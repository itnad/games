import { COMMAND_KINDS, type GameCommand } from "../core/commands";
import { STARK_RIFT_PROTOCOL_VERSION } from "../core/versions";
import type { ValidationIssue, ValidationResult } from "../data/validation";

export const MAIN_TO_WORKER_KINDS = [
  "init",
  "commandBatch",
  "releaseRenderBuffer",
  "pause",
  "resume",
  "saveSnapshot",
  "loadSnapshot",
  "replaySeek",
  "debugMetrics",
  "dispose",
] as const;

export const WORKER_TO_MAIN_KINDS = [
  "ready",
  "commandAck",
  "phaseChanged",
  "snapshotLoaded",
  "renderSnapshot",
  "uiState",
  "notification",
  "saveSnapshotReady",
  "fatalError",
  "metrics",
  "disposed",
] as const;

export type MainToWorkerKind = (typeof MAIN_TO_WORKER_KINDS)[number];
export type WorkerToMainKind = (typeof WORKER_TO_MAIN_KINDS)[number];

export type WorkerEnvelope<K extends string, P> = {
  protocolVersion: number;
  messageId: number;
  kind: K;
  payload: P;
};

export type MainToWorkerMessage =
  | WorkerEnvelope<"init", { dataVersion: string; mapId: string; seed: number; playerIds: number[] }>
  | WorkerEnvelope<"commandBatch", { commands: GameCommand[]; lastSeenTick: number }>
  | WorkerEnvelope<"releaseRenderBuffer", { bufferId: number }>
  | WorkerEnvelope<"pause" | "resume", { reason: string }>
  | WorkerEnvelope<"saveSnapshot", { requestId: number }>
  | WorkerEnvelope<"loadSnapshot", { snapshot: unknown }>
  | WorkerEnvelope<"replaySeek", { tick: number }>
  | WorkerEnvelope<"debugMetrics", { windowTicks: number }>
  | WorkerEnvelope<"dispose", Record<string, never>>;

export type WorkerToMainMessage = WorkerEnvelope<WorkerToMainKind, Record<string, unknown>>;

export function validateMainToWorkerMessage(input: unknown): ValidationResult<MainToWorkerMessage> {
  if (!isRecord(input)) {
    return invalid("$", "Message must be an object.");
  }
  if (input.protocolVersion !== STARK_RIFT_PROTOCOL_VERSION) {
    return invalid("protocolVersion", `Expected protocol version ${STARK_RIFT_PROTOCOL_VERSION}.`);
  }
  if (!isNonNegativeInteger(input.messageId)) {
    return invalid("messageId", "messageId must be a non-negative integer.");
  }
  if (typeof input.kind !== "string" || !isMainToWorkerKind(input.kind)) {
    return invalid("kind", "Unknown main-to-worker message kind.");
  }
  if (!isRecord(input.payload)) {
    return invalid("payload", "payload must be an object.");
  }

  const payloadIssue = validatePayload(input.kind, input.payload);
  if (payloadIssue) {
    return { ok: false, issues: [payloadIssue] };
  }

  return { ok: true, value: input as MainToWorkerMessage };
}

export function createWorkerEnvelope<K extends WorkerToMainKind>(
  messageId: number,
  kind: K,
  payload: Record<string, unknown>,
): WorkerEnvelope<K, Record<string, unknown>> {
  if (!isNonNegativeInteger(messageId)) {
    throw new TypeError("messageId must be a non-negative integer.");
  }
  return { protocolVersion: STARK_RIFT_PROTOCOL_VERSION, messageId, kind, payload };
}

function invalid(path: string, message: string): ValidationResult<never> {
  const issue: ValidationIssue = { path, code: "invalid_value", message };
  return { ok: false, issues: [issue] };
}

function isMainToWorkerKind(kind: string): kind is MainToWorkerKind {
  return (MAIN_TO_WORKER_KINDS as readonly string[]).includes(kind);
}

function validatePayload(kind: MainToWorkerKind, payload: Record<string, unknown>): ValidationIssue | null {
  switch (kind) {
    case "init":
      if (!isNonEmptyString(payload.dataVersion)) return payloadIssue("dataVersion", "must be a non-empty string");
      if (!isNonEmptyString(payload.mapId)) return payloadIssue("mapId", "must be a non-empty string");
      if (!isUint32(payload.seed)) return payloadIssue("seed", "must be a Uint32 integer");
      if (!isIntegerArray(payload.playerIds)) return payloadIssue("playerIds", "must be an integer array");
      return null;
    case "commandBatch":
      if (!Array.isArray(payload.commands)) return payloadIssue("commands", "must be an array");
      for (let index = 0; index < payload.commands.length; index += 1) {
        if (!isGameCommand(payload.commands[index])) {
          return payloadIssue(`commands[${index}]`, "must be a valid GameCommand");
        }
      }
      if (!isNonNegativeInteger(payload.lastSeenTick)) return payloadIssue("lastSeenTick", "must be a non-negative integer");
      return null;
    case "releaseRenderBuffer":
      return isNonNegativeInteger(payload.bufferId) ? null : payloadIssue("bufferId", "must be a non-negative integer");
    case "pause":
    case "resume":
      return isNonEmptyString(payload.reason) ? null : payloadIssue("reason", "must be a non-empty string");
    case "saveSnapshot":
      return isNonNegativeInteger(payload.requestId) ? null : payloadIssue("requestId", "must be a non-negative integer");
    case "loadSnapshot":
      return isRecord(payload.snapshot) ? null : payloadIssue("snapshot", "must be an object");
    case "replaySeek":
      return isNonNegativeInteger(payload.tick) ? null : payloadIssue("tick", "must be a non-negative integer");
    case "debugMetrics":
      return isPositiveInteger(payload.windowTicks) ? null : payloadIssue("windowTicks", "must be a positive integer");
    case "dispose":
      return Object.keys(payload).length === 0 ? null : payloadIssue("$", "must be empty");
  }
}

function isGameCommand(value: unknown): value is GameCommand {
  if (!isRecord(value)) return false;
  return (
    isNonNegativeInteger(value.sequence) &&
    isNonNegativeInteger(value.issuedTick) &&
    isNonNegativeInteger(value.executeTick) &&
    value.executeTick >= value.issuedTick &&
    isNonNegativeInteger(value.playerId) &&
    (value.source === "player" || value.source === "ai" || value.source === "tutorial") &&
    typeof value.kind === "string" &&
    (COMMAND_KINDS as readonly string[]).includes(value.kind) &&
    isPositiveIntegerArray(value.entityIds) &&
    (value.target === undefined || isCommandTarget(value.target)) &&
    (value.payload === undefined || isRecord(value.payload))
  );
}

function isCommandTarget(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === "entity") return isPositiveInteger(value.entityId);
  return value.kind === "point" && isSafeInteger(value.x) && isSafeInteger(value.y);
}

function payloadIssue(path: string, requirement: string): ValidationIssue {
  return {
    path: path === "$" ? "payload" : `payload.${path}`,
    code: "invalid_value",
    message: `payload.${path} ${requirement}.`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isUint32(value: unknown): value is number {
  return isNonNegativeInteger(value) && value <= 0xffff_ffff;
}

function isIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isNonNegativeInteger);
}

function isPositiveIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isPositiveInteger);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
