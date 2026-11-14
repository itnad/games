import type { RenderSnapshot } from "../worker/render-snapshot";
import type { CommandBody } from "./economy-controls";
import { isTank, isSieged, SIEGE_RESEARCH } from "../abilities/siege-state";
export function SiegeControls({ snapshot, selected, running, issue, select }: {
  snapshot: RenderSnapshot; selected: number[]; running: boolean;
  issue: (body: CommandBody) => void; select?: (ids: number[]) => void;
}) {
  const all = snapshot.entities.filter((e) => e.owner === snapshot.viewerPlayerId && isTank(e.definitionId)),
    tanks = all.filter((e) => selected.includes(e.id)), ready = snapshot.economy!.upgrades.some((u) => u.technologyId === SIEGE_RESEARCH),
    mobile = tanks.filter((e) => !e.siegeTransition && !isSieged(e.definitionId)).map((e) => e.id),
    deployed = tanks.filter((e) => !e.siegeTransition && isSieged(e.definitionId)).map((e) => e.id),
    busy = tanks.filter((e) => e.siegeTransition);
  if (!all.length) return null;
  return <div className="sr-siege-controls">
    {snapshot.combat?.scenario === "special-practice" && <button data-siege-select onClick={() => select?.(all.map((e) => e.id))}>시즈 탱크 선택</button>}
    {tanks.length > 0 && <>
      <div className="sr-action-row">
        <button data-state-ability="siege-mode" data-enabled="true" disabled={!running || !ready || !mobile.length}
          onClick={() => issue({ kind: "toggleStateAbility", entityIds: mobile, payload: { abilityId: "siege-mode", enabled: true } })}>시즈 모드</button>
        <button data-state-ability="siege-mode" data-enabled="false" disabled={!running || !deployed.length}
          onClick={() => issue({ kind: "toggleStateAbility", entityIds: deployed, payload: { abilityId: "siege-mode", enabled: false } })}>시즈 해제</button>
      </div>
      {busy.map((e) => <div key={e.id} data-siege-transition={e.id} className="sr-research-status">
        <span>{isSieged(e.siegeTransition!.targetDefinitionId) ? "시즈 전환" : "시즈 해제"} 중 · {Math.ceil(e.siegeTransition!.remainingTicks / 20)}초</span>
        <progress max={e.siegeTransition!.totalTicks} value={e.siegeTransition!.totalTicks - e.siegeTransition!.remainingTicks} />
      </div>)}
      <p className="sr-help" role="status">{!ready ? "연결된 머신샵에서 시즈 모드 연구 필요 · ◆ 150 ◉ 150 · 25초" : busy.length ? "전환 중에는 이동·공격·탑승할 수 없습니다. 전환은 2초가 걸립니다." :
        deployed.length ? "시즈 상태에서는 이동·탑승 불가 · 지상 범위 포격 · 사거리 2~12타일(충돌 상자 기준). 아군도 범위 피해를 받습니다." : "시즈 모드로 전환하면 장거리 지상 포격을 합니다. 전환·해제 각각 2초 · 기존 부대와 체력을 유지합니다."}</p>
    </>}
  </div>;
}
