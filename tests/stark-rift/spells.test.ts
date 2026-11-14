import { createSpellsRules, resolveRecall, spellArea } from "../../app/stark-rift/abilities/spells-rules";
import { RECALL, STASIS, RECALL_TICKS, STASIS_TICKS, isInStasis, recallOf, validSpells, spellsFitMap } from "../../app/stark-rift/abilities/spells-state";
import { energyOf, ENERGY } from "../../app/stark-rift/abilities/cloak-state";
import { ECONOMY_UPGRADES, ARBITER_ECONOMY_DATA_VERSION } from "../../app/stark-rift/data/economy-catalog";
import { ARBITER_COMBAT_RULES_VERSION } from "../../app/stark-rift/combat/state";
import { ARBITER_VISION_RULES_VERSION } from "../../app/stark-rift/vision/state";
import { describe, expect, it, vi } from "vitest";
import { ARBITER, ARBITER_RANGE, coveredByArbiter } from "../../app/stark-rift/abilities/arbiter";
import { createLurkerRules } from "../../app/stark-rift/abilities/lurker-rules";
import { createSiegeRules } from "../../app/stark-rift/abilities/siege-rules";
import { createCloakRules } from "../../app/stark-rift/abilities/cloak-rules";
import { activeCloak } from "../../app/stark-rift/abilities/cloak-state";
import { createSpecialRules } from "../../app/stark-rift/abilities/special-rules";
import { createBurrowRules } from "../../app/stark-rift/abilities/burrow-rules";
import { isEmbarked } from "../../app/stark-rift/abilities/special-state";
import { getRuntimeMap } from "../../app/stark-rift/data/maps";
import { economyDefinition, ECONOMY_DATA_VERSION, LURKER_ECONOMY_DATA_VERSION, type Faction } from "../../app/stark-rift/data/economy-catalog";
import { initializeEconomy, createEconomicEntity, newStructure, recomputeSupply, workerOf, releaseWork, indexOf, structureOf, meetsRequirements } from "../../app/stark-rift/economy/helpers";
import { createEconomyRules } from "../../app/stark-rift/economy/rules";
import { initializeCombat, synchronizeCombat, createCombatRules, combatReach } from "../../app/stark-rift/combat/rules";
import { combatProfile, weaponFor } from "../../app/stark-rift/combat/catalog";
import { LURKER_COMBAT_RULES_VERSION } from "../../app/stark-rift/combat/state";
import { initializeVision, visibilityMask, canSeeEntity, createVisionRules } from "../../app/stark-rift/vision/rules";
import { createMovementRules } from "../../app/stark-rift/core/movement-rules";
import { startSimulation, enqueueCommand, stepSimulation } from "../../app/stark-rift/core/simulation";
import { createPersistenceEnvelope, restoreSnapshot, simulationStateSchema } from "../../app/stark-rift/core/state";
import { parse } from "../../app/stark-rift/core/validation";
import { checksum } from "../../app/stark-rift/core/checksum";
import { removeEntity } from "../../app/stark-rift/core/world";
import { createRenderSnapshot, validateRenderSnapshot } from "../../app/stark-rift/worker/render-snapshot";
import { DevelopmentSaveStore, DEVELOPMENT_SAVE_PREFIX } from "../../app/stark-rift/ui/development-saves";
import type { GameCommand } from "../../app/stark-rift/core/commands";
vi.setConfig({ testTimeout: 30000 });
const session = { camera: { centerX: 22 * 256, centerY: 20 * 256, zoomLevel: 1 as const }, selection: { entityIds: [], controlGroupIds: [] }, openPanel: null };
function fixture(race: Faction = "protoss", enemy: Faction = "terran") {
  const { map, dataVersion } = getRuntimeMap("rift-basin"); map.height.fill(0);
  const state = startSimulation(42, map.id, dataVersion, [0, 1].map((id) => ({ id, faction: id === 0 ? race : enemy, minerals: 1000, gas: 1000, supplyUsedHalf: 0, supplyCapHalf: 0 })));
  initializeEconomy(state, map); initializeCombat(state); initializeVision(state, map);
  for (const w of state.economy.workers) w.autoAllowed = false;
  const visible = (s: typeof state, p: number, i: number) => canSeeEntity(s, map, p, i);
  const rules = createSpellsRules(map, createSpecialRules(map, createLurkerRules(createSiegeRules(createCloakRules(createBurrowRules(map, createVisionRules(map, createCombatRules(createEconomyRules(map, createMovementRules(map, visible, combatReach)), visible, map))))))));
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
type F = ReturnType<typeof fixture>;
function caster(f:F,x=40,y=40){const id=f.add(0,ARBITER,x,y);energyOf(f.state,id)!.amount=200*256;f.research(RECALL);f.research(STASIS);return id;}
const cast=(f:F,id:number,abilityId:string,x:number,y:number)=>f.issue({kind:'castAbility',entityIds:[id],payload:{abilityId},target:{kind:'point',x:x*256,y:y*256}});
describe('Arbiter spells and research',()=>{
  it.each([[RECALL,750],[STASIS,625]] as const)('researches %s at a powered Tribunal, charges 150/150 and supports full cancellation', (technologyId,ticks)=>{
    const f=fixture(),b=f.add(0,'protoss-arbiter-tribunal',42,40);f.add(0,'protoss-pylon',40,40);const body={kind:'research',entityIds:[b],payload:{technologyId}};
    expect(ECONOMY_UPGRADES.find(t=>t.id===technologyId)).toMatchObject({minerals:150,gas:150,ticks});expect(f.issue(body).accepted).toBe(true);expect(f.state.players[0]).toMatchObject({minerals:850,gas:850});expect(f.issue(body).accepted).toBe(false);
    f.issue({kind:'cancelResearch',entityIds:[b]});expect(f.state.players[0]).toMatchObject({minerals:1000,gas:1000});f.issue(body);f.tick(ticks-1);expect(f.state.economy.upgrades).toContainEqual({playerId:0,technologyId,level:1});
  });
  it('starts ordinary Arbiters at 50 energy and regenerates fixed original frames, including while frozen',()=>{
    const f=fixture(),a=f.add(0,ARBITER);expect(energyOf(f.state,a)).toMatchObject({amount:12800,frameRemainder:0});f.tick(5);expect(energyOf(f.state,a)).toMatchObject({amount:12848,frameRemainder:0});
    const c=caster(f,43,40);cast(f,c,STASIS,40,40);const before=energyOf(f.state,a)!.amount;f.tick(5);expect(energyOf(f.state,a)!.amount).toBe(before+48);
  });
  it('rejects missing research, energy, unsupported actors, invalid targets and multi-caster batches without charging',()=>{
    const f=fixture(),a=f.add(0,ARBITER),b=f.add(0,ARBITER,43,40);expect(cast(f,a,RECALL,40,40)).toMatchObject({accepted:false,code:'missing_prerequisite'});f.research(RECALL);expect(cast(f,a,RECALL,40,40)).toMatchObject({accepted:false,code:'insufficient_resource'});energyOf(f.state,a)!.amount=200*256;
    expect(cast(f,a,RECALL,-1,40).accepted).toBe(false);expect(cast(f,f.state.economy.workers[0].entityId,RECALL,40,40).accepted).toBe(false);
    expect(f.issue({kind:'castAbility',entityIds:[a,b],payload:{abilityId:RECALL},target:{kind:'point',x:40*256,y:40*256}}).accepted).toBe(false);expect(energyOf(f.state,a)!.amount).toBe(200*256);
  });
  it('applies stasis to allied and enemy ground/air bodies, excluding source, buildings, cargo, buried and already frozen units',()=>{
    const f=fixture('protoss','zerg'),a=caster(f),ally=f.add(0,'protoss-zealot',44,40),enemy=f.add(1,'zerg-hydralisk',44,41),air=f.add(1,'zerg-overlord',45,40),building=f.add(0,'protoss-pylon',44,40),buried=f.add(1,'zerg-zergling',43,40),ship=f.add(0,'protoss-shuttle',44,41),cargo=f.add(0,'protoss-zealot',45,41);
    f.load([ship],cargo);f.tick(5);f.state.economy.upgrades.push({playerId:1,technologyId:'burrowing',level:1});f.issue({kind:'toggleStateAbility',entityIds:[buried],payload:{abilityId:'burrow',enabled:true}},1);
    expect(cast(f,a,STASIS,44,40).accepted).toBe(true);for(const id of [ally,enemy,air,ship])expect(isInStasis(f.state,id)).toBe(true);for(const id of [a,building,cargo,buried])expect(isInStasis(f.state,id)).toBe(false);
    const expires=f.state.spells!.stasis.find(r=>r.entityId===ally)!.expiresTick;energyOf(f.state,a)!.amount=200*256;cast(f,a,STASIS,44,40);expect(f.state.spells!.stasis.find(r=>r.entityId===ally)!.expiresTick).toBe(expires);expect(validSpells(f.state)).toBe(true);
  });
  it('checks square hitbox boundaries and stasis cast range without charging out-of-range casts',()=>{
    const f=fixture(),a=caster(f),id=f.add(0,'protoss-zealot',45,40),i=indexOf(f.state,id),p=combatProfile('protoss-zealot')!;
    f.state.entities.x[i]=44*256+48*8+p.bounds[0]*8;expect(spellArea(f.state,i,44*256,40*256,48*8)).toBe(true);f.state.entities.x[i]++;expect(spellArea(f.state,i,44*256,40*256,48*8)).toBe(false);
    expect(cast(f,a,STASIS,51,40)).toMatchObject({accepted:false,code:'out_of_range'});expect(energyOf(f.state,a)!.amount).toBe(200*256);
  });
  it('locks movement, attack and cargo, grants immunity and automatically thaws after the saved duration',()=>{
    const f=fixture('protoss','terran'),a=caster(f),enemy=f.add(1,'terran-marine',44,40),ship=f.add(1,'terran-dropship',44,42);cast(f,a,STASIS,44,40);const i=indexOf(f.state,enemy),health=f.state.entities.health[i],position={x:f.state.entities.x[i],y:f.state.entities.y[i]},until=f.state.spells!.stasis.find(r=>r.entityId===enemy)!.expiresTick;
    expect(f.issue({kind:'move',entityIds:[enemy],target:{kind:'point',x:46*256,y:40*256}},1).accepted).toBe(false);expect(f.issue({kind:'loadTransport',entityIds:[ship],target:{kind:'entity',entityId:enemy}},1).accepted).toBe(false);expect(f.issue({kind:'focusAttack',entityIds:[a],target:{kind:'entity',entityId:enemy}}).accepted).toBe(false);
    while(f.state.tick<until-1)f.tick();expect(isInStasis(f.state,enemy)).toBe(true);expect(f.state.entities.health[i]).toBe(health);expect({x:f.state.entities.x[i],y:f.state.entities.y[i]}).toEqual(position);f.tick();expect(isInStasis(f.state,enemy)).toBe(false);expect(parse(simulationStateSchema,f.state).ok).toBe(true);
  });
  it('disables a frozen Arbiter aura and frozen detectors, restoring both on thaw',()=>{
    const f=fixture('protoss','protoss'),a=caster(f),other=f.add(0,ARBITER,44,40),ally=f.add(0,'protoss-zealot',48,40),observer=f.add(1,'protoss-observer',47,40);expect(coveredByArbiter(f.state,indexOf(f.state,ally))).toBe(true);cast(f,a,STASIS,44,40);expect(isInStasis(f.state,other)).toBe(true);expect(coveredByArbiter(f.state,indexOf(f.state,ally))).toBe(false);
    // Pure status queries do not require detector visibility to the caster.
    const row=f.state.spells!.stasis.find(r=>r.entityId===other)!;f.state.entities.x[indexOf(f.state,a)]=47*256;energyOf(f.state,a)!.amount=200*256;cast(f,a,STASIS,47,40);expect(isInStasis(f.state,observer)).toBe(true);expect(canSeeEntity(f.state,f.map,1,indexOf(f.state,ally))).toBe(false);
  });
  it('pauses a morphing egg and preserves its paid reservation through stasis',()=>{
    const f=fixture('protoss','zerg'),a=caster(f),h=f.add(1,'zerg-hydralisk',44,40);f.state.economy.upgrades.push({playerId:1,technologyId:'lurker-aspect',level:1});f.issue({kind:'morphUnit',entityIds:[h],payload:{unitId:'zerg-lurker'}},1);const before=f.state.lurker!.morphs[0].remainingTicks;cast(f,a,STASIS,44,40);f.tick(20);expect(f.state.lurker!.morphs[0].remainingTicks).toBe(before);expect(f.state.entities.definitionId[indexOf(f.state,h)]).toBe('zerg-lurker-egg');
  });
  it('charges recall once, locks its caster, samples source units after its delay and preserves groups/cooldowns',()=>{
    const f=fixture(),a=caster(f),z=f.add(0,'protoss-zealot',55,40);f.issue({kind:'assignGroup',entityIds:[z],payload:{slot:0,confirmed:false}});const r=f.state.combat!.records.find(r=>r.entityId===z)!;r.nextAttackTick=500;r.healthFraction=128;f.state.entities.health[indexOf(f.state,z)]=99;
    expect(cast(f,a,RECALL,55,40).accepted).toBe(true);expect(energyOf(f.state,a)!.amount).toBeGreaterThanOrEqual(50*256);expect(recallOf(f.state,a)?.remainingTicks).toBe(RECALL_TICKS-1);expect(f.issue({kind:'move',entityIds:[a],target:{kind:'point',x:42*256,y:40*256}}).accepted).toBe(false);
    f.tick(RECALL_TICKS-2);expect(recallOf(f.state,a)).toBeUndefined();const i=indexOf(f.state,z);expect(Math.abs(f.state.entities.x[i]-40*256)).toBeLessThan(6*256);expect(f.state.players[0].controlGroups[0].entityIds).toEqual([z]);expect(f.state.combat!.records.find(r=>r.entityId===z)).toMatchObject({healthFraction:128,nextAttackTick:500});
  });
  it('recalls through fog, respects exclusions and does not move enemies or buildings',()=>{
    const f=fixture('protoss','protoss'),a=caster(f),own=f.add(0,'protoss-zealot',70,70),enemy=f.add(1,'protoss-zealot',70,70),building=f.add(0,'protoss-pylon',71,71);cast(f,a,RECALL,70,70);f.tick(RECALL_TICKS-1);expect(f.state.entities.x[indexOf(f.state,own)]).toBeLessThan(46*256);expect(f.state.entities.x[indexOf(f.state,enemy)]).toBe(70*256);expect(f.state.entities.x[indexOf(f.state,building)]).toBe(71*256);
  });
  it('recalls a loaded carrier without losing passengers or private cargo positions',()=>{
    const f=fixture(),a=caster(f),ship=f.add(0,'protoss-shuttle',55,40),z=f.add(0,'protoss-zealot',56,40);expect(f.load([ship],z).accepted).toBe(true);f.tick(10);expect(isEmbarked(f.state,z)).toBe(true);cast(f,a,RECALL,55,40);f.tick(RECALL_TICKS-1);const i=indexOf(f.state,ship),j=indexOf(f.state,z);expect(f.state.entities.x[i]).toBeLessThan(46*256);expect(f.state.entities.x[j]).toBe(f.state.entities.x[i]);expect(f.state.entities.y[j]).toBe(f.state.entities.y[i]);expect(isEmbarked(f.state,z)).toBe(true);expect(parse(simulationStateSchema,f.state).ok).toBe(true);
  });
  it('removes incoming tracking on recalled units and keeps collision-free stable placements',()=>{
    const f=fixture('protoss','terran'),a=caster(f),z=f.add(0,'protoss-zealot',55,40),b=f.add(0,'protoss-zealot',56,40),v=f.add(1,'terran-vulture',59,40);f.tick();expect(f.state.combat!.projectiles.some(p=>[z,b].includes(p.targetId))).toBe(true);resolveRecall(f.state,f.map,a,55*256,40*256);expect(f.state.combat!.projectiles.some(p=>[z,b].includes(p.targetId))).toBe(false);const i=indexOf(f.state,z),j=indexOf(f.state,b);expect((f.state.entities.x[i]-f.state.entities.x[j])**2+(f.state.entities.y[i]-f.state.entities.y[j])**2).toBeGreaterThanOrEqual((f.state.entities.radius[i]+f.state.entities.radius[j])**2);
  });
  it('cancels recall on caster death without refund and pauses an interrupted cast while frozen',()=>{
    const f=fixture(),a=caster(f),other=caster(f,44,40);cast(f,a,RECALL,55,40);cast(f,other,STASIS,40,40);const n=recallOf(f.state,a)!.remainingTicks;f.tick(10);expect(recallOf(f.state,a)!.remainingTicks).toBe(n);removeEntity(f.state,a);expect(recallOf(f.state,a)).toBeUndefined();f.tick();expect(validSpells(f.state)).toBe(true);
  });
  it('restores pending recalls and frozen remaining time with deterministic continuation and anonymous public effects',()=>{
    const f=fixture(),a=caster(f),other=caster(f,44,40),z=f.add(0,'protoss-zealot',55,40);cast(f,a,RECALL,55,40);cast(f,other,STASIS,40,40);const copy=restoreSnapshot(JSON.stringify(f.saved())).simulation;expect(copy.spells).toEqual(f.state.spells);const view=f.view();expect(validateRenderSnapshot(view).ok).toBe(true);expect(view.spellEffects!.every(e=>!('sourceId'in e)&&!('entityId'in e))).toBe(true);
    for(let n=0;n<30;n++){stepSimulation(copy,f.rules);f.tick();}expect(checksum(copy)).toBe(checksum(f.state));f.state.spells!.recalls[0].x=f.map.widthTiles*256;expect(spellsFitMap(f.state,f.map)).toBe(false);
  });
  it('migrates the previous Arbiter save with original 50-energy initialization and untouched raw backup',()=>{
    const f=fixture(),a=f.add(0,ARBITER),old=f.saved();old.formatVersion=old.simulation.schemaVersion=15;old.engineVersion=old.simulation.engineVersion='0.16.0-stage6f';old.dataVersion=old.simulation.dataVersion=old.dataVersion.replace(ECONOMY_DATA_VERSION,ARBITER_ECONOMY_DATA_VERSION);old.simulation.combat!.rulesVersion=ARBITER_COMBAT_RULES_VERSION;old.simulation.vision!.rulesVersion=ARBITER_VISION_RULES_VERSION as never;delete old.simulation.energy;old.checksum=checksum(old.simulation);
    const raw=JSON.stringify(old),key=DEVELOPMENT_SAVE_PREFIX+'protoss',records=new Map([[key,raw]]),store=new DevelopmentSaveStore({getItem:k=>records.get(k)??null,setItem:(k,v)=>{records.set(k,v);}}),read=store.read('protoss');expect(read.status).toBe('ready');if(read.status!=='ready')throw Error('migration');expect(energyOf(read.snapshot.simulation,a)).toMatchObject({amount:50*256,frameRemainder:0});expect(store.write(read.snapshot)).toBe(true);expect(records.get(key+'.stage6f-backup')).toBe(raw);
  });
});
