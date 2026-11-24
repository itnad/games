// Only the hidden route entry applies this preset. Ordinary starts stay fresh.
export function withSecretExpeditionSkills(campaign) {
  if (campaign.mode !== "normal") return campaign;
  return {
    ...campaign,
    levels: { ...campaign.levels, electric: 5, basket: 5, rocker: 5, "cast-net": 1 },
  };
}

// 제목 화면의 게 그림을 짧은 간격으로 연속 터치하면 개발 도구 페이지로 간다.
// taps는 최근 터치 시각 목록. 창(windowMs) 밖의 터치는 버리고, count번째 터치에서 triggered를 돌려주며 목록을 비운다.
export const MUDFLAT_DEV_TAP_COUNT = 4;
export const MUDFLAT_DEV_TAP_WINDOW_MS = 1500;
export function registerDevEntryTap(taps = [], now = 0, count = MUDFLAT_DEV_TAP_COUNT, windowMs = MUDFLAT_DEV_TAP_WINDOW_MS) {
  const recent = (Array.isArray(taps) ? taps : []).filter((at) => Number.isFinite(at) && now - at >= 0 && now - at <= windowMs);
  recent.push(now);
  if (recent.length >= count) return { taps: [], triggered: true };
  return { taps: recent, triggered: false };
}
