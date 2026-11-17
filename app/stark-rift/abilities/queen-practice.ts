import type { SimulationState } from "../core/state";
import { createEconomicEntity,newStructure } from "../economy/helpers";
import { economyDefinition } from "../data/economy-catalog";
/** Explicit practice-only units/facility/resources; research and energy are earned normally. */
export function initializeQueenPractice(s:SimulationState){
 if(s.players[0].faction!=="zerg")return;
 const d=economyDefinition("zerg-queens-nest")!,x=9,y=23,id=createEconomicEntity(s,0,d,{x:(x+d.width/2)*256,y:(y+d.height/2)*256});s.economy.structures.push(newStructure(id,d,x,y,true,s.tick));
 for(const [n,x]of [18,22].entries()){const id=createEconomicEntity(s,0,economyDefinition("zerg-queen")!,{x:x*256,y:26*256});s.combat!.friendlyIds.push(id);s.players[0].controlGroups[n+3].entityIds.push(id);}
 s.players[0].minerals+=600;s.players[0].gas+=450;
}
