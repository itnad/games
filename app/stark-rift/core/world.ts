import { idleMovement } from "./orders";
import type { SimulationState } from "./state";
import { array, integer, object, refine, text, type Infer } from "./validation";

export const MAX_ENTITIES = 2048;
export const entityStoreSchema = refine(object({
  id: array(integer(1), 0, MAX_ENTITIES), owner: array(integer(), 0, MAX_ENTITIES),
  definitionId: array(text, 0, MAX_ENTITIES), x: array(integer(-Number.MAX_SAFE_INTEGER), 0, MAX_ENTITIES),
  y: array(integer(-Number.MAX_SAFE_INTEGER), 0, MAX_ENTITIES), health: array(integer(), 0, MAX_ENTITIES),
}), store => Object.values(store).every(column => column.length === store.id.length) &&
  store.id.every((id, index) => index === 0 || id > store.id[index - 1]), "Entity columns must align and IDs must increase.");
export type EntityStore = Infer<typeof entityStoreSchema>;
export const emptyEntityStore = (): EntityStore => ({ id: [], owner: [], definitionId: [], x: [], y: [], health: [] });
export function allocateId(state: SimulationState, counter: keyof SimulationState["counters"]): number {
  const id = state.counters[counter];
  if (!Number.isSafeInteger(id) || id < 1 || id >= Number.MAX_SAFE_INTEGER) throw new RangeError("ID space exhausted.");
  state.counters[counter] += 1;
  return id;
}
export function createEntity(state: SimulationState, input: { owner: number; definitionId: string; x: number; y: number; health: number }): number {
  if (state.entities.id.length >= MAX_ENTITIES || !state.players.some(p => p.id === input.owner) ||
      !input.definitionId.trim() || input.definitionId.length > 256 || !Number.isSafeInteger(input.x) ||
      !Number.isSafeInteger(input.y) || !Number.isSafeInteger(input.health) || input.health <= 0) throw new RangeError("Invalid entity creation.");
  const id = allocateId(state, "nextEntityId");
  state.entities.id.push(id);
  state.entities.owner.push(input.owner); state.entities.definitionId.push(input.definitionId);
  state.entities.x.push(input.x); state.entities.y.push(input.y); state.entities.health.push(input.health);
  state.movement.push(idleMovement(id));
  return id;
}
export function removeEntity(state: SimulationState, id: number): boolean {
  const index = state.entities.id.indexOf(id);
  if (index < 0) return false;
  for (const column of Object.values(state.entities)) column.splice(index, 1);
  state.movement.splice(index, 1);
  for (const player of state.players) for (const group of player.controlGroups) group.entityIds = group.entityIds.filter(member => member !== id);
  for (const motion of state.movement) if (motion.targetEntityId === id) {
    Object.assign(motion, idleMovement(motion.entityId));
  }
  return true;
}
