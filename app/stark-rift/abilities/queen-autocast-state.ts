import type {SimulationState} from "../core/state";
import {array,enumeration,integer,object,unique,type Infer} from "../core/validation";
import {checksum} from "../core/checksum";
export const QUEEN_AUTO_ABILITIES=["infestation","ensnare","spawn-broodlings","parasite"]as const;
export type QueenAutoAbility=typeof QUEEN_AUTO_ABILITIES[number];
export const QUEEN_AUTO_GRACE=20,QUEEN_AUTO_INTERVAL=5,QUEEN_AUTO_BUDGET=4;
export const isQueenAutoAbility=(id:string):id is QueenAutoAbility=>(QUEEN_AUTO_ABILITIES as readonly string[]).includes(id);
export const QUEEN_AUTOCAST_RULES_VERSION="queen-autocast-1-"+checksum({abilities:QUEEN_AUTO_ABILITIES,grace:20,interval:5,budget:4,default:"off-group-slot-inheritance-owner-only-atomic-toggles",orders:"idle-hold-arrived-only-manual-grace-enable-grace",targets:"visible-enemies-body-in-range-only-no-approach",ensnare:"16nearest-anchors-nearest-pair-midpoints-fresh-combat-armed2-no-temporary-no-friendly-body",broodlings:"armed-ground-combat-cost100-in-range-high-value-first-reserve150-before-parasite",parasite:"exclude-existing-own-bit-and-broodlings-active-detector-armed-nonworker-worker-value-distance-id",priority:"infestation-ensnare-broodlings-parasite-one-cast-per-actor-refresh-vision-after-success",practice:"second-zerg-special-enemy-zealot32-26-new-games-only"});
const record=object({entityId:integer(1),abilityIds:unique(array(enumeration(QUEEN_AUTO_ABILITIES),1,4)),manualUntilTick:integer()});
export const queenAutocastStateSchema=object({records:array(record,0,2048)});
type P=Infer<typeof record>;export type QueenAutocastRecord={-readonly[K in keyof P]:K extends 'abilityIds'?QueenAutoAbility[]:P[K]};
export type QueenAutocastState={records:QueenAutocastRecord[]};
export const queenAutocastOf=(s:SimulationState,id:number)=>s.queenAutocast?.records.find(r=>r.entityId===id);
export function setQueenAutocast(s:SimulationState,id:number,abilities:readonly QueenAutoAbility[]){
 s.queenAutocast??={records:[]};s.queenAutocast.records=s.queenAutocast.records.filter(r=>r.entityId!==id);
 const abilityIds=QUEEN_AUTO_ABILITIES.filter(a=>abilities.includes(a));if(abilityIds.length)s.queenAutocast.records.push({entityId:id,abilityIds,manualUntilTick:s.tick+QUEEN_AUTO_GRACE});s.queenAutocast.records.sort((a,b)=>a.entityId-b.entityId);
}
export function validQueenAutocast(s:SimulationState){
 const rows=s.queenAutocast?.records??[],e=s.entities;
 return (!rows.length||s.economy.enabled&&!!s.combat)&&rows.every((r,n)=>{const i=e.id.indexOf(r.entityId);return i>=0&&e.health[i]>0&&e.definitionId[i]==="zerg-queen"&&(n===0||rows[n-1].entityId<r.entityId)&&r.manualUntilTick<=s.tick+QUEEN_AUTO_GRACE&&r.abilityIds.every((a,j)=>j===0||QUEEN_AUTO_ABILITIES.indexOf(r.abilityIds[j-1])<QUEEN_AUTO_ABILITIES.indexOf(a));})&&s.players.every(p=>p.controlGroups.every(g=>!g.autocastAbilityIds.some(isQueenAutoAbility)||g.entityIds.every(id=>e.definitionId[e.id.indexOf(id)]==="zerg-queen")));
}
