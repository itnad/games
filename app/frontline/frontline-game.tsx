"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { withKoreanDirection, withKoreanObject } from "../korean-particles.js";
import {
  FRONTLINE_BUILDABLE_IDS,
  FRONTLINE_BUILDINGS,
  FRONTLINE_COMBAT_UNIT_IDS,
  FRONTLINE_DIFFICULTIES,
  FRONTLINE_ECONOMY,
  FRONTLINE_FORMATIONS,
  FRONTLINE_SQUAD_IDS,
  FRONTLINE_UNITS,
  FRONTLINE_ZONES,
} from "./frontline-data.js";
import {
  advanceFrontline,
  createFrontlineGame,
  frontlineBuildCheck,
  frontlineBuildingDone,
  frontlineClock,
  frontlineCommand,
  frontlineIncomePerMinute,
  frontlineMiningRate,
  frontlineOwnsZone,
  frontlineSlotsFree,
  frontlineSquadSummary,
  frontlineSupply,
  frontlineTrainCheck,
  frontlineZoneAt,
  frontlineZoneOwner,
} from "./frontline-engine.js";
import { frontlineAiStatus, frontlineAiThink } from "./frontline-ai.js";
import { FRONTLINE_MAX_ZOOM, drawFrontline, frontlineFillZoom, frontlineFitScale, frontlineIsVisible, frontlineScreenToMap, frontlineViewport } from "./frontline-renderer.js";
import { createFrontlinePixiRenderer, type FrontlinePixiRenderer } from "./frontline-pixi";
import type {
  FrontlineBuilding,
  FrontlineBuildingType,
  FrontlineCheck,
  FrontlineCommand,
  FrontlineDifficulty,
  FrontlineFormation,
  FrontlineSquadId,
  FrontlineSquadSummary,
  FrontlineState,
  FrontlineTrainable,
  FrontlineUnitType,
} from "./frontline-types";

type Screen = "menu" | "play";
type Tab = "squad" | "build" | "train" | "workers";
type Toast = { id: number; text: string; tone: "good" | "warn" };
type BattleRecord = { wins: number; losses: number; best: Partial<Record<FrontlineDifficulty, number>> };

const RECORD_KEY = "paperoid-frontline-record";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "squad", label: "부대", icon: "⚑" },
  { id: "build", label: "건설", icon: "▣" },
  { id: "train", label: "생산", icon: "✚" },
  { id: "workers", label: "일꾼", icon: "⛏" },
];
const DIFFICULTY_IDS: FrontlineDifficulty[] = ["easy", "normal", "hard"];
const FORMATION_IDS: FrontlineFormation[] = ["line", "wedge", "spread"];
const SQUAD_IDS = FRONTLINE_SQUAD_IDS as FrontlineSquadId[];
const COMBAT_IDS = FRONTLINE_COMBAT_UNIT_IDS as FrontlineUnitType[];
const TRAINABLE_IDS: FrontlineTrainable[] = ["worker", "rifle", "guard", "tank"];
const BUILDABLE_IDS = FRONTLINE_BUILDABLE_IDS as FrontlineBuildingType[];

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
  return FRONTLINE_ZONES.find((zone) => zone.id === id)?.name ?? id;
}

function playerBuildings(game: FrontlineState) {
  return game.buildings.filter((building) => building.side === "player");
}

export function FrontlineGame({ onExit }: { onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>("menu");
  const [difficulty, setDifficulty] = useState<FrontlineDifficulty>("normal");
  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [tab, setTab] = useState<Tab>("squad");
  const [selectedZone, setSelectedZone] = useState("center");
  const [selectedSquad, setSelectedSquad] = useState<FrontlineSquadId>(1);
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [record, setRecord] = useState<BattleRecord>(() => (typeof window === "undefined" ? { wins: 0, losses: 0, best: {} } : readRecord()));
  // 엔진 상태는 게임 루프가 직접 바꾸는 가변 객체다. 화면은 game 상태로 읽고, 0.25초마다 frame을 올려 다시 그린다.
  const [game, setGame] = useState<FrontlineState | null>(null);
  const [mapZoomed, setMapZoomed] = useState(false);

  const gameRef = useRef<FrontlineState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const pixiRef = useRef<FrontlinePixiRenderer | null>(null);
  const [renderer, setRenderer] = useState<"loading" | "pixi" | "canvas">("loading");
  const viewRef = useRef(frontlineViewport(1, 1));
  const sizeRef = useRef({ width: 1, height: 1 });
  // 카메라: 확대 배율(1 = 지도 전체)과 화면 중심의 지도 좌표.
  const cameraRef = useRef({ zoom: 1, cx: 50, cy: 150, ready: false, lastZoom: 2 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{ moved: boolean; pinch: boolean; x: number; y: number; cx: number; cy: number; zoom: number; distance: number; anchor: { x: number; y: number } } | null>(null);
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  const uiRef = useRef({ selectedZone, selectedSquad });
  const recordedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused || confirmExit;
    speedRef.current = speed;
    uiRef.current = { selectedZone, selectedSquad };
  }, [confirmExit, paused, selectedSquad, selectedZone, speed]);

  useEffect(() => {
    // 칩으로 고른 지역이 화면 밖이면 카메라를 그 지역으로 옮긴다.
    const zone = FRONTLINE_ZONES.find((item) => item.id === selectedZone);
    const view = viewRef.current;
    if (!zone || view.zoom <= 1.01) return;
    if (!frontlineIsVisible(view, zone.x, zone.y, -zone.radius * view.scale * 0.6)) {
      cameraRef.current.cx = zone.x;
      cameraRef.current.cy = zone.y;
    }
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
    const next = createFrontlineGame({ difficulty, seed: Math.floor(Math.random() * 2 ** 31) }) as unknown as FrontlineState;
    gameRef.current = next;
    setGame(next);
    recordedRef.current = false;
    cameraRef.current.ready = false;
    setSelectedZone("center");
    setSelectedSquad(1);
    setTab("squad");
    setPaused(false);
    setSpeed(1);
    setConfirmExit(false);
    setScreen("play");
  };

  const draw = useCallback((clock: number) => {
    const game = gameRef.current;
    if (!game) return;
    const camera = cameraRef.current;
    const { width, height } = sizeRef.current;
    if (!camera.ready && width > 1) {
      // 휴대폰은 화면 폭을 채운 확대 지도로 아군 본진에서 시작하고, 넓은 화면은 지도 전체를 보여 준다.
      camera.zoom = width < 900 ? frontlineFillZoom(width, height) : 1;
      camera.lastZoom = Math.max(2, camera.zoom);
      camera.cx = 50;
      camera.cy = 150;
      camera.ready = true;
      setMapZoomed(camera.zoom > 1.05);
    }
    const view = frontlineViewport(width, height, camera);
    camera.zoom = view.zoom;
    camera.cx = view.cx;
    camera.cy = view.cy;
    viewRef.current = view;
    const pixi = pixiRef.current;
    if (pixi) {
      pixi.render(game, view, { ...uiRef.current, clock, timeScale: pausedRef.current ? 0 : speedRef.current });
      return;
    }
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!context) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrontline(context, game, view, { ...uiRef.current, clock });
  }, []);

  useEffect(() => {
    // PixiJS(WebGL)로 그리고, 실패하면 2D 캔버스 렌더러로 돌아간다.
    if (screen !== "play") return;
    const surface = surfaceRef.current;
    if (!surface) return;
    let cancelled = false;
    let created: FrontlinePixiRenderer | null = null;
    const rect = surface.getBoundingClientRect();
    createFrontlinePixiRenderer(surface, rect.width, rect.height)
      .then((pixi) => {
        if (cancelled) {
          pixi.destroy();
          return;
        }
        created = pixi;
        pixiRef.current = pixi;
        pixi.resize(sizeRef.current.width, sizeRef.current.height);
        setRenderer("pixi");
      })
      .catch(() => {
        if (!cancelled) setRenderer("canvas");
      });
    return () => {
      cancelled = true;
      pixiRef.current = null;
      created?.destroy();
      setRenderer("loading");
    };
  }, [screen]);

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
      pixiRef.current?.resize(rect.width, rect.height);
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
      if (game && !pausedRef.current && game.status === "playing") advanceFrontline(game, dt * speedRef.current, frontlineAiThink);
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

  const issue = (command: FrontlineCommand, success?: string) => {
    if (!game) return;
    const result = frontlineCommand(game, "player", command) as FrontlineCheck;
    if (!result.ok) showToast(result.reason ?? "명령을 수행할 수 없습니다.");
    else if (success) showToast(success, "good");
    refresh();
  };

  const localPoint = (event: { clientX: number; clientY: number; currentTarget: Element }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const beginGesture = (pinch: boolean) => {
    const points = [...pointersRef.current.values()];
    const camera = cameraRef.current;
    const mid = points.length >= 2 ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : points[0];
    gestureRef.current = {
      moved: pinch || Boolean(gestureRef.current?.moved),
      pinch: pinch || Boolean(gestureRef.current?.pinch),
      x: mid.x,
      y: mid.y,
      cx: camera.cx,
      cy: camera.cy,
      zoom: camera.zoom,
      distance: points.length >= 2 ? Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)) : 1,
      anchor: frontlineScreenToMap(viewRef.current, mid.x, mid.y),
    };
  };

  const zoomAround = (screen: { x: number; y: number }, anchor: { x: number; y: number }, zoom: number) => {
    const camera = cameraRef.current;
    const { width, height } = sizeRef.current;
    camera.zoom = Math.min(FRONTLINE_MAX_ZOOM, Math.max(1, zoom));
    const scale = frontlineFitScale(width, height) * camera.zoom;
    camera.cx = anchor.x - (screen.x - width / 2) / scale;
    camera.cy = anchor.y - (screen.y - height / 2) / scale;
    setMapZoomed(camera.zoom > 1.05);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, localPoint(event));
    if (pointersRef.current.size === 1) gestureRef.current = null;
    beginGesture(pointersRef.current.size >= 2);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, localPoint(event));
    const gesture = gestureRef.current;
    if (!gesture) return;
    const points = [...pointersRef.current.values()];
    if (points.length >= 2) {
      // 두 손가락: 손가락 사이 지점을 고정한 채 확대·축소하고 함께 이동한다.
      const mid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
      zoomAround(mid, gesture.anchor, gesture.zoom * (distance / gesture.distance));
      return;
    }
    const dx = points[0].x - gesture.x;
    const dy = points[0].y - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 8) return;
    gesture.moved = true;
    const scale = viewRef.current.scale;
    cameraRef.current.cx = gesture.cx - dx / scale;
    cameraRef.current.cy = gesture.cy - dy / scale;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size > 0) {
      beginGesture(false);
      return;
    }
    gestureRef.current = null;
    if (!gesture || gesture.moved || gesture.pinch) return;
    selectAt(event);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (!pointersRef.current.size) gestureRef.current = null;
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const point = localPoint(event);
    const anchor = frontlineScreenToMap(viewRef.current, point.x, point.y);
    zoomAround(point, anchor, cameraRef.current.zoom * Math.exp(-event.deltaY * 0.0015));
  };

  const toggleMapZoom = () => {
    const camera = cameraRef.current;
    if (camera.zoom > 1.05) {
      camera.lastZoom = camera.zoom;
      camera.zoom = 1;
      setMapZoomed(false);
      return;
    }
    const zone = FRONTLINE_ZONES.find((item) => item.id === selectedZone);
    camera.zoom = Math.max(camera.lastZoom, frontlineFillZoom(sizeRef.current.width, sizeRef.current.height));
    if (zone) {
      camera.cx = zone.x;
      camera.cy = zone.y;
    }
    setMapZoomed(true);
  };

  const selectAt = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = game;
    if (!current) return;
    const local = localPoint(event);
    const point = frontlineScreenToMap(viewRef.current, local.x, local.y);
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
    const zone = frontlineZoneAt(point.x, point.y);
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
      <main className="fl-shell fl-menu-shell" data-game-menu="true">
        <header className="fl-topbar">
          <button type="button" onClick={onExit} aria-label="게임 목록으로">←</button>
          <div><span className="fl-brand">paperoid</span><strong>전선 지휘관</strong></div>
          <span aria-hidden="true" />
        </header>
        <section className="fl-menu">
          <div className="fl-menu-hero">
            <small>COMMAND · MANAGE · CONQUER</small>
            <h1>손이 아니라<br />판단으로 이기는 전쟁</h1>
            <p>광석을 캐고 기지를 넓히고 병력을 생산하세요. 부대에 목표와 대형만 정해 주면 유닛은 스스로 싸웁니다.</p>
          </div>
          <div className="fl-difficulty" role="radiogroup" aria-label="난이도">
            {DIFFICULTY_IDS.map((id) => {
              const item = FRONTLINE_DIFFICULTIES[id];
              return (
                <button key={id} type="button" role="radio" aria-checked={difficulty === id} className={difficulty === id ? "active" : ""} onClick={() => setDifficulty(id)}>
                  <b>{item.name}</b>
                  <span>{item.note}</span>
                  {record.best[id] ? <em>최단 승리 {frontlineClock(record.best[id] ?? 0)}</em> : null}
                </button>
              );
            })}
          </div>
          <ol className="fl-howto">
            <li><b>경제</b><span>일꾼은 자동으로 광산에 배치됩니다. 사령부에서 일꾼을 늘리고 보급고로 보급 한도를 올리세요.</span></li>
            <li><b>건설·생산</b><span>병영과 군수공장을 짓고 생산 탭에서 소총병, 방패병, 공성 전차를 훈련하세요.</span></li>
            <li><b>부대 지휘</b><span>지도에서 지역을 누른 뒤 진격, 이동, 후퇴 중 하나를 고르세요. 대형은 횡대, 쐐기, 산개 중에서 바꿀 수 있습니다.</span></li>
            <li><b>승리</b><span>적 본진의 사령부를 파괴하면 승리합니다. 아군 사령부를 잃으면 패배합니다.</span></li>
          </ol>
          <button type="button" className="fl-start" onClick={startBattle}>전투 시작</button>
          <p className="fl-record-line">전적 {record.wins}승 {record.losses}패</p>
        </section>
      </main>
    );
  }

  const supply = frontlineSupply(game, "player") as { used: number; cap: number };
  const income = frontlineIncomePerMinute(game, "player") as number;
  const workers = Object.values(game.sides.player.workers).reduce((sum, count) => sum + count, 0) + game.sides.player.transit.length;
  const recentLog = game.log.filter((entry) => entry.side === "player" && game.time - entry.time < 10).slice(-2);
  const enemyStatus = frontlineAiStatus(game, "enemy") as string;

  return (
    <main className="fl-shell fl-play-shell" data-game-menu={finished ? "true" : undefined}>
      <header className="fl-topbar">
        <button type="button" onClick={requestExit} aria-label="전투 나가기">←</button>
        <div><span className="fl-brand">전선 지휘관 · {FRONTLINE_DIFFICULTIES[game.difficulty].name}</span><strong>{frontlineClock(game.time)}</strong></div>
        <span aria-hidden="true" />
      </header>
      <section className="fl-hud" aria-label="자원 현황">
        <span className="fl-hud-ore"><small>광석</small><b>{Math.floor(game.sides.player.ore)}</b><em>+{income}/분</em></span>
        <span className={supply.used >= supply.cap ? "fl-hud-supply full" : "fl-hud-supply"}><small>보급</small><b>{supply.used}/{supply.cap}</b></span>
        <span><small>일꾼</small><b>{workers}</b></span>
        <div className="fl-speed">
          <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "계속하기" : "일시정지"}>{paused ? "▶" : "Ⅱ"}</button>
          <button type="button" onClick={() => setSpeed((value) => (value === 1 ? 2 : 1))} aria-label="게임 속도 전환">{speed}×</button>
        </div>
      </section>
      <div className="fl-body">
        <div className="fl-map" ref={mapRef}>
          <div
            ref={surfaceRef}
            className="fl-map-surface"
            data-renderer={renderer}
            role="application"
            aria-label="전장 지도. 지역을 눌러 목표로 선택하고, 끌어서 이동하고, 두 손가락으로 확대합니다."
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onWheel={handleWheel}
          >
            <canvas ref={canvasRef} className="fl-2d-canvas" aria-hidden="true" />
          </div>
          <button type="button" className="fl-map-mode" onClick={toggleMapZoom}>
            {mapZoomed ? "전체 지도" : "확대 지도"}
          </button>
          <span className="fl-enemy-chip">적 · {enemyStatus}</span>
          <ul className="fl-log" aria-live="polite">
            {recentLog.map((entry) => <li key={entry.id} className={`tone-${entry.tone}`}><span>{frontlineClock(entry.time)}</span>{entry.text}</li>)}
          </ul>
          {toast ? <p key={toast.id} className={`fl-toast tone-${toast.tone}`} role="status">{toast.text}</p> : null}
          {paused && !finished && !confirmExit ? (
            <div className="fl-overlay">
              <section>
                <h2>일시정지</h2>
                <p>지휘 화면을 잠시 멈췄습니다.</p>
                <button type="button" className="fl-primary" onClick={() => setPaused(false)}>계속하기</button>
                <button type="button" className="fl-secondary" onClick={() => setConfirmExit(true)}>전투 포기</button>
              </section>
            </div>
          ) : null}
        </div>
        <section className="fl-panel" aria-label="지휘 패널">
          <nav className="fl-tabs" aria-label="지휘 메뉴">
            {TABS.map((item) => (
              <button key={item.id} type="button" aria-pressed={tab === item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
                <i aria-hidden="true">{item.icon}</i>{item.label}
              </button>
            ))}
          </nav>
          <div className="fl-panel-body" key={tab}>
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
        <div className="fl-overlay fl-overlay-full" role="dialog" aria-modal="true" aria-labelledby="fl-exit-title">
          <section>
            <h2 id="fl-exit-title">전투를 포기할까요?</h2>
            <p>진행 중인 전투는 저장되지 않으며 패배로 기록되지 않습니다.</p>
            <button type="button" className="fl-primary" onClick={() => setConfirmExit(false)}>계속 지휘하기</button>
            <button type="button" className="fl-secondary" onClick={() => { setConfirmExit(false); setScreen("menu"); }}>난이도 선택으로</button>
            <button type="button" className="fl-secondary" onClick={onExit}>게임 목록으로</button>
          </section>
        </div>
      ) : null}
      {finished ? <ResultOverlay game={game} onRestart={startBattle} onMenu={() => setScreen("menu")} onExit={onExit} /> : null}
    </main>
  );
}

type IssueFn = (command: FrontlineCommand, success?: string) => void;

function SquadPanel({ game, selectedSquad, selectedZone, onSelectSquad, onSelectZone, issue }: {
  game: FrontlineState;
  selectedSquad: FrontlineSquadId;
  selectedZone: string;
  onSelectSquad: (id: FrontlineSquadId) => void;
  onSelectZone: (id: string) => void;
  issue: IssueFn;
}) {
  const summaries = SQUAD_IDS.map((id) => frontlineSquadSummary(game, "player", id) as FrontlineSquadSummary);
  const current = summaries.find((summary) => summary.id === selectedSquad) ?? summaries[0];
  const formation = FRONTLINE_FORMATIONS[current.formation];
  const rally = game.sides.player.rallySquad;
  const others = SQUAD_IDS.filter((id) => id !== current.id);
  const target = zoneName(selectedZone);
  const orderHint = `목표 지역: ${target}`;
  return (
    <div className="fl-squad">
      <div className="fl-squad-tabs" role="tablist" aria-label="부대 선택">
        {summaries.map((summary) => (
          <button key={summary.id} type="button" role="tab" aria-selected={summary.id === current.id} className={summary.id === current.id ? "active" : ""} onClick={() => onSelectSquad(summary.id)}>
            <b>{summary.name}{rally === summary.id ? " ★" : ""}</b>
            <span>{summary.size}기 · {summary.status}</span>
          </button>
        ))}
      </div>
      <div className="fl-squad-summary">
        <p className="fl-squad-where">
          <b>{current.zoneName}</b> {current.order === "attack" ? "진격 목표" : "집결지"}{current.size ? ` · 체력 ${Math.round(current.health * 100)}%` : " · 병력 없음"}
        </p>
        <div className="fl-unit-counts">
          {COMBAT_IDS.map((type) => <span key={type}><i className={`fl-icon ${type}`} aria-hidden="true" />{FRONTLINE_UNITS[type].name} <b>{current.counts[type]}</b></span>)}
        </div>
      </div>
      <div className="fl-zone-picker">
        <small>목표 지역 · 지도에서 눌러도 됩니다</small>
        <div>
          {FRONTLINE_ZONES.map((zone) => (
            <button key={zone.id} type="button" aria-pressed={zone.id === selectedZone} className={zone.id === selectedZone ? "active" : ""} onClick={() => onSelectZone(zone.id)}>{zone.short}</button>
          ))}
        </div>
      </div>
      <p className="fl-order-target">{orderHint}</p>
      <div className="fl-orders">
        <button type="button" className="fl-order attack" onClick={() => issue({ type: "order", squad: current.id, order: "attack", zone: selectedZone })}>
          <b>진격</b><small>싸우며 전진</small>
        </button>
        <button type="button" className="fl-order" onClick={() => issue({ type: "order", squad: current.id, order: "move", zone: selectedZone })}>
          <b>이동</b><small>교전 없이 이동</small>
        </button>
        <button type="button" className="fl-order retreat" onClick={() => issue({ type: "order", squad: current.id, order: "move", zone: "home" })}>
          <b>후퇴</b><small>본진으로 철수</small>
        </button>
      </div>
      <div className="fl-formation">
        <small>대열</small>
        <div>
          {FORMATION_IDS.map((id) => (
            <button key={id} type="button" aria-pressed={current.formation === id} className={current.formation === id ? "active" : ""} onClick={() => issue({ type: "formation", squad: current.id, formation: id })}>{FRONTLINE_FORMATIONS[id].name}</button>
          ))}
        </div>
        <p className="fl-note">{formation.note}</p>
      </div>
      <div className="fl-organize">
        <button type="button" className={rally === current.id ? "fl-rally active" : "fl-rally"} aria-pressed={rally === current.id} onClick={() => issue({ type: "rally", squad: current.id }, `새 병력이 ${current.name}에 합류합니다.`)}>
          {rally === current.id ? "★ 새 병력 합류 부대" : "새 병력을 이 부대로 보내기"}
        </button>
        {current.size ? (
          <div className="fl-transfer">
            <small>편성 이동</small>
            {[null, ...COMBAT_IDS].map((type) => {
              const count = type ? current.counts[type] : current.size;
              if (!count) return null;
              const label = type ? `${FRONTLINE_UNITS[type].name} ${count}` : `전체 ${count}`;
              return (
                <div key={type ?? "all"} className="fl-transfer-row">
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

function BuildPanel({ game, selectedZone, onSelectZone, issue }: { game: FrontlineState; selectedZone: string; onSelectZone: (id: string) => void; issue: IssueFn }) {
  const zone = FRONTLINE_ZONES.find((item) => item.id === selectedZone) ?? FRONTLINE_ZONES[0];
  const owner = frontlineZoneOwner(game, zone.id) as string | null;
  const owned = frontlineOwnsZone(game, "player", zone.id) as boolean;
  const free = (frontlineSlotsFree(game, zone.id) as number[]).length;
  const options = owned ? BUILDABLE_IDS.filter((id) => id !== "outpost") : BUILDABLE_IDS.filter((id) => id === "outpost");
  const here = game.buildings.filter((building) => building.zone === zone.id && building.side === "player");
  const ownerLabel = owner === "player" ? (owned ? "아군 기지" : "아군 기지 건설 중") : owner === "enemy" ? "적 기지" : "중립 지역";
  return (
    <div className="fl-build">
      <div className="fl-zone-picker">
        <small>건설 지역 · 지도에서 눌러도 됩니다</small>
        <div>
          {FRONTLINE_ZONES.map((item) => (
            <button key={item.id} type="button" aria-pressed={item.id === zone.id} className={item.id === zone.id ? "active" : ""} onClick={() => onSelectZone(item.id)}>{item.short}</button>
          ))}
        </div>
      </div>
      <p className="fl-zone-meta"><b>{zone.name}</b> · {ownerLabel}{owned ? ` · 빈 부지 ${free}` : ""}{zone.mine ? ` · 광석 ${Math.floor(game.zones[zone.id].ore)}` : " · 광산 없음"}{"highGround" in zone && zone.highGround ? " · 고지 (받는 피해 −20%)" : ""}</p>
      <div className="fl-build-list">
        {options.map((type) => {
          const def = FRONTLINE_BUILDINGS[type];
          const check = frontlineBuildCheck(game, "player", zone.id, type) as FrontlineCheck;
          return (
            <button key={type} type="button" className="fl-build-option" disabled={!check.ok} onClick={() => issue({ type: "build", zone: zone.id, building: type })}>
              <i className={`fl-glyph ${type}`} aria-hidden="true">{def.short}</i>
              <span><b>{def.name}</b><small>{check.ok ? ("note" in def ? def.note : "") : check.reason}</small></span>
              <em>{def.cost}<small>{def.time}초</small></em>
            </button>
          );
        })}
      </div>
      {here.length ? (
        <div className="fl-here">
          <small>이 지역의 아군 건물</small>
          <ul>
            {here.map((building) => (
              <li key={building.id}>
                <span>{FRONTLINE_BUILDINGS[building.type].name}</span>
                {frontlineBuildingDone(building) ? <em>체력 {Math.round((building.hp / building.maxHp) * 100)}%</em> : (
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

function bestProducer(game: FrontlineState, unit: FrontlineTrainable) {
  return playerBuildings(game)
    .filter((building) => frontlineBuildingDone(building) && ((FRONTLINE_BUILDINGS[building.type] as { trains?: string[] }).trains ?? []).includes(unit))
    .sort((a, b) => a.queue.length - b.queue.length || a.id - b.id)[0] ?? null;
}

function TrainPanel({ game, issue }: { game: FrontlineState; issue: IssueFn }) {
  const producers = playerBuildings(game).filter((building) => (FRONTLINE_BUILDINGS[building.type] as { trains?: string[] }).trains);
  return (
    <div className="fl-train">
      <small className="fl-section-label">빠른 생산 · 가장 한가한 건물에 맡깁니다</small>
      <div className="fl-quick-train">
        {TRAINABLE_IDS.map((unit) => {
          const def = FRONTLINE_UNITS[unit];
          const producer = bestProducer(game, unit);
          const check: FrontlineCheck = producer ? frontlineTrainCheck(game, "player", producer.id, unit) : { ok: false, reason: unit === "tank" ? "군수공장이 필요합니다." : "병영이 필요합니다." };
          return (
            <button key={unit} type="button" disabled={!check.ok} onClick={() => producer && issue({ type: "train", buildingId: producer.id, unit })} title={check.reason}>
              <i className={`fl-icon ${unit}`} aria-hidden="true" />
              <b>{def.name}</b>
              <small>{check.ok ? `${def.cost} · 보급 ${def.supply}` : check.reason}</small>
            </button>
          );
        })}
      </div>
      <ul className="fl-producers">
        {producers.map((building) => <ProducerRow key={building.id} game={game} building={building} issue={issue} />)}
      </ul>
    </div>
  );
}

function ProducerRow({ game, building, issue }: { game: FrontlineState; building: FrontlineBuilding; issue: IssueFn }) {
  const def = FRONTLINE_BUILDINGS[building.type] as { name: string; trains?: FrontlineTrainable[] };
  const done = frontlineBuildingDone(building);
  const head = building.queue[0];
  const progress = head ? 1 - head.remaining / FRONTLINE_UNITS[head.unit].time : 0;
  return (
    <li>
      <header>
        <b>{def.name}</b><span>{zoneName(building.zone)}</span>
        {building.queue.length ? <button type="button" onClick={() => issue({ type: "cancel", buildingId: building.id })}>마지막 취소</button> : null}
      </header>
      {done ? (
        <>
          <div className="fl-queue" aria-label={`생산 대기열 ${building.queue.length}개`}>
            {Array.from({ length: FRONTLINE_ECONOMY.queueLimit }, (_, index) => {
              const item = building.queue[index];
              return <i key={index} className={item ? `filled ${item.unit}` : ""}>{item ? FRONTLINE_UNITS[item.unit].short : ""}</i>;
            })}
            <span className="fl-queue-bar"><span style={{ width: `${Math.round(progress * 100)}%` }} /></span>
          </div>
          <div className="fl-producer-actions">
            {(def.trains ?? []).map((unit) => {
              const check = frontlineTrainCheck(game, "player", building.id, unit) as FrontlineCheck;
              return (
                <button key={unit} type="button" disabled={!check.ok} title={check.reason} onClick={() => issue({ type: "train", buildingId: building.id, unit })}>
                  {FRONTLINE_UNITS[unit].name} <small>{FRONTLINE_UNITS[unit].cost}</small>
                </button>
              );
            })}
          </div>
        </>
      ) : <p className="fl-note">건설 중 {Math.round(building.progress * 100)}%</p>}
    </li>
  );
}

function WorkersPanel({ game, issue }: { game: FrontlineState; issue: IssueFn }) {
  const side = game.sides.player;
  const mines = FRONTLINE_ZONES.filter((zone) => zone.mine > 0 && frontlineOwnsZone(game, "player", zone.id));
  const busiest = (except: string) => Object.entries(side.workers).filter(([id, count]) => id !== except && count > 0).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const emptiest = (except: string) => mines.filter((zone) => zone.id !== except && game.zones[zone.id].ore > 0).sort((a, b) => (side.workers[a.id] ?? 0) - (side.workers[b.id] ?? 0))[0]?.id ?? null;
  const hq = bestProducer(game, "worker");
  const workerCheck: FrontlineCheck = hq ? frontlineTrainCheck(game, "player", hq.id, "worker") : { ok: false, reason: "사령부가 없습니다." };
  return (
    <div className="fl-workers">
      <div className="fl-worker-top">
        <button type="button" className={side.autoWorkers ? "fl-toggle active" : "fl-toggle"} aria-pressed={side.autoWorkers} onClick={() => issue({ type: "autoWorkers", enabled: !side.autoWorkers }, side.autoWorkers ? "일꾼을 직접 배치합니다." : "일꾼을 자동으로 고르게 배치합니다.")}>
          자동 배치 {side.autoWorkers ? "켜짐" : "꺼짐"}
        </button>
        <button type="button" disabled={!workerCheck.ok} onClick={() => hq && issue({ type: "train", buildingId: hq.id, unit: "worker" })}>
          일꾼 생산 <small>{workerCheck.ok ? "50" : workerCheck.reason}</small>
        </button>
      </div>
      <p className="fl-note">광산당 일꾼 {FRONTLINE_ECONOMY.fullSaturation}명까지 최대 효율, {FRONTLINE_ECONOMY.maxSaturation}명까지는 절반 효율입니다.{side.transit.length ? ` 지금 ${side.transit.length}명이 이동 중입니다.` : ""}</p>
      <ul className="fl-mines">
        {mines.map((zone) => {
          const count = side.workers[zone.id] ?? 0;
          const ore = Math.floor(game.zones[zone.id].ore);
          const rate = Math.round((frontlineMiningRate(count) as number) * 60);
          const from = busiest(zone.id);
          const to = emptiest(zone.id);
          return (
            <li key={zone.id}>
              <div>
                <b>{zone.name}</b>
                <span>일꾼 {count}/{FRONTLINE_ECONOMY.fullSaturation} · 분당 {rate} · 남은 광석 {ore}</span>
                <span className="fl-meter"><span style={{ width: `${Math.min(100, (count / FRONTLINE_ECONOMY.maxSaturation) * 100)}%` }} /></span>
              </div>
              <div className="fl-worker-actions">
                <button type="button" disabled={side.autoWorkers || !count || !to} aria-label={`${zone.name} 일꾼 1명 내보내기`} onClick={() => to && issue({ type: "workers", from: zone.id, to })}>−</button>
                <button type="button" disabled={side.autoWorkers || !from || ore <= 0} aria-label={`${zone.name}에 일꾼 1명 보내기`} onClick={() => from && issue({ type: "workers", from, to: zone.id }, `일꾼 1명을 ${withKoreanDirection(zone.name)} 보냅니다.`)}>＋</button>
              </div>
            </li>
          );
        })}
      </ul>
      {mines.length < 2 ? <p className="fl-note">건설 탭에서 본진과 맞닿은 광산에 전진기지를 세우면 수입이 늘어납니다.</p> : null}
    </div>
  );
}

function ResultOverlay({ game, onRestart, onMenu, onExit }: { game: FrontlineState; onRestart: () => void; onMenu: () => void; onExit: () => void }) {
  const won = game.winner === "player";
  const mine = game.sides.player.stats;
  const theirs = game.sides.enemy.stats;
  return (
    <div className="fl-overlay fl-overlay-full fl-result" role="dialog" aria-modal="true" aria-labelledby="fl-result-title">
      <section className={won ? "won" : "lost"}>
        <small>{won ? "VICTORY" : "DEFEAT"}</small>
        <h2 id="fl-result-title">{won ? "적 사령부 함락" : "아군 사령부 함락"}</h2>
        <p>{FRONTLINE_DIFFICULTIES[game.difficulty].name} 난이도 · 전투 시간 {frontlineClock(game.time)}</p>
        <dl>
          <div><dt>채굴한 광석</dt><dd>{Math.floor(mine.oreMined)}</dd></div>
          <div><dt>생산한 유닛</dt><dd>{mine.unitsProduced}</dd></div>
          <div><dt>처치한 적</dt><dd>{mine.kills}</dd></div>
          <div><dt>잃은 병력</dt><dd>{mine.unitsLost + mine.workersLost}</dd></div>
          <div><dt>파괴한 건물</dt><dd>{mine.buildingsDestroyed}</dd></div>
          <div><dt>적 채굴량</dt><dd>{Math.floor(theirs.oreMined)}</dd></div>
        </dl>
        <button type="button" className="fl-primary" onClick={onRestart}>같은 난이도로 다시</button>
        <button type="button" className="fl-secondary" onClick={onMenu}>난이도 선택</button>
        <button type="button" className="fl-secondary" onClick={onExit}>게임 목록으로</button>
      </section>
    </div>
  );
}
