// 0단계 채보: 방 1개, 16마디. 악귀 패턴은 코드가 아니라 데이터로 적는다.
// 박 위치는 채보에 고정되어 있고, RNG는 "무작위 허용" 칸(방위 흔들림)에만 쓴다.

import { BEATS_PER_BAR } from "./beat-clock.js";
import { nextMudflatRandom, normalizeMudflatSeed } from "../mudflat-rng.js";

export const GHOST_TYPES = Object.freeze({
  "dokkaebi-fire": Object.freeze({
    id: "dokkaebi-fire",
    name: "도깨비불",
    behavior: "투사형",
    hp: 3,
    elevation: 12,
    distance: 6,
    color: "#ff9a3c",
    attack: Object.freeze({ kind: "fire", fireBeat: 0, arriveBeat: 2 }),
    heights: Object.freeze(["duck", "left", "right", "duck"]),
  }),
  "egg-ghost": Object.freeze({
    id: "egg-ghost",
    name: "달걀귀신",
    behavior: "급습형",
    hp: 2,
    elevation: 0,
    distance: 9,
    color: "#f3ead8",
    attack: Object.freeze({ kind: "rush", fireBeat: 0, arriveBeat: 3 }),
    heights: Object.freeze(["back"]),
  }),
});

export const STAGE_ZERO_BARS = 16;
export const GHOST_LIFETIME_BARS = 4;
export const PURIFY_WINDOW_BEATS = 8;

const GESTURE_BY_HEIGHT = Object.freeze({ duck: "duck", left: "left", right: "right", back: "back" });

function jitter(rngState, range) {
  const next = nextMudflatRandom(rngState);
  return { state: next.state, value: (next.value * 2 - 1) * range };
}

/**
 * 0단계 방 구성. 방위는 런 시작 때 폰이 향한 방향이 0도다.
 * 1~4마디 도깨비불 정면, 5~8마디 달걀귀신 후방, 9~16마디 둘을 엇갈린 박으로 섞는다.
 */
export function createStageZeroChart(seed, { bpm = 80 } = {}) {
  let rng = normalizeMudflatSeed(seed);
  const placements = [
    { type: "dokkaebi-fire", spawnBar: 0, azimuth: 0, spread: 25 },
    { type: "egg-ghost", spawnBar: 4, azimuth: 180, spread: 30 },
    { type: "dokkaebi-fire", spawnBar: 8, azimuth: -45, spread: 15 },
    { type: "egg-ghost", spawnBar: 8, azimuth: 125, spread: 20 },
    { type: "dokkaebi-fire", spawnBar: 12, azimuth: 45, spread: 15 },
    { type: "egg-ghost", spawnBar: 12, azimuth: -125, spread: 20 },
  ];
  const ghosts = placements.map((placement, index) => {
    const spec = GHOST_TYPES[placement.type];
    const offset = jitter(rng, placement.spread);
    rng = offset.state;
    const spawnBeat = placement.spawnBar * BEATS_PER_BAR;
    const attacks = Array.from({ length: GHOST_LIFETIME_BARS }, (_, bar) => {
      const barStart = spawnBeat + bar * BEATS_PER_BAR;
      const gesture = GESTURE_BY_HEIGHT[spec.heights[bar % spec.heights.length]];
      return {
        id: `${placement.type}-${index}-${bar}`,
        kind: spec.attack.kind,
        gesture,
        fireBeat: barStart + spec.attack.fireBeat,
        arriveBeat: barStart + spec.attack.arriveBeat,
      };
    });
    return {
      id: `${placement.type}-${index}`,
      type: placement.type,
      name: spec.name,
      spawnBeat,
      leaveBeat: spawnBeat + GHOST_LIFETIME_BARS * BEATS_PER_BAR,
      azimuth: placement.azimuth + offset.value,
      elevation: spec.elevation,
      distance: spec.distance,
      maxHp: spec.hp,
      attacks,
    };
  });
  return {
    id: "stage-zero",
    seed: normalizeMudflatSeed(seed),
    bpm,
    bars: STAGE_ZERO_BARS,
    lengthBeats: STAGE_ZERO_BARS * BEATS_PER_BAR,
    ghosts,
  };
}
