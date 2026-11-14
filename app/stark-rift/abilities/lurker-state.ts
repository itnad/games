import type { SimulationState } from "../core/state";
import { array, integer, object, unique, type Infer } from "../core/validation";
import { checksum } from "../core/checksum";
import original from "../data/lurker-original.json";
import { economyDefinition, economicTicks } from "../data/economy-catalog";
import { isEmbarked } from "./special-state";
export const LURKER = "zerg-lurker", LURKER_EGG = "zerg-lurker-egg", HYDRALISK = "zerg-hydralisk", LURKER_ASPECT = "lurker-aspect";
export const LURKER_WEAPON = original.weapons[0];
/** Authored travel speed; damage, width, range, cadence and morph costs use original data. */
export const LURKER_WAVE_RULES = { speed: 3072, lifetime: 40, maximum: 128 };
export const LURKER_RULES_VERSION = "lurker-1-" + checksum({ original: JSON.stringify(original), wave: LURKER_WAVE_RULES });
const point = { x: integer(), y: integer() };
export const lurkerStateSchema = object({
  morphs: array(object({ entityId: integer(1), remainingTicks: integer(1), totalTicks: integer(1), minerals: integer(), gas: integer(), supplyHalf: integer(4, 4), ...point }), 0, 2048),
  waves: array(object({ id: integer(1), sourceId: integer(1), owner: integer(0, 1), originX: integer(), originY: integer(), ...point, toX: integer(), toY: integer(), remainder: integer(0, 19), damage: integer(1, 1000000), spawnTick: integer(), expiresTick: integer(), hitIds: unique(array(integer(1), 0, 2048)) }), 0, LURKER_WAVE_RULES.maximum),
});
type Mutable<T> = { -readonly [K in keyof T]: T[K] extends (infer U)[] ? Mutable<U>[] : T[K] extends object ? Mutable<T[K]> : T[K] };
export type LurkerState = Mutable<Infer<typeof lurkerStateSchema>>;
export type LurkerWave = LurkerState["waves"][number];
export const emptyLurker = (): LurkerState => ({ morphs: [], waves: [] });
export const unitMorphOf = (s: SimulationState, id: number) => s.lurker?.morphs.find((m) => m.entityId === id);
export const hasLurkerAspect = (s: SimulationState, owner: number) => s.economy.upgrades.some((u) => u.playerId === owner && u.technologyId === LURKER_ASPECT);
export function validLurker(s: SimulationState): boolean {
  const e = s.entities, value = s.lurker;
  if (!value) return !e.definitionId.includes(LURKER_EGG);
  if (!s.economy.enabled || !s.combat) return value.morphs.length === 0 && value.waves.length === 0;
  const d = economyDefinition(LURKER)!, ids = new Set<number>();
  for (const j of value.morphs) {
    const i = e.id.indexOf(j.entityId), m = s.movement[i];
    if (ids.has(j.entityId) || i < 0 || e.health[i] === 0 || e.definitionId[i] !== LURKER_EGG || !hasLurkerAspect(s, e.owner[i]) || isEmbarked(s, j.entityId) ||
      e.speed[i] !== 0 || e.layer[i] !== "ground" || e.x[i] !== j.x || e.y[i] !== j.y ||
      !["idle", "hold"].includes(m.order) || m.path.length > 0 || s.navigation.jobs.some((p) => p.entityId === j.entityId) ||
      j.totalTicks !== economicTicks(original.units[0].defaultTimeCost) || j.remainingTicks > j.totalTicks || j.minerals !== d.minerals || j.gas !== d.gas ||
      s.vision?.concealed.some((c) => c.entityId === j.entityId)) return false;
    ids.add(j.entityId);
  }
  if (e.id.some((id, i) => e.definitionId[i] === LURKER_EGG && !ids.has(id))) return false;
  const waves = new Set<number>();
  return value.waves.every((w) => {
    if (waves.has(w.id) || w.id >= s.counters.nextProjectileId || w.sourceId >= s.counters.nextEntityId ||
      w.hitIds.some((id) => id >= s.counters.nextEntityId) || w.spawnTick > s.tick || w.expiresTick !== w.spawnTick + LURKER_WAVE_RULES.lifetime || w.expiresTick <= s.tick ||
      w.hitIds.includes(w.sourceId) || s.combat!.projectiles.some((p) => p.id === w.id)) return false;
    const source = e.id.indexOf(w.sourceId); if (source >= 0 && e.owner[source] !== w.owner) return false;
    waves.add(w.id); return true;
  });
}
export function lurkerFitsMap(s: SimulationState, map: { widthTiles: number; heightTiles: number }): boolean {
  const inside = (x: number, y: number) => x < map.widthTiles * 256 && y < map.heightTiles * 256;
  return (s.lurker?.waves ?? []).every((w) => inside(w.x, w.y) && inside(w.toX, w.toY) && inside(w.originX, w.originY)) &&
    (s.lurker?.morphs ?? []).every((j) => inside(j.x, j.y));
}
