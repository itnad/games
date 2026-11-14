import { siegeStateSchema, validSiege, type SiegeTransition } from "../abilities/siege-state";
import { energyStateSchema, validEnergy, type EnergyRecord } from "../abilities/cloak-state";
import { specialStateSchema, type SpecialState } from "../abilities/special-state";
import { validSpecial } from "../abilities/special-validation";
import { validBurrowState } from "../abilities/burrow";
import { getRuntimeMap } from "../data/maps";
import { ECONOMY_DATA_VERSION, LEGACY_ECONOMY_DATA_VERSION, BURROW_ECONOMY_DATA_VERSION, SPECIAL_ECONOMY_DATA_VERSION, CLOAK_ECONOMY_DATA_VERSION, unitFamily } from "../data/economy-catalog";
import { LEGACY_VISION_RULES_VERSION, VISION_RULES_VERSION, visionStateSchema, type VisionState } from "../vision/state";
import {
  combatStateSchema,
  PREVIOUS_COMBAT_RULES_VERSION,
  COMBAT_RULES_VERSION,
  RANGED_COMBAT_RULES_VERSION,
  TERRAIN_COMBAT_RULES_VERSION,
  BURROW_COMBAT_RULES_VERSION,
  SPECIAL_COMBAT_RULES_VERSION,
  CLOAK_COMBAT_RULES_VERSION,
  type CombatState,
} from "../combat/state";
import { validEconomy } from "../economy/validation";
import {
  economyStateSchema,
  emptyEconomy,
  type EconomyState,
} from "../economy/state";
import {
  navigationSchema,
  emptyNavigation,
  type NavigationState,
} from "../pathfinding/state";
import {
  controlGroupSchema,
  movementStateSchema,
  type ControlGroup,
  type MovementState,
} from "./orders";
import { checksum } from "./checksum";
import { RNG_STREAM_IDS } from "./rng";
import { entityStoreSchema, emptyEntityStore, type EntityStore } from "./world";
import type { GameCommand } from "./commands";
import { gameCommandSchema } from "./commands";
import {
  array,
  enumeration,
  integer,
  literal,
  nullable,
  object,
  parse,
  refine,
  text,
  union,
  unique,
  optional,
  type Schema,
} from "./validation";
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
  controlGroups: ControlGroup[];
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
export type { EntityStore } from "./world";
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
  movement: MovementState[];
  navigation: NavigationState;
  economy: EconomyState;
  combat?: CombatState;
  vision?: VisionState;
  special?: SpecialState;
  energy?: EnergyRecord[];
  siege?: SiegeTransition[];
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
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new TypeError("Seed must be a Uint32 integer.");
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
    entities: emptyEntityStore(),
    movement: [],
    navigation: emptyNavigation(),
    economy: emptyEconomy(),
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
    checksum: checksum(simulation),
    checksumAlgorithm: STARK_RIFT_CHECKSUM_ALGORITHM,
    rngAlgorithm: STARK_RIFT_RNG_ALGORITHM,
  };
  const validated = validatePersistenceEnvelope(saved);
  if (!validated.ok) throw new TypeError(JSON.stringify(validated.issues));
  // The caller may advance the simulation immediately after this call.
  return structuredClone(validated.value);
}

export const factionSchema = enumeration(["terran", "zerg", "protoss"]);
export const phaseSchema = enumeration([
  "setup",
  "running",
  "paused",
  "finished",
]);
const playerSchema = object({
  id: integer(),
  faction: factionSchema,
  minerals: integer(),
  gas: integer(),
  controlGroups: array(controlGroupSchema, 5, 5),
  supplyUsedHalf: integer(),
  supplyCapHalf: integer(0, 200),
});
const rngSchema = refine(
  object({
    id: enumeration(["combat", "ai", "map", "rules"]),
    algorithm: literal(STARK_RIFT_RNG_ALGORITHM),
    words: array(integer(0, 0xffffffff), 4, 4),
  }),
  (rng) => rng.words.some((word) => word !== 0),
  "RNG state cannot be all zero.",
);
const emptyStore = object({});

/** Live entity storage is defined; projectile/effect/AI layouts remain reserved for their stages. */
export const matchOutcomeSchema: Schema<MatchOutcome> = refine(
  object({
    kind: enumeration(["victory", "defeat", "draw", "surrender"]),
    winnerPlayerId: nullable(integer(0, 1)),
    decidedTick: integer(),
  }),
  (o) => (o.kind === "draw") === (o.winnerPlayerId === null),
  "Outcome winner must match its kind",
);
export const simulationStateSchema: Schema<SimulationState> = refine(
  object({
    schemaVersion: literal(STARK_RIFT_SCHEMA_VERSION),
    engineVersion: literal(STARK_RIFT_ENGINE_VERSION),
    dataVersion: text,
    tick: integer(),
    seed: integer(0, 0xffffffff),
    rngStreams: refine(
      array(rngSchema, 0, 4),
      (streams) => new Set(streams.map((s) => s.id)).size === streams.length,
      "Duplicate RNG stream.",
    ),
    counters: object({
      nextEntityId: integer(1),
      nextProjectileId: integer(1),
      nextEventId: integer(1),
    }),
    commandState: object({
      lastAcceptedSequenceByPlayer: array(integer(), 0, 2),
      nextInternalCommandId: integer(1),
      pending: array(gameCommandSchema),
    }),
    phase: phaseSchema,
    map: object({
      definitionId: union(text, literal("")),
      obstacleVersion: integer(),
    }),
    players: refine(
      array(playerSchema, 0, 2),
      (players) => new Set(players.map((p) => p.id)).size === players.length,
      "Duplicate player ID.",
    ),
    navigation: navigationSchema,
    economy: economyStateSchema,
    combat: optional(combatStateSchema),
    vision: optional(visionStateSchema),
    special: optional(specialStateSchema),
    energy: optional(energyStateSchema),
    siege: optional(siegeStateSchema),
    movement: array(movementStateSchema, 0, 2048),
    entities: entityStoreSchema,
    projectiles: emptyStore,
    gameplayEffects: emptyStore,
    scheduledEvents: array(emptyStore, 0, 0),
    ai: array(emptyStore, 0, 0),
    outcome: nullable(matchOutcomeSchema),
  }),
  (state) => {
    if (!validEconomy(state) || !validBurrowState(state) || !validSpecial(state) || !validEnergy(state) || !validSiege(state)) return false;
    if (state.vision) {
      const v = state.vision;
      if (
        !state.economy.enabled ||
        v.players.some((p, i) => p.playerId !== i) ||
        new Set(v.concealed.map((c) => c.entityId)).size !==
          v.concealed.length ||
        v.concealed.some((c) => !state.entities.id.includes(c.entityId))
      )
        return false;
      for (const p of v.players) {
        if (
          new Set(p.contacts.map((c) => c.entityId)).size !==
            p.contacts.length ||
          new Set(p.resources.map((r) => r.nodeId)).size !==
            p.resources.length ||
          p.contacts.some(
            (c) =>
              c.entityId >= state.counters.nextEntityId ||
              c.seenTick > state.tick ||
              c.owner === p.playerId,
          ) ||
          p.explored.some((c) => c >= v.width * v.height)
        )
          return false;
      }
    }
    if (state.combat) {
      const c = state.combat,
        e = state.entities;
      if (
        !state.economy.enabled ||
        new Set(c.records.map((r) => r.entityId)).size !== c.records.length ||
        c.records.some((r) => {
          const i = e.id.indexOf(r.entityId);
          return (
            i < 0 ||
            r.definitionId !== e.definitionId[i] ||
            r.healthFraction > e.health[i] * 256 ||
            r.shieldFraction > e.shield[i] * 256
          );
        })
      )
        return false;
      if (
        [...c.friendlyIds, ...c.targetIds].some(
          (id) => id >= state.counters.nextEntityId,
        ) ||
        c.friendlyIds.some((id) => c.targetIds.includes(id))
      )
        return false;
      if (
        new Set(c.effects.map((e) => e.id)).size !== c.effects.length ||
        c.effects.some(
          (e) => e.id >= state.counters.nextEventId || e.tick > state.tick,
        )
      )
        return false;
    }
    if (state.combat) {
      const shots = state.combat.projectiles;
      if (
        new Set(shots.map((p) => p.id)).size !== shots.length ||
        shots.some(
          (p) =>
            p.id >= state.counters.nextProjectileId ||
            p.sourceId >= state.counters.nextEntityId ||
            p.targetId >= state.counters.nextEntityId ||
            p.spawnTick > state.tick ||
            p.expiresTick <= state.tick ||
            p.expiresTick - p.spawnTick !== 200,
        )
      )
        return false;
    }
    const ids = state.players.map((p) => p.id);
    if (!ids.every((id, i) => id === i)) return false;
    if (
      state.entities.id.some(
        (id, i) =>
          id >= state.counters.nextEntityId ||
          !ids.includes(state.entities.owner[i]),
      )
    )
      return false;
    if (
      new Set(state.navigation.jobs.map((job) => job.entityId)).size !==
        state.navigation.jobs.length ||
      state.navigation.jobs.some(
        (job) => !state.entities.id.includes(job.entityId),
      )
    )
      return false;
    if (
      state.movement.length !== state.entities.id.length ||
      state.movement.some((m, i) => m.entityId !== state.entities.id[i])
    )
      return false;
    if (
      state.movement.some(
        (m) =>
          m.targetEntityId !== null &&
          !state.entities.id.includes(m.targetEntityId),
      )
    )
      return false;
    for (const player of state.players) {
      const assigned = new Set<number>();
      for (const group of player.controlGroups) {
        let definition: string | null = null;
        for (const id of group.entityIds) {
          const index = state.entities.id.indexOf(id);
          if (
            index < 0 ||
            assigned.has(id) ||
            state.entities.owner[index] !== player.id ||
            state.entities.health[index] === 0 ||
            state.entities.kind[index] !== "combat"
          )
            return false;
          if (
            definition !== null &&
            definition !== unitFamily(state.entities.definitionId[index])
          )
            return false;
          definition = unitFamily(state.entities.definitionId[index]);
          assigned.add(id);
        }
      }
    }
    if (
      state.phase !== "setup" &&
      (ids.length !== 2 ||
        state.rngStreams.length !== 4 ||
        !state.map.definitionId)
    )
      return false;
    if (state.phase === "setup" && state.tick !== 0) return false;
    if ((state.phase === "finished") !== (state.outcome !== null)) return false;
    if (
      state.outcome &&
      (state.outcome.decidedTick > state.tick ||
        (state.outcome.winnerPlayerId !== null &&
          !ids.includes(state.outcome.winnerPlayerId)))
    )
      return false;
    if (state.commandState.lastAcceptedSequenceByPlayer.length !== ids.length)
      return false;
    if (
      state.rngStreams.some(
        (stream, index) => stream.id !== RNG_STREAM_IDS[index],
      )
    )
      return false;
    const keys = new Set<string>();
    for (const [index, command] of state.commandState.pending.entries()) {
      const previous = state.commandState.pending[index - 1];
      if (
        previous &&
        (previous.executeTick > command.executeTick ||
          (previous.executeTick === command.executeTick &&
            (previous.playerId > command.playerId ||
              (previous.playerId === command.playerId &&
                previous.sequence >= command.sequence))))
      )
        return false;
      const key = `${command.playerId}:${command.sequence}`;
      if (
        !ids.includes(command.playerId) ||
        command.executeTick <= state.tick ||
        command.issuedTick > state.tick ||
        command.sequence >
          state.commandState.lastAcceptedSequenceByPlayer[command.playerId] ||
        keys.has(key)
      )
        return false;
      keys.add(key);
    }
    return true;
  },
  "Invalid simulation ownership, counters, command scheduler or lifecycle.",
);

export const sessionStateSchema: Schema<SessionState> = object({
  camera: object({
    centerX: integer(-Number.MAX_SAFE_INTEGER),
    centerY: integer(-Number.MAX_SAFE_INTEGER),
    zoomLevel: integer(0, 2) as Schema<0 | 1 | 2>,
  }),
  selection: object({
    entityIds: unique(array(integer(1), 0, 200)),
    controlGroupIds: unique(array(integer(0, 4), 0, 5)),
  }),
  openPanel: nullable(text),
});
export const persistenceEnvelopeSchema: Schema<PersistenceEnvelope> = refine(
  object({
    formatVersion: literal(STARK_RIFT_FORMAT_VERSION),
    engineVersion: literal(STARK_RIFT_ENGINE_VERSION),
    dataVersion: text,
    savedAt: refine(
      text,
      (value) =>
        /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
        Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString() === value,
      "Expected a canonical UTC timestamp.",
    ),
    simulation: simulationStateSchema,
    session: sessionStateSchema,
    recentCommands: array(gameCommandSchema),
    checksum: refine(
      text,
      (value) => /^[0-9a-f]{8}$/.test(value),
      "Expected an xxhash32 hexadecimal digest.",
    ),
    checksumAlgorithm: literal(STARK_RIFT_CHECKSUM_ALGORITHM),
    rngAlgorithm: literal(STARK_RIFT_RNG_ALGORITHM),
  }),
  (saved) =>
    saved.engineVersion === saved.simulation.engineVersion &&
    saved.dataVersion === saved.simulation.dataVersion &&
    saved.checksum === checksum(saved.simulation),
  "Envelope versions and simulation checksum must match.",
);
export const validatePersistenceEnvelope = (input: unknown) =>
  parse(persistenceEnvelopeSchema, input);

/** Verify the untouched source checksum and supported version before migration. */
export function migrateLegacyEnvelope(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const old = input as PersistenceEnvelope;
  if (![6, 7, 8, 9, 10, 11, 12].includes(old.formatVersion)) return input;
  const source = old.simulation,
    engine = (
      { 6: "0.7.0-stage4", 7: "0.8.0-stage5a", 8: "0.9.0-stage5b", 9: "0.10.0-stage5c", 10: "0.11.0-stage6a", 11: "0.12.0-stage6b", 12: "0.13.0-stage6c" } as Record<
        number,
        string
      >
    )[old.formatVersion];
  if (
    !source ||
    old.engineVersion !== engine ||
    source.engineVersion !== engine ||
    source.schemaVersion !== old.formatVersion ||
    old.checksum !== checksum(source) ||
    (old.formatVersion < 9 && source.vision !== undefined) ||
    (old.formatVersion < 11 && source.special !== undefined) ||
    (old.formatVersion < 12 && source.energy !== undefined) ||
    source.siege !== undefined ||
    (source.vision !== undefined && (source.vision.rulesVersion as string) !== (old.formatVersion >= 11 ? VISION_RULES_VERSION : LEGACY_VISION_RULES_VERSION))
  )
    throw new TypeError("Invalid legacy save");
  const currentDataVersion = getRuntimeMap("rift-basin").dataVersion,
    previousDataVersion = currentDataVersion.replace(ECONOMY_DATA_VERSION, old.formatVersion === 12 ? CLOAK_ECONOMY_DATA_VERSION : old.formatVersion === 11 ? SPECIAL_ECONOMY_DATA_VERSION : old.formatVersion === 10 ? BURROW_ECONOMY_DATA_VERSION : LEGACY_ECONOMY_DATA_VERSION);
  if (old.dataVersion !== source.dataVersion || source.map?.definitionId !== "rift-basin" || old.dataVersion !== previousDataVersion)
    throw new TypeError("Unknown legacy data version");
  if (old.formatVersion === 6 && source.combat !== undefined)
    throw new TypeError("Unexpected legacy combat");
  if (source.combat) {
    const expected =
      old.formatVersion === 7
        ? PREVIOUS_COMBAT_RULES_VERSION
        : old.formatVersion === 8 ? RANGED_COMBAT_RULES_VERSION : old.formatVersion === 9 ? TERRAIN_COMBAT_RULES_VERSION : old.formatVersion === 10 ? BURROW_COMBAT_RULES_VERSION : old.formatVersion === 11 ? SPECIAL_COMBAT_RULES_VERSION : CLOAK_COMBAT_RULES_VERSION;
    if (
      source.combat.rulesVersion !== expected ||
      !(old.formatVersion >= 11 ? ["economy", "combat-practice", "ranged-practice", "siege-practice", "special-practice"] : old.formatVersion >= 9 ? ["economy", "combat-practice", "ranged-practice", "siege-practice"] : ["economy", "combat-practice", "ranged-practice"]).includes(
        source.combat.scenario,
      )
    )
      throw new TypeError("Unknown legacy combat rules");
    if (
      old.formatVersion === 7 &&
      (Object.hasOwn(source.combat, "projectiles") ||
        source.combat.scenario === "ranged-practice" ||
        source.combat.effects.some(
          (e) =>
            !["shot", "slash", "death"].includes(e.kind) ||
            e.weaponId !== undefined,
        ))
    )
      throw new TypeError("Invalid legacy combat");
    if (
      old.formatVersion === 8 &&
      (!Array.isArray(source.combat.projectiles) ||
        source.combat.projectiles.some((p) => Object.hasOwn(p, "miss")) ||
        source.combat.effects.some((e) => e.kind === "miss"))
    )
      throw new TypeError("Invalid legacy flight");
  }
  const saved = structuredClone(old);
  saved.dataVersion = saved.simulation.dataVersion = currentDataVersion;
  saved.formatVersion = STARK_RIFT_FORMAT_VERSION;
  saved.engineVersion = STARK_RIFT_ENGINE_VERSION;
  saved.simulation.schemaVersion = STARK_RIFT_SCHEMA_VERSION;
  saved.simulation.engineVersion = STARK_RIFT_ENGINE_VERSION;
  if (saved.simulation.vision) saved.simulation.vision.rulesVersion = VISION_RULES_VERSION;
  if (saved.simulation.combat) {
    saved.simulation.combat.rulesVersion = COMBAT_RULES_VERSION;
    saved.simulation.combat.projectiles ??= [];
    if (old.formatVersion < 9)
      for (const p of saved.simulation.combat.projectiles) p.miss = false;
    for (const r of saved.simulation.combat.records) r.lastSeenTarget ??= null;
  }
  for (const m of saved.simulation.movement)
    if (!Object.hasOwn(m, "trackedTarget"))
      m.trackedTarget =
        m.order === "focusAttack" && m.target ? { ...m.target } : null;
  saved.checksum = checksum(saved.simulation);
  const parsed = validatePersistenceEnvelope(saved);
  if (!parsed.ok) throw new TypeError("Invalid migrated save");
  return parsed.value;
}
export const migrateStage4Envelope = migrateLegacyEnvelope;

export function serializeSnapshot(saved: PersistenceEnvelope): string {
  const result = validatePersistenceEnvelope(saved);
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues));
  return JSON.stringify(saved);
}
export function restoreSnapshot(serialized: string): PersistenceEnvelope {
  if (serialized.length > 16 * 1024 * 1024)
    throw new RangeError("Snapshot exceeds 16 MiB.");
  const result = validatePersistenceEnvelope(
    migrateLegacyEnvelope(JSON.parse(serialized)),
  );
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues));
  return structuredClone(result.value);
}
