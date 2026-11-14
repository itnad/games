import { ArbiterControls } from "./arbiter-controls";
import { LurkerControls } from "./lurker-controls";
import { technologyRequirements } from "../data/economy-catalog";
import { SiegeControls } from "./siege-controls";
import { isSieged } from "../abilities/siege-state";
import { CloakControls } from "./cloak-controls";
import { TransportControls } from "./transport-controls";
import { permanentCloak } from "../abilities/special-state";
import { hasBasicWeapon } from "../combat/catalog";
import { BURROW_ABILITY, BURROW_RESEARCH, supportsBurrow } from "../abilities/burrow";
import { useEffect, useRef } from "react";
import type { GameCommand } from "../core/commands";
import type { RenderSnapshot } from "../worker/render-snapshot";
import {
  countsAsDefinition, isLarvaProducer, unitFamily,
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
  scout, loadTransport, unloadTransport, selectEntities, castAbility,
}: {
  snapshot: RenderSnapshot;
  selected: number[];
  issue: (b: CommandBody) => void;
  rally: () => void;
  attackMove: () => void;
  running: boolean;
  openBuildMenu: () => void;
  selectWorker: () => void;
  scout: () => void;
  castAbility?: (id: number, ability: "recall" | "stasis-field") => void;
  loadTransport?: (ids: number[]) => void; unloadTransport?: (ids: number[]) => void; selectEntities?: (ids: number[]) => void;
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
        (!economyDefinition(snapshot.entities.find((e) => e.id === b.entityId)?.definitionId ?? "")?.addonParent || b.powered) &&
        countsAsDefinition(snapshot.entities.find((e) => e.id === b.entityId)?.definitionId ?? "", id),
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
  const transport = <TransportControls snapshot={snapshot} selected={selected} running={running} issue={issue}
    load={loadTransport ?? (() => {})} unload={unloadTransport ?? (() => {})} select={selectEntities ?? (() => {})} />;
  if (!def && (economy.transports ?? []).some((t) => t.passengers.some((p) => selected.includes(p.id)))) return transport;
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
  const mixed = entities.some((e) => unitFamily(e.definitionId) !== unitFamily(first.definitionId));
  const burrowActors = entities.filter((e) => supportsBurrow(e.definitionId)),
    surfaceIds = burrowActors.filter((e) => !e.burrowed && (e.definitionId === "zerg-lurker" || economy.upgrades.some((u) => u.technologyId === BURROW_RESEARCH))).map((e) => e.id),
    burrowIds = burrowActors.filter((e) => e.burrowed).map((e) => e.id),
    burrowReady = burrowActors.some((e) => e.definitionId === "zerg-lurker") || economy.upgrades.some((u) => u.technologyId === BURROW_RESEARCH);
  return (
    <div className="sr-economy-controls">
      <div className="sr-selection-title sr-selection-toolbar">
        <strong>
          {mixed ? "혼합 병력" : entities.some((e) => e.definitionId !== first.definitionId) ? "히드라·러커 부대" : def.name}
          {entities.length > 1 ? ` × ${entities.length}` : ""}
        </strong>
        {snapshot.combat?.scenario === "siege-practice" &&
          def.kind === "combat" && (
            <button disabled={!running} className="sr-scout" onClick={scout}>
              정찰 출발
            </button>
          )}
        {def.kind === "combat" &&
          snapshot.combat?.scenario !== "siege-practice" &&
          hasBasicWeapon(def.id) && (
            <button
              className="sr-attack-move"
              disabled={!running || entities.every((e) => e.stasisTicks || e.recallTicks || e.burrowed || e.siegeTransition || isSieged(e.definitionId))}
              onClick={attackMove}
            >
              공격 이동
            </button>
          )}
        {worker ? (
          <button className="sr-open-build" disabled={!running || first.burrowed} onClick={openBuildMenu}>
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
      <ArbiterControls snapshot={snapshot} selected={selected} select={selectEntities} running={running} cast={castAbility} />
      <LurkerControls snapshot={snapshot} selected={selected} running={running} issue={issue} select={selectEntities} />
      <SiegeControls snapshot={snapshot} selected={selected} running={running} issue={issue} select={selectEntities} />
      <CloakControls snapshot={snapshot} selected={selected} running={running} issue={issue} select={selectEntities} />
      {transport}
      {entities.some(e => e.stasisTicks) && <p className="sr-help" data-stasis-status>스테이시스 정지 중 · 최대 {Math.ceil(Math.max(...entities.map(e => e.stasisTicks ?? 0))/20)}초 · 이동·공격·탑승 불가 · 피해 면역</p>}
      {permanentCloak(def.id) && <p className="sr-help">영구 은폐 · {def.id === "protoss-observer" ? "비무장 탐지기 · 탐지 범위 11타일" : "지상 근접 공격 · 적 탐지기에 노출되면 공격받습니다."}</p>}
      {burrowActors.length > 0 && (
        <div className="sr-burrow-controls">
          <div className="sr-action-row">
            <button data-state-ability="burrow" data-enabled="true"
              disabled={!running || !burrowReady || surfaceIds.length === 0 || !!(worker && ["toBuild", "constructing"].includes(worker.task))}
              onClick={() => issue({ kind: "toggleStateAbility", entityIds: surfaceIds,
                payload: { abilityId: BURROW_ABILITY, enabled: true } })}>버로우</button>
            <button data-state-ability="burrow" data-enabled="false"
              disabled={!running || burrowIds.length === 0}
              onClick={() => issue({ kind: "toggleStateAbility", entityIds: burrowIds,
                payload: { abilityId: BURROW_ABILITY, enabled: false } })}>잠복 해제</button>
          </div>
          <p className="sr-help" role="status">
            {worker && ["toBuild", "constructing"].includes(worker.task) ? "건설 예약을 먼저 취소해야 잠복할 수 있습니다." :
              !burrowReady ? "해처리에서 버로우 연구 필요 · ◆ 100 ◉ 100 · 25초" :
              burrowActors.some((e) => e.definitionId === "zerg-lurker") ? "러커는 잠복 중에만 공격합니다. 이동·탑승하려면 직접 잠복을 해제하세요. 위에 유닛이 있으면 먼저 비워 주세요." :
              burrowIds.length > 0 ? `잠복 ${burrowIds.length}기 · 직접 해제 전까지 이동·공격·작업 불가. 위에 유닛이 있으면 먼저 비워 주세요.` :
              "잠복하면 적 탐지기 없이 보이지 않습니다. 이동·공격·작업을 하려면 직접 잠복을 해제하세요."}
          </p>
        </div>
      )}
      {worker && (
        <>
          <p className="sr-help">
            건설 버튼 → 건물 선택 → 전장 위치 터치 → 건설 확정
          </p>
          <div className="sr-work-status">
            {first.burrowed ? "잠복 중" : tasks[worker.task] ?? worker.task} · 운반 ◆ {worker.cargoMinerals}{" "}
            ◉ {worker.cargoGas}
          </div>
          <div className="sr-action-row">
            <button
              disabled={!running || first.burrowed}
              onClick={() => issue({ kind: "autoGather", entityIds: selected })}
            >
              자동 채취
            </button>
            <button
              disabled={!running || first.burrowed}
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
            {isLarvaProducer(def.id) && (
              <span>라바 {building.larva} / 3</span>
            )}
            {def.power && !building.powered && (
              <span className="sr-locked">동력 필요 · 생산 정지</span>
            )}
            {def.addonParent && !building.powered && <span className="sr-locked">부모 건물 연결 필요 · 연구 정지</span>}
          </div>
          {def.id === "zerg-hatchery" && <button data-morph="zerg-lair" disabled={!running || !!building.morph || !!building.research || !has("zerg-spawning-pool") || !canAfford(150, 100)}
            onClick={() => issue({ kind: "morphStructure", entityIds: selected, payload: { buildingId: "zerg-lair" } })}>레어 변태 ◆ 150 ◉ 100 · 31.25초{!has("zerg-spawning-pool") ? " · 스포닝 풀 필요" : ""}</button>}
          {building.morph && <div className="sr-research-status"><span>레어 변태 중 · {Math.ceil(building.morph.remainingTicks / 20)}초</span><progress max={building.morph.totalTicks} value={building.morph.totalTicks - building.morph.remainingTicks} /><button disabled={!running} onClick={() => issue({ kind: "cancelStructureMorph", entityIds: [building.entityId] })}>변태 취소 · 75% 환불</button></div>}
          <div className="sr-action-label">생산 · 길게 누르면 반복</div>
          <div className="sr-build-grid">
            {ECONOMY_DEFINITIONS.filter(
              (d) => d.kind !== "building" && countsAsDefinition(def.id, d.producer),
            ).map((d) => {
              const why = reason(d),
                repeat = building.repeatUnitId === d.id,
                allowed =
                  running &&
                  !why &&
                  building.powered &&
                  (!building.research || isLarvaProducer(def.id)) &&
                  building.queue.length < 5 &&
                  (!isLarvaProducer(def.id) || building.larva > 0) &&
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
          {ECONOMY_UPGRADES.filter((t) => countsAsDefinition(def.id, t.producer)).map((t) => {
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
                  !!building.research ||
                  !!building.morph ||
                  (building.queue.length > 0 && !isLarvaProducer(def.id)) ||
                  !building.powered ||
                  !technologyRequirements(t.id).every(has) ||
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
                {t.name} {[BURROW_RESEARCH, "ventral-sacs", "personnel-cloaking", "cloaking-field", "tank-siege-mode", "lurker-aspect", "recall", "stasis-field"].includes(t.id) ? "연구" : "1단계"} {done ? "완료" : cost(t.minerals, t.gas)}
                {t.id === BURROW_RESEARCH && !done && <small>25초 · 드론·저글링·히드라 잠복</small>}
                {t.id === "ventral-sacs" && !done && <small>50초 · 오버로드 8칸 수송</small>}
                {t.id === "personnel-cloaking" && !done && <small>25초 · 고스트 수동 은폐</small>}
                {t.id === "cloaking-field" && !done && <small>31.25초 · 레이스 수동 은폐</small>}
                {t.id === "recall" && !done && <small>37.5초 · 에너지 150 · 아군 소환</small>}
                {t.id === "stasis-field" && !done && <small>31.25초 · 에너지 100 · 범위 정지</small>}
                {t.id === "lurker-aspect" && !done && <small>37.5초 · 레어 필요 · 히드라 → 러커</small>}
                {t.id === "tank-siege-mode" && !done && <small>25초 · 시즈 탱크 포격 모드</small>}
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
            disabled={!running || entities.every((e) => !!e.stasisTicks || !!e.recallTicks || !!e.siegeTransition || !!e.unitMorph)}
            onClick={() => issue({ kind: "stop", entityIds: selected })}
          >
            정지
          </button>
          <button
            disabled={!running || entities.every((e) => !!e.stasisTicks || !!e.recallTicks || !!e.siegeTransition || !!e.unitMorph)}
            onClick={() => issue({ kind: "hold", entityIds: selected })}
          >
            위치 사수
          </button>
        </div>
      )}
    </div>
  );
}
