import { visibilityMask } from "../vision/rules";
import type { SimulationState } from "../core/state";
import type { BattleMap } from "../data/maps";
import type { EconomyDefinition } from "../data/economy-catalog";
import {
  ECONOMY_MECHANICS,
  economyDefinition,
  factionHeadquarters,
  factionWorker,
} from "../data/economy-catalog";
import { createEntity } from "../core/world";
import { idleMovement } from "../core/orders";
import { NavigationGrid, type Point } from "../pathfinding/navigation";
import { SpatialHash } from "../pathfinding/spatial-hash";
import { idleWorker, type StructureState, type WorkerState } from "./state";
export const indexOf = (s: SimulationState, id: number) =>
  s.entities.id.indexOf(id);
export const definitionOf = (s: SimulationState, id: number) =>
  economyDefinition(s.entities.definitionId[indexOf(s, id)]);
export const structureOf = (s: SimulationState, id: number) =>
  s.economy.structures.find((b) => b.entityId === id);
export const workerOf = (s: SimulationState, id: number) =>
  s.economy.workers.find((w) => w.entityId === id);
export const complete = (b: StructureState) =>
  b.started && b.completedTick >= 0;
export function hasCompleted(
  s: SimulationState,
  owner: number,
  id: string,
): boolean {
  return s.economy.structures.some(
    (b) =>
      complete(b) &&
      s.entities.owner[indexOf(s, b.entityId)] === owner &&
      definitionOf(s, b.entityId)?.id === id,
  );
}
export function meetsRequirements(
  s: SimulationState,
  owner: number,
  d: EconomyDefinition,
): boolean {
  return d.requires.every((id) => hasCompleted(s, owner, id));
}
export function createEconomicEntity(
  s: SimulationState,
  owner: number,
  d: EconomyDefinition,
  p: Point,
): number {
  const id = createEntity(s, {
    owner,
    definitionId: d.id,
    ...p,
    health: d.health,
    shield: d.shield,
    kind: d.kind,
    layer: d.icon === "airSupply" ? "air" : "ground",
    speed: d.speed,
    radius: d.radius,
  });
  if (d.kind === "worker") s.economy.workers.push(idleWorker(id));
  return id;
}
export function newStructure(
  id: number,
  d: EconomyDefinition,
  x: number,
  y: number,
  done = false,
  tick = 0,
): StructureState {
  return {
    entityId: id,
    tileX: x,
    tileY: y,
    width: d.width,
    height: d.height,
    started: done,
    remainingTicks: done ? 0 : d.ticks,
    totalTicks: d.ticks,
    builderId: null,
    workerHealth: 0,
    workerShield: 0,
    morphedWorker: false,
    addonParentId: null,
    geyserId: null,
    completedTick: done ? tick : -1,
    seededCreep: false,
    rally: null,
    repeatUnitId: null,
    queue: [],
    research: null,
    larva: done && d.id === "zerg-hatchery" ? 3 : 0,
    larvaTicks: ECONOMY_MECHANICS.larvaTicks,
  };
}
export function recomputeSupply(s: SimulationState): void {
  if (!s.economy.enabled) return;
  const es = s.entities;
  for (const p of s.players) {
    let used = 0,
      cap = 0;
    for (let i = 0; i < es.id.length; i++)
      if (es.owner[i] === p.id && es.health[i] > 0) {
        const d = economyDefinition(es.definitionId[i]);
        if (!d) continue;
        used += d.supply;
        const b = structureOf(s, es.id[i]);
        if (!b || complete(b)) cap += d.provides;
      }
    for (const b of s.economy.structures)
      if (es.owner[indexOf(s, b.entityId)] === p.id)
        used += b.queue.reduce((v, q) => v + q.supplyHalf, 0);
    p.supplyUsedHalf = used;
    p.supplyCapHalf = Math.min(200, cap);
  }
}
export function localVisibility(
  s: SimulationState,
  map: BattleMap,
  owner: number,
): Uint8Array {
  if (s.vision) return visibilityMask(s, map, owner);
  const out = new Uint8Array(map.widthTiles * map.heightTiles),
    es = s.entities;
  for (let i = 0; i < es.id.length; i++)
    if (es.owner[i] === owner && es.health[i] > 0) {
      const b = structureOf(s, es.id[i]);
      if (b && !b.started) continue;
      const d = economyDefinition(es.definitionId[i]),
        r = d?.sight ?? 7,
        cx = Math.floor(es.x[i] / 256),
        cy = Math.floor(es.y[i] / 256);
      for (
        let y = Math.max(0, cy - r);
        y <= Math.min(map.heightTiles - 1, cy + r);
        y++
      )
        for (
          let x = Math.max(0, cx - r);
          x <= Math.min(map.widthTiles - 1, cx + r);
          x++
        )
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r)
            out[y * map.widthTiles + x] = 2;
    }
  return out;
}
export function initializeEconomy(s: SimulationState, map: BattleMap): void {
  if (s.entities.id.length || s.economy.enabled)
    throw new Error("Economy already initialized");
  s.economy.enabled = true;
  s.economy.resources = map.resourceNodes.map((n) => ({
    nodeId: n.id,
    amount: n.amount,
    occupiedBy: null,
  }));
  for (const p of s.players) {
    const spawn = map.spawnPoints[p.id],
      hq = factionHeadquarters(p.faction),
      tx = spawn.x - 2,
      ty = spawn.y - 1,
      id = createEconomicEntity(s, p.id, hq, {
        x: (tx + hq.width / 2) * 256,
        y: (ty + hq.height / 2) * 256,
      });
    s.economy.structures.push(newStructure(id, hq, tx, ty, true, s.tick));
    for (let n = 0; n < 4; n++)
      createEconomicEntity(s, p.id, factionWorker(p.faction), {
        x: (spawn.x - 1 + n) * 256 + 64,
        y: (spawn.y + 3) * 256 + 64,
      });
    if (p.faction === "zerg")
      createEconomicEntity(s, p.id, economyDefinition("zerg-overlord")!, {
        x: spawn.x * 256 + 128,
        y: (spawn.y + 5) * 256 + 128,
      });
  }
  // An established Hatchery starts with its creep field; new providers spread over time.
  const cells = new Set<number>();
  for (const b of s.economy.structures)
    if (definitionOf(s, b.entityId)?.faction === "zerg") {
      const cx = b.tileX + b.width / 2,
        cy = b.tileY + b.height / 2;
      for (let y = 0; y < map.heightTiles; y++)
        for (let x = 0; x < map.widthTiles; x++)
          if (
            (x + 0.5 - cx) ** 2 * 25 + (y + 0.5 - cy) ** 2 * 64 <= 2500 &&
            map.buildable[y * map.widthTiles + x]
          )
            cells.add(y * map.widthTiles + x);
      b.seededCreep = true;
    }
  s.economy.creepCells = [...cells].sort((a, b) => a - b);
  s.economy.nextCreepTick = s.tick + ECONOMY_MECHANICS.creepSpreadTicks;
  recomputeSupply(s);
}
export function releaseWork(
  s: SimulationState,
  w: WorkerState,
  auto = false,
): void {
  for (const r of s.economy.resources)
    if (r.occupiedBy === w.entityId) r.occupiedBy = null;
  for (const b of s.economy.structures)
    if (b.builderId === w.entityId) b.builderId = null;
  w.task = "idle";
  w.resourceId = null;
  w.buildingId = null;
  w.buildQueue = [];
  w.homeId = null;
  w.regionId = null;
  w.remainingTicks = 0;
  w.autoAllowed = auto;
  w.goal = null;
}
/** Complete/cancel one construction while retaining the explicitly queued placements. */
export function advanceConstruction(
  s: SimulationState,
  w: WorkerState,
  id: number,
): void {
  const b = structureOf(s, id);
  if (b?.builderId === w.entityId) b.builderId = null;
  w.buildQueue = w.buildQueue.filter((next) => next !== id);
  if (w.buildingId !== id) return;
  const next = w.buildQueue.shift();
  stopEntity(s, w.entityId);
  w.goal = null;
  if (next !== undefined) {
    w.buildingId = next;
    w.task = "toBuild";
    w.autoAllowed = false;
  } else releaseWork(s, w, true);
}
export function stopEntity(s: SimulationState, id: number): void {
  const i = indexOf(s, id);
  if (i < 0) return;
  Object.assign(s.movement[i], idleMovement(id));
  s.navigation.jobs = s.navigation.jobs.filter((j) => j.entityId !== id);
}
export function approach(
  s: SimulationState,
  map: BattleMap,
  id: number,
  rect: { x: number; y: number; width: number; height: number },
  exclude: Point[] = [],
): Point | null {
  const i = indexOf(s, id);
  if (i < 0) return null;
  const es = s.entities,
    r = es.radius[i],
    hash = new SpatialHash(s),
    grid = new NavigationGrid(map, s, hash);
  const candidates: Point[] = [];
  for (
    let y = Math.floor((rect.y - r - 192) / 128) * 128 + 64;
    y <= rect.y + rect.height + r + 192;
    y += 128
  )
    for (
      let x = Math.floor((rect.x - r - 192) / 128) * 128 + 64;
      x <= rect.x + rect.width + r + 192;
      x += 128
    ) {
      const dx = x - Math.max(rect.x, Math.min(rect.x + rect.width, x)),
        dy = y - Math.max(rect.y, Math.min(rect.y + rect.height, y)),
        dist = dx * dx + dy * dy;
      if (dist >= (r + 16) ** 2 && dist <= (r + 192) ** 2)
        candidates.push({ x, y });
    }
  candidates.sort(
    (a, b) =>
      (a.x - es.x[i]) ** 2 +
        (a.y - es.y[i]) ** 2 -
        (b.x - es.x[i]) ** 2 -
        (b.y - es.y[i]) ** 2 ||
      a.y - b.y ||
      a.x - b.x,
  );
  return (
    candidates.find(
      (p) =>
        grid.clear(p, r, es.layer[i], id) &&
        !hash.overlaps(i, p.x, p.y) &&
        exclude.every(
          (q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 >= (2 * r + 16) ** 2,
        ),
    ) ?? null
  );
}
export const buildingRect = (b: StructureState) => ({
  x: b.tileX * 256,
  y: b.tileY * 256,
  width: b.width * 256,
  height: b.height * 256,
});
export function homeFor(
  s: SimulationState,
  map: BattleMap,
  id: number,
  baseId?: string,
): StructureState | undefined {
  const i = indexOf(s, id),
    region = map.regions.find((r) => r.id === baseId);
  return s.economy.structures
    .filter(
      (b) =>
        complete(b) &&
        definitionOf(s, b.entityId)?.headquarters &&
        s.entities.owner[indexOf(s, b.entityId)] === s.entities.owner[i] &&
        (!region ||
          Math.hypot(
            s.entities.x[indexOf(s, b.entityId)] / 256 - region.x,
            s.entities.y[indexOf(s, b.entityId)] / 256 - region.y,
          ) <= region.radius),
    )
    .sort((a, b) => {
      const ai = indexOf(s, a.entityId),
        bi = indexOf(s, b.entityId);
      return (
        (s.entities.x[ai] - s.entities.x[i]) ** 2 +
          (s.entities.y[ai] - s.entities.y[i]) ** 2 -
          (s.entities.x[bi] - s.entities.x[i]) ** 2 -
          (s.entities.y[bi] - s.entities.y[i]) ** 2 || a.entityId - b.entityId
      );
    })[0];
}
export function psiPower(
  s: SimulationState,
  owner: number,
  x: number,
  y: number,
): boolean {
  const mask = [8, 8, 7, 6, 3];
  return s.economy.structures.some(
    (b) =>
      complete(b) &&
      definitionOf(s, b.entityId)?.id === "protoss-pylon" &&
      s.entities.owner[indexOf(s, b.entityId)] === owner &&
      (() => {
        const i = indexOf(s, b.entityId),
          dx = x - s.entities.x[i],
          dy = y - s.entities.y[i],
          ax = Math.abs(dx) - (dx < 0 ? 1 : 0),
          ay = Math.abs(dy) - (dy < 0 ? 1 : 0),
          row = Math.floor(ay / 256);
        return row < 5 && ax < mask[row] * 256;
      })(),
  );
}
export function activeBuilding(s: SimulationState, b: StructureState): boolean {
  const i = indexOf(s, b.entityId),
    d = definitionOf(s, b.entityId);
  return (
    complete(b) &&
    !!d &&
    (!d.power ||
      psiPower(s, s.entities.owner[i], s.entities.x[i], s.entities.y[i]))
  );
}
