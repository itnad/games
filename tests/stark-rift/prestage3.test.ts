import { describe, expect, it } from "vitest";
import { startSimulation, enqueueCommand, stepSimulation, SimulationFault, type EngineRules } from "../../app/stark-rift/core/simulation";
import { createEntity, removeEntity } from "../../app/stark-rift/core/world";
import { checksum } from "../../app/stark-rift/core/checksum";
import { createPersistenceEnvelope, restoreSnapshot, serializeSnapshot, validatePersistenceEnvelope } from "../../app/stark-rift/core/state";
import { GestureMachine, type HitTarget } from "../../app/stark-rift/input/gesture-machine";
import { getRuntimeMap, createRiftBasin } from "../../app/stark-rift/data/maps";
import { validateDataBundle } from "../../app/stark-rift/data/validation";
import { STARK_RIFT_PROTOCOL_VERSION, STARK_RIFT_SCHEMA_VERSION } from "../../app/stark-rift/core/versions";
import { SimulationRuntime } from "../../app/stark-rift/worker/runtime";
import type { WorkerToMainMessage } from "../../app/stark-rift/worker/messages";

const players = [0, 1].map(id => ({ id, faction: "terran" as const, minerals: 50, gas: 0, supplyUsedHalf: 0, supplyCapHalf: 20 }));
const session = { camera: { centerX: 100, centerY: 100, zoomLevel: 1 as const }, selection: { entityIds: [], controlGroupIds: [] }, openPanel: null };
const registry = getRuntimeMap("rift-basin");
const make = () => startSimulation(1, registry.map.id, registry.dataVersion, players);
const command = { sequence: 1, issuedTick: 0, executeTick: 1, playerId: 0, source: "player", kind: "move", entityIds: [1], target: { kind: "point", x: 512, y: 512 } };
const wire = (kind: string, payload: unknown) => ({ protocolVersion: STARK_RIFT_PROTOCOL_VERSION, messageId: 1, kind, payload });
const init = { seed: 1, mapId: registry.map.id, dataVersion: registry.dataVersion, players: players.map((p, i) => ({ id: p.id, faction: p.faction, controller: i === 0 ? "human" : "ai" })) };
describe("failed tick containment", () => {
  it.each(["command", "system", "invalid_state"])("restores all deterministic state after a %s fault", kind => {
    const state = make(); createEntity(state, { owner: 0, definitionId: "fixture", x: 256, y: 256, health: 10 });
    const mutate = () => { state.entities.x[0] = 999; state.rngStreams[0].words[0]++; if (kind === "invalid_state") state.entities.health[0] = -1; else throw new Error("fault"); };
    const rules: EngineRules = { commands: { move: { policy: "atomic", validate: () => null, apply: kind === "command" ? mutate : () => {} } }, systems: { movement: kind === "command" ? () => {} : mutate } };
    enqueueCommand(state, command, rules); const checkpoint = structuredClone(state);
    expect(() => stepSimulation(state, rules)).toThrow(SimulationFault);
    expect(state).toEqual({ ...checkpoint, phase: "paused" });
    expect(state.commandState.pending).toHaveLength(1); expect(state.tick).toBe(0);
    expect(stepSimulation(state, rules)).toEqual([]);
  });
});
describe("persistent group/movement contracts", () => {
  function populated() { const state = make(); for (let i = 0; i < 2; i++) createEntity(state, { owner: 0, definitionId: "fixture", x: 256 + i, y: 256, health: 10 }); return state; }
  it("round-trips groups, path cursor and signed remainders", () => {
    const state = populated(); state.players[0].controlGroups[0].entityIds = [1, 2];
    Object.assign(state.movement[0], { order: "move", target: { x: 512, y: 512 }, path: [{ x: 256, y: 256 }, { x: 512, y: 512 }], pathIndex: 1, status: "moving", remainderX: -3, remainderY: 5 });
    const saved = createPersistenceEnvelope(state, session, [], "2026-11-02T00:00:00.000Z");
    expect(checksum(restoreSnapshot(serializeSnapshot(saved)).simulation)).toBe(checksum(state));
    removeEntity(state, 1); expect(state.players[0].controlGroups[0].entityIds).toEqual([2]); expect(state.movement.map(m => m.entityId)).toEqual([2]);
  });
  it.each(["duplicate_group", "foreign_owner", "wrong_type", "path_cursor", "remainder"])("rejects invalid persisted %s", invalid => {
    const state = populated(); state.players[0].controlGroups[0].entityIds = [1, 2];
    if (invalid === "duplicate_group") state.players[0].controlGroups[1].entityIds = [1];
    if (invalid === "foreign_owner") state.entities.owner[1] = 1;
    if (invalid === "wrong_type") state.entities.definitionId[1] = "other";
    if (invalid === "path_cursor") state.movement[0].pathIndex = 10;
    if (invalid === "remainder") state.movement[0].remainderX = 20;
    expect(() => createPersistenceEnvelope(state, session, [], "2026-11-02T00:00:00.000Z")).toThrow();
  });
});
describe("unified gesture arbitration", () => {
  function gestures(hit: HitTarget | null) {
    const events: string[] = [];
    const machine = new GestureMachine({ hitTest: () => hit, tap: () => events.push("tap"), group: () => events.push("group"), preview: v => { if (v) events.push("preview"); }, swipe: (_h, _p, attack) => events.push(attack ? "attack" : "move"), pan: () => events.push("pan"), pinch: () => events.push("pinch"), pinchEnd: () => events.push("pinchEnd") });
    return { machine, events };
  }
  it("separates tap/hold/swipe/pan, including worker movement", () => {
    for (const kind of ["combat", "worker"] as const) {
      const {machine, events} = gestures({ entityId: 1, kind });
      machine.down(1, {x: 0, y: 0}, 0); machine.up(1, 200); expect(events).toEqual(["tap"]); events.length = 0;
      machine.down(1, {x: 0, y: 0}, 0); machine.advance(300); machine.up(1, 400); expect(events).toEqual(["preview", "group"]); events.length = 0;
      machine.down(1, {x: 0, y: 0}, 0); machine.move(1, {x: 20, y: 0}); machine.up(1, 100); expect(events).toEqual([kind === "combat" ? "attack" : "move"]);
    }
    const {machine, events} = gestures(null); machine.down(1, {x: 0,y: 0},0); machine.move(1,{x: 10,y: 0}); machine.up(1,100); expect(events).toEqual(["pan"]);
  });
  it("cancels selection on pinch/cancel and ignores a third finger", () => {
    const {machine, events} = gestures({entityId: 1,kind: "combat"});
    machine.down(1,{x: 0,y: 0},0); machine.down(2,{x: 20,y: 0},20); machine.down(3,{x: 40,y: 0},30);
    machine.move(2,{x: 30,y: 0}); machine.up(3,100); machine.up(2,100); machine.up(1,200);
    expect(events).toEqual(["pinch","pinchEnd"]); events.length=0;
    machine.down(1,{x: 0,y: 0},0); machine.cancel(); machine.up(1,400); expect(events).toEqual([]);
  });
});
describe("map bundle integration", () => {
  it("accepts the actual tactical map with a stable map version", () => {
    expect(getRuntimeMap("rift-basin").dataVersion).toBe(registry.dataVersion);
    const result = validateDataBundle({ schemaVersion: STARK_RIFT_SCHEMA_VERSION, dataVersion: registry.dataVersion, source: { game: "Brood War", version: "1.16.1", reference: "contract fixture", tickRate: 20, timeScale: { numerator: 1, denominator: 2 } }, units: [], buildings: [], abilities: [], technologies: [], maps: [createRiftBasin()] });
    expect(result.ok).toBe(true);
    expect(() => getRuntimeMap("unknown")).toThrow();
  });
});
describe("runtime integration and flow control", () => {
  function runtime(rules?: EngineRules) { const messages: WorkerToMainMessage[] = []; const runtime = new SimulationRuntime({ emit: m => messages.push(m), rules }); runtime.receive(wire("init", init)); return {runtime,messages}; }
  it("updates command controls on pause/resume without advancing a tick or releasing render buffers", () => {
    const {runtime:r,messages}=runtime();
    r.advance(50); r.advance(50); // Fill both render slots, then change phase at the same tick.
    const renderCount=messages.filter(m=>m.kind==="renderSnapshot").length;
    for(const phase of ["paused","running","paused"] as const){
      const before=messages.length;
      r.receive(wire(phase==="paused"?"pause":"resume",{reason:"user"}));
      expect(messages.slice(before).filter(m=>m.kind==="uiState").map(m=>m.payload)).toEqual([
        expect.objectContaining({tick:2,phase}),
      ]);
      expect(messages.filter(m=>m.kind==="renderSnapshot")).toHaveLength(renderCount);
    }
    r.advance(500);
    r.receive(wire("debugMetrics",{windowTicks:20}));
    expect(messages.at(-1)?.payload).toMatchObject({tick:2});
  });
  it("ticks, bounds in-flight snapshots, publishes latest on release and does not loop at the same tick", () => {
    const {runtime: r,messages} = runtime(); r.advance(50); r.advance(50);
    expect(messages.filter(m=>m.kind==="renderSnapshot")).toHaveLength(2);
    r.receive(wire("releaseRenderBuffer",{bufferId:1}));
    const renders = messages.filter(m=>m.kind==="renderSnapshot"); expect(renders).toHaveLength(3); expect(renders[2].payload.tick).toBe(2);
    r.receive(wire("releaseRenderBuffer",{bufferId:2})); expect(messages.filter(m=>m.kind==="renderSnapshot")).toHaveLength(3);
  });
  it("saves actual session data, pauses on load and restores the queued state", () => {
    const {runtime:r,messages} = runtime(); r.advance(100); r.receive(wire("saveSnapshot",{requestId:1,session}));
    const saved=messages.find(m=>m.kind==="saveSnapshotReady"); if(saved?.kind!=="saveSnapshotReady") throw new Error("missing save");
    expect(saved.payload.snapshot.session).toEqual(session); expect(validatePersistenceEnvelope(saved.payload.snapshot).ok).toBe(true);
    r.advance(100); r.receive(wire("loadSnapshot",{snapshot:saved.payload.snapshot}));
    expect(messages.findLast(m=>m.kind==="phaseChanged")?.payload).toEqual({tick:2,phase:"paused"});
    r.receive(wire("resume",{reason:"user"})); r.advance(50); r.receive(wire("debugMetrics",{windowTicks:20}));
    expect(messages.findLast(m=>m.kind==="metrics")?.payload).toMatchObject({tick:3});
  });
  it("rejects wrong map versions, forged players and commands after disposal", () => {
    const emitted: WorkerToMainMessage[]=[]; const r=new SimulationRuntime({emit:m=>emitted.push(m)});
    r.receive(wire("init",{...init,dataVersion:"wrong"})); expect(emitted.at(-1)?.kind).toBe("fatalError");
    r.receive(wire("init",init)); r.receive(wire("commandBatch",{commands:[{...command,playerId:1}],lastSeenTick:0}));
    expect(emitted.at(-1)?.payload).toMatchObject({accepted:false,code:"not_owner"});
    r.receive(wire("dispose",{})); const count=emitted.length; r.advance(100); r.receive(wire("init",init)); expect(emitted).toHaveLength(count);
  });
  it("latches a tick fault until a verified checkpoint is loaded", () => {
    const rules: EngineRules={systems:{movement:()=>{throw new Error("fault");}}};
    const {runtime:r,messages}=runtime(rules); r.receive(wire("saveSnapshot",{requestId:1}));
    const saved=messages.find(m=>m.kind==="saveSnapshotReady"); if(saved?.kind!=="saveSnapshotReady") throw new Error("save missing");
    r.advance(50); expect(messages.at(-1)?.payload).toMatchObject({code:"SIMULATION_FAULT"});
    r.receive(wire("resume",{reason:"user"})); expect(messages.at(-1)?.payload).toMatchObject({code:"RESTORE_REQUIRED"});
    r.receive(wire("saveSnapshot",{requestId:2})); expect(messages.at(-1)?.payload).toMatchObject({code:"RESTORE_REQUIRED"});
    r.receive(wire("loadSnapshot",{snapshot:saved.payload.snapshot})); r.receive(wire("resume",{reason:"user"})); expect(messages.at(-1)?.payload).toMatchObject({phase:"running"});
  });
});
