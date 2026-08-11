export const MUDFLAT_RUN_SECONDS = 240;
export const MUDFLAT_JOYSTICK_RADIUS = 72;

export const MUDFLAT_CREATURES = [
  { id: "small-crab", name: "작은게", family: "crab", sprite: "/mudflat-creatures/small-crab.svg", icon: "♋", color: "#d6a177", hp: 2, speed: 25, size: 11, xp: 1, score: 6, unlock: 0 },
  { id: "crab", name: "칠게", family: "crab", sprite: "/mudflat-creatures/chilge.svg", icon: "♋", color: "#ef6d52", hp: 4, speed: 34, size: 13, xp: 2, score: 15, unlock: 15 },
  { id: "shore-crab", name: "방게", family: "crab", sprite: "/mudflat-creatures/shore-crab.svg", icon: "♋", color: "#bd8058", hp: 7, speed: 38, size: 15, xp: 3, score: 24, unlock: 40 },
  { id: "fiddler-crab", name: "농게", family: "crab", sprite: "/mudflat-creatures/fiddler-crab.svg", icon: "♋", color: "#e3a449", hp: 12, speed: 43, size: 17, xp: 4, score: 38, unlock: 70 },
  { id: "blue-crab", name: "민꽃게", family: "crab", sprite: "/mudflat-creatures/blue-crab.svg", icon: "♋", color: "#6bafa7", hp: 20, speed: 46, size: 20, xp: 6, score: 62, unlock: 105 },
  { id: "purple-crab", name: "보라돌이", family: "crab", sprite: "/mudflat-creatures/purple-crab.svg", icon: "♋", color: "#a66cb0", hp: 36, speed: 40, size: 24, xp: 10, score: 110, unlock: 150 },
  { id: "shrimp", name: "새우", family: "seafood", sprite: "/mudflat-creatures/shrimp.png", icon: "⌁", color: "#eda584", hp: 5, speed: 34, size: 14, xp: 3, score: 22, unlock: 32, movement: "wander" },
  { id: "whelk", name: "소라", family: "seafood", sprite: "/mudflat-creatures/whelk.png", icon: "@", color: "#c99a68", hp: 14, speed: 7.75, size: 9, visualScale: 1.2, xp: 5, score: 45, unlock: 65, movement: "flee", requiresHeadlamp: true },
  { id: "octopus", name: "낙지", family: "seafood", sprite: "/mudflat-creatures/octopus.png", icon: "✣", color: "#c9cdd0", hp: 22, speed: 38, size: 20, xp: 8, score: 75, unlock: 110, movement: "flee" },
  { id: "golbaengi", name: "골뱅이", family: "seafood", sprite: "/mudflat-creatures/golbaengi-v2.png", icon: "@", color: "#b97b42", hp: 16, speed: 7.75, size: 19, visualScale: .8, xp: 6, score: 52, unlock: 90, movement: "chase", requiresHeadlamp: true },
  { id: "flounder", name: "광어", family: "seafood", sprite: "/mudflat-creatures/flounder.png", icon: "◇", color: "#a59369", hp: 30, speed: 52, size: 22, xp: 10, score: 95, unlock: 145, movement: "flee" },
  { id: "pufferfish", name: "복어", family: "seafood", sprite: "/mudflat-creatures/pufferfish.png", icon: "●", color: "#d69a38", hp: 118, speed: 108.5, size: 17.6, xp: 7, score: 68, unlock: 0, movement: "oval", spawnVariant: true },
  { id: "fist-whelk", name: "주먹소라", family: "seafood", sprite: "/mudflat-creatures/whelk.png", icon: "@", color: "#b77f4d", hp: 14, speed: 7.75, size: 18, visualScale: .8, xp: 5, score: 45, unlock: 65, movement: "flee", requiresHeadlamp: true, spawnVariant: true },
  { id: "king-crab", name: "대왕 박하지", family: "crab", sprite: "/mudflat-creatures/king-crab.svg", icon: "♛", color: "#3a195b", hp: 420, speed: 28, size: 43, xp: 80, score: 1800, unlock: 200, boss: true },
];

export const MUDFLAT_ROCK_FINDINGS = [
  { type: "shrimp", name: "새우", movement: "wander", level1Chance: 0.2, level6Chance: 0.1 },
  { type: "small-crab", name: "작은게", movement: "chase", level1Chance: 0.3, level6Chance: 0.2 },
  { type: "crab", name: "칠게", movement: "chase", level1Chance: 0.1, level6Chance: 0.1 },
  { type: "blue-crab", name: "민꽃게", movement: "chase", level1Chance: 0.1, level6Chance: 0.1 },
  { type: "octopus", name: "낙지", movement: "flee", level1Chance: 0.1, level6Chance: 0.2 },
  { type: "pufferfish", name: "복어", movement: "oval", level1Chance: 0.05, level6Chance: 0.15 },
];

export const MUDFLAT_CLAM_GRADES = [
  { id: "small-clam", name: "작은조개", xp: 1, score: 5, price: 0 },
  { id: "clam", name: "바지락", xp: 2, score: 9, price: 1 },
  { id: "dongjuk", name: "동죽", xp: 3, score: 16, price: 2 },
  { id: "hard-clam", name: "백합", xp: 5, score: 28, price: 3 },
  { id: "ark-shell", name: "피조개", xp: 7, score: 42, price: 10 },
  { id: "razor-clam", name: "맛조개", xp: 9, score: 62, price: 12 },
];

export const MUDFLAT_PEARL = { id: "pearl", name: "진주", xp: 30, score: 500, price: 10000 };

const MUDFLAT_CLAM_WEIGHTS = [
  [6, 3, 1, 0, 0, 0],
  [5, 2, 1, 1, 1, 0],
  [3, 2, 2, 1, 1, 1],
  [1, 2, 2, 2, 2, 1],
  [1, 1, 2, 2, 2, 2],
  [0, 1, 2, 3, 2, 2],
];

export const MUDFLAT_SEAFOOD_MARKET = [
  { type: "small-crab", name: "작은게", image: "/mudflat-creatures/small-crab.svg", price: 2 },
  { type: "crab", name: "칠게", image: "/mudflat-creatures/chilge.svg", price: 3 },
  { type: "shore-crab", name: "방게", image: "/mudflat-creatures/shore-crab.svg", price: 4 },
  { type: "fiddler-crab", name: "농게", image: "/mudflat-creatures/fiddler-crab.svg", price: 5 },
  { type: "blue-crab", name: "민꽃게", image: "/mudflat-creatures/blue-crab.svg", price: 7 },
  { type: "purple-crab", name: "보라돌이", image: "/mudflat-creatures/purple-crab.svg", price: 9 },
  { type: "shrimp", name: "새우", image: "/mudflat-creatures/shrimp.png", price: 1 },
  { type: "whelk", name: "소라", image: "/mudflat-creatures/whelk.png", price: 2 },
  { type: "fist-whelk", name: "주먹소라", image: "/mudflat-creatures/whelk.png", price: 8 },
  { type: "octopus", name: "낙지", image: "/mudflat-creatures/octopus.png", price: 20 },
  { type: "golbaengi", name: "골뱅이", image: "/mudflat-creatures/golbaengi-v2.png", price: 6 },
  { type: "flounder", name: "광어", image: "/mudflat-creatures/flounder.png", price: 50 },
  { type: "pufferfish", name: "복어", image: "/mudflat-creatures/pufferfish.png", price: 15 },
  ...MUDFLAT_CLAM_GRADES.map((item) => ({ type: item.id, name: item.name, image: item.id === "razor-clam" ? "/mudflat-creatures/razor-clam.svg" : "/mudflat-creatures/clam.png", price: item.price })),
  { type: MUDFLAT_PEARL.id, name: MUDFLAT_PEARL.name, image: "/mudflat-creatures/pearl.png", price: MUDFLAT_PEARL.price, unit: "개" },
  { type: "king-crab", name: "대왕 박하지", image: "/mudflat-creatures/king-crab.svg", price: 100 },
];

export const MUDFLAT_SHOP_EQUIPMENT = [
  { id: "gloves", icon: "⌁", name: "미끄럼 방지 장갑", description: "모든 채집 도구의 위력이 12% 증가합니다.", basePrice: 90, priceStep: 70, max: 4 },
  { id: "waders", icon: "≫", name: "강화 갯벌 장화", description: "이동 속도가 5% 증가하고 최대 체력이 8 늘어납니다.", basePrice: 110, priceStep: 80, max: 4 },
  { id: "cooler", icon: "▣", name: "보냉 바구니", description: "해산물 판매가가 8% 오르고 수집 범위가 넓어집니다.", basePrice: 100, priceStep: 75, max: 4 },
  { id: "vest", icon: "♥", name: "부력 작업 조끼", description: "최대 체력이 15 늘어납니다.", basePrice: 130, priceStep: 95, max: 3 },
  { id: "headlamp", icon: "◉", name: "헤드랜턴", description: "어두운 곳에 숨은 소라와 골뱅이가 출현합니다.", basePrice: 1000, priceStep: 0, max: 1 },
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
  { id: "digging", icon: "⌁", name: "호미질", description: "조개 구멍에서 더 좋은 조개를 찾을 확률이 높아집니다.", max: 6 },
];

export function mudflatJoystickVector(deltaX, deltaY, radius = MUDFLAT_JOYSTICK_RADIUS, deadzone = 5) {
  const length = Math.hypot(deltaX, deltaY);
  if (!Number.isFinite(length) || length <= deadzone) return { x: 0, y: 0, strength: 0 };
  const clamped = Math.min(radius, length);
  const strength = Math.min(1, (clamped - deadzone) / Math.max(1, radius - deadzone));
  return { x: deltaX / length * strength, y: deltaY / length * strength, strength };
}

export function mudflatBossPulse(elapsedSeconds = 0, phase = 0) {
  const safeElapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  const safePhase = Number.isFinite(phase) ? phase : 0;
  const wave = (Math.sin(safeElapsed * 3.2 + safePhase) + 1) / 2;
  const purple = [58, 25, 91];
  const navy = [18, 43, 77];
  const mixed = purple.map((value, index) => Math.round(value + (navy[index] - value) * wave));
  return {
    wave,
    scaleX: .96 + wave * .12,
    scaleY: 1.08 - wave * .12,
    color: `rgb(${mixed.join(",")})`,
  };
}

export function mudflatEmptySeafoodHazard(emptySeconds = 0) {
  const safeSeconds = Math.max(0, Number.isFinite(emptySeconds) ? emptySeconds : 0);
  if (safeSeconds >= 30) return { damagePerSecond: 10, message: "너무 춥다. 되돌아가야해" };
  if (safeSeconds >= 10) return { damagePerSecond: 1, message: "너무 깊게 들어온 것 같다." };
  return { damagePerSecond: 0, message: "" };
}

export function mudflatSpawnInterval(elapsedSeconds, mode = "kids") {
  const base = Math.max(0.14, 0.62 - Math.max(0, elapsedSeconds) * 0.002);
  return mode === "normal" ? Math.max(0.11, base * 0.82) : base;
}

export function mudflatCreatureForTime(elapsedSeconds, roll = 0, options = {}) {
  const available = MUDFLAT_CREATURES.filter((item) => !item.boss && !item.spawnVariant && item.unlock <= elapsedSeconds && (!item.requiresHeadlamp || options.headlamp));
  const safeRoll = Math.max(0, Math.min(0.9999, roll));
  const scaledRoll = safeRoll * available.length;
  const index = Math.min(available.length - 1, Math.floor(scaledRoll));
  const selected = available[Math.max(0, index)];
  if (selected?.id === "whelk" && scaledRoll - Math.floor(scaledRoll) < 0.1) {
    return MUDFLAT_CREATURES.find((item) => item.id === "fist-whelk") ?? selected;
  }
  return selected;
}

export function mudflatClamRewardForRoll(level = 1, roll = 0) {
  const safeLevel = Math.max(1, Math.min(6, Math.floor(level)));
  const safeRoll = Math.max(0, Math.min(0.999999, Number.isFinite(roll) ? roll : 0));
  if (safeLevel === 6 && safeRoll < 0.01) return MUDFLAT_PEARL;
  const shellRoll = safeLevel === 6 ? (safeRoll - 0.01) / 0.99 : safeRoll;
  const weights = MUDFLAT_CLAM_WEIGHTS[safeLevel - 1];
  const total = weights.reduce((sum, value) => sum + value, 0);
  let threshold = Math.max(0, shellRoll) * total;
  for (let index = 0; index < weights.length; index += 1) {
    threshold -= weights[index];
    if (threshold < 0 && weights[index] > 0) return MUDFLAT_CLAM_GRADES[index];
  }
  return MUDFLAT_CLAM_GRADES.at(-1);
}

export function mudflatUpgradeChoices(_level, levels = {}, mode = "kids", random = Math.random) {
  const upgrades = mode === "normal" ? MUDFLAT_GENERAL_UPGRADES : MUDFLAT_UPGRADES;
  const ownedSkillCount = upgrades.filter((item) => (levels[item.id] ?? 0) > 0).length;
  const hasOpenSkillSlot = mode !== "normal" || ownedSkillCount < 6;
  const available = upgrades.filter((item) => {
    const currentLevel = levels[item.id] ?? 0;
    return currentLevel < item.max && (hasOpenSkillSlot || currentLevel > 0);
  });
  if (available.length <= 3) return available;
  const shuffled = [...available];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, 3);
}

export function mudflatTongStats(level = 1) {
  const safeLevel = Math.max(1, Math.floor(level));
  const multiplier = 1.5 ** (safeLevel - 1);
  return { rotationSpeed: 1.55 * multiplier, power: 5.5 * multiplier, reach: 84 };
}

export function mudflatNetStats(level = 0) {
  const safeLevel = Math.max(0, Math.min(6, Math.floor(level)));
  if (safeLevel === 0) return { range: 0, radius: 0, width: 0, headDepth: 0, scale: 0 };
  const tongRange = mudflatTongStats(1).reach;
  // The net grows in five equal steps: level 1 is the tong reach and level 6
  // is exactly twice that reach.  `radius`/`headDepth` describe the visible
  // oval net head, so the damage area can use the same shape rather than a
  // large circular splash around the target.
  const scale = 1 + (safeLevel - 1) / 5;
  const radius = tongRange * 0.43 * scale;
  return {
    range: tongRange * scale,
    radius,
    width: radius * 2,
    headDepth: tongRange * 0.28 * scale,
    scale,
  };
}

export function mudflatHarpoonStats(level = 0, netLevel = 1) {
  const safeLevel = Math.max(0, Math.floor(level));
  if (safeLevel === 0) return { range: 0, damage: 0, speed: 304, interval: Infinity };
  const referenceNetRange = mudflatNetStats(Math.max(1, netLevel)).range;
  return {
    range: referenceNetRange * (safeLevel + 1),
    damage: 30 * 1.5 ** (safeLevel - 1),
    speed: 304,
    interval: 2.2,
  };
}

export function mudflatRockTurnerStats(level = 0) {
  const safeLevel = Math.max(0, Math.min(6, Math.floor(level)));
  if (safeLevel === 0) return { processingTime: Infinity, interval: Infinity, activationsPerSecond: 0 };
  const processingTime = [1, 0.8, 0.6, 0.4, 0.2, 0.2][safeLevel - 1];
  return {
    processingTime,
    interval: processingTime,
    activationsPerSecond: 1 / processingTime,
  };
}

export function mudflatRockCreatureForRoll(roll = 0, level = 1) {
  const safeRoll = Math.max(0, Math.min(0.999999, Number.isFinite(roll) ? roll : 0));
  const safeLevel = Math.max(1, Math.min(6, Math.floor(level)));
  const levelRatio = (safeLevel - 1) / 5;
  let accumulated = 0;
  for (const finding of MUDFLAT_ROCK_FINDINGS) {
    accumulated += finding.level1Chance + (finding.level6Chance - finding.level1Chance) * levelRatio;
    if (safeRoll < accumulated) return finding;
  }
  return null;
}

export function mudflatPufferBleedOnContact(seconds = 0, tickClock = 1) {
  return { seconds: 50, tickClock: seconds > 0 ? tickClock : 1 };
}

export function mudflatPufferMovementForAge(ageSeconds = 0) {
  const safeAge = Math.max(0, Number(ageSeconds) || 0);
  return safeAge < 8 ? "wander" : "oval";
}

export function mudflatShellMovementSpeed(playerMovementSpeed = 0) {
  return Math.max(0, Number(playerMovementSpeed) || 0) * 0.05;
}

export function mudflatPufferBleedStep(seconds = 0, tickClock = 1, deltaSeconds = 0) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const activeTime = Math.min(Math.max(0, Number(deltaSeconds) || 0), safeSeconds);
  let nextTickClock = Number.isFinite(tickClock) ? tickClock - activeTime : 1;
  let ticks = 0;
  while (nextTickClock <= 0 && ticks < 100) {
    ticks += 1;
    nextTickClock += 1;
  }
  return { seconds: Math.max(0, safeSeconds - activeTime), tickClock: nextTickClock, ticks };
}

export function mudflatStageStats(stage = 1) {
  const safeStage = Math.max(1, Math.floor(stage));
  const profile = mudflatStageProfile(safeStage);
  const endlessDepth = Math.max(0, safeStage - 8);
  return {
    creatureHpMultiplier: 1 + (safeStage - 1) * 0.16 + (profile.finalBoss ? .24 : 0),
    creatureSpeedMultiplier: 1 + (safeStage - 1) * 0.045,
    spawnIntervalMultiplier: Math.max(0.5, 1 - (safeStage - 1) * 0.04) * profile.seafoodSpawnMultiplier,
    contactDamageBonus: Math.min(24, (safeStage - 1) * 2 + Math.floor(endlessDepth / 3)),
    rockLimit: Math.min(42, Math.round((20 + (safeStage - 1) * 2) * profile.rockMultiplier)),
  };
}

export const MUDFLAT_REGULAR_STAGES = [
  { stage: 1, name: "초입 갯벌", subtitle: "기본 조작과 채집 수단을 익히는 잔잔한 초입", modifiers: ["초입"], waterChannels: false, tideInterval: 0, safeZone: "none", rockMultiplier: .65, fallingRocks: 0, darkness: 0, mudSlow: 1, seafoodSpawnMultiplier: 1, wind: 0, waves: false, swarms: false, coldThresholdMultiplier: 1, finalBoss: false },
  { stage: 2, name: "차오르는 물골", subtitle: "물골을 피하고 밀물 전에 마른 지대를 찾으세요", modifiers: ["물골", "주기적 밀물"], waterChannels: true, tideInterval: 48, safeZone: "fixed", rockMultiplier: .8, fallingRocks: 0, darkness: 0, mudSlow: 1, seafoodSpawnMultiplier: .96, wind: 0, waves: false, swarms: false, coldThresholdMultiplier: 1, finalBoss: false },
  { stage: 3, name: "바위 갯벌", subtitle: "늘어난 돌과 낙석을 피해 돌 밑을 노리세요", modifiers: ["바위 증가", "낙석"], waterChannels: false, tideInterval: 0, safeZone: "none", rockMultiplier: 1.55, fallingRocks: 19, darkness: 0, mudSlow: .96, seafoodSpawnMultiplier: 1, wind: 0, waves: false, swarms: false, coldThresholdMultiplier: 1, finalBoss: false },
  { stage: 4, name: "어두운 갯벌", subtitle: "좁아진 시야에서 헤드랜턴으로 숨은 패류를 찾으세요", modifiers: ["시야 감소", "패류 가치 2배"], waterChannels: false, tideInterval: 0, safeZone: "none", rockMultiplier: 1, fallingRocks: 0, darkness: .78, mudSlow: 1, seafoodSpawnMultiplier: 1, wind: 0, waves: false, swarms: false, coldThresholdMultiplier: 1, finalBoss: false },
  { stage: 5, name: "깊은 펄", subtitle: "발이 빠지는 펄과 빨라진 추위에 대비하세요", modifiers: ["이동 감속", "빠른 추위"], waterChannels: false, tideInterval: 0, safeZone: "none", rockMultiplier: .9, fallingRocks: 0, darkness: .18, mudSlow: .78, seafoodSpawnMultiplier: 1.22, wind: 0, waves: false, swarms: false, coldThresholdMultiplier: .65, finalBoss: false },
  { stage: 6, name: "거센 갯벌", subtitle: "바람과 파도 사이로 몰려오는 해산물 무리를 버티세요", modifiers: ["바람", "파도", "해산물 무리"], waterChannels: true, tideInterval: 43, safeZone: "fixed", rockMultiplier: 1, fallingRocks: 0, darkness: 0, mudSlow: .93, seafoodSpawnMultiplier: .92, wind: 32, waves: true, swarms: true, coldThresholdMultiplier: .9, finalBoss: false },
  { stage: 7, name: "대조기 갯벌", subtitle: "빠른 밀물과 계속 움직이는 안전 지대를 따라가세요", modifiers: ["빠른 밀물", "이동 안전 지대"], waterChannels: true, tideInterval: 27, safeZone: "moving", rockMultiplier: 1.08, fallingRocks: 0, darkness: .08, mudSlow: .9, seafoodSpawnMultiplier: .88, wind: 18, waves: true, swarms: false, coldThresholdMultiplier: .85, finalBoss: false },
  { stage: 8, name: "마지막 물때", subtitle: "모든 환경과 강화된 대왕 박하지를 넘어 귀환하세요", modifiers: ["복합 환경", "강화 대왕 박하지", "최종 귀환"], waterChannels: true, tideInterval: 31, safeZone: "moving", rockMultiplier: 1.35, fallingRocks: 22, darkness: .62, mudSlow: .84, seafoodSpawnMultiplier: .82, wind: 30, waves: true, swarms: true, coldThresholdMultiplier: .72, finalBoss: true },
];

const MUDFLAT_ENDLESS_MODIFIERS = [
  { id: "channels", name: "깊은 물골", patch: { waterChannels: true, mudSlow: .9 } },
  { id: "dark", name: "짙은 어둠", patch: { darkness: .7 } },
  { id: "rocks", name: "낙석 지대", patch: { rockMultiplier: 1.5, fallingRocks: 18 } },
  { id: "wind", name: "돌풍", patch: { wind: 38, waves: true } },
  { id: "tide", name: "급한 밀물", patch: { tideInterval: 25, safeZone: "moving" } },
  { id: "swarm", name: "해산물 대이동", patch: { swarms: true, seafoodSpawnMultiplier: .78 } },
  { id: "mud", name: "끝없는 깊은 펄", patch: { mudSlow: .74, coldThresholdMultiplier: .62 } },
];

function mudflatSeed(stage, salt = 0) {
  const value = Math.sin(stage * 91.731 + salt * 37.117) * 43758.5453;
  return value - Math.floor(value);
}

export function mudflatStageProfile(stage = 1) {
  const safeStage = Math.max(1, Math.floor(stage));
  if (safeStage <= 8) return { ...MUDFLAT_REGULAR_STAGES[safeStage - 1], endless: false, objective: null };
  const chosen = [...MUDFLAT_ENDLESS_MODIFIERS]
    .sort((left, right) => mudflatSeed(safeStage, left.id.length) - mudflatSeed(safeStage, right.id.length))
    .slice(0, 3 + (safeStage % 4 === 0 ? 1 : 0));
  const profile = {
    stage: safeStage, name: "끝없는 물때", subtitle: "지형·날씨·생물이 다시 섞인 끝없는 원정",
    modifiers: chosen.map((item) => item.name), waterChannels: false, tideInterval: 0, safeZone: "none",
    rockMultiplier: 1, fallingRocks: 0, darkness: 0, mudSlow: 1, seafoodSpawnMultiplier: .86,
    wind: 0, waves: false, swarms: false, coldThresholdMultiplier: .82, finalBoss: safeStage % 3 === 0,
    endless: true,
  };
  for (const modifier of chosen) Object.assign(profile, modifier.patch);
  const objectiveIndex = Math.floor(mudflatSeed(safeStage, 19) * 3);
  profile.objective = [
    { id: "catch", label: `해산물 ${110 + (safeStage - 9) * 10}마리 채집`, target: 110 + (safeStage - 9) * 10, bonus: 140 + safeStage * 18 },
    { id: "rocks", label: `돌 ${8 + Math.floor((safeStage - 9) / 2)}개 뒤집기`, target: 8 + Math.floor((safeStage - 9) / 2), bonus: 160 + safeStage * 20 },
    { id: "health", label: "체력 50% 이상으로 귀환", target: .5, bonus: 180 + safeStage * 22 },
  ][objectiveIndex];
  return profile;
}

export function mudflatInWaterChannel(x = 0, y = 0, stage = 2) {
  const safeStage = Math.max(1, Math.floor(stage));
  const centerA = Math.sin((y + safeStage * 83) / 175) * 92 + Math.sin((y - safeStage * 41) / 430) * 52;
  if (Math.abs(x - centerA) < 42) return true;
  const profile = mudflatStageProfile(safeStage);
  if (!profile.endless && safeStage !== 8) return false;
  const centerB = 265 + Math.sin((y - safeStage * 63) / 210) * 74;
  return Math.abs(x - centerB) < 34;
}

export function mudflatStageEmptySeafoodHazard(emptySeconds = 0, stage = 1) {
  const profile = mudflatStageProfile(stage);
  return mudflatEmptySeafoodHazard(Math.max(0, Number(emptySeconds) || 0) / Math.max(.35, profile.coldThresholdMultiplier));
}

export function mudflatEndlessObjectiveResult(profile, { caught = 0, rocksFlipped = 0, hp = 0, maxHp = 1 } = {}) {
  const objective = profile?.objective;
  if (!objective) return { complete: false, bonus: 0, label: "" };
  const complete = objective.id === "catch" ? caught >= objective.target
    : objective.id === "rocks" ? rocksFlipped >= objective.target
      : hp / Math.max(1, maxHp) >= objective.target;
  return { complete, bonus: complete ? objective.bonus : 0, label: objective.label };
}

export function mudflatSeafoodSaleValue(type, count = 1, coolerLevel = 0, stage = 1) {
  const market = MUDFLAT_SEAFOOD_MARKET.find((item) => item.type === type);
  const safeCount = Math.max(0, Math.floor(count));
  if (!market || safeCount === 0) return 0;
  const profile = mudflatStageProfile(stage);
  const darkShellBonus = (profile.darkness >= .6 && ["whelk", "fist-whelk", "golbaengi"].includes(type)) ? 2 : 1;
  const saleMultiplier = (1 + Math.max(0, Math.floor(coolerLevel)) * 0.08) * darkShellBonus;
  return Math.floor(market.price * safeCount * saleMultiplier);
}

export function mudflatAutoSellInventory(inventory = {}, coolerLevel = 0, stage = 1) {
  const knownTypes = new Set(MUDFLAT_SEAFOOD_MARKET.map((item) => item.type));
  const haul = {};
  for (const [type, count] of Object.entries(inventory ?? {})) {
    if (!knownTypes.has(type)) continue;
    const safeCount = Math.max(0, Math.floor(Number(count) || 0));
    if (safeCount > 0) haul[type] = safeCount;
  }
  const count = Object.values(haul).reduce((sum, quantity) => sum + quantity, 0);
  const value = Object.entries(haul).reduce((sum, [type, quantity]) => sum + mudflatSeafoodSaleValue(type, quantity, coolerLevel, stage), 0);
  return { haul, count, value };
}

export function mudflatSettleCatch(inventory = {}, basket = {}, caught = 0, coolerLevel = 0) {
  const knownTypes = new Set(MUDFLAT_SEAFOOD_MARKET.map((item) => item.type));
  const normalizedInventory = {};
  const haul = {};
  for (const [type, count] of Object.entries(inventory ?? {})) {
    if (!knownTypes.has(type)) continue;
    const safeCount = Math.max(0, Math.floor(Number(count) || 0));
    if (safeCount > 0) normalizedInventory[type] = safeCount;
  }
  for (const [type, count] of Object.entries(basket ?? {})) {
    if (!knownTypes.has(type)) continue;
    const safeCount = Math.max(0, Math.floor(Number(count) || 0));
    if (safeCount > 0) haul[type] = safeCount;
  }
  const recordedCount = Object.values(haul).reduce((sum, count) => sum + count, 0);
  const expectedCount = Math.max(recordedCount, Math.max(0, Math.floor(Number(caught) || 0)));
  const recoveredCount = Math.max(0, expectedCount - recordedCount);
  if (recoveredCount > 0) haul.clam = (haul.clam ?? 0) + recoveredCount;
  const nextInventory = { ...normalizedInventory };
  for (const [type, count] of Object.entries(haul)) nextInventory[type] = (nextInventory[type] ?? 0) + count;
  const value = Object.entries(haul).reduce((sum, [type, count]) => sum + mudflatSeafoodSaleValue(type, count, coolerLevel), 0);
  return { inventory: nextInventory, haul, catchCount: expectedCount, recoveredCount, value };
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
