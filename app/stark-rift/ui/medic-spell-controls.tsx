import type { RenderSnapshot } from "../worker/render-snapshot";
import { MEDIC } from "../abilities/medic-data";
import { OPTICAL,RESTORATION,MEDIC_SPELLS } from "../abilities/medic-spells-state";
export function MedicSpellControls({snapshot,selected,running,select,cast}:{snapshot:RenderSnapshot;selected:number[];running:boolean;select?:(ids:number[])=>void;cast?:(id:number,ability:typeof OPTICAL|typeof RESTORATION)=>void}){
 const own=snapshot.entities.filter(e=>e.owner===snapshot.viewerPlayerId),actors=own.filter(e=>e.definitionId===MEDIC&&selected.includes(e.id)),academies=own.filter(e=>e.definitionId==='terran-academy').map(e=>e.id),practice=snapshot.combat?.scenario==='special-practice'&&snapshot.economy?.faction==='terran';
 if(!actors.length&&!practice)return null;
 return <div className="sr-medic-spell-controls">
  {practice&&<div className="sr-action-row"><button data-medic-spell-academy-select disabled={!academies.length} onClick={()=>select?.(academies.slice(0,1))}>메딕 기술 아카데미 선택</button></div>}
  {actors.length>0&&<><div className="sr-action-row">{MEDIC_SPELLS.map(t=>{const ready=actors.find(e=>!e.stasisTicks&&!e.medicSpellCooldownTicks&&(e.energy??0)>=t.energy),researched=snapshot.economy?.upgrades.some(u=>u.technologyId===t.id);return <button key={t.id} data-cast-ability={t.id} disabled={!running||!ready||!researched} onClick={()=>ready&&cast?.(ready.id,t.id as typeof OPTICAL|typeof RESTORATION)}>{t.title} · 에너지{t.energy}</button>;})}</div>
  <p className="sr-help">아카데미 연구 필요. 옵티컬 플레어:9타일 안 유닛을 영구 실명(시야2타일·탐지 중단). 아군도 대상입니다. 리스토레이션:6타일 안 실명·인스네어·패러사이트를 해제합니다. 체력 회복이나 스테이시스·스팀팩·은폐 해제 효과는 없습니다. 시전 버튼 → 유닛 또는 아군 부대 슬롯 터치. 사거리 밖은 이동 후 다시 지정하세요.</p>
  {actors.some(e=>e.medicSpellCooldownTicks)&&<p className="sr-work-status" data-medic-spell-cooldown>기술 시전 후 대기 중 · 약0.9초</p>}
  </>}
 </div>;
}
