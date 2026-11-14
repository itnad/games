import type { SimulationState } from "../core/state";
import { array, enumeration, integer, object, type Infer } from "../core/validation";
import { checksum } from "../core/checksum";
import { originalTicks } from "../data/economy-catalog";
import original from "../data/spells-original.json";
import { isEmbarked } from "./special-state";
export const RECALL = "recall", STASIS = "stasis-field";
export const RECALL_TICKS = originalTicks(original.recall.delayFrames);
export const STASIS_TICKS = originalTicks(original.stasis.statusCycles * original.stasis.framesPerCycle);
export const SPELLS_RULES_VERSION = "spells-1-" + checksum({ original: JSON.stringify(original), landing: "stable-id-local-6-tiles", orders: "hold-workers-resume", stasisMorph: "paused", recallApproach: "in-place", stasisApproach: "reject-outside-range" });
const point = { x: integer(), y: integer() };
export const spellEffectSchema = object({ id: integer(1), kind: enumeration(["recall", "stasis-field"]), owner: integer(0, 1), tick: integer(), ...point });
export const spellsStateSchema = object({
  stasis: array(object({ entityId: integer(1), appliedTick: integer(), expiresTick: integer(), ...point }), 0, 2048),
  recalls: array(object({ entityId: integer(1), remainingTicks: integer(1, RECALL_TICKS), ...point }), 0, 2048),
  effects: array(spellEffectSchema, 0, 128),
});
type Mutable<T> = { -readonly [K in keyof T]: T[K] extends (infer U)[] ? Mutable<U>[] : T[K] extends object ? Mutable<T[K]> : T[K] };
export type SpellsState = Mutable<Infer<typeof spellsStateSchema>>;
export const emptySpells = (): SpellsState => ({ stasis: [], recalls: [], effects: [] });
export const stasisOf = (s: SimulationState, id: number) => s.spells?.stasis.find((r) => r.entityId === id && r.expiresTick > s.tick);
export const isInStasis = (s: SimulationState, id: number) => !!stasisOf(s, id);
export const recallOf = (s: SimulationState, id: number) => s.spells?.recalls.find((r) => r.entityId === id);
export const spellLocked = (s: SimulationState, id: number) => isInStasis(s, id) || !!recallOf(s, id);
export function validSpells(s: SimulationState): boolean {
  if (!s.spells) return true;
  if (!s.economy.enabled || !s.combat) return !s.spells.stasis.length && !s.spells.recalls.length && !s.spells.effects.length;
  const e = s.entities, unique = (ids: number[]) => new Set(ids).size === ids.length;
  return unique(s.spells.stasis.map(r => r.entityId)) && unique(s.spells.recalls.map(r => r.entityId)) && unique(s.spells.effects.map(r => r.id)) &&
    s.spells.stasis.every(r => { const i = e.id.indexOf(r.entityId); return i >= 0 && e.health[i] > 0 && e.kind[i] !== "building" && !s.vision?.concealed.some(c => c.entityId === r.entityId && c.kind === "burrow") && !isEmbarked(s, r.entityId) && r.appliedTick <= s.tick && r.expiresTick === r.appliedTick + STASIS_TICKS && r.expiresTick > s.tick && e.x[i] === r.x && e.y[i] === r.y && s.movement[i].path.length === 0 && ["idle","hold"].includes(s.movement[i].order) && !s.navigation.jobs.some(j => j.entityId === r.entityId); }) &&
    s.spells.recalls.every(r => { const i = e.id.indexOf(r.entityId); return i >= 0 && e.health[i] > 0 && e.definitionId[i] === "protoss-arbiter" && s.economy.upgrades.some(u => u.playerId === e.owner[i] && u.technologyId === RECALL) && !isEmbarked(s, r.entityId) && s.movement[i].path.length === 0 && ["idle","hold"].includes(s.movement[i].order) && !s.navigation.jobs.some(j => j.entityId === r.entityId); }) &&
    s.spells.effects.every(r => r.id < s.counters.nextEventId && r.tick <= s.tick && s.tick - r.tick <= 20);
}
export function spellsFitMap(s: SimulationState, map: { widthTiles: number; heightTiles: number }): boolean {
  return [...s.spells?.stasis ?? [], ...s.spells?.recalls ?? [], ...s.spells?.effects ?? []].every(r => r.x < map.widthTiles * 256 && r.y < map.heightTiles * 256);
}
