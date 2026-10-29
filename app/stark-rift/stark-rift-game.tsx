"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { withKoreanDirection, withKoreanObject } from "../korean-particles.js";
import {
  STARK_RIFT_BUILDABLE_IDS,
  STARK_RIFT_COMBAT_UNIT_IDS,
  STARK_RIFT_DIFFICULTIES,
  STARK_RIFT_ECONOMY,
  STARK_RIFT_FACTIONS,
  STARK_RIFT_FORMATIONS,
  STARK_RIFT_SQUAD_IDS,
  STARK_RIFT_STRATEGIES,
  STARK_RIFT_ZONES,
} from "./stark-rift-data.js";
import {
  advanceStarkRift,
  createStarkRiftGame,
  starkRiftBuildCheck,
  starkRiftBuildingDefinition,
  starkRiftBuildingCost,
  starkRiftBuildingDone,
  starkRiftClock,
  starkRiftCommand,
  starkRiftIncomePerMinute,
  starkRiftMiningRate,
  starkRiftModifiers,
  starkRiftOwnsZone,
  starkRiftSlotsFree,
  starkRiftSquadSummary,
  starkRiftSupply,
  starkRiftTrainCheck,
  starkRiftUnitDefinition,
  starkRiftUnitCost,
  starkRiftZoneAt,
  starkRiftZoneOwner,
} from "./stark-rift-engine.js";
import { starkRiftAiStatus, starkRiftAiThink } from "./stark-rift-ai.js";
import { drawStarkRift, starkRiftCenterTop, starkRiftScreenToMap, starkRiftViewport } from "./stark-rift-renderer.js";
import type {
  StarkRiftBuilding,
  StarkRiftBuildingType,
  StarkRiftCheck,
  StarkRiftCommand,
  StarkRiftDifficulty,
  StarkRiftFaction,
  StarkRiftFormation,
  StarkRiftSquadId,
  StarkRiftSquadSummary,
  StarkRiftState,
  StarkRiftStrategy,
  StarkRiftTrainable,
  StarkRiftUnitType,
} from "./stark-rift-types";
import { starkRiftHasVisibleEnemy, starkRiftZoneIntel } from "./stark-rift-vision.js";

type Screen = "menu" | "play";
type Tab = "squad" | "build" | "train" | "workers";
type Toast = { id: number; text: string; tone: "good" | "warn" };
type BattleRecord = { wins: number; losses: number; best: Partial<Record<StarkRiftDifficulty, number>> };

const RECORD_KEY = "paperoid-stark-rift-record";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "squad", label: "부대", icon: "⚑" },
  { id: "build", label: "건설", icon: "▣" },
  { id: "train", label: "생산", icon: "✚" },
  { id: "workers", label: "일꾼", icon: "⛏" },
];
const DIFFICULTY_IDS: StarkRiftDifficulty[] = ["easy", "normal", "hard"];
const FACTION_IDS: StarkRiftFaction[] = ["vanguard", "brood", "conclave"];
const STRATEGY_IDS: StarkRiftStrategy[] = ["balanced", "expand", "assault"];
const FORMATION_IDS: StarkRiftFormation[] = ["line", "wedge", "spread"];
const SQUAD_IDS = STARK_RIFT_SQUAD_IDS as StarkRiftSquadId[];
const COMBAT_IDS = STARK_RIFT_COMBAT_UNIT_IDS as StarkRiftUnitType[];
const TRAINABLE_IDS: StarkRiftTrainable[] = ["worker", "rifle", "guard", "tank"];
const BUILDABLE_IDS = STARK_RIFT_BUILDABLE_IDS as StarkRiftBuildingType[];

function readRecord(): BattleRecord {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECORD_KEY) ?? "null");
    if (parsed && typeof parsed.wins === "number" && typeof parsed.losses === "number") return { wins: parsed.wins, losses: parsed.losses, best: parsed.best ?? {} };
  } catch {
    // 저장소를 쓸 수 없는 환경에서도 게임은 진행한다.
  }
  return { wins: 0, losses: 0, best: {} };
}

function writeRecord(record: BattleRecord) {
  try {
    window.localStorage.setItem(RECORD_KEY, JSON.stringify(record));
  } catch {
    // 기록 저장 실패는 무시한다.
  }
}

function zoneName(id: string) {
  return STARK_RIFT_ZONES.find((zone) => zone.id === id)?.name ?? id;
}

function playerBuildings(game: StarkRiftState) {
  return game.buildings.filter((building) => building.side === "player");
}

export function StarkRiftGame({ onExit }: { onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>("menu");
  const [difficulty, setDifficulty] = useState<StarkRiftDifficulty>("normal");
  const [faction, setFaction] = useState<StarkRiftFaction>("vanguard");
  const [strategy, setStrategy] = useState<StarkRiftStrategy>("balanced");
  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [tab, setTab] = useState<Tab>("squad");
  const [selectedZone, setSelectedZone] = useState("center");
  const [selectedSquad, setSelectedSquad] = useState<StarkRiftSquadId>(1);
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [record, setRecord] = useState<BattleRecord>(() => (typeof window === "undefined" ? { wins: 0, losses: 0, best: {} } : readRecord()));
  // 엔진 상태는 게임 루프가 직접 바꾸는 가변 객체다. 화면은 game 상태로 읽고, 0.25초마다 frame을 올려 다시 그린다.
  const [game, setGame] = useState<StarkRiftState | null>(null);
  const [mapMode, setMapMode] = useState<"fill" | "fit">("fill");

  const gameRef = useRef<StarkRiftState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef(starkRiftViewport(1, 1));
  const sizeRef = useRef({ width: 1, height: 1 });
  const cameraRef = useRef({ mode: "fill" as "fill" | "fit", top: Infinity });
  const dragRef = useRef<{ id: number; y: number; top: number; moved: boolean } | null>(null);
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  const uiRef = useRef({ selectedZone, selectedSquad });
  const recordedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused || confirmExit;
    speedRef.current = speed;
    uiRef.current = { selectedZone, selectedSquad };
    cameraRef.current.mode = mapMode;
  }, [confirmExit, mapMode, paused, selectedSquad, selectedZone, speed]);

  useEffect(() => {
    // 칩으로 고른 지역이 화면 밖이면 카메라를 그 지역으로 옮긴다.
    const zone = STARK_RIFT_ZONES.find((item) => item.id === selectedZone);
    const view = viewRef.current;
    if (!zone || !view.maxTop) return;
    const visibleTop = view.top;
    const visibleBottom = view.top + view.height / view.scale;
    if (zone.y - zone.radius < visibleTop || zone.y + zone.radius > visibleBottom) cameraRef.current.top = starkRiftCenterTop(view, zone.y);
  }, [selectedZone]);

  const refresh = useCallback(() => setFrame((value) => value + 1), []);

  const showToast = useCallback((text: string, tone: Toast["tone"] = "warn") => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const startBattle = () => {
    const enemyFaction = FACTION_IDS[(FACTION_IDS.indexOf(faction) + 1 + Math.floor(Math.random() * 2)) % FACTION_IDS.length];
    const next = createStarkRiftGame({
      difficulty,
      playerFaction: faction,
      enemyFaction,
      playerStrategy: strategy,
      enemyStrategy: STRATEGY_IDS[Math.floor(Math.random() * STRATEGY_IDS.length)],
      seed: Math.floor(Math.random() * 2 ** 31),
    }) as unknown as StarkRiftState;
    gameRef.current = next;
    setGame(next);
    recordedRef.current = false;
    cameraRef.current.top = Infinity;
    setMapMode(window.matchMedia("(min-width: 900px)").matches ? "fit" : "fill");
    setSelectedZone("center");
    setSelectedSquad(1);
    setTab("squad");
    setPaused(false);
    setSpeed(1);
    setConfirmExit(false);
    setScreen("play");
  };

  const draw = useCallback((clock: number) => {
    const canvas = canvasRef.current;
    const game = gameRef.current;
    if (!canvas || !game) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const camera = cameraRef.current;
    const view = starkRiftViewport(sizeRef.current.width, sizeRef.current.height, camera.mode, camera.top);
    camera.top = view.top;
    viewRef.current = view;
    drawStarkRift(context, game, view, { ...uiRef.current, clock });
  }, []);

  useEffect(() => {
    if (screen !== "play") return;
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;
    const resize = () => {
      const rect = map.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      sizeRef.current = { width: rect.width, height: rect.height };
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(map);
    return () => observer.disconnect();
  }, [screen]);

  useEffect(() => {
    if (screen !== "play") return;
    let frame = 0;
    let last = performance.now();
    let uiTimer = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const game = gameRef.current;
      if (game && !pausedRef.current && game.status === "playing") advanceStarkRift(game, dt * speedRef.current, starkRiftAiThink);
      draw(now / 1000);
      uiTimer += dt;
      if (uiTimer >= 0.25) {
        uiTimer = 0;
        setFrame((value) => value + 1);
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    const handleVisibility = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [draw, screen]);

  const finished = screen === "play" && game?.status === "over";

  useEffect(() => {
    if (!finished || !game || recordedRef.current) return;
    recordedRef.current = true;
    const won = game.winner === "player";
    const current = readRecord();
    const best = { ...current.best };
    if (won && (!best[game.difficulty] || game.time < (best[game.difficulty] ?? Infinity))) best[game.difficulty] = Math.round(game.time);
    const next = { wins: current.wins + (won ? 1 : 0), losses: current.losses + (won ? 0 : 1), best };
    writeRecord(next);
    setRecord(next);
  }, [finished, game]);

  const issue = (command: StarkRiftCommand, success?: string) => {
    if (!game) return;
    const result = starkRiftCommand(game, "player", command) as StarkRiftCheck;
    if (!result.ok) showToast(result.reason ?? "명령을 수행할 수 없습니다.");
    else if (success) showToast(success, "good");
    refresh();
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { id: event.pointerId, y: event.clientY, top: viewRef.current.top, moved: false };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) < 8) return;
    drag.moved = true;
    cameraRef.current.top = drag.top - dy / viewRef.current.scale;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.moved) return;
    selectAt(event);
  };

  const selectAt = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const current = game;
    if (!current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = starkRiftScreenToMap(viewRef.current, event.clientX - rect.left, event.clientY - rect.top);
    const touchSlack = 14 / viewRef.current.scale;
    const unit = current.units
      .filter((item) => item.side === "player")
      .map((item) => ({ item, distance: Math.hypot(item.x - point.x, item.y - point.y) }))
      .filter((entry) => entry.distance <= Math.max(2.5, touchSlack))
      .sort((a, b) => a.distance - b.distance)[0]?.item;
    if (unit && tab === "squad") {
      setSelectedSquad(unit.squad);
      return;
    }
    const zone = starkRiftZoneAt(point.x, point.y);
    if (zone) setSelectedZone(zone);
  };

  const requestExit = () => {
    if (screen === "play" && game?.status === "playing") {
      setConfirmExit(true);
      return;
    }
    onExit();
  };

  if (screen === "menu" || !game) {
    return (
      <main className="sr-shell sr-menu-shell" data-game-menu="true">
        <header className="sr-topbar">
          <button type="button" onClick={onExit} aria-label="게임 목록으로">←</button>
          <div><span className="sr-brand">paperoid</span><strong>Stark Rift</strong></div>
          <span aria-hidden="true" />
        </header>
        <section className="sr-menu">
          <div className="sr-menu-hero">
            <small>COMMAND · MANAGE · CONQUER</small>
            <h1>손이 아니라<br />판단으로 이기는 전쟁</h1>
            <p>서로 다른 세 종족 중 하나를 지휘하세요. 광석을 캐고 기지를 넓힌 뒤, 부대에 목표와 대열을 정해 전장을 장악합니다.</p>
          </div>
          <section className="sr-choice" aria-labelledby="sr-faction-heading">
            <div><small>01 · FACTION</small><h2 id="sr-faction-heading">종족 선택</h2></div>
            <div className="sr-faction-grid" role="radiogroup" aria-label="종족">
              {FACTION_IDS.map((id) => {
                const item = STARK_RIFT_FACTIONS[id];
                return (
                  <button key={id} type="button" role="radio" aria-checked={faction === id} className={faction === id ? "active" : ""} onClick={() => setFaction(id)} style={{ "--faction-color": item.color } as CSSProperties}>
                    <i>{item.icon}</i><b>{item.name}</b><em>{item.tagline}</em><span>{item.note}</span>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="sr-choice" aria-labelledby="sr-strategy-heading">
            <div><small>02 · DOCTRINE</small><h2 id="sr-strategy-heading">개전 전략</h2></div>
            <div className="sr-doctrine-grid" role="radiogroup" aria-label="개전 전략">
              {STRATEGY_IDS.map((id) => {
                const item = STARK_RIFT_STRATEGIES[id];
                return (
                  <button key={id} type="button" role="radio" aria-checked={strategy === id} className={strategy === id ? "active" : ""} onClick={() => setStrategy(id)}>
                    <i>{item.icon}</i><b>{item.name}</b><span>{item.note}</span>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="sr-choice" aria-labelledby="sr-difficulty-heading">
            <div><small>03 · OPPONENT</small><h2 id="sr-difficulty-heading">AI 난이도</h2></div>
          <div className="sr-difficulty" role="radiogroup" aria-label="난이도">
            {DIFFICULTY_IDS.map((id) => {
              const item = STARK_RIFT_DIFFICULTIES[id];
              return (
                <button key={id} type="button" role="radio" aria-checked={difficulty === id} className={difficulty === id ? "active" : ""} onClick={() => setDifficulty(id)}>
                  <b>{item.name}</b>
                  <span>{item.note}</span>
                  {record.best[id] ? <em>최단 승리 {starkRiftClock(record.best[id] ?? 0)}</em> : null}
                </button>
              );
            })}
          </div>
          </section>
          <ol className="sr-howto">
            <li><b>경제</b><span>일꾼은 자동으로 광산에 배치됩니다. 사령부에서 일꾼을 늘리고 보급고로 보급 한도를 올리세요.</span></li>
            <li><b>건설·생산</b><span>생산 건물을 세우고 선택한 종족의 주력병·전열병·포격병을 편성하세요.</span></li>
            <li><b>정찰</b><span>미탐색 지역에 부대를 보내 시야를 확보하세요. 정찰한 지역과 주변 정보는 24초 동안 유지됩니다.</span></li>
            <li><b>부대 지휘</b><span>지도에서 지역을 누른 뒤 진격, 이동, 후퇴 중 하나를 고르세요. 대열은 횡대, 쐐기, 산개 중에서 바꿀 수 있습니다.</span></li>
            <li><b>승리</b><span>적 본진의 사령부를 파괴하면 승리합니다. 아군 사령부를 잃으면 패배합니다.</span></li>
          </ol>
          <button type="button" className="sr-start" onClick={startBattle}>{STARK_RIFT_FACTIONS[faction].name} 출격</button>
          <p className="sr-record-line">전적 {record.wins}승 {record.losses}패</p>
        </section>
      </main>
    );
  }

  const supply = starkRiftSupply(game, "player") as { used: number; cap: number };
  const income = starkRiftIncomePerMinute(game, "player") as number;
  const workers = Object.values(game.sides.player.workers).reduce((sum, count) => sum + count, 0) + game.sides.player.transit.length;
  const recentLog = game.log.filter((entry) => entry.side === "player" && game.time - entry.time < 10).slice(-2);
  const enemyStatus = starkRiftHasVisibleEnemy(game, "player") ? starkRiftAiStatus(game, "enemy") as string : "정찰 정보 없음";

  return (
    <main className="sr-shell sr-play-shell" data-game-menu={finished ? "true" : undefined}>
      <header className="sr-topbar">
        <button type="button" onClick={requestExit} aria-label="전투 나가기">←</button>
        <div><span className="sr-brand">{STARK_RIFT_FACTIONS[game.sides.player.faction].name} · {STARK_RIFT_STRATEGIES[game.sides.player.strategy].name}</span><strong>{starkRiftClock(game.time)}</strong></div>
        <span aria-hidden="true" />
      </header>
      <section className="sr-hud" aria-label="자원 현황">
        <span className="sr-hud-ore"><small>광석</small><b>{Math.floor(game.sides.player.ore)}</b><em>+{income}/분</em></span>
        <span className={supply.used >= supply.cap ? "sr-hud-supply full" : "sr-hud-supply"}><small>보급</small><b>{supply.used}/{supply.cap}</b></span>
        <span><small>일꾼</small><b>{workers}</b></span>
        <div className="sr-speed">
          <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "계속하기" : "일시정지"}>{paused ? "▶" : "Ⅱ"}</button>
          <button type="button" onClick={() => setSpeed((value) => (value === 1 ? 2 : 1))} aria-label="게임 속도 전환">{speed}×</button>
        </div>
      </section>
      <div className="sr-body">
        <div className="sr-map" ref={mapRef}>
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => { dragRef.current = null; }}
            aria-label="전장 지도. 지역을 눌러 목표로 선택하고 위아래로 끌어 이동합니다."
          />
          <button type="button" className="sr-map-mode" onClick={() => setMapMode((value) => (value === "fill" ? "fit" : "fill"))}>
            {mapMode === "fill" ? "전체 지도" : "확대 지도"}
          </button>
          <span className="sr-enemy-chip">{STARK_RIFT_FACTIONS[game.sides.enemy.faction].name} · {enemyStatus}</span>
          <ul className="sr-log" aria-live="polite">
            {recentLog.map((entry) => <li key={entry.id} className={`tone-${entry.tone}`}><span>{starkRiftClock(entry.time)}</span>{entry.text}</li>)}
          </ul>
          {toast ? <p key={toast.id} className={`sr-toast tone-${toast.tone}`} role="status">{toast.text}</p> : null}
          {paused && !finished && !confirmExit ? (
            <div className="sr-overlay">
              <section>
                <h2>일시정지</h2>
                <p>지휘 화면을 잠시 멈췄습니다.</p>
                <button type="button" className="sr-primary" onClick={() => setPaused(false)}>계속하기</button>
                <button type="button" className="sr-secondary" onClick={() => setConfirmExit(true)}>전투 포기</button>
              </section>
            </div>
          ) : null}
        </div>
        <section className="sr-panel" aria-label="지휘 패널">
          <nav className="sr-tabs" aria-label="지휘 메뉴">
            {TABS.map((item) => (
              <button key={item.id} type="button" aria-pressed={tab === item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
                <i aria-hidden="true">{item.icon}</i>{item.label}
              </button>
            ))}
          </nav>
          <div className="sr-panel-body" key={tab}>
            {tab === "squad" ? (
              <SquadPanel game={game} selectedSquad={selectedSquad} selectedZone={selectedZone} onSelectSquad={setSelectedSquad} onSelectZone={setSelectedZone} issue={issue} />
            ) : null}
            {tab === "build" ? <BuildPanel game={game} selectedZone={selectedZone} onSelectZone={setSelectedZone} issue={issue} /> : null}
            {tab === "train" ? <TrainPanel game={game} issue={issue} /> : null}
            {tab === "workers" ? <WorkersPanel game={game} issue={issue} /> : null}
          </div>
        </section>
      </div>
      {confirmExit ? (
        <div className="sr-overlay sr-overlay-full" role="dialog" aria-modal="true" aria-labelledby="sr-exit-title">
          <section>
            <h2 id="sr-exit-title">전투를 포기할까요?</h2>
            <p>진행 중인 전투는 저장되지 않으며 패배로 기록되지 않습니다.</p>
            <button type="button" className="sr-primary" onClick={() => setConfirmExit(false)}>계속 지휘하기</button>
            <button type="button" className="sr-secondary" onClick={() => { setConfirmExit(false); setScreen("menu"); }}>난이도 선택으로</button>
            <button type="button" className="sr-secondary" onClick={onExit}>게임 목록으로</button>
          </section>
        </div>
      ) : null}
      {finished ? <ResultOverlay game={game} onRestart={startBattle} onMenu={() => setScreen("menu")} onExit={onExit} /> : null}
    </main>
  );
}

type IssueFn = (command: StarkRiftCommand, success?: string) => void;

function SquadPanel({ game, selectedSquad, selectedZone, onSelectSquad, onSelectZone, issue }: {
  game: StarkRiftState;
  selectedSquad: StarkRiftSquadId;
  selectedZone: string;
  onSelectSquad: (id: StarkRiftSquadId) => void;
  onSelectZone: (id: string) => void;
  issue: IssueFn;
}) {
  const summaries = SQUAD_IDS.map((id) => starkRiftSquadSummary(game, "player", id) as StarkRiftSquadSummary);
  const current = summaries.find((summary) => summary.id === selectedSquad) ?? summaries[0];
  const formation = STARK_RIFT_FORMATIONS[current.formation];
  const rally = game.sides.player.rallySquad;
  const others = SQUAD_IDS.filter((id) => id !== current.id);
  const target = zoneName(selectedZone);
  const orderHint = `목표 지역: ${target}`;
  return (
    <div className="sr-squad">
      <div className="sr-squad-tabs" role="tablist" aria-label="부대 선택">
        {summaries.map((summary) => (
          <button key={summary.id} type="button" role="tab" aria-selected={summary.id === current.id} className={summary.id === current.id ? "active" : ""} onClick={() => onSelectSquad(summary.id)}>
            <b>{summary.name}{rally === summary.id ? " ★" : ""}</b>
            <span>{summary.size}기 · {summary.status}</span>
          </button>
        ))}
      </div>
      <div className="sr-squad-summary">
        <p className="sr-squad-where">
          <b>{current.zoneName}</b> {current.order === "attack" ? "진격 목표" : current.order === "scout" ? "정찰 목표" : "집결지"}{current.size ? ` · 체력 ${Math.round(current.health * 100)}%` : " · 병력 없음"}
        </p>
        <div className="sr-unit-counts">
          {COMBAT_IDS.map((type) => <span key={type}><i className={`sr-icon ${type}`} aria-hidden="true" />{starkRiftUnitDefinition(game, "player", type).name} <b>{current.counts[type]}</b></span>)}
        </div>
      </div>
      <div className="sr-zone-picker">
        <small>목표 지역 · 지도에서 눌러도 됩니다</small>
        <div>
          {STARK_RIFT_ZONES.map((zone) => {
            const intel = starkRiftZoneIntel(game, "player", zone.id);
            return <button key={zone.id} type="button" aria-pressed={zone.id === selectedZone} className={`${zone.id === selectedZone ? "active" : ""} intel-${intel}`} onClick={() => onSelectZone(zone.id)}>{intel === "unknown" ? "?" : zone.short}</button>;
          })}
        </div>
      </div>
      <p className="sr-order-target">{orderHint}</p>
      <div className="sr-orders">
        <button type="button" className="sr-order attack" onClick={() => issue({ type: "order", squad: current.id, order: "attack", zone: selectedZone })}>
          <b>진격</b><small>싸우며 전진</small>
        </button>
        <button type="button" className="sr-order" onClick={() => issue({ type: "order", squad: current.id, order: "move", zone: selectedZone })}>
          <b>이동</b><small>교전 없이 이동</small>
        </button>
        <button type="button" className="sr-order scout" onClick={() => issue({ type: "order", squad: current.id, order: "scout", zone: selectedZone })}>
          <b>정찰</b><small>24초간 주변 공개</small>
        </button>
        <button type="button" className="sr-order retreat" onClick={() => issue({ type: "order", squad: current.id, order: "move", zone: "home" })}>
          <b>후퇴</b><small>본진으로 철수</small>
        </button>
      </div>
      <div className="sr-formation">
        <small>대열</small>
        <div>
          {FORMATION_IDS.map((id) => (
            <button key={id} type="button" aria-pressed={current.formation === id} className={current.formation === id ? "active" : ""} onClick={() => issue({ type: "formation", squad: current.id, formation: id })}>{STARK_RIFT_FORMATIONS[id].name}</button>
          ))}
        </div>
        <p className="sr-note">{formation.note}</p>
      </div>
      <div className="sr-organize">
        <button type="button" className={rally === current.id ? "sr-rally active" : "sr-rally"} aria-pressed={rally === current.id} onClick={() => issue({ type: "rally", squad: current.id }, `새 병력이 ${current.name}에 합류합니다.`)}>
          {rally === current.id ? "★ 새 병력 합류 부대" : "새 병력을 이 부대로 보내기"}
        </button>
        {current.size ? (
          <div className="sr-transfer">
            <small>편성 이동</small>
            {[null, ...COMBAT_IDS].map((type) => {
              const count = type ? current.counts[type] : current.size;
              if (!count) return null;
              const label = type ? `${starkRiftUnitDefinition(game, "player", type).name} ${count}` : `전체 ${count}`;
              return (
                <div key={type ?? "all"} className="sr-transfer-row">
                  <span>{label}</span>
                  {others.map((to) => (
                    <button key={to} type="button" onClick={() => issue({ type: "transfer", from: current.id, to, unitType: type }, `${withKoreanObject(label)} ${to}부대로 보냈습니다.`)}>→ {to}부대</button>
                  ))}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BuildPanel({ game, selectedZone, onSelectZone, issue }: { game: StarkRiftState; selectedZone: string; onSelectZone: (id: string) => void; issue: IssueFn }) {
  const zone = STARK_RIFT_ZONES.find((item) => item.id === selectedZone) ?? STARK_RIFT_ZONES[0];
  const intel = starkRiftZoneIntel(game, "player", zone.id);
  const actualOwner = starkRiftZoneOwner(game, zone.id) as string | null;
  const owner = actualOwner === "player" || intel === "visible" ? actualOwner : null;
  const owned = starkRiftOwnsZone(game, "player", zone.id) as boolean;
  const free = (starkRiftSlotsFree(game, zone.id) as number[]).length;
  const options = owned ? BUILDABLE_IDS.filter((id) => id !== "outpost") : BUILDABLE_IDS.filter((id) => id === "outpost");
  const here = game.buildings.filter((building) => building.zone === zone.id && building.side === "player");
  const ownerLabel = owner === "player" ? (owned ? "아군 기지" : "아군 기지 건설 중") : owner === "enemy" ? "적 기지" : intel === "unknown" ? "미탐색 지역" : intel === "explored" ? "최근 정보 없음" : "중립 지역";
  return (
    <div className="sr-build">
      <div className="sr-zone-picker">
        <small>건설 지역 · 지도에서 눌러도 됩니다</small>
        <div>
          {STARK_RIFT_ZONES.map((item) => (
            <button key={item.id} type="button" aria-pressed={item.id === zone.id} className={item.id === zone.id ? "active" : ""} onClick={() => onSelectZone(item.id)}>{item.short}</button>
          ))}
        </div>
      </div>
      <p className="sr-zone-meta"><b>{intel === "unknown" ? "미탐색 구역" : zone.name}</b> · {ownerLabel}{owned ? ` · 빈 부지 ${free}` : ""}{zone.mine && (owned || intel === "visible") ? ` · 광석 ${Math.floor(game.zones[zone.id].ore)}` : zone.mine ? " · 광석 정보 없음" : " · 광산 없음"}{"highGround" in zone && zone.highGround ? " · 고지 (받는 피해 −20%)" : ""}</p>
      <div className="sr-build-list">
        {options.map((type) => {
          const def = starkRiftBuildingDefinition(game, "player", type);
          const check = starkRiftBuildCheck(game, "player", zone.id, type) as StarkRiftCheck;
          return (
            <button key={type} type="button" className="sr-build-option" disabled={!check.ok} onClick={() => issue({ type: "build", zone: zone.id, building: type })}>
              <i className={`sr-glyph ${type}`} aria-hidden="true">{def.short}</i>
              <span><b>{def.name}</b><small>{check.ok ? ("note" in def ? def.note : "") : check.reason}</small></span>
              <em>{starkRiftBuildingCost(game, "player", type)}<small>{Math.round(def.time * starkRiftModifiers(game, "player").buildTime)}초</small></em>
            </button>
          );
        })}
      </div>
      {here.length ? (
        <div className="sr-here">
          <small>이 지역의 아군 건물</small>
          <ul>
            {here.map((building) => (
              <li key={building.id}>
                <span>{starkRiftBuildingDefinition(game, "player", building.type).name}</span>
                {starkRiftBuildingDone(building) ? <em>체력 {Math.round((building.hp / building.maxHp) * 100)}%</em> : (
                  <>
                    <em>건설 {Math.round(building.progress * 100)}%</em>
                    <button type="button" onClick={() => issue({ type: "cancel", buildingId: building.id }, "건설을 취소하고 광석 75%를 돌려받았습니다.")}>취소</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function bestProducer(game: StarkRiftState, unit: StarkRiftTrainable) {
  return playerBuildings(game)
    .filter((building) => starkRiftBuildingDone(building) && ((starkRiftBuildingDefinition(game, "player", building.type) as { trains?: string[] }).trains ?? []).includes(unit))
    .sort((a, b) => a.queue.length - b.queue.length || a.id - b.id)[0] ?? null;
}

function TrainPanel({ game, issue }: { game: StarkRiftState; issue: IssueFn }) {
  const producers = playerBuildings(game).filter((building) => (starkRiftBuildingDefinition(game, "player", building.type) as { trains?: string[] }).trains);
  return (
    <div className="sr-train">
      <small className="sr-section-label">빠른 생산 · 가장 한가한 건물에 맡깁니다</small>
      <div className="sr-quick-train">
        {TRAINABLE_IDS.map((unit) => {
          const def = starkRiftUnitDefinition(game, "player", unit);
          const producer = bestProducer(game, unit);
          const check: StarkRiftCheck = producer ? starkRiftTrainCheck(game, "player", producer.id, unit) : { ok: false, reason: unit === "tank" ? "군수공장이 필요합니다." : "병영이 필요합니다." };
          return (
            <button key={unit} type="button" disabled={!check.ok} onClick={() => producer && issue({ type: "train", buildingId: producer.id, unit })} title={check.reason}>
              <i className={`sr-icon ${unit}`} aria-hidden="true" />
              <b>{def.name}</b>
              <small>{check.ok ? `${starkRiftUnitCost(game, "player", unit)} · 보급 ${def.supply}` : check.reason}</small>
            </button>
          );
        })}
      </div>
      <ul className="sr-producers">
        {producers.map((building) => <ProducerRow key={building.id} game={game} building={building} issue={issue} />)}
      </ul>
    </div>
  );
}

function ProducerRow({ game, building, issue }: { game: StarkRiftState; building: StarkRiftBuilding; issue: IssueFn }) {
  const def = starkRiftBuildingDefinition(game, "player", building.type) as { name: string; trains?: StarkRiftTrainable[] };
  const done = starkRiftBuildingDone(building);
  const head = building.queue[0];
  const progress = head ? 1 - head.remaining / head.duration : 0;
  return (
    <li>
      <header>
        <b>{def.name}</b><span>{zoneName(building.zone)}</span>
        {building.queue.length ? <button type="button" onClick={() => issue({ type: "cancel", buildingId: building.id })}>마지막 취소</button> : null}
      </header>
      {done ? (
        <>
          <div className="sr-queue" aria-label={`생산 대기열 ${building.queue.length}개`}>
            {Array.from({ length: STARK_RIFT_ECONOMY.queueLimit }, (_, index) => {
              const item = building.queue[index];
              return <i key={index} className={item ? `filled ${item.unit}` : ""}>{item ? starkRiftUnitDefinition(game, "player", item.unit).short : ""}</i>;
            })}
            <span className="sr-queue-bar"><span style={{ width: `${Math.round(progress * 100)}%` }} /></span>
          </div>
          <div className="sr-producer-actions">
            {(def.trains ?? []).map((unit) => {
              const check = starkRiftTrainCheck(game, "player", building.id, unit) as StarkRiftCheck;
              return (
                <button key={unit} type="button" disabled={!check.ok} title={check.reason} onClick={() => issue({ type: "train", buildingId: building.id, unit })}>
                  {starkRiftUnitDefinition(game, "player", unit).name} <small>{starkRiftUnitCost(game, "player", unit)}</small>
                </button>
              );
            })}
          </div>
        </>
      ) : <p className="sr-note">건설 중 {Math.round(building.progress * 100)}%</p>}
    </li>
  );
}

function WorkersPanel({ game, issue }: { game: StarkRiftState; issue: IssueFn }) {
  const side = game.sides.player;
  const mines = STARK_RIFT_ZONES.filter((zone) => zone.mine > 0 && starkRiftOwnsZone(game, "player", zone.id));
  const busiest = (except: string) => Object.entries(side.workers).filter(([id, count]) => id !== except && count > 0).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const emptiest = (except: string) => mines.filter((zone) => zone.id !== except && game.zones[zone.id].ore > 0).sort((a, b) => (side.workers[a.id] ?? 0) - (side.workers[b.id] ?? 0))[0]?.id ?? null;
  const hq = bestProducer(game, "worker");
  const workerCheck: StarkRiftCheck = hq ? starkRiftTrainCheck(game, "player", hq.id, "worker") : { ok: false, reason: "사령부가 없습니다." };
  return (
    <div className="sr-workers">
      <div className="sr-worker-top">
        <button type="button" className={side.autoWorkers ? "sr-toggle active" : "sr-toggle"} aria-pressed={side.autoWorkers} onClick={() => issue({ type: "autoWorkers", enabled: !side.autoWorkers }, side.autoWorkers ? "일꾼을 직접 배치합니다." : "일꾼을 자동으로 고르게 배치합니다.")}>
          자동 배치 {side.autoWorkers ? "켜짐" : "꺼짐"}
        </button>
        <button type="button" disabled={!workerCheck.ok} onClick={() => hq && issue({ type: "train", buildingId: hq.id, unit: "worker" })}>
          일꾼 생산 <small>{workerCheck.ok ? "50" : workerCheck.reason}</small>
        </button>
      </div>
      <p className="sr-note">광산당 일꾼 {STARK_RIFT_ECONOMY.fullSaturation}명까지 최대 효율, {STARK_RIFT_ECONOMY.maxSaturation}명까지는 절반 효율입니다.{side.transit.length ? ` 지금 ${side.transit.length}명이 이동 중입니다.` : ""}</p>
      <ul className="sr-mines">
        {mines.map((zone) => {
          const count = side.workers[zone.id] ?? 0;
          const ore = Math.floor(game.zones[zone.id].ore);
          const rate = Math.round((starkRiftMiningRate(count) as number) * 60);
          const from = busiest(zone.id);
          const to = emptiest(zone.id);
          return (
            <li key={zone.id}>
              <div>
                <b>{zone.name}</b>
                <span>일꾼 {count}/{STARK_RIFT_ECONOMY.fullSaturation} · 분당 {rate} · 남은 광석 {ore}</span>
                <span className="sr-meter"><span style={{ width: `${Math.min(100, (count / STARK_RIFT_ECONOMY.maxSaturation) * 100)}%` }} /></span>
              </div>
              <div className="sr-worker-actions">
                <button type="button" disabled={side.autoWorkers || !count || !to} aria-label={`${zone.name} 일꾼 1명 내보내기`} onClick={() => to && issue({ type: "workers", from: zone.id, to })}>−</button>
                <button type="button" disabled={side.autoWorkers || !from || ore <= 0} aria-label={`${zone.name}에 일꾼 1명 보내기`} onClick={() => from && issue({ type: "workers", from, to: zone.id }, `일꾼 1명을 ${withKoreanDirection(zone.name)} 보냅니다.`)}>＋</button>
              </div>
            </li>
          );
        })}
      </ul>
      {mines.length < 2 ? <p className="sr-note">건설 탭에서 본진과 맞닿은 광산에 전진기지를 세우면 수입이 늘어납니다.</p> : null}
    </div>
  );
}

function ResultOverlay({ game, onRestart, onMenu, onExit }: { game: StarkRiftState; onRestart: () => void; onMenu: () => void; onExit: () => void }) {
  const won = game.winner === "player";
  const mine = game.sides.player.stats;
  const theirs = game.sides.enemy.stats;
  return (
    <div className="sr-overlay sr-overlay-full sr-result" role="dialog" aria-modal="true" aria-labelledby="sr-result-title">
      <section className={won ? "won" : "lost"}>
        <small>{won ? "VICTORY" : "DEFEAT"}</small>
        <h2 id="sr-result-title">{won ? "적 사령부 함락" : "아군 사령부 함락"}</h2>
        <p>{STARK_RIFT_DIFFICULTIES[game.difficulty].name} 난이도 · 전투 시간 {starkRiftClock(game.time)}</p>
        <dl>
          <div><dt>채굴한 광석</dt><dd>{Math.floor(mine.oreMined)}</dd></div>
          <div><dt>생산한 유닛</dt><dd>{mine.unitsProduced}</dd></div>
          <div><dt>처치한 적</dt><dd>{mine.kills}</dd></div>
          <div><dt>잃은 병력</dt><dd>{mine.unitsLost + mine.workersLost}</dd></div>
          <div><dt>파괴한 건물</dt><dd>{mine.buildingsDestroyed}</dd></div>
          <div><dt>적 채굴량</dt><dd>{Math.floor(theirs.oreMined)}</dd></div>
        </dl>
        <button type="button" className="sr-primary" onClick={onRestart}>같은 난이도로 다시</button>
        <button type="button" className="sr-secondary" onClick={onMenu}>난이도 선택</button>
        <button type="button" className="sr-secondary" onClick={onExit}>게임 목록으로</button>
      </section>
    </div>
  );
}
