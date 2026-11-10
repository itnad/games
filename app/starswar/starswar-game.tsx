"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { withKoreanDirection, withKoreanObject, withKoreanSubject } from "../korean-particles.js";
import {
  STW_AI_PERSONAS,
  STW_ARMY_UNITS,
  STW_BUILDINGS,
  STW_CANCEL_REFUND,
  STW_DIFFICULTIES,
  STW_ECONOMY,
  STW_LAYOUT,
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
  stwCreateScenario,
  stwRestore,
  stwSerialize,
  stwArmy,
  stwBuildCheck,
  stwClock,
  stwIssue,
  stwDone,
  stwNexus,
  stwRallyName,
  stwDropCheck,
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
import { stwAiReport, stwBugReport, stwLosingAiSides } from "./starswar-report.js";
import { stwLearnAdd, stwLearnEmpty, stwLearnNormalize, stwLearnSnapshot } from "./starswar-learn.js";
import { STW_MAX_ZOOM, stwFillZoom, stwFitScale, stwScreenToMap, stwViewport } from "./starswar-camera.js";
import { createStwPixiRenderer, type StwPixiRenderer } from "./starswar-pixi";
import { LAB_PRESETS, LabScreen, normalizeLab, type LabConfig } from "./starswar-lab";
import type { StwArmyType, StwBuildChoice, StwDropMission, StwDropTarget, StwFocus, StwOp, StwBuildingType, StwCheck, StwCommand, StwDifficulty, StwProducerType, StwRaceId, StwResearchId, StwState, StwView } from "./starswar-types";

type Screen = "menu" | "play" | "lab";

/** 마지막으로 쓴 실험실 설정. */
const LAB_KEY = "paperoid-starswar-lab";

function readLab(): LabConfig {
  try {
    const parsed = normalizeLab(JSON.parse(window.localStorage.getItem(LAB_KEY) ?? "null"));
    if (parsed) return parsed;
  } catch {
    // 무시한다.
  }
  return structuredClone(LAB_PRESETS[0].config);
}
type Tab = "build" | "produce" | "research" | "army";
type Toast = { id: number; text: string; tone: "good" | "warn" };
type BattleRecord = { wins: number; losses: number; best: Partial<Record<StwDifficulty, number>> };

const RECORD_KEY = "paperoid-starswar-record";
const TABS: { id: Tab; label: string }[] = [
  { id: "build", label: "경제·건설" },
  { id: "produce", label: "생산" },
  { id: "research", label: "연구" },
  { id: "army", label: "병력" },
];
const DIFFICULTY_IDS: StwDifficulty[] = ["easy", "normal", "hard", "master", "pro"];
/** 최상급 AI가 쓰는 지난 경기 분석(사람 대 AI 경기마다 갱신). 화면에는 드러내지 않는다. */
const LEARN_KEY = "paperoid-starswar-learning";

function readLearning() {
  try {
    return stwLearnNormalize(JSON.parse(window.localStorage.getItem(LEARN_KEY) ?? "null"));
  } catch {
    return stwLearnEmpty();
  }
}

function writeLearning(data: unknown) {
  try {
    window.localStorage.setItem(LEARN_KEY, JSON.stringify(data));
  } catch {
    // 저장소가 가득 찼으면 이번 경기는 반영하지 못할 뿐이다.
  }
}
const ARMY_IDS = STW_ARMY_UNITS as StwArmyType[];
const PRODUCER_NAMES: Record<StwProducerType, string> = { gateway: "게이트웨이", robo: "로보틱스", stargate: "스타게이트", barracks: "배럭", factory: "팩토리", starport: "스타포트", hatchery: "해처리", hatch: "해처리" };
/** 진행 중인 수송 작전 한 줄 요약. */
function opStatus(game: StwState, op: StwOp) {
  const phase: Record<StwOp["phase"], string> = { out: "이동 중", fight: `견제 중 ${Math.max(0, Math.round(game.time - op.since))}초`, pickup: "회수 중", home: "귀환 중", gather: op.sync ? "집결 · 정면 대기" : "집결 중", in: "진입 중" };
  return `${op.kind === "raid" ? "게릴라" : "폭탄"} ${phase[op.phase]}`;
}

/**
 * 건물마다 보여 줄 생산 선택지. 고를 수 있는 것이 여섯을 넘는 건물(해처리 11종)은 잠긴 유닛을 숨겨
 * 해처리가 여럿일 때 목록이 끝없이 길어지지 않게 한다. 지금 고른 유닛은 잠겨도 보인다.
 */
function lineChoices(game: StwState, type: StwProducerType, current: string | null) {
  const all = STW_PRODUCER_UNITS[type] as StwArmyType[];
  if (all.length <= 6) return { shown: all, hidden: [] as StwArmyType[] };
  const shown = all.filter((unit) => unit === current || !stwUnitLock(game, "player", unit));
  return { shown, hidden: all.filter((unit) => !shown.includes(unit)) };
}

/** 유닛 선택 버튼의 짧은 꼬리표: 떠 있는 유닛은 "공중", 공중을 쏘는 무기는 "대공", 공중만 쏘면 "공중만". */
function unitTags(def: { flying?: boolean; targets?: string; damage?: number }) {
  const tags: string[] = [];
  if (def.flying) tags.push("공중");
  if (def.targets === "air") tags.push("공중만");
  else if (def.targets === "both") tags.push("대공");
  return tags;
}
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
const RACE_MENU: Record<StwRaceId, { howto: [string, string][] }> = {
  protoss: {
    howto: [
      ["경제", "프로브를 늘리고 파일런으로 인구를 확보하세요. 어시밀레이터를 지으면 가스가 들어옵니다."],
      ["테크", "게이트웨이를 늘리고, 코어로 드라군을, 아카이브로 하이템플러를 해금하세요."],
      ["생산 라인", "게이트웨이마다 소환할 유닛을 정하면 자원이 있는 한 계속 소환됩니다."],
      ["웨이브", "지도를 눌러 병력을 보내세요. 앞쪽은 싸우며 전진, 뒤쪽은 후퇴, 적 본진은 출격입니다."],
    ],
  },
  terran: {
    howto: [
      ["경제", "SCV를 늘리고 서플라이 디팟으로 인구를 확보하세요. 리파이너리를 지으면 가스가 들어옵니다."],
      ["테크", "배럭을 늘리고, 아카데미로 파이어뱃·메딕을, 머신 샵으로 시즈 탱크를 해금하세요."],
      ["생산 라인", "배럭과 팩토리마다 생산할 유닛을 정하면 자원이 있는 한 계속 생산됩니다."],
      ["웨이브", "지도를 눌러 병력을 보내세요. 스팀팩과 시즈 모드는 알아서 씁니다. 적 본진을 누르면 출격입니다."],
    ],
  },
  zerg: {
    howto: [
      ["경제", "드론을 늘리고 오버로드로 인구를 확보하세요. 익스트랙터를 지으면 가스가 들어옵니다."],
      ["테크", "스포닝 풀로 저글링, 히드라리스크 덴으로 히드라를 열고, 레어 변태 뒤 럴커와 울트라리스크를 해금하세요."],
      ["생산 라인", "해처리마다 변태시킬 유닛을 정하세요. 해처리를 더 지으면 생산 라인이 늘어납니다."],
      ["웨이브", "지도를 눌러 병력을 보내세요. 럴커는 적이 오면 알아서 땅속에 숨습니다. 적 본진을 누르면 출격입니다."],
    ],
  },
};

function readRace(): { player: EnemyRace; enemy: EnemyRace } {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RACE_KEY) ?? "null");
    if (parsed && ENEMY_RACE_IDS.includes(parsed.player) && ENEMY_RACE_IDS.includes(parsed.enemy)) return parsed;
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
/** 자동 출격: 0은 끔, 1은 생산되는 대로 즉시, 나머지는 집결지에 모인 전투 병력 수. */
const WAVE_SIZES = [0, 1, 3, 6, 10];
/** "본진 수비" 버튼이 쓰는 집결 위치(본진 앞). */
const HOME_Y = STW_RALLY_POINTS.find((point) => point.id === "main")!.y;

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

/** 진행 중인 경기 저장(이어하기). 경기가 끝나거나 새 경기를 시작하면 지운다. */
const SAVE_KEY = "paperoid-starswar-save";
/** 자동 저장 간격(경기 시간, 초). */
const SAVE_EVERY = 5;

/** 저장된 경기와, 읽은 때 기준으로 몇 분 전에 저장했는지. */
type SavedBattle = { state: StwState; minutesAgo: number | null };

function readSave(): SavedBattle | null {
  try {
    const text = window.localStorage.getItem(SAVE_KEY);
    if (!text) return null;
    const state = stwRestore(text) as StwState | null;
    if (!state) {
      window.localStorage.removeItem(SAVE_KEY);
      return null;
    }
    const savedAt = (JSON.parse(text) as { savedAt?: number }).savedAt;
    return { state, minutesAgo: savedAt ? Math.max(0, Math.round((Date.now() - savedAt) / 60000)) : null };
  } catch {
    return null;
  }
}

function writeSave(state: StwState) {
  // 실험실 경기는 저장하지 않는다(진짜 경기의 이어하기를 덮어쓰지 않게).
  if (state.status !== "playing" || state.lab) return;
  try {
    const text = stwSerialize(state) as string;
    window.localStorage.setItem(SAVE_KEY, `${text.slice(0, -1)},"savedAt":${Date.now()}}`);
  } catch {
    // 저장소가 가득 찼거나 쓸 수 없으면 이어하기만 못 할 뿐 게임은 계속한다.
  }
}

function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // 무시한다.
  }
}

function cost(minerals: number, gas: number) {
  return gas ? `${minerals} · 가스 ${gas}` : `${minerals}`;
}

export function StarswarGame({ onExit }: { onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>("menu");
  const [difficulty, setDifficulty] = useState<StwDifficulty>("normal");
  const [races, setRaces] = useState<{ player: EnemyRace; enemy: EnemyRace }>(() => (typeof window === "undefined" ? { player: "protoss", enemy: "random" } : readRace()));
  const [game, setGame] = useState<StwState | null>(null);
  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [tab, setTab] = useState<Tab>("build");
  const [toast, setToast] = useState<Toast | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [record, setRecord] = useState<BattleRecord>(() => (typeof window === "undefined" ? { wins: 0, losses: 0, best: {} } : readRecord()));
  const [renderer, setRenderer] = useState<"loading" | "ready" | "failed">("loading");
  const [icons, setIcons] = useState<Record<string, string>>({});
  const [follow, setFollow] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const [labConfig, setLabConfig] = useState<LabConfig | null>(null);
  const [saved, setSaved] = useState<SavedBattle | null>(() => (typeof window === "undefined" ? null : readSave()));

  const gameRef = useRef<StwState | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const pixiRef = useRef<StwPixiRenderer | null>(null);
  const sizeRef = useRef({ width: 1, height: 1 });
  const viewRef = useRef<StwView>(stwViewport(1, 1, { zoom: 1, cx: 20, cy: 50 }));
  const scoutTagRef = useRef<HTMLDivElement | null>(null);
  // 부대 고르기: 지도 위 "부대" 버튼으로 연 칩에서 유닛 종류를 고르면, 지도 탭이 그 종류만 옮긴다.
  const [squadOpen, setSquadOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const selectedRef = useRef<string[]>([]);
  const cameraRef = useRef({ zoom: 1, cx: 20, cy: 94, ready: false, follow: true, lastZoom: 2 });
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const recordedRef = useRef(false);
  const savedAtRef = useRef(0);

  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{ moved: boolean; pinch: boolean; x: number; y: number; cx: number; cy: number; zoom: number; distance: number; anchor: { x: number; y: number } } | null>(null);

  useEffect(() => {
    if ((paused || confirmExit) && gameRef.current) writeSave(gameRef.current);
  }, [confirmExit, paused]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

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

  /** 전투 설정 화면으로: 진행 중이면 저장하고, 이어하기 카드를 새로 읽는다. */
  const goMenu = () => {
    if (gameRef.current) writeSave(gameRef.current);
    setSaved(readSave());
    setScreen("menu");
  };

  const enterBattle = (next: StwState, { resumed = false } = {}) => {
    gameRef.current = next;
    setGame(next);
    savedAtRef.current = next.time;
    recordedRef.current = false;
    cameraRef.current.ready = false;
    setFollow(true);
    setTab("build");
    setSelected([]);
    setSquadOpen(false);
    // 이어할 때는 상황을 살필 수 있게 일시정지로 시작한다.
    setPaused(resumed);
    setSpeed(1);
    setConfirmExit(false);
    setScreen("play");
  };

  const resumeBattle = () => {
    const save = readSave();
    if (!save) {
      setSaved(null);
      showToast("저장된 전투를 불러올 수 없습니다");
      return;
    }
    enterBattle(save.state, { resumed: true });
  };

  const discardSave = () => {
    clearSave();
    setSaved(null);
  };

  const startLab = (config: LabConfig) => {
    setLabConfig(config);
    try {
      window.localStorage.setItem(LAB_KEY, JSON.stringify(config));
    } catch {
      // 무시한다.
    }
    const next = stwCreateScenario({ ...config, difficulty, seed: Math.floor(Math.random() * 2 ** 31) }) as unknown as StwState;
    enterBattle(next);
  };

  const startBattle = () => {
    const enemy = races.enemy === "random" ? RACE_IDS[Math.floor(Math.random() * RACE_IDS.length)] : races.enemy;
    // 엔진 쪽 매개변수는 JS라 기본값(null)으로 타입이 잡힌다.
    const learned = ((STW_DIFFICULTIES[difficulty] as { master?: boolean }).master ? stwLearnSnapshot(readLearning()) : null) as never;
    const player = races.player === "random" ? RACE_IDS[Math.floor(Math.random() * RACE_IDS.length)] : races.player;
    const next = createStarswarGame({ difficulty, seed: Math.floor(Math.random() * 2 ** 31), races: { player, enemy }, hiddenEnemyRace: races.enemy === "random", learned }) as unknown as StwState;
    clearSave();
    enterBattle(next);
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
    pixi.render(current, view, { clock, timeScale: pausedRef.current ? 0 : speedRef.current, rally: current.sides.player.rally, selected: selectedRef.current });
    // 지도 위 정찰 버튼: 아군 본진 광물 줄 높이의 오른쪽 가장자리에 붙이고, 본진이 화면 밖이면 완성된 앞마당 광물 줄 높이에 붙인다.
    // 둘 다 화면 밖이면(전선을 따라가는 중) 지도 오른쪽 아래(아군 기지 쪽)에 붙여 둔다.
    // 카메라가 매 프레임 움직이므로 React 갱신(0.25초)이 아니라 여기서 바로 옮긴다.
    const tag = scoutTagRef.current;
    if (tag) {
      const anchors = [STW_LAYOUT.mainMinerals];
      const natural = stwNexus(current, "player", "natural");
      if (natural && stwDone(natural)) anchors.push(STW_LAYOUT.naturalMinerals);
      const spot = anchors
        .map((point) => ({ x: view.ox + point.x * view.scale, y: view.oy + point.y * view.scale }))
        .find((point) => point.x > 40 && point.x < width - 40 && point.y > 60 && point.y < height + 6);
      tag.style.display = current.status === "playing" ? "flex" : "none";
      tag.classList.toggle("pinned", !spot);
      // 가로로는 지도 오른쪽 가장자리에 붙이고, 세로로만 광물 줄 높이를 따라간다(가운데 건물·광물을 가리지 않게).
      tag.style.transform = spot ? `translateY(${Math.round(Math.max(70, Math.min(spot.y, height - 34)))}px) translateY(-50%)` : "";
    }
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
        try {
          setIcons(pixi.exportIcons());
        } catch (error) {
          // 아이콘을 못 뽑으면 글자 칩으로 보여 준다.
          console.error("starswar icons", error);
        }
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
      if (current && !pausedRef.current && current.status === "playing") {
        advanceStarswar(current, dt * speedRef.current, stwAiThink);
        if (current.time - savedAtRef.current >= SAVE_EVERY) {
          savedAtRef.current = current.time;
          writeSave(current);
        }
      }
      draw(now / 1000);
      uiTimer += dt;
      if (uiTimer >= 0.25) {
        uiTimer = 0;
        setFrame((value) => value + 1);
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    const saveNow = () => {
      if (gameRef.current) writeSave(gameRef.current);
    };
    const hide = () => {
      if (!document.hidden) return;
      setPaused(true);
      saveNow();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", saveNow);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", saveNow);
      // 전투 화면을 떠날 때(메뉴·게임 목록) 마지막 상태를 남긴다.
      saveNow();
    };
  }, [draw, screen]);

  const finished = screen === "play" && game?.status === "over";

  useEffect(() => {
    // 실험실 경기는 전적에 넣지 않는다.
    if (!finished || !game || recordedRef.current || game.lab) return;
    recordedRef.current = true;
    clearSave();
    const won = game.winner === "player";
    const lost = game.winner === "enemy";
    const current = readRecord();
    const best = { ...current.best };
    if (won && (!best[game.difficulty] || game.time < (best[game.difficulty] ?? Infinity))) best[game.difficulty] = Math.round(game.time);
    // 무승부는 전적에 넣지 않는다.
    const next = { wins: current.wins + (won ? 1 : 0), losses: current.losses + (lost ? 1 : 0), best };
    writeRecord(next);
    setRecord(next);
    // 최상급 AI용 분석: 어떤 난이도든 사람 대 AI 경기의 승패와 사람의 운영을 쌓는다.
    writeLearning(stwLearnAdd(readLearning(), game));
  }, [finished, game]);

  const issue = (command: StwCommand, success?: string) => {
    if (!game) return;
    const result = stwIssue(game, "player", command) as StwCheck;
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
    const gesture = gestureRef.current;
    const point = localPoint(event);
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size > 0) {
      beginGesture();
      return;
    }
    gestureRef.current = null;
    // 끌거나 벌리지 않고 톡 눌렀으면 그 자리로 병력을 보낸다.
    if (!gesture || gesture.moved || gesture.pinch || event.type === "pointercancel" || finished) return;
    if (Math.hypot(point.x - gesture.x, point.y - gesture.y) > 10) return;
    const target = stwScreenToMap(viewRef.current, point.x, point.y);
    if (selected.length) issue({ type: "squadMove", units: selected, y: target.y });
    else issue({ type: "move", y: target.y });
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

  const pickRace = (next: Partial<{ player: EnemyRace; enemy: EnemyRace }>) => {
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

  if (screen === "lab") {
    return <LabScreen initial={labConfig ?? readLab()} onStart={startLab} onBack={() => setScreen("menu")} />;
  }

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
            <h1>전략은 당신이,<br />전투는 병력이.</h1>
            <p>무엇을 짓고 연구할지, 언제 진격할지 정하세요.</p>
          </div>
          {saved ? <ResumeCard saved={saved} onResume={resumeBattle} onDiscard={discardSave} /> : null}
          <div className="stw-race-pick">
            <h3 className="stw-section">내 종족</h3>
            <div className="stw-segment" role="radiogroup" aria-label="내 종족">
              {ENEMY_RACE_IDS.map((id) => (
                <button key={id} type="button" role="radio" aria-checked={races.player === id} className={races.player === id ? "active" : ""} onClick={() => pickRace({ player: id })}>{id === "random" ? "무작위" : STW_RACES[id].name}</button>
              ))}
            </div>
            <p className="stw-hint">{races.player === "random" ? "전투를 시작할 때 프로토스·테란·저그 중 하나로 정해집니다." : STW_RACES[races.player].note}</p>
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
            {(races.player === "random" ? [] : RACE_MENU[races.player].howto).map(([title, body]) => <li key={title}><b>{title}</b><span>{body}</span></li>)}
          </ol>
          <button type="button" className="stw-start" onClick={startBattle}>전투 시작</button>
          <button type="button" className="stw-secondary stw-lab-entry" onClick={() => setScreen("lab")}>실험실<small>원하는 병력·연구·시각으로 교전 시험</small></button>
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
  const mapScout = stwScoutCheck(game, "player") as StwCheck;
  // 부대 칩: 지금 가진 전투 유닛 종류와 수, 따로 둔 부대면 그 자리.
  const squadCounts = new Map<string, number>();
  for (const unit of game.units) {
    const def = STW_UNITS[unit.type as keyof typeof STW_UNITS] as { worker?: boolean; transport?: number };
    if (unit.side !== "player" || unit.hp <= 0 || def.worker || def.transport || unit.type === "overlord" || (unit.group !== "rally" && unit.group !== "attack")) continue;
    squadCounts.set(unit.type, (squadCounts.get(unit.type) ?? 0) + 1);
  }
  const squadTypes = [...squadCounts.entries()].sort((a, b) => b[1] - a[1]);
  const squadSpots = game.sides.player.squads ?? {};
  const toggleSquad = (type: string) => setSelected((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  const mapScouts = game.units.filter((unit) => unit.side === "player" && unit.group === "scout");
  const mapScoutsMain = mapScouts.filter((unit) => unit.scoutMode !== "resources").length;

  return (
    <main className="stw-shell stw-play-shell" data-game-menu={finished ? "true" : undefined}>
      <header className="stw-topbar">
        <button type="button" onClick={requestExit} aria-label="전투 나가기">←</button>
        <div><span className="stw-brand">{STW_DIFFICULTIES[game.difficulty].name} · {raceOf(game).name} 대 {!game.hiddenEnemyRace || intel?.race ? raceOf(game, "enemy").name : "?"}</span><strong>{stwClock(game.time)}</strong></div>
        <QueueStrip game={game} icons={icons} issue={issue} />
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
            aria-label="전장. 톡 누르면 병력을 그 자리로 보내고, 끌어서 이동하고 두 손가락으로 확대합니다."
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
            <button type="button" className={squadOpen ? "active" : ""} aria-pressed={squadOpen} onClick={() => { if (squadOpen) setSelected([]); setSquadOpen((value) => !value); }}>
              부대{selected.length ? ` ${selected.length}` : ""}
            </button>
          </div>
          {squadOpen ? (
            <div className="stw-squad-bar" role="group" aria-label="부대 고르기">
              <div className="stw-squad-chips">
                {squadTypes.length ? squadTypes.map(([type, count]) => (
                  <button key={type} type="button" className={selected.includes(type) ? "active" : ""} aria-pressed={selected.includes(type)} onClick={() => toggleSquad(type)}>
                    {STW_UNITS[type as keyof typeof STW_UNITS].name} {count}
                    {squadSpots[type] ? <small>{stwRallyName(squadSpots[type]!.y) as string}</small> : null}
                  </button>
                )) : <span>옮길 전투 유닛이 없습니다</span>}
              </div>
              {selected.length ? (
                <div className="stw-squad-actions">
                  <span>지도를 누르면 고른 부대만 갑니다</span>
                  <button type="button" onClick={() => issue({ type: "squadMove", units: selected, y: 20 })}>이 부대 출격</button>
                  <button type="button" disabled={!selected.some((type) => squadSpots[type])} onClick={() => issue({ type: "squadRelease", units: selected })}>본대로</button>
                  <button type="button" onClick={() => setSelected([])} aria-label="선택 해제">✕</button>
                </div>
              ) : <p className="stw-squad-hint">옮길 유닛 종류를 고르세요. 그 종류의 새 유닛도 그 부대로 갑니다. 출격 버튼은 모두 합칩니다.</p>}
            </div>
          ) : null}
          <div ref={scoutTagRef} className="stw-map-scout" role="group" aria-label="정찰">
            <button type="button" disabled={!mapScout.ok} title={mapScout.ok ? "적 본진의 건물·병력·연구 확인" : mapScout.reason} onClick={() => issue({ type: "scout", target: "main" })}>
              본진 정찰{mapScoutsMain ? <em>{mapScoutsMain}</em> : null}
            </button>
            <button type="button" disabled={!mapScout.ok} title={mapScout.ok ? "적 앞마당과 광물 줄을 돌며 일꾼·가스·확장 확인" : mapScout.reason} onClick={() => issue({ type: "scout", target: "resources" })}>
              자원 정찰{mapScouts.length - mapScoutsMain ? <em>{mapScouts.length - mapScoutsMain}</em> : null}
            </button>
          </div>
          <p className="stw-intel-chip" hidden={squadOpen}>{intel ? `적 ${stwClock(intel.time)} · ${intelSummary(intel)}` : "적 정보 없음 · 정찰 필요"}</p>
          <ul className="stw-log" aria-live="polite">
            {recentLog.map((entry) => <li key={entry.id} className={`tone-${entry.tone}`}>{entry.text}</li>)}
          </ul>
          {toast ? <p key={toast.id} className={`stw-toast tone-${toast.tone}`} role="status">{toast.text}</p> : null}
          {paused && !finished && !confirmExit ? (
            <div className="stw-overlay">
              <section>
                <h2>일시정지</h2>
                <button type="button" className="stw-primary" onClick={() => setPaused(false)}>계속하기</button>
                <button type="button" className="stw-secondary" onClick={() => setConfirmExit(true)}>나가기</button>
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
            {tab === "research" ? <ResearchTab game={game} issue={issue} /> : null}
            {tab === "army" ? <ArmyTab game={game} issue={issue} /> : null}
          </div>
        </section>
      </div>
      {confirmExit ? (
        <div className="stw-overlay stw-overlay-full" role="dialog" aria-modal="true" aria-labelledby="stw-exit-title">
          <section>
            {game.lab ? (
              <>
                <h2 id="stw-exit-title">실험을 끝낼까요?</h2>
                <p>실험 경기는 저장하지 않습니다.</p>
                <button type="button" className="stw-primary" onClick={() => setConfirmExit(false)}>계속 지휘하기</button>
                <button type="button" className="stw-secondary" onClick={() => { gameRef.current = null; setConfirmExit(false); setScreen("lab"); }}>실험실로</button>
                <button type="button" className="stw-secondary" onClick={onExit}>게임 목록으로</button>
              </>
            ) : (
              <>
                <h2 id="stw-exit-title">전투를 멈출까요?</h2>
                <p>지금 상태가 저장되어 전투 설정 화면의 이어하기로 돌아올 수 있습니다. 포기하면 저장을 지웁니다(패배로 기록하지 않습니다).</p>
                <button type="button" className="stw-primary" onClick={() => setConfirmExit(false)}>계속 지휘하기</button>
                <button type="button" className="stw-secondary" onClick={() => { setConfirmExit(false); goMenu(); }}>저장하고 전투 설정으로</button>
                <button type="button" className="stw-secondary" onClick={onExit}>저장하고 게임 목록으로</button>
                <button type="button" className="stw-secondary stw-danger" onClick={() => { gameRef.current = null; clearSave(); setConfirmExit(false); goMenu(); }}>전투 포기</button>
              </>
            )}
          </section>
        </div>
      ) : null}
      {finished ? <ResultOverlay game={game} record={record} onRestart={game.lab && labConfig ? () => startLab(labConfig) : startBattle} onMenu={game.lab ? () => setScreen("lab") : goMenu} onExit={onExit} /> : null}
    </main>
  );
}

type Issue = (command: StwCommand, success?: string) => void;

type QueueItem = { key: string; icon: string; fallback: string; progress: number; badge?: string; mark?: string; title: string; detail: string; refund: string; cancel: StwCommand };

/** 진행 중인 생산·건설·연구를 모은다. 칩 하나가 한 항목이고, 일꾼 대기열은 하나로 묶어 수를 배지로 단다. */
function queueItems(game: StwState): QueueItem[] {
  const race = raceOf(game);
  const items: QueueItem[] = [];
  const worker = STW_UNITS[race.worker] as { name: string; minerals: number; time: number; short: string };
  const bases = stwOwnBuildings(game, "player", race.base) as { queue: { remaining: number }[] }[];
  const queued = bases.reduce((sum, base) => sum + base.queue.length, 0);
  if (queued) {
    const first = bases.map((base) => base.queue[0]).filter(Boolean).sort((a, b) => a.remaining - b.remaining)[0];
    items.push({ key: "worker", icon: `u:${race.worker}`, fallback: worker.short, progress: first ? 1 - first.remaining / worker.time : 0, badge: queued > 1 ? String(queued) : undefined, title: `${worker.name} 대기 ${queued}`, detail: "마지막 1기", refund: `광물 ${worker.minerals}`, cancel: { type: "cancelProbe" } });
  }
  for (const building of game.buildings) {
    if (building.side !== "player") continue;
    const def = STW_BUILDINGS[building.type];
    if (!stwDone(building)) {
      const refund = cost(Math.floor(def.minerals * STW_CANCEL_REFUND), Math.floor(def.gas * STW_CANCEL_REFUND));
      items.push({ key: `build:${building.id}`, icon: `b:${building.type}`, fallback: def.name.slice(0, 1), progress: building.progress, title: building.type === race.base ? `앞마당 ${def.name}` : def.name, detail: `${race.buildVerb} ${Math.round(building.progress * 100)}%`, refund: `광물 ${refund}`, cancel: { type: "cancelBuild", buildingId: building.id } });
      continue;
    }
    if (building.current) {
      const unit = STW_UNITS[building.current.unit] as { name: string; minerals: number; gas: number; short: string };
      items.push({ key: `unit:${building.id}`, icon: `u:${building.current.unit}`, fallback: unit.short, progress: 1 - building.current.remaining / building.current.total, title: unit.name, detail: `${PRODUCER_NAMES[building.type as StwProducerType]} · ${race.trainVerb} ${Math.round((1 - building.current.remaining / building.current.total) * 100)}%`, refund: `광물 ${cost(unit.minerals, unit.gas)}`, cancel: { type: "cancelUnit", buildingId: building.id } });
    }
    if (building.research) {
      const def2 = STW_RESEARCH[building.research.id];
      items.push({ key: `research:${building.id}`, icon: `b:${building.type}`, fallback: "연", mark: "연구", progress: 1 - building.research.remaining / def2.time, title: def2.name, detail: `연구 ${Math.round((1 - building.research.remaining / def2.time) * 100)}%`, refund: `광물 ${cost(def2.minerals, def2.gas)}`, cancel: { type: "cancelResearch", research: building.research.id } });
    }
  }
  return items;
}

/** 상단 오른쪽의 생산 현황: 아이콘 칩 한 줄. 테두리가 진행률 링이고, 누르면 아래에 이름·진행률·취소가 뜬다. */
function QueueStrip({ game, icons, issue }: { game: StwState; icons: Record<string, string>; issue: Issue }) {
  const [selected, setSelected] = useState<string | null>(null);
  const items = queueItems(game);
  const active = items.find((item) => item.key === selected) ?? null;
  return (
    <div className="stw-queue" aria-label="진행 중인 생산">
      <div className="stw-queue-row">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`stw-chip${item.key === selected ? " active" : ""}`}
            style={{ "--p": `${Math.round(item.progress * 100)}%` } as React.CSSProperties}
            aria-label={`${item.title} ${item.detail}`}
            aria-pressed={item.key === selected}
            onClick={() => setSelected((current) => (current === item.key ? null : item.key))}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 렌더러에서 뽑은 데이터 URL 아이콘 */}
            <span>{icons[item.icon] ? <img src={icons[item.icon]} alt="" /> : <b>{item.fallback}</b>}</span>
            {item.badge ? <em>{item.badge}</em> : null}
            {item.mark ? <i>{item.mark}</i> : null}
          </button>
        ))}
      </div>
      {active ? (
        <div className="stw-queue-pop" role="dialog" aria-label={`${active.title} 취소`}>
          <span><b>{active.title}</b><small>{active.detail} · 환불 {active.refund}</small></span>
          <button type="button" onClick={() => { issue(active.cancel); setSelected(null); }}>취소</button>
          <button type="button" className="stw-queue-close" onClick={() => setSelected(null)} aria-label="닫기">×</button>
        </div>
      ) : null}
    </div>
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
  return (
    <div className="stw-tab">
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
  const templars = game.units.filter((unit) => unit.side === "player" && unit.type === "templar").length;
  const darks = game.units.filter((unit) => unit.side === "player" && unit.type === "dark" && unit.group !== "cargo").length;
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
                {lineChoices(game, type, building.line).shown.map((unit) => {
                  const lock = stwUnitLock(game, "player", unit) as string | null;
                  const def = STW_UNITS[unit] as { name: string; minerals: number; gas: number; pair?: boolean; flying?: boolean; targets?: string; damage?: number };
                  const tags = unitTags(def);
                  return (
                    <button key={unit} type="button" disabled={Boolean(lock)} className={building.line === unit ? "active" : ""} aria-pressed={building.line === unit} onClick={() => issue({ type: "line", buildingId: building.id, unit })}>
                      {def.name}{tags.length ? <i className="stw-tags">{tags.join(" · ")}</i> : null}<small>{lock ?? `${cost(def.minerals, def.gas)}${def.pair ? " · 2기" : ""}`}</small>
                    </button>
                  );
                })}
                <button type="button" className={building.line === null ? "active" : ""} aria-pressed={building.line === null} onClick={() => issue({ type: "line", buildingId: building.id, unit: null })}>정지</button>
              </div>
              {counters[PRODUCER_NAMES[type]] === 1 && lineChoices(game, type, building.line).hidden.length ? (
                <p className="stw-line-locked">{`아직 잠긴 유닛: ${lineChoices(game, type, building.line).hidden.map((unit) => `${STW_UNITS[unit].name}(${stwUnitLock(game, "player", unit)})`).join(", ")}`}</p>
              ) : null}
            </div>
          );
        })}
        {race.id === "protoss" ? <Card title="아콘 합체" sub={`하이템플러 2기 → 아콘 · 보유 ${templars}`} note={templars >= 2 ? STW_UNITS.archon.note : "하이템플러 2기가 필요합니다"} disabled={templars < 2} onClick={() => issue({ type: "merge" })} /> : null}
        {race.id === "protoss" ? <Card title="다크 아콘 합체" sub={`다크템플러 2기 → 다크 아콘 · 보유 ${darks}`} note={darks >= 2 ? STW_UNITS.darkArchon.note : "다크템플러 2기가 필요합니다"} disabled={darks < 2} onClick={() => issue({ type: "darkMerge" })} /> : null}
      </div>
    </div>
  );
}

/** 연구 탭: 그 종족의 연구와 업그레이드. 진행 중이면 진행률, 끝났으면 완료로 보인다. */
function ResearchTab({ game, issue }: { game: StwState; issue: Issue }) {
  const race = raceOf(game);
  const research = game.sides.player.research;
  const researchIds = RESEARCH_IDS.filter((id) => (STW_RESEARCH[id] as { race?: string }).race === race.id);
  const running = game.buildings.filter((building) => building.side === "player" && building.research).length;
  const done = researchIds.filter((id) => research[id] === "done").length;
  return (
    <div className="stw-tab">
      <p className="stw-workers">완료 {done}/{researchIds.length}{running ? ` · 진행 중 ${running}` : ""}</p>
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
  const escorting = game.units.some((unit) => unit.side === "player" && unit.type === "overlord" && unit.escort);
  const scouts = game.units.filter((unit) => unit.side === "player" && unit.group === "scout");
  const scoutingMain = scouts.filter((unit) => unit.scoutMode !== "resources").length;
  const scoutingResources = scouts.length - scoutingMain;
  const intel = side.intel;
  const plan = side.dropPlan ?? { mission: "raid", target: "main", repeat: false, sync: false };
  const drop = stwDropCheck(game, "player", plan.mission) as StwCheck;
  const ops = (game.ops ?? []).filter((op) => op.side === "player");
  const transportName = race.id === "terran" ? "드랍십" : race.id === "zerg" ? "오버로드" : "셔틀";
  const targets: [StwDropTarget, string][] = plan.mission === "raid"
    ? [["main", "본진"], ["natural", "앞마당"], ["tech", "기술 건물"], ["alternate", "번갈아"]]
    : [["production", "생산 건물"], ["tech", "기술 건물"], ["main", "본진 중심"]];
  return (
    <div className="stw-tab">
      <div className="stw-army-summary">
        <div><small>대기 병력</small><b>{army.rally.length}</b><span>{armyText(Object.fromEntries(ARMY_IDS.map((type) => [type, count(army.rally, type)])))}</span></div>
        <div><small>공격 병력</small><b>{army.attack.length}</b><span>{armyText(Object.fromEntries(ARMY_IDS.map((type) => [type, count(army.attack, type)])))}</span></div>
      </div>
      <button type="button" className="stw-attack" disabled={!army.fighters.length} onClick={() => issue({ type: "attack" })}>출격<small>{army.rally.length && !army.fighters.length ? "출격할 전투 병력이 없습니다" : "대기 병력을 적 본진으로"}</small></button>
      <h3 className="stw-section">병력 이동</h3>
      <p className="stw-hint">지도를 톡 누르면 그 자리로 병력이 모입니다. 병력 앞쪽을 누르면 싸우며 전진하고, 뒤쪽을 누르면 교전을 끊고 물러납니다. 적 앞마당 안쪽을 누르면 출격입니다.</p>
      <div className="stw-recall">
        <button type="button" disabled={!army.rally.length && !army.attack.length} onClick={() => issue({ type: "move", y: HOME_Y })}>본진 수비<small>전원 본진 앞으로</small></button>
        <button type="button" disabled={!army.attack.length} onClick={() => issue({ type: "retreat" })}>후퇴<small>공격 병력을 집결지로</small></button>
      </div>
      <h3 className="stw-section">공격 목표</h3>
      <p className="stw-hint">{(side.focus ?? "fight") === "fight"
        ? "교전 우선: 공격 병력이 맞으면 때린 적과 방어 건물에게 반격하고, 싸울 수 있는 적을 먼저 친 뒤 건물을 깹니다."
        : "건물 우선: 공격 병력이 맞아도 무시하고 생산·기술 건물부터 깹니다. 근처에 칠 건물이 없을 때만 유닛과 싸웁니다. 메딕·하이템플러 같은 지원 유닛, 시즈 탱크·러커, 수송 작전 병력은 따르지 않습니다."}</p>
      <div className="stw-segment two">
        {([["fight", "교전 우선"], ["buildings", "건물 우선"]] as [StwFocus, string][]).map(([mode, label]) => (
          <button key={mode} type="button" className={(side.focus ?? "fight") === mode ? "active" : ""} aria-pressed={(side.focus ?? "fight") === mode} onClick={() => issue({ type: "focus", mode })}>{label}</button>
        ))}
      </div>
      <h3 className="stw-section">자동 출격</h3>
      <p className="stw-hint">집결지에 모인 전투 병력이 이 수에 이르면 자동으로 출격합니다. &quot;즉시&quot;는 생산되는 대로 바로 내보냅니다. 옵저버·오버로드 같은 지원 유닛은 세지 않습니다.</p>
      <div className="stw-segment">
        {WAVE_SIZES.map((size) => (
          <button key={size} type="button" className={side.autoWave === size ? "active" : ""} aria-pressed={side.autoWave === size} onClick={() => issue({ type: "autoWave", size }, size === 1 ? "전투 유닛이 생산되는 대로 바로 출격합니다." : size ? `전투 병력이 ${size}기 모이면 자동으로 출격합니다.` : "자동 출격을 껐습니다.")}>{size === 1 ? "즉시" : size ? `${size}기` : "끔"}</button>
        ))}
      </div>
      {side.autoWave && side.autoWaveHold ? <p className="stw-hint stw-hold">후퇴 명령으로 자동 출격이 멈춰 있습니다. 출격하거나 지도 앞쪽을 누르거나 위 단계를 다시 고르면 켜집니다.</p> : null}
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
      <h3 className="stw-section">수송 작전</h3>
      <div className="stw-drop-head">
        <p className={drop.ok ? "stw-drop-status ready" : "stw-drop-status"} role="status">
          {drop.ok
            ? `쉬는 ${transportName} ${(drop as StwCheck & { carriers?: unknown[] }).carriers?.length ?? 0}기 · 태울 병력 ${(drop as StwCheck & { passengers?: unknown[] }).passengers?.length ?? 0}기`
            : drop.reason}
        </p>
        <button type="button" className="stw-primary" disabled={!drop.ok} onClick={() => issue({ type: "drop" })}>{plan.mission === "raid" ? "견제 출발" : "폭탄 드랍 출발"}</button>
      </div>
      {ops.length ? (
        <ul className="stw-ops">
          {ops.map((op) => {
            const recallable = op.kind === "raid" ? op.phase === "out" || op.phase === "fight" : op.phase === "gather" || op.phase === "in";
            return (
              <li key={op.id}>
                <span>{opStatus(game, op)}</span>
                <button type="button" disabled={!recallable} onClick={() => issue({ type: "dropRecall", opId: op.id }, "수송 작전 병력을 거둬들입니다.")}>
                  {recallable ? "지금 회수" : op.phase === "pickup" ? "회수 중" : op.kind === "bomb" && op.phase === "home" ? "내린 병력은 끝까지" : "귀환 중"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="stw-hint">{plan.mission === "raid"
        ? `게릴라 드랍: ${transportName} 1기에 대기 병력 한 분대(8칸)를 태워 본진이나 앞마당 광물 줄의 일꾼을 칩니다(빠른 병력부터, 없으면 다른 지상 병력. 기술 건물을 고르면 그 건물을). 적이 몰려오거나 25초가 지나면 회수해 돌아옵니다.`
        : `폭탄 드랍: 쉬는 ${transportName} 모두에 대기 병력을 비싼 것부터 가득 싣고 가장자리에 모였다가 한꺼번에 내립니다(1기부터). 내린 병력은 끝까지 싸웁니다.`}</p>
      <div className="stw-segment two">
        {([["raid", "게릴라 드랍"], ["bomb", "폭탄 드랍"]] as [StwDropMission, string][]).map(([mission, label]) => (
          <button key={mission} type="button" className={plan.mission === mission ? "active" : ""} aria-pressed={plan.mission === mission} onClick={() => issue({ type: "dropPlan", mission })}>{label}</button>
        ))}
      </div>
      <div className="stw-segment">
        {targets.map(([target, label]) => (
          <button key={target} type="button" className={plan.target === target ? "active" : ""} aria-pressed={plan.target === target} onClick={() => issue({ type: "dropPlan", target })}>{label}</button>
        ))}
      </div>
      <div className="stw-segment one">
        {plan.mission === "raid" ? (
          <button type="button" className={plan.repeat ? "active" : ""} aria-pressed={plan.repeat} onClick={() => issue({ type: "dropPlan", repeat: !plan.repeat }, plan.repeat ? "계속 견제를 껐습니다." : "견제를 마치고 돌아오면 다시 나갑니다.")}>{plan.repeat ? "계속 견제 켬" : "계속 견제 끔"}</button>
        ) : (
          <button type="button" className={plan.sync ? "active" : ""} aria-pressed={plan.sync} onClick={() => issue({ type: "dropPlan", sync: !plan.sync }, plan.sync ? "정면 출격과 따로 들어갑니다." : "정면이 맞붙을 때 함께 들어갑니다.")}>{plan.sync ? "정면 출격과 동시에 켬" : "정면 출격과 동시에 끔"}</button>
        )}
      </div>
      <h3 className="stw-section">정찰</h3>
      <div className="stw-scout">
        <div className="stw-scout-pair">
          <Card title="본진 정찰" sub={`${workerName} 1기 잠시 이탈`} badge={scoutingMain ? `정찰 중 ${scoutingMain}` : undefined} note={scout.ok ? "적 본진의 건물·병력·연구 확인" : scout.reason} disabled={!scout.ok} onClick={() => issue({ type: "scout", target: "main" })} />
          <Card title="자원 정찰" sub={`${workerName} 1기 잠시 이탈`} badge={scoutingResources ? `정찰 중 ${scoutingResources}` : undefined} note={scout.ok ? "적 앞마당과 광물 줄을 돌며 일꾼·가스·확장 확인" : scout.reason} disabled={!scout.ok} onClick={() => issue({ type: "scout", target: "resources" })} />
        </div>
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

/** 완료한 연구 수. */
function researchDone(game: StwState, side: "player" | "enemy") {
  return Object.values(game.sides[side].research).filter((status) => status === "done").length;
}

/** 결과 화면의 병력 가치 추이: 10초마다 기록한 양쪽 병력 가치(광물 + 가스, 일꾼 제외)를 선 두 개로. */
function ArmyChart({ game }: { game: StwState }) {
  const history = game.history ?? [];
  if (history.length < 2) return null;
  const width = 300;
  const height = 96;
  // 실험실처럼 중간 시각에서 시작한 경기도 첫 기록부터 그린다.
  const start = history[0].t;
  const span = Math.max(1, history.at(-1)!.t - start);
  const top = Math.max(100, ...history.map((point) => Math.max(point.player.army, point.enemy.army)));
  const line = (side: "player" | "enemy") => history.map((point) => `${(((point.t - start) / span) * width).toFixed(1)},${(height - (point[side].army / top) * (height - 6) - 3).toFixed(1)}`).join(" ");
  const peak = (side: "player" | "enemy") => Math.max(...history.map((point) => point[side].army));
  return (
    <figure className="stw-result-chart">
      <figcaption>병력 가치 추이 <span className="mine">● 나 최고 {peak("player")}</span> <span className="theirs">● 적 최고 {peak("enemy")}</span></figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`병력 가치 추이. 나의 최고 ${peak("player")}, 적의 최고 ${peak("enemy")}`} preserveAspectRatio="none">
        <polyline className="theirs" points={line("enemy")} />
        <polyline className="mine" points={line("player")} />
      </svg>
      <div className="stw-result-axis"><span>{stwClock(start)}</span><span>{stwClock(game.time)}</span></div>
    </figure>
  );
}

/** 단일 HTML 빌드가 넣는 게임 판(커밋·날짜). 웹 빌드에는 없다. */
declare const __STW_BUILD__: string | undefined;
const STW_BUILD = typeof __STW_BUILD__ === "string" ? __STW_BUILD__ : "웹 빌드";

type ReportKind = "bug" | "ai";

/** 리포트에 붙일 기기 정보와 복사한 때. */
function reportEnv() {
  const screen = typeof window === "undefined" ? "" : ` · 화면 ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}`;
  const agent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return { build: STW_BUILD, device: `${agent}${screen}`, copiedAt: new Date().toLocaleString("ko-KR") };
}

/** 클립보드에 쓴다. 막혀 있으면(앱 안 화면 등) 숨은 입력칸으로 한 번 더 시도한다. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 아래 방법으로 넘어간다.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * 결과 화면의 리포트 창.
 * - 버그 리포트: 겪은 일을 적을 칸과 함께 경기 정보·명령·최근 기록·재현 코드를 복사한다.
 * - AI 개선 자료: 진 AI의 운영과 이긴 쪽 비교, 큰 교전, 자동 진단, 재현 코드를 복사한다.
 * 자동 복사가 막히면 글을 보여 주고 직접 복사하게 한다.
 */
function ReportPanel({ game, kind, onClose }: { game: StwState; kind: ReportKind; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const [env] = useState(reportEnv);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const text = useMemo(
    () => (kind === "bug" ? (stwBugReport(game, { ...env, note: note.trim() }) as string) : ((stwAiReport(game, env) as string | null) ?? "")),
    [env, game, kind, note],
  );
  useEffect(() => {
    if (status !== "manual" || !areaRef.current) return;
    areaRef.current.focus();
    areaRef.current.select();
  }, [status]);
  const copy = async () => setStatus((await copyText(text)) ? "copied" : "manual");
  const title = kind === "bug" ? "버그 리포트" : "AI 개선 자료";
  return (
    <div className="stw-overlay stw-overlay-full stw-report" role="dialog" aria-modal="true" aria-labelledby="stw-report-title">
      <section>
        <h2 id="stw-report-title">{title}</h2>
        <p>
          {kind === "bug"
            ? "경기 설정·결과 흐름·내 명령·최근 기록과, 이 경기를 처음부터 똑같이 다시 돌릴 수 있는 재현 코드를 복사합니다. 개선 요청 대화에 그대로 붙여 넣어 주세요."
            : "진 AI의 빌드 순서·일꾼·자원·병력 구성과 이긴 쪽의 운영, 큰 교전, 자동 진단, 재현 코드를 복사합니다. AI 개선 요청 대화에 붙여 넣어 주세요."}
        </p>
        {kind === "bug" ? (
          <label className="stw-report-note">
            <span>무슨 일이 있었나요? (선택)</span>
            <textarea value={note} rows={3} placeholder="예: 7분쯤 드라군이 앞마당에서 멈춰 움직이지 않았어요" onChange={(event) => { setNote(event.target.value); setStatus("idle"); }} />
          </label>
        ) : null}
        <button type="button" className="stw-primary" onClick={copy}>{status === "copied" ? "복사했습니다 ✓" : "클립보드에 복사"}</button>
        {status === "manual" ? <p className="stw-report-warn">이 화면에서는 자동 복사가 막혀 있습니다. 아래 글을 전체 선택해 복사해 주세요.</p> : null}
        <details className="stw-report-text" open={status === "manual"}>
          <summary>내용 보기 ({text.length.toLocaleString("en-US")}자)</summary>
          <textarea ref={areaRef} readOnly value={text} rows={10} onFocus={(event) => event.currentTarget.select()} />
        </details>
        <button type="button" className="stw-secondary" onClick={onClose}>닫기</button>
      </section>
    </div>
  );
}

function ResultOverlay({ game, record, onRestart, onMenu, onExit }: { game: StwState; record: BattleRecord; onRestart: () => void; onMenu: () => void; onExit: () => void }) {
  const [report, setReport] = useState<ReportKind | null>(null);
  const aiLost = stwLosingAiSides(game).length > 0;
  const won = game.winner === "player";
  const draw = game.winner === "draw";
  const mine = game.sides.player.stats;
  const theirs = game.sides.enemy.stats;
  const persona = game.sides.enemy.persona;
  const switched = game.sides.enemy.ai?.switched;
  const matchup = `${raceOf(game, "player").name} 대 ${raceOf(game, "enemy").name}`;
  const best = record.best[game.difficulty];
  const newBest = !game.lab && won && best !== undefined && Math.round(game.time) <= best;
  // 세 번째 값이 true인 줄은 적을수록 낫다(굵게 표시할 쪽이 반대).
  const rows: [string, number, number, boolean?][] = [
    ["채취 광물", Math.floor(mine.minerals), Math.floor(theirs.minerals)],
    ["채취 가스", Math.floor(mine.gas), Math.floor(theirs.gas)],
    ["생산 유닛", mine.produced, theirs.produced],
    ["잃은 유닛", mine.lost, theirs.lost, true],
    ["잃은 병력 가치", Math.round(mine.valueLost ?? 0), Math.round(theirs.valueLost ?? 0), true],
    ["파괴한 건물", mine.buildingsDestroyed, theirs.buildingsDestroyed],
    ["처치한 일꾼", mine.workersKilled ?? 0, theirs.workersKilled ?? 0],
    ["최대 인구", mine.supplyPeak ?? 0, theirs.supplyPeak ?? 0],
    ["마법 사용", (mine.spells ?? 0) + mine.storms, (theirs.spells ?? 0) + theirs.storms],
    ["완료한 연구", researchDone(game, "player"), researchDone(game, "enemy")],
  ];
  return (
    <div className="stw-overlay stw-overlay-full stw-result" role="dialog" aria-modal="true" aria-labelledby="stw-result-title">
      <section className={won ? "won" : draw ? "draw" : "lost"}>
        <small>{game.lab ? "실험실 · " : ""}{won ? "VICTORY" : draw ? "DRAW" : "DEFEAT"}</small>
        <h2 id="stw-result-title">{won ? "적 본진 함락" : draw ? "자원 고갈 무승부" : "아군 본진 함락"}</h2>
        <div className="stw-result-time">
          <span>경기 시간</span>
          <b>{stwClock(game.time)}</b>
          {newBest ? <em>최단 승리 기록</em> : won && best !== undefined && !game.lab ? <em className="quiet">최단 {stwClock(best)}</em> : null}
        </div>
        <p>
          {STW_DIFFICULTIES[game.difficulty].name} · {matchup}
          {persona ? ` · 상대 전략: ${STW_AI_PERSONAS[switched ? switched.from as keyof typeof STW_AI_PERSONAS : persona].name}` : ""}
          {switched ? ` → ${stwClock(switched.at)}에 ${withKoreanDirection(STW_AI_PERSONAS[switched.to as keyof typeof STW_AI_PERSONAS].name)} 전환` : ""}
        </p>
        <ArmyChart game={game} />
        <table className="stw-result-table">
          <thead><tr><th scope="col">항목</th><th scope="col" className="mine">나</th><th scope="col" className="theirs">적</th></tr></thead>
          <tbody>
            {rows.map(([label, a, b, lowerIsBetter]) => {
              const better = a === b ? null : (a > b) !== Boolean(lowerIsBetter) ? "mine" : "theirs";
              return <tr key={label}><th scope="row">{label}</th><td className={better === "mine" ? "lead" : undefined}>{a}</td><td className={better === "theirs" ? "lead" : undefined}>{b}</td></tr>;
            })}
          </tbody>
        </table>
        {game.lab ? <p className="stw-result-record">실험 경기는 전적에 넣지 않습니다.</p> : <p className="stw-result-record">전적 {record.wins}승 {record.losses}패</p>}
        <div className={aiLost ? "stw-result-tools" : "stw-result-tools one"}>
          <button type="button" className="stw-secondary" onClick={() => setReport("bug")}>버그 리포트</button>
          {aiLost ? <button type="button" className="stw-secondary" onClick={() => setReport("ai")}>AI 개선 자료</button> : null}
        </div>
        <button type="button" className="stw-primary" onClick={onRestart}>같은 설정으로 다시</button>
        <button type="button" className="stw-secondary" onClick={onMenu}>{game.lab ? "실험실" : "전투 설정"}</button>
        <button type="button" className="stw-secondary" onClick={onExit}>게임 목록으로</button>
      </section>
      {report ? <ReportPanel game={game} kind={report} onClose={() => setReport(null)} /> : null}
    </div>
  );
}

/** 메뉴의 이어하기 카드: 저장된 경기의 종족·난이도·진행 시간. */
function ResumeCard({ saved, onResume, onDiscard }: { saved: SavedBattle; onResume: () => void; onDiscard: () => void }) {
  const game = saved.state;
  const enemy = game.hiddenEnemyRace && !game.sides.player.intel?.race ? "?" : raceOf(game, "enemy").name;
  const minutes = saved.minutesAgo;
  const ago = minutes === null ? "" : minutes < 1 ? " · 방금 저장" : minutes < 60 ? ` · ${minutes}분 전 저장` : ` · ${Math.round(minutes / 60)}시간 전 저장`;
  return (
    <section className="stw-resume" aria-label="멈춘 전투">
      <div>
        <small>멈춘 전투</small>
        <b>{raceOf(game).name} 대 {enemy} · {STW_DIFFICULTIES[game.difficulty].name}</b>
        <span>{stwClock(game.time)} 진행{ago}</span>
      </div>
      <button type="button" className="stw-primary" onClick={onResume}>이어하기</button>
      <button type="button" className="stw-secondary" onClick={onDiscard} aria-label="저장된 전투 지우기">지우기</button>
    </section>
  );
}
