"use client";
import { unitTraits } from "../abilities/special-state";
import { hasBasicWeapon } from "../combat/catalog";
import type { Scenario } from "../combat/state";
import type { WorkerToMainMessage } from "../worker/messages";
import { useEffect, useMemo, useRef, useState } from "react";
import { getRuntimeMap } from "../data/maps";
import type { Faction } from "../data/economy-catalog";
import type { PersistenceEnvelope, SessionState } from "../core/state";
import type { RenderSnapshot } from "../worker/render-snapshot";
import { openSimulationClient, type SimulationClient } from "../worker/client";
import { InteractiveBattle } from "./interactive-battle";
import { CheckpointStore } from "./checkpoints";
import { PortraitOnly } from "./portrait-only";
import { isPortraitViewport } from "../input/portrait-mode";

/** Hosted development host uses the production Worker, map and economy rules. */
export function SimulationSession({
  seed,
  scenario = "economy",
  faction = "terran",
  initialSnapshot = null,
  onSave,
  onExit,
}: {
  scenario?: Scenario;
  seed: number;
  faction?: Faction;
  initialSnapshot?: PersistenceEnvelope | null;
  onSave?: (snapshot: PersistenceEnvelope) => void | Promise<void>;
  onExit?: () => void;
}) {
  const registered = useMemo(() => getRuntimeMap("rift-basin"), []);
  const client = useRef<SimulationClient | null>(null),
    checkpoints = useRef(new CheckpointStore());
  const pendingRestore = useRef<{
    seed: number;
    snapshot: PersistenceEnvelope;
  } | null>(null);
  const initialSession = (): SessionState => ({
    camera: {
      centerX:
        (scenario === "special-practice" && faction === "zerg" ? 24 : scenario === "special-practice" && faction === "protoss" ? 22 : scenario !== "economy" ? 18 : registered.map.spawnPoints[0].x) * 256,
      centerY:
        (scenario !== "economy"
          ? ["ranged-practice", "special-practice"].includes(scenario)
            ? 20
            : 18
          : registered.map.spawnPoints[0].y) * 256,
      zoomLevel: 1,
    },
    selection: { entityIds: [1], controlGroupIds: [] },
    openPanel: null,
  });
  const session = useRef<SessionState>(initialSession());
  const callbacks = useRef({ onSave, onExit });
  callbacks.current = { onSave, onExit };
  const actions = useRef({ save: () => {}, exit: () => {} });
  const [snapshot, setSnapshot] = useState<RenderSnapshot | null>(null),
    [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false),
    [savedAt, setSavedAt] = useState<string | null>(null),
    [exiting, setExiting] = useState(false);
  const [ui, setUi] = useState<
    Extract<WorkerToMainMessage, { kind: "uiState" }>["payload"] | null
  >(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [phase, setPhase] = useState("setup"),
    [generation, setGeneration] = useState(0);
  const [restart, setRestart] = useState(0),
    [hasCheckpoint, setHasCheckpoint] = useState(false);
  useEffect(() => {
    let active = true,
      instance: SimulationClient | null = null,
      request = 0,
      failed = false,
      initialized = false,
      notification = 0,
      exitRequested = false,
      firstRender = true;
    const restoration =
      pendingRestore.current?.seed === seed
        ? pendingRestore.current.snapshot
        : initialSnapshot;
    pendingRestore.current = null;
    let restoring = restoration !== null;
    if (!restoration) {
      checkpoints.current.clear();
      session.current = initialSession();
      setHasCheckpoint(false);
    } else {
      session.current = structuredClone(restoration.session);
      setHasCheckpoint(checkpoints.current.save(restoration));
    }
    setUi(null);
    setNotice(null);
    setSnapshot(null);
    setError(null);
    setSaveError(false);
    setSavedAt(null);
    setExiting(false);
    setPhase("setup");
    const save = () => {
      if (initialized && !failed && !restoring)
        instance?.send("saveSnapshot", {
          requestId: ++request,
          session: session.current,
        });
    };
    actions.current = {
      save,
      exit: () => {
        if (failed) {
          callbacks.current.onExit?.();
          return;
        }
        if (!initialized || restoring || exitRequested) return;
        exitRequested = true;
        setExiting(true);
        instance?.send("pause", { reason: "exit" });
        save();
      },
    };
    try {
      instance = openSimulationClient((message) => {
        if (!active) return;
        if (message.kind === "ready") {
          initialized = true;
          if (restoration)
            instance?.send("loadSnapshot", { snapshot: restoration });
          else {
            if (!isPortraitViewport())
              instance?.send("pause", { reason: "orientation" });
            else setPhase("running");
            save();
          }
        }
        if (message.kind === "renderSnapshot" && !restoring && !failed) {
          if (firstRender && !restoration && scenario !== "economy") {
            session.current.selection = {
              entityIds: message.payload.entities
                .filter(
                  (e) =>
                    e.owner === 0 &&
                    e.kind === "combat" &&
                    (scenario === "special-practice" ? !!unitTraits(e.definitionId)?.spaceProvided && message.payload.combat?.scenario === "special-practice" : hasBasicWeapon(e.definitionId)),
                )
                .map((e) => e.id),
              controlGroupIds:
                scenario === "special-practice" ? [] : scenario === "ranged-practice" && faction === "terran"
                  ? [0, 1]
                  : [0],
            };
          }
          firstRender = false;
          setSnapshot(message.payload);
        }
        if (message.kind === "uiState") setUi(message.payload);
        if (message.kind === "commandAck")
          setNotice(
            message.payload.accepted
              ? null
              : "명령을 실행하지 못했습니다. 선택한 대상과 목적지를 확인해 주세요.",
          );
        if (message.kind === "phaseChanged") {
          setPhase(message.payload.phase);
          if (message.payload.phase === "finished") save();
        }
        if (message.kind === "snapshotLoaded") {
          restoring = false;
          failed = false;
          setSnapshot(null);
          setGeneration((v) => v + 1);
          setError(null);
        }
        if (
          message.kind === "saveSnapshotReady" &&
          checkpoints.current.save(message.payload.snapshot)
        ) {
          setHasCheckpoint(true);
          const copy = checkpoints.current.read()!,
            callback = callbacks.current.onSave,
            sequence = ++notification;
          Promise.resolve()
            .then(() => callback?.(copy))
            .then(
              () => {
                if (!active || sequence !== notification) return;
                setSaveError(false);
                setSavedAt(copy.savedAt);
                if (exitRequested) callbacks.current.onExit?.();
              },
              () => {
                if (active && sequence === notification) {
                  setSaveError(true);
                  exitRequested = false;
                  setExiting(false);
                }
              },
            );
        }
        if (message.kind === "fatalError" && !failed) {
          failed = true;
          exitRequested = false;
          setExiting(false);
          setError("경기를 멈췄습니다. 마지막 정상 저장본으로 복구해 주세요.");
          instance?.send("pause", { reason: "error" });
        }
      });
      client.current = instance;
      instance.send("init", {
        scenario,
        seed: restoration?.simulation.seed ?? seed,
        mapId: registered.map.id,
        dataVersion: registered.dataVersion,
        players: [
          { id: 0, faction, controller: "human" },
          {
            id: 1,
            faction: scenario === "special-practice" ? "protoss" : scenario === "siege-practice" ? "terran" : "zerg",
            controller: "ai",
          },
        ],
      });
    } catch (reason) {
      failed = true;
      setError(
        reason instanceof Error
          ? reason.message
          : "경기를 시작하지 못했습니다.",
      );
    }
    const visibility = () => {
      instance?.suspendHealthCheck();
      if (document.hidden) {
        instance?.send("pause", { reason: "background" });
        save();
      }
    };
    document.addEventListener("visibilitychange", visibility);
    const interval = setInterval(save, 10000);
    const health = setInterval(() => {
      if (!document.hidden && !failed) instance?.checkHealth();
    }, 1000);
    return () => {
      active = false;
      clearInterval(interval);
      clearInterval(health);
      document.removeEventListener("visibilitychange", visibility);
      instance?.dispose();
      client.current = null;
      actions.current = { save: () => {}, exit: () => {} };
    };
  }, [registered, seed, faction, scenario, initialSnapshot, restart]);
  const recover = () => {
    const saved = checkpoints.current.read();
    if (!saved) return;
    pendingRestore.current = { seed, snapshot: saved };
    client.current?.dispose();
    client.current = null;
    setRestart((value) => value + 1);
  };
  const result = ui?.phase === "finished" ? ui.outcome : null;
  const surrender = () => {
    if (
      !ui ||
      !snapshot ||
      !client.current ||
      !window.confirm("항복하면 이번 경기가 종료됩니다. 항복할까요?")
    )
      return;
    const tick = Math.max(ui.tick, snapshot.tick);
    client.current.send("resume", { reason: "surrender" });
    client.current.send("commandBatch", {
      commands: [
        {
          kind: "surrender",
          entityIds: [],
          sequence: ui.lastAcceptedSequence + 1,
          issuedTick: tick,
          executeTick: tick + 1,
          playerId: snapshot.viewerPlayerId,
          source: "player",
        },
      ],
      lastSeenTick: tick,
    });
  };
  return (
    <PortraitOnly
      onBlocked={() => client.current?.send("pause", { reason: "orientation" })}
    >
      <div className="sr-session-content">
        <header className="sr-session-toolbar">
          <div className="sr-session-title">
            <strong>스타크 리프트</strong>
            <span>
              개발 테스트 ·{" "}
              {savedAt ? "이 브라우저에 저장됨" : "자동 저장 준비 중"}
            </span>
          </div>
          <button
            disabled={!ui || !!error || exiting}
            onClick={() => actions.current.save()}
          >
            저장
          </button>
          {onExit && (
            <button
              disabled={exiting || (!ui && !error)}
              onClick={() => actions.current.exit()}
            >
              {exiting ? "저장 중…" : error ? "선택 화면" : "저장하고 나가기"}
            </button>
          )}
          {saveError && onExit && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "저장하지 않고 선택 화면으로 나갈까요? 마지막 저장 이후 진행은 사라집니다.",
                  )
                )
                  onExit();
              }}
            >
              저장 없이 선택 화면
            </button>
          )}
          {saveError && (
            <span className="sr-session-save-error" role="status">
              브라우저 저장에 실패했습니다. 현재 창의 복구본은 유지됩니다.
            </span>
          )}
        </header>
        {snapshot?.combat && snapshot.combat.scenario !== "economy" && (
          <div className="sr-practice-status" role="status">
            {snapshot.combat.scenario === "special-practice" ? "특수 연습" : snapshot.combat.scenario === "ranged-practice"
              ? "원거리 연습"
              : snapshot.combat.scenario === "siege-practice"
                ? "본부 공략"
                : "전투 연습"}{" "}
            · 남은 적 {snapshot.combat.targetsRemaining}/
            {snapshot.combat.totalTargets} · 아군{" "}
            {snapshot.combat.friendlyRemaining}
            {snapshot.combat.targetsRemaining === 0
              ? " · 목표 처치 완료"
              : snapshot.combat.friendlyRemaining === 0
                ? " · 연습 병력 전멸 · 선택 화면에서 다시 시작하세요"
                : snapshot.combat.scenario === "special-practice" ? " · 탑승 → 부대 선택 → 하차 지점" : " · 부대 1번 → 붉은 적 터치"}
          </div>
        )}
        <div className="sr-session-battle">
          {snapshot && ui && (
            <InteractiveBattle
              key={generation}
              map={registered.map}
              snapshot={snapshot}
              initialSession={session.current}
              ui={ui}
              notice={notice}
              send={(command) =>
                client.current?.send("commandBatch", {
                  commands: [command],
                  lastSeenTick: command.issuedTick,
                })
              }
              onPause={() => {
                client.current?.send("pause", { reason: "menu" });
                actions.current.save();
              }}
              onRenderFailure={() =>
                setError(
                  "화면 연결이 끊어졌습니다. 마지막 저장으로 화면과 경기를 복구해 주세요.",
                )
              }
              onSessionChange={(value) => {
                session.current = value;
              }}
            />
          )}
          {!snapshot && !error && (
            <p className="sr-session-feedback" role="status">
              경기를 준비하고 있습니다.
            </p>
          )}
          {error && (
            <div className="sr-session-feedback" role="alert">
              <p>{error}</p>
              {hasCheckpoint && (
                <button onClick={recover}>마지막 저장으로 복구</button>
              )}
            </div>
          )}
          {phase === "paused" && !error && (
            <div className="sr-session-resume sr-pause-actions">
              <button
                onClick={() =>
                  client.current?.send("resume", { reason: "user" })
                }
              >
                이어서 진행
              </button>
              <button onClick={surrender}>항복</button>
            </div>
          )}
          {result && !error && (
            <section
              className="sr-match-result"
              role="dialog"
              aria-label="경기 결과"
            >
              <strong>
                {result.kind === "draw"
                  ? "무승부"
                  : result.winnerPlayerId === snapshot?.viewerPlayerId
                    ? "승리"
                    : "패배"}
              </strong>
              <p>
                {result.kind === "surrender"
                  ? "항복으로 경기가 종료됐습니다."
                  : result.kind === "draw"
                    ? "양쪽의 마지막 본부 건물이 동시에 파괴됐습니다."
                    : result.winnerPlayerId === snapshot?.viewerPlayerId
                      ? "상대의 모든 본부 건물을 파괴했습니다."
                      : "모든 아군 본부 건물을 잃었습니다."}
              </p>
              <p>
                진행 시간 · {Math.floor(result.decidedTick / 1200)}분{" "}
                {Math.floor(result.decidedTick / 20) % 60}초
              </p>
              {onExit && (
                <button
                  onClick={() => actions.current.exit()}
                  disabled={exiting}
                >
                  결과 저장하고 나가기
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </PortraitOnly>
  );
}
