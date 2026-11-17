import { STASIS_VISION_RULES_VERSION } from "../../app/stark-rift/vision/state";
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
  const rules = createAutocastRules(map,spellRules);
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
const rows=[['terran','terran-ghost','moebius-reactor','terran-covert-ops',150],['terran','terran-wraith','apollo-reactor','terran-control-tower',200],['protoss','protoss-arbiter','khaydarin-core','protoss-arbiter-tribunal',150]] as const;
function facility(f:F,name:string,x=42,y=40){
 const id=f.add(0,name,x,y);
 if(name==='protoss-arbiter-tribunal')f.add(0,'protoss-pylon',40,40);
 else {const parent=f.add(0,name==='terran-covert-ops'?'terran-science-facility':'terran-starport',x,y-4);structureOf(f.state,id)!.addonParentId=parent;}
 return id;
}
describe('original energy capacity upgrades',()=>{
 it.each(rows)('%s %s pays %s research once, refunds cancellation and completes after1042ticks',(race,unit,technologyId,producer,cost)=>{
  const f=fixture(race,race),b=facility(f,producer),other=facility(f,producer,46,40),c={kind:'research',entityIds:[b],payload:{technologyId}};
  expect(ECONOMY_UPGRADES.find(t=>t.id===technologyId)).toMatchObject({producer,minerals:cost,gas:cost,ticks:1042,maxLevel:1});expect(f.issue(c).accepted).toBe(true);expect(f.state.players[0]).toMatchObject({minerals:1000-cost,gas:1000-cost});expect(f.issue({kind:'research',entityIds:[other],payload:{technologyId}}).accepted).toBe(false);f.issue({kind:'cancelResearch',entityIds:[b]});expect(f.state.players[0]).toMatchObject({minerals:1000,gas:1000});f.issue(c);f.tick(1040);expect(f.state.economy.upgrades.some(u=>u.technologyId===technologyId)).toBe(false);f.tick();expect(f.state.economy.upgrades).toContainEqual({playerId:0,technologyId,level:1});expect(f.issue(c).accepted).toBe(false);
 });
 it.each(rows)('initializes newly produced %s %s at exactly62.5 while ordinary units retain50',(race,unit,technologyId)=>{
  const f=fixture(race,race),old=f.add(0,unit),r=energyOf(f.state,old)!;expect(r.amount).toBe(12800);f.research(technologyId);expect(r.amount).toBe(12800);const id=f.add(0,unit,42,40);expect(energyOf(f.state,id)).toMatchObject({amount:16000,frameRemainder:0});expect(maximumEnergy(f.state,0,unit)).toBe(250);const other=f.add(1,unit,45,40);expect(energyOf(f.state,other)!.amount).toBe(12800);expect(maximumEnergy(f.state,1,unit)).toBe(200);
 });
 it.each(rows)('regenerates %s %s to250 without gifting energy to existing casters',(race,unit,technologyId,producer)=>{
  const f=fixture(race,race),a=f.add(0,unit,38,40),b=facility(f,producer),r=energyOf(f.state,a)!;r.amount=200*256;f.issue({kind:'research',entityIds:[b],payload:{technologyId}});f.tick(1040);expect(r.amount).toBe(200*256);f.tick();expect(maximumEnergy(f.state,0,unit)).toBe(250);expect(r.amount).toBeGreaterThan(200*256);expect(r.amount).toBeLessThan(201*256);r.amount=250*256-1;advanceEnergy(f.state);expect(r.amount).toBe(64000);advanceEnergy(f.state);expect(r.amount).toBe(64000);
 });
 it.each(rows)('uses the completed upgrade when %s %s finishes an already-paid production queue',(race,unit,technologyId)=>{
  const f=fixture(race,race),producer=f.add(0,unit==='terran-ghost'?'terran-barracks':unit==='terran-wraith'?'terran-starport':'protoss-stargate',42,40);
  if(unit==='terran-ghost'){f.add(0,'terran-academy',18,22);facility(f,'terran-covert-ops',20,26);}
  if(unit==='protoss-arbiter'){facility(f,'protoss-arbiter-tribunal',20,24);f.add(0,'protoss-pylon',40,40);f.add(0,'protoss-pylon',20,24);}
  expect(f.issue({kind:'produce',entityIds:[producer],payload:{unitId:unit}}).accepted).toBe(true);f.research(technologyId);const ticks=structureOf(f.state,producer)!.queue[0].remainingTicks;f.tick(ticks);const id=f.state.entities.id.find((id,i)=>f.state.entities.definitionId[i]===unit)!;expect(id).toBeDefined();expect(energyOf(f.state,id)!.amount).toBeGreaterThanOrEqual(16000);expect(energyOf(f.state,id)!.amount).toBeLessThan(16100);
 });
 it('keeps each caster upgrade isolated to its unit type and player',()=>{
  const f=fixture('terran','terran'),g=f.add(0,'terran-ghost'),w=f.add(0,'terran-wraith');f.research('moebius-reactor');expect(maximumEnergy(f.state,0,'terran-ghost')).toBe(250);expect(maximumEnergy(f.state,0,'terran-wraith')).toBe(200);energyOf(f.state,g)!.amount=64000;expect(validEnergy(f.state)).toBe(true);energyOf(f.state,w)!.amount=51201;expect(validEnergy(f.state)).toBe(false);
 });
 it.each([['terran-ghost','moebius-reactor','personnel-cloaking',10],['terran-wraith','apollo-reactor','cloaking-field',13]] as const)('preserves upgraded %s cloak cost, original drain and fixed frame remainder',(unit,capacity,cloak,drain)=>{
  const f=fixture('terran','terran'),a=f.add(0,unit);f.research(capacity);f.research(cloak);energyOf(f.state,a)!.amount=240*256;expect(f.issue({kind:'toggleStateAbility',entityIds:[a],payload:{abilityId:'cloak',enabled:true}}).accepted).toBe(true);expect(energyOf(f.state,a)!.amount).toBeLessThan(215*256);const before=energyOf(f.state,a)!.amount;for(let n=0;n<5;n++)advanceEnergy(f.state);expect(energyOf(f.state,a)!.amount).toBe(before-6*drain);expect(f.view().entities.find(e=>e.id===a)).toMatchObject({maxEnergy:250,cloaked:true});
 });
 it('preserves more than200 energy in cargo, render packets and deterministic save continuation',()=>{
  const f=fixture('terran','terran'),a=f.add(0,'terran-ghost'),ship=f.add(0,'terran-dropship',41,40);f.research('moebius-reactor');energyOf(f.state,a)!.amount=240*256;f.load([ship],a);f.tick(10);expect(isEmbarked(f.state,a)).toBe(true);const view=f.view(),p=view.economy!.transports!.find(t=>t.entityId===ship)!.passengers[0];expect(p).toMatchObject({id:a,maxEnergy:250});expect(p.energy).toBeGreaterThanOrEqual(240);expect(validateRenderSnapshot(view).ok).toBe(true);const copy=restoreSnapshot(JSON.stringify(f.saved())).simulation;for(let n=0;n<20;n++){f.tick();stepSimulation(copy,f.rules);}expect(checksum(copy)).toBe(checksum(f.state));
 });
 it('continues upgraded Arbiter regeneration while frozen and validates only legal capacity displays',()=>{
  const f=fixture(),a=caster(f),other=caster(f,44,40);f.research('khaydarin-core');energyOf(f.state,a)!.amount=64000-1;cast(f,other,STASIS,40,40);expect(isInStasis(f.state,a)).toBe(true);f.tick(5);expect(energyOf(f.state,a)!.amount).toBe(64000);const v=f.view(),e=v.entities.find(e=>e.id===a)!;expect(e).toMatchObject({energy:250,maxEnergy:250});e.energy=251;expect(validateRenderSnapshot(v).ok).toBe(false);e.energy=200;e.maxEnergy=237;expect(validateRenderSnapshot(v).ok).toBe(false);e.maxEnergy=undefined;expect(validateRenderSnapshot(v).ok).toBe(false);
 });
 it('pauses unpowered capacity research and detached Terran addon research without granting the upgrade',()=>{
  for(const producer of ['terran-covert-ops','protoss-arbiter-tribunal']){
   const f=fixture(producer.startsWith('terran')?'terran':'protoss'),b=facility(f,producer),tech=producer.startsWith('terran')?'moebius-reactor':'khaydarin-core';f.issue({kind:'research',entityIds:[b],payload:{technologyId:tech}});const state=structureOf(f.state,b)!,remaining=state.research!.remainingTicks;if(producer.startsWith('terran'))removeEntity(f.state,state.addonParentId!);else for(const id of [...f.state.entities.id])if(f.state.entities.definitionId[indexOf(f.state,id)]==='protoss-pylon')removeEntity(f.state,id);f.tick(10);expect(state.research!.remainingTicks).toBe(remaining);expect(f.state.economy.upgrades.some(u=>u.technologyId===tech)).toBe(false);f.issue({kind:'cancelResearch',entityIds:[b]});expect(f.state.players[0].gas).toBe(1000);
  }
 });
 it('rejects over-cap amounts, missing upgrades and mismatched cargo energy displays',()=>{
  const f=fixture('terran','terran'),a=f.add(0,'terran-ghost'),ship=f.add(0,'terran-dropship',41,40);energyOf(f.state,a)!.amount=51201;expect(parse(simulationStateSchema,f.state).ok).toBe(false);f.research('moebius-reactor');expect(parse(simulationStateSchema,f.state).ok).toBe(true);energyOf(f.state,a)!.amount=64001;expect(parse(simulationStateSchema,f.state).ok).toBe(false);energyOf(f.state,a)!.amount=60000;f.load([ship],a);f.tick(5);const v=f.view(),p=v.economy!.transports!.find(t=>t.entityId===ship)!.passengers[0];Object.assign(p,{maxEnergy:200});expect(validateRenderSnapshot(v).ok).toBe(false);
 });
 it('migrates stage6H without changing preferences, paid spell timers, fractions or old energy and backs up raw bytes',()=>{
  const f=fixture(),a=caster(f),b=caster(f,44,40);toggleAuto(f,[a]);cast(f,a,RECALL,60,60);cast(f,b,STASIS,40,40);const old=f.saved();old.formatVersion=old.simulation.schemaVersion=17;old.engineVersion=old.simulation.engineVersion='0.18.0-stage6h';old.simulation.combat!.rulesVersion=AUTOCAST_COMBAT_RULES_VERSION;old.dataVersion=old.simulation.dataVersion=old.dataVersion.replace(ECONOMY_DATA_VERSION,SPELLS_ECONOMY_DATA_VERSION);if(old.formatVersion>=16)old.simulation.vision!.rulesVersion=STASIS_VISION_RULES_VERSION as never;old.checksum=checksum(old.simulation);
  const raw=JSON.stringify(old),key=DEVELOPMENT_SAVE_PREFIX+'protoss',records=new Map([[key,raw]]),store=new DevelopmentSaveStore({getItem:k=>records.get(k)??null,setItem:(k,v)=>{records.set(k,v);}}),read=store.read('protoss');expect(read.status).toBe('ready');if(read.status!=='ready')throw Error('migration');for(const field of ['autocast','spells','energy','players','rngStreams','commandState'] as const)expect(read.snapshot.simulation[field]).toEqual(old.simulation[field]);expect(store.write(read.snapshot)).toBe(true);expect(records.get(key+'.stage6h-backup')).toBe(raw);
  const forged=structuredClone(old);forged.simulation.economy.upgrades.push({playerId:0,technologyId:'khaydarin-core',level:1});forged.checksum=checksum(forged.simulation);expect(()=>restoreSnapshot(JSON.stringify(forged))).toThrow();const over=structuredClone(old);over.simulation.energy![0].amount=51201;over.checksum=checksum(over.simulation);expect(()=>restoreSnapshot(JSON.stringify(over))).toThrow();
 });
});

it.each(['terran','protoss'] as const)('places %s practice research facilities on buildable tiles without overlap or free capacity upgrades',race=>{
 const f=fixture(race,'protoss');initializeCombat(f.state,'special-practice');
 const labs=f.state.economy.structures.filter(b=>['terran-science-facility','terran-covert-ops','terran-starport','terran-control-tower','protoss-arbiter-tribunal'].includes(f.state.entities.definitionId[indexOf(f.state,b.entityId)]));expect(labs.length).toBe(race==='terran'?4:1);
 for(const b of labs){for(let y=b.tileY;y<b.tileY+b.height;y++)for(let x=b.tileX;x<b.tileX+b.width;x++)expect(f.map.buildable[y*f.map.widthTiles+x]).toBe(1);for(const o of f.state.economy.structures.filter(o=>o.entityId!==b.entityId))expect(b.tileX<o.tileX+o.width&&b.tileX+b.width>o.tileX&&b.tileY<o.tileY+o.height&&b.tileY+b.height>o.tileY).toBe(false);}
 for(const id of ['moebius-reactor','apollo-reactor','khaydarin-core'])expect(f.state.economy.upgrades.some(u=>u.technologyId===id)).toBe(false);expect(f.state.players[0].gas).toBe(1650);for(const r of f.state.energy??[])expect(r.amount).toBe(f.state.entities.definitionId[indexOf(f.state,r.entityId)]==='protoss-arbiter'?51200:12800);
});
