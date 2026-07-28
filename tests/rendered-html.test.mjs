import assert from "node:assert/strict";
import test from "node:test";
import { chooseAiHeld, describeAiHeld, shouldAiStop } from "../app/dice-ai.js";
import { scoreDice } from "../app/dice-scoring.js";
import {
  createRaceHorses,
  wcAvailableHorseIds,
  wcMoveHorse,
  wcSettleRace,
  wcSettleRaceMulti,
} from "../app/winners-circle-engine.js";
import {
  QWIXX_ROWS,
  qwixxApplyMark,
  qwixxCanMark,
  qwixxCrossScore,
  qwixxPlayerScore,
} from "../app/qwixx-engine.js";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Playroom game library", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>PLAYROOM — AI 보드게임 아지트<\/title>/i);
  assert.match(html, /PLAYROOM/);
  assert.match(html, /오목/);
  assert.match(html, /짝 맞추기/);
  assert.match(html, /리버시/);
  assert.match(html, /만칼라/);
  assert.match(html, /해전/);
  assert.match(html, /주사위 대결/);
  assert.match(html, /체커/);
  assert.match(html, /장기/);
  assert.match(html, /위너스 서클/);
  assert.match(html, /나인 멘스 모리스/);
  assert.match(html, /고누/);
  assert.match(html, /도미노/);
  assert.match(html, /백개먼/);
  assert.match(html, /차이니즈 체커/);
  assert.match(html, /다이아몬드 게임/);
  assert.match(html, /잉카 골드/);
  assert.match(html, /큐윅스/);
  assert.match(html, /열일곱 가지/);
  assert.match(html, /게임 이름 검색/);
  assert.match(html, /추가 되면 좋을 게임을 추천해주세요/);
  assert.match(html, /게임 추천 게시판/);
  assert.match(html, /id="game-suggestion"/i);
  assert.match(html, /maxlength="50"/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("applies Qwixx row direction, locking, and official scoring", () => {
  assert.deepEqual(QWIXX_ROWS.red, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(QWIXX_ROWS.blue, [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);

  let marks = { red: [], yellow: [], green: [], blue: [] };
  assert.equal(qwixxCanMark(marks, "red", 5), true);
  marks = qwixxApplyMark(marks, "red", 5);
  assert.equal(qwixxCanMark(marks, "red", 4), false);
  assert.equal(qwixxCanMark(marks, "red", 12), false);

  marks = { ...marks, red: [0, 1, 2, 3, 4] };
  assert.equal(qwixxCanMark(marks, "red", 12), true);
  assert.equal(qwixxCrossScore(6), 21);
  assert.equal(qwixxCrossScore(12), 78);
  assert.equal(qwixxPlayerScore({ marks, locks: ["red"], penalties: 1 }), 16);
});

test("scores dice with official Yahtzee lower-section values", () => {
  assert.deepEqual(scoreDice([6, 5, 5, 5, 6]), { score: 25, name: "풀하우스" });
  assert.deepEqual(scoreDice([4, 5, 2, 4, 5]), { score: 20, name: "찬스" });
  assert.deepEqual(scoreDice([6, 6, 6, 6, 5]), { score: 29, name: "포카드" });
  assert.deepEqual(scoreDice([6, 6, 6, 5, 4]), { score: 27, name: "트리플" });
  assert.deepEqual(scoreDice([1, 2, 3, 4, 4]), { score: 30, name: "스몰 스트레이트" });
  assert.deepEqual(scoreDice([2, 3, 4, 5, 6]), { score: 40, name: "라지 스트레이트" });
  assert.deepEqual(scoreDice([3, 3, 3, 3, 3]), { score: 50, name: "다섯 주사위!" });
});

test("AI preserves strong dice combinations and stops at completed scores", () => {
  assert.equal(shouldAiStop([1, 2, 3, 4, 5]), true);
  assert.equal(shouldAiStop([2, 3, 4, 5, 6]), true);
  assert.equal(shouldAiStop([6, 6, 6, 6, 6]), true);
  assert.equal(shouldAiStop([5, 5, 5, 2, 2]), true);
  assert.deepEqual(chooseAiHeld([1, 2, 3, 4, 5]), [true, true, true, true, true]);

  assert.equal(shouldAiStop([1, 2, 3, 4, 4]), false);
  assert.deepEqual(chooseAiHeld([1, 2, 3, 4, 4]), [true, true, true, true, false]);
  assert.equal(describeAiHeld([1, 2, 3, 4, 4], [true, true, true, true, false]), "1·2·3·4 눈 4개");

  assert.deepEqual(chooseAiHeld([6, 6, 5, 5, 2]), [true, true, true, true, false]);
  assert.deepEqual(chooseAiHeld([4, 4, 4, 2, 6]), [true, true, true, false, false]);
});

test("runs Winner's Circle movement cycles and race settlement", () => {
  const horses = createRaceHorses(1);
  assert.deepEqual(wcAvailableHorseIds(horses, []), [0, 1, 2, 3, 4, 5, 6]);

  let state = { horses, usedHorseIds: [], paceHorseId: null };
  for (const horse of horses) {
    state = wcMoveHorse(
      state.horses,
      horse.id,
      "horse",
      state.usedHorseIds,
      state.paceHorseId,
    );
  }
  assert.deepEqual(state.usedHorseIds, []);

  const finished = createRaceHorses(1).map((horse, index) => ({
    ...horse,
    position: index < 3 ? 32 : index,
    finishedRank: index < 3 ? index + 1 : null,
  }));
  const result = wcSettleRace(
    finished,
    [{ horseId: 0, value: 2 }, { horseId: 1, value: 1 }, { horseId: 6, value: 1 }],
    [{ horseId: 0, value: 1 }, { horseId: 2, value: 2 }, { horseId: 5, value: 1 }],
    0,
    3,
  );
  assert.equal(result.multiplier, 2);
  assert.equal(result.podium.length, 3);
  assert.ok(result.playerDelta > 0);
});

test("settles a six-player Winner's Circle race independently", () => {
  const finished = createRaceHorses(2).map((horse, index) => ({
    ...horse,
    position: index < 3 ? 32 : index,
    finishedRank: index < 3 ? index + 1 : null,
  }));
  const competitors = Array.from({ length: 6 }, (_, index) => ({
    id: index === 0 ? "player" : `ai-${index}`,
    bets: [
      { horseId: index % 3, value: 2 },
      { horseId: (index + 3) % 7, value: 1 },
      { horseId: (index + 4) % 7, value: 1 },
    ],
  }));
  const result = wcSettleRaceMulti(finished, competitors, 0, 1);
  assert.equal(result.results.length, 6);
  assert.ok(result.results.every((entry) => Number.isFinite(entry.delta)));
  assert.equal(result.podium.length, 3);
});
