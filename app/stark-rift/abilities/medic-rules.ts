import { NavigationGrid } from "../pathfinding/navigation";
import { SpatialHash } from "../pathfinding/spatial-hash";
import { destinationAvailable } from "../pathfinding/destinations";
import type { EngineRules } from "../core/simulation";
import type { SimulationState } from "../core/state";
import type { BattleMap } from "../data/maps";
import { idleMovement } from "../core/orders";
import { economyDefinition } from "../data/economy-catalog";
import { combatProfile, hasBasicWeapon } from "../combat/catalog";
import { canSeeEntity, visibilityMask } from "../vision/rules";
import { energyOf, ENERGY } from "./cloak-state";
import { maximumEnergy } from "./energy-upgrades";
import { isEmbarked } from "./special-state";
import { spellLocked, isInStasis } from "./spells-state";
import { MEDIC, HEALING, MEDIC_HEALING as H } from "./medic-data";
import { medicOf, medicPatient, clearMedicJob, type MedicRecord } from "./medic-state";

export function missingMedicHealth(s:SimulationState,id:number):number {
 const i=s.entities.id.indexOf(id),d=economyDefinition(s.entities.definitionId[i]);
 if(i<0||!d)return 0;
 const fraction=s.combat?.records.find(r=>r.entityId===id)?.healthFraction??0;
 return Math.max(0,d.health*256-(s.entities.health[i]*256-fraction));
}
export function medicInRangeAt(s:SimulationState,a:number,b:number,point:{x:number;y:number}):boolean {
 const e=s.entities,i=e.id.indexOf(a),j=e.id.indexOf(b),p=combatProfile(e.definitionId[i]),q=combatProfile(e.definitionId[j]);
 if(!p||!q)return false;
 const dx=Math.max(0,e.x[j]-q.bounds[0]*8-point.x-p.bounds[2]*8,point.x-p.bounds[0]*8-e.x[j]-q.bounds[2]*8),dy=Math.max(0,e.y[j]-q.bounds[1]*8-point.y-p.bounds[3]*8,point.y-p.bounds[1]*8-e.y[j]-q.bounds[3]*8);
 return dx*dx+dy*dy<=(H.rangePixels*8)**2;
}
export function medicInRange(s:SimulationState,a:number,b:number):boolean {
 const i=s.entities.id.indexOf(a);return i>=0&&medicInRangeAt(s,a,b,{x:s.entities.x[i],y:s.entities.y[i]});
}
/** Choose a legal endpoint candidate inside the actual healing range, without formation padding. */
function approachPoint(s:SimulationState,map:BattleMap,r:MedicRecord):{x:number;y:number}|null {
 if(r.targetId===null)return null;
 const e=s.entities,i=e.id.indexOf(r.entityId),j=e.id.indexOf(r.targetId),a=combatProfile(e.definitionId[i]),b=combatProfile(e.definitionId[j]);if(!a||!b)return null;
 const grid=new NavigationGrid(map,s,new SpatialHash(s),false,true),cx=Math.floor(e.x[j]/128),cy=Math.floor(e.y[j]/128),radius=Math.ceil((H.rangePixels+Math.max(...a.bounds)+Math.max(...b.bounds))*8/128)+1,ideal=goal(s,r.entityId,r.targetId),points:{x:number;y:number}[]=[];
 for(let y=Math.max(0,cy-radius);y<=Math.min(grid.height-1,cy+radius);y++)for(let x=Math.max(0,cx-radius);x<=Math.min(grid.width-1,cx+radius);x++){
  const p=grid.point(y*grid.width+x);
  if(medicInRangeAt(s,r.entityId,r.targetId,p)&&grid.clear(p,e.radius[i],e.layer[i],r.entityId)&&destinationAvailable(s,r.entityId,p,e.radius[i],e.layer[i]))points.push(p);
 }
 points.sort((p,q)=>(p.x-e.x[i])**2+(p.y-e.y[i])**2-(q.x-e.x[i])**2-(q.y-e.y[i])**2 || (p.x-ideal.x)**2+(p.y-ideal.y)**2-(q.x-ideal.x)**2-(q.y-ideal.y)**2 || p.y-q.y || p.x-q.x);
 return points.find(p=>r.manual||medicFrontlineAllows(s,map,r.entityId,p))??null;
}
function requestApproach(s:SimulationState,r:MedicRecord,p:{x:number;y:number}) {
 const i=s.entities.id.indexOf(r.entityId),m=s.movement[i],style={formation:m.formation,stance:m.stance};
 Object.assign(m,idleMovement(r.entityId),style,{order:"move",origin:{x:s.entities.x[i],y:s.entities.y[i]},target:p,status:"waiting",priority:2,requestTick:s.tick,transitFormation:style.formation,obstacleVersion:s.map.obstacleVersion});
 s.navigation.jobs=s.navigation.jobs.filter(j=>j.entityId!==r.entityId);
}
const loading=(s:SimulationState,id:number)=>s.special?.transports.some(t=>t.loadQueue.includes(id))??false;
function stopMedic(s:SimulationState,r:MedicRecord) {
 const i=s.entities.id.indexOf(r.entityId);if(i<0)return;
 const m=s.movement[i],style={formation:m.formation,stance:m.stance};
 Object.assign(m,idleMovement(r.entityId),style,{order:r.held?"hold":"idle"});
 s.navigation.jobs=s.navigation.jobs.filter(j=>j.entityId!==r.entityId);
}
function goal(s:SimulationState,a:number,b:number){
 const e=s.entities,i=e.id.indexOf(a),j=e.id.indexOf(b),dx=e.x[j]-e.x[i],dy=e.y[j]-e.y[i],distance=Math.max(1,Math.floor(Math.sqrt(dx*dx+dy*dy))),gap=e.radius[i]+e.radius[j]+16*8;
 return {x:Math.max(0,e.x[j]-Math.trunc(dx*Math.min(gap,distance)/distance)),y:Math.max(0,e.y[j]-Math.trunc(dy*Math.min(gap,distance)/distance))};
}
/** Directional frontline guard uses current visible threats and nearby allied weapons only. */
export function medicFrontlineAllows(s:SimulationState,map:BattleMap,id:number,p:{x:number;y:number}):boolean {
 const e=s.entities,i=e.id.indexOf(id),owner=e.owner[i],mask=visibilityMask(s,map,owner);
 const allies=e.id.map((_,j)=>j).filter(j=>e.owner[j]===owner&&e.health[j]>0&&e.layer[j]==="ground"&&hasBasicWeapon(e.definitionId[j])&&!isEmbarked(s,e.id[j])&&!isInStasis(s,e.id[j])&&(e.x[j]-e.x[i])**2+(e.y[j]-e.y[i])**2<=(6*256)**2);
 for(let j=0;j<e.id.length;j++)if(e.owner[j]!==owner&&e.health[j]>0&&hasBasicWeapon(e.definitionId[j])&&(e.x[j]-e.x[i])**2+(e.y[j]-e.y[i])**2<=(12*256)**2&&canSeeEntity(s,map,owner,j,mask)){
  const dx=e.x[j]-e.x[i],dy=e.y[j]-e.y[i],projection=(p.x-e.x[i])*dx+(p.y-e.y[i])*dy;
  if(projection>0&&(!allies.length||projection>Math.max(...allies.map(k=>(e.x[k]-e.x[i])*dx+(e.y[k]-e.y[i])*dy))))return false;
 }
 return true;
}
function available(s:SimulationState,r:MedicRecord,target:number):boolean {
 return medicPatient(s,r.entityId,target)&&missingMedicHealth(s,target)>0&&!s.medics!.records.some(o=>o!==r&&o.targetId===target);
}
function inAcquire(s:SimulationState,a:number,b:number):boolean {
 const e=s.entities,i=e.id.indexOf(a),j=e.id.indexOf(b);
 return (e.x[j]-e.x[i])**2+(e.y[j]-e.y[i])**2<=(H.acquirePixels*8)**2;
}
export function healMedicFrame(s:SimulationState,r:MedicRecord):number {
 const id=r.entityId,target=r.targetId,energy=energyOf(s,id);
 if(target===null||!energy||energy.amount<H.minimumEnergy*ENERGY.scale||spellLocked(s,id)||isEmbarked(s,id)||loading(s,id)||!medicPatient(s,id,target)||isInStasis(s,target)||!medicInRange(s,id,target))return 0;
 const amount=Math.min(H.amountPerFrame,missingMedicHealth(s,target)),cost=Math.floor(amount/H.energyDivisor);
 if(amount<=0||energy.amount<cost)return 0;
 const i=s.entities.id.indexOf(target),record=s.combat!.records.find(c=>c.entityId===target)!,actual=s.entities.health[i]*256-record.healthFraction+amount;
 energy.amount-=cost;s.entities.health[i]=Math.ceil(actual/256);record.healthFraction=s.entities.health[i]*256-actual;r.healedTargetId=target;r.healedTick=s.tick;
 if(missingMedicHealth(s,target)===0){r.targetId=null;r.manual=false;}
 return amount;
}
export function createMedicRules(map:BattleMap,base:EngineRules):EngineRules {
 const commands={...base.commands},fallbackCast=commands.castAbility,fallbackToggle=commands.toggleAutocast,move=base.commands?.move;
 for(const kind of Object.keys(commands) as (keyof typeof commands)[]){
  const h=commands[kind]!;
  commands[kind]={...h,apply:(s,c,ids)=>{
   h.apply(s,c,ids);
   if(["move","attackMove","focusAttack","stop","hold","patrol","loadTransport"].includes(c.kind))for(const id of ids){const r=medicOf(s,id);if(r){clearMedicJob(r);r.held=c.kind==="hold";r.manualUntilTick=s.tick+20;}}
   if(c.kind==="assignGroup"){
    const g=s.players[c.playerId].controlGroups[c.payload.slot];
    if(ids.every(id=>!!medicOf(s,id))){
     const enabled=g.autocastConfiguredAbilityIds?.includes(HEALING)?g.autocastAbilityIds.includes(HEALING):true;
     for(const id of ids){const r=medicOf(s,id)!;r.autocast=enabled;if(!enabled&&!r.manual&&r.targetId!==null){clearMedicJob(r);stopMedic(s,r);}}
     g.autocastConfiguredAbilityIds=[...new Set([...(g.autocastConfiguredAbilityIds??[]),HEALING])];g.autocastAbilityIds=g.autocastAbilityIds.filter(a=>a!==HEALING);if(enabled)g.autocastAbilityIds.push(HEALING);
    }else{g.autocastConfiguredAbilityIds=g.autocastConfiguredAbilityIds?.filter(a=>a!==HEALING);g.autocastAbilityIds=g.autocastAbilityIds.filter(a=>a!==HEALING);}
   }
  }};
 }
 commands.castAbility={policy:"atomic",validate:(s,c,id)=>{
  if(c.kind!=="castAbility"||c.payload.abilityId!==HEALING)return fallbackCast?fallbackCast.validate(s,c,id):"invalid_command";
  if(c.entityIds.length!==1||c.target.kind!=="entity"||!s.economy.enabled||!s.combat||!medicOf(s,id))return "invalid_target";
  if(spellLocked(s,id)||isEmbarked(s,id)||loading(s,id))return "invalid_state";
  if(!medicPatient(s,id,c.target.entityId)||missingMedicHealth(s,c.target.entityId)===0||isInStasis(s,c.target.entityId))return "invalid_target";
  if(s.medics!.records.some(r=>r.entityId!==id&&r.manual&&r.targetId===(c.target as {entityId:number}).entityId))return "invalid_state";
  return (energyOf(s,id)?.amount??0)<H.minimumEnergy*256?"insufficient_resource":null;
 },apply:(s,c,ids)=>{
  if(c.kind!=="castAbility"||c.payload.abilityId!==HEALING||c.target.kind!=="entity"){fallbackCast?.apply(s,c,ids);return;}
  const r=medicOf(s,ids[0])!;
  for(const other of s.medics!.records)if(other!==r&&other.targetId===c.target.entityId){clearMedicJob(other);stopMedic(s,other);}
  stopMedic(s,r);r.targetId=c.target.entityId;r.manual=true;r.held=false;r.manualUntilTick=0;
 }};
 commands.toggleAutocast={policy:"atomic",validate:(s,c,id)=>{
  if(c.kind!=="toggleAutocast"||c.payload.abilityId!==HEALING)return fallbackToggle?fallbackToggle.validate(s,c,id):"invalid_command";
  return s.economy.enabled&&s.combat&&medicOf(s,id)?null:"invalid_target";
 },apply:(s,c,ids)=>{
  if(c.kind!=="toggleAutocast"||c.payload.abilityId!==HEALING){fallbackToggle?.apply(s,c,ids);return;}
  for(const id of ids){const r=medicOf(s,id)!;r.autocast=c.payload.enabled;if(!r.autocast&&!r.manual&&r.targetId!==null){clearMedicJob(r);stopMedic(s,r);}}
  for(const g of s.players[c.playerId].controlGroups)if(g.entityIds.length&&g.entityIds.every(id=>ids.includes(id))){g.autocastConfiguredAbilityIds=[...new Set([...(g.autocastConfiguredAbilityIds??[]),HEALING])];g.autocastAbilityIds=g.autocastAbilityIds.filter(a=>a!==HEALING);if(c.payload.enabled)g.autocastAbilityIds.push(HEALING);}
 }};
 return {...base,commands,systems:{...base.systems,targeting:s=>{
  base.systems?.targeting?.(s);
  const records=s.medics?.records??[],e=s.entities;
  for(const r of records){r.healedTargetId=null;r.healedTick=null;if(isEmbarked(s,r.entityId)||loading(s,r.entityId))clearMedicJob(r);if(r.targetId!==null&&(!medicPatient(s,r.entityId,r.targetId)||!missingMedicHealth(s,r.targetId)||(!r.manual&&!inAcquire(s,r.entityId,r.targetId)))){clearMedicJob(r);if(!isEmbarked(s,r.entityId)&&!loading(s,r.entityId)&&!spellLocked(s,r.entityId))stopMedic(s,r);}}
  if(s.tick%5===0&&records.length){
   const offset=(Math.floor(s.tick/5)*8)%records.length;
   for(let n=0;n<Math.min(8,records.length);n++){
    const r=records[(offset+n)%records.length],i=e.id.indexOf(r.entityId),m=s.movement[i];
    if(!r.autocast||r.targetId!==null||r.manualUntilTick>=s.tick||spellLocked(s,r.entityId)||isEmbarked(s,r.entityId)||loading(s,r.entityId)||(energyOf(s,r.entityId)?.amount??0)<256||!(["idle","hold"].includes(m.order)||m.order==="move"&&m.status==="arrived"))continue;
    const candidates=e.id.filter(id=>inAcquire(s,r.entityId,id)&&available(s,r,id)&&!isInStasis(s,id)&&(r.held?medicInRange(s,r.entityId,id):medicInRange(s,r.entityId,id)||medicFrontlineAllows(s,map,r.entityId,goal(s,r.entityId,id))));
    candidates.sort((a,b)=>{const j=e.id.indexOf(a),k=e.id.indexOf(b);return (e.x[j]-e.x[i])**2+(e.y[j]-e.y[i])**2-(e.x[k]-e.x[i])**2-(e.y[k]-e.y[i])**2||a-b;});
    r.targetId=candidates[0]??null;r.manual=false;
   }
  }
  for(const r of records){
   const i=e.id.indexOf(r.entityId),energy=energyOf(s,r.entityId);if(i<0||e.health[i]===0||!energy)continue;
   if(r.targetId!==null&&!spellLocked(s,r.entityId)&&!isEmbarked(s,r.entityId)&&!loading(s,r.entityId)&&!isInStasis(s,r.targetId)){
    if(medicInRange(s,r.entityId,r.targetId))stopMedic(s,r);
    else if(!r.manual&&!medicFrontlineAllows(s,map,r.entityId,goal(s,r.entityId,r.targetId))){clearMedicJob(r);stopMedic(s,r);}
    else if(!r.held&&move&&s.tick%5===0){
     const m=s.movement[i];
     if(["idle","arrived","blocked"].includes(m.status)||!m.target||!medicInRangeAt(s,r.entityId,r.targetId,m.target)){
      const p=approachPoint(s,map,r);if(p)requestApproach(s,r,p);else stopMedic(s,r);
     }
    }
   }
   const frames=Math.floor((energy.frameRemainder+6)/5);energy.frameRemainder=(energy.frameRemainder+6)%5;
   for(let frame=0;frame<frames;frame++){energy.amount=Math.min(maximumEnergy(s,e.owner[i],MEDIC)*256,energy.amount+ENERGY.regenerationPerFrame);healMedicFrame(s,r);}
  }
 },lifecycle:s=>{
  base.systems?.lifecycle?.(s);
  for(const r of s.medics?.records??[])if(r.targetId!==null&&!medicPatient(s,r.entityId,r.targetId)||r.healedTargetId!==null&&!medicPatient(s,r.entityId,r.healedTargetId))clearMedicJob(r);
 }}};
}
