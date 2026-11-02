import { describe, expect, it, vi } from "vitest";
import { SimulationClient, type WorkerPort } from "../../app/stark-rift/worker/client";
import { createWorkerEnvelope, type WorkerToMainMessage } from "../../app/stark-rift/worker/messages";
import { STARK_RIFT_ENGINE_VERSION } from "../../app/stark-rift/core/versions";
import { CheckpointStore } from "../../app/stark-rift/ui/checkpoints";
import { createPersistenceEnvelope, restoreSnapshot, serializeSnapshot } from "../../app/stark-rift/core/state";
import { startSimulation, stepSimulation } from "../../app/stark-rift/core/simulation";
import { createEntity, removeEntity } from "../../app/stark-rift/core/world";

function transport() {
  const handlers = new Map<string, EventListener>(); const sent: unknown[] = [];
  const terminate = vi.fn();
  const port = { postMessage: (message: unknown) => sent.push(message), terminate,
    addEventListener: (name: string, fn: EventListener) => handlers.set(name, fn),
    removeEventListener: (name: string) => handlers.delete(name),
  } as unknown as WorkerPort;
  const received: WorkerToMainMessage[] = [];
  const client = new SimulationClient(port, message => received.push(message));
  return { client, port, handlers, sent, terminate, received, emit: (data: unknown) => handlers.get("message")?.({data} as MessageEvent) };
}
const ready = () => createWorkerEnvelope(1, "ready", {tick:0,engineVersion:STARK_RIFT_ENGINE_VERSION,dataVersion:"test"});
describe("worker transport failure handling", () => {
  it.each(["error","messageerror"])("detaches a failed %s transport once", name => {
    const t=transport(); t.handlers.get(name)?.({} as Event);
    expect(t.terminate).toHaveBeenCalledTimes(1); expect(t.handlers.size).toBe(0);
    expect(t.received.at(-1)?.payload).toMatchObject({code:"WORKER_FAILED"});
    t.client.dispose(); expect(t.terminate).toHaveBeenCalledTimes(1);
  });
  it("surfaces invalid responses and cleans up even when postMessage throws", () => {
    const t=transport(); t.emit({kind:"garbage"});
    expect(t.received.at(-1)?.payload).toMatchObject({code:"INVALID_WORKER_RESPONSE"}); expect(t.handlers.size).toBe(0);
    const broken=transport(); broken.port.postMessage=()=>{throw new Error("closed channel");};
    expect(()=>broken.client.dispose()).not.toThrow(); expect(broken.terminate).toHaveBeenCalledTimes(1); expect(broken.handlers.size).toBe(0);
  });
  it("detects an unresponsive Worker and suspends pending heartbeat across background transitions", () => {
    const t=transport(); t.emit(ready()); t.client.checkHealth(1000); t.client.checkHealth(3499); expect(t.terminate).not.toHaveBeenCalled();
    t.client.suspendHealthCheck(); t.client.checkHealth(10000); expect(t.terminate).not.toHaveBeenCalled();
    t.emit(createWorkerEnvelope(2,"metrics",{tick:0,windowTicks:20,entityCount:0,pendingCommands:0}));
    t.client.checkHealth(11000); t.client.checkHealth(13500);
    expect(t.received.at(-1)?.payload).toMatchObject({code:"WORKER_TIMEOUT"}); expect(t.terminate).toHaveBeenCalledTimes(1);
  });
  it("does not replay a same-tick snapshot but returns every received buffer", () => {
    const t=transport(); const packet={bufferId:1,tick:2,previousTick:1,viewerPlayerId:0,widthTiles:1,heightTiles:1,entities:[],visibility:new Uint8Array(1)};
    t.emit(createWorkerEnvelope(1,"renderSnapshot",packet)); t.emit(createWorkerEnvelope(2,"renderSnapshot",{...packet,bufferId:2}));
    expect(t.received).toHaveLength(1); expect(t.sent).toHaveLength(2);
    t.emit(createWorkerEnvelope(3,"snapshotLoaded",{tick:0}));
    t.emit(createWorkerEnvelope(4,"renderSnapshot",{...packet,tick:0,previousTick:0,bufferId:3})); expect(t.received).toHaveLength(3);
    t.client.dispose();
  });
});
const makeState=()=>startSimulation(1,"rift-basin","fixture",[0,1].map(id=>({id,faction:"terran",minerals:50,gas:0,supplyUsedHalf:0,supplyCapHalf:20})));
const session={camera:{centerX:100,centerY:100,zoomLevel:1 as const},selection:{entityIds:[],controlGroupIds:[]},openPanel:null};
describe("checkpoint and entity reference isolation", () => {
  it("keeps a private recovery copy when callers mutate received snapshots", () => {
    const store=new CheckpointStore(); const snapshot=createPersistenceEnvelope(makeState(),session,[],"2026-11-02T00:00:00.000Z");
    expect(store.save(snapshot)).toBe(true); snapshot.simulation.tick=100;
    const copy=store.read()!; copy.simulation.tick=200;
    expect(store.read()?.simulation.tick).toBe(0); expect(store.save({})).toBe(false); expect(store.read()?.simulation.tick).toBe(0);
    expect(()=>restoreSnapshot(serializeSnapshot(store.read()!))).not.toThrow(); store.clear(); expect(store.read()).toBeNull();
  });
  it("clears the entire movement order when its tracked target is removed", () => {
    const state=makeState(); for(let i=0;i<2;i++) createEntity(state,{owner:i,definitionId:"test",x:256,y:256,health:10});
    Object.assign(state.movement[0],{order:"focusAttack",target:{x:512,y:512},targetEntityId:2,path:[{x:512,y:512}],status:"moving",remainderX:3});
    removeEntity(state,2); expect(state.movement[0]).toMatchObject({order:"idle",target:null,targetEntityId:null,path:[],pathIndex:0,remainderX:0});
    expect(()=>stepSimulation(state)).not.toThrow(); expect(state.phase).toBe("running");
  });
});
