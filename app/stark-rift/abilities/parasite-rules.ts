import type { EngineRules } from "../core/simulation";
import type { BattleMap } from "../data/maps";
import { idleMovement } from "../core/orders";
import { allocateId } from "../core/world";
import { canSeeEntity } from "../vision/rules";
import { energyOf } from "./cloak-state";
import { isEmbarked } from "./special-state";
import { spellLocked,isInStasis } from "./spells-state";
import { RESTORATION } from "./medic-spells-state";
import { medicSpellInRange } from "./medic-spells-rules";
import { QUEEN,ENSNARE,queenCooldown } from "./queen-state";
import { PARASITE,PARASITE_COOLDOWN,emptyParasites,parasiteCooldown } from "./parasite-state";
import original from "../data/parasite-original.json";
export function createParasiteRules(map:BattleMap,base:EngineRules):EngineRules{
 const fallback=base.commands?.castAbility;
 return {...base,commands:{...base.commands,castAbility:{policy:"partial",validate:(s,c,id)=>{
  if(c.kind!=="castAbility"||c.payload.abilityId!==PARASITE){if(c.kind==="castAbility"&&c.payload.abilityId===ENSNARE&&parasiteCooldown(s,id))return "invalid_state";return fallback?fallback.validate(s,c,id):"invalid_command";}
  const e=s.entities,i=e.id.indexOf(id);if(!s.economy.enabled||!s.combat||c.entityIds.length!==1||c.target.kind!=="entity"||e.definitionId[i]!==QUEEN)return "invalid_target";
  if(spellLocked(s,id)||isEmbarked(s,id)||queenCooldown(s,id)||parasiteCooldown(s,id))return "invalid_state";
  const j=e.id.indexOf(c.target.entityId);if(j<0||e.health[j]<=0||e.kind[j]==="building"||isEmbarked(s,e.id[j])||isInStasis(s,e.id[j])||!canSeeEntity(s,map,c.playerId,j))return "invalid_target";
  if(!medicSpellInRange(s,id,e.id[j],original.ability.rangePixels))return "out_of_range";
  return(energyOf(s,id)?.amount??0)<original.ability.energy*256?"insufficient_resource":null;
 },apply:(s,c,ids)=>{
  if(c.kind!=="castAbility"||c.payload.abilityId!==PARASITE||c.target.kind!=="entity"){
   fallback?.apply(s,c,ids);if(c.kind==="castAbility"&&c.payload.abilityId===RESTORATION&&c.target.kind==="entity"&&s.parasites){const target=c.target.entityId;s.parasites.records=s.parasites.records.filter(r=>r.entityId!==target);}return;
  }
  const id=ids[0],e=s.entities,i=e.id.indexOf(id),target=c.target.entityId,j=e.id.indexOf(target);energyOf(s,id)!.amount-=original.ability.energy*256;s.parasites??=emptyParasites();const p=s.parasites;
  const m=s.movement[i],style={formation:m.formation,stance:m.stance};Object.assign(m,idleMovement(id),style);s.navigation.jobs=s.navigation.jobs.filter(v=>v.entityId!==id);
  p.cooldowns=p.cooldowns.filter(r=>r.entityId!==id);p.cooldowns.push({entityId:id,appliedTick:s.tick,expiresTick:s.tick+PARASITE_COOLDOWN});p.cooldowns.sort((a,b)=>a.entityId-b.entityId);
  const old=p.records.find(r=>r.entityId===target);if(old){old.sourceMask|=1<<c.playerId;old.appliedTick=s.tick;}else p.records.push({entityId:target,appliedTick:s.tick,sourceMask:1<<c.playerId});p.records.sort((a,b)=>a.entityId-b.entityId);
  p.effects.push({id:allocateId(s,"nextEventId"),owner:c.playerId,tick:s.tick,sourceId:id,targetId:target,x:e.x[i],y:e.y[i],toX:e.x[j],toY:e.y[j]});p.effects=p.effects.slice(-128);
 }}},systems:{...base.systems,construction:s=>{
  if(s.parasites){s.parasites.cooldowns=s.parasites.cooldowns.filter(r=>r.expiresTick>s.tick);s.parasites.effects=s.parasites.effects.filter(r=>s.tick-r.tick<=20);}base.systems?.construction?.(s);
  if(s.parasites)s.parasites.records=s.parasites.records.filter(r=>{const i=s.entities.id.indexOf(r.entityId);return i>=0&&s.entities.health[i]>0&&(s.entities.kind[i]!=="building"||s.economy.structures.some(b=>b.entityId===r.entityId&&b.morphedWorker&&b.completedTick<0));});
 }}};
}
