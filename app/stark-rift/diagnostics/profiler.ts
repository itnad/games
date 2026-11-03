import { stepSimulation, type EngineRules, type RuleSystem } from "../core/simulation";
import type { SimulationState } from "../core/state";

export type TickSample = {tick:number;totalMs:number;systems:Record<string,number>;queue:number;expanded:number;started:number;reused:number};
export type Distribution = {count:number;mean:number;p95:number;max:number};
export function distribution(values:readonly number[]):Distribution{
  if(!values.length)return {count:0,mean:0,p95:0,max:0};
  if(values.some(value=>!Number.isFinite(value)||value<0))throw new RangeError("Invalid timing sample.");
  const sorted=[...values].sort((a,b)=>a-b);
  return {count:values.length,mean:values.reduce((sum,value)=>sum+value,0)/values.length,p95:sorted[Math.ceil(sorted.length*.95)-1],max:sorted[sorted.length-1]};
}
/** Observation only: clocks and samples are never inserted into simulation state. */
export function profileStep(state:SimulationState,rules:EngineRules,now=()=>performance.now()){
  const systems:Record<string,number>={},wrapped:EngineRules={...rules,systems:{}};
  for(const [name,system]of Object.entries(rules.systems??{})){
    if(!system)continue;
    (wrapped.systems as Record<string,RuleSystem>)[name]=current=>{
      const start=now();system(current);systems[name]=Math.max(0,now()-start);
    };
  }
  const start=now(),acknowledgements=stepSimulation(state,wrapped),totalMs=Math.max(0,now()-start);
  const sample:TickSample={tick:state.tick,totalMs,systems,queue:state.navigation.jobs.length,expanded:state.navigation.lastExpanded,started:state.navigation.lastStarted,reused:state.navigation.lastReused};
  return {acknowledgements,sample};
}
export class TimingWindow{
  private samples:TickSample[]=[];
  constructor(private capacity=200){if(!Number.isSafeInteger(capacity)||capacity<1||capacity>10000)throw new RangeError("Invalid timing window.");}
  add(sample:TickSample):void{this.samples.push(structuredClone(sample));if(this.samples.length>this.capacity)this.samples.shift();}
  read(){
    const names=[...new Set(this.samples.flatMap(sample=>Object.keys(sample.systems)))].sort();
    return {ticks:distribution(this.samples.map(sample=>sample.totalMs)),systems:Object.fromEntries(names.map(name=>[name,distribution(this.samples.map(sample=>sample.systems[name]??0))])),latest:this.samples.length?structuredClone(this.samples[this.samples.length-1]):null};
  }
}
