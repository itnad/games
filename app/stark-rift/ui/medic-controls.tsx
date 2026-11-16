import { useEffect, useRef } from "react";
import type { RenderSnapshot } from "../worker/render-snapshot";
import type { CommandBody } from "./economy-controls";
import { MEDIC, HEALING } from "../abilities/medic-data";
export function MedicControls({snapshot,selected,running,select,heal,issue}:{snapshot:RenderSnapshot;selected:number[];running:boolean;select?:(ids:number[])=>void;heal?:(id:number)=>void;issue:(b:CommandBody)=>void}){
 const owned=snapshot.entities.filter(e=>e.owner===snapshot.viewerPlayerId),all=owned.filter(e=>e.definitionId===MEDIC),actors=all.filter(e=>selected.includes(e.id)),on=actors.length>0&&actors.every(e=>e.healAutocast),ready=actors.find(e=>!e.stasisTicks&&(e.energy??0)>=1);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),long=useRef(false),point=useRef<{x:number;y:number}|null>(null),current=useRef({actors,running});current.current={actors,running};
 const end=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;point.current=null;};
 useEffect(()=>{end();long.current=false;return end;},[selected.join(','),running]);
 const toggle=()=>{const c=current.current;if(c.running&&c.actors.length)issue({kind:'toggleAutocast',entityIds:c.actors.map(e=>e.id),payload:{abilityId:HEALING,enabled:!c.actors.every(e=>e.healAutocast)}});};
 if(!all.length)return null;
 return <div className="sr-medic-controls">
  {snapshot.combat?.scenario==='special-practice'&&<><div className="sr-action-row">
   <button data-medic-select onClick={()=>select?.(all.map(e=>e.id))}>메딕 선택</button>
   <button data-medic-patient-select onClick={()=>select?.(owned.filter(e=>e.definitionId==='terran-marine').map(e=>e.id))}>치료 연습 마린 선택</button>
   <button data-medic-barracks-select onClick={()=>select?.(owned.filter(e=>e.definitionId==='terran-barracks').map(e=>e.id).slice(0,1))}>메딕 생산 배럭 선택</button>
  </div><p className="sr-help">치료 연습: 부상 마린 2기 · 메딕 2기 · 5번 슬롯. 메딕 선택 → 치료 → 1번 슬롯 또는 부상병 터치. 배럭 생산에는 아카데미가 필요합니다.</p></>}
  {actors.length>0&&<><div className="sr-action-row">
   <button data-cast-ability="healing" disabled={!running||!ready} aria-pressed={on}
    onContextMenu={e=>e.preventDefault()} onPointerDown={e=>{if(!e.isPrimary||e.button!==0)return;end();long.current=false;point.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);timer.current=setTimeout(()=>{long.current=true;timer.current=null;toggle();},550);}}
    onPointerMove={e=>{if(point.current&&Math.hypot(e.clientX-point.current.x,e.clientY-point.current.y)>10){end();long.current=true;}}}
    onPointerUp={end} onLostPointerCapture={end} onBlur={end} onPointerCancel={()=>{end();long.current=true;}}
    onClick={()=>{end();if(!long.current&&ready)heal?.(ready.id);long.current=false;}}>치료{on?' · A':''}</button>
   <button data-healing-autocast-toggle disabled={!running} aria-pressed={on} onClick={toggle}>자동치료 {on?'끄기':'켜기'}</button>
  </div>
  {actors.map(e=><p className="sr-work-status" data-medic-energy={e.id} key={e.id}>메딕 #{e.id} · 에너지 {e.energy??0} / {e.maxEnergy??200}{e.healTargetId?` · 치료 대상 #${e.healTargetId}`:''}{e.stasisTicks?' · 스테이시스 정지 중':''}</p>)}
  <p className="sr-help">치료 중에만 에너지를 사용합니다. 자동치료는 가까운 부상병에게 접근하며 이동·정지 지시를 우선합니다. 위치 사수 중에는 제자리에서 치료합니다. 치료 길게 누르기 또는 자동치료 버튼으로 전환하세요. 자신·기계·공중·적 유닛은 치료할 수 없습니다.</p>
  </>}
 </div>;
}
