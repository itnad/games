import {describe,it,expect} from "vitest";
import {startSimulation,enqueueCommand,stepSimulation} from "../../app/stark-rift/core/simulation";
import {createEntity} from "../../app/stark-rift/core/world";
import {createMovementRules} from "../../app/stark-rift/core/movement-rules";
import {createPersistenceEnvelope,restoreSnapshot,serializeSnapshot} from "../../app/stark-rift/core/state";
import {checksum} from "../../app/stark-rift/core/checksum";
import type {BattleMap} from "../../app/stark-rift/data/maps";
import {NavigationGrid} from "../../app/stark-rift/pathfinding/navigation";
import {formationOffsets} from "../../app/stark-rift/pathfinding/formation";
import {createRenderSnapshot} from "../../app/stark-rift/worker/render-snapshot";
import {hitTest,selectNearby} from "../../app/stark-rift/input/selection";
import {GestureMachine} from "../../app/stark-rift/input/gesture-machine";
const players=[0,1].map(id=>({id,faction:"terran" as const,minerals:50,gas:0,supplyUsedHalf:0,supplyCapHalf:100}));
function flat(size=32):BattleMap{return{id:"test",widthTiles:size,heightTiles:size,symmetry:"rotational-180",terrain:new Uint8Array(size*size),height:new Uint8Array(size*size),walkable:new Uint8Array(size*size).fill(1),buildable:new Uint8Array(size*size).fill(1),spawnPoints:[{x:4,y:4},{x:size-4,y:size-4}],resourceNodes:[],regions:[]};}
const make=()=>startSimulation(42,"test","fixture",players);
const spawn=(state:ReturnType<typeof make>,x:number,y:number,extra:Partial<Parameters<typeof createEntity>[1]>={})=>createEntity(state,{owner:0,definitionId:"test-unit",x,y,health:100,speed:512,radius:40,...extra});
function send(state:ReturnType<typeof make>,rules:ReturnType<typeof createMovementRules>,kind:string,ids:number[],extra:object={}){const sequence=state.commandState.lastAcceptedSequenceByPlayer[0]+1;expect(enqueueCommand(state,{sequence,issuedTick:state.tick,executeTick:state.tick+1,playerId:0,source:"player",kind,entityIds:ids,...extra},rules).ok).toBe(true);}
const session={camera:{centerX:0,centerY:0,zoomLevel:1 as const},selection:{entityIds:[],controlGroupIds:[]},openPanel:null};
describe("selection and group assignment",()=>{
  it("selects nearest same-kind units within four tiles, with ID tie breaks and a ten-unit cap",()=>{
    const state=make(),map=flat();for(let i=0;i<12;i++)spawn(state,1024+(i%4)*128,1024+Math.floor(i/4)*128);spawn(state,1024,1024,{owner:1});spawn(state,1024,1024,{kind:"worker",definitionId:"worker"});
    const snapshot=createRenderSnapshot(state,map,0,new Uint8Array(32*32).fill(2));
    expect(hitTest(snapshot,{x:1024,y:1024})?.id).toBe(1);expect(selectNearby(snapshot,1)).toHaveLength(10);expect(selectNearby(snapshot,13)).toEqual([]);expect(selectNearby(snapshot,14)).toEqual([14]);
  });
  it("requires confirmation for group transfers and preserves formation/stance",()=>{
    const state=make(),map=flat(),rules=createMovementRules(map);const ids=[spawn(state,1024,1024),spawn(state,1152,1024)];
    send(state,rules,"assignGroup",ids,{payload:{slot:0,confirmed:false}});stepSimulation(state,rules);expect(state.players[0].controlGroups[0].entityIds).toEqual(ids);
    send(state,rules,"assignGroup",ids,{payload:{slot:1,confirmed:false}});expect(stepSimulation(state,rules)[0].accepted).toBe(false);
    send(state,rules,"assignGroup",ids,{payload:{slot:1,confirmed:true}});stepSimulation(state,rules);expect(state.players[0].controlGroups[0].entityIds).toEqual([]);
    send(state,rules,"setFormation",ids,{payload:{formation:"spread"}});send(state,rules,"setStance",ids,{payload:{stance:"formation"}});stepSimulation(state,rules);
    expect(state.players[0].controlGroups[1]).toMatchObject({entityIds:ids,formation:"spread",stance:"formation"});
  });
});
describe("movement commands",()=>{
  it("repeats patrol legs until a new command replaces the order",()=>{
    const state=make(),map=flat(),rules=createMovementRules(map),id=spawn(state,1024,1024);
    send(state,rules,"patrol",[id],{target:{kind:"point",x:2048,y:1024}});
    let reached=false,returned=false;for(let i=0;i<220;i++){stepSimulation(state,rules);if(state.entities.x[0]>2000)reached=true;if(reached&&state.entities.x[0]<1150)returned=true;}
    expect(reached).toBe(true);expect(returned).toBe(true);expect(state.movement[0].order).toBe("patrol");
    send(state,rules,"stop",[id]);stepSimulation(state,rules);expect(state.movement[0].order).toBe("idle");
  });
  it("invalidates obstacle paths on building geometry changes, not ordinary damage",()=>{
    const state=make(),map=flat(),rules=createMovementRules(map),id=spawn(state,1024,1024);
    send(state,rules,"move",[id],{target:{kind:"point",x:4096,y:1024}});stepSimulation(state,rules);
    const version=state.map.obstacleVersion;spawn(state,2048,1024,{kind:"building",speed:0,radius:256});stepSimulation(state,rules);
    expect(state.map.obstacleVersion).toBe(version+1);state.entities.health[1]--;stepSimulation(state,rules);expect(state.map.obstacleVersion).toBe(version+1);
  });
  it("moves around terrain, stops, holds and rejects building movement",()=>{
    const state=make(),map=flat(),rules=createMovementRules(map);const id=spawn(state,1024,1024);map.walkable[4*32+6]=0;
    send(state,rules,"move",[id],{target:{kind:"point",x:2560,y:1024}});
    for(let tick=0;tick<160;tick++){stepSimulation(state,rules);expect(new NavigationGrid(map,state).clear({x:state.entities.x[0],y:state.entities.y[0]},40,"ground")).toBe(true);}
    expect(state.entities.x[0]).toBeGreaterThan(2300);expect(state.movement[0].order).toBe("idle");
    send(state,rules,"patrol",[id],{target:{kind:"point",x:1024,y:1024}});for(let i=0;i<30;i++)stepSimulation(state,rules);
    send(state,rules,"hold",[id]);stepSimulation(state,rules);const x=state.entities.x[0];for(let i=0;i<20;i++)stepSimulation(state,rules);expect(state.entities.x[0]).toBe(x);expect(state.movement[0].order).toBe("hold");
    const building=spawn(state,1024,2048,{kind:"building",speed:0});send(state,rules,"move",[building],{target:{kind:"point",x:1500,y:1500}});expect(stepSimulation(state,rules)[0].accepted).toBe(false);
  });
  it("corrects an impassable destination to a reachable cell",()=>{
    const state=make(),map=flat(16),rules=createMovementRules(map),id=spawn(state,1024,1024);for(let y=6;y<10;y++)for(let x=6;x<10;x++)map.walkable[y*16+x]=0;
    send(state,rules,"move",[id],{target:{kind:"point",x:2048,y:2048}});for(let i=0;i<250;i++)stepSimulation(state,rules);
    expect(state.movement[0].order).toBe("idle");expect(new NavigationGrid(map,state).clear({x:state.entities.x[0],y:state.entities.y[0]},40,"ground")).toBe(true);expect(state.entities.x[0]===2048&&state.entities.y[0]===2048).toBe(false);
  });
  it("requires visible enemy targets and performs focus pursuit without applying combat damage",()=>{
    const state=make(),map=flat(),id=spawn(state,1024,1024),enemy=spawn(state,2048,1024,{owner:1,speed:0});
    const hidden=createMovementRules(map);send(state,hidden,"focusAttack",[id],{target:{kind:"entity",entityId:enemy}});expect(stepSimulation(state,hidden)[0].accepted).toBe(false);
    const rules=createMovementRules(map,()=>true);send(state,rules,"focusAttack",[id],{target:{kind:"entity",entityId:enemy}});for(let i=0;i<100;i++)stepSimulation(state,rules);
    expect(state.entities.x[0]).toBeGreaterThan(1700);expect(state.entities.health[1]).toBe(100);
  });
  it("lets air units cross the ground rift",()=>{
    const state=make(),map=flat(16),rules=createMovementRules(map);for(let y=0;y<16;y++)map.walkable[y*16+8]=0;
    const id=spawn(state,1024,1024,{layer:"air"});send(state,rules,"move",[id],{target:{kind:"point",x:3072,y:1024}});for(let i=0;i<180;i++)stepSimulation(state,rules);expect(state.entities.x[0]).toBeGreaterThan(2900);
  });
});
describe("stage 3 completion gates",()=>{
  it("moves fifty units through a narrow passage without overlaps and stays within search budgets",()=>{
    const state=make(),map=flat(),rules=createMovementRules(map);for(let y=0;y<32;y++)if(y!==15)map.walkable[y*32+15]=0;
    const ids:number[]=[];for(let i=0;i<50;i++)ids.push(spawn(state,1024+(i%10)*128,3072+Math.floor(i/10)*128));
    for(let slot=0;slot<5;slot++)send(state,rules,"assignGroup",ids.slice(slot*10,slot*10+10),{payload:{slot,confirmed:false}});stepSimulation(state,rules);
    send(state,rules,"move",ids,{target:{kind:"point",x:24*256,y:16*256}});
    let reused=0,column=false;for(let tick=0;tick<1200;tick++){
      stepSimulation(state,rules);expect(state.navigation.lastStarted).toBeLessThanOrEqual(4);expect(state.navigation.lastExpanded).toBeLessThanOrEqual(8000);
      reused+=state.navigation.lastReused;
      column ||= state.movement.some(m=>m.transitFormation==="column");
      if(tick%20===0)for(let i=0;i<50;i++)for(let j=i+1;j<50;j++)expect((state.entities.x[i]-state.entities.x[j])**2+(state.entities.y[i]-state.entities.y[j])**2).toBeGreaterThanOrEqual(80**2);
    }
    expect(state.entities.x.filter(x=>x>16*256)).toHaveLength(50);
    expect(state.movement.every(m=>m.order==="idle")).toBe(true);
    expect(reused).toBeGreaterThan(0);
    expect(column).toBe(true);
  },20000);
  it("preserves incremental search, shared cache and movement across a save/restore boundary",()=>{
    const map=flat(48),state=make(),rules=createMovementRules(map);for(let y=0;y<48;y++)map.walkable[y*48+24]=0;
    const ids=Array.from({length:8},(_,i)=>spawn(state,1024+i*128,1024));send(state,rules,"move",ids,{target:{kind:"point",x:40*256,y:40*256}});stepSimulation(state,rules);
    expect(state.navigation.jobs.length).toBeGreaterThan(0);
    const saved=createPersistenceEnvelope(state,session,[],"2026-11-02T00:00:00.000Z"),restored=restoreSnapshot(serializeSnapshot(saved)).simulation;
    for(let i=0;i<150;i++){stepSimulation(state,rules);stepSimulation(restored,createMovementRules(map));expect(checksum(restored)).toBe(checksum(state));}
  },20000);
  it("provides three distinct formation shapes",()=>{
    const line=formationOffsets(10,128,"line"),column=formationOffsets(10,128,"column"),spread=formationOffsets(10,128,"spread");
    expect(new Set(line.map(p=>p.y)).size).toBe(1);expect(new Set(column.map(p=>p.x)).size).toBe(1);expect(new Set(spread.map(p=>p.x)).size).toBeGreaterThan(1);
  });
});
describe("terrain touch arbitration",()=>{
  it("sends a short terrain tap as a destination and a terrain drag only as a camera pan",()=>{
    const events:string[]=[];const machine=new GestureMachine({hitTest:()=>null,groundTap:()=>events.push("destination"),tap:()=>events.push("unit"),preview:()=>{},group:()=>{},swipe:()=>events.push("command"),pan:()=>events.push("pan"),pinch:()=>{},pinchEnd:()=>{}});
    machine.down(1,{x:0,y:0},0);machine.up(1,100);expect(events).toEqual(["destination"]);events.length=0;
    machine.down(1,{x:0,y:0},0);machine.move(1,{x:20,y:0});machine.up(1,100);expect(events).toEqual(["pan"]);
  });
});
