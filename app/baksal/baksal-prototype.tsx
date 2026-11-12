"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "./baksal.css";
import {
  BEATS_PER_BAR,
  BPM_CHOICES,
  COUNT_IN_BEATS,
  JUDGMENT_LABELS,
  beatAtTime,
  calibrationOffsetMs,
  clockBeatAtTime,
  clockBpmAtBeat,
  clockTimeOfBeat,
  correctInputBeat,
  createTempoMap,
  nearestBeatOffset,
  secondsPerBeat,
  timeOfBeat,
} from "./beat-clock.js";
import { angularDistanceDeg, orientationToAim, projectToScreen, wrapDegrees } from "./aim-projection.js";
import {
  DODGE_GESTURES,
  DODGE_GESTURE_LABELS,
  DODGE_THRESHOLD_RANGE,
  createDodgeDetector,
  createWalkDetector,
} from "./dodge-detector.js";
import { GHOST_TYPES, GHOST_TYPE_IDS, MASTERY_THRESHOLDS, masteryLevel } from "./baksal-ghosts.js";
import { PURIFY_WINDOW_BEATS, createRunChart } from "./baksal-chart.js";
import {
  advanceRun,
  chooseTalisman,
  createRun,
  cuesBetween,
  currentRoom,
  dodgeRun,
  ghostPosition,
  ghostVisibility,
  isCursed,
  isTorchActive,
  projectilePosition,
  purifyRun,
  radarAzimuth,
  shieldRun,
  shootRun,
  summarizeRun,
  activateTalisman,
  weakPointPosition,
} from "./baksal-engine.js";
import { TALISMANS, nextTalismanUnlock, unlockedTalismanIds } from "./baksal-talismans.js";
import { codexMastery, readCodex, recordRun, writeCodex } from "./baksal-codex.js";
import { createBaksalAudio } from "./baksal-audio.js";
import { DEFAULT_BAKSAL_SETTINGS, normalizeBaksalSettings, readBaksalSettings, writeBaksalSettings } from "./baksal-settings.js";
import { createMudflatSeed } from "../mudflat-rng.js";
import { withKoreanSubject } from "../korean-particles.js";
import { GESTURE_HINTS, drawFrame, type Frame, type FrameFlash, type FrameGhost, type FrameProjectile } from "./baksal-render";

type Screen = "start" | "calibrate" | "run" | "result" | "codex";
type Settings = ReturnType<typeof normalizeBaksalSettings>;
type Audio = ReturnType<typeof createBaksalAudio>;
type Aim = { yaw: number; pitch: number };
type Orientation = { yaw: number; pitch: number; t: number } | null;
type GestureListener = (gesture: string, t: number) => void;
type RunSummary = ReturnType<typeof summarizeRun>;
type Clock = ReturnType<typeof createTempoMap>;
type CodexGhostEntry = { seen: number; purified: number };
type CodexRun = { at: number; score: number; failed: boolean; roomsCleared: number; bpm: number; maxCombo: number };
type Codex = { ghosts: Record<string, CodexGhostEntry>; totalPurified: number; runs: CodexRun[]; best: number };
type RunRecord = { codex: Codex; newEntries: string[]; masteryUps: { type: string; level: number }[]; newTalismans: string[]; isBest: boolean };
type TalismanInfo = { id: string; axis: string; name: string; summary: string; active?: { uses: number; effect: string; beats: number } };
const TALISMAN_BY_ID: Record<string, TalismanInfo> = TALISMANS;
type ActiveTalisman = { id: string; usesLeft: number; effect: string; beats: number };
type Choice = { offered: string[]; deadlineBeat: number; forRoom: number };
type RunState = {
  chart: { rooms: { index: number; name: string; boss: boolean; startBeat: number; endBeat: number }[]; lengthBeats: number; bpm: number };
  phase: string;
  score: number;
  combo: number;
  hp: number;
  maxHp: number;
  shieldsLeft: number;
  shieldUntil: number;
  torchUntil: number;
  curse: { shakeUntil: number; blurUntil: number };
  active: ActiveTalisman | null;
  choice: Choice | null;
  ghosts: RunGhost[];
  projectiles: RunProjectile[];
  modifiers: { aimAssistDeg: number; lanternConeDeg: number; purifyBeats: number[] };
  mastery: Record<string, number>;
  finished: boolean;
};
type RunProjectile = { id: string; ghostId: string; kind: string; gesture: string | null; fireBeat: number; arriveBeat: number; status: string };
type RunGhost = {
  id: string; type: string; name: string; grade: string; status: string; hp: number; maxHp: number; azimuth: number; elevation: number; distance: number;
  purifiableUntil: number | null; staggerUntil: number; hidden: boolean; mimic: boolean; spawnBeat: number;
};
type PauseReason = "manual" | "walk" | "down" | "hidden";

type SensorState = {
  gyro: boolean | null;
  motion: boolean | null;
  camera: "pending" | "granted" | "denied";
};

const CALIBRATION_TAPS = 8;
const LOOKAHEAD_SECONDS = 0.15;
const SCHEDULER_INTERVAL_MS = 25;
const HOLD_MS = 320;
const JUDGMENT_COLORS: Record<string, string> = { ttak: "#ffd36c", joa: "#9be7ff", miss: "#ff8c8c" };

function eventAudioTime(audio: Audio, timeStamp: number) {
  const lag = Math.max(0, (performance.now() - timeStamp) / 1000);
  return audio.now() - Math.min(lag, 0.5);
}

export function BaksalPrototype({ onExit }: { onExit?: () => void } = {}) {
  const [screen, setScreen] = useState<Screen>("start");
  const [settings, setSettings] = useState<Settings>(() => normalizeBaksalSettings(DEFAULT_BAKSAL_SETTINGS));
  const [codex, setCodex] = useState<Codex>(() => readCodex(() => undefined as unknown as Storage) as Codex);
  const [sensors, setSensors] = useState<SensorState>({ gyro: null, motion: null, camera: "pending" });
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<{ summary: RunSummary; rotation: number; runIndex: number; record: RunRecord } | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [audio, setAudio] = useState<Audio | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const orientationRef = useRef<Orientation>(null);
  const gestureListenerRef = useRef<GestureListener | null>(null);
  const motionListenerRef = useRef<((sample: { t: number; x: number; y: number; z: number }) => void) | null>(null);
  const detectorRef = useRef(createDodgeDetector());
  const sensorsArmed = useRef(false);

  useEffect(() => {
    setSettings(readBaksalSettings());
    setCodex(readCodex() as Codex);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => writeBaksalSettings({ ...previous, ...patch }));
  }, []);

  useEffect(() => {
    detectorRef.current.setThreshold(settings.dodgeThreshold);
  }, [settings.dodgeThreshold]);

  useEffect(() => () => {
    stream?.getTracks().forEach((track) => track.stop());
  }, [stream]);

  const armSensors = useCallback(() => {
    if (sensorsArmed.current) return;
    sensorsArmed.current = true;
    let sawOrientation = false;
    let sawMotion = false;
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.beta === undefined) return;
      const aim = orientationToAim({ alpha: event.alpha ?? 0, beta: event.beta, gamma: event.gamma ?? 0 });
      orientationRef.current = { yaw: aim.yaw, pitch: aim.pitch, t: event.timeStamp };
      if (!sawOrientation) {
        sawOrientation = true;
        setSensors((previous) => ({ ...previous, gyro: true }));
      }
    };
    const onMotion = (event: DeviceMotionEvent) => {
      const linear = event.acceleration;
      const gravity = event.accelerationIncludingGravity;
      let detected = null;
      if (linear && linear.x !== null && linear.y !== null && linear.z !== null) {
        const sample = { t: event.timeStamp, x: linear.x, y: linear.y, z: linear.z };
        motionListenerRef.current?.(sample);
        detected = detectorRef.current.push(sample);
      } else if (gravity && gravity.x !== null && gravity.y !== null && gravity.z !== null) {
        detected = detectorRef.current.pushWithGravity({ t: event.timeStamp, x: gravity.x, y: gravity.y, z: gravity.z });
      } else {
        return;
      }
      if (!sawMotion) {
        sawMotion = true;
        setSensors((previous) => ({ ...previous, motion: true }));
      }
      if (detected) gestureListenerRef.current?.(detected.gesture, detected.t);
    };
    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("devicemotion", onMotion);
    window.setTimeout(() => {
      setSensors((previous) => ({ ...previous, gyro: previous.gyro ?? sawOrientation, motion: previous.motion ?? sawMotion }));
    }, 1800);
  }, []);

  const beginSession = useCallback(async () => {
    setStarting(true);
    try {
      type AudioContextCtor = typeof AudioContext;
      const Ctor: AudioContextCtor | undefined = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
      if (!Ctor) throw new Error("audio");
      let currentAudio = audio;
      if (!currentAudio) {
        currentAudio = createBaksalAudio(new Ctor());
        setAudio(currentAudio);
      }
      await currentAudio.context.resume();

      const orientationCtor = (globalThis as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
      const motionCtor = (globalThis as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
      try { await orientationCtor?.requestPermission?.(); } catch { /* 거부하면 고정 자세 모드로 간다 */ }
      try { await motionCtor?.requestPermission?.(); } catch { /* 거부하면 회피 버튼으로 간다 */ }
      armSensors();

      if (!stream && navigator.mediaDevices?.getUserMedia) {
        try {
          const granted = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
          setStream(granted);
          setSensors((previous) => ({ ...previous, camera: "granted" }));
        } catch {
          setSensors((previous) => ({ ...previous, camera: "denied" }));
        }
      } else if (!stream) {
        setSensors((previous) => ({ ...previous, camera: "denied" }));
      }
      setScreen(settings.offsetMs === null ? "calibrate" : "run");
    } finally {
      setStarting(false);
    }
  }, [armSensors, audio, settings.offsetMs, stream]);

  const startRun = useCallback(() => {
    setRunKey((key) => key + 1);
    setScreen("run");
  }, []);

  const finishRun = useCallback((summary: RunSummary, rotation: number) => {
    const runIndex = settings.runsPlayed + 1;
    updateSettings({ runsPlayed: runIndex });
    const record = recordRun(codex, summary) as RunRecord;
    setCodex(writeCodex(record.codex) as Codex);
    setResult({ summary, rotation, runIndex, record });
    setScreen("result");
  }, [codex, settings.runsPlayed, updateSettings]);

  const fixedStance = settings.fixedStance || sensors.gyro === false;

  return (
    <div className="bk-root" data-screen={screen}>
      <div className="bk-portrait">
        {screen === "start" && (
          <StartScreen
            settings={settings}
            sensors={sensors}
            starting={starting}
            codex={codex}
            onChange={updateSettings}
            onStart={beginSession}
            onRecalibrate={() => updateSettings({ offsetMs: null })}
            onCodex={() => setScreen("codex")}
            onExit={onExit}
          />
        )}
        {screen === "codex" && <CodexScreen codex={codex} onBack={() => setScreen("start")} />}
        {screen === "calibrate" && audio && (
          <CalibrationScreen
            audio={audio}
            bpm={settings.bpm}
            onDone={(offsetMs) => { updateSettings({ offsetMs }); startRun(); }}
            onSkip={() => { updateSettings({ offsetMs: 0 }); startRun(); }}
          />
        )}
        {screen === "run" && audio && (
          <RunScreen
            key={runKey}
            audio={audio}
            stream={stream}
            settings={settings}
            codex={codex}
            fixedStance={fixedStance}
            motionAvailable={sensors.motion !== false}
            orientationRef={orientationRef}
            gestureListenerRef={gestureListenerRef}
            motionListenerRef={motionListenerRef}
            onFinish={finishRun}
            onExit={() => setScreen("start")}
          />
        )}
        {screen === "result" && result && (
          <ResultScreen
            result={result}
            settings={settings}
            codex={codex}
            onAgain={startRun}
            onCodex={() => setScreen("codex")}
            onHome={() => setScreen("start")}
          />
        )}
      </div>
      <div className="bk-notice" role="status">
        <strong>세로 화면으로 돌려 주세요</strong>
        <p>박살은 폰을 세로로 세워 들고 플레이합니다.</p>
      </div>
    </div>
  );
}

function StartScreen({ settings, sensors, starting, codex, onChange, onStart, onRecalibrate, onCodex, onExit }: {
  settings: Settings;
  sensors: SensorState;
  starting: boolean;
  codex: Codex;
  onChange: (patch: Partial<Settings>) => void;
  onStart: () => void;
  onRecalibrate: () => void;
  onCodex: () => void;
  onExit?: () => void;
}) {
  const seen = GHOST_TYPE_IDS.filter((id) => codex.ghosts[id].seen > 0).length;
  const unlock = nextTalismanUnlock(codex.totalPurified);
  return (
    <main className="bk-panel">
      <span className="bk-stage-tag">1단계 · 방 4개 + 지박령</span>
      <header className="bk-brand">
        <small>BAKSAL: BEAT THE GHOSTS</small>
        <h1>박<em>살</em></h1>
        <p>리듬 AR 퇴마 댄싱 · <b>박자로 악귀를 박살내다</b></p>
      </header>

      <section className="bk-card bk-meta-row" aria-label="기록">
        <span><small>최고 점수</small><b>{codex.best}</b></span>
        <span><small>도감</small><b>{seen}<em>/{GHOST_TYPE_IDS.length}</em></b></span>
        <span><small>누적 정화</small><b>{codex.totalPurified}</b></span>
      </section>
      {unlock && <p className="bk-note">누적 정화 {unlock.purified}회가 되면 부적 {withKoreanSubject(unlock.ids.map((id: string) => TALISMAN_BY_ID[id].name).join("·"))} 열립니다.</p>}

      <section className="bk-card">
        <h2>이렇게 합니다</h2>
        <ul>
          <li>폰을 세워 들면 카메라 위에 악귀가 나타납니다. <b>몸을 돌려</b> 조준점에 맞춥니다.</li>
          <li>딱딱이 박자에 맞춰 <b>화면 아무 곳을 탭</b>하면 소금총이 나갑니다. 정박이면 <b>딱</b>, 피해 2배. 노란 표식은 약점입니다.</li>
          <li>악귀는 1박에 예고하고 3박(돌진은 4박)에 도착합니다. 도착 박에 <b>몸과 폰을 함께</b> 숙이거나, 옆으로, 뒤로 피합니다. 저주 파동은 쏴서 막습니다.</li>
          <li>쓰러진 악귀는 <b>마디 첫 박</b>에 조준한 채 길게 눌러 정화합니다. 방이 끝나면 부적 3개 중 1개를 고릅니다.</li>
          <li>위급하면 폰을 <b>세게 흔들어</b> 1박 결계를 칩니다. 런당 1회.</li>
          <li>주변 1m를 비우고, 한 발 이내로만 움직입니다. 이어폰을 권장합니다.</li>
        </ul>
      </section>

      <section className="bk-card">
        <div className="bk-field">
          <span>템포 <small>{settings.bpm} BPM부터 시작</small></span>
          <div className="bk-segment" role="group" aria-label="템포 선택">
            {BPM_CHOICES.map((bpm) => (
              <button key={bpm} type="button" aria-pressed={settings.bpm === bpm} onClick={() => onChange({ bpm })}>{bpm}</button>
            ))}
          </div>
        </div>
        <div className="bk-field">
          <span>판정 폭 <small>{settings.windows === "lenient" ? "넉넉한 판정 ±150/300ms" : "표준 ±90/180ms"}</small></span>
          <div className="bk-segment" role="group" aria-label="판정 폭 선택">
            <button type="button" aria-pressed={settings.windows === "standard"} onClick={() => onChange({ windows: "standard" })}>표준</button>
            <button type="button" aria-pressed={settings.windows === "lenient"} onClick={() => onChange({ windows: "lenient" })}>넉넉하게</button>
          </div>
        </div>
        <div className="bk-field">
          <span>회피 감도 <small>충격 {settings.dodgeThreshold.toFixed(1)} m/s² 이상</small></span>
          <input
            type="range"
            min={DODGE_THRESHOLD_RANGE.min}
            max={DODGE_THRESHOLD_RANGE.max}
            step={0.5}
            value={settings.dodgeThreshold}
            aria-label="회피 감도"
            onChange={(event) => onChange({ dodgeThreshold: Number(event.target.value) })}
          />
          <p className="bk-note">오인식이 잦으면 값을 올리고, 동작이 안 잡히면 내립니다.</p>
        </div>
        <div className="bk-field">
          <button type="button" className="bk-toggle" aria-pressed={settings.fixedStance} onClick={() => onChange({ fixedStance: !settings.fixedStance })}>
            <span>고정 자세 모드<small>드래그로 조준하고 회피와 결계는 버튼으로 합니다. 자이로가 없으면 자동으로 켜집니다.</small></span>
            <i aria-hidden="true" />
          </button>
        </div>
      </section>

      <div className="bk-actions">
        <button type="button" className="bk-primary" disabled={starting} onClick={onStart}>
          {starting ? "권한을 확인하는 중" : settings.offsetMs === null ? "권한 허용하고 보정 시작" : "권한 허용하고 시작"}
        </button>
        <button type="button" className="bk-secondary" onClick={onCodex}>악귀 도감</button>
        {settings.offsetMs !== null && (
          <button type="button" className="bk-secondary" onClick={onRecalibrate}>
            지연 보정 다시 하기 (현재 {settings.offsetMs > 0 ? "+" : ""}{settings.offsetMs}ms)
          </button>
        )}
        {onExit && <button type="button" className="bk-secondary" onClick={onExit}>게임 목록으로</button>}
      </div>
      {sensors.camera === "denied" && <p className="bk-note warn">카메라를 쓸 수 없어 어두운 배경으로 진행합니다. 게임 규칙은 같습니다.</p>}
      {sensors.gyro === false && <p className="bk-note warn">방향 센서를 읽을 수 없어 고정 자세 모드로 진행합니다.</p>}
      <p className="bk-note">카메라 영상은 기기 밖으로 나가지 않습니다. 위치 정보는 쓰지 않습니다. 지금까지 {settings.runsPlayed}런을 했습니다.</p>
    </main>
  );
}

function CodexScreen({ codex, onBack }: { codex: Codex; onBack: () => void }) {
  return (
    <main className="bk-panel">
      <header className="bk-brand">
        <small>도감</small>
        <h1 style={{ fontSize: 34 }}>악귀 도감</h1>
        <p>정화할수록 약점과 공격 박이 드러납니다. 숙련 3단계부터 런 중에 약점이 표시됩니다.</p>
      </header>
      <ul className="bk-codex">
        {GHOST_TYPE_IDS.map((id) => {
          const spec = GHOST_TYPES[id as keyof typeof GHOST_TYPES];
          const entry = codex.ghosts[id];
          const level = masteryLevel(entry.purified);
          const known = entry.seen > 0;
          const attack = spec.bars[0][0];
          return (
            <li key={id} className={known ? "known" : "unknown"} style={{ ["--bk-ghost" as string]: spec.color }}>
              <i aria-hidden="true" />
              <div>
                <b>{known ? spec.name : "???"} <small>{spec.grade} · {known ? spec.behavior : "미확인"}</small></b>
                <span className="bk-mastery" aria-label={`숙련 ${level}단계`}>
                  {MASTERY_THRESHOLDS.map((threshold, index) => <em key={threshold} className={level > index ? "on" : ""} />)}
                  <small>정화 {entry.purified} · 조우 {entry.seen}</small>
                </span>
                <p>{known ? spec.lore : "아직 만나지 못했다."}</p>
                {level >= 2 && (
                  <p className="bk-codex-detail">
                    공격 {attack.beat + 1}박 예고 → {attack.beat + attack.arrive + 1 > 4 ? "다음 마디 1박" : `${attack.beat + attack.arrive + 1}박`} 도착 ·
                    약점 {spec.weakPoint.elevation > 0 ? "위쪽" : "아래쪽"}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {codex.runs.length > 0 && (
        <section className="bk-card">
          <h2>최근 런</h2>
          <ul className="bk-history">
            {codex.runs.slice(0, 8).map((run, index) => (
              <li key={`${run.at}-${index}`}>
                <b>{run.score}</b>
                <span>{run.failed ? "쓰러짐" : "완주"} · 방 {run.roomsCleared}/5 · {run.bpm} BPM · {run.maxCombo}콤보</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="bk-actions">
        <button type="button" className="bk-primary" onClick={onBack}>돌아가기</button>
      </div>
    </main>
  );
}

function CalibrationScreen({ audio, bpm, onDone, onSkip }: {
  audio: Audio;
  bpm: number;
  onDone: (offsetMs: number) => void;
  onSkip: () => void;
}) {
  const [taps, setTaps] = useState<number[]>([]);
  const [phase, setPhase] = useState<"running" | "done">("running");
  const [pulse, setPulse] = useState(false);
  const [countIn, setCountIn] = useState<number | null>(COUNT_IN_BEATS);
  const [round, setRound] = useState(0);
  const [offset, setOffset] = useState<number | null>(null);
  const clockRef = useRef<{ bpm: number; startTime: number } | null>(null);
  const tapsRef = useRef<number[]>([]);

  useEffect(() => {
    const clock = { bpm, startTime: audio.now() + 0.4 };
    clockRef.current = clock;
    tapsRef.current = [];
    let nextBeat = -COUNT_IN_BEATS;
    const totalBeats = CALIBRATION_TAPS + 2;
    const interval = window.setInterval(() => {
      const horizon = audio.now() + LOOKAHEAD_SECONDS;
      while (nextBeat <= totalBeats && timeOfBeat(nextBeat, clock) < horizon) {
        audio.click(timeOfBeat(nextBeat, clock));
        nextBeat += 1;
      }
    }, SCHEDULER_INTERVAL_MS);
    let frame = 0;
    const loop = () => {
      const beat = beatAtTime(audio.now(), clock);
      setPulse(beat - Math.floor(beat) < 0.18);
      setCountIn(beat < 0 ? Math.ceil(-beat) : null);
      if (beat > totalBeats + 0.5) {
        const measured = calibrationOffsetMs(tapsRef.current);
        setOffset(tapsRef.current.length >= 4 ? measured : null);
        setPhase("done");
        return;
      }
      frame = window.requestAnimationFrame(loop);
    };
    frame = window.requestAnimationFrame(loop);
    return () => {
      window.clearInterval(interval);
      window.cancelAnimationFrame(frame);
    };
  }, [audio, bpm, round]);

  const onTap = (event: React.PointerEvent) => {
    if (phase !== "running" || !clockRef.current) return;
    const beat = beatAtTime(eventAudioTime(audio, event.timeStamp), clockRef.current);
    if (beat < -0.5) return;
    const { offsetMs } = nearestBeatOffset(beat, bpm);
    tapsRef.current = [...tapsRef.current, offsetMs].slice(-CALIBRATION_TAPS);
    setTaps(tapsRef.current);
  };

  return (
    <main className="bk-calibrate">
      <header className="bk-brand">
        <small>지연 보정</small>
        <h1 style={{ fontSize: 34 }}>소리에 맞춰 탭</h1>
        <p>기기마다 소리가 늦게 납니다. 클릭 소리가 들릴 때마다 아래 영역을 탭해 주세요. 8번이면 됩니다.</p>
      </header>
      {phase === "running" ? (
        <div className={`bk-tap-zone${pulse ? " pulse" : ""}`} onPointerDown={onTap} role="button" aria-label="박자에 맞춰 탭">
          <b>{countIn !== null ? countIn : taps.length}</b>
          <span>{countIn !== null ? "준비" : `${taps.length}/${CALIBRATION_TAPS} 탭`}</span>
          <div className="bk-tap-dots" aria-hidden="true">
            {Array.from({ length: CALIBRATION_TAPS }, (_, index) => <i key={index} className={index < taps.length ? "done" : ""} />)}
          </div>
        </div>
      ) : (
        <div className="bk-tap-zone">
          {offset === null ? (
            <>
              <b>?</b>
              <span>탭이 4번 미만입니다. 다시 해 주세요.</span>
            </>
          ) : (
            <>
              <b>{offset > 0 ? "+" : ""}{offset}<small style={{ fontSize: 18 }}>ms</small></b>
              <span>{offset > 0 ? "입력이 소리보다 늦게 들어옵니다. 그만큼 당겨서 판정합니다." : offset < 0 ? "입력이 소리보다 빠릅니다. 그만큼 늦춰서 판정합니다." : "오차가 거의 없습니다."}</span>
            </>
          )}
        </div>
      )}
      <div className="bk-actions">
        {phase === "done" && offset !== null && (
          <button type="button" className="bk-primary" onClick={() => onDone(offset)}>이 값으로 시작</button>
        )}
        {phase === "done" && (
          <button type="button" className="bk-secondary" onClick={() => { setPhase("running"); setTaps([]); tapsRef.current = []; setOffset(null); setCountIn(COUNT_IN_BEATS); setRound((value) => value + 1); }}>
            다시 보정
          </button>
        )}
        <button type="button" className="bk-secondary" onClick={onSkip}>보정 없이 시작 (0ms)</button>
      </div>
    </main>
  );
}

type HudState = {
  room: number;
  roomName: string;
  boss: boolean;
  score: number;
  combo: number;
  hp: number;
  maxHp: number;
  message: string;
  shields: number;
  active: { id: string; name: string; usesLeft: number; ready: boolean } | null;
  choice: { offered: string[]; remaining: number } | null;
  bpm: number;
};

function RunScreen({ audio, stream, settings, codex, fixedStance, motionAvailable, orientationRef, gestureListenerRef, motionListenerRef, onFinish, onExit }: {
  audio: Audio;
  stream: MediaStream | null;
  settings: Settings;
  codex: Codex;
  fixedStance: boolean;
  motionAvailable: boolean;
  orientationRef: React.MutableRefObject<Orientation>;
  gestureListenerRef: React.MutableRefObject<GestureListener | null>;
  motionListenerRef: React.MutableRefObject<((sample: { t: number; x: number; y: number; z: number }) => void) | null>;
  onFinish: (summary: RunSummary, rotation: number) => void;
  onExit: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hud, setHud] = useState<HudState>({ room: 1, roomName: "", boss: false, score: 0, combo: 0, hp: 5, maxHp: 5, message: "", shields: 1, active: null, choice: null, bpm: settings.bpm });
  const [paused, setPaused] = useState<PauseReason | null>(null);
  const [resuming, setResuming] = useState(false);
  const pausedRef = useRef<PauseReason | null>(null);
  const pausedAtRef = useRef(0);
  const resumeUntilRef = useRef<number | null>(null);

  const runtime = useRef<{
    clock: Clock;
    run: RunState;
    aim: Aim;
    originYaw: number | null;
    lastYaw: number | null;
    rotation: number;
    nextBeat: number;
    hint: Frame["hint"];
    judgment: FrameFlash;
    action: FrameFlash;
    hitFlashAt: number | null;
    message: { text: string; until: number } | null;
    finishedAt: number | null;
    downSince: number | null;
    drag: { id: number; x: number; y: number; moved: boolean; t: number } | null;
    holdTimer: number | null;
    hudAt: number;
  } | null>(null);

  const aimNow = useCallback((): Aim => {
    const state = runtime.current;
    if (!state) return { yaw: 0, pitch: 0 };
    if (fixedStance) return state.aim;
    const orientation = orientationRef.current;
    if (!orientation) return state.aim;
    if (state.originYaw === null) state.originYaw = orientation.yaw;
    const yaw = wrapDegrees(orientation.yaw - state.originYaw);
    if (state.lastYaw !== null) state.rotation += Math.abs(wrapDegrees(yaw - state.lastYaw));
    state.lastYaw = yaw;
    state.aim = { yaw, pitch: orientation.pitch };
    return state.aim;
  }, [fixedStance, orientationRef]);

  const correctedBeat = useCallback((audioTime: number) => {
    const state = runtime.current;
    if (!state) return 0;
    const beat = clockBeatAtTime(audioTime, state.clock);
    return correctInputBeat(beat, clockBpmAtBeat(state.clock, beat), settings.offsetMs ?? 0);
  }, [settings.offsetMs]);

  const flashJudgment = useCallback((judgment: string | null | undefined) => {
    const state = runtime.current;
    if (!state || !judgment) return;
    state.judgment = { text: JUDGMENT_LABELS[judgment as keyof typeof JUDGMENT_LABELS] ?? judgment, color: JUDGMENT_COLORS[judgment] ?? "#fff", at: performance.now() };
  }, []);

  const flashAction = useCallback((text: string, color: string) => {
    const state = runtime.current;
    if (!state) return;
    state.action = { text, color, at: performance.now() };
  }, []);

  const showMessage = useCallback((text: string, seconds = 2.2) => {
    const state = runtime.current;
    if (!state) return;
    state.message = { text, until: performance.now() + seconds * 1000 };
  }, []);

  const inputBlocked = useCallback(() => {
    const state = runtime.current;
    return !state || Boolean(pausedRef.current) || resumeUntilRef.current !== null || state.finishedAt !== null;
  }, []);

  const shootAt = useCallback((audioTime: number) => {
    const state = runtime.current;
    if (!state || inputBlocked()) return;
    const beat = correctedBeat(audioTime);
    if (beat < 0 || state.run.phase === "choice") return;
    const result = shootRun(state.run, beat, aimNow());
    audio.shot(audio.now());
    if (result.hit) {
      flashJudgment(result.judgment);
      audio.judgment(audio.now() + 0.02, result.judgment);
      if (result.weak) {
        audio.weak(audio.now() + 0.03);
        flashAction("약점!", "#ffd36c");
      }
      if (result.destroyed) flashAction(result.kind === "curse" ? "저주 격파!" : "격파!", "#9be7ff");
      if (result.killed) flashAction("정화 가능", "#dcc8ff");
    }
  }, [aimNow, audio, correctedBeat, flashAction, flashJudgment, inputBlocked]);

  const purifyAt = useCallback((audioTime: number) => {
    const state = runtime.current;
    if (!state || inputBlocked()) return;
    const result = purifyRun(state.run, correctedBeat(audioTime), aimNow());
    if (result.ok) {
      audio.purified(audio.now());
      flashAction(`${withKoreanSubject(result.name)} 봉인됐다`, "#dcc8ff");
      flashJudgment(result.judgment);
    } else if (result.reason === "beat") {
      flashAction(state.run.modifiers.purifyBeats.length > 1 ? "1박이나 3박에 다시" : "첫 박에 다시", "#ff8c8c");
    }
  }, [aimNow, audio, correctedBeat, flashAction, flashJudgment, inputBlocked]);

  const shieldAt = useCallback((audioTime: number) => {
    const state = runtime.current;
    if (!state || inputBlocked()) return;
    const result = shieldRun(state.run, correctedBeat(audioTime));
    if (result.ok) {
      audio.shield(audio.now());
      flashAction("긴급 결계!", "#a0dcff");
      if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
    } else if (result.reason === "none-left") {
      flashAction("결계가 없다", "#ff8c8c");
    }
  }, [audio, correctedBeat, flashAction, inputBlocked]);

  const dodgeAt = useCallback((gesture: string, audioTime: number) => {
    const state = runtime.current;
    if (!state || inputBlocked()) return;
    if (gesture === "shake") {
      shieldAt(audioTime);
      return;
    }
    const result = dodgeRun(state.run, correctedBeat(audioTime), gesture);
    if (result.matched) {
      audio.dodged(audio.now());
      flashAction(`${DODGE_GESTURE_LABELS[gesture as keyof typeof DODGE_GESTURE_LABELS]} 성공`, "#9bffb0");
      state.hint = null;
    } else if (result.reason === "wrong-gesture") {
      flashAction(`${GESTURE_HINTS[result.expected] ?? ""}`, "#ff8c8c");
    }
  }, [audio, correctedBeat, flashAction, inputBlocked, shieldAt]);

  const activateAt = useCallback((audioTime: number) => {
    const state = runtime.current;
    if (!state || inputBlocked() || !state.run.active) return;
    const result = activateTalisman(state.run, correctedBeat(audioTime), aimNow());
    if (result.ok) {
      if (result.effect === "torch") audio.torch(audio.now());
      else audio.talisman(audio.now());
      flashAction(`${TALISMAN_BY_ID[state.run.active.id].name} 발동`, "#ffe7c9");
    } else if (result.reason === "no-target") {
      flashAction("등롱 안에 투사체가 없다", "#ff8c8c");
    } else if (result.reason === "active") {
      flashAction("아직 타오르는 중", "#ff8c8c");
    }
  }, [aimNow, audio, correctedBeat, flashAction, inputBlocked]);

  const pickTalisman = useCallback((id: string) => {
    const state = runtime.current;
    if (!state || state.run.phase !== "choice") return;
    const result = chooseTalisman(state.run, id);
    if (result.ok) {
      audio.talisman(audio.now());
      showMessage(`${withKoreanSubject(result.name)} 손에 들어왔다`);
    }
  }, [audio, showMessage]);

  const purifiableInAim = useCallback(() => {
    const state = runtime.current;
    if (!state) return false;
    const aim = aimNow();
    const beat = clockBeatAtTime(audio.now(), state.clock);
    return (state.run.ghosts as RunGhost[]).some((ghost) => ghost.status === "purifiable" && angularDistanceDeg(aim, ghostPosition(state.run, ghost, beat)) <= state.run.modifiers.aimAssistDeg);
  }, [aimNow, audio]);

  const pauseRun = useCallback((reason: PauseReason) => {
    if (pausedRef.current || !runtime.current || runtime.current.finishedAt !== null) return;
    pausedRef.current = reason;
    pausedAtRef.current = audio.now();
    resumeUntilRef.current = null;
    setResuming(false);
    setPaused(reason);
  }, [audio]);

  /** 재개: 4박 카운트인 뒤에 멈춘 자리에서 이어진다. 카운트인 동안은 입력을 받지 않는다. */
  const resumeRun = useCallback(() => {
    const state = runtime.current;
    if (!pausedRef.current || !state || resumeUntilRef.current !== null) return;
    const bpm = clockBpmAtBeat(state.clock, clockBeatAtTime(pausedAtRef.current, state.clock));
    const spb = secondsPerBeat(bpm);
    const now = audio.now();
    for (let i = 0; i < COUNT_IN_BEATS; i += 1) audio.click(now + i * spb);
    resumeUntilRef.current = now + COUNT_IN_BEATS * spb;
    setResuming(true);
    setPaused(null);
  }, [audio]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      video.play().catch(() => { /* 자동 재생이 막히면 어두운 배경으로 진행 */ });
    }
  }, [stream]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const chart = createRunChart(createMudflatSeed(), { bpm: settings.bpm });
    const mastery = Object.fromEntries(GHOST_TYPE_IDS.map((id) => [id, codexMastery(codex, id)]));
    const run = createRun(chart, { windows: settings.windows, unlockedTalismans: unlockedTalismanIds(codex.totalPurified), mastery }) as unknown as RunState;
    runtime.current = {
      clock: createTempoMap(audio.now() + 0.5, chart.segments),
      run,
      aim: { yaw: 0, pitch: 0 },
      originYaw: null,
      lastYaw: null,
      rotation: 0,
      nextBeat: -COUNT_IN_BEATS,
      hint: null,
      judgment: null,
      action: null,
      hitFlashAt: null,
      message: { text: `${chart.rooms[0].name} · 주변 1m를 비우고 폰을 세워 주세요`, until: performance.now() + 3000 },
      finishedAt: null,
      downSince: null,
      drag: null,
      holdTimer: null,
      hudAt: 0,
    };
    pausedRef.current = null;
    resumeUntilRef.current = null;
    setPaused(null);
    setResuming(false);

    const walker = createWalkDetector();
    motionListenerRef.current = (sample) => {
      if (fixedStance) return;
      if (walker.push(sample)) pauseRun("walk");
    };
    gestureListenerRef.current = (gesture, t) => {
      dodgeAt(gesture, eventAudioTime(audio, t));
    };

    const scheduler = window.setInterval(() => {
      const state = runtime.current;
      if (!state || pausedRef.current || resumeUntilRef.current !== null || state.finishedAt !== null) return;
      const horizon = audio.now() + LOOKAHEAD_SECONDS;
      const aim = aimNow();
      while (clockTimeOfBeat(state.nextBeat, state.clock) < horizon) {
        const beat = state.nextBeat;
        const at = clockTimeOfBeat(beat, state.clock);
        if (beat <= state.run.chart.lengthBeats + BEATS_PER_BAR) {
          audio.metronome(at, ((beat % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR === 0);
        }
        for (const cue of cuesBetween(state.run, beat, beat + 1)) {
          const cueAt = clockTimeOfBeat(cue.beat, state.clock);
          if (cue.type === "room") {
            audio.roomStart(cueAt, cue.boss);
            continue;
          }
          const relative = wrapDegrees((cue.azimuth ?? 0) - aim.yaw);
          if (cue.type === "spawn") {
            if (cue.grade === "지박령") audio.roomStart(cueAt, true);
            else audio.spawn(cueAt, relative);
            const ghost = (state.run.ghosts as RunGhost[]).find((candidate) => candidate.id === cue.ghostId);
            if (ghost?.hidden) audio.whisper(cueAt + 0.2, relative);
          } else if (cue.type === "fire") {
            if (cue.kind === "curse") audio.curseCue(cueAt, relative);
            else audio.cue(cueAt, cue.gesture, relative);
          } else if (cue.type === "arrive") {
            if (cue.kind !== "curse") audio.arrive(cueAt, cue.gesture, relative);
          }
        }
        state.nextBeat += 1;
      }
    }, SCHEDULER_INTERVAL_MS);

    const context = canvas.getContext("2d");
    let frameId = 0;
    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") pauseRun("hidden");
    };
    document.addEventListener("visibilitychange", onVisibility);

    const loop = () => {
      const state = runtime.current;
      if (!state || !context) return;
      const now = performance.now();
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const aim = aimNow();
      const audioNow = audio.now();

      // 재개 카운트인이 끝나면 멈춘 시간만큼 시계를 민다.
      if (resumeUntilRef.current !== null && audioNow >= resumeUntilRef.current) {
        const pausedFor = audioNow - pausedAtRef.current;
        state.clock = { ...state.clock, startTime: state.clock.startTime + pausedFor };
        pausedRef.current = null;
        resumeUntilRef.current = null;
        setResuming(false);
      }
      const frozen = Boolean(pausedRef.current) || resumeUntilRef.current !== null;
      const beat = clockBeatAtTime(frozen ? pausedAtRef.current : audioNow, state.clock);

      if (!frozen && state.finishedAt === null) {
        if (!fixedStance && orientationRef.current) {
          if (aim.pitch < -60) {
            if (state.downSince === null) state.downSince = audioNow;
            else if (audioNow - state.downSince > secondsPerBeat(clockBpmAtBeat(state.clock, beat))) pauseRun("down");
          } else {
            state.downSince = null;
          }
        }
        for (const event of advanceRun(state.run, beat)) {
          if (event.type === "cue") {
            state.hint = { gesture: event.gesture, kind: event.kind, until: event.arriveBeat };
          } else if (event.type === "player-hit") {
            audio.playerHit(audioNow);
            state.hitFlashAt = now;
            state.hint = null;
            flashJudgment("miss");
            if (navigator.vibrate) navigator.vibrate(120);
          } else if (event.type === "cursed") {
            audio.cursed(audioNow);
            state.hint = null;
            flashAction("저주에 걸렸다", "#ff8fb8");
          } else if (event.type === "curse-resisted") {
            flashAction("저주를 씻어냈다", "#9bffb0");
          } else if (event.type === "blocked") {
            audio.blocked(audioNow);
            flashAction("결계가 막았다", "#a0dcff");
            state.hint = null;
          } else if (event.type === "spawn") {
            showMessage(event.mimic ? "소리가 사람을 흉내 낸다. 반대쪽을 봐라" : event.hidden ? `${withKoreanSubject(event.name)} 곁눈에 아른거린다` : `${withKoreanSubject(event.name)} 나타났다`);
          } else if (event.type === "purify-expired") {
            showMessage(`${withKoreanSubject(event.name)} 사라졌다. 정화를 놓쳤다`);
          } else if (event.type === "leave") {
            showMessage(`${withKoreanSubject(event.name)} 물러났다`);
          } else if (event.type === "room-clear") {
            showMessage(`${event.name} 정리. 부적을 고르세요`, 3);
          } else if (event.type === "talisman-auto") {
            showMessage(`시간이 지나 ${withKoreanSubject(event.name)} 자동으로 선택됐다`);
          } else if (event.type === "finished") {
            state.finishedAt = now;
            state.hint = null;
          }
        }
      } else if (pausedRef.current === "down" && aim.pitch > -35) {
        resumeRun();
      }

      if (state.finishedAt !== null && now - state.finishedAt > 900) {
        onFinish(summarizeRun(state.run), state.rotation);
        return;
      }

      const torch = isTorchActive(state.run, beat);
      const ghosts: FrameGhost[] = [];
      for (const ghost of state.run.ghosts as RunGhost[]) {
        if (ghost.status !== "alive" && ghost.status !== "purifiable") continue;
        const position = ghostPosition(state.run, ghost, beat);
        const projected = projectToScreen(aim, position, width, height);
        const spec = GHOST_TYPES[ghost.type as keyof typeof GHOST_TYPES];
        const visibility = ghostVisibility(state.run, ghost, aim, beat);
        const radarDYaw = wrapDegrees(radarAzimuth(state.run, ghost, aim, beat) - aim.yaw);
        let weakPoint: FrameGhost["weakPoint"] = null;
        if (ghost.status === "alive" && (state.run.mastery[ghost.type] ?? 0) >= 3 && visibility > 0.2) {
          const weakProjected = projectToScreen(aim, weakPointPosition(state.run, ghost, beat), width, height);
          if (weakProjected.onScreen) weakPoint = { x: weakProjected.x, y: weakProjected.y };
        }
        ghosts.push({
          id: ghost.id,
          type: ghost.type,
          sprite: spec?.sprite ?? "flame",
          name: ghost.name,
          grade: ghost.grade,
          color: spec?.color ?? "#fff",
          x: projected.x,
          y: projected.y,
          onScreen: projected.onScreen,
          dYaw: projected.dYaw,
          radarDYaw,
          scale: projected.scale,
          visibility,
          status: ghost.status as "alive" | "purifiable",
          hp: ghost.hp,
          maxHp: ghost.maxHp,
          purifyRemaining: ghost.status === "purifiable" && ghost.purifiableUntil !== null ? Math.max(0, (ghost.purifiableUntil - beat) / PURIFY_WINDOW_BEATS) : null,
          weakPoint,
          staggered: beat < ghost.staggerUntil,
          hidden: ghost.hidden,
        });
      }
      const projectiles: FrameProjectile[] = [];
      for (const projectile of state.run.projectiles as RunProjectile[]) {
        if (projectile.status !== "flying") continue;
        const position = projectilePosition(state.run, projectile, beat);
        const projected = projectToScreen(aim, position, width, height);
        projectiles.push({ id: projectile.id, gesture: projectile.gesture, kind: projectile.kind, x: projected.x, y: projected.y, onScreen: projected.onScreen, progress: position.progress, dYaw: projected.dYaw });
      }
      const room = currentRoom(state.run);
      const boss = (state.run.ghosts as RunGhost[]).find((ghost) => ghost.grade === "지박령" && ghost.status === "alive");
      let countIn: number | null = null;
      if (resumeUntilRef.current !== null) countIn = Math.max(1, Math.ceil((resumeUntilRef.current - audioNow) / secondsPerBeat(clockBpmAtBeat(state.clock, beat))));
      else if (beat < 0 && !pausedRef.current) countIn = Math.min(COUNT_IN_BEATS, Math.ceil(-beat));
      const frame: Frame = {
        now,
        beat,
        beatPhase: beat - Math.floor(beat),
        countIn,
        ghosts,
        projectiles,
        hint: state.hint && beat < state.hint.until + 0.2 ? state.hint : null,
        showHintText: room.index <= 1 || settings.runsPlayed < 3,
        judgment: state.judgment,
        action: state.action,
        hitFlashAt: state.hitFlashAt,
        paused: frozen,
        lanternConeDeg: state.run.modifiers.lanternConeDeg,
        torch,
        curseShake: beat < state.run.curse.shakeUntil,
        curseBlur: isCursed(state.run, beat),
        shieldActive: beat < state.run.shieldUntil,
        boss: boss ? { name: boss.name, hp: boss.hp, maxHp: boss.maxHp } : null,
      };
      drawFrame(context, width, height, frame);

      if (now - state.hudAt > 100) {
        state.hudAt = now;
        const active = state.run.active;
        setHud({
          room: Math.min(state.run.chart.rooms.length, room.index + 1),
          roomName: room.name,
          boss: Boolean(room.boss),
          score: state.run.score,
          combo: state.run.combo,
          hp: state.run.hp,
          maxHp: state.run.maxHp,
          message: state.message && state.message.until > now ? state.message.text : "",
          shields: state.run.shieldsLeft,
          active: active ? { id: active.id, name: TALISMAN_BY_ID[active.id].name, usesLeft: active.usesLeft, ready: active.usesLeft > 0 && !(active.effect === "torch" && torch) } : null,
          choice: state.run.phase === "choice" && state.run.choice ? { offered: [...state.run.choice.offered], remaining: Math.max(0, state.run.choice.deadlineBeat - beat) } : null,
          bpm: clockBpmAtBeat(state.clock, beat),
        });
      }
      frameId = window.requestAnimationFrame(loop);
    };
    frameId = window.requestAnimationFrame(loop);

    return () => {
      window.clearInterval(scheduler);
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      motionListenerRef.current = null;
      gestureListenerRef.current = null;
      if (runtime.current?.holdTimer) window.clearTimeout(runtime.current.holdTimer);
    };
  }, [aimNow, audio, codex, dodgeAt, fixedStance, flashAction, flashJudgment, gestureListenerRef, motionListenerRef, onFinish, orientationRef, pauseRun, resumeRun, settings.bpm, settings.runsPlayed, settings.windows, showMessage]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = runtime.current;
    if (!state || inputBlocked()) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const t = eventAudioTime(audio, event.timeStamp);
    state.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, t };
    if (fixedStance) return;
    if (purifiableInAim()) {
      state.holdTimer = window.setTimeout(() => {
        state.holdTimer = null;
        purifyAt(t);
      }, HOLD_MS);
    } else {
      shootAt(t);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = runtime.current;
    if (!state?.drag || state.drag.id !== event.pointerId) return;
    const dx = event.clientX - state.drag.x;
    const dy = event.clientY - state.drag.y;
    if (Math.hypot(dx, dy) > 8) state.drag.moved = true;
    if (fixedStance) {
      state.aim = {
        yaw: wrapDegrees(state.aim.yaw + dx * 0.25),
        pitch: Math.max(-80, Math.min(80, state.aim.pitch - dy * 0.25)),
      };
      state.drag.x = event.clientX;
      state.drag.y = event.clientY;
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = runtime.current;
    if (!state?.drag || state.drag.id !== event.pointerId) return;
    const drag = state.drag;
    state.drag = null;
    if (state.holdTimer) {
      window.clearTimeout(state.holdTimer);
      state.holdTimer = null;
    }
    if (fixedStance && !drag.moved && !inputBlocked()) {
      if (purifiableInAim()) {
        if (eventAudioTime(audio, event.timeStamp) - drag.t >= HOLD_MS / 1000) purifyAt(drag.t);
      } else {
        shootAt(drag.t);
      }
    }
  };

  const pauseCopy: Record<PauseReason, { title: string; body: string }> = {
    manual: { title: "잠시 멈춤", body: "준비되면 이어서 합니다. 4박 카운트인 뒤 멈춘 자리에서 박자가 다시 흐릅니다." },
    walk: { title: "멈춰서 플레이하세요", body: "걷는 움직임이 감지됐습니다. 제자리에 서서 이어 주세요." },
    down: { title: "폰을 들어 주세요", body: "폰을 내려놓아 멈췄습니다. 다시 세워 들면 이어집니다." },
    hidden: { title: "잠시 멈춤", body: "화면을 벗어나 멈췄습니다." },
  };

  const buttonsOnly = fixedStance || !motionAvailable;

  return (
    <div
      className="bk-run"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {stream ? <video ref={videoRef} playsInline muted autoPlay aria-hidden="true" /> : null}
      <canvas ref={canvasRef} aria-label="악귀와 조준점이 보이는 카메라 화면" />
      <div className="bk-hud">
        <button type="button" aria-label="나가기" onClick={onExit}>✕</button>
        <div className="bk-hud-center">
          <div className="bk-hearts" aria-label={`체력 ${hud.hp}`}>
            {Array.from({ length: hud.maxHp }, (_, index) => <i key={index} className={index < hud.hp ? "on" : ""}>♥</i>)}
          </div>
          <strong>{hud.boss ? "지박령" : `방 ${hud.room}/5`} · {hud.score}점{hud.combo >= 2 ? ` · ${hud.combo}콤보` : ""} · {hud.bpm}</strong>
          {hud.message && <span>{hud.message}</span>}
        </div>
        <button type="button" aria-label="잠시 멈춤" onClick={() => pauseRun("manual")}>❚❚</button>
      </div>
      <div className="bk-bottom">
        {buttonsOnly ? (
          <div className="bk-dodge-pad" role="group" aria-label="회피 동작">
            {DODGE_GESTURES.map((gesture) => (
              <button key={gesture} type="button" onPointerDown={(event) => { event.stopPropagation(); dodgeAt(gesture, eventAudioTime(audio, event.timeStamp)); }}>
                {DODGE_GESTURE_LABELS[gesture as keyof typeof DODGE_GESTURE_LABELS]}
              </button>
            ))}
          </div>
        ) : null}
        <div className="bk-bottom-row">
          <button
            type="button"
            className={`bk-slot${hud.active?.ready ? " ready" : ""}`}
            disabled={!hud.active}
            aria-label={hud.active ? `${hud.active.name} ${hud.active.usesLeft}회 남음` : "발동형 부적 없음"}
            onPointerDown={(event) => { event.stopPropagation(); activateAt(eventAudioTime(audio, event.timeStamp)); }}
          >
            <small>부적</small>
            <b>{hud.active ? hud.active.name : "—"}</b>
            {hud.active && <em>{hud.active.usesLeft}회</em>}
          </button>
          <span className="bk-fire-hint">{fixedStance ? "끌어서 조준 · 탭하면 발사" : "화면 전체가 발사 · 몸을 돌려 조준"}</span>
          <button
            type="button"
            className={`bk-slot shield${hud.shields > 0 ? " ready" : ""}`}
            aria-label={`긴급 결계 ${hud.shields}회 남음`}
            onPointerDown={(event) => { event.stopPropagation(); shieldAt(eventAudioTime(audio, event.timeStamp)); }}
          >
            <small>{buttonsOnly ? "결계" : "흔들기"}</small>
            <b>결계</b>
            <em>{hud.shields}회</em>
          </button>
        </div>
      </div>
      {hud.choice && !paused && !resuming && (
        <div className="bk-choice" role="dialog" aria-label="부적 선택">
          <header>
            <b>부적을 고르세요</b>
            <i aria-hidden="true"><span style={{ width: `${Math.min(100, (hud.choice.remaining / 8) * 100)}%` }} /></i>
          </header>
          <div>
            {hud.choice.offered.map((id) => {
              const talisman = TALISMAN_BY_ID[id];
              return (
                <button key={id} type="button" onPointerDown={(event) => { event.stopPropagation(); pickTalisman(id); }}>
                  <small>{talisman.axis}{talisman.active ? " · 발동형" : ""}</small>
                  <b>{talisman.name}</b>
                  <span>{talisman.summary}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {paused && (
        <div className="bk-overlay" role="dialog" aria-modal="true">
          <h2>{pauseCopy[paused].title}</h2>
          <p>{pauseCopy[paused].body}</p>
          <div className="bk-actions">
            {paused !== "down" && <button type="button" className="bk-primary" onClick={resumeRun}>이어서 하기</button>}
            <button type="button" className="bk-secondary" onClick={onExit}>그만하기</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultScreen({ result, settings, codex, onAgain, onCodex, onHome }: {
  result: { summary: RunSummary; rotation: number; runIndex: number; record: RunRecord };
  settings: Settings;
  codex: Codex;
  onAgain: () => void;
  onCodex: () => void;
  onHome: () => void;
}) {
  const { summary, rotation, runIndex, record } = result;
  const dodgeTotal = summary.dodges.ok + summary.dodges.fail + summary.dodges.blocked;
  const ghostName = (type: string) => GHOST_TYPES[type as keyof typeof GHOST_TYPES]?.name ?? type;
  return (
    <main className="bk-panel">
      <span className="bk-stage-tag">{runIndex}번째 런 · {settings.bpm} BPM · {settings.windows === "lenient" ? "넉넉한 판정" : "표준 판정"}</span>
      <header className="bk-score">
        <small>{summary.failed ? "쓰러졌다" : "밤을 지켰다"}{record.isBest ? " · 최고 기록" : ""}</small>
        <b>{summary.score}</b>
        <span>방 {summary.roomsCleared}/5 · 최대 {summary.maxCombo}콤보 · 체력 {summary.hp}/{summary.maxHp}</span>
      </header>
      <section className="bk-result-grid" aria-label="판정 요약">
        <span><small>딱</small><b>{summary.counts.ttak}</b></span>
        <span><small>좋아</small><b>{summary.counts.joa}</b></span>
        <span><small>놓침</small><b>{summary.counts.miss}</b></span>
        <span><small>회피</small><b>{summary.dodges.ok}<em>/{dodgeTotal}</em></b></span>
        <span><small>격파</small><b>{summary.destroyed}</b></span>
        <span><small>정화</small><b>{summary.purified}<em>/{summary.purified + summary.missedPurify}</em></b></span>
        <span><small>약점</small><b>{summary.weakHits}</b></span>
        <span><small>저주</small><b>{summary.cursedCount}</b></span>
        <span><small>회전</small><b>{Math.round(rotation)}<em>°</em></b></span>
      </section>
      <section className="bk-card">
        <h2>방별 기록</h2>
        <table className="bk-rooms">
          <thead><tr><th>방</th><th>딱</th><th>회피</th><th>정화</th><th>피격</th></tr></thead>
          <tbody>
            {(summary.roomStats as { name: string; boss: boolean; ttak: number; dodgeOk: number; blocked: number; purified: number; hits: number; cursed: number }[]).map((room, index) => (
              <tr key={room.name} className={index >= summary.roomsCleared && !(index === summary.roomsCleared && summary.failed) ? "skipped" : ""}>
                <td>{room.boss ? "지박령" : `${index + 1}. ${room.name}`}</td>
                <td>{room.ttak}</td>
                <td>{room.dodgeOk}{room.blocked ? `+${room.blocked}` : ""}</td>
                <td>{room.purified}</td>
                <td>{room.hits}{room.cursed ? ` (저주 ${room.cursed})` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {(record.newEntries.length > 0 || record.masteryUps.length > 0 || record.newTalismans.length > 0) && (
        <section className="bk-card bk-unlocks">
          <h2>도감</h2>
          {record.newEntries.length > 0 && <p>새로 등록: <b>{record.newEntries.map(ghostName).join(", ")}</b></p>}
          {record.masteryUps.length > 0 && <p>숙련 상승: <b>{record.masteryUps.map((up) => `${ghostName(up.type)} ${up.level}단계`).join(", ")}</b></p>}
          {record.newTalismans.length > 0 && <p>새 부적: <b>{record.newTalismans.map((id) => TALISMAN_BY_ID[id].name).join(", ")}</b></p>}
        </section>
      )}
      {summary.talismans.length > 0 && (
        <p className="bk-note">이번 런의 부적: {summary.talismans.map((id: string) => TALISMAN_BY_ID[id]?.name ?? id).join(" · ")}</p>
      )}
      <p className="bk-question">
        한 번 더 하고 싶은가? 누적 정화 {codex.totalPurified}회. 회피가 잘 안 잡히면 시작 화면에서 회피 감도를 조절한다.
      </p>
      <div className="bk-actions">
        <button type="button" className="bk-primary" onClick={onAgain}>한 번 더</button>
        <button type="button" className="bk-secondary" onClick={onCodex}>악귀 도감</button>
        <button type="button" className="bk-secondary" onClick={onHome}>처음으로</button>
      </div>
    </main>
  );
}
