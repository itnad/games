import { array, enumeration, integer, literal, object, refine, reject, text, type Schema } from "../core/validation";
import { checksum } from "../core/checksum";
export type MapPoint = { x: number; y: number };
export type ResourceNode = MapPoint & { id: string; kind: "mineral" | "gas"; amount: number; baseId: string };
export type MapRegion = MapPoint & { id: string; kind: "main" | "natural" | "outer" | "center" | "ramp"; radius: number };
export type BattleMap = {
  id: string; widthTiles: number; heightTiles: number; symmetry: "rotational-180";
  terrain: Uint8Array; height: Uint8Array; walkable: Uint8Array; buildable: Uint8Array;
  spawnPoints: MapPoint[]; resourceNodes: ResourceNode[]; regions: MapRegion[];
};
export function createRiftBasin(): BattleMap {
  const size = 96, count = size * size;
  const map: BattleMap = {
    id: "rift-basin", widthTiles: size, heightTiles: size, symmetry: "rotational-180",
    terrain: new Uint8Array(count), height: new Uint8Array(count),
    walkable: new Uint8Array(count).fill(1), buildable: new Uint8Array(count).fill(1),
    spawnPoints: [{ x: 14, y: 14 }, { x: 81, y: 81 }], resourceNodes: [], regions: [],
  };
  const paint = (x: number, y: number, terrain: number, height: number, walk: number, build: number) => {
    for (const i of [y * size + x, (size - 1 - y) * size + size - 1 - x]) {
      map.terrain[i] = terrain; map.height[i] = height; map.walkable[i] = walk; map.buildable[i] = build;
    }
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (x < 2 || y < 2 || x >= size - 2 || y >= size - 2) paint(x, y, 2, 0, 0, 0);
  }
  for (let y = 2; y <= 25; y++) for (let x = 2; x <= 25; x++) {
    const wall = (x === 25 || y === 25) && !(y === 25 && x >= 20 && x <= 23);
    const ramp = y >= 23 && x >= 20 && x <= 23;
    paint(x, y, wall ? 2 : ramp ? 3 : 1, ramp ? 0 : 1, wall ? 0 : 1, wall || ramp ? 0 : 1);
  }
  // Two-tile rift, a short central bridge and wide routes around both ends.
  for (let x = 22; x <= 73; x++) if (x < 44 || x > 51) paint(x, 47, 4, 0, 0, 0);
  const bases = [
    { kind: "main" as const, x: 14, y: 14, minerals: 8, gases: 1 },
    { kind: "natural" as const, x: 22, y: 33, minerals: 7, gases: 1 },
    { kind: "outer" as const, x: 12, y: 56, minerals: 6, gases: 1 },
    { kind: "center" as const, x: 38, y: 39, minerals: 8, gases: 2 },
  ];
  for (const base of bases) for (const side of [0, 1]) {
    const point = (x: number, y: number) => side ? { x: size - 1 - x, y: size - 1 - y } : { x, y };
    const baseId = `${base.kind}-${side}`;
    map.regions.push({ id: baseId, kind: base.kind, ...point(base.x, base.y), radius: 8 });
    for (let i = 0; i < base.minerals + base.gases; i++) {
      const mineral = i < base.minerals;
      const p = point(mineral ? base.x - 6 + i : base.x + 5, mineral ? base.y - 5 : base.y - 4 + (i - base.minerals) * 3);
      map.resourceNodes.push({ id: `${baseId}-${i}`, ...p, kind: mineral ? "mineral" : "gas", amount: mineral ? 1500 : 5000, baseId });
      map.walkable[p.y * size + p.x] = 0; map.buildable[p.y * size + p.x] = 0;
    }
  }
  map.regions.push({ id: "ramp-0", kind: "ramp", x: 21, y: 24, radius: 2 }, { id: "ramp-1", kind: "ramp", x: 74, y: 71, radius: 2 });
  validateBattleMap(map);
  return map;
}
/** Four-neighbour tile distances, also used by map build reports. */
export function mapDistances(map: BattleMap, start: MapPoint): Int32Array {
  const w = map.widthTiles, h = map.heightTiles, distances = new Int32Array(w * h).fill(-1);
  if (!Number.isInteger(start.x) || !Number.isInteger(start.y) || start.x < 0 || start.x >= w || start.y < 0 || start.y >= h) throw new RangeError("Invalid map start.");
  const first = start.y * w + start.x;
  if (!map.walkable[first]) throw new RangeError("Blocked map start.");
  const queue = new Int32Array(w * h); let head = 0, tail = 1; queue[0] = first; distances[first] = 0;
  while (head < tail) {
    const i = queue[head++], x = i % w, y = Math.floor(i / w);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const next = ny * w + nx;
      if (map.walkable[next] && distances[next] < 0) { distances[next] = distances[i] + 1; queue[tail++] = next; }
    }
  }
  return distances;
}
export function validateBattleMap(map: BattleMap): void {
  const w = map.widthTiles, h = map.heightTiles, n = w * h;
  if (w !== 96 || h !== 96 || map.spawnPoints.length !== 2) throw new RangeError("Rift Basin must be 96x96 with two spawns.");
  for (const column of [map.terrain, map.height, map.walkable, map.buildable]) {
    if (column.length !== n || column.some((value, i) => value !== column[n - 1 - i])) throw new RangeError("Map must have rotational symmetry.");
  }
  if (map.terrain.some(v => v > 4) || map.height.some(v => v > 1) || map.walkable.some(v => v > 1) ||
      map.buildable.some((v, i) => v > 1 || (v === 1 && map.walkable[i] === 0))) throw new RangeError("Invalid terrain flags.");
  const inside = (p: MapPoint) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < w && p.y >= 0 && p.y < h;
  if (!map.spawnPoints.every(inside) || map.spawnPoints[0].x + map.spawnPoints[1].x !== w - 1 ||
      map.spawnPoints[0].y + map.spawnPoints[1].y !== h - 1) throw new RangeError("Asymmetric spawn points.");
  const regionIds = new Set(map.regions.map(r => r.id));
  if (regionIds.size !== map.regions.length || map.regions.some(r => !inside(r) || !Number.isInteger(r.radius) || r.radius <= 0 ||
      !map.regions.some(other => other.kind === r.kind && other.x === w - 1 - r.x && other.y === h - 1 - r.y && other.radius === r.radius))) throw new RangeError("Invalid map regions.");
  const occupied = new Set<number>(); const ids = new Set<string>();
  for (const node of map.resourceNodes) {
    const i = node.y * w + node.x;
    if (!Number.isInteger(node.x) || !Number.isInteger(node.y) || node.x < 0 || node.x >= w || node.y < 0 || node.y >= h ||
        !Number.isSafeInteger(node.amount) || node.amount <= 0 || !regionIds.has(node.baseId) || occupied.has(i) || ids.has(node.id) || map.walkable[i] || map.buildable[i]) throw new RangeError("Invalid resource node.");
    if (!map.resourceNodes.some(other => other.x === w - 1 - node.x && other.y === h - 1 - node.y && other.amount === node.amount && other.kind === node.kind)) throw new RangeError("Asymmetric resources.");
    occupied.add(i); ids.add(node.id);
  }
  const distances = mapDistances(map, map.spawnPoints[0]);
  if (map.walkable.some((walk, i) => walk && distances[i] < 0)) throw new RangeError("Map contains an isolated walkable region.");
  if (map.regions.some(r => distances[r.y * w + r.x] < 0)) throw new RangeError("Unreachable base or ramp.");
}

const bytes: Schema<Uint8Array> = { check: (value, path, issues) => (value instanceof Uint8Array && value.length <= 128 * 128) || reject(issues, path, "Expected bounded map bytes.") };
const point = { x: integer(), y: integer() };
export const battleMapSchema: Schema<BattleMap> = refine(object({
  id: text, widthTiles: integer(1, 128), heightTiles: integer(1, 128), symmetry: literal("rotational-180"),
  terrain: bytes, height: bytes, walkable: bytes, buildable: bytes,
  spawnPoints: array(object(point), 2, 2),
  resourceNodes: array(object({ ...point, id: text, kind: enumeration(["mineral", "gas"]), amount: integer(1), baseId: text }), 0, 1024),
  regions: array(object({ ...point, id: text, kind: enumeration(["main", "natural", "outer", "center", "ramp"]), radius: integer(1) }), 0, 128),
}), map => { try { validateBattleMap(map); return true; } catch { return false; } }, "Invalid tactical map.");
export function getRuntimeMap(id: string): { map: BattleMap; dataVersion: string } {
  if (id !== "rift-basin") throw new RangeError("Unknown map ID.");
  const map = createRiftBasin();
  const canonical = { ...map, terrain: [...map.terrain], height: [...map.height], walkable: [...map.walkable], buildable: [...map.buildable] };
  return { map, dataVersion: `map-${checksum(canonical)}` };
}
