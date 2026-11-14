import type { SimulationState } from "../core/state";
import { array, integer, object, enumeration, type Infer } from "../core/validation";
import { checksum } from "../core/checksum";
import { isEmbarked } from "./special-state";
import original from "../data/siege-original.json";

export const TANK_MODE = "terran-siege-tank-tank-mode";
export const SIEGE_MODE = "terran-siege-tank-siege-mode";
export const SIEGE_RESEARCH = "tank-siege-mode";
export const SIEGE_ABILITY = "siege-mode";
/** Authored 2-second transition. Original animation signals/turret-facing are not simulated. */
export const SIEGE_TRANSITION_TICKS = 40;
export const SIEGE_RULES_VERSION = "siege-1-" + checksum({ original: JSON.stringify(original), transitionTicks: SIEGE_TRANSITION_TICKS });
export const isTank = (definition: string) => definition === TANK_MODE || definition === SIEGE_MODE;
export const isSieged = (definition: string) => definition === SIEGE_MODE;
export const siegeStateSchema = array(object({
  entityId: integer(1), targetDefinitionId: enumeration([TANK_MODE, SIEGE_MODE]),
  remainingTicks: integer(1, SIEGE_TRANSITION_TICKS), totalTicks: integer(SIEGE_TRANSITION_TICKS, SIEGE_TRANSITION_TICKS),
  x: integer(), y: integer(),
}), 0, 2048);
type Record = Infer<typeof siegeStateSchema>[number];
export type SiegeTransition = { -readonly [K in keyof Record]: Record[K] };
export const siegeTransitionOf = (s: SimulationState, id: number) => s.siege?.find((r) => r.entityId === id);
export const tankLocked = (s: SimulationState, id: number, definition = s.entities.definitionId[s.entities.id.indexOf(id)]) => isSieged(definition) || !!siegeTransitionOf(s, id);
export const hasSiegeResearch = (s: SimulationState, owner: number) => s.economy.upgrades.some((u) => u.playerId === owner && u.technologyId === SIEGE_RESEARCH);
export function validSiege(s: SimulationState): boolean {
  const e = s.entities, jobs = s.siege ?? [], byId = new Map(jobs.map((j) => [j.entityId, j]));
  if (jobs.some((j, n) => (n > 0 && jobs[n - 1].entityId >= j.entityId) || !e.id.includes(j.entityId))) return false;
  if (!s.economy.enabled) return jobs.length === 0;
  for (let i = 0; i < e.id.length; i++) {
    const job = byId.get(e.id[i]), deployed = isSieged(e.definitionId[i]);
    if (!job && !deployed) continue;
    const m = s.movement[i];
    if (!isTank(e.definitionId[i]) || e.layer[i] !== "ground" || e.speed[i] !== 0 ||
      !hasSiegeResearch(s, e.owner[i]) || isEmbarked(s, e.id[i]) ||
      s.navigation.jobs.some((j) => j.entityId === e.id[i]) || m.path.length > 0 ||
      !["idle", "hold", ...(job ? [] : ["focusAttack"])].includes(m.order) ||
      (job && (job.targetDefinitionId === e.definitionId[i] || job.x !== e.x[i] || job.y !== e.y[i]))) return false;
  }
  return true;
}
