import { createLurkerRules } from "../../app/stark-rift/abilities/lurker-rules";
import { LURKER, HYDRALISK, LURKER_EGG, LURKER_ASPECT, unitMorphOf, validLurker, lurkerFitsMap } from "../../app/stark-rift/abilities/lurker-state";
import { advanceSpines, launchSpines, spineIntersectsBox } from "../../app/stark-rift/combat/lurker-waves";
import { SIEGE_COMBAT_RULES_VERSION } from "../../app/stark-rift/combat/state";
import { SIEGE_ECONOMY_DATA_VERSION } from "../../app/stark-rift/data/economy-catalog";
import { createSiegeRules } from "../../app/stark-rift/abilities/siege-rules";
import { SIEGE_MODE, TANK_MODE, SIEGE_RESEARCH, siegeTransitionOf, SIEGE_TRANSITION_TICKS, validSiege } from "../../app/stark-rift/abilities/siege-state";
import { siegeSplashTargets, SIEGE_CANNON } from "../../app/stark-rift/combat/siege-splash";
import { weaponInRange, hitPoints } from "../../app/stark-rift/combat/rules";
import { combatProfile, weaponFor } from "../../app/stark-rift/combat/catalog";
import { CLOAK_COMBAT_RULES_VERSION } from "../../app/stark-rift/combat/state";
import { CLOAK_ECONOMY_DATA_VERSION } from "../../app/stark-rift/data/economy-catalog";
import { createCloakRules, advanceEnergy } from "../../app/stark-rift/abilities/cloak-rules";
import { ENERGY, energyOf, activeCloak, validEnergy } from "../../app/stark-rift/abilities/cloak-state";
import { SPECIAL_COMBAT_RULES_VERSION } from "../../app/stark-rift/combat/state";
import { describe, expect, it, vi } from "vitest";
import { createSpecialRules } from "../../app/stark-rift/abilities/special-rules";
import { createBurrowRules } from "../../app/stark-rift/abilities/burrow-rules";
import { isEmbarked, carrierOf, occupiedSpace, transportCapacity, unitTraits, permanentCloak, morphOf } from "../../app/stark-rift/abilities/special-state";
import { getRuntimeMap } from "../../app/stark-rift/data/maps";
import { ECONOMY_DEFINITIONS, ECONOMY_UPGRADES, ECONOMY_DATA_VERSION, BURROW_ECONOMY_DATA_VERSION, SPECIAL_ECONOMY_DATA_VERSION, economyDefinition, type Faction } from "../../app/stark-rift/data/economy-catalog";
import { initializeEconomy, createEconomicEntity, newStructure, workerOf, releaseWork, indexOf, structureOf, recomputeSupply } from "../../app/stark-rift/economy/helpers";
import { createEconomyRules } from "../../app/stark-rift/economy/rules";
import { initializeCombat, synchronizeCombat, createCombatRules, combatReach } from "../../app/stark-rift/combat/rules";
import { BURROW_COMBAT_RULES_VERSION } from "../../app/stark-rift/combat/state";
import { initializeVision, visibilityMask, canSeeEntity, createVisionRules } from "../../app/stark-rift/vision/rules";
import { createMovementRules } from "../../app/stark-rift/core/movement-rules";
import { startSimulation, enqueueCommand, stepSimulation } from "../../app/stark-rift/core/simulation";
import { createPersistenceEnvelope, restoreSnapshot, simulationStateSchema } from "../../app/stark-rift/core/state";
import { parse } from "../../app/stark-rift/core/validation";
import { checksum } from "../../app/stark-rift/core/checksum";
import { removeEntity } from "../../app/stark-rift/core/world";
import { createRenderSnapshot, validateRenderSnapshot } from "../../app/stark-rift/worker/render-snapshot";
import { DevelopmentSaveStore, DEVELOPMENT_SAVE_PREFIX } from "../../app/stark-rift/ui/development-saves";
import { NavigationGrid } from "../../app/stark-rift/pathfinding/navigation";
import type { GameCommand } from "../../app/stark-rift/core/commands";
vi.setConfig({ testTimeout: 30000 });
const session = { camera: { centerX: 18 * 256, centerY: 20 * 256, zoomLevel: 1 as const }, selection: { entityIds: [], controlGroupIds: [] }, openPanel: null };
function fixture(race: Faction = "zerg", enemy: Faction = "protoss") {
  const { map, dataVersion } = getRuntimeMap("rift-basin"); map.height.fill(0);
  const state = startSimulation(42, map.id, dataVersion, [0, 1].map((id) => ({ id, faction: id === 0 ? race : enemy, minerals: 1000, gas: 1000, supplyUsedHalf: 0, supplyCapHalf: 0 })));
  initializeEconomy(state, map); initializeCombat(state); initializeVision(state, map);
  for (const w of state.economy.workers) w.autoAllowed = false;
  const visible = (s: typeof state, p: number, i: number) => canSeeEntity(s, map, p, i);
  const rules = createSpecialRules(map, createLurkerRules(createSiegeRules(createCloakRules(createBurrowRules(map, createVisionRules(map, createCombatRules(createEconomyRules(map, createMovementRules(map, visible, combatReach)), visible, map)))))));
  const tick = (n = 1) => { for (let i = 0; i < n; i++) stepSimulation(state, rules); };
  const issue = (body: object, owner = 0) => {
    const c = { ...body, sequence: state.commandState.lastAcceptedSequenceByPlayer[owner] + 1, issuedTick: state.tick, executeTick: state.tick + 1, playerId: owner, source: "player" } as GameCommand;
    expect(enqueueCommand(state, c, rules)).toEqual({ ok: true }); return stepSimulation(state, rules)[0];
  };
  const add = (owner: number, name: string, x = 40, y = 40) => {
    const d = economyDefinition(name)!, tx = Math.floor(x - d.width / 2), ty = Math.floor(y - d.height / 2),
      eid = createEconomicEntity(state, owner, d, { x: (d.kind === "building" ? tx + d.width / 2 : x) * 256, y: (d.kind === "building" ? ty + d.height / 2 : y) * 256 });
    if (d.kind === "building") state.economy.structures.push(newStructure(eid, d, tx, ty, true, state.tick));
    const w = workerOf(state, eid); if (w) releaseWork(state, w, false);
    recomputeSupply(state); synchronizeCombat(state); return eid;
  };
  const research = (id: string) => { if (!state.economy.upgrades.some(u => u.playerId === 0 && u.technologyId === id)) state.economy.upgrades.push({ playerId: 0, technologyId: id, level: 1 }); };
  const load = (ships: number[], passenger: number) => issue({ kind: "loadTransport", entityIds: ships, target: { kind: "entity", entityId: passenger } });
  const unload = (ships: number[], x = 40, y = 40) => issue({ kind: "unloadTransport", entityIds: ships, target: { kind: "point", x: x * 256, y: y * 256 } });
  const saved = () => createPersistenceEnvelope(state, session, [], "2026-11-12T00:00:00.000Z");
  const view = (owner = 0) => createRenderSnapshot(state, map, owner, visibilityMask(state, map, owner));
  return { state, map, rules, add, research, tick, issue, load, unload, saved, view };
}
const morph = (f: ReturnType<typeof fixture>, ids: number[]) => f.issue({ kind: 'morphUnit', entityIds: ids, payload: { unitId: LURKER } });
const burrow = (f: ReturnType<typeof fixture>, id: number, enabled = true) => f.issue({ kind: 'toggleStateAbility', entityIds: [id], payload: { abilityId: 'burrow', enabled } });
describe('Lurker research and vulnerable morph', () => {
  it('requires a completed Lair, charges 200/200 and completes research in 750 ticks', () => {
    const f = fixture(), den = f.add(0, 'zerg-hydralisk-den', 40, 40), technologyId = LURKER_ASPECT;
    expect(ECONOMY_UPGRADES.find(t => t.id === technologyId)).toMatchObject({ minerals: 200, gas: 200, frames: 1800, ticks: 750 });
    expect(f.issue({ kind: 'research', entityIds: [den], payload: { technologyId } })).toMatchObject({ accepted: false, code: 'missing_prerequisite' });
    f.add(0, 'zerg-lair', 46, 40); expect(f.issue({ kind: 'research', entityIds: [den], payload: { technologyId } }).accepted).toBe(true);
    expect(f.state.players[0]).toMatchObject({ minerals: 800, gas: 800 }); f.tick(748); expect(f.state.economy.upgrades).toEqual([]); f.tick(); expect(f.state.economy.upgrades).toContainEqual({ playerId: 0, technologyId, level: 1 });
  });
  it('cancels research with a full refund and rejects duplicate research', () => {
    const f = fixture(), den = f.add(0, 'zerg-hydralisk-den'); f.add(0, 'zerg-lair', 46, 40);
    const c = { kind: 'research', entityIds: [den], payload: { technologyId: LURKER_ASPECT } };
    expect(f.issue(c).accepted).toBe(true); expect(f.issue(c).accepted).toBe(false); f.issue({ kind: 'cancelResearch', entityIds: [den] }); expect(f.state.players[0]).toMatchObject({ minerals: 1000, gas: 1000 });
  });
  it('reserves the final supply through a vulnerable 200 HP / armor 10 egg and keeps its group', () => {
    const f = fixture(), h = f.add(0, HYDRALISK), other = f.add(0, HYDRALISK, 43, 40); f.research(LURKER_ASPECT);
    f.issue({ kind: 'assignGroup', entityIds: [h, other], payload: { slot: 0, confirmed: false } }); const used = f.state.players[0].supplyUsedHalf;
    expect(morph(f, [h]).accepted).toBe(true); const i = indexOf(f.state, h);
    expect(f.state.players[0]).toMatchObject({ minerals: 950, gas: 900, supplyUsedHalf: used + 2 }); expect(f.state.entities.definitionId[i]).toBe(LURKER_EGG); expect(f.state.entities.health[i]).toBe(200); expect(economyDefinition(LURKER_EGG)!.armor).toBe(10);
    expect(unitMorphOf(f.state, h)?.remainingTicks).toBe(249); expect(parse(simulationStateSchema, f.state).ok).toBe(true); f.tick(248); expect(unitMorphOf(f.state, h)).toBeDefined(); f.tick();
    expect(f.state.entities.definitionId[i]).toBe(LURKER); expect(f.state.entities.health[i]).toBe(125); expect(f.state.players[0].supplyUsedHalf).toBe(used + 2); expect(f.state.players[0].controlGroups[0].entityIds).toEqual([h, other]);
    expect(f.issue({ kind: 'assignGroup', entityIds: [h, other], payload: { slot: 0, confirmed: false } }).accepted).toBe(true);
  });
  it('preserves HP ratio including fractional damage, cooldown, style, and cancel refunds', () => {
    const f = fixture(), h = f.add(0, HYDRALISK), i = indexOf(f.state, h); f.research(LURKER_ASPECT);
    f.state.entities.health[i] = 41; const r = f.state.combat!.records[i]; r.healthFraction = 128; r.remainder = 4; r.nextAttackTick = 1000;
    f.issue({ kind: 'setFormation', entityIds: [h], payload: { formation: 'column' } }); morph(f, [h]);
    expect(f.state.entities.health[i]).toBe(102); expect(f.state.combat!.records[i].healthFraction).toBe(192); expect(f.state.combat!.records[i].nextAttackTick).toBe(1000);
    expect(f.issue({ kind: 'cancelUnitMorph', entityIds: [h] }).accepted).toBe(true); expect(f.state.entities.definitionId[i]).toBe(HYDRALISK); expect(f.state.entities.health[i]).toBe(41); expect(f.state.combat!.records[i].healthFraction).toBe(128); expect(f.state.movement[i].formation).toBe('column'); expect(f.state.players[0]).toMatchObject({ minerals: 1000, gas: 1000 });
  });
  it('limits a multi-morph by resources and incremental supply in stable ID order', () => {
    const f = fixture(), a = f.add(0, HYDRALISK), b = f.add(0, HYDRALISK, 43, 40); f.research(LURKER_ASPECT); f.state.players[0].minerals = 50; f.state.players[0].gas = 100;
    expect(morph(f, [b, a])).toMatchObject({ accepted: true, executedEntityIds: [a] }); expect(f.state.lurker!.morphs.map(j => j.entityId)).toEqual([a]);
    f.issue({ kind: 'cancelUnitMorph', entityIds: [a] }); f.state.players[0].minerals = 1000; f.state.players[0].gas = 1000;
    while (f.state.players[0].supplyUsedHalf + 2 < f.state.players[0].supplyCapHalf) f.add(0, 'zerg-zergling', 70, 70);
    expect(morph(f, [b, a])).toMatchObject({ accepted: true, executedEntityIds: [a] }); expect(morph(f, [b])).toMatchObject({ accepted: false, code: 'insufficient_resource' });
  });
  it('rejects morph without research, while buried, in cargo, and invalid targets', () => {
    const f = fixture(), h = f.add(0, HYDRALISK), ship = f.add(0, 'zerg-overlord', 40, 41);
    expect(morph(f, [h])).toMatchObject({ accepted: false, code: 'missing_prerequisite' }); f.research(LURKER_ASPECT); f.research('burrowing'); burrow(f, h);
    expect(morph(f, [h])).toMatchObject({ accepted: false, code: 'invalid_state' }); burrow(f, h, false); f.research('ventral-sacs'); f.load([ship], h); f.tick(10); expect(isEmbarked(f.state, h)).toBe(true); expect(morph(f, [h]).accepted).toBe(false); expect(morph(f, [ship]).accepted).toBe(false);
  });
  it('locks egg commands and cargo, allows styles, cleans destroyed eggs without a refund', () => {
    const f = fixture(), h = f.add(0, HYDRALISK), ship = f.add(0, 'zerg-overlord', 40, 41); f.research(LURKER_ASPECT); f.research('ventral-sacs'); morph(f, [h]);
    for (const kind of ['move', 'attackMove', 'patrol']) expect(f.issue({ kind, entityIds: [h], target: { kind: 'point', x: 42 * 256, y: 40 * 256 } }).accepted).toBe(false);
    for (const kind of ['stop', 'hold']) expect(f.issue({ kind, entityIds: [h] }).accepted).toBe(false);
    expect(f.load([ship], h).accepted).toBe(false); expect(f.issue({ kind: 'setStance', entityIds: [h], payload: { stance: 'formation' } }).accepted).toBe(true);
    f.state.entities.health[indexOf(f.state, h)] = 0; f.tick(); expect(unitMorphOf(f.state, h)).toBeUndefined(); expect(f.state.entities.id).not.toContain(h); expect(f.state.players[0]).toMatchObject({ minerals: 950, gas: 900 }); expect(parse(simulationStateSchema, f.state).ok).toBe(true);
  });
  it('saves a mid-morph exactly and rejects orphan eggs and altered morph positions', () => {
    const f = fixture(), h = f.add(0, HYDRALISK); f.research(LURKER_ASPECT); morph(f, [h]); f.tick(13);
    const restored = restoreSnapshot(JSON.stringify(f.saved())); expect(restored.simulation.lurker).toEqual(f.state.lurker);
    for (let i = 0; i < 240; i++) { stepSimulation(f.state, f.rules); stepSimulation(restored.simulation, f.rules); } expect(checksum(restored.simulation)).toBe(checksum(f.state));
    const bad = structuredClone(f.state); bad.entities.definitionId[indexOf(bad, h)] = LURKER_EGG; expect(validLurker(bad)).toBe(false);
    morph(f, [f.add(0, HYDRALISK, 43, 40)]); f.state.lurker!.morphs[0].x++; expect(validLurker(f.state)).toBe(false);
  });
});
describe('buried Lurker ground waves', () => {
  it('uses innate burrow and only attacks while buried, without chasing focus targets', () => {
    const f = fixture(), h = f.add(0, LURKER), target = f.add(1, 'protoss-probe', 44, 40); f.tick(5); expect(f.state.lurker?.waves ?? []).toEqual([]);
    expect(burrow(f, h).accepted).toBe(true); expect(f.state.lurker!.waves.length).toBe(1); const i = indexOf(f.state, h), x = f.state.entities.x[i];
    expect(f.issue({ kind: 'focusAttack', entityIds: [h], target: { kind: 'entity', entityId: target } }).accepted).toBe(true);
    f.state.entities.x[indexOf(f.state, target)] = 60 * 256; f.tick(5); expect(f.state.entities.x[i]).toBe(x); expect(f.state.navigation.jobs.some(j => j.entityId === h)).toBe(false); expect(parse(simulationStateSchema, f.state).ok).toBe(true);
    expect(f.issue({ kind: 'move', entityIds: [h], target: { kind: 'point', x: 45 * 256, y: 40 * 256 } }).accepted).toBe(false); expect(burrow(f, h, false).accepted).toBe(true);
    f.state.lurker!.waves = []; f.tick(40); expect(f.state.lurker!.waves).toEqual([]);
  });
  it('damages multiple collinear enemies once each, ignoring allies and air bodies', () => {
    const f = fixture(), h = f.add(0, LURKER), a = f.add(1, 'protoss-probe', 43, 40), b = f.add(1, 'protoss-probe', 45, 40), ally = f.add(0, HYDRALISK, 42, 40), air = f.add(1, 'protoss-observer', 44, 40), off = f.add(1, 'protoss-probe', 44, 42);
    // Pure wave phase prevents unrelated ally weapons from contributing damage.
    launchSpines(f.state, indexOf(f.state, h), indexOf(f.state, a), 20 * 256, f.map); const hits: number[] = [];
    for (let n = 0; n < 20; n++) { f.state.tick++; hits.push(...advanceSpines(f.state).map(s => f.state.entities.id[s.b])); }
    expect(hits).toEqual([a, b]); expect(hits).not.toContain(ally); expect(hits).not.toContain(air); expect(hits).not.toContain(off);
  });
  it('applies original normal damage, shield absorption, armor, and 37-frame cadence', () => {
    const f = fixture(), h = f.add(0, LURKER), a = f.add(1, 'protoss-probe', 44, 40); burrow(f, h); f.tick(10);
    const i = indexOf(f.state, a); expect(f.state.entities.shield[i]).toBe(0); expect(f.state.entities.health[i]).toBe(20); expect(f.state.combat!.records.find(r => r.entityId === h)!.nextAttackTick).toBe(32);
    f.tick(20); expect(f.state.entities.health[i]).toBe(20);
  });
  it('keeps a fixed trajectory after target motion, source death or surfacing', () => {
    const f = fixture(), h = f.add(0, LURKER), a = f.add(1, 'protoss-probe', 44, 40), b = f.add(1, 'protoss-probe', 45, 40); burrow(f, h); const first = structuredClone(f.state.lurker!.waves[0]);
    expect(burrow(f, h, false).accepted).toBe(true); removeEntity(f.state, h); f.state.entities.y[indexOf(f.state, a)] += 2 * 256; f.tick(12);
    expect(f.state.entities.shield[indexOf(f.state, a)]).toBe(20); expect(f.state.entities.shield[indexOf(f.state, b)]).toBe(0); expect(first.toY).toBe(first.originY); expect(parse(simulationStateSchema, f.state).ok).toBe(true);
  });
  it('cannot acquire undetected burrowed targets but can hit a buried bystander', () => {
    const f = fixture('zerg', 'zerg'), h = f.add(0, LURKER), buried = f.add(1, HYDRALISK, 44, 40); f.state.economy.upgrades.push({ playerId: 1, technologyId: 'burrowing', level: 1 });
    f.issue({ kind: 'toggleStateAbility', entityIds: [buried], payload: { abilityId: 'burrow', enabled: true } }, 1); burrow(f, h); f.tick(5); expect(f.state.lurker?.waves ?? []).toEqual([]);
    const target = f.add(1, 'zerg-drone', 43, 40); f.tick(12); expect(f.state.entities.health[indexOf(f.state, buried)]).toBe(60); expect(f.state.entities.health[indexOf(f.state, target)]).toBe(20);
  });
  it('persists wave trajectory/remainders/hit IDs and keeps rendering anonymous', () => {
    const f = fixture(), h = f.add(0, LURKER), a = f.add(1, 'protoss-probe', 44, 40); burrow(f, h); f.tick(3);
    const restored = restoreSnapshot(JSON.stringify(f.saved())); expect(restored.simulation.lurker).toEqual(f.state.lurker);
    const view = f.view(1); expect(view.entities.some(e => e.id === h)).toBe(false); expect(view.groundWaves!.length).toBeGreaterThan(0); expect(Object.keys(view.groundWaves![0]).sort()).toEqual(['id', 'owner', 'x', 'y']); expect(validateRenderSnapshot(view).ok).toBe(true);
    for (let n = 0; n < 70; n++) { stepSimulation(f.state, f.rules); stepSimulation(restored.simulation, f.rules); } expect(checksum(restored.simulation)).toBe(checksum(f.state));
  });
  it('rejects out-of-bounds waves, counter collisions, and malformed private wave identities', () => {
    const f = fixture(), h = f.add(0, LURKER), a = f.add(1, 'protoss-probe', 44, 40); burrow(f, h); const wave = f.state.lurker!.waves[0]; expect(validLurker(f.state)).toBe(true);
    wave.toX = f.map.widthTiles * 256; expect(lurkerFitsMap(f.state, f.map)).toBe(false); wave.toX = 46 * 256; wave.id = f.state.counters.nextProjectileId; expect(validLurker(f.state)).toBe(false);
  });
  it.each([
    [{ x: 0, y: 0 }, { x: 100, y: 0 }, 30, 20, 40, 30, 20, true],
    [{ x: 0, y: 0 }, { x: 100, y: 0 }, 30, 21, 40, 30, 20, false],
    [{ x: 0, y: 0 }, { x: 100, y: 100 }, 50, 40, 60, 50, 0, true],
    [{ x: 0, y: 0 }, { x: 0, y: 0 }, 3, 4, 5, 6, 5, true],
    [{ x: 0, y: 0 }, { x: 0, y: 0 }, 3, 4, 5, 6, 4, false],
  ] as const)('uses exact swept hitbox boundaries %#', (a, b, left, top, right, bottom, radius, expected) => expect(spineIntersectsBox(a, b, left, top, right, bottom, radius)).toBe(expected));
  it('migrates stage 6D without changing energy, siege jobs, RNG, or the original backup', () => {
    const f = fixture('terran'), h = f.add(0, TANK_MODE); f.research(SIEGE_RESEARCH); f.issue({ kind: 'toggleStateAbility', entityIds: [h], payload: { abilityId: 'siege-mode', enabled: true } });
    const old = f.saved(); old.formatVersion = old.simulation.schemaVersion = 13; old.engineVersion = old.simulation.engineVersion = '0.14.0-stage6d'; old.dataVersion = old.simulation.dataVersion = old.dataVersion.replace(ECONOMY_DATA_VERSION, SIEGE_ECONOMY_DATA_VERSION); old.simulation.combat!.rulesVersion = SIEGE_COMBAT_RULES_VERSION; if (old.simulation.vision) old.simulation.vision.rulesVersion = "fog-2-permanent-cloak-cargo-observer11" as never; old.checksum = checksum(old.simulation);
    const raw = JSON.stringify(old), key = DEVELOPMENT_SAVE_PREFIX + 'terran', records = new Map([[key, raw]]), store = new DevelopmentSaveStore({ getItem: k => records.get(k) ?? null, setItem: (k, v) => { records.set(k, v); } }); const read = store.read('terran'); expect(read.status).toBe('ready'); if (read.status !== 'ready') throw Error('migration');
    expect(read.snapshot.formatVersion).toBe(16); expect(read.snapshot.simulation.siege).toEqual(old.simulation.siege); expect(read.snapshot.simulation.rngStreams).toEqual(old.simulation.rngStreams); expect(store.write(read.snapshot)).toBe(true); expect(records.get(key + '.stage6d-backup')).toBe(raw);
  });
});
