// 도감과 런 기록: 로컬 저장소에만 둔다. 서버에 보내지 않는다.

import { GHOST_TYPE_IDS, masteryLevel } from "./baksal-ghosts.js";
import { unlockedTalismanIds } from "./baksal-talismans.js";

export const BAKSAL_CODEX_KEY = "baksal.codex.v1";
const HISTORY_LIMIT = 20;

export function emptyCodex() {
  return { ghosts: {}, totalPurified: 0, runs: [], best: 0 };
}

export function normalizeCodex(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const ghosts = {};
  for (const id of GHOST_TYPE_IDS) {
    const entry = source.ghosts?.[id] ?? {};
    ghosts[id] = { seen: Math.max(0, Math.floor(Number(entry.seen) || 0)), purified: Math.max(0, Math.floor(Number(entry.purified) || 0)) };
  }
  const runs = Array.isArray(source.runs)
    ? source.runs.filter((run) => run && typeof run === "object").slice(0, HISTORY_LIMIT).map((run) => ({
      at: Number(run.at) || 0,
      score: Math.max(0, Math.floor(Number(run.score) || 0)),
      failed: Boolean(run.failed),
      roomsCleared: Math.max(0, Math.floor(Number(run.roomsCleared) || 0)),
      bpm: Number(run.bpm) || 80,
      maxCombo: Math.max(0, Math.floor(Number(run.maxCombo) || 0)),
    }))
    : [];
  return {
    ghosts,
    totalPurified: Math.max(0, Math.floor(Number(source.totalPurified) || 0)),
    runs,
    best: Math.max(0, Math.floor(Number(source.best) || 0)),
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
 */
export function recordRun(codex, summary, { at = Date.now() } = {}) {
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
  after.totalPurified += summary.purified ?? 0;
  const unlockedBefore = unlockedTalismanIds(before.totalPurified);
  const unlockedAfter = unlockedTalismanIds(after.totalPurified);
  const newTalismans = unlockedAfter.filter((id) => !unlockedBefore.includes(id));
  after.runs = [{
    at,
    score: summary.score ?? 0,
    failed: Boolean(summary.failed),
    roomsCleared: summary.roomsCleared ?? 0,
    bpm: summary.bpm ?? 80,
    maxCombo: summary.maxCombo ?? 0,
  }, ...after.runs].slice(0, HISTORY_LIMIT);
  after.best = Math.max(after.best, summary.score ?? 0);
  return { codex: after, newEntries, masteryUps, newTalismans, isBest: (summary.score ?? 0) > before.best };
}

export function codexMastery(codex, type) {
  return masteryLevel(codex?.ghosts?.[type]?.purified ?? 0);
}
