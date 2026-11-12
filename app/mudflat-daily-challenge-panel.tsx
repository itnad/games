"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MUDFLAT_DAILY_NAME_KEY,
  MUDFLAT_DAILY_PARTICIPANT_KEY,
  mudflatDailyDefaultName,
  normalizeMudflatDailyName,
} from "./mudflat-daily-challenge.js";

type DailyChallenge = { date: string; stage: number; seed: number };
type DailyLeaderboardEntry = {
  id: number;
  rank: number;
  displayName: string;
  score: number;
  caught: number;
  elapsed: number;
  remainingHp: number;
  bossCaught: boolean;
};
type DailyParticipantResult = DailyLeaderboardEntry & { completed: boolean; rank: number | null };
type DailyApiPayload = {
  challenge: DailyChallenge;
  leaderboard: DailyLeaderboardEntry[];
  participant: DailyParticipantResult | null;
  error?: string;
};

export type MudflatDailyStart = DailyChallenge & { participantId: string; displayName: string };
export type MudflatDailyResult = MudflatDailyStart & {
  completed: boolean;
  score: number;
  caught: number;
  elapsed: number;
  remainingHp: number;
  bossCaught: boolean;
  submission: "submitting" | "saved" | "failed";
  rank: number | null;
  recordImproved?: boolean;
  message?: string;
};

function createParticipantId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function getDailyIdentity() {
  let participantId = window.localStorage.getItem(MUDFLAT_DAILY_PARTICIPANT_KEY) ?? "";
  if (!participantId) {
    participantId = createParticipantId();
    window.localStorage.setItem(MUDFLAT_DAILY_PARTICIPANT_KEY, participantId);
  }
  const storedName = normalizeMudflatDailyName(window.localStorage.getItem(MUDFLAT_DAILY_NAME_KEY));
  const displayName = storedName || mudflatDailyDefaultName(participantId);
  return { participantId, displayName };
}

function formatElapsed(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

export async function submitMudflatDailyResult(result: MudflatDailyResult) {
  const response = await fetch("/api/haeru-daily", {
    method: "POST",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      participantId: result.participantId,
      displayName: result.displayName,
      stage: result.stage,
      seed: result.seed,
      score: result.score,
      caught: result.caught,
      elapsed: Math.floor(result.elapsed),
      remainingHp: Math.max(0, Math.floor(result.remainingHp)),
      bossCaught: result.bossCaught,
      completed: result.completed,
    }),
  });
  const payload = await response.json() as { participant?: DailyParticipantResult; improved?: boolean; error?: string };
  if (!response.ok || !payload.participant) throw new Error(payload.error || "기록을 저장하지 못했습니다.");
  return { participant: payload.participant, improved: payload.improved === true };
}

export function MudflatDailyChallengePanel({ onStart, hasActiveRun }: { onStart: (challenge: MudflatDailyStart) => void; hasActiveRun: boolean }) {
  const [identity, setIdentity] = useState<{ participantId: string; displayName: string } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [payload, setPayload] = useState<DailyApiPayload | null>(null);
  const [status, setStatus] = useState("오늘의 공통 갯벌을 불러오는 중입니다.");

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      let nextIdentity: { participantId: string; displayName: string };
      try { nextIdentity = getDailyIdentity(); }
      catch { setStatus("브라우저 저장 공간을 사용할 수 없어 오늘의 갯벌에 참가할 수 없습니다."); return; }
      setIdentity(nextIdentity);
      setDisplayName(nextIdentity.displayName);
      fetch(`/api/haeru-daily?participantId=${encodeURIComponent(nextIdentity.participantId)}`, { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json() as DailyApiPayload;
          if (!response.ok) throw new Error(data.error || "기록판을 불러오지 못했습니다.");
          if (!cancelled) { setPayload(data); setStatus(""); }
        })
        .catch((error) => { if (!cancelled) setStatus(error instanceof Error ? error.message : "기록판을 불러오지 못했습니다."); });
    });
    return () => { cancelled = true; window.cancelAnimationFrame(frame); };
  }, []);

  const normalizedName = useMemo(() => normalizeMudflatDailyName(displayName), [displayName]);
  const start = () => {
    if (!payload || !identity || !normalizedName) return;
    try { window.localStorage.setItem(MUDFLAT_DAILY_NAME_KEY, normalizedName); }
    catch { setStatus("참가자 이름을 저장하지 못했습니다."); return; }
    onStart({ ...payload.challenge, participantId: identity.participantId, displayName: normalizedName });
  };

  return <details className="ms-daily-card" aria-label="오늘의 갯벌 일일 이벤트">
    <summary>
      <span className="ms-daily-event-label">일일 이벤트</span>
      <span className="ms-daily-summary-copy"><b>오늘의 갯벌</b><small>{payload ? `${payload.challenge.stage}단계 · 같은 조건으로 최고 기록 도전` : "오늘의 공통 조건을 불러오는 중"}</small></span>
      {payload?.participant?.completed && <strong>{payload.participant.score.toLocaleString()}점</strong>}
      <i aria-hidden="true">⌄</i>
    </summary>
    <div className="ms-daily-content">
      <p>같은 단계·장비·환경에 횟수 제한 없이 도전하고, 가장 좋은 귀환 기록을 통합 순위에 남깁니다.</p>
      {payload && <small className="ms-daily-date">{payload.challenge.date.replaceAll("-", ".")} · STAGE {payload.challenge.stage}</small>}
      <div className="ms-daily-entry">
        <label><span>기록 이름</span><input value={displayName} maxLength={12} onChange={(event) => setDisplayName(event.target.value)} aria-label="오늘의 갯벌 기록 이름" /></label>
        <button type="button" onClick={start} disabled={!payload || !identity || !normalizedName}>{payload?.participant ? "다시 도전 →" : "이벤트 출정 →"}</button>
      </div>
      {hasActiveRun && <p className="ms-daily-preserve">진행 중인 일반 원정 저장은 그대로 유지됩니다.</p>}
      {payload?.participant && <div className={`ms-daily-own${payload.participant.completed ? " is-clear" : ""}`}>
        <span>{payload.participant.completed ? `${payload.participant.rank ? `${payload.participant.rank}위` : "순위 집계 중"}` : "재도전 가능"}</span>
        <b>{payload.participant.completed ? `${payload.participant.score.toLocaleString()}점` : "아직 귀환 기록 없음"}</b>
        <small>{payload.participant.completed ? `채집 ${payload.participant.caught} · ${formatElapsed(payload.participant.elapsed)}` : "귀환에 성공하면 최고 기록이 등록됩니다."}</small>
      </div>}
      {status && <p className="ms-daily-status" role="status">{status}</p>}
      <details className="ms-daily-ranking">
        <summary><span><small>LIVE RANKING</small><b>오늘의 통합 순위</b></span><i>⌄</i></summary>
        {payload?.leaderboard.length ? <ol>{payload.leaderboard.map((entry) => <li key={entry.id} className={entry.rank <= 3 ? `rank-${entry.rank}` : undefined}>
          <em>{entry.rank}</em><span><b>{entry.displayName}</b><small>채집 {entry.caught} · {formatElapsed(entry.elapsed)}</small></span><strong>{entry.score.toLocaleString()}</strong>
        </li>)}</ol> : <p>아직 귀환에 성공한 기록이 없습니다. 오늘의 첫 기록을 남겨보세요.</p>}
      </details>
    </div>
  </details>;
}

export function MudflatDailyResultPanel({ result, onBack, onRetrySubmit }: { result: MudflatDailyResult; onBack: () => void; onRetrySubmit: () => void }) {
  const [shareStatus, setShareStatus] = useState("");
  const shareText = `해루질럿 오늘의 갯벌 ${result.stage}단계\n${result.completed ? `${result.score.toLocaleString()}점 · 채집 ${result.caught}마리${result.recordImproved && result.rank ? ` · ${result.rank}위` : ""}` : `채집 ${result.caught}마리 · 귀환 실패`}\n같은 갯벌에 도전해보세요!`;
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "해루질럿 오늘의 갯벌", text: shareText, url: `${window.location.origin}/haeru` });
      else { await navigator.clipboard.writeText(`${shareText}\n${window.location.origin}/haeru`); setShareStatus("공유 문구를 복사했습니다."); }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("공유하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  return <main className="ms-shell ms-daily-result">
    <section className={`ms-daily-result-card${result.completed ? " is-clear" : " is-failed"}`}>
      <small>DAILY MUDFLAT · {result.date.replaceAll("-", ".")}</small>
      <h1>{result.completed ? "오늘의 갯벌 귀환 성공" : "오늘의 갯벌 도전 종료"}</h1>
      <p>{result.completed ? "같은 조건에서 도전한 해루질꾼들과 기록을 비교해 보세요." : "귀환에는 실패했지만 오늘의 채집 기록은 남았습니다."}</p>
      <div className="ms-daily-result-score"><span>{result.submission !== "saved" ? "기록 중" : result.recordImproved ? result.rank ? `${result.rank}위` : "최고 기록 갱신" : "기존 최고 유지"}</span><b>{result.completed ? result.score.toLocaleString() : "–"}<em>{result.completed ? "점" : "귀환 실패"}</em></b></div>
      <div className="ms-daily-result-grid">
        <span><small>도전 단계</small><b>{result.stage}</b></span>
        <span><small>채집</small><b>{result.caught}마리</b></span>
        <span><small>원정 시간</small><b>{formatElapsed(result.elapsed)}</b></span>
        <span><small>남은 체력</small><b>{Math.floor(result.remainingHp)}</b></span>
      </div>
      <div className="ms-daily-submit-state" role="status">
        {result.submission === "submitting" && "오늘의 기록판에 등록하는 중입니다."}
        {result.submission === "saved" && (result.recordImproved ? "오늘의 최고 기록이 통합 순위에 반영되었습니다." : result.completed ? "기존 최고 기록이 통합 순위에 유지됩니다." : "언제든 다시 도전해 귀환 기록을 남길 수 있습니다.")}
        {result.submission === "failed" && <><span>{result.message || "기록을 등록하지 못했습니다."}</span><button type="button" onClick={onRetrySubmit}>다시 등록</button></>}
      </div>
      <div className="ms-daily-result-actions"><button type="button" onClick={share}>결과 공유</button><button type="button" onClick={onBack}>해루질럿 메인</button></div>
      {shareStatus && <p className="ms-daily-share-status" role="status">{shareStatus}</p>}
    </section>
  </main>;
}
