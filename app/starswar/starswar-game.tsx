"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { withKoreanDirection, withKoreanObject, withKoreanSubject } from "../korean-particles.js";
import {
  STW_AI_PERSONAS,
  STW_ARMY_UNITS,
  STW_BUILDINGS,
  STW_CANCEL_REFUND,
  STW_DIFFICULTIES,
  STW_ECONOMY,
  STW_PRODUCER_UNITS,
  STW_PRODUCERS,
  STW_RACES,
  STW_RALLY_POINTS,
  STW_RESEARCH,
  STW_UNITS,
} from "./starswar-data.js";
import {
  advanceStarswar,
  createStarswarGame,
  stwArmy,
  stwBuildCheck,
  stwClock,
  stwCommand,
  stwDone,
  stwIncome,
  stwOwnBuildings,
  stwProbeCheck,
  stwRace,
  stwRallyY,
  stwResearchCheck,
  stwScoutCheck,
  stwSupply,
  stwUnitLock,
  stwUnitUnlocked,
  stwWorkerSplit,
  intelSummary,
} from "./starswar-engine.js";
import { stwAiThink } from "./starswar-ai.js";
import { STW_MAX_ZOOM, stwFillZoom, stwFitScale, stwScreenToMap, stwViewport } from "./starswar-camera.js";
import { createStwPixiRenderer, type StwPixiRenderer } from "./starswar-pixi";
import type { StwArmyType, StwBuildChoice, StwBuildingType, StwCheck, StwCommand, StwDifficulty, StwProducerType, StwRaceId, StwRallyId, StwResearchId, StwState, StwView } from "./starswar-types";

type Screen = "menu" | "play";
type Tab = "build" | "produce" | "army";
type Toast = { id: number; text: string; tone: "good" | "warn" };
type BattleRecord = { wins: number; losses: number; best: Partial<Record<StwDifficulty, number>> };

const RECORD_KEY = "paperoid-starswar-record";
const TABS: { id: Tab; label: string }[] = [
  { id: "build", label: "경제·건설" },
  { id: "produce", label: "생산·연구" },
  { id: "army", label: "병력" },
];
const DIFFICULTY_IDS: StwDifficulty[] = ["easy", "normal", "hard"];
const ARMY_IDS = STW_ARMY_UNITS as StwArmyType[];
const PRODUCER_NAMES: Record<StwProducerType, string> = { gateway: "게이트웨이", robo: "로보틱스", barracks: "배럭", factory: "팩토리", hatchery: "해처리", hatch: "해처리" };
const RACE_IDS: StwRaceId[] = ["protoss", "terran", "zerg"];
type EnemyRace = StwRaceId | "random";
const ENEMY_RACE_IDS: EnemyRace[] = ["protoss", "terran", "zerg", "random"];
const RACE_KEY = "paperoid-starswar-race";

type RaceInfo = {
  id: StwRaceId;
  name: string;
  worker: "probe" | "scv" | "drone";
  base: StwBuildingType;
  supply: StwBuildingType;
  buildVerb: string;
  trainVerb: string;
  mainProducer: StwProducerType;
  producers: StwProducerType[];
  builds: StwBuildChoice[];
  note: string;
};

function raceOf(game: StwState, side: "player" | "enemy" = "player") {
  return stwRace(game, side) as unknown as RaceInfo;
}

/** 메뉴의 종족별 소개와 진행 안내. */
const RACE_MENU: Record<StwRaceId, { hero: string; lead: string; howto: [string, string][] }> = {
  protoss: {
    hero: "관문이 군대를 소환합니다.",
    lead: "프로브가 광물을 캐는 동안 무엇을 짓고, 무엇을 연구하고, 언제 출격할지만 고르세요. 질럿, 드라군, 하이템플러가 게이트웨이에서 꾸준히 소환되어 전선으로 나아갑니다.",
    howto: [
      ["경제", "프로브를 늘리고 파일런으로 인구를 확보하세요. 어시밀레이터를 지으면 가스가 들어옵니다."],
      ["테크", "게이트웨이를 늘리고, 코어로 드라군을, 아카이브로 하이템플러를 해금하세요."],
      ["생산 라인", "게이트웨이마다 소환할 유닛을 정하면 자원이 있는 한 계속 소환됩니다."],
      ["웨이브", "집결지를 정하고 원할 때 출격시키세요. 적 본진 기지를 부수면 승리합니다."],
    ],
  },
  terran: {
    hero: "배럭이 보병을 쏟아냅니다.",
    lead: "SCV가 광물을 캐는 동안 무엇을 짓고, 무엇을 연구하고, 언제 출격할지만 고르세요. 해병과 메딕이 배럭에서, 벌처와 시즈 탱크가 팩토리에서 꾸준히 생산됩니다.",
    howto: [
      ["경제", "SCV를 늘리고 서플라이 디팟으로 인구를 확보하세요. 리파이너리를 지으면 가스가 들어옵니다."],
      ["테크", "배럭을 늘리고, 아카데미로 파이어뱃·메딕을, 머신 샵으로 시즈 탱크를 해금하세요."],
      ["생산 라인", "배럭과 팩토리마다 생산할 유닛을 정하면 자원이 있는 한 계속 생산됩니다."],
      ["웨이브", "스팀팩과 시즈 모드는 알아서 씁니다. 적 본진 기지를 부수면 승리합니다."],
    ],
  },
  zerg: {
    hero: "해처리가 무리를 깨웁니다.",
    lead: "드론이 광물을 캐는 동안 무엇을 변태시키고, 무엇을 연구하고, 언제 출격할지만 고르세요. 해처리마다 저글링, 히드라리스크, 럴커, 울트라리스크가 꾸준히 태어나 몰려갑니다.",
    howto: [
      ["경제", "드론을 늘리고 오버로드로 인구를 확보하세요. 익스트랙터를 지으면 가스가 들어옵니다."],
      ["테크", "스포닝 풀로 저글링, 히드라리스크 덴으로 히드라를 열고, 레어 변태 뒤 럴커와 울트라리스크를 해금하세요."],
      ["생산 라인", "해처리마다 변태시킬 유닛을 정하세요. 해처리를 더 지으면 생산 라인이 늘어납니다."],
      ["웨이브", "럴커는 적이 오면 알아서 땅속에 숨습니다. 적 본진 기지를 부수면 승리합니다."],
    ],
  },
};

function readRace(): { player: StwRaceId; enemy: EnemyRace } {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RACE_KEY) ?? "null");
    if (parsed && RACE_IDS.includes(parsed.player) && ENEMY_RACE_IDS.includes(parsed.enemy)) return parsed;
  } catch {
    // 저장소를 쓸 수 없으면 기본값을 쓴다.
  }
  return { player: "protoss", enemy: "random" };
}

/** "질럿 3 · 드라군 2"처럼 0이 아닌 유닛만 나열. */
function armyText(counts: Partial<Record<string, number>>) {
  const parts = ARMY_IDS.filter((type) => (counts[type] ?? 0) > 0).map((type) => `${STW_UNITS[type].name} ${counts[type]}`);
  return parts.length ? parts.join(" · ") : "없음";
}
const RESEARCH_IDS = Object.keys(STW_RESEARCH) as StwResearchId[];
const WAVE_SIZES = [0, 6, 10, 16];
const RECALL_CHOICES: { point: StwRallyId; label: string; note: string }[] = [
  { point: "main", label: "본진 수비", note: "본진 앞으로" },
  { point: "natural", label: "앞마당 수비", note: "앞마당으로" },
  { point: "center", label: "중앙 대기", note: "전장 가운데로" },
  { point: "forward", label: "전진 대기", note: "적 앞마당 앞으로" },
];

function readRecord(): BattleRecord {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECORD_KEY) ?? "null");
    if (parsed && typeof parsed.wins === "number" && typeof parsed.losses === "number") return { wins: parsed.wins, losses: parsed.losses, best: parsed.best ?? {} };
  } catch {
    // 저장소를 쓸 수 없어도 게임은 진행한다.
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

function cost(minerals: number, gas: number) {
  return gas ? `${minerals} · 가스 ${gas}` : `${minerals}`;
}

export function StarswarGame({ onExit }: { onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>("menu");
  const [difficulty, setDifficulty] = useState<StwDifficulty>("normal");
  const [races, setRaces] = useState<{ player: StwRaceId; enemy: EnemyRace }>(() => (typeof window === "undefined" ? { player: "protoss", enemy: "random" } : readRace()));
  const [game, setGame] = useState<StwState | null>(null);
  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [tab, setTab] = useState<Tab>("build");
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [record, setRecord] = useState<BattleRecord>(() => (typeof window === "undefined" ? { wins: 0, losses: 0, best: {} } : readRecord()));
  const [renderer, setRenderer] = useState<"loading" | "ready" | "failed">("loading");
  const [follow, setFollow] = useState(true);
  const [zoomed, setZoomed] = useState(false);

  const gameRef = useRef<StwState | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const pixiRef = useRef<StwPixiRenderer | null>(null);
  const sizeRef = useRef({ width: 1, height: 1 });
  const viewRef = useRef<StwView>(stwViewport(1, 1, { zoom: 1, cx: 20, cy: 50 }));
  const cameraRef = useRef({ zoom: 1, cx: 20, cy: 94, ready: false, follow: true, lastZoom: 2 });
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const recordedRef = useRef(false);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{ moved: boolean; pinch: boolean; x: number; y: number; cx: number; cy: number; zoom: number; distance: number; anchor: { x: number; y: number } } | null>(null);

  useEffect(() => {
    pausedRef.current = paused || confirmExit;
    speedRef.current = speed;
    cameraRef.current.follow = follow;
  }, [confirmExit, follow, paused, speed]);

  const refresh = useCallback(() => setFrame((value) => value + 1), []);
  const showToast = useCallback((text: string, tone: Toast["tone"] = "warn") => setToast({ id: Date.now(), text, tone }), []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const startBattle = () => {
    const enemy = races.enemy === "random" ? RACE_IDS[Math.floor(Math.random() * RACE_IDS.length)] : races.enemy;
    const next = createStarswarGame({ difficulty, seed: Math.floor(Math.random() * 2 ** 31), races: { player: races.player, enemy }, hiddenEnemyRace: races.enemy === "random" }) as unknown as StwState;
    gameRef.current = next;
    setGame(next);
    recordedRef.current = false;
    cameraRef.current.ready = false;
    setFollow(true);
    setTab("build");
    setPaused(false);
    setSpeed(1);
    setConfirmExit(false);
    setScreen("play");
  };

  const draw = useCallback((clock: number) => {
    const current = gameRef.current;
    const pixi = pixiRef.current;
    if (!current || !pixi) return;
    const camera = cameraRef.current;
    const { width, height } = sizeRef.current;
    if (!camera.ready && width > 1) {
      camera.zoom = width < 700 ? stwFillZoom(width, height) : 1.2;
      camera.lastZoom = Math.max(1.6, camera.zoom);
      camera.cx = 20;
      camera.cy = 94;
      camera.ready = true;
      setZoomed(camera.zoom > 1.05);
    }
    if (camera.follow) {
      // 전선 따라가기: 공격 병력이 있으면 그 선두, 없으면 집결지를 화면 가운데로.
      const army = stwArmy(current, "player");
      const focus = army.attack.length
        ? army.attack.reduce((best, unit) => Math.min(best, unit.y), 100) + 6
        : stwRallyY("player", current.sides.player.rally) + 4;
      camera.cy += (focus - camera.cy) * 0.06;
    }
    const view = stwViewport(width, height, camera) as StwView;
    camera.zoom = view.zoom;
    camera.cx = view.cx;
    camera.cy = view.cy;
    viewRef.current = view;
    pixi.render(current, view, { clock, timeScale: pausedRef.current ? 0 : speedRef.current, rally: current.sides.player.rally });
  }, []);

  useEffect(() => {
    if (screen !== "play") return;
    const surface = surfaceRef.current;
    if (!surface) return;
    let cancelled = false;
    let created: StwPixiRenderer | null = null;
    const resize = () => {
      const rect = surface.getBoundingClientRect();
      sizeRef.current = { width: rect.width, height: rect.height };
      pixiRef.current?.resize(rect.width, rect.height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    createStwPixiRenderer(surface, sizeRef.current.width, sizeRef.current.height)
      .then((pixi) => {
        if (cancelled) {
          pixi.destroy();
          return;
        }
        created = pixi;
        pixiRef.current = pixi;
        resize();
        setRenderer("ready");
      })
      .catch(() => {
        if (!cancelled) setRenderer("failed");
      });
    return () => {
      cancelled = true;
      observer.disconnect();
      pixiRef.current = null;
      created?.destroy();
      setRenderer("loading");
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== "play") return;
    let frame = 0;
    let last = performance.now();
    let uiTimer = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const current = gameRef.current;
      if (current && !pausedRef.current && current.status === "playing") advanceStarswar(current, dt * speedRef.current, stwAiThink);
      draw(now / 1000);
      uiTimer += dt;
      if (uiTimer >= 0.25) {
        uiTimer = 0;
        setFrame((value) => value + 1);
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    const hide = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [draw, screen]);

  const finished = screen === "play" && game?.status === "over";

  useEffect(() => {
    if (!finished || !game || recordedRef.current) return;
    recordedRef.current = true;
    const won = game.winner === "player";
    const lost = game.winner === "enemy";
    const current = readRecord();
    const best = { ...current.best };
    if (won && (!best[game.difficulty] || game.time < (best[game.difficulty] ?? Infinity))) best[game.difficulty] = Math.round(game.time);
    // 무승부는 전적에 넣지 않는다.
    const next = { wins: current.wins + (won ? 1 : 0), losses: current.losses + (lost ? 1 : 0), best };
    writeRecord(next);
    setRecord(next);
  }, [finished, game]);

  const issue = (command: StwCommand, success?: string) => {
    if (!game) return;
    const result = stwCommand(game, "player", command) as StwCheck;
    if (!result.ok) showToast(result.reason ?? "지금은 할 수 없습니다");
    else if (success) showToast(success, "good");
    refresh();
  };

  /* ───────── 지도 조작 ───────── */

  const localPoint = (event: { clientX: number; clientY: number; currentTarget: Element }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const beginGesture = () => {
    const points = [...pointersRef.current.values()];
    const camera = cameraRef.current;
    const mid = points.length >= 2 ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } : points[0];
    gestureRef.current = {
      moved: points.length >= 2 || Boolean(gestureRef.current?.moved),
      pinch: points.length >= 2 || Boolean(gestureRef.current?.pinch),
      x: mid.x,
      y: mid.y,
      cx: camera.cx,
      cy: camera.cy,
      zoom: camera.zoom,
      distance: points.length >= 2 ? Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)) : 1,
      anchor: stwScreenToMap(viewRef.current, mid.x, mid.y),
    };
  };

  const zoomAround = (point: { x: number; y: number }, anchor: { x: number; y: number }, zoom: number) => {
    const camera = cameraRef.current;
    const { width, height } = sizeRef.current;
    camera.zoom = Math.min(STW_MAX_ZOOM, Math.max(1, zoom));
    const scale = stwFitScale(width, height) * camera.zoom;
    camera.cx = anchor.x - (point.x - width / 2) / scale;
    camera.cy = anchor.y - (point.y - height / 2) / scale;
    setZoomed(camera.zoom > 1.05);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, localPoint(event));
    if (pointersRef.current.size === 1) gestureRef.current = null;
    beginGesture();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, localPoint(event));
    const gesture = gestureRef.current;
    if (!gesture) return;
    const points = [...pointersRef.current.values()];
    if (points.length >= 2) {
      const mid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
      zoomAround(mid, gesture.anchor, gesture.zoom * (distance / gesture.distance));
      setFollow(false);
      return;
    }
    const dx = points[0].x - gesture.x;
    const dy = points[0].y - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 8) return;
    gesture.moved = true;
    setFollow(false);
    const scale = viewRef.current.scale;
    cameraRef.current.cx = gesture.cx - dx / scale;
    cameraRef.current.cy = gesture.cy - dy / scale;
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size > 0) beginGesture();
    else gestureRef.current = null;
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const point = localPoint(event);
    zoomAround(point, stwScreenToMap(viewRef.current, point.x, point.y), cameraRef.current.zoom * Math.exp(-event.deltaY * 0.0015));
  };

  const toggleZoom = () => {
    const camera = cameraRef.current;
    if (camera.zoom > 1.05) {
      camera.lastZoom = camera.zoom;
      camera.zoom = 1;
      setZoomed(false);
    } else {
      camera.zoom = Math.max(camera.lastZoom, stwFillZoom(sizeRef.current.width, sizeRef.current.height));
      setZoomed(true);
    }
  };

  const pickRace = (next: Partial<{ player: StwRaceId; enemy: EnemyRace }>) => {
    setRaces((current) => {
      const merged = { ...current, ...next };
      try {
        window.localStorage.setItem(RACE_KEY, JSON.stringify(merged));
      } catch {
        // 선택 저장 실패는 무시한다.
      }
      return merged;
    });
  };

  const requestExit = () => {
    if (screen === "play" && game?.status === "playing") {
      setConfirmExit(true);
      return;
    }
    onExit();
  };

  /* ───────── 메뉴 ───────── */

  if (screen === "menu" || !game) {
    return (
      <main className="stw-shell stw-menu-shell" data-game-menu="true">
        <header className="stw-topbar">
          <button type="button" onClick={onExit} aria-label="게임 목록으로">←</button>
          <div><span className="stw-brand">paperoid</span><strong>스타즈워</strong></div>
        </header>
        <section className="stw-menu">
          <div className="stw-menu-hero">
            <small>BUILD · TECH · WAVE</small>
            <h1>선택만 하세요.<br />{RACE_MENU[races.player].hero}</h1>
            <p>{RACE_MENU[races.player].lead}</p>
          </div>
          <div className="stw-race-pick">
            <h3 className="stw-section">내 종족</h3>
            <div className="stw-segment" role="radiogroup" aria-label="내 종족">
              {RACE_IDS.map((id) => (
                <button key={id} type="button" role="radio" aria-checked={races.player === id} className={races.player === id ? "active" : ""} onClick={() => pickRace({ player: id })}>{STW_RACES[id].name}</button>
              ))}
            </div>
            <p className="stw-hint">{STW_RACES[races.player].note}</p>
            <h3 className="stw-section">상대 종족</h3>
            <div className="stw-segment" role="radiogroup" aria-label="상대 종족">
              {ENEMY_RACE_IDS.map((id) => (
                <button key={id} type="button" role="radio" aria-checked={races.enemy === id} className={races.enemy === id ? "active" : ""} onClick={() => pickRace({ enemy: id })}>{id === "random" ? "무작위" : STW_RACES[id].name}</button>
              ))}
            </div>
          </div>
          <div className="stw-difficulty" role="radiogroup" aria-label="난이도">
            {DIFFICULTY_IDS.map((id) => {
              const item = STW_DIFFICULTIES[id];
              return (
                <button key={id} type="button" role="radio" aria-checked={difficulty === id} className={difficulty === id ? "active" : ""} onClick={() => setDifficulty(id)}>
                  <b>{item.name}</b>
                  <span>{item.note}</span>
                  {record.best[id] ? <em>최단 승리 {stwClock(record.best[id] ?? 0)}</em> : null}
                </button>
              );
            })}
          </div>
          <ol className="stw-howto">
            {RACE_MENU[races.player].howto.map(([title, body]) => <li key={title}><b>{title}</b><span>{body}</span></li>)}
          </ol>
          <button type="button" className="stw-start" onClick={startBattle}>전투 시작</button>
          <p className="stw-record-line">전적 {record.wins}승 {record.losses}패</p>
        </section>
      </main>
    );
  }

  /* ───────── 전투 ───────── */

  const side = game.sides.player;
  const supply = stwSupply(game, "player") as { used: number; cap: number };
  const income = stwIncome(game, "player") as { minerals: number; gas: number };
  const army = stwArmy(game, "player");
  const recentLog = game.log.filter((entry) => entry.side === "player" && game.time - entry.time < 8).slice(-2);
  const intel = side.intel;

  return (
    <main className="stw-shell stw-play-shell" data-game-menu={finished ? "true" : undefined}>
      <header className="stw-topbar">
        <button type="button" onClick={requestExit} aria-label="전투 나가기">←</button>
        <div><span className="stw-brand">{STW_DIFFICULTIES[game.difficulty].name} · {raceOf(game).name} 대 {!game.hiddenEnemyRace || intel?.race ? raceOf(game, "enemy").name : "?"}</span><strong>{stwClock(game.time)}</strong></div>
      </header>
      <section className="stw-hud" aria-label="자원 현황">
        <span className="stw-res minerals"><i aria-hidden="true" /><b>{Math.floor(side.minerals)}</b><em>+{income.minerals}</em></span>
        <span className="stw-res gas"><i aria-hidden="true" /><b>{Math.floor(side.gas)}</b><em>+{income.gas}</em></span>
        <span className={supply.used >= supply.cap ? "stw-res supply full" : "stw-res supply"}><i aria-hidden="true" /><b>{supply.used}/{supply.cap}</b></span>
        <div className="stw-speed">
          <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "계속하기" : "일시정지"}>{paused ? "▶" : "Ⅱ"}</button>
          <button type="button" onClick={() => setSpeed((value) => (value === 1 ? 2 : 1))} aria-label="게임 속도 전환">{speed}×</button>
        </div>
      </section>
      <div className="stw-body">
        <div className="stw-map">
          <div
            ref={surfaceRef}
            className="stw-map-surface"
            role="application"
            aria-label="전장. 끌어서 이동하고 두 손가락으로 확대합니다."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          />
          {renderer === "failed" ? <p className="stw-map-error">이 기기에서 그래픽을 초기화하지 못했습니다.</p> : null}
          <div className="stw-map-tools">
            <button type="button" onClick={toggleZoom}>{zoomed ? "전체" : "확대"}</button>
            <button type="button" className={follow ? "active" : ""} aria-pressed={follow} onClick={() => setFollow((value) => !value)}>전선 따라가기</button>
          </div>
          <p className="stw-intel-chip">{intel ? `적 ${stwClock(intel.time)} · ${intelSummary(intel)}` : "적 정보 없음 · 정찰 필요"}</p>
          <ul className="stw-log" aria-live="polite">
            {recentLog.map((entry) => <li key={entry.id} className={`tone-${entry.tone}`}>{entry.text}</li>)}
          </ul>
          {toast ? <p key={toast.id} className={`stw-toast tone-${toast.tone}`} role="status">{toast.text}</p> : null}
          {paused && !finished && !confirmExit ? (
            <div className="stw-overlay">
              <section>
                <h2>일시정지</h2>
                <button type="button" className="stw-primary" onClick={() => setPaused(false)}>계속하기</button>
                <button type="button" className="stw-secondary" onClick={() => setConfirmExit(true)}>전투 포기</button>
              </section>
            </div>
          ) : null}
        </div>
        <section className="stw-panel" aria-label="선택 패널">
          <nav className="stw-tabs">
            {TABS.map((item) => (
              <button key={item.id} type="button" aria-pressed={tab === item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
                {item.label}
                {item.id === "army" && army.rally.length ? <em>{army.rally.length}</em> : null}
              </button>
            ))}
          </nav>
          <div className="stw-panel-body" key={tab}>
            {tab === "build" ? <BuildTab game={game} issue={issue} /> : null}
            {tab === "produce" ? <ProduceTab game={game} issue={issue} /> : null}
            {tab === "army" ? <ArmyTab game={game} issue={issue} /> : null}
          </div>
        </section>
      </div>
      {confirmExit ? (
        <div className="stw-overlay stw-overlay-full" role="dialog" aria-modal="true" aria-labelledby="stw-exit-title">
          <section>
            <h2 id="stw-exit-title">전투를 포기할까요?</h2>
            <p>진행 중인 전투는 저장되지 않으며 패배로 기록되지 않습니다.</p>
            <button type="button" className="stw-primary" onClick={() => setConfirmExit(false)}>계속 지휘하기</button>
            <button type="button" className="stw-secondary" onClick={() => { setConfirmExit(false); setScreen("menu"); }}>전투 설정으로</button>
            <button type="button" className="stw-secondary" onClick={onExit}>게임 목록으로</button>
          </section>
        </div>
      ) : null}
      {finished ? <ResultOverlay game={game} onRestart={startBattle} onMenu={() => setScreen("menu")} onExit={onExit} /> : null}
    </main>
  );
}

type Issue = (command: StwCommand, success?: string) => void;

/** 진행 중인 선택 한 줄: 이름, 진행률, 환불액, 취소 버튼. */
function PendingRow({ title, detail, refund, onCancel }: { title: string; detail: string; refund: string; onCancel: () => void }) {
  return (
    <li className="stw-pending-row">
      <span><b>{title}</b><small>{detail} · 취소 시 {refund}</small></span>
      <button type="button" onClick={onCancel} aria-label={`${title} 취소`}>취소</button>
    </li>
  );
}

function Card({ title, sub, note, disabled, onClick, tone, badge }: { title: string; sub?: string; note?: string; disabled?: boolean; onClick: () => void; tone?: string; badge?: string }) {
  return (
    <button type="button" className={`stw-card${tone ? ` ${tone}` : ""}`} disabled={disabled} onClick={onClick}>
      <span className="stw-card-head"><b>{title}</b>{badge ? <em>{badge}</em> : null}</span>
      {sub ? <span className="stw-card-cost">{sub}</span> : null}
      {note ? <small>{note}</small> : null}
    </button>
  );
}

function BuildTab({ game, issue }: { game: StwState; issue: Issue }) {
  const race = raceOf(game);
  const worker = STW_UNITS[race.worker];
  const baseDef = STW_BUILDINGS[race.base];
  const bases = stwOwnBuildings(game, "player", race.base);
  const split = stwWorkerSplit(game, "player") as { gas: number; main: number; natural: number; idle: number };
  const probe = stwProbeCheck(game, "player") as StwCheck;
  const queued = bases.reduce((sum, nexus) => sum + (nexus as { queue: unknown[] }).queue.length, 0);
  const constructing = game.buildings.filter((building) => building.side === "player" && !stwDone(building));
  return (
    <div className="stw-tab">
      {queued || constructing.length ? (
        <section className="stw-pending" aria-label="진행 중">
          <h3 className="stw-section">진행 중</h3>
          <ul>
            {queued ? <PendingRow title={`${worker.name} 대기 ${queued}`} detail="마지막 1기" refund={`광물 ${worker.minerals}`} onCancel={() => issue({ type: "cancelProbe" })} /> : null}
            {constructing.map((building) => {
              const def = STW_BUILDINGS[building.type];
              const refund = cost(Math.floor(def.minerals * STW_CANCEL_REFUND), Math.floor(def.gas * STW_CANCEL_REFUND));
              return <PendingRow key={building.id} title={building.type === race.base ? `앞마당 ${def.name}` : def.name} detail={`${race.buildVerb} ${Math.round(building.progress * 100)}%`} refund={`광물 ${refund}`} onCancel={() => issue({ type: "cancelBuild", buildingId: building.id })} />;
            })}
          </ul>
        </section>
      ) : null}
      <p className="stw-workers">
        {worker.name} {game.sides.player.probes} · 본진 {split.main}/{STW_ECONOMY.fullSaturation}{bases.length > 1 ? ` · 앞마당 ${split.natural}/${STW_ECONOMY.fullSaturation}` : ""} · 가스 {split.gas}{split.idle ? ` · 남는 ${split.idle}` : ""}
      </p>
      <div className="stw-grid">
        <Card title={`${worker.name} +1`} sub={cost(worker.minerals, 0)} badge={queued ? `대기 ${queued}` : undefined} note={probe.ok ? "광물 채취 속도 증가" : probe.reason} disabled={!probe.ok} onClick={() => issue({ type: "probe" })} />
        {race.builds.map((id) => {
          const def = id === "expand" ? baseDef : STW_BUILDINGS[id];
          const check = stwBuildCheck(game, "player", id) as StwCheck;
          const owned = id === "expand" ? bases.filter((item) => (item as { base: string }).base === "natural") : stwOwnBuildings(game, "player", id);
          const building = owned.filter((item) => !stwDone(item)).length;
          const done = owned.length - building;
          const badge = building ? `${race.buildVerb} 중 ${building}` : done ? `보유 ${done}` : undefined;
          const note = check.ok ? (id === "expand" ? "앞마당 광물 채취 · 인구 +10" : "note" in def ? def.note : "") : check.reason;
          return <Card key={id} title={id === "expand" ? `앞마당 ${baseDef.name}` : def.name} sub={cost(def.minerals, def.gas)} badge={badge} note={note} disabled={!check.ok} onClick={() => issue({ type: "build", building: id })} />;
        })}
      </div>
    </div>
  );
}

function ProduceTab({ game, issue }: { game: StwState; issue: Issue }) {
  const race = raceOf(game);
  const verb = race.trainVerb;
  const mainName = PRODUCER_NAMES[race.mainProducer];
  const mainUnits = STW_PRODUCER_UNITS[race.mainProducer] as StwArmyType[];
  const producers = game.buildings.filter((building) => building.side === "player" && (STW_PRODUCERS as string[]).includes(building.type));
  // 저그 해처리처럼 같은 생산 목록을 쓰는 건물은 한 묶음으로 본다.
  const gateways = producers.filter((building) => STW_PRODUCER_UNITS[building.type as StwProducerType] === STW_PRODUCER_UNITS[race.mainProducer]);
  const research = game.sides.player.research;
  const researchIds = RESEARCH_IDS.filter((id) => (STW_RESEARCH[id] as { race?: string }).race === race.id);
  const templars = game.units.filter((unit) => unit.side === "player" && unit.type === "templar").length;
  const counters: Record<string, number> = {};
  return (
    <div className="stw-tab">
      <div className="stw-lines">
        <div className="stw-line-all">
          <span>모든 {mainName}</span>
          {mainUnits.map((unit) => (
            <button key={unit} type="button" disabled={!gateways.length || !stwUnitUnlocked(game, "player", unit)} onClick={() => issue({ type: "lineAll", unit }, `${withKoreanSubject(`모든 ${mainName}`)} ${withKoreanDirection(STW_UNITS[unit].name)} ${withKoreanObject(verb)} 시작합니다.`)}>{STW_UNITS[unit].name}</button>
          ))}
          <button type="button" disabled={!gateways.length} onClick={() => issue({ type: "lineAll", unit: null, producer: race.mainProducer }, `모든 ${mainName} 생산을 멈췄습니다.`)}>정지</button>
        </div>
        {!producers.length ? <p className="stw-empty">{`${withKoreanObject(race.producers.map((type) => STW_BUILDINGS[type].name).join(" 또는 "))} 지으면 여기서 ${verb}할 유닛을 정할 수 있습니다.`}</p> : null}
        {producers.map((building) => {
          const type = building.type as StwProducerType;
          counters[PRODUCER_NAMES[type]] = (counters[PRODUCER_NAMES[type]] ?? 0) + 1;
          const label = `${PRODUCER_NAMES[type]} ${counters[PRODUCER_NAMES[type]]}`;
          const progress = building.current ? 1 - building.current.remaining / building.current.total : 0;
          const status = !stwDone(building) ? `${race.buildVerb} 중 ${Math.round(building.progress * 100)}%` : building.current ? `${STW_UNITS[building.current.unit].name} ${verb} ${Math.round(progress * 100)}%` : building.blocked ?? "대기";
          return (
            <div key={building.id} className="stw-line">
              <header>
                <b>{label}</b><span>{status}</span>
                {building.current ? <button type="button" className="stw-cancel" onClick={() => issue({ type: "cancelUnit", buildingId: building.id })} aria-label={`${label}의 ${STW_UNITS[building.current.unit].name} ${verb} 취소`}>취소</button> : null}
              </header>
              <span className="stw-progress"><span style={{ width: `${Math.round(progress * 100)}%` }} /></span>
              <div className="stw-line-choices">
                {(STW_PRODUCER_UNITS[type] as StwArmyType[]).map((unit) => {
                  const lock = stwUnitLock(game, "player", unit) as string | null;
                  const def = STW_UNITS[unit] as { name: string; minerals: number; gas: number; pair?: boolean };
                  return (
                    <button key={unit} type="button" disabled={Boolean(lock)} className={building.line === unit ? "active" : ""} aria-pressed={building.line === unit} onClick={() => issue({ type: "line", buildingId: building.id, unit })}>
                      {def.name}<small>{lock ?? `${cost(def.minerals, def.gas)}${def.pair ? " · 2기" : ""}`}</small>
                    </button>
                  );
                })}
                <button type="button" className={building.line === null ? "active" : ""} aria-pressed={building.line === null} onClick={() => issue({ type: "line", buildingId: building.id, unit: null })}>정지</button>
              </div>
            </div>
          );
        })}
        {race.id === "protoss" ? <Card title="아콘 합체" sub={`하이템플러 2기 → 아콘 · 보유 ${templars}`} note={templars >= 2 ? STW_UNITS.archon.note : "하이템플러 2기가 필요합니다"} disabled={templars < 2} onClick={() => issue({ type: "merge" })} /> : null}
      </div>
      <h3 className="stw-section">연구</h3>
      {game.buildings.some((building) => building.side === "player" && building.research) ? (
        <ul className="stw-pending">
          {game.buildings.filter((building) => building.side === "player" && building.research).map((building) => {
            const id = building.research!.id;
            const def = STW_RESEARCH[id];
            return <PendingRow key={building.id} title={def.name} detail={`연구 ${Math.round((1 - building.research!.remaining / def.time) * 100)}%`} refund={`광물 ${cost(def.minerals, def.gas)}`} onCancel={() => issue({ type: "cancelResearch", research: id })} />;
          })}
        </ul>
      ) : null}
      <div className="stw-grid">
        {researchIds.map((id) => {
          const def = STW_RESEARCH[id];
          const status = research[id];
          const check = stwResearchCheck(game, "player", id) as StwCheck;
          const running = game.buildings.find((building) => building.side === "player" && building.research?.id === id);
          const note = status === "done" ? "완료" : running ? `연구 중 ${Math.round((1 - (running.research?.remaining ?? 0) / def.time) * 100)}%` : check.ok ? def.note : check.reason;
          return <Card key={id} title={def.name} sub={cost(def.minerals, def.gas)} note={note} tone={status === "done" ? "done" : undefined} disabled={!check.ok} onClick={() => issue({ type: "research", research: id })} />;
        })}
      </div>
    </div>
  );
}

function ArmyTab({ game, issue }: { game: StwState; issue: Issue }) {
  const side = game.sides.player;
  const army = stwArmy(game, "player");
  const scout = stwScoutCheck(game, "player") as StwCheck;
  const race = raceOf(game);
  const workerName = STW_UNITS[race.worker].name;
  const count = (list: { type: string }[], type: StwArmyType) => list.filter((unit) => unit.type === type).length;
  const overlordsReady = stwOwnBuildings(game, "player", "overlord").filter((item) => stwDone(item)).length;
  const escorting = game.units.some((unit) => unit.side === "player" && unit.type === "overlord");
  const intel = side.intel;
  return (
    <div className="stw-tab">
      <div className="stw-army-summary">
        <div><small>대기 병력</small><b>{army.rally.length}</b><span>{armyText(Object.fromEntries(ARMY_IDS.map((type) => [type, count(army.rally, type)])))}</span></div>
        <div><small>공격 병력</small><b>{army.attack.length}</b><span>{armyText(Object.fromEntries(ARMY_IDS.map((type) => [type, count(army.attack, type)])))}</span></div>
      </div>
      <button type="button" className="stw-attack" disabled={!army.fighters.length} onClick={() => issue({ type: "attack" })}>출격<small>{army.rally.length && !army.fighters.length ? "출격할 전투 병력이 없습니다" : "대기 병력을 적 본진으로"}</small></button>
      <h3 className="stw-section">후퇴·수비</h3>
      <p className="stw-hint">공격 중인 병력까지 모두 불러들입니다. 후퇴하는 동안에는 싸우지 않고 돌아옵니다.</p>
      <div className="stw-recall">
        {RECALL_CHOICES.map((choice) => (
          <button key={choice.point} type="button" className={side.rally === choice.point && !army.attack.length ? "active" : ""} disabled={!army.rally.length && !army.attack.length} onClick={() => issue({ type: "recall", point: choice.point })}>
            {choice.label}<small>{choice.note}</small>
          </button>
        ))}
      </div>
      <h3 className="stw-section">집결지</h3>
      <p className="stw-hint">새 병력과 대기 병력이 모이는 곳입니다. 이곳 뒤쪽으로 들어온 적은 대기 병력이 자동으로 요격합니다.</p>
      <div className="stw-segment">
        {STW_RALLY_POINTS.map((point) => (
          <button key={point.id} type="button" className={side.rally === point.id ? "active" : ""} aria-pressed={side.rally === point.id} onClick={() => issue({ type: "rally", point: point.id as StwRallyId })}>{point.short}</button>
        ))}
      </div>
      <h3 className="stw-section">자동 출격</h3>
      <p className="stw-hint">집결지에 모인 전투 병력이 이 수에 이르면 자동으로 출격합니다. 옵저버·오버로드 같은 지원 유닛은 세지 않습니다.</p>
      <div className="stw-segment">
        {WAVE_SIZES.map((size) => (
          <button key={size} type="button" className={side.autoWave === size ? "active" : ""} aria-pressed={side.autoWave === size} onClick={() => issue({ type: "autoWave", size }, size ? `전투 병력이 ${size}기 모이면 자동으로 출격합니다.` : "자동 출격을 껐습니다.")}>{size ? `${size}기` : "끔"}</button>
        ))}
      </div>
      {race.id === "zerg" ? (
        <>
          <h3 className="stw-section">오버로드 동행</h3>
          <p className="stw-hint">오버로드 1기가 떠올라 병력을 따라다니며 은폐 유닛을 탐지합니다. 인구 +8은 유지되지만 잃으면 상한이 8 줄어듭니다.</p>
          <div className="stw-scout">
            <Card
              title={side.escort ? "동행 중" : "오버로드 동행"}
              sub={`완성된 오버로드 ${overlordsReady}${escorting ? " · 동행 1" : ""}`}
              note={side.escort ? "누르면 기지로 돌려보냅니다" : overlordsReady || escorting ? "누르면 오버로드 1기가 출발합니다" : "완성된 오버로드가 없습니다"}
              tone={side.escort ? "done" : undefined}
              disabled={!side.escort && !overlordsReady && !escorting}
              onClick={() => issue({ type: "escort", on: !side.escort })}
            />
          </div>
        </>
      ) : null}
      <h3 className="stw-section">정찰</h3>
      <div className="stw-scout">
        <Card title={`${workerName} 정찰`} sub={`${workerName} 1기 잠시 이탈`} note={scout.ok ? "적 본진까지 다녀오며 건물과 병력을 확인" : scout.reason} disabled={!scout.ok} onClick={() => issue({ type: "scout" })} />
        <div className="stw-intel">
          {intel ? (
            <>
              <b>{stwClock(intel.time)} 정찰 기준{intel.race ? ` · ${STW_RACES[intel.race].name}` : ""}</b>
              <span>건물: {Object.entries(intel.buildings).map(([type, value]) => `${STW_BUILDINGS[type as keyof typeof STW_BUILDINGS].name} ${value}`).join(", ")}</span>
              <span>병력: {armyText(intel.units)}</span>
              <span>연구: {intel.research.length ? intel.research.map((item) => `${STW_RESEARCH[item.id].name}${item.status === "running" ? "(진행 중)" : ""}`).join(", ") : "없음"}</span>
            </>
          ) : <span>아직 적 본진을 보지 못했습니다. 정찰을 보내면 적의 테크와 병력 구성을 알 수 있습니다.</span>}
        </div>
      </div>
    </div>
  );
}

function ResultOverlay({ game, onRestart, onMenu, onExit }: { game: StwState; onRestart: () => void; onMenu: () => void; onExit: () => void }) {
  const won = game.winner === "player";
  const draw = game.winner === "draw";
  const mine = game.sides.player.stats;
  const theirs = game.sides.enemy.stats;
  const persona = game.sides.enemy.persona;
  const matchup = `${raceOf(game, "player").name} 대 ${raceOf(game, "enemy").name}`;
  return (
    <div className="stw-overlay stw-overlay-full stw-result" role="dialog" aria-modal="true" aria-labelledby="stw-result-title">
      <section className={won ? "won" : draw ? "draw" : "lost"}>
        <small>{won ? "VICTORY" : draw ? "DRAW" : "DEFEAT"}</small>
        <h2 id="stw-result-title">{won ? "적 본진 함락" : draw ? "자원 고갈 무승부" : "아군 본진 함락"}</h2>
        <p>{STW_DIFFICULTIES[game.difficulty].name} · {matchup} · {stwClock(game.time)}{persona ? ` · 상대 전략: ${STW_AI_PERSONAS[persona].name}` : ""}</p>
        <dl>
          <div><dt>채취 광물</dt><dd>{Math.floor(mine.minerals)}</dd></div>
          <div><dt>채취 가스</dt><dd>{Math.floor(mine.gas)}</dd></div>
          <div><dt>생산 유닛</dt><dd>{mine.produced}</dd></div>
          <div><dt>처치</dt><dd>{mine.kills}</dd></div>
          <div><dt>잃은 유닛</dt><dd>{mine.lost}</dd></div>
          {raceOf(game).id === "protoss" ? <div><dt>스톰</dt><dd>{mine.storms}</dd></div> : <div><dt>건물 손실</dt><dd>{mine.buildingsLost}</dd></div>}
          <div><dt>파괴한 건물</dt><dd>{mine.buildingsDestroyed}</dd></div>
          <div><dt>적 채취 광물</dt><dd>{Math.floor(theirs.minerals)}</dd></div>
        </dl>
        <button type="button" className="stw-primary" onClick={onRestart}>같은 설정으로 다시</button>
        <button type="button" className="stw-secondary" onClick={onMenu}>전투 설정</button>
        <button type="button" className="stw-secondary" onClick={onExit}>게임 목록으로</button>
      </section>
    </div>
  );
}
