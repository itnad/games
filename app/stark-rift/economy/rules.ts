import { technologyRequirements } from "../data/economy-catalog";
import { morphOf } from "../abilities/special-state";
import { isBurrowed } from "../abilities/burrow";
import type { SimulationState } from "../core/state";
import type { BattleMap } from "../data/maps";
import type { EngineRules, CommandHandler } from "../core/simulation";
import type {
  GameCommand,
  CommandFailureCode,
  CommandKind,
} from "../core/commands";
import { allocateId, removeEntity } from "../core/world";
import {
  ECONOMY_MECHANICS,
  countsAsDefinition, isLarvaProducer,
  ECONOMY_UPGRADES,
  economyDefinition,
  type EconomyDefinition,
} from "../data/economy-catalog";
import {
  advanceConstruction,
  activeBuilding,
  buildingRect,
  complete,
  createEconomicEntity,
  definitionOf,
  hasCompleted,
  homeFor,
  indexOf,
  meetsRequirements,
  newStructure,
  recomputeSupply,
  releaseWork,
  stopEntity,
  structureOf,
  workerOf,
} from "./helpers";
import { placementAt, placementFailure } from "./placement";
import {
  beginGather,
  resourceAvailable,
  tickWorkers,
  type InternalMove,
} from "./workers";
import { tickConstructionAndProduction } from "./systems";
import { idleWorker } from "./state";
export function productionFailure(
  s: SimulationState,
  owner: number,
  id: number,
  d: EconomyDefinition,
  charge = true,
): CommandFailureCode | null {
  const b = structureOf(s, id),
    producer = definitionOf(s, id);
  if (
    !b ||
    !producer ||
    d.kind === "building" ||
    d.faction !== s.players[owner].faction ||
    !countsAsDefinition(producer.id, d.producer)
  )
    return "invalid_target";
  if (!activeBuilding(s, b) || b.queue.length >= 5 || (b.research && !isLarvaProducer(producer.id)))
    return "invalid_state";
  if (!meetsRequirements(s, owner, d)) return "missing_prerequisite";
  if (
    d.requires.some((required) => economyDefinition(required)?.addonParent === producer.id &&
      !s.economy.structures.some((add) => add.addonParentId === id &&
        definitionOf(s, add.entityId)?.id === required && complete(add)))
  )
    return "missing_prerequisite";
  if (isLarvaProducer(producer.id) && b.larva < 1) return "invalid_state";
  const p = s.players[owner];
  if (
    charge &&
    (p.minerals < d.minerals ||
      p.gas < d.gas ||
      p.supplyUsedHalf + d.supply * d.batch > Math.min(200, p.supplyCapHalf))
  )
    return "insufficient_resource";
  return null;
}
export function enqueueProduction(
  s: SimulationState,
  id: number,
  d: EconomyDefinition,
): void {
  const b = structureOf(s, id)!,
    p = s.players[s.entities.owner[indexOf(s, id)]];
  p.minerals -= d.minerals;
  p.gas -= d.gas;
  if (isLarvaProducer(definitionOf(s, id)?.id ?? "")) b.larva--;
  b.queue.push({
    id: allocateId(s, "nextEventId"),
    definitionId: d.id,
    remainingTicks: d.ticks,
    totalTicks: d.ticks,
    minerals: d.minerals,
    gas: d.gas,
    supplyHalf: d.supply * d.batch,
    count: d.batch,
  });
  recomputeSupply(s);
}
export function cancelConstruction(s: SimulationState, id: number): void {
  const b = structureOf(s, id),
    d = definitionOf(s, id);
  if (!b || !d || complete(b)) return;
  const i = indexOf(s, id),
    owner = s.entities.owner[i],
    p = s.players[owner],
    factor = b.started ? 0.75 : 1;
  p.minerals += Math.floor(d.minerals * factor);
  p.gas += Math.floor(d.gas * factor);
  const builder = b.builderId === null ? undefined : workerOf(s, b.builderId);
  if (builder) {
    advanceConstruction(s, builder, id);
  }
  if (b.morphedWorker) {
    const drone = economyDefinition("zerg-drone")!,
      es = s.entities;
    s.economy.structures = s.economy.structures.filter((x) => x !== b);
    es.definitionId[i] = drone.id;
    es.kind[i] = "worker";
    es.speed[i] = drone.speed;
    es.radius[i] = drone.radius;
    es.health[i] = Math.max(1, b.workerHealth);
    es.shield[i] = b.workerShield;
    s.economy.workers.push(idleWorker(id));
    s.economy.workers.sort((a, b) => a.entityId - b.entityId);
    stopEntity(s, id);
  } else removeEntity(s, id);
  s.map.obstacleVersion++;
  recomputeSupply(s);
}
export function createEconomyRules(
  map: BattleMap,
  movement: EngineRules,
): EngineRules {
  const move: InternalMove = (s, id, p, attack = false) => {
    const i = indexOf(s, id);
    if (i < 0) return null;
    const kind: "attackMove" | "move" = attack ? "attackMove" : "move",
      sequence = s.commandState.nextInternalCommandId++;
    const c = {
      kind,
      sequence,
      issuedTick: s.tick,
      executeTick: s.tick + 1,
      playerId: s.entities.owner[i],
      source: "tutorial" as const,
      entityIds: [id],
      target: { kind: "point" as const, ...p },
    };
    movement.commands![kind]!.apply(s, c, [id]);
    return s.movement[i].target;
  };
  const commands: NonNullable<EngineRules["commands"]> = {
    ...movement.commands,
  };
  // Player movement has priority over the automatic economy. Internal work movement bypasses these wrappers.
  for (const kind of [
    "move",
    "attackMove",
    "focusAttack",
    "patrol",
    "stop",
    "hold",
  ] as const) {
    const base = commands[kind]!;
    commands[kind] = {
      ...base,
      apply: (s, c, ids) => {
        for (const id of ids) {
          const w = workerOf(s, id);
          if (w) releaseWork(s, w, false);
        }
        base.apply(s, c, ids);
      },
    };
  }
  const make = (
    validate: CommandHandler["validate"],
    apply: CommandHandler["apply"],
  ): CommandHandler => ({
    policy: "partial",
    validate: (s, c, id) =>
      s.economy.enabled && !isBurrowed(s, id) ? validate(s, c, id) : "invalid_state",
    apply,
  });
  const workerValid = (s: SimulationState, id: number) =>
    workerOf(s, id) ? null : ("invalid_target" as const);
  commands.gather = make(
    (s, c, id) => {
      if (c.kind !== "gather") return "invalid_command";
      if (workerValid(s, id)) return "invalid_target";
      const n = map.resourceNodes.find((n) => n.id === c.payload.resourceId);
      return n && resourceAvailable(s, map, c.playerId, n)
        ? null
        : "invalid_target";
    },
    (s, c, ids) => {
      if (c.kind === "gather")
        for (const id of ids)
          beginGather(
            s,
            map,
            workerOf(s, id)!,
            map.resourceNodes.find((n) => n.id === c.payload.resourceId)!,
          );
    },
  );
  commands.autoGather = make(
    (s, c, id) => workerValid(s, id),
    (s, c, ids) => {
      for (const id of ids) {
        const w = workerOf(s, id)!;
        releaseWork(s, w, true);
        stopEntity(s, id);
      }
    },
  );
  commands.returnCargo = make(
    (s, c, id) =>
      workerValid(s, id) || (!homeFor(s, map, id) ? "invalid_target" : null),
    (s, c, ids) => {
      for (const id of ids) {
        const w = workerOf(s, id)!;
        releaseWork(s, w, true);
        w.homeId = homeFor(s, map, id)!.entityId;
        w.task = "returning";
        stopEntity(s, id);
      }
    },
  );
  commands.resumeConstruction = make(
    (s, c, id) => {
      if (
        c.kind !== "resumeConstruction" ||
        definitionOf(s, id)?.id !== "terran-scv"
      )
        return "invalid_target";
      const b = structureOf(s, c.target.entityId);
      return b &&
        !complete(b) &&
        b.builderId === null &&
        definitionOf(s, b.entityId)?.faction === "terran" &&
        s.entities.owner[indexOf(s, b.entityId)] === c.playerId &&
        id ===
          Math.min(
            ...c.entityIds.filter(
              (n) =>
                definitionOf(s, n)?.id === "terran-scv" &&
                s.entities.owner[indexOf(s, n)] === c.playerId,
            ),
          )
        ? null
        : "invalid_target";
    },
    (s, c, ids) => {
      if (c.kind !== "resumeConstruction") return;
      const b = structureOf(s, c.target.entityId)!,
        w = workerOf(s, ids[0])!;
      releaseWork(s, w, false);
      b.builderId = w.entityId;
      w.task = "toBuild";
      w.buildingId = b.entityId;
      stopEntity(s, w.entityId);
    },
  );
  commands.placeBuilding = make(
    (s, c, id) => {
      if (c.kind !== "placeBuilding") return "invalid_command";
      if (s.entities.id.length >= 2048) return "invalid_state";
      const d = economyDefinition(c.payload.buildingId),
        actor = definitionOf(s, id);
      if (!d || !actor || d.kind !== "building" || d.producer !== actor.id)
        return "invalid_target";
      const eligible = c.entityIds
        .filter(
          (n) =>
            definitionOf(s, n)?.id === d.producer &&
            !isBurrowed(s, n) &&
            s.entities.owner[indexOf(s, n)] === c.playerId &&
            s.entities.health[indexOf(s, n)] > 0 &&
            (!c.payload.queued ||
              d.faction !== "zerg" ||
              !["toBuild", "constructing"].includes(
                workerOf(s, n)?.task ?? "",
              )),
        )
        .sort((a, b) => a - b);
      if (
        id !== eligible[0] ||
        (c.payload.queued && (workerOf(s, id)?.buildQueue.length ?? 0) >= 16)
      )
        return "invalid_state";
      if (d.addonParent && !activeBuilding(s, structureOf(s, id)!))
        return "invalid_state";
      const p = s.players[c.playerId];
      if (p.minerals < d.minerals || p.gas < d.gas)
        return "insufficient_resource";
      return placementFailure(
        s,
        map,
        c.playerId,
        id,
        d,
        placementAt(s, map, id, d, c.target.x, c.target.y),
      );
    },
    (s, c, ids) => {
      if (c.kind !== "placeBuilding") return;
      const id = ids[0],
        d = economyDefinition(c.payload.buildingId)!,
        p = placementAt(s, map, id, d, c.target.x, c.target.y),
        owner = s.players[c.playerId];
      owner.minerals -= d.minerals;
      owner.gas -= d.gas;
      const eid = createEconomicEntity(s, c.playerId, d, {
          x: (p.tileX + d.width / 2) * 256,
          y: (p.tileY + d.height / 2) * 256,
        }),
        b = newStructure(eid, d, p.tileX, p.tileY);
      b.geyserId = p.geyserId;
      b.addonParentId = p.addonParentId;
      s.entities.health[indexOf(s, eid)] = 1;
      s.entities.shield[indexOf(s, eid)] = 0;
      s.economy.structures.push(b);
      const w = workerOf(s, id);
      if (w) {
        if (c.payload.queued && ["toBuild", "constructing"].includes(w.task)) {
          w.buildQueue.push(eid);
          b.builderId = id;
        } else {
          releaseWork(s, w, false);
          w.task = "toBuild";
          w.buildingId = eid;
          b.builderId = id;
          stopEntity(s, id);
        }
      } else {
        b.started = true;
        s.map.obstacleVersion++;
      }
      recomputeSupply(s);
    },
  );
  commands.cancelConstruction = make(
    (s, c, id) => {
      const b = structureOf(s, id);
      return b && !complete(b) ? null : "invalid_target";
    },
    (s, c, ids) => {
      for (const id of ids) cancelConstruction(s, id);
    },
  );
  commands.produce = make(
    (s, c, id) => {
      if (c.kind !== "produce") return "invalid_command";
      const d = economyDefinition(c.payload.unitId);
      if (!d) return "invalid_target";
      const failure = productionFailure(s, c.playerId, id, d);
      if (failure) return failure;
      const chosen = c.entityIds
        .filter(
          (n) =>
            s.entities.owner[indexOf(s, n)] === c.playerId &&
            !productionFailure(s, c.playerId, n, d),
        )
        .sort(
          (a, b) =>
            structureOf(s, a)!.queue.length - structureOf(s, b)!.queue.length ||
            a - b,
        )[0];
      return chosen === id ? null : "invalid_state";
    },
    (s, c, ids) => {
      if (c.kind === "produce")
        enqueueProduction(s, ids[0], economyDefinition(c.payload.unitId)!);
    },
  );
  commands.toggleRepeatProduction = make(
    (s, c, id) => {
      if (c.kind !== "toggleRepeatProduction") return "invalid_command";
      const d = economyDefinition(c.payload.unitId),
        b = structureOf(s, id);
      if (
        !d ||
        !b ||
        !complete(b) ||
        !countsAsDefinition(definitionOf(s, id)?.id ?? "", d.producer) ||
        d.kind === "building"
      )
        return "invalid_target";
      return meetsRequirements(s, c.playerId, d)
        ? null
        : "missing_prerequisite";
    },
    (s, c, ids) => {
      if (c.kind === "toggleRepeatProduction")
        for (const id of ids)
          structureOf(s, id)!.repeatUnitId = c.payload.enabled
            ? c.payload.unitId
            : null;
    },
  );
  commands.cancelProduction = make(
    (s, c, id) =>
      c.kind === "cancelProduction" &&
      structureOf(s, id)?.queue.some((q) => q.id === c.payload.queueEntryId)
        ? null
        : "invalid_target",
    (s, c, ids) => {
      if (c.kind !== "cancelProduction") return;
      for (const id of ids) {
        const b = structureOf(s, id)!,
          q = b.queue.find((q) => q.id === c.payload.queueEntryId)!;
        const p = s.players[s.entities.owner[indexOf(s, id)]];
        p.minerals += q.minerals;
        p.gas += q.gas;
        b.queue = b.queue.filter((j) => j !== q);
      }
      recomputeSupply(s);
    },
  );
  commands.setRallyPoint = make(
    (s, c, id) =>
      c.kind === "setRallyPoint" &&
      c.target.x >= 0 &&
      c.target.y >= 0 &&
      c.target.x < map.widthTiles * 256 &&
      c.target.y < map.heightTiles * 256 &&
      structureOf(s, id) &&
      complete(structureOf(s, id)!)
        ? null
        : "invalid_target",
    (s, c, ids) => {
      if (c.kind === "setRallyPoint")
        for (const id of ids)
          structureOf(s, id)!.rally = { x: c.target.x, y: c.target.y };
    },
  );
  commands.research = make(
    (s, c, id) => {
      if (c.kind !== "research") return "invalid_command";
      const t = ECONOMY_UPGRADES.find((t) => t.id === c.payload.technologyId),
        b = structureOf(s, id);
      if (!t || !b || !countsAsDefinition(definitionOf(s, id)?.id ?? "", t.producer))
        return "invalid_target";
      if (!technologyRequirements(t.id).every((required) => hasCompleted(s, c.playerId, required))) return "missing_prerequisite";
      if (!activeBuilding(s, b) || b.research || (b.queue.length > 0 && !isLarvaProducer(t.producer)))
        return "invalid_state";
      if (
        s.economy.upgrades.some(
          (u) => u.playerId === c.playerId && u.technologyId === t.id,
        ) ||
        s.economy.structures.some(
          (other) =>
            other.research?.technologyId === t.id &&
            s.entities.owner[indexOf(s, other.entityId)] === c.playerId,
        )
      )
        return "missing_prerequisite";
      const chosen = c.entityIds
        .filter(
          (n) =>
            countsAsDefinition(definitionOf(s, n)?.id ?? "", t.producer) &&
            s.entities.owner[indexOf(s, n)] === c.playerId &&
            activeBuilding(s, structureOf(s, n)!) &&
            !morphOf(s, n) &&
            !structureOf(s, n)!.research,
        )
        .sort((a, b) => a - b)[0];
      if (id !== chosen) return "invalid_state";
      return s.players[c.playerId].minerals >= t.minerals &&
        s.players[c.playerId].gas >= t.gas
        ? null
        : "insufficient_resource";
    },
    (s, c, ids) => {
      if (c.kind !== "research") return;
      const t = ECONOMY_UPGRADES.find((t) => t.id === c.payload.technologyId)!,
        p = s.players[c.playerId];
      p.minerals -= t.minerals;
      p.gas -= t.gas;
      structureOf(s, ids[0])!.research = {
        id: allocateId(s, "nextEventId"),
        technologyId: t.id,
        level: 1,
        remainingTicks: t.ticks,
        totalTicks: t.ticks,
        minerals: t.minerals,
        gas: t.gas,
      };
    },
  );
  commands.cancelResearch = make(
    (s, c, id) => (structureOf(s, id)?.research ? null : "invalid_target"),
    (s, c, ids) => {
      for (const id of ids) {
        const b = structureOf(s, id)!,
          r = b.research!,
          p = s.players[s.entities.owner[indexOf(s, id)]];
        p.minerals += r.minerals;
        p.gas += r.gas;
        b.research = null;
      }
    },
  );
  return {
    commands,
    systems: {
      ...movement.systems,
      construction: (s) => tickConstructionAndProduction(s, map, move),
      economy: (s) => tickWorkers(s, map, move),
    },
  };
}
