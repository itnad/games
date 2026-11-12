import { describe, it, expect, vi } from "vitest";
import { getRuntimeMap } from "../../app/stark-rift/data/maps";
import {
  ECONOMY_DEFINITIONS,
  ECONOMY_MECHANICS,
  economyDefinition,
  economicTicks,
  factionWorker,
  type Faction,
} from "../../app/stark-rift/data/economy-catalog";
import {
  startSimulation,
  stepSimulation,
  enqueueCommand,
} from "../../app/stark-rift/core/simulation";
import { createMovementRules } from "../../app/stark-rift/core/movement-rules";
import { createEconomyRules } from "../../app/stark-rift/economy/rules";
import {
  initializeEconomy,
  structureOf,
  createEconomicEntity,
  newStructure,
  recomputeSupply,
  indexOf,
  workerOf,
} from "../../app/stark-rift/economy/helpers";
import {
  simulationStateSchema,
  createPersistenceEnvelope,
  restoreSnapshot,
} from "../../app/stark-rift/core/state";
import { parse } from "../../app/stark-rift/core/validation";
import { checksum } from "../../app/stark-rift/core/checksum";
import { removeEntity } from "../../app/stark-rift/core/world";
import type { GameCommand } from "../../app/stark-rift/core/commands";
// Multi-thousand-tick correctness scenarios also run on shared CI CPUs.
vi.setConfig({ testTimeout: 20000 });
function fixture(faction: Faction = "terran") {
  const { map, dataVersion } = getRuntimeMap("rift-basin"),
    state = startSimulation(
      42,
      map.id,
      dataVersion,
      [0, 1].map((id) => ({
        id,
        faction,
        minerals: 50,
        gas: 0,
        supplyUsedHalf: 0,
        supplyCapHalf: 0,
      })),
    );
  initializeEconomy(state, map);
  const rules = createEconomyRules(
    map,
    createMovementRules(map, () => true),
  );
  const tick = (n: number) => {
    for (let i = 0; i < n; i++) stepSimulation(state, rules);
  };
  const issue = (body: object) => {
    const c = {
      ...body,
      sequence: state.commandState.lastAcceptedSequenceByPlayer[0] + 1,
      issuedTick: state.tick,
      executeTick: state.tick + 1,
      playerId: 0,
      source: "player",
    } as GameCommand;
    expect(enqueueCommand(state, c, rules)).toEqual({ ok: true });
    return stepSimulation(state, rules)[0];
  };
  const add = (id: string, x: number, y: number) => {
    const d = economyDefinition(id)!,
      eid = createEconomicEntity(state, 0, d, {
        x: (x + d.width / 2) * 256,
        y: (y + d.height / 2) * 256,
      });
    state.economy.structures.push(newStructure(eid, d, x, y, true, state.tick));
    recomputeSupply(state);
    return eid;
  };
  return { map, state, rules, tick, issue, add };
}
describe("stage 4 deterministic economy", () => {
  it("uses verified costs, nearest 50% timing, supply halves and original movement speed", () => {
    expect(ECONOMY_DEFINITIONS).toHaveLength(41);
    expect(economicTicks(75)).toBe(31);
    expect(economicTicks(300)).toBe(125);
    expect(economyDefinition("terran-scv")?.speed).toBe(945);
    expect(economyDefinition("zerg-zergling")?.batch).toBe(2);
  });
  it.each(["terran", "zerg", "protoss"] as const)(
    "%s starts correctly and actually mines and returns cargo through movement",
    (f) => {
      const { state, tick } = fixture(f);
      expect(state.players[0]).toMatchObject({
        minerals: 50,
        supplyUsedHalf: 8,
        supplyCapHalf: f === "terran" ? 20 : 18,
      });
      expect(
        state.economy.workers.filter(
          (w) => state.entities.owner[indexOf(state, w.entityId)] === 0,
        ),
      ).toHaveLength(4);
      tick(600);
      expect(state.players[0].minerals).toBeGreaterThan(50);
      expect(parse(simulationStateSchema, state).ok).toBe(true);
    },
  );
  it("never spends the same minerals twice for same-tick production", () => {
    const { state, rules } = fixture(),
      hq = state.economy.structures[0].entityId;
    for (let sequence = 1; sequence <= 2; sequence++)
      expect(
        enqueueCommand(
          state,
          {
            kind: "produce",
            sequence,
            issuedTick: 0,
            executeTick: 1,
            playerId: 0,
            source: "player",
            entityIds: [hq],
            payload: { unitId: "terran-scv" },
          },
          rules,
        ).ok,
      ).toBe(true);
    const result = stepSimulation(state, rules);
    expect(result.map((r) => r.accepted)).toEqual([true, false]);
    expect(state.players[0].minerals).toBe(0);
    expect(state.players[0].supplyUsedHalf).toBe(10);
  });
  it("reserves supply immediately, refunds cancellation and produces a real worker", () => {
    const { state, issue, tick } = fixture(),
      hq = state.economy.structures[0].entityId;
    expect(
      issue({
        kind: "produce",
        entityIds: [hq],
        payload: { unitId: "terran-scv" },
      }).accepted,
    ).toBe(true);
    const q = structureOf(state, hq)!.queue[0];
    expect(state.players[0].supplyUsedHalf).toBe(10);
    issue({
      kind: "cancelProduction",
      entityIds: [hq],
      payload: { queueEntryId: q.id },
    });
    expect(state.players[0].minerals).toBe(50);
    expect(state.players[0].supplyUsedHalf).toBe(8);
    issue({
      kind: "produce",
      entityIds: [hq],
      payload: { unitId: "terran-scv" },
    });
    tick(126);
    expect(
      state.economy.workers.filter(
        (w) => state.entities.owner[indexOf(state, w.entityId)] === 0,
      ),
    ).toHaveLength(5);
    expect(structureOf(state, hq)!.queue).toHaveLength(0);
  });
  it("honors explicit stop instead of restarting auto gathering", () => {
    const { state, tick, issue } = fixture();
    tick(100);
    const w = state.economy.workers[0];
    issue({ kind: "stop", entityIds: [w.entityId] });
    expect(w.autoAllowed).toBe(false);
    tick(100);
    expect(w.task).toBe("idle");
    expect(state.movement[indexOf(state, w.entityId)].order).toBe("idle");
  });
  it.each(["terran", "zerg", "protoss"] as const)(
    "%s construction has its race-specific builder lifecycle and refund",
    (f) => {
      const { state, issue, tick } = fixture(f);
      state.players[0].minerals = 500;
      const worker = state.economy.workers[0],
        id = worker.entityId,
        build =
          f === "terran"
            ? "terran-supply-depot"
            : f === "zerg"
              ? "zerg-spawning-pool"
              : "protoss-pylon";
      const r = issue({
        kind: "placeBuilding",
        entityIds: [id],
        target: { kind: "point", x: 18 * 256, y: 17 * 256 },
        payload: { buildingId: build },
      });
      expect(r.accepted).toBe(true);
      tick(180);
      const b = state.economy.structures.find(
        (b) =>
          state.entities.owner[indexOf(state, b.entityId)] === 0 &&
          state.entities.definitionId[indexOf(state, b.entityId)] === build,
      )!;
      expect(b?.started).toBe(true);
      expect(b.completedTick).toBe(-1);
      if (f === "zerg") {
        expect(b.entityId).toBe(id);
        expect(workerOf(state, id)).toBeUndefined();
      } else if (f === "protoss") expect(b.builderId).toBeNull();
      else expect(b.builderId).toBe(id);
      const funds = state.players[0].minerals;
      expect(
        issue({ kind: "cancelConstruction", entityIds: [b.entityId] }).accepted,
      ).toBe(true);
      expect(state.players[0].minerals).toBeGreaterThanOrEqual(
        funds + Math.floor(economyDefinition(build)!.minerals * 0.75),
      );
      if (f === "zerg") expect(workerOf(state, id)).toBeDefined();
    },
  );
  it("pauses SCV construction, resumes it, and completes supply", () => {
    const { state, issue, tick } = fixture();
    state.players[0].minerals = 1000;
    const w = state.economy.workers[0].entityId;
    issue({
      kind: "placeBuilding",
      entityIds: [w],
      target: { kind: "point", x: 18 * 256, y: 17 * 256 },
      payload: { buildingId: "terran-supply-depot" },
    });
    tick(100);
    const b = state.economy.structures.find(
      (b) =>
        state.entities.definitionId[indexOf(state, b.entityId)] ===
        "terran-supply-depot",
    )!;
    expect(b.started).toBe(true);
    issue({ kind: "stop", entityIds: [w] });
    const remaining = b.remainingTicks;
    tick(60);
    expect(b.remainingTicks).toBe(remaining);
    expect(
      issue({
        kind: "resumeConstruction",
        entityIds: [w],
        target: { kind: "entity", entityId: b.entityId },
      }).accepted,
    ).toBe(true);
    tick(600);
    expect(b.completedTick).toBeGreaterThan(0);
    expect(state.players[0].supplyCapHalf).toBe(36);
  });
  it("requires a refinery, harvests gas and keeps depleted gas usable", () => {
    const { state, map, add, issue, tick } = fixture();
    const node = map.resourceNodes.find(
        (n) => n.kind === "gas" && n.baseId === "main-0",
      )!,
      worker = state.economy.workers[0].entityId;
    expect(
      issue({
        kind: "gather",
        entityIds: [worker],
        payload: { resourceId: node.id },
      }).accepted,
    ).toBe(false);
    const id = add("terran-refinery", node.x - 2, node.y - 1);
    structureOf(state, id)!.geyserId = node.id;
    const resource = state.economy.resources.find((r) => r.nodeId === node.id)!;
    resource.amount = 0;
    expect(
      issue({
        kind: "gather",
        entityIds: [worker],
        payload: { resourceId: node.id },
      }).accepted,
    ).toBe(true);
    tick(650);
    expect(state.players[0].gas).toBeGreaterThan(0);
    expect(state.players[0].gas % 2).toBe(0);
  });
  it("blocks unpowered Protoss production and rejects off-creep Zerg placement", () => {
    const p = fixture("protoss");
    p.state.players[0].minerals = 1000;
    const gateway = p.add("protoss-gateway", 18, 17);
    expect(
      p.issue({
        kind: "produce",
        entityIds: [gateway],
        payload: { unitId: "protoss-zealot" },
      }).accepted,
    ).toBe(false);
    p.add("protoss-pylon", 16, 18);
    expect(
      p.issue({
        kind: "produce",
        entityIds: [gateway],
        payload: { unitId: "protoss-zealot" },
      }).accepted,
    ).toBe(true);
    const z = fixture("zerg");
    z.state.players[0].minerals = 1000;
    expect(
      z.issue({
        kind: "placeBuilding",
        entityIds: [z.state.economy.workers[0].entityId],
        target: { kind: "point", x: 21 * 256, y: 21 * 256 },
        payload: { buildingId: "zerg-spawning-pool" },
      }).accepted,
    ).toBe(false);
  });
  it("consumes larva, produces paired Zerglings and never refunds larva on egg cancellation", () => {
    const { state, add, issue, tick } = fixture("zerg");
    state.players[0].minerals = 1000;
    add("zerg-spawning-pool", 17, 16);
    const hq = state.economy.structures[0],
      larva = hq.larva;
    expect(
      issue({
        kind: "produce",
        entityIds: [hq.entityId],
        payload: { unitId: "zerg-zergling" },
      }).accepted,
    ).toBe(true);
    expect(hq.larva).toBe(larva - 1);
    const q = hq.queue[0];
    issue({
      kind: "cancelProduction",
      entityIds: [hq.entityId],
      payload: { queueEntryId: q.id },
    });
    expect(hq.larva).toBe(larva - 1);
    issue({
      kind: "produce",
      entityIds: [hq.entityId],
      payload: { unitId: "zerg-zergling" },
    });
    tick(190);
    expect(
      state.entities.definitionId.filter((id) => id === "zerg-zergling"),
    ).toHaveLength(2);
  });
  it("waits with repeat production intent until funds exist and stops repeat explicitly", () => {
    const { state, issue, tick } = fixture(),
      hq = state.economy.structures[0];
    state.players[0].minerals = 0;
    expect(
      issue({
        kind: "toggleRepeatProduction",
        entityIds: [hq.entityId],
        payload: { unitId: "terran-scv", enabled: true },
      }).accepted,
    ).toBe(true);
    expect(hq.queue).toHaveLength(0);
    tick(650);
    expect(state.economy.workers.length).toBeGreaterThan(8);
    issue({
      kind: "toggleRepeatProduction",
      entityIds: [hq.entityId],
      payload: { unitId: "terran-scv", enabled: false },
    });
    expect(hq.repeatUnitId).toBeNull();
  });
  it("replays identically after saving paid queues, cargo and live harvest locks", () => {
    const { state, map, rules, tick, issue } = fixture();
    tick(180);
    issue({
      kind: "produce",
      entityIds: [state.economy.structures[0].entityId],
      payload: { unitId: "terran-scv" },
    });
    const saved = createPersistenceEnvelope(
        state,
        {
          camera: { centerX: 0, centerY: 0, zoomLevel: 1 },
          selection: { entityIds: [], controlGroupIds: [] },
          openPanel: null,
        },
        [],
        "2026-11-11T00:00:00.000Z",
      ),
      restored = restoreSnapshot(JSON.stringify(saved)).simulation,
      otherRules = createEconomyRules(
        map,
        createMovementRules(map, () => true),
      );
    for (let i = 0; i < 200; i++) {
      stepSimulation(state, rules);
      stepSimulation(restored, otherRules);
    }
    expect(checksum(restored)).toBe(checksum(state));
    const broken = structuredClone(state);
    broken.economy.resources[0].occupiedBy = 999;
    expect(parse(simulationStateSchema, broken).ok).toBe(false);
  });
  it("releases worker locks, queue supply and builder references when an entity is removed", () => {
    const { state, tick } = fixture();
    tick(100);
    const worker =
      state.economy.workers.find((w) => w.task === "harvesting") ??
      state.economy.workers[0];
    removeEntity(state, worker.entityId);
    expect(parse(simulationStateSchema, state).ok).toBe(true);
    expect(
      state.economy.resources.every((r) => r.occupiedBy !== worker.entityId),
    ).toBe(true);
  });
  it("enforces five paid queue slots and keeps a blocked exit job paid until space opens", () => {
    const { state, map, issue, add, tick } = fixture();
    state.players[0].minerals = 10000;
    add("terran-supply-depot", 18, 17);
    const hq = state.economy.structures[0];
    for (let i = 0; i < 5; i++)
      expect(
        issue({
          kind: "produce",
          entityIds: [hq.entityId],
          payload: { unitId: "terran-scv" },
        }).accepted,
      ).toBe(true);
    expect(
      issue({
        kind: "produce",
        entityIds: [hq.entityId],
        payload: { unitId: "terran-scv" },
      }).accepted,
    ).toBe(false);
    expect(hq.queue.length).toBe(5);
    const before = state.players[0].supplyUsedHalf;
    const original = new Uint8Array(map.walkable);
    map.walkable.fill(0);
    for (const w of state.economy.workers) w.autoAllowed = false;
    tick(125);
    expect(hq.queue[0].remainingTicks).toBe(0);
    expect(hq.queue).toHaveLength(5);
    expect(state.players[0].supplyUsedHalf).toBe(before);
    map.walkable.set(original);
    tick(1);
    expect(hq.queue).toHaveLength(4);
  });
  it("serializes research, prevents duplicates and refunds manual cancellation exactly once", () => {
    const { state, add, issue, tick } = fixture();
    const a = add("terran-engineering-bay", 18, 17),
      b = add("terran-engineering-bay", 18, 20);
    state.players[0].minerals = 1000;
    state.players[0].gas = 1000;
    const technologyId = "terran-infantry-weapons";
    expect(
      issue({ kind: "research", entityIds: [a], payload: { technologyId } })
        .accepted,
    ).toBe(true);
    expect(
      issue({ kind: "research", entityIds: [b], payload: { technologyId } })
        .accepted,
    ).toBe(false);
    expect(issue({ kind: "cancelResearch", entityIds: [a] }).accepted).toBe(
      true,
    );
    expect(state.players[0].gas).toBe(1000);
    expect(issue({ kind: "cancelResearch", entityIds: [a] }).accepted).toBe(
      false,
    );
    issue({ kind: "research", entityIds: [a], payload: { technologyId } });
    tick(1670);
    expect(state.economy.upgrades).toContainEqual({
      playerId: 0,
      technologyId,
      level: 1,
    });
    expect(
      issue({ kind: "research", entityIds: [b], payload: { technologyId } })
        .accepted,
    ).toBe(false);
  });
  it("requires an attached Machine Shop for tank production rather than a remote completed addon", () => {
    const { state, add, issue, tick } = fixture();
    state.players[0].minerals = 10000;
    state.players[0].gas = 10000;
    add("terran-supply-depot", 17, 16);
    add("terran-barracks", 6, 16);
    const a = add("terran-factory", 18, 19),
      b = add("terran-factory", 6, 20);
    const unitId = "terran-siege-tank-tank-mode";
    expect(
      issue({ kind: "produce", entityIds: [a], payload: { unitId } }).accepted,
    ).toBe(false);
    expect(
      issue({
        kind: "placeBuilding",
        entityIds: [a],
        target: { kind: "point", x: 0, y: 0 },
        payload: { buildingId: "terran-machine-shop" },
      }).accepted,
    ).toBe(true);
    tick(260);
    expect(
      issue({ kind: "produce", entityIds: [a], payload: { unitId } }).accepted,
    ).toBe(true);
    expect(
      issue({ kind: "produce", entityIds: [b], payload: { unitId } }).accepted,
    ).toBe(false);
  });
  it("keeps automatic workers inside a friendly base region after scouting", () => {
    const { state, issue, tick } = fixture();
    const w = state.economy.workers[0];
    issue({
      kind: "move",
      entityIds: [w.entityId],
      target: { kind: "point", x: 22 * 256, y: 33 * 256 },
    });
    tick(1200);
    issue({ kind: "autoGather", entityIds: [w.entityId] });
    tick(100);
    expect(w.task).toBe("idle");
    expect(w.resourceId).toBeNull();
  });
  it("does not leak enemy balances, queues, workers or unseen resources in render snapshots", async () => {
    const { state, map } = fixture(),
      { createRenderSnapshot } = await import(
        "../../app/stark-rift/worker/render-snapshot"
      );
    const snap = createRenderSnapshot(state, map, 0, new Uint8Array(96 * 96));
    expect(snap.entities.every((e) => e.owner === 0)).toBe(true);
    expect(
      snap.economy?.structures.every((b) =>
        snap.entities.some((e) => e.id === b.entityId && e.owner === 0),
      ),
    ).toBe(true);
    expect(snap.economy?.workers).toHaveLength(4);
    expect(snap.economy?.resources).toEqual([]);
    expect(snap.economy?.creepCells).toEqual([]);
  });

  it.each(["terran", "zerg", "protoss"] as const)(
    "%s builds an expansion headquarters and produces its basic army",
    (f) => {
      const { state, issue, tick, add } = fixture(f);
      state.players[0].minerals = 2000;
      state.players[0].gas = 1000;
      const worker = state.economy.workers[0].entityId;
      const production =
          f === "terran"
            ? "terran-barracks"
            : f === "zerg"
              ? "zerg-spawning-pool"
              : "protoss-gateway",
        unit =
          f === "terran"
            ? "terran-marine"
            : f === "zerg"
              ? "zerg-zergling"
              : "protoss-zealot";
      if (f === "terran") add("terran-supply-depot", 18, 17);
      if (f === "protoss") add("protoss-pylon", 17, 18);
      const producer = add(production, 19, 20),
        hq = state.economy.structures[0].entityId;
      expect(
        issue({
          kind: "produce",
          entityIds: [f === "zerg" ? hq : producer],
          payload: { unitId: unit },
        }).accepted,
      ).toBe(true);
      tick(260);
      expect(state.entities.definitionId.some((id) => id === unit)).toBe(true);
      const wid = state.economy.workers.find(
        (w) => state.entities.owner[indexOf(state, w.entityId)] === 0,
      )!.entityId;
      expect(
        issue({
          kind: "move",
          entityIds: [wid],
          target: { kind: "point", x: 22 * 256, y: 33 * 256 },
        }).accepted,
      ).toBe(true);
      tick(500);
      expect(
        issue({
          kind: "placeBuilding",
          entityIds: [wid],
          target: { kind: "point", x: 22 * 256, y: 33 * 256 },
          payload: {
            buildingId:
              f === "terran"
                ? "terran-command-center"
                : f === "zerg"
                  ? "zerg-hatchery"
                  : "protoss-nexus",
          },
        }).accepted,
      ).toBe(true);
      tick(1200);
      expect(
        state.economy.structures.filter(
          (b) =>
            b.completedTick >= 0 &&
            state.entities.owner[indexOf(state, b.entityId)] === 0 &&
            economyDefinition(
              state.entities.definitionId[indexOf(state, b.entityId)],
            )?.headquarters,
        ),
      ).toHaveLength(2);
    },
  );
  it("conserves minerals across stock, worker cargo and both player balances", () => {
    const { state, map, tick } = fixture();
    const sum = () =>
      state.players.reduce((n, p) => n + p.minerals, 0) +
      state.economy.workers.reduce((n, w) => n + w.cargoMinerals, 0) +
      state.economy.resources.reduce(
        (n, r) =>
          n +
          (map.resourceNodes.find((node) => node.id === r.nodeId)?.kind ===
          "mineral"
            ? r.amount
            : 0),
        0,
      );
    const initial = sum();
    tick(1200);
    expect(sum()).toBe(initial);
  });
  it("restores creep tie-breaking RNG and larva clocks deterministically", () => {
    const { state, map, tick, add } = fixture("zerg");
    add("zerg-creep-colony", 18, 17);
    tick(30);
    const before = structuredClone(
        state.rngStreams.find((r) => r.id === "map")!.words,
      ),
      saved = structuredClone(state),
      rules = createEconomyRules(
        map,
        createMovementRules(map, () => true),
      );
    tick(100);
    for (let i = 0; i < 100; i++) stepSimulation(saved, rules);
    expect(state.rngStreams.find((r) => r.id === "map")!.words).not.toEqual(
      before,
    );
    expect(checksum(saved)).toBe(checksum(state));
  });
  it.each(["terran", "protoss"] as const)(
    "%s completes continuous placements in order without abandoning the first building",
    (f) => {
      const { state, issue, tick } = fixture(f);
      state.players[0].minerals = 2000;
      const w = state.economy.workers[0],
        buildingId = f === "terran" ? "terran-supply-depot" : "protoss-pylon";
      for (const [x, y] of [
        [18, 17],
        [21, 19],
      ])
        expect(
          issue({
            kind: "placeBuilding",
            entityIds: [w.entityId],
            target: { kind: "point", x: x * 256, y: y * 256 },
            payload: { buildingId, queued: true },
          }).accepted,
        ).toBe(true);
      expect(w.buildQueue).toHaveLength(1);
      tick(1000);
      expect(
        state.economy.structures.filter(
          (b) =>
            b.completedTick >= 0 &&
            state.entities.definitionId[indexOf(state, b.entityId)] ===
              buildingId &&
            state.entities.owner[indexOf(state, b.entityId)] === 0,
        ),
      ).toHaveLength(2);
      expect(w.buildQueue).toHaveLength(0);
    },
  );
  it("cancels one queued blueprint without interrupting the active SCV construction", () => {
    const { state, issue, tick } = fixture();
    state.players[0].minerals = 1000;
    const w = state.economy.workers[0],
      payload = { buildingId: "terran-supply-depot", queued: true };
    issue({
      kind: "placeBuilding",
      entityIds: [w.entityId],
      target: { kind: "point", x: 18 * 256, y: 17 * 256 },
      payload,
    });
    tick(90);
    const active = w.buildingId;
    issue({
      kind: "placeBuilding",
      entityIds: [w.entityId],
      target: { kind: "point", x: 21 * 256, y: 19 * 256 },
      payload,
    });
    const queued = w.buildQueue[0];
    expect(
      issue({ kind: "cancelConstruction", entityIds: [queued] }).accepted,
    ).toBe(true);
    expect(w.buildingId).toBe(active);
    expect(w.task).toBe("constructing");
    tick(400);
    expect(structureOf(state, active!)?.completedTick).toBeGreaterThan(0);
  });
});
