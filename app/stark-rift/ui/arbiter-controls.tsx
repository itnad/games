import type { RenderSnapshot } from "../worker/render-snapshot";
import { ARBITER } from "../abilities/arbiter";
export function ArbiterControls({ snapshot, selected, select, running = true, cast }: {
  snapshot: RenderSnapshot; selected: number[]; select?: (ids: number[]) => void; running?: boolean; cast?: (id: number, ability: "recall" | "stasis-field") => void;
}) {
  const owned = snapshot.entities.filter((e) => e.owner === snapshot.viewerPlayerId), arbiters = owned.filter((e) => e.definitionId === ARBITER),
    actors = arbiters.filter((e) => selected.includes(e.id)), covered = owned.filter((e) => e.auraCloaked), affected = owned.filter((e) => selected.includes(e.id) && e.auraCloaked);
  if (!arbiters.length && !affected.length) return null;
  return <div className="sr-arbiter-controls">
    {snapshot.combat?.scenario === "special-practice" && arbiters.length > 0 && <div className="sr-action-row">
      <button data-arbiter-select onClick={() => select?.(arbiters.map((e) => e.id))}>아비터 선택</button>
      <button data-arbiter-escort-select onClick={() => select?.(owned.filter((e) => e.definitionId === "protoss-zealot").map((e) => e.id))}>호위 질럿 선택</button>
    </div>}
    {actors.length > 0 && <>
      <div className="sr-action-row">{(["recall", "stasis-field"] as const).map(ability => {
        const ready = actors.find(e => !e.stasisTicks && !e.recallTicks && (e.energy ?? 0) >= (ability === "recall" ? 150 : 100)), researched = snapshot.economy!.upgrades.some(u => u.technologyId === ability);
        return <button key={ability} data-cast-ability={ability} disabled={!running || !ready || !researched} onClick={() => ready && cast?.(ready.id,ability)}>{ability === "recall" ? "리콜 · 에너지 150" : "스테이시스 · 에너지 100"}</button>;
      })}</div>
      {actors.map(e => <p key={e.id} className="sr-work-status" data-arbiter-energy={e.id}>아비터 #{e.id} · 에너지 {e.energy ?? 0} / 200{e.recallTicks ? " · 리콜 시전 중" : e.stasisTicks ? " · 스테이시스 정지 중" : ""}</p>)}
      <p className="sr-help">트리뷰널 연구 필요 · 리콜: 지정 지역의 아군을 약 0.9초 후 소환 · 스테이시스: 9타일 안 지정, 아군도 약 44초 정지·무적. 시전 버튼 → 전장 또는 미니맵 위치 터치.</p>
      <p className="sr-work-status" data-cloak-field-status>자동 은폐장 · 적용 아군 {covered.length}기 · 에너지 소모 없음</p>
      <p className="sr-help">주변 아군 지상·공중 유닛을 은폐합니다. 기본 범위 5타일 · 충돌 상자 기준. 선택하면 범위가 표시됩니다. 위치를 터치해 이동시키면 은폐장도 따라갑니다.</p>
      <p className="sr-help">아비터 자신·다른 아비터·건물·수송 중인 유닛은 제외됩니다. 범위를 벗어나거나 아비터가 파괴되면 은폐가 해제됩니다. 적 탐지기 안에서는 공격받습니다.</p>
    </>}
    {affected.length > 0 && <p data-aura-cloaked-status className="sr-help" role="status">아비터 은폐장 적용 · 이동·공격·수송 가능. 범위를 벗어나면 은폐장이 해제됩니다. 영구 은폐와 개인 은폐는 각자의 규칙을 따릅니다.</p>}
  </div>;
}
