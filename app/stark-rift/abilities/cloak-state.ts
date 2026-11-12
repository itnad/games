import type { SimulationState } from "../core/state";
import { array, integer, object, type Infer } from "../core/validation";
import { checksum } from "../core/checksum";
import original from "../data/cloak-original.json";

export const CLOAK_ABILITY = "cloak";
export const ENERGY = original.energy;
export const CLOAK_ENERGY_COST = original.technologies[0].energy;
export const CLOAK_RULES_VERSION = "cloak-1-" + checksum(JSON.stringify(original));
export const cloakResearch = (definition: string) => definition === "terran-ghost" ? "personnel-cloaking" : definition === "terran-wraith" ? "cloaking-field" : null;
export const supportsCloak = (definition: string) => cloakResearch(definition) !== null;
export const energyStateSchema = array(object({ entityId: integer(1), amount: integer(0, ENERGY.maximum * ENERGY.scale), frameRemainder: integer(0, 4) }), 0, 2048);
type Record = Infer<typeof energyStateSchema>[number];
export type EnergyRecord = { -readonly [K in keyof Record]: Record[K] };
export const energyOf = (s: SimulationState, id: number) => s.energy?.find((r) => r.entityId === id);
export const activeCloak = (s: SimulationState, id: number) => s.vision?.concealed.some((c) => c.entityId === id && c.kind === "cloak") ?? false;
export const hasCloakResearch = (s: SimulationState, id: number) => {
  const i = s.entities.id.indexOf(id), tech = cloakResearch(s.entities.definitionId[i]);
  return !!tech && s.economy.upgrades.some((u) => u.playerId === s.entities.owner[i] && u.technologyId === tech);
};
export const energyView = (s: SimulationState, id: number) => {
  const r = energyOf(s, id);
  return r ? { energy: Math.floor(r.amount / ENERGY.scale), maxEnergy: ENERGY.maximum } : {};
};
export function validEnergy(s: SimulationState): boolean {
  const records = s.energy ?? [], e = s.entities;
  const indices = new Map(e.id.map((id, i) => [id, i])), byId = new Map(records.map((r) => [r.entityId, r]));
  if (records.some((r, n) => {
    const i = indices.get(r.entityId);
    return (n > 0 && records[n - 1].entityId >= r.entityId) || i === undefined ||
      !supportsCloak(e.definitionId[i]) || e.layer[i] !== (e.definitionId[i] === "terran-wraith" ? "air" : "ground");
  })) return false;
  if (!s.economy.enabled && records.length > 0) return false;
  if (s.economy.enabled && e.id.some((id, i) => supportsCloak(e.definitionId[i]) && !byId.has(id))) return false;
  return (s.vision?.concealed ?? []).every((c) => c.kind !== "cloak" || (hasCloakResearch(s, c.entityId) && (energyOf(s, c.entityId)?.amount ?? 0) > 0));
}
