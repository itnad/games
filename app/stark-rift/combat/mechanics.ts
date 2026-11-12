/** Authored Stark Rift flight speeds, in fixed world units/second (8 units/pixel).
 * Damage/range/cadence use BWAPI data; these visual flight speeds are not claimed as original BW data.
 * Tank-mode cannon and needle-spine hit resolve directly; grenade/plasma have persistent flight.
 */
export const PROJECTILE_RULES = {
  Fragmentation_Grenade: { speed: 384 * 8, lifetime: 200 },
  Phase_Disruptor: { speed: 240 * 8, lifetime: 200 },
} as const;
export const MAX_COMBAT_PROJECTILES = 4096;
export const projectileRule = (weapon: string) =>
  PROJECTILE_RULES[weapon as keyof typeof PROJECTILE_RULES];
