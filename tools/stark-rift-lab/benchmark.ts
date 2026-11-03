import {profileStep,TimingWindow,distribution} from '../../app/stark-rift/diagnostics/profiler';
import {createMovementRules} from '../../app/stark-rift/core/movement-rules';
import {createRenderSnapshot} from '../../app/stark-rift/worker/render-snapshot';
import {checksum} from '../../app/stark-rift/core/checksum';
import {createScenario,queueScenarioMovement,activeCount,type ScenarioId} from './scenarios';
export function runBenchmark(id:ScenarioId,ticks:number){
  const scenario=createScenario(id),{state,map}=scenario,rules=createMovementRules(map,()=>true),window=new TimingWindow(Math.min(10000,ticks));
  const snapshots:number[]=[],warmup:number[]=[];let overlaps=0,budgetViolations=0;
  queueScenarioMovement(scenario);
  const visibility=new Uint8Array(map.widthTiles*map.heightTiles).fill(2);
  for(let i=0;i<ticks;i++){
    const result=profileStep(state,rules);if(i<20)warmup.push(result.sample.totalMs);else window.add(result.sample);
    if(state.navigation.lastExpanded>8000||state.navigation.lastStarted>4)budgetViolations++;
    if(i%20===0||i===ticks-1){
      const start=performance.now();createRenderSnapshot(state,map,0,visibility);snapshots.push(performance.now()-start);
      for(let a=0;a<state.entities.id.length;a++)for(let b=a+1;b<state.entities.id.length;b++){
        if(state.entities.layer[a]===state.entities.layer[b]&&(state.entities.x[a]-state.entities.x[b])**2+(state.entities.y[a]-state.entities.y[b])**2<(state.entities.radius[a]+state.entities.radius[b])**2)overlaps++;
      }
    }
  }
  const summary=window.read(),remaining=activeCount(state),sampleChecksPassed=overlaps===0&&budgetViolations===0,arrivalGatePassed=id==='passage50'?remaining===0:null;
  return {scenario:id,simulatedTicks:ticks,entities:state.entities.id.length,mapTiles:[map.widthTiles,map.heightTiles],warmupTicks:20,warmup:distribution(warmup),...summary,snapshotCreation:distribution(snapshots),remainingOrders:remaining,overlapSamples:overlaps,budgetViolations,sampleChecksPassed,arrivalGatePassed,remainingByStatus:Object.fromEntries(['moving','waiting','blocked','arrived'].map(status=>[status,state.movement.filter(m=>m.order!=='idle'&&m.status===status).length])),budgets:{tickMeanMs:6,tickP95Ms:10,pathMeanMs:2.5},timingBudgetMet:summary.ticks.mean<=6&&summary.ticks.p95<=10&&(summary.systems.pathfinding?.mean??0)<=2.5,finalChecksum:checksum(state)};
}
