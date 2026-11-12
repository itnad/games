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
  correctInputBeat,
  nearestBeatOffset,
  timeOfBeat,
} from "./beat-clock.js";
import {
  AIM_ASSIST_RADIUS_DEG,
  angularDistanceDeg,
  lanternVisibility,
  orientationToAim,
  projectToScreen,
  wrapDegrees,
} from "./aim-projection.js";
import {
  DODGE_GESTURES,
  DODGE_GESTURE_LABELS,
  DODGE_THRESHOLD_RANGE,
  createDodgeDetector,
  createWalkDetector,
} from "./dodge-detector.js";
import { GHOST_TYPES, PURIFY_WINDOW_BEATS, STAGE_ZERO_BARS, createStageZeroChart } from "./baksal-chart.js";
import {
  advanceRun,
  createRun,
  cuesBetween,
  dodgeRun,
  projectilePosition,
  purifyRun,
  shootRun,
  summarizeRun,
} from "./baksal-engine.js";
import { createBaksalAudio } from "./baksal-audio.js";
import { DEFAULT_BAKSAL_SETTINGS, normalizeBaksalSettings, readBaksalSettings, writeBaksalSettings } from "./baksal-settings.js";
import { createMudflatSeed } from "../mudflat-rng.js";
import { withKoreanSubject } from "../korean-particles.js";
import { GESTURE_HINTS, drawFrame, type Frame, type FrameFlash, type FrameGhost, type FrameProjectile } from "./baksal-render";

type Screen = "start" | "calibrate" | "run" | "result";
type Settings = ReturnType<typeof normalizeBaksalSettings>;
type Audio = ReturnType<typeof createBaksalAudio>;
type Aim = { yaw: number; pitch: number };
type Orientation = { yaw: number; pitch: number; t: number } | null;
type GestureListener = (gesture: string, t: number) => void;
type RunSummary = ReturnType<typeof summarizeRun>;
type Clock = { bpm: number; startTime: number };
type RunProjectile = { id: string; ghostId: string; kind: string; gesture: string; fireBeat: number; arriveBeat: number; status: string };

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

export function BaksalPrototype() {
  const [screen, setScreen] = useState<Screen>("start");
  const [settings, setSettings] = useState<Settings>(() => normalizeBaksalSettings(DEFAULT_BAKSAL_SETTINGS));
  const [sensors, setSensors] = useState<SensorState>({ gyro: null, motion: null, camera: "pending" });
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<{ summary: RunSummary; rotation: number; runIndex: number } | null>(null);
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
        const sample = { t: event.timeStamp, x: gravity.x, y: gravity.y, z: gravity.z };
        detected = detectorRef.current.pushWithGravity(sample);
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
      setSensors((previous) => ({
        ...previous,
        gyro: previous.gyro ?? sawOrientation,
        motion: previous.motion ?? sawMotion,
      }));
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
    setResult({ summary, rotation, runIndex });
    setScreen("result");
  }, [settings.runsPlayed, updateSettings]);

  const fixedStance = settings.fixedStance || sensors.gyro === false;

  return (
    <div className="bk-root">
      <div className="bk-portrait">
        {screen === "start" && (
          <StartScreen
            settings={settings}
            sensors={sensors}
            starting={starting}
            onChange={updateSettings}
            onStart={beginSession}
            onRecalibrate={() => updateSettings({ offsetMs: null })}
          />
        )}
        {screen === "calibrate" && audio && (
          <CalibrationScreen
            audio={audio}
            bpm={settings.bpm}
            onDone={(offsetMs) => {
              updateSettings({ offsetMs });
              startRun();
            }}
            onSkip={() => {
              updateSettings({ offsetMs: 0 });
              startRun();
            }}
          />
        )}
        {screen === "run" && audio && (
          <RunScreen
            key={runKey}
            audio={audio}
            stream={stream}
            settings={settings}
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
            onAgain={startRun}
            onRecalibrate={() => setScreen("calibrate")}
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

function StartScreen({ settings, sensors, starting, onChange, onStart, onRecalibrate }: {
  settings: Settings;
  sensors: SensorState;
  starting: boolean;
  onChange: (patch: Partial<Settings>) => void;
  onStart: () => void;
  onRecalibrate: () => void;
}) {
  return (
    <main className="bk-panel">
      <span className="bk-stage-tag">0단계 재미 검증 · 방 1개</span>
      <header className="bk-brand">
        <small>BAKSAL: BEAT THE GHOSTS</small>
        <h1>박<em>살</em></h1>
        <p>리듬 AR 퇴마 댄싱 · <b>박자로 악귀를 박살내다</b></p>
      </header>

      <section className="bk-card">
        <h2>이렇게 합니다</h2>
        <ul>
          <li>폰을 세워 들면 카메라 위에 악귀가 나타납니다. <b>몸을 돌려</b> 조준점에 맞춥니다.</li>
          <li>딱딱이 박자에 맞춰 <b>화면 아무 곳을 탭</b>하면 소금총이 나갑니다. 정박이면 <b>딱</b>, 피해 2배.</li>
          <li>악귀가 1박에 예고하고 3박(돌진은 4박)에 도착합니다. 도착 박에 <b>몸과 폰을 함께</b> 숙이거나, 옆으로, 뒤로 피합니다.</li>
          <li>쓰러진 악귀는 <b>마디 첫 박</b>에 조준한 채 길게 눌러 정화합니다.</li>
          <li>주변 1m를 비우고, 한 발 이내로만 움직입니다. 이어폰을 권장합니다.</li>
        </ul>
      </section>

      <section className="bk-card">
        <div className="bk-field">
          <span>템포 <small>{settings.bpm} BPM</small></span>
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
            <span>고정 자세 모드<small>드래그로 조준하고 회피는 버튼으로 합니다. 자이로가 없으면 자동으로 켜집니다.</small></span>
            <i aria-hidden="true" />
          </button>
        </div>
      </section>

      <div className="bk-actions">
        <button type="button" className="bk-primary" disabled={starting} onClick={onStart}>
          {starting ? "권한을 확인하는 중" : settings.offsetMs === null ? "권한 허용하고 보정 시작" : "권한 허용하고 시작"}
        </button>
        {settings.offsetMs !== null && (
          <button type="button" className="bk-secondary" onClick={onRecalibrate}>
            지연 보정 다시 하기 (현재 {settings.offsetMs > 0 ? "+" : ""}{settings.offsetMs}ms)
          </button>
        )}
      </div>
      {sensors.camera === "denied" && <p className="bk-note warn">카메라를 쓸 수 없어 어두운 배경으로 진행합니다. 게임 규칙은 같습니다.</p>}
      {sensors.gyro === false && <p className="bk-note warn">방향 센서를 읽을 수 없어 고정 자세 모드로 진행합니다.</p>}
      <p className="bk-note">카메라 영상은 기기 밖으로 나가지 않습니다. 위치 정보는 쓰지 않습니다. 지금까지 {settings.runsPlayed}런을 했습니다.</p>
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
  const clockRef = useRef<Clock | null>(null);
  const tapsRef = useRef<number[]>([]);

  useEffect(() => {
    const clock: Clock = { bpm, startTime: audio.now() + 0.4 };
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

function RunScreen({ audio, stream, settings, fixedStance, motionAvailable, orientationRef, gestureListenerRef, motionListenerRef, onFinish, onExit }: {
  audio: Audio;
  stream: MediaStream | null;
  settings: Settings;
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
  const [hud, setHud] = useState({ bar: 0, score: 0, combo: 0, hp: 5, message: "" });
  const [paused, setPaused] = useState<null | "manual" | "walk" | "down" | "hidden">(null);
  const pausedRef = useRef<null | "manual" | "walk" | "down" | "hidden">(null);
  const pausedAtRef = useRef(0);

  const runtime = useRef<{
    clock: Clock;
    run: ReturnType<typeof createRun>;
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
    return correctInputBeat(beatAtTime(audioTime, state.clock), state.clock.bpm, settings.offsetMs ?? 0);
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

  const shootAt = useCallback((audioTime: number) => {
    const state = runtime.current;
    if (!state || pausedRef.current) return;
    const beat = correctedBeat(audioTime);
    if (beat < 0) return;
    const result = shootRun(state.run, beat, aimNow());
    audio.shot(audio.now());
    if (result.hit) {
      flashJudgment(result.judgment);
      audio.judgment(audio.now() + 0.02, result.judgment);
      if (result.destroyed) flashAction("격파!", "#9be7ff");
      if (result.killed) flashAction("정화 가능", "#dcc8ff");
    }
  }, [aimNow, audio, correctedBeat, flashAction, flashJudgment]);

  const purifyAt = useCallback((audioTime: number) => {
    const state = runtime.current;
    if (!state || pausedRef.current) return;
    const result = purifyRun(state.run, correctedBeat(audioTime), aimNow());
    if (result.ok) {
      audio.purified(audio.now());
      flashAction(`${withKoreanSubject(result.name)} 봉인됐다`, "#dcc8ff");
      flashJudgment(result.judgment);
    } else if (result.reason === "beat") {
      flashAction("첫 박에 다시", "#ff8c8c");
    }
  }, [aimNow, audio, correctedBeat, flashAction, flashJudgment]);

  const dodgeAt = useCallback((gesture: string, audioTime: number) => {
    const state = runtime.current;
    if (!state || pausedRef.current) return;
    const result = dodgeRun(state.run, correctedBeat(audioTime), gesture);
    if (result.matched) {
      audio.dodged(audio.now());
      flashAction(`${DODGE_GESTURE_LABELS[gesture as keyof typeof DODGE_GESTURE_LABELS]} 성공`, "#9bffb0");
      state.hint = null;
    } else if (result.reason === "wrong-gesture") {
      flashAction(`${GESTURE_HINTS[result.expected] ?? ""}`, "#ff8c8c");
    }
  }, [audio, correctedBeat, flashAction]);

  const purifiableInAim = useCallback(() => {
    const state = runtime.current;
    if (!state) return false;
    const aim = aimNow();
    return state.run.ghosts.some((ghost: { status: string; azimuth: number; elevation: number }) => ghost.status === "purifiable" && angularDistanceDeg(aim, ghost) <= AIM_ASSIST_RADIUS_DEG);
  }, [aimNow]);

  const pauseRun = useCallback((reason: "manual" | "walk" | "down" | "hidden") => {
    if (pausedRef.current || !runtime.current || runtime.current.finishedAt !== null) return;
    pausedRef.current = reason;
    pausedAtRef.current = audio.now();
    setPaused(reason);
  }, [audio]);

  const resumeRun = useCallback(() => {
    const state = runtime.current;
    if (!pausedRef.current || !state) return;
    const pausedFor = audio.now() - pausedAtRef.current;
    state.clock = { ...state.clock, startTime: state.clock.startTime + pausedFor };
    pausedRef.current = null;
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
    const chart = createStageZeroChart(createMudflatSeed(), { bpm: settings.bpm });
    const run = createRun(chart, { windows: settings.windows });
    runtime.current = {
      clock: { bpm: settings.bpm, startTime: audio.now() + 0.5 },
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
      message: { text: "주변 1m를 비우고 폰을 세워 주세요", until: performance.now() + 3000 },
      finishedAt: null,
      downSince: null,
      drag: null,
      holdTimer: null,
      hudAt: 0,
    };
    pausedRef.current = null;
    setPaused(null);

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
      if (!state || pausedRef.current || state.finishedAt !== null) return;
      const horizon = audio.now() + LOOKAHEAD_SECONDS;
      const aim = aimNow();
      while (timeOfBeat(state.nextBeat, state.clock) < horizon) {
        const beat = state.nextBeat;
        const at = timeOfBeat(beat, state.clock);
        if (beat <= state.run.chart.lengthBeats + BEATS_PER_BAR) {
          audio.metronome(at, ((beat % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR === 0);
        }
        for (const cue of cuesBetween(state.run, beat, beat + 1)) {
          const cueAt = timeOfBeat(cue.beat, state.clock);
          const relative = wrapDegrees(cue.azimuth - aim.yaw);
          if (cue.type === "spawn") audio.spawn(cueAt, relative);
          else if (cue.type === "fire") audio.cue(cueAt, cue.gesture, relative);
          else if (cue.type === "arrive") audio.arrive(cueAt, cue.gesture, relative);
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
      const beat = beatAtTime(audioNow, state.clock);

      if (!pausedRef.current && state.finishedAt === null) {
        if (!fixedStance && orientationRef.current) {
          if (aim.pitch < -60) {
            if (state.downSince === null) state.downSince = audioNow;
            else if (audioNow - state.downSince > 60 / state.clock.bpm) pauseRun("down");
          } else {
            state.downSince = null;
          }
        }
        for (const event of advanceRun(state.run, beat)) {
          if (event.type === "cue") {
            const projectile = (state.run.projectiles as RunProjectile[]).find((candidate) => candidate.id === event.projectileId);
            state.hint = { gesture: event.gesture, until: projectile?.arriveBeat ?? beat + 2 };
          } else if (event.type === "player-hit") {
            audio.playerHit(audioNow);
            state.hitFlashAt = now;
            state.hint = null;
            flashJudgment("miss");
            if (navigator.vibrate) navigator.vibrate(120);
          } else if (event.type === "spawn") {
            showMessage(`${withKoreanSubject(event.name)} 나타났다`);
          } else if (event.type === "purify-expired") {
            showMessage(`${withKoreanSubject(event.name)} 사라졌다. 정화를 놓쳤다`);
          } else if (event.type === "leave") {
            showMessage(`${withKoreanSubject(event.name)} 물러났다`);
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

      const ghosts: FrameGhost[] = [];
      for (const ghost of state.run.ghosts) {
        if (ghost.status !== "alive" && ghost.status !== "purifiable") continue;
        const projected = projectToScreen(aim, ghost, width, height);
        const spec = GHOST_TYPES[ghost.type as keyof typeof GHOST_TYPES];
        ghosts.push({
          id: ghost.id,
          type: ghost.type,
          name: ghost.name,
          color: spec?.color ?? "#fff",
          x: projected.x,
          y: projected.y,
          onScreen: projected.onScreen,
          dYaw: projected.dYaw,
          scale: projected.scale,
          visibility: lanternVisibility(aim, ghost),
          status: ghost.status,
          hp: ghost.hp,
          maxHp: ghost.maxHp,
          purifyRemaining: ghost.status === "purifiable" ? Math.max(0, (ghost.purifiableUntil - beat) / PURIFY_WINDOW_BEATS) : null,
        });
      }
      const projectiles: FrameProjectile[] = [];
      for (const projectile of state.run.projectiles as RunProjectile[]) {
        if (projectile.status !== "flying") continue;
        const position = projectilePosition(state.run, projectile, beat);
        const projected = projectToScreen(aim, position, width, height);
        projectiles.push({ id: projectile.id, gesture: projectile.gesture, kind: projectile.kind, x: projected.x, y: projected.y, onScreen: projected.onScreen, progress: position.progress, dYaw: projected.dYaw });
      }
      const frame: Frame = {
        now,
        beat,
        beatPhase: beat - Math.floor(beat),
        countIn: beat < 0 && !pausedRef.current ? Math.min(COUNT_IN_BEATS, Math.ceil(-beat)) : null,
        ghosts,
        projectiles,
        hint: state.hint && beat < state.hint.until + 0.2 ? state.hint : null,
        judgment: state.judgment,
        action: state.action,
        hitFlashAt: state.hitFlashAt,
        paused: Boolean(pausedRef.current),
      };
      drawFrame(context, width, height, frame);

      if (now - state.hudAt > 100) {
        state.hudAt = now;
        setHud({
          bar: Math.min(STAGE_ZERO_BARS, Math.max(0, Math.floor(beat / BEATS_PER_BAR) + 1)),
          score: state.run.score,
          combo: state.run.combo,
          hp: state.run.hp,
          message: state.message && state.message.until > now ? state.message.text : "",
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
  }, [aimNow, audio, dodgeAt, fixedStance, flashJudgment, gestureListenerRef, motionListenerRef, onFinish, orientationRef, pauseRun, resumeRun, settings.bpm, settings.windows, showMessage]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = runtime.current;
    if (!state || pausedRef.current) return;
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
    if (fixedStance && !drag.moved && !pausedRef.current) {
      if (purifiableInAim()) {
        if (eventAudioTime(audio, event.timeStamp) - drag.t >= HOLD_MS / 1000) purifyAt(drag.t);
      } else {
        shootAt(drag.t);
      }
    }
  };

  const pauseCopy: Record<NonNullable<typeof paused>, { title: string; body: string }> = {
    manual: { title: "잠시 멈춤", body: "준비되면 이어서 합니다. 박자는 멈춘 자리에서 다시 흐릅니다." },
    walk: { title: "멈춰서 플레이하세요", body: "걷는 움직임이 감지됐습니다. 제자리에 서서 이어 주세요." },
    down: { title: "폰을 들어 주세요", body: "폰을 내려놓아 멈췄습니다. 다시 세워 들면 이어집니다." },
    hidden: { title: "잠시 멈춤", body: "화면을 벗어나 멈췄습니다." },
  };

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
            {Array.from({ length: 5 }, (_, index) => <i key={index} className={index < hud.hp ? "on" : ""}>♥</i>)}
          </div>
          <strong>{hud.bar}/{STAGE_ZERO_BARS}마디 · {hud.score}점{hud.combo >= 2 ? ` · ${hud.combo}콤보` : ""}</strong>
          {hud.message && <span>{hud.message}</span>}
        </div>
        <button type="button" aria-label="잠시 멈춤" onClick={() => pauseRun("manual")}>❚❚</button>
      </div>
      <div className="bk-bottom">
        {fixedStance || !motionAvailable ? (
          <div className="bk-dodge-pad" role="group" aria-label="회피 동작">
            {DODGE_GESTURES.map((gesture) => (
              <button key={gesture} type="button" onPointerDown={(event) => { event.stopPropagation(); dodgeAt(gesture, eventAudioTime(audio, event.timeStamp)); }}>
                {DODGE_GESTURE_LABELS[gesture as keyof typeof DODGE_GESTURE_LABELS]}
              </button>
            ))}
          </div>
        ) : null}
        <span className="bk-fire-hint">{fixedStance ? "끌어서 조준 · 탭하면 발사" : "화면 전체가 발사 · 몸을 돌려 조준"}</span>
      </div>
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

function ResultScreen({ result, settings, onAgain, onRecalibrate, onHome }: {
  result: { summary: RunSummary; rotation: number; runIndex: number };
  settings: Settings;
  onAgain: () => void;
  onRecalibrate: () => void;
  onHome: () => void;
}) {
  const { summary, rotation, runIndex } = result;
  const dodgeTotal = summary.dodges.ok + summary.dodges.fail;
  return (
    <main className="bk-panel">
      <span className="bk-stage-tag">{runIndex}번째 런 · {settings.bpm} BPM · {settings.windows === "lenient" ? "넉넉한 판정" : "표준 판정"}</span>
      <header className="bk-score">
        <small>{summary.failed ? "쓰러졌다" : "밤을 지켰다"}</small>
        <b>{summary.score}</b>
        <span>최대 {summary.maxCombo}콤보 · 체력 {summary.hp}/5</span>
      </header>
      <section className="bk-result-grid" aria-label="판정 요약">
        <span><small>딱</small><b>{summary.counts.ttak}</b></span>
        <span><small>좋아</small><b>{summary.counts.joa}</b></span>
        <span><small>놓침</small><b>{summary.counts.miss}</b></span>
        <span><small>회피 성공</small><b>{summary.dodges.ok}<em>/{dodgeTotal}</em></b></span>
        <span><small>격파</small><b>{summary.destroyed}</b></span>
        <span><small>정화</small><b>{summary.purified}<em>/{summary.purified + summary.missedPurify}</em></b></span>
        <span><small>발사</small><b>{summary.shotsFired}</b></span>
        <span><small>딱 비율</small><b>{Math.round(summary.ttakRate * 100)}<em>%</em></b></span>
        <span><small>회전</small><b>{Math.round(rotation)}<em>°</em></b></span>
      </section>
      <p className="bk-question">
        0단계 질문: <b>한 번 더 하고 싶은가?</b> 10런 뒤에도 그렇다면 1단계로 간다. 회피가 잘 안 잡히면 시작 화면에서 회피 감도를 조절한다.
      </p>
      <div className="bk-actions">
        <button type="button" className="bk-primary" onClick={onAgain}>한 번 더</button>
        <button type="button" className="bk-secondary" onClick={onRecalibrate}>지연 보정 다시</button>
        <button type="button" className="bk-secondary" onClick={onHome}>처음으로</button>
      </div>
    </main>
  );
}
