import { isBurrowed } from "../abilities/burrow";
import type { SimulationState } from "../core/state";
import type { BattleMap, ResourceNode } from "../data/maps";
import type { Point } from "../pathfinding/navigation";
import { ECONOMY_MECHANICS } from "../data/economy-catalog";
import {
  approach,
  buildingRect,
  complete,
  definitionOf,
  homeFor,
  indexOf,
  localVisibility,
  releaseWork,
  stopEntity,
  structureOf,
} from "./helpers";
import type { WorkerState } from "./state";
export type InternalMove = (
  s: SimulationState,
  id: number,
  p: Point,
  attack?: boolean,
) => Point | null;
export function resourceAvailable(
  s: SimulationState,
  map: BattleMap,
  owner: number,
  n: ResourceNode,
): boolean {
  const r = s.economy.resources.find((r) => r.nodeId === n.id);
  if (!r || (n.kind === "mineral" && r.amount === 0)) return false;
  if (
    n.kind === "gas" &&
    !s.economy.structures.some(
      (b) =>
        complete(b) &&
        b.geyserId === n.id &&
        s.entities.owner[indexOf(s, b.entityId)] === owner,
    )
  )
    return false;
  return localVisibility(s, map, owner)[n.y * map.widthTiles + n.x] === 2;
}
export function nodeRect(s: SimulationState, n: ResourceNode) {
  const refinery = s.economy.structures.find(
    (b) => b.geyserId === n.id && complete(b),
  );
  return refinery
    ? buildingRect(refinery)
    : { x: n.x * 256, y: n.y * 256, width: 256, height: 256 };
}
export function beginGather(
  s: SimulationState,
  map: BattleMap,
  w: WorkerState,
  n: ResourceNode,
): void {
  releaseWork(s, w, true);
  w.resourceId = n.id;
  w.regionId = n.baseId;
  w.homeId =
    homeFor(s, map, w.entityId, n.baseId)?.entityId ??
    homeFor(s, map, w.entityId)?.entityId ??
    null;
  w.task = w.cargoMinerals || w.cargoGas ? "returning" : "toResource";
  stopEntity(s, w.entityId);
}
function assignLocal(
  s: SimulationState,
  map: BattleMap,
  w: WorkerState,
): boolean {
  const i = indexOf(s, w.entityId),
    es = s.entities,
    home = homeFor(s, map, w.entityId);
  if (!home) return false;
  const hi = indexOf(s, home.entityId),
    region = map.regions
      .filter(
        (r) =>
          r.kind !== "ramp" &&
          (r.x * 256 - es.x[i]) ** 2 + (r.y * 256 - es.y[i]) ** 2 <=
            (r.radius * 256) ** 2 &&
          (r.x * 256 - es.x[hi]) ** 2 + (r.y * 256 - es.y[hi]) ** 2 <=
            (r.radius * 256) ** 2,
      )
      .sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!region) return false;
  const candidates = map.resourceNodes.filter(
    (n) =>
      n.baseId === region.id &&
      n.kind === "mineral" &&
      resourceAvailable(s, map, es.owner[i], n),
  );
  candidates.sort((a, b) => {
    const count = (n: ResourceNode) =>
      s.economy.workers.filter((other) => other.resourceId === n.id).length;
    return (
      count(a) - count(b) ||
      (a.x * 256 - es.x[i]) ** 2 +
        (a.y * 256 - es.y[i]) ** 2 -
        (b.x * 256 - es.x[i]) ** 2 -
        (b.y * 256 - es.y[i]) ** 2 ||
      a.id.localeCompare(b.id)
    );
  });
  if (!candidates.length) return false;
  beginGather(s, map, w, candidates[0]);
  return true;
}
const nearRect = (
  s: SimulationState,
  w: WorkerState,
  r: { x: number; y: number; width: number; height: number },
) => {
  const i = indexOf(s, w.entityId),
    x = s.entities.x[i],
    y = s.entities.y[i],
    dx = x - Math.max(r.x, Math.min(r.x + r.width, x)),
    dy = y - Math.max(r.y, Math.min(r.y + r.height, y));
  return dx * dx + dy * dy <= (s.entities.radius[i] + 256) ** 2;
};
function travel(
  s: SimulationState,
  map: BattleMap,
  w: WorkerState,
  rect: { x: number; y: number; width: number; height: number },
  move: InternalMove,
): boolean {
  const i = indexOf(s, w.entityId),
    m = s.movement[i];
  if (m.order === "idle" && nearRect(s, w, rect)) return true;
  if (
    m.order === "idle" ||
    m.status === "blocked" ||
    (s.tick % 40 === w.entityId % 40 && m.stalledTicks > 10)
  ) {
    const goals = s.economy.workers
      .filter((o) => o !== w && o.goal)
      .map((o) => o.goal!);
    const p = approach(s, map, w.entityId, rect, goals);
    if (p) w.goal = move(s, w.entityId, p);
  }
  return false;
}
export function tickWorkers(
  s: SimulationState,
  map: BattleMap,
  move: InternalMove,
): void {
  if (!s.economy.enabled) return;
  for (const w of s.economy.workers) {
    const i = indexOf(s, w.entityId);
    if (i < 0 || s.entities.health[i] === 0 || isBurrowed(s, w.entityId)) continue;
    if (w.task === "toBuild" || w.task === "constructing") continue;
    if (w.task === "idle") {
      if (
        w.autoAllowed &&
        s.movement[i].order === "idle" &&
        (s.tick % 10 === w.entityId % 10 || s.tick === 1)
      ) {
        if ((w.cargoMinerals || w.cargoGas) && homeFor(s, map, w.entityId)) {
          w.homeId = homeFor(s, map, w.entityId)!.entityId;
          w.task = "returning";
        } else assignLocal(s, map, w);
      }
      continue;
    }
    const n = map.resourceNodes.find((n) => n.id === w.resourceId),
      r = s.economy.resources.find((r) => r.nodeId === w.resourceId);
    if (w.task === "returning") {
      let h = w.homeId === null ? undefined : structureOf(s, w.homeId);
      if (!h || !complete(h)) {
        h = homeFor(s, map, w.entityId, w.regionId ?? undefined);
        w.homeId = h?.entityId ?? null;
      }
      if (!h) {
        releaseWork(s, w, true);
        continue;
      }
      if (travel(s, map, w, buildingRect(h), move)) {
        const p = s.players[s.entities.owner[i]];
        p.minerals += w.cargoMinerals;
        p.gas += w.cargoGas;
        w.cargoMinerals = 0;
        w.cargoGas = 0;
        w.goal = null;
        if (n && resourceAvailable(s, map, p.id, n)) w.task = "toResource";
        else releaseWork(s, w, true);
      }
      continue;
    }
    if (!n || !r || !resourceAvailable(s, map, s.entities.owner[i], n)) {
      releaseWork(s, w, true);
      stopEntity(s, w.entityId);
      continue;
    }
    if (w.task === "toResource") {
      if (travel(s, map, w, nodeRect(s, n), move) && r.occupiedBy === null) {
        r.occupiedBy = w.entityId;
        w.task = "harvesting";
        w.remainingTicks =
          n.kind === "mineral"
            ? ECONOMY_MECHANICS.mineralHarvestTicks
            : ECONOMY_MECHANICS.gasHarvestTicks;
        w.goal = null;
      }
    } else if (w.task === "harvesting") {
      if (r.occupiedBy !== w.entityId) {
        w.task = "toResource";
        continue;
      }
      if (--w.remainingTicks <= 0) {
        const load =
          r.amount > 0
            ? Math.min(ECONOMY_MECHANICS.load, r.amount)
            : n.kind === "gas"
              ? ECONOMY_MECHANICS.depletedGasLoad
              : 0;
        if (n.kind === "mineral") w.cargoMinerals = load;
        else w.cargoGas = load;
        r.amount = Math.max(0, r.amount - load);
        r.occupiedBy = null;
        w.remainingTicks = 0;
        w.task = "returning";
        w.goal = null;
        if (r.amount === 0 && n.kind === "mineral") s.map.obstacleVersion++;
      }
    }
  }
}
