import type { SimulationState } from "../core/state";
import type { BattleMap } from "../data/maps";
import { economyDefinition, countsAsDefinition } from "../data/economy-catalog";
import { cargoSpace, occupiedSpace, transportCapacity, isEmbarked } from "./special-state";
import { isBurrowed } from "./burrow";
export function validSpecial(s: SimulationState): boolean {
  if (!s.special) return true;
  if (!s.economy.enabled) return !s.special.transports.length && !s.special.morphs.length;
  const e = s.entities, seen = new Set<number>(), claims = new Set<number>(), morphs = new Set<number>();
  for (const t of s.special.transports) {
    const i = e.id.indexOf(t.entityId);
    if (seen.has(t.entityId) || i < 0 || e.layer[i] !== "air" || !transportCapacity(s, t.entityId) ||
      occupiedSpace(s, t) > transportCapacity(s, t.entityId) || t.nextUnloadTick > s.tick + 8 ||
      new Set(t.unloads.map((j) => j.passengerId)).size !== t.unloads.length ||
      t.unloads.some((j) => !t.passengers.includes(j.passengerId))) return false;
    seen.add(t.entityId);
    for (const id of [...t.passengers, ...t.loadQueue]) {
      const j = e.id.indexOf(id), w = s.economy.workers.find((w) => w.entityId === id), m = s.movement[j];
      if (j < 0 || claims.has(id) || e.owner[j] !== e.owner[i] || e.kind[j] === "building" ||
        e.layer[j] !== "ground" || cargoSpace(s, id) < 1 || cargoSpace(s, id) > 8 || isBurrowed(s, id) ||
        (w && (w.task !== "idle" || w.autoAllowed || w.buildingId !== null || w.buildQueue.length > 0))) return false;
      claims.add(id);
      if (t.passengers.includes(id) && (e.x[j] !== e.x[i] || e.y[j] !== e.y[i] ||
        m.order !== "idle" || m.target !== null || m.targetEntityId !== null ||
        m.path.length > 0 || s.navigation.jobs.some((job) => job.entityId === id))) return false;
    }
  }
  for (const job of s.special.morphs) {
    const i = e.id.indexOf(job.entityId), d = economyDefinition(job.targetDefinitionId), b = s.economy.structures.find((b) => b.entityId === job.entityId);
    if (morphs.has(job.entityId) || i < 0 || !d || d.id !== "zerg-lair" || e.definitionId[i] !== "zerg-hatchery" ||
      !b || b.completedTick < 0 || b.research !== null || job.remainingTicks > job.totalTicks ||
      job.totalTicks !== d.ticks || job.minerals !== d.minerals || job.gas !== d.gas ||
      !countsAsDefinition(e.definitionId[i], d.producer) || isEmbarked(s, job.entityId)) return false;
    morphs.add(job.entityId);
  }
  return true;
}
export function specialFitsMap(s: SimulationState, map: BattleMap): boolean {
  return (s.special?.transports ?? []).every((t) => t.unloads.every((j) => j.x < map.widthTiles * 256 && j.y < map.heightTiles * 256));
}
