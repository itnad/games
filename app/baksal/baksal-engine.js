// 런 엔진: 박(실수) 기준으로 방·악귀·공격·판정·부적을 처리한다. 브라우저 API를 쓰지 않는 순수 모듈이다.
// 시간 단위는 전부 "박"이다. 호출자가 오디오 클럭에서 박을 계산해 넘긴다.

import {
  BEATS_PER_BAR,
  JUDGMENT_DAMAGE_MULTIPLIER,
  JUDGMENT_WINDOWS_MS,
  judgeOffset,
  nearestBeatOffset,
  secondsPerBeat,
} from "./beat-clock.js";
import { angularDistanceDeg, lanternVisibility, wrapDegrees } from "./aim-projection.js";
import { CHOICE_BEATS, PURIFY_WINDOW_BEATS, chartBpmAtBeat, ghostAzimuthAt, roomAtBeat } from "./baksal-chart.js";
import { TALISMANS, defaultModifiers, offerTalismans, BASE_TALISMAN_IDS } from "./baksal-talismans.js";

export const PLAYER_MAX_HP = 5;
export const BASE_SHIELDS = 1;
export const SHIELD_BEATS = 1;
export const STAGGER_BEATS = 4;
export const CURSE_BEATS = 4;
export const SCORE = Object.freeze({ ttak: 100, joa: 50, miss: 10, dodge: 80, destroy: 120, purify: 300, weak: 60, comboCap: 20 });
export const RUN_TAIL_BEATS = BEATS_PER_BAR;

const PROJECTILE_OFFSETS = Object.freeze({
  duck: { azimuth: 0, elevation: 26 },
  left: { azimuth: -14, elevation: -4 },
  right: { azimuth: 14, elevation: -4 },
  back: { azimuth: 0, elevation: 2 },
  curse: { azimuth: 0, elevation: 6 },
});

function emptyRoomStats() {
  return { ttak: 0, joa: 0, miss: 0, dodgeOk: 0, dodgeFail: 0, purified: 0, hits: 0, cursed: 0, blocked: 0 };
}

export function createRun(chart, { windows = "standard", unlockedTalismans = BASE_TALISMAN_IDS, mastery = {} } = {}) {
  const ghostStats = {};
  return {
    chart,
    windows: JUDGMENT_WINDOWS_MS[windows] ? windows : "standard",
    beat: -Infinity,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    score: 0,
    combo: 0,
    maxCombo: 0,
    counts: { ttak: 0, joa: 0, miss: 0 },
    dodges: { ok: 0, fail: 0, wrong: 0, blocked: 0 },
    destroyed: 0,
    purified: 0,
    missedPurify: 0,
    shotsFired: 0,
    weakHits: 0,
    cursedCount: 0,
    ghosts: chart.ghosts.map((ghost) => ({ ...ghost, hp: ghost.maxHp, status: "waiting", purifiableUntil: null, staggerUntil: -Infinity, activated: new Set() })),
    projectiles: [],
    phase: "room",
    roomIndex: 0,
    roomsCleared: 0,
    roomStats: chart.rooms.map(() => emptyRoomStats()),
    ghostStats,
    choice: null,
    talismans: [],
    modifiers: defaultModifiers(),
    active: null,
    torchUntil: -Infinity,
    cleanseUntil: -Infinity,
    shieldsLeft: BASE_SHIELDS,
    shieldUntil: -Infinity,
    curse: { shakeUntil: -Infinity, blurUntil: -Infinity },
    comboShieldsLeft: 0,
    unlockedTalismans: [...unlockedTalismans],
    mastery: { ...mastery },
    rng: chart.seed ^ 0x5bd1e995,
    finished: false,
    failed: false,
  };
}

function windowsOf(state) {
  return JUDGMENT_WINDOWS_MS[state.windows];
}

function bpmAt(state, beat) {
  return chartBpmAtBeat(state.chart, beat);
}

function beatsForMs(state, beat, ms) {
  return ms / 1000 / secondsPerBeat(bpmAt(state, beat));
}

function addCombo(state) {
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
}

function breakCombo(state) {
  if (state.comboShieldsLeft > 0) {
    state.comboShieldsLeft -= 1;
    return true;
  }
  state.combo = 0;
  return false;
}

function comboBonus(state) {
  return Math.min(SCORE.comboCap, state.combo) * state.modifiers.comboStep;
}

function statsAt(state, beat) {
  const room = roomAtBeat(state.chart, beat);
  return state.roomStats[room.index];
}

export function currentRoom(state) {
  return state.chart.rooms[Math.min(state.roomIndex, state.chart.rooms.length - 1)];
}

export function aliveGhosts(state) {
  return state.ghosts.filter((ghost) => ghost.status === "alive");
}

export function flyingProjectiles(state) {
  return state.projectiles.filter((projectile) => projectile.status === "flying");
}

export function ghostPosition(state, ghost, beat) {
  return { azimuth: wrapDegrees(ghostAzimuthAt(ghost, beat)), elevation: ghost.elevation, distance: ghost.distance };
}

export function weakPointPosition(state, ghost, beat) {
  const base = ghostPosition(state, ghost, beat);
  if (!ghost.weakPoint) return base;
  return { azimuth: wrapDegrees(base.azimuth + ghost.weakPoint.azimuth), elevation: base.elevation + ghost.weakPoint.elevation, distance: base.distance };
}

export function isTorchActive(state, beat) {
  return beat < state.torchUntil;
}

/** 등롱 규칙에 따른 선명도. 은신 악귀는 등롱 가장자리에서만, 횃불·맑은 불이면 어디서나 보인다. */
export function ghostVisibility(state, ghost, aim, beat) {
  const cone = state.modifiers.lanternConeDeg;
  const position = ghostPosition(state, ghost, beat);
  const torch = isTorchActive(state, beat);
  const base = torch ? Math.max(0.9, lanternVisibility(aim, position, cone + 40)) : lanternVisibility(aim, position, cone);
  if (!ghost.hidden || state.modifiers.revealHidden || torch) return base;
  const half = cone / 2;
  const distance = angularDistanceDeg(aim, position);
  if (distance > half || distance < half * 0.45) return 0;
  const center = half * 0.75;
  return Math.max(0.2, 1 - Math.abs(distance - center) / (half * 0.3));
}

/** 레이더에 찍을 방위. 흉내 내는 악귀는 보이기 전까지 소리 나는 반대쪽에 찍힌다. */
export function radarAzimuth(state, ghost, aim, beat) {
  const position = ghostPosition(state, ghost, beat);
  if (ghost.mimic && ghostVisibility(state, ghost, aim, beat) <= 0.05) return wrapDegrees(position.azimuth + 180);
  return position.azimuth;
}

/** 투사체의 현재 구면 위치. 발사 시점의 악귀 위치에서 플레이어 몸 쪽으로 다가온다. */
export function projectilePosition(state, projectile, beat) {
  const span = Math.max(0.001, projectile.arriveBeat - projectile.fireBeat);
  const progress = Math.max(0, Math.min(1, (beat - projectile.fireBeat) / span));
  const key = projectile.kind === "curse" ? "curse" : projectile.gesture;
  const offset = PROJECTILE_OFFSETS[key] ?? PROJECTILE_OFFSETS.back;
  const distance = projectile.originDistance * (1 - progress) + 0.9 * progress;
  return {
    azimuth: wrapDegrees(projectile.originAzimuth + offset.azimuth * progress),
    elevation: projectile.originElevation + (offset.elevation - projectile.originElevation) * progress,
    distance,
    progress,
  };
}

function openChoice(state, beat, roomIndexCompleted) {
  const owned = state.talismans;
  const offer = offerTalismans(state.rng, { unlocked: state.unlockedTalismans, owned, activeId: state.active?.id ?? null });
  state.rng = offer.state;
  state.phase = "choice";
  state.choice = { offered: offer.offered, deadlineBeat: beat + CHOICE_BEATS, forRoom: roomIndexCompleted + 1 };
}

/** 부적 선택. 후보에 없는 id는 거부한다. 발동형은 왼손 슬롯을 대체한다. */
export function chooseTalisman(state, id) {
  if (state.phase !== "choice" || !state.choice) return { ok: false, reason: "no-choice" };
  if (!state.choice.offered.includes(id)) return { ok: false, reason: "not-offered" };
  const talisman = TALISMANS[id];
  if (talisman.active) {
    state.active = { id, usesLeft: talisman.active.uses, effect: talisman.active.effect, beats: talisman.active.beats };
  } else {
    state.talismans.push(id);
    const before = state.modifiers;
    state.modifiers = talisman.apply(before);
    state.maxHp = PLAYER_MAX_HP + state.modifiers.maxHpBonus;
    if (state.modifiers.healOnPick) {
      state.hp = Math.min(state.maxHp, state.hp + state.modifiers.healOnPick);
      state.modifiers = { ...state.modifiers, healOnPick: 0 };
    }
    if (state.modifiers.comboShields > before.comboShields) state.comboShieldsLeft += state.modifiers.comboShields - before.comboShields;
    if (state.modifiers.shieldBonus > before.shieldBonus) state.shieldsLeft += state.modifiers.shieldBonus - before.shieldBonus;
  }
  state.phase = "room";
  state.roomIndex = state.choice.forRoom;
  state.choice = null;
  return { ok: true, id, name: talisman.name, active: Boolean(talisman.active) };
}

/** 시간을 앞으로 보낸다. 발생한 사건 목록을 돌려준다. */
export function advanceRun(state, beat) {
  const events = [];
  if (state.finished) return events;
  state.beat = beat;

  if (state.phase === "choice" && state.choice && beat >= state.choice.deadlineBeat) {
    const auto = chooseTalisman(state, state.choice.offered[0]);
    if (auto.ok) events.push({ type: "talisman-auto", id: auto.id, name: auto.name });
  }
  const room = currentRoom(state);
  if (state.phase === "room" && beat >= room.endBeat) {
    state.roomsCleared = Math.max(state.roomsCleared, room.index + 1);
    if (room.boss || room.index === state.chart.rooms.length - 1) {
      state.finished = true;
      events.push({ type: "room-clear", roomIndex: room.index, name: room.name });
      events.push({ type: "finished", failed: false });
      return events;
    }
    openChoice(state, room.endBeat, room.index);
    events.push({ type: "room-clear", roomIndex: room.index, name: room.name });
    events.push({ type: "choice", offered: [...state.choice.offered], deadlineBeat: state.choice.deadlineBeat });
  }

  const joaBeats = beatsForMs(state, beat, windowsOf(state).joa + state.modifiers.dodgeWindowBonusMs);

  for (const ghost of state.ghosts) {
    if (ghost.status === "waiting" && beat >= ghost.spawnBeat) {
      ghost.status = "alive";
      state.ghostStats[ghost.type] = state.ghostStats[ghost.type] ?? { seen: 0, purified: 0 };
      state.ghostStats[ghost.type].seen += 1;
      events.push({ type: "spawn", ghostId: ghost.id, name: ghost.name, ghostType: ghost.type, mimic: ghost.mimic, hidden: ghost.hidden });
    }
    if (ghost.status === "alive") {
      for (const attack of ghost.attacks) {
        if (ghost.activated.has(attack.id) || beat < attack.fireBeat) continue;
        ghost.activated.add(attack.id);
        if (attack.fireBeat < ghost.staggerUntil) continue;
        const origin = ghostPosition(state, ghost, attack.fireBeat);
        state.projectiles.push({
          ...attack,
          ghostId: ghost.id,
          status: "flying",
          originAzimuth: origin.azimuth,
          originElevation: origin.elevation,
          originDistance: origin.distance,
        });
        events.push({ type: "cue", ghostId: ghost.id, projectileId: attack.id, gesture: attack.gesture, kind: attack.kind, arriveBeat: attack.arriveBeat });
      }
      if (beat >= ghost.leaveBeat) {
        ghost.status = "gone";
        events.push({ type: "leave", ghostId: ghost.id, name: ghost.name });
      }
    }
    if (ghost.status === "purifiable" && beat > ghost.purifiableUntil) {
      ghost.status = "gone";
      state.missedPurify += 1;
      events.push({ type: "purify-expired", ghostId: ghost.id, name: ghost.name });
    }
  }

  for (const projectile of state.projectiles) {
    if (projectile.status !== "flying") continue;
    const ghost = state.ghosts.find((candidate) => candidate.id === projectile.ghostId);
    if (ghost.status !== "alive") {
      projectile.status = "void";
      continue;
    }
    if (beat <= projectile.arriveBeat + joaBeats) continue;
    const stats = statsAt(state, projectile.arriveBeat);
    if (projectile.kind === "curse") {
      if (beat < state.cleanseUntil || projectile.arriveBeat < state.cleanseUntil) {
        projectile.status = "void";
        events.push({ type: "curse-resisted", projectileId: projectile.id });
        continue;
      }
      projectile.status = "hit";
      state.curse = { shakeUntil: projectile.arriveBeat + CURSE_BEATS, blurUntil: projectile.arriveBeat + CURSE_BEATS };
      state.cursedCount += 1;
      stats.cursed += 1;
      breakCombo(state);
      events.push({ type: "cursed", projectileId: projectile.id, until: state.curse.shakeUntil });
      continue;
    }
    if (projectile.arriveBeat <= state.shieldUntil && projectile.arriveBeat >= state.shieldUntil - SHIELD_BEATS) {
      projectile.status = "blocked";
      state.dodges.blocked += 1;
      stats.blocked += 1;
      events.push({ type: "blocked", projectileId: projectile.id });
      continue;
    }
    projectile.status = "hit";
    state.hp = Math.max(0, state.hp - 1);
    state.dodges.fail += 1;
    stats.dodgeFail += 1;
    stats.hits += 1;
    breakCombo(state);
    events.push({ type: "player-hit", projectileId: projectile.id, gesture: projectile.gesture, hp: state.hp });
  }

  if (state.hp <= 0) {
    state.finished = true;
    state.failed = true;
    events.push({ type: "finished", failed: true });
  } else if (beat >= state.chart.lengthBeats + RUN_TAIL_BEATS) {
    state.finished = true;
    events.push({ type: "finished", failed: false });
  }
  return events;
}

function nearestTarget(candidates, aim, radius) {
  let best = null;
  for (const candidate of candidates) {
    const distance = angularDistanceDeg(aim, candidate.position);
    if (distance <= radius && (!best || distance < best.distance)) best = { ...candidate, distance };
  }
  return best;
}

/** 사격. 박 판정은 목표가 있을 때만 기록한다. 빈 곳에 쏘면 벌칙이 없다. */
export function shootRun(state, beat, aim) {
  if (state.finished) return { judgment: null, hit: null };
  state.shotsFired += 1;
  const judgment = judgeOffset(nearestBeatOffset(beat, bpmAt(state, beat)).offsetMs, windowsOf(state));
  let multiplier = JUDGMENT_DAMAGE_MULTIPLIER[judgment];
  if (judgment === "joa" && state.modifiers.joaDoubles) multiplier = 2;
  const radius = state.modifiers.aimAssistDeg;

  const projectileTarget = nearestTarget(
    flyingProjectiles(state).map((projectile) => ({ kind: "projectile", target: projectile, position: projectilePosition(state, projectile, beat) })),
    aim,
    radius,
  );
  const ghostTarget = nearestTarget(
    aliveGhosts(state)
      .filter((ghost) => !ghost.hidden || ghostVisibility(state, ghost, aim, beat) > 0)
      .map((ghost) => ({ kind: "ghost", target: ghost, position: ghostPosition(state, ghost, beat) })),
    aim,
    radius,
  );
  const chosen = projectileTarget ?? ghostTarget;
  if (!chosen) return { judgment, hit: null };

  const stats = statsAt(state, beat);
  state.counts[judgment] += 1;
  stats[judgment] += 1;
  if (judgment === "miss") breakCombo(state);
  else addCombo(state);
  state.score += SCORE[judgment] + (judgment === "miss" ? 0 : comboBonus(state));

  if (chosen.kind === "projectile") {
    if (multiplier >= 1) {
      chosen.target.status = "destroyed";
      state.destroyed += 1;
      state.score += SCORE.destroy;
      return { judgment, hit: "projectile", destroyed: true, targetId: chosen.target.id, kind: chosen.target.kind };
    }
    return { judgment, hit: "projectile", destroyed: false, targetId: chosen.target.id, kind: chosen.target.kind };
  }

  const ghost = chosen.target;
  let weak = false;
  if (ghost.weakPoint && judgment !== "miss") {
    const weakDistance = angularDistanceDeg(aim, weakPointPosition(state, ghost, beat));
    if (weakDistance <= state.modifiers.weakPointDeg) {
      weak = true;
      multiplier *= 1 + state.modifiers.weakPointBonus;
      ghost.staggerUntil = beat + STAGGER_BEATS;
      state.weakHits += 1;
      state.score += SCORE.weak;
    }
  }
  ghost.hp = Math.max(0, ghost.hp - multiplier);
  if (ghost.hp <= 0) {
    ghost.status = "purifiable";
    ghost.purifiableUntil = beat + PURIFY_WINDOW_BEATS;
    return { judgment, hit: "ghost", killed: true, weak, targetId: ghost.id, name: ghost.name };
  }
  return { judgment, hit: "ghost", killed: false, weak, targetId: ghost.id, name: ghost.name };
}

/** 회피 동작. 도착 박 창 안의 투사체 중 동작이 맞는 것을 피한다. 저주 파동은 피할 수 없다. */
export function dodgeRun(state, beat, gesture) {
  if (state.finished) return { matched: false, reason: "finished" };
  const windows = windowsOf(state);
  const joaBeats = beatsForMs(state, beat, windows.joa + state.modifiers.dodgeWindowBonusMs);
  const inWindow = flyingProjectiles(state).filter((projectile) => projectile.gesture && Math.abs(beat - projectile.arriveBeat) <= joaBeats);
  if (inWindow.length === 0) return { matched: false, reason: "no-projectile" };
  const match = inWindow
    .filter((projectile) => projectile.gesture === gesture)
    .sort((a, b) => Math.abs(beat - a.arriveBeat) - Math.abs(beat - b.arriveBeat))[0];
  if (!match) {
    state.dodges.wrong += 1;
    return { matched: false, reason: "wrong-gesture", expected: inWindow[0].gesture };
  }
  const offsetMs = (beat - match.arriveBeat) * secondsPerBeat(bpmAt(state, beat)) * 1000;
  const judgment = judgeOffset(offsetMs, { ttak: windows.ttak, joa: windows.joa + state.modifiers.dodgeWindowBonusMs });
  match.status = "dodged";
  state.dodges.ok += 1;
  statsAt(state, beat).dodgeOk += 1;
  addCombo(state);
  state.score += SCORE.dodge + comboBonus(state);
  return { matched: true, judgment, projectileId: match.id };
}

function nearestPurifyOffset(state, beat) {
  const bpm = bpmAt(state, beat);
  let best = null;
  for (const allowed of state.modifiers.purifyBeats) {
    const nearestBar = Math.round((beat - allowed) / BEATS_PER_BAR) * BEATS_PER_BAR + allowed;
    const offsetMs = (beat - nearestBar) * secondsPerBeat(bpm) * 1000;
    if (!best || Math.abs(offsetMs) < Math.abs(best.offsetMs)) best = { beat: nearestBar, offsetMs };
  }
  return best;
}

/** 정화. 허용된 박(기본은 마디 첫 박)에만 되고, 조준한 정화 가능 악귀가 있어야 한다. */
export function purifyRun(state, beat, aim) {
  if (state.finished) return { ok: false, reason: "finished" };
  const judgment = judgeOffset(nearestPurifyOffset(state, beat).offsetMs, windowsOf(state));
  const target = nearestTarget(
    state.ghosts.filter((ghost) => ghost.status === "purifiable").map((ghost) => ({ kind: "ghost", target: ghost, position: ghostPosition(state, ghost, beat) })),
    aim,
    state.modifiers.aimAssistDeg,
  );
  if (!target) return { ok: false, reason: "no-target", judgment };
  if (judgment === "miss") return { ok: false, reason: "beat", judgment, targetId: target.target.id };
  target.target.status = "purified";
  state.purified += 1;
  statsAt(state, beat).purified += 1;
  state.ghostStats[target.target.type] = state.ghostStats[target.target.type] ?? { seen: 0, purified: 0 };
  state.ghostStats[target.target.type].purified += 1;
  addCombo(state);
  state.score += SCORE.purify + comboBonus(state);
  return { ok: true, judgment, targetId: target.target.id, name: target.target.name, ghostType: target.target.type };
}

/** 긴급 결계: 1박 동안 도착하는 공격을 막는다. 저주 파동은 막지 못한다. */
export function shieldRun(state, beat) {
  if (state.finished || state.phase !== "room") return { ok: false, reason: "phase" };
  if (beat < state.shieldUntil) return { ok: false, reason: "active" };
  if (state.shieldsLeft <= 0) return { ok: false, reason: "none-left" };
  state.shieldsLeft -= 1;
  state.shieldUntil = beat + SHIELD_BEATS;
  return { ok: true, until: state.shieldUntil, left: state.shieldsLeft };
}

/** 왼손 발동형 부적. */
export function activateTalisman(state, beat, aim) {
  if (state.finished || !state.active) return { ok: false, reason: "none" };
  if (state.active.usesLeft <= 0) return { ok: false, reason: "used-up" };
  const active = state.active;
  if (active.effect === "torch") {
    if (isTorchActive(state, beat)) return { ok: false, reason: "active" };
    state.torchUntil = beat + active.beats;
  } else if (active.effect === "cleanse") {
    state.curse = { shakeUntil: -Infinity, blurUntil: -Infinity };
    state.cleanseUntil = beat + active.beats;
  } else if (active.effect === "salt-throw") {
    let count = 0;
    for (const projectile of flyingProjectiles(state)) {
      const position = projectilePosition(state, projectile, beat);
      if (angularDistanceDeg(aim, position) <= state.modifiers.lanternConeDeg / 2) {
        projectile.status = "destroyed";
        count += 1;
      }
    }
    if (count === 0) return { ok: false, reason: "no-target" };
    state.destroyed += count;
    state.score += SCORE.destroy * count;
  }
  active.usesLeft -= 1;
  return { ok: true, effect: active.effect, left: active.usesLeft };
}

export function isCursed(state, beat) {
  return beat < state.curse.shakeUntil || beat < state.curse.blurUntil;
}

/** 오디오 예약용: [fromBeat, toBeat) 안에서 울려야 하는 신호. 살아 있는 악귀의 것만 돌려준다. */
export function cuesBetween(state, fromBeat, toBeat) {
  const cues = [];
  for (const ghost of state.ghosts) {
    if (ghost.status === "gone" || ghost.status === "purified") continue;
    const cueAzimuth = (beat) => {
      const azimuth = ghostAzimuthAt(ghost, beat);
      return wrapDegrees(ghost.mimic ? azimuth + 180 : azimuth);
    };
    if (ghost.spawnBeat >= fromBeat && ghost.spawnBeat < toBeat) {
      cues.push({ type: "spawn", beat: ghost.spawnBeat, ghostId: ghost.id, ghostType: ghost.type, azimuth: cueAzimuth(ghost.spawnBeat), name: ghost.name, grade: ghost.grade });
    }
    if (ghost.status === "purifiable") continue;
    for (const attack of ghost.attacks) {
      if (attack.fireBeat < ghost.staggerUntil) continue;
      if (attack.fireBeat >= fromBeat && attack.fireBeat < toBeat) {
        cues.push({ type: "fire", beat: attack.fireBeat, ghostId: ghost.id, azimuth: cueAzimuth(attack.fireBeat), gesture: attack.gesture, kind: attack.kind });
      }
      if (attack.arriveBeat >= fromBeat && attack.arriveBeat < toBeat) {
        const projectile = state.projectiles.find((candidate) => candidate.id === attack.id);
        if (!projectile || projectile.status === "flying") {
          cues.push({ type: "arrive", beat: attack.arriveBeat, ghostId: ghost.id, azimuth: cueAzimuth(attack.arriveBeat), gesture: attack.gesture, kind: attack.kind });
        }
      }
    }
  }
  for (const room of state.chart.rooms) {
    if (room.startBeat >= fromBeat && room.startBeat < toBeat && room.index > 0) {
      cues.push({ type: "room", beat: room.startBeat, roomIndex: room.index, name: room.name, boss: room.boss });
    }
  }
  return cues.sort((a, b) => a.beat - b.beat);
}

export function summarizeRun(state) {
  const judged = state.counts.ttak + state.counts.joa + state.counts.miss;
  return {
    score: state.score,
    maxCombo: state.maxCombo,
    counts: { ...state.counts },
    judged,
    ttakRate: judged ? state.counts.ttak / judged : 0,
    dodges: { ...state.dodges },
    destroyed: state.destroyed,
    purified: state.purified,
    missedPurify: state.missedPurify,
    shotsFired: state.shotsFired,
    weakHits: state.weakHits,
    cursedCount: state.cursedCount,
    hp: state.hp,
    maxHp: state.maxHp,
    failed: state.failed,
    roomsCleared: state.roomsCleared,
    roomStats: state.roomStats.map((stats, index) => ({ ...stats, name: state.chart.rooms[index].name, boss: state.chart.rooms[index].boss })),
    ghostStats: Object.fromEntries(Object.entries(state.ghostStats).map(([type, counts]) => [type, { ...counts }])),
    talismans: [...state.talismans, ...(state.active ? [state.active.id] : [])],
    bpm: state.chart.bpm,
  };
}
