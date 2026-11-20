import type {SimulationState} from "../core/state";
import {array,integer,object,unique,type Infer} from "../core/validation";
import {checksum} from "../core/checksum";
import original from "../data/infestation-original.json";
export const INFESTATION="infestation",INFESTED_CENTER="zerg-infested-command-center",INFESTED_TERRAN="zerg-infested-terran",SUICIDE="suicide",INFESTATION_RANGE=32;
export const INFESTATION_RULES_VERSION="infestation-1-"+checksum({original:JSON.stringify(original),cast:"builtin-zero-energy-visible-completed-enemy-CC-hp-ceil-percent-below50-body-range32px-instant-no-approach-no-queen-hide-no-cooldown",conversion:"same-id-full1500hp-owner-queen-no-depot-or-supply-unplaceable-queues-cancel-full-original-payer-refund-addon-detach-groups-workers-orders-clean",blast:"suicide-ground-3px-auto-self-manual-500explosive-body-radii20-40-60-allies-half-quarter-burrow-inner-only-cargo-stasis-air-excluded-simultaneous",controls:"partial-multi-manual-irreversible-same-tick-detonation-request-lock",practice:"separate-zerg-vs-terran-infested-key-no-legacy-grants"});
const effect=object({id:integer(1),owner:integer(0,1),tick:integer(),x:integer(),y:integer()});
export const infestationStateSchema=object({detonations:unique(array(integer(1),0,2048)),effects:array(effect,0,128)});
type P=Infer<typeof infestationStateSchema>;export type InfestationState={detonations:number[];effects:{-readonly[K in keyof P['effects'][number]]:P['effects'][number][K]}[]};
export const emptyInfestation=():InfestationState=>({detonations:[],effects:[]});
/** Detonation requests are consumed by combat in their execution tick, before saving/validation. */
export const validInfestation=(s:SimulationState)=>!s.infestation||s.infestation.detonations.length===0&&(!s.economy.enabled||!s.combat?s.infestation.effects.length===0:new Set(s.infestation.effects.map(e=>e.id)).size===s.infestation.effects.length&&s.infestation.effects.every(e=>e.id<s.counters.nextEventId&&e.tick<=s.tick&&s.tick-e.tick<=20&&s.players.some(p=>p.id===e.owner)));
export const infestationFitsMap=(s:SimulationState,map:{widthTiles:number;heightTiles:number})=>(s.infestation?.effects??[]).every(e=>e.x<map.widthTiles*256&&e.y<map.heightTiles*256);
