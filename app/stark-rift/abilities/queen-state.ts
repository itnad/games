import type { SimulationState } from "../core/state";
import { array,integer,object,type Infer } from "../core/validation";
import { checksum } from "../core/checksum";
import { stimulatedSpeed,stimulatedCooldown,stimOf } from "./stim-state";
import original from "../data/queen-original.json";
export const QUEEN="zerg-queen",ENSNARE="ensnare",ENSNARE_TICKS=500,QUEEN_CAST_COOLDOWN=18;
export const QUEEN_RULES_VERSION="queen-1-"+checksum({original:JSON.stringify(original),cast:"single-point-body-range9-immediate-no-approach-cooldown18",area:"square64px-body-intersection-exclude-caster-building-cargo-burrow-stasis",duration:"500absolute-ticks-refresh-cargo-stasis-drone-building-clear",modifiers:"stim-plus1-ensnare-minus1-speed-half-cooldown-plus-floor-quarter-preserve-existing-cooldown",vision:"cloak-revealed-only-in-visible-tiles-do-not-remove-cloak",restoration:"remove-blind-and-ensnare-no-extra-cost",effects:"20ticks-visible-center-no-reference"});
const timed=object({entityId:integer(1),appliedTick:integer(),expiresTick:integer()});
export const queenStateSchema=object({ensnared:array(timed,0,2048),cooldowns:array(timed,0,2048),effects:array(object({id:integer(1),owner:integer(0,1),tick:integer(),x:integer(),y:integer()}),0,128)});
type Parsed=Infer<typeof queenStateSchema>;
export type QueenState={ensnared:{-readonly[K in keyof Parsed['ensnared'][number]]:Parsed['ensnared'][number][K]}[];cooldowns:{-readonly[K in keyof Parsed['cooldowns'][number]]:Parsed['cooldowns'][number][K]}[];effects:{-readonly[K in keyof Parsed['effects'][number]]:Parsed['effects'][number][K]}[]};
export const emptyQueen=():QueenState=>({ensnared:[],cooldowns:[],effects:[]});
export const ensnareOf=(s:SimulationState,id:number)=>s.queen?.ensnared.find(r=>r.entityId===id&&r.expiresTick>s.tick);
export const queenCooldown=(s:SimulationState,id:number)=>s.queen?.cooldowns.find(r=>r.entityId===id&&r.expiresTick>s.tick);
export function statusSpeed(s:SimulationState,i:number):number {if(!ensnareOf(s,s.entities.id[i]))return stimulatedSpeed(s,i);return stimOf(s,s.entities.id[i])?s.entities.speed[i]:Math.floor(s.entities.speed[i]/2);}
export function statusCooldown(s:SimulationState,id:number,frames:number):number {if(!ensnareOf(s,id))return stimulatedCooldown(s,id,frames);return stimOf(s,id)?frames:Math.max(5,Math.min(250,frames+Math.floor(frames/4)));}
export function validQueen(s:SimulationState):boolean {
 const q=s.queen;if(!q)return true;if(!s.economy.enabled||!s.combat)return !q.ensnared.length&&!q.cooldowns.length&&!q.effects.length;
 const e=s.entities,ordered=(rows:{entityId:number}[])=>rows.every((r,n)=>n===0||rows[n-1].entityId<r.entityId),live=(id:number)=>{const i=e.id.indexOf(id);return i>=0&&e.health[i]>0&&(e.kind[i]!=="building"||s.economy.structures.some(b=>b.entityId===id&&b.morphedWorker&&b.completedTick<0));};
 return ordered(q.ensnared)&&ordered(q.cooldowns)&&q.ensnared.every(r=>live(r.entityId)&&r.appliedTick<=s.tick&&r.expiresTick===r.appliedTick+ENSNARE_TICKS&&r.expiresTick>s.tick)&&q.cooldowns.every(r=>live(r.entityId)&&e.definitionId[e.id.indexOf(r.entityId)]===QUEEN&&r.appliedTick<=s.tick&&r.expiresTick===r.appliedTick+QUEEN_CAST_COOLDOWN&&r.expiresTick>s.tick&&s.economy.upgrades.some(u=>u.playerId===e.owner[e.id.indexOf(r.entityId)]&&u.technologyId===ENSNARE))&&new Set(q.effects.map(r=>r.id)).size===q.effects.length&&q.effects.every(r=>r.id<s.counters.nextEventId&&s.players.some(p=>p.id===r.owner)&&r.tick<=s.tick&&s.tick-r.tick<=20);
}
export const queenFitsMap=(s:SimulationState,map:{widthTiles:number;heightTiles:number})=>(s.queen?.effects??[]).every(r=>r.x<map.widthTiles*256&&r.y<map.heightTiles*256);
