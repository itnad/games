import type { GameCommand } from "./commands";
import {
  STARK_RIFT_DATA_VERSION,
  STARK_RIFT_ENGINE_VERSION,
  STARK_RIFT_FORMAT_VERSION,
  STARK_RIFT_SCHEMA_VERSION,
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
};

export function createEmptySimulationState(seed: number): SimulationState {
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
  return {
    formatVersion: STARK_RIFT_FORMAT_VERSION,
    engineVersion: simulation.engineVersion,
    dataVersion: simulation.dataVersion,
    savedAt,
    simulation,
    session,
    recentCommands,
    checksum,
  };
}
