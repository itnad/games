import type { SimulationState } from "../core/state";
import type { GameCommand } from "../core/commands";
import type { EngineRules } from "../core/simulation";
import type { BattleMap } from "../data/maps";
import { idleMovement } from "../core/orders";
import { countsAsDefinition, economyDefinition } from "../data/economy-catalog";
import { definitionOf, hasCompleted, indexOf, releaseWork, workerOf, recomputeSupply } from "../economy/helpers";
import { NavigationGrid, type Point } from "../pathfinding/navigation";
import { SpatialHash } from "../pathfinding/spatial-hash";
import { formationOffsets } from "../pathfinding/formation";
import { isBurrowed } from "./burrow";
import { cargoSpace, carrierOf, emptySpecial, isEmbarked, loadingIn, occupiedSpace, transportCapacity, morphOf, TRANSPORT_MECHANICS, type CarrierState } from "./special-state";
type Move = (s: SimulationState, ids: number[], target: Point) => void;
function freeze(s: SimulationState, id: number) {
  const i = indexOf(s, id); if (i < 0) return;
  const m = s.movement[i], style = { formation: m.formation, stance: m.stance };
  Object.assign(m, idleMovement(id), style);
  s.navigation.jobs = s.navigation.jobs.filter((j) => j.entityId !== id);
  const w = workerOf(s, id); if (w) releaseWork(s, w, false);
  const r = s.combat?.records.find((r) => r.entityId === id);
  if (r) { r.resumeTarget = null; r.lastSeenTarget = null; }
}
function stateFor(s: SimulationState, id: number): CarrierState {
  s.special ??= emptySpecial();
  let t = carrierOf(s, id);
  if (!t) {
    t = { entityId: id, passengers: [], loadQueue: [], unloads: [], nextUnloadTick: 0 };
    s.special.transports.push(t); s.special.transports.sort((a, b) => a.entityId - b.entityId);
  }
  return t;
}
function cancelLoading(s: SimulationState, t: CarrierState) {
  for (const id of t.loadQueue) freeze(s, id);
  t.loadQueue = [];
}
function candidateCarrier(s: SimulationState, command: GameCommand, passengerId: number): number | undefined {
  const j = indexOf(s, passengerId), e = s.entities;
  return [...command.entityIds].filter((id) => {
    const i = indexOf(s, id), capacity = transportCapacity(s, id), t = carrierOf(s, id);
    return i >= 0 && e.owner[i] === command.playerId && capacity > 0 &&
      capacity - (t ? occupiedSpace(s, t) : 0) >= cargoSpace(s, passengerId);
  }).sort((a, b) => {
    const distance = (id: number) => { const i = indexOf(s, id); return (e.x[i] - e.x[j]) ** 2 + (e.y[i] - e.y[j]) ** 2; };
    return distance(a) - distance(b) || a - b;
  })[0];
}
/** Find a legal body before moving the carrier. Arrival checks stay local, so cargo never teleports. */
function landing(s: SimulationState, map: BattleMap, passenger: number, aim: Point, carrier: Point | null): Point | null {
  const i = indexOf(s, passenger); if (i < 0) return null;
  const radius = s.entities.radius[i], grid = new NavigationGrid(map, s), hash = new SpatialHash(s);
  const clear = (p: Point) => (!carrier || (p.x - carrier.x) ** 2 + (p.y - carrier.y) ** 2 <= TRANSPORT_MECHANICS.dropRange ** 2) &&
    grid.clear(p, radius, "ground", passenger) && !hash.overlaps(i, p.x, p.y);
  if (clear(aim)) return aim;
  const cx = Math.floor(aim.x / 128), cy = Math.floor(aim.y / 128), points: Point[] = [];
  for (let ring = 0; ring <= 6; ring++) {
    points.length = 0;
    for (let dx = -ring; dx <= ring; dx++) {
      const dy = ring - Math.abs(dx);
      for (const y of dy === 0 ? [cy] : [cy - dy, cy + dy]) points.push({ x: (cx + dx) * 128 + 64, y: y * 128 + 64 });
    }
    points.sort((a, b) => (a.x - aim.x) ** 2 + (a.y - aim.y) ** 2 - (b.x - aim.x) ** 2 - (b.y - aim.y) ** 2 || a.y - b.y || a.x - b.x);
    const found = points.find(clear); if (found) return found;
  }
  if (carrier) return null;
  const distant: Point[] = [];
  for (let y = 0; y < map.heightTiles; y++) for (let x = 0; x < map.widthTiles; x++)
    if (map.walkable[y * map.widthTiles + x]) distant.push({ x: x * 256 + 128, y: y * 256 + 128 });
  distant.sort((a, b) => (a.x - aim.x) ** 2 + (a.y - aim.y) ** 2 - (b.x - aim.x) ** 2 - (b.y - aim.y) ** 2 || a.y - b.y || a.x - b.x);
  return distant.find(clear) ?? null;
}
function planUnload(s: SimulationState, map: BattleMap, id: number, target: Point, ids: number[], append: boolean, move: Move) {
  const t = stateFor(s, id); cancelLoading(s, t);
  const e = s.entities, i = indexOf(s, id), current = { x: e.x[i], y: e.y[i] };
  const aim = landing(s, map, ids[0], target, null) ?? target;
  const firstMotion = s.movement[indexOf(s, ids[0])],
    spacing = Math.max(...ids.map((pid) => e.radius[indexOf(s, pid)] * 2 + 32)),
    offsets = formationOffsets(ids.length, spacing, firstMotion.formation);
  const jobs = ids.map((passengerId, n) => ({ passengerId,
    ...(landing(s, map, passengerId, { x: aim.x + offsets[n].x, y: aim.y + offsets[n].y }, null) ?? aim) }));
  t.unloads = append ? [...t.unloads.filter((j) => !ids.includes(j.passengerId)), ...jobs] : jobs;
  if ((current.x - t.unloads[0].x) ** 2 + (current.y - t.unloads[0].y) ** 2 > 128 ** 2) {
    move(s, [id], t.unloads[0]);
    const goal = s.movement[i].target;
    if (goal) { t.unloads[0].x = goal.x; t.unloads[0].y = goal.y; }
  }
  else freeze(s, id);
}
function approachPassengers(s: SimulationState, move: Move) {
  for (const t of s.special?.transports ?? []) {
    const i = indexOf(s, t.entityId); if (i < 0) continue;
    const e = s.entities;
    for (const id of t.loadQueue) {
      const j = indexOf(s, id); if (j < 0) continue;
      const m = s.movement[j], range = e.radius[i] + e.radius[j] + TRANSPORT_MECHANICS.loadRange;
      if ((e.x[i] - e.x[j]) ** 2 + (e.y[i] - e.y[j]) ** 2 <= range ** 2) continue;
      if (!m.target || (m.target.x - e.x[i]) ** 2 + (m.target.y - e.y[i]) ** 2 > 256 ** 2 || m.status === "idle" || m.status === "blocked")
        if (s.tick % 8 === id % 8 || !m.target) move(s, [id], { x: e.x[i], y: e.y[i] });
    }
    const job = t.unloads[0], m = s.movement[i];
    if (job && (e.x[i] - job.x) ** 2 + (e.y[i] - job.y) ** 2 > 192 ** 2 &&
      (m.status === "idle" || m.status === "blocked")) move(s, [t.entityId], job);
  }
}
function transportArrivals(s: SimulationState, map: BattleMap) {
  const e = s.entities;
  for (const t of s.special?.transports ?? []) {
    const i = indexOf(s, t.entityId); if (i < 0 || e.health[i] === 0) continue;
    for (const id of [...t.loadQueue]) {
      const j = indexOf(s, id); if (j < 0 || e.health[j] === 0) continue;
      const range = e.radius[i] + e.radius[j] + TRANSPORT_MECHANICS.loadRange;
      if ((e.x[i] - e.x[j]) ** 2 + (e.y[i] - e.y[j]) ** 2 > range ** 2) continue;
      freeze(s, id); t.loadQueue = t.loadQueue.filter((p) => p !== id); t.passengers.push(id);
    }
    const job = t.unloads[0], current = { x: e.x[i], y: e.y[i] };
    if (job && s.tick >= t.nextUnloadTick && (current.x - job.x) ** 2 + (current.y - job.y) ** 2 <= 192 ** 2) {
      const j = indexOf(s, job.passengerId),
        point = landing(s, map, job.passengerId, { x: job.x, y: job.y }, current);
      if (point) {
        t.passengers = t.passengers.filter((p) => p !== job.passengerId); t.unloads.shift();
        freeze(s, job.passengerId); e.x[j] = point.x; e.y[j] = point.y;
        s.movement[j].order = "hold"; t.nextUnloadTick = s.tick + TRANSPORT_MECHANICS.unloadTicks;
      }
    }
    for (const id of t.passengers) { const j = indexOf(s, id); if (j >= 0) { e.x[j] = e.x[i]; e.y[j] = e.y[i]; } }
  }
  if (s.special) s.special.transports = s.special.transports.filter((t) => t.passengers.length || t.loadQueue.length || t.unloads.length);
}
function tickMorphs(s: SimulationState) {
  if (!s.special) return;
  for (const job of [...s.special.morphs]) {
    if (--job.remainingTicks > 0) continue;
    const i = indexOf(s, job.entityId), b = s.economy.structures.find((b) => b.entityId === job.entityId), d = economyDefinition(job.targetDefinitionId);
    if (i >= 0 && b && d) {
      const old = definitionOf(s, job.entityId)!;
      s.entities.health[i] = Math.min(d.health, s.entities.health[i] + d.health - old.health);
      s.entities.definitionId[i] = d.id; s.entities.radius[i] = d.radius;
      b.totalTicks = d.ticks; b.remainingTicks = 0; b.width = d.width; b.height = d.height;
      s.map.obstacleVersion++;
    }
    s.special.morphs = s.special.morphs.filter((m) => m !== job);
  }
  recomputeSupply(s);
}
export function createSpecialRules(map: BattleMap, base: EngineRules): EngineRules {
  const commands = { ...base.commands }, move: Move = (s, ids, target) => {
    const i = indexOf(s, ids[0]); if (i < 0) return;
    const c = { kind: "move", entityIds: ids, target: { kind: "point", x: target.x, y: target.y }, source: "tutorial", playerId: s.entities.owner[i], sequence: s.commandState.nextInternalCommandId++, issuedTick: s.tick, executeTick: s.tick + 1 } as GameCommand;
    base.commands!.move!.apply(s, c, ids);
  };
  for (const kind of Object.keys(commands) as (keyof typeof commands)[]) {
    const handler = commands[kind]!;
    commands[kind] = {
      ...handler,
      validate: (s, c, id) => isEmbarked(s, id) && !["assignGroup", "setFormation", "setStance"].includes(c.kind) ? "invalid_state" :
        morphOf(s, id) && ["research", "placeBuilding"].includes(c.kind) ? "invalid_state" : handler.validate(s, c, id),
      apply: (s, c, ids) => {
        if (["move", "attackMove", "focusAttack", "patrol", "stop", "hold", "gather", "returnCargo", "autoGather", "placeBuilding", "toggleStateAbility"].includes(c.kind))
          for (const id of ids) {
            const loading = loadingIn(s, id); if (loading) loading.loadQueue = loading.loadQueue.filter((p) => p !== id);
            const t = carrierOf(s, id);
            if (t) { t.unloads = []; if (["stop", "hold", "patrol"].includes(c.kind)) cancelLoading(s, t); }
          }
        handler.apply(s, c, ids);
      },
    };
  }
  commands.loadTransport = {
    policy: "partial",
    validate: (s, c, id) => {
      if (c.kind !== "loadTransport" || !s.economy.enabled) return "invalid_command";
      const e = s.entities, j = indexOf(s, c.target.entityId), w = workerOf(s, c.target.entityId);
      if (j < 0 || e.health[j] === 0 || e.owner[j] !== c.playerId || e.kind[j] === "building" || e.layer[j] !== "ground" || cargoSpace(s, c.target.entityId) > 8) return "invalid_target";
      if (isEmbarked(s, c.target.entityId) || loadingIn(s, c.target.entityId) || isBurrowed(s, c.target.entityId) || w?.buildingId) return "invalid_state";
      if (!transportCapacity(s, id)) return definitionOf(s, id)?.id === "zerg-overlord" ? "missing_prerequisite" : "invalid_target";
      return candidateCarrier(s, c, c.target.entityId) === id ? null : "invalid_state";
    },
    apply: (s, c, ids) => {
      if (c.kind !== "loadTransport") return;
      const t = stateFor(s, ids[0]); t.unloads = []; freeze(s, c.target.entityId); t.loadQueue.push(c.target.entityId);
    },
  };
  const unload = (single: boolean): NonNullable<EngineRules["commands"]>["unloadTransport"] => ({
    policy: single ? "atomic" : "partial",
    validate: (s, c, id) => {
      if (c.kind !== "unloadTransport" && c.kind !== "unloadPassenger") return "invalid_command";
      if (c.target.x < 0 || c.target.y < 0 || c.target.x >= map.widthTiles * 256 || c.target.y >= map.heightTiles * 256) return "out_of_range";
      const t = carrierOf(s, id); if (!t || !t.passengers.length) return "invalid_state";
      return c.kind === "unloadPassenger" && !t.passengers.includes(c.payload.passengerId) ? "invalid_target" : null;
    },
    apply: (s, c, ids) => {
      if (c.kind !== "unloadTransport" && c.kind !== "unloadPassenger") return;
      const spacing = Math.max(...ids.map((id) => s.entities.radius[indexOf(s, id)] * 2 + 256));
      const positions = formationOffsets(ids.length, spacing, "spread");
      ids.forEach((id, n) => planUnload(s, map, id, { x: Math.min(map.widthTiles * 256 - 1, Math.max(0, c.target.x + positions[n].x)), y: Math.min(map.heightTiles * 256 - 1, Math.max(0, c.target.y + positions[n].y)) }, c.kind === "unloadPassenger" ? [c.payload.passengerId] : [...carrierOf(s, id)!.passengers], c.kind === "unloadPassenger", move));
    },
  });
  commands.unloadTransport = unload(false); commands.unloadPassenger = unload(true);
  commands.morphStructure = {
    policy: "partial",
    validate: (s, c, id) => {
      if (c.kind !== "morphStructure" || c.payload.buildingId !== "zerg-lair") return "invalid_target";
      const b = s.economy.structures.find((b) => b.entityId === id), d = economyDefinition("zerg-lair")!;
      if (!b || b.completedTick < 0 || definitionOf(s, id)?.id !== "zerg-hatchery" || b.research || morphOf(s, id)) return "invalid_state";
      if (!d.requires.every((r) => hasCompleted(s, c.playerId, r))) return "missing_prerequisite";
      const chosen = c.entityIds.filter((eid) => {
        const other = s.economy.structures.find((b) => b.entityId === eid);
        return definitionOf(s, eid)?.id === "zerg-hatchery" && s.entities.owner[indexOf(s, eid)] === c.playerId &&
          other && other.completedTick >= 0 && !other.research && !morphOf(s, eid);
      }).sort((a, b) => a - b)[0];
      if (id !== chosen) return "invalid_state";
      return s.players[c.playerId].minerals < d.minerals || s.players[c.playerId].gas < d.gas ? "insufficient_resource" : null;
    },
    apply: (s, c, ids) => {
      s.special ??= emptySpecial(); const d = economyDefinition("zerg-lair")!, p = s.players[c.playerId];
      for (const id of ids) {
        if (p.minerals < d.minerals || p.gas < d.gas) break;
        p.minerals -= d.minerals; p.gas -= d.gas;
        s.special.morphs.push({ entityId: id, targetDefinitionId: d.id, remainingTicks: d.ticks, totalTicks: d.ticks, minerals: d.minerals, gas: d.gas });
      }
    },
  };
  commands.cancelStructureMorph = {
    policy: "partial", validate: (s, c, id) => morphOf(s, id) ? null : "invalid_state",
    apply: (s, c, ids) => {
      for (const id of ids) { const job = morphOf(s, id)!, p = s.players[c.playerId]; p.minerals += Math.floor(job.minerals * .75); p.gas += Math.floor(job.gas * .75); }
      s.special!.morphs = s.special!.morphs.filter((m) => !ids.includes(m.entityId));
    },
  };
  return { commands, systems: { ...base.systems,
    construction: (s) => { tickMorphs(s); base.systems?.construction?.(s); },
    pathfinding: (s) => { approachPassengers(s, move); base.systems?.pathfinding?.(s); },
    movement: (s) => { base.systems?.movement?.(s); transportArrivals(s, map); },
  } };
}
