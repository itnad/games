import special from "../data/special-original.json";
import original from "../data/combat-original.json";
import { economyId } from "../data/economy-catalog";
const profiles = new Map([...original.profiles, ...special.profiles].map((p) => [economyId(p.name), p]));
const weapons = new Map([...original.weapons, ...special.weapons].map((w) => [w.name, w]));
export const combatWeapon = (id: string) => weapons.get(id);
export const combatProfile = (id: string) => profiles.get(id);
export function weaponFor(id: string, layer: "ground" | "air") {
  const p = combatProfile(id);
  return p
    ? weapons.get(layer === "air" ? p.airWeapon : p.groundWeapon)
    : undefined;
}
export const hasBasicWeapon = (id: string) => !!weaponFor(id, "ground");
