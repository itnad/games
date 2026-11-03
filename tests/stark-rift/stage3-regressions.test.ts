import {describe,expect,it} from "vitest";
import {startSimulation,enqueueCommand,stepSimulation} from "../../app/stark-rift/core/simulation";
import {createEntity} from "../../app/stark-rift/core/world";
import {createMovementRules} from "../../app/stark-rift/core/movement-rules";
import {navigate,NavigationGrid} from "../../app/stark-rift/pathfinding/navigation";
import {createPersistenceEnvelope,restoreSnapshot,serializeSnapshot} from "../../app/stark-rift/core/state";
import {checksum} from "../../app/stark-rift/core/checksum";
import type {BattleMap} from "../../app/stark-rift/data/maps";
const map=():BattleMap=>({id:"review",widthTiles:32,heightTiles:32,symmetry:"rotational-180",terrain:new Uint8Array(1024),height:new Uint8Array(1024),walkable:new Uint8Array(1024).fill(1),buildable:new Uint8Array(1024).fill(1),spawnPoints:[{x:4,y:4},{x:28,y:28}],resourceNodes:[],regions:[]});
const state=()=>startSimulation(42,"review","fixture",[0,1].map(id=>({id,faction:"terran",minerals:50,gas:0,supplyUsedHalf:0,supplyCapHalf:100})));
function spawn(s:ReturnType<typeof state>,x:number,y:number,extra:Partial<Parameters<typeof createEntity>[1]>={}){return createEntity(s,{owner:0,definitionId:"unit",x,y,health:100,speed:512,radius:40,...extra});}
function send(s:ReturnType<typeof state>,r:ReturnType<typeof createMovementRules>,kind:string,ids:number[],extra:object={}){const sequence=s.commandState.lastAcceptedSequenceByPlayer[0]+1;expect(enqueueCommand(s,{sequence,issuedTick:s.tick,executeTick:s.tick+1,playerId:0,source:"player",kind,entityIds:ids,...extra},r).ok).toBe(true);}
const session={camera:{centerX:0,centerY:0,zoomLevel:1 as const},selection:{entityIds:[],controlGroupIds:[]},openPanel:null};
describe("stage 3 reviewed defects",()=>{
  it.each([{dx:200,dy:0},{dx:0,dy:200}])("restarts focus pursuit when the visible target leaves approach range: %o",({dx,dy})=>{
    const s=state(),m=map(),r=createMovementRules(m,()=>true);spawn(s,1024,1024);spawn(s,2048,1024,{owner:1,speed:0});
    send(s,r,"focusAttack",[1],{target:{kind:"entity",entityId:2}});for(let i=0;i<100;i++)stepSimulation(s,r);
    expect(s.movement[0].status).toBe("arrived");const before={x:s.entities.x[0],y:s.entities.y[0]};s.entities.x[1]+=before.x<=s.entities.x[1]?dx:-dx;s.entities.y[1]+=before.y<=s.entities.y[1]?dy:-dy;
    expect((s.entities.x[1]-before.x)**2+(s.entities.y[1]-before.y)**2).toBeGreaterThan(144**2);
    for(let i=0;i<30;i++)stepSimulation(s,r);
    expect({x:s.entities.x[0],y:s.entities.y[0]}).not.toEqual(before);
    expect((s.entities.x[1]-s.entities.x[0])**2+(s.entities.y[1]-s.entities.y[0])**2).toBeLessThanOrEqual(144**2);
  });
  it.each(["line","column","spread"] as const)("retains temporary %s formation through move, stop and save/restore",formation=>{
    let s=state();const m=map(),r=createMovementRules(m);spawn(s,1024,1024);spawn(s,1152,1024);
    send(s,r,"setFormation",[1,2],{payload:{formation}});stepSimulation(s,r);
    s=restoreSnapshot(serializeSnapshot(createPersistenceEnvelope(s,session,[],"2026-11-03T00:00:00.000Z"))).simulation;
    send(s,r,"move",[1,2],{target:{kind:"point",x:4096,y:4096}});stepSimulation(s,r);expect(s.movement.every(m=>m.formation===formation)).toBe(true);
    if(formation==="column")expect(s.movement[0].target?.x).toBe(s.movement[1].target?.x);
    if(formation==="spread")expect(Math.abs(s.movement[0].target!.x-s.movement[1].target!.x)).toBeGreaterThanOrEqual(256);
    send(s,r,"stop",[1,2]);stepSimulation(s,r);send(s,r,"move",[1,2],{target:{kind:"point",x:5000,y:5000}});stepSimulation(s,r);
    expect(s.movement.every(m=>m.formation===formation)).toBe(true);
  });
  it.each([{x:40,y:40},{x:8150,y:8150},{x:-10000,y:-10000}])("allocates ten distinct, reachable corner destinations: %o",target=>{
    const s=state(),m=map(),r=createMovementRules(m);const ids=Array.from({length:10},(_,i)=>spawn(s,1024+(i%5)*128,1024+Math.floor(i/5)*128));
    send(s,r,"move",ids,{target:{kind:"point",...target}});stepSimulation(s,r);
    const goals=s.movement.map(m=>m.target);expect(new Set(goals.map(p=>JSON.stringify(p))).size).toBe(10);
    for(let i=0;i<1000;i++)stepSimulation(s,r);
    expect(s.movement.every(m=>m.order==="idle")).toBe(true);
    for(let i=0;i<10;i++)for(let j=i+1;j<10;j++)expect((s.entities.x[i]-s.entities.x[j])**2+(s.entities.y[i]-s.entities.y[j])**2).toBeGreaterThanOrEqual(80**2);
  },15000);
  it("does not assign a final point occupied by an idle unit",()=>{
    const s=state(),m=map(),r=createMovementRules(m);spawn(s,1024,1024);spawn(s,2112,1088,{speed:0});
    send(s,r,"move",[1],{target:{kind:"point",x:2112,y:1088}});for(let i=0;i<150;i++)stepSimulation(s,r);
    expect(s.movement[0].order).toBe("idle");expect((s.entities.x[0]-2112)**2+(s.entities.y[0]-1088)**2).toBeGreaterThanOrEqual(80**2);
  });
  it.each([{x:1152,y:1152},{x:1104,y:1167}])("checks the swept segment between clear A* nodes around a circular building: %o",building=>{
    const s=state(),m=map();spawn(s,1088,1088);spawn(s,building.x,building.y,{owner:1,kind:"building",speed:0});
    Object.assign(s.movement[0],{order:"move",target:{x:1728,y:1088},status:"waiting"});navigate(s,m);
    const route=s.movement[0].path,grid=new NavigationGrid(m,s);expect(route.length).toBeGreaterThan(1);
    expect(grid.clear({x:1088,y:1088},40,"ground",1)).toBe(true);expect(grid.clear({x:1216,y:1088},40,"ground",1)).toBe(true);
    expect(grid.segment({x:1088,y:1088},{x:1216,y:1088},40,"ground",1)).toBe(false);
    for(let i=1;i<route.length;i++)expect(grid.segment(route[i-1],route[i],40,"ground",1)).toBe(true);
  });
  it("reserves separate fallback destinations when every requested target is across an impassable wall",()=>{
    const s=state(),m=map(),r=createMovementRules(m);for(let y=0;y<32;y++)m.walkable[y*32+16]=0;
    const ids=Array.from({length:5},(_,i)=>spawn(s,1024+i*128,2048));send(s,r,"move",ids,{target:{kind:"point",x:24*256,y:12*256}});
    for(let i=0;i<400;i++)stepSimulation(s,r);expect(s.movement.every(m=>m.order==="idle")).toBe(true);
    expect(s.entities.x.every(x=>x<16*256)).toBe(true);
    for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)expect((s.entities.x[i]-s.entities.x[j])**2+(s.entities.y[i]-s.entities.y[j])**2).toBeGreaterThanOrEqual(80**2);
  });
  it("keeps mixed-size units separated at a constrained destination",()=>{
    const s=state(),m=map(),r=createMovementRules(m),ids=Array.from({length:6},(_,i)=>spawn(s,1536+i*256,1536,{radius:i%2?80:40}));
    send(s,r,"move",ids,{target:{kind:"point",x:40,y:40}});for(let i=0;i<1000;i++)stepSimulation(s,r);
    expect(s.movement.every(m=>m.order==="idle")).toBe(true);
    for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)expect((s.entities.x[i]-s.entities.x[j])**2+(s.entities.y[i]-s.entities.y[j])**2).toBeGreaterThanOrEqual((s.entities.radius[i]+s.entities.radius[j])**2);
  });
  it("keeps destination reservations deterministic across a mid-move restore",()=>{
    const s=state(),m=map(),r=createMovementRules(m);const ids=Array.from({length:10},(_,i)=>spawn(s,1024+(i%5)*128,1024+Math.floor(i/5)*128));
    send(s,r,"move",ids,{target:{kind:"point",x:40,y:40}});for(let i=0;i<20;i++)stepSimulation(s,r);
    const restored=restoreSnapshot(serializeSnapshot(createPersistenceEnvelope(s,session,[],"2026-11-03T00:00:00.000Z"))).simulation;
    for(let i=0;i<150;i++){stepSimulation(s,r);stepSimulation(restored,createMovementRules(m));expect(checksum(s)).toBe(checksum(restored));}
  });
});
