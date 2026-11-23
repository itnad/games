import { and, asc, eq, gt, lt, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { stardraftDailyResults } from "../../../db/schema";
import {
  STW_DAILY_MAX_TICKS,
  STW_DAILY_RACES,
  STW_DAILY_REPLAY_MAX_CHARS,
  normalizeStwDailyName,
  stwDailyAcceptedDate,
  stwDailyChallengeForDate,
  stwKstDate,
  stwDailyRecordIsBetter,
  stwDailyReplayProblem,
  validStwDailyParticipantId,
} from "../../stardraft/stardraft-daily.js";

const MAX_LOST_VALUE = 1_000_000;
const LEADERBOARD_SIZE = 20;

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("no such table") || message.includes("stardraft_daily_results")) {
    return "오늘의 대전 순위표를 준비하고 있습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "오늘의 대전 기록을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function integerInRange(value: unknown, minimum: number, maximum: number) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= minimum && numeric <= maximum ? numeric : null;
}

// 순위: 빨리 이긴 순, 같으면 잃은 병력 가치가 적은 순, 그래도 같으면 먼저 올린 순. 재현 코드는 목록에 싣지 않는다(크다).
// 날마다 내 종족별로 대전이 하나씩 열리고, 순위표도 종족별로 따로다.
async function readRanking(challengeDate: string, race: string, limit = LEADERBOARD_SIZE) {
  return getDb()
    .select({
      id: stardraftDailyResults.id,
      participantId: stardraftDailyResults.participantId,
      displayName: stardraftDailyResults.displayName,
      elapsedTicks: stardraftDailyResults.elapsedTicks,
      lostValue: stardraftDailyResults.lostValue,
    })
    .from(stardraftDailyResults)
    .where(and(eq(stardraftDailyResults.challengeDate, challengeDate), eq(stardraftDailyResults.playerRace, race)))
    .orderBy(asc(stardraftDailyResults.elapsedTicks), asc(stardraftDailyResults.lostValue), asc(stardraftDailyResults.id))
    .limit(limit);
}

async function readParticipant(challengeDate: string, race: string, participantId: string) {
  const row = (await getDb()
    .select({
      id: stardraftDailyResults.id,
      displayName: stardraftDailyResults.displayName,
      elapsedTicks: stardraftDailyResults.elapsedTicks,
      lostValue: stardraftDailyResults.lostValue,
    })
    .from(stardraftDailyResults)
    .where(and(eq(stardraftDailyResults.challengeDate, challengeDate), eq(stardraftDailyResults.playerRace, race), eq(stardraftDailyResults.participantId, participantId)))
    .limit(1))[0] ?? null;
  if (!row) return null;
  // 내 순위: 나보다 앞선 기록 수 + 1.
  const ahead = await getDb()
    .select({ id: stardraftDailyResults.id })
    .from(stardraftDailyResults)
    .where(and(
      eq(stardraftDailyResults.challengeDate, challengeDate),
      eq(stardraftDailyResults.playerRace, race),
      or(
        lt(stardraftDailyResults.elapsedTicks, row.elapsedTicks),
        and(eq(stardraftDailyResults.elapsedTicks, row.elapsedTicks), lt(stardraftDailyResults.lostValue, row.lostValue)),
        and(eq(stardraftDailyResults.elapsedTicks, row.elapsedTicks), eq(stardraftDailyResults.lostValue, row.lostValue), lt(stardraftDailyResults.id, row.id)),
      ),
    ));
  return { displayName: row.displayName, elapsedTicks: row.elapsedTicks, lostValue: row.lostValue, rank: ahead.length + 1 };
}

export async function GET(request: Request) {
  // 조건(상대 종족·전략·맵·시드)은 응답에 싣지 않는다: 화면이 날짜와 내 종족으로 같은 규칙을 계산하고, 상대는 경기에서 가려 둔다.
  const date = stwKstDate();
  try {
    const participantId = new URL(request.url).searchParams.get("participantId");
    const known = participantId && validStwDailyParticipantId(participantId) ? participantId : null;
    const boards: Record<string, unknown> = {};
    for (const race of STW_DAILY_RACES as string[]) {
      const leaderboard = await readRanking(date, race);
      boards[race] = {
        leaderboard: leaderboard.map((entry, index) => ({ rank: index + 1, displayName: entry.displayName, elapsedTicks: entry.elapsedTicks, lostValue: entry.lostValue })),
        participant: known ? await readParticipant(date, race, known) : null,
      };
    }
    return Response.json({ date, races: STW_DAILY_RACES, boards }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: errorMessage(error), date }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > STW_DAILY_REPLAY_MAX_CHARS + 2_000) {
      return Response.json({ error: "기록이 너무 큽니다." }, { status: 413 });
    }
    const payload = JSON.parse(text) as Record<string, unknown>;
    const participantId = typeof payload.participantId === "string" ? payload.participantId : "";
    const displayName = normalizeStwDailyName(payload.displayName);
    if (!validStwDailyParticipantId(participantId) || !displayName) {
      return Response.json({ error: "참가자 이름이나 기기 식별값이 올바르지 않습니다." }, { status: 400 });
    }
    // 조건은 서버가 날짜로 정한다. 요청이 고를 수 있는 것은 "오늘" 또는 자정을 막 넘긴 "어제"뿐이다.
    const date = stwDailyAcceptedDate(payload.date);
    if (!date) return Response.json({ error: "오늘의 대전 날짜가 지났습니다. 오늘 조건으로 다시 도전해 주세요." }, { status: 400 });
    const race = typeof payload.race === "string" && (STW_DAILY_RACES as string[]).includes(payload.race) ? payload.race : null;
    if (!race) return Response.json({ error: "오늘의 대전 종족이 올바르지 않습니다." }, { status: 400 });
    const challenge = stwDailyChallengeForDate(date, race);
    const elapsedTicks = integerInRange(payload.elapsedTicks, 1, STW_DAILY_MAX_TICKS);
    const lostValue = integerInRange(payload.lostValue, 0, MAX_LOST_VALUE);
    if (elapsedTicks === null || lostValue === null) {
      return Response.json({ error: "기록 수치가 허용 범위를 벗어났습니다." }, { status: 400 });
    }
    const problem = stwDailyReplayProblem(payload.replay, challenge, elapsedTicks);
    if (problem) return Response.json({ error: `${problem}.` }, { status: 400 });
    const replay = JSON.stringify(payload.replay);
    if (replay.length > STW_DAILY_REPLAY_MAX_CHARS) return Response.json({ error: "기록이 너무 큽니다." }, { status: 413 });
    const build = typeof payload.build === "string" ? payload.build.slice(0, 120) : "";

    const candidate = { displayName, seed: challenge.seed, elapsedTicks, lostValue, build, replay };
    const db = getDb();
    const mine = and(eq(stardraftDailyResults.challengeDate, challenge.date), eq(stardraftDailyResults.playerRace, race), eq(stardraftDailyResults.participantId, participantId));
    const existing = (await db
      .select({ elapsedTicks: stardraftDailyResults.elapsedTicks, lostValue: stardraftDailyResults.lostValue, displayName: stardraftDailyResults.displayName })
      .from(stardraftDailyResults)
      .where(mine)
      .limit(1))[0] ?? null;
    const inserted = await db
      .insert(stardraftDailyResults)
      .values({ challengeDate: challenge.date, playerRace: race, participantId, ...candidate })
      .onConflictDoNothing({ target: [stardraftDailyResults.challengeDate, stardraftDailyResults.playerRace, stardraftDailyResults.participantId] })
      .returning({ id: stardraftDailyResults.id });

    // 하루에 종족마다 한 사람 한 줄: 더 좋은 기록일 때만 바꾼다(여러 번 도전해도 최고 기록만 남는다).
    let improved = inserted.length > 0;
    if (!improved && existing && stwDailyRecordIsBetter(existing, candidate)) {
      const updated = await db
        .update(stardraftDailyResults)
        .set(candidate)
        .where(and(mine, or(
          gt(stardraftDailyResults.elapsedTicks, candidate.elapsedTicks),
          and(eq(stardraftDailyResults.elapsedTicks, candidate.elapsedTicks), gt(stardraftDailyResults.lostValue, candidate.lostValue)),
        )))
        .returning({ id: stardraftDailyResults.id });
      improved = updated.length > 0;
    } else if (!improved && existing && existing.displayName !== displayName) {
      await db.update(stardraftDailyResults).set({ displayName }).where(mine);
    }

    return Response.json({
      accepted: true,
      improved,
      date: challenge.date,
      race,
      participant: await readParticipant(challenge.date, race, participantId),
    }, { status: inserted.length > 0 ? 201 : 200 });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "기록 형식이 올바르지 않습니다." }, { status: 400 });
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
