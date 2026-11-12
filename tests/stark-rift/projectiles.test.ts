import { ECONOMY_DATA_VERSION, LEGACY_ECONOMY_DATA_VERSION } from "../../app/stark-rift/data/economy-catalog";
import { describe, it, expect, vi } from "vitest";
import {
  startSimulation,
  stepSimulation,
} from "../../app/stark-rift/core/simulation";
import { getRuntimeMap } from "../../app/stark-rift/data/maps";
import {
  initializeEconomy,
  createEconomicEntity,
  recomputeSupply,
  indexOf,
  workerOf,
} from "../../app/stark-rift/economy/helpers";
import {
  economyDefinition,
  type Faction,
} from "../../app/stark-rift/data/economy-catalog";
import { createMovementRules } from "../../app/stark-rift/core/movement-rules";
import { createEconomyRules } from "../../app/stark-rift/economy/rules";
import {
  initializeCombat,
  synchronizeCombat,
  combatReach,
  createCombatRules,
  weaponInRange,
} from "../../app/stark-rift/combat/rules";
import { combatWeapon, weaponFor } from "../../app/stark-rift/combat/catalog";
import { PREVIOUS_COMBAT_RULES_VERSION } from "../../app/stark-rift/combat/state";
import {
  createPersistenceEnvelope,
  restoreSnapshot,
  validatePersistenceEnvelope,
} from "../../app/stark-rift/core/state";
import {
  DevelopmentSaveStore,
  DEVELOPMENT_SAVE_PREFIX,
} from "../../app/stark-rift/ui/development-saves";
import { checksum } from "../../app/stark-rift/core/checksum";
import {
  createRenderSnapshot,
  validateRenderSnapshot,
} from "../../app/stark-rift/worker/render-snapshot";
import { removeEntity } from "../../app/stark-rift/core/world";
import { MAX_COMBAT_PROJECTILES } from "../../app/stark-rift/combat/mechanics";
vi.setConfig({ testTimeout: 20000 });
const session = {
  camera: { centerX: 18 * 256, centerY: 18 * 256, zoomLevel: 1 as const },
  selection: { entityIds: [], controlGroupIds: [] },
  openPanel: null,
};
function fixture(race: Faction = "terran", enemy: Faction = "zerg") {
  const { map, dataVersion } = getRuntimeMap("rift-basin");
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
  const rules = createCombatRules(
    createEconomyRules(
      map,
      createMovementRules(map, () => true, combatReach),
    ),
    () => true,
  );
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) stepSimulation(state, rules);
  };
  const add = (
    owner: number,
    definition: string,
    x = owner === 0 ? 18 : 21,
    y = 18,
  ) => {
    const id = createEconomicEntity(
      state,
      owner,
      economyDefinition(definition)!,
      { x: x * 256, y: y * 256 },
    );
    const w = workerOf(state, id);
    if (w) w.autoAllowed = false;
    recomputeSupply(state);
    synchronizeCombat(state);
    return id;
  };
  const hp = (id: number) => state.entities.health[indexOf(state, id)];
  return { state, map, rules, tick, add, hp };
}
describe("stage 5b weapons and persistent projectiles", () => {
  it("loads verified damage, cooldown, range, damage class and air target data", () => {
    expect(combatWeapon("Fragmentation_Grenade")).toMatchObject({
      defaultWpnDamageAmt: 20,
      wpnDamageCooldowns: 30,
      wpnMaxRange: 160,
      damageType: "Concussive",
    });
    expect(combatWeapon("Arclite_Cannon")).toMatchObject({
      defaultWpnDamageAmt: 30,
      wpnDamageCooldowns: 37,
      wpnMaxRange: 224,
      damageType: "Explosive",
      explosionType: "Normal",
    });
    expect(weaponFor("zerg-hydralisk", "air")?.name).toBe("Needle_Spines");
    expect(weaponFor("protoss-dragoon", "air")?.name).toBe("Phase_Disruptor");
    expect(weaponFor("terran-vulture", "air")).toBeUndefined();
    expect(weaponFor("terran-siege-tank-tank-mode", "air")).toBeUndefined();
  });
  it("launches a grenade and deals no damage until it reaches the target", () => {
    const f = fixture(),
      a = f.add(0, "terran-vulture"),
      b = f.add(1, "zerg-drone");
    f.tick();
    expect(f.hp(b)).toBe(40);
    expect(f.state.combat!.projectiles).toHaveLength(1);
    const p = f.state.combat!.projectiles[0];
    expect(p.sourceId).toBe(a);
    f.tick();
    expect(p.x).toBeGreaterThan(18 * 256);
    expect(f.hp(b)).toBe(40);
    f.tick(8);
    expect(f.hp(b)).toBe(20);
    expect(f.state.combat!.projectiles).toEqual([]);
    expect(
      f.state.combat!.effects.some((e) => e.kind === "impact" && e.owner === 0),
    ).toBe(true);
  });
  it("grenades survive the death of their shooter and ignore later stop orders", () => {
    const f = fixture(),
      a = f.add(0, "terran-vulture"),
      b = f.add(1, "zerg-drone");
    f.tick();
    removeEntity(f.state, a);
    f.tick(10);
    expect(f.hp(b)).toBe(20);
    expect(f.state.combat!.projectiles).toEqual([]);
  });
  it("discards shots at a killed target without redirecting to another entity", () => {
    const f = fixture(),
      a = f.add(0, "terran-vulture"),
      b = f.add(1, "zerg-drone");
    f.tick();
    removeEntity(f.state, b);
    const other = f.add(1, "zerg-drone");
    f.tick(10);
    expect(f.hp(other)).toBe(40);
    expect(f.state.combat!.projectiles).toEqual([]);
  });
  it("uses explosive damage for cannon and needle-spine hits", () => {
    const tank = fixture(),
      a = tank.add(0, "terran-siege-tank-tank-mode"),
      b = tank.add(1, "zerg-drone");
    tank.tick();
    expect(tank.hp(b)).toBe(25);
    expect(tank.state.combat!.projectiles).toEqual([]);
    const hydra = fixture("zerg"),
      h = hydra.add(0, "zerg-hydralisk"),
      d = hydra.add(1, "zerg-drone");
    hydra.tick();
    expect(hydra.hp(d)).toBe(35);
  });
  it("dragoons hit air and capture the completed ground-weapon upgrade at launch", () => {
    const f = fixture("protoss"),
      a = f.add(0, "protoss-dragoon"),
      b = f.add(1, "zerg-overlord");
    f.state.economy.upgrades.push({
      playerId: 0,
      technologyId: "protoss-ground-weapons",
      level: 1,
    });
    f.tick();
    expect(f.state.combat!.projectiles[0].damage).toBe(22 * 256);
    f.tick(15);
    expect(f.hp(b)).toBe(178);
  });
  it("applies shields before explosive size scaling and target armor at impact", () => {
    const f = fixture("protoss", "protoss"),
      a = f.add(0, "protoss-dragoon"),
      b = f.add(1, "protoss-zealot");
    f.state.entities.shield[indexOf(f.state, b)] = 5;
    f.tick(16);
    expect(f.hp(b)).toBe(93);
    expect(f.state.entities.shield[indexOf(f.state, b)]).toBe(0);
  });
  it("preserves flight position, damage, cooldown and deterministic results after saving", () => {
    const f = fixture("protoss"),
      a = f.add(0, "protoss-dragoon"),
      b = f.add(1, "zerg-overlord");
    f.tick(4);
    const saved = createPersistenceEnvelope(
        f.state,
        session,
        [],
        new Date().toISOString(),
      ),
      copy = restoreSnapshot(JSON.stringify(saved)).simulation;
    expect(copy.combat!.projectiles).toEqual(f.state.combat!.projectiles);
    for (let i = 0; i < 40; i++) {
      f.tick();
      stepSimulation(copy, f.rules);
    }
    expect(checksum(copy)).toBe(checksum(f.state));
  });
  it("does not leak projectile targets or hidden flight positions in render snapshots", () => {
    const f = fixture(),
      a = f.add(0, "terran-vulture");
    f.add(1, "zerg-drone");
    f.tick();
    const mask = new Uint8Array(96 * 96);
    mask[18 * 96 + 18] = 2;
    const view = createRenderSnapshot(f.state, f.map, 0, mask);
    expect(view.combat!.projectiles).toHaveLength(1);
    expect(Object.keys(view.combat!.projectiles[0]).sort()).toEqual([
      "id",
      "owner",
      "weaponId",
      "x",
      "y",
    ]);
    mask.fill(0);
    expect(
      createRenderSnapshot(f.state, f.map, 0, mask).combat!.projectiles,
    ).toEqual([]);
    view.combat!.projectiles[0].x = 40 * 256;
    expect(validateRenderSnapshot(view).ok).toBe(false);
  });
  it("expires stalled shots within a bounded lifetime and honors the projectile cap without restarting cooldown", () => {
    const f = fixture(),
      a = f.add(0, "terran-vulture"),
      b = f.add(1, "zerg-drone");
    f.tick();
    const prototype = f.state.combat!.projectiles[0];
    f.state.combat!.projectiles = Array.from(
      { length: MAX_COMBAT_PROJECTILES },
      (_, i) => ({ ...prototype, id: i + 1, x: 2 * 256, y: 2 * 256 }),
    );
    f.state.counters.nextProjectileId = MAX_COMBAT_PROJECTILES + 1;
    f.state.combat!.records.find((r) => r.entityId === a)!.nextAttackTick = 0;
    f.tick();
    expect(f.state.combat!.projectiles).toHaveLength(MAX_COMBAT_PROJECTILES);
    expect(
      f.state.combat!.records.find((r) => r.entityId === a)!.nextAttackTick,
    ).toBe(0);
    f.state.tick = 200;
    for (const p of f.state.combat!.projectiles) {
      p.spawnTick = 1;
      p.expiresTick = 201;
    }
    f.tick();
    expect(f.state.combat!.projectiles.length).toBeLessThan(
      MAX_COMBAT_PROJECTILES,
    );
  });
  it.each(["terran", "zerg", "protoss"] as const)(
    "%s ranged practice starts without firing and keeps homogeneous control groups",
    (race) => {
      const f = fixture(race);
      initializeCombat(f.state, "ranged-practice");
      f.tick(20);
      expect(f.state.combat!.projectiles).toEqual([]);
      expect(f.state.combat!.effects).toEqual([]);
      expect(
        f.state.combat!.targetIds.every((id) =>
          f.state.entities.id.includes(id),
        ),
      ).toBe(true);
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
      expect(
        f.state.players[0].controlGroups.filter((g) => g.entityIds.length)
          .length,
      ).toBe(race === "terran" ? 2 : 1);
    },
  );
});
describe("stage 5a save compatibility and mode isolation", () => {
  it("validates and upgrades actual legacy structure while retaining the source and an exact stage5a backup", () => {
    const f = fixture();
    initializeCombat(f.state, "combat-practice");
    const current = createPersistenceEnvelope(
      f.state,
      session,
      [],
      new Date().toISOString(),
    );
    const legacy = JSON.parse(JSON.stringify(current));
    legacy.formatVersion = legacy.simulation.schemaVersion = 7;
    legacy.engineVersion = legacy.simulation.engineVersion = "0.8.0-stage5a";
    legacy.simulation.combat.rulesVersion = PREVIOUS_COMBAT_RULES_VERSION;
    delete legacy.simulation.combat.projectiles;
    legacy.dataVersion = legacy.simulation.dataVersion = legacy.dataVersion.replace(ECONOMY_DATA_VERSION, LEGACY_ECONOMY_DATA_VERSION);
    legacy.checksum = checksum(legacy.simulation);
    const key = DEVELOPMENT_SAVE_PREFIX + "combat.terran",
      raw = JSON.stringify(legacy),
      records = new Map([[key, raw]]),
      storage = {
        getItem: (k: string) => records.get(k) ?? null,
        setItem: (k: string, v: string) => {
          records.set(k, v);
        },
      };
    const store = new DevelopmentSaveStore(storage),
      read = store.read("terran", "combat-practice");
    expect(read.status).toBe("ready");
    if (read.status !== "ready") throw Error();
    expect(read.snapshot.simulation.combat!.projectiles).toEqual([]);
    expect(read.snapshot.simulation.combat!.records).toEqual(
      legacy.simulation.combat.records,
    );
    expect(records.get(key)).toBe(raw);
    expect(store.write(read.snapshot)).toBe(true);
    expect(records.get(key + ".stage5a-backup")).toBe(raw);
    initializeCombat(f.state, "ranged-practice");
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
    expect(store.read("terran", "ranged-practice").status).toBe("ready");
    expect(store.read("terran", "combat-practice").status).toBe("ready");
    legacy.simulation.players[0].minerals++;
    records.set(key, JSON.stringify(legacy));
    expect(store.read("terran", "combat-practice").status).toBe("invalid");
  });
  it("leaves a stage5a original intact when its backup cannot be saved", () => {
    const f = fixture();
    const current = createPersistenceEnvelope(
        f.state,
        session,
        [],
        new Date().toISOString(),
      ),
      old = JSON.parse(JSON.stringify(current));
    old.formatVersion = old.simulation.schemaVersion = 7;
    old.engineVersion = old.simulation.engineVersion = "0.8.0-stage5a";
    old.simulation.combat.rulesVersion = PREVIOUS_COMBAT_RULES_VERSION;
    delete old.simulation.combat.projectiles;
    old.dataVersion = old.simulation.dataVersion = old.dataVersion.replace(ECONOMY_DATA_VERSION, LEGACY_ECONOMY_DATA_VERSION);
    old.checksum = checksum(old.simulation);
    const raw = JSON.stringify(old);
    let value = raw;
    const store = new DevelopmentSaveStore({
      getItem: (k) => (k.endsWith("-backup") ? null : value),
      setItem: (k, v) => {
        if (k.endsWith("-backup")) throw Error("quota");
        value = v;
      },
    });
    expect(store.write(current)).toBe(false);
    expect(value).toBe(raw);
  });
});

import { enqueueCommand } from "../../app/stark-rift/core/simulation";
import type { GameCommand } from "../../app/stark-rift/core/commands";
describe("ranged practice complete production rules", () => {
  it.each(["terran", "zerg", "protoss"] as const)(
    "%s clears both valid ground and air targets after attack-move",
    (race) => {
      const f = fixture(race);
      initializeCombat(f.state, "ranged-practice");
      const command: GameCommand = {
        kind: "attackMove",
        entityIds: f.state.combat!.friendlyIds,
        target: { kind: "point", x: 23 * 256, y: 19 * 256 },
        playerId: 0,
        source: "player",
        sequence: 1,
        issuedTick: 0,
        executeTick: 1,
      };
      expect(enqueueCommand(f.state, command, f.rules)).toEqual({ ok: true });
      for (
        let i = 0;
        i < 500 &&
        f.state.combat!.targetIds.some((id) =>
          f.state.entities.id.includes(id),
        );
        i++
      )
        f.tick();
      expect(
        f.state.combat!.targetIds.filter((id) =>
          f.state.entities.id.includes(id),
        ),
      ).toEqual([]);
    },
  );
});
