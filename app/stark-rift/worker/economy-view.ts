import { energyView } from "../abilities/cloak-state";
import { carrierOf, isEmbarked, transportCapacity, unitTraits, occupiedSpace, morphOf } from "../abilities/special-state";
import type { SimulationState } from "../core/state";
import type { BattleMap } from "../data/maps";
import {
  array,
  boolean,
  enumeration,
  integer,
  nullable,
  optional,
  object,
  text,
  type Infer,
} from "../core/validation";
import { activeBuilding, indexOf } from "../economy/helpers";
const point = object({ x: integer(), y: integer() });
export const economyViewSchema = object({
  faction: enumeration(["terran", "zerg", "protoss"]),
  minerals: integer(),
  gas: integer(),
  supplyUsedHalf: integer(),
  supplyCapHalf: integer(0, 200),
  resources: array(object({ nodeId: text, amount: integer() }), 0, 512),
  creepCells: array(integer(0, 16383), 0, 16384),
  transports: optional(array(object({
    entityId: integer(1), capacity: integer(0, 8), usedSpace: integer(0, 8),
    passengers: array(object({ id: integer(1), definitionId: text, health: integer(), shield: integer(), energy: optional(integer(0, 200)), maxEnergy: optional(integer(200, 200)), space: integer(1, 8) }), 0, 8),
    loading: array(object({ id: integer(1), definitionId: text }), 0, 8),
    unloadTarget: nullable(point),
  }), 0, 2048)),
  workers: array(
    object({
      entityId: integer(1),
      task: text,
      cargoMinerals: integer(0, 8),
      cargoGas: integer(0, 8),
      resourceId: nullable(text),
    }),
    0,
    2048,
  ),
  structures: array(
    object({
      entityId: integer(1),
      tileX: integer(),
      tileY: integer(),
      started: boolean,
      remainingTicks: integer(),
      totalTicks: integer(1),
      completed: boolean,
      powered: boolean,
      builderId: nullable(integer(1)),
      larva: integer(0, 3),
      rally: nullable(point),
      repeatUnitId: nullable(text),
      queue: array(
        object({
          id: integer(1),
          definitionId: text,
          remainingTicks: integer(),
          totalTicks: integer(1),
          count: integer(1, 2),
        }),
        0,
        5,
      ),
      morph: optional(object({ targetDefinitionId: text, remainingTicks: integer(1), totalTicks: integer(1) })),
      research: nullable(
        object({
          technologyId: text,
          remainingTicks: integer(),
          totalTicks: integer(1),
        }),
      ),
    }),
    0,
    2048,
  ),
  upgrades: array(object({ technologyId: text, level: integer(1, 3) }), 0, 128),
});
export type EconomyView = Infer<typeof economyViewSchema>;
/** Private paid queues, cargo and balances only belong to the viewing player. */
export function createEconomyView(
  s: SimulationState,
  map: BattleMap,
  viewer: number,
  visibility: Uint8Array,
): EconomyView {
  const p = s.players[viewer],
    own = (id: number) => s.entities.owner[indexOf(s, id)] === viewer;
  return {
    faction: p.faction,
    minerals: p.minerals,
    gas: p.gas,
    supplyUsedHalf: p.supplyUsedHalf,
    supplyCapHalf: p.supplyCapHalf,
    resources: s.economy.resources
      .filter((r) => {
        const n = map.resourceNodes.find((n) => n.id === r.nodeId);
        return n && visibility[n.y * map.widthTiles + n.x] === 2;
      })
      .map((r) => ({ nodeId: r.nodeId, amount: r.amount }))
      .concat(
        (s.vision?.players[viewer].resources ?? [])
          .filter((r) => {
            const n = map.resourceNodes.find((n) => n.id === r.nodeId);
            return !!n && visibility[n.y * map.widthTiles + n.x] === 1;
          })
          .map((r) => ({ ...r })),
      ),
    creepCells: s.economy.creepCells.filter((c) => visibility[c] === 2),
    transports: s.entities.id.filter((id, i) => own(id) && !!unitTraits(s.entities.definitionId[i])?.spaceProvided && s.entities.health[i] > 0).map((id) => {
      const t = carrierOf(s, id);
      return { entityId: id, capacity: transportCapacity(s, id), usedSpace: t ? occupiedSpace(s, t) : 0,
        passengers: (t?.passengers ?? []).map((pid) => { const i = indexOf(s, pid); return { ...energyView(s, pid), id: pid, definitionId: s.entities.definitionId[i], health: s.entities.health[i], shield: s.entities.shield[i], space: unitTraits(s.entities.definitionId[i])!.spaceRequired }; }),
        loading: (t?.loadQueue ?? []).map((pid) => ({ id: pid, definitionId: s.entities.definitionId[indexOf(s, pid)] })),
        unloadTarget: t?.unloads[0] ? { x: t.unloads[0].x, y: t.unloads[0].y } : null,
      };
    }),
    workers: s.economy.workers
      .filter((w) => own(w.entityId) && !isEmbarked(s, w.entityId))
      .map((w) => ({
        entityId: w.entityId,
        task: w.task,
        cargoMinerals: w.cargoMinerals,
        cargoGas: w.cargoGas,
        resourceId: w.resourceId,
      })),
    structures: s.economy.structures
      .filter((b) => own(b.entityId))
      .map((b) => ({
        entityId: b.entityId,
        tileX: b.tileX,
        tileY: b.tileY,
        started: b.started,
        remainingTicks: b.remainingTicks,
        totalTicks: b.totalTicks,
        completed: b.completedTick >= 0,
        powered: activeBuilding(s, b),
        builderId: b.builderId,
        larva: b.larva,
        rally: b.rally,
        repeatUnitId: b.repeatUnitId,
        queue: b.queue.map((q) => ({
          id: q.id,
          definitionId: q.definitionId,
          remainingTicks: q.remainingTicks,
          totalTicks: q.totalTicks,
          count: q.count,
        })),
        ...(morphOf(s, b.entityId) ? { morph: { targetDefinitionId: morphOf(s, b.entityId)!.targetDefinitionId, remainingTicks: morphOf(s, b.entityId)!.remainingTicks, totalTicks: morphOf(s, b.entityId)!.totalTicks } } : {}),
        research: b.research
          ? {
              technologyId: b.research.technologyId,
              remainingTicks: b.research.remainingTicks,
              totalTicks: b.research.totalTicks,
            }
          : null,
      })),
    upgrades: s.economy.upgrades
      .filter((u) => u.playerId === viewer)
      .map((u) => ({ technologyId: u.technologyId, level: u.level })),
  };
}
