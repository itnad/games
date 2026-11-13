import { isEmbarked } from "../abilities/special-state";
import { isBurrowed } from "../abilities/burrow";
import {bodyContains,isBlueprint} from '../economy/footprints';
import type { SimulationState } from "../core/state";
import type { NavigationGrid, Point } from "./navigation";
type Reservation = Point & {radius:number;layer:string};
/** A single endpoint query needs no allocated reservation index. Clearance here is zero. */
export function destinationAvailable(state:SimulationState,actorId:number,point:Point,radius:number,layer:string):boolean{
  const s=state.entities;
  for(let i=0;i<s.id.length;i++){
    const motion=state.movement[i];
    if((isBurrowed(state,s.id[i])||isEmbarked(state,s.id[i]))||isBlueprint(state,i)||s.id[i]===actorId||s.health[i]===0||s.layer[i]!==layer||motion.order==="focusAttack")continue;
    const x=motion.target?.x??s.x[i],y=motion.target?.y??s.y[i];
    if(s.kind[i]==="building"?bodyContains(state,i,point.x,point.y,radius):(point.x-x)**2+(point.y-y)**2<(radius+s.radius[i])**2)return false;
  }
  return true;
}
/** Stable ID order allocates non-overlapping final positions, independent of transient traffic. */
export class DestinationReservations {
  private cells=new Map<string,Reservation[]>();
  constructor(state:SimulationState,excluded:readonly number[],private clearance=0){
    const ignored=new Set(excluded),s=state.entities;
    for(let i=0;i<s.id.length;i++){
      if((isBurrowed(state,s.id[i])||isEmbarked(state,s.id[i]))||s.kind[i]==="building"||isBlueprint(state,i)||ignored.has(s.id[i])||s.health[i]===0)continue;
      const m=state.movement[i];
      if(m.order==="focusAttack")continue;
      const point=m.target??{x:s.x[i],y:s.y[i]};
      this.reserve(point,s.radius[i],s.layer[i]);
    }
  }
  free(point:Point,radius:number,layer:string):boolean{
    const extent=radius+2*this.clearance,seen=new Set<Reservation>();
    for(let y=Math.floor((point.y-extent)/512);y<=Math.floor((point.y+extent)/512);y++)for(let x=Math.floor((point.x-extent)/512);x<=Math.floor((point.x+extent)/512);x++){
      for(const other of this.cells.get(`${layer}:${x},${y}`)??[]){
        if(seen.has(other))continue;seen.add(other);
        if((point.x-other.x)**2+(point.y-other.y)**2<(radius+other.radius+2*this.clearance)**2)return false;
      }
    }
    return true;
  }
  reserve(point:Point,radius:number,layer:string):void{
    const entry={...point,radius,layer};
    for(let y=Math.floor((point.y-radius)/512);y<=Math.floor((point.y+radius)/512);y++)for(let x=Math.floor((point.x-radius)/512);x<=Math.floor((point.x+radius)/512);x++){
      const key=`${layer}:${x},${y}`;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key)!.push(entry);
    }
  }
  allocate(grid:NavigationGrid,desired:Point,radius:number,layer:string,id:number):Point|null{
    desired={x:Math.min(grid.map.widthTiles*256-1,Math.max(0,desired.x)),y:Math.min(grid.map.heightTiles*256-1,Math.max(0,desired.y))};
    const cell=grid.cell(desired),cx=cell%grid.width,cy=Math.floor(cell/grid.width);
    for(let ring=0;ring<grid.width+grid.height;ring++){
      const candidates:number[]=[];
      for(let dx=-ring;dx<=ring;dx++){
        const x=cx+dx,dy=ring-Math.abs(dx);if(x<0||x>=grid.width)continue;
        for(const y of dy===0?[cy]:[cy-dy,cy+dy])if(y>=0&&y<grid.height)candidates.push(y*grid.width+x);
      }
      candidates.sort((a,b)=>{const pa=grid.point(a),pb=grid.point(b);return (pa.x-desired.x)**2+(pa.y-desired.y)**2-(pb.x-desired.x)**2-(pb.y-desired.y)**2||a-b;});
      for(const candidate of candidates){const point=grid.point(candidate);if(grid.clear(point,radius,layer,id)&&this.free(point,radius,layer)){this.reserve(point,radius,layer);return point;}}
    }
    return null;
  }
}
