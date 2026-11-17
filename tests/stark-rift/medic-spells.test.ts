import {describe,it,expect} from "vitest";
import {getRuntimeMap} from "../../app/stark-rift/data/maps";
import {economyDefinition,ECONOMY_UPGRADES,ECONOMY_DATA_VERSION,STIM_ECONOMY_DATA_VERSION,type Faction} from "../../app/stark-rift/data/economy-catalog";
import {startSimulation,enqueueCommand,stepSimulation} from "../../app/stark-rift/core/simulation";
import {initializeEconomy,createEconomicEntity,newStructure,recomputeSupply,workerOf,releaseWork,indexOf,structureOf} from "../../app/stark-rift/economy/helpers";
import {initializeCombat,synchronizeCombat,createCombatRules,combatReach} from "../../app/stark-rift/combat/rules";
import {initializeVision,canSeeEntity,visibilityMask,createVisionRules,highGroundSight} from "../../app/stark-rift/vision/rules";
import {STASIS_VISION_RULES_VERSION,VISION_RULES_VERSION} from "../../app/stark-rift/vision/state";
import {createMovementRules} from "../../app/stark-rift/core/movement-rules";
import {createEconomyRules} from "../../app/stark-rift/economy/rules";
import {createBurrowRules} from "../../app/stark-rift/abilities/burrow-rules";
import {createCloakRules} from "../../app/stark-rift/abilities/cloak-rules";
import {createSiegeRules} from "../../app/stark-rift/abilities/siege-rules";
import {createLurkerRules} from "../../app/stark-rift/abilities/lurker-rules";
import {createSpecialRules} from "../../app/stark-rift/abilities/special-rules";
import {createSpellsRules} from "../../app/stark-rift/abilities/spells-rules";
import {createAutocastRules} from "../../app/stark-rift/abilities/autocast-rules";
import {createMedicRules} from "../../app/stark-rift/abilities/medic-rules";
import {createStimRules} from "../../app/stark-rift/abilities/stim-rules";
import {createMedicSpellRules,medicSpellInRange} from "../../app/stark-rift/abilities/medic-spells-rules";
import {OPTICAL,RESTORATION,MEDIC_SPELLS,MEDIC_SPELL_COOLDOWN,isBlinded,medicSpellCooldown,medicSpellsFitMap} from "../../app/stark-rift/abilities/medic-spells-state";
import {MEDIC,HEALING} from "../../app/stark-rift/abilities/medic-data";
import {medicOf} from "../../app/stark-rift/abilities/medic-state";
import {STIM,stimOf} from "../../app/stark-rift/abilities/stim-state";
import {STASIS_TICKS,isInStasis} from "../../app/stark-rift/abilities/spells-state";
import {energyOf,activeCloak} from "../../app/stark-rift/abilities/cloak-state";
import {isEmbarked} from "../../app/stark-rift/abilities/special-state";
import {combatProfile} from "../../app/stark-rift/combat/catalog";
import {STIM_COMBAT_RULES_VERSION} from "../../app/stark-rift/combat/state";
import {createRenderSnapshot,validateRenderSnapshot} from "../../app/stark-rift/worker/render-snapshot";
import {createPersistenceEnvelope,restoreSnapshot,simulationStateSchema} from "../../app/stark-rift/core/state";
import {parse} from "../../app/stark-rift/core/validation";
import {checksum} from "../../app/stark-rift/core/checksum";
import {removeEntity} from "../../app/stark-rift/core/world";
import {DevelopmentSaveStore,DEVELOPMENT_SAVE_PREFIX} from "../../app/stark-rift/ui/development-saves";
import type {GameCommand} from "../../app/stark-rift/core/commands";
function fixture(enemy:Faction="terran"){
 const {map,dataVersion}=getRuntimeMap("rift-basin");map.height.fill(0);
 const state=startSimulation(42,map.id,dataVersion,[0,1].map(id=>({id,faction:id===0?"terran":enemy,minerals:2000,gas:2000,supplyUsedHalf:0,supplyCapHalf:0})));
 initializeEconomy(state,map);initializeCombat(state);initializeVision(state,map);for(const w of state.economy.workers)w.autoAllowed=false;
 const visible=(s:typeof state,p:number,i:number)=>canSeeEntity(s,map,p,i);
 const base=createSpellsRules(map,createSpecialRules(map,createLurkerRules(createSiegeRules(createCloakRules(createBurrowRules(map,createVisionRules(map,createCombatRules(createEconomyRules(map,createMovementRules(map,visible,combatReach)),visible,map))))))));
 const rules=createMedicSpellRules(map,createStimRules(createMedicRules(map,createAutocastRules(map,base))));
 const tick=(n=1)=>{for(let i=0;i<n;i++)stepSimulation(state,rules);};
 const issue=(body:object,owner=0)=>{const c={...body,playerId:owner,sequence:state.commandState.lastAcceptedSequenceByPlayer[owner]+1,source:"player",issuedTick:state.tick,executeTick:state.tick+1} as GameCommand;expect(enqueueCommand(state,c,rules)).toEqual({ok:true});return stepSimulation(state,rules)[0];};
 const add=(owner:number,name:string,x=40,y=40)=>{const d=economyDefinition(name)!,tx=Math.floor(x-d.width/2),ty=Math.floor(y-d.height/2),id=createEconomicEntity(state,owner,d,{x:(d.kind==="building"?tx+d.width/2:x)*256,y:(d.kind==="building"?ty+d.height/2:y)*256});if(d.kind==="building")state.economy.structures.push(newStructure(id,d,tx,ty,true,state.tick));const w=workerOf(state,id);if(w)releaseWork(state,w,false);if(name===MEDIC){energyOf(state,id)!.amount=51200;medicOf(state,id)!.autocast=false;}recomputeSupply(state);synchronizeCombat(state);return id;};
 const research=(technologyId:string,playerId=0)=>{if(!state.economy.upgrades.some(u=>u.playerId===playerId&&u.technologyId===technologyId))state.economy.upgrades.push({playerId,technologyId,level:1});};
 const cast=(id:number,abilityId:string,target:number,owner=0)=>issue({kind:"castAbility",entityIds:[id],payload:{abilityId},target:{kind:"entity",entityId:target}},owner);
 const view=(owner=0)=>createRenderSnapshot(state,map,owner,visibilityMask(state,map,owner));
 const saved=()=>createPersistenceEnvelope(state,{camera:{centerX:40*256,centerY:40*256,zoomLevel:1},selection:{entityIds:[],controlGroupIds:[]},openPanel:null},[],"2026-11-17T00:00:00.000Z");
 return {state,map,rules,tick,issue,add,research,cast,view,saved};
}
describe("Medic Optical Flare and Restoration",()=>{
 it.each(MEDIC_SPELLS)("researches $id at Academy for100/100 with exact original half-duration and cancellation refund",t=>{
  const f=fixture(),b=f.add(0,"terran-academy",42,42),a=f.add(0,MEDIC),p=f.add(0,"terran-marine",41,40),cmd={kind:"research",entityIds:[b],payload:{technologyId:t.id}};expect(f.cast(a,t.id,p).accepted).toBe(false);expect(ECONOMY_UPGRADES.find(u=>u.id===t.id)).toMatchObject({producer:"terran-academy",minerals:100,gas:100,ticks:t.id===OPTICAL?750:500,maxLevel:1});f.issue(cmd);expect(f.state.players[0].gas).toBe(1900);f.issue({kind:"cancelResearch",entityIds:[b]});expect(f.state.players[0].gas).toBe(2000);f.issue(cmd);const total=structureOf(f.state,b)!.research!.remainingTicks;f.tick(total-1);expect(f.state.economy.upgrades.some(u=>u.technologyId===t.id)).toBe(false);f.tick();expect(f.state.economy.upgrades).toContainEqual({playerId:0,technologyId:t.id,level:1});expect(f.issue(cmd).accepted).toBe(false);
 });
 it.each(MEDIC_SPELLS)("pays $energy energy for $id, rejects one raw unit below the cost and preserves fixed-frame regeneration",t=>{
  const f=fixture(),a=f.add(0,MEDIC),p=f.add(0,"terran-marine",41,40);f.research(t.id);const r=energyOf(f.state,a)!;r.amount=t.energy*256-1;expect(f.cast(a,t.id,p).accepted).toBe(false);r.amount=t.energy*256;const rem=r.frameRemainder;expect(f.cast(a,t.id,p).accepted).toBe(true);expect(r.amount).toBe(Math.floor((rem+6)/5)*8);expect(medicSpellCooldown(f.state,a)!.expiresTick).toBe(f.state.tick+18);
 });
 it.each(MEDIC_SPELLS)("checks the inclusive $rangePixels pixel hitbox range of $id",t=>{
  const f=fixture(),a=f.add(0,MEDIC),p=f.add(0,"terran-marine"),e=f.state.entities,i=indexOf(f.state,a),j=indexOf(f.state,p);f.research(t.id);e.x[j]=e.x[i]+(combatProfile(MEDIC)!.bounds[2]+combatProfile("terran-marine")!.bounds[0]+t.rangePixels)*8;expect(medicSpellInRange(f.state,a,p,t.rangePixels)).toBe(true);e.x[j]++;expect(f.cast(a,t.id,p)).toMatchObject({accepted:false,code:"out_of_range"});e.x[j]--;expect(f.cast(a,t.id,p).accepted).toBe(true);
 });
 it("uses only status effects, without applying the nonzero weapon damage fields to HP or shields",()=>{
  const f=fixture("protoss"),a=f.add(0,MEDIC),b=f.add(0,MEDIC,40,42),target=f.add(1,"protoss-shuttle",41,40),i=indexOf(f.state,target),before=[f.state.entities.health[i],f.state.entities.shield[i]];f.research(OPTICAL);f.research(RESTORATION);f.cast(a,OPTICAL,target);expect(isBlinded(f.state,target)).toBe(true);expect([f.state.entities.health[i],f.state.entities.shield[i]]).toEqual(before);f.cast(b,RESTORATION,target);expect(isBlinded(f.state,target)).toBe(false);expect([f.state.entities.health[i],f.state.entities.shield[i]]).toEqual(before);
 });
 it("reduces shared sight and high-ground sight to2tiles, retaining explored fog memory, then restores them",()=>{
  const f=fixture(),p=f.add(0,"terran-marine"),a=f.add(1,MEDIC,44,40),b=f.add(1,MEDIC,43,42);f.research(OPTICAL,1);f.research(RESTORATION,1);f.tick();const cell=(x:number)=>40*f.map.widthTiles+x;expect(visibilityMask(f.state,f.map,0)[cell(43)]).toBe(2);expect(highGroundSight(f.state,f.map,0,indexOf(f.state,a))).toBe(true);f.cast(a,OPTICAL,p,1);const mask=visibilityMask(f.state,f.map,0);expect(mask[cell(42)]).toBe(2);expect(mask[cell(43)]).toBe(1);expect(highGroundSight(f.state,f.map,0,indexOf(f.state,a))).toBe(false);f.cast(b,RESTORATION,p,1);expect(visibilityMask(f.state,f.map,0)[cell(43)]).toBe(2);expect(highGroundSight(f.state,f.map,0,indexOf(f.state,a))).toBe(true);
 });
 it("disables an air detector even where shared sight still reveals a cloaked Ghost tile, and restores detection",()=>{
  const f=fixture("zerg"),a=f.add(0,MEDIC),b=f.add(0,MEDIC,40,42),g=f.add(0,"terran-ghost",42,40),lord=f.add(1,"zerg-overlord",43,40);f.research(OPTICAL);f.research(RESTORATION);f.research("personnel-cloaking");f.issue({kind:"toggleStateAbility",entityIds:[g],payload:{abilityId:"cloak",enabled:true}});expect(canSeeEntity(f.state,f.map,1,indexOf(f.state,g))).toBe(true);f.cast(a,OPTICAL,lord);expect(visibilityMask(f.state,f.map,1)[40*f.map.widthTiles+42]).toBe(2);expect(canSeeEntity(f.state,f.map,1,indexOf(f.state,g))).toBe(false);f.cast(b,RESTORATION,lord);expect(canSeeEntity(f.state,f.map,1,indexOf(f.state,g))).toBe(true);
 });
 it("retains permanent blindness after the source dies and during cargo, but rejects casting on an embarked target",()=>{
  const f=fixture(),a=f.add(0,MEDIC),b=f.add(0,MEDIC,40,42),p=f.add(0,"terran-marine",41,40),ship=f.add(0,"terran-dropship",41,40);f.research(OPTICAL);f.research(RESTORATION);f.cast(a,OPTICAL,p);removeEntity(f.state,a);f.issue({kind:"loadTransport",entityIds:[ship],target:{kind:"entity",entityId:p}});f.tick(10);expect(isEmbarked(f.state,p)).toBe(true);expect(f.view().economy!.transports!.find(t=>t.entityId===ship)!.passengers[0].blinded).toBe(true);expect(f.cast(b,RESTORATION,p).accepted).toBe(false);f.tick(1000);expect(isBlinded(f.state,p)).toBe(true);f.issue({kind:"unloadTransport",entityIds:[ship],target:{kind:"point",x:41*256,y:40*256}});f.tick(10);f.cast(b,RESTORATION,p);expect(isBlinded(f.state,p)).toBe(false);expect(parse(simulationStateSchema,f.state).ok).toBe(true);
 });
 it("keeps Stim and HP fractions while restoring blindness and does not remove personal cloak",()=>{
  const f=fixture(),a=f.add(0,MEDIC),b=f.add(0,MEDIC,40,42),p=f.add(0,"terran-marine",41,40),g=f.add(0,"terran-ghost",42,40);for(const id of [OPTICAL,RESTORATION,STIM,"personnel-cloaking"])f.research(id);f.issue({kind:"castAbility",entityIds:[p],payload:{abilityId:STIM},target:{kind:"entity",entityId:p}});f.state.combat!.records.find(r=>r.entityId===p)!.healthFraction=19;f.cast(a,OPTICAL,p);f.cast(b,RESTORATION,p);expect(isBlinded(f.state,p)).toBe(false);expect(stimOf(f.state,p)).toBeDefined();expect(f.state.entities.health[indexOf(f.state,p)]).toBe(30);expect(f.state.combat!.records.find(r=>r.entityId===p)!.healthFraction).toBe(19);f.tick(18);f.issue({kind:"toggleStateAbility",entityIds:[g],payload:{abilityId:"cloak",enabled:true}});f.cast(b,RESTORATION,g);expect(activeCloak(f.state,g)).toBe(true);
 });
 it("rejects hidden enemies, buildings, unsupported casters and multi-caster duplication without payment",()=>{
  const f=fixture(),a=f.add(0,MEDIC),b=f.add(0,MEDIC,40,42),g=f.add(1,"terran-ghost",41,40),building=f.add(1,"terran-barracks",44,42);f.research(OPTICAL);f.research("personnel-cloaking",1);f.issue({kind:"toggleStateAbility",entityIds:[g],payload:{abilityId:"cloak",enabled:true}},1);const before=energyOf(f.state,a)!.amount;expect(f.cast(a,OPTICAL,g).accepted).toBe(false);expect(f.cast(a,OPTICAL,building).accepted).toBe(false);expect(f.cast(g,OPTICAL,a,1).accepted).toBe(false);expect(f.issue({kind:"castAbility",entityIds:[a,b],payload:{abilityId:OPTICAL},target:{kind:"entity",entityId:a}}).accepted).toBe(false);expect(energyOf(f.state,a)!.amount).toBe(before);
 });
 it("does not dispel Stasis and rejects a frozen caster or patient",()=>{
  const f=fixture(),a=f.add(0,MEDIC),p=f.add(0,"terran-marine",41,40);f.research(RESTORATION);f.state.spells={stasis:[{entityId:p,appliedTick:0,expiresTick:STASIS_TICKS,x:41*256,y:40*256}],recalls:[],effects:[]};expect(f.cast(a,RESTORATION,p).accepted).toBe(false);expect(isInStasis(f.state,p)).toBe(true);f.state.spells.stasis.push({entityId:a,appliedTick:0,expiresTick:STASIS_TICKS,x:40*256,y:40*256});expect(f.cast(a,RESTORATION,a).accepted).toBe(false);
 });
 it("cancels healing and movement only on a successful spell, gives shared18tick cooldown and resumes manual healing later",()=>{
  const f=fixture(),a=f.add(0,MEDIC),p=f.add(0,"terran-marine",42,40);f.research(OPTICAL);f.state.entities.health[indexOf(f.state,p)]=20;f.cast(a,HEALING,p);expect(medicOf(f.state,a)!.manual).toBe(true);f.cast(a,OPTICAL,p);expect(medicOf(f.state,a)).toMatchObject({targetId:null,manual:false,manualUntilTick:f.state.tick+20});expect(f.state.movement[indexOf(f.state,a)].order).toBe("idle");expect(f.cast(a,HEALING,p)).toMatchObject({accepted:false,code:"invalid_state"});f.tick(MEDIC_SPELL_COOLDOWN);expect(f.cast(a,HEALING,p).accepted).toBe(true);
 });
 it("allows self and repeat casts, charges harmless Restoration and retains both source-owner bits",()=>{
  const f=fixture(),a=f.add(0,MEDIC),b=f.add(1,MEDIC,41,40);for(const owner of [0,1]){f.research(OPTICAL,owner);f.research(RESTORATION,owner);}f.cast(a,OPTICAL,a);f.cast(b,OPTICAL,a,1);expect(f.state.medicSpells!.blind).toEqual([{entityId:a,appliedTick:f.state.tick,sourceMask:3}]);f.tick(18);f.cast(a,RESTORATION,a);expect(isBlinded(f.state,a)).toBe(false);f.tick(18);const before=energyOf(f.state,b)!.amount;f.cast(b,RESTORATION,b,1);expect(energyOf(f.state,b)!.amount).toBeLessThan(before-49*256);
 });
 it("round-trips blindness, cast cooldown, effects and energy with deterministic continuation",()=>{
  const f=fixture(),a=f.add(0,MEDIC),p=f.add(0,"terran-dropship",41,40);f.research(OPTICAL);f.cast(a,OPTICAL,p);const copy=restoreSnapshot(JSON.stringify(f.saved())).simulation;for(let n=0;n<30;n++){f.tick();stepSimulation(copy,f.rules);}expect(checksum(copy)).toBe(checksum(f.state));expect(isBlinded(copy,p)).toBe(true);expect(copy.medicSpells!.cooldowns).toEqual([]);expect(copy.medicSpells!.effects).toEqual([]);
 });
 it("migrates20 without changing active Stim, Medic jobs, fractions, energy or RNG and keeps the exact raw backup",()=>{
  const f=fixture(),a=f.add(0,MEDIC),p=f.add(0,"terran-marine",44,40);f.research(STIM);f.issue({kind:"castAbility",entityIds:[p],payload:{abilityId:STIM},target:{kind:"entity",entityId:p}});f.cast(a,HEALING,p);const old=f.saved();old.formatVersion=old.simulation.schemaVersion=20;old.engineVersion=old.simulation.engineVersion="0.21.0-stage6k";old.simulation.combat!.rulesVersion=STIM_COMBAT_RULES_VERSION;old.simulation.vision!.rulesVersion=STASIS_VISION_RULES_VERSION as never;old.dataVersion=old.simulation.dataVersion=old.dataVersion.replace(ECONOMY_DATA_VERSION,STIM_ECONOMY_DATA_VERSION);old.checksum=checksum(old.simulation);const raw=JSON.stringify(old),key=DEVELOPMENT_SAVE_PREFIX+"terran",records=new Map([[key,raw]]),store=new DevelopmentSaveStore({getItem:k=>records.get(k)??null,setItem:(k,v)=>{records.set(k,v);}}),read=store.read("terran");expect(read.status).toBe("ready");if(read.status!=="ready")throw Error("migration");for(const field of ["stim","medics","energy","players","movement","rngStreams","commandState"]as const)expect(read.snapshot.simulation[field]).toEqual(old.simulation[field]);expect(read.snapshot.simulation.medicSpells).toBeUndefined();expect(read.snapshot.simulation.vision!.rulesVersion).toBe(VISION_RULES_VERSION);expect(store.write(read.snapshot)).toBe(true);expect(records.get(key+".stage6k-backup")).toBe(raw);for(const type of ["state","research"]){const forged=structuredClone(old);if(type==="state")forged.simulation.medicSpells={blind:[],cooldowns:[],effects:[]};else forged.simulation.economy.upgrades.push({playerId:0,technologyId:OPTICAL,level:1});forged.checksum=checksum(forged.simulation);expect(()=>restoreSnapshot(JSON.stringify(forged))).toThrow();}
 });
 it("sanitizes effect references, keeps enemy cooldown private, validates flags and removes dead status references",()=>{
  const f=fixture(),a=f.add(0,MEDIC),p=f.add(0,"terran-marine",41,40);f.research(OPTICAL);f.cast(a,OPTICAL,p);const v=f.view();expect(v.entities.find(e=>e.id===p)!.blinded).toBe(true);expect(v.medicSpellEffects).toHaveLength(1);expect(v.medicSpellEffects![0]).not.toHaveProperty("targetId");expect(validateRenderSnapshot(v).ok).toBe(true);f.add(1,"terran-scv",43,40);const enemy=f.view(1);expect(enemy.entities.some(e=>e.id===a)).toBe(true);expect(enemy.entities.every(e=>e.medicSpellCooldownTicks===undefined)).toBe(true);const row=f.state.medicSpells!.blind[0];row.appliedTick=f.state.tick+1;expect(parse(simulationStateSchema,f.state).ok).toBe(false);row.appliedTick=f.state.tick;f.state.medicSpells!.effects[0].toX=f.map.widthTiles*256;expect(medicSpellsFitMap(f.state,f.map)).toBe(false);f.state.medicSpells!.effects[0].toX=41*256;removeEntity(f.state,p);expect(f.state.medicSpells!.blind).toEqual([]);expect(parse(simulationStateSchema,f.state).ok).toBe(true);
 });
});
it("preserves partial Stim execution through the new spell wrapper",()=>{
 const f=fixture(),a=f.add(0,"terran-marine"),b=f.add(0,"terran-marine",42,40);f.research(STIM);f.state.entities.health[indexOf(f.state,b)]=10;expect(f.issue({kind:"castAbility",entityIds:[a,b],payload:{abilityId:STIM},target:{kind:"entity",entityId:a}})).toMatchObject({accepted:true,executedEntityIds:[a]});expect(f.state.entities.health[indexOf(f.state,a)]).toBe(30);expect(f.state.entities.health[indexOf(f.state,b)]).toBe(10);
});
it("rejects duplicate blind rows, building forgery and malformed cooldowns",()=>{
 const f=fixture(),a=f.add(0,MEDIC),p=f.add(0,"terran-marine",41,40),b=f.add(0,"terran-barracks",44,44);f.research(OPTICAL);f.cast(a,OPTICAL,p);const m=f.state.medicSpells!;m.blind.push({...m.blind[0]});expect(parse(simulationStateSchema,f.state).ok).toBe(false);m.blind.pop();m.blind[0].entityId=b;expect(parse(simulationStateSchema,f.state).ok).toBe(false);m.blind[0].entityId=p;m.cooldowns[0].expiresTick++;expect(parse(simulationStateSchema,f.state).ok).toBe(false);m.cooldowns[0].expiresTick--;expect(parse(simulationStateSchema,f.state).ok).toBe(true);
});
it("retains a Drone's blindness through construction cancellation and clears it when its building completes",()=>{
 const f=fixture("zerg"),a=f.add(0,MEDIC,82,76),drone=f.add(1,"zerg-drone",81,78);f.research(OPTICAL);f.cast(a,OPTICAL,drone);const build={kind:"placeBuilding",entityIds:[drone],target:{kind:"point",x:79*256,y:77*256},payload:{buildingId:"zerg-spawning-pool"}};expect(f.issue(build,1).accepted).toBe(true);for(let n=0;n<30&&!structureOf(f.state,drone);n++)f.tick();expect(structureOf(f.state,drone)!.morphedWorker).toBe(true);expect(isBlinded(f.state,drone)).toBe(true);expect(f.view(1).entities.find(e=>e.id===drone)!.blinded).toBeUndefined();f.issue({kind:"cancelConstruction",entityIds:[drone]},1);expect(f.state.entities.definitionId[indexOf(f.state,drone)]).toBe("zerg-drone");expect(isBlinded(f.state,drone)).toBe(true);expect(f.issue(build,1).accepted).toBe(true);for(let n=0;n<30&&!structureOf(f.state,drone);n++)f.tick();const remaining=structureOf(f.state,drone)!.remainingTicks;f.tick(remaining+2);expect(structureOf(f.state,drone)!.completedTick).toBeGreaterThanOrEqual(0);expect(isBlinded(f.state,drone)).toBe(false);expect(parse(simulationStateSchema,f.state).ok).toBe(true);
});
