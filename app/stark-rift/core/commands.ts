export const COMMAND_KINDS = [
  "move",
  "attackMove",
  "focusAttack",
  "stop",
  "hold",
  "patrol",
  "setFormation",
  "setStance",
  "setRallyPoint",
  "produce",
  "toggleRepeatProduction",
  "cancelProduction",
  "placeBuilding",
  "cancelConstruction",
  "research",
  "cancelResearch",
  "castAbility",
  "toggleAutocast",
  "toggleStateAbility",
  "loadTransport",
  "unloadTransport",
  "unloadPassenger",
  "surrender",
] as const;

export type CommandKind = (typeof COMMAND_KINDS)[number];
export type CommandSource = "player" | "ai" | "tutorial";

export type PointTarget = {
  kind: "point";
  x: number;
  y: number;
};

export type EntityTarget = {
  kind: "entity";
  entityId: number;
};

export type GameCommand = {
  sequence: number;
  issuedTick: number;
  executeTick: number;
  playerId: number;
  source: CommandSource;
  kind: CommandKind;
  entityIds: number[];
  target?: PointTarget | EntityTarget;
  payload?: Record<string, unknown>;
};

export const COMMAND_FAILURE_CODES = [
  "not_owner",
  "invalid_target",
  "out_of_range",
  "blocked",
  "insufficient_resource",
  "missing_prerequisite",
  "invalid_state",
  "duplicate_sequence",
  "invalid_command",
] as const;

export type CommandFailureCode = (typeof COMMAND_FAILURE_CODES)[number];

export type CommandAcknowledgement =
  | {
      accepted: true;
      playerId: number;
      sequence: number;
      executeTick: number;
      executedEntityIds: number[];
    }
  | {
      accepted: false;
      playerId: number;
      sequence: number;
      code: CommandFailureCode;
      details?: Record<string, string | number>;
    };
