// 스타즈워 고정 데이터. 이름은 모두 여기 모여 있어 독자 이름으로 바꿀 때 이 파일만 고치면 된다.
// 전장은 가로 40 × 세로 100의 한 줄 전선이다. 아군 본진은 아래(y=100 쪽), 적 본진은 위(y=0 쪽).

export const STW_LANE_WIDTH = 40;
export const STW_LANE_LENGTH = 100;
export const STW_TICK = 0.1;

/** 아군 기준 위치. 적은 (40 - x, 100 - y)로 점대칭. */
export const STW_LAYOUT = {
  mainNexus: { x: 20, y: 94 },
  naturalNexus: { x: 20, y: 73 },
  mainMinerals: { x: 20, y: 99.2 },
  naturalMinerals: { x: 20, y: 78.6 },
  geysers: [{ x: 5, y: 98 }, { x: 35, y: 98 }],
  mainSlots: [
    { x: 6, y: 86.5 }, { x: 34, y: 86.5 }, { x: 6, y: 92 }, { x: 34, y: 92 },
    { x: 11.5, y: 89 }, { x: 28.5, y: 89 }, { x: 11.5, y: 95.5 }, { x: 28.5, y: 95.5 },
    { x: 13, y: 83 }, { x: 27, y: 83 }, { x: 20, y: 85.2 },
  ],
  frontSlots: [{ x: 7, y: 81 }, { x: 33, y: 81 }],
  naturalSlots: [{ x: 8, y: 70 }, { x: 32, y: 70 }, { x: 12, y: 66 }, { x: 28, y: 66 }],
};

/** 집결 위치. y는 아군 기준. */
export const STW_RALLY_POINTS = [
  { id: "main", name: "본진 앞", short: "본진", y: 77 },
  { id: "natural", name: "앞마당", short: "앞마당", y: 64 },
  { id: "center", name: "중앙", short: "중앙", y: 50 },
  { id: "forward", name: "적 앞마당 앞", short: "전진", y: 36 },
];

export const STW_UNITS = {
  probe: {
    id: "probe", name: "프로브", short: "P", minerals: 50, gas: 0, time: 12, supply: 1, from: "nexus",
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
    note: "무기 없음 · 사이오닉 스톰으로 뭉친 적을 녹임",
  },
};

export const STW_ARMY_UNITS = ["zealot", "dragoon", "templar"];

export const STW_BUILDINGS = {
  nexus: { id: "nexus", name: "넥서스", minerals: 400, gas: 0, time: 70, hp: 1000, shields: 1000, armor: 1, size: 8, supply: 10, sight: 11 },
  pylon: { id: "pylon", name: "파일런", minerals: 100, gas: 0, time: 18, hp: 200, shields: 200, armor: 1, size: 3.4, supply: 8, sight: 8, note: "인구 +8" },
  gateway: { id: "gateway", name: "게이트웨이", minerals: 150, gas: 0, time: 30, hp: 500, shields: 500, armor: 1, size: 5, requires: "pylon", sight: 8, note: "전투 유닛 생산 라인 +1" },
  assimilator: { id: "assimilator", name: "어시밀레이터", minerals: 75, gas: 0, time: 20, hp: 450, shields: 450, armor: 1, size: 4.2, sight: 6, note: "가스 채취 · 프로브 3기 배치" },
  core: { id: "core", name: "사이버네틱스 코어", minerals: 150, gas: 0, time: 30, hp: 500, shields: 500, armor: 1, size: 4.6, requires: "gateway", sight: 8, note: "드라군 해금 · 사거리 연구" },
  forge: { id: "forge", name: "포지", minerals: 150, gas: 0, time: 28, hp: 550, shields: 550, armor: 1, size: 4.6, requires: "pylon", sight: 8, note: "지상 공격·방어 업그레이드 · 포톤 캐논 해금" },
  cannon: {
    id: "cannon", name: "포톤 캐논", minerals: 150, gas: 0, time: 25, hp: 100, shields: 100, armor: 0, size: 3.2, requires: "forge", sight: 11,
    damage: 20, hits: 1, damageType: "normal", range: 7, cooldown: 1.25, note: "사거리 7 방어 건물 · 앞마당이 있으면 앞마당에 세움",
  },
  citadel: { id: "citadel", name: "아둔의 성소", minerals: 150, gas: 100, time: 35, hp: 450, shields: 450, armor: 1, size: 4.4, requires: "core", sight: 8, note: "질럿 다리 강화 연구 · 아카이브 해금" },
  archives: { id: "archives", name: "템플러 아카이브", minerals: 150, gas: 200, time: 40, hp: 500, shields: 500, armor: 1, size: 4.6, requires: "citadel", sight: 8, note: "하이템플러 해금 · 사이오닉 스톰 연구" },
};

/** 플레이어가 고를 수 있는 건설 목록. 앞마당 넥서스는 별도 키. */
export const STW_BUILD_CHOICES = ["pylon", "gateway", "assimilator", "core", "forge", "cannon", "citadel", "archives", "expand"];

export const STW_RESEARCH = {
  weapons1: { id: "weapons1", name: "지상 공격 1단계", at: "forge", minerals: 100, gas: 100, time: 40, note: "질럿 +1×2, 드라군 +2" },
  armor1: { id: "armor1", name: "지상 방어 1단계", at: "forge", minerals: 100, gas: 100, time: 40, note: "모든 유닛 방어력 +1" },
  weapons2: { id: "weapons2", name: "지상 공격 2단계", at: "forge", minerals: 150, gas: 150, time: 50, requires: ["weapons1", "citadel"], note: "공격력 한 단계 더" },
  shields1: { id: "shields1", name: "보호막 1단계", at: "forge", minerals: 150, gas: 150, time: 45, requires: ["armor1"], note: "보호막 방어력 +1" },
  range: { id: "range", name: "특이점 충전", at: "core", minerals: 150, gas: 150, time: 45, note: "드라군 사거리 5.5 → 8" },
  charge: { id: "charge", name: "다리 강화", at: "citadel", minerals: 150, gas: 150, time: 45, note: "질럿 이동 속도 +50%" },
  storm: { id: "storm", name: "사이오닉 스톰", at: "archives", minerals: 200, gas: 200, time: 55, note: "하이템플러가 뭉친 적에게 스톰을 자동 시전" },
};

/** 소환 중인 건물을 취소하면 돌려받는 비율. 프로브·유닛·연구 취소는 전액 환불. */
export const STW_CANCEL_REFUND = 0.75;

export const STW_STORM = { energy: 75, radius: 3.2, duration: 3, dps: 26, castRange: 9, minTargets: 3 };

export const STW_ECONOMY = {
  startMinerals: 50,
  startProbes: 4,
  mineralRate: 0.95,
  fullSaturation: 16,
  maxSaturation: 24,
  overflowRate: 0.45,
  gasPerProbe: 0.3,
  probesPerGas: 3,
  minMineralProbes: 4,
  mainMinerals: 9000,
  naturalMinerals: 7000,
  supplyLimit: 100,
  probeQueueLimit: 5,
  shieldRegen: 2,
  shieldRegenDelay: 7,
};

export const STW_SIZE_MULTIPLIER = {
  normal: { small: 1, medium: 1, large: 1 },
  explosive: { small: 0.5, medium: 0.75, large: 1 },
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
};
