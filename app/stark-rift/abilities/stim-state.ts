import type { SimulationState } from "../core/state";
import { array, integer, object, type Infer } from "../core/validation";
import { checksum } from "../core/checksum";
import original from "../data/stim-original.json";
export const STIM = "stim-packs", MARINE = "terran-marine";
export const STIM_HEALTH_COST = original.healthCost;
export const STIM_TICKS = Math.floor((original.statusCycles*original.framesPerCycle*5+3)/6);
export const STIM_RULES_VERSION = "stim-1-"+checksum({original:JSON.stringify(original),duration:"absolute247-cargo-stasis-elapse",reuse:"pay-again-refresh-no-stack",orders:"preserve",eligibility:"marine-actual-hp-above10-partial"});
export const stimStateSchema=object({records:array(object({entityId:integer(1),appliedTick:integer(),expiresTick:integer()}),0,2048)});
type Row=Infer<typeof stimStateSchema>["records"][number];
export type StimState={records:{-readonly[K in keyof Row]:Row[K]}[]};
export const stimOf=(s:SimulationState,id:number)=>s.stim?.records.find(r=>r.entityId===id&&r.expiresTick>s.tick);
export const stimulatedSpeed=(s:SimulationState,i:number)=>stimOf(s,s.entities.id[i])?Math.floor(s.entities.speed[i]*original.speedNumerator/original.speedDenominator):s.entities.speed[i];
export const stimulatedCooldown=(s:SimulationState,id:number,frames:number)=>stimOf(s,id)?Math.max(original.minimumCooldownFrames,Math.floor(frames/original.cooldownDivisor)):frames;
export const actualHealth=(s:SimulationState,id:number)=>{const i=s.entities.id.indexOf(id);return i<0?0:s.entities.health[i]*256-(s.combat?.records.find(r=>r.entityId===id)?.healthFraction??0);};
export function validStim(s:SimulationState):boolean {
 const rows=s.stim?.records??[];return (!rows.length||s.economy.enabled&&!!s.combat)&&rows.every((r,n)=>{const i=s.entities.id.indexOf(r.entityId);return i>=0&&s.entities.definitionId[i]===MARINE&&s.entities.layer[i]==="ground"&&s.entities.health[i]>0&&(n===0||rows[n-1].entityId<r.entityId)&&r.appliedTick<=s.tick&&r.expiresTick===r.appliedTick+STIM_TICKS&&r.expiresTick>s.tick&&s.economy.upgrades.some(u=>u.playerId===s.entities.owner[i]&&u.technologyId===STIM);});
}
