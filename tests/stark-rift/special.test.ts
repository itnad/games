import { describe, expect, it, vi } from "vitest";
import { createSpecialRules } from "../../app/stark-rift/abilities/special-rules";
import { createBurrowRules } from "../../app/stark-rift/abilities/burrow-rules";
import { isEmbarked, carrierOf, occupiedSpace, transportCapacity, unitTraits, permanentCloak, morphOf } from "../../app/stark-rift/abilities/special-state";
import { getRuntimeMap } from "../../app/stark-rift/data/maps";
import { ECONOMY_DEFINITIONS, ECONOMY_UPGRADES, ECONOMY_DATA_VERSION, BURROW_ECONOMY_DATA_VERSION, economyDefinition, type Faction } from "../../app/stark-rift/data/economy-catalog";
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
function fixture(race: Faction = "terran", enemy: Faction = "zerg") {
  const { map, dataVersion } = getRuntimeMap("rift-basin");
  const state = startSimulation(42, map.id, dataVersion, [0, 1].map((id) => ({ id, faction: id === 0 ? race : enemy, minerals: 1000, gas: 1000, supplyUsedHalf: 0, supplyCapHalf: 0 })));
  initializeEconomy(state, map); initializeCombat(state); initializeVision(state, map);
  for (const w of state.economy.workers) w.autoAllowed = false;
  const visible = (s: typeof state, p: number, i: number) => canSeeEntity(s, map, p, i);
  const rules = createSpecialRules(map, createBurrowRules(map, createVisionRules(map, createCombatRules(createEconomyRules(map, createMovementRules(map, visible, combatReach)), visible, map))));
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
  const research = (id: string) => state.economy.upgrades.push({ playerId: 0, technologyId: id, level: 1 });
  const load = (ships: number[], passenger: number) => issue({ kind: "loadTransport", entityIds: ships, target: { kind: "entity", entityId: passenger } });
  const unload = (ships: number[], x = 40, y = 40) => issue({ kind: "unloadTransport", entityIds: ships, target: { kind: "point", x: x * 256, y: y * 256 } });
  const saved = () => createPersistenceEnvelope(state, session, [], "2026-11-12T00:00:00.000Z");
  const view = (owner = 0) => createRenderSnapshot(state, map, owner, visibilityMask(state, map, owner));
  return { state, map, rules, add, research, tick, issue, load, unload, saved, view };
}
describe("original cloak and transport content", () => {
  it("keeps original costs, air layers, permanent cloak and unit-specific cargo slots", () => {
    expect(ECONOMY_DEFINITIONS).toHaveLength(47);
    expect(economyDefinition("protoss-observer")).toMatchObject({ minerals: 25, gas: 75, supply: 2 });
    expect(economyDefinition("protoss-dark-templar")).toMatchObject({ minerals: 125, gas: 100 });
    expect(unitTraits("terran-dropship")?.spaceProvided).toBe(8);
    expect(unitTraits("terran-marine")?.spaceRequired).toBe(1);
    expect(unitTraits("terran-siege-tank-tank-mode")?.spaceRequired).toBe(4);
    expect(permanentCloak("protoss-observer")).toBe(true); expect(permanentCloak("protoss-dark-templar")).toBe(true);
  });
  it("requires this Starport's own Control Tower to produce a Dropship", () => {
    const f = fixture(), port = f.add(0, "terran-starport", 42, 40), other = f.add(0, "terran-starport", 48, 40), tower = f.add(0, "terran-control-tower", 51, 40);
    structureOf(f.state, tower)!.addonParentId = other;
    expect(f.issue({ kind: "produce", entityIds: [port], payload: { unitId: "terran-dropship" } }).accepted).toBe(false);
    expect(f.issue({ kind: "produce", entityIds: [other], payload: { unitId: "terran-dropship" } }).accepted).toBe(true);
    f.tick(economyDefinition("terran-dropship")!.ticks); expect(f.state.entities.definitionId).toContain("terran-dropship");
    const i = f.state.entities.definitionId.indexOf("terran-dropship"); expect(f.state.entities.layer[i]).toBe("air");
  });
  it("retains Hatchery larvae, home, reservations and damage across Lair morph then researches transport", () => {
    const f = fixture("zerg"), hq = f.state.economy.structures[0].entityId; f.add(0, "zerg-spawning-pool", 20, 18);
    const i = indexOf(f.state, hq); f.state.entities.health[i] -= 100;
    const record = f.state.combat!.records[i]; record.healthFraction = 128;
    expect(f.issue({ kind: "morphStructure", entityIds: [hq], payload: { buildingId: "zerg-lair" } }).accepted).toBe(true);
    expect(f.issue({ kind: "produce", entityIds: [hq], payload: { unitId: "zerg-drone" } }).accepted).toBe(true);
    expect(f.issue({ kind: "research", entityIds: [hq], payload: { technologyId: "burrowing" } }).accepted).toBe(false);
    f.tick(economyDefinition("zerg-lair")!.ticks);
    expect(f.state.entities.definitionId[indexOf(f.state, hq)]).toBe("zerg-lair"); expect(structureOf(f.state, hq)!.larva).toBeGreaterThan(0);
    expect(f.state.entities.health[indexOf(f.state, hq)]).toBe(economyDefinition("zerg-lair")!.health - 100);
    expect(f.state.combat!.records[indexOf(f.state, hq)].healthFraction).toBe(128);
    expect(f.issue({ kind: "research", entityIds: [hq], payload: { technologyId: "ventral-sacs" } }).accepted).toBe(true);
    f.tick(ECONOMY_UPGRADES.find((t) => t.id === "ventral-sacs")!.ticks);
    const lord = f.state.entities.id.find((id, j) => f.state.entities.definitionId[j] === "zerg-overlord")!;
    expect(transportCapacity(f.state, lord)).toBe(8); expect(parse(simulationStateSchema, f.state).ok).toBe(true);
  });
  it("charges only the selected eligible morph, refuses duplicate spending and refunds 75% on cancellation", () => {
    const f = fixture("zerg"), a = f.state.economy.structures[0].entityId; f.add(0, "zerg-spawning-pool", 22, 18); const b = f.add(0, "zerg-hatchery", 40, 40);
    f.state.players[0].minerals = 150; f.state.players[0].gas = 100;
    expect(f.issue({ kind: "morphStructure", entityIds: [b, a], payload: { buildingId: "zerg-lair" } })).toMatchObject({ accepted: true, executedEntityIds: [a] });
    expect(morphOf(f.state, a)).toBeDefined(); expect(morphOf(f.state, b)).toBeUndefined();
    expect(f.issue({ kind: "morphStructure", entityIds: [b], payload: { buildingId: "zerg-lair" } }).accepted).toBe(false);
    f.issue({ kind: "cancelStructureMorph", entityIds: [a] }); expect(f.state.players[0]).toMatchObject({ minerals: 112, gas: 75 });
  });
  it("does not refund a destroyed morph and removes its pending reservation", () => {
    const f = fixture("zerg"), hq = f.state.economy.structures[0].entityId; f.add(0, "zerg-spawning-pool", 22, 18);
    f.issue({ kind: "morphStructure", entityIds: [hq], payload: { buildingId: "zerg-lair" } }); const minerals = f.state.players[0].minerals;
    removeEntity(f.state, hq); expect(f.state.special!.morphs).toEqual([]); expect(f.state.players[0].minerals).toBe(minerals);
  });
  it("produces a cloaked Dark Templar only with Archives and an air Observer only with Observatory", () => {
    const f = fixture("protoss"), pylon = f.add(0, "protoss-pylon", 40, 40), gate = f.add(0, "protoss-gateway", 43, 40), robo = f.add(0, "protoss-robotics-facility", 40, 43);
    expect(f.issue({ kind: "produce", entityIds: [gate], payload: { unitId: "protoss-dark-templar" } }).accepted).toBe(false);
    f.add(0, "protoss-templar-archives", 18, 18); f.add(0, "protoss-observatory", 20, 18);
    expect(f.issue({ kind: "produce", entityIds: [gate], payload: { unitId: "protoss-dark-templar" } }).accepted).toBe(true);
    expect(f.issue({ kind: "produce", entityIds: [robo], payload: { unitId: "protoss-observer" } }).accepted).toBe(true);
    f.tick(320); const observer = f.state.entities.definitionId.indexOf("protoss-observer"); expect(observer).toBeGreaterThan(-1); expect(f.state.entities.layer[observer]).toBe("air");
  });
});
describe("transport orders and cargo", () => {
  it.each([['terran','terran-dropship','terran-marine'],['protoss','protoss-shuttle','protoss-zealot'],['zerg','zerg-overlord','zerg-hydralisk']] as const)("%s loads and unloads through real movement", (race, shipType, troopType) => {
    const f = fixture(race), ship = f.add(0, shipType), troop = f.add(0, troopType, 46, 40); if (race === "zerg") f.research("ventral-sacs");
    expect(f.load([ship], troop).accepted).toBe(true); expect(isEmbarked(f.state, troop)).toBe(false); f.tick(100); expect(isEmbarked(f.state, troop)).toBe(true);
    const v = f.view(); expect(v.entities.some((e) => e.id === troop)).toBe(false); expect(v.economy!.transports!.find((t) => t.entityId === ship)!.passengers[0].id).toBe(troop); expect(validateRenderSnapshot(v).ok).toBe(true);
    expect(f.unload([ship], 44, 40).accepted).toBe(true); f.tick(160); expect(isEmbarked(f.state, troop)).toBe(false); expect(f.state.entities.x[indexOf(f.state, troop)]).toBeGreaterThan(42 * 256); expect(f.state.movement[indexOf(f.state, troop)].order).toBe("hold");
  });
  it("enforces eight original slots, counting reservations and large units before they board", () => {
    const f = fixture(), ship = f.add(0, "terran-dropship"), a = f.add(0, "terran-siege-tank-tank-mode", 46, 40), b = f.add(0, "terran-siege-tank-tank-mode", 47, 40), c = f.add(0, "terran-marine", 48, 40);
    expect(f.load([ship], a).accepted).toBe(true); expect(f.load([ship], b).accepted).toBe(true); expect(occupiedSpace(f.state, carrierOf(f.state, ship)!)).toBe(8);
    expect(f.load([ship], c).accepted).toBe(false); expect(isEmbarked(f.state, c)).toBe(false);
  });
  it("distributes between selected carriers deterministically and preserves supply and group membership", () => {
    const f = fixture(), a = f.add(0, "terran-dropship"), b = f.add(0, "terran-dropship", 44, 40), troops = [f.add(0, "terran-siege-tank-tank-mode", 41, 40), f.add(0, "terran-siege-tank-tank-mode", 42, 40), f.add(0, "terran-siege-tank-tank-mode", 43, 40)];
    f.issue({ kind: "assignGroup", entityIds: troops, payload: { slot: 0, confirmed: false } }); const supply = f.state.players[0].supplyUsedHalf;
    for (const troop of troops) expect(f.load([b, a], troop).accepted).toBe(true);
    f.tick(50); expect(f.state.special!.transports.reduce((n,t) => n+t.passengers.length,0)).toBe(3); expect(f.state.players[0].controlGroups[0].entityIds).toEqual(troops); expect(f.state.players[0].supplyUsedHalf).toBe(supply);
  });
  it("requires Overlord transport research and rejects air, burrowed, building, enemy and duplicate targets", () => {
    const f = fixture("zerg"), ship = f.add(0,"zerg-overlord"), troop = f.add(0,"zerg-zergling",41,40), enemy = f.add(1,"zerg-drone",42,40);
    expect(f.load([ship],troop)).toMatchObject({accepted:false,code:"missing_prerequisite"}); f.research("ventral-sacs"); f.research("burrowing");
    expect(f.load([ship],ship).accepted).toBe(false); expect(f.load([ship], f.state.economy.structures[0].entityId).accepted).toBe(false); expect(f.load([ship],enemy).accepted).toBe(false);
    f.issue({kind:"toggleStateAbility",entityIds:[troop],payload:{abilityId:"burrow",enabled:true}}); expect(f.load([ship],troop).accepted).toBe(false);
    f.issue({kind:"toggleStateAbility",entityIds:[troop],payload:{abilityId:"burrow",enabled:false}}); expect(f.load([ship],troop).accepted).toBe(true); expect(f.load([ship],troop).accepted).toBe(false);
  });
  it("stops a worker's previous task but preserves its resource cargo while aboard", () => {
    const f=fixture(),ship=f.add(0,"terran-dropship"),worker=f.add(0,"terran-scv",41,40),w=workerOf(f.state,worker)!;
    w.cargoMinerals=8;expect(f.load([ship],worker).accepted).toBe(true);expect(isEmbarked(f.state,worker)).toBe(true);expect(w).toMatchObject({cargoMinerals:8,task:"idle",autoAllowed:false});
    expect(f.issue({kind:"autoGather",entityIds:[worker]})).toMatchObject({accepted:false,code:"invalid_state"}); f.unload([ship]);f.tick(30);expect(w.cargoMinerals).toBe(8);expect(w.autoAllowed).toBe(false);
  });
  it("cancels a boarding reservation when the passenger receives an explicit new order", () => {
    const f=fixture(),ship=f.add(0,"terran-dropship"),troop=f.add(0,"terran-marine",48,40);f.load([ship],troop);
    expect(f.issue({kind:"move",entityIds:[troop],target:{kind:"point",x:48*256,y:44*256}}).accepted).toBe(true);expect(carrierOf(f.state,ship)?.loadQueue??[]).toEqual([]);f.tick(60);expect(isEmbarked(f.state,troop)).toBe(false);
  });
  it("cancels approach orders with a carrier stop and retains already loaded cargo", () => {
    const f=fixture(),ship=f.add(0,"terran-dropship"),a=f.add(0,"terran-marine",41,40),b=f.add(0,"terran-marine",48,40);f.load([ship],a);f.load([ship],b);
    f.issue({kind:"stop",entityIds:[ship]});expect(isEmbarked(f.state,a)).toBe(true);expect(isEmbarked(f.state,b)).toBe(false);expect(f.state.movement[indexOf(f.state,b)].order).toBe("idle");expect(carrierOf(f.state,ship)!.loadQueue).toEqual([]);
  });
  it("keeps several requested portrait unloads in order rather than replacing the previous one", () => {
    const f=fixture(),ship=f.add(0,"terran-dropship"),a=f.add(0,"terran-marine",41,40),b=f.add(0,"terran-marine",41,41),c=f.add(0,"terran-marine",40,41);for(const id of [a,b,c])f.load([ship],id);
    for(const id of [a,b])expect(f.issue({kind:"unloadPassenger",entityIds:[ship],target:{kind:"point",x:40*256,y:40*256},payload:{passengerId:id}}).accepted).toBe(true);
    f.tick(20);expect(isEmbarked(f.state,a)).toBe(false);expect(isEmbarked(f.state,b)).toBe(false);expect(isEmbarked(f.state,c)).toBe(true);
  });
  it("retains cargo if all nearby ground is blocked and retries after ground becomes available", () => {
    const f=fixture(),ship=f.add(0,"terran-dropship"),troop=f.add(0,"terran-marine",41,40);f.load([ship],troop);
    const old=f.map.walkable.slice();f.map.walkable.fill(0);expect(f.unload([ship]).accepted).toBe(true);f.tick(15);expect(isEmbarked(f.state,troop)).toBe(true);expect(carrierOf(f.state,ship)!.unloads).toHaveLength(1);
    f.map.walkable.set(old);f.tick(15);expect(isEmbarked(f.state,troop)).toBe(false);
  });
  it("flies to the nearest usable landing point when the requested water cell cannot hold a passenger", () => {
    const f=fixture(),ship=f.add(0,"terran-dropship",40,44),troop=f.add(0,"terran-marine",41,44);f.load([ship],troop);expect(f.unload([ship],40,47).accepted).toBe(true);
    expect(isEmbarked(f.state,troop)).toBe(true);f.tick(100);expect(isEmbarked(f.state,troop)).toBe(false);const i=indexOf(f.state,troop);expect(new NavigationGrid(f.map,f.state).clear({x:f.state.entities.x[i],y:f.state.entities.y[i]},f.state.entities.radius[i],"ground",troop)).toBe(true);
  });
  it("removes all passengers, supply and group references when their carrier dies", () => {
    const f=fixture(),ship=f.add(0,"terran-dropship"),a=f.add(0,"terran-marine",41,40),b=f.add(0,"terran-marine",40,41);f.issue({kind:"assignGroup",entityIds:[a,b],payload:{slot:0,confirmed:false}});f.load([ship],a);f.load([ship],b);const used=f.state.players[0].supplyUsedHalf;
    f.state.entities.health[indexOf(f.state,ship)]=0;f.tick();expect(f.state.entities.id).not.toContain(a);expect(f.state.entities.id).not.toContain(b);expect(f.state.players[0].supplyUsedHalf).toBe(used-4-4);expect(f.state.players[0].controlGroups[0].entityIds).toEqual([]);expect(parse(simulationStateSchema,f.state).ok).toBe(true);
  });
  it("loaded infantry cannot attack or provide vision, and enemies cannot target it or inspect the manifest", () => {
    const f=fixture(),ship=f.add(0,"terran-dropship"),troop=f.add(0,"terran-siege-tank-tank-mode",41,40),enemy=f.add(1,"zerg-drone",42,40);f.load([ship],troop);const hp=f.state.entities.health[indexOf(f.state,enemy)];f.tick(20);
    expect(f.state.entities.health[indexOf(f.state,enemy)]).toBe(hp);expect(canSeeEntity(f.state,f.map,1,indexOf(f.state,troop))).toBe(false);expect(f.view(1).economy!.transports!.some(t=>t.entityId===ship)).toBe(false);
    expect(visibilityMask(f.state,f.map,0)[40*96+49]).not.toBe(2);
    expect(f.issue({kind:"focusAttack",entityIds:[troop],target:{kind:"entity",entityId:enemy}}).accepted).toBe(false);
  });
});
describe("permanent cloak and hidden information", () => {
  it("does not expose an undetected Dark Templar but shows only an anonymous attack-position warning", () => {
    const f=fixture("terran","protoss"),own=f.add(0,"terran-siege-tank-tank-mode"),dt=f.add(1,"protoss-dark-templar",41,40);
    f.tick();expect(canSeeEntity(f.state,f.map,0,indexOf(f.state,dt))).toBe(false);const view=f.view();expect(view.entities.some(e=>e.id===dt)).toBe(false);expect(view.combat!.effects.some(e=>e.kind==="hiddenAttack")).toBe(true);
    expect(view.combat!.effects.every(e=>!("sourceId" in e))).toBe(true);expect(view.combat!.effects.filter(e=>e.kind==="hiddenAttack").every(e=>e.weaponId===undefined)).toBe(true);expect(validateRenderSnapshot(view).ok).toBe(true);
  });
  it("Observer reveals a cloaked enemy for allied attacks and loses detection immediately on death", () => {
    const f=fixture("protoss","protoss"),dragoon=f.add(0,"protoss-dragoon"),dt=f.add(1,"protoss-dark-templar",43,40);f.tick();
    expect(f.issue({kind:"focusAttack",entityIds:[dragoon],target:{kind:"entity",entityId:dt}}).accepted).toBe(false);
    const observer=f.add(0,"protoss-observer",42,42);f.tick();expect(canSeeEntity(f.state,f.map,0,indexOf(f.state,dt))).toBe(true);expect(f.view().entities.find(e=>e.id===dt)?.cloaked).toBe(true);
    expect(f.issue({kind:"focusAttack",entityIds:[dragoon],target:{kind:"entity",entityId:dt}}).accepted).toBe(true);removeEntity(f.state,observer);expect(canSeeEntity(f.state,f.map,0,indexOf(f.state,dt))).toBe(false);
  });
  it("maintains a Dark Templar's permanent cloak after carrying and landing it", () => {
    const f=fixture("protoss","protoss"),ship=f.add(0,"protoss-shuttle"),dt=f.add(0,"protoss-dark-templar",41,40),enemy=f.add(1,"protoss-zealot",44,40);f.load([ship],dt);f.unload([ship]);f.tick(20);
    expect(isEmbarked(f.state,dt)).toBe(false);expect(f.view().entities.find(e=>e.id===dt)?.cloaked).toBe(true);expect(canSeeEntity(f.state,f.map,1,indexOf(f.state,dt))).toBe(false);
  });
});
describe("special persistence and practice", () => {
  it("replays saved boarding and unloading orders identically without leaking or duplicating passengers", () => {
    const f=fixture(),ship=f.add(0,"terran-dropship"),troop=f.add(0,"terran-marine",41,40),other=f.add(0,"terran-dropship",45,44),loading=f.add(0,"terran-marine",52,44);f.load([ship],troop);f.load([other],loading);f.unload([ship],44,40);
    const copy=restoreSnapshot(JSON.stringify(f.saved())).simulation;
    for(let i=0;i<90;i++){f.tick();stepSimulation(copy,f.rules);expect(checksum(copy)).toBe(checksum(f.state));}
  });
  it.each(["owner","position","capacity","duplicate","activeOrder"])("rejects corrupted cargo: %s", defect=>{
    const f=fixture(),ship=f.add(0,"terran-dropship"),a=f.add(0,"terran-marine",41,40);f.load([ship],a);const i=indexOf(f.state,a);
    if(defect==="owner")f.state.entities.owner[i]=1;if(defect==="position")f.state.entities.x[i]++;if(defect==="capacity")carrierOf(f.state,ship)!.passengers.push(f.add(0,"terran-siege-tank-tank-mode",42,40),f.add(0,"terran-siege-tank-tank-mode",43,40));
    if(defect==="duplicate")carrierOf(f.state,ship)!.loadQueue.push(a);if(defect==="activeOrder")f.state.movement[i].order="hold";
    expect(parse(simulationStateSchema,f.state).ok).toBe(false);
  });
  it.each(["terran","zerg","protoss"] as const)("%s special practice starts and its save remains separate from economy", race=>{
    const f=fixture(race,"protoss");initializeCombat(f.state,"special-practice");initializeVision(f.state,f.map);f.tick(2);expect(f.state.players[0].supplyCapHalf).toBeGreaterThanOrEqual(f.state.players[0].supplyUsedHalf);expect(f.view().economy!.transports!.filter(t=>t.capacity>0).length).toBeGreaterThanOrEqual(2);
    const records=new Map<string,string>();const store=new DevelopmentSaveStore({getItem:k=>records.get(k)??null,setItem:(k,v)=>{records.set(k,v);}});expect(store.write(f.saved())).toBe(true);expect(store.read(race,"special-practice").status).toBe("ready");expect(store.read(race).status).toBe("empty");
  });
  it("migrates checked 6A burrow and preserves raw backups while adopting the new data bundle",()=>{
    const f=fixture("zerg"),drone=f.state.economy.workers[0].entityId;f.research("burrowing");f.issue({kind:"toggleStateAbility",entityIds:[drone],payload:{abilityId:"burrow",enabled:true}});
    const old=JSON.parse(JSON.stringify(f.saved()));old.formatVersion=old.simulation.schemaVersion=10;old.engineVersion=old.simulation.engineVersion="0.11.0-stage6a";old.simulation.combat.rulesVersion=BURROW_COMBAT_RULES_VERSION;old.simulation.vision.rulesVersion="fog-1-los-edge-detector11-memory600";old.dataVersion=old.simulation.dataVersion=old.dataVersion.replace(ECONOMY_DATA_VERSION,BURROW_ECONOMY_DATA_VERSION);old.checksum=checksum(old.simulation);
    const key=DEVELOPMENT_SAVE_PREFIX+"zerg",raw=JSON.stringify(old),records=new Map([[key,raw]]),store=new DevelopmentSaveStore({getItem:k=>records.get(k)??null,setItem:(k,v)=>{records.set(k,v);}});const read=store.read("zerg");expect(read.status).toBe("ready");if(read.status!=="ready")throw Error();expect(read.snapshot.simulation.vision!.concealed).toEqual(old.simulation.vision.concealed);expect(read.snapshot.simulation.rngStreams).toEqual(old.simulation.rngStreams);expect(store.write(read.snapshot)).toBe(true);expect(records.get(key+".stage6a-backup")).toBe(raw);
  });
});

describe("simultaneous landing and incoming fire", () => {
  it("lands multiple carriers' heavy cargo without overlap while retaining its formation and groups", () => {
    const f = fixture(), a = f.add(0,"terran-dropship"), b = f.add(0,"terran-dropship",44,40), troops = [f.add(0,"terran-siege-tank-tank-mode",41,40),f.add(0,"terran-siege-tank-tank-mode",42,40),f.add(0,"terran-siege-tank-tank-mode",43,40)];
    f.issue({kind:"assignGroup",entityIds:troops,payload:{slot:0,confirmed:false}});f.issue({kind:"setFormation",entityIds:troops,payload:{formation:"column"}});
    for(const id of troops)f.load([a,b],id);f.tick(40);f.unload([a,b],46,40);f.tick(200);
    for(const id of troops){expect(isEmbarked(f.state,id)).toBe(false);expect(f.state.movement[indexOf(f.state,id)]).toMatchObject({formation:"column",order:"hold"});}
    for(let n=0;n<troops.length;n++)for(let m=n+1;m<troops.length;m++){
      const i=indexOf(f.state,troops[n]),j=indexOf(f.state,troops[m]),e=f.state.entities;expect((e.x[i]-e.x[j])**2+(e.y[i]-e.y[j])**2).toBeGreaterThanOrEqual((e.radius[i]+e.radius[j])**2);
    }
    expect(f.state.players[0].controlGroups[0].entityIds).toEqual(troops);
  });
  it("fizzles an already fired enemy missile when its target boards, without damaging passengers inside", () => {
    const f=fixture("terran","terran"),ship=f.add(0,"terran-dropship"),troop=f.add(0,"terran-marine",41,40),enemy=f.add(1,"terran-vulture",43,40);
    f.tick();expect(f.state.combat!.projectiles).toHaveLength(1);const hp=f.state.entities.health[indexOf(f.state,troop)];expect(f.load([ship],troop).accepted).toBe(true);f.tick(15);
    expect(f.state.entities.health[indexOf(f.state,troop)]).toBe(hp);expect(f.state.combat!.projectiles).toEqual([]);expect(isEmbarked(f.state,troop)).toBe(true);
  });
});
