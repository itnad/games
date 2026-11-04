import type { DeepMudPatch, Point } from "./mudflat-survivor-types";

const DEEP_MUD_TILE = 250;
const GAEBUL_STAGE = 5;

export function worldHash(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function deepMudPatchForCell(cellX: number, cellY: number): DeepMudPatch | null {
  const hash = worldHash(cellX + 91, cellY - 37);
  if (hash < .32) return null;
  const offsetX = (worldHash(cellX - 17, cellY + 23) - .5) * DEEP_MUD_TILE * .62;
  const offsetY = (worldHash(cellX + 29, cellY - 11) - .5) * DEEP_MUD_TILE * .58;
  return {
    x: cellX * DEEP_MUD_TILE + DEEP_MUD_TILE / 2 + offsetX,
    y: cellY * DEEP_MUD_TILE + DEEP_MUD_TILE / 2 + offsetY,
    radiusX: 72 + hash * 56,
    radiusY: 38 + worldHash(cellX + 7, cellY + 13) * 34,
    angle: (worldHash(cellY - 19, cellX + 5) - .5) * Math.PI * .82,
    hash,
  };
}

export function deepMudBoundaryScale(patch: DeepMudPatch, angle: number) {
  return Math.max(.7, Math.min(1.18,
    .92
    + Math.sin(angle * 3 + patch.hash * 18.4) * .13
    + Math.sin(angle * 5 - patch.hash * 27.7) * .08
    + Math.sin(angle * 8 + patch.hash * 43.1) * .045));
}

export function traceDeepMudBlobPath(context: CanvasRenderingContext2D, patch: DeepMudPatch, scale = 1) {
  const points = Array.from({ length: 30 }, (_, index) => {
    const angle = index / 30 * Math.PI * 2;
    const edge = deepMudBoundaryScale(patch, angle) * scale;
    return { x: Math.cos(angle) * patch.radiusX * edge, y: Math.sin(angle) * patch.radiusY * edge };
  });
  const first = points[0]!, last = points.at(-1)!;
  context.beginPath();
  context.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!, next = points[(index + 1) % points.length]!;
    context.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
  }
  context.closePath();
}

function mudflatSurfaceBoundaryScale(seed: number, angle: number) {
  return Math.max(.74, Math.min(1.2,
    .96
    + Math.sin(angle * 2 + seed * 16.1) * .11
    + Math.sin(angle * 4 - seed * 23.7) * .075
    + Math.sin(angle * 7 + seed * 41.3) * .04));
}

export function traceMudflatSurfacePatch(context: CanvasRenderingContext2D, radiusX: number, radiusY: number, seed: number, scale = 1) {
  const points = Array.from({ length: 22 }, (_, index) => {
    const angle = index / 22 * Math.PI * 2;
    const edge = mudflatSurfaceBoundaryScale(seed, angle) * scale;
    return { x: Math.cos(angle) * radiusX * edge, y: Math.sin(angle) * radiusY * edge };
  });
  const first = points[0]!, last = points.at(-1)!;
  context.beginPath();
  context.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!, next = points[(index + 1) % points.length]!;
    context.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
  }
  context.closePath();
}

export function deepMudPatchesInView(minX: number, maxX: number, minY: number, maxY: number) {
  const firstX = Math.floor(minX / DEEP_MUD_TILE) - 1;
  const lastX = Math.ceil(maxX / DEEP_MUD_TILE) + 1;
  const firstY = Math.floor(minY / DEEP_MUD_TILE) - 1;
  const lastY = Math.ceil(maxY / DEEP_MUD_TILE) + 1;
  const patches: DeepMudPatch[] = [];
  for (let cellY = firstY; cellY <= lastY; cellY += 1) {
    for (let cellX = firstX; cellX <= lastX; cellX += 1) {
      const patch = deepMudPatchForCell(cellX, cellY);
      if (patch && patch.x + patch.radiusX >= minX && patch.x - patch.radiusX <= maxX
        && patch.y + patch.radiusY >= minY && patch.y - patch.radiusY <= maxY) patches.push(patch);
    }
  }
  return patches;
}

export function deepMudStrengthAtPoint(point: Point, stage: number) {
  if (stage !== GAEBUL_STAGE) return { strength: 0, patch: null as DeepMudPatch | null };
  const cellX = Math.floor(point.x / DEEP_MUD_TILE);
  const cellY = Math.floor(point.y / DEEP_MUD_TILE);
  let bestStrength = 0;
  let bestPatch: DeepMudPatch | null = null;
  for (let y = cellY - 1; y <= cellY + 1; y += 1) {
    for (let x = cellX - 1; x <= cellX + 1; x += 1) {
      const patch = deepMudPatchForCell(x, y);
      if (!patch) continue;
      const cos = Math.cos(-patch.angle), sin = Math.sin(-patch.angle);
      const dx = point.x - patch.x, dy = point.y - patch.y;
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;
      const distance = Math.hypot(localX / patch.radiusX, localY / patch.radiusY);
      const boundary = deepMudBoundaryScale(patch, Math.atan2(localY / patch.radiusY, localX / patch.radiusX));
      if (distance < boundary) {
        const strength = Math.min(1, (boundary - distance) / .74 + .22);
        if (strength > bestStrength) { bestStrength = strength; bestPatch = patch; }
      }
    }
  }
  return { strength: bestStrength, patch: bestPatch };
}

export function randomDeepMudPointNear(player: Point, width: number, height: number, random: () => number) {
  const patches = deepMudPatchesInView(player.x - width * .7, player.x + width * .7, player.y - height * .7, player.y + height * .7);
  if (!patches.length) return null;
  const patch = patches[Math.floor(random() * patches.length)]!;
  const angle = random() * Math.PI * 2;
  const radius = Math.sqrt(random()) * deepMudBoundaryScale(patch, angle) * .72;
  const localX = Math.cos(angle) * patch.radiusX * radius;
  const localY = Math.sin(angle) * patch.radiusY * radius;
  const cos = Math.cos(patch.angle), sin = Math.sin(patch.angle);
  return { x: patch.x + localX * cos - localY * sin, y: patch.y + localX * sin + localY * cos };
}
