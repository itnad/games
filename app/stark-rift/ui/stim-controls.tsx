import type { RenderSnapshot } from "../worker/render-snapshot";
import type { CommandBody } from "./economy-controls";
import { MARINE, STIM } from "../abilities/stim-state";
export function StimControls({snapshot,selected,running,select,issue}:{snapshot:RenderSnapshot;selected:number[];running:boolean;select?:(ids:number[])=>void;issue:(b:CommandBody)=>void}){
 const own=snapshot.entities.filter(e=>e.owner===snapshot.viewerPlayerId),marines=own.filter(e=>e.definitionId===MARINE),actors=marines.filter(e=>selected.includes(e.id)),ready=actors.filter(e=>e.health>10&&!e.stasisTicks),researched=snapshot.economy?.upgrades.some(u=>u.technologyId===STIM),practice=snapshot.combat?.scenario==='special-practice'&&snapshot.economy?.faction==='terran';
 if(!actors.length&&!practice)return null;
 return <div className="sr-stim-controls">
  {practice&&<div className="sr-action-row"><button data-stim-marines-select onClick={()=>select?.(marines.map(e=>e.id))}>스팀팩 마린 선택</button><button data-stim-academy-select onClick={()=>select?.(own.filter(e=>e.definitionId==='terran-academy').map(e=>e.id).slice(0,1))}>스팀팩 아카데미 선택</button></div>}
  {actors.length>0&&<><div className="sr-action-row"><button data-cast-ability="stim-packs" disabled={!running||!researched||!ready.length} onClick={()=>issue({kind:'castAbility',entityIds:actors.map(e=>e.id),target:{kind:'entity',entityId:actors[0].id},payload:{abilityId:STIM}})}>스팀팩 · 체력10 소모</button></div>
   {actors.map(e=><p key={e.id} className="sr-work-status" data-stim-status={e.id}>마린 #{e.id} · 체력 {e.health}{e.stimTicks?` · 스팀팩 ${Math.ceil(e.stimTicks/20)}초`:''}{e.health<=10?' · 체력 부족':''}</p>)}
   <p className="sr-help">{researched?'스팀팩 연구 완료':'아카데미에서 스팀팩 연구 필요 · ◆100 ◉100 · 25초'} · 체력이10을 넘는 마린만 사용합니다. 약12.4초 동안 이동1.5배·공격 간격 단축. 다시 사용하면 체력10을 추가 소모하고 시간을 갱신합니다. 이동·공격 지시는 유지되며 메딕으로 소모한 체력을 치료할 수 있습니다. 자동치료는5타일 안에서 부상병을 찾으며, 멀어진 마린은 수동치료로 지정하세요.</p>
  </>}
 </div>;
}
