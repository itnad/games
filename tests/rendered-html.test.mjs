import assert from "node:assert/strict";
import test from "node:test";
import { scoreDice } from "../app/dice-scoring.js";
import {
  createRaceHorses,
  wcAvailableHorseIds,
  wcMoveHorse,
  wcSettleRace,
} from "../app/winners-circle-engine.js";

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
  assert.match(html, /게임 이름 검색/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
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
