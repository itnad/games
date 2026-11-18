import queen from "../data/queen-original.json";
import type { SimulationState } from "../core/state";
import { checksum } from "../core/checksum";
import medic from "../data/medic-original.json";
import original from "../data/energy-original.json";

export const ENERGY_UPGRADES = [...original.upgrades,medic.upgrade,queen.upgrade].map(u => ({ ...u, id: u.name.toLowerCase().replaceAll("_", "-") }));
export const ENERGY_UPGRADE_RULES_VERSION = "energy-upgrades-1-" + checksum(JSON.stringify(original));
export const energyUpgrade = (definition: string) => ENERGY_UPGRADES.find(u => u.unitId === definition);
export function maximumEnergy(s: SimulationState, owner: number, definition: string): 200 | 250 {
  const upgrade = energyUpgrade(definition);
  return upgrade && s.economy.upgrades.some(u => u.playerId === owner && u.technologyId === upgrade.id)
    ? original.energy.upgradedMaximum as 250 : original.energy.baseMaximum as 200;
}
export const initialEnergy = (s: SimulationState, owner: number, definition: string) =>
  maximumEnergy(s, owner, definition) * 256 / original.energy.initialDivisor;
