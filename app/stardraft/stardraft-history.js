// 스타드래프트 "최근 경기": 끝난 사람 대 AI 경기를 재현 코드와 함께 브라우저에 남겨, 메인 화면에서 기록을 보고 다시 볼 수 있게 한다.
import { STW_AI_PERSONAS, STW_DIFFICULTIES, STW_RACES } from "./stardraft-data.js";
import { STW_REPLAY_VERSION, stwReplayCode } from "./stardraft-replay.js";

/** 남겨 두는 경기 수. 재현 코드는 사람이 내린 명령 수에 비례한다(13분 경기에 5~6KB). */
export const STW_HISTORY_LIMIT = 10;

const RESULTS = ["won", "lost", "draw"];

/**
 * 끝난 경기의 기록 한 줄. 기록하지 않는 경기면 null:
 * 아직 안 끝난 경기, 실험실 경기, AI 대 AI 관전·다시 보기, 사람이 지휘하지 않은 경기.
 */
export function stwHistoryEntry(state, { build = "", at = Date.now() } = {}) {
  if (!state || state.status === "playing" || state.lab || state.spectate || state.aiSides?.includes("player")) return null;
  const replay = stwReplayCode(state, build);
  return {
    id: `${at}-${state.replay?.setup?.seed ?? 0}`,
    at,
    result: state.winner === "player" ? "won" : state.winner === "enemy" ? "lost" : "draw",
    time: Math.round(state.time),
    difficulty: state.difficulty,
    map: state.map ?? "plain",
    races: { player: state.sides.player.race, enemy: state.sides.enemy.race },
    persona: state.sides.enemy.persona ?? null,
    build,
    ...(replay ? { replay } : {}),
  };
}

/** 저장소에서 읽은 값을 기록 목록으로 다듬는다. 모양이 맞지 않는 줄은 버린다. */
export function stwHistoryNormalize(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === "object" && typeof entry.id === "string" && Number.isFinite(entry.at) && RESULTS.includes(entry.result)
      && Number.isFinite(entry.time) && STW_DIFFICULTIES[entry.difficulty] && STW_RACES[entry.races?.player] && STW_RACES[entry.races?.enemy])
    .map((entry) => ({
      ...entry,
      map: typeof entry.map === "string" ? entry.map : "plain",
      persona: STW_AI_PERSONAS[entry.persona] ? entry.persona : null,
      build: typeof entry.build === "string" ? entry.build : "",
      // 다시 볼 수 있는 것은 지금 형식의 재현 코드뿐이다.
      replay: entry.replay && entry.replay.v === STW_REPLAY_VERSION && (entry.replay.setup || entry.replay.scenario) ? entry.replay : undefined,
    }))
    .slice(0, STW_HISTORY_LIMIT);
}

/** 새 기록을 맨 앞에 넣고 오래된 것을 덜어 낸다. */
export function stwHistoryAdd(list, entry, limit = STW_HISTORY_LIMIT) {
  if (!entry) return stwHistoryNormalize(list);
  return [entry, ...stwHistoryNormalize(list).filter((item) => item.id !== entry.id)].slice(0, limit);
}

/** 남아 있는 기록의 승패 요약: 전체와 내 종족별. */
export function stwHistorySummary(list) {
  const summary = { total: 0, wins: 0, losses: 0, draws: 0, byRace: {} };
  for (const entry of stwHistoryNormalize(list)) {
    const race = (summary.byRace[entry.races.player] ??= { wins: 0, losses: 0, draws: 0 });
    const key = entry.result === "won" ? "wins" : entry.result === "lost" ? "losses" : "draws";
    summary.total += 1;
    summary[key] += 1;
    race[key] += 1;
  }
  return summary;
}
