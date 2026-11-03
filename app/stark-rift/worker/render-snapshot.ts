import type { SimulationState } from "../core/state";
import type { BattleMap } from "../data/maps";
import { array, integer, object, parse, refine, reject, enumeration, text, type Schema } from "../core/validation";
export type RenderEntity = { id: number; owner: number; definitionId: string; x: number; y: number; health: number; kind:"combat"|"worker"|"building"; layer:"ground"|"air"; radius:number };
export type RenderSnapshot = { tick: number; previousTick: number; bufferId: number; viewerPlayerId: number; widthTiles: number; heightTiles: number; entities: RenderEntity[]; visibility: Uint8Array };
const visibilitySchema: Schema<Uint8Array> = { check: (input, path, issues) =>
  (input instanceof Uint8Array && input.length <= 128 * 128 && !input.some(v => v > 2)) || reject(issues, path, "Expected a visibility mask with values 0, 1 or 2.") };
export const renderSnapshotSchema: Schema<RenderSnapshot> = refine(object({
  tick: integer(), previousTick: integer(), bufferId: integer(), viewerPlayerId: integer(0, 1), widthTiles: integer(1, 128), heightTiles: integer(1, 128),
  entities: array(object({ id: integer(1), owner: integer(0, 1), definitionId: text, x: integer(), y: integer(), health: integer(),kind:enumeration(["combat","worker","building"]),layer:enumeration(["ground","air"]),radius:integer(1,512) }), 0, 2048),
  visibility: visibilitySchema,
}), snapshot => snapshot.previousTick <= snapshot.tick && snapshot.visibility.length === snapshot.widthTiles * snapshot.heightTiles &&
  new Set(snapshot.entities.map(e => e.id)).size === snapshot.entities.length && snapshot.entities.every(e => {
    const x = Math.floor(e.x / 256), y = Math.floor(e.y / 256);
    return x < snapshot.widthTiles && y < snapshot.heightTiles && (e.owner === snapshot.viewerPlayerId || snapshot.visibility[y * snapshot.widthTiles + x] === 2);
  }), "Invalid snapshot dimensions, IDs or visibility.");
export const validateRenderSnapshot = (input: unknown) => parse(renderSnapshotSchema, input);
/** The visibility system supplies a player-specific mask. Never give the renderer hidden state. */
export function createRenderSnapshot(state: SimulationState, map: BattleMap, viewer: number, visibility: Uint8Array): RenderSnapshot {
  if (!state.players.some(p => p.id === viewer) || visibility.length !== map.widthTiles * map.heightTiles || visibility.some(v => v > 2)) throw new RangeError("Invalid viewer visibility.");
  const entities: RenderEntity[] = [];
  const s = state.entities;
  for (let i = 0; i < s.id.length; i++) {
    if (s.health[i] === 0) continue;
    const tileX = Math.floor(s.x[i] / 256), tileY = Math.floor(s.y[i] / 256);
    if (tileX < 0 || tileX >= map.widthTiles || tileY < 0 || tileY >= map.heightTiles) continue;
    if (s.owner[i] !== viewer && visibility[tileY * map.widthTiles + tileX] !== 2) continue;
    entities.push({ id: s.id[i], owner: s.owner[i], definitionId: s.definitionId[i], x: s.x[i], y: s.y[i], health: s.health[i],kind:s.kind[i],layer:s.layer[i],radius:s.radius[i] });
  }
  return { bufferId: 0, tick: state.tick, previousTick: Math.max(0, state.tick - 1), viewerPlayerId: viewer, widthTiles: map.widthTiles, heightTiles: map.heightTiles, entities, visibility: visibility.slice() };
}
