import {describe,it,expect} from 'vitest';
import {segmentNearCircle,segmentNearTile} from '../../app/stark-rift/pathfinding/geometry';
import {SpatialHash} from '../../app/stark-rift/pathfinding/spatial-hash';
import {NavigationGrid} from '../../app/stark-rift/pathfinding/navigation';
import {DestinationReservations} from '../../app/stark-rift/pathfinding/destinations';
import {createScenario} from '../../tools/stark-rift-lab/scenarios';
type Point={x:number;y:number};
function exactCircle(a:Point,b:Point,c:Point,r:number){
  const dx=BigInt(b.x-a.x),dy=BigInt(b.y-a.y),px=BigInt(c.x-a.x),py=BigInt(c.y-a.y),length=dx*dx+dy*dy,dot=px*dx+py*dy,rr=BigInt(r)*BigInt(r);
  if(!length||dot<=BigInt(0))return px*px+py*py<rr;
  if(dot>=length)return (px-dx)**BigInt(2)+(py-dy)**BigInt(2)<rr;
  return (px*dy-py*dx)**BigInt(2)<rr*length;
}
function random(seed=123){let value=seed;return (max:number)=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value%max;};}
describe('exact geometry fast paths',()=>{
  it('matches exact rational circle distance for map coordinates and large-product fallback cases',()=>{
    const next=random();
    for(let i=0;i<6000;i++){
      const a={x:next(32768),y:next(32768)},b={x:next(32768),y:next(32768)},c={x:next(32768),y:next(32768)},r=1+next(1024);
      expect(segmentNearCircle(a,b,c,r)).toBe(exactCircle(a,b,c,r));
    }
    for(const y of [1000,1023,1024,1025]){
      const a={x:0,y:0},b={x:30000000,y:0},c={x:15000000,y};
      expect(segmentNearCircle(a,b,c,1024)).toBe(exactCircle(a,b,c,1024));
    }
    expect(segmentNearTile({x:-100000000,y:-100000000},{x:100000000,y:100000000},0,0,40)).toBe(true);
    expect(segmentNearTile({x:-100000000,y:100000000},{x:100000000,y:-100000000},0,0,40)).toBe(true);
  });
});
describe('indexed candidates preserve collision and reservation rules',()=>{
  it('matches live full-scan navigation, including a newly parked body and updated positions',()=>{
    const fixture=createScenario('cross200'),{state,map}=fixture,hash=new SpatialHash(state),indexed=new NavigationGrid(map,state,hash),plain=new NavigationGrid(map,state);
    const next=random();
    for(let i=0;i<100;i++){const radius=1+next(512),layer=i%3?'ground':'air',a={x:next(96*256),y:next(96*256)},b={x:next(96*256),y:next(96*256)};
      expect(indexed.clear(a,radius,layer,1)).toBe(plain.clear(a,radius,layer,1));expect(indexed.segment(a,b,radius,layer,1)).toBe(plain.segment(a,b,radius,layer,1));}
    state.movement[0].order='move';state.movement[0].target={x:4096,y:4096};state.entities.x[0]=4096;state.entities.y[0]=4096;hash.update(0);state.movement[0].order='idle';
    expect(indexed.segment({x:3900,y:4096},{x:4300,y:4096},40,'ground',2)).toBe(false);
    state.entities.health[0]=0;
    expect(indexed.segment({x:3900,y:4096},{x:4300,y:4096},40,'ground',2)).toBe(plain.segment({x:3900,y:4096},{x:4300,y:4096},40,'ground',2));
    map.walkable[16*96+16]=0;
    expect(indexed.clear({x:16*256+64,y:16*256+64},40,'ground',2)).toBe(false);
  });
  it.each([0,40,512])('matches a direct reservation oracle with clearance %s',clearance=>{
    const {state}=createScenario('cross200'),reservations=new DestinationReservations(state,[],clearance),entries=state.entities.id.map((_,i)=>({x:state.entities.x[i],y:state.entities.y[i],radius:state.entities.radius[i],layer:state.entities.layer[i]}));
    const next=random(456);
    for(let i=0;i<1000;i++){
      const point={x:next(96*256),y:next(96*256)},radius=1+next(512),layer=i%3?'ground':'air';
      const free=entries.every(other=>other.layer!==layer||(point.x-other.x)**2+(point.y-other.y)**2>=(radius+other.radius+2*clearance)**2);
      expect(reservations.free(point,radius,layer)).toBe(free);
      if(i%10===0){reservations.reserve(point,radius,layer);entries.push({...point,radius,layer});}
    }
  });
});

it('keeps row clipping and search-epoch clear caches equivalent to the live full scan',()=>{
  const {state,map}=createScenario('basin50');state.entities.health.fill(0);
  const hash=new SpatialHash(state),cached=new NavigationGrid(map,state,hash,true,true),plain=new NavigationGrid(map,state),next=random(789);
  for(let i=0;i<1200;i++){
    const a={x:64+next(190)*128,y:64+next(190)*128},b={x:64+next(190)*128,y:64+next(190)*128},radius=1+next(512),layer=i%4?'ground':'air';
    expect(cached.clear(a,radius,layer,1)).toBe(plain.clear(a,radius,layer,1));
    expect(cached.clear(a,radius,layer,2)).toBe(plain.clear(a,radius,layer,2));
    expect(cached.segment(a,b,radius,layer,1)).toBe(plain.segment(a,b,radius,layer,1));
    expect(cached.segment(b,a,radius,layer,1)).toBe(plain.segment(b,a,radius,layer,1));
  }
  for(let i=0;i<80;i++){
    const a={x:64+next(189)*128,y:64+next(189)*128},b={x:a.x+128,y:a.y},radius=1+next(512);
    expect(cached.segment(a,b,radius,'ground',1)).toBe(plain.segment(a,b,radius,'ground',1));
    expect(cached.segment(b,a,radius,'ground',2)).toBe(plain.segment(b,a,radius,'ground',2));
  }
  state.entities.health[0]=100;state.entities.kind[0]='building';
  const own={x:state.entities.x[0],y:state.entities.y[0]},adjacent={x:own.x+128,y:own.y};
  const withBuilding=new NavigationGrid(map,state,new SpatialHash(state),true,true);
  expect(withBuilding.clear(own,40,'ground',1)).toBe(plain.clear(own,40,'ground',1));
  expect(withBuilding.clear(own,40,'ground',2)).toBe(false);
  expect(withBuilding.segment(own,adjacent,40,'ground',1)).toBe(plain.segment(own,adjacent,40,'ground',1));
  expect(withBuilding.segment(own,adjacent,40,'ground',2)).toBe(false);
  map.walkable[14*96+14]=0;
  const refreshed=new NavigationGrid(map,state,new SpatialHash(state),true,true),point={x:14*256+64,y:14*256+64};
  expect(refreshed.clear(point,40,'ground',1)).toBe(false);
});

it('adds newly parked actors to the movement obstacle index immediately',()=>{
  const {state,map}=createScenario('controls');state.movement.forEach(m=>{m.order='move';m.target={x:6144,y:4096};});
  const hash=new SpatialHash(state),grid=new NavigationGrid(map,state,hash,true);grid.trackStaticObstacles();
  const point={x:state.entities.x[0],y:state.entities.y[0]};
  expect(grid.clear(point,40,'ground',2)).toBe(true);
  state.movement[0].order='idle';grid.addStaticObstacle(0);
  expect(grid.clear(point,40,'ground',2)).toBe(false);
  expect(grid.clear(point,40,'ground',1)).toBe(true);
});
