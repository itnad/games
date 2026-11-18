import { isInStasis } from "../abilities/spells-state";
import type { SimulationState } from "../core/state";
import { combatProfile } from "./catalog";
import { isEmbarked } from "../abilities/special-state";
import { isBurrowed } from "../abilities/burrow";
import original from "../data/infestation-original.json";
export const INFESTED_BLAST = {...original.weapons[0],...original.splash};
/** Distance to the closest hitbox point. Ground radial splash also damages allies. */
export function infestedSplashTargets(s: SimulationState, source: number, x: number, y: number) {
  const e = s.entities, result: { index: number; divisor: number }[] = [];
  for (let i = 0; i < e.id.length; i++) {
    if (i === source || e.health[i] === 0 || isInStasis(s,e.id[i]) || e.layer[i] !== "ground" || isEmbarked(s, e.id[i]) ||
      s.economy.structures.some((b) => b.entityId === e.id[i] && !b.started)) continue;
    const p = combatProfile(e.definitionId[i]); if (!p) continue;
    const dx = Math.max(0, e.x[i] - p.bounds[0] * 8 - x, x - (e.x[i] + p.bounds[2] * 8)),
      dy = Math.max(0, e.y[i] - p.bounds[1] * 8 - y, y - (e.y[i] + p.bounds[3] * 8)), distance = dx * dx + dy * dy;
    if (distance > (INFESTED_BLAST.wpnSplashRangeOuter * 8) ** 2) continue;
    const full = distance <= (INFESTED_BLAST.wpnSplashRangeInner * 8) ** 2;
    if (!full && isBurrowed(s, e.id[i])) continue;
    result.push({ index: i, divisor: full ? 1 : distance <= (INFESTED_BLAST.wpnSplashRangeMid * 8) ** 2 ? 2 : 4 });
  }
  return result;
}
