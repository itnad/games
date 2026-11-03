import type { SimulationState } from "../core/state";
import { segmentNearCircle } from "./geometry";
import type { Point } from "./navigation";
export class SpatialHash{
  private cells=new Map<string,Set<number>>();private memberships=new Map<number,string[]>();
  constructor(private state:SimulationState){for(let i=0;i<state.entities.id.length;i++)if(state.entities.health[i]>0)this.update(i);}
  private keys(x:number,y:number,r:number):string[]{const out:string[]=[];for(let cy=Math.floor((y-r)/512);cy<=Math.floor((y+r)/512);cy++)for(let cx=Math.floor((x-r)/512);cx<=Math.floor((x+r)/512);cx++)out.push(`${cx},${cy}`);return out;}
  update(index:number):void{for(const key of this.memberships.get(index)??[])this.cells.get(key)?.delete(index);const s=this.state.entities,keys=this.keys(s.x[index],s.y[index],s.radius[index]);for(const key of keys){if(!this.cells.has(key))this.cells.set(key,new Set());this.cells.get(key)!.add(index);}this.memberships.set(index,keys);}
  overlaps(index:number,x:number,y:number):boolean{
    const s=this.state.entities,candidates=new Set<number>();for(const key of this.keys(x,y,s.radius[index]))for(const other of this.cells.get(key)??[])candidates.add(other);
    for(const other of [...candidates].sort((a,b)=>s.id[a]-s.id[b])){if(other===index||s.layer[index]!==s.layer[other])continue;const r=s.radius[index]+s.radius[other],dx=x-s.x[other],dy=y-s.y[other];if(dx*dx+dy*dy<r*r)return true;}return false;
  }
  /** Query every cell touched by the swept body, then test the full segment exactly. */
  overlapsSegment(index:number,start:Point,end:Point):boolean{
    const s=this.state.entities,radius=s.radius[index],candidates=new Set<number>();
    for(let cy=Math.floor((Math.min(start.y,end.y)-radius)/512);cy<=Math.floor((Math.max(start.y,end.y)+radius)/512);cy++)
      for(let cx=Math.floor((Math.min(start.x,end.x)-radius)/512);cx<=Math.floor((Math.max(start.x,end.x)+radius)/512);cx++)
        for(const other of this.cells.get(`${cx},${cy}`)??[])candidates.add(other);
    for(const other of [...candidates].sort((a,b)=>s.id[a]-s.id[b])){
      if(other===index||s.health[other]===0||s.layer[index]!==s.layer[other])continue;
      if(segmentNearCircle(start,end,{x:s.x[other],y:s.y[other]},radius+s.radius[other]))return true;
    }
    return false;
  }
}
