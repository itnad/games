// 런 엔진: 박(실수) 기준으로 악귀·공격·판정을 처리한다. 브라우저 API를 쓰지 않는 순수 모듈이다.
// 시간 단위는 전부 "박"이다. 호출자가 오디오 클럭에서 박을 계산해 넘긴다.

import {
  BEATS_PER_BAR,
  JUDGMENT_DAMAGE_MULTIPLIER,
  JUDGMENT_WINDOWS_MS,
  judgeOffset,
  nearestBarStartOffset,
  nearestBeatOffset,
  secondsPerBeat,
} from "./beat-clock.js";
import { AIM_ASSIST_RADIUS_DEG, angularDistanceDeg, wrapDegrees } from "./aim-projection.js";
import { PURIFY_WINDOW_BEATS } from "./baksal-chart.js";

export const PLAYER_MAX_HP = 5;
export const SCORE = Object.freeze({ ttak: 100, joa: 50, miss: 10, dodge: 80, destroy: 120, purify: 300, comboStep: 5, comboCap: 20 });
export const RUN_TAIL_BEATS = BEATS_PER_BAR;

const PROJECTILE_OFFSETS = Object.freeze({
  duck: { azimuth: 0, elevation: 26 },
  left: { azimuth: -14, elevation: -4 },
  right: { azimuth: 14, elevation: -4 },
  back: { azimuth: 0, elevation: 2 },
});

export function createRun(chart, { windows = "standard" } = {}) {
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
    dodges: { ok: 0, fail: 0, wrong: 0 },
    destroyed: 0,
    purified: 0,
    missedPurify: 0,
    shotsFired: 0,
    ghosts: chart.ghosts.map((ghost) => ({ ...ghost, hp: ghost.maxHp, status: "waiting", purifiableUntil: null, activated: new Set() })),
    projectiles: [],
    finished: false,
    failed: false,
  };
}

function windowsOf(state) {
  return JUDGMENT_WINDOWS_MS[state.windows];
}

function beatsForMs(state, ms) {
  return ms / 1000 / secondsPerBeat(state.chart.bpm);
}

function addCombo(state) {
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
}

function comboBonus(state) {
  return Math.min(SCORE.comboCap, state.combo) * SCORE.comboStep;
}

export function aliveGhosts(state) {
  return state.ghosts.filter((ghost) => ghost.status === "alive");
}

export function flyingProjectiles(state) {
  return state.projectiles.filter((projectile) => projectile.status === "flying");
}

/** 투사체의 현재 구면 위치. 악귀 위치에서 플레이어 몸 쪽으로 다가온다. */
export function projectilePosition(state, projectile, beat) {
  const ghost = state.ghosts.find((candidate) => candidate.id === projectile.ghostId);
  const span = Math.max(0.001, projectile.arriveBeat - projectile.fireBeat);
  const progress = Math.max(0, Math.min(1, (beat - projectile.fireBeat) / span));
  const offset = PROJECTILE_OFFSETS[projectile.gesture] ?? PROJECTILE_OFFSETS.back;
  const distance = ghost.distance * (1 - progress) + 0.9 * progress;
  return {
    azimuth: wrapDegrees(ghost.azimuth + offset.azimuth * progress),
    elevation: ghost.elevation + (offset.elevation - ghost.elevation) * progress,
    distance,
    progress,
  };
}

/** 시간을 앞으로 보낸다. 발생한 사건 목록을 돌려준다. */
export function advanceRun(state, beat) {
  const events = [];
  if (state.finished) return events;
  state.beat = beat;
  const joaBeats = beatsForMs(state, windowsOf(state).joa);

  for (const ghost of state.ghosts) {
    if (ghost.status === "waiting" && beat >= ghost.spawnBeat) {
      ghost.status = "alive";
      events.push({ type: "spawn", ghostId: ghost.id, name: ghost.name });
    }
    if (ghost.status === "alive") {
      for (const attack of ghost.attacks) {
        if (ghost.activated.has(attack.id) || beat < attack.fireBeat) continue;
        ghost.activated.add(attack.id);
        state.projectiles.push({ ...attack, ghostId: ghost.id, status: "flying" });
        events.push({ type: "cue", ghostId: ghost.id, projectileId: attack.id, gesture: attack.gesture, kind: attack.kind });
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
    if (beat > projectile.arriveBeat + joaBeats) {
      projectile.status = "hit";
      state.hp = Math.max(0, state.hp - 1);
      state.dodges.fail += 1;
      state.combo = 0;
      events.push({ type: "player-hit", projectileId: projectile.id, gesture: projectile.gesture, hp: state.hp });
    }
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
  const judgment = judgeOffset(nearestBeatOffset(beat, state.chart.bpm).offsetMs, windowsOf(state));
  const multiplier = JUDGMENT_DAMAGE_MULTIPLIER[judgment];

  const projectileTarget = nearestTarget(
    flyingProjectiles(state).map((projectile) => ({ kind: "projectile", target: projectile, position: projectilePosition(state, projectile, beat) })),
    aim,
    AIM_ASSIST_RADIUS_DEG,
  );
  const ghostTarget = nearestTarget(
    aliveGhosts(state).map((ghost) => ({ kind: "ghost", target: ghost, position: ghost })),
    aim,
    AIM_ASSIST_RADIUS_DEG,
  );
  const chosen = projectileTarget ?? ghostTarget;
  if (!chosen) return { judgment, hit: null };

  state.counts[judgment] += 1;
  if (judgment === "miss") state.combo = 0;
  else addCombo(state);
  state.score += SCORE[judgment] + (judgment === "miss" ? 0 : comboBonus(state));

  if (chosen.kind === "projectile") {
    if (multiplier >= 1) {
      chosen.target.status = "destroyed";
      state.destroyed += 1;
      state.score += SCORE.destroy;
      return { judgment, hit: "projectile", destroyed: true, targetId: chosen.target.id };
    }
    return { judgment, hit: "projectile", destroyed: false, targetId: chosen.target.id };
  }

  const ghost = chosen.target;
  ghost.hp = Math.max(0, ghost.hp - multiplier);
  if (ghost.hp <= 0) {
    ghost.status = "purifiable";
    ghost.purifiableUntil = beat + PURIFY_WINDOW_BEATS;
    return { judgment, hit: "ghost", killed: true, targetId: ghost.id };
  }
  return { judgment, hit: "ghost", killed: false, targetId: ghost.id };
}

/** 회피 동작. 도착 박 창 안의 투사체 중 동작이 맞는 것을 피한다. */
export function dodgeRun(state, beat, gesture) {
  if (state.finished) return { matched: false, reason: "finished" };
  const windows = windowsOf(state);
  const joaBeats = beatsForMs(state, windows.joa);
  const inWindow = flyingProjectiles(state).filter((projectile) => Math.abs(beat - projectile.arriveBeat) <= joaBeats);
  if (inWindow.length === 0) return { matched: false, reason: "no-projectile" };
  const match = inWindow
    .filter((projectile) => projectile.gesture === gesture)
    .sort((a, b) => Math.abs(beat - a.arriveBeat) - Math.abs(beat - b.arriveBeat))[0];
  if (!match) {
    state.dodges.wrong += 1;
    return { matched: false, reason: "wrong-gesture", expected: inWindow[0].gesture };
  }
  const offsetMs = (beat - match.arriveBeat) * secondsPerBeat(state.chart.bpm) * 1000;
  const judgment = judgeOffset(offsetMs, windows);
  match.status = "dodged";
  state.dodges.ok += 1;
  addCombo(state);
  state.score += SCORE.dodge + comboBonus(state);
  return { matched: true, judgment, projectileId: match.id };
}

/** 정화. 마디 첫 박에만 되고, 조준한 정화 가능 악귀가 있어야 한다. */
export function purifyRun(state, beat, aim) {
  if (state.finished) return { ok: false, reason: "finished" };
  const judgment = judgeOffset(nearestBarStartOffset(beat, state.chart.bpm).offsetMs, windowsOf(state));
  const target = nearestTarget(
    state.ghosts.filter((ghost) => ghost.status === "purifiable").map((ghost) => ({ kind: "ghost", target: ghost, position: ghost })),
    aim,
    AIM_ASSIST_RADIUS_DEG,
  );
  if (!target) return { ok: false, reason: "no-target", judgment };
  if (judgment === "miss") return { ok: false, reason: "beat", judgment, targetId: target.target.id };
  target.target.status = "purified";
  state.purified += 1;
  addCombo(state);
  state.score += SCORE.purify + comboBonus(state);
  return { ok: true, judgment, targetId: target.target.id, name: target.target.name };
}

/** 오디오 예약용: [fromBeat, toBeat) 안에서 울려야 하는 신호. 살아 있는 악귀의 것만 돌려준다. */
export function cuesBetween(state, fromBeat, toBeat) {
  const cues = [];
  for (const ghost of state.ghosts) {
    if (ghost.status === "gone" || ghost.status === "purified") continue;
    if (ghost.spawnBeat >= fromBeat && ghost.spawnBeat < toBeat) {
      cues.push({ type: "spawn", beat: ghost.spawnBeat, ghostId: ghost.id, azimuth: ghost.azimuth, name: ghost.name });
    }
    if (ghost.status === "purifiable") continue;
    for (const attack of ghost.attacks) {
      if (attack.fireBeat >= fromBeat && attack.fireBeat < toBeat) {
        cues.push({ type: "fire", beat: attack.fireBeat, ghostId: ghost.id, azimuth: ghost.azimuth, gesture: attack.gesture, kind: attack.kind });
      }
      if (attack.arriveBeat >= fromBeat && attack.arriveBeat < toBeat) {
        const projectile = state.projectiles.find((candidate) => candidate.id === attack.id);
        if (!projectile || projectile.status === "flying") {
          cues.push({ type: "arrive", beat: attack.arriveBeat, ghostId: ghost.id, azimuth: ghost.azimuth, gesture: attack.gesture, kind: attack.kind });
        }
      }
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
    hp: state.hp,
    failed: state.failed,
  };
}
