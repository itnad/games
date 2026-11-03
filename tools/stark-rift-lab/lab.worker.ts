import {SimulationRuntime} from '../../app/stark-rift/worker/runtime';
import {TimingWindow} from '../../app/stark-rift/diagnostics/profiler';
import {resolveLabMap} from './scenarios';
const scope=globalThis as unknown as {postMessage:(value:unknown,transfer:Transferable[])=>void;onmessage:((event:MessageEvent)=>void)|null;close:()=>void};
let window=new TimingWindow(200);let metrics:MessagePort|null=null;
const runtime=new SimulationRuntime({resolveMap:resolveLabMap,visibility:(_state,map)=>new Uint8Array(map.widthTiles*map.heightTiles).fill(2),observeTick:sample=>{
  window.add(sample);if(sample.tick===1||sample.tick%20===0)metrics?.postMessage(window.read());
},emit:(message,transfer=[])=>{
  if(message.kind==='snapshotLoaded'){window=new TimingWindow(200);metrics?.postMessage(window.read());}
  scope.postMessage(message,transfer);
  if(message.kind==='disposed'){clearInterval(timer);metrics?.close();scope.close();}
}});
let last=performance.now();
const advance=()=>{const elapsed=Math.max(0,Math.floor(performance.now()-last));last+=elapsed;runtime.advance(elapsed);};
const timer=setInterval(advance,50);
scope.onmessage=event=>{
  if(event.data?.kind==='connectLabMetrics'&&event.data.port){metrics=event.data.port;return;}
  advance();runtime.receive(event.data);
};
