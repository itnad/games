import type { SimulationState } from "../core/state";
import { createEconomicEntity, newStructure } from "../economy/helpers";
import { economyDefinition } from "../data/economy-catalog";

/** Explicit practice grants only: no completed capacity research or altered caster energy. */
export function initializeEnergyPractice(s: SimulationState) {
  const race = s.players[0].faction;
  if (race === "zerg") return;
  const add = (definition: string, x: number, y: number, parent: number | null = null) => {
    const d = economyDefinition(definition)!;
    const id = createEconomicEntity(s,0,d,{x:(x+d.width/2)*256,y:(y+d.height/2)*256});
    const structure = newStructure(id,d,x,y,true,s.tick);structure.addonParentId=parent;s.economy.structures.push(structure);return id;
  };
  const addon = (definition: string, parent: number) => {
    const b=s.economy.structures.find(b=>b.entityId===parent)!,d=economyDefinition(definition)!;
    return add(definition,b.tileX+b.width,b.tileY+b.height-d.height,parent);
  };
  if (race === "terran") {
    const science=add("terran-science-facility",6,26);addon("terran-covert-ops",science);
    const starport=add("terran-starport",6,30);addon("terran-control-tower",starport);
  } else add("protoss-arbiter-tribunal",9,22);
  s.players[0].minerals+=600;s.players[0].gas+=650;
}
