import {afterEach,describe,it,expect,vi} from "vitest";
import type {ComponentProps} from "react";
const hooks=vi.hoisted(()=>({state:[] as unknown[],refs:[] as {current:unknown}[],effects:[] as (()=>void)[],si:0,ri:0}));
// Exercise the component's callbacks and snapshot effect without requiring a GPU/DOM.
vi.mock("react",()=>({
  useState:(initial:unknown)=>{
    const i=hooks.si++;
    if(!(i in hooks.state))hooks.state[i]=typeof initial==="function"?initial():initial;
    return [hooks.state[i],(value:unknown)=>{hooks.state[i]=typeof value==="function"?value(hooks.state[i]):value;}];
  },
  useRef:(initial:unknown)=>{const i=hooks.ri++;if(!(i in hooks.refs))hooks.refs[i]={current:initial};return hooks.refs[i];},
  useEffect:(effect:()=>void)=>{hooks.effects.push(effect);},
}));
vi.mock("../../app/stark-rift/ui/battle-screen",()=>({BattleScreen:()=>null}));
import {InteractiveBattle} from "../../app/stark-rift/ui/interactive-battle";
import {startSimulation} from "../../app/stark-rift/core/simulation";
import {createEntity} from "../../app/stark-rift/core/world";
import {createRenderSnapshot} from "../../app/stark-rift/worker/render-snapshot";
import {BattleCamera} from "../../app/stark-rift/render/camera";
import type {BattleMap} from "../../app/stark-rift/data/maps";
import type {SessionState} from "../../app/stark-rift/core/state";
import {isPortraitViewport,subscribePortraitMode} from "../../app/stark-rift/input/portrait-mode";
afterEach(()=>vi.unstubAllGlobals());
function fixture(){
  hooks.state=[];hooks.refs=[];hooks.effects=[];
  const map:BattleMap={id:"selection",widthTiles:32,heightTiles:32,symmetry:"rotational-180",terrain:new Uint8Array(1024),height:new Uint8Array(1024),walkable:new Uint8Array(1024).fill(1),buildable:new Uint8Array(1024).fill(1),spawnPoints:[{x:4,y:4},{x:28,y:28}],resourceNodes:[],regions:[]};
  const state=startSimulation(42,map.id,"fixture",[0,1].map(id=>({id,faction:"terran",minerals:50,gas:0,supplyUsedHalf:0,supplyCapHalf:100})));
  for(let i=0;i<4;i++)createEntity(state,{owner:0,definitionId:i===3?"worker":"unit",kind:i===3?"worker":"combat",x:1024+i*128,y:1024,health:100,speed:512,radius:40});
  state.players[0].controlGroups[0].entityIds=[1,2];state.players[0].controlGroups[1].entityIds=[3];
  const send=vi.fn(),onSessionChange=vi.fn();
  const props:ComponentProps<typeof InteractiveBattle>={map,snapshot:createRenderSnapshot(state,map,0,new Uint8Array(1024).fill(2)),ui:{tick:0,phase:"running",lastAcceptedSequence:0,controlGroups:structuredClone(state.players[0].controlGroups)},send,onSessionChange,onPause:()=>{},onRenderFailure:()=>{},notice:null,initialSession:{camera:{centerX:4096,centerY:4096,zoomLevel:1},selection:{entityIds:[1,2],controlGroupIds:[0]},openPanel:null}};
  const render=()=>{hooks.si=0;hooks.ri=0;hooks.effects=[];return InteractiveBattle(props);};
  const camera=new BattleCamera(32,32),size=()=>({width:360,height:400});
  return {props,send,onSessionChange,render,camera,size};
}
describe("selection after swiping",()=>{
  it("reuses the media query during rendering and detaches orientation subscriptions",()=>{
    const query={matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()},matchMedia=vi.fn(()=>query);
    vi.stubGlobal("window",{matchMedia});
    for(let frame=0;frame<10000;frame++)expect(isPortraitViewport()).toBe(true);
    const changed=vi.fn(),detach=subscribePortraitMode(changed);
    expect(matchMedia).toHaveBeenCalledTimes(1);query.matches=true;
    expect(isPortraitViewport()).toBe(false);detach();
    expect(query.removeEventListener).toHaveBeenCalledWith("change",changed);
  });
  it("does not replace existing groups when their confirmation is declined",()=>{
    const confirm=vi.fn(()=>false);vi.stubGlobal("window",{matchMedia:()=>({matches:false}),confirm});
    const f=fixture(),before=structuredClone(f.props.ui.controlGroups);
    f.render().props.inputFactory(f.camera,f.size).group({entityId:3,kind:"combat"});
    expect(confirm).toHaveBeenCalledTimes(1);expect(f.send).not.toHaveBeenCalled();
    expect(f.props.ui.controlGroups).toEqual(before);
  });
  it("blocks landscape commands without consuming their sequence",()=>{
    let landscape=true;
    vi.stubGlobal("window",{matchMedia:()=>({get matches(){return landscape;}})});
    const f=fixture(),actions=f.render().props.inputFactory(f.camera,f.size);
    actions.groundTap({x:200,y:220});
    expect(f.send).not.toHaveBeenCalled();
    landscape=false;
    actions.groundTap({x:200,y:220});
    expect(f.send.mock.lastCall![0]).toMatchObject({kind:"move",sequence:1,entityIds:[1,2]});
  });
  it("keeps a temporary group selected while paused without registering it or opening confirmation",()=>{
    const confirm=vi.fn();vi.stubGlobal("window",{matchMedia:()=>({matches:false}),confirm});
    const f=fixture();f.props.ui={...f.props.ui,phase:"paused"};
    f.render().props.inputFactory(f.camera,f.size).group({entityId:3,kind:"combat"});
    expect(f.send).not.toHaveBeenCalled();expect(confirm).not.toHaveBeenCalled();
    f.props.snapshot={...f.props.snapshot,tick:1};f.render();hooks.effects.slice(0,1).forEach(effect=>effect());f.render();
    expect(f.onSessionChange.mock.lastCall![0].selection).toEqual({entityIds:expect.arrayContaining([1,2,3]),controlGroupIds:[]});
  });
  it.each([
    {id:3,kind:"combat" as const,attack:true,ids:[3],slots:[]},
    {id:4,kind:"worker" as const,attack:false,ids:[4],slots:[]},
    {id:1,kind:"combat" as const,attack:true,ids:[1,2],slots:[0]},
  ])("keeps the intended selection through snapshots, restore and the next command: %o",({id,kind,attack,ids,slots})=>{
    const f=fixture(),view=f.render(),actions=view.props.inputFactory(f.camera,f.size);
    actions.swipe({entityId:id,kind},{x:200,y:220},attack);
    expect(f.send.mock.calls[0][0]).toMatchObject({kind:attack?"attackMove":"move",entityIds:ids});
    expect(f.onSessionChange.mock.lastCall![0].selection).toEqual({entityIds:ids,controlGroupIds:slots});
    f.props.snapshot={...f.props.snapshot,tick:1};f.render();hooks.effects.forEach(effect=>effect());f.render();
    actions.groundTap({x:210,y:230});
    expect(f.send.mock.calls[1][0]).toMatchObject({kind:"move",entityIds:ids,sequence:2});
    expect(f.props.ui.controlGroups.map(g=>g.entityIds)).toEqual([[1,2],[3],[],[],[]]);
    const saved:SessionState=structuredClone(f.onSessionChange.mock.lastCall![0]);
    f.props.ui={...f.props.ui,tick:1,lastAcceptedSequence:2};
    hooks.state=[];hooks.refs=[];f.props.initialSession=saved;
    const restored=f.render();hooks.effects.forEach(effect=>effect());f.render();
    restored.props.inputFactory(f.camera,f.size).groundTap({x:220,y:240});
    expect(f.send.mock.lastCall![0]).toMatchObject({kind:"move",entityIds:ids,sequence:3});
  });
  it("preserves a union of selected slots when swiping within that union",()=>{
    const f=fixture();f.props.initialSession.selection={entityIds:[1,2,3],controlGroupIds:[0,1]};
    const actions=f.render().props.inputFactory(f.camera,f.size);
    actions.swipe({entityId:3,kind:"combat"},{x:200,y:220},true);
    f.props.snapshot={...f.props.snapshot,tick:1};f.render();hooks.effects.forEach(effect=>effect());f.render();
    actions.groundTap({x:210,y:230});
    expect(f.send.mock.lastCall![0].entityIds).toEqual([1,2,3]);
    expect(f.onSessionChange.mock.lastCall![0].selection.controlGroupIds).toEqual([0,1]);
  });
});
