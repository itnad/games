import { COMMAND_FAILURE_CODES, MAX_COMMANDS_PER_BATCH, gameCommandSchema } from "../core/commands";
import { renderSnapshotSchema } from "./render-snapshot";
import { factionSchema, persistenceEnvelopeSchema, phaseSchema } from "../core/state";
import { STARK_RIFT_ENGINE_VERSION, STARK_RIFT_PROTOCOL_VERSION } from "../core/versions";
import { array, boolean, dictionary, enumeration, integer, literal, nullable, object, optional, parse, refine, taggedUnion, text, unique, union, type Infer, type Schema } from "../core/validation";

function message<const K extends string, S extends Schema<unknown>>(kind: K, payload: S) {
  return object({ protocolVersion: literal(STARK_RIFT_PROTOCOL_VERSION), messageId: integer(), kind: literal(kind), payload });
}
export const playerSetupSchema = object({
  id: integer(), faction: factionSchema, controller: enumeration(["human", "ai"]),
});
const initPayload = refine(object({
  dataVersion: text, mapId: text, seed: integer(0, 0xffffffff),
  players: array(playerSetupSchema, 2, 2),
}), payload => new Set(payload.players.map(p => p.id)).size === payload.players.length, "Player IDs must be unique.");
const batchPayload = refine(object({
  commands: array(gameCommandSchema, 0, MAX_COMMANDS_PER_BATCH), lastSeenTick: integer(),
}), payload => {
  const sequences = new Set<string>();
  for (const command of payload.commands) {
    const key = `${command.playerId}:${command.sequence}`;
    if (sequences.has(key) || command.issuedTick > payload.lastSeenTick) return false;
    sequences.add(key);
  }
  return true;
}, "Batch contains a duplicate player sequence or a command issued after lastSeenTick.");
export const mainToWorkerSchemas = {
  init: message("init", initPayload),
  commandBatch: message("commandBatch", batchPayload),
  releaseRenderBuffer: message("releaseRenderBuffer", object({ bufferId: integer() })),
  pause: message("pause", object({ reason: text })),
  resume: message("resume", object({ reason: text })),
  saveSnapshot: message("saveSnapshot", object({ requestId: integer() })),
  loadSnapshot: message("loadSnapshot", object({ snapshot: persistenceEnvelopeSchema })),
  replaySeek: message("replaySeek", object({ tick: integer() })),
  debugMetrics: message("debugMetrics", object({ windowTicks: integer(1) })),
  dispose: message("dispose", object({})),
};
export const MAIN_TO_WORKER_KINDS = Object.keys(mainToWorkerSchemas) as (keyof typeof mainToWorkerSchemas)[];
export const mainToWorkerMessageSchema = taggedUnion("kind", mainToWorkerSchemas);
export type MainToWorkerMessage = Infer<typeof mainToWorkerMessageSchema>;
export type MainToWorkerKind = MainToWorkerMessage["kind"];
export const validateMainToWorkerMessage = (input: unknown) => parse(mainToWorkerMessageSchema, input);

const ackHeader = { playerId: integer(), sequence: integer(1) };
const acknowledgementSchema = union(
  object({ ...ackHeader, accepted: literalBoolean(true), executeTick: integer(1), executedEntityIds: unique(array(integer(1), 0, 200)) }),
  object({ ...ackHeader, accepted: literalBoolean(false), code: enumeration(COMMAND_FAILURE_CODES), details: optional(dictionary(union(text, integer(-Number.MAX_SAFE_INTEGER)))) }),
);
function literalBoolean<T extends boolean>(expected: T): Schema<T> {
  return refine(boolean, value => value === expected, `Expected ${expected}.`) as Schema<T>;
}
export const workerToMainSchemas = {
  renderSnapshot: message("renderSnapshot", renderSnapshotSchema),
  ready: message("ready", object({ tick: integer(), engineVersion: literal(STARK_RIFT_ENGINE_VERSION), dataVersion: text })),
  commandAck: message("commandAck", acknowledgementSchema),
  phaseChanged: message("phaseChanged", object({ tick: integer(), phase: phaseSchema })),
  snapshotLoaded: message("snapshotLoaded", object({ tick: integer() })),
  saveSnapshotReady: message("saveSnapshotReady", object({ requestId: integer(), snapshot: persistenceEnvelopeSchema })),
  fatalError: message("fatalError", object({ code: text, recoverable: boolean, diagnosticId: nullable(text) })),
  metrics: message("metrics", object({ tick: integer(), windowTicks: integer(1), entityCount: integer(), pendingCommands: integer() })),
  disposed: message("disposed", object({})),
};
// These wire layouts depend on the renderer/UI stages and are deliberately not accepted yet.
export const RESERVED_WORKER_TO_MAIN_KINDS = ["uiState", "notification"] as const;
export const WORKER_TO_MAIN_KINDS = Object.keys(workerToMainSchemas) as (keyof typeof workerToMainSchemas)[];
export const workerToMainMessageSchema = taggedUnion("kind", workerToMainSchemas);
export type WorkerToMainMessage = Infer<typeof workerToMainMessageSchema>;
export type WorkerToMainKind = WorkerToMainMessage["kind"];
export const validateWorkerToMainMessage = (input: unknown) => parse(workerToMainMessageSchema, input);
type ResponseFor<K extends WorkerToMainKind> = Extract<WorkerToMainMessage, { kind: K }>;
export function createWorkerEnvelope<K extends WorkerToMainKind>(
  messageId: number, kind: K, payload: ResponseFor<NoInfer<K>>["payload"],
): ResponseFor<K> {
  const input = { protocolVersion: STARK_RIFT_PROTOCOL_VERSION, messageId, kind, payload };
  const result = validateWorkerToMainMessage(input);
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues));
  return result.value as ResponseFor<K>;
}
