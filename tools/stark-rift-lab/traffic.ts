import {stepSimulation} from '../../app/stark-rift/core/simulation';
import {createMovementRules} from '../../app/stark-rift/core/movement-rules';
import {checksum} from '../../app/stark-rift/core/checksum';
import {createScenario,queueScenarioMovement,activeCount} from './scenarios';
/** Fixed game-time completion check; not a substitute for real device soak testing. */
export function runTrafficCheck(id:'basin50'|'cross200',limit=2400){
  const scenario=createScenario(id),{state,map}=scenario,rules=createMovementRules(map,()=>true),lastMoved=new Int32Array(state.entities.id.length);
  const checkpoints:{tick:number;remaining:number;moving:number;waiting:number;blocked:number;staleActive:number}[]=[];
  queueScenarioMovement(scenario);
  for(let tick=1;tick<=limit;tick++){
    const x=[...state.entities.x],y=[...state.entities.y];stepSimulation(state,rules);
    for(let i=0;i<x.length;i++)if(x[i]!==state.entities.x[i]||y[i]!==state.entities.y[i])lastMoved[i]=tick;
    const active=state.movement.filter(m=>m.order!=='idle'&&m.order!=='hold');
    if(tick%300===0||!active.length)checkpoints.push({tick,remaining:active.length,moving:active.filter(m=>m.status==='moving').length,waiting:active.filter(m=>m.status==='waiting').length,blocked:active.filter(m=>m.status==='blocked').length,staleActive:state.movement.filter((m,i)=>m.order!=='idle'&&m.order!=='hold'&&tick-lastMoved[i]>=400).length});
    if(!active.length)return {scenario:id,completed:true,ticks:tick,remaining:0,checkpoints,checksum:checksum(state)};
  }
  return {scenario:id,completed:false,ticks:limit,remaining:activeCount(state),checkpoints,checksum:checksum(state)};
}
