import type { SimulationState } from "../core/state";
import type { BattleMap } from "../data/maps";
import { segmentNearCircle, segmentNearTile } from "../pathfinding/geometry";
export type Rect = { x: number; y: number; width: number; height: number };
export function structureRect(
  state: SimulationState,
  index: number,
): Rect | null {
  const b = state.economy.structures.find(
    (b) => b.entityId === state.entities.id[index],
  );
  return b && b.started
    ? {
        x: b.tileX * 256,
        y: b.tileY * 256,
        width: b.width * 256,
        height: b.height * 256,
      }
    : null;
}
export function isBlueprint(state: SimulationState, index: number): boolean {
  return state.economy.structures.some(
    (b) => b.entityId === state.entities.id[index] && !b.started,
  );
}
export function circleRect(x: number, y: number, r: number, b: Rect): boolean {
  const dx = x - Math.max(b.x, Math.min(b.x + b.width, x)),
    dy = y - Math.max(b.y, Math.min(b.y + b.height, y));
  return dx * dx + dy * dy < r * r;
}
export function bodyContains(
  state: SimulationState,
  index: number,
  x: number,
  y: number,
  r: number,
): boolean {
  if (isBlueprint(state, index)) return false;
  const b = structureRect(state, index),
    s = state.entities;
  return b
    ? circleRect(x, y, r, b)
    : (x - s.x[index]) ** 2 + (y - s.y[index]) ** 2 <
        (r + s.radius[index]) ** 2;
}
export function segmentHitsBody(
  state: SimulationState,
  index: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
  r: number,
): boolean {
  if (isBlueprint(state, index)) return false;
  const rect = structureRect(state, index),
    s = state.entities;
  if (!rect)
    return segmentNearCircle(
      a,
      b,
      { x: s.x[index], y: s.y[index] },
      r + s.radius[index],
    );
  for (let y = rect.y; y < rect.y + rect.height; y += 256)
    for (let x = rect.x; x < rect.x + rect.width; x += 256)
      if (segmentNearTile(a, b, x, y, r)) return true;
  return false;
}
export function tileWalkable(
  map: BattleMap,
  state: SimulationState,
  index: number,
): boolean {
  return (
    !!map.walkable[index] ||
    (state.economy.enabled &&
      map.resourceNodes.some(
        (n) =>
          n.kind === "mineral" &&
          n.y * map.widthTiles + n.x === index &&
          state.economy.resources.some(
            (r) => r.nodeId === n.id && r.amount === 0,
          ),
      ))
  );
}
