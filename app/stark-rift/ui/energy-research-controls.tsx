import type { RenderSnapshot } from "../worker/render-snapshot";
import { ENERGY_UPGRADES } from "../abilities/energy-upgrades";

export function EnergyResearchControls({snapshot,select}:{snapshot:RenderSnapshot;select?:(ids:number[])=>void}) {
  if(snapshot.combat?.scenario!=="special-practice" || snapshot.economy?.faction==="zerg")return null;
  const own=snapshot.entities.filter(e=>e.owner===snapshot.viewerPlayerId);
  if(!ENERGY_UPGRADES.some(t=>own.some(e=>e.definitionId===t.producer)))return <p className="sr-help">에너지 연구시설이 없는 이전 연습 저장은 그대로 유지됩니다. 새 테스트를 시작하면 연구시설과 연습 자원이 제공됩니다.</p>;
  return <div className="sr-energy-research-controls">
    <div className="sr-action-row">{ENERGY_UPGRADES.map(t=>{
      const ids=own.filter(e=>e.definitionId===t.producer).map(e=>e.id);
      return ids.length>0 && <button key={t.id} data-energy-facility={t.id} onClick={()=>select?.(ids.slice(0,1))}>{t.title} 연구소 선택</button>;
    })}</div>
    <p className="sr-help">에너지 연구 연습 · 연구시설과 미네랄 600·가스 650을 추가 제공합니다. 연구 후 최대 250, 새 생산 유닛은 62.5로 시작합니다. 현재 에너지는 즉시 늘어나지 않습니다. 일반 운영에서는 시설 건설과 연구 비용이 필요합니다.</p>
  </div>;
}
