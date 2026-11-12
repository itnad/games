// 오늘의 순찰: KST 날짜마다 서버가 정하는 시드 런과 점수판. 서버와 클라이언트가 같이 쓰는 순수 규칙이다.
// 참가자 식별값은 익명이며 응답·내보내기에 넣지 않는다. 조건(시드·템포·강화)은 서버만 정한다.

import { BEATS_PER_BAR } from "./beat-clock.js";
import { createRunChart } from "./baksal-chart.js";
import { SCORE } from "./baksal-engine.js";
import { BASE_TALISMAN_IDS } from "./baksal-talismans.js";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const BAKSAL_DAILY_BPM = 80;
export const BAKSAL_DAILY_TALISMANS = BASE_TALISMAN_IDS;
/** 결계 목표: 그날 참가자 전원의 하루 최고 점수 합. 못 미치면 다음 날 원귀가 하나 늘어난다. */
export const BAKSAL_BARRIER_TARGET = 30_000;
export const BAKSAL_DAILY_PARTICIPANT_KEY = "paperoid-baksal-daily-participant-v1";
export const BAKSAL_DAILY_NAME_KEY = "paperoid-baksal-daily-name-v1";
export const BAKSAL_DAILY_NAME_MAX = 12;

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function baksalKstDate(now = Date.now()) {
  return new Date(Number(now) + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function baksalPreviousDate(date) {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return baksalKstDate(Date.now() - DAY_MS);
  return new Date(parsed - DAY_MS).toISOString().slice(0, 10);
}

/** 오늘의 조건. reinforced는 서버가 전날 결계 합계를 보고 정한다. */
export function baksalDailyChallengeForDate(date = baksalKstDate(), { reinforced = false } = {}) {
  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : baksalKstDate();
  return {
    date: normalizedDate,
    seed: hashText(`baksal-seed:${normalizedDate}`),
    bpm: BAKSAL_DAILY_BPM,
    reinforced: Boolean(reinforced),
  };
}

export function baksalDailyChart(challenge) {
  return createRunChart(challenge.seed, { bpm: challenge.bpm, reinforced: challenge.reinforced });
}

export function baksalBarrierStatus(total, target = BAKSAL_BARRIER_TARGET) {
  const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
  return { total: safeTotal, target, ratio: Math.min(1, safeTotal / target), holding: safeTotal >= target };
}

export function normalizeBaksalDailyName(value) {
  if (typeof value !== "string") return "";
  return Array.from(value.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/\s+/g, " ")).slice(0, BAKSAL_DAILY_NAME_MAX).join("");
}

export function baksalDailyDefaultName(participantId) {
  const suffix = String(participantId ?? "").replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase() || "0000";
  return `야경꾼 ${suffix}`;
}

export function validBaksalDailyParticipantId(value) {
  return typeof value === "string" && /^[a-z0-9-]{16,64}$/i.test(value);
}

/** 하루 최고 기록 비교: 점수, 통과한 방, 최대 콤보, 남은 체력 순. */
export function baksalDailyRecordIsBetter(current, candidate) {
  if (!candidate) return false;
  if (!current) return true;
  if (candidate.score !== current.score) return candidate.score > current.score;
  if (candidate.roomsCleared !== current.roomsCleared) return candidate.roomsCleared > current.roomsCleared;
  if (candidate.maxCombo !== current.maxCombo) return candidate.maxCombo > current.maxCombo;
  return candidate.remainingHp > current.remainingHp;
}

/** 채보에서 나올 수 있는 최대 수치. 이론상 불가능한 기록만 거른다. 정교한 치트 대응은 하지 않는다. */
export function baksalChartLimits(chart) {
  const ghosts = chart.ghosts.length;
  const attacks = chart.ghosts.reduce((sum, ghost) => sum + ghost.attacks.length, 0);
  const beats = chart.lengthBeats + BEATS_PER_BAR;
  // 한 박에 사격이 판정을 받는 횟수는 빠른 연타로 늘 수 있으니 박당 4회로 넉넉하게 잡는다.
  const judged = beats * 4;
  const perAction = SCORE.ttak + SCORE.destroy + SCORE.weak + SCORE.comboCap * 8;
  const maxScore = judged * perAction + attacks * (SCORE.dodge + SCORE.comboCap * 8) + ghosts * (SCORE.purify + SCORE.comboCap * 8);
  return { ghosts, attacks, beats, judged, maxScore, maxCombo: judged + attacks + ghosts, rooms: chart.rooms.length };
}

export function baksalDailyResultIsPlausible(chart, result) {
  const limits = baksalChartLimits(chart);
  const within = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;
  return within(result.score, limits.maxScore)
    && within(result.maxCombo, limits.maxCombo)
    && within(result.roomsCleared, limits.rooms)
    && within(result.purified, limits.ghosts)
    && within(result.dodges, limits.attacks)
    && within(result.judged, limits.judged)
    && within(result.ttak, result.judged)
    && within(result.remainingHp, 10)
    && (!result.completed || result.roomsCleared === limits.rooms);
}
