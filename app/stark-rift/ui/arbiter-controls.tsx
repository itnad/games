import type { RenderSnapshot } from "../worker/render-snapshot";
import { ARBITER } from "../abilities/arbiter";
import { useEffect, useRef } from "react";
export function ArbiterControls({ snapshot, selected, select, running = true, cast, toggleAutocast }: {
  snapshot: RenderSnapshot; selected: number[]; select?: (ids: number[]) => void; running?: boolean; cast?: (id: number, ability: "recall" | "stasis-field") => void;
  toggleAutocast?: (ids: number[], enabled: boolean) => void;
}) {
  const owned = snapshot.entities.filter((e) => e.owner === snapshot.viewerPlayerId), arbiters = owned.filter((e) => e.definitionId === ARBITER),
    actors = arbiters.filter((e) => selected.includes(e.id)), covered = owned.filter((e) => e.auraCloaked), affected = owned.filter((e) => selected.includes(e.id) && e.auraCloaked);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), long = useRef(false), pointer = useRef<{x:number;y:number} | null>(null);
  const current = useRef({actors,running,toggleAutocast});current.current={actors,running,toggleAutocast};
  const end = () => { if(timer.current)clearTimeout(timer.current);timer.current=null;pointer.current=null; };
  const selectionKey=actors.map(e=>e.id).join(",");
  useEffect(()=>{end();long.current=false;return end;},[selectionKey,running]);
  if (!arbiters.length && !affected.length) return null;
  const allAuto=actors.length>0 && actors.every(e=>e.stasisAutocast), anyAuto=actors.some(e=>e.stasisAutocast);
  const toggle = () => {const c=current.current;if(c.running && c.actors.length)c.toggleAutocast?.(c.actors.map(e=>e.id),!c.actors.every(e=>e.stasisAutocast));};
  return <div className="sr-arbiter-controls">
    {snapshot.combat?.scenario === "special-practice" && arbiters.length > 0 && <div className="sr-action-row">
      <button data-arbiter-select onClick={() => select?.(arbiters.map((e) => e.id))}>아비터 선택</button>
      <button data-arbiter-escort-select onClick={() => select?.(owned.filter((e) => e.definitionId === "protoss-zealot").map((e) => e.id))}>호위 질럿 선택</button>
    </div>}
    {actors.length > 0 && <>
      <div className="sr-action-row">{(["recall", "stasis-field"] as const).map(ability => {
        const ready = actors.find(e => !e.stasisTicks && !e.recallTicks && (e.energy ?? 0) >= (ability === "recall" ? 150 : 100)), researched = snapshot.economy!.upgrades.some(u => u.technologyId === ability);
        return <button key={ability} data-cast-ability={ability} disabled={!running || ability === "recall" && (!ready || !researched)}
          aria-pressed={ability === "stasis-field" ? allAuto : undefined}
          onContextMenu={e=>e.preventDefault()}
          onPointerDown={e=>{if(ability!=="stasis-field" || !e.isPrimary || e.button!==0)return;end();long.current=false;pointer.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);timer.current=setTimeout(()=>{long.current=true;timer.current=null;toggle();},550);}}
          onPointerMove={e=>{const p=pointer.current;if(p && Math.hypot(e.clientX-p.x,e.clientY-p.y)>10){end();long.current=true;}}}
          onPointerUp={end} onLostPointerCapture={end} onBlur={end} onPointerCancel={()=>{end();long.current=true;}}
          onKeyDown={e=>{if(ability==="stasis-field" && e.shiftKey && (e.key==="Enter" || e.key===" ")){e.preventDefault();toggle();}}}
          onClick={()=>{end();if(!long.current && ready && researched)cast?.(ready.id,ability);long.current=false;}}>{ability === "recall" ? "리콜 · 에너지 150" : `스테이시스 · 에너지 100${allAuto ? " · A" : anyAuto ? " · A 일부" : ""}`}</button>;
      })}</div>
      <div className="sr-action-row"><button data-stasis-autocast-toggle disabled={!running} aria-pressed={allAuto} onClick={toggle}>스테이시스 자동시전 {allAuto ? "끄기" : "켜기"}</button></div>
      <p className="sr-help" data-stasis-autocast-status>자동시전 {allAuto ? "켜짐 · A" : anyAuto ? "일부 켜짐" : "꺼짐"} · 스테이시스 길게 누르기 또는 자동시전 버튼으로 전환. 연구·에너지 필요. 현재 사거리 안 보이는 적 2기 이상, 아군이 범위에 없을 때 사용합니다. 자동 접근하지 않으며 수동 명령을 우선합니다.</p>
      {actors.map(e => <p key={e.id} className="sr-work-status" data-arbiter-energy={e.id}>아비터 #{e.id} · 에너지 {e.energy ?? 0} / 200{e.recallTicks ? " · 리콜 시전 중" : e.stasisTicks ? " · 스테이시스 정지 중" : ""}</p>)}
      <p className="sr-help">트리뷰널 연구 필요 · 리콜: 지정 지역의 아군을 약 0.9초 후 소환 · 스테이시스: 9타일 안 지정, 아군도 약 44초 정지·무적. 시전 버튼 → 전장 또는 미니맵 위치 터치.</p>
      <p className="sr-work-status" data-cloak-field-status>자동 은폐장 · 적용 아군 {covered.length}기 · 에너지 소모 없음</p>
      <p className="sr-help">주변 아군 지상·공중 유닛을 은폐합니다. 기본 범위 5타일 · 충돌 상자 기준. 선택하면 범위가 표시됩니다. 위치를 터치해 이동시키면 은폐장도 따라갑니다.</p>
      <p className="sr-help">아비터 자신·다른 아비터·건물·수송 중인 유닛은 제외됩니다. 범위를 벗어나거나 아비터가 파괴되면 은폐가 해제됩니다. 적 탐지기 안에서는 공격받습니다.</p>
    </>}
    {affected.length > 0 && <p data-aura-cloaked-status className="sr-help" role="status">아비터 은폐장 적용 · 이동·공격·수송 가능. 범위를 벗어나면 은폐장이 해제됩니다. 영구 은폐와 개인 은폐는 각자의 규칙을 따릅니다.</p>}
  </div>;
}
