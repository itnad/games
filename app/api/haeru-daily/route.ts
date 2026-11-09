import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { mudflatDailyResults } from "../../../db/schema";
import {
  mudflatDailyChallengeForDate,
  normalizeMudflatDailyName,
  validMudflatDailyParticipantId,
} from "../../mudflat-daily-challenge.js";

const MAX_SCORE = 5_000_000;
const MAX_CAUGHT = 500;
const MAX_ELAPSED = 3_600;
const MAX_HP = 2_000;

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "오늘의 갯벌 기록을 불러오지 못했습니다.";
  if (message.includes("no such table") || message.includes("mudflat_daily_results")) {
    return "오늘의 갯벌 기록판을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "오늘의 갯벌 기록을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function integerInRange(value: unknown, minimum: number, maximum: number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= minimum && numeric <= maximum ? numeric : null;
}

async function readRanking(challengeDate: string, limit = 20) {
  const db = getDb();
  return db
    .select({
      id: mudflatDailyResults.id,
      participantId: mudflatDailyResults.participantId,
      displayName: mudflatDailyResults.displayName,
      score: mudflatDailyResults.score,
      caught: mudflatDailyResults.caught,
      elapsed: mudflatDailyResults.elapsed,
      remainingHp: mudflatDailyResults.remainingHp,
      bossCaught: mudflatDailyResults.bossCaught,
    })
    .from(mudflatDailyResults)
    .where(and(eq(mudflatDailyResults.challengeDate, challengeDate), eq(mudflatDailyResults.completed, true)))
    .orderBy(desc(mudflatDailyResults.score), desc(mudflatDailyResults.caught), asc(mudflatDailyResults.elapsed), asc(mudflatDailyResults.id))
    .limit(limit);
}

export async function GET(request: Request) {
  const challenge = mudflatDailyChallengeForDate();
  try {
    const participantId = new URL(request.url).searchParams.get("participantId");
    const db = getDb();
    const leaderboard = await readRanking(challenge.date);
    const participant = validMudflatDailyParticipantId(participantId)
      ? (await db
          .select()
          .from(mudflatDailyResults)
          .where(and(eq(mudflatDailyResults.challengeDate, challenge.date), eq(mudflatDailyResults.participantId, participantId)))
          .limit(1))[0] ?? null
      : null;
    const participantRank = participant?.completed
      ? leaderboard.findIndex((entry) => entry.participantId === participant.participantId) + 1 || null
      : null;

    return Response.json({
      challenge,
      leaderboard: leaderboard.map((entry, index) => ({ ...entry, rank: index + 1, participantId: undefined })),
      participant: participant ? { ...participant, participantId: undefined, rank: participantRank } : null,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: errorMessage(error), challenge }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const challenge = mudflatDailyChallengeForDate();
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const participantId = typeof payload.participantId === "string" ? payload.participantId : "";
    const displayName = normalizeMudflatDailyName(payload.displayName);
    const stage = integerInRange(payload.stage, 1, 9);
    const seed = integerInRange(payload.seed, 1, 0xffffffff);
    const score = integerInRange(payload.score, 0, MAX_SCORE);
    const caught = integerInRange(payload.caught, 0, MAX_CAUGHT);
    const elapsed = integerInRange(payload.elapsed, 0, MAX_ELAPSED);
    const remainingHp = integerInRange(payload.remainingHp, 0, MAX_HP);
    const completed = payload.completed === true;
    const bossCaught = payload.bossCaught === true;

    if (!validMudflatDailyParticipantId(participantId) || !displayName || Array.from(displayName).length > 12) {
      return Response.json({ error: "참가자 이름이나 기기 식별값이 올바르지 않습니다." }, { status: 400 });
    }
    if (stage !== challenge.stage || seed !== challenge.seed) {
      return Response.json({ error: "오늘의 갯벌 조건과 일치하지 않는 기록입니다." }, { status: 400 });
    }
    if (score === null || caught === null || elapsed === null || remainingHp === null) {
      return Response.json({ error: "기록 수치가 허용 범위를 벗어났습니다." }, { status: 400 });
    }

    const db = getDb();
    const inserted = await db
      .insert(mudflatDailyResults)
      .values({
        challengeDate: challenge.date,
        participantId,
        displayName,
        stage,
        seed,
        score: completed ? score : 0,
        caught,
        elapsed,
        remainingHp,
        bossCaught,
        completed,
      })
      .onConflictDoNothing({ target: [mudflatDailyResults.challengeDate, mudflatDailyResults.participantId] })
      .returning({ id: mudflatDailyResults.id });

    const participant = (await db
      .select()
      .from(mudflatDailyResults)
      .where(and(eq(mudflatDailyResults.challengeDate, challenge.date), eq(mudflatDailyResults.participantId, participantId)))
      .limit(1))[0];
    const ranking = participant.completed ? await readRanking(challenge.date, 100) : [];
    const rankIndex = ranking.findIndex((entry) => entry.participantId === participantId);

    return Response.json({
      accepted: inserted.length > 0,
      participant: { ...participant, participantId: undefined, rank: rankIndex >= 0 ? rankIndex + 1 : null },
    }, { status: inserted.length > 0 ? 201 : 200 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
