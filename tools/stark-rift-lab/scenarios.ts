import {initializeEconomy} from '../../app/stark-rift/economy/helpers';
import {ECONOMY_DATA_VERSION,type Faction} from '../../app/stark-rift/data/economy-catalog';
import {createRiftBasin,type BattleMap} from '../../app/stark-rift/data/maps';
import {startSimulation,enqueueCommand} from '../../app/stark-rift/core/simulation';
import {createMovementRules} from '../../app/stark-rift/core/movement-rules';
import {createEntity} from '../../app/stark-rift/core/world';
import {NavigationGrid} from '../../app/stark-rift/pathfinding/navigation';
import {checksum} from '../../app/stark-rift/core/checksum';
import {createPersistenceEnvelope,type SessionState,type SimulationState} from '../../app/stark-rift/core/state';
export const SCENARIOS={'economy-terran':'테란 · 기지 운영','economy-zerg':'저그 · 기지 운영','economy-protoss':'프로토스 · 기지 운영',controls:'선택·슬롯·명령',passage50:'50기 좁은 통로',basin50:'50기 균열 분지',cross200:'200기 교차 이동'} as const;
export type ScenarioId=keyof typeof SCENARIOS;
export function scenarioMap(id:ScenarioId):BattleMap{
  const economy=id.startsWith('economy-'),size=economy||id==='basin50'||id==='cross200'?96:32;
  const map:BattleMap=economy||id==='basin50'?createRiftBasin():{id:'',widthTiles:size,heightTiles:size,symmetry:'rotational-180',terrain:new Uint8Array(size*size),height:new Uint8Array(size*size),walkable:new Uint8Array(size*size).fill(1),buildable:new Uint8Array(size*size).fill(1),spawnPoints:[{x:4,y:12},{x:size-5,y:16}],resourceNodes:[],regions:[]};
  map.id=`lab-${id}`;
  if(id==='passage50')for(let y=0;y<size;y++)if(y!==15){map.walkable[y*size+15]=0;map.buildable[y*size+15]=0;map.terrain[y*size+15]=2;}
  return map;
}
export function resolveLabMap(mapId:string){
  const id=mapId.slice(4) as ScenarioId;
  if(!mapId.startsWith('lab-')||!Object.hasOwn(SCENARIOS,id))throw new RangeError('Unknown lab scenario.');
  const map=scenarioMap(id);return {map,dataVersion:`lab-fixture-v2-${checksum({id,walkable:[...map.walkable],economy:ECONOMY_DATA_VERSION})}`};
}
export function createScenario(id:ScenarioId){
  const {map,dataVersion}=resolveLabMap(`lab-${id}`);
  const state=startSimulation(42,map.id,dataVersion,[0,1].map(owner=>({id:owner,faction:(id.startsWith('economy-')?id.slice(8):'terran') as Faction,minerals:50,gas:0,supplyUsedHalf:0,supplyCapHalf:200})));
  if(id.startsWith('economy-')){
    initializeEconomy(state,map);const ids=state.entities.id.filter((_,i)=>state.entities.owner[i]===0),enemyIds=state.entities.id.filter((_,i)=>state.entities.owner[i]===1),spawn=map.spawnPoints[0];
    const session:SessionState={camera:{centerX:spawn.x*256,centerY:spawn.y*256,zoomLevel:0},selection:{entityIds:[ids[0]],controlGroupIds:[]},openPanel:null};
    return {id,map,dataVersion,state,ids,enemyIds,goal:{x:(spawn.x+6)*256,y:(spawn.y+6)*256},session};
  }
  const ids:number[]=[],enemyIds:number[]=[];
  const spawn=(owner:number,x:number,y:number,kind:'combat'|'worker'='combat')=>createEntity(state,{owner,definitionId:`fixture-${kind}`,kind,x,y,health:100,speed:512,radius:40});
  const count=id==='cross200'?100:id==='controls'?10:50;
  if(id==='basin50'){
    const grid=new NavigationGrid(map,state),spawnPoint=map.spawnPoints[0];
    const cells=Array.from({length:grid.width*grid.height},(_,cell)=>cell).sort((a,b)=>{
      const pa=grid.point(a),pb=grid.point(b),x=spawnPoint.x*256,y=spawnPoint.y*256;
      return (pa.x-x)**2+(pa.y-y)**2-(pb.x-x)**2-(pb.y-y)**2||a-b;
    });
    for(const cell of cells){const p=grid.point(cell);if(grid.clear(p,40,'ground'))ids.push(spawn(0,p.x,p.y));if(ids.length===count)break;}
  }else for(let i=0;i<count;i++)ids.push(spawn(0,1024+(i%10)*128,3072+Math.floor(i/10)*128));
  if(id==='controls'){
    for(let i=0;i<4;i++)spawn(0,1024+i*128,4096,'worker');
    for(let i=0;i<2;i++)enemyIds.push(spawn(1,4096+i*128,3072));
  }
  if(id==='cross200')for(let i=0;i<100;i++)enemyIds.push(spawn(1,6144+(i%10)*128,3072+Math.floor(i/10)*128));
  for(let slot=0;slot<5;slot++)state.players[0].controlGroups[slot].entityIds=ids.slice(slot*10,slot*10+10);
  const center=id==='basin50'?{x:map.spawnPoints[0].x*256,y:map.spawnPoints[0].y*256}:{x:2304,y:3584};
  const session:SessionState={camera:{centerX:center.x,centerY:center.y,zoomLevel:1},selection:{entityIds:ids.slice(0,Math.min(50,ids.length)),controlGroupIds:[0,1,2,3,4].filter(slot=>state.players[0].controlGroups[slot].entityIds.length>0)},openPanel:null};
  const goal=id==='basin50'?{x:map.spawnPoints[1].x*256,y:map.spawnPoints[1].y*256}:id==='cross200'?{x:6656,y:3584}:{x:6144,y:4096};
  return {id,map,dataVersion,state,ids,enemyIds,goal,session};
}
export type LabScenario=ReturnType<typeof createScenario>;
export function queueScenarioMovement(scenario:LabScenario,includePlayer=true){
  if(scenario.id.startsWith('economy-'))return;
  const {state,map,ids,enemyIds,goal,id}=scenario,rules=createMovementRules(map,()=>true);
  const issue=(owner:number,actors:number[],target:{x:number;y:number})=>{
    if(!actors.length)return;
    const result=enqueueCommand(state,{kind:'move',sequence:state.commandState.lastAcceptedSequenceByPlayer[owner]+1,issuedTick:state.tick,executeTick:state.tick+1,playerId:owner,source:owner===0?'player':'ai',entityIds:actors,target:{kind:'point',...target}},rules);
    if(!result.ok)throw new Error(`Lab command rejected: ${result.code}`);
  };
  if(includePlayer)issue(0,ids,goal);
  if(id==='cross200')issue(1,enemyIds,{x:1536,y:3584});
}
export function scenarioEnvelope(scenario:LabScenario){
  return createPersistenceEnvelope(scenario.state,scenario.session,[],'2026-11-03T00:00:00.000Z');
}
export function activeCount(state:SimulationState){return state.movement.filter(m=>m.order!=='idle'&&m.order!=='hold').length;}
