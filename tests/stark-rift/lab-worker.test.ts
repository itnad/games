import {it,expect} from 'vitest';
import {build} from 'vite';
import {Worker,MessageChannel} from 'node:worker_threads';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {SimulationClient,type WorkerPort} from '../../app/stark-rift/worker/client';
import type {WorkerToMainMessage} from '../../app/stark-rift/worker/messages';
import type {TimingWindow} from '../../app/stark-rift/diagnostics/profiler';
import {createScenario,scenarioEnvelope} from '../../tools/stark-rift-lab/scenarios';
it('runs the lab Worker with fixtures, standard game messages and a separate metrics port',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'stark-lab-worker-'));let worker:Worker|undefined;
  const channel=new MessageChannel(),messages:WorkerToMainMessage[]=[],samples:ReturnType<TimingWindow['read']>[]=[];
  let client:SimulationClient|undefined;
  try{
    await build({configFile:false,logLevel:'silent',build:{outDir:directory,emptyOutDir:false,lib:{entry:'tools/stark-rift-lab/lab.worker.ts',formats:['es'],fileName:()=> 'lab.mjs'}}});
    await writeFile(join(directory,'bridge.mjs'),`import {parentPort} from 'node:worker_threads';globalThis.postMessage=(data,transfer)=>parentPort.postMessage(data,transfer);globalThis.close=()=>parentPort.close();await import(${JSON.stringify(pathToFileURL(join(directory,'lab.mjs')).href)});parentPort.on('message',data=>globalThis.onmessage({data}));`);
    worker=new Worker(pathToFileURL(join(directory,'bridge.mjs')));
    const wrappers=new Map<unknown,(data:unknown)=>void>();
    const port={postMessage:(data:unknown)=>worker!.postMessage(data),terminate:()=>{void worker!.terminate();},addEventListener:(kind:string,callback:(event:unknown)=>void)=>{const wrapped=(data:unknown)=>callback(kind==='message'?{data}:data);wrappers.set(callback,wrapped);worker!.on(kind,wrapped);},removeEventListener:(kind:string,callback:unknown)=>{const wrapped=wrappers.get(callback);if(wrapped)worker!.off(kind,wrapped);}} as unknown as WorkerPort;
    channel.port1.on('message',sample=>samples.push(sample));worker.postMessage({kind:'connectLabMetrics',port:channel.port2},[channel.port2]);
    client=new SimulationClient(port,message=>messages.push(message));
    const fixture=createScenario('passage50');
    const wait=async(predicate:()=>boolean)=>{for(let i=0;i<500;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('Lab Worker timeout');};
    client.send('init',{seed:42,mapId:fixture.map.id,dataVersion:fixture.dataVersion,players:[{id:0,faction:'terran',controller:'human'},{id:1,faction:'terran',controller:'ai'}]});
    await wait(()=>messages.some(message=>message.kind==='ready'));
    client.send('loadSnapshot',{snapshot:scenarioEnvelope(fixture)});
    await wait(()=>messages.some(message=>message.kind==='snapshotLoaded'));
    await wait(()=>messages.some(message=>message.kind==='renderSnapshot'&&message.payload.entities.length===50));
    client.send('resume',{reason:'test'});
    await wait(()=>samples.some(sample=>sample.ticks.count>0));
    const measured=samples.find(sample=>sample.ticks.count>0)!;
    expect(measured.ticks.mean).toBeGreaterThanOrEqual(0);
    expect(measured.systems.movement).toBeDefined();
    expect(messages.filter(message=>message.kind==='fatalError')).toEqual([]);
  }finally{client?.dispose();channel.port1.close();channel.port2.close();await worker?.terminate();await rm(directory,{recursive:true,force:true});}
},15000);
