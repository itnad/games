import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GAME_OBJECTIVES } from "../app/game-objectives.js";
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
import {
  CONFRONTATION_CARDS,
  confrontationMoveTargets,
  confrontationResolveCombat,
  confrontationWinner,
  createConfrontationPieces,
} from "../app/confrontation-engine.js";
import {
  LOVE_LETTER_CARD_COUNTS,
  loveLetterBuildDeck,
  loveLetterFavorTarget,
  loveLetterMustPlay,
  loveLetterRoundWinners,
  loveLetterSpyBonus,
  loveLetterValidTargets,
} from "../app/love-letter-engine.js";
import {
  MINIVILLE_ESTABLISHMENTS,
  minivilleApplyTrade,
  minivilleApplyTvStation,
  minivilleBuildLandmark,
  minivilleBuyEstablishment,
  minivilleCreateMarket,
  minivilleCreatePlayer,
  minivilleResolveBaseIncome,
  minivilleWinner,
} from "../app/miniville-engine.js";
import {
  PICK_PICNIC_YARDS,
  pickPicnicCreateDeck,
  pickPicnicCreateGame,
  pickPicnicDuel,
  pickPicnicGrainScore,
  pickPicnicHandSize,
  pickPicnicHumanConflicts,
  pickPicnicPlayerScore,
  pickPicnicResolveRound,
} from "../app/pick-picnic-engine.js";
import {
  EPIC_DUELS_MAPS,
  EPIC_DUELS_TEAMS,
  epicCreateDeck,
  epicCreateMatch,
  epicLineOfSight,
  epicReachableCells,
  epicResolveCombat,
} from "../app/epic-duels-engine.js";
import {
  SD_SPACE_BASES,
  sdCaptureResult,
  sdCreateBattleDeck,
  sdCreateSpaceGame,
  sdDuelResult,
  sdFortressCannonCells,
  sdFortressCreateGame,
  sdFortressReachable,
  sdFortressResolveBattle,
} from "../app/sd-gundam-deluxe-engine.js";
import {
  SY_EDGES,
  SY_NODES,
  SY_REVEAL_MOVES,
  syAdvanceCandidates,
  syChooseMrXMove,
  syCreateInitialState,
  syLegalMoves,
} from "../app/scotland-yard-engine.js";
import {
  WC_CROSSINGS,
  WC_LOCATIONS,
  WC_NIGHTS,
  WC_STREET_LINKS,
  wcAdjacentLocations,
  wcAdvanceCandidates,
  wcAlleyMoves,
  wcChooseJackMove,
  wcCreateGame,
  wcJackNormalMoves,
  wcPoliceMoves,
} from "../app/whitechapel-engine.js";
import {
  swBuildAgeDeck,
  swCanBuildCard,
  swChooseAiSelection,
  swCreateGame,
  swFinalRanking,
  swResolveSelections,
  swScorePlayer,
} from "../app/seven-wonders-engine.js";
import {
  cuChooseAiAction,
  cuCreateGame,
  cuMoveCamel,
  cuRanking,
  cuRollPyramid,
} from "../app/camel-up-engine.js";
import {
  tichuBuildDeck,
  tichuBomb,
  tichuChooseAiAction,
  tichuClassify,
  tichuCompleteGrand,
  tichuCreateGame,
  tichuNextRound,
  tichuResolvePassing,
} from "../app/tichu-engine.js";
import {
  CFE_DEALS,
  CFE_INNER_TRACK,
  cfeBorrow,
  cfeChooseAiAction,
  cfeCreateGame,
  cfeFinancials,
  cfeRepayLiability,
  cfeResolvePending,
} from "../app/cashflow-escape-engine.js";
import {
  baccaratCreateGame,
  baccaratNextRound,
  baccaratPayout,
  baccaratPlayRound,
  baccaratPoint,
  baccaratResolveHands,
  baccaratShouldBankerDraw,
} from "../app/baccarat-engine.js";

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

test("provides a complete objective and victory guide for every game", async () => {
  const expectedGameIds = [
    "gomoku",
    "memory",
    "reversi",
    "mancala",
    "battleship",
    "dice",
    "checkers",
    "janggi",
    "winners-circle",
    "nine-mens-morris",
    "gonu",
    "domino",
    "backgammon",
    "chinese-checkers",
    "diamond",
    "incan-gold",
    "qwixx",
    "confrontation",
    "love-letter",
    "miniville",
    "pick-picnic",
    "epic-duels",
    "sd-gundam-deluxe",
    "scotland-yard",
    "whitechapel",
    "seven-wonders",
    "camel-up",
    "tichu",
    "cashflow-escape",
    "baccarat",
  ];

  assert.deepEqual(Object.keys(GAME_OBJECTIVES).sort(), expectedGameIds.sort());
  for (const [gameId, guide] of Object.entries(GAME_OBJECTIVES)) {
    for (const field of ["title", "summary", "objective", "victory", "finish"]) {
      assert.equal(
        typeof guide[field],
        "string",
        `${gameId}의 ${field} 항목이 문자열이어야 합니다.`,
      );
      assert.ok(
        guide[field].trim().length > 0,
        `${gameId}의 ${field} 항목이 비어 있습니다.`,
      );
    }
  }

  const guideSource = await readFile(
    new URL("../app/game-objective-guide.tsx", import.meta.url),
    "utf8",
  );
  assert.match(guideSource, /게임 목표/);
  assert.match(guideSource, /승리 조건/);
  assert.match(guideSource, /게임 종료 시점/);

  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.equal(
    [...pageSource.matchAll(/<GuidedGame gameId=\{activeGame\}>/g)].length,
    expectedGameIds.length,
  );
});

test("applies the shared readable typography contract to every current and future game", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const layoutSource = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/game-readability.css", import.meta.url), "utf8");
  const guide = await readFile(new URL("../docs/game-ui-readability.md", import.meta.url), "utf8");

  assert.match(pageSource, /className="game-readability-scope"/);
  assert.match(pageSource, /data-game-id=\{gameId\}/);
  assert.match(layoutSource, /game-readability\.css/);
  assert.match(styles, /--game-font-body:\s*clamp\(15px/);
  assert.match(styles, /--game-font-control:\s*clamp\(15px/);
  assert.match(styles, /--game-font-meta:\s*clamp\(13px/);
  assert.match(styles, /--game-font-compact:\s*12px/);
  assert.match(guide, /12px.*미만의 보이는 텍스트를 새로 추가하지 않는다/);
});

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
  assert.match(html, /빛과 그림자의 대결/);
  assert.match(html, /러브레터/);
  assert.match(html, /미니빌/);
  assert.match(html, /픽 피크닉/);
  assert.match(html, /스타워즈 에픽 듀얼/);
  assert.match(html, /SD 간담 디럭스/);
  assert.match(html, /스코틀랜드 야드/);
  assert.match(html, /화이트채플/);
  assert.match(html, /7원더스/);
  assert.match(html, /카멜 업/);
  assert.match(html, /티츄/);
  assert.match(html, /현금흐름 탈출/);
  assert.match(html, /바카라/);
  assert.match(html, /서른 가지/);
  assert.match(html, /게임 이름 검색/);
  assert.match(html, /추가 되면 좋을 게임을 추천해주세요/);
  assert.match(html, /게임 추천 게시판/);
  assert.match(html, /id="game-suggestion"/i);
  assert.match(html, /maxlength="50"/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("runs a complete 3-to-7 player Seven Wonders draft", () => {
  for (const playerCount of [3, 4, 5, 6, 7]) {
    for (const age of [1, 2, 3]) {
      const deck = swBuildAgeDeck(age, playerCount, () => 0.42);
      assert.equal(deck.length, playerCount * 7);
      assert.equal(new Set(deck.map((card) => card.id)).size, deck.length);
      if (age === 3) {
        assert.equal(deck.filter((card) => card.color === "purple").length, playerCount + 2);
      }
    }

    let game = swCreateGame(playerCount, "strategist", () => 0.37);
    assert.equal(game.players.length, playerCount);
    assert.ok(game.hands.every((hand) => hand.length === 7));
    assert.ok(game.hands[0].some((card) => swCanBuildCard(game.players, 0, card)));
    assert.equal(typeof swScorePlayer(game.players[0], game.players).total, "number");

    let turns = 0;
    while (game.phase !== "finished" && turns < 20) {
      const choices = game.players.map((_, playerIndex) => {
        const choice = swChooseAiSelection(game, playerIndex);
        assert.ok(["build", "wonder", "discard"].includes(choice.action));
        assert.ok(choice.cardIndex >= 0 && choice.cardIndex < game.hands[playerIndex].length);
        return choice;
      });
      game = swResolveSelections(game, choices);
      turns += 1;
    }

    assert.equal(turns, 18);
    assert.equal(game.phase, "finished");
    assert.equal(game.result.length, playerCount);
    assert.deepEqual(game.result, swFinalRanking(game.players));
    assert.ok(game.result.every((entry) => Number.isFinite(entry.score.total)));
    assert.ok(game.players.every((player) => player.conflict.length <= 6));
    assert.ok(game.players.flatMap((player) => player.conflict).every((token) => [-1, 1, 3, 5].includes(token)));
  }
});

test("runs Camel Up stacking, pyramid legs, and 3-to-8 player races", () => {
  const stacked = cuCreateGame(3, "balanced", () => 0.2);
  stacked.track = Object.fromEntries(Object.keys(stacked.track).map((position) => [position, []]));
  stacked.track[2] = ["red", "yellow", "green"];
  const moved = cuMoveCamel(stacked, "yellow", 2);
  assert.deepEqual(moved.track[2], ["red"]);
  assert.deepEqual(moved.track[4], ["yellow", "green"]);
  assert.deepEqual(cuRanking(moved.track).slice(0, 3), ["green", "yellow", "red"]);

  for (const playerCount of [3, 4, 5, 6, 7, 8]) {
    let game = cuCreateGame(playerCount, "sharp", Math.random);
    let turns = 0;
    while (game.phase !== "finished" && turns < 500) {
      game = cuChooseAiAction(game, game.currentPlayer, Math.random);
      turns += 1;
    }
    assert.equal(game.phase, "finished");
    assert.equal(game.standings.length, playerCount);
    assert.ok(game.standings.every((player) => player.coins >= 0));
    assert.ok(game.leg >= 1);
  }

  const roll = cuCreateGame(3, "balanced", () => 0.1);
  const afterRoll = cuRollPyramid(roll, 0, () => 0);
  assert.equal(afterRoll.revealed.length, 1);
  assert.equal(afterRoll.players[0].pyramidTickets, 1);
});

test("runs Tichu combinations, team rounds, and a complete match", () => {
  const deck = tichuBuildDeck();
  assert.equal(deck.length, 56);
  assert.equal(new Set(deck.map((card) => card.id)).size, 56);
  assert.equal(deck.filter((card) => card.special).length, 4);
  assert.equal(deck.reduce((sum, card) => sum + card.points, 0), 100);

  const cards = Object.fromEntries(deck.map((card) => [card.id, card]));
  assert.equal(tichuClassify([cards["jade-8"], cards["sword-8"]]).type, "pair");
  assert.equal(tichuClassify([cards["jade-7"], cards["sword-7"], cards["pagoda-7"], cards["star-7"]]).type, "bomb");
  assert.equal(tichuClassify([cards["jade-3"], cards["jade-4"], cards["jade-5"], cards["jade-6"], cards["jade-7"]]).label, "스트레이트 플러시 폭탄");
  assert.equal(tichuClassify([cards["jade-9"], cards["sword-9"], cards["pagoda-9"], cards["jade-4"], cards.phoenix]).type, "full-house");

  const bombGame = tichuCreateGame("balanced", 500, () => 0.4);
  bombGame.phase = "playing";
  bombGame.currentPlayer = 1;
  bombGame.currentCombo = tichuClassify([cards["jade-14"]]);
  bombGame.table = [{ playerId: 1, cards: [cards["jade-14"]], combo: bombGame.currentCombo }];
  bombGame.lastPlayer = 1;
  bombGame.players[0].hand = [cards["jade-7"], cards["sword-7"], cards["pagoda-7"], cards["star-7"], cards["jade-2"]];
  const bombed = tichuBomb(bombGame, 0, ["jade-7", "sword-7", "pagoda-7", "star-7"]);
  assert.equal(bombed.currentCombo.type, "bomb");
  assert.equal(bombed.lastPlayer, 0);
  assert.equal(bombed.players[0].hand.length, 1);

  let seed = 20260730;
  const random = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  let game = tichuCreateGame("sharp", 500, random);
  let actions = 0;
  let rounds = 0;
  while (game.phase !== "finished" && actions < 5000) {
    if (game.phase === "grand") game = tichuCompleteGrand(game, false);
    else if (game.phase === "passing") game = tichuResolvePassing(game, game.players[0].hand.slice(0, 3).map((card) => card.id));
    else if (game.phase === "playing") game = tichuChooseAiAction(game, game.currentPlayer, random);
    else if (game.phase === "round-end") {
      rounds += 1;
      game = tichuNextRound(game, random);
    }
    actions += 1;
  }
  assert.equal(game.phase, "finished");
  assert.ok(game.scores.some((score) => score >= 500));
  assert.ok(game.round >= 1);
  assert.ok(rounds < 30);
  assert.ok(actions < 5000);
});

test("runs Cashflow Escape financial statements, debt, and 2-to-6 player journeys", () => {
  assert.equal(CFE_INNER_TRACK.length, 24);
  assert.ok(CFE_DEALS.some((deal) => deal.category === "realestate"));
  assert.ok(CFE_DEALS.some((deal) => deal.category === "stock"));
  assert.ok(CFE_DEALS.some((deal) => deal.category === "business"));

  const financeGame = cfeCreateGame(2, "balanced", () => 0.3);
  const before = cfeFinancials(financeGame.players[0]);
  const debt = financeGame.players[0].liabilities.find((item) => item.balance <= financeGame.players[0].cash);
  if (debt) {
    const repaid = cfeRepayLiability(financeGame, 0, debt.id);
    const after = cfeFinancials(repaid.players[0]);
    assert.equal(after.totalExpenses, before.totalExpenses - debt.payment);
    assert.equal(repaid.players[0].cash, financeGame.players[0].cash - debt.balance);
  }
  const borrowed = cfeBorrow(financeGame, 0, 100);
  assert.equal(borrowed.players[0].bankLoan, 100);
  assert.equal(cfeFinancials(borrowed.players[0]).totalExpenses, before.totalExpenses + 10);

  const pending = cfeCreateGame(2, "balanced", () => 0.2);
  pending.pending = { kind: "deal", playerId: 0, card: CFE_DEALS[0] };
  pending.players[0].cash = CFE_DEALS[0].cost + 100;
  const invested = cfeResolvePending(pending, 0, "buy");
  assert.equal(invested.players[0].assets.length, 1);
  assert.equal(cfeFinancials(invested.players[0]).passiveIncome, CFE_DEALS[0].income);

  for (const playerCount of [2, 3, 4, 5, 6]) {
    let seed = 9070 + playerCount;
    const random = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    let game = cfeCreateGame(playerCount, "sharp", random);
    let actions = 0;
    while (game.phase !== "finished" && actions < 4000) {
      game = cfeChooseAiAction(game, game.currentPlayer, random);
      actions += 1;
    }
    assert.equal(game.phase, "finished", `${playerCount}인 게임이 완주되어야 합니다.`);
    assert.ok(game.winner >= 0 && game.winner < playerCount);
    assert.equal(game.standings.length, playerCount);
    assert.ok(game.players.some((player) => player.stage === "growth"));
    assert.ok(actions < 4000);
  }
});

test("applies official commission Baccarat points, third-card table, and session settlement", () => {
  const card = (value, id = String(value)) => ({ id, value, rank: id, suit: "spade", symbol: "♠", color: "black" });
  assert.equal(baccaratPoint([card(7), card(8)]), 5);
  assert.equal(baccaratPoint([card(10), card(9)]), 9);

  assert.equal(baccaratShouldBankerDraw(2, 8), true);
  assert.equal(baccaratShouldBankerDraw(3, 8), false);
  assert.equal(baccaratShouldBankerDraw(3, 7), true);
  assert.equal(baccaratShouldBankerDraw(4, 1), false);
  assert.equal(baccaratShouldBankerDraw(4, 2), true);
  assert.equal(baccaratShouldBankerDraw(5, 4), true);
  assert.equal(baccaratShouldBankerDraw(6, 5), false);
  assert.equal(baccaratShouldBankerDraw(6, 6), true);
  assert.equal(baccaratShouldBankerDraw(7, 7), false);
  assert.equal(baccaratShouldBankerDraw(5, null), true);
  assert.equal(baccaratShouldBankerDraw(6, null), false);

  const draws = [card(4, "player-third"), card(2, "banker-third")];
  const resolved = baccaratResolveHands(
    [card(2, "p1"), card(3, "p2")],
    [card(2, "b1"), card(2, "b2")],
    () => draws.shift(),
  );
  assert.equal(resolved.playerDrew, true);
  assert.equal(resolved.bankerDrew, true);
  assert.equal(resolved.playerTotal, 9);
  assert.equal(resolved.bankerTotal, 6);
  assert.equal(resolved.winner, "player");

  let extraDraws = 0;
  const natural = baccaratResolveHands(
    [card(4, "np1"), card(4, "np2")],
    [card(3, "nb1"), card(3, "nb2")],
    () => { extraDraws += 1; return card(1); },
  );
  assert.equal(natural.natural, true);
  assert.equal(extraDraws, 0);
  assert.equal(baccaratPayout("player", "player", 100), 100);
  assert.equal(baccaratPayout("banker", "banker", 100), 95);
  assert.equal(baccaratPayout("tie", "tie", 100), 800);
  assert.equal(baccaratPayout("player", "tie", 100), 0);

  let game = baccaratCreateGame({ roundLimit: 10, startingChips: 1000 }, () => 0.42);
  while (game.phase !== "finished") {
    if (game.phase === "betting") game = baccaratPlayRound(game, "player", 10);
    else game = baccaratNextRound(game);
  }
  assert.equal(game.history.length, 10);
  assert.equal(game.round, 10);
  assert.equal(game.stats.player + game.stats.banker + game.stats.tie, 10);
  assert.ok(Number.isFinite(game.chips));
});

test("runs Scotland Yard hidden movement, tickets, and fair AI", () => {
  assert.equal(SY_NODES.length, 96);
  assert.equal(new Set(SY_NODES.map((node) => node.id)).size, 96);
  assert.deepEqual(SY_REVEAL_MOVES, [3, 8, 13, 18, 24]);
  assert.ok(["taxi", "bus", "underground", "ferry"].every(
    (transport) => SY_EDGES.some((edge) => edge.transport === transport),
  ));

  const detectiveMoves = syLegalMoves(37, {
    tickets: { taxi: 11, bus: 8, underground: 4 },
    occupied: [38],
  });
  assert.ok(detectiveMoves.every((move) => move.transport !== "ferry"));
  assert.ok(detectiveMoves.every((move) => move.to !== 38));

  const bobbyMoves = syLegalMoves(37, {
    tickets: { taxi: 0, bus: 0, underground: 0 },
    isBobby: true,
  });
  assert.ok(bobbyMoves.length > 0);
  assert.ok(bobbyMoves.every((move) => move.transport !== "ferry"));

  const mrXMoves = syLegalMoves(37, {
    occupied: [],
    isMrX: true,
    blackTickets: 1,
  });
  assert.ok(mrXMoves.some((move) => move.transport === "ferry"));

  const visibleCandidates = syAdvanceCandidates([37], "taxi");
  const blackCandidates = syAdvanceCandidates([37], "black");
  assert.ok(visibleCandidates.every((node) => blackCandidates.includes(node)));
  assert.ok(blackCandidates.length > visibleCandidates.length);

  const aiMove = syChooseMrXMove({
    node: 43,
    detectiveNodes: [1, 12, 85, 96],
    difficulty: "inspector",
    blackTickets: 5,
    random: () => 0.42,
  });
  assert.ok(aiMove);
  assert.ok(![1, 12, 85, 96].includes(aiMove.to));

  const state = syCreateInitialState(() => 0.42);
  assert.equal(state.detectives.length, 4);
  assert.equal(new Set(state.detectives.map((piece) => piece.node)).size, 4);
  assert.ok(!state.detectives.some((piece) => piece.node === state.mrX.node));
  assert.equal(state.mrX.blackTickets, 5);
  assert.equal(state.mrX.doubleTickets, 2);
});

test("runs Whitechapel nights, dual map, clues, and hidden movement", () => {
  assert.equal(WC_NIGHTS.length, 4);
  assert.deepEqual(WC_NIGHTS.map((night) => night.kills), [1, 1, 2, 1]);
  assert.ok(WC_NIGHTS.every((night) => night.maxMoves === 15));
  assert.equal(WC_LOCATIONS.length, 84);
  assert.equal(WC_CROSSINGS.length, 66);
  assert.ok(WC_STREET_LINKS.length > WC_LOCATIONS.length);

  const adjacent = wcAdjacentLocations("c1");
  assert.ok(adjacent.length >= 2);
  const normal = wcJackNormalMoves(adjacent[0], []);
  assert.ok(normal.length > 0);
  assert.ok(wcJackNormalMoves(adjacent[0], ["c1"]).length < normal.length);
  assert.ok(wcAlleyMoves(adjacent[0]).length > 0);

  const police = wcPoliceMoves("c1", [], 2);
  assert.ok(police.some((move) => move.distance === 0));
  assert.ok(police.some((move) => move.distance === 2));
  assert.ok(police.every((move) => move.distance <= 2));

  const candidates = wcAdvanceCandidates([adjacent[0]], "normal", []);
  const coachCandidates = wcAdvanceCandidates([adjacent[0]], "coach", []);
  assert.ok(candidates.length > 0);
  assert.ok(coachCandidates.length > 0);

  const game = wcCreateGame("inspector", () => 0.42);
  assert.equal(game.night, 1);
  assert.equal(game.phase, "patrol");
  assert.equal(game.women.length, 8);
  assert.equal(game.targets.length, 5);
  assert.ok(game.targets.every((target) => game.women.includes(target)));

  const move = wcChooseJackMove({
    location: game.targets[0],
    hideout: game.hideout,
    policeCrossings: ["c1", "c11", "c22", "c44", "c66"],
    coaches: 3,
    alleys: 2,
    movesUsed: 0,
    difficulty: "inspector",
    random: () => 0.42,
  });
  assert.ok(move);
  assert.ok(["normal", "coach", "alley"].includes(move.type));
});

test("runs SD Gundam Deluxe space and fortress manual rules", () => {
  const deck = sdCreateBattleDeck(() => 0.42);
  assert.equal(deck.length, 36);
  assert.equal(SD_SPACE_BASES.length, 10);

  const space = sdCreateSpaceGame(6, () => 0.42);
  assert.equal(space.players.length, 6);
  assert.ok(space.players.every((player) => player.hand.length === 3));
  assert.equal(space.deck.length, 18);

  const base = { hp: 200 };
  assert.deepEqual(
    sdCaptureResult([{ hp: 120 }, { hp: 90 }], base),
    { total: 210, success: true },
  );
  assert.equal(sdCaptureResult([{ hp: 100 }, { hp: 100 }], base).success, false);
  assert.equal(sdDuelResult({ hp: 140 }, { hp: 120 }).winner, 0);
  assert.equal(sdDuelResult({ hp: 140 }, { hp: 140 }).winner, null);

  const fortress = sdFortressCreateGame(2, () => 0.42);
  assert.equal(fortress.pieces.filter((piece) => piece.side === 0).length, 9);
  assert.equal(fortress.pieces.filter((piece) => piece.side === 1).length, 9);
  const fourPlayerFortress = sdFortressCreateGame(4, () => 0.42);
  assert.equal(fourPlayerFortress.pieces.length, 36);
  const reachable = sdFortressReachable(fortress, "0-0", 5);
  assert.ok(reachable.length > 0);
  assert.ok(reachable.every(([row, column]) => row >= 0 && row < 9 && column >= 0 && column < 9));

  const cannon = sdFortressCannonCells([4, 0], "right", 8);
  assert.deepEqual(cannon.at(-1), [4, 3], "the central obstacle stops the particle cannon");
  assert.equal(
    sdFortressResolveBattle({ hp: 100 }, { hp: 110 }, [7, 2], [0, 0]).winner,
    0,
    "the +30 terrain bonus applies to the attacker",
  );
});

test("includes Qwixx game rules and a guided tutorial", async () => {
  const source = await readFile(new URL("../app/qwixx-game.tsx", import.meta.url), "utf8");
  assert.match(source, /게임 방법/);
  assert.match(source, /게임 목표/);
  assert.match(source, /최종 점수가 가장 높은 사람이 승리/);
  assert.match(source, /튜토리얼/);
  assert.match(source, /공용 합/);
  assert.match(source, /개인 조합/);
  assert.match(source, /줄 잠금/);
  assert.match(source, /점수 계산/);
  assert.match(source, /QWIXX_TUTORIAL\.length/);
});

test("builds all twelve 31-card Epic Duels teams and resolves combat", () => {
  assert.equal(EPIC_DUELS_TEAMS.length, 12);
  assert.equal(EPIC_DUELS_MAPS.length, 4);
  for (const team of EPIC_DUELS_TEAMS) {
    const deck = epicCreateDeck(team.id, () => 0.42);
    assert.equal(deck.length, 31, `${team.id} deck`);
    assert.equal(deck.filter((card) => card.type === "basic").length, 19);
    assert.equal(deck.filter((card) => card.type !== "basic").length, 12);
  }

  const match = epicCreateMatch("luke", "vader", "geonosis", () => 0.42);
  assert.equal(match.players[0].hand.length, 4);
  assert.equal(match.players[1].hand.length, 4);
  assert.equal(match.players[0].figures.length, 2);
  assert.equal(match.players[1].figures.length, 3);

  const reachable = epicReachableCells(match, "0-major", 3);
  assert.ok(reachable.length > 0);
  assert.ok(reachable.every(([row, column]) => row >= 0 && row <= 8 && column >= 0 && column <= 8));

  const attacker = { hp: 17 };
  const defender = { hp: 20 };
  assert.deepEqual(
    epicResolveCombat(
      attacker,
      defender,
      { attack: 8, defense: null, effect: "none" },
      { attack: 1, defense: 3, effect: "none" },
      {},
    ),
    { attack: 8, defense: 3, damage: 5, reflected: 0 },
  );
  assert.equal(
    epicResolveCombat(
      attacker,
      defender,
      { attack: 3, defense: null, effect: "unblocked-twenty" },
      null,
      {},
    ).damage,
    20,
  );

  const rangedMatch = structuredClone(match);
  rangedMatch.players[0].figures[1].pos = [4, 0];
  rangedMatch.players[1].figures[0].pos = [4, 8];
  assert.equal(epicLineOfSight(rangedMatch, rangedMatch.players[0].figures[1], rangedMatch.players[1].figures[0]), false);
  rangedMatch.mapId = "kamino";
  rangedMatch.players
    .flatMap((player) => player.figures)
    .filter((figure) => !["0-minor-0", "1-major"].includes(figure.id))
    .forEach((figure, index) => { figure.pos = [0, index]; });
  assert.equal(epicLineOfSight(rangedMatch, rangedMatch.players[0].figures[1], rangedMatch.players[1].figures[0]), true);
});

test("runs Pick Picknic feeding, sharing, fox, and duel rules", () => {
  const deck = pickPicnicCreateDeck(() => 0.42);
  assert.equal(deck.length, 42);
  assert.equal(deck.filter((card) => card.kind === "bird").length, 30);
  assert.equal(deck.filter((card) => card.kind === "fox").length, 12);
  assert.equal(pickPicnicHandSize(2), 6);
  assert.equal(pickPicnicHandSize(4), 5);

  const created = pickPicnicCreateGame(4, () => 0.42);
  assert.equal(created.players.length, 4);
  assert.ok(created.players.every((player) => player.hand.length === 5));
  assert.equal(created.yards.length, 6);
  assert.ok(created.yards.every((yard) => yard.grains.length === 1));
  assert.equal(created.bag.length, 60);

  const birdA = { uid: "a", yardId: "yellow", kind: "bird", value: 3, name: "닭" };
  const birdB = { uid: "b", yardId: "yellow", kind: "bird", value: 5, name: "닭" };
  const fox = { uid: "f", yardId: "yellow", kind: "fox", value: 4, name: "여우" };
  const fleet = { uid: "m", yardId: "yellow", kind: "bird", value: -2, name: "겁쟁이 닭" };
  const players = [
    { id: 0, name: "나", hand: [birdA, fox], grains: { green: 0, blue: 0, gold: 0 }, captured: [] },
    { id: 1, name: "AI", hand: [birdB, fleet], grains: { green: 0, blue: 0, gold: 0 }, captured: [] },
  ];
  const yards = PICK_PICNIC_YARDS.map((yard) => ({
    ...yard,
    grains: yard.id === "yellow" ? ["green", "blue", "gold"] : [],
  }));
  const base = { players, yards, deck: [], discard: [], bag: [], lastRound: false };

  const birdPlays = [{ playerId: 0, card: birdA }, { playerId: 1, card: birdB }];
  assert.deepEqual(pickPicnicHumanConflicts(birdPlays), ["yellow"]);
  const shared = pickPicnicResolveRound(base, birdPlays, { yellow: "share" }, () => 0);
  assert.equal(shared.yards[0].grains.length, 0);
  assert.equal(
    pickPicnicPlayerScore(shared.players[0]) + pickPicnicPlayerScore(shared.players[1]),
    6,
  );

  const hunted = pickPicnicResolveRound(
    base,
    [{ playerId: 0, card: fox }, { playerId: 1, card: birdB }],
    {},
    () => 0,
  );
  assert.equal(hunted.players[0].captured[0].value, 5);
  assert.equal(hunted.yards[0].grains.length, 3);

  const fleetHunt = pickPicnicResolveRound(
    base,
    [{ playerId: 0, card: fox }, { playerId: 1, card: fleet }],
    {},
    () => 0,
  );
  assert.equal(fleetHunt.players[0].captured[0].value, -2);
  assert.equal(fleetHunt.players[1].grains.green, 1);
  assert.equal(pickPicnicGrainScore(fleetHunt.players[1].grains), 1);

  const duel = pickPicnicDuel(birdPlays, () => 0);
  assert.equal(duel.winner.playerId, 1);
});

test("labels Pick Picknic grain blocks with visible point values", async () => {
  const source = await readFile(new URL("../app/pick-picnic-game.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/pick-picnic.css", import.meta.url), "utf8");
  assert.match(source, /<b>\{grainInfo\.value\}<\/b>/);
  assert.match(source, /먹이 블록 점수 안내/);
  assert.match(source, /\{grain\.name\} <strong>\{grain\.value\}점<\/strong>/);
  assert.match(styles, /\.picnic-grains i b/);
  assert.match(styles, /\.picnic-inline-legend/);
});

test("runs Miniville income, construction, trade, and landmark rules", () => {
  assert.equal(MINIVILLE_ESTABLISHMENTS.length, 15);
  const market = minivilleCreateMarket();
  assert.equal(market.wheat, 6);
  assert.equal(market.stadium, 4);

  const player = minivilleCreatePlayer(0, "나");
  const rival = {
    ...minivilleCreatePlayer(1, "AI"),
    cards: { wheat: 1, bakery: 1, cafe: 1 },
  };
  const income = minivilleResolveBaseIncome([player, rival], 0, 3);
  assert.equal(income.players[0].coins, 3);
  assert.equal(income.players[1].coins, 4);

  const mallPlayer = { ...player, landmarks: ["mall"] };
  const mallIncome = minivilleResolveBaseIncome([mallPlayer, minivilleCreatePlayer(1, "AI")], 0, 3);
  assert.equal(mallIncome.players[0].coins, 5);

  const factoryPlayer = {
    ...player,
    cards: { wheat: 1, bakery: 1, ranch: 2, "cheese-factory": 1 },
  };
  const factoryIncome = minivilleResolveBaseIncome([factoryPlayer, minivilleCreatePlayer(1, "AI")], 0, 7);
  assert.equal(factoryIncome.players[0].coins, 9);

  const richRival = { ...rival, coins: 8 };
  const tv = minivilleApplyTvStation([player, richRival], 0, 1);
  assert.equal(tv.paid, 5);
  assert.equal(tv.players[0].coins, 8);
  assert.equal(tv.players[1].coins, 3);

  const traded = minivilleApplyTrade([player, rival], 0, 1, "wheat", "cafe");
  assert.equal(traded[0].cards.wheat, 0);
  assert.equal(traded[0].cards.cafe, 1);
  assert.equal(traded[1].cards.wheat, 2);
  assert.equal(traded[1].cards.cafe, 0);

  const bought = minivilleBuyEstablishment([{ ...player, coins: 5 }], market, 0, "forest");
  assert.equal(bought.bought, true);
  assert.equal(bought.players[0].coins, 2);
  assert.equal(bought.market.forest, 5);

  let landmarkPlayers = [{ ...player, coins: 60 }];
  for (const id of ["station", "mall", "amusement", "radio"]) {
    landmarkPlayers = minivilleBuildLandmark(landmarkPlayers, 0, id).players;
  }
  assert.equal(minivilleWinner(landmarkPlayers), 0);
});

test("runs the official 21-card Love Letter rules", () => {
  const deck = loveLetterBuildDeck(() => 0.5);
  assert.equal(deck.length, 21);
  assert.deepEqual(
    deck.reduce((counts, card) => ({ ...counts, [card.value]: (counts[card.value] ?? 0) + 1 }), {}),
    LOVE_LETTER_CARD_COUNTS,
  );
  assert.equal(loveLetterFavorTarget(2), 6);
  assert.equal(loveLetterFavorTarget(4), 4);
  assert.equal(loveLetterFavorTarget(6), 3);

  const countess = { uid: "countess", value: 8 };
  assert.equal(loveLetterMustPlay([countess, { uid: "king", value: 7 }]), "countess");
  assert.equal(loveLetterMustPlay([countess, { uid: "prince", value: 5 }]), "countess");
  assert.equal(loveLetterMustPlay([countess, { uid: "guard", value: 1 }]), null);

  const players = [
    { id: 0, alive: true, protected: false, hand: [{ value: 5 }], discarded: [{ value: 0 }] },
    { id: 1, alive: true, protected: true, hand: [{ value: 4 }], discarded: [] },
    { id: 2, alive: true, protected: false, hand: [{ value: 5 }], discarded: [] },
  ];
  assert.deepEqual(loveLetterValidTargets(players, 0, 1), [2]);
  assert.deepEqual(loveLetterValidTargets(players, 0, 5), [2, 0]);
  assert.deepEqual(loveLetterRoundWinners(players), [0, 2]);
  assert.equal(loveLetterSpyBonus(players), 0);

  const sharedSpies = players.map((player) =>
    player.id === 2 ? { ...player, discarded: [{ value: 0 }] } : player,
  );
  assert.equal(loveLetterSpyBonus(sharedSpies), null);
});

test("runs hidden confrontation movement, combat, and victory conditions", () => {
  const pieces = createConfrontationPieces(() => 0.42);
  assert.equal(pieces.length, 18);
  assert.equal(pieces.filter((piece) => piece.side === "dawn").length, 9);
  assert.equal(pieces.filter((piece) => piece.side === "shadow").length, 9);
  assert.equal(CONFRONTATION_CARDS.length, 9);

  const dawnFront = pieces.find((piece) => piece.side === "dawn" && piece.regionId !== "dawn-hold");
  const targets = confrontationMoveTargets(dawnFront, pieces);
  assert.ok(targets.length > 0);
  assert.ok(targets.every((region) => region.level > 1));

  const attacker = { id: "a", side: "dawn", strength: 4, ability: "brave" };
  const defender = { id: "d", side: "shadow", strength: 5, ability: "none" };
  const result = confrontationResolveCombat(
    attacker,
    defender,
    CONFRONTATION_CARDS.find((card) => card.id === "power-3"),
    CONFRONTATION_CARDS.find((card) => card.id === "power-1"),
    "old-ford",
  );
  assert.equal(result.attackerTotal, 8);
  assert.equal(result.defenderTotal, 6);
  assert.deepEqual(result.defeated, ["d"]);

  const bearer = pieces.find((piece) => piece.ability === "bearer");
  const winningPieces = pieces.map((piece) =>
    piece.id === bearer.id ? { ...piece, regionId: "shadow-hold" } : piece,
  );
  assert.equal(confrontationWinner(winningPieces), "dawn");
  assert.equal(confrontationWinner(pieces.map((piece) => piece.id === bearer.id ? { ...piece, alive: false } : piece)), "shadow");
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
