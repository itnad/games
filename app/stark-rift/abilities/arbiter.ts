import { isInStasis } from "./spells-state";
import type { SimulationState } from "../core/state";
import { checksum } from "../core/checksum";
import { combatProfile } from "../combat/catalog";
import { isEmbarked } from "./special-state";
import original from "../data/arbiter-original.json";
export const ARBITER = "protoss-arbiter";
export const ARBITER_RANGE = original.aura.rangePixels * 8;
/** Authored visual flight speed. Damage, range and cooldown use original weapon data. */
export const ARBITER_FLIGHT = { speed: 240 * 8, lifetime: 200 };
export const ARBITER_RULES_VERSION = "arbiter-1-" + checksum({ original: JSON.stringify(original), flight: ARBITER_FLIGHT, distance: "euclidean-hitboxes", update: "derived-per-query" });
/** Passive coverage is derived from current bodies: no stale saved flags or source IDs to leak. */
export function coveredByArbiter(s: SimulationState, index: number): boolean {
  const e = s.entities;
  if (!s.economy.enabled || index < 0 || index >= e.id.length || e.health[index] === 0 || e.kind[index] === "building" || e.definitionId[index] === ARBITER || isEmbarked(s, e.id[index])) return false;
  const target = combatProfile(e.definitionId[index]); if (!target) return false;
  for (let i = 0; i < e.id.length; i++) {
    if (e.definitionId[i] !== ARBITER || e.owner[i] !== e.owner[index] || e.health[i] === 0 || isInStasis(s,e.id[i]) || isEmbarked(s, e.id[i])) continue;
    const source = original.profiles[0].bounds,
      dx = Math.max(0, e.x[index] - target.bounds[0] * 8 - (e.x[i] + source[2] * 8), e.x[i] - source[0] * 8 - (e.x[index] + target.bounds[2] * 8)),
      dy = Math.max(0, e.y[index] - target.bounds[1] * 8 - (e.y[i] + source[3] * 8), e.y[i] - source[1] * 8 - (e.y[index] + target.bounds[3] * 8));
    if (dx * dx + dy * dy <= ARBITER_RANGE * ARBITER_RANGE) return true;
  }
  return false;
}
