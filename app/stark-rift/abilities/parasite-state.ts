import type { SimulationState } from "../core/state";
import { array,integer,object,type Infer } from "../core/validation";
import { checksum } from "../core/checksum";
import original from "../data/parasite-original.json";
export const PARASITE="parasite",PARASITE_COOLDOWN=18;
export const PARASITE_RULES_VERSION="parasite-1-"+checksum({original:JSON.stringify(original),cast:"visible-nonbuilding-ground-air-own-enemy-self-body-range12-immediate-no-approach",cooldown:"18ticks-shared-with-ensnare",vision:"victim-current-sight-highground-detection-no-owner-data-cargo-suspended",status:"permanent-owner-mask-repeat-pay-no-stack-source-death-retain-morph-building-clear",restoration:"clear-parasite-blind-ensnare-single50payment",effects:"20ticks-visible-bodies-strip-entity-refs"});
const record=object({entityId:integer(1),appliedTick:integer(),sourceMask:integer(1,3)});
export const parasiteStateSchema=object({records:array(record,0,2048),cooldowns:array(object({entityId:integer(1),appliedTick:integer(),expiresTick:integer()}),0,2048),effects:array(object({id:integer(1),owner:integer(0,1),tick:integer(),sourceId:integer(1),targetId:integer(1),x:integer(),y:integer(),toX:integer(),toY:integer()}),0,128)});
type P=Infer<typeof parasiteStateSchema>;type Row<T>={-readonly[K in keyof T]:T[K]};
export type ParasiteState={records:Row<P['records'][number]>[];cooldowns:Row<P['cooldowns'][number]>[];effects:Row<P['effects'][number]>[]};
export const emptyParasites=():ParasiteState=>({records:[],cooldowns:[],effects:[]});
export const parasiteOf=(s:SimulationState,id:number)=>s.parasites?.records.find(r=>r.entityId===id);
export const parasitedBy=(s:SimulationState,id:number,owner:number)=>((parasiteOf(s,id)?.sourceMask??0)&(1<<owner))!==0;
export const parasiteCooldown=(s:SimulationState,id:number)=>s.parasites?.cooldowns.find(r=>r.entityId===id&&r.expiresTick>s.tick);
export function validParasites(s:SimulationState):boolean{
 const p=s.parasites;if(!p)return true;if(!s.economy.enabled||!s.combat)return !p.records.length&&!p.cooldowns.length&&!p.effects.length;
 const e=s.entities,ordered=(rows:{entityId:number}[])=>rows.every((r,n)=>n===0||rows[n-1].entityId<r.entityId),live=(id:number)=>{const i=e.id.indexOf(id);return i>=0&&e.health[i]>0&&(e.kind[i]!=="building"||s.economy.structures.some(b=>b.entityId===id&&b.morphedWorker&&b.completedTick<0));};
 return ordered(p.records)&&ordered(p.cooldowns)&&p.records.every(r=>live(r.entityId)&&r.appliedTick<=s.tick&&(r.sourceMask&~((1<<s.players.length)-1))===0)&&p.cooldowns.every(r=>live(r.entityId)&&e.definitionId[e.id.indexOf(r.entityId)]==="zerg-queen"&&r.appliedTick<=s.tick&&r.expiresTick===r.appliedTick+PARASITE_COOLDOWN&&r.expiresTick>s.tick&&!s.queen?.cooldowns.some(c=>c.entityId===r.entityId))&&new Set(p.effects.map(r=>r.id)).size===p.effects.length&&p.effects.every(r=>r.id<s.counters.nextEventId&&s.players.some(v=>v.id===r.owner)&&r.tick<=s.tick&&s.tick-r.tick<=20&&r.sourceId<s.counters.nextEntityId&&r.targetId<s.counters.nextEntityId);
}
export const parasitesFitMap=(s:SimulationState,map:{widthTiles:number;heightTiles:number})=>(s.parasites?.effects??[]).every(r=>r.x<map.widthTiles*256&&r.toX<map.widthTiles*256&&r.y<map.heightTiles*256&&r.toY<map.heightTiles*256);
