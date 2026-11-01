import type { GameCommand } from "./commands";
import { gameCommandSchema } from "./commands";
import { array, enumeration, integer, literal, nullable, object, parse, refine, text, union, unique, type Schema } from "./validation";
import {
  STARK_RIFT_DATA_VERSION,
  STARK_RIFT_ENGINE_VERSION,
  STARK_RIFT_FORMAT_VERSION,
  STARK_RIFT_SCHEMA_VERSION,
  STARK_RIFT_CHECKSUM_ALGORITHM,
  STARK_RIFT_RNG_ALGORITHM,
} from "./versions";

export type SimulationPhase = "setup" | "running" | "paused" | "finished";
export type RngStreamId = "combat" | "ai" | "map" | "rules";

export type RngStreamState = {
  id: RngStreamId;
  algorithm: string;
  words: number[];
};

export type SimulationCounters = {
  nextEntityId: number;
  nextProjectileId: number;
  nextEventId: number;
};

export type CommandSchedulerState = {
  lastAcceptedSequenceByPlayer: number[];
  nextInternalCommandId: number;
  pending: GameCommand[];
};

export type MapState = {
  definitionId: string;
  obstacleVersion: number;
};

export type PlayerState = {
  id: number;
  faction: "terran" | "zerg" | "protoss";
  minerals: number;
  gas: number;
  supplyUsedHalf: number;
  supplyCapHalf: number;
};

export type MatchOutcome = {
  kind: "victory" | "defeat" | "draw" | "surrender";
  winnerPlayerId: number | null;
  decidedTick: number;
};

// Concrete SoA stores are introduced with the phase 1 deterministic engine.
export type EntityStore = Record<string, ArrayLike<number>>;
export type ProjectileStore = Record<string, ArrayLike<number>>;
export type GameplayEffectStore = Record<string, ArrayLike<number>>;
export type ScheduledEventQueue = unknown[];
export type AiRuntimeState = Record<string, unknown>;

export type SimulationState = {
  schemaVersion: number;
  engineVersion: string;
  dataVersion: string;
  tick: number;
  seed: number;
  rngStreams: RngStreamState[];
  counters: SimulationCounters;
  commandState: CommandSchedulerState;
  phase: SimulationPhase;
  map: MapState;
  players: PlayerState[];
  entities: EntityStore;
  projectiles: ProjectileStore;
  gameplayEffects: GameplayEffectStore;
  scheduledEvents: ScheduledEventQueue;
  ai: AiRuntimeState[];
  outcome: MatchOutcome | null;
};

export type SessionState = {
  camera: { centerX: number; centerY: number; zoomLevel: 0 | 1 | 2 };
  selection: { entityIds: number[]; controlGroupIds: number[] };
  openPanel: string | null;
};

export type PersistenceEnvelope = {
  formatVersion: number;
  engineVersion: string;
  dataVersion: string;
  savedAt: string;
  simulation: SimulationState;
  session: SessionState;
  recentCommands: GameCommand[];
  checksum: string;
  checksumAlgorithm: typeof STARK_RIFT_CHECKSUM_ALGORITHM;
  rngAlgorithm: typeof STARK_RIFT_RNG_ALGORITHM;
};

export function createEmptySimulationState(seed: number): SimulationState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new TypeError("Seed must be a Uint32 integer.");
  return {
    schemaVersion: STARK_RIFT_SCHEMA_VERSION,
    engineVersion: STARK_RIFT_ENGINE_VERSION,
    dataVersion: STARK_RIFT_DATA_VERSION,
    tick: 0,
    seed,
    rngStreams: [],
    counters: { nextEntityId: 1, nextProjectileId: 1, nextEventId: 1 },
    commandState: {
      lastAcceptedSequenceByPlayer: [],
      nextInternalCommandId: 1,
      pending: [],
    },
    phase: "setup",
    map: { definitionId: "", obstacleVersion: 0 },
    players: [],
    entities: {},
    projectiles: {},
    gameplayEffects: {},
    scheduledEvents: [],
    ai: [],
    outcome: null,
  };
}

export function createPersistenceEnvelope(
  simulation: SimulationState,
  session: SessionState,
  recentCommands: GameCommand[],
  checksum: string,
  savedAt: string,
): PersistenceEnvelope {
  const saved = {
    formatVersion: STARK_RIFT_FORMAT_VERSION,
    engineVersion: simulation.engineVersion,
    dataVersion: simulation.dataVersion,
    savedAt,
    simulation,
    session,
    recentCommands,
    checksum,
    checksumAlgorithm: STARK_RIFT_CHECKSUM_ALGORITHM,
    rngAlgorithm: STARK_RIFT_RNG_ALGORITHM,
  };
  const validated = validatePersistenceEnvelope(saved);
  if (!validated.ok) throw new TypeError(JSON.stringify(validated.issues));
  // The caller may advance the simulation immediately after this call.
  return structuredClone(validated.value);
}

export const factionSchema = enumeration(["terran", "zerg", "protoss"]);
export const phaseSchema = enumeration(["setup", "running", "paused", "finished"]);
const playerSchema = object({
  id: integer(), faction: factionSchema, minerals: integer(), gas: integer(),
  supplyUsedHalf: integer(), supplyCapHalf: integer(0, 200),
});
const rngSchema = refine(object({
  id: enumeration(["combat", "ai", "map", "rules"]), algorithm: literal(STARK_RIFT_RNG_ALGORITHM),
  words: array(integer(0, 0xffffffff), 4, 4),
}), rng => rng.words.some(word => word !== 0), "RNG state cannot be all zero.");
const emptyStore = object({});

/** Phase 0 has no entity/event/AI storage layout yet. Never bless arbitrary blobs as valid saves. */
export const simulationStateSchema: Schema<SimulationState> = refine(object({
  schemaVersion: literal(STARK_RIFT_SCHEMA_VERSION), engineVersion: literal(STARK_RIFT_ENGINE_VERSION),
  dataVersion: text, tick: integer(), seed: integer(0, 0xffffffff),
  rngStreams: refine(array(rngSchema, 0, 4), streams => new Set(streams.map(s => s.id)).size === streams.length, "Duplicate RNG stream."),
  counters: object({ nextEntityId: integer(1), nextProjectileId: integer(1), nextEventId: integer(1) }),
  commandState: object({ lastAcceptedSequenceByPlayer: array(integer(), 0, 2), nextInternalCommandId: integer(1), pending: array(gameCommandSchema) }),
  phase: phaseSchema,
  map: object({ definitionId: union(text, literal("")), obstacleVersion: integer() }),
  players: refine(array(playerSchema, 0, 2), players => new Set(players.map(p => p.id)).size === players.length, "Duplicate player ID."),
  entities: emptyStore, projectiles: emptyStore, gameplayEffects: emptyStore,
  scheduledEvents: array(emptyStore, 0, 0), ai: array(emptyStore, 0, 0),
  outcome: nullable(object({ kind: enumeration(["victory", "defeat", "draw", "surrender"]), winnerPlayerId: nullable(integer()), decidedTick: integer() })),
}), state => state.phase === "setup" && state.tick === 0 && state.outcome === null,
"Phase 0 only supports setup snapshots; live simulation storage must be defined in phase 1.");

export const sessionStateSchema: Schema<SessionState> = object({
  camera: object({ centerX: integer(-Number.MAX_SAFE_INTEGER), centerY: integer(-Number.MAX_SAFE_INTEGER), zoomLevel: integer(0, 2) as Schema<0 | 1 | 2> }),
  selection: object({ entityIds: unique(array(integer(1), 0, 200)), controlGroupIds: unique(array(integer(0, 4), 0, 5)) }),
  openPanel: nullable(text),
});
export const persistenceEnvelopeSchema: Schema<PersistenceEnvelope> = refine(object({
  formatVersion: literal(STARK_RIFT_FORMAT_VERSION), engineVersion: literal(STARK_RIFT_ENGINE_VERSION),
  dataVersion: text, savedAt: refine(text, value => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, "Expected a canonical UTC timestamp."),
  simulation: simulationStateSchema, session: sessionStateSchema,
  recentCommands: array(gameCommandSchema),
  checksum: refine(text, value => /^[0-9a-f]{8}$/.test(value), "Expected an xxhash32 hexadecimal digest."),
  checksumAlgorithm: literal(STARK_RIFT_CHECKSUM_ALGORITHM), rngAlgorithm: literal(STARK_RIFT_RNG_ALGORITHM),
}), saved => saved.engineVersion === saved.simulation.engineVersion && saved.dataVersion === saved.simulation.dataVersion,
"Envelope and simulation versions must match.");
export const validatePersistenceEnvelope = (input: unknown) => parse(persistenceEnvelopeSchema, input);
