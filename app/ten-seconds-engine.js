export const TEN_SECONDS_TARGET_MS = 10_000;

export function judgeTenSeconds(elapsedMs) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const difference = elapsed - TEN_SECONDS_TARGET_MS;
  const absoluteError = Math.abs(difference);
  const score = Math.max(0, Math.round(10_000 - absoluteError * 5));
  const rating = absoluteError <= 5
    ? "완벽"
    : absoluteError <= 50
      ? "전설"
      : absoluteError <= 100
        ? "달인"
        : absoluteError <= 250
          ? "고수"
          : absoluteError <= 500
            ? "성공"
            : "다시 도전";
  return { elapsed, difference, absoluteError, score, rating };
}

export function summarizeTenSeconds(elapsedValues) {
  const valid = elapsedValues.filter((value) => Number.isFinite(value) && value >= 0);
  if (!valid.length) return { rounds: 0, averageError: 0, bestError: 0, totalScore: 0, averageScore: 0 };
  const judged = valid.map(judgeTenSeconds);
  const totalScore = judged.reduce((sum, item) => sum + item.score, 0);
  return {
    rounds: judged.length,
    averageError: judged.reduce((sum, item) => sum + item.absoluteError, 0) / judged.length,
    bestError: Math.min(...judged.map((item) => item.absoluteError)),
    totalScore,
    averageScore: Math.round(totalScore / judged.length),
  };
}

export function formatTenSeconds(milliseconds, signed = false) {
  const value = Number(milliseconds) || 0;
  const prefix = signed ? value > 0 ? "+" : value < 0 ? "−" : "±" : "";
  return `${prefix}${(Math.abs(value) / 1000).toFixed(3)}초`;
}
