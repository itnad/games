import type { SimulationState } from "../core/state";
export class SpatialHash{
  private cells=new Map<string,Set<number>>();private memberships=new Map<number,string[]>();
  constructor(private state:SimulationState){for(let i=0;i<state.entities.id.length;i++)if(state.entities.health[i]>0)this.update(i);}
  private keys(x:number,y:number,r:number):string[]{const out:string[]=[];for(let cy=Math.floor((y-r)/512);cy<=Math.floor((y+r)/512);cy++)for(let cx=Math.floor((x-r)/512);cx<=Math.floor((x+r)/512);cx++)out.push(`${cx},${cy}`);return out;}
  update(index:number):void{for(const key of this.memberships.get(index)??[])this.cells.get(key)?.delete(index);const s=this.state.entities,keys=this.keys(s.x[index],s.y[index],s.radius[index]);for(const key of keys){if(!this.cells.has(key))this.cells.set(key,new Set());this.cells.get(key)!.add(index);}this.memberships.set(index,keys);}
  overlaps(index:number,x:number,y:number):boolean{
    const s=this.state.entities,candidates=new Set<number>();for(const key of this.keys(x,y,s.radius[index]))for(const other of this.cells.get(key)??[])candidates.add(other);
    for(const other of [...candidates].sort((a,b)=>s.id[a]-s.id[b])){if(other===index||s.layer[index]!==s.layer[other])continue;const r=s.radius[index]+s.radius[other],dx=x-s.x[other],dy=y-s.y[other];if(dx*dx+dy*dy<r*r)return true;}return false;
  }
}
