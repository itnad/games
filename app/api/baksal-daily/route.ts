import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { baksalDailyResults } from "../../../db/schema";
import {
  baksalBarrierStatus,
  baksalDailyChallengeForDate,
  baksalDailyChart,
  baksalDailyRecordIsBetter,
  baksalDailyResultIsPlausible,
  baksalKstDate,
  baksalPreviousDate,
  normalizeBaksalDailyName,
  validBaksalDailyParticipantId,
  BAKSAL_BARRIER_TARGET,
  BAKSAL_DAILY_NAME_MAX,
} from "../../baksal/baksal-daily.js";

const LEADERBOARD_LIMIT = 100;

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("no such table") || message.includes("baksal_daily_results")) {
    return "오늘의 순찰 기록판을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "오늘의 순찰 기록을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function integerInRange(value: unknown, minimum: number, maximum: number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= minimum && numeric <= maximum ? numeric : null;
}

async function barrierTotal(date: string) {
  const db = getDb();
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${baksalDailyResults.score}), 0)`, participants: sql<number>`count(*)` })
    .from(baksalDailyResults)
    .where(eq(baksalDailyResults.challengeDate, date));
  return { total: Number(rows[0]?.total ?? 0), participants: Number(rows[0]?.participants ?? 0) };
}

/** 오늘의 조건은 서버만 정한다. 전날 결계 합계가 목표에 못 미치면 오늘은 원귀가 하나 늘어난다. */
async function todaysChallenge() {
  const date = baksalKstDate();
  const yesterday = await barrierTotal(baksalPreviousDate(date));
  const reinforced = yesterday.total < BAKSAL_BARRIER_TARGET;
  return { challenge: baksalDailyChallengeForDate(date, { reinforced }), yesterday: baksalBarrierStatus(yesterday.total) };
}

const rankingColumns = {
  id: baksalDailyResults.id,
  participantId: baksalDailyResults.participantId,
  displayName: baksalDailyResults.displayName,
  score: baksalDailyResults.score,
  roomsCleared: baksalDailyResults.roomsCleared,
  maxCombo: baksalDailyResults.maxCombo,
  remainingHp: baksalDailyResults.remainingHp,
  purified: baksalDailyResults.purified,
  completed: baksalDailyResults.completed,
  lenient: baksalDailyResults.lenient,
};

async function readRanking(date: string, limit = LEADERBOARD_LIMIT) {
  return getDb()
    .select(rankingColumns)
    .from(baksalDailyResults)
    .where(eq(baksalDailyResults.challengeDate, date))
    .orderBy(
      desc(baksalDailyResults.score),
      desc(baksalDailyResults.roomsCleared),
      desc(baksalDailyResults.maxCombo),
      desc(baksalDailyResults.remainingHp),
      asc(baksalDailyResults.id),
    )
    .limit(limit);
}

async function readParticipant(date: string, participantId: string) {
  return (await getDb()
    .select()
    .from(baksalDailyResults)
    .where(and(eq(baksalDailyResults.challengeDate, date), eq(baksalDailyResults.participantId, participantId)))
    .limit(1))[0] ?? null;
}

/** 순위: 점수가 더 높은 기록 수 + 1. 같은 점수는 같은 순위다. */
async function rankOf(date: string, score: number) {
  const rows = await getDb()
    .select({ ahead: sql<number>`count(*)` })
    .from(baksalDailyResults)
    .where(and(eq(baksalDailyResults.challengeDate, date), gt(baksalDailyResults.score, score)));
  return Number(rows[0]?.ahead ?? 0) + 1;
}

function publicEntry<T extends { participantId?: string }>(entry: T) {
  const { participantId: _hidden, ...rest } = entry;
  void _hidden;
  return rest;
}

export async function GET(request: Request) {
  let challenge = baksalDailyChallengeForDate();
  try {
    const today = await todaysChallenge();
    challenge = today.challenge;
    const participantId = new URL(request.url).searchParams.get("participantId");
    const [leaderboard, totals] = await Promise.all([readRanking(challenge.date), barrierTotal(challenge.date)]);
    const participant = validBaksalDailyParticipantId(participantId) ? await readParticipant(challenge.date, participantId as string) : null;
    return Response.json({
      challenge,
      barrier: { ...baksalBarrierStatus(totals.total), participants: totals.participants },
      yesterday: today.yesterday,
      leaderboard: leaderboard.map((entry, index) => ({ ...publicEntry(entry), rank: index + 1 })),
      participant: participant ? { ...publicEntry(participant), rank: await rankOf(challenge.date, participant.score) } : null,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: errorMessage(error), challenge }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try {
    const { challenge } = await todaysChallenge();
    const payload = (await request.json()) as Record<string, unknown>;
    const participantId = typeof payload.participantId === "string" ? payload.participantId : "";
    const displayName = normalizeBaksalDailyName(payload.displayName);
    if (!validBaksalDailyParticipantId(participantId) || !displayName || Array.from(displayName).length > BAKSAL_DAILY_NAME_MAX) {
      return Response.json({ error: "참가자 이름이나 기기 식별값이 올바르지 않습니다." }, { status: 400 });
    }
    // 조건은 클라이언트가 고르지 않는다. 받은 값은 오늘 서버 조건과 같은지만 확인한다.
    if (payload.date !== challenge.date || Number(payload.seed) !== challenge.seed || Number(payload.bpm) !== challenge.bpm || Boolean(payload.reinforced) !== challenge.reinforced) {
      return Response.json({ error: "오늘의 순찰 조건과 일치하지 않는 기록입니다. 새로 고친 뒤 다시 도전해 주세요.", challenge }, { status: 409 });
    }

    const candidate = {
      displayName,
      seed: challenge.seed,
      bpm: challenge.bpm,
      reinforced: challenge.reinforced,
      score: integerInRange(payload.score, 0, 50_000_000),
      roomsCleared: integerInRange(payload.roomsCleared, 0, 20),
      maxCombo: integerInRange(payload.maxCombo, 0, 100_000),
      remainingHp: integerInRange(payload.remainingHp, 0, 10),
      purified: integerInRange(payload.purified, 0, 1_000),
      dodges: integerInRange(payload.dodges, 0, 10_000),
      ttak: integerInRange(payload.ttak, 0, 100_000),
      judged: integerInRange(payload.judged, 0, 100_000),
      completed: payload.completed === true,
      lenient: payload.lenient === true,
    };
    if (Object.values(candidate).some((value) => value === null)) {
      return Response.json({ error: "기록 수치가 허용 범위를 벗어났습니다." }, { status: 400 });
    }
    const record = candidate as { [K in keyof typeof candidate]: NonNullable<(typeof candidate)[K]> };
    if (!baksalDailyResultIsPlausible(baksalDailyChart(challenge), record)) {
      return Response.json({ error: "오늘의 순찰에서 나올 수 없는 기록입니다." }, { status: 400 });
    }

    const db = getDb();
    const existing = await readParticipant(challenge.date, participantId);
    let improved = false;
    if (!existing) {
      const inserted = await db
        .insert(baksalDailyResults)
        .values({ challengeDate: challenge.date, participantId, ...record })
        .onConflictDoNothing({ target: [baksalDailyResults.challengeDate, baksalDailyResults.participantId] })
        .returning({ id: baksalDailyResults.id });
      improved = inserted.length > 0;
    }
    const current = existing ?? (improved ? null : await readParticipant(challenge.date, participantId));
    if (current && baksalDailyRecordIsBetter(current, record)) {
      await db.update(baksalDailyResults).set(record).where(eq(baksalDailyResults.id, current.id));
      improved = true;
    } else if (current && current.displayName !== displayName) {
      await db.update(baksalDailyResults).set({ displayName }).where(eq(baksalDailyResults.id, current.id));
    }

    const saved = await readParticipant(challenge.date, participantId);
    const totals = await barrierTotal(challenge.date);
    return Response.json({
      accepted: true,
      improved,
      participant: saved ? { ...publicEntry(saved), rank: await rankOf(challenge.date, saved.score) } : null,
      barrier: { ...baksalBarrierStatus(totals.total), participants: totals.participants },
    }, { status: improved && !existing ? 201 : 200 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
