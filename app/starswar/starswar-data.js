// 스타즈워 고정 데이터. 이름은 모두 여기 모여 있어 독자 이름으로 바꿀 때 이 파일만 고치면 된다.
// 전장은 가로 40 × 세로 100의 한 줄 전선이다. 아군 본진은 아래(y=100 쪽), 적 본진은 위(y=0 쪽).

export const STW_LANE_WIDTH = 40;
export const STW_LANE_LENGTH = 100;
export const STW_TICK = 0.1;

function mainGrid() {
  const slots = [];
  for (const y of [96, 91, 86, 81]) {
    for (const x of [4, 9.2, 14.4, 19.6, 24.8, 30, 35.2]) {
      const nexus = Math.abs(x - 20) < 6.5 && Math.abs(y - 94) < 6.5;
      const minerals = Math.abs(x - 20) < 8 && y > 95;
      const geyser = Math.hypot(x - 5, y - 98) < 4.5 || Math.hypot(x - 35, y - 98) < 4.5;
      if (!nexus && !minerals && !geyser) slots.push({ x, y });
    }
  }
  return slots;
}

/** 아군 기준 위치. 적은 (40 - x, 100 - y)로 점대칭. */
export const STW_LAYOUT = {
  mainNexus: { x: 20, y: 94 },
  naturalNexus: { x: 20, y: 73 },
  mainMinerals: { x: 20, y: 99.2 },
  naturalMinerals: { x: 20, y: 78.6 },
  geysers: [{ x: 5, y: 98 }, { x: 35, y: 98 }],
  // 본진 건물 자리: 넥서스·광물·간헐천을 피한 격자. 일반 건물은 뒤쪽부터, 포톤 캐논은 앞쪽부터 채운다.
  mainSlots: mainGrid(),
  naturalSlots: [{ x: 8, y: 70 }, { x: 32, y: 70 }, { x: 12, y: 66 }, { x: 28, y: 66 }, { x: 5, y: 76 }, { x: 35, y: 76 }],
};

/**
 * 집결 위치. y는 아군 기준(100이 아군 끝). AI는 이 이름표를 쓰고, 플레이어는 지도를 눌러 STW_RALLY_RANGE 안의 아무 세로 위치나 고른다.
 * 아군 기준 y가 STW_ATTACK_ZONE_Y 이하(적 앞마당 안쪽)를 누르면 집결이 아니라 출격 명령이다.
 */
export const STW_RALLY_RANGE = { min: 34, max: 84 };
export const STW_ATTACK_ZONE_Y = 30;
export const STW_RALLY_POINTS = [
  { id: "main", name: "본진 앞", short: "본진", y: 77 },
  { id: "natural", name: "앞마당", short: "앞마당", y: 64 },
  { id: "center", name: "중앙", short: "중앙", y: 50 },
  { id: "forward", name: "적 앞마당 앞", short: "전진", y: 36 },
];

export const STW_UNITS = {
  probe: {
    id: "probe", name: "프로브", short: "P", minerals: 50, gas: 0, time: 12, supply: 1, from: "nexus", worker: true,
    hp: 20, shields: 20, armor: 0, size: "small", speed: 3.4, radius: 0.9, sight: 8,
  },
  zealot: {
    id: "zealot", name: "질럿", short: "Z", minerals: 100, gas: 0, time: 18, supply: 2, from: "gateway",
    hp: 100, shields: 60, armor: 1, size: "small", speed: 3, radius: 1.15, sight: 9,
    damage: 8, hits: 2, damageType: "normal", range: 1.2, cooldown: 1.1, weaponStep: 1, role: "melee",
    note: "근접 · 연속 2회 공격 · 드라군에게 강함",
  },
  dragoon: {
    id: "dragoon", name: "드라군", short: "D", minerals: 125, gas: 50, time: 22, supply: 2, from: "gateway", requires: "core",
    hp: 100, shields: 80, armor: 1, size: "large", speed: 2.6, radius: 1.45, sight: 10,
    damage: 20, hits: 1, damageType: "explosive", range: 5.5, cooldown: 1.5, weaponStep: 2, role: "ranged",
    note: "원거리 · 폭발형(소형에게 50%) · 건물과 대형에 강함",
  },
  templar: {
    id: "templar", name: "하이템플러", short: "H", minerals: 50, gas: 150, time: 26, supply: 2, from: "gateway", requires: "archives",
    hp: 40, shields: 40, armor: 0, size: "small", speed: 2.2, radius: 1.05, sight: 10, role: "caster",
    energy: 50, maxEnergy: 200, energyRegen: 0.8,
    note: "무기 없음 · 사이오닉 스톰(3초 동안 총 105)으로 뭉친 적을 녹임",
  },
  dark: {
    id: "dark", name: "다크템플러", short: "K", minerals: 125, gas: 100, time: 26, supply: 2, from: "gateway", requires: "archives",
    hp: 80, shields: 40, armor: 1, size: "small", speed: 3, radius: 1.1, sight: 8,
    damage: 40, hits: 1, damageType: "normal", range: 1.2, cooldown: 1.25, weaponStep: 3, role: "melee", cloaked: true,
    note: "은폐 근접 · 탐지기가 없으면 공격받지 않음",
  },
  archon: {
    id: "archon", name: "아콘", short: "A", minerals: 100, gas: 300, time: 0, supply: 4, from: "merge",
    hp: 10, shields: 350, armor: 0, size: "large", speed: 2.8, radius: 1.8, sight: 9,
    damage: 30, hits: 1, damageType: "normal", range: 2.5, cooldown: 1.25, weaponStep: 3, role: "melee",
    splash: { radius: 1.6, factor: 1 },
    note: "하이템플러 2기 합체 · 보호막 350 · 근거리 범위 공격",
  },
  observer: {
    id: "observer", name: "옵저버", short: "O", minerals: 25, gas: 75, time: 20, supply: 1, from: "robo",
    hp: 40, shields: 20, armor: 0, size: "small", speed: 3.3, radius: 0.9, sight: 11, role: "support", cloaked: true, detector: 9, flying: true,
    note: "은폐 탐지기 · 공격 병력을 따라다니며 시야 제공",
  },
  reaver: {
    id: "reaver", name: "리버", short: "R", minerals: 200, gas: 100, time: 35, supply: 4, from: "robo", requires: "bay",
    hp: 100, shields: 80, armor: 0, size: "large", speed: 1.8, radius: 1.7, sight: 10,
    damage: 100, hits: 1, damageType: "normal", range: 8, cooldown: 3.5, weaponStep: 0, role: "siege",
    splash: { radius: 2.4, factor: 0.5 },
    note: "느림 · 사거리 8 범위 포격 · 뭉친 적과 건물에 강함",
  },

  // ───── 테란 ─────
  scv: {
    id: "scv", race: "terran", name: "SCV", short: "S", minerals: 50, gas: 0, time: 12, supply: 1, from: "cc", worker: true,
    hp: 60, shields: 0, armor: 0, size: "small", speed: 3.4, radius: 0.9, sight: 8,
  },
  marine: {
    id: "marine", race: "terran", name: "해병", short: "M", minerals: 50, gas: 0, time: 15, supply: 1, from: "barracks",
    hp: 45, shields: 0, armor: 0, size: "small", speed: 2.6, radius: 0.9, sight: 9,
    damage: 6, hits: 1, damageType: "normal", range: 5, cooldown: 0.75, weaponStep: 1, role: "ranged", bio: true, stim: true, kite: true,
    note: "값싼 원거리 보병 · 스팀팩을 쓰면 근접 적에게 물러나며 사격 · 메딕과 함께하면 강함",
  },
  firebat: {
    id: "firebat", race: "terran", name: "파이어뱃", short: "F", minerals: 50, gas: 25, time: 16, supply: 1, from: "barracks", requires: "academy",
    hp: 60, shields: 0, armor: 1, size: "small", speed: 2.6, radius: 1, sight: 8,
    damage: 8, hits: 2, damageType: "concussive", range: 1.8, cooldown: 0.95, weaponStep: 1, role: "melee", bio: true, stim: true,
    splash: { radius: 1.6, factor: 1 },
    note: "근접 화염 범위 공격 · 진동형(소형에게 100%, 대형에게 25%)",
  },
  medic: {
    id: "medic", race: "terran", name: "메딕", short: "+", minerals: 50, gas: 25, time: 18, supply: 1, from: "barracks", requires: "academy",
    hp: 60, shields: 0, armor: 1, size: "small", speed: 2.6, radius: 0.95, sight: 9, role: "caster", bio: true,
    heal: 10, healRange: 4.5,
    note: "무기 없음 · 근처 보병의 체력을 초당 10 치료",
  },
  vulture: {
    id: "vulture", race: "terran", name: "벌처", short: "V", minerals: 75, gas: 0, time: 18, supply: 2, from: "factory",
    hp: 80, shields: 0, armor: 0, size: "medium", speed: 4.2, radius: 1.2, sight: 9,
    damage: 20, hits: 1, damageType: "concussive", range: 5, cooldown: 1.4, weaponStep: 0, role: "ranged", kite: true,
    note: "빠른 차량 · 진동형이라 소형 보병과 질럿에 강함 · 물러나며 사격",
  },
  tank: {
    id: "tank", race: "terran", name: "시즈 탱크", short: "T", minerals: 150, gas: 100, time: 30, supply: 2, from: "factory", requires: "shop",
    hp: 150, shields: 0, armor: 1, size: "large", speed: 2.2, radius: 1.6, sight: 11,
    damage: 30, hits: 1, damageType: "explosive", range: 7, cooldown: 1.5, weaponStep: 0, role: "siege",
    siege: { damage: 70, range: 12, minRange: 2, cooldown: 3, setup: 2, splash: { radius: 2.2, factor: 0.5 } },
    note: "시즈 모드 연구 후 적이 오면 자동으로 시즈 · 사거리 12 범위 포격",
  },

  // ───── 저그: 모든 유닛과 건물의 체력이 저절로 회복된다 ─────
  drone: {
    id: "drone", race: "zerg", name: "드론", short: "D", minerals: 50, gas: 0, time: 12, supply: 1, from: "hatchery", worker: true,
    hp: 40, shields: 0, armor: 0, size: "small", speed: 3.4, radius: 0.9, sight: 8,
  },
  zergling: {
    id: "zergling", race: "zerg", name: "저글링", short: "L", minerals: 50, gas: 0, time: 16, supply: 0.5, pair: true, from: "hatchery", requires: "pool",
    hp: 35, shields: 0, armor: 0, size: "small", speed: 3.6, radius: 0.85, sight: 8,
    damage: 5, hits: 1, damageType: "normal", range: 1, cooldown: 0.75, weaponStep: 1, weaponGroup: "melee", role: "melee",
    note: "한 번에 2기 · 빠르고 값싼 근접 물량",
  },
  hydra: {
    id: "hydra", race: "zerg", name: "히드라리스크", short: "H", minerals: 75, gas: 25, time: 15, supply: 1, from: "hatchery", requires: "den",
    hp: 80, shields: 0, armor: 0, size: "medium", speed: 2.6, radius: 1.05, sight: 9,
    damage: 12, hits: 1, damageType: "explosive", range: 4.5, cooldown: 0.75, weaponStep: 1, weaponGroup: "missile", role: "ranged",
    note: "원거리 · 폭발형(소형에게 50%) · 저그의 주력",
  },
  lurker: {
    id: "lurker", race: "zerg", name: "럴커", short: "R", minerals: 125, gas: 125, time: 24, supply: 2, from: "hatchery", requires: "den", requiresResearch: "lurkerAspect",
    hp: 125, shields: 0, armor: 1, size: "medium", speed: 2.6, radius: 1.3, sight: 9,
    damage: 20, hits: 1, damageType: "normal", range: 6, cooldown: 1.5, weaponStep: 2, weaponGroup: "missile", role: "siege",
    burrow: { setup: 1, width: 1 },
    note: "적이 오면 자동으로 땅속에 숨어 은폐 · 일직선 가시 범위 공격",
  },
  overlord: {
    id: "overlord", race: "zerg", name: "오버로드", short: "O", minerals: 100, gas: 0, time: 0, supply: 0, supplyProvided: 8, from: "escort",
    hp: 200, shields: 0, armor: 0, size: "large", speed: 2.4, radius: 1.6, sight: 9, role: "support", detector: 8, flying: true,
    note: "병력과 동행하는 떠다니는 탐지기 · 잃으면 인구 상한 −8",
  },
  ultra: {
    id: "ultra", race: "zerg", name: "울트라리스크", short: "U", minerals: 200, gas: 200, time: 30, supply: 4, from: "hatchery", requires: "cavern",
    hp: 400, shields: 0, armor: 1, size: "large", speed: 3, radius: 1.9, sight: 9,
    damage: 30, hits: 1, damageType: "normal", range: 1.4, cooldown: 1, weaponStep: 3, weaponGroup: "melee", role: "melee",
    splash: { radius: 1.3, factor: 0.5 },
    note: "체력 400 근접 괴수 · 앞쪽을 휩쓰는 범위 공격 · 키틴질 강화로 방어력 +2",
  },
};

/** 병력 유닛(일꾼 제외). 모든 종족. */
export const STW_ARMY_UNITS = ["zealot", "dragoon", "templar", "dark", "archon", "observer", "reaver", "marine", "firebat", "medic", "vulture", "tank", "zergling", "hydra", "lurker", "ultra", "overlord"];
/** 저그 해처리는 본진·앞마당·추가 해처리가 같은 라바 목록을 쓴다. */
const LARVA = ["zergling", "hydra", "lurker", "ultra"];
/** 생산 건물별로 고를 수 있는 유닛. */
export const STW_PRODUCER_UNITS = {
  gateway: ["zealot", "dragoon", "templar", "dark"],
  robo: ["observer", "reaver"],
  barracks: ["marine", "firebat", "medic"],
  factory: ["vulture", "tank"],
  hatchery: LARVA,
  hatch: LARVA,
};

export const STW_BUILDINGS = {
  nexus: { id: "nexus", name: "넥서스", minerals: 400, gas: 0, time: 70, hp: 1000, shields: 1000, armor: 1, size: 8, supply: 10, sight: 11, base: true },
  pylon: { id: "pylon", name: "파일런", minerals: 100, gas: 0, time: 18, hp: 200, shields: 200, armor: 1, size: 3.4, supply: 8, sight: 8, note: "인구 +8" },
  gateway: { id: "gateway", name: "게이트웨이", minerals: 150, gas: 0, time: 30, hp: 500, shields: 500, armor: 1, size: 5, requires: "pylon", sight: 8, note: "전투 유닛 생산 라인 +1" },
  assimilator: { id: "assimilator", name: "어시밀레이터", minerals: 75, gas: 0, time: 20, hp: 450, shields: 450, armor: 1, size: 4.2, sight: 6, refinery: true, note: "가스 채취 · 프로브 3기 배치" },
  core: { unique: true, id: "core", name: "사이버네틱스 코어", minerals: 150, gas: 0, time: 30, hp: 500, shields: 500, armor: 1, size: 4.6, requires: "gateway", sight: 8, note: "드라군 해금 · 사거리 연구" },
  forge: { unique: true, id: "forge", name: "포지", minerals: 150, gas: 0, time: 28, hp: 550, shields: 550, armor: 1, size: 4.6, requires: "pylon", sight: 8, note: "지상 공격·방어 업그레이드 · 포톤 캐논 해금" },
  cannon: {
    id: "cannon", name: "포톤 캐논", minerals: 150, gas: 0, time: 25, hp: 100, shields: 100, armor: 0, size: 3.2, requires: "forge", sight: 11,
    damage: 20, hits: 1, damageType: "normal", range: 7, cooldown: 1.25, detector: 7, defense: true, note: "기지 전체를 지키고 기지 전체의 은폐를 탐지 · 앞마당이 있으면 앞마당에 세움",
  },
  citadel: { unique: true, id: "citadel", name: "아둔의 성소", minerals: 150, gas: 100, time: 35, hp: 450, shields: 450, armor: 1, size: 4.4, requires: "core", sight: 8, note: "질럿 다리 강화 연구 · 아카이브 해금" },
  archives: { unique: true, id: "archives", name: "템플러 아카이브", minerals: 150, gas: 200, time: 40, hp: 500, shields: 500, armor: 1, size: 4.6, requires: "citadel", sight: 8, note: "하이템플러·다크템플러 해금 · 사이오닉 스톰 연구" },
  robo: { id: "robo", name: "로보틱스 퍼실리티", minerals: 200, gas: 200, time: 40, hp: 500, shields: 500, armor: 1, size: 5, requires: "core", sight: 8, note: "옵저버·리버 생산 라인" },
  bay: { unique: true, id: "bay", name: "로보틱스 지원 베이", minerals: 150, gas: 100, time: 30, hp: 450, shields: 450, armor: 1, size: 4.4, requires: "robo", sight: 8, note: "리버 해금 · 스캐럽 강화 연구" },

  // ───── 테란: 보호막이 없고, 공격받지 않으면 SCV가 수리하듯 체력이 천천히 회복된다 ─────
  cc: { id: "cc", race: "terran", name: "커맨드 센터", minerals: 400, gas: 0, time: 70, hp: 1500, shields: 0, armor: 1, size: 8, supply: 10, sight: 11, base: true },
  depot: { id: "depot", race: "terran", name: "서플라이 디팟", minerals: 100, gas: 0, time: 18, hp: 500, shields: 0, armor: 1, size: 3.6, supply: 8, sight: 8, note: "인구 +8" },
  refinery: { id: "refinery", race: "terran", name: "리파이너리", minerals: 75, gas: 0, time: 20, hp: 750, shields: 0, armor: 1, size: 4.2, sight: 6, refinery: true, note: "가스 채취 · SCV 3기 배치" },
  barracks: { id: "barracks", race: "terran", name: "배럭", minerals: 150, gas: 0, time: 30, hp: 1000, shields: 0, armor: 1, size: 5, requires: "depot", sight: 8, note: "보병 생산 라인 +1" },
  ebay: { unique: true, id: "ebay", race: "terran", name: "엔지니어링 베이", minerals: 125, gas: 0, time: 28, hp: 850, shields: 0, armor: 1, size: 4.6, requires: "depot", sight: 8, note: "보병 공격·방어 업그레이드 · 미사일 터렛 해금" },
  bunker: {
    id: "bunker", race: "terran", name: "벙커", minerals: 100, gas: 0, time: 22, hp: 350, shields: 0, armor: 1, size: 3.6, requires: "barracks", sight: 10,
    damage: 6, hits: 3, damageType: "normal", range: 6, cooldown: 1.1, defense: true, note: "해병 3기가 주둔한 화력으로 기지 전체를 지킴 · 앞마당이 있으면 앞마당에 세움",
  },
  turret: { id: "turret", race: "terran", name: "미사일 터렛", minerals: 75, gas: 0, time: 18, hp: 200, shields: 0, armor: 0, size: 3, requires: "ebay", sight: 11, detector: 7, defense: true, note: "기지 전체의 은폐 탐지 전용(지상 공격 없음)" },
  academy: { unique: true, id: "academy", race: "terran", name: "아카데미", minerals: 150, gas: 0, time: 30, hp: 600, shields: 0, armor: 1, size: 4.6, requires: "barracks", sight: 8, note: "파이어뱃·메딕 해금 · 스팀팩·U-238 연구" },
  comsat: {
    unique: true, id: "comsat", race: "terran", name: "컴샛 스테이션", minerals: 50, gas: 50, time: 20, hp: 500, shields: 0, armor: 1, size: 3.4, requires: "academy", sight: 8,
    energy: 50, maxEnergy: 200, energyRegen: 0.8, note: "은폐 유닛에게 공격받으면 에너지 50으로 자동 스캔",
  },
  factory: { id: "factory", race: "terran", name: "팩토리", minerals: 200, gas: 100, time: 40, hp: 1250, shields: 0, armor: 1, size: 5.2, requires: "barracks", sight: 8, note: "벌처·시즈 탱크 생산 라인" },
  shop: { unique: true, id: "shop", race: "terran", name: "머신 샵", minerals: 50, gas: 50, time: 20, hp: 750, shields: 0, armor: 1, size: 3.6, requires: "factory", sight: 8, note: "시즈 탱크 해금 · 시즈 모드·이온 추진기 연구" },

  // ───── 저그: 드론이 건물로 변태한다. 건물도 체력이 저절로 회복된다 ─────
  hatchery: { id: "hatchery", race: "zerg", name: "해처리", minerals: 300, gas: 0, time: 60, hp: 1250, shields: 0, armor: 1, size: 8, supply: 10, sight: 11, base: true },
  hatch: { id: "hatch", race: "zerg", name: "해처리", minerals: 225, gas: 0, time: 40, hp: 1250, shields: 0, armor: 1, size: 6, supply: 2, sight: 9, note: "본진에 해처리 추가 · 생산 라인 +1" },
  overlord: { id: "overlord", race: "zerg", name: "오버로드", minerals: 100, gas: 0, time: 18, hp: 200, shields: 0, armor: 0, size: 3.6, supply: 8, sight: 9, detector: 5, note: "인구 +8 · 기지 전체의 은폐 탐지 · 병력 탭에서 동행시킬 수 있음" },
  extractor: { id: "extractor", race: "zerg", name: "익스트랙터", minerals: 50, gas: 0, time: 20, hp: 750, shields: 0, armor: 1, size: 4.2, sight: 6, refinery: true, note: "가스 채취 · 드론 3기 배치" },
  pool: { unique: true, id: "pool", race: "zerg", name: "스포닝 풀", minerals: 200, gas: 0, time: 40, hp: 750, shields: 0, armor: 1, size: 4.8, sight: 8, note: "저글링·성큰 콜로니 해금 · 대사 촉진 연구" },
  evo: { unique: true, id: "evo", race: "zerg", name: "에볼루션 챔버", minerals: 75, gas: 0, time: 25, hp: 750, shields: 0, armor: 1, size: 4.4, sight: 8, note: "근접·원거리 공격과 갑피 업그레이드 · 스포어 콜로니 해금" },
  sunken: {
    id: "sunken", race: "zerg", name: "성큰 콜로니", minerals: 125, gas: 0, time: 25, hp: 300, shields: 0, armor: 2, size: 3.4, requires: "pool", sight: 10,
    damage: 40, hits: 1, damageType: "explosive", range: 7, cooldown: 2, defense: true, note: "땅속 촉수로 기지 전체를 지킴 · 폭발형 40 · 앞마당이 있으면 앞마당에 세움",
  },
  spore: { id: "spore", race: "zerg", name: "스포어 콜로니", minerals: 75, gas: 0, time: 20, hp: 400, shields: 0, armor: 0, size: 3.2, requires: "evo", sight: 10, detector: 7, defense: true, note: "기지 전체의 은폐 탐지 전용(지상 공격 없음)" },
  den: { unique: true, id: "den", race: "zerg", name: "히드라리스크 덴", minerals: 100, gas: 50, time: 30, hp: 850, shields: 0, armor: 1, size: 4.4, requires: "pool", sight: 8, note: "히드라리스크 해금 · 사거리·속도 연구 · 럴커 변태" },
  cavern: { unique: true, id: "cavern", race: "zerg", name: "울트라리스크 동굴", minerals: 150, gas: 200, time: 45, hp: 600, shields: 0, armor: 1, size: 4.8, requires: "den", requiresResearch: "lair", sight: 8, note: "울트라리스크 해금 · 키틴질 강화 연구" },
};


/** 생산 라인이 있는 건물. */
export const STW_PRODUCERS = ["gateway", "robo", "barracks", "factory", "hatchery", "hatch"];

export const STW_RESEARCH = {
  weapons1: { id: "weapons1", name: "지상 공격 1단계", at: "forge", minerals: 100, gas: 100, time: 40, note: "질럿 +1×2, 드라군 +2" },
  armor1: { id: "armor1", name: "지상 방어 1단계", at: "forge", minerals: 100, gas: 100, time: 40, note: "모든 유닛 방어력 +1" },
  weapons2: { id: "weapons2", name: "지상 공격 2단계", at: "forge", minerals: 150, gas: 150, time: 50, requires: ["weapons1", "citadel"], note: "공격력 한 단계 더" },
  shields1: { id: "shields1", name: "보호막 1단계", at: "forge", minerals: 150, gas: 150, time: 45, requires: ["armor1"], note: "보호막 방어력 +1" },
  range: { id: "range", name: "특이점 충전", at: "core", minerals: 150, gas: 150, time: 45, note: "드라군 사거리 5.5 → 8" },
  charge: { id: "charge", name: "다리 강화", at: "citadel", minerals: 150, gas: 150, time: 45, note: "질럿 이동 속도 +50%" },
  storm: { id: "storm", name: "사이오닉 스톰", at: "archives", minerals: 200, gas: 200, time: 55, note: "하이템플러가 뭉친 적에게 스톰을 자동 시전" },
  scarab: { id: "scarab", name: "스캐럽 강화", at: "bay", minerals: 100, gas: 100, time: 40, note: "리버 피해 100 → 125" },

  // ───── 테란 ─────
  infWeapons1: { id: "infWeapons1", race: "terran", name: "보병 공격 1단계", at: "ebay", minerals: 100, gas: 100, time: 40, note: "해병 +1, 파이어뱃 +1×2" },
  infArmor1: { id: "infArmor1", race: "terran", name: "보병 방어 1단계", at: "ebay", minerals: 100, gas: 100, time: 40, note: "보병 방어력 +1" },
  infWeapons2: { id: "infWeapons2", race: "terran", name: "보병 공격 2단계", at: "ebay", minerals: 175, gas: 175, time: 50, requires: ["infWeapons1", "academy"], note: "보병 공격력 한 단계 더" },
  stim: { id: "stim", race: "terran", name: "스팀팩", at: "academy", minerals: 100, gas: 100, time: 45, note: "교전 시 체력 10을 써서 10초간 공격·이동 속도 +50%" },
  u238: { id: "u238", race: "terran", name: "U-238 탄", at: "academy", minerals: 150, gas: 150, time: 40, note: "해병 사거리 4.5 → 5.5" },
  siege: { id: "siege", race: "terran", name: "시즈 모드", at: "shop", minerals: 150, gas: 150, time: 50, note: "적이 오면 탱크가 자동으로 시즈 · 사거리 12 범위 포격" },
  ion: { id: "ion", race: "terran", name: "이온 추진기", at: "shop", minerals: 100, gas: 100, time: 35, note: "벌처 이동 속도 +40%" },

  // ───── 저그 ─────
  lair: { id: "lair", race: "zerg", name: "레어 변태", at: "hatchery", minerals: 150, gas: 100, time: 50, requires: ["pool"], note: "본진 해처리가 레어로 · 럴커·울트라리스크·2단계 업그레이드 해금" },
  metabolic: { id: "metabolic", race: "zerg", name: "대사 촉진", at: "pool", minerals: 100, gas: 100, time: 40, note: "저글링 이동 속도 +50%" },
  spines: { id: "spines", race: "zerg", name: "홈 갈퀴", at: "den", minerals: 150, gas: 150, time: 40, note: "히드라리스크 사거리 4.5 → 6" },
  augments: { id: "augments", race: "zerg", name: "근육 강화", at: "den", minerals: 150, gas: 150, time: 40, requires: ["lair"], note: "히드라리스크 이동 속도 +35%" },
  lurkerAspect: { id: "lurkerAspect", race: "zerg", name: "럴커 변태", at: "den", minerals: 200, gas: 200, time: 50, requires: ["lair"], note: "럴커 해금" },
  pneumatized: { id: "pneumatized", race: "zerg", name: "기낭 갑피", at: "hatchery", minerals: 150, gas: 150, time: 40, requires: ["lair"], note: "동행 오버로드 이동 속도 +50%" },
  chitin: { id: "chitin", race: "zerg", name: "키틴질 강화", at: "cavern", minerals: 150, gas: 150, time: 45, note: "울트라리스크 방어력 +2" },
  zMelee1: { id: "zMelee1", race: "zerg", name: "근접 공격 1단계", at: "evo", minerals: 100, gas: 100, time: 40, note: "저글링 +1, 울트라리스크 +3" },
  zMissile1: { id: "zMissile1", race: "zerg", name: "원거리 공격 1단계", at: "evo", minerals: 100, gas: 100, time: 40, note: "히드라리스크 +1, 럴커 +2" },
  zCarapace1: { id: "zCarapace1", race: "zerg", name: "갑피 1단계", at: "evo", minerals: 150, gas: 150, time: 40, note: "저그 유닛 방어력 +1" },
  zMelee2: { id: "zMelee2", race: "zerg", name: "근접 공격 2단계", at: "evo", minerals: 150, gas: 150, time: 50, requires: ["zMelee1", "lair"], note: "근접 공격력 한 단계 더" },
  zMissile2: { id: "zMissile2", race: "zerg", name: "원거리 공격 2단계", at: "evo", minerals: 150, gas: 150, time: 50, requires: ["zMissile1", "lair"], note: "원거리 공격력 한 단계 더" },
};

// 종족 표시가 없는 항목은 모두 프로토스다.
for (const table of [STW_UNITS, STW_BUILDINGS, STW_RESEARCH]) {
  for (const entry of Object.values(table)) entry.race ??= "protoss";
}

/** 종족별 기본 구성. */
export const STW_RACES = {
  protoss: {
    id: "protoss", name: "프로토스", worker: "probe", base: "nexus", supply: "pylon", refinery: "assimilator", buildVerb: "소환", trainVerb: "소환",
    mainProducer: "gateway", producers: ["gateway", "robo"], startLines: { gateway: "zealot" },
    builds: ["pylon", "gateway", "assimilator", "core", "forge", "cannon", "citadel", "archives", "robo", "bay", "expand"],
    weapons: ["weapons1", "weapons2"], armor: ["armor1"], shields: ["shields1"],
    note: "보호막이 저절로 회복되는 정예 병력과 사이오닉 기술",
  },
  terran: {
    id: "terran", name: "테란", worker: "scv", base: "cc", supply: "depot", refinery: "refinery", buildVerb: "건설", trainVerb: "생산",
    mainProducer: "barracks", producers: ["barracks", "factory"], startLines: { barracks: "marine" },
    builds: ["depot", "barracks", "refinery", "ebay", "bunker", "turret", "academy", "comsat", "factory", "shop", "expand"],
    weapons: ["infWeapons1", "infWeapons2"], armor: ["infArmor1"], shields: [],
    note: "값싼 보병과 메딕, 시즈 탱크의 포격 · 건물이 스스로 수리됨",
  },
  zerg: {
    id: "zerg", name: "저그", worker: "drone", base: "hatchery", supply: "overlord", refinery: "extractor", buildVerb: "변태", trainVerb: "변태",
    mainProducer: "hatchery", producers: ["hatchery", "hatch"], startLines: { hatchery: "zergling", hatch: "zergling" },
    builds: ["overlord", "pool", "extractor", "hatch", "evo", "sunken", "spore", "den", "cavern", "expand"],
    weapons: [], weaponGroups: { melee: ["zMelee1", "zMelee2"], missile: ["zMissile1", "zMissile2"] }, armor: ["zCarapace1"], shields: [],
    note: "해처리마다 쏟아지는 값싼 물량 · 몸이 저절로 회복되고 럴커는 땅속에 숨음",
  },
};

/** 소환 중인 건물을 취소하면 돌려받는 비율. 프로브·유닛·연구 취소는 전액 환불. */
export const STW_CANCEL_REFUND = 0.75;

/**
 * 지역 방어: 방어 건물은 자기 사거리 안의 적뿐 아니라, 같은 기지의 어떤 건물이든 이 거리 안에서 노릴 수 있는 적을 모두 쏜다.
 * 사거리 8(드라군 특이점 충전, 리버)까지 덮고, 시즈 모드 탱크(12)만 밖에서 때릴 수 있다.
 */
export const STW_DEFENSE_REACH = 8.5;

export const STW_STORM = { energy: 75, radius: 3.2, duration: 3, dps: 35, castRange: 9, minTargets: 3 };

export const STW_ECONOMY = {
  startMinerals: 50,
  startProbes: 4,
  mineralRate: 0.95,
  fullSaturation: 16,
  maxSaturation: 24,
  overflowRate: 0.45,
  gasPerProbe: 0.55,
  probesPerGas: 3,
  minMineralProbes: 4,
  mainMinerals: 12000,
  naturalMinerals: 9000,
  lowMinerals: 1500,
  supplyLimit: 100,
  probeQueueLimit: 5,
  shieldRegen: 2,
  shieldRegenDelay: 7,
  zergRegen: 0.6,
};

export const STW_SIZE_MULTIPLIER = {
  normal: { small: 1, medium: 1, large: 1 },
  explosive: { small: 0.5, medium: 0.75, large: 1 },
  concussive: { small: 1, medium: 0.5, large: 0.25 },
};

export const STW_DIFFICULTIES = {
  easy: { id: "easy", name: "쉬움", note: "적 수입 −20% · 공격이 느림", income: 0.8, thinkEvery: 1.5, waveScale: 1.25 },
  normal: { id: "normal", name: "보통", note: "같은 규칙으로 싸우는 기본 난이도", income: 1, thinkEvery: 1, waveScale: 1 },
  hard: { id: "hard", name: "어려움", note: "적 수입 +15% · 빠르고 집요한 공격", income: 1.15, thinkEvery: 0.6, waveScale: 0.85 },
};

export const STW_AI_PERSONAS = {
  rush: { id: "rush", name: "질럿 러시", note: "게이트웨이를 빨리 늘려 질럿으로 몰아친다" },
  dragoon: { id: "dragoon", name: "드라군 운영", note: "앞마당을 먹고 사거리 드라군으로 민다" },
  templar: { id: "templar", name: "템플러 테크", note: "질럿으로 버티며 스톰을 준비한다" },
  dark: { id: "dark", name: "다크템플러 기습", note: "빠르게 아카이브를 올려 보이지 않는 칼날로 찌른다" },
  robo: { id: "robo", name: "로보 운영", note: "드라군과 리버, 옵저버로 천천히 밀어붙인다" },
  bio: { id: "bio", race: "terran", name: "바이오닉 러시", note: "해병과 메딕, 스팀팩으로 빠르게 몰아친다" },
  mech: { id: "mech", race: "terran", name: "메카닉 운영", note: "벌처로 버티며 시즈 탱크 포격선을 민다" },
  tankbio: { id: "tankbio", race: "terran", name: "탱크 바이오", note: "해병·메딕 뒤에 시즈 탱크를 받쳐 앞마당과 함께 민다" },
  vulture: { id: "vulture", race: "terran", name: "벌처 러시", note: "팩토리 둘에서 빠른 벌처를 쏟아내 일찍 흔든다" },
  ling: { id: "ling", race: "zerg", name: "저글링 러시", note: "해처리를 늘려 대사 촉진 저글링으로 휩쓴다" },
  hydra: { id: "hydra", race: "zerg", name: "히드라 럴커", note: "히드라로 버티며 럴커와 울트라리스크까지 올린다" },
  pool: { id: "pool", race: "zerg", name: "빠른 저글링", note: "스포닝 풀부터 올리고 드론을 아껴 이른 저글링으로 찌른다" },
  ultra: { id: "ultra", race: "zerg", name: "울트라 운영", note: "앞마당을 빨리 먹고 성큰으로 버티며 울트라리스크와 저글링으로 민다" },
};
for (const persona of Object.values(STW_AI_PERSONAS)) persona.race ??= "protoss";
