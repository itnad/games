// 스타드래프트 "오늘의 대전": 한국 시각 날짜마다 내 종족별로 하나씩, 세 가지 조건(상대 종족·맵·상대 전략·시드)이 정해지고, 누가 가장 빨리 이기는지 겨룬다.
// 상대 종족과 전략은 화면에 알리지 않는다(경기에서 정찰로 알아낸다).
// 조건을 정하는 규칙, 기록 비교, 서버가 받은 기록을 살피는 검사를 모은 순수 함수들이다(화면과 서버가 같은 함수를 쓴다).
import { STW_AI_PERSONAS, STW_MAP_IDS, STW_RACES } from "./stardraft-data.js";
import { STW_REPLAY_VERSION } from "./stardraft-replay.js";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
/** 오늘의 대전이 열리는 내 종족들(날마다 종족별로 하나씩). */
export const STW_DAILY_RACES = Object.keys(STW_RACES);
const RACE_IDS = STW_DAILY_RACES;

/** 내 종족 순서(프로토스·테란·저그)에 맞춘 상대 종족의 순서 여섯 가지. 하루의 세 대전은 서로 다른 종족을 상대한다. */
const ENEMY_ORDERS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

/** 오늘의 대전 난이도: 누구나 끝까지 갈 수 있게 보통으로 고정한다(겨루는 것은 승리 시간). */
export const STW_DAILY_DIFFICULTY = "normal";
/** 자정을 넘겨 끝난 경기를 전날 기록으로 받아 주는 시간(분). 경기 하나가 10~20분이라 한 시간을 둔다. */
export const STW_DAILY_GRACE_MINUTES = 60;
/** 받는 재현 코드의 한도: 글자 수와 명령 수. 13분 경기가 5~6KB, 명령 100개 남짓이다. */
export const STW_DAILY_REPLAY_MAX_CHARS = 200_000;
export const STW_DAILY_REPLAY_MAX_COMMANDS = 6_000;
/** 기록으로 받는 경기 시간의 한도(틱, 0.1초). 1시간. */
export const STW_DAILY_MAX_TICKS = 36_000;

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function stwKstDate(now = Date.now()) {
  return new Date(Number(now) + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 그 날짜에 그 종족으로 하는 대전의 조건. 날짜와 내 종족만으로 정해지므로 화면과 서버가 같은 값을 얻는다.
 * 상대 종족·전략·맵·시드는 종족마다 따로 정해진다. 상대 종족은 경기에서 가려 둔다(hidden).
 */
export function stwDailyChallengeForDate(date = stwKstDate(), race = RACE_IDS[0]) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : stwKstDate();
  const player = RACE_IDS.includes(race) ? race : RACE_IDS[0];
  // 상대 종족: 그 날의 세 대전이 서로 다른 종족을 만나도록, 날짜로 종족 순서 여섯 가지 가운데 하나를 고른다.
  const order = ENEMY_ORDERS[hashText(`stardraft-enemies:${day}`) % ENEMY_ORDERS.length];
  const enemy = RACE_IDS[order[RACE_IDS.indexOf(player)]];
  // 상대 전략: 그 종족의 전략 가운데, 내 종족 상대로 피하는 것(저그 상대 고스트)은 빼고 고른다.
  const personas = Object.values(STW_AI_PERSONAS).filter((persona) => persona.race === enemy && !persona.avoid?.includes(player)).map((persona) => persona.id);
  const persona = personas[hashText(`stardraft-persona:${day}:${player}:${enemy}`) % personas.length];
  const map = STW_MAP_IDS[hashText(`stardraft-map:${day}:${player}`) % STW_MAP_IDS.length];
  const seed = hashText(`stardraft-seed:${day}:${player}:${enemy}:${persona}:${map}`);
  return { date: day, difficulty: STW_DAILY_DIFFICULTY, races: { player, enemy }, persona, map, seed };
}

/** 그 날짜의 대전 세 가지(내 종족별). */
export function stwDailyChallengesForDate(date = stwKstDate()) {
  return RACE_IDS.map((race) => stwDailyChallengeForDate(date, race));
}

/** 오늘의 대전 경기를 만드는 설정(createStardraftGame에 그대로 넘긴다). 상대 종족은 정찰하기 전까지 가려 둔다. */
export function stwDailySetup(challenge) {
  return { difficulty: challenge.difficulty, seed: challenge.seed, aiSides: ["enemy"], races: { ...challenge.races }, personas: { enemy: challenge.persona }, map: challenge.map, hiddenEnemyRace: true };
}

/**
 * 기록을 받을 날짜: 요청이 말한 날짜가 오늘이면 오늘, 자정 뒤 한 시간 안이고 어제 날짜면 어제(자정을 넘겨 끝난 경기), 그 밖에는 null.
 */
export function stwDailyAcceptedDate(claimed, now = Date.now()) {
  const today = stwKstDate(now);
  if (claimed === today) return today;
  const yesterday = stwKstDate(Number(now) - 24 * 60 * 60 * 1000);
  const intoToday = (Number(now) + KST_OFFSET_MS) % (24 * 60 * 60 * 1000);
  return claimed === yesterday && intoToday < STW_DAILY_GRACE_MINUTES * 60 * 1000 ? yesterday : null;
}

export function normalizeStwDailyName(value) {
  if (typeof value !== "string") return "";
  return Array.from(value.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/\s+/g, " ")).slice(0, 12).join("");
}

export function stwDailyDefaultName(participantId) {
  const suffix = String(participantId ?? "").replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase() || "0000";
  return `지휘관 ${suffix}`;
}

export function validStwDailyParticipantId(value) {
  return typeof value === "string" && /^[a-z0-9-]{16,64}$/i.test(value);
}

/** 더 좋은 기록인지: 더 빨리 이긴 쪽, 같으면 잃은 병력 가치가 적은 쪽. */
export function stwDailyRecordIsBetter(current, candidate) {
  if (!candidate) return false;
  if (!current) return true;
  if (candidate.elapsedTicks !== current.elapsedTicks) return candidate.elapsedTicks < current.elapsedTicks;
  return candidate.lostValue < current.lostValue;
}

/** 끝난 오늘의 대전 경기에서 보낼 기록(이긴 경기만). 재현 코드는 따로 붙인다. */
export function stwDailyResult(state) {
  if (!state || state.status !== "over" || state.winner !== "player") return null;
  return { elapsedTicks: Math.round(state.time * 10), lostValue: Math.round(state.sides.player.stats.valueLost ?? 0) };
}

/**
 * 받은 재현 코드가 그 날의 조건으로 이긴 경기의 것인지 살핀다. 문제가 없으면 null, 있으면 이유를 돌려준다.
 * 경기를 다시 돌려 보지는 않는다(서버에서 돌리기에는 무겁다). 조건·끝 상태·크기만 본다.
 * 순위표에서 그 기록을 다시 볼 때 같은 끝이 나오는지로 누구나 확인할 수 있다.
 */
export function stwDailyReplayProblem(code, challenge, elapsedTicks) {
  if (!code || typeof code !== "object" || code.v !== STW_REPLAY_VERSION || code.scenario) return "재현 코드 형식이 맞지 않습니다";
  const setup = code.setup;
  if (!setup || typeof setup !== "object") return "재현 코드에 경기 설정이 없습니다";
  const personas = setup.personas ?? {};
  const sameConditions = setup.seed === challenge.seed && setup.difficulty === challenge.difficulty
    && setup.races?.player === challenge.races.player && setup.races?.enemy === challenge.races.enemy
    && (setup.map ?? "plain") === challenge.map && personas.enemy === challenge.persona && personas.player === undefined
    && Array.isArray(setup.aiSides) && setup.aiSides.length === 1 && setup.aiSides[0] === "enemy"
    && setup.hiddenEnemyRace === true && setup.learned === undefined && setup.spectate === undefined && setup.scoutReact === undefined;
  if (!sameConditions) return "오늘의 대전 조건과 다른 경기입니다";
  const commands = code.commands;
  if (!Array.isArray(commands) || commands.length > STW_DAILY_REPLAY_MAX_COMMANDS) return "명령 기록이 너무 깁니다";
  let previous = 0;
  for (const command of commands) {
    if (!Array.isArray(command) || command.length !== 3 || !Number.isInteger(command[0]) || command[0] < previous || command[1] !== "player" || !command[2] || typeof command[2] !== "object") return "명령 기록이 올바르지 않습니다";
    previous = command[0];
  }
  const end = code.end;
  if (!end || end.status !== "over" || end.winner !== "player") return "이긴 경기의 기록이 아닙니다";
  if (Math.round(Number(end.time) * 10) !== elapsedTicks || previous > elapsedTicks) return "경기 시간이 기록과 다릅니다";
  return null;
}

/** 틱(0.1초)을 "12:34.5"로. */
export function stwDailyClock(ticks) {
  const safe = Math.max(0, Math.round(Number(ticks) || 0));
  const seconds = Math.floor(safe / 10);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.${safe % 10}`;
}
