import type { SimulationState } from "../core/state";
import { array, enumeration, integer, object, type Infer } from "../core/validation";
import { checksum } from "../core/checksum";
import original from "../data/medic-spells-original.json";
import { MEDIC } from "./medic-data";
export const OPTICAL="optical-flare", RESTORATION="restoration";
export const MEDIC_SPELLS=original.technologies;
export const MEDIC_SPELL_COOLDOWN=18;
export const MEDIC_SPELL_RULES_VERSION="medic-spells-1-"+checksum({original:JSON.stringify(original),cast:"visible-body-range-reject-no-approach-single-atomic-immediate-effect",cooldown:"18ticks-original22frames-no-random-jitter",orders:"stop-heal-grace20",targets:"nonbuilding-own-enemy-ground-air",blind:"permanent-source-mask-drone-morph-retain-until-building-completes",restore:"blind-only-preserve-stasis-stim-cloak",effects:"20ticks-visible-endpoints"});
export const medicSpellEffectSchema=object({id:integer(1),abilityId:enumeration([OPTICAL,RESTORATION]),owner:integer(0,1),tick:integer(),sourceId:integer(1),targetId:integer(1),x:integer(),y:integer(),toX:integer(),toY:integer()});
export const medicSpellsSchema=object({blind:array(object({entityId:integer(1),appliedTick:integer(),sourceMask:integer(1,3)}),0,2048),cooldowns:array(object({entityId:integer(1),appliedTick:integer(),expiresTick:integer()}),0,2048),effects:array(medicSpellEffectSchema,0,128)});
type Mutable<T>={-readonly[K in keyof T]:T[K] extends (infer U)[]?Mutable<U>[]:T[K] extends object?Mutable<T[K]>:T[K]};
export type MedicSpellsState=Mutable<Infer<typeof medicSpellsSchema>>;
export const emptyMedicSpells=():MedicSpellsState=>({blind:[],cooldowns:[],effects:[]});
export const isBlinded=(s:SimulationState,id:number)=>s.medicSpells?.blind.some(r=>r.entityId===id)??false;
export const medicSpellCooldown=(s:SimulationState,id:number)=>s.medicSpells?.cooldowns.find(r=>r.entityId===id&&r.expiresTick>s.tick);
export function validMedicSpells(s:SimulationState):boolean {
 const m=s.medicSpells;if(!m)return true;if(!s.economy.enabled||!s.combat)return !m.blind.length&&!m.cooldowns.length&&!m.effects.length;
 const e=s.entities,ordered=(rows:{entityId:number}[])=>rows.every((r,n)=>n===0||rows[n-1].entityId<r.entityId),live=(id:number)=>{const i=e.id.indexOf(id);return i>=0&&e.health[i]>0&&e.kind[i]!=="building";};
 return ordered(m.blind)&&ordered(m.cooldowns)&&m.blind.every(r=>(live(r.entityId)||s.economy.structures.some(b=>b.entityId===r.entityId&&b.morphedWorker&&b.completedTick<0))&&r.appliedTick<=s.tick&&(r.sourceMask&~((1<<s.players.length)-1))===0)&&m.cooldowns.every(r=>{const i=e.id.indexOf(r.entityId);return live(r.entityId)&&e.definitionId[i]===MEDIC&&s.economy.upgrades.some(u=>u.playerId===e.owner[i]&&[OPTICAL,RESTORATION].includes(u.technologyId))&&r.appliedTick<=s.tick&&r.expiresTick===r.appliedTick+MEDIC_SPELL_COOLDOWN&&r.expiresTick>s.tick;})&&new Set(m.effects.map(r=>r.id)).size===m.effects.length&&m.effects.every(r=>r.id<s.counters.nextEventId&&s.players.some(p=>p.id===r.owner)&&r.tick<=s.tick&&s.tick-r.tick<=20&&r.sourceId<s.counters.nextEntityId&&r.targetId<s.counters.nextEntityId);
}
export const medicSpellsFitMap=(s:SimulationState,map:{widthTiles:number;heightTiles:number})=>(s.medicSpells?.effects??[]).every(r=>r.x<map.widthTiles*256&&r.toX<map.widthTiles*256&&r.y<map.heightTiles*256&&r.toY<map.heightTiles*256);
