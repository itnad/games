import type { BattleMap } from "../data/maps";
import type { SimulationState } from "../core/state";
import type { NavigationJob } from "./state";
import { checksum } from "../core/checksum";
export const CELL = 128;
export type Point = {x:number;y:number};
export class NavigationGrid {
  readonly width:number; readonly height:number;
  constructor(readonly map:BattleMap,private state:SimulationState){this.width=map.widthTiles*2;this.height=map.heightTiles*2;}
  point(cell:number):Point{return {x:(cell%this.width)*CELL+CELL/2,y:Math.floor(cell/this.width)*CELL+CELL/2};}
  cell(point:Point):number{return Math.min(this.height-1,Math.max(0,Math.floor(point.y/CELL)))*this.width+Math.min(this.width-1,Math.max(0,Math.floor(point.x/CELL)));}
  clear(point:Point,radius:number,layer:string,ignore=0):boolean{
    const {x,y}=point, w=this.map.widthTiles,h=this.map.heightTiles;
    if(x-radius<0||y-radius<0||x+radius>=w*256||y+radius>=h*256)return false;
    if(layer==="air")return true;
    for(let ty=Math.floor((y-radius)/256);ty<=Math.floor((y+radius)/256);ty++) for(let tx=Math.floor((x-radius)/256);tx<=Math.floor((x+radius)/256);tx++){
      if(this.map.walkable[ty*w+tx])continue;
      const dx=x-Math.max(tx*256,Math.min((tx+1)*256,x)),dy=y-Math.max(ty*256,Math.min((ty+1)*256,y));
      if(dx*dx+dy*dy<radius*radius)return false;
    }
    const s=this.state.entities;
    for(let i=0;i<s.id.length;i++)if(s.id[i]!==ignore&&s.kind[i]==="building"&&s.health[i]>0){const dx=x-s.x[i],dy=y-s.y[i],r=radius+s.radius[i];if(dx*dx+dy*dy<r*r)return false;}
    return true;
  }
  segment(a:Point,b:Point,radius:number,layer:string,ignore=0):boolean{
    const steps=Math.max(1,Math.ceil(Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y))/Math.min(64,radius)));
    for(let i=0;i<=steps;i++)if(!this.clear({x:Math.round(a.x+(b.x-a.x)*i/steps),y:Math.round(a.y+(b.y-a.y)*i/steps)},radius,layer,ignore))return false;
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
  const s=state.entities,n=state.navigation,grid=new NavigationGrid(map,state);
  const obstacles=s.id.flatMap((id,i)=>s.kind[i]==="building"&&s.health[i]>0?[[id,s.x[i],s.y[i],s.radius[i]]]:[]);
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
    if(cached){
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
    while(job.open.length&&n.lastExpanded<8000){
      const current=pop(job.open);
      if(job.closed[current.cell]||current.g!==job.cost[current.cell])continue;
      job.closed[current.cell]=1;n.lastExpanded++;
      if(heuristic(current.cell,job.goal,grid.width)<heuristic(job.best,job.goal,grid.width))job.best=current.cell;
      if(current.cell===job.goal){end=current.cell;break;}
      const x=current.cell%grid.width,y=Math.floor(current.cell/grid.width);
      for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
        if(nx<0||ny<0||nx>=grid.width||ny>=grid.height)continue;
        const cell=ny*grid.width+nx,g=current.g+10;
        if(job.closed[cell]||(job.cost[cell]!==undefined&&job.cost[cell]<=g)||!grid.clear(grid.point(cell),job.radius,job.layer,job.entityId))continue;
        job.cost[cell]=g;job.parent[cell]=current.cell;push(job.open,{cell,g,h:heuristic(cell,job.goal,grid.width)});
      }
    }
    if(end===null&&!job.open.length)end=job.best;
    if(end!==null){
      const i=s.id.indexOf(job.entityId),m=state.movement[i],route=path(job,end);
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
