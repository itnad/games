import type { SimulationState } from "../core/state";
import { createEconomicEntity, newStructure, recomputeSupply, workerOf, releaseWork } from "../economy/helpers";
import { economyDefinition } from "../data/economy-catalog";
/** A labelled practice setup supplies units and completed Zerg cargo research; normal economy still pays full costs. */
export function initializeSpecialPractice(s: SimulationState) {
  const race = s.players[0].faction;
  if (race === "zerg") for (const technologyId of ["ventral-sacs", "burrowing"])
    s.economy.upgrades.push({ playerId: 0, technologyId, level: 1 });
  if (race !== "zerg") {
    const supply = economyDefinition(race === "terran" ? "terran-supply-depot" : "protoss-pylon")!, tx = 10, ty = 19;
    const eid = createEconomicEntity(s, 0, supply, { x: (tx + supply.width / 2) * 256, y: (ty + supply.height / 2) * 256 });
    s.economy.structures.push(newStructure(eid, supply, tx, ty, true, s.tick));
  }
  const ship = race === "terran" ? "terran-dropship" : race === "zerg" ? "zerg-overlord" : "protoss-shuttle";
  const light = race === "terran" ? "terran-marine" : race === "zerg" ? "zerg-zergling" : "protoss-zealot";
  const heavy = race === "terran" ? "terran-siege-tank-tank-mode" : race === "zerg" ? "zerg-hydralisk" : "protoss-dark-templar";
  const army = [ship, ship, light, light, heavy, heavy];
  for (let n = 0; n < army.length; n++) {
    const id = createEconomicEntity(s, 0, economyDefinition(army[n])!, { x: (n < 2 ? 16 + n * 4 : 15 + (n - 2) * 2) * 256, y: (n < 2 ? 18 : 22) * 256 });
    s.combat!.friendlyIds.push(id);
    if (n >= 2) s.players[0].controlGroups[n < 4 ? 0 : 1].entityIds.push(id);
  }
  if (race === "terran") {
    for (const technologyId of ["personnel-cloaking", "cloaking-field"]) s.economy.upgrades.push({ playerId: 0, technologyId, level: 1 });
    for (const [n, definition] of ["terran-ghost", "terran-wraith"].entries()) {
      const id = createEconomicEntity(s, 0, economyDefinition(definition)!, { x: (16 + n * 4) * 256, y: 24 * 256 });
      s.combat!.friendlyIds.push(id); s.players[0].controlGroups[n + 2].entityIds.push(id);
    }
  }
  if (race === "protoss") s.combat!.friendlyIds.push(createEconomicEntity(s, 0, economyDefinition("protoss-observer")!, { x: 14 * 256, y: 18 * 256 }));
  const target = race === "protoss" ? "protoss-dark-templar" : "protoss-probe";
  const id = createEconomicEntity(s, 1, economyDefinition(target)!, { x: 29 * 256, y: 20 * 256 });
  s.combat!.targetIds.push(id); s.movement[s.entities.id.indexOf(id)].order = "hold";
  const worker = workerOf(s, id); if (worker) releaseWork(s, worker, false);
  recomputeSupply(s);
}
