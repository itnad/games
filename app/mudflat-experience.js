export const EXPERIENCE_RISE_SECONDS = .1;
export const EXPERIENCE_FLASH_SECONDS = .22;

export function createExperiencePickup(id, x, y, xp) {
  return {
    id, x, y, xp, age: 0, phase: "spawn", visualX: x, visualY: y,
    fromX: x, fromY: y, pullTime: 0, pullDuration: .24,
    trail: /** @type {Array<{ x: number, y: number }>} */ ([]),
  };
}

const smoothstep = (value) => value * value * (3 - 2 * value);

// 소쿠리의 달인 흡입: 바닥에 놓인 보석만 플레이어 쪽으로 날리기 시작한다. 먼
// 보석일수록 비행이 길어지되 0.9초를 넘지 않는다. 경험치 양은 그대로다.
export function startExperiencePull(pickup, player) {
  if (pickup.phase !== "idle" || pickup.xp <= 0) return false;
  const distance = Math.hypot(player.x - pickup.x, player.y - pickup.y);
  pickup.phase = "pull";
  pickup.fromX = pickup.visualX;
  pickup.fromY = pickup.visualY;
  pickup.pullTime = 0;
  pickup.pullDuration = Math.min(.9, .24 + .06 * Math.min(1, distance / 200) + Math.max(0, distance - 200) / 900);
  return true;
}

// Returns the reward once, only after the visible flight reaches the player.
export function advanceExperiencePickup(pickup, player, radius, dt, blocked = false) {
  if (blocked || pickup.xp <= 0 || dt <= 0) return 0;
  // A slow frame must never skip the entire birth/flight animation.
  const step = Math.min(.034, dt);
  pickup.age += step;
  if (pickup.phase === "spawn") {
    pickup.visualY = pickup.y - 18 * smoothstep(Math.min(1, pickup.age / EXPERIENCE_RISE_SECONDS));
    if (pickup.age < EXPERIENCE_RISE_SECONDS) return 0;
    pickup.phase = "idle";
  }
  if (pickup.phase === "idle") {
    const settle = Math.min(1, (pickup.age - EXPERIENCE_RISE_SECONDS) / .18);
    pickup.visualY = pickup.y - 18 * (1 - smoothstep(settle));
    const distance = Math.hypot(player.x - pickup.x, player.y - pickup.y);
    if (distance >= radius) return 0;
    pickup.phase = "pull";
    pickup.fromX = pickup.visualX;
    pickup.fromY = pickup.visualY;
    pickup.pullDuration = .24 + .06 * Math.min(1, distance / 200);
    return 0;
  }

  pickup.trail.push({ x: pickup.visualX, y: pickup.visualY });
  if (pickup.trail.length > 5) pickup.trail.shift();
  pickup.pullTime = Math.min(pickup.pullDuration, pickup.pullTime + step);
  const progress = pickup.pullTime / pickup.pullDuration;
  const eased = progress * progress;
  // Track a moving character, with a small side bend even for a drop at their feet.
  const bend = Math.sin(progress * Math.PI) * (pickup.id % 2 ? 9 : -9);
  pickup.visualX = pickup.fromX + (player.x - pickup.fromX) * eased + bend;
  pickup.visualY = pickup.fromY + (player.y - 10 - pickup.fromY) * eased;
  if (progress < 1) return 0;
  pickup.visualX = player.x;
  pickup.visualY = player.y - 10;
  const earned = pickup.xp;
  pickup.xp = 0;
  pickup.phase = "arrived";
  pickup.trail.length = 0;
  return earned;
}
