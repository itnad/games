import {describe,it,expect} from 'vitest';
import {distribution,profileStep,TimingWindow} from '../../app/stark-rift/diagnostics/profiler';
import {checksum} from '../../app/stark-rift/core/checksum';
import {stepSimulation} from '../../app/stark-rift/core/simulation';
import {createMovementRules} from '../../app/stark-rift/core/movement-rules';
import {NavigationGrid} from '../../app/stark-rift/pathfinding/navigation';
import {SimulationRuntime} from '../../app/stark-rift/worker/runtime';
import {createWorkerEnvelope,type WorkerToMainMessage} from '../../app/stark-rift/worker/messages';
import {STARK_RIFT_PROTOCOL_VERSION} from '../../app/stark-rift/core/versions';
import {createScenario,queueScenarioMovement,resolveLabMap,scenarioEnvelope,SCENARIOS,type ScenarioId} from '../../tools/stark-rift-lab/scenarios';
describe('diagnostic observation',()=>{
  it('keeps profiled and unprofiled simulation checksums identical',()=>{
    const fixture=createScenario('passage50');queueScenarioMovement(fixture);
    const baseline=structuredClone(fixture.state),base=createMovementRules(fixture.map,()=>true),rules={...base,systems:{...base.systems,vision:undefined}};let time=0;
    for(let i=0;i<60;i++){
      const measured=profileStep(fixture.state,rules,()=>++time);stepSimulation(baseline,rules);
      expect(checksum(fixture.state)).toBe(checksum(baseline));
      expect(measured.sample.totalMs).toBeGreaterThan(0);expect(measured.sample.systems.pathfinding).toBeGreaterThan(0);
    }
  });
  it('bounds the window, uses nearest-rank p95 and keeps caller mutations isolated',()=>{
    expect(distribution([])).toEqual({count:0,mean:0,p95:0,max:0});
    expect(distribution(Array.from({length:100},(_,i)=>i+1))).toEqual({count:100,mean:50.5,p95:95,max:100});
    const window=new TimingWindow(2),sample={tick:1,totalMs:1,systems:{movement:1},queue:0,expanded:0,started:0,reused:0};
    window.add(sample);sample.totalMs=999;sample.systems.movement=999;
    window.add({...sample,tick:2,totalMs:2,systems:{movement:2}});window.add({...sample,tick:3,totalMs:3,systems:{movement:3}});
    expect(window.read().ticks).toEqual({count:2,mean:2.5,p95:3,max:3});
    const copy=window.read();copy.latest!.systems.movement=999;expect(window.read().latest!.systems.movement).toBe(3);
    expect(()=>distribution([NaN])).toThrow();expect(()=>new TimingWindow(0)).toThrow();
  });
});
describe('local-only lab fixtures',()=>{
  it.each(Object.keys(SCENARIOS) as ScenarioId[])('creates valid non-overlapping and restorable %s fixtures',id=>{
    const fixture=createScenario(id),grid=new NavigationGrid(fixture.map,fixture.state);
    expect(()=>scenarioEnvelope(fixture)).not.toThrow();
    fixture.state.entities.id.forEach((entity,i)=>expect(grid.clear({x:fixture.state.entities.x[i],y:fixture.state.entities.y[i]},fixture.state.entities.radius[i],fixture.state.entities.layer[i],entity)).toBe(true));
    expect(fixture.ids).toHaveLength(id.startsWith('economy-')?id==='economy-zerg'?6:5:id==='cross200'?100:id==='controls'?10:50);
    expect(resolveLabMap(fixture.map.id).dataVersion).toBe(fixture.dataVersion);
  });
  it('rejects lab IDs in the production runtime and isolates observer failures in a lab runtime',()=>{
    const fixture=createScenario('controls'),messages:WorkerToMainMessage[]=[];
    const init={protocolVersion:STARK_RIFT_PROTOCOL_VERSION,messageId:1,kind:'init',payload:{seed:42,mapId:fixture.map.id,dataVersion:fixture.dataVersion,players:[{id:0,faction:'terran',controller:'human'},{id:1,faction:'terran',controller:'ai'}]}};
    const normal=new SimulationRuntime({emit:message=>messages.push(message)});normal.receive(init);
    expect(messages.some(message=>message.kind==='ready')).toBe(false);
    messages.length=0;let observed=0;
    const lab=new SimulationRuntime({resolveMap:resolveLabMap,emit:message=>messages.push(message),observeTick:()=>{observed++;throw new Error('Broken diagnostic consumer');}});
    lab.receive(init);lab.advance(50);
    expect(observed).toBe(1);expect(messages.filter(message=>message.kind==='fatalError')).toEqual([]);
    lab.advance(50);expect(observed).toBe(2);expect(messages.some(message=>message.kind==='phaseChanged'&&message.payload.phase==='paused')).toBe(false);
    // Existing response contracts remain valid; diagnostics have no new wire kind.
    expect(()=>createWorkerEnvelope(1,'metrics',{tick:1,windowTicks:20,entityCount:0,pendingCommands:0})).not.toThrow();
  });
});
