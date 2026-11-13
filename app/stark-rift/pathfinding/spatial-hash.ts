import { isEmbarked } from "../abilities/special-state";
import { isBurrowed } from "../abilities/burrow";
import {bodyContains,segmentHitsBody,isBlueprint} from '../economy/footprints';
import type { SimulationState } from "../core/state";
import { segmentNearCircle } from "./geometry";
import type { Point } from "./navigation";
export class SpatialHash{
  private cells=new Map<string,Set<number>>();private memberships=new Map<number,string[]>();
  constructor(private state:SimulationState,indices:Iterable<number>=state.entities.id.keys()){for(const i of indices)if(state.entities.health[i]>0&&!isBlueprint(state,i)&&!isBurrowed(state,state.entities.id[i])&&!isEmbarked(state,state.entities.id[i]))this.update(i);}
  private keys(x:number,y:number,r:number):string[]{const out:string[]=[];for(let cy=Math.floor((y-r)/512);cy<=Math.floor((y+r)/512);cy++)for(let cx=Math.floor((x-r)/512);cx<=Math.floor((x+r)/512);cx++)out.push(`${cx},${cy}`);return out;}
  update(index:number):void{for(const key of this.memberships.get(index)??[])this.cells.get(key)?.delete(index);const s=this.state.entities,keys=this.keys(s.x[index],s.y[index],s.radius[index]);for(const key of keys){if(!this.cells.has(key))this.cells.set(key,new Set());this.cells.get(key)!.add(index);}this.memberships.set(index,keys);}
  queryBounds(left:number,top:number,right:number,bottom:number,ordered=true):Iterable<number>{
    const cells=(Math.floor(bottom/512)-Math.floor(top/512)+1)*(Math.floor(right/512)-Math.floor(left/512)+1);
    // Long sight lines can cover hundreds of empty buckets; a stable scan is cheaper there.
    if(cells>Math.max(4,this.memberships.size/16))return this.memberships.keys();
    const candidates=new Set<number>();
    for(let cy=Math.floor(top/512);cy<=Math.floor(bottom/512);cy++)for(let cx=Math.floor(left/512);cx<=Math.floor(right/512);cx++)
      for(const index of this.cells.get(`${cx},${cy}`)??[])candidates.add(index);
    return ordered?[...candidates].sort((a,b)=>this.state.entities.id[a]-this.state.entities.id[b]):candidates;
  }
  overlaps(index:number,x:number,y:number):boolean{
    const s=this.state.entities,candidates=new Set<number>();for(const key of this.keys(x,y,s.radius[index]))for(const other of this.cells.get(key)??[])candidates.add(other);
    for(const other of [...candidates].sort((a,b)=>s.id[a]-s.id[b])){if(other===index||s.layer[index]!==s.layer[other])continue;if(bodyContains(this.state,other,x,y,s.radius[index]))return true;}return false;
  }
  /** Query every cell touched by the swept body, then test the full segment exactly. */
  overlapsSegment(index:number,start:Point,end:Point):boolean{
    const s=this.state.entities,radius=s.radius[index],candidates=this.queryBounds(Math.min(start.x,end.x)-radius,Math.min(start.y,end.y)-radius,Math.max(start.x,end.x)+radius,Math.max(start.y,end.y)+radius,false);
    for(const other of candidates){
      if(other===index||s.health[other]===0||s.layer[index]!==s.layer[other])continue;
      if(segmentHitsBody(this.state,other,start,end,radius))return true;
    }
    return false;
  }
}
