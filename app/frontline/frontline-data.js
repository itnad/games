// 전선 지휘관 고정 데이터: 지도, 유닛, 건물, 대형, 난이도.
// 모든 좌표는 가로 100 × 세로 150의 논리 좌표계이며 아군은 아래쪽, 적은 위쪽에서 시작한다.

export const FRONTLINE_MAP_WIDTH = 100;
export const FRONTLINE_MAP_HEIGHT = 150;
export const FRONTLINE_TICK = 0.1;

/**
 * 지역은 180도 회전 대칭이다. (x, y) ↔ (100 - x, 150 - y)
 * mine: 광석 매장량, highGround: 방어 보정, slots: 건물 자리 수
 */
export const FRONTLINE_ZONES = [
  { id: "home", name: "아군 본진", short: "본진", x: 50, y: 136, radius: 13, mine: 9000, slots: 9, start: "player" },
  { id: "south", name: "남부 광산", short: "남부", x: 20, y: 110, radius: 11, mine: 6000, slots: 6 },
  { id: "east", name: "동부 수정밭", short: "동부", x: 82, y: 84, radius: 11, mine: 4000, slots: 5 },
  { id: "center", name: "중앙 고지", short: "중앙", x: 50, y: 75, radius: 12, mine: 0, slots: 4, highGround: true },
  { id: "west", name: "서부 수정밭", short: "서부", x: 18, y: 66, radius: 11, mine: 4000, slots: 5 },
  { id: "north", name: "북부 광산", short: "북부", x: 80, y: 40, radius: 11, mine: 6000, slots: 6 },
  { id: "enemy", name: "적 본진", short: "적 본진", x: 50, y: 14, radius: 13, mine: 9000, slots: 9, start: "enemy" },
];

export const FRONTLINE_EDGES = [
  ["home", "south"],
  ["home", "east"],
  ["south", "west"],
  ["south", "center"],
  ["east", "center"],
  ["east", "north"],
  ["west", "center"],
  ["west", "enemy"],
  ["north", "center"],
  ["north", "enemy"],
];

export const FRONTLINE_UNITS = {
  worker: { id: "worker", name: "일꾼", short: "일", cost: 50, time: 12, supply: 1, producer: ["hq", "outpost"] },
  rifle: {
    id: "rifle", name: "소총병", short: "소", cost: 50, time: 16, supply: 1, producer: ["barracks"],
    hp: 45, armor: 0, damage: 6, range: 7, cooldown: 0.9, speed: 3.2, radius: 1.1, role: "ranged",
    note: "사거리 7 · 값싼 주력 사격 유닛",
  },
  guard: {
    id: "guard", name: "방패병", short: "방", cost: 75, time: 20, supply: 2, producer: ["barracks"],
    hp: 125, armor: 2, damage: 11, range: 1.8, cooldown: 1.1, speed: 3.4, radius: 1.4, role: "melee",
    note: "체력 125 · 앞줄에서 피해를 받아냄",
  },
  tank: {
    id: "tank", name: "공성 전차", short: "전", cost: 150, time: 30, supply: 3, producer: ["factory"],
    hp: 170, armor: 2, damage: 28, range: 12, cooldown: 2.6, speed: 2.3, radius: 1.9, role: "siege",
    splash: 2.6, buildingBonus: 1.5,
    note: "사거리 12 · 광역 포격 · 건물에 1.5배 피해",
  },
};

export const FRONTLINE_COMBAT_UNIT_IDS = ["rifle", "guard", "tank"];

export const FRONTLINE_BUILDINGS = {
  hq: { id: "hq", name: "사령부", short: "사", cost: 400, time: 60, hp: 1500, armor: 1, supply: 10, size: 7, trains: ["worker"] },
  outpost: {
    id: "outpost", name: "전진기지", short: "전", cost: 300, time: 40, hp: 800, armor: 1, supply: 6, size: 5.5, trains: ["worker"],
    note: "광산 지역을 점령하고 일꾼을 배치할 수 있게 합니다",
  },
  depot: { id: "depot", name: "보급고", short: "보", cost: 100, time: 20, hp: 350, armor: 1, supply: 8, size: 3.6, note: "보급 한도 +8" },
  barracks: {
    id: "barracks", name: "병영", short: "병", cost: 150, time: 30, hp: 650, armor: 1, size: 4.8, trains: ["rifle", "guard"],
    note: "소총병과 방패병을 훈련합니다",
  },
  factory: {
    id: "factory", name: "군수공장", short: "공", cost: 200, time: 40, hp: 750, armor: 1, size: 5.2, trains: ["tank"], requires: "barracks",
    note: "공성 전차를 생산합니다 · 병영 필요",
  },
  turret: {
    id: "turret", name: "방어 포탑", short: "포", cost: 120, time: 25, hp: 420, armor: 1, size: 3.2,
    damage: 10, range: 9, cooldown: 1, note: "사거리 9 자동 방어",
  },
};

export const FRONTLINE_BUILDABLE_IDS = ["depot", "barracks", "factory", "turret", "outpost"];

export const FRONTLINE_FORMATIONS = {
  line: {
    id: "line", name: "횡대", spacing: 2.8, rowWidth: 8,
    note: "근접 앞·원거리 뒤로 정렬 · 원거리 피해 +15% · 이동 −10%",
    rangedDamage: 1.15, meleeDamage: 1, damageTaken: 1, splashTaken: 1, speed: 0.9,
  },
  wedge: {
    id: "wedge", name: "쐐기", spacing: 2.4, rowWidth: 5,
    note: "돌파 대형 · 근접 피해 +25% · 이동 +15% · 받는 피해 +10%",
    rangedDamage: 1, meleeDamage: 1.25, damageTaken: 1.1, splashTaken: 1, speed: 1.15,
  },
  spread: {
    id: "spread", name: "산개", spacing: 4.6, rowWidth: 6,
    note: "넓게 퍼짐 · 광역 포격 피해 −60% · 받는 피해 동일",
    rangedDamage: 1, meleeDamage: 1, damageTaken: 1, splashTaken: 0.4, speed: 1,
  },
};

export const FRONTLINE_SQUAD_IDS = [1, 2, 3];

export const FRONTLINE_DIFFICULTIES = {
  easy: { id: "easy", name: "훈련병", note: "적 수입 −25% · 공격이 늦음", income: 0.75, firstWave: 14, waveGrowth: 6, thinkEvery: 1.6, firstAttackAt: 300 },
  normal: { id: "normal", name: "지휘관", note: "같은 규칙으로 싸우는 기본 난이도", income: 1, firstWave: 12, waveGrowth: 6, thinkEvery: 1, firstAttackAt: 220 },
  hard: { id: "hard", name: "사령관", note: "적 수입 +20% · 빠르고 집요한 공격", income: 1.2, firstWave: 10, waveGrowth: 7, thinkEvery: 0.6, firstAttackAt: 170 },
};

export const FRONTLINE_ECONOMY = {
  startOre: 150,
  startWorkers: 6,
  orePerWorker: 1,
  fullSaturation: 8,
  maxSaturation: 12,
  overflowRate: 0.5,
  workerSpeed: 6,
  workerHp: 40,
  queueLimit: 5,
  supplyLimit: 100,
};

export const FRONTLINE_HIGH_GROUND_REDUCTION = 0.8;
