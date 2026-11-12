import { describe, it, expect, vi } from "vitest";
import { createBurrowRules } from "../../app/stark-rift/abilities/burrow-rules";
import { isBurrowed, BURROW_RESEARCH } from "../../app/stark-rift/abilities/burrow";
import { getRuntimeMap } from "../../app/stark-rift/data/maps";
import { economyDefinition, ECONOMY_UPGRADES, ECONOMY_DATA_VERSION, LEGACY_ECONOMY_DATA_VERSION } from "../../app/stark-rift/data/economy-catalog";
import { createMovementRules } from "../../app/stark-rift/core/movement-rules";
import { createEconomyRules } from "../../app/stark-rift/economy/rules";
import { initializeEconomy, createEconomicEntity, indexOf, workerOf, recomputeSupply, newStructure, structureOf, releaseWork } from "../../app/stark-rift/economy/helpers";
import { initializeCombat, synchronizeCombat, createCombatRules, combatReach } from "../../app/stark-rift/combat/rules";
import { createVisionRules, initializeVision, canSeeEntity, visibilityMask } from "../../app/stark-rift/vision/rules";
import { enqueueCommand, startSimulation, stepSimulation } from "../../app/stark-rift/core/simulation";
import { createPersistenceEnvelope, restoreSnapshot, migrateLegacyEnvelope, validatePersistenceEnvelope, simulationStateSchema } from "../../app/stark-rift/core/state";
import { parse } from "../../app/stark-rift/core/validation";
import { checksum } from "../../app/stark-rift/core/checksum";
import { createRenderSnapshot, validateRenderSnapshot } from "../../app/stark-rift/worker/render-snapshot";
import { removeEntity } from "../../app/stark-rift/core/world";
import { SpatialHash } from "../../app/stark-rift/pathfinding/spatial-hash";
import { NavigationGrid } from "../../app/stark-rift/pathfinding/navigation";
import { destinationAvailable } from "../../app/stark-rift/pathfinding/destinations";
import { DevelopmentSaveStore, DEVELOPMENT_SAVE_PREFIX } from "../../app/stark-rift/ui/development-saves";
import { TERRAIN_COMBAT_RULES_VERSION } from "../../app/stark-rift/combat/state";
import type { GameCommand } from "../../app/stark-rift/core/commands";
vi.setConfig({ testTimeout: 30000 });
const session = { camera: { centerX: 18 * 256, centerY: 18 * 256, zoomLevel: 1 as const }, selection: { entityIds: [], controlGroupIds: [] }, openPanel: null };
function fixture(enemy: "terran" | "zerg" = "zerg") {
  const { map, dataVersion } = getRuntimeMap("rift-basin");
  const state = startSimulation(42, map.id, dataVersion, [0, 1].map((id) => ({id, faction: id === 0 ? "zerg" as const : enemy, minerals: 500, gas: 500, supplyUsedHalf: 0, supplyCapHalf: 0})));
  initializeEconomy(state, map); initializeCombat(state); initializeVision(state, map);
  for (const w of state.economy.workers) w.autoAllowed = false;
  const visible = (s: typeof state, owner: number, i: number) => canSeeEntity(s, map, owner, i);
  const rules = createBurrowRules(map, createVisionRules(map, createCombatRules(createEconomyRules(map, createMovementRules(map, visible, combatReach)), visible, map)));
  const tick = (n = 1) => { for (let i = 0; i < n; i++) stepSimulation(state, rules); };
  const issue = (body: object, owner = 0) => {
    const c = { ...body, sequence: state.commandState.lastAcceptedSequenceByPlayer[owner] + 1, playerId: owner, source: "player", issuedTick: state.tick, executeTick: state.tick + 1 } as GameCommand;
    expect(enqueueCommand(state, c, rules)).toEqual({ ok: true }); return stepSimulation(state, rules)[0];
  };
  const toggle = (ids: number[], enabled: boolean, owner = 0) => issue({ kind: "toggleStateAbility", entityIds: ids, payload: { abilityId: "burrow", enabled } }, owner);
  const add = (owner: number, id: string, x = 18, y = 18) => {
    const d = economyDefinition(id)!, entity = createEconomicEntity(state, owner, d, { x: x * 256, y: y * 256 });
    const w = workerOf(state, entity); if (w) w.autoAllowed = false;
    synchronizeCombat(state); recomputeSupply(state); return entity;
  };
  const researched = (owner = 0) => state.economy.upgrades.push({ playerId: owner, technologyId: BURROW_RESEARCH, level: 1 });
  const saved = () => createPersistenceEnvelope(state, session, [], "2026-11-12T00:00:00.000Z");
  return { state, map, rules, tick, issue, toggle, add, researched, saved };
}
describe("researched manual burrow", () => {
  it("charges original research once, completes on the 500th tick, and permits parallel larva production", () => {
    const f = fixture(), hq = f.state.economy.structures[0].entityId;
    expect(ECONOMY_UPGRADES.find(t => t.id === BURROW_RESEARCH)).toMatchObject({ minerals: 100, gas: 100, frames: 1200, ticks: 500 });
    expect(f.issue({ kind: "research", entityIds: [hq], payload: { technologyId: BURROW_RESEARCH } }).accepted).toBe(true);
    expect(f.state.players[0]).toMatchObject({ minerals: 400, gas: 400 });
    expect(f.issue({ kind: "research", entityIds: [hq], payload: { technologyId: BURROW_RESEARCH } }).accepted).toBe(false);
    expect(f.issue({ kind: "produce", entityIds: [hq], payload: { unitId: "zerg-drone" } }).accepted).toBe(true);
    f.tick(496); expect(f.state.tick).toBe(499); expect(f.state.economy.upgrades).toHaveLength(0);
    f.tick(); expect(f.state.economy.upgrades).toContainEqual({ playerId: 0, technologyId: BURROW_RESEARCH, level: 1 });
    expect(f.state.economy.workers.filter(w => f.state.entities.owner[indexOf(f.state, w.entityId)] === 0)).toHaveLength(5);
  });
  it("starts research with larvae already morphing, prevents duplicate research at another hatchery and refunds cancellation", () => {
    const f = fixture(), hq = f.state.economy.structures[0].entityId, d = economyDefinition("zerg-hatchery")!;
    const second = f.add(0, d.id, 24, 16); f.state.economy.structures.push(newStructure(second, d, 22, 14, true, 0)); recomputeSupply(f.state);
    f.issue({ kind: "produce", entityIds: [hq], payload: { unitId: "zerg-drone" } });
    expect(f.issue({ kind: "research", entityIds: [hq], payload: { technologyId: BURROW_RESEARCH } }).accepted).toBe(true);
    expect(f.issue({ kind: "research", entityIds: [second], payload: { technologyId: BURROW_RESEARCH } }).accepted).toBe(false);
    expect(f.issue({ kind: "cancelResearch", entityIds: [hq] }).accepted).toBe(true);
    expect(f.state.players[0]).toMatchObject({ minerals: 450, gas: 500 });
    expect(f.issue({ kind: "research", entityIds: [second], payload: { technologyId: BURROW_RESEARCH } }).accepted).toBe(true);
  });
  it("rejects missing research, wrong owner, unsupported unit and unknown ability without changing cargo or concealment", () => {
    const f = fixture(), ling = f.add(0, "zerg-zergling"), enemy = f.add(1, "zerg-zergling", 30, 30), lord = f.add(0, "zerg-overlord");
    expect(f.toggle([ling], true)).toMatchObject({ accepted: false, code: "missing_prerequisite" });
    f.researched(); expect(f.toggle([enemy], true)).toMatchObject({ accepted: false, code: "not_owner" });
    expect(f.toggle([lord], true)).toMatchObject({ accepted: false, code: "invalid_target" });
    expect(f.issue({ kind: "toggleStateAbility", entityIds: [ling], payload: { abilityId: "unknown", enabled: true } })).toMatchObject({ accepted: false, code: "invalid_command" });
    expect(f.state.vision!.concealed).toEqual([]);
  });
  it.each(["zerg-drone", "zerg-zergling", "zerg-hydralisk"])("%s toggles manually and cannot implicitly move, attack or work", id => {
    const f = fixture(), actor = f.add(0, id), enemy = f.add(1, "zerg-drone", 21, 18); f.researched();
    const p = { x: f.state.entities.x[indexOf(f.state, actor)], y: f.state.entities.y[indexOf(f.state, actor)] };
    expect(f.toggle([actor], true).accepted).toBe(true);
    for (const body of [ { kind: "move", target: { kind: "point", x: 23 * 256, y: 18 * 256 } }, { kind: "attackMove", target: { kind: "point", x: 23 * 256, y: 18 * 256 } }, { kind: "focusAttack", target: { kind: "entity", entityId: enemy } }, { kind: "patrol", target: { kind: "point", x: 23 * 256, y: 18 * 256 } } ])
      expect(f.issue({ ...body, entityIds: [actor] })).toMatchObject({ accepted: false, code: "invalid_state" });
    f.issue({ kind: "hold", entityIds: [actor] }); f.tick(30);
    expect(isBurrowed(f.state, actor)).toBe(true); expect(f.state.entities.x[indexOf(f.state, actor)]).toBe(p.x); expect(f.state.entities.y[indexOf(f.state, actor)]).toBe(p.y);
    expect(f.toggle([actor], false).accepted).toBe(true); expect(isBurrowed(f.state, actor)).toBe(false);
    expect(f.issue({ kind: "move", entityIds: [actor], target: { kind: "point", x: p.x + 768, y: p.y } }).accepted).toBe(true); f.tick(30);
    expect(f.state.entities.x[indexOf(f.state, actor)]).not.toBe(p.x);
  });
  it("releases a harvester lock but keeps carried resources and waits for explicit work after surfacing", () => {
    const f = fixture(), drone = f.state.economy.workers[0].entityId, w = workerOf(f.state, drone)!, resource = f.state.economy.resources[0]; f.researched();
    w.task = "harvesting"; w.resourceId = resource.nodeId; w.remainingTicks = 20; w.cargoMinerals = 8; resource.occupiedBy = drone;
    expect(f.toggle([drone], true).accepted).toBe(true); expect(resource.occupiedBy).toBeNull(); expect(w).toMatchObject({ task: "idle", autoAllowed: false, cargoMinerals: 8 });
    for (const body of [{ kind: "autoGather" }, { kind: "returnCargo" }, { kind: "gather", payload: { resourceId: resource.nodeId } }, { kind: "placeBuilding", target: { kind: "point", x: 19 * 256, y: 18 * 256 }, payload: { buildingId: "zerg-hatchery" } }])
      expect(f.issue({ ...body, entityIds: [drone] })).toMatchObject({ accepted: false, code: "invalid_state" });
    f.tick(30); expect(w.cargoMinerals).toBe(8); expect(f.toggle([drone], false).accepted).toBe(true); f.tick(20); expect(w.task).toBe("idle");
    expect(f.issue({ kind: "autoGather", entityIds: [drone] }).accepted).toBe(true); f.tick(200); expect(f.state.players[0].minerals).toBeGreaterThan(500);
  });
  it("keeps paid Drone construction connected by refusing burrow until it is cancelled", () => {
    const f = fixture(), drone = f.state.economy.workers[0].entityId; f.researched();
    const result = f.issue({ kind: "placeBuilding", entityIds: [drone], target: { kind: "point", x: 21 * 256, y: 14 * 256 }, payload: { buildingId: "zerg-hatchery" } });
    expect(result.accepted).toBe(true); const w = workerOf(f.state, drone)!; expect(w.buildingId).not.toBeNull();
    expect(f.toggle([drone], true)).toMatchObject({ accepted: false, code: "invalid_state" });
    expect(f.issue({ kind: "cancelConstruction", entityIds: [w.buildingId!] }).accepted).toBe(true);
    expect(f.toggle([drone], true).accepted).toBe(true);
  });
  it("stops an interrupted attack-move, retains control group and formation, and partially handles mixed selections", () => {
    const f = fixture(), ling = f.add(0, "zerg-zergling"), lord = f.add(0, "zerg-overlord"); f.researched();
    f.issue({ kind: "assignGroup", entityIds: [ling], payload: { slot: 0, confirmed: false } });
    f.issue({ kind: "setFormation", entityIds: [ling], payload: { formation: "line" } });
    f.issue({ kind: "attackMove", entityIds: [ling], target: { kind: "point", x: 30 * 256, y: 18 * 256 } });
    expect(f.toggle([ling, lord], true)).toMatchObject({ accepted: true, executedEntityIds: [ling] });
    expect(f.state.movement[indexOf(f.state, ling)]).toMatchObject({ order: "idle", target: null, formation: "line" });
    expect(f.state.players[0].controlGroups[0].entityIds).toEqual([ling]);
    f.toggle([ling], false); expect(f.state.movement[indexOf(f.state, ling)].order).toBe("idle");
  });
});
describe("burrow collision, visibility and combat", () => {
  it("lets ground units cross a burrow, refuses blocked surfacing, then succeeds when the body is clear", () => {
    const f = fixture(), actor = f.add(0, "zerg-hydralisk"), other = f.add(0, "zerg-zergling", 21, 18); f.researched(); f.toggle([actor], true);
    const p = { x: 18 * 256, y: 18 * 256 }, i = indexOf(f.state, other);
    expect(new NavigationGrid(f.map, f.state).clear(p, f.state.entities.radius[i], "ground", other)).toBe(true);
    expect(new SpatialHash(f.state).overlaps(i, p.x, p.y)).toBe(false);
    expect(destinationAvailable(f.state, other, p, f.state.entities.radius[i], "ground")).toBe(true);
    f.state.entities.x[i] = p.x; f.state.entities.y[i] = p.y;
    expect(f.toggle([actor], false)).toMatchObject({ accepted: false, code: "blocked" }); expect(isBurrowed(f.state, actor)).toBe(true);
    f.state.entities.x[i] += 768; expect(f.toggle([actor], false).accepted).toBe(true);
  });
  it("reports only the actual surfaced IDs when overlapping burrows are selected together", () => {
    const f = fixture(), a = f.add(0, "zerg-zergling"), b = f.add(0, "zerg-zergling"); f.researched(); f.toggle([a, b], true);
    expect(f.toggle([b, a], false)).toMatchObject({ accepted: true, executedEntityIds: [a] });
    expect(isBurrowed(f.state, a)).toBe(false); expect(isBurrowed(f.state, b)).toBe(true);
  });
  it("reveals to a live enemy detector only, never fires from burrow, and projects only authorized flags", () => {
    const f = fixture(), actor = f.add(0, "zerg-hydralisk", 40, 40), enemy = f.add(1, "zerg-hydralisk", 42, 40); f.researched(); f.toggle([actor], true);
    expect(canSeeEntity(f.state, f.map, 1, indexOf(f.state, actor))).toBe(false);
    expect(createRenderSnapshot(f.state, f.map, 1, visibilityMask(f.state, f.map, 1)).entities.some(e => e.id === actor)).toBe(false);
    const detector = f.add(1, "zerg-overlord", 42, 42); f.tick();
    const view = createRenderSnapshot(f.state, f.map, 1, visibilityMask(f.state, f.map, 1));
    expect(view.entities.find(e => e.id === actor)?.burrowed).toBe(true); expect(validateRenderSnapshot(view).ok).toBe(true);
    const hp = f.state.entities.health[indexOf(f.state, enemy)]; f.tick(10); expect(f.state.entities.health[indexOf(f.state, enemy)]).toBe(hp);
    expect(f.state.entities.health[indexOf(f.state, actor)]).toBeLessThan(80);
    removeEntity(f.state, detector); expect(canSeeEntity(f.state, f.map, 1, indexOf(f.state, actor))).toBe(false);
  });
  it("keeps an already fired enemy projectile travelling after its target burrows", () => {
    const f = fixture("terran"), actor = f.add(0, "zerg-drone"), enemy = f.add(1, "terran-vulture", 21, 18); f.researched();
    f.tick(); expect(f.state.combat!.projectiles).toHaveLength(1);
    const shot = f.state.combat!.projectiles[0].id;
    expect(f.toggle([actor], true).accepted).toBe(true); expect(f.state.combat!.projectiles.some(p => p.id === shot)).toBe(true);
    f.tick(12); expect(f.state.entities.health[indexOf(f.state, actor)]).toBe(20);
    expect(f.state.combat!.projectiles).toEqual([]); expect(isBurrowed(f.state, actor)).toBe(true);
  });
  it("removes a dead burrow and group membership without leaving invalid references", () => {
    const f = fixture(), a = f.add(0, "zerg-zergling"); f.researched(); f.toggle([a], true); removeEntity(f.state, a);
    expect(f.state.vision!.concealed).toEqual([]); expect(parse(simulationStateSchema, f.state).ok).toBe(true);
  });
});
describe("burrow persistence and migration", () => {
  it("restores burrow and an accepted future unburrow with identical subsequent simulation checksums", () => {
    const f = fixture(), a = f.add(0, "zerg-hydralisk"); f.researched(); f.toggle([a], true);
    expect(enqueueCommand(f.state, { kind: "toggleStateAbility", entityIds: [a], payload: { abilityId: "burrow", enabled: false }, source: "player", sequence: 2, playerId: 0, issuedTick: f.state.tick, executeTick: f.state.tick + 4 }, f.rules).ok).toBe(true);
    const saved = f.saved(), copy = restoreSnapshot(JSON.stringify(saved)).simulation; expect(isBurrowed(copy, a)).toBe(true);
    for (let i = 0; i < 40; i++) { f.tick(); stepSimulation(copy, f.rules); expect(checksum(copy)).toBe(checksum(f.state)); }
    expect(isBurrowed(copy, a)).toBe(false);
  });
  it.each(["research", "movement", "work", "type"])("rejects a malformed saved burrow: %s", defect => {
    const f = fixture(), a = f.add(0, "zerg-drone"); f.researched(); f.toggle([a], true);
    if (defect === "research") f.state.economy.upgrades = [];
    if (defect === "movement") f.state.movement[indexOf(f.state, a)].order = "move";
    if (defect === "work") workerOf(f.state, a)!.autoAllowed = true;
    if (defect === "type") f.state.vision!.concealed[0].entityId = f.state.economy.structures[0].entityId;
    expect(parse(simulationStateSchema, f.state).ok).toBe(false);
  });
  it("migrates checked 5C vision, contacts, RNG and misses while preserving and backing up the original", () => {
    const f = fixture("terran"); f.add(0, "zerg-drone"); f.add(1, "terran-vulture", 21, 18); f.tick();
    expect(f.state.combat!.projectiles).toHaveLength(1); f.state.combat!.projectiles[0].miss = true;
    const saved = f.saved(), old = JSON.parse(JSON.stringify(saved));
    old.formatVersion = old.simulation.schemaVersion = 9; old.engineVersion = old.simulation.engineVersion = "0.10.0-stage5c";
    old.dataVersion = old.simulation.dataVersion = old.dataVersion.replace(ECONOMY_DATA_VERSION, LEGACY_ECONOMY_DATA_VERSION);
    old.simulation.combat.rulesVersion = TERRAIN_COMBAT_RULES_VERSION; old.checksum = checksum(old.simulation);
    const key = DEVELOPMENT_SAVE_PREFIX + "zerg", raw = JSON.stringify(old), records = new Map([[key, raw]]), store = new DevelopmentSaveStore({ getItem: k => records.get(k) ?? null, setItem: (k, v) => { records.set(k, v); } });
    const read = store.read("zerg"); expect(read.status).toBe("ready"); if (read.status !== "ready") throw Error();
    expect(read.snapshot.simulation.combat!.projectiles).toEqual(old.simulation.combat.projectiles); expect(read.snapshot.simulation.combat!.projectiles[0].miss).toBe(true);
    expect(read.snapshot.simulation.vision).toEqual(old.simulation.vision); expect(read.snapshot.simulation.rngStreams).toEqual(old.simulation.rngStreams); expect(records.get(key)).toBe(raw);
    expect(store.write(read.snapshot)).toBe(true); expect(records.get(key + ".stage5c-backup")).toBe(raw);
    old.simulation.players[0].minerals++; expect(() => migrateLegacyEnvelope(old)).toThrow("Invalid legacy save");
  });
  it("rejects a checksummed old save with a mismatched header or unknown data bundle", () => {
    const f = fixture(), old = JSON.parse(JSON.stringify(f.saved())); old.formatVersion = old.simulation.schemaVersion = 9; old.engineVersion = old.simulation.engineVersion = "0.10.0-stage5c"; old.simulation.combat.rulesVersion = TERRAIN_COMBAT_RULES_VERSION;
    old.dataVersion = old.simulation.dataVersion = "unknown"; old.checksum = checksum(old.simulation); expect(() => migrateLegacyEnvelope(old)).toThrow("Unknown legacy data version");
  });
  it("does not replace the original when the 5C backup fails", () => {
    const f = fixture(), saved = f.saved(), old = { ...saved, formatVersion: 9 }; let raw = JSON.stringify(old), value = raw;
    const store = new DevelopmentSaveStore({ getItem: k => k.endsWith("-backup") ? null : value, setItem: (k, v) => { if (k.endsWith("-backup")) throw Error("quota"); value = v; } });
    expect(store.write(saved)).toBe(false); expect(value).toBe(raw);
  });
});
