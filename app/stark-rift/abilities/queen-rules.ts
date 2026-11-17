import type { EngineRules } from "../core/simulation";
import type { BattleMap } from "../data/maps";
import { idleMovement } from "../core/orders";
import { allocateId } from "../core/world";
import { combatProfile } from "../combat/catalog";
import { energyOf } from "./cloak-state";
import { isEmbarked } from "./special-state";
import { isBurrowed } from "./burrow";
import { spellLocked,isInStasis } from "./spells-state";
import { spellArea } from "./spells-rules";
import { RESTORATION } from "./medic-spells-state";
import { QUEEN,ENSNARE,ENSNARE_TICKS,QUEEN_CAST_COOLDOWN,emptyQueen,queenCooldown } from "./queen-state";
import original from "../data/queen-original.json";
export function createQueenRules(map:BattleMap,base:EngineRules):EngineRules {
 const fallback=base.commands?.castAbility;
 return {...base,commands:{...base.commands,castAbility:{policy:"partial",validate:(s,c,id)=>{
  if(c.kind!=="castAbility"||c.payload.abilityId!==ENSNARE)return fallback?fallback.validate(s,c,id):"invalid_command";
  const e=s.entities,i=e.id.indexOf(id);if(c.entityIds.length!==1||c.target.kind!=="point"||!s.economy.enabled||!s.combat||e.definitionId[i]!==QUEEN)return "invalid_target";
  if(spellLocked(s,id)||isEmbarked(s,id)||queenCooldown(s,id))return "invalid_state";
  if(!s.economy.upgrades.some(u=>u.playerId===c.playerId&&u.technologyId===ENSNARE))return "missing_prerequisite";
  const p=combatProfile(QUEEN)!.bounds,{x,y}=c.target,dx=Math.max(0,e.x[i]-p[0]*8-x,x-e.x[i]-p[2]*8),dy=Math.max(0,e.y[i]-p[1]*8-y,y-e.y[i]-p[3]*8);
  if(x>=map.widthTiles*256||y>=map.heightTiles*256||dx*dx+dy*dy>(original.technology.rangePixels*8)**2)return "out_of_range";
  return (energyOf(s,id)?.amount??0)<original.technology.energy*256?"insufficient_resource":null;
 },apply:(s,c,ids)=>{
  if(c.kind!=="castAbility"||c.payload.abilityId!==ENSNARE||c.target.kind!=="point"){
   fallback?.apply(s,c,ids);if(c.kind==="castAbility"&&c.payload.abilityId===RESTORATION&&c.target.kind==="entity"&&s.queen){const target=c.target.entityId;s.queen.ensnared=s.queen.ensnared.filter(r=>r.entityId!==target);}return;
  }
  const id=ids[0],e=s.entities,i=e.id.indexOf(id),{x,y}=c.target;energyOf(s,id)!.amount-=original.technology.energy*256;s.queen??=emptyQueen();const q=s.queen;
  const m=s.movement[i],style={formation:m.formation,stance:m.stance};Object.assign(m,idleMovement(id),style);s.navigation.jobs=s.navigation.jobs.filter(j=>j.entityId!==id);
  q.cooldowns=q.cooldowns.filter(r=>r.entityId!==id);q.cooldowns.push({entityId:id,appliedTick:s.tick,expiresTick:s.tick+QUEEN_CAST_COOLDOWN});q.cooldowns.sort((a,b)=>a.entityId-b.entityId);
  for(let j=0;j<e.id.length;j++){const target=e.id[j];if(target===id||e.health[j]<=0||e.kind[j]==="building"||isEmbarked(s,target)||isBurrowed(s,target)||isInStasis(s,target)||!spellArea(s,j,x,y,original.ensnare.halfWidthPixels*8))continue;const old=q.ensnared.find(r=>r.entityId===target);if(old){old.appliedTick=s.tick;old.expiresTick=s.tick+ENSNARE_TICKS;}else q.ensnared.push({entityId:target,appliedTick:s.tick,expiresTick:s.tick+ENSNARE_TICKS});}
  q.ensnared.sort((a,b)=>a.entityId-b.entityId);q.effects.push({id:allocateId(s,"nextEventId"),owner:c.playerId,tick:s.tick,x,y});q.effects=q.effects.slice(-128);
 }}},systems:{...base.systems,construction:s=>{
  if(s.queen){s.queen.ensnared=s.queen.ensnared.filter(r=>r.expiresTick>s.tick);s.queen.cooldowns=s.queen.cooldowns.filter(r=>r.expiresTick>s.tick);s.queen.effects=s.queen.effects.filter(r=>s.tick-r.tick<=20);}
  base.systems?.construction?.(s);
  if(s.queen)s.queen.ensnared=s.queen.ensnared.filter(r=>{const i=s.entities.id.indexOf(r.entityId);return i>=0&&s.entities.health[i]>0&&(s.entities.kind[i]!=="building"||s.economy.structures.some(b=>b.entityId===r.entityId&&b.morphedWorker&&b.completedTick<0));});
 }}};
}
