import type { SimulationState } from "../core/state";
import original from "../data/burrow-original.json";

export const BURROW_ABILITY = "burrow";
export const BURROW_RESEARCH = "burrowing";
export const supportsBurrow = (definitionId: string) => definitionId === "zerg-lurker" || original.units.includes(definitionId);
export const isBurrowed = (s: SimulationState, id: number): boolean =>
  s.vision?.concealed.some((c) => c.entityId === id && c.kind === "burrow") ?? false;
export const hasBurrowResearch = (s: SimulationState, owner: number): boolean =>
  s.economy.upgrades.some((u) => u.playerId === owner && u.technologyId === BURROW_RESEARCH);

export const canBurrow = (s: SimulationState, id: number) => s.entities.definitionId[s.entities.id.indexOf(id)] === "zerg-lurker" || hasBurrowResearch(s, s.entities.owner[s.entities.id.indexOf(id)]);

/** A saved burrow cannot conceal a building, keep working, or resume a queued journey. */
export function validBurrowState(s: SimulationState): boolean {
  return (s.vision?.concealed ?? []).every((c) => {
    if (c.kind !== "burrow") return true;
    const i = s.entities.id.indexOf(c.entityId), m = s.movement[i],
      w = s.economy.workers.find((w) => w.entityId === c.entityId),
      r = s.combat?.records.find((r) => r.entityId === c.entityId);
    return i >= 0 && supportsBurrow(s.entities.definitionId[i]) &&
      s.entities.layer[i] === "ground" && canBurrow(s, c.entityId) &&
      !!m && (["idle", "hold"].includes(m.order) ? m.target === null && m.targetEntityId === null && m.trackedTarget === null : s.entities.definitionId[i] === "zerg-lurker" && m.order === "focusAttack") && m.path.length === 0 &&
      !s.navigation.jobs.some((j) => j.entityId === c.entityId) &&
      (!w || (w.task === "idle" && !w.autoAllowed && w.resourceId === null &&
        w.buildingId === null && w.buildQueue.length === 0)) &&
      (!r || (r.resumeTarget === null && (r.lastSeenTarget === null || s.entities.definitionId[i] === "zerg-lurker" && m.order === "focusAttack")));
  });
}
