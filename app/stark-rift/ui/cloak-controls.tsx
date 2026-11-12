import type { RenderSnapshot } from "../worker/render-snapshot";
import type { CommandBody } from "./economy-controls";
import { cloakResearch, supportsCloak } from "../abilities/cloak-state";
export function CloakControls({ snapshot, selected, running, issue, select }: {
  snapshot: RenderSnapshot; selected: number[]; running: boolean;
  issue: (body: CommandBody) => void; select?: (ids: number[]) => void;
}) {
  const all = snapshot.entities.filter((e) => e.owner === snapshot.viewerPlayerId && supportsCloak(e.definitionId)),
    actors = all.filter((e) => selected.includes(e.id)),
    researched = (definition: string) => snapshot.economy!.upgrades.some((u) => u.technologyId === cloakResearch(definition)),
    ready = actors.filter((e) => !e.cloaked && researched(e.definitionId) && (e.energy ?? 0) >= 25).map((e) => e.id),
    active = actors.filter((e) => e.cloaked).map((e) => e.id);
  if (!all.length) return null;
  return <div className="sr-cloak-controls">
    {snapshot.combat?.scenario === "special-practice" && <div className="sr-action-row">
      {[["terran-ghost", "고스트 선택"], ["terran-wraith", "레이스 선택"]].map(([definition, label]) => {
        const ids = all.filter((e) => e.definitionId === definition).map((e) => e.id);
        return ids.length > 0 && <button key={definition} data-cloak-select={definition} onClick={() => select?.(ids)}>{label}</button>;
      })}
    </div>}
    {actors.length > 0 && <>
      <p className="sr-work-status" data-energy-status>에너지 {actors[0].energy} / {actors[0].maxEnergy}{actors.length > 1 ? " · 선두 기준" : ""} · 은폐 {active.length}기</p>
      <div className="sr-action-row">
        <button data-state-ability="cloak" data-enabled="true" disabled={!running || !ready.length}
          onClick={() => issue({ kind: "toggleStateAbility", entityIds: ready, payload: { abilityId: "cloak", enabled: true } })}>클로킹 · 에너지 25</button>
        <button data-state-ability="cloak" data-enabled="false" disabled={!running || !active.length}
          onClick={() => issue({ kind: "toggleStateAbility", entityIds: active, payload: { abilityId: "cloak", enabled: false } })}>은폐 해제</button>
      </div>
      <p className="sr-help" role="status">{actors.some((e) => !researched(e.definitionId)) ? "고스트는 코버트 옵스의 개인 은폐, 레이스는 컨트롤 타워의 클로킹 필드 연구가 필요합니다." :
        active.length ? "이동·공격 중에도 은폐 유지 · 에너지 소진 시 자동 해제. 적 탐지기에 노출되면 공격받습니다." :
        !ready.length ? "클로킹에 에너지 25가 필요합니다. 은폐 해제 중에는 에너지가 회복됩니다." : "클로킹 시작 시 에너지 25 사용 · 은폐 중 지속 소모, 해제 중 회복."}</p>
    </>}
  </div>;
}
