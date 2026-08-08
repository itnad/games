export const MUDFLAT_RUN_SECONDS = 240;
export const MUDFLAT_JOYSTICK_RADIUS = 72;

export const MUDFLAT_CREATURES = [
  { id: "clam", name: "바지락", icon: "◒", color: "#eee0bd", hp: 2, speed: 24, size: 13, xp: 1, score: 8, unlock: 0 },
  { id: "crab", name: "칠게", icon: "♋", color: "#ef6d52", hp: 4, speed: 34, size: 15, xp: 2, score: 15, unlock: 18 },
  { id: "shrimp", name: "새우", icon: "⌁", color: "#eda584", hp: 5, speed: 34, size: 14, xp: 3, score: 22, unlock: Infinity },
  { id: "mudfish", name: "망둥어", icon: "⌁", color: "#8fc7b1", hp: 7, speed: 47, size: 14, xp: 3, score: 24, unlock: 45 },
  { id: "whelk", name: "소라", icon: "@", color: "#c99a68", hp: 12, speed: 23, size: 18, xp: 4, score: 38, unlock: 78 },
  { id: "octopus", name: "낙지", icon: "✣", color: "#b878a8", hp: 18, speed: 38, size: 20, xp: 6, score: 60, unlock: 120 },
  { id: "king-crab", name: "대왕 꽃게", icon: "♛", color: "#f0a33b", hp: 420, speed: 28, size: 43, xp: 80, score: 1800, unlock: 200, boss: true },
];

export const MUDFLAT_ROCK_FINDINGS = [
  { type: "whelk", name: "소라", movement: "still", chance: 0.4 },
  { type: "clam", name: "조개", movement: "still", chance: 0.3 },
  { type: "shrimp", name: "새우", movement: "wander", chance: 0.2 },
  { type: "octopus", name: "낙지", movement: "flee", chance: 0.1 },
];

export const MUDFLAT_SEAFOOD_MARKET = [
  { type: "clam", name: "조개", icon: "◒", price: 4 },
  { type: "crab", name: "칠게", icon: "♋", price: 8 },
  { type: "shrimp", name: "새우", icon: "⌁", price: 12 },
  { type: "mudfish", name: "망둥어", icon: "◇", price: 15 },
  { type: "whelk", name: "소라", icon: "@", price: 22 },
  { type: "octopus", name: "낙지", icon: "✣", price: 36 },
  { type: "king-crab", name: "대왕 꽃게", icon: "♛", price: 240 },
];

export const MUDFLAT_SHOP_EQUIPMENT = [
  { id: "gloves", icon: "⌁", name: "미끄럼 방지 장갑", description: "모든 채집 도구의 위력이 12% 증가합니다.", basePrice: 90, priceStep: 70, max: 4 },
  { id: "waders", icon: "≫", name: "강화 갯벌 장화", description: "이동 속도가 5% 증가하고 최대 체력이 8 늘어납니다.", basePrice: 110, priceStep: 80, max: 4 },
  { id: "cooler", icon: "▣", name: "보냉 바구니", description: "해산물 판매가가 8% 오르고 수집 범위가 넓어집니다.", basePrice: 100, priceStep: 75, max: 4 },
  { id: "vest", icon: "♥", name: "부력 작업 조끼", description: "최대 체력이 15 늘어납니다.", basePrice: 130, priceStep: 95, max: 3 },
];

export const MUDFLAT_RECOVERY_FOODS = [
  { id: "fishcake", icon: "♨", name: "따뜻한 어묵국", description: "체력을 35 회복합니다.", price: 35, heal: 35 },
  { id: "riceball", icon: "●", name: "든든한 주먹밥", description: "체력을 70 회복합니다.", price: 65, heal: 70 },
  { id: "porridge", icon: "◉", name: "해물죽 한 그릇", description: "체력을 모두 회복합니다.", price: 110, heal: Infinity },
];

export const MUDFLAT_UPGRADES = [
  { id: "hoe", icon: "⌁", name: "호미질", description: "채집 범위와 위력이 커집니다.", max: 6 },
  { id: "net", icon: "◇", name: "자동 뜰채", description: "가까운 해산물에게 그물을 던집니다.", max: 6 },
  { id: "salt", icon: "✦", name: "왕소금", description: "주위를 도는 소금 결정이 해산물을 잡습니다.", max: 6 },
  { id: "boots", icon: "≫", name: "갯벌 장화", description: "진흙에서도 더 빠르게 이동합니다.", max: 5 },
  { id: "basket", icon: "◉", name: "넓은 바구니", description: "경험치와 보상을 끌어당기는 범위가 넓어집니다.", max: 5 },
  { id: "stamina", icon: "♥", name: "든든한 간식", description: "최대 체력과 현재 체력을 회복합니다.", max: 5 },
];

export const MUDFLAT_GENERAL_UPGRADES = [
  { id: "basket", icon: "◉", name: "넓은 바구니", description: "경험치와 보상을 끌어당기는 범위가 넓어집니다.", max: 6 },
  { id: "tongs", icon: "⌁", name: "집게 숙련도", description: "집게를 쓰는 방식과 파워가 상승합니다.", max: 6 },
  { id: "harpoon", icon: "➶", name: "작살던지기", description: "가장 가까운 해산물을 향해 여러 대상을 관통하는 작살을 던집니다.", max: 6 },
  { id: "boots", icon: "≫", name: "갯벌 장화", description: "내구도가 강하고 더 빠르게 이동합니다.", max: 6 },
  { id: "snack", icon: "♥", name: "든든한 간식", description: "최대 체력 상승 및 현재 체력을 회복합니다.", max: 6 },
  { id: "rocker", icon: "◆", name: "돌뒤집게", description: "돌 밑에 숨어있는 해산물을 찾아낼 수 있습니다.", max: 6 },
  { id: "net", icon: "◇", name: "뜰채", description: "넓은 범위의 채집이 가능합니다.", max: 6 },
];

export function mudflatJoystickVector(deltaX, deltaY, radius = MUDFLAT_JOYSTICK_RADIUS, deadzone = 5) {
  const length = Math.hypot(deltaX, deltaY);
  if (!Number.isFinite(length) || length <= deadzone) return { x: 0, y: 0, strength: 0 };
  const clamped = Math.min(radius, length);
  const strength = Math.min(1, (clamped - deadzone) / Math.max(1, radius - deadzone));
  return { x: deltaX / length * strength, y: deltaY / length * strength, strength };
}

export function mudflatSpawnInterval(elapsedSeconds, mode = "kids") {
  const base = Math.max(0.14, 0.62 - Math.max(0, elapsedSeconds) * 0.002);
  return mode === "normal" ? Math.max(0.11, base * 0.82) : base;
}

export function mudflatCreatureForTime(elapsedSeconds, roll = 0) {
  const available = MUDFLAT_CREATURES.filter((item) => !item.boss && item.unlock <= elapsedSeconds);
  const index = Math.min(available.length - 1, Math.floor(Math.max(0, Math.min(0.9999, roll)) * available.length));
  return available[Math.max(0, index)];
}

export function mudflatUpgradeChoices(level, levels = {}, mode = "kids") {
  const upgrades = mode === "normal" ? MUDFLAT_GENERAL_UPGRADES : MUDFLAT_UPGRADES;
  const available = upgrades.filter((item) => (levels[item.id] ?? 0) < item.max);
  if (available.length <= 3) return available;
  const start = (Math.max(1, level) * 2 + Math.floor(level / 3)) % available.length;
  return Array.from({ length: 3 }, (_, index) => available[(start + index * 2) % available.length]);
}

export function mudflatTongStats(level = 1) {
  const safeLevel = Math.max(1, Math.floor(level));
  const multiplier = 1.5 ** (safeLevel - 1);
  return { rotationSpeed: 1.55 * multiplier, power: 5.5 * multiplier, reach: 84 };
}

export function mudflatHarpoonStats(level = 0, viewportWidth = 0) {
  const safeLevel = Math.max(0, Math.floor(level));
  if (safeLevel === 0) return { range: 0, damage: 0, speed: 760, interval: Infinity };
  return {
    range: Math.max(0, viewportWidth) * 0.7 * 1.2 ** (safeLevel - 1),
    damage: 30 * 1.5 ** (safeLevel - 1),
    speed: 760,
    interval: 2.2,
  };
}

export function mudflatRockTurnerStats(level = 0) {
  const safeLevel = Math.max(0, Math.floor(level));
  if (safeLevel === 0) return { interval: Infinity, activationsPerSecond: 0, creatureChance: 0 };
  const activationsPerSecond = 1.3 ** (safeLevel - 1);
  return {
    interval: 1 / activationsPerSecond,
    activationsPerSecond,
    creatureChance: Math.min(1, Math.round((0.2 + (safeLevel - 1) * 0.1) * 100) / 100),
  };
}

export function mudflatRockCreatureForRoll(roll = 0) {
  const safeRoll = Math.max(0, Math.min(0.999999, Number.isFinite(roll) ? roll : 0));
  let accumulated = 0;
  for (const finding of MUDFLAT_ROCK_FINDINGS) {
    accumulated += finding.chance;
    if (safeRoll < accumulated) return finding;
  }
  return MUDFLAT_ROCK_FINDINGS.at(-1);
}

export function mudflatStageStats(stage = 1) {
  const safeStage = Math.max(1, Math.floor(stage));
  return {
    creatureHpMultiplier: 1 + (safeStage - 1) * 0.18,
    creatureSpeedMultiplier: 1 + (safeStage - 1) * 0.05,
    spawnIntervalMultiplier: Math.max(0.58, 1 - (safeStage - 1) * 0.045),
    contactDamageBonus: (safeStage - 1) * 2,
    rockLimit: Math.min(32, 20 + (safeStage - 1) * 2),
  };
}

export function mudflatSeafoodSaleValue(type, count = 1, coolerLevel = 0) {
  const market = MUDFLAT_SEAFOOD_MARKET.find((item) => item.type === type);
  const safeCount = Math.max(0, Math.floor(count));
  if (!market || safeCount === 0) return 0;
  const saleMultiplier = 1 + Math.max(0, Math.floor(coolerLevel)) * 0.08;
  return Math.floor(market.price * safeCount * saleMultiplier);
}

export function mudflatEquipmentPrice(id, currentLevel = 0) {
  const equipment = MUDFLAT_SHOP_EQUIPMENT.find((item) => item.id === id);
  if (!equipment) return Infinity;
  return equipment.basePrice + Math.max(0, Math.floor(currentLevel)) * equipment.priceStep;
}

export function mudflatTrainingPrice(currentLevel = 0) {
  return 70 + Math.max(0, Math.floor(currentLevel)) * 45;
}

export function mudflatFinalScore({ catchScore = 0, caught = 0, elapsed = 0, bossCaught = false }) {
  const survivalBonus = Math.floor(Math.min(MUDFLAT_RUN_SECONDS, elapsed) * 4);
  return Math.max(0, Math.floor(catchScore + caught * 3 + survivalBonus + (bossCaught ? 2500 : 0)));
}
