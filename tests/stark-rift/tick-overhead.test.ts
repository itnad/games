import {describe,it,expect} from "vitest";
import {cloneSimulationState} from "../../app/stark-rift/core/clone";
import {stepSimulation,type StepTimings} from "../../app/stark-rift/core/simulation";
import type {SimulationState} from "../../app/stark-rift/core/state";
import {createScenario} from "../../tools/stark-rift-lab/scenarios";
import {checksum} from "../../app/stark-rift/core/checksum";
import {array,boolean,dictionary,enumeration,integer,object,optional,parse,refine,text,type Schema} from "../../app/stark-rift/core/validation";

describe("rollback checkpoint cloning",()=>{
  it("reads plain accessors once and propagates accessor errors without retrying",()=>{
    let reads=0;const source={get value(){reads++;return 7;}};
    expect(cloneSimulationState(source as unknown as SimulationState)).toEqual({value:7});expect(reads).toBe(1);
    reads=0;const failure=new RangeError("accessor failed"),broken={get value(){reads++;throw failure;}};
    expect(()=>cloneSimulationState(broken as unknown as SimulationState)).toThrow(failure);expect(reads).toBe(1);
  });
  it("matches native cloning and preserves point aliases without exposing the original",()=>{
    const {state}=createScenario("controls"),point={x:4096,y:4096};
    Object.assign(state.movement[0],{order:"move",target:point,origin:point,path:[point],status:"moving"});
    const copied=cloneSimulationState(state);
    expect(copied).toStrictEqual(structuredClone(state));
    expect(copied.movement[0].target).toBe(copied.movement[0].path[0]);
    expect(copied.movement[0].origin).toBe(copied.movement[0].target);
    Object.assign(copied.movement[0].target!,{x:99});expect(point.x).toBe(4096);
  });
  it("preserves sparse arrays, cycles, signed zero and special dictionary keys",()=>{
    const values=new Array(5);values[2]=-0;
    const dictionary=Object.create(null);Object.defineProperty(dictionary,"__proto__",{value:{safe:true},enumerable:true});
    const source={values,dictionary,missing:undefined,self:null as unknown};source.self=source;
    const copied=cloneSimulationState(source as unknown as SimulationState) as unknown as typeof source;
    expect(copied).toStrictEqual(structuredClone(source));expect(copied.self).toBe(copied);
    expect(Object.is(copied.values[2],-0)).toBe(true);expect(Object.hasOwn(copied.values,0)).toBe(false);
    expect(Object.hasOwn(copied.dictionary,"__proto__")).toBe(true);expect(Object.getPrototypeOf(copied.dictionary)).toBe(Object.prototype);
  });
  it("uses native semantics for non-plain data and uncloneable values",()=>{
    const source={map:new Map<unknown,unknown>(),date:new Date(0)};source.map.set("root",source);
    const copied=cloneSimulationState(source as unknown as SimulationState) as unknown as typeof source;
    expect(copied).toStrictEqual(structuredClone(source));expect(copied.map.get("root")).toBe(copied);
    expect(()=>cloneSimulationState({value:()=>0} as unknown as SimulationState)).toThrow();
  });
  it("restores the original graph after a system fails and isolates timing observers",()=>{
    const {state}=createScenario("controls"),before=structuredClone(state),samples:StepTimings[]=[];
    expect(()=>stepSimulation(state,{systems:{movement:s=>{s.entities.x[0]=999;s.navigation.cache.push({key:"bad",path:[1]});throw new Error("failed movement");}}})).toThrow();
    before.phase="paused";expect(state).toStrictEqual(before);
    state.phase="running";const baseline=structuredClone(state);
    stepSimulation(state,{},timing=>{samples.push(timing);throw new Error("broken observer");});stepSimulation(baseline);
    expect(checksum(state)).toBe(checksum(baseline));expect(samples).toHaveLength(1);
    expect(Object.values(samples[0]).every(value=>value>=0&&Number.isFinite(value))).toBe(true);
  });
});
describe("compiled primitive validation",()=>{
  it("reads an array accessor once even when its first value fails validation",()=>{
    let reads=0;const values:number[]=[];
    Object.defineProperty(values,0,{enumerable:true,get:()=>++reads===1?NaN:1});
    expect(parse(array(integer()),values).ok).toBe(false);expect(reads).toBe(1);
  });
  it("retains error paths and order for holes, bounds, unknown fields and dictionaries",()=>{
    const schema=object({ids:array(integer(1,5)),flag:boolean,label:optional(text),kind:enumeration(["a","b"]),values:dictionary(integer())});
    const result=parse(schema,{extra:true,ids:[,6],flag:1,label:"",kind:"bad",values:{x:-1}});
    expect(result.ok).toBe(false);
    if(!result.ok)expect(result.issues.map(issue=>issue.path)).toEqual(["extra","ids[0]","ids[1]","flag","label","kind","values.x"]);
    expect(parse(schema,{ids:[1,5],flag:true,kind:"a",values:{x:0}}).ok).toBe(true);
  });
  it("keeps custom checks and refinements active and rejects non-plain dictionaries",()=>{
    let calls=0;const custom:Schema<number>={check:input=>{calls++;return input===7;}};
    expect(parse(array(custom),[7,7]).ok).toBe(true);expect(calls).toBe(2);
    expect(parse(array(refine(integer(),value=>value%2===0,"Expected even.")),[2,3]).ok).toBe(false);
    expect(parse(dictionary(integer()),new Map())).toMatchObject({ok:false});
    expect(parse(array(integer()),[Number.MAX_SAFE_INTEGER+1])).toMatchObject({ok:false});
  });
});

describe("single endpoint availability",()=>{
  it("matches the full reservation index across owners, layers, health and focus orders",async()=>{
    const {DestinationReservations,destinationAvailable}=await import('../../app/stark-rift/pathfinding/destinations');
    const {state}=createScenario('cross200');
    state.entities.id.forEach((id,i)=>{
      state.entities.radius[i]=20+(i%7)*30;
      if(i%11===0)state.entities.health[i]=0;
      if(i%5===0)state.entities.layer[i]='air';
      if(i%3===0){state.movement[i].order='move';state.movement[i].target={x:4096+(i%10)*128,y:4096+Math.floor(i/10)*128};}
      if(i%13===0){state.movement[i].order='focusAttack';state.movement[i].targetEntityId=1;}
    });
    for(let i=0;i<200;i++){
      const actor=state.entities.id[i],point={x:2048+(i%20)*200,y:2048+Math.floor(i/20)*200},layer=i%2?'ground':'air',radius=40+(i%4)*30;
      expect(destinationAvailable(state,actor,point,radius,layer)).toBe(new DestinationReservations(state,[actor]).free(point,radius,layer));
    }
  });
});

describe('longer traffic completion',()=>{
  it.each(['basin50','cross200'] as const)('completes %s after the short benchmark window',async id=>{
    const {runTrafficCheck}=await import('../../tools/stark-rift-lab/traffic');
    const result=runTrafficCheck(id);
    expect(result.completed).toBe(true);expect(result.remaining).toBe(0);expect(result.ticks).toBeLessThanOrEqual(2400);
    expect(result.checkpoints.every(point=>point.staleActive===0)).toBe(true);
  },30000);
});
