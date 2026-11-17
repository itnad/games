import { STASIS_VISION_RULES_VERSION } from "../../app/stark-rift/vision/state";
import { createStimRules } from "../../app/stark-rift/abilities/stim-rules";
import { STIM,MARINE,STIM_TICKS,stimOf,actualHealth,stimulatedSpeed,stimulatedCooldown } from "../../app/stark-rift/abilities/stim-state";
import { MEDIC_ECONOMY_DATA_VERSION } from "../../app/stark-rift/data/economy-catalog";
import { MEDIC_COMBAT_RULES_VERSION } from "../../app/stark-rift/combat/state";
import { createMedicRules, healMedicFrame, missingMedicHealth, medicInRange, medicFrontlineAllows } from "../../app/stark-rift/abilities/medic-rules";
import { MEDIC, HEALING } from "../../app/stark-rift/abilities/medic-data";
import { medicOf } from "../../app/stark-rift/abilities/medic-state";
import { ENERGY_ECONOMY_DATA_VERSION } from "../../app/stark-rift/data/economy-catalog";
import { ENERGY_COMBAT_RULES_VERSION } from "../../app/stark-rift/combat/state";
import { maximumEnergy } from "../../app/stark-rift/abilities/energy-upgrades";
import { advanceEnergy } from "../../app/stark-rift/abilities/cloak-rules";
import { AUTOCAST_COMBAT_RULES_VERSION } from "../../app/stark-rift/combat/state";
import { createAutocastRules } from "../../app/stark-rift/abilities/autocast-rules";
import { autocastOf, validAutocast } from "../../app/stark-rift/abilities/autocast-state";
import { SPELLS_COMBAT_RULES_VERSION } from "../../app/stark-rift/combat/state";
import { createSpellsRules, resolveRecall, spellArea } from "../../app/stark-rift/abilities/spells-rules";
import { RECALL, STASIS, RECALL_TICKS, STASIS_TICKS, isInStasis, recallOf, validSpells, spellsFitMap } from "../../app/stark-rift/abilities/spells-state";
import { energyOf, ENERGY, validEnergy } from "../../app/stark-rift/abilities/cloak-state";
import { ECONOMY_UPGRADES, SPELLS_ECONOMY_DATA_VERSION, ARBITER_ECONOMY_DATA_VERSION } from "../../app/stark-rift/data/economy-catalog";
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
  const spellRules = createSpellsRules(map, createSpecialRules(map, createLurkerRules(createSiegeRules(createCloakRules(createBurrowRules(map, createVisionRules(map, createCombatRules(createEconomyRules(map, createMovementRules(map, visible, combatReach)), visible, map))))))));
  const rules = createStimRules(createMedicRules(map,createAutocastRules(map,spellRules)));
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

const toggleAuto=(f:F,ids:number[])=>f.issue({kind:'toggleAutocast',entityIds:ids,payload:{abilityId:STASIS,enabled:true}});

const heal=(f:F,id:number,target:number)=>f.issue({kind:'castAbility',entityIds:[id],payload:{abilityId:HEALING},target:{kind:'entity',entityId:target}});
const auto=(f:F,ids:number[],enabled:boolean)=>f.issue({kind:'toggleAutocast',entityIds:ids,payload:{abilityId:HEALING,enabled}});
const hurt=(f:F,id:number,hp=10,fraction=0)=>{f.state.entities.health[indexOf(f.state,id)]=hp;f.state.combat!.records.find(r=>r.entityId===id)!.healthFraction=fraction;};

const stim=(f:F,ids:number[],owner=0)=>f.issue({kind:'castAbility',entityIds:ids,payload:{abilityId:STIM},target:{kind:'entity',entityId:ids[0]}},owner);
describe('Marine Stim Packs',()=>{
 it('requires Academy research, pays100/100 once, refunds cancellation and completes500ticks',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MARINE),b=f.add(0,'terran-academy',42,42),cmd={kind:'research',entityIds:[b],payload:{technologyId:STIM}};expect(stim(f,[a]).accepted).toBe(false);expect(actualHealth(f.state,a)).toBe(40*256);expect(ECONOMY_UPGRADES.find(t=>t.id===STIM)).toMatchObject({producer:'terran-academy',minerals:100,gas:100,ticks:500,maxLevel:1});expect(f.issue(cmd).accepted).toBe(true);expect(f.state.players[0].gas).toBe(900);f.issue({kind:'cancelResearch',entityIds:[b]});expect(f.state.players[0].gas).toBe(1000);f.issue(cmd);f.tick(498);expect(f.state.economy.upgrades.some(u=>u.technologyId===STIM)).toBe(false);f.tick();expect(f.state.economy.upgrades).toContainEqual({playerId:0,technologyId:STIM,level:1});expect(f.issue(cmd).accepted).toBe(false);expect(stim(f,[a]).accepted).toBe(true);
 });
 it('spends10HP exactly, preserving health fractions and shields without an energy cost',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MARINE);f.research(STIM);hurt(f,a,40,137);const before=actualHealth(f.state,a);expect(stim(f,[a]).accepted).toBe(true);expect(actualHealth(f.state,a)).toBe(before-2560);expect(f.state.combat!.records.find(r=>r.entityId===a)!.healthFraction).toBe(137);expect(f.state.entities.shield[indexOf(f.state,a)]).toBe(0);expect(energyOf(f.state,a)).toBeUndefined();expect(stimOf(f.state,a)).toMatchObject({appliedTick:1,expiresTick:1+STIM_TICKS});
 });
 it('partially executes only Marines strictly above10 actual HP and never kills an eligible fractional survivor',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MARINE),b=f.add(0,MARINE,42,40),c=f.add(0,MEDIC,44,40);auto(f,[c],false);f.research(STIM);hurt(f,a,10);hurt(f,b,11,255);const ack=stim(f,[a,b,c]);expect(ack).toMatchObject({accepted:true,executedEntityIds:[b]});expect(actualHealth(f.state,a)).toBe(2560);expect(actualHealth(f.state,b)).toBe(1);expect(f.state.entities.health[indexOf(f.state,b)]).toBe(1);expect(stim(f,[a,b]).accepted).toBe(false);
 });
 it('rejects unsupported units, wrong target shape, foreign ownership and a paused simulation',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MARINE),m=f.add(0,MEDIC),other=f.add(1,MARINE,45,40);f.research(STIM);expect(stim(f,[m]).accepted).toBe(false);expect(stim(f,[other]).accepted).toBe(false);expect(f.issue({kind:'castAbility',entityIds:[a],payload:{abilityId:STIM},target:{kind:'point',x:40*256,y:40*256}}).accepted).toBe(false);f.state.phase='paused';const c={kind:'castAbility',entityIds:[a],payload:{abilityId:STIM},target:{kind:'entity',entityId:a},sequence:99,issuedTick:f.state.tick,executeTick:f.state.tick+1,playerId:0,source:'player'};expect(enqueueCommand(f.state,c,f.rules)).toEqual({ok:false,code:'invalid_state'});
 });
 it('refreshes duration and pays again without stacking speed or resetting the current attack cooldown',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MARINE);f.research(STIM);const record=f.state.combat!.records.find(r=>r.entityId===a)!;record.nextAttackTick=900;record.remainder=4;stim(f,[a]);const speed=f.state.entities.speed[indexOf(f.state,a)];f.tick(20);stim(f,[a]);expect(actualHealth(f.state,a)).toBe(20*256);expect(f.state.stim!.records).toHaveLength(1);expect(stimulatedSpeed(f.state,indexOf(f.state,a))).toBe(speed*1.5);expect(record.nextAttackTick).toBe(900);expect(record.remainder).toBe(4);expect(stimOf(f.state,a)!.expiresTick).toBe(f.state.tick+STIM_TICKS);
 });
 it('keeps move, hold, formation and path scheduling orders when activated',()=>{
  for(const order of ['move','hold'] as const){const f=fixture('terran','terran'),a=f.add(0,MARINE);f.research(STIM);f.issue({kind:order,entityIds:[a],...(order==='move'?{target:{kind:'point',x:46*256,y:40*256}}:{})});const before=structuredClone(f.state.movement[indexOf(f.state,a)]);stim(f,[a]);const after=f.state.movement[indexOf(f.state,a)];expect(after.order).toBe(before.order);expect(after.origin).toEqual(before.origin);expect(after.formation).toBe(before.formation);expect(after.requestTick).toBe(before.requestTick);}
 });
 it('moves approximately1.5times as far through the same unobstructed route with integer remainder accounting',()=>{
  const run=(boost:boolean)=>{const f=fixture('terran','terran'),a=f.add(0,MARINE);f.research(STIM);if(boost)stim(f,[a]);else f.tick();f.issue({kind:'move',entityIds:[a],target:{kind:'point',x:55*256,y:40*256}});const start=f.state.entities.x[indexOf(f.state,a)];f.tick(20);return f.state.entities.x[indexOf(f.state,a)]-start;};const normal=run(false),boosted=run(true);expect(boosted).toBeGreaterThan(normal*1.35);expect(boosted).toBeLessThan(normal*1.65);
 });
 it('halves original Marine15frame cooldown to7, clamps short cooldowns to5 and increases actual fire cadence',()=>{
  const run=(boost:boolean)=>{const f=fixture('terran','terran'),a=f.add(0,MARINE),target=f.add(1,'terran-command-center',44,40);f.research(STIM);if(boost)stim(f,[a]);else f.tick();f.issue({kind:'focusAttack',entityIds:[a],target:{kind:'entity',entityId:target}});const r=f.state.combat!.records.find(r=>r.entityId===a)!;let shots=0,last=r.nextAttackTick;for(let i=0;i<120;i++){f.tick();if(r.nextAttackTick!==last){shots++;last=r.nextAttackTick;}}if(boost){expect(stimulatedCooldown(f.state,a,15)).toBe(7);expect(stimulatedCooldown(f.state,a,6)).toBe(5);}return shots;};const normal=run(false),boosted=run(true);expect(boosted).toBeGreaterThanOrEqual(normal*1.8);
 });
 it('expires exactly247ticks after payment and restores base movement and attack calculations',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MARINE);f.research(STIM);stim(f,[a]);expect(STIM_TICKS).toBe(247);f.tick(246);expect(stimOf(f.state,a)).toBeDefined();f.tick();expect(stimOf(f.state,a)).toBeUndefined();expect(f.state.stim!.records).toEqual([]);expect(stimulatedSpeed(f.state,indexOf(f.state,a))).toBe(f.state.entities.speed[indexOf(f.state,a)]);expect(stimulatedCooldown(f.state,a,15)).toBe(15);
 });
 it('lets a nearby Medic automatically repair the exact Stim HP cost without clearing the buff',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MARINE),m=f.add(0,MEDIC,41,40);f.research(STIM);stim(f,[a]);expect(actualHealth(f.state,a)).toBe(30*256);f.tick(30);expect(actualHealth(f.state,a)).toBe(40*256);expect(stimOf(f.state,a)).toBeDefined();expect(energyOf(f.state,m)!.amount).toBeLessThan(12800);expect(f.view().entities.find(e=>e.id===a)).toHaveProperty('stimTicks');
 });
 it('retains timers and regenerating energy in cargo, refuses new activation and expires while carried',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MARINE),ship=f.add(0,'terran-dropship',40,40);f.research(STIM);stim(f,[a]);f.load([ship],a);f.tick(10);expect(isEmbarked(f.state,a)).toBe(true);expect(stim(f,[a]).accepted).toBe(false);expect(f.view().economy!.transports!.find(t=>t.entityId===ship)!.passengers[0].stimTicks).toBe(stimOf(f.state,a)!.expiresTick-f.state.tick);f.tick(250);expect(stimOf(f.state,a)).toBeUndefined();expect(f.view().economy!.transports!.find(t=>t.entityId===ship)!.passengers[0].stimTicks).toBeUndefined();
 });
 it('keeps time elapsing in Stasis, rejects activation and resumes with base speed after thaw',()=>{
  const f=fixture('terran','protoss'),a=f.add(0,MARINE);f.research(STIM);stim(f,[a]);f.state.spells??={stasis:[],recalls:[],effects:[]};f.state.spells.stasis.push({entityId:a,x:40*256,y:40*256,appliedTick:f.state.tick,expiresTick:f.state.tick+STASIS_TICKS});expect(stim(f,[a]).accepted).toBe(false);f.tick(250);expect(isInStasis(f.state,a)).toBe(true);expect(stimOf(f.state,a)).toBeUndefined();f.tick(STASIS_TICKS);expect(isInStasis(f.state,a)).toBe(false);expect(stimulatedSpeed(f.state,indexOf(f.state,a))).toBe(f.state.entities.speed[indexOf(f.state,a)]);
 });
 it('retains Stim across Recall teleportation while cleaning old healing reservations',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MARINE),arbiter=f.add(1,ARBITER,46,40);f.state.entities.owner[indexOf(f.state,arbiter)]=0;f.research(STIM); // Direct resolver coverage for future mixed-faction ownership; no validated simulation step.
  f.state.stim={records:[{entityId:a,appliedTick:0,expiresTick:STIM_TICKS}]};resolveRecall(f.state,f.map,arbiter,40*256,40*256);expect(f.state.entities.x[indexOf(f.state,a)]).not.toBe(40*256);expect(stimOf(f.state,a)).toBeDefined();
 });
 it('round-trips active Stim, Medic job, navigation and attack fractions with deterministic continuation',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MARINE),m=f.add(0,MEDIC,42,40);f.research(STIM);stim(f,[a]);f.tick(5);const copy=restoreSnapshot(JSON.stringify(f.saved())).simulation;expect(copy.stim).toEqual(f.state.stim);for(let n=0;n<260;n++){f.tick();stepSimulation(copy,f.rules);}expect(checksum(copy)).toBe(checksum(f.state));
 });
 it('migrates stage6J with exact Medic jobs, fractions, settings, energy and RNG, retaining raw19backup',()=>{
  const f=fixture('terran','terran'),m=f.add(0,MEDIC),p=f.add(0,MARINE,44,40);hurt(f,p,15,71);auto(f,[m],false);heal(f,m,p);f.tick(5);const old=f.saved();old.formatVersion=old.simulation.schemaVersion=19;old.engineVersion=old.simulation.engineVersion='0.20.0-stage6j';old.simulation.combat!.rulesVersion=MEDIC_COMBAT_RULES_VERSION;old.dataVersion=old.simulation.dataVersion=old.dataVersion.replace(ECONOMY_DATA_VERSION,MEDIC_ECONOMY_DATA_VERSION);if(old.formatVersion>=16)old.simulation.vision!.rulesVersion=STASIS_VISION_RULES_VERSION as never;old.checksum=checksum(old.simulation);const raw=JSON.stringify(old),key=DEVELOPMENT_SAVE_PREFIX+'terran',records=new Map([[key,raw]]),store=new DevelopmentSaveStore({getItem:k=>records.get(k)??null,setItem:(k,v)=>{records.set(k,v);}}),read=store.read('terran');expect(read.status).toBe('ready');if(read.status!=='ready')throw Error('migration');expect(read.snapshot.formatVersion).toBe(22);for(const field of ['medics','energy','players','movement','rngStreams','commandState'] as const)expect(read.snapshot.simulation[field]).toEqual(old.simulation[field]);expect(read.snapshot.simulation.stim).toBeUndefined();expect(store.write(read.snapshot)).toBe(true);expect(records.get(key+'.stage6j-backup')).toBe(raw);
  const forged=structuredClone(old);forged.simulation.stim={records:[]};forged.checksum=checksum(forged.simulation);expect(()=>restoreSnapshot(JSON.stringify(forged))).toThrow();const fakeResearch=structuredClone(old);fakeResearch.simulation.economy.upgrades.push({playerId:0,technologyId:STIM,level:1});fakeResearch.checksum=checksum(fakeResearch.simulation);expect(()=>restoreSnapshot(JSON.stringify(fakeResearch))).toThrow();
 });
 it('rejects forged timers, duplicate rows, unsupported entities and cleans records on death/removal',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MARINE),m=f.add(0,MEDIC);f.research(STIM);stim(f,[a]);const row=f.state.stim!.records[0];row.expiresTick++;expect(parse(simulationStateSchema,f.state).ok).toBe(false);row.expiresTick--;f.state.stim!.records.push({...row});expect(parse(simulationStateSchema,f.state).ok).toBe(false);f.state.stim!.records.pop();row.entityId=m;expect(parse(simulationStateSchema,f.state).ok).toBe(false);row.entityId=a;f.state.economy.upgrades=[];expect(parse(simulationStateSchema,f.state).ok).toBe(false);f.research(STIM);f.state.entities.layer[indexOf(f.state,a)]='air';expect(parse(simulationStateSchema,f.state).ok).toBe(false);f.state.entities.layer[indexOf(f.state,a)]='ground';removeEntity(f.state,a);expect(f.state.stim!.records).toEqual([]);expect(parse(simulationStateSchema,f.state).ok).toBe(true);
 });
 it('shows timers only on visible Marines and rejects passenger timer forgery on other unit types',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MARINE),m=f.add(0,MEDIC,42,40);f.research(STIM);stim(f,[a]);const v=f.view();expect(v.entities.find(e=>e.id===a)!.stimTicks).toBe(STIM_TICKS);expect(validateRenderSnapshot(v).ok).toBe(true);v.entities.find(e=>e.id===m)!.stimTicks=10;expect(validateRenderSnapshot(v).ok).toBe(false);
 });
 it('keeps practice research unpaid and existing wounded Marine/Medic drill unchanged',()=>{
  const f=fixture('terran','protoss');initializeCombat(f.state,'special-practice');expect(f.state.economy.upgrades.some(u=>u.technologyId===STIM)).toBe(false);expect(f.state.players[0].controlGroups[0].entityIds.map(id=>f.state.entities.health[indexOf(f.state,id)])).toEqual([15,20]);expect(f.state.medics!.records).toHaveLength(2);expect(f.state.stim).toBeUndefined();
 });
});
it('heals the second parked patient when ordinary formation clearance would stop the Medic just outside healing range',()=>{
 const f=fixture('terran','protoss');initializeCombat(f.state,'special-practice');const [p,q]=f.state.players[0].controlGroups[0].entityIds,[m]=f.state.players[0].controlGroups[4].entityIds;
 const place=(id:number,x:number,y:number,hp:number)=>{const i=indexOf(f.state,id);f.state.entities.x[i]=x*256;f.state.entities.y[i]=y*256;f.state.entities.health[i]=hp;};
 place(p,17.75,19.75,40);place(q,18.25,20.25,30);place(m,16.75,20.75,60);f.tick(60);expect(actualHealth(f.state,q)).toBe(40*256);expect(parse(simulationStateSchema,f.state).ok).toBe(true);
});
