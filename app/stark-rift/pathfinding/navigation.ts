import { isBurrowed } from "../abilities/burrow";
import {isBlueprint,tileWalkable,bodyContains,segmentHitsBody} from '../economy/footprints';
import type { BattleMap } from "../data/maps";
import type { SimulationState } from "../core/state";
import type { NavigationJob } from "./state";
import { checksum } from "../core/checksum";
import { DestinationReservations, destinationAvailable } from "./destinations";
import { segmentNearCircle, segmentNearTile } from "./geometry";
import { SpatialHash } from "./spatial-hash";
export const CELL = 128;
export type Point = {x:number;y:number};
export class NavigationGrid {
  readonly width:number; readonly height:number;
  private blockedRows?:number[][];
  private clearTables?:Map<string,Int8Array>;
  private edgeTables?:Map<string,Int8Array>;
  private staticIds=new Set<number>();
  private staticIndices?:number[];
  private staticSpatial?:SpatialHash;
  /** Optional index is owned by the caller and updated whenever positions change. */
  constructor(readonly map:BattleMap,private state:SimulationState,private spatial?:SpatialHash,snapshotTerrain=false,snapshotObstacles=false){
    this.width=map.widthTiles*2;this.height=map.heightTiles*2;
    // Only the command/pathfinding/movement epoch opts in; ordinary grids remain live.
    if(snapshotTerrain){
      this.blockedRows=Array.from({length:map.heightTiles},()=>[]);
      for(let i=0;i<map.walkable.length;i++)if(!tileWalkable(map,state,i))this.blockedRows[Math.floor(i/map.widthTiles)].push(i%map.widthTiles);
    }
    if(snapshotObstacles){
      this.clearTables=new Map();this.edgeTables=new Map();
      this.trackStaticObstacles();
    }
  }
  trackStaticObstacles():void{
    this.staticIndices=[];this.staticIds.clear();const s=this.state.entities;
    s.id.forEach((id,i)=>{if(s.health[i]>0&&!isBlueprint(this.state,i)&&!isBurrowed(this.state,id)&&(s.kind[i]==="building"||this.state.movement[i].order==="idle"||this.state.movement[i].order==="hold")){this.staticIndices!.push(i);this.staticIds.add(id);}});
    this.staticSpatial=this.staticIndices.length>16?new SpatialHash(this.state,this.staticIndices):undefined;
  }
  addStaticObstacle(index:number):void{
    if(!this.staticIndices||this.staticIds.has(this.state.entities.id[index])||isBurrowed(this.state,this.state.entities.id[index]))return;
    this.staticIds.add(this.state.entities.id[index]);this.staticIndices.push(index);this.staticIndices.sort((a,b)=>this.state.entities.id[a]-this.state.entities.id[b]);
    if(this.staticSpatial)this.staticSpatial.update(index);
    else if(this.staticIndices.length>16)this.staticSpatial=new SpatialHash(this.state,this.staticIndices);
  }
  private obstacleCandidates(left:number,top:number,right:number,bottom:number):Iterable<number>{
    if(this.staticIndices)return this.staticSpatial?.queryBounds(left,top,right,bottom)??this.staticIndices;
    return this.spatial?.queryBounds(left,top,right,bottom)??this.state.entities.id.keys();
  }
  point(cell:number):Point{return {x:(cell%this.width)*CELL+CELL/2,y:Math.floor(cell/this.width)*CELL+CELL/2};}
  cell(point:Point):number{return Math.min(this.height-1,Math.max(0,Math.floor(point.y/CELL)))*this.width+Math.min(this.width-1,Math.max(0,Math.floor(point.x/CELL)));}
  clear(point:Point,radius:number,layer:string,ignore=0):boolean{
    if(this.clearTables&&point.x>=0&&point.y>=0&&point.x<this.map.widthTiles*256&&point.y<this.map.heightTiles*256&&point.x%CELL===CELL/2&&point.y%CELL===CELL/2){
      const key=`${radius}:${layer}:${this.staticIds.has(ignore)?ignore:0}`;
      let table=this.clearTables.get(key);if(!table){table=new Int8Array(this.width*this.height);this.clearTables.set(key,table);}
      const cell=Math.floor(point.y/CELL)*this.width+Math.floor(point.x/CELL),cached=table[cell];
      if(cached)return cached>0;
      const result=this.clearUncached(point,radius,layer,ignore);table[cell]=result?1:-1;return result;
    }
    return this.clearUncached(point,radius,layer,ignore);
  }
  private clearUncached(point:Point,radius:number,layer:string,ignore:number):boolean{
    const {x,y}=point, w=this.map.widthTiles,h=this.map.heightTiles;
    if(x-radius<0||y-radius<0||x+radius>=w*256||y+radius>=h*256)return false;
    if(layer!=="air")for(let ty=Math.floor((y-radius)/256);ty<=Math.floor((y+radius)/256);ty++) for(let tx=Math.floor((x-radius)/256);tx<=Math.floor((x+radius)/256);tx++){
      if(tileWalkable(this.map,this.state,ty*w+tx))continue;
      const dx=x-Math.max(tx*256,Math.min((tx+1)*256,x)),dy=y-Math.max(ty*256,Math.min((ty+1)*256,y));
      if(dx*dx+dy*dy<radius*radius)return false;
    }
    const s=this.state.entities;
    const candidates=this.obstacleCandidates(x-radius,y-radius,x+radius,y+radius);
    for(const i of candidates)if(s.id[i]!==ignore&&s.layer[i]===layer&&s.health[i]>0&&(s.kind[i]==="building"||this.state.movement[i].order==="idle"||this.state.movement[i].order==="hold")){if(bodyContains(this.state,i,x,y,radius))return false;}
    return true;
  }
  segment(a:Point,b:Point,radius:number,layer:string,ignore=0):boolean{
    if(this.edgeTables&&Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===CELL&&
       a.x>=0&&a.y>=0&&b.x>=0&&b.y>=0&&a.x<this.map.widthTiles*256&&b.x<this.map.widthTiles*256&&a.y<this.map.heightTiles*256&&b.y<this.map.heightTiles*256&&
       a.x%CELL===CELL/2&&a.y%CELL===CELL/2&&b.x%CELL===CELL/2&&b.y%CELL===CELL/2){
      const key=`${radius}:${layer}:${this.staticIds.has(ignore)?ignore:0}`;
      let table=this.edgeTables.get(key);if(!table){table=new Int8Array(this.width*this.height*2);this.edgeTables.set(key,table);}
      const first=Math.floor(a.y/CELL)*this.width+Math.floor(a.x/CELL),second=Math.floor(b.y/CELL)*this.width+Math.floor(b.x/CELL);
      const edge=Math.min(first,second)*2+(a.y!==b.y?1:0),cached=table[edge];
      if(cached)return cached>0;
      const result=this.segmentUncached(a,b,radius,layer,ignore);table[edge]=result?1:-1;return result;
    }
    return this.segmentUncached(a,b,radius,layer,ignore);
  }
  private segmentUncached(a:Point,b:Point,radius:number,layer:string,ignore:number):boolean{
    if(!this.clear(a,radius,layer,ignore)||!this.clear(b,radius,layer,ignore))return false;
    if(layer!=="air"){
      const left=Math.max(0,Math.floor((Math.min(a.x,b.x)-radius)/256)),right=Math.min(this.map.widthTiles-1,Math.floor((Math.max(a.x,b.x)+radius)/256));
      const top=Math.max(0,Math.floor((Math.min(a.y,b.y)-radius)/256)),bottom=Math.min(this.map.heightTiles-1,Math.floor((Math.max(a.y,b.y)+radius)/256));
      for(let y=top;y<=bottom;y++){
        if(this.blockedRows){
          const row=this.blockedRows[y];if(!row.length)continue;
          let rowLeft=left,rowRight=right;
          const from=a.y<=b.y?a:b,to=a.y<=b.y?b:a,rise=to.y-from.y,run=to.x-from.x;
          if(rise>0){
            const yLow=Math.max(from.y,y*256-radius),yHigh=Math.min(to.y,(y+1)*256+radius);
            if(yLow>yHigh)continue;
            const base=from.x*rise,offsetLow=(yLow-from.y)*run,offsetHigh=(yHigh-from.y)*run;
            const first=base+offsetLow,second=base+offsetHigh;
            if([base,offsetLow,offsetHigh,first,second].every(Number.isSafeInteger)){
              // Outward integer bounds include every segment point near this row.
              // One extra world unit protects the broad phase at quotient boundaries.
              rowLeft=Math.max(left,Math.floor((Math.floor(Math.min(first,second)/rise)-radius-1)/256));
              rowRight=Math.min(right,Math.floor((Math.ceil(Math.max(first,second)/rise)+radius+1)/256));
            }
          }
          let low=0,high=row.length;
          while(low<high){const mid=(low+high)>>>1;if(row[mid]<rowLeft)low=mid+1;else high=mid;}
          for(let i=low;i<row.length&&row[i]<=rowRight;i++)if(segmentNearTile(a,b,row[i]*256,y*256,radius))return false;
        }else for(let x=left;x<=right;x++)if(!tileWalkable(this.map,this.state,y*this.map.widthTiles+x)&&segmentNearTile(a,b,x*256,y*256,radius))return false;
      }
    }
    const s=this.state.entities;
    const candidates=this.obstacleCandidates(Math.min(a.x,b.x)-radius,Math.min(a.y,b.y)-radius,Math.max(a.x,b.x)+radius,Math.max(a.y,b.y)+radius);
    for(const i of candidates)if(s.id[i]!==ignore&&s.layer[i]===layer&&s.health[i]>0&&(s.kind[i]==="building"||this.state.movement[i].order==="idle"||this.state.movement[i].order==="hold")&&segmentHitsBody(this.state,i,a,b,radius))return false;
    return true;
  }
}
type Node=NavigationJob["open"][number];
const compare=(a:Node,b:Node)=>a.g+a.h-b.g-b.h||a.h-b.h||a.cell-b.cell;
function push(heap:Node[],node:Node){heap.push(node);let i=heap.length-1;while(i){const p=(i-1)>>1;if(compare(heap[p],node)<=0)break;heap[i]=heap[p];i=p;}heap[i]=node;}
function pop(heap:Node[]):Node{
  const first=heap[0],last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&compare(heap[j+1],heap[j])<0)j++;if(compare(last,heap[j])<=0)break;heap[i]=heap[j];i=j;}heap[i]=last;}return first;
}
const heuristic=(cell:number,goal:number,width:number)=>10*(Math.abs(cell%width-goal%width)+Math.abs(Math.floor(cell/width)-Math.floor(goal/width)));
function path(job:NavigationJob,end:number):number[]{const result=[end];while(end!==job.start){const parent=job.parent[String(end)];if(parent===undefined)return [];end=parent;result.push(end);if(result.length>8192)return [];}return result.reverse();}
function jobKey(goal:number,radius:number,layer:string,version:number){return `${goal}:${radius}:${layer}:${version}`;}
/** Search queues and caches are state, so save/restore preserves scheduling and path completion ticks. */
export function navigate(state:SimulationState,map:BattleMap):void{
  const s=state.entities,n=state.navigation,grid=new NavigationGrid(map,state,new SpatialHash(state),true,true);
  const obstacles=s.id.flatMap((id,i)=>s.health[i]>0&&!isBlueprint(state,i)&&!isBurrowed(state,id)&&(s.kind[i]==="building"||state.movement[i].order==="idle"||state.movement[i].order==="hold")?[[id,s.x[i],s.y[i],s.radius[i],s.layer[i]]]:[]);
  const signature=obstacles.length?checksum(obstacles):"none";
  if(n.obstacleSignature!==signature){n.obstacleSignature=signature;state.map.obstacleVersion++;}
  n.lastStarted=0;n.lastExpanded=0;n.lastReused=0;
  n.jobs=n.jobs.filter(j=>{const i=s.id.indexOf(j.entityId);return i>=0&&state.movement[i].status==="waiting"&&j.version===state.map.obstacleVersion;});
  n.cache=n.cache.filter(c=>c.key.endsWith(`:${state.map.obstacleVersion}`));
  const order=s.id.map((_,i)=>i).sort((a,b)=>state.movement[a].priority-state.movement[b].priority||state.movement[a].requestTick-state.movement[b].requestTick||s.id[a]-s.id[b]);
  for(const i of order){
    const m=state.movement[i];
    if(m.order!=="idle"&&m.order!=="hold"&&m.obstacleVersion!==state.map.obstacleVersion){m.status="waiting";m.path=[];m.pathIndex=0;m.obstacleVersion=state.map.obstacleVersion;}
    if(m.status!=="waiting"||!m.target||n.jobs.some(j=>j.entityId===s.id[i]))continue;
    let start=grid.cell({x:s.x[i],y:s.y[i]});
    if(!grid.clear(grid.point(start),s.radius[i],s.layer[i],s.id[i])){
      const candidates:number[]=[];const cx=start%grid.width,cy=Math.floor(start/grid.width);
      for(let y=Math.max(0,cy-5);y<=Math.min(grid.height-1,cy+5);y++)for(let x=Math.max(0,cx-5);x<=Math.min(grid.width-1,cx+5);x++)candidates.push(y*grid.width+x);
      candidates.sort((a,b)=>{const pa=grid.point(a),pb=grid.point(b);return (pa.x-s.x[i])**2+(pa.y-s.y[i])**2-(pb.x-s.x[i])**2-(pb.y-s.y[i])**2||a-b;});
      const corrected=candidates.find(cell=>grid.segment({x:s.x[i],y:s.y[i]},grid.point(cell),s.radius[i],s.layer[i],s.id[i]));
      if(corrected===undefined){m.status="blocked";continue;}start=corrected;
    }
    const goal=grid.cell(m.target),key=jobKey(goal,s.radius[i],s.layer[i],state.map.obstacleVersion);
    let cached=n.cache.find(c=>c.key===key);
    if(!cached&&grid.clear(grid.point(goal),s.radius[i],s.layer[i],s.id[i])){
      const corridor=n.cache.find(c=>{
        if(!c.key.endsWith(`:${s.radius[i]}:${s.layer[i]}:${state.map.obstacleVersion}`)||!c.path.length)return false;
        const end=grid.point(c.path[c.path.length-1]),target=grid.point(goal);
        return (end.x-target.x)**2+(end.y-target.y)**2<=2048**2&&grid.segment(end,target,s.radius[i],s.layer[i],s.id[i]);
      });
      if(corridor)cached={key,path:[...corridor.path,goal]};
    }
    if(cached&&cached.path.length&&(m.order==="focusAttack"||destinationAvailable(state,s.id[i],grid.point(cached.path[cached.path.length-1]),s.radius[i],s.layer[i]))){
      let join=-1,best=Infinity;
      for(let p=0;p<cached.path.length;p++){const point=grid.point(cached.path[p]),distance=(point.x-s.x[i])**2+(point.y-s.y[i])**2;if(distance<best&&grid.segment({x:s.x[i],y:s.y[i]},point,s.radius[i],s.layer[i],s.id[i])){best=distance;join=p;}}
      if(join>=0){n.lastReused++;m.path=cached.path.slice(join).map(c=>grid.point(c));m.pathIndex=0;m.status="moving";m.target=m.path.at(-1)!;continue;}
    }
    if(n.lastStarted>=4||n.jobs.length>=4)continue;
    const h=heuristic(start,goal,grid.width);
    n.jobs.push({entityId:s.id[i],start,goal,best:start,radius:s.radius[i],layer:s.layer[i],version:state.map.obstacleVersion,open:[{cell:start,g:0,h}],cost:{[start]:0},parent:{},closed:{}});n.lastStarted++;
  }
  for(const job of [...n.jobs]){
    let end:number|null=null;
    const index=s.id.indexOf(job.entityId),motion=state.movement[index],destinations=new DestinationReservations(state,[job.entityId]);
    const available=(cell:number)=>motion.order==="focusAttack"||destinations.free(grid.point(cell),job.radius,job.layer);
    // Reservations do not change while this job expands. Keep the best-cell predicate local.
    let bestAvailable=available(job.best),bestHeuristic=heuristic(job.best,job.goal,grid.width);
    while(job.open.length&&n.lastExpanded<8000){
      const current=pop(job.open);
      if(job.closed[current.cell]||current.g!==job.cost[current.cell])continue;
      job.closed[current.cell]=1;n.lastExpanded++;
      const currentAvailable=available(current.cell);
      if(currentAvailable){
        const h=heuristic(current.cell,job.goal,grid.width);
        if(!bestAvailable||h<bestHeuristic){job.best=current.cell;bestAvailable=true;bestHeuristic=h;}
      }
      if(current.cell===job.goal&&currentAvailable){end=current.cell;break;}
      const x=current.cell%grid.width,y=Math.floor(current.cell/grid.width);
      for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
        if(nx<0||ny<0||nx>=grid.width||ny>=grid.height)continue;
        const cell=ny*grid.width+nx,g=current.g+10;
        if(job.closed[cell]||(job.cost[cell]!==undefined&&job.cost[cell]<=g)||!grid.clear(grid.point(cell),job.radius,job.layer,job.entityId)||!grid.segment(grid.point(current.cell),grid.point(cell),job.radius,job.layer,job.entityId))continue;
        job.cost[cell]=g;job.parent[cell]=current.cell;push(job.open,{cell,g,h:heuristic(cell,job.goal,grid.width)});
      }
    }
    if(end===null&&!job.open.length){
      const free=Object.keys(job.closed).map(Number).filter(available).sort((a,b)=>heuristic(a,job.goal,grid.width)-heuristic(b,job.goal,grid.width)||a-b);
      end=free[0]??job.start;
    }
    if(end!==null){
      const i=s.id.indexOf(job.entityId),m=state.movement[i],route=available(end)?path(job,end):[];
      m.path=route.map(c=>grid.point(c));m.pathIndex=0;m.status=route.length?"moving":"blocked";
      if(m.path.length)m.target=m.path.at(-1)!;
      n.cache.push({key:jobKey(job.goal,job.radius,job.layer,job.version),path:route});if(n.cache.length>64)n.cache.shift();
      n.jobs=n.jobs.filter(j=>j!==job);
    }
    if(n.lastExpanded>=8000)break;
  }
}
export function navigationFitsMap(state:SimulationState,map:BattleMap):boolean{
  const limit=map.widthTiles*map.heightTiles*4,cell=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<limit;
  const keys=(record:Record<string,number>)=>Object.keys(record).every(key=>/^(0|[1-9]\d*)$/.test(key)&&cell(Number(key)));
  return state.navigation.jobs.every(job=>{
    const i=state.entities.id.indexOf(job.entityId);
    return i>=0&&job.radius===state.entities.radius[i]&&job.layer===state.entities.layer[i]&&job.version<=state.map.obstacleVersion&&
      [job.start,job.goal,job.best].every(cell)&&job.open.every(node=>cell(node.cell))&&keys(job.cost)&&keys(job.parent)&&keys(job.closed)&&Object.values(job.parent).every(cell);
  })&&state.navigation.cache.every(cache=>/^\d+:\d+:(ground|air):\d+$/.test(cache.key)&&cell(Number(cache.key.split(":")[0]))&&cache.path.every(cell));
}
