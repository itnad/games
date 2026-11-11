import { advanceConstruction } from "./helpers";
import type { SimulationState } from "../core/state";
/** Called before storage is removed; destruction releases reservations without refunding units/buildings. */
export function detachEconomyEntity(s: SimulationState, id: number): void {
  if (!s.economy.enabled) return;
  const i = s.entities.id.indexOf(id),
    b = s.economy.structures.find((b) => b.entityId === id);
  if (b?.research && i >= 0) {
    const p = s.players[s.entities.owner[i]];
    p.minerals += Math.floor((b.research.minerals * 3) / 4);
    p.gas += Math.floor((b.research.gas * 3) / 4);
  }
  for (const r of s.economy.resources)
    if (r.occupiedBy === id) r.occupiedBy = null;
  s.economy.workers = s.economy.workers.filter((w) => w.entityId !== id);
  s.economy.structures = s.economy.structures.filter((b) => b.entityId !== id);
  for (const w of s.economy.workers) {
    if (w.homeId === id) w.homeId = null;
    if (w.buildingId === id || w.buildQueue.includes(id))
      advanceConstruction(s, w, id);
  }
  for (const other of s.economy.structures) {
    if (other.builderId === id) other.builderId = null;
    if (other.addonParentId === id) other.addonParentId = null;
  }
}
