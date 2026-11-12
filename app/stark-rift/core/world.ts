import { detachSpecialEntity } from "../abilities/special-cleanup";
import { detachEconomyEntity } from "../economy/cleanup";
import { recomputeSupply } from "../economy/helpers";
import { idleMovement } from "./orders";
import type { SimulationState } from "./state";
import {
  array,
  integer,
  object,
  enumeration,
  refine,
  text,
  type Infer,
} from "./validation";

export const MAX_ENTITIES = 2048;
export const entityStoreSchema = refine(
  object({
    id: array(integer(1), 0, MAX_ENTITIES),
    owner: array(integer(), 0, MAX_ENTITIES),
    definitionId: array(text, 0, MAX_ENTITIES),
    kind: array(enumeration(["combat", "worker", "building"]), 0, MAX_ENTITIES),
    layer: array(enumeration(["ground", "air"]), 0, MAX_ENTITIES),
    speed: array(integer(0, 4096), 0, MAX_ENTITIES),
    radius: array(integer(1, 512), 0, MAX_ENTITIES),
    x: array(integer(-Number.MAX_SAFE_INTEGER), 0, MAX_ENTITIES),
    y: array(integer(-Number.MAX_SAFE_INTEGER), 0, MAX_ENTITIES),
    health: array(integer(), 0, MAX_ENTITIES),
    shield: array(integer(), 0, MAX_ENTITIES),
  }),
  (store) =>
    Object.values(store).every((column) => column.length === store.id.length) &&
    store.id.every((id, index) => index === 0 || id > store.id[index - 1]),
  "Entity columns must align and IDs must increase.",
);
export type EntityStore = Infer<typeof entityStoreSchema>;
export const emptyEntityStore = (): EntityStore => ({
  id: [],
  owner: [],
  definitionId: [],
  kind: [],
  layer: [],
  speed: [],
  radius: [],
  x: [],
  y: [],
  health: [],
  shield: [],
});
export function allocateId(
  state: SimulationState,
  counter: keyof SimulationState["counters"],
): number {
  const id = state.counters[counter];
  if (!Number.isSafeInteger(id) || id < 1 || id >= Number.MAX_SAFE_INTEGER)
    throw new RangeError("ID space exhausted.");
  state.counters[counter] += 1;
  return id;
}
export function createEntity(
  state: SimulationState,
  input: {
    owner: number;
    definitionId: string;
    x: number;
    y: number;
    health: number;
    shield?: number;
    kind?: "combat" | "worker" | "building";
    layer?: "ground" | "air";
    speed?: number;
    radius?: number;
  },
): number {
  if (
    state.entities.id.length >= MAX_ENTITIES ||
    !state.players.some((p) => p.id === input.owner) ||
    !input.definitionId.trim() ||
    input.definitionId.length > 256 ||
    !Number.isSafeInteger(input.x) ||
    !Number.isSafeInteger(input.y) ||
    !Number.isSafeInteger(input.health) ||
    input.health <= 0 ||
    !Number.isSafeInteger(input.shield ?? 0) ||
    (input.shield ?? 0) < 0
  )
    throw new RangeError("Invalid entity creation.");
  const speed = input.speed ?? 0,
    radius = input.radius ?? 48;
  if (
    !Number.isSafeInteger(speed) ||
    speed < 0 ||
    speed > 4096 ||
    !Number.isSafeInteger(radius) ||
    radius < 1 ||
    radius > 512
  )
    throw new RangeError("Invalid movement profile.");
  const id = allocateId(state, "nextEntityId");
  state.entities.id.push(id);
  state.entities.kind.push(input.kind ?? "combat");
  state.entities.layer.push(input.layer ?? "ground");
  state.entities.speed.push(speed);
  state.entities.radius.push(radius);
  state.entities.owner.push(input.owner);
  state.entities.definitionId.push(input.definitionId);
  state.entities.x.push(input.x);
  state.entities.y.push(input.y);
  state.entities.health.push(input.health);
  state.entities.shield.push(input.shield ?? 0);
  state.movement.push(idleMovement(id));
  return id;
}
export function removeEntity(state: SimulationState, id: number): boolean {
  if (!state.entities.id.includes(id)) return false;
  for (const passenger of detachSpecialEntity(state, id)) removeEntity(state, passenger);
  const index = state.entities.id.indexOf(id);
  detachEconomyEntity(state, id);
  if (state.vision)
    state.vision.concealed = state.vision.concealed.filter(
      (c) => c.entityId !== id,
    );
  if (state.combat)
    state.combat.records = state.combat.records.filter(
      (r) => r.entityId !== id,
    );
  for (const column of Object.values(state.entities)) column.splice(index, 1);
  state.movement.splice(index, 1);
  state.navigation.jobs = state.navigation.jobs.filter(
    (job) => job.entityId !== id,
  );
  for (const player of state.players)
    for (const group of player.controlGroups)
      group.entityIds = group.entityIds.filter((member) => member !== id);
  for (const motion of state.movement)
    if (motion.targetEntityId === id) {
      Object.assign(motion, idleMovement(motion.entityId), {
        formation: motion.formation,
        stance: motion.stance,
      });
    }
  recomputeSupply(state);
  return true;
}
