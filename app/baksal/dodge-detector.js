// 회피 동작 인식: 기기 좌표 가속도(중력 제외)의 순간 충격으로 네 동작을 구분한다.
// 세로로 세워 든 폰 기준: x는 화면 오른쪽, y는 화면 위쪽, z는 사용자 쪽이다.
// 어느 창에서 어떤 동작이 필요한지는 엔진이 판단한다. 이 모듈은 "언제 어떤 충격이 있었나"만 말한다.

export const DODGE_GESTURES = Object.freeze(["duck", "left", "right", "back"]);
export const DODGE_GESTURE_LABELS = Object.freeze({
  duck: "숙이기",
  left: "왼쪽 피하기",
  right: "오른쪽 피하기",
  back: "젖히기",
});

export const DEFAULT_DODGE_THRESHOLD = 4.5;
export const DODGE_THRESHOLD_RANGE = Object.freeze({ min: 2.5, max: 9 });
export const DODGE_REFRACTORY_MS = 350;

export function classifyImpulse(sample, threshold = DEFAULT_DODGE_THRESHOLD) {
  const x = Number(sample.x) || 0;
  const y = Number(sample.y) || 0;
  const z = Number(sample.z) || 0;
  const candidates = [
    { gesture: y < 0 ? "duck" : null, magnitude: Math.abs(y) },
    { gesture: x < 0 ? "left" : "right", magnitude: Math.abs(x) },
    { gesture: z > 0 ? "back" : null, magnitude: Math.abs(z) },
  ].filter((candidate) => candidate.gesture);
  candidates.sort((a, b) => b.magnitude - a.magnitude);
  const best = candidates[0];
  if (!best || best.magnitude < threshold) return null;
  return best.gesture;
}

/**
 * 연속 샘플을 받아 동작 이벤트를 돌려준다. 같은 동작의 흔들림이 여러 샘플에 걸쳐도
 * 불응 시간 안에서는 한 번만 인식한다.
 */
export function createDodgeDetector({ threshold = DEFAULT_DODGE_THRESHOLD, refractoryMs = DODGE_REFRACTORY_MS } = {}) {
  let lastGestureAt = -Infinity;
  let gravity = null;
  const detector = {
    threshold,
    setThreshold(value) {
      const next = Number(value);
      if (Number.isFinite(next)) {
        detector.threshold = Math.min(DODGE_THRESHOLD_RANGE.max, Math.max(DODGE_THRESHOLD_RANGE.min, next));
      }
    },
    /** 중력이 제외된 가속도 샘플 {t(ms), x, y, z}. */
    push(sample) {
      const gesture = classifyShake(sample) ?? classifyImpulse(sample, detector.threshold);
      if (!gesture) return null;
      if (sample.t - lastGestureAt < refractoryMs) return null;
      lastGestureAt = sample.t;
      return { gesture, t: sample.t };
    },
    /** 중력 포함 가속도만 제공되는 기기용. 저역 통과로 중력을 추정해 뺀다. */
    pushWithGravity(sample) {
      const alpha = 0.12;
      if (!gravity) {
        gravity = { x: sample.x, y: sample.y, z: sample.z };
        return null;
      }
      gravity = {
        x: gravity.x + (sample.x - gravity.x) * alpha,
        y: gravity.y + (sample.y - gravity.y) * alpha,
        z: gravity.z + (sample.z - gravity.z) * alpha,
      };
      return detector.push({ t: sample.t, x: sample.x - gravity.x, y: sample.y - gravity.y, z: sample.z - gravity.z });
    },
    reset() {
      lastGestureAt = -Infinity;
      gravity = null;
    },
  };
  return detector;
}

/**
 * 걷기 감지: 1초 창 안에 세로 방향 충격이 주기적으로 반복되면 걷는 것으로 본다.
 * 런 중에는 플레이어가 걷지 않아야 하므로 일시정지 신호로 쓴다.
 */
export function createWalkDetector({ windowMs = 2000, minSteps = 4, stepThreshold = 2.2 } = {}) {
  const peaks = [];
  let above = false;
  return {
    push(sample) {
      const vertical = Math.abs(Number(sample.y) || 0);
      if (!above && vertical > stepThreshold) {
        above = true;
        peaks.push(sample.t);
      } else if (above && vertical < stepThreshold * 0.5) {
        above = false;
      }
      while (peaks.length && sample.t - peaks[0] > windowMs) peaks.shift();
      if (peaks.length < minSteps) return false;
      const intervals = peaks.slice(1).map((t, index) => t - peaks[index]);
      const regular = intervals.every((gap) => gap >= 280 && gap <= 900);
      return regular;
    },
    reset() {
      peaks.length = 0;
      above = false;
    },
  };
}

/** 긴급 결계용 흔들기: 어느 축이든 큰 충격이면 흔들기로 본다. 회피보다 먼저 검사한다. */
export const SHAKE_THRESHOLD = 16;

export function classifyShake(sample, threshold = SHAKE_THRESHOLD) {
  const magnitude = Math.hypot(Number(sample.x) || 0, Number(sample.y) || 0, Number(sample.z) || 0);
  return magnitude >= threshold ? "shake" : null;
}
