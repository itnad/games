const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const FIRST_DAILY_STAGE = 2;
const DAILY_STAGE_COUNT = 7;

export const MUDFLAT_DAILY_PARTICIPANT_KEY = "paperoid-mudflat-daily-participant-v1";
export const MUDFLAT_DAILY_NAME_KEY = "paperoid-mudflat-daily-name-v1";

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function mudflatKstDate(now = Date.now()) {
  return new Date(Number(now) + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function mudflatDailyChallengeForDate(date = mudflatKstDate()) {
  const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : mudflatKstDate();
  const stageHash = hashText(`haeru-stage:${normalizedDate}`);
  const stage = FIRST_DAILY_STAGE + stageHash % DAILY_STAGE_COUNT;
  const seed = hashText(`haeru-seed:${normalizedDate}:${stage}`);
  return { date: normalizedDate, stage, seed };
}

export function normalizeMudflatDailyName(value) {
  if (typeof value !== "string") return "";
  return Array.from(value.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/\s+/g, " ")).slice(0, 12).join("");
}

export function mudflatDailyDefaultName(participantId) {
  const suffix = String(participantId ?? "").replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase() || "0000";
  return `갯벌꾼 ${suffix}`;
}

export function validMudflatDailyParticipantId(value) {
  return typeof value === "string" && /^[a-z0-9-]{16,64}$/i.test(value);
}
