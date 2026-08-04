export const MUDFLAT_RUN_SECONDS = 240;
export const MUDFLAT_JOYSTICK_RADIUS = 72;

export const MUDFLAT_CREATURES = [
  { id: "clam", name: "바지락", icon: "◒", color: "#eee0bd", hp: 2, speed: 24, size: 13, xp: 1, score: 8, unlock: 0 },
  { id: "crab", name: "칠게", icon: "♋", color: "#ef6d52", hp: 4, speed: 34, size: 15, xp: 2, score: 15, unlock: 18 },
  { id: "mudfish", name: "망둥어", icon: "⌁", color: "#8fc7b1", hp: 7, speed: 47, size: 14, xp: 3, score: 24, unlock: 45 },
  { id: "whelk", name: "소라", icon: "@", color: "#c99a68", hp: 12, speed: 23, size: 18, xp: 4, score: 38, unlock: 78 },
  { id: "octopus", name: "낙지", icon: "✣", color: "#b878a8", hp: 18, speed: 38, size: 20, xp: 6, score: 60, unlock: 120 },
  { id: "king-crab", name: "대왕 꽃게", icon: "♛", color: "#f0a33b", hp: 420, speed: 28, size: 43, xp: 80, score: 1800, unlock: 200, boss: true },
];

export const MUDFLAT_UPGRADES = [
  { id: "hoe", icon: "⌁", name: "호미질", description: "채집 범위와 위력이 커집니다.", max: 6 },
  { id: "net", icon: "◇", name: "자동 뜰채", description: "가까운 해산물에게 그물을 던집니다.", max: 6 },
  { id: "salt", icon: "✦", name: "왕소금", description: "주위를 도는 소금 결정이 해산물을 잡습니다.", max: 6 },
  { id: "boots", icon: "≫", name: "갯벌 장화", description: "진흙에서도 더 빠르게 이동합니다.", max: 5 },
  { id: "basket", icon: "◉", name: "넓은 바구니", description: "경험치와 보상을 끌어당기는 범위가 넓어집니다.", max: 5 },
  { id: "stamina", icon: "♥", name: "든든한 간식", description: "최대 체력과 현재 체력을 회복합니다.", max: 5 },
];

export function mudflatJoystickVector(deltaX, deltaY, radius = MUDFLAT_JOYSTICK_RADIUS, deadzone = 5) {
  const length = Math.hypot(deltaX, deltaY);
  if (!Number.isFinite(length) || length <= deadzone) return { x: 0, y: 0, strength: 0 };
  const clamped = Math.min(radius, length);
  const strength = Math.min(1, (clamped - deadzone) / Math.max(1, radius - deadzone));
  return { x: deltaX / length * strength, y: deltaY / length * strength, strength };
}

export function mudflatSpawnInterval(elapsedSeconds) {
  return Math.max(0.14, 0.62 - Math.max(0, elapsedSeconds) * 0.002);
}

export function mudflatCreatureForTime(elapsedSeconds, roll = 0) {
  const available = MUDFLAT_CREATURES.filter((item) => !item.boss && item.unlock <= elapsedSeconds);
  const index = Math.min(available.length - 1, Math.floor(Math.max(0, Math.min(0.9999, roll)) * available.length));
  return available[Math.max(0, index)];
}

export function mudflatUpgradeChoices(level, levels = {}) {
  const available = MUDFLAT_UPGRADES.filter((item) => (levels[item.id] ?? 0) < item.max);
  if (available.length <= 3) return available;
  const start = (Math.max(1, level) * 2 + Math.floor(level / 3)) % available.length;
  return Array.from({ length: 3 }, (_, index) => available[(start + index * 2) % available.length]);
}

export function mudflatFinalScore({ catchScore = 0, caught = 0, elapsed = 0, bossCaught = false }) {
  const survivalBonus = Math.floor(Math.min(MUDFLAT_RUN_SECONDS, elapsed) * 4);
  return Math.max(0, Math.floor(catchScore + caught * 3 + survivalBonus + (bossCaught ? 2500 : 0)));
}
