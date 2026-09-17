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
