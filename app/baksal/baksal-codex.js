// 도감과 런 기록: 로컬 저장소에만 둔다. 서버에 보내지 않는다.
// 오늘의 순찰 결과는 도감(조우·정화)에는 반영하지만 일반 런 기록·최고 점수·부적 해금 수와는 격리한다.

import { GHOST_TYPE_IDS, masteryLevel } from "./baksal-ghosts.js";
import { unlockedTalismanIds } from "./baksal-talismans.js";

export const BAKSAL_CODEX_KEY = "baksal.codex.v1";
export const BAKSAL_EXPORT_FORMAT = "baksal-save";
export const BAKSAL_EXPORT_VERSION = 1;
const HISTORY_LIMIT = 20;
const ACTIVITY_DAYS = 7;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function kstDate(now) {
  return new Date(Number(now) + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function nonNegativeInteger(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

export function emptyCodex() {
  return { ghosts: {}, totalPurified: 0, runs: [], best: 0, activity: {}, daily: null };
}

function normalizeActivity(raw) {
  const activity = {};
  if (!raw || typeof raw !== "object") return activity;
  const dates = Object.keys(raw).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort().slice(-ACTIVITY_DAYS * 2);
  for (const date of dates) {
    const entry = raw[date] ?? {};
    activity[date] = {
      runs: nonNegativeInteger(entry.runs),
      rotation: nonNegativeInteger(entry.rotation),
      dodges: nonNegativeInteger(entry.dodges),
      seconds: nonNegativeInteger(entry.seconds),
    };
  }
  return activity;
}

export function normalizeCodex(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const ghosts = {};
  for (const id of GHOST_TYPE_IDS) {
    const entry = source.ghosts?.[id] ?? {};
    ghosts[id] = { seen: nonNegativeInteger(entry.seen), purified: nonNegativeInteger(entry.purified) };
  }
  const runs = Array.isArray(source.runs)
    ? source.runs.filter((run) => run && typeof run === "object").slice(0, HISTORY_LIMIT).map((run) => ({
      at: Number(run.at) || 0,
      score: nonNegativeInteger(run.score),
      failed: Boolean(run.failed),
      roomsCleared: nonNegativeInteger(run.roomsCleared),
      bpm: Number(run.bpm) || 80,
      maxCombo: nonNegativeInteger(run.maxCombo),
    }))
    : [];
  const daily = source.daily && typeof source.daily === "object" && /^\d{4}-\d{2}-\d{2}$/.test(source.daily.date ?? "")
    ? { date: source.daily.date, best: nonNegativeInteger(source.daily.best), attempts: nonNegativeInteger(source.daily.attempts) }
    : null;
  return {
    ghosts,
    totalPurified: nonNegativeInteger(source.totalPurified),
    runs,
    best: nonNegativeInteger(source.best),
    activity: normalizeActivity(source.activity),
    daily,
  };
}

export function readCodex(getStorage = () => globalThis.localStorage) {
  try {
    const raw = getStorage()?.getItem(BAKSAL_CODEX_KEY);
    return normalizeCodex(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeCodex(null);
  }
}

export function writeCodex(codex, getStorage = () => globalThis.localStorage) {
  const normalized = normalizeCodex(codex);
  try {
    getStorage()?.setItem(BAKSAL_CODEX_KEY, JSON.stringify(normalized));
  } catch {
    // 저장소를 쓸 수 없어도 게임은 진행된다.
  }
  return normalized;
}

/**
 * 런 결과를 도감에 반영한다. 돌려주는 값에는 새로 등록된 악귀, 숙련이 오른 악귀,
 * 새로 열린 부적이 들어 있어 결과 화면이 그대로 보여 준다.
 * daily가 참이면 도감과 활동량만 갱신하고 일반 기록·해금 수는 건드리지 않는다.
 * @param {object} codex
 * @param {object} summary
 * @param {{ at?: number, rotation?: number, seconds?: number, daily?: boolean, dailyDate?: string | null }} [options]
 */
export function recordRun(codex, summary, { at = Date.now(), rotation = 0, seconds = 0, daily = false, dailyDate = null } = {}) {
  const before = normalizeCodex(codex);
  const after = normalizeCodex(before);
  const newEntries = [];
  const masteryUps = [];
  for (const [type, counts] of Object.entries(summary.ghostStats ?? {})) {
    if (!after.ghosts[type]) continue;
    const previous = before.ghosts[type];
    after.ghosts[type].seen += counts.seen ?? 0;
    after.ghosts[type].purified += counts.purified ?? 0;
    if (previous.seen === 0 && after.ghosts[type].seen > 0) newEntries.push(type);
    const levelBefore = masteryLevel(previous.purified);
    const levelAfter = masteryLevel(after.ghosts[type].purified);
    if (levelAfter > levelBefore) masteryUps.push({ type, level: levelAfter });
  }

  const date = kstDate(at);
  const today = after.activity[date] ?? { runs: 0, rotation: 0, dodges: 0, seconds: 0 };
  after.activity[date] = {
    runs: today.runs + 1,
    rotation: today.rotation + nonNegativeInteger(rotation),
    dodges: today.dodges + nonNegativeInteger(summary.dodges?.ok),
    seconds: today.seconds + nonNegativeInteger(seconds),
  };
  after.activity = normalizeActivity(after.activity);

  let newTalismans = [];
  let isBest = false;
  if (daily) {
    const sameDay = after.daily?.date === dailyDate;
    after.daily = {
      date: dailyDate ?? date,
      best: Math.max(sameDay ? after.daily.best : 0, nonNegativeInteger(summary.score)),
      attempts: (sameDay ? after.daily.attempts : 0) + 1,
    };
    isBest = !sameDay || nonNegativeInteger(summary.score) > (before.daily?.best ?? 0);
  } else {
    after.totalPurified += summary.purified ?? 0;
    const unlockedBefore = unlockedTalismanIds(before.totalPurified);
    const unlockedAfter = unlockedTalismanIds(after.totalPurified);
    newTalismans = unlockedAfter.filter((id) => !unlockedBefore.includes(id));
    after.runs = [{
      at,
      score: summary.score ?? 0,
      failed: Boolean(summary.failed),
      roomsCleared: summary.roomsCleared ?? 0,
      bpm: summary.bpm ?? 80,
      maxCombo: summary.maxCombo ?? 0,
    }, ...after.runs].slice(0, HISTORY_LIMIT);
    isBest = (summary.score ?? 0) > before.best;
    after.best = Math.max(after.best, summary.score ?? 0);
  }
  return { codex: after, newEntries, masteryUps, newTalismans, isBest };
}

export function codexMastery(codex, type) {
  return masteryLevel(codex?.ghosts?.[type]?.purified ?? 0);
}

/** 최근 7일(KST, 오늘 포함) 활동량 합계. */
export function weeklyActivity(codex, now = Date.now()) {
  const total = { runs: 0, rotation: 0, dodges: 0, seconds: 0, days: 0 };
  for (let offset = 0; offset < ACTIVITY_DAYS; offset += 1) {
    const entry = codex?.activity?.[kstDate(now - offset * DAY_MS)];
    if (!entry) continue;
    total.runs += entry.runs;
    total.rotation += entry.rotation;
    total.dodges += entry.dodges;
    total.seconds += entry.seconds;
    if (entry.runs > 0) total.days += 1;
  }
  return total;
}

/** 내보내기: 도감과 설정만 담는다. 오늘의 순찰 참가자 식별값은 넣지 않는다. */
export function exportBaksalSave(codex, settings, { at = Date.now() } = {}) {
  return JSON.stringify({
    format: BAKSAL_EXPORT_FORMAT,
    version: BAKSAL_EXPORT_VERSION,
    exportedAt: new Date(at).toISOString(),
    codex: normalizeCodex(codex),
    settings: settings ?? null,
  }, null, 2);
}

/** 가져오기: 형식을 확인하고 정규화한다. 실패하면 이유를 돌려준다. */
export function parseBaksalSave(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text));
  } catch {
    return { ok: false, reason: "json" };
  }
  if (!parsed || parsed.format !== BAKSAL_EXPORT_FORMAT) return { ok: false, reason: "format" };
  if (Number(parsed.version) > BAKSAL_EXPORT_VERSION) return { ok: false, reason: "version" };
  return { ok: true, codex: normalizeCodex(parsed.codex), settings: parsed.settings && typeof parsed.settings === "object" ? parsed.settings : null };
}
