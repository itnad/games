import { isInStasis } from "../abilities/spells-state";
import type { SimulationState } from "../core/state";
import { allocateId } from "../core/world";
import { integrate } from "../core/fixed-point";
import { integerSqrt } from "../pathfinding/formation";
import { combatProfile } from "./catalog";
import { isEmbarked } from "../abilities/special-state";
import { emptyLurker, LURKER_WEAPON, LURKER_WAVE_RULES } from "../abilities/lurker-state";
type Point = { x: number; y: number };
/** Swept circular wave versus original rectangular hitboxes, including exact tangencies. */
export function spineIntersectsBox(a: Point, b: Point, left: number, top: number, right: number, bottom: number, radius = LURKER_WEAPON.wpnSplashRangeInner * 8): boolean {
  if (Math.max(a.x, b.x) + radius < left || Math.min(a.x, b.x) - radius > right || Math.max(a.y, b.y) + radius < top || Math.min(a.y, b.y) - radius > bottom) return false;
  const endpoint = (p: Point) => Math.max(0, left - p.x, p.x - right) ** 2 + Math.max(0, top - p.y, p.y - bottom) ** 2 <= radius ** 2;
  if (endpoint(a) || endpoint(b)) return true;
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  if (!length) return false;
  const corners = [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
  const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  for (let n = 0; n < 4; n++) {
    const p = corners[n], q = corners[(n + 1) % 4], u = cross(a, b, p), v = cross(a, b, q), w = cross(p, q, a), z = cross(p, q, b);
    if (Math.min(a.x, b.x) <= Math.max(p.x, q.x) && Math.max(a.x, b.x) >= Math.min(p.x, q.x) && Math.min(a.y, b.y) <= Math.max(p.y, q.y) && Math.max(a.y, b.y) >= Math.min(p.y, q.y) &&
      (u === 0 || v === 0 || (u < 0) !== (v < 0)) && (w === 0 || z === 0 || (w < 0) !== (z < 0))) return true;
    const px = p.x - a.x, py = p.y - a.y, dot = px * dx + py * dy;
    if (dot >= 0 && dot <= length) {
      const area = px * dy - py * dx;
      if (BigInt(area) * BigInt(area) <= BigInt(radius * radius) * BigInt(length)) return true;
    }
  }
  return false;
}
export function launchSpines(s: SimulationState, a: number, b: number, damage: number, map: { widthTiles: number; heightTiles: number }) {
  s.lurker ??= emptyLurker();
  const e = s.entities, dx = e.x[b] - e.x[a], dy = e.y[b] - e.y[a], distance = Math.max(1, integerSqrt(dx * dx + dy * dy)), range = LURKER_WEAPON.wpnMaxRange * 8 + e.radius[a];
  s.lurker.waves.push({ id: allocateId(s, "nextProjectileId"), sourceId: e.id[a], owner: e.owner[a], originX: e.x[a], originY: e.y[a], x: e.x[a], y: e.y[a],
    toX: Math.max(0, Math.min(map.widthTiles * 256 - 1, e.x[a] + Math.trunc(dx * range / distance))), toY: Math.max(0, Math.min(map.heightTiles * 256 - 1, e.y[a] + Math.trunc(dy * range / distance))),
    remainder: 0, damage, spawnTick: s.tick, expiresTick: s.tick + LURKER_WAVE_RULES.lifetime, hitIds: [] });
}
/** Fixed trajectories survive attacker death/surfacing and hit each enemy ground body once. */
export function advanceSpines(s: SimulationState) {
  const shots: { a: number; b: number; damage: number; hits: number; type: string; weaponId: string }[] = [], e = s.entities;
  if (!s.lurker) return shots;
  s.lurker.waves = s.lurker.waves.filter((wave) => {
    if (s.tick >= wave.expiresTick) return false;
    const before = { x: wave.x, y: wave.y }, dx = wave.toX - wave.x, dy = wave.toY - wave.y, distance = integerSqrt(dx * dx + dy * dy), travel = integrate(LURKER_WAVE_RULES.speed, wave.remainder);
    wave.remainder = travel.remainder;
    const arrived = distance <= travel.delta;
    if (arrived) { wave.x = wave.toX; wave.y = wave.toY; }
    else { wave.x += Math.trunc(dx * travel.delta / distance); wave.y += Math.trunc(dy * travel.delta / distance); }
    for (let i = 0; i < e.id.length; i++) {
      if (e.health[i] === 0 || isInStasis(s,e.id[i]) || e.owner[i] === wave.owner || e.layer[i] !== "ground" || isEmbarked(s, e.id[i]) || wave.hitIds.includes(e.id[i]) || s.economy.structures.some((b) => b.entityId === e.id[i] && !b.started)) continue;
      const p = combatProfile(e.definitionId[i]); if (!p) continue;
      if (spineIntersectsBox(before, wave, e.x[i] - p.bounds[0] * 8, e.y[i] - p.bounds[1] * 8, e.x[i] + p.bounds[2] * 8, e.y[i] + p.bounds[3] * 8)) {
        wave.hitIds.push(e.id[i]); shots.push({ a: -1, b: i, damage: wave.damage, hits: 1, type: LURKER_WEAPON.damageType, weaponId: LURKER_WEAPON.name });
      }
    }
    return !arrived;
  });
  return shots;
}
