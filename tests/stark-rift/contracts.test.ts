import { describe, expect, it } from "vitest";
import { createEmptySimulationState, createPersistenceEnvelope } from "../../app/stark-rift/core/state";
import {
  STARK_RIFT_DATA_VERSION,
  STARK_RIFT_ENGINE_VERSION,
  STARK_RIFT_FORMAT_VERSION,
  STARK_RIFT_PROTOCOL_VERSION,
  STARK_RIFT_SCHEMA_VERSION,
} from "../../app/stark-rift/core/versions";
import { validateDataBundle } from "../../app/stark-rift/data/validation";
import { createWorkerEnvelope, validateMainToWorkerMessage } from "../../app/stark-rift/worker/messages";

describe("Stark Rift phase 0 contracts", () => {
  it("creates a versioned empty simulation and persistence envelope", () => {
    const simulation = createEmptySimulationState(42);
    const session = {
      camera: { centerX: 0, centerY: 0, zoomLevel: 1 as const },
      selection: { entityIds: [], controlGroupIds: [] },
      openPanel: null,
    };
    const saved = createPersistenceEnvelope(simulation, session, [], "checksum", "2026-11-01T00:00:00.000Z");

    expect(simulation).toMatchObject({
      schemaVersion: STARK_RIFT_SCHEMA_VERSION,
      engineVersion: STARK_RIFT_ENGINE_VERSION,
      dataVersion: STARK_RIFT_DATA_VERSION,
      seed: 42,
      tick: 0,
      phase: "setup",
    });
    expect(saved.formatVersion).toBe(STARK_RIFT_FORMAT_VERSION);
    expect(saved.simulation).toBe(simulation);
  });

  it("rejects stale and malformed worker messages with structured issues", () => {
    const stale = validateMainToWorkerMessage({
      protocolVersion: STARK_RIFT_PROTOCOL_VERSION + 1,
      messageId: 1,
      kind: "pause",
      payload: { reason: "menu" },
    });
    const unknown = validateMainToWorkerMessage({
      protocolVersion: STARK_RIFT_PROTOCOL_VERSION,
      messageId: 2,
      kind: "mutateWorld",
      payload: {},
    });
    const malformedPayload = validateMainToWorkerMessage({
      protocolVersion: STARK_RIFT_PROTOCOL_VERSION,
      messageId: 3,
      kind: "pause",
      payload: {},
    });

    expect(stale).toEqual({
      ok: false,
      issues: [expect.objectContaining({ path: "protocolVersion" })],
    });
    expect(unknown).toEqual({
      ok: false,
      issues: [expect.objectContaining({ path: "kind" })],
    });
    expect(malformedPayload).toEqual({
      ok: false,
      issues: [expect.objectContaining({ path: "payload.reason" })],
    });
  });

  it("accepts a valid command batch at the runtime boundary", () => {
    const result = validateMainToWorkerMessage({
      protocolVersion: STARK_RIFT_PROTOCOL_VERSION,
      messageId: 4,
      kind: "commandBatch",
      payload: {
        lastSeenTick: 9,
        commands: [
          {
            sequence: 1,
            issuedTick: 9,
            executeTick: 10,
            playerId: 0,
            source: "player",
            kind: "move",
            entityIds: [1, 2],
            target: { kind: "point", x: 256, y: 512 },
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects a command batch with an invalid target", () => {
    const result = validateMainToWorkerMessage({
      protocolVersion: STARK_RIFT_PROTOCOL_VERSION,
      messageId: 5,
      kind: "commandBatch",
      payload: {
        lastSeenTick: 9,
        commands: [
          {
            sequence: 1,
            issuedTick: 9,
            executeTick: 10,
            playerId: 0,
            source: "player",
            kind: "focusAttack",
            entityIds: [1],
            target: { kind: "entity", entityId: 0 },
          },
        ],
      },
    });

    expect(result).toEqual({
      ok: false,
      issues: [expect.objectContaining({ path: "payload.commands[0]" })],
    });
  });

  it("creates protocol-versioned worker responses", () => {
    expect(createWorkerEnvelope(7, "ready", { tick: 0 })).toEqual({
      protocolVersion: STARK_RIFT_PROTOCOL_VERSION,
      messageId: 7,
      kind: "ready",
      payload: { tick: 0 },
    });
  });

  it("accepts a valid data bundle and rejects duplicate definition ids", () => {
    const base = {
      schemaVersion: STARK_RIFT_SCHEMA_VERSION,
      dataVersion: "test-bundle",
      units: [{ id: "marine" }],
      buildings: [{ id: "command-center" }],
      abilities: [],
      technologies: [],
      maps: [{ id: "rift-basin" }],
    };
    expect(validateDataBundle(base).ok).toBe(true);

    const duplicate = validateDataBundle({
      ...base,
      units: [{ id: "marine" }, { id: "marine" }],
    });
    expect(duplicate).toEqual({
      ok: false,
      issues: [expect.objectContaining({ code: "duplicate_id", path: "units[1].id" })],
    });

    expect(validateDataBundle({ ...base, schemaVersion: 999 })).toEqual({
      ok: false,
      issues: [expect.objectContaining({ code: "invalid_value", path: "schemaVersion" })],
    });
  });
});
