// 로컬 설정: 보정 오프셋, BPM, 판정 폭, 회피 감도, 고정 자세 모드. 서버에 보내지 않는다.

import { BPM_CHOICES, DEFAULT_BPM, normalizeBpm } from "./beat-clock.js";
import { DEFAULT_DODGE_THRESHOLD, DODGE_THRESHOLD_RANGE } from "./dodge-detector.js";

export const BAKSAL_SETTINGS_KEY = "baksal.settings.v1";

export const DEFAULT_BAKSAL_SETTINGS = Object.freeze({
  bpm: DEFAULT_BPM,
  windows: "standard",
  offsetMs: null,
  dodgeThreshold: DEFAULT_DODGE_THRESHOLD,
  fixedStance: false,
  metronomeVibration: false,
  runsPlayed: 0,
});

export function normalizeBaksalSettings(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const bpm = normalizeBpm(source.bpm);
  const threshold = Number(source.dodgeThreshold);
  return {
    bpm: BPM_CHOICES.includes(bpm) ? bpm : DEFAULT_BPM,
    windows: source.windows === "lenient" ? "lenient" : "standard",
    offsetMs: Number.isFinite(Number(source.offsetMs)) && source.offsetMs !== null ? Math.round(Number(source.offsetMs)) : null,
    dodgeThreshold: Number.isFinite(threshold)
      ? Math.min(DODGE_THRESHOLD_RANGE.max, Math.max(DODGE_THRESHOLD_RANGE.min, threshold))
      : DEFAULT_DODGE_THRESHOLD,
    fixedStance: Boolean(source.fixedStance),
    metronomeVibration: Boolean(source.metronomeVibration),
    runsPlayed: Math.max(0, Math.floor(Number(source.runsPlayed) || 0)),
  };
}

export function readBaksalSettings(getStorage = () => globalThis.localStorage) {
  try {
    const storage = getStorage();
    const raw = storage?.getItem(BAKSAL_SETTINGS_KEY);
    return normalizeBaksalSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeBaksalSettings(null);
  }
}

export function writeBaksalSettings(settings, getStorage = () => globalThis.localStorage) {
  const normalized = normalizeBaksalSettings(settings);
  try {
    getStorage()?.setItem(BAKSAL_SETTINGS_KEY, JSON.stringify(normalized));
  } catch {
    // 저장소를 쓸 수 없어도 게임은 진행된다.
  }
  return normalized;
}
