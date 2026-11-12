import { ECONOMY_DATA_VERSION, LEGACY_ECONOMY_DATA_VERSION } from "../../app/stark-rift/data/economy-catalog";
import { describe, it, expect, vi } from "vitest";
import { getRuntimeMap, type BattleMap } from "../../app/stark-rift/data/maps";
import {
  startSimulation,
  stepSimulation,
  enqueueCommand,
} from "../../app/stark-rift/core/simulation";
import {
  initializeEconomy,
  createEconomicEntity,
  indexOf,
  newStructure,
  recomputeSupply,
  workerOf,
} from "../../app/stark-rift/economy/helpers";
import {
  economyDefinition,
  type Faction,
} from "../../app/stark-rift/data/economy-catalog";
import {
  initializeCombat,
  synchronizeCombat,
  createCombatRules,
  combatReach,
} from "../../app/stark-rift/combat/rules";
import { createEconomyRules } from "../../app/stark-rift/economy/rules";
import { createMovementRules } from "../../app/stark-rift/core/movement-rules";
import {
  createVisionRules,
  initializeVision,
  visibilityMask,
  canSeeEntity,
  updateVision,
  terrainSight,
  uphillAttack,
  headquartersOutcome,
  visionFitsMap,
} from "../../app/stark-rift/vision/rules";
import {
  createRenderSnapshot,
  validateRenderSnapshot,
} from "../../app/stark-rift/worker/render-snapshot";
import { removeEntity } from "../../app/stark-rift/core/world";
import {
  createPersistenceEnvelope,
  restoreSnapshot,
  validatePersistenceEnvelope,
} from "../../app/stark-rift/core/state";
import { checksum } from "../../app/stark-rift/core/checksum";
import {
  DevelopmentSaveStore,
  DEVELOPMENT_SAVE_PREFIX,
} from "../../app/stark-rift/ui/development-saves";
import { RANGED_COMBAT_RULES_VERSION } from "../../app/stark-rift/combat/state";
import type { GameCommand } from "../../app/stark-rift/core/commands";
vi.setConfig({ testTimeout: 30000 });
const session = {
  camera: { centerX: 22 * 256, centerY: 29 * 256, zoomLevel: 1 as const },
  selection: { entityIds: [], controlGroupIds: [] },
  openPanel: null,
};
function fixture(
  race: Faction = "terran",
  enemy: Faction = "zerg",
  mutate?: (map: BattleMap) => void,
) {
  const { map, dataVersion } = getRuntimeMap("rift-basin");
  mutate?.(map);
  const state = startSimulation(
    42,
    map.id,
    dataVersion,
    [0, 1].map((id) => ({
      id,
      faction: id === 0 ? race : enemy,
      minerals: 50,
      gas: 0,
      supplyUsedHalf: 0,
      supplyCapHalf: 0,
    })),
  );
  initializeEconomy(state, map);
  initializeCombat(state);
  initializeVision(state, map);
  const visible = (s: typeof state, viewer: number, i: number) =>
    canSeeEntity(s, map, viewer, i);
  const rules = createVisionRules(
    map,
    createCombatRules(
      createEconomyRules(map, createMovementRules(map, visible, combatReach)),
      visible,
      map,
    ),
  );
  const add = (owner: number, definition: string, x: number, y: number) => {
    const id = createEconomicEntity(
      state,
      owner,
      economyDefinition(definition)!,
      { x: x * 256, y: y * 256 },
    );
    const w = workerOf(state, id);
    if (w) w.autoAllowed = false;
    synchronizeCombat(state);
    recomputeSupply(state);
    return id;
  };
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) stepSimulation(state, rules);
  };
  const issue = (body: object) => {
    const command = {
      ...body,
      issuedTick: state.tick,
      executeTick: state.tick + 1,
      sequence: state.commandState.lastAcceptedSequenceByPlayer[0] + 1,
      playerId: 0,
      source: "player",
    } as GameCommand;
    expect(enqueueCommand(state, command, rules)).toEqual({ ok: true });
    return stepSimulation(state, rules)[0];
  };
  return { map, state, rules, add, tick, issue };
}
describe("persistent fog and observed intelligence", () => {
  it("separates black, current and explored terrain and removes vision from dead scouts immediately", () => {
    const f = fixture(),
      scout = f.add(0, "terran-marine", 40, 40);
    updateVision(f.state, f.map);
    expect(visibilityMask(f.state, f.map, 0)[40 * 96 + 40]).toBe(2);
    expect(visibilityMask(f.state, f.map, 0)[70 * 96 + 40]).toBe(0);
    removeEntity(f.state, scout);
    f.tick();
    expect(visibilityMask(f.state, f.map, 0)[40 * 96 + 40]).toBe(1);
  });
  it("keeps a fixed enemy unit marker for 600 ticks without tracking hidden movement", () => {
    const f = fixture(),
      scout = f.add(0, "terran-marine", 40, 40),
      enemy = f.add(1, "zerg-drone", 42, 40);
    updateVision(f.state, f.map);
    removeEntity(f.state, scout);
    f.state.entities.x[indexOf(f.state, enemy)] = 60 * 256;
    f.tick();
    let view = createRenderSnapshot(
      f.state,
      f.map,
      0,
      visibilityMask(f.state, f.map, 0),
    );
    expect(view.entities.some((e) => e.id === enemy)).toBe(false);
    expect(view.scouting!.contacts.find((c) => c.entityId === enemy)?.x).toBe(
      42 * 256,
    );
    f.state.tick = 599;
    updateVision(f.state, f.map);
    expect(
      f.state.vision!.players[0].contacts.some((c) => c.entityId === enemy),
    ).toBe(true);
    f.state.tick = 600;
    updateVision(f.state, f.map);
    expect(
      f.state.vision!.players[0].contacts.some((c) => c.entityId === enemy),
    ).toBe(false);
  });
  it("remembers a building destroyed outside sight until its old footprint is scouted again", () => {
    const f = fixture(),
      scout = f.add(0, "terran-marine", 40, 40),
      d = economyDefinition("zerg-hatchery")!,
      id = f.add(1, d.id, 43, 40);
    f.state.economy.structures.push(newStructure(id, d, 41, 38.5, true, 0));
    // Use integral tile placement for a valid construction footprint.
    const b = f.state.economy.structures.at(-1)!;
    b.tileY = 39;
    f.state.entities.y[indexOf(f.state, id)] = (39 + d.height / 2) * 256;
    updateVision(f.state, f.map);
    removeEntity(f.state, scout);
    removeEntity(f.state, id);
    updateVision(f.state, f.map);
    expect(
      f.state.vision!.players[0].contacts.some((c) => c.entityId === id),
    ).toBe(true);
    f.state.tick = 1000;
    updateVision(f.state, f.map);
    expect(
      f.state.vision!.players[0].contacts.some((c) => c.entityId === id),
    ).toBe(true);
    f.add(0, "terran-marine", 43, 40);
    updateVision(f.state, f.map);
    expect(
      f.state.vision!.players[0].contacts.some((c) => c.entityId === id),
    ).toBe(false);
  });
  it("never changes a remembered resource amount until it is observed again", () => {
    const f = fixture(),
      n = f.map.resourceNodes.find(
        (n) => n.baseId === "natural-0" && n.kind === "mineral",
      )!,
      scout = f.add(0, "terran-marine", n.x, n.y + 2);
    updateVision(f.state, f.map);
    removeEntity(f.state, scout);
    f.state.economy.resources.find((r) => r.nodeId === n.id)!.amount = 0;
    updateVision(f.state, f.map);
    let view = createRenderSnapshot(
      f.state,
      f.map,
      0,
      visibilityMask(f.state, f.map, 0),
    );
    expect(view.economy!.resources.find((r) => r.nodeId === n.id)?.amount).toBe(
      1500,
    );
    f.add(0, "terran-marine", n.x, n.y + 2);
    updateVision(f.state, f.map);
    view = createRenderSnapshot(
      f.state,
      f.map,
      0,
      visibilityMask(f.state, f.map, 0),
    );
    expect(view.economy!.resources.find((r) => r.nodeId === n.id)?.amount).toBe(
      0,
    );
  });
  it("does not allow historical ghost targets to be focused or selected as live entities", () => {
    const f = fixture(),
      scout = f.add(0, "terran-marine", 40, 40),
      enemy = f.add(1, "zerg-drone", 42, 40);
    updateVision(f.state, f.map);
    f.state.entities.x[indexOf(f.state, scout)] = 20 * 256;
    f.state.entities.y[indexOf(f.state, scout)] = 20 * 256;
    updateVision(f.state, f.map);
    const view = createRenderSnapshot(
      f.state,
      f.map,
      0,
      visibilityMask(f.state, f.map, 0),
    );
    expect(view.scouting!.contacts.some((c) => c.entityId === enemy)).toBe(
      true,
    );
    expect(view.entities.some((e) => e.id === enemy)).toBe(false);
    expect(
      f.issue({
        kind: "focusAttack",
        entityIds: [scout],
        target: { kind: "entity", entityId: enemy },
      }).accepted,
    ).toBe(false);
  });
  it("renders a partly seen building consistently even when the center is outside current sight", () => {
    const f = fixture(),
      d = economyDefinition("zerg-hatchery")!,
      enemy = f.add(1, d.id, 24, 14);
    f.state.economy.structures.push(newStructure(enemy, d, 22, 12.5, true, 0));
    const b = f.state.economy.structures.at(-1)!;
    b.tileY = 13;
    f.state.entities.y[indexOf(f.state, enemy)] = (13 + d.height / 2) * 256;
    const mask = new Uint8Array(96 * 96);
    mask[13 * 96 + 22] = 2;
    const view = createRenderSnapshot(f.state, f.map, 0, mask);
    expect(view.entities.some((e) => e.id === enemy)).toBe(true);
    expect(validateRenderSnapshot(view).ok).toBe(true);
  });
});
describe("height and concealed target rules", () => {
  it("shows the first high edge, blocks cells behind it from low ground, and allows air sight", () => {
    const f = fixture("terran", "zerg", (map) => {
      map.height.fill(0);
      for (let y = 0; y < 96; y++)
        for (let x = 42; x < 46; x++) map.height[y * 96 + x] = 1;
    });
    expect(terrainSight(f.map, 40, 40, 42, 40)).toBe(true);
    expect(terrainSight(f.map, 40, 40, 43, 40)).toBe(false);
    expect(terrainSight(f.map, 40, 40, 43, 40, true)).toBe(true);
  });
  it("requires a live Overlord detector as well as current sight for cloaked and burrowed targets", () => {
    const f = fixture("zerg"),
      scout = f.add(0, "zerg-hydralisk", 40, 40),
      enemy = f.add(1, "zerg-drone", 42, 40);
    f.state.economy.upgrades.push({ playerId: 1, technologyId: "burrowing", level: 1 });
    f.state.vision!.concealed.push({ entityId: enemy, kind: "burrow" });
    updateVision(f.state, f.map);
    expect(canSeeEntity(f.state, f.map, 0, indexOf(f.state, enemy))).toBe(
      false,
    );
    expect(
      createRenderSnapshot(
        f.state,
        f.map,
        0,
        visibilityMask(f.state, f.map, 0),
      ).entities.some((e) => e.id === enemy),
    ).toBe(false);
    expect(
      f.issue({
        kind: "focusAttack",
        entityIds: [scout],
        target: { kind: "entity", entityId: enemy },
      }).accepted,
    ).toBe(false);
    const detector = f.add(0, "zerg-overlord", 40, 42);
    updateVision(f.state, f.map);
    expect(canSeeEntity(f.state, f.map, 0, indexOf(f.state, enemy))).toBe(true);
    removeEntity(f.state, detector);
    updateVision(f.state, f.map);
    expect(canSeeEntity(f.state, f.map, 0, indexOf(f.state, enemy))).toBe(
      false,
    );
  });
  it("uses saved combat RNG for uphill ranged misses and removes the penalty with allied high or air vision", () => {
    const f = fixture("terran", "zerg", (map) => {
      map.height.fill(0);
      for (let y = 0; y < 96; y++) map.height[y * 96 + 42] = 1;
    });
    const a = f.add(0, "terran-marine", 40, 40),
      b = f.add(1, "zerg-drone", 42, 40);
    expect(
      uphillAttack(f.state, f.map, indexOf(f.state, a), indexOf(f.state, b)),
    ).toBe(true);
    const before = checksum(f.state.rngStreams.find((r) => r.id === "combat"));
    f.tick();
    expect(
      checksum(f.state.rngStreams.find((r) => r.id === "combat")),
    ).not.toBe(before);
    // Friendly ground on the target plateau supplies high-ground sight.
    f.add(0, "terran-marine", 42, 42);
    expect(
      uphillAttack(f.state, f.map, indexOf(f.state, a), indexOf(f.state, b)),
    ).toBe(false);
  });
});
describe("headquarters outcome and practical mission", () => {
  it("counts started incomplete headquarters, ignores unstarted blueprints, and does not count other surviving units", () => {
    const f = fixture(),
      hq = f.state.economy.structures.find(
        (b) => f.state.entities.owner[indexOf(f.state, b.entityId)] === 1,
      )!;
    hq.completedTick = -1;
    hq.remainingTicks = 10;
    headquartersOutcome(f.state);
    expect(f.state.phase).toBe("running");
    hq.started = false;
    headquartersOutcome(f.state);
    expect(f.state.phase).toBe("finished");
    expect(f.state.outcome?.winnerPlayerId).toBe(0);
    expect(f.state.entities.owner.some((o) => o === 1)).toBe(true);
  });
  it("resolves same-tick destruction of the last two headquarters as a draw and clears queued commands", () => {
    const f = fixture();
    for (const b of [...f.state.economy.structures])
      removeEntity(f.state, b.entityId);
    headquartersOutcome(f.state);
    expect(f.state.outcome).toMatchObject({
      kind: "draw",
      winnerPlayerId: null,
    });
    expect(f.state.commandState.pending).toEqual([]);
  });
  it("records surrender and supports a checked finished save without resuming it", () => {
    const f = fixture();
    f.issue({ kind: "surrender", entityIds: [] });
    expect(f.state.outcome).toMatchObject({
      kind: "surrender",
      winnerPlayerId: 1,
    });
    const saved = createPersistenceEnvelope(
      f.state,
      session,
      [],
      new Date().toISOString(),
    );
    const records = new Map<string, string>();
    const store = new DevelopmentSaveStore({
      getItem: (k) => records.get(k) ?? null,
      setItem: (k, v) => {
        records.set(k, v);
      },
    });
    expect(store.write(saved)).toBe(true);
    expect(store.read("terran").status).toBe("ready");
    expect(restoreSnapshot(JSON.stringify(saved)).simulation.phase).toBe(
      "finished",
    );
  });
  it.each(["terran", "zerg", "protoss"] as const)(
    "%s wins the mission by scouting and destroying a real stopped headquarters",
    (race) => {
      const f = fixture(race, "terran");
      initializeCombat(f.state, "siege-practice");
      initializeVision(f.state, f.map);
      expect(
        validatePersistenceEnvelope(
          createPersistenceEnvelope(
            f.state,
            session,
            [],
            new Date().toISOString(),
          ),
        ).ok,
      ).toBe(true);
      const target = f.state.combat!.targetIds[0];
      expect(
        createRenderSnapshot(
          f.state,
          f.map,
          0,
          visibilityMask(f.state, f.map, 0),
        ).entities.some((e) => e.id === target),
      ).toBe(false);
      f.issue({
        kind: "attackMove",
        entityIds: f.state.combat!.friendlyIds,
        target: { kind: "point", x: 22 * 256, y: 29 * 256 },
      });
      for (let i = 0; i < 1600 && f.state.phase === "running"; i++) f.tick();
      expect(f.state.phase).toBe("finished");
      expect(f.state.outcome?.winnerPlayerId).toBe(0);
      expect(f.state.entities.id).not.toContain(target);
    },
  );
});
describe("fog and in-flight save compatibility", () => {
  it("restores explored terrain, non-live contacts and pending RNG decisions deterministically", () => {
    const f = fixture(),
      a = f.add(0, "terran-marine", 40, 40);
    f.add(1, "zerg-drone", 42, 40);
    updateVision(f.state, f.map);
    removeEntity(f.state, a);
    f.tick();
    const saved = createPersistenceEnvelope(
        f.state,
        session,
        [],
        new Date().toISOString(),
      ),
      copy = restoreSnapshot(JSON.stringify(saved)).simulation;
    for (let i = 0; i < 10; i++) {
      f.tick();
      stepSimulation(copy, f.rules);
    }
    expect(checksum(copy)).toBe(checksum(f.state));
    expect(visionFitsMap(copy, f.map)).toBe(true);
  });
  it("migrates a checked 5B flight without retroactively changing its hit and backs up the original record", () => {
    const f = fixture();
    f.add(0, "terran-vulture", 18, 18);
    f.add(1, "zerg-drone", 21, 18);
    f.tick();
    delete f.state.vision;
    const current = createPersistenceEnvelope(
        f.state,
        session,
        [],
        new Date().toISOString(),
      ),
      old = JSON.parse(JSON.stringify(current));
    old.formatVersion = old.simulation.schemaVersion = 8;
    old.engineVersion = old.simulation.engineVersion = "0.9.0-stage5b";
    old.simulation.combat.rulesVersion = RANGED_COMBAT_RULES_VERSION;
    for (const r of old.simulation.combat.records) delete r.lastSeenTarget;
    for (const p of old.simulation.combat.projectiles) delete p.miss;
    old.dataVersion = old.simulation.dataVersion = old.dataVersion.replace(ECONOMY_DATA_VERSION, LEGACY_ECONOMY_DATA_VERSION);
    if (old.simulation.vision) old.simulation.vision.rulesVersion = "fog-1-los-edge-detector11-memory600";
    old.checksum = checksum(old.simulation);
    const raw = JSON.stringify(old),
      key = DEVELOPMENT_SAVE_PREFIX + "terran",
      records = new Map([[key, raw]]),
      store = new DevelopmentSaveStore({
        getItem: (k) => records.get(k) ?? null,
        setItem: (k, v) => {
          records.set(k, v);
        },
      });
    const read = store.read("terran");
    expect(read.status).toBe("ready");
    if (read.status !== "ready") throw Error();
    expect(read.snapshot.simulation.combat!.projectiles).toHaveLength(1);
    expect(read.snapshot.simulation.combat!.projectiles[0].miss).toBe(false);
    expect(store.write(read.snapshot)).toBe(true);
    expect(records.get(key + ".stage5b-backup")).toBe(raw);
    expect(
      read.snapshot.simulation.combat!.records.every(
        (r) => r.lastSeenTarget === null,
      ),
    ).toBe(true);
  });
});

describe("terminal outcomes and observation boundaries", () => {
  it("declares defeat when only the human headquarters is lost", () => {
    const f = fixture(),
      ownHQ = f.state.economy.structures.find(
        (b) => f.state.entities.owner[indexOf(f.state, b.entityId)] === 0,
      )!;
    removeEntity(f.state, ownHQ.entityId);
    headquartersOutcome(f.state);
    expect(f.state.outcome?.winnerPlayerId).toBe(1);
    expect(f.state.phase).toBe("finished");
  });
  it("collects attacks before resolving simultaneous lethal headquarters damage", () => {
    const f = fixture(),
      own = f.state.economy.structures.find(
        (b) => f.state.entities.owner[indexOf(f.state, b.entityId)] === 0,
      )!,
      enemy = f.state.economy.structures.find(
        (b) => f.state.entities.owner[indexOf(f.state, b.entityId)] === 1,
      )!;
    // Existing enemy race is zerg, so use a ranged unit belonging to that race.
    const a = f.add(0, "terran-marine", 78, 81),
      b = f.add(1, "zerg-hydralisk", 17, 14);
    f.state.entities.health[indexOf(f.state, own.entityId)] = 9;
    f.state.entities.health[indexOf(f.state, enemy.entityId)] = 5;
    for (const [playerId, entityId, target] of [
      [0, a, enemy.entityId],
      [1, b, own.entityId],
    ]) {
      const command: GameCommand = {
        kind: "focusAttack",
        entityIds: [entityId],
        target: { kind: "entity", entityId: target },
        sequence: 1,
        playerId,
        issuedTick: 0,
        executeTick: 1,
        source: playerId === 0 ? "player" : "ai",
      };
      expect(enqueueCommand(f.state, command, f.rules)).toEqual({ ok: true });
    }
    f.tick();
    expect(f.state.outcome).toMatchObject({
      kind: "draw",
      winnerPlayerId: null,
    });
  });
  it("retains the most recent visible target position when concealment ends focus pursuit", () => {
    const f = fixture("terran", "terran"),
      a = f.add(0, "terran-marine", 40, 40),
      b = f.add(1, "terran-ghost", 42, 40);
    f.issue({
      kind: "focusAttack",
      entityIds: [a],
      target: { kind: "entity", entityId: b },
    });
    f.state.entities.x[indexOf(f.state, b)] += 90;
    f.tick();
    const last = {
      x: f.state.entities.x[indexOf(f.state, b)],
      y: f.state.entities.y[indexOf(f.state, b)],
    };
    expect(
      f.state.combat!.records.find((r) => r.entityId === a)!.lastSeenTarget,
    ).toEqual(last);
    f.state.economy.upgrades.push({ playerId: 1, technologyId: "personnel-cloaking", level: 1 });
    f.state.vision!.concealed.push({ entityId: b, kind: "cloak" });
    f.state.entities.x[indexOf(f.state, b)] += 100;
    f.tick();
    expect(f.state.movement[indexOf(f.state, a)].targetEntityId).toBeNull();
    expect(
      f.state.combat!.records.find((r) => r.entityId === a)!.lastSeenTarget,
    ).toEqual(last);
  });
});

import { SimulationRuntime } from "../../app/stark-rift/worker/runtime";
import { SCENARIOS } from "../../app/stark-rift/combat/state";
import { STARK_RIFT_PROTOCOL_VERSION } from "../../app/stark-rift/core/versions";
import type { WorkerToMainMessage } from "../../app/stark-rift/worker/messages";
describe("production protocol supports every selectable scenario", () => {
  for (const scenario of SCENARIOS)
    it.each(["terran", "zerg", "protoss"] as const)(
      scenario + " %s publishes a checked initial snapshot",
      (race) => {
        const messages: WorkerToMainMessage[] = [],
          runtime = new SimulationRuntime({ emit: (m) => messages.push(m) }),
          registered = getRuntimeMap("rift-basin");
        runtime.receive({
          messageId: 1,
          protocolVersion: STARK_RIFT_PROTOCOL_VERSION,
          kind: "init",
          payload: {
            mapId: "rift-basin",
            dataVersion: registered.dataVersion,
            seed: 42,
            scenario,
            players: [
              { id: 0, faction: race, controller: "human" },
              {
                id: 1,
                faction: scenario === "siege-practice" ? "terran" : "zerg",
                controller: "ai",
              },
            ],
          },
        });
        expect(messages.filter((m) => m.kind === "fatalError")).toEqual([]);
        const rendered = messages.find((m) => m.kind === "renderSnapshot");
        expect(
          rendered?.kind === "renderSnapshot" &&
            rendered.payload.combat?.scenario,
        ).toBe(scenario);
      },
    );
});
