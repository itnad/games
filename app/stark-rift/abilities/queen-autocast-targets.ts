import type {SimulationState} from "../core/state";
import type {GameCommand} from "../core/commands";
import type {BattleMap} from "../data/maps";
import {economyDefinition} from "../data/economy-catalog";
import {weaponFor} from "../combat/catalog";
import {canSeeEntity} from "../vision/rules";
import {isEmbarked,unitTraits} from "./special-state";
import {isBurrowed} from "./burrow";
import {isInStasis} from "./spells-state";
import {isBlinded} from "./medic-spells-state";
import {medicSpellInRange} from "./medic-spells-rules";
import {spellArea} from "./spells-rules";
import {ensnareOf} from "./queen-state";
import {parasitedBy} from "./parasite-state";
import {broodlingsTarget} from "./broodlings-rules";
import {INFESTATION_RANGE} from "./infestation-state";
import type {QueenAutoAbility} from "./queen-autocast-state";
import queen from "../data/queen-original.json";
import broodlings from "../data/broodlings-original.json";
import parasite from "../data/parasite-original.json";
export type QueenAutoValidate=(c:GameCommand)=>string|null;
export const queenAutoCommand=(s:SimulationState,id:number,abilityId:QueenAutoAbility,target:Extract<GameCommand,{kind:"castAbility"}>["target"]):GameCommand=>({kind:"castAbility",playerId:s.entities.owner[s.entities.id.indexOf(id)],entityIds:[id],payload:{abilityId},target,source:"ai",sequence:1,issuedTick:Math.max(0,s.tick-1),executeTick:s.tick});
const armed=(definition:string)=>!!weaponFor(definition,"ground")||!!weaponFor(definition,"air");
const value=(definition:string)=>{const d=economyDefinition(definition);return d?(d.minerals+d.gas)/d.batch:0;};
const affected=(s:SimulationState,j:number)=>s.entities.health[j]>0&&s.entities.kind[j]!=="building"&&!isEmbarked(s,s.entities.id[j])&&!isBurrowed(s,s.entities.id[j])&&!isInStasis(s,s.entities.id[j]);
export function queenEntityAutocastTarget(s:SimulationState,map:BattleMap,id:number,ability:Exclude<QueenAutoAbility,'ensnare'>,mask:Uint8Array,validate:QueenAutoValidate){
 const e=s.entities,i=e.id.indexOf(id),owner=e.owner[i],range=ability==="infestation"?INFESTATION_RANGE:ability==="spawn-broodlings"?broodlings.technology.rangePixels:parasite.ability.rangePixels;
 const candidates=e.id.map((_,j)=>j).filter(j=>e.owner[j]!==owner&&e.health[j]>0&&canSeeEntity(s,map,owner,j,mask)&&!isEmbarked(s,e.id[j])&&!isInStasis(s,e.id[j])&&medicSpellInRange(s,id,e.id[j],range)&&(ability==="infestation"?e.definitionId[j]==="terran-command-center":ability==="spawn-broodlings"?e.kind[j]==="combat"&&e.layer[j]==="ground"&&armed(e.definitionId[j])&&value(e.definitionId[j])>=100&&broodlingsTarget(e.definitionId[j]):e.kind[j]!=="building"&&e.definitionId[j]!=="zerg-broodling"&&!parasitedBy(s,e.id[j],owner)));
 const distance=(j:number)=>(e.x[j]-e.x[i])**2+(e.y[j]-e.y[i])**2;
 const rank=(j:number)=>unitTraits(e.definitionId[j])?.detector&&!isBlinded(s,e.id[j])?0:armed(e.definitionId[j])?1:e.kind[j]!=="worker"?2:3;
 candidates.sort((a,b)=>(ability==="infestation"?e.health[a]-e.health[b]:ability==="parasite"?rank(a)-rank(b)||value(e.definitionId[b])-value(e.definitionId[a]):value(e.definitionId[b])-value(e.definitionId[a]))||distance(a)-distance(b)||e.id[a]-e.id[b]);
 for(const j of candidates){const command=queenAutoCommand(s,id,ability,{kind:"entity",entityId:e.id[j]}),error=validate(command);if(error===null||ability==="spawn-broodlings"&&error==="insufficient_resource")return {command,reserving:error!==null};}
 return null;
}
/** Only visible enemy bodies score; every friendly body that the spell would affect vetoes the point. */
export function queenEnsnareAutocastTarget(s:SimulationState,map:BattleMap,id:number,mask:Uint8Array,validate:QueenAutoValidate){
 const e=s.entities,i=e.id.indexOf(id),owner=e.owner[i],enemies:number[]=[],friends:number[]=[];
 for(let j=0;j<e.id.length;j++){if(j===i||!affected(s,j))continue;if(e.owner[j]===owner)friends.push(j);else if(e.kind[j]==="combat"&&e.definitionId[j]!=="zerg-broodling"&&armed(e.definitionId[j])&&!ensnareOf(s,e.id[j])&&canSeeEntity(s,map,owner,j,mask))enemies.push(j);}
 if(enemies.length<2)return null;
 const distance=(j:number)=>(e.x[j]-e.x[i])**2+(e.y[j]-e.y[i])**2,anchors=enemies.filter(j=>distance(j)<=(12*256)**2).sort((a,b)=>distance(a)-distance(b)||e.id[a]-e.id[b]).slice(0,16),points=anchors.map(j=>({x:e.x[j],y:e.y[j]}));
 for(const a of anchors){const b=anchors.filter(j=>j!==a).sort((u,v)=>(e.x[u]-e.x[a])**2+(e.y[u]-e.y[a])**2-(e.x[v]-e.x[a])**2-(e.y[v]-e.y[a])**2||e.id[u]-e.id[v])[0];if(b!==undefined)points.push({x:Math.floor((e.x[a]+e.x[b])/2),y:Math.floor((e.y[a]+e.y[b])/2)});}
 const scored:{command:GameCommand;count:number;distance:number;x:number;y:number}[]=[],seen=new Set<string>(),half=queen.ensnare.halfWidthPixels*8;
 for(const p of points){const key=p.x+','+p.y;if(seen.has(key))continue;seen.add(key);if(mask[Math.floor(p.y/256)*map.widthTiles+Math.floor(p.x/256)]!==2||friends.some(j=>spellArea(s,j,p.x,p.y,half)))continue;const count=enemies.filter(j=>spellArea(s,j,p.x,p.y,half)).length;if(count<2)continue;const command=queenAutoCommand(s,id,"ensnare",{kind:"point",...p});if(validate(command)!==null)continue;scored.push({command,count,distance:(p.x-e.x[i])**2+(p.y-e.y[i])**2,...p});}
 return scored.sort((a,b)=>b.count-a.count||a.distance-b.distance||a.y-b.y||a.x-b.x)[0]?.command??null;
}
