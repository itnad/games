import type { EngineRules } from "../core/simulation";
import type { SimulationState } from "../core/state";
import type { BattleMap } from "../data/maps";
import { idleMovement } from "../core/orders";
import { allocateId } from "../core/world";
import { combatProfile } from "../combat/catalog";
import { canSeeEntity } from "../vision/rules";
import { energyOf, ENERGY } from "./cloak-state";
import { isEmbarked } from "./special-state";
import { spellLocked,isInStasis } from "./spells-state";
import { MEDIC,HEALING } from "./medic-data";
import { medicOf,clearMedicJob } from "./medic-state";
import { OPTICAL,RESTORATION,MEDIC_SPELLS,MEDIC_SPELL_COOLDOWN,emptyMedicSpells,medicSpellCooldown } from "./medic-spells-state";
export function medicSpellInRange(s:SimulationState,a:number,b:number,pixels:number):boolean {
 const e=s.entities,i=e.id.indexOf(a),j=e.id.indexOf(b),p=combatProfile(e.definitionId[i]),q=combatProfile(e.definitionId[j]);if(!p||!q)return false;
 const dx=Math.max(0,e.x[j]-q.bounds[0]*8-e.x[i]-p.bounds[2]*8,e.x[i]-p.bounds[0]*8-e.x[j]-q.bounds[2]*8),dy=Math.max(0,e.y[j]-q.bounds[1]*8-e.y[i]-p.bounds[3]*8,e.y[i]-p.bounds[1]*8-e.y[j]-q.bounds[3]*8);return dx*dx+dy*dy<=(pixels*8)**2;
}
export function createMedicSpellRules(map:BattleMap,base:EngineRules):EngineRules {
 const fallback=base.commands?.castAbility;
 return {...base,commands:{...base.commands,castAbility:{policy:"partial",validate:(s,c,id)=>{
  if(c.kind!=="castAbility"||![OPTICAL,RESTORATION].includes(c.payload.abilityId)){
   if(c.kind==="castAbility"&&c.payload.abilityId===HEALING&&medicSpellCooldown(s,id))return "invalid_state";
   return fallback?fallback.validate(s,c,id):"invalid_command";
  }
  const e=s.entities,i=e.id.indexOf(id),tech=MEDIC_SPELLS.find(t=>t.id===c.payload.abilityId)!;
  if(!s.economy.enabled||!s.combat||c.entityIds.length!==1||c.target.kind!=="entity"||e.definitionId[i]!==MEDIC)return "invalid_target";
  if(spellLocked(s,id)||isEmbarked(s,id)||medicSpellCooldown(s,id)||s.special?.transports.some(t=>t.loadQueue.includes(id)))return "invalid_state";
  if(!s.economy.upgrades.some(u=>u.playerId===c.playerId&&u.technologyId===tech.id))return "missing_prerequisite";
  const j=e.id.indexOf(c.target.entityId);
  if(j<0||e.health[j]<=0||e.kind[j]==="building"||isEmbarked(s,e.id[j])||isInStasis(s,e.id[j])||!canSeeEntity(s,map,c.playerId,j))return "invalid_target";
  if(!medicSpellInRange(s,id,e.id[j],tech.rangePixels))return "out_of_range";
  return (energyOf(s,id)?.amount??0)<tech.energy*ENERGY.scale?"insufficient_resource":null;
 },apply:(s,c,ids)=>{
  if(c.kind!=="castAbility"||![OPTICAL,RESTORATION].includes(c.payload.abilityId)||c.target.kind!=="entity"){fallback?.apply(s,c,ids);return;}
  const id=ids[0],e=s.entities,i=e.id.indexOf(id),target=c.target.entityId,j=e.id.indexOf(target),tech=MEDIC_SPELLS.find(t=>t.id===c.payload.abilityId)!;energyOf(s,id)!.amount-=tech.energy*256;s.medicSpells??=emptyMedicSpells();const m=s.medicSpells;
  const healer=medicOf(s,id);if(healer){clearMedicJob(healer);healer.held=false;healer.manualUntilTick=s.tick+20;}
  const motion=s.movement[i],style={formation:motion.formation,stance:motion.stance};Object.assign(motion,idleMovement(id),style);s.navigation.jobs=s.navigation.jobs.filter(r=>r.entityId!==id);
  m.cooldowns=m.cooldowns.filter(r=>r.entityId!==id);m.cooldowns.push({entityId:id,appliedTick:s.tick,expiresTick:s.tick+MEDIC_SPELL_COOLDOWN});m.cooldowns.sort((a,b)=>a.entityId-b.entityId);
  if(tech.id===OPTICAL){const old=m.blind.find(r=>r.entityId===target);if(old){old.sourceMask|=1<<c.playerId;old.appliedTick=s.tick;}else m.blind.push({entityId:target,appliedTick:s.tick,sourceMask:1<<c.playerId});m.blind.sort((a,b)=>a.entityId-b.entityId);}
  else m.blind=m.blind.filter(r=>r.entityId!==target);
  m.effects.push({id:allocateId(s,"nextEventId"),abilityId:tech.id as typeof OPTICAL|typeof RESTORATION,owner:c.playerId,tick:s.tick,sourceId:id,targetId:target,x:e.x[i],y:e.y[i],toX:e.x[j],toY:e.y[j]});m.effects=m.effects.slice(-128);
 }}},systems:{...base.systems,construction:s=>{if(s.medicSpells){s.medicSpells.cooldowns=s.medicSpells.cooldowns.filter(r=>r.expiresTick>s.tick);s.medicSpells.effects=s.medicSpells.effects.filter(r=>s.tick-r.tick<=20);}base.systems?.construction?.(s);if(s.medicSpells)s.medicSpells.blind=s.medicSpells.blind.filter(r=>{const i=s.entities.id.indexOf(r.entityId);return i>=0&&s.entities.health[i]>0&&(s.entities.kind[i]!=="building"||s.economy.structures.some(b=>b.entityId===r.entityId&&b.morphedWorker&&b.completedTick<0));});}}};
}
