import type { SimulationState } from "../core/state";
import { idleMovement } from "../core/orders";
/** Remove references before World recursively destroys passengers; no nested carriers are allowed. */
export function detachSpecialEntity(s: SimulationState, id: number): number[] {
  if (!s.special) return [];
  const t = s.special.transports.find((t) => t.entityId === id), passengers = [...t?.passengers ?? []];
  for (const loading of t?.loadQueue ?? []) {
    const i = s.entities.id.indexOf(loading);
    if (i >= 0) Object.assign(s.movement[i], idleMovement(loading), { formation: s.movement[i].formation, stance: s.movement[i].stance });
    s.navigation.jobs = s.navigation.jobs.filter((j) => j.entityId !== loading);
  }
  s.special.transports = s.special.transports.filter((t) => t.entityId !== id);
  s.special.morphs = s.special.morphs.filter((m) => m.entityId !== id);
  for (const other of s.special.transports) {
    other.passengers = other.passengers.filter((p) => p !== id);
    other.loadQueue = other.loadQueue.filter((p) => p !== id);
    other.unloads = other.unloads.filter((j) => j.passengerId !== id);
  }
  return passengers;
}
