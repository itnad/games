import { array, enumeration, integer, nullable, object, refine, unique, text, type Infer } from "./validation";

export const pointSchema = object({ x: integer(), y: integer() });
export const controlGroupSchema = object({
  entityIds: unique(array(integer(1), 0, 10)),
  formation: enumeration(["line", "column", "spread"]),
  stance: enumeration(["free", "formation", "breakthrough"]),
  autocastAbilityIds: unique(array(text)),
});
export type ControlGroup = { -readonly [K in keyof Infer<typeof controlGroupSchema>]: Infer<typeof controlGroupSchema>[K] };
export const emptyControlGroups = (): ControlGroup[] => Array.from({ length: 5 }, () => ({ entityIds: [], formation: "line", stance: "free", autocastAbilityIds: [] }));
export const movementStateSchema = refine(object({
  entityId: integer(1), order: enumeration(["idle", "move", "attackMove", "focusAttack", "hold", "patrol"]),
  target: nullable(pointSchema), targetEntityId: nullable(integer(1)),
  path: array(pointSchema, 0, 8192), pathIndex: integer(),
  status: enumeration(["idle", "waiting", "moving", "arrived", "blocked"]),
  remainderX: integer(-19, 19), remainderY: integer(-19, 19), obstacleVersion: integer(),
}), value => value.pathIndex <= value.path.length &&
  (value.order !== "idle" || (value.target === null && value.targetEntityId === null && value.path.length === 0 && value.status === "idle")) &&
  (!["move", "attackMove", "patrol"].includes(value.order) || value.target !== null) &&
  (value.order !== "focusAttack" || value.targetEntityId !== null), "Invalid movement order or path cursor.");
export type MovementState = { -readonly [K in keyof Infer<typeof movementStateSchema>]: Infer<typeof movementStateSchema>[K] };
export const idleMovement = (entityId: number): MovementState => ({ entityId, order: "idle", target: null, targetEntityId: null, path: [], pathIndex: 0, status: "idle", remainderX: 0, remainderY: 0, obstacleVersion: 0 });
