"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatTenSeconds, judgeTenSeconds, summarizeTenSeconds } from "./ten-seconds-engine.js";

type ExitProps = { onExit: () => void };
type TimerMode = "practice" | "sense" | "blackout";
type SessionMode = "single" | "challenge";
type Phase = "setup" | "ready" | "running" | "result" | "complete";

const RECORD_KEY = "paperoid-ten-seconds-records-v1";
const HISTORY_KEY = "paperoid-ten-seconds-history-v1";
const MODES: Array<{ id: TimerMode; name: string; icon: string; description: string }> = [
  { id: "practice", name: "연습", icon: "◷", description: "10초까지 시간이 계속 보입니다." },
  { id: "sense", name: "감각", icon: "◐", description: "7초부터 숫자가 사라집니다." },
  { id: "blackout", name: "암전", icon: "●", description: "시작과 동시에 시간이 숨겨집니다." },
];

function recordKey(session: SessionMode, mode: TimerMode) { return `${session}-${mode}`; }

export function TenSecondsGame({ onExit }: ExitProps) {
  const [mode, setMode] = useState<TimerMode>("sense");
  const [session, setSession] = useState<SessionMode>("single");
  const [phase, setPhase] = useState<Phase>("setup");
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [rounds, setRounds] = useState<number[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [records, setRecords] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<number[]>([]);
  const [sound, setSound] = useState(true);
  const [haptic, setHaptic] = useState(true);
  const startedAt = useRef(0);
  const stopping = useRef(false);

  useEffect(() => {
    try {
      setRecords(JSON.parse(window.localStorage.getItem(RECORD_KEY) ?? "{}"));
      setHistory(JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]").filter((item: unknown) => typeof item === "number").slice(0, 8));
    } catch { setRecords({}); setHistory([]); }
  }, []);

  const tone = useCallback((frequency: number, duration = 70) => {
    if (!sound) return;
    try {
      const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.06, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration / 1000);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration / 1000);
      window.setTimeout(() => void context.close(), duration + 80);
    } catch { /* Sound is optional. */ }
  }, [sound]);

  const saveRecord = useCallback((key: string, error: number) => {
    setRecords((current) => {
      if (current[key] !== undefined && current[key] <= error) return current;
      const next = { ...current, [key]: error };
      window.localStorage.setItem(RECORD_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const stop = useCallback((wasInvalid = false) => {
    if (phase !== "running" || stopping.current) return;
    stopping.current = true;
    if (wasInvalid) {
      setInvalid(true); setPhase("result"); return;
    }
    const value = performance.now() - startedAt.current;
    setElapsed(value);
    setRounds((current) => [...current, value]);
    setHistory((current) => {
      const next = [value, ...current].slice(0, 8);
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
    if (session === "single") saveRecord(recordKey(session, mode), Math.abs(value - 10_000));
    if (haptic && "vibrate" in navigator) navigator.vibrate(Math.abs(value - 10_000) <= 100 ? [35, 30, 70] : 35);
    tone(Math.abs(value - 10_000) <= 100 ? 880 : 330, 120);
    setPhase("result");
  }, [haptic, mode, phase, saveRecord, session, tone]);

  useEffect(() => {
    if (phase !== "ready") return;
    const timer = window.setTimeout(() => {
      if (countdown > 1) { setCountdown((value) => value - 1); tone(480 + countdown * 70); return; }
      stopping.current = false;
      startedAt.current = performance.now();
      setElapsed(0);
      setInvalid(false);
      tone(780, 100);
      setPhase("running");
    }, 800);
    return () => window.clearTimeout(timer);
  }, [countdown, phase, tone]);

  useEffect(() => {
    if (phase !== "running") return;
    let frame = 0;
    const tick = (now: number) => {
      const value = now - startedAt.current;
      setElapsed(value);
      if (value >= 30_000) { stop(false); return; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [phase, stop]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      if (phase === "running") { event.preventDefault(); stop(false); }
    };
    const visibility = () => { if (document.hidden && phase === "running") stop(true); };
    window.addEventListener("keydown", keydown);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("keydown", keydown); document.removeEventListener("visibilitychange", visibility); };
  }, [phase, stop]);

  const beginRound = () => { setCountdown(3); setElapsed(0); setInvalid(false); stopping.current = false; tone(520); setPhase("ready"); };
  const beginSession = () => { setRounds([]); beginRound(); };
  const reset = () => { setRounds([]); setElapsed(0); setInvalid(false); setPhase("setup"); };
  const finishChallenge = () => {
    const summary = summarizeTenSeconds(rounds);
    saveRecord(recordKey("challenge", mode), summary.averageError);
    setPhase("complete");
  };

  const currentJudge = useMemo(() => judgeTenSeconds(rounds.at(-1) ?? elapsed), [elapsed, rounds]);
  const summary = useMemo(() => summarizeTenSeconds(rounds), [rounds]);
  const visibleTimer = mode === "practice" || (mode === "sense" && elapsed < 7_000);
  const best = records[recordKey(session, mode)];
  const roundNumber = Math.min(5, rounds.length + (phase === "result" ? 0 : 1));

  return <main className={`ts-shell mode-${mode} phase-${phase}`}><header className="ts-topbar"><button type="button" onClick={onExit} aria-label="게임 목록으로">←</button><div><small>paperoid · REFLEX</small><strong>10.00</strong></div><button type="button" onClick={reset}>설정</button></header>{phase === "setup" ? <section className="ts-setup"><div className="ts-hero"><small>FEEL THE MOMENT</small><h1>10<span>.</span>00</h1><p>시간 감각만으로 정확히 10초를 맞춰보세요.<br />화면을 터치하거나 스페이스바를 누르면 멈춥니다.</p><div className="ts-best"><span>선택 모드 최고 기록</span><b>{best === undefined ? "—" : `±${(best / 1000).toFixed(3)}초`}</b></div></div><div className="ts-options"><section><header><span>01</span><div><b>시간 표시 방식</b><small>난이도를 선택하세요</small></div></header><div className="ts-mode-grid" role="radiogroup" aria-label="시간 표시 방식">{MODES.map((item) => <button type="button" role="radio" aria-checked={mode === item.id} className={mode === item.id ? "selected" : ""} key={item.id} onClick={() => setMode(item.id)}><i>{item.icon}</i><span><b>{item.name}</b><small>{item.description}</small></span></button>)}</div></section><section><header><span>02</span><div><b>게임 방식</b><small>한 번 또는 다섯 번 도전합니다</small></div></header><div className="ts-session-switch"><button type="button" className={session === "single" ? "selected" : ""} onClick={() => setSession("single")}><b>단판</b><small>한 번의 감각에 집중</small></button><button type="button" className={session === "challenge" ? "selected" : ""} onClick={() => setSession("challenge")}><b>5라운드</b><small>평균 오차로 승부</small></button></div></section><div className="ts-setting-row"><label><input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} /> 효과음</label><label><input type="checkbox" checked={haptic} onChange={(event) => setHaptic(event.target.checked)} /> 진동</label></div><button className="ts-primary" type="button" onClick={beginSession}>도전 시작 <span>→</span></button></div>{history.length > 0 && <section className="ts-history"><header><b>최근 기록</b><span>10초와의 오차</span></header><div>{history.slice(0, 6).map((item, index) => { const judged = judgeTenSeconds(item); return <span key={index} className={judged.absoluteError <= 100 ? "great" : ""}><i style={{ height: `${Math.max(8, 60 - Math.min(52, judged.absoluteError / 15))}px` }} /><b>{formatTenSeconds(judged.difference, true)}</b></span>; })}</div></section>}</section> : phase === "complete" ? <section className="ts-complete"><small>5 ROUND CHALLENGE</small><h1>평균 오차<br /><b>±{(summary.averageError / 1000).toFixed(3)}초</b></h1><p>가장 정확한 기록은 ±{(summary.bestError / 1000).toFixed(3)}초입니다.</p><div className="ts-round-summary">{rounds.map((item, index) => { const judged = judgeTenSeconds(item); return <span key={index}><small>{index + 1}R</small><b>{(item / 1000).toFixed(3)}</b><em>{formatTenSeconds(judged.difference, true)}</em></span>; })}</div><div className="ts-complete-score"><span>평균 점수</span><b>{summary.averageScore.toLocaleString()}점</b></div><div className="ts-result-actions"><button type="button" onClick={reset}>모드 변경</button><button className="ts-primary" type="button" onClick={beginSession}>다시 도전</button></div></section> : <section className="ts-play"><header><span>{session === "challenge" ? `${roundNumber} / 5 ROUND` : MODES.find((item) => item.id === mode)?.name}</span><b>{phase === "ready" ? "준비하세요" : phase === "running" ? "지금 흐르고 있습니다" : invalid ? "이번 기록은 무효입니다" : currentJudge.rating}</b></header><button className="ts-stage" type="button" onPointerDown={() => phase === "running" && stop(false)} disabled={phase !== "running"} aria-label={phase === "running" ? "초시계 멈추기" : "초시계 화면"}>{phase === "ready" ? <div className="ts-countdown"><span>{countdown}</span><small>곧 시작합니다</small></div> : phase === "running" ? <div className="ts-running"><div className="ts-pulse"><i /><i /><i /></div><span className={visibleTimer ? "visible" : "hidden"}>{visibleTimer ? `${(elapsed / 1000).toFixed(3)}` : "—.———"}</span><small>{visibleTimer ? "SECONDS" : "시간을 느껴보세요"}</small><b>화면 터치 · SPACE</b></div> : <div className="ts-result-view"><small>{invalid ? "INVALID ROUND" : "YOUR TIME"}</small><span>{invalid ? "—.———" : (currentJudge.elapsed / 1000).toFixed(3)}</span>{invalid ? <p>플레이 중 화면을 벗어나 기록을 판정하지 않았습니다.</p> : <><b className={Math.abs(currentJudge.difference) <= 100 ? "great" : ""}>{formatTenSeconds(currentJudge.difference, true)}</b><p>{currentJudge.difference < 0 ? "조금 빨랐어요" : currentJudge.difference > 0 ? "조금 늦었어요" : "정확히 맞췄습니다"}</p></>}</div>}</button>{phase === "result" && <div className="ts-result-panel">{!invalid && <div><span><small>점수</small><b>{currentJudge.score.toLocaleString()}</b></span><span><small>오차</small><b>{(currentJudge.absoluteError / 1000).toFixed(3)}초</b></span><span><small>등급</small><b>{currentJudge.rating}</b></span></div>}<div className="ts-result-actions"><button type="button" onClick={reset}>모드 변경</button>{invalid ? <button className="ts-primary" type="button" onClick={beginRound}>다시 시작</button> : session === "single" ? <button className="ts-primary" type="button" onClick={() => { setRounds([]); beginRound(); }}>다시 도전</button> : rounds.length >= 5 ? <button className="ts-primary" type="button" onClick={finishChallenge}>최종 결과</button> : <button className="ts-primary" type="button" onClick={beginRound}>다음 라운드</button>}</div></div>}</section>}</main>;
}
