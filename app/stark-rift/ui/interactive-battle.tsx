"use client";
import { useEffect, useRef, useState } from "react";
import type { BattleMap } from "../data/maps";
import type { RenderSnapshot } from "../worker/render-snapshot";
import type { WorkerToMainMessage } from "../worker/messages";
import type { SessionState } from "../core/state";
import type { GameCommand } from "../core/commands";
import { hitTest, selectNearby } from "../input/selection";
import type { BattleCamera } from "../render/camera";
import type { GestureActions } from "../input/camera-gestures";
import { BattleScreen } from "./battle-screen";
import { isPortraitViewport, subscribePortraitMode } from "../input/portrait-mode";
import {EconomyControls} from './economy-controls';
import {previewBuilding} from './placement-preview';
import {economyDefinition} from '../data/economy-catalog';
type UiState=Extract<WorkerToMainMessage,{kind:"uiState"}>["payload"];
type Body<T=GameCommand>=T extends GameCommand?Omit<T,"sequence"|"issuedTick"|"executeTick"|"playerId"|"source">:never;
export function InteractiveBattle({map,snapshot,ui,send,onPause,onRenderFailure,initialSession,onSessionChange,notice}:{map:BattleMap;snapshot:RenderSnapshot;ui:UiState;send:(command:GameCommand)=>void;onPause:()=>void;onRenderFailure:()=>void;initialSession:SessionState;onSessionChange:(session:SessionState)=>void;notice:string|null}){
  const [selected,setSelected]=useState<number[]>(initialSession.selection.entityIds),[slots,setSlots]=useState<number[]>(initialSession.selection.controlGroupIds);
  const [preview,setPreview]=useState<number[]>([]),[pending,setPending]=useState<number[]|null>(null),[mode,setMode]=useState<"move"|"patrol"|"rally"|null>(null);
  const [build,setBuild]=useState<{id:string;repeat:boolean}|null>(null),[buildPoint,setBuildPoint]=useState<{x:number;y:number}|null>(null);
  const placement=build&&buildPoint?previewBuilding(map,snapshot,selected[0],build.id,buildPoint):null;
  const latest=useRef({snapshot,ui,selected,slots,mode,build});latest.current={snapshot,ui,selected,slots,mode,build};
  const sequence=useRef(ui.lastAcceptedSequence),camera=useRef<BattleCamera|null>(null),dimensions=useRef(()=>({width:1,height:1}));
  sequence.current=Math.max(sequence.current,ui.lastAcceptedSequence);
  const session=useRef(structuredClone(initialSession));
  const callbacks=useRef({send,onSessionChange});callbacks.current={send,onSessionChange};
  const select=(ids:number[],groups:number[]=[])=>{setSelected(ids);setSlots(groups);session.current.selection={entityIds:ids,controlGroupIds:groups};callbacks.current.onSessionChange(structuredClone(session.current));};
  useEffect(()=>{
    const ids=slots.length?slots.flatMap(slot=>ui.controlGroups[slot].entityIds):selected;
    const alive=[...new Set(ids)].filter(id=>snapshot.entities.some(e=>e.id===id&&e.owner===snapshot.viewerPlayerId));
    if(alive.join(",")!==selected.join(","))select(alive,slots);
  },[snapshot,ui]);
  useEffect(()=>{if(build&&snapshot.economy?.faction==='zerg'&&!selected.some(id=>snapshot.entities.some(e=>e.id===id&&e.kind==='worker'))){setBuild(null);setBuildPoint(null);}},[snapshot,selected,build]);
  const issue=(body:Body)=>{
    const current=latest.current,tick=Math.max(current.snapshot.tick,current.ui.tick);
    if(current.ui.phase!=="running"||!isPortraitViewport())return;
    callbacks.current.send({...body,sequence:++sequence.current,issuedTick:tick,executeTick:tick+1,playerId:current.snapshot.viewerPlayerId,source:"player"} as GameCommand);
  };
  const register=(ids:number[],slot:number)=>{
    if(latest.current.ui.phase!=="running"||!isPortraitViewport())return;
    const groups=latest.current.ui.controlGroups;
    const conflict=groups[slot].entityIds.some(id=>!ids.includes(id))||groups.some((g,i)=>i!==slot&&g.entityIds.some(id=>ids.includes(id)));
    if(conflict&&!window.confirm("기존 부대를 옮기거나 이 슬롯을 교체할까요?"))return;
    issue({kind:"assignGroup",entityIds:ids,payload:{slot,confirmed:conflict}});setPending(null);select(ids,[slot]);
  };
  const focus=(ids:number[])=>{
    const entities=latest.current.snapshot.entities.filter(e=>ids.includes(e.id));const c=camera.current;if(!entities.length||!c)return;
    const size=dimensions.current();c.setCenter(entities.reduce((sum,e)=>sum+e.x,0)/entities.length,entities.reduce((sum,e)=>sum+e.y,0)/entities.length,size.width,size.height);
    session.current.camera={centerX:Math.round(c.centerX),centerY:Math.round(c.centerY),zoomLevel:Math.round(c.zoom) as 0|1|2};callbacks.current.onSessionChange(structuredClone(session.current));
  };
  const bind=(c:BattleCamera,size:()=>{width:number;height:number}):GestureActions=>{
    camera.current=c;dimensions.current=size;
    const world=(point:{x:number;y:number})=>{const d=size(),p=c.screenToWorld(point.x,point.y,d.width,d.height);return {x:Math.round(p.x),y:Math.round(p.y)};};
    const target=(point:{x:number;y:number})=>{const p=world(point);return {kind:"point" as const,x:p.x,y:p.y};};
    return {
      hitTest:point=>{
        const current=latest.current;if(current.build||current.mode==='rally')return null;
        const p=world(point),hasWorker=current.selected.some(id=>current.snapshot.entities.find(e=>e.id===id)?.kind==='worker');
        if(hasWorker&&current.snapshot.economy){const n=map.resourceNodes.findIndex(n=>current.snapshot.visibility[n.y*map.widthTiles+n.x]===2&&Math.abs(p.x-(n.x*256+128))<=200&&Math.abs(p.y-(n.y*256+128))<=200);if(n>=0)return {entityId:-n-1,kind:'worker'};}
        const d=size(),e=hitTest(latest.current.snapshot,world(point),Math.ceil(12/c.scale(d.width,d.height)));return e?{entityId:e.id,kind:e.kind}:null;},
      tap:hit=>{
        const current=latest.current;if(hit.entityId<0){const n=map.resourceNodes[-hit.entityId-1];if(n)issue({kind:'gather',entityIds:current.selected,payload:{resourceId:n.id}});return;}
        const targetBuilding=current.snapshot.economy?.structures.find(b=>b.entityId===hit.entityId&&!b.completed&&b.builderId===null);
        if(targetBuilding&&current.selected.some(id=>current.snapshot.entities.find(e=>e.id===id)?.definitionId==='terran-scv')){issue({kind:'resumeConstruction',entityIds:current.selected,target:{kind:'entity',entityId:hit.entityId}});return;}
        const e=latest.current.snapshot.entities.find(e=>e.id===hit.entityId);if(!e)return;
        if(e.owner===latest.current.snapshot.viewerPlayerId){select([e.id]);setMode(null);setBuild(null);setBuildPoint(null);}
        else if(latest.current.selected.length)issue({kind:"focusAttack",entityIds:latest.current.selected,target:{kind:"entity",entityId:e.id}});
      },
      preview:hit=>setPreview(hit?selectNearby(latest.current.snapshot,hit.entityId):[]),
      group:hit=>{
        const current=latest.current,e=current.snapshot.entities.find(e=>e.id===hit.entityId);if(!e||e.owner!==current.snapshot.viewerPlayerId)return;
        const refill=current.slots.length===1?current.ui.controlGroups[current.slots[0]].entityIds:[];
        const ids=selectNearby(current.snapshot,e.id,refill);select(ids);setPreview([]);
        if(e.kind!=="combat")return;
        const refillSlot=current.slots.length===1&&refill.every(id=>current.snapshot.entities.some(e=>e.id===id&&e.definitionId===current.snapshot.entities.find(e=>e.id===hit.entityId)?.definitionId))?current.slots[0]:-1;
        const slot=refillSlot>=0?refillSlot:current.ui.controlGroups.findIndex(g=>g.entityIds.length===0);
        if(slot>=0)register(ids,slot);else setPending(ids);
      },
      swipe:(hit,point,attack)=>{
        if(hit.kind==="building"){
          if(latest.current.snapshot.economy&&latest.current.snapshot.entities.some(e=>e.id===hit.entityId&&e.owner===latest.current.snapshot.viewerPlayerId)){const ids=latest.current.selected.includes(hit.entityId)?latest.current.selected:[hit.entityId];select(ids);issue({kind:'setRallyPoint',entityIds:ids,target:target(point)});}return;
        }
        const inSelection=latest.current.selected.includes(hit.entityId),ids=inSelection?latest.current.selected:[hit.entityId];
        if(!latest.current.snapshot.entities.some(e=>e.id===hit.entityId&&e.owner===latest.current.snapshot.viewerPlayerId))return;
        select(ids,inSelection?latest.current.slots:[]);issue({kind:attack?"attackMove":"move",entityIds:ids,target:target(point)});
      },
      groundTap:point=>{const current=latest.current;if(!current.selected.length)return;
        if(current.build){setBuildPoint(world(point));return;}
        const buildings=current.snapshot.economy&&current.selected.every(id=>current.snapshot.entities.find(e=>e.id===id)?.kind==='building');
        if(current.mode==='rally'||buildings){issue({kind:'setRallyPoint',entityIds:current.selected,target:target(point)});setMode(null);return;}
        issue({kind:current.mode??'move',entityIds:current.selected,target:target(point)});setMode(null);
      },
    };
  };
  const drag=useRef<{id:number;origin:number;x:number;y:number;visited:number[]}|null>(null);
  useEffect(()=>subscribePortraitMode(()=>{if(!isPortraitViewport()){drag.current=null;setPreview([]);}}),[]);
  const chooseSlot=(slot:number,add=false)=>{const groups=add?[...new Set([...latest.current.slots,slot])]:[slot];select(groups.flatMap(i=>latest.current.ui.controlGroups[i].entityIds),groups);};
  const controls=<><div className="sr-groups" onPointerMove={event=>{
    const d=drag.current;if(!d||d.id!==event.pointerId)return;
    const dx=event.clientX-d.x,dy=event.clientY-d.y;
    const button=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLButtonElement>("button[data-slot]");
    if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)&&button){const slot=Number(button.dataset.slot);if(!d.visited.includes(slot)){d.visited.push(slot);select(d.visited.flatMap(i=>latest.current.ui.controlGroups[i].entityIds),d.visited);}}
  }} onPointerUp={event=>{
    const d=drag.current;drag.current=null;if(!d||d.id!==event.pointerId)return;
    if(event.clientY-d.y< -32&&Math.abs(event.clientY-d.y)>Math.abs(event.clientX-d.x)){
      const c=camera.current,canvas=event.currentTarget.closest(".sr-battle")?.querySelector(".sr-viewport canvas"),rect=canvas?.getBoundingClientRect();if(c&&rect&&event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom){const point=c.screenToWorld(event.clientX-rect.left,event.clientY-rect.top,rect.width,rect.height);const ids=d.visited.flatMap(i=>latest.current.ui.controlGroups[i].entityIds);if(ids.length)issue({kind:"attackMove",entityIds:ids,target:{kind:"point",x:Math.round(point.x),y:Math.round(point.y)}});}
    }
  }} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}>
    {[0,1,2,3,4].map(slot=><button key={slot} data-slot={slot} aria-pressed={slots.includes(slot)} onPointerDown={event=>{if(pending)return;event.currentTarget.parentElement?.setPointerCapture(event.pointerId);drag.current={id:event.pointerId,origin:slot,x:event.clientX,y:event.clientY,visited:[slot]};chooseSlot(slot,event.ctrlKey||event.metaKey);}} onDoubleClick={()=>focus(ui.controlGroups[slot].entityIds)} onClick={event=>{if(pending)register(pending,slot);else if(event.detail===0)chooseSlot(slot);}}>{slot+1} · {ui.controlGroups[slot].entityIds.length}</button>)}
  </div><div className="sr-command-space sr-commands">
    {pending&&<span>등록할 부대 슬롯을 선택해 주세요.</span>}{mode&&<span>전장에서 목적지를 선택해 주세요.</span>}{notice&&<span role="status">{notice}</span>}
    {snapshot.economy?<>
      {build&&<div className="sr-placement-controls"><strong>{economyDefinition(build.id)?.name}{build.repeat?' · 연속 배치':''}</strong><span>{placement?.reason??'전장에서 건설할 위치를 터치하세요.'}</span><button disabled={ui.phase!=='running'||!placement||placement.status==='blocked'} onClick={()=>{if(!buildPoint)return;issue({kind:'placeBuilding',entityIds:selected,target:{kind:'point',...buildPoint},payload:{buildingId:build.id,queued:build.repeat}});setBuildPoint(null);if(!build.repeat)setBuild(null);}}>건설 확정</button><button onClick={()=>{setBuild(null);setBuildPoint(null);}}>배치 취소</button></div>}
      <EconomyControls snapshot={snapshot} selected={selected} running={ui.phase==='running'} issue={issue} build={(id,repeat)=>{setBuild({id,repeat});setBuildPoint(null);setMode(null);}} rally={()=>{setMode('rally');setBuild(null);setBuildPoint(null);}}/>
    </>:<><span>선택 {selected.length}</span>
    <button disabled={ui.phase!=="running"||!selected.length} onClick={()=>issue({kind:"stop",entityIds:selected})}>정지</button><button disabled={ui.phase!=="running"||!selected.length} onClick={()=>issue({kind:"hold",entityIds:selected})}>위치 사수</button><button disabled={ui.phase!=="running"||!selected.length} onClick={()=>setMode("patrol")}>순찰</button>
    {(["line","column","spread"] as const).map((formation,i)=><button key={formation} disabled={ui.phase!=="running"||!selected.length} onClick={()=>issue({kind:"setFormation",entityIds:selected,payload:{formation}})}>{["전열","종대","분산"][i]}</button>)}
    {(["free","formation","breakthrough"] as const).map((stance,i)=><button key={stance} disabled={ui.phase!=="running"||!selected.length} onClick={()=>issue({kind:"setStance",entityIds:selected,payload:{stance}})}>{["자율 교전","대열 유지","목표 돌파"][i]}</button>)}
    </>}
    <button onClick={()=>{select([]);setMode(null);setPending(null);setBuild(null);setBuildPoint(null);}}>선택 해제</button>
  </div></>;
  return <BattleScreen placement={placement} onMinimapPoint={point=>{if(latest.current.mode!=='rally')return false;issue({kind:'setRallyPoint',entityIds:latest.current.selected,target:{kind:'point',x:Math.round(point.x),y:Math.round(point.y)}});setMode(null);return true;}} map={map} snapshot={snapshot} initialCamera={initialSession.camera} inputFactory={bind} controls={controls} selectedIds={selected} previewIds={preview} onPause={onPause} onRenderFailure={onRenderFailure} onCameraChange={value=>{session.current.camera=value;callbacks.current.onSessionChange(structuredClone(session.current));}}/>;
}
