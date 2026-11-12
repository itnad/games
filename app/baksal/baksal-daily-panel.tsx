"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BAKSAL_DAILY_NAME_KEY,
  BAKSAL_DAILY_NAME_MAX,
  BAKSAL_DAILY_PARTICIPANT_KEY,
  baksalDailyDefaultName,
  normalizeBaksalDailyName,
} from "./baksal-daily.js";

export type BaksalDailyChallenge = { date: string; seed: number; bpm: number; reinforced: boolean };
export type BaksalBarrier = { total: number; target: number; ratio: number; holding: boolean; participants?: number };
export type BaksalDailyEntry = {
  id: number;
  rank: number;
  displayName: string;
  score: number;
  roomsCleared: number;
  maxCombo: number;
  remainingHp: number;
  purified: number;
  completed: boolean;
  lenient: boolean;
};
export type BaksalDailyBoard = {
  challenge: BaksalDailyChallenge;
  barrier: BaksalBarrier;
  yesterday: BaksalBarrier;
  leaderboard: BaksalDailyEntry[];
  participant: BaksalDailyEntry | null;
};
export type BaksalDailyIdentity = { participantId: string; displayName: string };
export type BaksalDailySubmission = {
  status: "submitting" | "saved" | "failed";
  improved?: boolean;
  participant?: BaksalDailyEntry | null;
  barrier?: BaksalBarrier;
  message?: string;
};
export type BaksalDailyPayload = {
  score: number;
  roomsCleared: number;
  maxCombo: number;
  remainingHp: number;
  purified: number;
  dodges: number;
  ttak: number;
  judged: number;
  completed: boolean;
  lenient: boolean;
};

function createParticipantId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function readBaksalDailyIdentity(): BaksalDailyIdentity {
  let participantId = "";
  let storedName = "";
  try {
    participantId = window.localStorage.getItem(BAKSAL_DAILY_PARTICIPANT_KEY) ?? "";
    if (!participantId) {
      participantId = createParticipantId();
      window.localStorage.setItem(BAKSAL_DAILY_PARTICIPANT_KEY, participantId);
    }
    storedName = normalizeBaksalDailyName(window.localStorage.getItem(BAKSAL_DAILY_NAME_KEY));
  } catch {
    participantId ||= createParticipantId();
  }
  return { participantId, displayName: storedName || baksalDailyDefaultName(participantId) };
}

function saveBaksalDailyName(name: string) {
  try {
    window.localStorage.setItem(BAKSAL_DAILY_NAME_KEY, name);
  } catch {
    // 저장소가 막혀 있으면 이번 접속에서만 쓴다.
  }
}

export async function submitBaksalDaily(challenge: BaksalDailyChallenge, identity: BaksalDailyIdentity, payload: BaksalDailyPayload): Promise<BaksalDailySubmission> {
  try {
    const response = await fetch("/api/baksal-daily", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...challenge, ...identity, ...payload }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { status: "failed", message: body.error ?? "기록을 저장하지 못했습니다." };
    return { status: "saved", improved: Boolean(body.improved), participant: body.participant ?? null, barrier: body.barrier };
  } catch {
    return { status: "failed", message: "연결이 끊겨 기록을 저장하지 못했습니다." };
  }
}

function BarrierGauge({ barrier, label }: { barrier: BaksalBarrier; label: string }) {
  return (
    <div className="bk-barrier" aria-label={`${label} ${barrier.total}점, 목표 ${barrier.target}점`}>
      <span><small>{label}</small><b>{barrier.total.toLocaleString("ko-KR")}<em> / {barrier.target.toLocaleString("ko-KR")}</em></b></span>
      <i aria-hidden="true"><span style={{ width: `${Math.round(barrier.ratio * 100)}%` }} /></i>
    </div>
  );
}

export function BaksalLeaderboard({ entries, highlightRank }: { entries: BaksalDailyEntry[]; highlightRank?: number | null }) {
  if (entries.length === 0) return <p className="bk-note">아직 오늘 기록이 없습니다. 첫 순찰자가 되어 보세요.</p>;
  return (
    <ol className="bk-leaderboard">
      {entries.map((entry) => (
        <li key={entry.id} className={highlightRank === entry.rank ? "me" : ""}>
          <em>{entry.rank}</em>
          <b>{entry.displayName}</b>
          <span>{entry.completed ? "완주" : `방 ${entry.roomsCleared}`}{entry.lenient ? " · 넉넉" : ""}</span>
          <strong>{entry.score.toLocaleString("ko-KR")}</strong>
        </li>
      ))}
    </ol>
  );
}

export function BaksalDailyPanel({ starting, onStart }: {
  starting: boolean;
  onStart: (challenge: BaksalDailyChallenge, identity: BaksalDailyIdentity) => void;
}) {
  const [board, setBoard] = useState<BaksalDailyBoard | null>(null);
  const [error, setError] = useState("");
  const [identity, setIdentity] = useState<BaksalDailyIdentity | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async (participantId: string) => {
    try {
      const response = await fetch(`/api/baksal-daily?participantId=${encodeURIComponent(participantId)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "오늘의 순찰을 불러오지 못했습니다.");
        return;
      }
      setBoard(body as BaksalDailyBoard);
      setError("");
    } catch {
      setError("연결이 끊겨 오늘의 순찰을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    const current = readBaksalDailyIdentity();
    setIdentity(current);
    setNameDraft(current.displayName);
    void load(current.participantId);
  }, [load]);

  const commitName = () => {
    if (!identity) return;
    const normalized = normalizeBaksalDailyName(nameDraft) || baksalDailyDefaultName(identity.participantId);
    setNameDraft(normalized);
    saveBaksalDailyName(normalized);
    setIdentity({ ...identity, displayName: normalized });
  };

  const me = board?.participant ?? null;
  return (
    <section className="bk-card bk-daily" aria-label="오늘의 순찰">
      <header>
        <div>
          <small>오늘의 순찰 · {board?.challenge.date ?? "불러오는 중"}</small>
          <h2>모두 같은 밤, 같은 악귀</h2>
        </div>
        {board?.challenge.reinforced && <span className="bk-badge">원귀 강화</span>}
      </header>
      {error && <p className="bk-note warn">{error}</p>}
      {board && (
        <>
          <BarrierGauge barrier={board.barrier} label={`오늘의 결계 · ${board.barrier.participants ?? 0}명`} />
          <p className="bk-note">
            {board.challenge.reinforced
              ? `어제 결계가 ${board.yesterday.total.toLocaleString("ko-KR")}점으로 약해 오늘은 그림자 마당에 몽달귀신이 더 나옵니다.`
              : "어제 결계가 목표를 넘겨 오늘은 기본 순찰입니다."}
            {" "}오늘 합계가 목표에 못 미치면 내일 원귀가 늘어납니다.
          </p>
          <div className="bk-daily-me">
            <span><small>내 오늘 최고</small><b>{me ? me.score.toLocaleString("ko-KR") : "—"}</b></span>
            <span><small>순위</small><b>{me ? `${me.rank}위` : "—"}</b></span>
          </div>
          <BaksalLeaderboard entries={expanded ? board.leaderboard : board.leaderboard.slice(0, 5)} highlightRank={me?.rank} />
          {board.leaderboard.length > 5 && (
            <button type="button" className="bk-link" onClick={() => setExpanded((value) => !value)}>
              {expanded ? "접기" : `상위 ${board.leaderboard.length}명 모두 보기`}
            </button>
          )}
        </>
      )}
      <label className="bk-name-field">
        <span>점수판 이름</span>
        <input
          value={nameDraft}
          maxLength={BAKSAL_DAILY_NAME_MAX * 2}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={commitName}
          aria-label="점수판에 표시할 이름"
        />
      </label>
      <p className="bk-note">템포 80, 같은 방 순서와 같은 부적 후보로 겨룹니다. 도감 숙련의 약점 표시는 꺼집니다. 다시 하기는 무제한이고 하루 최고 기록 1개만 남습니다.</p>
      <button
        type="button"
        className="bk-primary"
        disabled={!board || !identity || starting}
        onClick={() => {
          if (!board || !identity) return;
          const normalized = normalizeBaksalDailyName(nameDraft) || identity.displayName;
          saveBaksalDailyName(normalized);
          onStart(board.challenge, { ...identity, displayName: normalized });
        }}
      >
        오늘의 순찰 시작
      </button>
    </section>
  );
}
