import type { SimulationState } from "../core/state";
import type { NavigationGrid, Point } from "./navigation";
type Reservation = Point & {radius:number;layer:string};
/** Stable ID order allocates non-overlapping final positions, independent of transient traffic. */
export class DestinationReservations {
  private entries:Reservation[]=[];
  constructor(state:SimulationState,excluded:readonly number[],private clearance=0){
    const ignored=new Set(excluded),s=state.entities;
    for(let i=0;i<s.id.length;i++){
      if(ignored.has(s.id[i])||s.health[i]===0)continue;
      const m=state.movement[i];
      if(m.order==="focusAttack")continue;
      const point=m.target??{x:s.x[i],y:s.y[i]};
      this.entries.push({...point,radius:s.radius[i],layer:s.layer[i]});
    }
  }
  free(point:Point,radius:number,layer:string):boolean{
    return this.entries.every(other=>other.layer!==layer||(point.x-other.x)**2+(point.y-other.y)**2>=(radius+other.radius+2*this.clearance)**2);
  }
  reserve(point:Point,radius:number,layer:string):void{this.entries.push({...point,radius,layer});}
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
