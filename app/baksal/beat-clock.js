// 박자 시계: 오디오 클럭 시각(초)과 박 번호를 서로 바꾼다.
// 판정 창과 BPM의 설계 의도는 docs/baksal-game-design.md 4절에 있다. 최종 원본은 이 파일의 상수다.

export const BEATS_PER_BAR = 4;
export const COUNT_IN_BEATS = 4;

export const JUDGMENT_WINDOWS_MS = Object.freeze({
  standard: Object.freeze({ ttak: 90, joa: 180 }),
  lenient: Object.freeze({ ttak: 150, joa: 300 }),
});

export const DEFAULT_BPM = 80;
export const BPM_CHOICES = Object.freeze([70, 80, 90]);

export function normalizeBpm(value) {
  const bpm = Number(value);
  if (!Number.isFinite(bpm)) return DEFAULT_BPM;
  return Math.min(200, Math.max(40, Math.round(bpm)));
}

export function secondsPerBeat(bpm) {
  return 60 / normalizeBpm(bpm);
}

/** 시작 시각 이후 흐른 박(실수). 카운트인은 음수 박으로 표현된다. */
export function beatAtTime(time, { bpm, startTime }) {
  return (time - startTime) / secondsPerBeat(bpm) - COUNT_IN_BEATS;
}

export function timeOfBeat(beat, { bpm, startTime }) {
  return startTime + (beat + COUNT_IN_BEATS) * secondsPerBeat(bpm);
}

/** 가장 가까운 정박과의 차이(ms, 늦으면 양수). */
export function nearestBeatOffset(beat, bpm) {
  const nearest = Math.round(beat);
  return { beat: nearest, offsetMs: (beat - nearest) * secondsPerBeat(bpm) * 1000 };
}

/** 마디 첫 박(0, 4, 8, ...)과의 차이. 정화 판정에 쓴다. */
export function nearestBarStartOffset(beat, bpm) {
  const nearest = Math.round(beat / BEATS_PER_BAR) * BEATS_PER_BAR;
  return { beat: nearest, offsetMs: (beat - nearest) * secondsPerBeat(bpm) * 1000 };
}

export function judgeOffset(offsetMs, windows = JUDGMENT_WINDOWS_MS.standard) {
  const distance = Math.abs(offsetMs);
  if (distance <= windows.ttak) return "ttak";
  if (distance <= windows.joa) return "joa";
  return "miss";
}

export const JUDGMENT_LABELS = Object.freeze({ ttak: "딱", joa: "좋아", miss: "놓침" });
export const JUDGMENT_DAMAGE_MULTIPLIER = Object.freeze({ ttak: 2, joa: 1, miss: 0.5 });

export function barOfBeat(beat) {
  return Math.floor(beat / BEATS_PER_BAR);
}

export function beatInBar(beat) {
  return ((Math.floor(beat) % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR;
}

/** 입력 시각 보정: 사용자가 보정 화면에서 측정한 오프셋(ms)을 뺀다. */
export function correctInputBeat(beat, bpm, offsetMs) {
  return beat - (Number(offsetMs) || 0) / 1000 / secondsPerBeat(bpm);
}

/** 보정 화면: 탭 오프셋 목록에서 중앙값을 구한다. 극단값 2개를 버린다. */
export function calibrationOffsetMs(offsets) {
  const values = offsets.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (values.length === 0) return 0;
  const trimmed = values.length >= 5 ? values.slice(1, -1) : values;
  const middle = Math.floor(trimmed.length / 2);
  const median = trimmed.length % 2 === 0 ? (trimmed[middle - 1] + trimmed[middle]) / 2 : trimmed[middle];
  return Math.round(Math.max(-250, Math.min(250, median)));
}
