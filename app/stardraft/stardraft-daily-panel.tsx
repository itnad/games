"use client";

// 스타드래프트 "오늘의 대전" 카드: 오늘의 조건, 도전 버튼, 순위표, 이름 바꾸기. 기록 올리기도 여기서 한다.
import { useEffect, useState } from "react";
import { STW_AI_PERSONAS, STW_DIFFICULTIES, STW_MAPS, STW_RACES } from "./stardraft-data.js";
import {
  normalizeStwDailyName,
  stwDailyChallengeForDate,
  stwDailyClock,
  stwDailyDefaultName,
  stwDailyResult,
} from "./stardraft-daily.js";
import { stwReplayCode } from "./stardraft-replay.js";
import { STW_STORAGE_KEYS } from "./stardraft-storage.js";
import type { StwDifficulty, StwMapId, StwRaceId, StwState } from "./stardraft-types";

export type StwDailyChallenge = { date: string; difficulty: StwDifficulty; races: { player: StwRaceId; enemy: StwRaceId }; persona: string; map: StwMapId; seed: number };
type DailyRow = { rank: number; displayName: string; elapsedTicks: number; lostValue: number };
type DailyBoard = { challenge: StwDailyChallenge; leaderboard: DailyRow[]; participant: DailyRow | null; error?: string };
/** 기록을 올린 결과. status: sending(보내는 중) · saved(올라감) · failed(못 올림). */
export type StwDailySubmission = { status: "sending" | "saved" | "failed"; elapsedTicks: number; rank?: number | null; improved?: boolean; best?: number; message?: string };

const API = "/api/stardraft-daily";

function createParticipantId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

/** 이 브라우저의 익명 참가자. 식별값은 처음 쓸 때 만들어 저장소에 두고, 이름은 바꿀 수 있다. */
function dailyIdentity() {
  let participantId = "";
  let stored = "";
  try {
    participantId = window.localStorage.getItem(STW_STORAGE_KEYS.dailyParticipant) ?? "";
    if (!participantId) {
      participantId = createParticipantId();
      window.localStorage.setItem(STW_STORAGE_KEYS.dailyParticipant, participantId);
    }
    stored = normalizeStwDailyName(window.localStorage.getItem(STW_STORAGE_KEYS.dailyName)) as string;
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 쓰는 식별값으로 한다.
    participantId ||= createParticipantId();
  }
  return { participantId, displayName: stored || (stwDailyDefaultName(participantId) as string) };
}

/** 이긴 오늘의 대전 경기를 순위표에 올린다. 진 경기는 올리지 않는다(null). */
export async function submitStwDaily(game: StwState, build: string): Promise<StwDailySubmission | null> {
  const result = stwDailyResult(game) as { elapsedTicks: number; lostValue: number } | null;
  if (!result || !game.daily) return null;
  try {
    const identity = dailyIdentity();
    const response = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...identity, date: game.daily.date, ...result, build, replay: stwReplayCode(game, build) }),
    });
    const payload = (await response.json()) as { accepted?: boolean; improved?: boolean; participant?: DailyRow | null; error?: string };
    if (!response.ok || !payload.accepted) return { status: "failed", elapsedTicks: result.elapsedTicks, message: payload.error ?? "기록을 올리지 못했습니다." };
    return { status: "saved", elapsedTicks: result.elapsedTicks, rank: payload.participant?.rank ?? null, improved: Boolean(payload.improved), best: payload.participant?.elapsedTicks };
  } catch {
    return { status: "failed", elapsedTicks: result.elapsedTicks, message: "순위표에 연결하지 못했습니다. 이 화면에서는 기록을 올릴 수 없습니다." };
  }
}

/** 조건 한 줄: "프로토스 vs 저그 · 협곡 · 상대 뮤탈 저글링 · 보통". */
export function stwDailyConditions(challenge: StwDailyChallenge) {
  const persona = (STW_AI_PERSONAS as unknown as Record<string, { name: string }>)[challenge.persona]?.name ?? challenge.persona;
  return `${STW_RACES[challenge.races.player].name} vs ${STW_RACES[challenge.races.enemy].name} · ${STW_MAPS[challenge.map].name} · 상대 ${persona} · ${STW_DIFFICULTIES[challenge.difficulty].name}`;
}

export function DailyCard({ onStart, refresh }: { onStart: (challenge: StwDailyChallenge) => void; refresh: number }) {
  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState<DailyBoard | null>(null);
  const [failed, setFailed] = useState("");
  const [name, setName] = useState("");
  // 조건은 날짜로 정해지므로 순위표를 못 불러와도 바로 보여 주고 도전할 수 있다. 불러오면 서버가 준 조건을 쓴다.
  const [local] = useState(() => stwDailyChallengeForDate() as StwDailyChallenge);
  const challenge = board?.challenge ?? local;

  useEffect(() => {
    let cancelled = false;
    const identity = dailyIdentity();
    fetch(`${API}?participantId=${encodeURIComponent(identity.participantId)}`, { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, payload: (await response.json()) as DailyBoard }))
      .then(({ ok, payload }) => {
        if (cancelled) return;
        setName(identity.displayName);
        if (ok && Array.isArray(payload.leaderboard)) {
          setBoard(payload);
          setFailed("");
        } else setFailed(payload.error ?? "순위표를 불러오지 못했습니다.");
      })
      .catch(() => {
        if (cancelled) return;
        setName(identity.displayName);
        setFailed("순위표에 연결하지 못했습니다. 도전은 할 수 있지만 이 화면에서는 기록이 올라가지 않습니다.");
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const saveName = (value: string) => {
    const next = normalizeStwDailyName(value) as string;
    setName(value);
    try {
      if (next) window.localStorage.setItem(STW_STORAGE_KEYS.dailyName, next);
      else window.localStorage.removeItem(STW_STORAGE_KEYS.dailyName);
    } catch {
      // 이름을 저장하지 못해도 이번 도전은 할 수 있다.
    }
  };
  const mine = board?.participant ?? null;

  return (
    <section className="stw-daily" aria-label="오늘의 대전">
      <div className="stw-daily-head">
        <div>
          <small>오늘의 대전 · {challenge.date.slice(5).replace("-", "/")}</small>
          <b>{stwDailyConditions(challenge)}</b>
          <span>{mine ? `내 기록 ${stwDailyClock(mine.elapsedTicks)} · ${mine.rank}위` : "가장 빨리 이기면 1위 · 몇 번이든 다시 도전"}</span>
        </div>
        <button type="button" className="stw-primary" onClick={() => onStart(challenge)}>도전</button>
      </div>
      <button type="button" className="stw-daily-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? "순위표 접기" : `순위표 보기${board ? ` (${board.leaderboard.length})` : ""}`}</button>
      {open ? (
        <div className="stw-daily-body">
          <p className="stw-hint">모두 같은 조건(같은 종족·맵·상대 전략·시드)으로 겨룹니다. 이긴 경기만 오르고, 하루에 가장 좋은 기록 하나가 남습니다. 전적과 이어하기에는 들어가지 않습니다.</p>
          {failed ? <p className="stw-daily-note" role="status">{failed}</p> : null}
          {board ? (
            board.leaderboard.length ? (
              <ol className="stw-daily-board">
                {board.leaderboard.map((row) => (
                  <li key={row.rank} className={mine && mine.rank === row.rank ? "mine" : undefined}>
                    <i>{row.rank}</i>
                    <b>{row.displayName}</b>
                    <span>{stwDailyClock(row.elapsedTicks)}</span>
                    <em>잃은 병력 {row.lostValue}</em>
                  </li>
                ))}
              </ol>
            ) : <p className="stw-daily-note">아직 기록이 없습니다. 첫 기록을 남겨 보세요.</p>
          ) : failed ? null : <p className="stw-daily-note" role="status">순위표를 불러오는 중입니다.</p>}
          <label className="stw-daily-name">
            <span>순위표 이름</span>
            <input type="text" value={name} maxLength={12} placeholder="이름 (12자까지)" onChange={(event) => saveName(event.target.value)} />
          </label>
        </div>
      ) : null}
    </section>
  );
}
