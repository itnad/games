import type { RenderSnapshot } from "../worker/render-snapshot";
import type { CommandBody } from "./economy-controls";
import { HYDRALISK, LURKER, LURKER_ASPECT, LURKER_EGG } from "../abilities/lurker-state";
export function LurkerControls({ snapshot, selected, running, issue, select }: {
  snapshot: RenderSnapshot; selected: number[]; running: boolean;
  issue: (body: CommandBody) => void; select?: (ids: number[]) => void;
}) {
  const all = snapshot.entities.filter((e) => e.owner === snapshot.viewerPlayerId && [HYDRALISK, LURKER, LURKER_EGG].includes(e.definitionId)),
    actors = all.filter((e) => selected.includes(e.id)), hydras = actors.filter((e) => e.definitionId === HYDRALISK && !e.burrowed),
    eggs = actors.filter((e) => e.unitMorph), economy = snapshot.economy!, ready = economy.upgrades.some((u) => u.technologyId === LURKER_ASPECT);
  if (!all.length) return null;
  return <div className="sr-lurker-controls">
    {snapshot.combat?.scenario === "special-practice" && <div className="sr-action-row">
      {[[HYDRALISK, "히드라 선택"], [LURKER, "러커 선택"], [LURKER_EGG, "변태 중인 알 선택"]].map(([definition, label]) => {
        const ids = all.filter((e) => e.definitionId === definition).map((e) => e.id);
        return ids.length > 0 && <button key={definition} data-lurker-select={definition} onClick={() => select?.(ids)}>{label}</button>;
      })}
    </div>}
    {actors.length > 0 && <>
      {actors.some((e) => e.definitionId === HYDRALISK) && <button data-unit-morph="zerg-lurker"
        disabled={!running || !ready || !hydras.length || economy.minerals < 50 || economy.gas < 100 || economy.supplyCapHalf - economy.supplyUsedHalf < 2}
        onClick={() => issue({ kind: "morphUnit", entityIds: hydras.map((e) => e.id), payload: { unitId: LURKER } })}>러커 변태 · ◆ 50 ◉ 100 · 人 +1</button>}
      {eggs.map((e) => <div key={e.id} data-unit-morph-progress={e.id} className="sr-research-status">
        <span>러커 변태 중 · {Math.ceil(e.unitMorph!.remainingTicks / 20)}초 · 알 체력 {e.health} / 200</span>
        <progress max={e.unitMorph!.totalTicks} value={e.unitMorph!.totalTicks - e.unitMorph!.remainingTicks} />
        <button disabled={!running} onClick={() => issue({ kind: "cancelUnitMorph", entityIds: [e.id] })}>변태 취소 · 전액 환불</button>
      </div>)}
      <p className="sr-help" role="status">{!ready && actors.some((e) => e.definitionId === HYDRALISK) ? "레어 완성 후 히드라리스크 덴에서 러커 변태 연구 · ◆ 200 ◉ 200 · 37.5초" :
        eggs.length ? "변태 12.5초 · 알은 이동·공격·탑승 불가. 공격받을 수 있으며 체력 비율과 부대를 유지합니다." :
        actors.some((e) => e.definitionId === LURKER) ? "러커는 버로우 연구 없이 잠복할 수 있습니다. 잠복 중에만 지상 직선 범위 공격 · 사거리 6타일 · 아군·공중 유닛에는 피해 없음." :
        actors.some((e) => e.burrowed) ? "히드라리스크의 잠복을 해제한 뒤 러커로 변태하세요." : "히드라리스크 → 러커 · 12.5초 · 추가 인구 1. 여러 기 선택 시 보유 자원과 인구 한도만큼 변태합니다."}</p>
    </>}
  </div>;
}
