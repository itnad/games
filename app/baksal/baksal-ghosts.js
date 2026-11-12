// 악귀 도감 원본. 등급·행동 유형·공격 패턴·약점을 데이터로 적는다.
// 공격 패턴은 마디 단위다. bars[n % bars.length]가 그 마디의 공격 목록이고,
// 각 공격은 { beat(마디 안 박), arrive(발사 뒤 몇 박), kind, gesture }다.
// kind: fire(화염, 회피 또는 격파), rush(돌진, 젖히기 또는 격파), curse(저주 파동, 격파만 가능)

export const GHOST_TYPES = Object.freeze({
  "dokkaebi-fire": Object.freeze({
    id: "dokkaebi-fire",
    name: "도깨비불",
    grade: "잡귀",
    behavior: "투사형",
    hp: 3,
    elevation: 12,
    distance: 6,
    color: "#ff9a3c",
    sprite: "flame",
    weakPoint: { azimuth: 0, elevation: 8 },
    bars: [
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "duck" }],
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "left" }],
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "right" }],
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "duck" }],
    ],
    lore: "밤길에 떠다니는 불. 1박에 예고하고 3박에 도착하는 화염을 던진다.",
  }),
  "egg-ghost": Object.freeze({
    id: "egg-ghost",
    name: "달걀귀신",
    grade: "잡귀",
    behavior: "급습형",
    hp: 2,
    elevation: 0,
    distance: 9,
    color: "#f3ead8",
    sprite: "egg",
    weakPoint: { azimuth: 0, elevation: -5 },
    bars: [[{ beat: 0, arrive: 3, kind: "rush", gesture: "back" }]],
    lore: "눈코입이 없다. 등롱 밖에서 소리를 내고 4박에 들이받는다.",
  }),
  geuseundae: Object.freeze({
    id: "geuseundae",
    name: "그슨대",
    grade: "잡귀",
    behavior: "포위형",
    hp: 2,
    elevation: 6,
    distance: 7,
    color: "#8a7fb5",
    sprite: "shadow",
    pack: 3,
    orbitDegPerBar: 30,
    weakPoint: { azimuth: 0, elevation: 10 },
    bars: [
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "left" }],
      [{ beat: 1, arrive: 2, kind: "fire", gesture: "right" }],
      [{ beat: 2, arrive: 2, kind: "fire", gesture: "duck" }],
    ],
    lore: "어두울수록 커지는 그림자. 셋이 둘레를 돌며 번갈아 공격한다.",
  }),
  eodukshini: Object.freeze({
    id: "eodukshini",
    name: "어둑시니",
    grade: "잡귀",
    behavior: "은신형",
    hp: 2,
    elevation: 4,
    distance: 6,
    color: "#6fd3c7",
    sprite: "shimmer",
    hidden: true,
    weakPoint: { azimuth: 0, elevation: 0 },
    bars: [[{ beat: 1, arrive: 2, kind: "fire", gesture: "duck" }]],
    lore: "정면으로 보면 사라진다. 등롱 가장자리에서만 드러나고 2박에 공격한다.",
  }),
  sonmalmyeong: Object.freeze({
    id: "sonmalmyeong",
    name: "손말명",
    grade: "잡귀",
    behavior: "저주형",
    hp: 2,
    elevation: 8,
    distance: 7,
    color: "#ff8fb8",
    sprite: "bride",
    weakPoint: { azimuth: 0, elevation: 12 },
    bars: [[{ beat: 0, arrive: 4, kind: "curse", gesture: null }]],
    lore: "공격 대신 저주를 건다. 다음 마디 첫 박에 도착하기 전에 쏴서 막아야 한다.",
  }),
  mongdal: Object.freeze({
    id: "mongdal",
    name: "몽달귀신",
    grade: "원귀",
    behavior: "급습+투사",
    hp: 4,
    elevation: 4,
    distance: 8,
    color: "#c9d7ff",
    sprite: "scholar",
    weakPoint: { azimuth: 0, elevation: 9 },
    bars: [
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "duck" }],
      [{ beat: 1, arrive: 3, kind: "rush", gesture: "back" }],
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "left" }, { beat: 2, arrive: 2, kind: "fire", gesture: "right" }],
    ],
    lore: "장가 못 간 한이 깊다. 화염과 돌진을 섞고 한 마디에 두 번 공격하기도 한다.",
  }),
  mulgwishin: Object.freeze({
    id: "mulgwishin",
    name: "물귀신",
    grade: "원귀",
    behavior: "포위+투사",
    hp: 4,
    elevation: -2,
    distance: 7,
    color: "#5db6ff",
    sprite: "drowned",
    orbitDegPerBar: 22,
    weakPoint: { azimuth: 0, elevation: 4 },
    bars: [
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "left" }],
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "right" }],
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "left" }, { beat: 2, arrive: 2, kind: "fire", gesture: "right" }],
      [{ beat: 1, arrive: 3, kind: "rush", gesture: "back" }],
    ],
    lore: "물가를 돌며 몸통 높이로 물보라를 던진다. 왼쪽, 오른쪽을 번갈아 피해야 한다.",
  }),
  jangsanbeom: Object.freeze({
    id: "jangsanbeom",
    name: "장산범",
    grade: "지박령",
    behavior: "보스",
    hp: 12,
    elevation: 6,
    distance: 7,
    color: "#ffd36c",
    sprite: "tiger",
    mimic: true,
    orbitDegPerBar: 15,
    weakPoint: { azimuth: 0, elevation: 11 },
    bars: [
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "duck" }],
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "left" }],
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "right" }],
      [{ beat: 1, arrive: 3, kind: "rush", gesture: "back" }],
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "duck" }, { beat: 1, arrive: 3, kind: "rush", gesture: "back" }],
      [{ beat: 0, arrive: 4, kind: "curse", gesture: null }],
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "left" }, { beat: 2, arrive: 2, kind: "fire", gesture: "right" }],
      [{ beat: 0, arrive: 2, kind: "fire", gesture: "duck" }, { beat: 1, arrive: 3, kind: "rush", gesture: "back" }, { beat: 2, arrive: 2, kind: "fire", gesture: "left" }],
    ],
    lore: "사람 소리를 흉내 낸다. 소리가 나는 반대쪽에 있고, 마디마다 템포를 끌어올린다.",
  }),
});

export const GHOST_TYPE_IDS = Object.freeze(Object.keys(GHOST_TYPES));

export const GESTURE_FOR_KIND_FALLBACK = Object.freeze({ fire: "duck", rush: "back", curse: null });

/** 도감 숙련 단계: 정화 횟수 기준. 3단계부터 런 중 약점과 공격 박이 표시된다. */
export const MASTERY_THRESHOLDS = Object.freeze([1, 3, 6]);

export function masteryLevel(purifiedCount) {
  const count = Number(purifiedCount) || 0;
  let level = 0;
  for (const threshold of MASTERY_THRESHOLDS) if (count >= threshold) level += 1;
  return level;
}
