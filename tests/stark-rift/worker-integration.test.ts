import { afterAll, beforeAll, expect, it } from "vitest";
import { build } from "vite";
import { Worker } from "node:worker_threads";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getRuntimeMap } from "../../app/stark-rift/data/maps";
import { SimulationClient, type WorkerPort } from "../../app/stark-rift/worker/client";
import type { WorkerToMainMessage } from "../../app/stark-rift/worker/messages";

let directory = "";
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "stark-worker-"));
  await build({configFile:false,logLevel:"silent",build:{outDir:directory,emptyOutDir:false,lib:{entry:"app/stark-rift/worker/simulation.worker.ts",formats:["es"],fileName:()=>"simulation.mjs"}}});
  await writeFile(join(directory,"bridge.mjs"), `import {parentPort} from 'node:worker_threads';
globalThis.postMessage=(data,transfer)=>parentPort.postMessage(data,transfer);
globalThis.close=()=>parentPort.close();
await import(${JSON.stringify(pathToFileURL(join(directory,"simulation.mjs")).href)});
parentPort.on('message',data=>globalThis.onmessage({data}));`);
});
afterAll(async()=>{ if(directory) await rm(directory,{recursive:true,force:true}); });
it("runs the built browser Worker entry through real isolated message/transfer channels", async () => {
  const worker = new Worker(pathToFileURL(join(directory,"bridge.mjs")));
  const wrappers = new Map<unknown,(data:unknown)=>void>();
  const port = {
    postMessage:(data:unknown)=>worker.postMessage(data), terminate:()=>{void worker.terminate();},
    addEventListener:(kind:string, callback:(event:unknown)=>void)=>{ const wrapped=(data:unknown)=>callback(kind==="message"?{data}:data); wrappers.set(callback,wrapped); worker.on(kind==="messageerror"?"messageerror":kind,wrapped); },
    removeEventListener:(kind:string, callback:unknown)=>{ const wrapped=wrappers.get(callback); if(wrapped) worker.off(kind,wrapped); },
  } as unknown as WorkerPort;
  const messages:WorkerToMainMessage[]=[];
  const client = new SimulationClient(port, message=>messages.push(message));
  async function waitFor(predicate:(message:WorkerToMainMessage)=>boolean) {
    const start=Date.now();
    while(Date.now()-start<4000) { const found=messages.findLast(predicate); if(found) return found; await new Promise(resolve=>setTimeout(resolve,10)); }
    throw new Error("Worker response timeout: "+messages.map(m=>m.kind).join(","));
  }
  try {
    const registered=getRuntimeMap("rift-basin");
    client.send("init",{seed:1,mapId:registered.map.id,dataVersion:registered.dataVersion,players:[{id:0,faction:"terran",controller:"human"},{id:1,faction:"zerg",controller:"ai"}]});
    await waitFor(m=>m.kind==="ready");
    const rendered=await waitFor(m=>m.kind==="renderSnapshot"&&m.payload.tick>=2);
    if(rendered.kind!=="renderSnapshot") throw new Error("snapshot missing");
    expect(rendered.payload.visibility).toBeInstanceOf(Uint8Array); expect(rendered.payload.visibility.length).toBe(96*96);
    client.send("pause",{reason:"test"}); await waitFor(m=>m.kind==="phaseChanged"&&m.payload.phase==="paused");
    client.send("saveSnapshot",{requestId:7}); const saved=await waitFor(m=>m.kind==="saveSnapshotReady"&&m.payload.requestId===7);
    if(saved.kind!=="saveSnapshotReady") throw new Error("save missing");
    client.send("loadSnapshot",{snapshot:saved.payload.snapshot}); await waitFor(m=>m.kind==="snapshotLoaded");
    client.send("resume",{reason:"test"}); await waitFor(m=>m.kind==="phaseChanged"&&m.payload.phase==="running");
    client.send("dispose",{}); await waitFor(m=>m.kind==="disposed");
    expect(messages.filter(m=>m.kind==="fatalError")).toEqual([]);
  } finally {client.dispose();await worker.terminate();}
},10000);

it("restores a verified checkpoint into a new Worker after the old Worker is terminated", async()=>{
  async function boot(){
    const worker=new Worker(pathToFileURL(join(directory,"bridge.mjs")));const messages:WorkerToMainMessage[]=[];let id=0;
    worker.on("message",(message:WorkerToMainMessage)=>messages.push(message));
    const {STARK_RIFT_PROTOCOL_VERSION}=await import("../../app/stark-rift/core/versions");
    const send=(kind:string,payload:unknown)=>worker.postMessage({protocolVersion:STARK_RIFT_PROTOCOL_VERSION,messageId:++id,kind,payload});
    const wait=async(predicate:(m:WorkerToMainMessage)=>boolean)=>{for(let i=0;i<400;i++){const m=messages.findLast(predicate);if(m)return m;await new Promise(r=>setTimeout(r,10));}throw new Error("Recovery timeout");};
    const registered=getRuntimeMap("rift-basin");send("init",{seed:1,mapId:registered.map.id,dataVersion:registered.dataVersion,players:[{id:0,faction:"terran",controller:"human"},{id:1,faction:"zerg",controller:"ai"}]});
    await wait(m=>m.kind==="ready");return {worker,send,wait,messages};
  }
  const original=await boot();let recovered:Awaited<ReturnType<typeof boot>>|undefined;
  try{
    original.send("pause",{reason:"checkpoint"});await original.wait(m=>m.kind==="phaseChanged");
    original.send("saveSnapshot",{requestId:1});const save=await original.wait(m=>m.kind==="saveSnapshotReady");
    if(save.kind!=="saveSnapshotReady")throw new Error("Save missing");
    await original.worker.terminate();recovered=await boot();
    recovered.send("loadSnapshot",{snapshot:save.payload.snapshot});const loaded=await recovered.wait(m=>m.kind==="snapshotLoaded");
    expect(loaded.payload).toEqual({tick:save.payload.snapshot.simulation.tick});
    recovered.send("resume",{reason:"recovered"});await recovered.wait(m=>m.kind==="phaseChanged"&&m.payload.phase==="running");
    recovered.send("debugMetrics",{windowTicks:20});await recovered.wait(m=>m.kind==="metrics");
    expect(recovered.messages.filter(m=>m.kind==="fatalError")).toEqual([]);
  }finally{await original.worker.terminate();await recovered?.worker.terminate();}
},10000);

it.each([
  ['terran','terran-ghost','cloak','cloaked'],
  ['terran','terran-wraith','cloak','cloaked'],
  ['terran','terran-siege-tank-tank-mode','siege-mode','sieged'],
  ['zerg','zerg-hydralisk','burrow','burrowed'],
  ['zerg','zerg-lurker','burrow','burrowed'],
] as const)('built production Worker forwards %s %s ability %s through the complete rule stack',async(race,definition,ability,expected)=>{
  const worker=new Worker(pathToFileURL(join(directory,'bridge.mjs'))),messages:WorkerToMainMessage[]=[];let messageId=0;
  const {STARK_RIFT_PROTOCOL_VERSION}=await import('../../app/stark-rift/core/versions');
  const send=(kind:string,payload:unknown)=>worker.postMessage({protocolVersion:STARK_RIFT_PROTOCOL_VERSION,messageId:++messageId,kind,payload});
  worker.on('message',(m:WorkerToMainMessage)=>{messages.push(m);if(m.kind==='renderSnapshot')send('releaseRenderBuffer',{bufferId:m.payload.bufferId});});
  const wait=async(predicate:(m:WorkerToMainMessage)=>boolean)=>{const until=Date.now()+6000;while(Date.now()<until){const m=messages.findLast(predicate);if(m)return m;await new Promise(r=>setTimeout(r,10));}throw new Error('Ability Worker timeout: '+JSON.stringify(messages.filter(m=>['commandAck','fatalError'].includes(m.kind))));};
  try{
    const {map,dataVersion}=getRuntimeMap('rift-basin');send('init',{seed:42,mapId:map.id,dataVersion,scenario:'special-practice',players:[{id:0,faction:race,controller:'human'},{id:1,faction:'protoss',controller:'ai'}]});await wait(m=>m.kind==='ready');
    send('pause',{reason:'ability setup'});await wait(m=>m.kind==='phaseChanged'&&m.payload.phase==='paused');send('saveSnapshot',{requestId:91});const saved=await wait(m=>m.kind==='saveSnapshotReady'&&m.payload.requestId===91);if(saved.kind!=='saveSnapshotReady')throw Error('save');
    const s=saved.payload.snapshot.simulation,actor=s.entities.id.find((id,i)=>s.entities.owner[i]===0&&s.entities.definitionId[i]===definition)!;expect(actor).toBeDefined();const tick=s.tick;
    send('resume',{reason:'ability test'});send('commandBatch',{lastSeenTick:tick,commands:[{kind:'toggleStateAbility',entityIds:[actor],payload:{abilityId:ability,enabled:true},sequence:1,issuedTick:tick,executeTick:tick+3,playerId:0,source:'player'}]});
    const ack=await wait(m=>m.kind==='commandAck'&&m.payload.sequence===1);if(ack.kind!=='commandAck')throw Error('ack');expect(ack.payload.accepted).toBe(true);
    await wait(m=>m.kind==='renderSnapshot'&&m.payload.entities.some(e=>e.id===actor&&(expected==='sieged'?e.definitionId==='terran-siege-tank-siege-mode':expected==='cloaked'?e.cloaked===true:e.burrowed===true)));
    expect(messages.filter(m=>m.kind==='fatalError')).toEqual([]);
  }finally{send('dispose',{});await worker.terminate();}
},15000);


it('built production Worker morphs Hydralisks and saves paid egg reservations', async () => {
  const worker=new Worker(pathToFileURL(join(directory,'bridge.mjs'))), messages:WorkerToMainMessage[]=[];let messageId=0;
  const {STARK_RIFT_PROTOCOL_VERSION}=await import('../../app/stark-rift/core/versions');
  const send=(kind:string,payload:unknown)=>worker.postMessage({protocolVersion:STARK_RIFT_PROTOCOL_VERSION,messageId:++messageId,kind,payload});
  worker.on('message',(m:WorkerToMainMessage)=>{messages.push(m);if(m.kind==='renderSnapshot')send('releaseRenderBuffer',{bufferId:m.payload.bufferId});});
  const wait=async(predicate:(m:WorkerToMainMessage)=>boolean)=>{const until=Date.now()+6000;while(Date.now()<until){const m=messages.findLast(predicate);if(m)return m;await new Promise(r=>setTimeout(r,10));}throw new Error('Morph Worker timeout');};
  try {
    const {map,dataVersion}=getRuntimeMap('rift-basin');send('init',{seed:42,mapId:map.id,dataVersion,scenario:'special-practice',players:[{id:0,faction:'zerg',controller:'human'},{id:1,faction:'protoss',controller:'ai'}]});await wait(m=>m.kind==='ready');
    const first=await wait(m=>m.kind==='renderSnapshot');if(first.kind!=='renderSnapshot')throw Error('render');const ids=first.payload.entities.filter(e=>e.owner===0&&e.definitionId==='zerg-hydralisk').map(e=>e.id), tick=first.payload.tick, supply=first.payload.economy!.supplyUsedHalf;
    send('commandBatch',{lastSeenTick:tick,commands:[{kind:'morphUnit',entityIds:ids,payload:{unitId:'zerg-lurker'},sequence:1,issuedTick:tick,executeTick:tick+3,playerId:0,source:'player'}]});
    const ack=await wait(m=>m.kind==='commandAck'&&m.payload.sequence===1);if(ack.kind!=='commandAck')throw Error('ack');expect(ack.payload.accepted).toBe(true);
    await wait(m=>m.kind==='renderSnapshot'&&ids.every(id=>m.payload.entities.some(e=>e.id===id&&e.unitMorph)));
    send('pause',{reason:'morph checkpoint'});await wait(m=>m.kind==='phaseChanged'&&m.payload.phase==='paused');send('saveSnapshot',{requestId:92});const saved=await wait(m=>m.kind==='saveSnapshotReady'&&m.payload.requestId===92);if(saved.kind!=='saveSnapshotReady')throw Error('save');
    expect(saved.payload.snapshot.simulation.lurker!.morphs).toHaveLength(2);expect(saved.payload.snapshot.simulation.players[0].gas).toBe(0);expect(saved.payload.snapshot.simulation.players[0].supplyUsedHalf).toBe(supply+4);expect(messages.filter(m=>m.kind==='fatalError')).toEqual([]);
  } finally {send('dispose',{});await worker.terminate();}
},15000);
