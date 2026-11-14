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
function fixture(race: Faction = "terran", enemy: Faction = "zerg") {
  const { map, dataVersion } = getRuntimeMap("rift-basin");
  const state = startSimulation(42, map.id, dataVersion, [0, 1].map((id) => ({ id, faction: id === 0 ? race : enemy, minerals: 1000, gas: 1000, supplyUsedHalf: 0, supplyCapHalf: 0 })));
  initializeEconomy(state, map); initializeCombat(state); initializeVision(state, map);
  for (const w of state.economy.workers) w.autoAllowed = false;
  const visible = (s: typeof state, p: number, i: number) => canSeeEntity(s, map, p, i);
  const rules = createSpecialRules(map, createCloakRules(createBurrowRules(map, createVisionRules(map, createCombatRules(createEconomyRules(map, createMovementRules(map, visible, combatReach)), visible, map)))));
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
describe("active cloaking and original energy", () => {
  it.each([['terran-ghost',10],['terran-wraith',13]] as const)("%s regenerates 8/256 per original frame and drains %i/256 only while cloaked",(definition,drain)=>{
    const f=fixture(),id=f.add(0,definition),r=energyOf(f.state,id)!;
    expect(r).toMatchObject({amount:50*256,frameRemainder:0});
    for(let n=0;n<5;n++)advanceEnergy(f.state);
    expect(r.amount).toBe(50*256+6*8);expect(r.frameRemainder).toBe(0);
    f.research(definition==='terran-ghost'?'personnel-cloaking':'cloaking-field');
    expect(f.issue({kind:'toggleStateAbility',entityIds:[id],payload:{abilityId:'cloak',enabled:true}}).accepted).toBe(true);
    const before=r.amount;for(let n=0;n<5;n++)advanceEnergy(f.state);
    expect(r.amount).toBe(before-6*drain);expect(activeCloak(f.state,id)).toBe(true);
  });
  it("caps energy at 200, rejects insufficient energy, duplicate toggles, wrong owners and unsupported actors",()=>{
    const f=fixture('terran','terran'),id=f.add(0,'terran-ghost'),wraith=f.add(0,'terran-wraith'),r=energyOf(f.state,id)!;
    const toggle=(ids:number[],enabled=true)=>f.issue({kind:'toggleStateAbility',entityIds:ids,payload:{abilityId:'cloak',enabled}});
    expect(toggle([id])).toMatchObject({accepted:false,code:'missing_prerequisite'});f.research('personnel-cloaking');
    r.amount=25*256-1;expect(toggle([id])).toMatchObject({accepted:false,code:'insufficient_resource'});
    r.amount=50*256;expect(toggle([wraith,id])).toMatchObject({accepted:true,executedEntityIds:[id]});expect(r.amount).toBeLessThan(25*256); // only the accepted unit pays
    expect(toggle([id])).toMatchObject({accepted:false,code:'invalid_state'});
    r.amount=1;f.tick(2);expect(activeCloak(f.state,id)).toBe(false);expect(r.amount).toBeGreaterThan(0);
    expect(toggle([f.state.economy.workers[0].entityId])).toMatchObject({accepted:false,code:'invalid_target'});
    const enemy=f.add(1,'terran-ghost');expect(toggle([enemy])).toMatchObject({accepted:false,code:'not_owner'});
    r.amount=200*256-1;f.tick(5);expect(r.amount).toBe(200*256);expect(parse(simulationStateSchema,f.state).ok).toBe(true);
  });
  it("decloaks in the energy phase before enemy targeting, and never spends below zero",()=>{
    const f=fixture(),ghost=f.add(0,'terran-ghost'),r=energyOf(f.state,ghost)!;f.research('personnel-cloaking');
    f.issue({kind:'toggleStateAbility',entityIds:[ghost],payload:{abilityId:'cloak',enabled:true}});r.amount=1;
    const attacker=f.add(1,'zerg-hydralisk',42,40);f.tick();expect(activeCloak(f.state,ghost)).toBe(false);
    expect(f.state.combat!.records.find(r=>r.entityId===attacker)!.nextAttackTick).toBeGreaterThan(f.state.tick);
    expect(r.amount).toBeGreaterThanOrEqual(0);
  });
  it("preserves movement, attack orders and cooldown when toggling, allows both ground and air attacks",()=>{
    const f=fixture(),ghost=f.add(0,'terran-ghost'),enemy=f.add(1,'zerg-drone',46,40);f.research('personnel-cloaking');
    f.issue({kind:'focusAttack',entityIds:[ghost],target:{kind:'entity',entityId:enemy}});
    expect(f.issue({kind:'toggleStateAbility',entityIds:[ghost],payload:{abilityId:'cloak',enabled:true}}).accepted).toBe(true);
    expect(f.state.movement[indexOf(f.state,ghost)].order).toBe('focusAttack');
    f.tick(25);expect(activeCloak(f.state,ghost)).toBe(true);expect(f.state.entities.health[indexOf(f.state,enemy)]).toBeLessThan(40);
    const wraith=f.add(0,'terran-wraith',40,43),air=f.add(1,'zerg-overlord',43,43),before=f.state.entities.health[indexOf(f.state,air)];
    expect(f.state.entities.layer[indexOf(f.state,wraith)]).toBe('air');
    f.issue({kind:'focusAttack',entityIds:[wraith],target:{kind:'entity',entityId:air}});f.tick(20);
    expect(f.state.entities.health[indexOf(f.state,air)]).toBeLessThan(before);
    f.issue({kind:'move',entityIds:[ghost],target:{kind:'point',x:42*256,y:42*256}});f.tick(20);expect(activeCloak(f.state,ghost)).toBe(true);
    f.issue({kind:'toggleStateAbility',entityIds:[ghost],payload:{abilityId:'cloak',enabled:false}});expect(activeCloak(f.state,ghost)).toBe(false);
  });
  it("hides active cloak from enemies without leaking energy or identity, then reveals it with a live detector",()=>{
    const f=fixture('terran','zerg'),ghost=f.add(0,'terran-ghost'),foe=f.add(1,'zerg-hydralisk',43,40);f.research('personnel-cloaking');
    f.issue({kind:'toggleStateAbility',entityIds:[ghost],payload:{abilityId:'cloak',enabled:true}});f.tick();
    expect(f.view().entities.find(e=>e.id===ghost)).toMatchObject({cloaked:true,maxEnergy:200});
    expect(f.view(1).entities.some(e=>e.id===ghost)).toBe(false);
    expect(f.issue({kind:'focusAttack',entityIds:[foe],target:{kind:'entity',entityId:ghost}},1).accepted).toBe(false);
    const detector=f.add(1,'zerg-overlord',42,42);f.tick();expect(f.view(1).entities.find(e=>e.id===ghost)).toMatchObject({cloaked:true,maxEnergy:200});
    removeEntity(f.state,detector);expect(f.view(1).entities.some(e=>e.id===ghost)).toBe(false);
    expect(validateRenderSnapshot(f.view()).ok).toBe(true);
  });
  it("continues consuming energy in cargo, preserves remainder across reload and removes dead passengers' records",()=>{
    const f=fixture(),ship=f.add(0,'terran-dropship'),ghost=f.add(0,'terran-ghost',41,40);f.research('personnel-cloaking');
    f.issue({kind:'toggleStateAbility',entityIds:[ghost],payload:{abilityId:'cloak',enabled:true}});f.load([ship],ghost);f.tick(15);
    expect(isEmbarked(f.state,ghost)).toBe(true);const r=energyOf(f.state,ghost)!,before=r.amount;
    expect(f.view().economy!.transports!.find(t=>t.entityId===ship)!.passengers[0]).toMatchObject({energy:Math.floor(before/256),maxEnergy:200});
    expect(f.issue({kind:'toggleStateAbility',entityIds:[ghost],payload:{abilityId:'cloak',enabled:false}}).accepted).toBe(false);
    const beforeSave=r.amount,saved=f.saved(),restored=restoreSnapshot(JSON.stringify(saved)).simulation;f.tick(25);for(let n=0;n<25;n++)stepSimulation(restored,f.rules);
    expect(r.amount).toBe(beforeSave-30*10);expect(checksum(restored)).toBe(checksum(f.state));
    f.unload([ship],43,40);f.tick(50);expect(activeCloak(f.state,ghost)).toBe(true);expect(isEmbarked(f.state,ghost)).toBe(false);
    f.load([ship],ghost);f.tick(20);expect(isEmbarked(f.state,ghost)).toBe(true);removeEntity(f.state,ship);expect(energyOf(f.state,ghost)).toBeUndefined();expect(parse(simulationStateSchema,f.state).ok).toBe(true);
  });
  it("rejects forged cloak/energy records, unsupported casters and missing research",()=>{
    const f=fixture(),id=f.add(0,'terran-ghost'),r=energyOf(f.state,id)!;f.research('personnel-cloaking');
    f.issue({kind:'toggleStateAbility',entityIds:[id],payload:{abilityId:'cloak',enabled:true}});
    const valid=structuredClone(f.state);r.amount=0;expect(validEnergy(f.state)).toBe(false);Object.assign(f.state,structuredClone(valid));
    f.state.energy!.push({...energyOf(f.state,id)!});expect(validEnergy(f.state)).toBe(false);Object.assign(f.state,structuredClone(valid));
    f.state.economy.upgrades=[];expect(validEnergy(f.state)).toBe(false);Object.assign(f.state,structuredClone(valid));
    f.state.energy![0].frameRemainder=5;expect(parse(simulationStateSchema,f.state).ok).toBe(false);Object.assign(f.state,structuredClone(valid));
    f.state.energy=[];expect(validEnergy(f.state)).toBe(false);
  });
});
describe("production, research and previous stage save",()=>{
  it("requires Academy and Covert Ops for Ghost production; Wraith only needs a Starport",()=>{
    const f=fixture(),b=f.add(0,'terran-barracks',42,40),port=f.add(0,'terran-starport',48,40);f.add(0,'terran-supply-depot',42,45);
    expect(f.issue({kind:'produce',entityIds:[b],payload:{unitId:'terran-ghost'}}).accepted).toBe(false);
    f.add(0,'terran-academy',20,25);expect(f.issue({kind:'produce',entityIds:[b],payload:{unitId:'terran-ghost'}}).accepted).toBe(false);
    const science=f.add(0,'terran-science-facility',18,22),ops=f.add(0,'terran-covert-ops',22,22);structureOf(f.state,ops)!.addonParentId=science;expect(f.issue({kind:'produce',entityIds:[b],payload:{unitId:'terran-ghost'}}).accepted).toBe(true);
    expect(f.issue({kind:'produce',entityIds:[port],payload:{unitId:'terran-wraith'}}).accepted).toBe(true);f.tick(375);
    for(const def of ['terran-ghost','terran-wraith']){const id=f.state.entities.id.find((id,i)=>f.state.entities.definitionId[i]===def)!;expect(energyOf(f.state,id)?.amount).toBeGreaterThanOrEqual(50*256);}
  });
  it.each([['terran-covert-ops','personnel-cloaking',100,500],['terran-control-tower','cloaking-field',150,625]] as const)("%s pays research, prevents duplicates, refunds cancellation and finishes on time",(building,tech,cost,ticks)=>{
    const f=fixture(),id=f.add(0,building,42,40),other=f.add(0,building,46,40);const parent=f.add(0,building==='terran-covert-ops'?'terran-science-facility':'terran-starport',42,37);structureOf(f.state,id)!.addonParentId=parent;const t=ECONOMY_UPGRADES.find(t=>t.id===tech)!;expect(t).toMatchObject({minerals:cost,gas:cost,ticks});
    f.issue({kind:'research',entityIds:[id],payload:{technologyId:tech}});expect(f.state.players[0]).toMatchObject({minerals:1000-cost,gas:1000-cost});
    expect(f.issue({kind:'research',entityIds:[other],payload:{technologyId:tech}}).accepted).toBe(false);
    f.issue({kind:'cancelResearch',entityIds:[id]});expect(f.state.players[0]).toMatchObject({minerals:1000,gas:1000});
    f.issue({kind:'research',entityIds:[id],payload:{technologyId:tech}});f.tick(ticks-2);expect(f.state.economy.upgrades.some(u=>u.technologyId===tech)).toBe(false);f.tick();expect(f.state.economy.upgrades.some(u=>u.technologyId===tech)).toBe(true);
  });
  it("migrates a stage6B cargo save without losing concealed units, groups, RNG or queues and backs up the raw save",()=>{
    const f=fixture(),ship=f.add(0,'terran-dropship'),troop=f.add(0,'terran-marine',41,40);f.load([ship],troop);f.tick(20);
    const old=structuredClone(f.saved());old.formatVersion=old.simulation.schemaVersion=11;old.engineVersion=old.simulation.engineVersion='0.12.0-stage6b';old.simulation.combat!.rulesVersion=SPECIAL_COMBAT_RULES_VERSION as never;
    old.dataVersion=old.simulation.dataVersion=old.dataVersion.replace(ECONOMY_DATA_VERSION,SPECIAL_ECONOMY_DATA_VERSION);if (old.simulation.vision) old.simulation.vision.rulesVersion = "fog-2-permanent-cloak-cargo-observer11" as never; old.checksum = checksum(old.simulation);
    const raw=JSON.stringify(old),key=DEVELOPMENT_SAVE_PREFIX+'terran',records=new Map([[key,raw]]),store=new DevelopmentSaveStore({getItem:k=>records.get(k)??null,setItem:(k,v)=>{records.set(k,v);}}),read=store.read('terran');
    expect(read.status).toBe('ready');if(read.status!=='ready')throw Error('migration');expect(read.snapshot.formatVersion).toBe(15);expect(read.snapshot.simulation.special).toEqual(old.simulation.special);expect(read.snapshot.simulation.rngStreams).toEqual(old.simulation.rngStreams);expect(store.write(read.snapshot)).toBe(true);expect(records.get(key+'.stage6b-backup')).toBe(raw);
    const invalid=structuredClone(old);invalid.simulation.energy=[];invalid.checksum=checksum(invalid.simulation);expect(()=>restoreSnapshot(JSON.stringify(invalid))).toThrow();
  });
});

describe("attached research infrastructure",()=>{
  it("constructs Covert Ops on its Science Facility, pauses orphan research and prevents using orphan prerequisites",()=>{
    const f=fixture(),parent=f.add(0,'terran-science-facility',42,40),barracks=f.add(0,'terran-barracks',36,40);f.add(0,'terran-academy',20,25);
    expect(f.issue({kind:'placeBuilding',entityIds:[parent],target:{kind:'point',x:0,y:0},payload:{buildingId:'terran-covert-ops'}}).accepted).toBe(true);
    f.tick(250);const ops=f.state.entities.id.find((id,i)=>f.state.entities.definitionId[i]==='terran-covert-ops')!;expect(structureOf(f.state,ops)!.addonParentId).toBe(parent);
    expect(f.issue({kind:'research',entityIds:[ops],payload:{technologyId:'personnel-cloaking'}}).accepted).toBe(true);const remaining=structureOf(f.state,ops)!.research!.remainingTicks;
    removeEntity(f.state,parent);f.tick(10);expect(structureOf(f.state,ops)!.research!.remainingTicks).toBe(remaining);
    expect(f.issue({kind:'produce',entityIds:[barracks],payload:{unitId:'terran-ghost'}}).accepted).toBe(false);
    expect(f.view().economy!.structures.find(b=>b.entityId===ops)!.powered).toBe(false);
    expect(f.issue({kind:'cancelResearch',entityIds:[ops]}).accepted).toBe(true);expect(f.issue({kind:'research',entityIds:[ops],payload:{technologyId:'personnel-cloaking'}}).accepted).toBe(false);
  });
  it("restores a near-depleted cloak and pending toggle at the exact fractional frame, then consumes identically",()=>{
    const f=fixture(),id=f.add(0,'terran-wraith');f.research('cloaking-field');f.issue({kind:'toggleStateAbility',entityIds:[id],payload:{abilityId:'cloak',enabled:true}});energyOf(f.state,id)!.amount=14;energyOf(f.state,id)!.frameRemainder=4;
    const restored=restoreSnapshot(JSON.stringify(f.saved())).simulation;f.tick(5);for(let n=0;n<5;n++)stepSimulation(restored,f.rules);expect(checksum(restored)).toBe(checksum(f.state));expect(activeCloak(f.state,id)).toBe(false);
    const c={kind:'toggleStateAbility',entityIds:[id],payload:{abilityId:'cloak',enabled:true},sequence:f.state.commandState.lastAcceptedSequenceByPlayer[0]+1,playerId:0,issuedTick:f.state.tick,executeTick:f.state.tick+3,source:'player'};energyOf(f.state,id)!.amount=50*256;expect(enqueueCommand(f.state,c,f.rules).ok).toBe(true);
    const future=restoreSnapshot(JSON.stringify(f.saved())).simulation;f.tick(10);for(let n=0;n<10;n++)stepSimulation(future,f.rules);expect(checksum(future)).toBe(checksum(f.state));expect(activeCloak(f.state,id)).toBe(true);
  });
});

describe('non-interrupting cloak command',()=>{
  it('preserves a passenger approach when activating cloak before boarding',()=>{
    const f=fixture(),ship=f.add(0,'terran-dropship'),ghost=f.add(0,'terran-ghost',46,40);f.research('personnel-cloaking');f.load([ship],ghost);
    expect(f.issue({kind:'toggleStateAbility',entityIds:[ghost],payload:{abilityId:'cloak',enabled:true}}).accepted).toBe(true);expect(carrierOf(f.state,ship)!.loadQueue).toContain(ghost);
    f.tick(100);expect(isEmbarked(f.state,ghost)).toBe(true);expect(activeCloak(f.state,ghost)).toBe(true);
  });
});
