import type { SimulationState } from "../core/state";
import { array, integer, object, unique, text, type Infer } from "../core/validation";
import original from "../data/special-original.json";
import { checksum } from "../core/checksum";
const id = (name: string) => name.toLowerCase().replaceAll("_", "-");
const traits = new Map(original.traits.map((t) => [id(t.name), t]));
export const unitTraits = (definition: string) => traits.get(definition);
export const permanentCloak = (definition: string) => unitTraits(definition)?.permanentCloak ?? false;
export const CARGO_RESEARCH = "ventral-sacs";
export const TRANSPORT_MECHANICS = { loadRange: 256, dropRange: 512, unloadTicks: 8 };
export const SPECIAL_RULES_VERSION = "special-1-" + checksum({ original: JSON.stringify(original), transport: TRANSPORT_MECHANICS });
const point = { x: integer(), y: integer() };
export const specialStateSchema = object({
  transports: array(object({
    entityId: integer(1),
    passengers: unique(array(integer(1), 0, 8)),
    loadQueue: unique(array(integer(1), 0, 8)),
    unloads: array(object({ passengerId: integer(1), ...point }), 0, 8),
    nextUnloadTick: integer(),
  }), 0, 2048),
  morphs: array(object({
    entityId: integer(1), targetDefinitionId: text,
    remainingTicks: integer(1), totalTicks: integer(1), minerals: integer(), gas: integer(),
  }), 0, 2048),
});
type Mutable<T> = { -readonly [K in keyof T]: T[K] extends (infer U)[] ? Mutable<U>[] : T[K] extends object ? Mutable<T[K]> : T[K] };
export type SpecialState = Mutable<Infer<typeof specialStateSchema>>;
export type CarrierState = SpecialState["transports"][number];
export const emptySpecial = (): SpecialState => ({ transports: [], morphs: [] });
export const carrierOf = (s: SimulationState, id: number) => s.special?.transports.find((t) => t.entityId === id);
export const carriedBy = (s: SimulationState, id: number) => s.special?.transports.find((t) => t.passengers.includes(id));
export const isEmbarked = (s: SimulationState, id: number): boolean => !!carriedBy(s, id);
export const loadingIn = (s: SimulationState, id: number) => s.special?.transports.find((t) => t.loadQueue.includes(id));
export function transportCapacity(s: SimulationState, entityId: number): number {
  const i = s.entities.id.indexOf(entityId), d = s.entities.definitionId[i];
  if (i < 0 || s.entities.health[i] === 0) return 0;
  if (d === "zerg-overlord" && !s.economy.upgrades.some((u) => u.playerId === s.entities.owner[i] && u.technologyId === CARGO_RESEARCH)) return 0;
  return unitTraits(d)?.spaceProvided ?? 0;
}
export const cargoSpace = (s: SimulationState, id: number) => unitTraits(s.entities.definitionId[s.entities.id.indexOf(id)])?.spaceRequired ?? 255;
export const occupiedSpace = (s: SimulationState, t: CarrierState) => [...t.passengers, ...t.loadQueue].reduce((n, id) => n + cargoSpace(s, id), 0);
export const morphOf = (s: SimulationState, id: number) => s.special?.morphs.find((m) => m.entityId === id);
