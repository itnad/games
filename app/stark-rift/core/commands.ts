import { array, boolean, enumeration, integer, literal, object, optional, parse, refine, taggedUnion, text, unique, union, type Infer, type Schema } from "./validation";

export const MAX_COMMANDS_PER_BATCH = 256;
export const MAX_COMMAND_ENTITIES = 200;
export const pointTargetSchema = object({ kind: literal("point"), x: integer(-Number.MAX_SAFE_INTEGER), y: integer(-Number.MAX_SAFE_INTEGER) });
export const entityTargetSchema = object({ kind: literal("entity"), entityId: integer(1) });
export type PointTarget = Infer<typeof pointTargetSchema>;
export type EntityTarget = Infer<typeof entityTargetSchema>;
export type CommandSource = "player" | "ai" | "tutorial";

const header = {
  sequence: integer(1), issuedTick: integer(), executeTick: integer(), playerId: integer(),
  source: enumeration(["player", "ai", "tutorial"]),
};
const actors = unique(array(integer(1), 1, MAX_COMMAND_ENTITIES));
function command<const K extends string, const S extends Record<string, Schema<unknown>>>(kind: K, shape: S) {
  return refine(object({ ...header, kind: literal(kind), ...shape }),
    value => {
      // The shared header has already passed its runtime schema here.
      const ticks = value as unknown as { executeTick: number; issuedTick: number };
      return ticks.executeTick > ticks.issuedTick;
    }, "Commands must execute after their issue tick.");
}
export const commandSchemas = {
  assignGroup: command("assignGroup", {entityIds: unique(array(integer(1),1,10)),payload:object({slot:integer(0,4),confirmed:boolean})}),
  move: command("move", { entityIds: actors, target: pointTargetSchema }),
  attackMove: command("attackMove", { entityIds: actors, target: pointTargetSchema }),
  focusAttack: command("focusAttack", { entityIds: actors, target: entityTargetSchema }),
  stop: command("stop", { entityIds: actors }),
  hold: command("hold", { entityIds: actors }),
  patrol: command("patrol", { entityIds: actors, target: pointTargetSchema }),
  setFormation: command("setFormation", { entityIds: actors, payload: object({ formation: enumeration(["line", "column", "spread"]) }) }),
  setStance: command("setStance", { entityIds: actors, payload: object({ stance: enumeration(["free", "formation", "breakthrough"]) }) }),
  setRallyPoint: command("setRallyPoint", { entityIds: actors, target: pointTargetSchema }),
  gather: command("gather",{entityIds:actors,payload:object({resourceId:text})}),
  returnCargo: command("returnCargo",{entityIds:actors}),
  autoGather: command("autoGather",{entityIds:actors}),
  resumeConstruction: command("resumeConstruction",{entityIds:actors,target:entityTargetSchema}),
  produce: command("produce", { entityIds: actors, payload: object({ unitId: text }) }),
  toggleRepeatProduction: command("toggleRepeatProduction", { entityIds: actors, payload: object({ unitId: text, enabled: boolean }) }),
  cancelProduction: command("cancelProduction", { entityIds: actors, payload: object({ queueEntryId: integer(1) }) }),
  placeBuilding: command("placeBuilding", { entityIds: actors, target: pointTargetSchema, payload: object({ buildingId: text,queued:optional(boolean) }) }),
  morphStructure: command("morphStructure", { entityIds: actors, payload: object({ buildingId: text }) }),
  cancelStructureMorph: command("cancelStructureMorph", { entityIds: actors }),
  cancelConstruction: command("cancelConstruction", { entityIds: actors }),
  research: command("research", { entityIds: actors, payload: object({ technologyId: text }) }),
  cancelResearch: command("cancelResearch", { entityIds: actors }),
  castAbility: command("castAbility", { entityIds: actors, payload: object({ abilityId: text }), target: union(pointTargetSchema, entityTargetSchema, object({ kind: literal("self") })) }),
  toggleAutocast: command("toggleAutocast", { entityIds: actors, payload: object({ abilityId: text, enabled: boolean }) }),
  toggleStateAbility: command("toggleStateAbility", { entityIds: actors, payload: object({ abilityId: text, enabled: boolean }) }),
  loadTransport: command("loadTransport", { entityIds: actors, target: entityTargetSchema }),
  unloadTransport: command("unloadTransport", { entityIds: actors, target: pointTargetSchema }),
  unloadPassenger: command("unloadPassenger", { entityIds: unique(array(integer(1), 1, 1)), target: pointTargetSchema, payload: object({ passengerId: integer(1) }) }),
  surrender: command("surrender", { entityIds: array(integer(1), 0, 0) }),
};
export const COMMAND_KINDS = Object.keys(commandSchemas) as (keyof typeof commandSchemas)[];
export type CommandKind = keyof typeof commandSchemas;
export const gameCommandSchema = taggedUnion("kind", commandSchemas);
export type GameCommand = Infer<typeof gameCommandSchema>;
export const validateGameCommand = (input: unknown) => parse(gameCommandSchema, input);

export const COMMAND_FAILURE_CODES = [
  "not_owner", "invalid_target", "out_of_range", "blocked", "insufficient_resource",
  "missing_prerequisite", "invalid_state", "duplicate_sequence", "invalid_command",
] as const;
export type CommandFailureCode = (typeof COMMAND_FAILURE_CODES)[number];
export type CommandAcknowledgement =
  | { accepted: true; playerId: number; sequence: number; executeTick: number; executedEntityIds: number[] }
  | { accepted: false; playerId: number; sequence: number; code: CommandFailureCode; details?: Record<string, string | number> };
