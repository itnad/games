import { STASIS_VISION_RULES_VERSION } from "../../app/stark-rift/vision/state";
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
  const rules = createMedicRules(map,createAutocastRules(map,spellRules));
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
describe('Medic healing and production',()=>{
 it('requires Academy, pays exact resources and trains in188ticks with one supply',()=>{
  const f=fixture('terran','terran'),b=f.add(0,'terran-barracks',42,40),cmd={kind:'produce',entityIds:[b],payload:{unitId:MEDIC}};
  expect(f.issue(cmd).accepted).toBe(false);f.add(0,'terran-academy',18,22);const before=f.state.players[0].minerals;
  expect(f.issue(cmd).accepted).toBe(true);expect(f.state.players[0].minerals).toBe(before-50);expect(f.state.players[0].gas).toBe(975);f.tick(186);expect(f.state.entities.definitionId).not.toContain(MEDIC);f.tick();const id=f.state.entities.id.find((id,i)=>f.state.entities.definitionId[i]===MEDIC)!;
  expect(id).toBeDefined();expect(medicOf(f.state,id)).toMatchObject({autocast:true,targetId:null});expect(energyOf(f.state,id)!.amount).toBeGreaterThanOrEqual(12800);expect(economyDefinition(MEDIC)!.supply).toBe(2);
 });
 it('researches Caduceus for150/150, refunds cancellation, completes1042ticks and starts new Medics at62.5',()=>{
  const f=fixture('terran','terran'),b=f.add(0,'terran-academy',42,40),id=f.add(0,MEDIC),cmd={kind:'research',entityIds:[b],payload:{technologyId:'caduceus-reactor'}};
  expect(f.issue(cmd).accepted).toBe(true);expect(f.state.players[0].gas).toBe(850);f.issue({kind:'cancelResearch',entityIds:[b]});expect(f.state.players[0].gas).toBe(1000);f.issue(cmd);f.tick(1040);expect(maximumEnergy(f.state,0,MEDIC)).toBe(200);f.tick();expect(maximumEnergy(f.state,0,MEDIC)).toBe(250);expect(energyOf(f.state,id)!.amount).toBeLessThan(200*256);const next=f.add(0,MEDIC,44,40);expect(energyOf(f.state,next)!.amount).toBe(16000);expect(f.issue(cmd).accepted).toBe(false);
 });
 it('heals exact fixed-point HP and energy per original frame, including the last fractional wound',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MEDIC),p=f.add(0,'terran-marine',41,40),r=medicOf(f.state,a)!,energy=energyOf(f.state,a)!;hurt(f,p,10,50);r.targetId=p;r.manual=true;
  expect(healMedicFrame(f.state,r)).toBe(200);expect(f.state.entities.health[indexOf(f.state,p)]).toBe(11);expect(f.state.combat!.records.find(r=>r.entityId===p)!.healthFraction).toBe(106);expect(energy.amount).toBe(12700);
  hurt(f,p,40,17);expect(healMedicFrame(f.state,r)).toBe(17);expect(energy.amount).toBe(12692);expect(missingMedicHealth(f.state,p)).toBe(0);expect(r.targetId).toBeNull();expect(r.healedTargetId).toBe(p);
 });
 it('interleaves regen before healing at the energy cap and retains original frame remainder',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MEDIC),p=f.add(0,'terran-marine',41,40),r=medicOf(f.state,a)!,energy=energyOf(f.state,a)!;hurt(f,p,1);energy.amount=51200;r.targetId=p;r.manual=true;
  f.tick(5);expect(energy.amount).toBe(51200+5*8-6*100);expect(energy.frameRemainder).toBe(0);expect(missingMedicHealth(f.state,p)).toBe(39*256-1200);
 });
 it('requires at least one energy per heal frame, without subtracting energy for travel or invalid patients',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MEDIC),p=f.add(0,'terran-marine',41,40),r=medicOf(f.state,a)!;hurt(f,p);r.targetId=p;r.manual=true;energyOf(f.state,a)!.amount=255;expect(healMedicFrame(f.state,r)).toBe(0);energyOf(f.state,a)!.amount=256;expect(healMedicFrame(f.state,r)).toBe(200);expect(energyOf(f.state,a)!.amount).toBe(156);
 });
 it.each(['terran-siege-tank-tank-mode','terran-wraith','terran-barracks'])('rejects incompatible %s and self, enemy, full health without cost',definition=>{
  const f=fixture('terran','terran'),a=f.add(0,MEDIC),p=f.add(0,definition,41,40),enemy=f.add(1,'terran-marine',42,40),full=f.add(0,'terran-marine',39,40);hurt(f,p);hurt(f,enemy);
  for(const target of [a,p,enemy,full])expect(heal(f,a,target).accepted).toBe(false);expect(energyOf(f.state,a)!.amount).toBeGreaterThanOrEqual(12800);
 });
 it.each(['terran-scv','protoss-zealot','zerg-zergling'])('heals organic ally %s without changing shield',definition=>{
  const f=fixture('terran','terran'),a=f.add(0,MEDIC),p=f.add(0,definition,41,40);hurt(f,p);const shield=f.state.entities.shield[indexOf(f.state,p)];medicOf(f.state,a)!.targetId=p;medicOf(f.state,a)!.manual=true;expect(healMedicFrame(f.state,medicOf(f.state,a)!)).toBe(200);expect(f.state.entities.health[indexOf(f.state,p)]).toBeGreaterThan(10);expect(f.state.entities.shield[indexOf(f.state,p)]).toBe(shield);
 });
 it('reserves distinct nearest patients, preventing double healing and manual reservation collision',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MEDIC),b=f.add(0,MEDIC,40,41),p=f.add(0,'terran-marine',41,40),q=f.add(0,'terran-marine',41,41);hurt(f,p);hurt(f,q);f.tick(5);const rows=f.state.medics!.records;expect(rows.map(r=>r.targetId).sort()).toEqual([p,q].sort());expect(heal(f,a,q).accepted).toBe(true);expect(medicOf(f.state,b)!.targetId).toBeNull();expect(heal(f,b,q).accepted).toBe(false);
 });
 it('follows a manual far target, finishes healing and preserves deterministic save continuation',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MEDIC,36,40),p=f.add(0,'terran-marine',42,40);hurt(f,p,1);auto(f,[a],false);expect(heal(f,a,p).accepted).toBe(true);f.tick(10);expect(medicOf(f.state,a)).toMatchObject({manual:true,targetId:p});const copy=restoreSnapshot(JSON.stringify(f.saved())).simulation;
  for(let n=0;n<120;n++){f.tick();stepSimulation(copy,f.rules);}expect(checksum(copy)).toBe(checksum(f.state));expect(missingMedicHealth(f.state,p)).toBe(0);expect(medicOf(f.state,a)!.targetId).toBeNull();
 });
 it('respects player movement and stop grace, hold does not approach, explicit heal overrides hold',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MEDIC),p=f.add(0,'terran-marine',43,40);hurt(f,p,1);f.issue({kind:'hold',entityIds:[a]});f.tick(30);expect(medicOf(f.state,a)!.targetId).toBeNull();expect(f.state.entities.x[indexOf(f.state,a)]).toBe(40*256);expect(heal(f,a,p).accepted).toBe(true);f.tick(5);expect(f.state.movement[indexOf(f.state,a)].order).toBe('move');f.issue({kind:'stop',entityIds:[a]});expect(medicOf(f.state,a)!.targetId).toBeNull();f.tick(19);expect(medicOf(f.state,a)!.targetId).toBeNull();
  f.issue({kind:'move',entityIds:[a],target:{kind:'point',x:35*256,y:40*256}});f.tick(25);expect(f.state.movement[indexOf(f.state,a)].order).toBe('move');expect(medicOf(f.state,a)!.targetId).toBeNull();
 });
 it('cancels an active auto approach when newly visible threats would put the Medic ahead',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MEDIC),p=f.add(0,MEDIC,44,40);hurt(f,p);medicOf(f.state,p)!.autocast=false;f.tick(5);expect(medicOf(f.state,a)!.targetId).toBe(p);f.add(1,'terran-marine',46,40);f.tick();expect(medicOf(f.state,a)!.targetId).toBeNull();expect(f.state.movement[indexOf(f.state,a)].order).toBe('idle');
 });
 it('keeps a manual job while frozen, regens energy, then resumes without healing a frozen patient',()=>{
  const f=fixture('terran','protoss'),a=f.add(0,MEDIC),p=f.add(0,'terran-marine',41,40);hurt(f,p,1);heal(f,a,p);f.state.spells??={stasis:[],recalls:[],effects:[]};f.state.spells.stasis.push({entityId:a,x:40*256,y:40*256,appliedTick:f.state.tick,expiresTick:f.state.tick+STASIS_TICKS});const hp=f.state.entities.health[indexOf(f.state,p)],en=energyOf(f.state,a)!.amount;f.tick(5);expect(f.state.entities.health[indexOf(f.state,p)]).toBe(hp);expect(energyOf(f.state,a)!.amount).toBeGreaterThan(en);expect(medicOf(f.state,a)!.manual).toBe(true);f.tick(STASIS_TICKS);expect(f.state.entities.health[indexOf(f.state,p)]).toBeGreaterThan(hp);
 });
 it('supports cargo, clears patient references on removal and does not override boarding movement',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MEDIC),p=f.add(0,'terran-marine',41,40),ship=f.add(0,'terran-dropship',40,40);hurt(f,p);heal(f,a,p);expect(f.load([ship],a).accepted).toBe(true);f.tick(10);expect(isEmbarked(f.state,a)).toBe(true);const hp=f.state.entities.health[indexOf(f.state,p)],en=energyOf(f.state,a)!.amount;f.tick(5);expect(f.state.entities.health[indexOf(f.state,p)]).toBe(hp);expect(energyOf(f.state,a)!.amount).toBeGreaterThan(en);removeEntity(f.state,p);expect(medicOf(f.state,a)!.targetId).toBeNull();expect(parse(simulationStateSchema,f.state).ok).toBe(true);
 });
 it('persists explicit off across group refill and keeps new groups on by default',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MEDIC),b=f.add(0,MEDIC,42,40);const assign=(ids:number[])=>f.issue({kind:'assignGroup',entityIds:ids,payload:{slot:2,confirmed:true}});assign([a]);expect(medicOf(f.state,a)!.autocast).toBe(true);auto(f,[a],false);assign([a,b]);expect(medicOf(f.state,b)!.autocast).toBe(false);expect(f.state.players[0].controlGroups[2]).toMatchObject({autocastConfiguredAbilityIds:[HEALING],autocastAbilityIds:[]});const copy=restoreSnapshot(JSON.stringify(f.saved()));expect(copy.simulation.medics).toEqual(f.state.medics);
 });
 it('renders beam only when both actors are visible and keeps enemy settings private',()=>{
  const f=fixture('terran','terran'),a=f.add(1,MEDIC),p=f.add(1,'terran-marine',41,40);hurt(f,p);medicOf(f.state,a)!.targetId=p;medicOf(f.state,a)!.manual=true;healMedicFrame(f.state,medicOf(f.state,a)!);f.add(0,'terran-marine',43,40);initializeVision(f.state,f.map);const view=f.view(),row=view.entities.find(e=>e.id===a)!;expect(row).toBeDefined();expect(row.healAutocast).toBeUndefined();expect(row.healTargetId).toBeUndefined();expect(row.healingTargetId).toBe(p);expect(validateRenderSnapshot(view).ok).toBe(true);row.healAutocast=true;expect(validateRenderSnapshot(view).ok).toBe(false);
 });
 it('migrates real stage6I fields including upgraded energy without adding Medics; backs up untouched bytes',()=>{
  const f=fixture('terran','terran'),a=f.add(0,'terran-ghost');f.research('moebius-reactor');energyOf(f.state,a)!.amount=60000;const old=f.saved();old.formatVersion=old.simulation.schemaVersion=18;old.engineVersion=old.simulation.engineVersion='0.19.0-stage6i';old.simulation.combat!.rulesVersion=ENERGY_COMBAT_RULES_VERSION;old.dataVersion=old.simulation.dataVersion=old.dataVersion.replace(ECONOMY_DATA_VERSION,ENERGY_ECONOMY_DATA_VERSION);if(old.formatVersion>=16)old.simulation.vision!.rulesVersion=STASIS_VISION_RULES_VERSION as never;old.checksum=checksum(old.simulation);const raw=JSON.stringify(old),key=DEVELOPMENT_SAVE_PREFIX+'terran',records=new Map([[key,raw]]),store=new DevelopmentSaveStore({getItem:k=>records.get(k)??null,setItem:(k,v)=>{records.set(k,v);}}),read=store.read('terran');expect(read.status).toBe('ready');if(read.status!=='ready')throw Error('migration');expect(read.snapshot.formatVersion).toBe(22);expect(read.snapshot.simulation.energy).toEqual(old.simulation.energy);expect(read.snapshot.simulation.medics).toBeUndefined();expect(store.write(read.snapshot)).toBe(true);expect(records.get(key+'.stage6i-backup')).toBe(raw);
 });
 it('rejects duplicate reservations, missing Medic records and future beam ticks',()=>{
  const f=fixture('terran','terran'),a=f.add(0,MEDIC),b=f.add(0,MEDIC,40,41),p=f.add(0,'terran-marine',41,40);hurt(f,p);medicOf(f.state,a)!.targetId=p;medicOf(f.state,b)!.targetId=p;expect(parse(simulationStateSchema,f.state).ok).toBe(false);medicOf(f.state,b)!.targetId=null;expect(parse(simulationStateSchema,f.state).ok).toBe(true);medicOf(f.state,a)!.healedTargetId=p;medicOf(f.state,a)!.healedTick=1;expect(parse(simulationStateSchema,f.state).ok).toBe(false);f.state.medics!.records.pop();expect(parse(simulationStateSchema,f.state).ok).toBe(false);
 });
});
it('practice supplies two separated Medics, wounded Marines and nonoverlapping buildable facilities',()=>{
 const f=fixture('terran','protoss');initializeCombat(f.state,'special-practice');const ids=f.state.players[0].controlGroups[4].entityIds;expect(ids).toHaveLength(2);for(const id of ids)expect(medicOf(f.state,id)).toMatchObject({autocast:true,targetId:null});for(const id of f.state.players[0].controlGroups[0].entityIds)expect(missingMedicHealth(f.state,id)).toBeGreaterThan(0);
 for(const b of f.state.economy.structures){for(let y=b.tileY;y<b.tileY+b.height;y++)for(let x=b.tileX;x<b.tileX+b.width;x++)expect(f.map.buildable[y*f.map.widthTiles+x]).toBe(1);for(const o of f.state.economy.structures.filter(o=>o.entityId!==b.entityId))expect(b.tileX<o.tileX+o.width&&b.tileX+b.width>o.tileX&&b.tileY<o.tileY+o.height&&b.tileY+b.height>o.tileY).toBe(false);}
 expect(f.state.players[0].supplyUsedHalf).toBeLessThanOrEqual(f.state.players[0].supplyCapHalf);f.tick(30);for(const id of ids)expect(medicOf(f.state,id)!.targetId).toBeNull();expect(validateRenderSnapshot(f.view()).ok).toBe(true);
});
it('heals across the actual practice ramp and wall instead of stopping at a partial route',()=>{
 const f=fixture('terran','protoss');initializeCombat(f.state,'special-practice');const a=f.state.players[0].controlGroups[4].entityIds[0],p=f.state.players[0].controlGroups[0].entityIds[0];auto(f,f.state.players[0].controlGroups[4].entityIds,false);heal(f,a,p);f.tick(300);expect({wound:missingMedicHealth(f.state,p),movement:f.state.movement[indexOf(f.state,a)]}).toMatchObject({wound:0});
});
it('uses the inclusive original30px hitbox range and reports fractional wounds at displayed full HP',()=>{
 const f=fixture('terran','terran'),a=f.add(0,MEDIC),p=f.add(0,'terran-marine',41,40),e=f.state.entities,i=indexOf(f.state,p),j=indexOf(f.state,a);e.x[i]=e.x[j]+(combatProfile(MEDIC)!.bounds[2]+combatProfile('terran-marine')!.bounds[0]+30)*8;expect(medicInRange(f.state,a,p)).toBe(true);e.x[i]++;expect(medicInRange(f.state,a,p)).toBe(false);hurt(f,p,40,1);expect(f.view().entities.find(e=>e.id===p)!.needsHealing).toBe(true);
});
it('never reveals a healing beam endpoint on an undetected enemy cloaked Ghost',()=>{
 const f=fixture('terran','terran'),a=f.add(1,MEDIC),p=f.add(1,'terran-ghost',41,40);f.add(0,'terran-marine',43,40);f.state.economy.upgrades.push({playerId:1,technologyId:'personnel-cloaking',level:1});f.issue({kind:'toggleStateAbility',entityIds:[p],payload:{abilityId:'cloak',enabled:true}},1);hurt(f,p);const r=medicOf(f.state,a)!;r.targetId=p;r.manual=true;healMedicFrame(f.state,r);const v=f.view();expect(v.entities.some(e=>e.id===p)).toBe(false);expect(v.entities.find(e=>e.id===a)).toBeDefined();expect(v.entities.find(e=>e.id===a)!.healingTargetId).toBeUndefined();expect(validateRenderSnapshot(v).ok).toBe(true);
});
it('cancels an active automatic patient when the refilled group inherits explicit off',()=>{
 const f=fixture('terran','terran'),a=f.add(0,MEDIC,36,40),b=f.add(0,MEDIC,40,40),p=f.add(0,'terran-marine',42,40);hurt(f,p,1);f.issue({kind:'assignGroup',entityIds:[a],payload:{slot:2,confirmed:true}});auto(f,[a],false);f.tick(5);expect(medicOf(f.state,b)!.targetId).toBe(p);expect(f.issue({kind:'assignGroup',entityIds:[a,b],payload:{slot:2,confirmed:true}}).accepted).toBe(true);expect(medicOf(f.state,b)).toMatchObject({autocast:false,targetId:null});expect(parse(simulationStateSchema,f.state).ok).toBe(true);
});
