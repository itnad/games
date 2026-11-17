import type { EngineRules } from "../core/simulation";
import { isEmbarked } from "./special-state";
import { spellLocked } from "./spells-state";
import { actualHealth, MARINE, STIM, STIM_HEALTH_COST, STIM_TICKS } from "./stim-state";
/** Explicit one-shot health payment. Orders, current attack cooldown and navigation remain intact. */
export function createStimRules(base:EngineRules):EngineRules {
 const fallback=base.commands?.castAbility;
 return {...base,commands:{...base.commands,castAbility:{policy:"partial",validate:(s,c,id)=>{
  if(c.kind!=="castAbility"||c.payload.abilityId!==STIM)return fallback?fallback.validate(s,c,id):"invalid_command";
  const i=s.entities.id.indexOf(id);
  if(!s.economy.enabled||!s.combat||s.entities.definitionId[i]!==MARINE||s.entities.layer[i]!=="ground"||c.target.kind!=="entity"||!c.entityIds.includes(c.target.entityId))return "invalid_target";
  if(isEmbarked(s,id)||spellLocked(s,id))return "invalid_state";
  if(!s.economy.upgrades.some(u=>u.playerId===c.playerId&&u.technologyId===STIM))return "missing_prerequisite";
  return actualHealth(s,id)>STIM_HEALTH_COST*256?null:"insufficient_resource";
 },apply:(s,c,ids)=>{
  if(c.kind!=="castAbility"||c.payload.abilityId!==STIM){fallback?.apply(s,c,ids);return;}
  s.stim??={records:[]};
  for(const id of ids){s.entities.health[s.entities.id.indexOf(id)]-=STIM_HEALTH_COST;const old=s.stim.records.find(r=>r.entityId===id);if(old){old.appliedTick=s.tick;old.expiresTick=s.tick+STIM_TICKS;}else s.stim.records.push({entityId:id,appliedTick:s.tick,expiresTick:s.tick+STIM_TICKS});}
  s.stim.records.sort((a,b)=>a.entityId-b.entityId);
 }}},systems:{...base.systems,construction:s=>{
  if(s.stim)s.stim.records=s.stim.records.filter(r=>r.expiresTick>s.tick&&s.entities.id.includes(r.entityId)&&s.entities.health[s.entities.id.indexOf(r.entityId)]>0);
  base.systems?.construction?.(s);
 }}};
}
