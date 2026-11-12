import { useEffect, useRef, useState } from "react";
import type { RenderSnapshot } from "../worker/render-snapshot";
import type { CommandBody } from "./economy-controls";
import { economyDefinition } from "../data/economy-catalog";
export function TransportControls({ snapshot, selected, running, issue, load, unload, select }: {
  snapshot: RenderSnapshot; selected: number[]; running: boolean;
  issue: (body: CommandBody) => void; load: (ids: number[]) => void; unload: (ids: number[]) => void; select: (ids: number[]) => void;
}) {
  const all = snapshot.economy?.transports ?? [],
    carriers = all.filter((t) => selected.includes(t.entityId) || t.passengers.some((p) => selected.includes(p.id))),
    ids = carriers.map((t) => t.entityId),
    loadedSelection = carriers.some((t) => !selected.includes(t.entityId)),
    observer = snapshot.entities.find((e) => e.owner === snapshot.viewerPlayerId && e.definitionId === "protoss-observer");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), long = useRef(false), [detail, setDetail] = useState<string | null>(null);
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => clear, []);
  if (!carriers.length) return null;
  return <div className="sr-transport-controls">
    {loadedSelection && <button onClick={() => select(ids)}>수송선 선택</button>}
    <div className="sr-action-row">
      <button data-transport="load" disabled={!running || !carriers.some((t) => t.capacity > t.usedSpace)} onClick={() => load(ids)}>탑승</button>
      <button data-transport="unload" disabled={!running || !carriers.some((t) => t.passengers.length)} onClick={() => unload(ids)}>전체 하차</button>
      {carriers.some((t) => t.loading.length || t.unloadTarget) && <button disabled={!running} onClick={() => issue({ kind: "stop", entityIds: ids })}>수송 지시 취소</button>}
    </div>
    {observer && <button disabled={!running} onClick={() => select([observer.id])}>옵저버 선택</button>}
    {carriers.map((t, n) => <section key={t.entityId} data-carrier={t.entityId}>
      <p className="sr-work-status"><strong>{economyDefinition(snapshot.entities.find((e) => e.id === t.entityId)?.definitionId ?? "")?.name ?? "수송선"} {carriers.length > 1 ? n + 1 : ""}</strong> · {t.usedSpace} / {t.capacity || 8}칸{t.capacity === 0 ? " · 레어에서 수송 연구 필요" : ""}</p>
      {t.loading.length > 0 && <p className="sr-help">탑승 대기 {t.loading.length}기 · 병력이 수송선으로 이동합니다. 접근하지 못하면 수송선을 지상 가까이 옮겨 주세요.</p>}
      {t.unloadTarget && <p className="sr-help">하차 지점으로 이동·하차 대기 · 공간이 비면 차례대로 내립니다.</p>}
      <div className="sr-cargo-grid">{t.passengers.map((p) => <button key={p.id} data-passenger={p.id} disabled={!running}
        onPointerDown={() => { clear(); long.current = false; timer.current = setTimeout(() => { long.current = true; setDetail(`${economyDefinition(p.definitionId)?.name} · 체력 ${p.health} · 보호막 ${p.shield} · 수송 공간 ${p.space}`); timer.current = null; }, 550); }}
        onPointerUp={clear} onPointerLeave={clear} onPointerCancel={() => { clear(); long.current = true; }} onContextMenu={(e) => e.preventDefault()}
        onClick={() => { clear(); if (long.current) { long.current = false; return; } const ship = snapshot.entities.find((e) => e.id === t.entityId); if (ship) issue({ kind: "unloadPassenger", entityIds: [t.entityId], target: { kind: "point", x: ship.x, y: ship.y }, payload: { passengerId: p.id } }); }}>
        <strong>{economyDefinition(p.definitionId)?.name}</strong><small>체력 {p.health}{p.shield ? ` · 보호막 ${p.shield}` : ""}</small><small>{p.space}칸 · 터치해 하차</small>
      </button>)}</div>
    </section>)}
    {detail && <p className="sr-help" role="status">{detail}</p>}
    <p className="sr-help">탑승 → 아군 또는 부대 슬롯 터치 · 전체 하차 → 전장/미니맵 지점 선택. 수송선 파괴 시 탑승 병력도 소멸합니다.</p>
  </div>;
}
