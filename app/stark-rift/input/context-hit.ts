import { hitTest } from "./selection";
import type { BattleMap } from "../data/maps";
import type { RenderSnapshot } from "../worker/render-snapshot";
import type { HitTarget } from "./gesture-machine";
/** Direct body taps select an entity even when it overlaps the resource touch area. */
export function contextHit(
  snapshot: RenderSnapshot,
  map: BattleMap,
  point: { x: number; y: number },
  selected: readonly number[],
  tolerance: number,
  bodyTolerance: number,
): HitTarget | null {
  const direct = hitTest(snapshot, point, bodyTolerance);
  if (direct && direct.kind !== "building")
    return { entityId: direct.id, kind: direct.kind };
  const hasWorker = selected.some((id) =>
    snapshot.entities.some(
      (e) =>
        e.id === id &&
        e.owner === snapshot.viewerPlayerId &&
        e.kind === "worker",
    ),
  );
  if (hasWorker && snapshot.economy) {
    const node = map.resourceNodes.findIndex(
      (n) =>
        snapshot.visibility[n.y * map.widthTiles + n.x] === 2 &&
        Math.abs(point.x - n.x * 256 - 128) <= 200 &&
        Math.abs(point.y - n.y * 256 - 128) <= 200,
    );
    if (node >= 0) return { entityId: -node - 1, kind: "worker" };
  }
  if (direct) return { entityId: direct.id, kind: direct.kind };
  const nearby = hitTest(snapshot, point, tolerance);
  return nearby ? { entityId: nearby.id, kind: nearby.kind } : null;
}
