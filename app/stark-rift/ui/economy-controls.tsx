import { hasBasicWeapon } from "../combat/catalog";
import { useEffect, useRef } from "react";
import type { GameCommand } from "../core/commands";
import type { RenderSnapshot } from "../worker/render-snapshot";
import {
  ECONOMY_DEFINITIONS,
  ECONOMY_UPGRADES,
  economyDefinition,
} from "../data/economy-catalog";
export type CommandBody<T = GameCommand> = T extends GameCommand
  ? Omit<T, "sequence" | "issuedTick" | "executeTick" | "playerId" | "source">
  : never;
export function EconomyControls({
  snapshot,
  selected,
  issue,
  rally,
  attackMove,
  running,
  openBuildMenu,
  selectWorker,
}: {
  snapshot: RenderSnapshot;
  selected: number[];
  issue: (b: CommandBody) => void;
  rally: () => void;
  attackMove: () => void;
  running: boolean;
  openBuildMenu: () => void;
  selectWorker: () => void;
}) {
  const economy = snapshot.economy!,
    entities = snapshot.entities.filter(
      (e) => selected.includes(e.id) && e.owner === snapshot.viewerPlayerId,
    ),
    first = entities[0],
    def = first ? economyDefinition(first.definitionId) : undefined;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    long = useRef(false);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const start = (action: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    long.current = false;
    timer.current = setTimeout(() => {
      long.current = true;
      action();
      timer.current = null;
    }, 550);
  };
  const end = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const click = (action: () => void) => {
    end();
    if (!long.current) action();
    long.current = false;
  };
  const has = (id: string) =>
    economy.structures.some(
      (b) =>
        b.completed &&
        snapshot.entities.find((e) => e.id === b.entityId)?.definitionId === id,
    );
  const canAfford = (minerals: number, gas: number) =>
    economy.minerals >= minerals && economy.gas >= gas;
  const cost = (m: number, g: number, s = 0) =>
    `◆ ${m}${g ? "  ◉ " + g : ""}${s ? "  人 " + s / 2 : ""}`;
  const reason = (d: (typeof ECONOMY_DEFINITIONS)[number]) =>
    !canAfford(d.minerals, d.gas)
      ? "자원 부족"
      : d.requires.some((id) => !has(id))
        ? "선행 건물 필요"
        : null;
  const worker = economy.workers.find((w) => w.entityId === first?.id),
    building = economy.structures.find((b) => b.entityId === first?.id);
  const tasks: Record<string, string> = {
    idle: "대기",
    toResource: "채취 지점으로 이동",
    harvesting: "채취 중",
    returning: "자원 반납",
    toBuild: "건설 지점으로 이동",
    constructing: "건설 중",
  };
  if (!def)
    return (
      <div>
        <div className="sr-selection-toolbar">
          <span>선택한 유닛 없음</span>
          {economy.workers.length > 0 && (
            <button onClick={selectWorker}>일꾼 선택</button>
          )}
        </div>
        <p className="sr-selection-hint">
          본부에서 일꾼을 생산하거나, 일꾼을 선택해 건설하세요.
        </p>
      </div>
    );
  const mixed = entities.some((e) => e.definitionId !== first.definitionId);
  return (
    <div className="sr-economy-controls">
      <div className="sr-selection-title sr-selection-toolbar">
        <strong>
          {mixed ? "혼합 병력" : def.name}
          {entities.length > 1 ? ` × ${entities.length}` : ""}
        </strong>
        {def.kind === "combat" && hasBasicWeapon(def.id) && (
          <button
            className="sr-attack-move"
            disabled={!running}
            onClick={attackMove}
          >
            공격 이동
          </button>
        )}
        {worker ? (
          <button className="sr-open-build" onClick={openBuildMenu}>
            건설
          </button>
        ) : (
          economy.workers.length > 0 && (
            <button className="sr-select-worker" onClick={selectWorker}>
              일꾼 선택
            </button>
          )
        )}
        <span>
          {mixed ? "선두 체력" : "체력"} {first.health}
          {def.shield ? ` · 보호막 ${first.shield ?? 0}` : ""}
        </span>
      </div>
      {worker && (
        <>
          <p className="sr-help">
            건설 버튼 → 건물 선택 → 전장 위치 터치 → 건설 확정
          </p>
          <div className="sr-work-status">
            {tasks[worker.task] ?? worker.task} · 운반 ◆ {worker.cargoMinerals}{" "}
            ◉ {worker.cargoGas}
          </div>
          <div className="sr-action-row">
            <button
              disabled={!running}
              onClick={() => issue({ kind: "autoGather", entityIds: selected })}
            >
              자동 채취
            </button>
            <button
              disabled={!running}
              onClick={() =>
                issue({ kind: "returnCargo", entityIds: selected })
              }
            >
              자원 반납
            </button>
            <button
              disabled={!running}
              onClick={() => issue({ kind: "stop", entityIds: selected })}
            >
              정지
            </button>
          </div>
        </>
      )}
      {building && !building.completed && (
        <>
          <p>
            {building.started ? "건설 중" : "건설 예약"} ·{" "}
            {Math.floor(
              (1 - building.remainingTicks / building.totalTicks) * 100,
            )}
            %
            {def.faction === "terran" &&
            building.started &&
            building.builderId === null
              ? " · SCV 연결 필요"
              : ""}
          </p>
          <progress
            max={building.totalTicks}
            value={building.totalTicks - building.remainingTicks}
          />
          <button
            disabled={!running}
            onClick={() =>
              issue({
                kind: "cancelConstruction",
                entityIds: [building.entityId],
              })
            }
          >
            건설 취소 · {building.started ? "75" : "100"}% 환불
          </button>
          <p className="sr-help">
            중단된 테란 건물: SCV 선택 후 건물을 터치하면 재개합니다.
          </p>
        </>
      )}
      {building?.completed && (
        <>
          <div className="sr-action-row">
            {def.id === "zerg-hatchery" && (
              <span>라바 {building.larva} / 3</span>
            )}
            {def.power && !building.powered && (
              <span className="sr-locked">동력 필요 · 생산 정지</span>
            )}
          </div>
          <div className="sr-action-label">생산 · 길게 누르면 반복</div>
          <div className="sr-build-grid">
            {ECONOMY_DEFINITIONS.filter(
              (d) => d.kind !== "building" && d.producer === def.id,
            ).map((d) => {
              const why = reason(d),
                repeat = building.repeatUnitId === d.id,
                allowed =
                  running &&
                  !why &&
                  building.powered &&
                  building.queue.length < 5 &&
                  (def.id !== "zerg-hatchery" || building.larva > 0) &&
                  economy.supplyUsedHalf + d.supply * d.batch <=
                    economy.supplyCapHalf;
              return (
                <div key={d.id} className="sr-production-card">
                  <button
                    data-produce={d.id}
                    disabled={!allowed && !repeat}
                    aria-pressed={repeat}
                    onPointerDown={() =>
                      start(() =>
                        issue({
                          kind: "toggleRepeatProduction",
                          entityIds: selected,
                          payload: { unitId: d.id, enabled: !repeat },
                        }),
                      )
                    }
                    onPointerUp={end}
                    onPointerLeave={end}
                    onPointerCancel={end}
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={() =>
                      click(() =>
                        issue({
                          kind: "produce",
                          entityIds: selected,
                          payload: { unitId: d.id },
                        }),
                      )
                    }
                  >
                    <strong>
                      {d.name}
                      {d.batch > 1 ? ` × ${d.batch}` : ""}
                    </strong>
                    <small>{cost(d.minerals, d.gas, d.supply * d.batch)}</small>
                    {repeat && <small>반복 중 · 길게 눌러 해제</small>}
                    {why && <small>{why}</small>}
                  </button>
                  <button
                    className="sr-repeat-toggle"
                    data-repeat={d.id}
                    disabled={!running || d.requires.some((id) => !has(id))}
                    aria-pressed={repeat}
                    onClick={() =>
                      issue({
                        kind: "toggleRepeatProduction",
                        entityIds: selected,
                        payload: { unitId: d.id, enabled: !repeat },
                      })
                    }
                  >
                    {repeat ? "반복 해제" : "반복 예약"}
                  </button>
                </div>
              );
            })}
            {ECONOMY_DEFINITIONS.filter((d) => d.addonParent === def.id).map(
              (d) => (
                <button
                  key={d.id}
                  disabled={!running || !!reason(d)}
                  onClick={() =>
                    issue({
                      kind: "placeBuilding",
                      entityIds: selected,
                      target: { kind: "point", x: first.x, y: first.y },
                      payload: { buildingId: d.id },
                    })
                  }
                >
                  {d.name}
                  <small>{cost(d.minerals, d.gas)}</small>
                </button>
              ),
            )}
          </div>
          <button disabled={!running} onClick={rally}>
            집결지 지정
          </button>
          {building.repeatUnitId && (
            <div className="sr-work-status">
              반복: {economyDefinition(building.repeatUnitId)?.name} ·
              자원·인구·라바 부족 시 대기{" "}
              <button
                disabled={!running}
                onClick={() =>
                  issue({
                    kind: "toggleRepeatProduction",
                    entityIds: selected,
                    payload: { unitId: building.repeatUnitId!, enabled: false },
                  })
                }
              >
                반복 해제
              </button>
            </div>
          )}
          {building.queue.length > 0 && (
            <>
              <div className="sr-action-label">
                생산 대기열 · 두 번 터치하면 전액 환불
              </div>
              <div className="sr-production-queue">
                {building.queue.map((q) => (
                  <button
                    key={q.id}
                    data-queue={q.id}
                    disabled={!running}
                    onDoubleClick={() =>
                      issue({
                        kind: "cancelProduction",
                        entityIds: [building.entityId],
                        payload: { queueEntryId: q.id },
                      })
                    }
                    title="두 번 터치해 취소"
                  >
                    <span>{economyDefinition(q.definitionId)?.name}</span>
                    <progress
                      value={q.totalTicks - q.remainingTicks}
                      max={q.totalTicks}
                    />
                    <small>{Math.ceil(q.remainingTicks / 20)}초</small>
                  </button>
                ))}
              </div>
            </>
          )}
          {ECONOMY_UPGRADES.filter((t) => t.producer === def.id).map((t) => {
            const done = economy.upgrades.some((u) => u.technologyId === t.id),
              busy = economy.structures.some(
                (b) => b.research?.technologyId === t.id,
              );
            return (
              <button
                key={t.id}
                disabled={
                  !running ||
                  done ||
                  busy ||
                  !building.powered ||
                  !canAfford(t.minerals, t.gas)
                }
                onClick={() =>
                  issue({
                    kind: "research",
                    entityIds: selected,
                    payload: { technologyId: t.id },
                  })
                }
              >
                {t.name} 1단계 {done ? "완료" : cost(t.minerals, t.gas)}
              </button>
            );
          })}
          {building.research && (
            <div className="sr-research-status">
              <span>
                {
                  ECONOMY_UPGRADES.find(
                    (t) => t.id === building.research!.technologyId,
                  )?.name
                }{" "}
                연구
              </span>
              <progress
                max={building.research.totalTicks}
                value={
                  building.research.totalTicks -
                  building.research.remainingTicks
                }
              />
              <button
                disabled={!running}
                onClick={() =>
                  issue({
                    kind: "cancelResearch",
                    entityIds: [building.entityId],
                  })
                }
              >
                연구 취소 · 전액 환불
              </button>
            </div>
          )}
        </>
      )}
      {def.kind === "combat" && (
        <p className="sr-help">
          건물은 SCV·드론·프로브 같은 일꾼으로 건설합니다. 일꾼 선택 버튼을 눌러
          주세요.
        </p>
      )}
      {def.kind === "combat" && !hasBasicWeapon(def.id) && (
        <p className="sr-help">비무장 유닛입니다. 이동과 정찰에 활용하세요.</p>
      )}
      {def.kind === "combat" && (
        <div className="sr-action-row">
          <button
            disabled={!running}
            onClick={() => issue({ kind: "stop", entityIds: selected })}
          >
            정지
          </button>
          <button
            disabled={!running}
            onClick={() => issue({ kind: "hold", entityIds: selected })}
          >
            위치 사수
          </button>
        </div>
      )}
    </div>
  );
}
