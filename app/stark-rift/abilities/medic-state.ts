import type { SimulationState } from "../core/state";
import { array, boolean, integer, nullable, object, type Infer } from "../core/validation";
import { isEmbarked } from "./special-state";
import { isBurrowed } from "./burrow";
import { MEDIC, isOrganic } from "./medic-data";
export const medicStateSchema = object({records:array(object({entityId:integer(1),autocast:boolean,targetId:nullable(integer(1)),manual:boolean,held:boolean,manualUntilTick:integer(),healedTargetId:nullable(integer(1)),healedTick:nullable(integer())}),0,2048)});
type Row=Infer<typeof medicStateSchema>["records"][number];
export type MedicRecord={-readonly [K in keyof Row]:Row[K]};
export type MedicState={records:MedicRecord[]};
export const medicOf=(s:SimulationState,id:number)=>s.medics?.records.find(r=>r.entityId===id);
export const newMedic=(entityId:number):MedicRecord=>({entityId,autocast:true,targetId:null,manual:false,held:false,manualUntilTick:0,healedTargetId:null,healedTick:null});
export function clearMedicJob(r:MedicRecord){r.targetId=null;r.manual=false;r.healedTargetId=null;r.healedTick=null;}
export function medicPatient(s:SimulationState,caster:number,target:number):boolean {
 const e=s.entities,a=e.id.indexOf(caster),b=e.id.indexOf(target);
 return a>=0&&b>=0&&caster!==target&&e.owner[a]===e.owner[b]&&e.health[b]>0&&e.kind[b]!=="building"&&e.layer[b]==="ground"&&isOrganic(e.definitionId[b])&&!isEmbarked(s,target)&&!isBurrowed(s,target);
}
export function validMedics(s:SimulationState):boolean {
 const records=s.medics?.records??[],e=s.entities;
 if(!s.economy.enabled)return records.length===0;
 if(records.length!==e.id.filter((id,i)=>e.definitionId[i]===MEDIC).length)return false;
 const unique=(ids:(number|null)[])=>new Set(ids.filter(id=>id!==null)).size===ids.filter(id=>id!==null).length;
 return unique(records.map(r=>r.entityId))&&unique(records.map(r=>r.targetId))&&unique(records.map(r=>r.healedTargetId))&&records.every((r,n)=>{
  const i=e.id.indexOf(r.entityId);
  return i>=0&&e.definitionId[i]===MEDIC&&(n===0||records[n-1].entityId<r.entityId)&&r.manualUntilTick<=s.tick+20&&(!r.manual||r.targetId!==null&&!r.held)&&(r.targetId===null||(r.autocast||r.manual)&&medicPatient(s,r.entityId,r.targetId))&&((r.healedTargetId===null&&r.healedTick===null)||(r.healedTargetId!==null&&r.healedTick===s.tick&&medicPatient(s,r.entityId,r.healedTargetId)));
 });
}
