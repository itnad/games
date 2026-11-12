import assert from "node:assert/strict";
import test from "node:test";
import {
  mudflatDailyChallengeForDate,
  mudflatDailyDefaultName,
  mudflatDailyRecordIsBetter,
  mudflatKstDate,
  normalizeMudflatDailyName,
  validMudflatDailyParticipantId,
} from "../app/mudflat-daily-challenge.js";

test("today's mudflat uses a stable KST date, stage and seed", () => {
  assert.equal(mudflatKstDate(Date.parse("2026-11-08T15:30:00Z")), "2026-11-09");
  assert.deepEqual(mudflatDailyChallengeForDate("2026-11-09"), {
    date: "2026-11-09",
    stage: 5,
    seed: 3797903052,
  });
  assert.deepEqual(mudflatDailyChallengeForDate("2026-11-09"), mudflatDailyChallengeForDate("2026-11-09"));
});

test("daily ranking keeps only a better successful return without counting attempts", () => {
  const current = { completed: true, score: 1200, caught: 40, elapsed: 150 };
  assert.equal(mudflatDailyRecordIsBetter(current, { completed: false, score: 0, caught: 60, elapsed: 100 }), false);
  assert.equal(mudflatDailyRecordIsBetter(current, { completed: true, score: 1199, caught: 99, elapsed: 90 }), false);
  assert.equal(mudflatDailyRecordIsBetter(current, { completed: true, score: 1200, caught: 41, elapsed: 160 }), true);
  assert.equal(mudflatDailyRecordIsBetter(current, { completed: true, score: 1200, caught: 40, elapsed: 149 }), true);
  assert.equal(mudflatDailyRecordIsBetter(current, { completed: true, score: 1200, caught: 40, elapsed: 150 }), false);
  assert.equal(mudflatDailyRecordIsBetter({ completed: false, score: 0, caught: 0, elapsed: 20 }, { completed: true, score: 1, caught: 1, elapsed: 200 }), true);
});

test("daily stages rotate only through the comparable regular stages", () => {
  const challenges = Array.from({ length: 31 }, (_, day) => mudflatDailyChallengeForDate(`2026-12-${String(day + 1).padStart(2, "0")}`));
  assert.ok(challenges.every(({ stage, seed }) => stage >= 2 && stage <= 8 && Number.isInteger(seed) && seed > 0));
  assert.ok(new Set(challenges.map(({ stage }) => stage)).size >= 6);
});

test("daily identities and public names are bounded before submission", () => {
  assert.equal(normalizeMudflatDailyName("  갯벌\n 최고   선수  "), "갯벌 최고 선수");
  assert.equal(Array.from(normalizeMudflatDailyName("가나다라마바사아자차카타파하")).length, 12);
  assert.equal(mudflatDailyDefaultName("12345678-abcd-ef00"), "갯벌꾼 EF00");
  assert.equal(validMudflatDailyParticipantId("12345678-abcd-ef00"), true);
  assert.equal(validMudflatDailyParticipantId("short"), false);
});
