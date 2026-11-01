import { describe, expect, it } from "vitest";
import { checksum, xxhash32, canonicalJson } from "../../app/stark-rift/core/checksum";
import { FixedTickClock } from "../../app/stark-rift/core/clock";
import { add, integrate, multiplyDivide } from "../../app/stark-rift/core/fixed-point";
import { createRngStreams, nextUint32 } from "../../app/stark-rift/core/rng";
import { enqueueCommand, startSimulation, stepSimulation, SYSTEM_ORDER, type EngineRules } from "../../app/stark-rift/core/simulation";
import { createPersistenceEnvelope, restoreSnapshot, serializeSnapshot, validatePersistenceEnvelope } from "../../app/stark-rift/core/state";
import { createEntity, removeEntity } from "../../app/stark-rift/core/world";

const players = [0, 1].map(id => ({ id, faction: "terran" as const, minerals: 50, gas: 0, supplyUsedHalf: 0, supplyCapHalf: 20 }));
const session = { camera: { centerX: 0, centerY: 0, zoomLevel: 1 as const }, selection: { entityIds: [], controlGroupIds: [] }, openPanel: null };
const makeState = () => startSimulation(42, "fixture-map", "fixture-data", players);
const move = (sequence = 1, executeTick = 3) => ({ sequence, issuedTick: 0, executeTick, playerId: 0, source: "player", kind: "move", entityIds: [1], target: { kind: "point", x: 123, y: -456 } });
// Test-only rule systems exercise scheduling/RNG/state. These are not gameplay movement rules.
const rules: EngineRules = {
  commands: { move: {
    policy: "partial", validate: () => null,
    apply: (state, command, ids) => {
      if (command.kind !== "move") throw new Error("Unexpected command.");
      for (const id of ids) { const index = state.entities.id.indexOf(id); state.entities.x[index] = command.target.x; state.entities.y[index] = command.target.y; }
    },
  } },
  systems: { movement: state => {
    for (let i = 0; i < state.entities.id.length; i++) {
      state.entities.x[i] = add(state.entities.x[i], nextUint32(state.rngStreams, "rules") % 3 - 1);
      state.entities.y[i] = add(state.entities.y[i], nextUint32(state.rngStreams, "combat") % 3 - 1);
    }
  } },
};
function populated() {
  const state = makeState();
  for (let i = 0; i < 10; i++) createEntity(state, { owner: i % 2, definitionId: "fixture", x: i * 256, y: 0, health: 100 });
  expect(enqueueCommand(state, move(), rules).ok).toBe(true);
  expect(enqueueCommand(state, move(2, 9000), rules).ok).toBe(true);
  return state;
}
describe("integer math and external clock", () => {
  it("preserves signed fractions, uses exact intermediate arithmetic and rejects overflow", () => {
    for (const sign of [1, -1]) {
      let remainder = 0, distance = 0;
      for (let i = 0; i < 20; i++) { const step = integrate(sign, remainder); remainder = step.remainder; distance += step.delta; }
      expect(distance).toBe(sign); expect(remainder).toBe(0);
    }
    expect(multiplyDivide(Number.MAX_SAFE_INTEGER, 256, 256)).toBe(Number.MAX_SAFE_INTEGER);
    expect(multiplyDivide(-7, 1, 2)).toBe(-3);
    expect(() => add(Number.MAX_SAFE_INTEGER, 1)).toThrow(RangeError);
    expect(() => multiplyDivide(1, 1, 0)).toThrow(RangeError);
  });
  it("keeps catch-up backlog and clears it on pause without advancing the simulation", () => {
    const clock = new FixedTickClock(); let ticks = 0;
    expect(clock.advance(525, () => { ticks++; return true; })).toBe(5);
    expect(clock.pendingMs).toBe(275);
    clock.advance(0, () => { ticks++; return true; }); expect(ticks).toBe(10);
    expect(clock.pendingMs).toBe(25);
    clock.advance(100, () => false); expect(clock.pendingMs).toBe(0);
    expect(() => clock.advance(-1, () => true)).toThrow(RangeError);
  });
});
describe("reference algorithms", () => {
  it.each([["", "02cc5d05"], ["a", "550d7456"], ["abc", "32d153ff"], ["message digest", "7c948494"], ["abcdefghijklmnopqrstuvwxyz", "63a14d5f"]])("matches xxHash32 vector %s", (input, expected) => {
    expect(xxhash32(new TextEncoder().encode(input))).toBe(expected);
  });
  it("matches xoshiro128** and separates random streams", () => {
    const stream = [{ id: "combat" as const, algorithm: "xoshiro128ss-v1", words: [1, 2, 3, 4] }];
    expect(nextUint32(stream, "combat")).toBe(11520);
    expect(nextUint32(stream, "combat")).toBe(0);
    const a = createRngStreams(0), b = createRngStreams(0);
    for (let i = 0; i < 100; i++) nextUint32(a, "ai");
    expect(nextUint32(a, "combat")).toBe(nextUint32(b, "combat"));
  });
  it("ignores object insertion order and rejects non-canonical values", () => {
    expect(checksum({ b: 2, a: 1 })).toBe(checksum({ a: 1, b: 2 }));
    expect(() => canonicalJson({ bad: NaN })).toThrow(TypeError);
  });
});
describe("world and command scheduling", () => {
  it("never reuses IDs after deletion and retains aligned columns", () => {
    const state = populated(); removeEntity(state, 2);
    const id = createEntity(state, { owner: 0, definitionId: "fixture", x: 0, y: 0, health: 1 });
    expect(id).toBe(11); expect(state.entities.id).not.toContain(2);
    expect(new Set(Object.values(state.entities).map(column => column.length)).size).toBe(1);
  });
  it("rejects duplicate, stale and unsupported commands without mutating state", () => {
    const state = populated(), before = checksum(state);
    expect(enqueueCommand(state, move(), rules)).toEqual({ ok: false, code: "duplicate_sequence" });
    expect(enqueueCommand(state, { ...move(3), kind: "hold", target: undefined }, rules).ok).toBe(false);
    expect(checksum(state)).toBe(before);
  });
  it("revalidates ownership at execution and applies partial/atomic policy", () => {
    for (const policy of ["partial", "atomic"] as const) {
      const state = makeState();
      createEntity(state, { owner: 0, definitionId: "fixture", x: 0, y: 0, health: 100 });
      createEntity(state, { owner: 1, definitionId: "fixture", x: 0, y: 0, health: 100 });
      const local: EngineRules = { commands: { move: { ...rules.commands!.move!, policy } } };
      enqueueCommand(state, { ...move(), entityIds: [2, 1] }, local);
      stepSimulation(state, local); stepSimulation(state, local);
      const [result] = stepSimulation(state, local);
      expect(result.accepted).toBe(policy === "partial");
      expect(state.entities.x).toEqual(policy === "partial" ? [123, 0] : [0, 0]);
    }
  });
  it("orders commands by tick/player/sequence and calls systems in design order", () => {
    const state = populated(); const trace: string[] = [];
    const commandsOnly: EngineRules = { commands: { move: { ...rules.commands!.move!, apply: (_s, command) => { trace.push(`${command.playerId}:${command.sequence}`); } } } };
    enqueueCommand(state, { ...move(1), playerId: 1, entityIds: [2] }, commandsOnly);
    stepSimulation(state, commandsOnly); stepSimulation(state, commandsOnly); stepSimulation(state, commandsOnly);
    expect(trace).toEqual(["0:1", "1:1"]);
    trace.length = 0;
    stepSimulation(state, { systems: Object.fromEntries(SYSTEM_ORDER.filter(n => n !== "commands").map(n => [n, () => trace.push(n)])) });
    expect(trace).toEqual(SYSTEM_ORDER.slice(1));
  });
  it("pauses and ends without running additional systems", () => {
    const state = makeState(); state.phase = "paused";
    expect(stepSimulation(state)).toEqual([]); expect(state.tick).toBe(0);
    state.phase = "running";
    enqueueCommand(state, { sequence: 1, issuedTick: 0, executeTick: 1, playerId: 0, source: "player", kind: "surrender", entityIds: [] });
    stepSimulation(state); expect(state.phase).toBe("finished"); expect(state.outcome?.winnerPlayerId).toBe(1);
    stepSimulation(state); expect(state.tick).toBe(1);
  });
});
describe("stage 1 completion gates", () => {
  it("repeats 10,000 nontrivial ticks identically and resumes a mid-run save including future commands", () => {
    const a = populated(), b = populated();
    let restored = populated();
    for (let tick = 1; tick <= 10000; tick++) {
      stepSimulation(a, rules); stepSimulation(b, rules); stepSimulation(restored, rules);
      if (tick === 4300) {
        const saved = createPersistenceEnvelope(restored, session, [], "2026-11-01T00:00:00.000Z");
        restored = restoreSnapshot(serializeSnapshot(saved)).simulation;
        expect(restored.commandState.pending).toHaveLength(1);
        expect(enqueueCommand(restored, move(2, 9999), rules).ok).toBe(false);
      }
      if (tick % 100 === 0) { expect(checksum(a)).toBe(checksum(b)); expect(checksum(a)).toBe(checksum(restored)); }
    }
    expect(a.tick).toBe(10000); expect(a.commandState.pending).toHaveLength(0);
    expect(a.entities.x[0]).not.toBe(0);
  });
  it("rejects tampered snapshots and invalid owners even with a recalculated checksum", () => {
    const saved = createPersistenceEnvelope(populated(), session, [], "2026-11-01T00:00:00.000Z");
    saved.simulation.entities.health[0]--;
    expect(() => restoreSnapshot(JSON.stringify(saved))).toThrow(TypeError);
    saved.simulation.entities.owner[0] = 999; saved.checksum = checksum(saved.simulation);
    expect(validatePersistenceEnvelope(saved).ok).toBe(false);
  });
  it("keeps session camera state outside the simulation checksum", () => {
    const state = populated(); const a = createPersistenceEnvelope(state, session, [], "2026-11-01T00:00:00.000Z");
    const b = createPersistenceEnvelope(state, { ...session, camera: { ...session.camera, centerX: 100 } }, [], "2026-11-01T00:00:00.000Z");
    expect(a.checksum).toBe(b.checksum);
  });
});
