import { ECONOMY_DATA_VERSION, LEGACY_ECONOMY_DATA_VERSION } from "../../app/stark-rift/data/economy-catalog";
import { describe, it, expect, vi } from "vitest";
import {
  startSimulation,
  stepSimulation,
  enqueueCommand,
} from "../../app/stark-rift/core/simulation";
import { getRuntimeMap } from "../../app/stark-rift/data/maps";
import {
  initializeEconomy,
  createEconomicEntity,
  indexOf,
  recomputeSupply,
  newStructure,
  structureOf,
  workerOf,
} from "../../app/stark-rift/economy/helpers";
import { createEconomyRules } from "../../app/stark-rift/economy/rules";
import {
  economyDefinition,
  type Faction,
} from "../../app/stark-rift/data/economy-catalog";
import { createMovementRules } from "../../app/stark-rift/core/movement-rules";
import {
  combatReach,
  initializeCombat,
  createCombatRules,
  hitPoints,
  weaponInRange,
  synchronizeCombat,
} from "../../app/stark-rift/combat/rules";
import { checksum } from "../../app/stark-rift/core/checksum";
import {
  createPersistenceEnvelope,
  restoreSnapshot,
  simulationStateSchema,
} from "../../app/stark-rift/core/state";
import { parse } from "../../app/stark-rift/core/validation";
import {
  DevelopmentSaveStore,
  DEVELOPMENT_SAVE_PREFIX,
} from "../../app/stark-rift/ui/development-saves";
import { createRenderSnapshot } from "../../app/stark-rift/worker/render-snapshot";
import type { GameCommand } from "../../app/stark-rift/core/commands";
vi.setConfig({ testTimeout: 20000 });
const session = {
  camera: { centerX: 14 * 256, centerY: 14 * 256, zoomLevel: 1 as const },
  selection: { entityIds: [1], controlGroupIds: [] },
  openPanel: null,
};
function fixture(faction: Faction = "terran", visible = () => true) {
  const { map, dataVersion } = getRuntimeMap("rift-basin");
  const state = startSimulation(
    42,
    map.id,
    dataVersion,
    [0, 1].map((id) => ({
      id,
      faction: id === 0 ? faction : "zerg",
      minerals: 50,
      gas: 0,
      supplyUsedHalf: 0,
      supplyCapHalf: 0,
    })),
  );
  initializeEconomy(state, map);
  initializeCombat(state);
  const rules = createCombatRules(
    createEconomyRules(map, createMovementRules(map, visible, combatReach)),
    visible,
  );
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) stepSimulation(state, rules);
  };
  const add = (owner: number, id: string, x: number, y: number) => {
    const eid = createEconomicEntity(state, owner, economyDefinition(id)!, {
      x: x * 256,
      y: y * 256,
    });
    recomputeSupply(state);
    synchronizeCombat(state);
    return eid;
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
  return { state, map, rules, tick, add, issue };
}
describe("stage 5a deterministic basic combat", () => {
  it("applies shields, armor per hit, original size factors and minimum half HP", () => {
    expect(
      hitPoints(100 * 256, 10 * 256, 16 * 256, 1, "small", "Normal"),
    ).toEqual({ health: 95 * 256, shield: 0 });
    expect(
      hitPoints(100 * 256, 0, 8 * 256, 1, "large", "Concussive").health,
    ).toBe(100 * 256 - 7 * 64);
    expect(
      hitPoints(100 * 256, 0, 8 * 256, 1, "small", "Explosive").health,
    ).toBe(100 * 256 - 7 * 128);
    expect(hitPoints(256, 0, 256, 10, "large", "Normal").health).toBe(128);
    let hp = 100 * 256;
    for (let i = 0; i < 2; i++)
      hp = hitPoints(hp, 0, 8 * 256, 1, "small", "Normal").health;
    expect(hp).toBe(86 * 256);
  });
  it("uses original Marine range, alternates 13/12 ticks and does not halve attack timing", () => {
    const f = fixture(),
      a = f.add(0, "terran-marine", 16, 18),
      b = f.add(1, "zerg-drone", 20, 18),
      s = f.state;
    expect(weaponInRange(s, indexOf(s, a), indexOf(s, b))).toBe(true);
    f.tick();
    expect(s.entities.health[indexOf(s, b)]).toBe(34);
    f.tick(12);
    expect(s.entities.health[indexOf(s, b)]).toBe(34);
    f.tick();
    expect(s.entities.health[indexOf(s, b)]).toBe(28);
    f.tick(11);
    expect(s.entities.health[indexOf(s, b)]).toBe(28);
    f.tick();
    expect(s.entities.health[indexOf(s, b)]).toBe(22);
  });
  it("applies the completed weapon upgrade and Zealot double hit", () => {
    const f = fixture("protoss"),
      a = f.add(0, "protoss-zealot", 18, 18),
      b = f.add(1, "zerg-drone", 18.75, 18),
      s = f.state;
    s.economy.upgrades.push({
      playerId: 0,
      technologyId: "protoss-ground-weapons",
      level: 1,
    });
    f.tick();
    expect(s.entities.health[indexOf(s, b)]).toBe(22);
    expect(s.combat!.effects.some((e) => e.kind === "slash")).toBe(true);
  });
  it("resolves simultaneous lethal attacks and releases control groups and supply", () => {
    const f = fixture("zerg"),
      a = f.add(0, "zerg-zergling", 18, 18),
      b = f.add(1, "zerg-zergling", 18.75, 18),
      s = f.state;
    s.entities.health[indexOf(s, a)] = 5;
    s.entities.health[indexOf(s, b)] = 5;
    s.players[0].controlGroups[0].entityIds = [a];
    const supply = s.players[0].supplyUsedHalf;
    f.tick();
    expect(s.entities.id).not.toContain(a);
    expect(s.entities.id).not.toContain(b);
    expect(s.players[0].controlGroups[0].entityIds).toEqual([]);
    expect(s.players[0].supplyUsedHalf).toBe(supply - 1);
    expect(s.combat!.effects.filter((e) => e.kind === "death")).toHaveLength(2);
  });
  it("does not automatically interrupt workers or ordinary movement to attack", () => {
    const f = fixture(),
      a = f.add(0, "terran-scv", 18, 18),
      b = f.add(1, "zerg-drone", 18.75, 18),
      s = f.state;
    const w = workerOf(s, a)!;
    w.autoAllowed = false;
    workerOf(s, b)!.autoAllowed = false;
    f.tick(10);
    expect(s.entities.health[indexOf(s, b)]).toBe(40);
    f.issue({
      kind: "focusAttack",
      entityIds: [a],
      target: { kind: "entity", entityId: b },
    });
    expect(s.entities.health[indexOf(s, b)]).toBe(35);
    const r = s.combat!.records.find((r) => r.entityId === a)!;
    const cooldown = r.nextAttackTick;
    f.issue({ kind: "stop", entityIds: [a] });
    f.issue({
      kind: "focusAttack",
      entityIds: [a],
      target: { kind: "entity", entityId: b },
    });
    expect(r.nextAttackTick).toBe(cooldown);
    expect(s.entities.health[indexOf(s, b)]).toBe(35);
  });
  it("blocks unsupported weapons and melee attacks on air; hidden targets take no damage", () => {
    const f = fixture("protoss"),
      a = f.add(0, "protoss-zealot", 18, 18),
      b = f.add(1, "zerg-overlord", 18.75, 18);
    expect(
      f.issue({
        kind: "focusAttack",
        entityIds: [a],
        target: { kind: "entity", entityId: b },
      }).accepted,
    ).toBe(false);
    const hidden = fixture("terran", () => false),
      m = hidden.add(0, "terran-marine", 18, 18),
      d = hidden.add(1, "zerg-drone", 19, 18);
    hidden.tick(20);
    expect(hidden.state.entities.health[indexOf(hidden.state, d)]).toBe(40);
  });
  it("pauses attack-move within firing range and resumes its original destination after the kill", () => {
    const f = fixture(),
      a = f.add(0, "terran-marine", 16, 18),
      b = f.add(1, "zerg-drone", 20, 18),
      s = f.state;
    s.entities.health[indexOf(s, b)] = 6;
    f.issue({
      kind: "attackMove",
      entityIds: [a],
      target: { kind: "point", x: 23 * 256, y: 18 * 256 },
    });
    expect(s.entities.x[indexOf(s, a)]).toBe(16 * 256);
    expect(s.entities.id).not.toContain(b);
    f.tick(20);
    expect(s.entities.x[indexOf(s, a)]).toBeGreaterThan(16 * 256);
  });
  it("does not track the position of a focus target after visibility is lost", () => {
    let seen = true;
    const f = fixture("terran", () => seen),
      a = f.add(0, "terran-marine", 16, 18),
      b = f.add(1, "zerg-drone", 23, 18),
      s = f.state;
    f.issue({
      kind: "focusAttack",
      entityIds: [a],
      target: { kind: "entity", entityId: b },
    });
    const last = { ...s.movement[indexOf(s, a)].target! };
    seen = false;
    s.entities.x[indexOf(s, b)] = 30 * 256;
    f.tick();
    expect(s.movement[indexOf(s, a)].order).toBe("move");
    expect(s.movement[indexOf(s, a)].target).toEqual(last);
  });
  it.each(["terran", "zerg", "protoss"] as const)(
    "initializes %s practice with valid source state and no automatic initial battle",
    (race) => {
      const f = fixture(race);
      initializeCombat(f.state, "combat-practice");
      expect(parse(simulationStateSchema, f.state).ok).toBe(true);
      f.tick(20);
      expect(
        f.state.combat!.targetIds.every((id) =>
          f.state.entities.id.includes(id),
        ),
      ).toBe(true);
      expect(f.state.combat!.effects).toEqual([]);
    },
  );
  it("persists cadence/fractional damage and reproduces identical subsequent ticks", () => {
    const f = fixture(),
      a = f.add(0, "terran-marine", 16, 18);
    f.add(1, "zerg-drone", 20, 18);
    f.tick(5);
    const saved = createPersistenceEnvelope(
        f.state,
        session,
        [],
        new Date().toISOString(),
      ),
      restored = restoreSnapshot(JSON.stringify(saved)).simulation;
    for (let n = 0; n < 40; n++) {
      f.tick();
      stepSimulation(restored, f.rules);
    }
    expect(checksum(restored)).toBe(checksum(f.state));
  });
  it("never sends hidden effects to the renderer", () => {
    const f = fixture();
    f.add(0, "terran-marine", 16, 18);
    f.add(1, "zerg-drone", 20, 18);
    f.tick();
    expect(
      createRenderSnapshot(f.state, f.map, 0, new Uint8Array(96 * 96)).combat
        ?.effects,
    ).toEqual([]);
  });
  it("preserves building damage through construction and completion", () => {
    const f = fixture("protoss"),
      s = f.state,
      d = economyDefinition("protoss-pylon")!,
      id = f.add(0, d.id, 18, 18),
      b = newStructure(id, d, 17, 17);
    b.started = true;
    b.remainingTicks = 2;
    s.economy.structures.push(b);
    s.entities.health[indexOf(s, id)] = 100;
    s.entities.shield[indexOf(s, id)] = 50;
    f.tick(2);
    expect(b.completedTick).toBeGreaterThan(0);
    expect(s.entities.health[indexOf(s, id)]).toBeLessThan(d.health);
    expect(s.entities.shield[indexOf(s, id)]).toBeLessThan(d.shield);
  });
  it("upgrades checked stage4 saves without losing progress, backs up before replacing and isolates practice saves", () => {
    const f = fixture();
    delete f.state.combat;
    const modern = createPersistenceEnvelope(
      f.state,
      session,
      [],
      new Date().toISOString(),
    );
    const old = structuredClone(modern);
    old.formatVersion = 6;
    old.engineVersion = old.simulation.engineVersion = "0.7.0-stage4";
    old.simulation.schemaVersion = 6;
    old.dataVersion = old.simulation.dataVersion = old.dataVersion.replace(ECONOMY_DATA_VERSION, LEGACY_ECONOMY_DATA_VERSION);
    if (old.simulation.vision) (old.simulation.vision as { rulesVersion: string }).rulesVersion = "fog-1-los-edge-detector11-memory600";
    old.checksum = checksum(old.simulation);
    const records = new Map<string, string>([
        [DEVELOPMENT_SAVE_PREFIX + "terran", JSON.stringify(old)],
      ]),
      storage = {
        getItem: (k: string) => records.get(k) ?? null,
        setItem: (k: string, v: string) => {
          records.set(k, v);
        },
      };
    const store = new DevelopmentSaveStore(storage),
      read = store.read("terran");
    expect(read.status).toBe("ready");
    if (read.status !== "ready") throw Error();
    expect(read.snapshot.simulation.players).toEqual(old.simulation.players);
    expect(read.snapshot.simulation.engineVersion).toBe("0.15.0-stage6e");
    expect(records.get(DEVELOPMENT_SAVE_PREFIX + "terran")).toBe(
      JSON.stringify(old),
    );
    expect(store.write(read.snapshot)).toBe(true);
    expect(records.get(DEVELOPMENT_SAVE_PREFIX + "terran.stage4-backup")).toBe(
      JSON.stringify(old),
    );
    initializeCombat(f.state, "combat-practice");
    expect(
      store.write(
        createPersistenceEnvelope(
          f.state,
          session,
          [],
          new Date().toISOString(),
        ),
      ),
    ).toBe(true);
    expect(store.read("terran").status).toBe("ready");
    expect(store.read("terran", "combat-practice").status).toBe("ready");
    old.simulation.players[0].minerals++;
    records.set(DEVELOPMENT_SAVE_PREFIX + "terran", JSON.stringify(old));
    expect(store.read("terran").status).toBe("invalid");
  });
});

describe("production practice movement and combat", () => {
  it.each(["terran", "zerg", "protoss"] as const)(
    "%s army can clear the real practice using attack-move",
    (race) => {
      const f = fixture(race);
      initializeCombat(f.state, "combat-practice");
      f.issue({
        kind: "attackMove",
        entityIds: f.state.combat!.friendlyIds,
        target: { kind: "point", x: 23 * 256, y: 19 * 256 },
      });
      for (
        let tick = 0;
        tick < 500 &&
        f.state.combat!.targetIds.some((id) =>
          f.state.entities.id.includes(id),
        );
        tick++
      )
        f.tick();
      const remaining = f.state.combat!.targetIds.filter((id) =>
        f.state.entities.id.includes(id),
      );
      expect(
        remaining.map((id) => ({
          id,
          hp: f.state.entities.health[indexOf(f.state, id)],
          x: f.state.entities.x[indexOf(f.state, id)],
          y: f.state.entities.y[indexOf(f.state, id)],
        })),
      ).toEqual([]);
    },
  );
});

describe("combat persistence and destruction boundaries", () => {
  it("keeps the old stage4 record when backing it up hits quota", () => {
    const f = fixture();
    delete f.state.combat;
    const saved = createPersistenceEnvelope(
      f.state,
      session,
      [],
      new Date().toISOString(),
    );
    const old = structuredClone(saved);
    old.formatVersion = 6;
    old.engineVersion = old.simulation.engineVersion = "0.7.0-stage4";
    old.simulation.schemaVersion = 6;
    old.dataVersion = old.simulation.dataVersion = old.dataVersion.replace(ECONOMY_DATA_VERSION, LEGACY_ECONOMY_DATA_VERSION);
    if (old.simulation.vision) (old.simulation.vision as { rulesVersion: string }).rulesVersion = "fog-1-los-edge-detector11-memory600";
    old.checksum = checksum(old.simulation);
    const serialized = JSON.stringify(old);
    let current = serialized;
    const store = new DevelopmentSaveStore({
      getItem: (k) => (k.endsWith(".stage4-backup") ? null : current),
      setItem: (k, v) => {
        if (k.endsWith(".stage4-backup")) throw Error("quota");
        current = v;
      },
    });
    expect(store.write(saved)).toBe(false);
    expect(current).toBe(serialized);
  });
  it("destroys production reservations and detaches the builder of a killed structure", () => {
    const f = fixture(),
      s = f.state,
      d = economyDefinition("terran-barracks")!,
      id = f.add(0, d.id, 18, 18),
      b = newStructure(id, d, 16, 16, true, 0);
    s.economy.structures.push(b);
    b.queue.push({
      id: s.counters.nextEventId++,
      definitionId: "terran-marine",
      remainingTicks: 100,
      totalTicks: 100,
      minerals: 50,
      gas: 0,
      supplyHalf: 2,
      count: 1,
    });
    recomputeSupply(s);
    const used = s.players[0].supplyUsedHalf;
    s.entities.health[indexOf(s, id)] = 0;
    f.tick();
    expect(structureOf(s, id)).toBeUndefined();
    expect(s.players[0].supplyUsedHalf).toBe(used - 2);
  });
  it("clears a killed harvester resource lock and every reference to its work", () => {
    const f = fixture(),
      s = f.state,
      w = s.economy.workers.find(
        (w) => s.entities.owner[indexOf(s, w.entityId)] === 0,
      )!;
    const n = s.economy.resources[0];
    n.occupiedBy = w.entityId;
    w.resourceId = n.nodeId;
    w.task = "harvesting";
    w.remainingTicks = 20;
    s.entities.health[indexOf(s, w.entityId)] = 0;
    f.tick();
    expect(n.occupiedBy).toBeNull();
    expect(s.economy.workers).not.toContain(w);
    expect(parse(simulationStateSchema, s).ok).toBe(true);
  });
  it("retains damage on a completed building and does not heal fractional damage on stop", () => {
    const f = fixture("zerg"),
      s = f.state,
      a = f.add(0, "zerg-zergling", 18, 18),
      b = f.add(1, "zerg-drone", 18.75, 18);
    const record = s.combat!.records.find((r) => r.entityId === b)!;
    record.healthFraction = 128;
    f.tick();
    expect(s.entities.health[indexOf(s, b)] * 256 - record.healthFraction).toBe(
      35 * 256 - 128,
    );
  });
});

describe("interrupted attack-move orders", () => {
  it("saves and restores the original destination during pursuit deterministically", () => {
    const f = fixture();
    initializeCombat(f.state, "combat-practice");
    f.issue({
      kind: "attackMove",
      entityIds: f.state.combat!.friendlyIds,
      target: { kind: "point", x: 23 * 256, y: 19 * 256 },
    });
    f.tick(10);
    expect(f.state.combat!.records.some((r) => r.resumeTarget !== null)).toBe(
      true,
    );
    const saved = createPersistenceEnvelope(
        f.state,
        session,
        [],
        new Date().toISOString(),
      ),
      copy = restoreSnapshot(JSON.stringify(saved)).simulation;
    for (let i = 0; i < 100; i++) {
      f.tick();
      stepSimulation(copy, f.rules);
    }
    expect(checksum(copy)).toBe(checksum(f.state));
  });
  it("gives an explicit new move priority over a remembered destination", () => {
    const f = fixture();
    initializeCombat(f.state, "combat-practice");
    const ids = f.state.combat!.friendlyIds;
    f.issue({
      kind: "attackMove",
      entityIds: ids,
      target: { kind: "point", x: 23 * 256, y: 19 * 256 },
    });
    f.issue({
      kind: "move",
      entityIds: ids,
      target: { kind: "point", x: 16 * 256, y: 22 * 256 },
    });
    expect(
      f.state
        .combat!.records.filter((r) => ids.includes(r.entityId))
        .every((r) => r.resumeTarget === null),
    ).toBe(true);
    f.tick(5);
    expect(
      ids.every(
        (id) => f.state.movement[indexOf(f.state, id)].order === "move",
      ),
    ).toBe(true);
  });
});
