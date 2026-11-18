import type {SimulationState} from "../core/state";
import {economyDefinition} from "../data/economy-catalog";
import {createEconomicEntity,newStructure,recomputeSupply,releaseWork,workerOf} from "../economy/helpers";
/** Separate new-game exercise; existing saves never receive these units or resources. */
export function initializeInfestationPractice(s:SimulationState){
 if(s.players[0].faction!=="zerg"||s.players[1].faction!=="terran")throw new RangeError("Infestation practice requires Zerg versus Terran");
 const queen=createEconomicEntity(s,0,economyDefinition("zerg-queen")!,{x:22*256,y:24*256});s.combat!.friendlyIds.push(queen);s.players[0].controlGroups[0].entityIds=[queen];
 const d=economyDefinition("terran-command-center")!,x=24,y=23,id=createEconomicEntity(s,1,d,{x:(x+d.width/2)*256,y:(y+d.height/2)*256});s.economy.structures.push(newStructure(id,d,x,y,true,s.tick));s.entities.health[s.entities.id.indexOf(id)]=600;s.combat!.targetIds.push(id);
 for(const [x,y]of [[32,23],[32,24],[33,24]]){const target=createEconomicEntity(s,1,economyDefinition("terran-scv")!,{x:x*256,y:y*256});releaseWork(s,workerOf(s,target)!,false);s.combat!.targetIds.push(target);s.movement[s.entities.id.indexOf(target)].order="hold";}
 s.players[0].minerals+=500;s.players[0].gas+=200;recomputeSupply(s);
}
