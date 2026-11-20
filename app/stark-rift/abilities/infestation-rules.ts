import type {EngineRules} from "../core/simulation";
import type {SimulationState} from "../core/state";
import type {BattleMap} from "../data/maps";
import {allocateId} from "../core/world";
import {idleMovement} from "../core/orders";
import {economyDefinition} from "../data/economy-catalog";
import {detachEconomyEntity} from "../economy/cleanup";
import {structureOf,complete,newStructure,recomputeSupply} from "../economy/helpers";
import {synchronizeCombat} from "../combat/rules";
import {canSeeEntity} from "../vision/rules";
import {isEmbarked} from "./special-state";
import {isBurrowed} from "./burrow";
import {spellLocked} from "./spells-state";
import {medicSpellInRange} from "./medic-spells-rules";
import {INFESTATION,INFESTED_CENTER,INFESTED_TERRAN,SUICIDE,INFESTATION_RANGE,emptyInfestation} from "./infestation-state";
export function convertInfestedCenter(s:SimulationState,id:number,owner:number){
 const e=s.entities,i=e.id.indexOf(id),old=structureOf(s,id)!,payer=e.owner[i],d=economyDefinition(INFESTED_CENTER)!;
 // Paid reservations return to the payer; capture never grants the opponent's resources.
 for(const q of old.queue){s.players[payer].minerals+=q.minerals;s.players[payer].gas+=q.gas;}
 if(old.research){s.players[payer].minerals+=old.research.minerals;s.players[payer].gas+=old.research.gas;old.research=null;}
 detachEconomyEntity(s,id);e.owner[i]=owner;e.definitionId[i]=d.id;e.health[i]=d.health;e.shield[i]=d.shield;e.speed[i]=0;e.radius[i]=d.radius;
 s.economy.structures.push(newStructure(id,d,old.tileX,old.tileY,true,s.tick));s.economy.structures.sort((a,b)=>a.entityId-b.entityId);
 for(const p of s.players)if(p.id!==owner)for(const g of p.controlGroups)g.entityIds=g.entityIds.filter(v=>v!==id);
 for(const m of s.movement)if(m.entityId===id||m.targetEntityId===id&&e.owner[e.id.indexOf(m.entityId)]===owner){const style={formation:m.formation,stance:m.stance};Object.assign(m,idleMovement(m.entityId),style);s.navigation.jobs=s.navigation.jobs.filter(j=>j.entityId!==m.entityId);}
 s.map.obstacleVersion++;synchronizeCombat(s);recomputeSupply(s);s.infestation??=emptyInfestation();s.infestation.effects.push({id:allocateId(s,"nextEventId"),owner,tick:s.tick,x:e.x[i],y:e.y[i]});s.infestation.effects=s.infestation.effects.slice(-128);
}
export function createInfestationRules(map:BattleMap,base:EngineRules):EngineRules{
 const commands={...base.commands},fallback=commands.castAbility;
 for(const kind of Object.keys(commands)as(keyof typeof commands)[]){const h=commands[kind]!;commands[kind]={...h,validate:(s,c,id)=>s.infestation?.detonations.includes(id)?"invalid_state":h.validate(s,c,id)};}
 commands.castAbility={policy:"partial",validate:(s,c,id)=>{
  if(s.infestation?.detonations.includes(id))return "invalid_state";
  if(c.kind!=="castAbility"||![INFESTATION,SUICIDE].includes(c.payload.abilityId))return fallback?fallback.validate(s,c,id):"invalid_command";
  const e=s.entities,i=e.id.indexOf(id);if(!s.economy.enabled||!s.combat||c.target.kind!=="entity")return "invalid_target";
  if(spellLocked(s,id)||isEmbarked(s,id)||isBurrowed(s,id))return "invalid_state";
  if(c.payload.abilityId===SUICIDE)return e.definitionId[i]===INFESTED_TERRAN?null:"invalid_target";
  if(c.entityIds.length!==1||e.definitionId[i]!=="zerg-queen")return "invalid_target";
  const j=e.id.indexOf(c.target.entityId),b=structureOf(s,c.target.entityId),d=economyDefinition("terran-command-center")!;
  if(j<0||e.health[j]<=0||e.owner[j]===c.playerId||e.definitionId[j]!==d.id||e.layer[j]!=="ground"||!b||!complete(b)||e.health[j]*100>=d.health*50||!canSeeEntity(s,map,c.playerId,j))return "invalid_target";
  return medicSpellInRange(s,id,e.id[j],INFESTATION_RANGE)?null:"out_of_range";
 },apply:(s,c,ids)=>{
  if(c.kind!=="castAbility"||![INFESTATION,SUICIDE].includes(c.payload.abilityId)){fallback?.apply(s,c,ids);return;}
  if(c.payload.abilityId===SUICIDE){s.infestation??=emptyInfestation();for(const id of ids)if(!s.infestation.detonations.includes(id))s.infestation.detonations.push(id);return;}
  if(c.target.kind!=="entity")return;const id=ids[0],i=s.entities.id.indexOf(id),m=s.movement[i],style={formation:m.formation,stance:m.stance};Object.assign(m,idleMovement(id),style);s.navigation.jobs=s.navigation.jobs.filter(j=>j.entityId!==id);convertInfestedCenter(s,c.target.entityId,c.playerId);
 }};
 return {...base,commands,systems:{...base.systems,construction:s=>{if(s.infestation)s.infestation.effects=s.infestation.effects.filter(e=>s.tick-e.tick<=20);base.systems?.construction?.(s);}}};
}
