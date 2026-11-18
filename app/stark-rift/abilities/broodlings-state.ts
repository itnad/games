import type { SimulationState } from "../core/state";
import { array,integer,object,type Infer } from "../core/validation";
import { checksum } from "../core/checksum";
import original from "../data/broodlings-original.json";
export const BROODLING="zerg-broodling",BROODLINGS="spawn-broodlings",BROODLING_TICKS=1500,BROODLINGS_COOLDOWN=18;
export const BROODLINGS_RULES_VERSION="broodlings-1-"+checksum({original:JSON.stringify(original),cast:"visible-ground-organic-or-mechanical-nonrobot-nonbuilding-own-enemy-body-range9-instant-no-approach",cooldown:"18ticks-shared-parasite-ensnare",spawn:"remove-target-cleanup-first-two-offset2px-half-tile-manhattan-rings4-distance-y-x-legal-circle-map-entitycap-no-refund-if-blocked",lifetime:"1500absolute-ticks-cargo-stasis-source-death-independent",combat:"toxic-spores-melee-upgrade-normal4-15frames-no-supply",effects:"20ticks-visible-target-no-references"});
const timed=object({entityId:integer(1),appliedTick:integer(),expiresTick:integer()});
export const broodlingsStateSchema=object({records:array(timed,0,2048),cooldowns:array(timed,0,2048),effects:array(object({id:integer(1),owner:integer(0,1),tick:integer(),x:integer(),y:integer()}),0,128)});
type Parsed=Infer<typeof broodlingsStateSchema>;type Row<T>={-readonly[K in keyof T]:T[K]};
export type BroodlingsState={records:Row<Parsed['records'][number]>[];cooldowns:Row<Parsed['cooldowns'][number]>[];effects:Row<Parsed['effects'][number]>[]};
export const emptyBroodlings=():BroodlingsState=>({records:[],cooldowns:[],effects:[]});
export const broodlingOf=(s:SimulationState,id:number)=>s.broodlings?.records.find(r=>r.entityId===id);
export const broodlingsCooldown=(s:SimulationState,id:number)=>s.broodlings?.cooldowns.find(r=>r.entityId===id&&r.expiresTick>s.tick);
export function validBroodlings(s:SimulationState):boolean{
 const b=s.broodlings,e=s.entities,ids=e.id.filter((_,i)=>e.definitionId[i]===BROODLING);if(!b)return !ids.length;
 if(!s.economy.enabled||!s.combat)return !b.records.length&&!b.cooldowns.length&&!b.effects.length&&!ids.length;
 const ordered=(rows:{entityId:number}[])=>rows.every((r,n)=>n===0||rows[n-1].entityId<r.entityId),live=(id:number,def:string)=>{const i=e.id.indexOf(id);return i>=0&&e.health[i]>0&&e.definitionId[i]===def;};
 return ordered(b.records)&&ordered(b.cooldowns)&&ids.length===b.records.length&&b.records.every(r=>live(r.entityId,BROODLING)&&r.appliedTick<=s.tick&&r.expiresTick===r.appliedTick+BROODLING_TICKS&&r.expiresTick>s.tick)&&b.cooldowns.every(r=>live(r.entityId,"zerg-queen")&&r.appliedTick<=s.tick&&r.expiresTick===r.appliedTick+BROODLINGS_COOLDOWN&&r.expiresTick>s.tick&&s.economy.upgrades.some(u=>u.playerId===e.owner[e.id.indexOf(r.entityId)]&&u.technologyId===BROODLINGS)&&!s.queen?.cooldowns.some(v=>v.entityId===r.entityId)&&!s.parasites?.cooldowns.some(v=>v.entityId===r.entityId))&&new Set(b.effects.map(r=>r.id)).size===b.effects.length&&b.effects.every(r=>r.id<s.counters.nextEventId&&s.players.some(p=>p.id===r.owner)&&r.tick<=s.tick&&s.tick-r.tick<=20);
}
export const broodlingsFitMap=(s:SimulationState,map:{widthTiles:number;heightTiles:number})=>(s.broodlings?.effects??[]).every(r=>r.x<map.widthTiles*256&&r.y<map.heightTiles*256);
