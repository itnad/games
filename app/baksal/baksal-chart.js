// 런 채보: 방 4개 + 지박령 보스. 박 위치는 채보에 고정되어 있고, RNG는 방위 흔들림에만 쓴다.
// 방 사이에는 2마디(8박)의 부적 선택 구간이 있고 그동안 악귀는 나오지 않는다.

import { BEATS_PER_BAR, COUNT_IN_BEATS } from "./beat-clock.js";
import { GHOST_TYPES } from "./baksal-ghosts.js";
import { nextMudflatRandom, normalizeMudflatSeed } from "../mudflat-rng.js";

export const CHOICE_BEATS = 2 * BEATS_PER_BAR;
export const PURIFY_WINDOW_BEATS = 8;
export const STAGE_ZERO_BARS = 16;

// 방 구성: 각 항목은 { type, bar(방 안 시작 마디), bars(머무는 마디 수), azimuth, spread }
const ROOM_PLANS = Object.freeze([
  {
    name: "초입 골목",
    bars: 8,
    bpm: 80,
    ghosts: [
      { type: "dokkaebi-fire", bar: 0, bars: 4, azimuth: 0, spread: 25 },
      { type: "egg-ghost", bar: 4, bars: 4, azimuth: 180, spread: 30 },
    ],
  },
  {
    name: "그림자 마당",
    bars: 10,
    bpm: 80,
    ghosts: [
      { type: "geuseundae", bar: 0, bars: 5, azimuth: -60, spread: 20 },
      { type: "eodukshini", bar: 5, bars: 5, azimuth: 40, spread: 30 },
      { type: "dokkaebi-fire", bar: 6, bars: 4, azimuth: -50, spread: 20 },
    ],
  },
  {
    name: "우물가",
    bars: 10,
    bpm: 90,
    ghosts: [
      { type: "sonmalmyeong", bar: 0, bars: 4, azimuth: 20, spread: 25 },
      { type: "egg-ghost", bar: 2, bars: 4, azimuth: -150, spread: 30 },
      { type: "mongdal", bar: 6, bars: 4, azimuth: 0, spread: 40 },
    ],
  },
  {
    name: "물안개 다리",
    bars: 10,
    bpm: 100,
    ghosts: [
      { type: "mulgwishin", bar: 0, bars: 5, azimuth: 30, spread: 20 },
      { type: "eodukshini", bar: 1, bars: 4, azimuth: -120, spread: 30 },
      { type: "mongdal", bar: 5, bars: 5, azimuth: 150, spread: 30 },
      { type: "dokkaebi-fire", bar: 7, bars: 3, azimuth: -30, spread: 20 },
    ],
  },
]);

const BOSS_PLAN = Object.freeze({
  name: "장산 고개",
  bars: 24,
  bpm: 100,
  tempoShifts: [{ bar: 8, bpm: 110 }, { bar: 16, bpm: 120 }],
  ghosts: [
    { type: "jangsanbeom", bar: 0, bars: 24, azimuth: 0, spread: 60 },
    { type: "egg-ghost", bar: 12, bars: 4, azimuth: 120, spread: 20 },
    { type: "egg-ghost", bar: 12, bars: 4, azimuth: -120, spread: 20 },
  ],
});

function jitter(rngState, range) {
  const next = nextMudflatRandom(rngState);
  return { state: next.state, value: (next.value * 2 - 1) * range };
}

function buildGhost(spec, placement, spawnBeat, azimuth, idSuffix) {
  const lifetimeBars = placement.bars;
  const attacks = [];
  for (let bar = 0; bar < lifetimeBars; bar += 1) {
    const barStart = spawnBeat + bar * BEATS_PER_BAR;
    const pattern = spec.bars[bar % spec.bars.length];
    pattern.forEach((attack, index) => {
      attacks.push({
        id: `${idSuffix}-${bar}-${index}`,
        kind: attack.kind,
        gesture: attack.gesture,
        fireBeat: barStart + attack.beat,
        arriveBeat: barStart + attack.beat + attack.arrive,
      });
    });
  }
  return {
    id: idSuffix,
    type: spec.id,
    name: spec.name,
    grade: spec.grade,
    spawnBeat,
    leaveBeat: spawnBeat + lifetimeBars * BEATS_PER_BAR,
    azimuth,
    elevation: spec.elevation,
    distance: spec.distance,
    maxHp: spec.hp,
    orbitDegPerBar: spec.orbitDegPerBar ?? 0,
    hidden: Boolean(spec.hidden),
    mimic: Boolean(spec.mimic),
    weakPoint: spec.weakPoint ?? null,
    attacks,
  };
}

function buildRoom(plan, index, startBeat, rngState, isBoss) {
  let rng = rngState;
  const ghosts = [];
  plan.ghosts.forEach((placement, placementIndex) => {
    const spec = GHOST_TYPES[placement.type];
    const offset = jitter(rng, placement.spread);
    rng = offset.state;
    const spawnBeat = startBeat + placement.bar * BEATS_PER_BAR;
    const pack = spec.pack ?? 1;
    for (let member = 0; member < pack; member += 1) {
      const packOffset = pack > 1 ? (member - (pack - 1) / 2) * (360 / pack / 1.5) : 0;
      const ghost = buildGhost(spec, placement, spawnBeat, placement.azimuth + offset.value + packOffset, `r${index}-${placement.type}-${placementIndex}-${member}`);
      // 포위형 무리는 구성원마다 공격 박이 다르다: 패턴 시작 마디를 어긋나게 한다.
      if (pack > 1) {
        ghost.attacks = [];
        for (let bar = 0; bar < placement.bars; bar += 1) {
          const barStart = spawnBeat + bar * BEATS_PER_BAR;
          const pattern = spec.bars[(bar + member) % spec.bars.length];
          pattern.forEach((attack, attackIndex) => {
            ghost.attacks.push({
              id: `${ghost.id}-${bar}-${attackIndex}`,
              kind: attack.kind,
              gesture: attack.gesture,
              fireBeat: barStart + attack.beat,
              arriveBeat: barStart + attack.beat + attack.arrive,
            });
          });
        }
      }
      ghosts.push(ghost);
    }
  });
  return {
    room: {
      index,
      name: plan.name,
      boss: isBoss,
      bpm: plan.bpm,
      bars: plan.bars,
      startBeat,
      endBeat: startBeat + plan.bars * BEATS_PER_BAR,
      ghosts,
      tempoShifts: (plan.tempoShifts ?? []).map((shift) => ({ beat: startBeat + shift.bar * BEATS_PER_BAR, bpm: shift.bpm })),
    },
    rng,
  };
}

/**
 * 전체 런 채보. bpmBase는 1~2방 템포이고, 이후 방은 계획표의 상대 비율로 올라간다.
 * 70/80/90 선택은 전체 템포를 비례 조정한다.
 */
export function createRunChart(seed, { bpm = 80 } = {}) {
  const scale = bpm / 80;
  let rng = normalizeMudflatSeed(seed);
  const rooms = [];
  let cursor = 0;
  const plans = [...ROOM_PLANS, BOSS_PLAN];
  plans.forEach((plan, index) => {
    const scaledPlan = { ...plan, bpm: Math.round(plan.bpm * scale), tempoShifts: (plan.tempoShifts ?? []).map((shift) => ({ ...shift, bpm: Math.round(shift.bpm * scale) })) };
    const built = buildRoom(scaledPlan, index, cursor, rng, index === plans.length - 1);
    rng = built.rng;
    rooms.push(built.room);
    cursor = built.room.endBeat + (index === plans.length - 1 ? 0 : CHOICE_BEATS);
  });
  const segments = [{ beat: -COUNT_IN_BEATS, bpm: rooms[0].bpm }];
  for (const room of rooms) {
    if (segments[segments.length - 1].bpm !== room.bpm) segments.push({ beat: room.startBeat, bpm: room.bpm });
    for (const shift of room.tempoShifts) segments.push({ beat: shift.beat, bpm: shift.bpm });
  }
  return {
    id: "run-v1",
    seed: normalizeMudflatSeed(seed),
    bpm,
    rooms,
    segments,
    lengthBeats: rooms[rooms.length - 1].endBeat,
    ghosts: rooms.flatMap((room) => room.ghosts),
  };
}

export function chartBpmAtBeat(chart, beat) {
  let bpm = chart.segments[0].bpm;
  for (const segment of chart.segments) {
    if (beat >= segment.beat) bpm = segment.bpm;
    else break;
  }
  return bpm;
}

export function roomAtBeat(chart, beat) {
  for (const room of chart.rooms) {
    if (beat < room.endBeat) return room;
  }
  return chart.rooms[chart.rooms.length - 1];
}

/** 포위형은 마디마다 둘레를 돈다. 다른 악귀는 제자리다. */
export function ghostAzimuthAt(ghost, beat) {
  if (!ghost.orbitDegPerBar) return ghost.azimuth;
  const elapsed = Math.max(0, beat - ghost.spawnBeat) / BEATS_PER_BAR;
  return ghost.azimuth + ghost.orbitDegPerBar * elapsed;
}

/** 0단계 호환: 방 1개짜리 채보. 테스트와 비교 실험에 쓴다. */
export function createStageZeroChart(seed, { bpm = 80 } = {}) {
  const chart = createRunChart(seed, { bpm });
  const room = chart.rooms[0];
  const second = chart.rooms[1];
  const ghosts = [...room.ghosts, ...second.ghosts.map((ghost) => ({
    ...ghost,
    spawnBeat: ghost.spawnBeat - (second.startBeat - room.endBeat),
    leaveBeat: ghost.leaveBeat - (second.startBeat - room.endBeat),
    attacks: ghost.attacks.map((attack) => ({
      ...attack,
      fireBeat: attack.fireBeat - (second.startBeat - room.endBeat),
      arriveBeat: attack.arriveBeat - (second.startBeat - room.endBeat),
    })),
  }))];
  const single = { ...room, index: 0, name: "검증 방", bars: room.bars + second.bars, endBeat: room.startBeat + (room.bars + second.bars) * BEATS_PER_BAR, ghosts, tempoShifts: [] };
  return {
    id: "stage-zero",
    seed: chart.seed,
    bpm,
    rooms: [single],
    segments: [{ beat: -COUNT_IN_BEATS, bpm }],
    lengthBeats: single.endBeat,
    ghosts,
  };
}
