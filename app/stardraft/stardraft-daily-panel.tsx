"use client";

// 스타드래프트 "오늘의 대전" 카드: 내 종족별 대전 세 가지와 도전 버튼, 종족별 순위표, 이름 바꾸기. 기록 올리기도 여기서 한다.
// 상대 종족과 전략은 보여 주지 않는다(경기에서 정찰로 알아낸다).
import { useEffect, useState } from "react";
import { withKoreanDirection } from "../korean-particles.js";
import { STW_RACES } from "./stardraft-data.js";
import {
  STW_DAILY_RACES,
  normalizeStwDailyName,
  stwDailyChallengeForDate,
  stwDailyClock,
  stwDailyDefaultName,
  stwDailyResult,
  stwKstDate,
} from "./stardraft-daily.js";
import { stwReplayCode } from "./stardraft-replay.js";
import { STW_STORAGE_KEYS } from "./stardraft-storage.js";
import type { StwDifficulty, StwMapId, StwRaceId, StwState } from "./stardraft-types";

export type StwDailyChallenge = { date: string; difficulty: StwDifficulty; races: { player: StwRaceId; enemy: StwRaceId }; persona: string; map: StwMapId; seed: number };
type DailyRow = { rank: number; displayName: string; elapsedTicks: number; lostValue: number };
type RaceBoard = { leaderboard: DailyRow[]; participant: DailyRow | null };
type DailyBoards = { date: string; boards: Record<string, RaceBoard>; error?: string };
const DAILY_RACES = STW_DAILY_RACES as StwRaceId[];
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
      body: JSON.stringify({ ...identity, date: game.daily.date, race: game.daily.race, ...result, build, replay: stwReplayCode(game, build) }),
    });
    const payload = (await response.json()) as { accepted?: boolean; improved?: boolean; participant?: DailyRow | null; error?: string };
    if (!response.ok || !payload.accepted) return { status: "failed", elapsedTicks: result.elapsedTicks, message: payload.error ?? "기록을 올리지 못했습니다." };
    return { status: "saved", elapsedTicks: result.elapsedTicks, rank: payload.participant?.rank ?? null, improved: Boolean(payload.improved), best: payload.participant?.elapsedTicks };
  } catch {
    return { status: "failed", elapsedTicks: result.elapsedTicks, message: "순위표에 연결하지 못했습니다. 이 화면에서는 기록을 올릴 수 없습니다." };
  }
}

export function DailyCard({ onStart, refresh }: { onStart: (challenge: StwDailyChallenge) => void; refresh: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DailyBoards | null>(null);
  const [failed, setFailed] = useState("");
  const [name, setName] = useState("");
  const [tab, setTab] = useState<StwRaceId>(DAILY_RACES[0]);
  // 날짜는 순위표를 불러오면 서버가 준 것을 쓰고, 못 불러오면 이 기기의 한국 시각으로 정한다(그래도 도전은 된다).
  const [localDate] = useState(() => stwKstDate() as string);
  const date = data?.date ?? localDate;

  useEffect(() => {
    let cancelled = false;
    const identity = dailyIdentity();
    fetch(`${API}?participantId=${encodeURIComponent(identity.participantId)}`, { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, payload: (await response.json()) as DailyBoards }))
      .then(({ ok, payload }) => {
        if (cancelled) return;
        setName(identity.displayName);
        if (ok && payload.boards) {
          setData(payload);
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
  const board = data?.boards[tab] ?? null;
  const mineOnTab = board?.participant ?? null;

  return (
    <section className="stw-daily" aria-label="오늘의 대전">
      <div className="stw-daily-title">
        <small>오늘의 대전 · {date.slice(5).replace("-", "/")}</small>
        <span>종족을 골라 도전하세요. 상대 종족과 전략은 정찰로 알아내야 합니다.</span>
      </div>
      <div className="stw-daily-races">
        {DAILY_RACES.map((race) => {
          const mine = data?.boards[race]?.participant ?? null;
          return (
            <button key={race} type="button" className={`stw-daily-race ${race}`} onClick={() => onStart(stwDailyChallengeForDate(date, race) as StwDailyChallenge)} aria-label={`${withKoreanDirection(STW_RACES[race].name)} 오늘의 대전 도전`}>
              <b>{STW_RACES[race].name}</b>
              <span>{mine ? `${stwDailyClock(mine.elapsedTicks)} · ${mine.rank}위` : "기록 없음"}</span>
              <em>도전</em>
            </button>
          );
        })}
      </div>
      <button type="button" className="stw-daily-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? "순위표 접기" : "순위표 보기"}</button>
      {open ? (
        <div className="stw-daily-body">
          <p className="stw-hint">종족마다 모두 같은 조건(같은 상대·맵·시드, 난이도 보통)으로 겨룹니다. 가장 빨리 이긴 순서이고, 이긴 경기만 오르며, 종족마다 하루에 가장 좋은 기록 하나가 남습니다. 전적과 이어하기에는 들어가지 않습니다.</p>
          {failed ? <p className="stw-daily-note" role="status">{failed}</p> : null}
          <div className="stw-segment stw-daily-tabs" role="radiogroup" aria-label="순위표 종족">
            {DAILY_RACES.map((race) => (
              <button key={race} type="button" role="radio" aria-checked={tab === race} className={tab === race ? "active" : ""} onClick={() => setTab(race)}>{STW_RACES[race].name}</button>
            ))}
          </div>
          {board ? (
            board.leaderboard.length ? (
              <ol className="stw-daily-board">
                {board.leaderboard.map((row) => (
                  <li key={row.rank} className={mineOnTab && mineOnTab.rank === row.rank ? "mine" : undefined}>
                    <i>{row.rank}</i>
                    <b>{row.displayName}</b>
                    <span>{stwDailyClock(row.elapsedTicks)}</span>
                    <em>잃은 병력 {row.lostValue}</em>
                  </li>
                ))}
              </ol>
            ) : <p className="stw-daily-note">아직 {STW_RACES[tab].name} 기록이 없습니다. 첫 기록을 남겨 보세요.</p>
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
