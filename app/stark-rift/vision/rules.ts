import type { SimulationState } from "../core/state";
import type { EngineRules } from "../core/simulation";
import type { BattleMap } from "../data/maps";
import { economyDefinition } from "../data/economy-catalog";
import { MEMORY_TICKS, VISION_RULES_VERSION, type Contact } from "./state";
// Every mobile detector in the current roster is an Overlord. Content-stage detectors can extend this table.
export const DETECTOR_RADIUS_TILES: Record<string, number> = {
  "zerg-overlord": 11,
};
const caches = new WeakMap<BattleMap, Map<string, number[]>>();
export function terrainSight(
  map: BattleMap,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  air = false,
): boolean {
  if (air) return true;
  const level = map.height[sy * map.widthTiles + sx];
  let x = sx,
    y = sy,
    dx = Math.abs(tx - sx),
    dy = -Math.abs(ty - sy),
    stepX = sx < tx ? 1 : -1,
    stepY = sy < ty ? 1 : -1,
    error = dx + dy;
  while (x !== tx || y !== ty) {
    const twice = 2 * error;
    if (twice >= dy) {
      error += dy;
      x += stepX;
    }
    if (twice <= dx) {
      error += dx;
      y += stepY;
    }
    // The first higher edge remains visible, but higher terrain blocks the cells behind it.
    if ((x !== tx || y !== ty) && map.height[y * map.widthTiles + x] > level)
      return false;
  }
  return true;
}
function sightCells(
  map: BattleMap,
  cx: number,
  cy: number,
  r: number,
  air: boolean,
): number[] {
  let cache = caches.get(map);
  if (!cache) {
    cache = new Map();
    caches.set(map, cache);
  }
  const key = `${cx}:${cy}:${r}:${air}`;
  const found = cache.get(key);
  if (found) return found;
  const cells: number[] = [];
  for (
    let y = Math.max(0, cy - r);
    y <= Math.min(map.heightTiles - 1, cy + r);
    y++
  )
    for (
      let x = Math.max(0, cx - r);
      x <= Math.min(map.widthTiles - 1, cx + r);
      x++
    )
      if (
        (x - cx) ** 2 + (y - cy) ** 2 <= r * r &&
        terrainSight(map, cx, cy, x, y, air)
      )
        cells.push(y * map.widthTiles + x);
  if (cache.size >= 512) cache.delete(cache.keys().next().value!);
  cache.set(key, cells);
  return cells;
}
export function visibilityMask(
  s: SimulationState,
  map: BattleMap,
  owner: number,
): Uint8Array {
  const mask = new Uint8Array(map.widthTiles * map.heightTiles),
    e = s.entities;
  for (const cell of s.vision?.players[owner].explored ?? []) mask[cell] = 1;
  for (let i = 0; i < e.id.length; i++)
    if (e.owner[i] === owner && e.health[i] > 0) {
      const b = s.economy.structures.find((b) => b.entityId === e.id[i]);
      if (b && !b.started) continue;
      const cx = Math.floor(e.x[i] / 256),
        cy = Math.floor(e.y[i] / 256),
        r = economyDefinition(e.definitionId[i])?.sight ?? 7;
      if (cx < 0 || cy < 0 || cx >= map.widthTiles || cy >= map.heightTiles)
        continue;
      for (const cell of sightCells(map, cx, cy, r, e.layer[i] === "air"))
        mask[cell] = 2;
    }
  return mask;
}
export function revealedBody(
  map: { widthTiles: number; heightTiles: number },
  mask: Uint8Array,
  body: { x: number; y: number; kind: string; definitionId: string },
  every = false,
  minimum = 2,
): boolean {
  const d = economyDefinition(body.definitionId),
    width = body.kind === "building" ? (d?.width ?? 1) : 0,
    height = body.kind === "building" ? (d?.height ?? 1) : 0;
  const left = width
      ? Math.floor(body.x / 256 - width / 2)
      : Math.floor(body.x / 256),
    top = height
      ? Math.floor(body.y / 256 - height / 2)
      : Math.floor(body.y / 256);
  let visible = false;
  for (let y = top; y < top + Math.max(1, height); y++)
    for (let x = left; x < left + Math.max(1, width); x++) {
      const seen =
        x >= 0 &&
        y >= 0 &&
        x < map.widthTiles &&
        y < map.heightTiles &&
        mask[y * map.widthTiles + x] >= minimum;
      if (every && !seen) return false;
      if (seen) visible = true;
    }
  return visible;
}
export function canSeeEntity(
  s: SimulationState,
  map: BattleMap,
  owner: number,
  index: number,
  mask = visibilityMask(s, map, owner),
): boolean {
  const e = s.entities;
  if (index < 0 || index >= e.id.length || e.health[index] === 0) return false;
  if (e.owner[index] === owner) return true;
  if (
    s.economy.structures.some((b) => b.entityId === e.id[index] && !b.started)
  )
    return false;
  if (
    !revealedBody(map, mask, {
      x: e.x[index],
      y: e.y[index],
      kind: e.kind[index],
      definitionId: e.definitionId[index],
    })
  )
    return false;
  if (!s.vision?.concealed.some((c) => c.entityId === e.id[index])) return true;
  for (let i = 0; i < e.id.length; i++)
    if (e.owner[i] === owner && e.health[i] > 0) {
      const r = DETECTOR_RADIUS_TILES[e.definitionId[i]];
      if (
        r &&
        (e.x[index] - e.x[i]) ** 2 + (e.y[index] - e.y[i]) ** 2 <=
          (r * 256) ** 2
      )
        return true;
    }
  return false;
}
export function highGroundSight(
  s: SimulationState,
  map: BattleMap,
  owner: number,
  target: number,
): boolean {
  const e = s.entities,
    tx = Math.floor(e.x[target] / 256),
    ty = Math.floor(e.y[target] / 256),
    height = map.height[ty * map.widthTiles + tx];
  for (let i = 0; i < e.id.length; i++)
    if (e.owner[i] === owner && e.health[i] > 0) {
      const b = s.economy.structures.find((b) => b.entityId === e.id[i]);
      if (b && !b.started) continue;
      const x = Math.floor(e.x[i] / 256),
        y = Math.floor(e.y[i] / 256),
        r = economyDefinition(e.definitionId[i])?.sight ?? 7;
      if (
        (e.layer[i] === "air" ||
          map.height[y * map.widthTiles + x] >= height) &&
        (x - tx) ** 2 + (y - ty) ** 2 <= r * r &&
        terrainSight(map, x, y, tx, ty, e.layer[i] === "air")
      )
        return true;
    }
  return false;
}
export function uphillAttack(
  s: SimulationState,
  map: BattleMap,
  a: number,
  b: number,
): boolean {
  const e = s.entities;
  if (!s.vision || e.layer[a] !== "ground" || e.layer[b] !== "ground")
    return false;
  const cell = (i: number) =>
    Math.floor(e.y[i] / 256) * map.widthTiles + Math.floor(e.x[i] / 256);
  return (
    map.height[cell(a)] < map.height[cell(b)] &&
    !highGroundSight(s, map, e.owner[a], b)
  );
}
export function initializeVision(s: SimulationState, map: BattleMap) {
  s.vision = {
    rulesVersion: VISION_RULES_VERSION,
    width: map.widthTiles,
    height: map.heightTiles,
    concealed: [],
    players: [0, 1].map((playerId) => ({
      playerId,
      explored: [],
      contacts: [],
      resources: [],
    })),
  };
  updateVision(s, map);
}
export function updateVision(s: SimulationState, map: BattleMap) {
  if (!s.vision) return;
  const e = s.entities;
  for (const p of s.vision.players) {
    const mask = visibilityMask(s, map, p.playerId),
      contacts = new Map(p.contacts.map((c) => [c.entityId, c])),
      observed = new Set<number>();
    p.explored = [];
    for (let c = 0; c < mask.length; c++) if (mask[c]) p.explored.push(c);
    for (let i = 0; i < e.id.length; i++)
      if (
        e.owner[i] !== p.playerId &&
        canSeeEntity(s, map, p.playerId, i, mask)
      ) {
        const b = s.economy.structures.find((b) => b.entityId === e.id[i]);
        observed.add(e.id[i]);
        contacts.set(e.id[i], {
          entityId: e.id[i],
          owner: e.owner[i],
          definitionId: e.definitionId[i],
          kind: e.kind[i],
          layer: e.layer[i],
          x: e.x[i],
          y: e.y[i],
          radius: e.radius[i],
          seenTick: s.tick,
          progress:
            b && b.completedTick < 0
              ? Math.floor(
                  ((b.totalTicks - b.remainingTicks) * 1000) / b.totalTicks,
                )
              : null,
        });
      }
    for (const c of contacts.values())
      if (!observed.has(c.entityId)) {
        // Only observations at the old location can clear a memory; hidden live state never updates it.
        const ownIndex = e.id.indexOf(c.entityId);
        if (
          (ownIndex >= 0 && e.owner[ownIndex] === p.playerId) ||
          (c.kind !== "building" && s.tick - c.seenTick >= MEMORY_TICKS) ||
          revealedBody(map, mask, c, c.kind === "building")
        )
          contacts.delete(c.entityId);
      }
    p.contacts = [...contacts.values()]
      .sort((a, b) => b.seenTick - a.seenTick || a.entityId - b.entityId)
      .slice(0, 2048)
      .sort((a, b) => a.entityId - b.entityId);
    const known = new Map(p.resources.map((r) => [r.nodeId, r]));
    for (const n of map.resourceNodes)
      if (mask[n.y * map.widthTiles + n.x] === 2) {
        const actual = s.economy.resources.find((r) => r.nodeId === n.id);
        if (actual) known.set(n.id, { nodeId: n.id, amount: actual.amount });
      }
    p.resources = [...known.values()].sort((a, b) =>
      a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0,
    );
  }
}
export function rememberedContacts(
  s: SimulationState,
  map: BattleMap,
  viewer: number,
  mask: Uint8Array,
): Contact[] {
  return (s.vision?.players[viewer].contacts ?? [])
    .filter((c) => {
      const i = s.entities.id.indexOf(c.entityId);
      return (
        (i < 0 || !canSeeEntity(s, map, viewer, i, mask)) &&
        (c.kind === "building" || s.tick - c.seenTick < MEMORY_TICKS)
      );
    })
    .map((c) => ({ ...c }));
}
export function visionFitsMap(s: SimulationState, map: BattleMap): boolean {
  if (!s.vision) return true;
  return (
    s.vision.width === map.widthTiles &&
    s.vision.height === map.heightTiles &&
    s.vision.players.every(
      (p) =>
        p.explored.every((c) => c < map.widthTiles * map.heightTiles) &&
        p.contacts.every(
          (c) =>
            c.x < map.widthTiles * 256 &&
            c.y < map.heightTiles * 256 &&
            economyDefinition(c.definitionId)?.kind === c.kind,
        ) &&
        p.resources.every((r) =>
          map.resourceNodes.some((n) => n.id === r.nodeId),
        ),
    )
  );
}
export function headquartersOutcome(s: SimulationState) {
  if (!s.vision || !s.economy.enabled || s.phase !== "running") return;
  const counts = s.players.map(
    (p) =>
      s.economy.structures.filter(
        (b) =>
          b.started &&
          s.entities.owner[s.entities.id.indexOf(b.entityId)] === p.id &&
          s.entities.health[s.entities.id.indexOf(b.entityId)] > 0 &&
          economyDefinition(
            s.entities.definitionId[s.entities.id.indexOf(b.entityId)],
          )?.headquarters,
      ).length,
  );
  if (counts.every((c) => c > 0)) return;
  const winner =
    counts[0] === 0 && counts[1] === 0 ? null : counts[0] === 0 ? 1 : 0;
  s.outcome = {
    kind: winner === null ? "draw" : "victory",
    winnerPlayerId: winner,
    decidedTick: s.tick,
  };
  s.phase = "finished";
  s.commandState.pending = [];
}
export function createVisionRules(
  map: BattleMap,
  base: EngineRules,
): EngineRules {
  return {
    ...base,
    systems: {
      ...base.systems,
      vision: (s) => {
        base.systems?.vision?.(s);
        updateVision(s, map);
      },
      lifecycle: (s) => {
        base.systems?.lifecycle?.(s);
        updateVision(s, map);
      },
      victory: (s) => {
        base.systems?.victory?.(s);
        headquartersOutcome(s);
      },
    },
  };
}
