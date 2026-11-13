import { nextUint32 } from "../core/rng";
import type { SimulationState } from "../core/state";
import type { BattleMap } from "../data/maps";
import { removeEntity } from "../core/world";
import { ECONOMY_MECHANICS, economyDefinition, economyLayer, isLarvaProducer } from "../data/economy-catalog";
import { NavigationGrid, type Point } from "../pathfinding/navigation";
import { SpatialHash } from "../pathfinding/spatial-hash";
import { idleMovement } from "../core/orders";
import {
  advanceConstruction,
  activeBuilding,
  approach,
  buildingRect,
  complete,
  createEconomicEntity,
  definitionOf,
  indexOf,
  recomputeSupply,
  releaseWork,
  stopEntity,
  workerOf,
} from "./helpers";
import { placementFailure } from "./placement";
import { enqueueProduction, productionFailure } from "./rules";
import type { InternalMove } from "./workers";
import type { StructureState } from "./state";
function startBuilding(
  s: SimulationState,
  map: BattleMap,
  b: StructureState,
  move: InternalMove,
): boolean {
  if (b.addonParentId !== null) return true;
  const w = b.builderId === null ? undefined : workerOf(s, b.builderId);
  if (!w || w.buildingId !== b.entityId) return false;
  const i = indexOf(s, w.entityId),
    es = s.entities,
    m = s.movement[i],
    r = buildingRect(b),
    dx = es.x[i] - Math.max(r.x, Math.min(r.x + r.width, es.x[i])),
    dy = es.y[i] - Math.max(r.y, Math.min(r.y + r.height, es.y[i]));
  if (
    m.order !== "idle" ||
    dx * dx + dy * dy > (es.radius[i] + 256) ** 2 ||
    dx * dx + dy * dy < es.radius[i] ** 2
  ) {
    if (m.order === "idle" || m.status === "blocked") {
      const p = approach(s, map, w.entityId, r);
      if (p) w.goal = move(s, w.entityId, p);
    }
    return false;
  }
  const d = definitionOf(s, b.entityId)!;
  if (!b.started) {
    if (
      placementFailure(
        s,
        map,
        es.owner[i],
        w.entityId,
        d,
        {
          tileX: b.tileX,
          tileY: b.tileY,
          geyserId: b.geyserId,
          addonParentId: b.addonParentId,
        },
        b.entityId,
      )
    )
      return false;
    b.started = true;
    s.map.obstacleVersion++;
    if (d.faction === "zerg") {
      const old = b.entityId,
        drone = w.entityId;
      b.workerHealth = es.health[i];
      b.workerShield = es.shield[i];
      b.morphedWorker = true;
      releaseWork(s, w, false);
      s.economy.workers = s.economy.workers.filter((other) => other !== w);
      b.entityId = drone;
      b.builderId = null;
      removeEntity(s, old);
      const di = indexOf(s, drone);
      es.definitionId[di] = d.id;
      es.kind[di] = "building";
      es.speed[di] = 0;
      es.radius[di] = d.radius;
      es.x[di] = (b.tileX + d.width / 2) * 256;
      es.y[di] = (b.tileY + d.height / 2) * 256;
      es.health[di] = 1;
      es.shield[di] = 0;
      Object.assign(s.movement[di], idleMovement(drone));
      s.economy.structures.sort((a, b) => a.entityId - b.entityId);
      recomputeSupply(s);
    } else if (d.faction === "protoss") {
      advanceConstruction(s, w, b.entityId);
    } else w.task = "constructing";
  } else w.task = "constructing";
  return true;
}
function spawnPositions(
  s: SimulationState,
  map: BattleMap,
  b: StructureState,
  id: string,
  count: number,
): Point[] | null {
  const d = economyDefinition(id)!,
    rect = buildingRect(b),
    layer = economyLayer(d),
    grid = new NavigationGrid(map, s, new SpatialHash(s)),
    hash = new SpatialHash(s),
    positions: Point[] = [],
    r = d.radius;
  const candidates: Point[] = [],
    aim = b.rally ?? {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height + 256,
    };
  for (
    let y = Math.max(64, Math.floor((rect.y - r - 384) / 128) * 128 + 64);
    y < rect.y + rect.height + r + 384;
    y += 128
  )
    for (
      let x = Math.max(64, Math.floor((rect.x - r - 384) / 128) * 128 + 64);
      x < rect.x + rect.width + r + 384;
      x += 128
    ) {
      const dx = x - Math.max(rect.x, Math.min(rect.x + rect.width, x)),
        dy = y - Math.max(rect.y, Math.min(rect.y + rect.height, y));
      if (
        dx * dx + dy * dy >= (r + 16) ** 2 &&
        dx * dx + dy * dy <= (r + 384) ** 2
      )
        candidates.push({ x, y });
    }
  candidates.sort(
    (a, b) =>
      (a.x - aim.x) ** 2 +
        (a.y - aim.y) ** 2 -
        (b.x - aim.x) ** 2 -
        (b.y - aim.y) ** 2 ||
      a.y - b.y ||
      a.x - b.x,
  );
  for (const p of candidates) {
    if (
      !grid.clear(p, r, layer) ||
      positions.some(
        (q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < (r * 2 + 16) ** 2,
      )
    )
      continue;
    let occupied = false;
    for (const i of hash.queryBounds(p.x - r, p.y - r, p.x + r, p.y + r))
      if (s.entities.layer[i] === layer) {
        const rr = r + s.entities.radius[i];
        if (
          (p.x - s.entities.x[i]) ** 2 + (p.y - s.entities.y[i]) ** 2 <
            rr * rr &&
          s.entities.kind[i] !== "building"
        ) {
          occupied = true;
          break;
        }
      }
    if (!occupied) positions.push(p);
    if (positions.length === count) return positions;
  }
  return null;
}
function spreadCreep(s: SimulationState, map: BattleMap): void {
  if (s.tick < s.economy.nextCreepTick) return;
  s.economy.nextCreepTick = s.tick + ECONOMY_MECHANICS.creepSpreadTicks;
  const cells = new Set(s.economy.creepCells);
  for (const b of s.economy.structures) {
    const d = definitionOf(s, b.entityId);
    if (
      !d ||
      !complete(b) ||
      !["zerg-hatchery", "zerg-creep-colony"].includes(d.id)
    )
      continue;
    if (!b.seededCreep) {
      for (let y = b.tileY; y < b.tileY + b.height; y++)
        for (let x = b.tileX; x < b.tileX + b.width; x++)
          cells.add(y * map.widthTiles + x);
      b.seededCreep = true;
    }
    const cx = b.tileX + b.width / 2,
      cy = b.tileY + b.height / 2,
      candidates: number[] = [];
    for (
      let y = Math.max(0, Math.floor(cy - 7));
      y < Math.min(map.heightTiles, cy + 7);
      y++
    )
      for (
        let x = Math.max(0, Math.floor(cx - 10));
        x < Math.min(map.widthTiles, cx + 10);
        x++
      ) {
        const c = y * map.widthTiles + x;
        if (
          cells.has(c) ||
          !map.buildable[c] ||
          (x + 0.5 - cx) ** 2 * 25 + (y + 0.5 - cy) ** 2 * 64 > 2500
        )
          continue;
        let neighbors = 0;
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++)
            if (ox !== 0 || oy !== 0) {
              const nx = x + ox,
                ny = y + oy;
              if (
                nx >= 0 &&
                nx < map.widthTiles &&
                ny >= 0 &&
                ny < map.heightTiles &&
                cells.has(ny * map.widthTiles + nx)
              )
                neighbors++;
            }
        const occupied = s.economy.structures.some(
          (other) =>
            other.started &&
            x >= other.tileX &&
            x < other.tileX + other.width &&
            y >= other.tileY &&
            y < other.tileY + other.height,
        );
        if (neighbors && !occupied) candidates.push(c);
      }
    // Original spread favors the most surrounding creep (eight neighbors), then samples a tie.
    const neighbors = (c: number) => {
      let count = 0;
      const x = c % map.widthTiles,
        y = Math.floor(c / map.widthTiles);
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++)
          if (ox !== 0 || oy !== 0) {
            const nx = x + ox,
              ny = y + oy;
            if (
              nx >= 0 &&
              nx < map.widthTiles &&
              ny >= 0 &&
              ny < map.heightTiles &&
              cells.has(ny * map.widthTiles + nx)
            )
              count++;
          }
      return count;
    };
    if (candidates.length) {
      const highest = Math.max(...candidates.map(neighbors)),
        ties = candidates.filter((c) => neighbors(c) === highest);
      cells.add(ties[nextUint32(s.rngStreams, "map") % ties.length]);
    }
  }
  s.economy.creepCells = [...cells].sort((a, b) => a - b);
}
export function tickConstructionAndProduction(
  s: SimulationState,
  map: BattleMap,
  move: InternalMove,
): void {
  if (!s.economy.enabled) return;
  for (const b of [...s.economy.structures]) {
    const d = definitionOf(s, b.entityId);
    if (!d) continue;
    if (!complete(b)) {
      if (!b.started) {
        if (!startBuilding(s, map, b, move)) continue;
      } else if (
        d.faction === "terran" &&
        !d.addonParent &&
        !startBuilding(s, map, b, move)
      )
        continue;
      const before = b.totalTicks - b.remainingTicks;
      if (b.remainingTicks > 0) b.remainingTicks--;
      const i = indexOf(s, b.entityId),
        done = b.totalTicks - b.remainingTicks;
      s.entities.health[i] = Math.min(
        d.health,
        s.entities.health[i] +
          Math.max(1, Math.floor((d.health * done) / b.totalTicks)) -
          Math.max(1, Math.floor((d.health * before) / b.totalTicks)),
      );
      s.entities.shield[i] = Math.min(
        d.shield,
        s.entities.shield[i] +
          Math.floor((d.shield * done) / b.totalTicks) -
          Math.floor((d.shield * before) / b.totalTicks),
      );
      if (b.remainingTicks === 0) {
        b.completedTick = s.tick;
        if (isLarvaProducer(d.id)) b.larva = 1;
        const w = b.builderId === null ? undefined : workerOf(s, b.builderId);
        if (w) {
          advanceConstruction(s, w, b.entityId);
        }
        b.builderId = null;
        s.map.obstacleVersion++;
        recomputeSupply(s);
      }
      continue;
    }
    if (isLarvaProducer(d.id) && b.larva < 3) {
      if (b.larvaTicks > 0) b.larvaTicks--;
      if (b.larvaTicks === 0) {
        b.larva++;
        b.larvaTicks = ECONOMY_MECHANICS.larvaTicks;
      }
    }
    if (!activeBuilding(s, b)) continue;
    const jobs = isLarvaProducer(d.id) ? [...b.queue] : b.queue.slice(0, 1);
    for (const q of jobs) {
      if (q.remainingTicks > 0) q.remainingTicks--;
      if (q.remainingTicks > 0) continue;
      if (s.entities.id.length + q.count > 2048) continue;
      const positions = spawnPositions(s, map, b, q.definitionId, q.count);
      if (!positions) continue;
      const unit = economyDefinition(q.definitionId)!;
      b.queue = b.queue.filter((job) => job !== q);
      for (const p of positions) {
        const id = createEconomicEntity(
          s,
          s.entities.owner[indexOf(s, b.entityId)],
          unit,
          p,
        );
        if (b.rally) move(s, id, b.rally, unit.kind !== "worker");
      }
      recomputeSupply(s);
    }
    if (b.research) {
      const r = b.research;
      if (r.remainingTicks > 0) r.remainingTicks--;
      if (r.remainingTicks === 0) {
        s.economy.upgrades.push({
          playerId: s.entities.owner[indexOf(s, b.entityId)],
          technologyId: r.technologyId,
          level: r.level,
        });
        b.research = null;
      }
    }
    if (b.repeatUnitId && b.queue.length === 0 && (!b.research || isLarvaProducer(d.id))) {
      const repeat = economyDefinition(b.repeatUnitId),
        owner = s.entities.owner[indexOf(s, b.entityId)];
      if (repeat && !productionFailure(s, owner, b.entityId, repeat))
        enqueueProduction(s, b.entityId, repeat);
    }
  }
  spreadCreep(s, map);
  recomputeSupply(s);
}
