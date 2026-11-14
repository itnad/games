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
function fixture(race: Faction = "terran", enemy: Faction = "zerg") {
  const { map, dataVersion } = getRuntimeMap("rift-basin"); map.height.fill(0);
  const state = startSimulation(42, map.id, dataVersion, [0, 1].map((id) => ({ id, faction: id === 0 ? race : enemy, minerals: 1000, gas: 1000, supplyUsedHalf: 0, supplyCapHalf: 0 })));
  initializeEconomy(state, map); initializeCombat(state); initializeVision(state, map);
  for (const w of state.economy.workers) w.autoAllowed = false;
  const visible = (s: typeof state, p: number, i: number) => canSeeEntity(s, map, p, i);
  const rules = createSpecialRules(map, createSiegeRules(createCloakRules(createBurrowRules(map, createVisionRules(map, createCombatRules(createEconomyRules(map, createMovementRules(map, visible, combatReach)), visible, map))))));
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
function deploy(f:ReturnType<typeof fixture>,id:number,enabled=true){f.research(SIEGE_RESEARCH);expect(f.issue({kind:'toggleStateAbility',entityIds:[id],payload:{abilityId:'siege-mode',enabled}}).accepted).toBe(true);f.tick(SIEGE_TRANSITION_TICKS-1);}
describe('siege research and timed modes',()=>{
  it('uses original 150/150 research at an attached Machine Shop and finishes on tick 500',()=>{
    const f=fixture(),factory=f.add(0,'terran-factory',42,40),shop=f.add(0,'terran-machine-shop',46,40),other=f.add(0,'terran-machine-shop',50,40),technologyId=SIEGE_RESEARCH;
    expect(ECONOMY_UPGRADES.find(t=>t.id===technologyId)).toMatchObject({minerals:150,gas:150,frames:1200,ticks:500});
    expect(f.issue({kind:'research',entityIds:[shop],payload:{technologyId}}).accepted).toBe(false);structureOf(f.state,shop)!.addonParentId=factory;
    expect(f.issue({kind:'research',entityIds:[shop],payload:{technologyId}}).accepted).toBe(true);expect(f.state.players[0]).toMatchObject({minerals:850,gas:850});
    expect(f.issue({kind:'research',entityIds:[other],payload:{technologyId}}).accepted).toBe(false);f.issue({kind:'cancelResearch',entityIds:[shop]});expect(f.state.players[0]).toMatchObject({minerals:1000,gas:1000});
    f.issue({kind:'research',entityIds:[shop],payload:{technologyId}});f.tick(498);expect(f.state.economy.upgrades).toEqual([]);f.tick();expect(f.state.economy.upgrades).toContainEqual({playerId:0,technologyId,level:1});
  });
  it('rejects missing research, unsupported units, duplicate transitions and enemy orders without charging resources',()=>{
    const f=fixture('terran','terran'),tank=f.add(0,TANK_MODE),enemy=f.add(1,TANK_MODE),worker=f.state.economy.workers[0].entityId;
    const toggle=(id:number)=>f.issue({kind:'toggleStateAbility',entityIds:[id],payload:{abilityId:'siege-mode',enabled:true}});
    expect(toggle(tank)).toMatchObject({accepted:false,code:'missing_prerequisite'});f.research(SIEGE_RESEARCH);expect(toggle(worker)).toMatchObject({accepted:false,code:'invalid_target'});expect(toggle(enemy)).toMatchObject({accepted:false,code:'not_owner'});
    const before={minerals:f.state.players[0].minerals,gas:f.state.players[0].gas};expect(toggle(tank).accepted).toBe(true);expect(toggle(tank)).toMatchObject({accepted:false,code:'invalid_state'});expect(f.state.players[0]).toMatchObject(before);expect(siegeTransitionOf(f.state,tank)).toBeDefined();
  });
  it('interrupts movement and locks commands for 40 ticks, preserving health fractions, groups, style and cooldown',()=>{
    const f=fixture(),tank=f.add(0,TANK_MODE),other=f.add(0,TANK_MODE,43,40),i=indexOf(f.state,tank);f.research(SIEGE_RESEARCH);
    f.issue({kind:'assignGroup',entityIds:[tank,other],payload:{slot:0,confirmed:false}});f.issue({kind:'setFormation',entityIds:[tank],payload:{formation:'column'}});f.issue({kind:'setStance',entityIds:[tank],payload:{stance:'formation'}});
    f.issue({kind:'move',entityIds:[tank],target:{kind:'point',x:46*256,y:40*256}});f.state.entities.health[i]=121;const r=f.state.combat!.records.find(r=>r.entityId===tank)!;r.healthFraction=111;r.nextAttackTick=f.state.tick+120;r.remainder=4;const next=r.nextAttackTick;
    f.issue({kind:'toggleStateAbility',entityIds:[tank],payload:{abilityId:'siege-mode',enabled:true}});const x=f.state.entities.x[i],y=f.state.entities.y[i];
    for(const kind of ['move','attackMove','patrol','stop','hold'] as const){const b=['move','attackMove','patrol'].includes(kind)?{kind,entityIds:[tank],target:{kind:'point',x:42*256,y:44*256}}:{kind,entityIds:[tank]};expect(f.issue(b).accepted).toBe(false);}
    expect(f.state.navigation.jobs.some(j=>j.entityId===tank)).toBe(false);f.tick(33);expect(siegeTransitionOf(f.state,tank)).toBeDefined();f.tick();expect(siegeTransitionOf(f.state,tank)).toBeUndefined();
    expect(f.state.entities.definitionId[i]).toBe(SIEGE_MODE);expect(f.state.entities.x[i]).toBe(x);expect(f.state.entities.y[i]).toBe(y);expect(f.state.entities.health[i]).toBe(121);expect(f.state.entities.speed[i]).toBe(0);
    expect(f.state.combat!.records.find(r=>r.entityId===tank)).toMatchObject({healthFraction:111,nextAttackTick:next,remainder:4});expect(f.state.players[0].controlGroups[0].entityIds).toEqual([tank,other]);expect(f.state.movement[i]).toMatchObject({formation:'column',stance:'formation'});expect(parse(simulationStateSchema,f.state).ok).toBe(true);
    expect(f.issue({kind:'assignGroup',entityIds:[tank,other],payload:{slot:0,confirmed:false}}).accepted).toBe(true);deploy(f,tank,false);expect(f.state.entities.definitionId[i]).toBe(TANK_MODE);expect(f.state.entities.speed[i]).toBe(economyDefinition(TANK_MODE)!.speed);expect(f.state.combat!.records.find(r=>r.entityId===tank)!.healthFraction).toBe(111);
  });
  it('keeps deployed tanks immobile for focus targets, target loss, stop, formation and mixed movement orders',()=>{
    const f=fixture('terran','terran'),tank=f.add(0,TANK_MODE),mobile=f.add(0,TANK_MODE,42,42);deploy(f,tank);const i=indexOf(f.state,tank),origin={x:f.state.entities.x[i],y:f.state.entities.y[i]},foe=f.add(1,'terran-scv',53,40);f.add(0,'terran-scv',51,42);
    expect(f.issue({kind:'focusAttack',entityIds:[tank],target:{kind:'entity',entityId:foe}}).accepted).toBe(true);f.tick(30);expect(f.state.entities.x[i]).toBe(origin.x);expect(f.state.entities.y[i]).toBe(origin.y);expect(f.state.navigation.jobs.some(j=>j.entityId===tank)).toBe(false);
    removeEntity(f.state,foe);f.tick();expect(f.state.movement[i].order).toMatch(/idle|hold/);expect(f.issue({kind:'move',entityIds:[tank,mobile],target:{kind:'point',x:44*256,y:42*256}})).toMatchObject({accepted:true,executedEntityIds:[mobile]});f.tick(50);expect(f.state.entities.x[i]).toBe(origin.x);expect(f.state.entities.y[i]).toBe(origin.y);
  });
  it('refuses loading a deployed or transitioning tank and preserves 4-slot cargo after undeploy',()=>{
    const f=fixture(),tank=f.add(0,TANK_MODE),ship=f.add(0,'terran-dropship',41,40);f.research(SIEGE_RESEARCH);f.issue({kind:'toggleStateAbility',entityIds:[tank],payload:{abilityId:'siege-mode',enabled:true}});
    expect(f.load([ship],tank).accepted).toBe(false);f.tick(39);expect(f.load([ship],tank).accepted).toBe(false);deploy(f,tank,false);expect(f.load([ship],tank).accepted).toBe(true);f.tick(20);expect(isEmbarked(f.state,tank)).toBe(true);expect(occupiedSpace(f.state,carrierOf(f.state,ship)!)).toBe(4);expect(f.issue({kind:'toggleStateAbility',entityIds:[tank],payload:{abilityId:'siege-mode',enabled:true}}).accepted).toBe(false);
  });
});
describe('siege cannon reach and splash',()=>{
  it('uses 70 explosive damage, a 75-frame cadence, 2..12 tile body-edge range and no air weapon',()=>{
    expect(SIEGE_CANNON).toMatchObject({defaultWpnDamageAmt:70,wpnDamageCooldowns:75,wpnMinRange:64,wpnMaxRange:384,damageType:'Explosive',wpnSplashRangeInner:10,wpnSplashRangeMid:25,wpnSplashRangeOuter:40});expect(weaponFor(SIEGE_MODE,'air')).toBeUndefined();
    const f=fixture('terran','terran'),tank=f.add(0,TANK_MODE);deploy(f,tank);const i=indexOf(f.state,tank);
    for(const [x,expected] of [[42,false],[43,true],[52,true],[54,false]] as const){const target=f.add(1,'terran-scv',x,40);expect(weaponInRange(f.state,i,indexOf(f.state,target))).toBe(expected);removeEntity(f.state,target);}
  });
  it('needs forward sight for long-range targets and cannot fire or chase under minimum range',()=>{
    const f=fixture('terran','terran'),tank=f.add(0,TANK_MODE);deploy(f,tank);const foe=f.add(1,'terran-scv',52,40),near=f.add(1,'terran-scv',41,40);f.tick(20);expect(f.state.entities.health[indexOf(f.state,foe)]).toBe(60);expect(f.state.entities.health[indexOf(f.state,near)]).toBe(60);
    const spotter=f.add(0,'terran-scv',50,42);f.tick();expect(f.state.entities.health[indexOf(f.state,foe)]).toBe(25);expect(f.state.entities.health[indexOf(f.state,near)]).toBe(60);expect(f.state.combat!.records.find(r=>r.entityId===tank)!.nextAttackTick-f.state.tick).toBeGreaterThanOrEqual(62);expect(f.state.entities.x[indexOf(f.state,tank)]).toBe(40*256);removeEntity(f.state,spotter);
  });
  it('classifies the exact 10/25/40-pixel splash boundaries by hitbox distance',()=>{
    const f=fixture('terran','terran'),tank=f.add(0,TANK_MODE),p=combatProfile('terran-scv')!,ids=[] as number[],distances=[10,11,25,26,40,41];
    for(const distance of distances)ids.push(f.add(1,'terran-scv',48+(p.bounds[0]+distance)/32,40));
    const hits=siegeSplashTargets(f.state,indexOf(f.state,tank),48*256,40*256);expect(ids.map(id=>hits.find(h=>h.index===indexOf(f.state,id))?.divisor)).toEqual([1,2,2,4,4,undefined]);
  });
  it('applies full/half/quarter splash to enemies and allies before armor and size, excluding air and the source',()=>{
    const f=fixture('terran','terran'),tank=f.add(0,TANK_MODE);deploy(f,tank);const target=f.add(1,'terran-scv',48,40),p=combatProfile('terran-scv')!,inner=f.add(0,'terran-scv',48,40),mid=f.add(1,'terran-scv',48+(p.bounds[0]+20)/32,40),outer=f.add(0,'terran-scv',48+(p.bounds[0]+35)/32,40),air=f.add(0,'terran-dropship',48,40),hp=f.state.entities.health[indexOf(f.state,tank)];
    f.tick();expect(f.state.entities.health[indexOf(f.state,target)]).toBe(25);expect(f.state.entities.health[indexOf(f.state,inner)]).toBe(25);expect(f.state.entities.health[indexOf(f.state,mid)]).toBe(43);expect(f.state.entities.health[indexOf(f.state,outer)]).toBe(52);expect(f.state.entities.health[indexOf(f.state,air)]).toBe(150);expect(f.state.entities.health[indexOf(f.state,tank)]).toBe(hp);expect(f.state.combat!.effects.some(e=>e.kind==='impact'&&e.weaponId===SIEGE_CANNON.name)).toBe(true);
  });
  it('does not damage embarked cargo or unstarted blueprints and only splashes burrowed units in the inner radius',()=>{
    const f=fixture('terran','zerg'),tank=f.add(0,TANK_MODE),ship=f.add(0,'terran-dropship',48,40),cargo=f.add(0,'terran-scv',48,40);f.load([ship],cargo);f.tick(15);expect(isEmbarked(f.state,cargo)).toBe(true);deploy(f,tank);
    f.state.economy.upgrades.push({playerId:1,technologyId:'burrowing',level:1});const target=f.add(1,'zerg-drone',48,40),p=combatProfile('zerg-drone')!,inner=f.add(1,'zerg-drone',48,40),outer=f.add(1,'zerg-drone',48+(p.bounds[0]+20)/32,40);
    for(const id of [inner,outer])f.state.vision!.concealed.push({entityId:id,kind:'burrow'});const bp=f.add(0,'terran-supply-depot',48,40);structureOf(f.state,bp)!.started=false;structureOf(f.state,bp)!.completedTick=-1;const initial=f.state.entities.health[indexOf(f.state,bp)];
    f.tick();expect(f.state.entities.health[indexOf(f.state,inner)]).toBe(5);expect(f.state.entities.health[indexOf(f.state,outer)]).toBe(40);expect(f.state.entities.health[indexOf(f.state,cargo)]).toBe(60);expect(f.state.entities.health[indexOf(f.state,bp)]).toBe(initial);
  });
});
describe('saved siege transitions and compatibility',()=>{
  it('restores a partially completed transition and produces identical RNG, cooldown, health and future state',()=>{
    const f=fixture(),tank=f.add(0,TANK_MODE);f.research(SIEGE_RESEARCH);f.issue({kind:'toggleStateAbility',entityIds:[tank],payload:{abilityId:'siege-mode',enabled:true}});f.tick(13);
    const saved=f.saved(),restored=restoreSnapshot(JSON.stringify(saved)).simulation;expect(restored.siege).toEqual(f.state.siege);f.tick(90);for(let n=0;n<90;n++)stepSimulation(restored,f.rules);expect(checksum(restored)).toBe(checksum(f.state));expect(f.view().entities.find(e=>e.id===tank)!.definitionId).toBe(SIEGE_MODE);expect(validateRenderSnapshot(f.view()).ok).toBe(true);
    f.issue({kind:'toggleStateAbility',entityIds:[tank],payload:{abilityId:'siege-mode',enabled:false}});const second=restoreSnapshot(JSON.stringify(f.saved())).simulation;f.tick(60);for(let n=0;n<60;n++)stepSimulation(second,f.rules);expect(checksum(second)).toBe(checksum(f.state));
  });
  it('cleans up a destroyed transitioning tank and rejects forged transition state',()=>{
    const f=fixture(),tank=f.add(0,TANK_MODE);f.research(SIEGE_RESEARCH);f.issue({kind:'toggleStateAbility',entityIds:[tank],payload:{abilityId:'siege-mode',enabled:true}});const saved=structuredClone(f.state);f.state.siege![0].x++;expect(validSiege(f.state)).toBe(false);Object.assign(f.state,structuredClone(saved));f.state.siege!.push({...f.state.siege![0]});expect(validSiege(f.state)).toBe(false);Object.assign(f.state,structuredClone(saved));removeEntity(f.state,tank);expect(f.state.siege).toEqual([]);expect(parse(simulationStateSchema,f.state).ok).toBe(true);
  });
  it('migrates a checked stage6C active cloak save while preserving energy, RNG and the original raw backup',()=>{
    const f=fixture(),ghost=f.add(0,'terran-ghost');f.research('personnel-cloaking');expect(f.issue({kind:'toggleStateAbility',entityIds:[ghost],payload:{abilityId:'cloak',enabled:true}}).accepted).toBe(true);expect(activeCloak(f.state,ghost)).toBe(true);f.tick(7);const old=structuredClone(f.saved());old.formatVersion=old.simulation.schemaVersion=12;old.engineVersion=old.simulation.engineVersion='0.13.0-stage6c';old.simulation.combat!.rulesVersion=CLOAK_COMBAT_RULES_VERSION as never;old.dataVersion=old.simulation.dataVersion=old.dataVersion.replace(ECONOMY_DATA_VERSION,CLOAK_ECONOMY_DATA_VERSION);old.checksum=checksum(old.simulation);
    const key=DEVELOPMENT_SAVE_PREFIX+'terran',raw=JSON.stringify(old),records=new Map([[key,raw]]),store=new DevelopmentSaveStore({getItem:k=>records.get(k)??null,setItem:(k,v)=>{records.set(k,v);}}),read=store.read('terran');expect(read.status).toBe('ready');if(read.status!=='ready')throw Error('migration');expect(read.snapshot.formatVersion).toBe(14);expect(read.snapshot.simulation.energy).toEqual(old.simulation.energy);expect(read.snapshot.simulation.rngStreams).toEqual(old.simulation.rngStreams);expect(store.write(read.snapshot)).toBe(true);expect(records.get(key+'.stage6c-backup')).toBe(raw);
    old.simulation.siege=[];old.checksum=checksum(old.simulation);expect(()=>restoreSnapshot(JSON.stringify(old))).toThrow();
  });
});

describe('visible siege consequences',()=>{
  it('shows an anonymous impact when artillery fires from outside the victim view',()=>{
    const f=fixture('terran','terran'),tank=f.add(0,TANK_MODE);deploy(f,tank);f.add(0,'terran-scv',50,42);const foe=f.add(1,'terran-scv',52,40);f.tick();
    const impact=f.state.combat!.effects.find(e=>e.kind==='impact'&&e.weaponId===SIEGE_CANNON.name)!;expect(impact).toMatchObject({owner:0,x:52*256,y:40*256,toX:52*256,toY:40*256});expect(canSeeEntity(f.state,f.map,1,indexOf(f.state,tank))).toBe(false);
    const view=f.view(1);expect(view.combat!.effects.some(e=>e.kind==='hiddenAttack'&&e.x===52*256&&e.y===40*256&&e.weaponId===undefined)).toBe(true);expect(view.entities.some(e=>e.id===tank)).toBe(false);expect(validateRenderSnapshot(view).ok).toBe(true);
  });
  it('applies outer splash to shields before health using the divided damage',()=>{
    const f=fixture('terran','protoss'),tank=f.add(0,TANK_MODE);deploy(f,tank);const target=f.add(1,'protoss-probe',48,40),p=combatProfile('protoss-probe')!,outer=f.add(1,'protoss-probe',48+(p.bounds[0]+35)/32,40);f.tick();
    expect(f.state.entities.health[indexOf(f.state,outer)]).toBe(20);expect(f.state.entities.shield[indexOf(f.state,outer)]).toBe(3);expect(f.state.combat!.records.find(r=>r.entityId===outer)!.shieldFraction).toBe(128);
  });
});
