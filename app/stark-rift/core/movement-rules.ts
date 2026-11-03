import type { BattleMap } from "../data/maps";
import type { EngineRules, CommandHandler } from "./simulation";
import type { SimulationState } from "./state";
import { idleMovement, emptyControlGroups } from "./orders";
import { integrate } from "./fixed-point";
import { navigate, NavigationGrid, type Point } from "../pathfinding/navigation";
import { formationOffsets, integerSqrt } from "../pathfinding/formation";
import { SpatialHash } from "../pathfinding/spatial-hash";
import { DestinationReservations } from "../pathfinding/destinations";

export type VisibilityCheck=(state:SimulationState,viewer:number,targetIndex:number)=>boolean;
export function createMovementRules(map:BattleMap,visible:VisibilityCheck=()=>false):EngineRules{
  const handlers:NonNullable<EngineRules["commands"]>={};
  for(const kind of ["move","attackMove","focusAttack","patrol","stop","hold","setFormation","setStance","assignGroup"] as const){
    const handler:CommandHandler={policy:kind==="assignGroup"?"atomic":"partial",validate:(state,command,id)=>{
      const s=state.entities,index=s.id.indexOf(id);
      if(command.kind==="assignGroup"){
        const ids=command.entityIds,definition=s.definitionId[index];
        if(s.kind[index]!=="combat"||ids.some(entity=>s.definitionId[s.id.indexOf(entity)]!==definition))return "invalid_target";
        const groups=state.players[command.playerId].controlGroups,slot=command.payload.slot;
        if(!command.payload.confirmed&&(groups[slot].entityIds.some(member=>!ids.includes(member))||groups.some((g,i)=>i!==slot&&g.entityIds.some(member=>ids.includes(member)))))return "invalid_state";
        return null;
      }
      if(s.kind[index]==="building"||(["move","attackMove","focusAttack","patrol"].includes(command.kind)&&s.speed[index]===0))return "invalid_state";
      if(command.kind==="focusAttack"){
        const target=s.id.indexOf(command.target.entityId);
        if(target<0||s.health[target]===0||s.owner[target]===command.playerId||!visible(state,command.playerId,target))return "invalid_target";
      }
      return null;
    },apply:(state,command,ids)=>{
      const s=state.entities,groups=state.players[command.playerId].controlGroups;
      if(command.kind==="assignGroup"){
        for(const group of groups)group.entityIds=group.entityIds.filter(id=>!ids.includes(id));
        const slot=command.payload.slot;groups[slot].entityIds=[...ids];return;
      }
      const batches=new Map<string,number[]>();
      for(const id of ids){const slot=groups.findIndex(g=>g.entityIds.includes(id)),key=slot<0?`temporary:${state.movement[s.id.indexOf(id)].formation}`:String(slot);if(!batches.has(key))batches.set(key,[]);batches.get(key)!.push(id);}
      const grid=new NavigationGrid(map,state),largest=Math.max(...ids.map(id=>s.radius[s.id.indexOf(id)]));
      const constrained=ids.some(id=>{
        const index=s.id.indexOf(id),point="target" in command&&command.target.kind==="point"?command.target:state.movement[index].target;
        return point!==null&&point!==undefined&&!grid.clear(point,s.radius[index]+largest*2,s.layer[index],id);
      });
      // Keep an approach lane between parked bodies when a wall or map edge constrains the formation.
      const reservations=new DestinationReservations(state,ids,constrained?largest:0);
      let batchIndex=0;
      const columns=Math.min(2,batches.size),rows=Math.ceil(batches.size/columns),maxBatch=Math.max(...[...batches.values()].map(ids=>ids.length));
      for(const [key,batch] of batches){
        const slot=key.startsWith("temporary:")?-1:Number(key),formation=slot<0?state.movement[s.id.indexOf(batch[0])].formation:groups[slot].formation;
        const spacing=Math.max(...batch.map(id=>s.radius[s.id.indexOf(id)]*2+32),128);
        const offsets=formationOffsets(batch.length,spacing,formation);
        if(command.kind==="setFormation"){
          const active=batch.map(id=>state.movement[s.id.indexOf(id)]).filter(m=>m.target!==null&&["move","attackMove","patrol"].includes(m.order));
          const center=active.length?{x:Math.round(active.reduce((sum,m)=>sum+m.target!.x,0)/active.length),y:Math.round(active.reduce((sum,m)=>sum+m.target!.y,0)/active.length)}:null;
          const changed=formationOffsets(active.length,spacing,command.payload.formation);
          active.forEach((m,i)=>{const index=s.id.indexOf(m.entityId);const point=reservations.allocate(grid,{x:center!.x+changed[i].x,y:center!.y+changed[i].y},s.radius[index],s.layer[index],m.entityId);m.target=point??m.target;m.path=[];m.pathIndex=0;m.status=point?"waiting":"blocked";m.requestTick=state.tick;});
        }
        for(const [position,id]of batch.entries()){
          const i=s.id.indexOf(id),m=state.movement[i];
          state.navigation.jobs=state.navigation.jobs.filter(j=>j.entityId!==id);
          if(command.kind==="setFormation"){
            m.formation=command.payload.formation;if(slot>=0)groups[slot].formation=command.payload.formation;continue;
          }
          if(command.kind==="setStance"){m.stance=command.payload.stance;if(slot>=0)groups[slot].stance=command.payload.stance;continue;}
          if(command.kind==="stop"||command.kind==="hold"){
            const old={formation:m.formation,stance:m.stance};Object.assign(m,idleMovement(id),old);if(command.kind==="hold")m.order="hold";continue;
          }
          if(command.kind!=="move"&&command.kind!=="attackMove"&&command.kind!=="patrol"&&command.kind!=="focusAttack")continue;
          let target:Point;
          if(command.kind==="focusAttack"){const t=s.id.indexOf(command.target.entityId);target={x:s.x[t],y:s.y[t]};}
          else target={x:Math.round(command.target.x+offsets[position].x+(batchIndex%columns-(columns-1)/2)*(maxBatch+2)*spacing),y:Math.round(command.target.y+offsets[position].y+(Math.floor(batchIndex/columns)-(rows-1)/2)*3*spacing)};
          const oldStance=m.stance;Object.assign(m,idleMovement(id));m.stance=slot<0?oldStance:groups[slot].stance;m.formation=formation;
          const destination=command.kind==="focusAttack"?target:reservations.allocate(grid,target,s.radius[i],s.layer[i],id);
          m.transitFormation=formation;m.priority=command.source==="ai"?2:0;m.requestTick=state.tick;m.order=command.kind;m.origin={x:s.x[i],y:s.y[i]};m.target=destination??{x:s.x[i],y:s.y[i]};
          m.targetEntityId=command.kind==="focusAttack"?command.target.entityId:null;m.status=destination?"waiting":"blocked";m.obstacleVersion=state.map.obstacleVersion;
        }
        batchIndex++;
      }
    }};
    handlers[kind]=handler;
  }
  return {commands:handlers,systems:{pathfinding:state=>navigate(state,map),movement:state=>move(state,map,visible),lifecycle:state=>{
    for(const player of state.players)for(let slot=0;slot<5;slot++){
      const group=player.controlGroups[slot];group.entityIds=group.entityIds.filter(id=>{const i=state.entities.id.indexOf(id);return i>=0&&state.entities.health[i]>0;});
      if(!group.entityIds.length)player.controlGroups[slot]=emptyControlGroups()[slot];
    }
  }}};
}
function move(state:SimulationState,map:BattleMap,visible:VisibilityCheck):void{
  const s=state.entities,grid=new NavigationGrid(map,state),hash=new SpatialHash(state);
  for(let i=0;i<s.id.length;i++){
    const m=state.movement[i];if(s.health[i]===0||s.kind[i]==="building")continue;
    if(m.order==="focusAttack"&&m.targetEntityId!==null){
      const t=s.id.indexOf(m.targetEntityId);
      if(t>=0&&visible(state,s.owner[i],t)){
        const dx=s.x[t]-s.x[i],dy=s.y[t]-s.y[i],range=s.radius[i]+s.radius[t]+64;
        if(dx*dx+dy*dy<=range*range){m.status="arrived";continue;}
        if(m.status==="arrived"){
          const length=integerSqrt(dx*dx+dy*dy),approach={x:s.x[t]-Math.trunc(dx*(range-1)/length),y:s.y[t]-Math.trunc(dy*(range-1)/length)};
          if(grid.segment({x:s.x[i],y:s.y[i]},approach,s.radius[i],s.layer[i],s.id[i])&&!hash.overlaps(i,approach.x,approach.y)){
            m.target={x:s.x[t],y:s.y[t]};m.path=[approach];m.pathIndex=0;m.status="moving";
          }
        }
        if(m.status==="arrived"||!m.target||Math.abs(m.target.x-s.x[t])+Math.abs(m.target.y-s.y[t])>256){m.target={x:s.x[t],y:s.y[t]};m.path=[];m.pathIndex=0;m.status="waiting";m.priority=1;m.requestTick=state.tick;state.navigation.jobs=state.navigation.jobs.filter(j=>j.entityId!==s.id[i]);}
      }
    }
    if(m.status!=="moving"||!m.path.length)continue;
    // Intermediate cell centers guide a corridor, not individual parking spaces.
    // Skip to the furthest visible waypoint to avoid queues around an already passed corner.
    for(let next=Math.min(m.path.length-1,m.pathIndex+64);next>m.pathIndex;next--)if(grid.segment({x:s.x[i],y:s.y[i]},m.path[next],s.radius[i],s.layer[i],s.id[i])){m.pathIndex=next;break;}
    const waypoint=m.path[m.pathIndex];if(!waypoint)continue;
    if(!grid.segment({x:s.x[i],y:s.y[i]},waypoint,s.radius[i],s.layer[i],s.id[i])){m.status="waiting";m.requestTick=state.tick;m.path=[];m.pathIndex=0;continue;}
    const dx=waypoint.x-s.x[i],dy=waypoint.y-s.y[i],distance=integerSqrt(dx*dx+dy*dy);
    const side=s.radius[i]*2+32,horizontal=Math.abs(dx)>=Math.abs(dy);
    const narrow=s.layer[i]==="ground"&&[-1,1].some(sign=>!grid.clear({x:s.x[i]+(horizontal?0:sign*side),y:s.y[i]+(horizontal?sign*side:0)},s.radius[i],s.layer[i],s.id[i]));
    m.transitFormation=narrow?"column":m.formation;
    const budget=integrate(s.speed[i],m.remainderX);m.remainderX=budget.remainder;const step=budget.delta;if(!step&&distance)continue;
    let nx=waypoint.x,ny=waypoint.y;
    if(distance>step){let mx=Math.trunc(dx*step/Math.max(1,distance)),my=Math.trunc(dy*step/Math.max(1,distance));if(!mx&&!my){if(Math.abs(dx)>=Math.abs(dy))mx=Math.sign(dx);else my=Math.sign(dy);}nx=s.x[i]+mx;ny=s.y[i]+my;}
    const start={x:s.x[i],y:s.y[i]};
    const directions=[[1024,0],[946,392],[724,724],[392,946],[0,1024],[-392,946],[-724,724],[-946,392],[-1024,0],[-946,-392],[-724,-724],[-392,-946],[0,-1024],[392,-946],[724,-724],[946,-392]];
    const candidates=[{x:nx,y:ny},...directions.map(([dx,dy])=>({x:s.x[i]+Math.trunc(dx*step/1024),y:s.y[i]+Math.trunc(dy*step/1024)}))]
      .filter(point=>point.x!==start.x||point.y!==start.y)
      .sort((a,b)=>(a.x-waypoint.x)**2+(a.y-waypoint.y)**2-(b.x-waypoint.x)**2-(b.y-waypoint.y)**2||a.y-b.y||a.x-b.x);
    const collisionFree=(point:Point)=>{const steps=Math.max(1,Math.ceil(Math.max(Math.abs(point.x-start.x),Math.abs(point.y-start.y))/s.radius[i]));for(let step=1;step<=steps;step++)if(hash.overlaps(i,Math.round(start.x+(point.x-start.x)*step/steps),Math.round(start.y+(point.y-start.y)*step/steps)))return false;return true;};
    const next=candidates.find(point=>grid.segment(start,point,s.radius[i],s.layer[i],s.id[i])&&collisionFree(point));
    if(next){s.x[i]=next.x;s.y[i]=next.y;hash.update(i);if(next.x===waypoint.x&&next.y===waypoint.y){m.pathIndex++;m.stalledTicks=0;}else if((next.x-waypoint.x)**2+(next.y-waypoint.y)**2<dx*dx+dy*dy)m.stalledTicks=0;else m.stalledTicks++;}
    else m.stalledTicks++;
    if(m.pathIndex>=m.path.length){
      if(m.order==="patrol"&&m.origin&&m.target){const target=m.origin;m.origin=m.target;m.target=target;m.path=[];m.pathIndex=0;m.status="waiting";}
      else if(m.order==="focusAttack")m.status="arrived";
      else{const old={formation:m.formation,stance:m.stance};Object.assign(m,idleMovement(m.entityId),old);}
    }else if(m.stalledTicks>=20+s.id[i]%4){m.path=[];m.pathIndex=0;m.status="waiting";m.requestTick=state.tick;m.stalledTicks=0;}
  }
}
