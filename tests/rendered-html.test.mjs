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
  assert.match(html, /스물네 가지/);
  assert.match(html, /게임 이름 검색/);
  assert.match(html, /추가 되면 좋을 게임을 추천해주세요/);
  assert.match(html, /게임 추천 게시판/);
  assert.match(html, /id="game-suggestion"/i);
  assert.match(html, /maxlength="50"/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
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
