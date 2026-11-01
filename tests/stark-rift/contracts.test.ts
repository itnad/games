import { describe, expect, it } from "vitest";
import { COMMAND_KINDS, MAX_COMMANDS_PER_BATCH, validateGameCommand, type GameCommand } from "../../app/stark-rift/core/commands";
import { createEmptySimulationState, createPersistenceEnvelope, validatePersistenceEnvelope } from "../../app/stark-rift/core/state";
import { STARK_RIFT_ENGINE_VERSION, STARK_RIFT_PROTOCOL_VERSION, STARK_RIFT_SCHEMA_VERSION } from "../../app/stark-rift/core/versions";
import { validateDataBundle } from "../../app/stark-rift/data/validation";
import { createWorkerEnvelope, MAIN_TO_WORKER_KINDS, RESERVED_WORKER_TO_MAIN_KINDS, validateMainToWorkerMessage, validateWorkerToMainMessage, WORKER_TO_MAIN_KINDS } from "../../app/stark-rift/worker/messages";
import { parse, object, integer, array } from "../../app/stark-rift/core/validation";

const point = { kind: "point", x: 256, y: 512 };
const target = { kind: "entity", entityId: 2 };
const base = { sequence: 1, issuedTick: 9, executeTick: 10, playerId: 0, source: "player", entityIds: [1] };
const commands = {
  move: { target: point }, attackMove: { target: point }, focusAttack: { target },
  stop: {}, hold: {}, patrol: { target: point },
  setFormation: { payload: { formation: "line" } }, setStance: { payload: { stance: "free" } },
  setRallyPoint: { target: point }, produce: { payload: { unitId: "marine" } },
  toggleRepeatProduction: { payload: { unitId: "marine", enabled: true } },
  cancelProduction: { payload: { queueEntryId: 1 } },
  placeBuilding: { target: point, payload: { buildingId: "barracks" } },
  cancelConstruction: {}, research: { payload: { technologyId: "stim" } }, cancelResearch: {},
  castAbility: { target, payload: { abilityId: "heal" } },
  toggleAutocast: { payload: { abilityId: "heal", enabled: true } },
  toggleStateAbility: { payload: { abilityId: "siege", enabled: false } },
  loadTransport: { target }, unloadTransport: { target: point },
  unloadPassenger: { target: point, payload: { passengerId: 3 } },
  surrender: { entityIds: [] },
} satisfies Record<(typeof COMMAND_KINDS)[number], object>;
const move = { ...base, kind: "move", target: point };
const wire = (kind: string, payload: unknown) => ({ protocolVersion: STARK_RIFT_PROTOCOL_VERSION, messageId: 1, kind, payload });
function saved() {
  return createPersistenceEnvelope(createEmptySimulationState(42), {
    camera: { centerX: 0, centerY: 0, zoomLevel: 1 },
    selection: { entityIds: [], controlGroupIds: [] }, openPanel: null,
  }, [], "2026-11-01T00:00:00.000Z");
}

describe("command runtime boundary", () => {
  it.each(Object.entries(commands))("accepts the specified %s wire format", (kind, fields) => {
    expect(validateGameCommand({ ...base, kind, ...fields }).ok).toBe(true);
  });
  it.each([
    { target: undefined }, { target }, { target: { ...point, x: NaN } },
    { entityIds: [] }, { entityIds: [1, 1] }, { entityIds: [0] }, { entityIds: Array(2) },
    { sequence: 0 }, { executeTick: 9 }, { issuedTick: -1 }, { playerId: Infinity },
    { source: "server" }, { payload: {} }, { extra: true },
  ])("rejects invalid movement input %#", fields => {
    expect(validateGameCommand({ ...move, ...fields }).ok).toBe(false);
  });
  it.each(["produce", "setFormation", "castAbility", "toggleAutocast", "placeBuilding"])("requires the %s payload", kind => {
    expect(validateGameCommand({ ...base, kind }).ok).toBe(false);
  });
  it("rejects an unknown formation, nonboolean toggle, or untargeted surrender actors", () => {
    expect(validateGameCommand({ ...base, kind: "setFormation", payload: { formation: "circle" } }).ok).toBe(false);
    expect(validateGameCommand({ ...base, kind: "toggleAutocast", payload: { abilityId: "heal", enabled: 1 } }).ok).toBe(false);
    expect(validateGameCommand({ ...base, kind: "surrender" }).ok).toBe(false);
  });
});

describe("versioned snapshots", () => {
  it("takes an independent validated snapshot", () => {
    const simulation = createEmptySimulationState(42);
    const session = saved().session;
    const result = createPersistenceEnvelope(simulation, session, [], "2026-11-01T00:00:00.000Z");
    simulation.map.obstacleVersion = 99;
    session.camera.centerX = 123;
    expect(result.simulation.map.obstacleVersion).toBe(0);
    expect(result.session.camera.centerX).toBe(0);
    expect(validatePersistenceEnvelope(result).ok).toBe(true);
  });
  it.each([-1, 1.5, NaN, Infinity, 0x100000000])("rejects seed %s", seed => {
    expect(() => createEmptySimulationState(seed)).toThrow(TypeError);
  });
  it.each([
    { formatVersion: 1 }, { engineVersion: "old" }, { dataVersion: "other" },
    { checksum: "pretend" }, { checksumAlgorithm: "other" }, { savedAt: "2026-02-30T00:00:00.000Z" },
    { simulation: {} }, { session: {} },
  ])("rejects damaged or incompatible saves %#", patch => {
    expect(validatePersistenceEnvelope({ ...saved(), ...patch }).ok).toBe(false);
  });
  it("does not pretend to validate an undefined live entity storage format", () => {
    const snapshot = saved();
    expect(validatePersistenceEnvelope({ ...snapshot, simulation: { ...snapshot.simulation, entities: { arbitrary: [1] } } }).ok).toBe(false);
    snapshot.simulation = { ...createEmptySimulationState(1), phase: "running" };
    expect(validatePersistenceEnvelope(snapshot).ok).toBe(false);
  });
  it("rejects malformed RNG streams and duplicate selection", () => {
    const snapshot = saved();
    snapshot.simulation.rngStreams = [{ id: "combat", algorithm: "xoshiro128ss-v1", words: [0, 0, 0, 0] }];
    expect(validatePersistenceEnvelope(snapshot).ok).toBe(false);
    snapshot.simulation.rngStreams = [];
    snapshot.session.selection.entityIds = [1, 1];
    expect(validatePersistenceEnvelope(snapshot).ok).toBe(false);
  });
});

describe("worker boundary in both directions", () => {
  const init = { dataVersion: "fixture", mapId: "rift-basin", seed: 42, players: [
    { id: 0, faction: "terran", controller: "human" }, { id: 1, faction: "zerg", controller: "ai" },
  ] };
  const incoming = {
    init, commandBatch: { commands: [move], lastSeenTick: 9 },
    releaseRenderBuffer: { bufferId: 0 }, pause: { reason: "menu" }, resume: { reason: "menu" },
    saveSnapshot: { requestId: 1 }, loadSnapshot: { snapshot: saved() }, replaySeek: { tick: 0 },
    debugMetrics: { windowTicks: 20 }, dispose: {},
  };
  it.each(Object.entries(incoming))("accepts %s", (kind, payload) => {
    expect(validateMainToWorkerMessage(wire(kind, payload)).ok).toBe(true);
  });
  it("covers all declared incoming kinds", () => expect(Object.keys(incoming).sort()).toEqual([...MAIN_TO_WORKER_KINDS].sort()));
  it("rejects incompatible versions and prototype property message kinds", () => {
    expect(validateMainToWorkerMessage({ ...wire("dispose", {}), protocolVersion: 1 }).ok).toBe(false);
    expect(validateMainToWorkerMessage(wire("toString", {})).ok).toBe(false);
    expect(validateMainToWorkerMessage(new Date()).ok).toBe(false);
  });
  it.each([
    {}, { ...init, playerIds: [0, 1] }, { ...init, players: [] },
    { ...init, players: [init.players[0], init.players[0]] },
    { ...init, players: [init.players[0], { ...init.players[1], faction: "random" }] },
  ])("rejects incomplete/ambiguous player setup %#", payload => {
    expect(validateMainToWorkerMessage(wire("init", payload)).ok).toBe(false);
  });
  it("checks duplicate player sequences, future issue ticks and batch size", () => {
    for (const payload of [
      { commands: [move, move], lastSeenTick: 9 },
      { commands: [move], lastSeenTick: 8 },
      { commands: Array(MAX_COMMANDS_PER_BATCH + 1).fill(move), lastSeenTick: 9 },
    ]) expect(validateMainToWorkerMessage(wire("commandBatch", payload)).ok).toBe(false);
    expect(validateMainToWorkerMessage(wire("commandBatch", { commands: [move, { ...move, playerId: 1 }], lastSeenTick: 9 })).ok).toBe(true);
  });
  it("checks a save's contents instead of only testing whether it is an object", () => {
    const result = validateMainToWorkerMessage(wire("loadSnapshot", { snapshot: {} }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(issue => issue.path.startsWith("payload.snapshot."))).toBe(true);
  });
  const outgoing = {
    ready: { tick: 0, engineVersion: STARK_RIFT_ENGINE_VERSION as typeof STARK_RIFT_ENGINE_VERSION, dataVersion: "fixture" },
    commandAck: { accepted: false, playerId: 0, sequence: 1, code: "invalid_target" },
    phaseChanged: { tick: 0, phase: "paused" }, snapshotLoaded: { tick: 0 },
    saveSnapshotReady: { requestId: 1, snapshot: saved() },
    fatalError: { code: "VERSION_MISMATCH", recoverable: false, diagnosticId: null },
    metrics: { tick: 0, windowTicks: 20, entityCount: 0, pendingCommands: 0 }, disposed: {},
  };
  it.each(Object.entries(outgoing))("validates response %s", (kind, payload) => {
    expect(validateWorkerToMainMessage(wire(kind, payload)).ok).toBe(true);
    expect(validateWorkerToMainMessage(wire(kind, { wrong: true })).ok).toBe(false);
  });
  it("covers all declared outgoing kinds and rejects reserved layouts", () => {
    expect(Object.keys(outgoing).sort()).toEqual([...WORKER_TO_MAIN_KINDS].sort());
    for (const kind of RESERVED_WORKER_TO_MAIN_KINDS) expect(validateWorkerToMainMessage(wire(kind, {})).ok).toBe(false);
  });
  it("creates validated responses and rejects invalid runtime payloads", () => {
    expect(createWorkerEnvelope(7, "ready", outgoing.ready)).toEqual({ ...wire("ready", outgoing.ready), messageId: 7 });
    expect(() => createWorkerEnvelope(-1, "disposed", {})).toThrow(TypeError);
    // @ts-expect-error ready requires engine/data version as well as tick.
    expect(() => createWorkerEnvelope(1, "ready", { tick: 0 })).toThrow(TypeError);
    // @ts-expect-error commands are discriminated: a move must carry a point target.
    const invalidCommand: GameCommand = { ...base, source: "player", kind: "move" };
    void invalidCommand;
  });
});

describe("schema boundary edge cases", () => {
  it("rejects inherited fields, sparse arrays and non-finite integers", () => {
    expect(parse(object({ id: integer() }), Object.create({ id: 1 })).ok).toBe(false);
    expect(parse(array(integer()), Array(1)).ok).toBe(false);
    expect(parse(integer(), Infinity).ok).toBe(false);
  });
});

// Real balance data is intentionally absent; these are contract fixtures, not sourced game values.
export const dataFixture = () => ({
  schemaVersion: STARK_RIFT_SCHEMA_VERSION, dataVersion: "fixture-only",
  source: { game: "Brood War", version: "1.16.1", reference: "test fixture, not balance data", tickRate: 20, timeScale: { numerator: 1, denominator: 2 } },
  units: [{
    id: "scv", faction: "terran", mineralCost: 50, gasCost: 0, buildTicks: 100, prerequisites: [],
    maxHealth: 60, maxShield: 0, armor: 0, supplyHalf: 2, moveSpeed: 1, sightRange: 7,
    detectionRange: 0, collisionRadius: 1, cargoSize: 1, size: "small", weapons: [], abilities: [], producedBy: ["command-center"],
  }],
  buildings: [{
    id: "command-center", faction: "terran", mineralCost: 400, gasCost: 0, buildTicks: 100, prerequisites: [],
    maxHealth: 1500, maxShield: 0, armor: 1, widthTiles: 4, heightTiles: 3, abilities: [], producedBy: ["scv"],
  }],
  abilities: [], technologies: [], maps: [{ id: "fixture", widthTiles: 96, heightTiles: 96, spawnPoints: [{ x: 10, y: 10 }, { x: 85, y: 85 }] }],
});
describe("data definition contract", () => {
  it("accepts a complete fixture and producer cycles that are not prerequisite cycles", () => {
    expect(validateDataBundle(dataFixture()).ok).toBe(true);
  });
  it("rejects id-only definitions", () => {
    expect(validateDataBundle({ ...dataFixture(), units: [{ id: "marine" }] }).ok).toBe(false);
  });
  it.each([-1, NaN, Infinity, 0.5])("rejects invalid costs %s", mineralCost => {
    const input = dataFixture(); input.units[0].mineralCost = mineralCost;
    expect(validateDataBundle(input).ok).toBe(false);
  });
  it("rejects duplicate IDs, unknown references and prerequisite cycles", () => {
    const input = dataFixture();
    input.units.push({ ...input.units[0] });
    expect(validateDataBundle(input).ok).toBe(false);
    input.units.pop(); input.units[0].producedBy = ["missing"];
    expect(validateDataBundle(input).ok).toBe(false);
    const cycle = dataFixture();
    expect(validateDataBundle({ ...cycle, units: [{ ...cycle.units[0], prerequisites: [{ kind: "buildings", id: "command-center" }] }],
      buildings: [{ ...cycle.buildings[0], prerequisites: [{ kind: "units", id: "scv" }] }] }).ok).toBe(false);
  });
  it("rejects out-of-bounds/duplicate spawns and changed source conversion rules", () => {
    const input = dataFixture(); input.maps[0].spawnPoints[1] = { x: 96, y: 0 };
    expect(validateDataBundle(input).ok).toBe(false);
    input.maps[0].spawnPoints[1] = input.maps[0].spawnPoints[0];
    expect(validateDataBundle(input).ok).toBe(false);
    expect(validateDataBundle({ ...dataFixture(), source: { ...dataFixture().source, tickRate: 30 } }).ok).toBe(false);
  });
});
