import type { SimulationState } from "../core/state";
import { economyDefinition } from "../data/economy-catalog";
import { createEconomicEntity, newStructure } from "../economy/helpers";
import { MEDIC } from "./medic-data";
/** Labelled practice grants; existing saves and ordinary economy receive no bonus. */
export function initializeMedicPractice(s:SimulationState){
 if(s.players[0].faction!=="terran")return;
 for(const [definition,x,y] of [["terran-barracks",2,19],["terran-academy",2,22],["terran-supply-depot",13,26]] as const){
  const d=economyDefinition(definition)!,id=createEconomicEntity(s,0,d,{x:(x+d.width/2)*256,y:(y+d.height/2)*256});
  s.economy.structures.push(newStructure(id,d,x,y,true,s.tick));
 }
 for(const x of [18,22]){const id=createEconomicEntity(s,0,economyDefinition(MEDIC)!,{x:x*256,y:27*256});s.combat!.friendlyIds.push(id);s.players[0].controlGroups[4].entityIds.push(id);}
 for(const [n,id] of s.players[0].controlGroups[0].entityIds.entries())s.entities.health[s.entities.id.indexOf(id)]=15+n*5;
}
