import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { GAME_OBJECTIVES } from "../app/game-objectives.js";
import { chooseAiHeld, describeAiHeld, shouldAiStop } from "../app/dice-ai.js";
import { scoreDice } from "../app/dice-scoring.js";
import {
  BATTLESHIP_SEA_SIZE,
  BATTLESHIP_SHIP_LENGTHS,
  applyCheckerMove,
  battleshipRemainingShips,
  checkerMoves,
  createBattleshipFleet,
} from "../app/classic-rules-engine.js";
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
  hasKoreanFinalConsonant,
  withKoreanAnd,
  withKoreanDirection,
  withKoreanObject,
  withKoreanSubject,
  withKoreanTopic,
} from "../app/korean-particles.js";
import {
  PAPER_DUNGEON_CLASSES,
  PAPER_DUNGEON_ENEMIES,
  choosePaperDungeonReward,
  createPaperDungeonRun,
  isPaperDungeonSave,
  resolvePaperDungeonAction,
} from "../app/paper-dungeon-engine.js";
import {
  TEN_SECONDS_TARGET_MS,
  formatTenSeconds,
  judgeTenSeconds,
  summarizeTenSeconds,
} from "../app/ten-seconds-engine.js";
import {
  MUDFLAT_CREATURES,
  MUDFLAT_JOYSTICK_RADIUS,
  MUDFLAT_RUN_SECONDS,
  mudflatCreatureForTime,
  mudflatFinalScore,
  mudflatJoystickVector,
  mudflatSpawnInterval,
  mudflatUpgradeChoices,
} from "../app/mudflat-survivor-engine.js";
import {
  EPIC_DUELS_MAPS,
  EPIC_DUELS_TEAMS,
  epicCreateDeck,
  epicCreateMatch,
  epicLineOfSight,
  epicMovementRoll,
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
  SY_MAX_ROUNDS,
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
  wcCreateNightSetup,
  wcJackNormalMoves,
  wcPoliceMoves,
} from "../app/whitechapel-engine.js";
import {
  swBuildAgeDeck,
  swCanBuildCard,
  swChooseAiSelection,
  swCreateGame,
  swFinalRanking,
  swPaymentForCost,
  swResolveSelections,
  swWinningEntries,
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
  tichuDeclare,
  tichuGiveDragonTrick,
  tichuNextRound,
  tichuPass,
  tichuPlay,
  tichuResolvePassing,
} from "../app/tichu-engine.js";
import {
  CFE_DEALS,
  CFE_GROWTH_TRACK,
  CFE_INNER_TRACK,
  cfeBorrow,
  cfeChooseAiAction,
  cfeCreateGame,
  cfeFinancials,
  cfeMigrateSavedGame,
  cfeRepayLiability,
  cfeResolvePending,
  cfeRoll,
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

test("hides unverified games by default and reveals them from the footer phrase", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const hiddenIds = [
    "seven-wonders",
    "tichu",
    "cashflow-escape",
    "confrontation",
    "clocktowers",
    "pick-picnic",
    "epic-duels",
    "sd-gundam-deluxe",
    "scotland-yard",
    "whitechapel",
    "miniville",
    "camel-up",
    "winners-circle",
    "mudflat-survivor",
  ];

  for (const id of hiddenIds) {
    assert.match(pageSource, new RegExp(`DEFAULT_HIDDEN_GAME_IDS[\\s\\S]*?"${id}"`));
  }
  assert.match(pageSource, /className="footer-game-visibility-toggle"[\s\S]*?>\s*즐거운\s*<\/button>/);
  assert.match(pageSource, /showAllGames \? GAMES : GAMES\.filter/);
  assert.match(pageSource, /paperoid-show-all-games/);
});

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
    "clocktowers",
    "pocket-stack",
    "color-chain",
    "number-drop",
    "dot-survivor",
    "untangle",
    "parking-escape",
    "paper-dungeon",
    "ten-seconds",
    "mudflat-survivor",
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

test("server-renders the paperoid game library", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>paperoid — AI 보드게임 아지트<\/title>/i);
  assert.match(html, /paperoid/);
  assert.match(html, /오목/);
  assert.match(html, /짝 맞추기/);
  assert.match(html, /리버시/);
  assert.match(html, /만칼라/);
  assert.match(html, /해전/);
  assert.match(html, /주사위 대결/);
  assert.match(html, /체커/);
  assert.match(html, /장기/);
  assert.match(html, /나인 멘스 모리스/);
  assert.match(html, /고누/);
  assert.match(html, /도미노/);
  assert.match(html, /백개먼/);
  assert.match(html, /차이니즈 체커/);
  assert.match(html, /다이아몬드 게임/);
  assert.match(html, /잉카 골드/);
  assert.match(html, /큐윅스/);
  assert.match(html, /러브레터/);
  assert.match(html, /바카라/);
  assert.match(html, /포켓 스택/);
  assert.match(html, /컬러 체인/);
  assert.match(html, /넘버 드롭/);
  assert.match(html, /도트 서바이버/);
  assert.match(html, /줄 풀기/);
  assert.match(html, /주차 탈출/);
  assert.match(html, /종이 던전/);
  assert.match(html, /10\.00/);
  for (const hiddenTitle of [
    "위너스 서클",
    "빛과 그림자의 대결",
    "미니빌",
    "픽 피크닉",
    "스타워즈 에픽 듀얼",
    "SD 건담 디럭스",
    "스코틀랜드 야드",
    "화이트채플",
    "7원더스",
    "카멜 업",
    "티츄",
    "현금흐름 탈출",
    "갯벌 한탕",
  ]) {
    assert.doesNotMatch(html, new RegExp(hiddenTitle));
  }
  assert.match(html, /모든 게임 표시/);
  assert.match(html, /이름·장르로 게임 찾기/);
  assert.match(html, /추가 되면 좋을 게임을 추천해주세요/);
  assert.match(html, /게임 추천 게시판/);
  assert.match(html, /id="game-suggestion"/i);
  assert.match(html, /maxlength="50"/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("registers six responsive casual games with touch, keyboard, and saved records", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const source = await readFile(new URL("../app/casual-games.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/casual-games.css", import.meta.url), "utf8");

  for (const id of ["pocket-stack", "color-chain", "number-drop", "dot-survivor", "untangle", "parking-escape"]) {
    assert.match(pageSource, new RegExp(`activeGame === "${id}"`));
    assert.match(pageSource, new RegExp(`id: "${id}"`));
  }
  assert.match(pageSource, /category: "캐주얼"/);
  assert.match(source, /window\.localStorage/);
  assert.match(source, /onPointerDown/);
  assert.match(source, /ArrowLeft/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /touch-action: none/);
});

test("runs Paper Dungeon from class selection through the tenth-floor boss", async () => {
  assert.equal(PAPER_DUNGEON_CLASSES.length, 3);
  assert.equal(PAPER_DUNGEON_ENEMIES.length, 10);
  assert.equal(PAPER_DUNGEON_ENEMIES[4].boss, true);
  assert.equal(PAPER_DUNGEON_ENEMIES[9].boss, true);

  let run = createPaperDungeonRun("scribe", "모모");
  assert.equal(run.phase, "battle");
  assert.equal(run.floor, 1);
  assert.equal(run.player.name, "모모");
  assert.match(run.logs[0], /모모가/);
  assert.equal(isPaperDungeonSave(run), true);
  run.player.attack = 500;

  for (let floor = 1; floor <= 10; floor += 1) {
    run = resolvePaperDungeonAction(run, "attack", () => 0.5);
    if (floor < 10) {
      assert.equal(run.phase, "reward");
      assert.equal(run.rewards.length, 3);
      run = choosePaperDungeonReward(run, "essence");
      run.player.attack = 500;
      assert.equal(run.floor, floor + 1);
      assert.equal(run.phase, "battle");
    }
  }
  assert.equal(run.phase, "victory");
  assert.equal(run.floor, 10);
  assert.equal(run.defeated, 10);

  const source = await readFile(new URL("../app/paper-dungeon-game.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/paper-dungeon.css", import.meta.url), "utf8");
  assert.match(source, /paperoid-paper-dungeon-save-v1/);
  assert.match(source, /Arrow|keydown|KeyboardEvent/);
  assert.match(source, /자동 저장된 원정/);
  assert.match(styles, /@media \(max-width: 700px\)/);
});

test("judges 10.00 with millisecond precision and supports a five-round challenge", async () => {
  assert.equal(TEN_SECONDS_TARGET_MS, 10_000);
  assert.deepEqual(judgeTenSeconds(10_000), {
    elapsed: 10_000,
    difference: 0,
    absoluteError: 0,
    score: 10_000,
    rating: "완벽",
  });
  assert.equal(judgeTenSeconds(10_049).rating, "전설");
  assert.equal(judgeTenSeconds(9_900).rating, "달인");
  assert.equal(judgeTenSeconds(10_700).rating, "다시 도전");
  assert.equal(formatTenSeconds(83, true), "+0.083초");
  assert.equal(formatTenSeconds(-127, true), "−0.127초");

  const summary = summarizeTenSeconds([9_950, 10_020, 10_100, 9_990, 10_040]);
  assert.equal(summary.rounds, 5);
  assert.equal(summary.averageError, 44);
  assert.equal(summary.bestError, 10);

  const source = await readFile(new URL("../app/ten-seconds-game.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/ten-seconds.css", import.meta.url), "utf8");
  assert.match(source, /performance\.now\(\)/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /event\.code !== "Space"/);
  assert.match(source, /paperoid-ten-seconds-records-v1/);
  assert.match(styles, /touch-action: manipulation/);
  assert.match(styles, /@media \(max-width:700px\)/);
});

test("uses an invisible relative-drag joystick for Mudflat Survivor", async () => {
  assert.equal(MUDFLAT_RUN_SECONDS, 240);
  assert.equal(MUDFLAT_JOYSTICK_RADIUS, 72);
  assert.ok(MUDFLAT_CREATURES.length >= 6);
  assert.equal(MUDFLAT_CREATURES.at(-1).boss, true);

  assert.deepEqual(mudflatJoystickVector(2, 2), { x: 0, y: 0, strength: 0 });
  const horizontal = mudflatJoystickVector(72, 0);
  assert.equal(horizontal.x, 1);
  assert.equal(horizontal.y, 0);
  assert.equal(horizontal.strength, 1);
  const diagonal = mudflatJoystickVector(100, 100);
  assert.ok(Math.abs(diagonal.x - Math.SQRT1_2) < 0.0001);
  assert.ok(Math.abs(diagonal.y - Math.SQRT1_2) < 0.0001);
  assert.equal(diagonal.strength, 1);

  assert.equal(mudflatCreatureForTime(0, 0.99).id, "clam");
  assert.notEqual(mudflatCreatureForTime(130, 0.99).id, "clam");
  assert.ok(mudflatSpawnInterval(200) < mudflatSpawnInterval(0));
  assert.equal(mudflatUpgradeChoices(2, {}).length, 3);
  assert.ok(mudflatFinalScore({ catchScore: 1000, caught: 50, elapsed: 240, bossCaught: true }) > 4000);

  const source = await readFile(new URL("../app/mudflat-survivor-game.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/mudflat-survivor.css", import.meta.url), "utf8");
  assert.match(source, /event\.clientX - joystick\.originX/);
  assert.match(source, /event\.clientY - joystick\.originY/);
  assert.match(source, /onPointerCancel=\{pointerEnd\}/);
  assert.match(source, /onLostPointerCapture=\{pointerEnd\}/);
  assert.doesNotMatch(source, /virtual-joystick|joystick-knob|joystick-base/);
  assert.match(source, /function drawMudflat\(/);
  assert.match(source, /function drawCreatureSprite\(/);
  assert.match(source, /function drawGatherer\(/);
  assert.match(source, /creature\.type === "crab"/);
  assert.match(source, /creature\.type === "mudfish"/);
  assert.match(source, /creature\.type === "octopus"/);
  assert.doesNotMatch(source, /const grid = 80/);
  assert.match(styles, /touch-action:none/);
  assert.match(styles, /data-game-id="mudflat-survivor"/);
  assert.doesNotMatch(styles, /\.ms-tools b\{display:none\}/);
});

test("uses official classic Battleship fleet and American checkers crowning", () => {
  let seed = 4711;
  const random = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  const fleet = createBattleshipFleet(random);
  assert.equal(BATTLESHIP_SEA_SIZE, 10);
  assert.deepEqual(fleet.ships.map((ship) => ship.length), BATTLESHIP_SHIP_LENGTHS);
  assert.equal(fleet.cells.size, 17);
  for (const ship of fleet.ships) {
    const rows = new Set(ship.map((cell) => Math.floor(cell / BATTLESHIP_SEA_SIZE)));
    const cols = new Set(ship.map((cell) => cell % BATTLESHIP_SEA_SIZE));
    assert.ok(rows.size === 1 || cols.size === 1);
  }
  const sunkShots = new Set(fleet.ships[0]);
  assert.equal(battleshipRemainingShips(fleet, sunkShots), 4);

  const board = Array(64).fill(0);
  board[17] = 1;
  board[10] = 2;
  board[12] = 2;
  const firstJump = checkerMoves(board, 1).find((move) => move.from === 17 && move.to === 3);
  assert.ok(firstJump);
  const crowned = applyCheckerMove(board, firstJump);
  assert.equal(crowned.crowned, true);
  assert.equal(crowned.board[3], 3);
  assert.ok(checkerMoves(crowned.board, 1, 3).some((move) => move.capture !== undefined));
  assert.equal(crowned.crowned, true, "끝줄에서 킹이 된 순간에는 추가 잡기가 있어도 차례가 끝나야 합니다.");
});

test("documents audited classic variants and player choices", async () => {
  const source = await readFile(new URL("../app/classic-games.tsx", import.meta.url), "utf8");

  assert.match(source, /상대 말을 두 개 이하로 줄이거나 상대가 합법적으로 움직일 수 없게 만들면 승리/);
  assert.match(source, /지역마다 다른 전통 고누 가운데, 네 줄 말판/);
  assert.match(source, /더블식스 28장을 쓰는 2인 드로우 도미노/);
  assert.match(source, /패를 어느 쪽에 놓을까요/);
  assert.match(source, /각자 주사위 하나를 굴려 선수를 정하세요/);
  assert.match(source, /가능하면 두 눈을 모두 사용해야 하며/);
  assert.match(source, /하나만 쓸 수 있다면 더 높은 눈을 사용/);
  assert.match(source, /더블링 큐브와 매치 점수는 사용하지 않습니다/);
});

test("matches the official IELLO 2016 Diamant relic variant", async () => {
  const source = await readFile(new URL("../app/incan-gold-game.tsx", import.meta.url), "utf8");

  assert.match(source, /\[1, 2, 3, 4, 5, 5, 7, 7, 9, 11, 11, 13, 14, 15, 17\]/);
  assert.match(source, /\[5, 7, 8, 10, 12\]/);
  assert.match(source, /IELLO 2016 규칙/);
  assert.match(source, /총점이 같으면 해당 탐험가들이 공동 승리/);
});

test("offers all four standard Janggi horse-elephant setups", async () => {
  const source = await readFile(new URL("../app/janggi-game.tsx", import.meta.url), "utf8");

  assert.match(source, /안상 차림/);
  assert.match(source, /바깥상 차림/);
  assert.match(source, /왼상 차림/);
  assert.match(source, /오른상 차림/);
  assert.match(source, /이 차림으로 대국 시작/);
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

test("applies official Seven Wonders trade sources and shared-victory tiebreak", () => {
  const game = swCreateGame(3, "balanced", () => 0.37);
  const [human, left, right] = game.players;
  human.coins = 10;
  human.production.wood = 0;
  human.tradeProduction.wood = 0;
  left.production.wood = 2;
  left.tradeProduction.wood = 1;
  right.production.wood = 0;
  right.tradeProduction.wood = 0;

  assert.ok(swPaymentForCost(game.players, 0, { wood: 1 }));
  assert.equal(swPaymentForCost(game.players, 0, { wood: 2 }), null);

  for (const player of game.players) {
    player.cards = [];
    player.stages = [];
    player.conflict = [];
    player.coins = 3;
  }
  const winners = swWinningEntries(game.players);
  assert.equal(winners.length, 3);
  game.players[1].coins = 4;
  assert.deepEqual(swWinningEntries(game.players).map((entry) => entry.playerId), [1]);
});

test("runs Camel Up stacking, pyramid legs, and 3-to-8 player races", () => {
  const stacked = cuCreateGame(3, "balanced", () => 0.2);
  stacked.track = Object.fromEntries(Object.keys(stacked.track).map((position) => [position, []]));
  stacked.track[2] = ["red", "yellow", "green"];
  const moved = cuMoveCamel(stacked, "yellow", 2);
  assert.deepEqual(moved.track[2], ["red"]);
  assert.deepEqual(moved.track[4], ["yellow", "green"]);
  assert.deepEqual(cuRanking(moved.track).slice(0, 3), ["green", "yellow", "red"]);

  const gray = cuCreateGame(3, "balanced", () => 0.2);
  gray.track = Object.fromEntries(Object.keys(gray.track).map((position) => [position, []]));
  gray.track[10] = ["black", "red"];
  gray.track[14] = ["white"];
  gray.dice = ["gray"];
  gray.currentPlayer = 0;
  const sequence = [0, 0, 0];
  const grayMoved = cuRollPyramid(gray, 0, () => sequence.shift() ?? 0);
  assert.deepEqual(grayMoved.track[10], ["black", "red"]);
  assert.deepEqual(grayMoved.track[13], ["white"]);

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
    else if (game.phase === "dragon-choice") game = tichuGiveDragonTrick(game, 1);
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

test("applies official Tichu declaration, Dragon, double-win, and tie rules", () => {
  const deckById = Object.fromEntries(tichuBuildDeck().map((card) => [card.id, card]));
  let passing = tichuCompleteGrand(tichuCreateGame("balanced", 1000, () => 0.37), false);
  passing = tichuDeclare(passing, 0);
  assert.equal(passing.phase, "passing");
  assert.equal(passing.declarations[0].type, "tichu");

  let dragon = tichuCompleteGrand(tichuCreateGame("balanced", 1000, () => 0.31), false);
  dragon = tichuResolvePassing(dragon, dragon.players[0].hand.slice(0, 3).map((card) => card.id));
  dragon.phase = "playing";
  dragon.currentPlayer = 3;
  dragon.table = [{
    playerId: 0,
    cards: [deckById.dragon],
    combo: { type: "single", count: 1, strength: 16, label: "싱글" },
  }];
  dragon.currentCombo = dragon.table[0].combo;
  dragon.lastPlayer = 0;
  dragon.passes = [1, 2];
  dragon = tichuPass(dragon, 3);
  assert.equal(dragon.phase, "dragon-choice");
  dragon = tichuGiveDragonTrick(dragon, 1);
  assert.equal(dragon.phase, "playing");
  assert.ok(dragon.players[1].tricks.some((card) => card.special === "dragon"));

  let tied = tichuCompleteGrand(tichuCreateGame("balanced", 1000, () => 0.23), false);
  tied = tichuResolvePassing(tied, tied.players[0].hand.slice(0, 3).map((card) => card.id));
  tied.phase = "playing";
  tied.scores = [800, 1000];
  tied.finishOrder = [0];
  tied.players[0].hand = [];
  tied.players[2].hand = [deckById["jade-2"]];
  tied.currentPlayer = 2;
  tied.currentCombo = null;
  tied.table = [];
  tied.lastPlayer = null;
  tied = tichuPlay(tied, 2, ["jade-2"]);
  assert.equal(tied.roundResult.doubleVictory, true);
  assert.deepEqual(tied.scores, [1000, 1000]);
  assert.equal(tied.phase, "round-end");
});

test("runs Cashflow Escape financial statements, debt, and 2-to-6 player journeys", () => {
  assert.equal(CFE_INNER_TRACK.length, 24);
  assert.ok(CFE_DEALS.some((deal) => deal.category === "realestate"));
  assert.ok(CFE_DEALS.some((deal) => deal.category === "stock"));
  assert.ok(CFE_DEALS.some((deal) => deal.category === "business"));

  const financeGame = cfeCreateGame(2, "balanced", () => 0.3);
  const before = cfeFinancials(financeGame.players[0]);
  assert.equal(financeGame.players[0].cash, financeGame.players[0].profession.savings + before.monthlyCashflow);
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
  assert.equal(cfeFinancials(invested.players[0]).assetIncome, CFE_DEALS[0].income);
  assert.match(invested.log.at(-1), /현금 -\d+만원 · 자산소득 \+\d+만원/);

  const marketGame = cfeCreateGame(2, "balanced", () => 0.2);
  marketGame.players[0].assets = CFE_DEALS.map((deal) => ({ ...deal, income: 0, acquiredTurn: 1 }));
  marketGame.players[0].position = 2;
  const arrivedAtMarket = cfeRoll(marketGame, 0, () => 0);
  assert.equal(arrivedAtMarket.pending?.kind, "market");
  assert.match(arrivedAtMarket.log.at(-1), /시장 변화 · .+ — .+/);
  const sold = cfeResolvePending(arrivedAtMarket, 0, "sell", arrivedAtMarket.pending.assetIds[0]);
  assert.match(sold.log.at(-1), /결정 · .+ 적용 · .+ 매각 · 현금 \+\d+만원 · 자산소득 -\d+만원/);

  for (const playerCount of [2, 3, 4, 5, 6]) {
    let seed = 9070 + playerCount;
    const random = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    let game = cfeCreateGame(playerCount, "sharp", random);
    let actions = 0;
    while (game.phase !== "finished" && actions < 10000) {
      if (game.pending && game.pending.playerId !== game.currentPlayer) {
        const pendingPlayer = game.players[game.pending.playerId];
        const choice = game.pending.kind === "opportunity" ? "small"
          : game.pending.kind === "vision" && pendingPlayer.cash >= game.pending.dream.cost ? "buy"
          : "skip";
        game = cfeResolvePending(game, game.pending.playerId, choice);
      } else {
        game = cfeChooseAiAction(game, game.currentPlayer, random);
      }
      actions += 1;
    }
    assert.equal(game.phase, "finished", `${playerCount}인 게임이 완주되어야 합니다.`);
    assert.ok(game.winner >= 0 && game.winner < playerCount);
    assert.equal(game.standings.length, playerCount);
    assert.ok(game.players.some((player) => player.stage === "growth"));
    assert.ok(actions < 10000);
  }
});

test("matches official Cashflow movement, charity, downsize, and Fast Track rules", () => {
  const opportunityGame = cfeCreateGame(2, "balanced", () => 0.2);
  const opportunity = cfeRoll(opportunityGame, 0, () => 0);
  assert.equal(opportunity.pending?.kind, "opportunity");
  const smallDeal = cfeResolvePending(opportunity, 0, "small");
  assert.equal(smallDeal.pending?.kind, "deal");
  assert.equal(smallDeal.pending?.card.size, "small");

  const charityGame = cfeCreateGame(2, "balanced", () => 0.2);
  charityGame.players[0].position = 5;
  const charity = cfeRoll(charityGame, 0, () => 0);
  assert.equal(charity.pending?.kind, "charity");
  assert.equal(charity.pending.amount, Math.ceil(cfeFinancials(charity.players[0]).totalIncome * 0.1));
  const charityAccepted = cfeResolvePending(charity, 0, "accept");
  charityAccepted.currentPlayer = 0;
  charityAccepted.players[0].position = 6;
  const rolls = [0, 0.5];
  const twoDice = cfeRoll(charityAccepted, 0, () => rolls.shift(), 2);
  assert.deepEqual(twoDice.lastRoll.values, [1, 4]);
  assert.equal(twoDice.lastRoll.used, 5);
  assert.equal(twoDice.players[0].charityTurns, 2);

  const paydayGame = cfeCreateGame(2, "balanced", () => 0.2);
  paydayGame.players[0].position = 22;
  const paydayBefore = paydayGame.players[0].cash;
  const paydayFlow = cfeFinancials(paydayGame.players[0]).monthlyCashflow;
  const passedPayday = cfeRoll(paydayGame, 0, () => 0.2);
  assert.equal(passedPayday.players[0].position, 0);
  assert.equal(passedPayday.players[0].cash, paydayBefore + paydayFlow);

  const downsizeGame = cfeCreateGame(2, "balanced", () => 0.2);
  downsizeGame.players[0].position = 16;
  downsizeGame.players[0].charityTurns = 2;
  downsizeGame.players[0].cash = 5000;
  const expenses = cfeFinancials(downsizeGame.players[0]).totalExpenses;
  const downsized = cfeRoll(downsizeGame, 0, () => 0, 1);
  assert.equal(downsized.players[0].cash, 5000 - expenses);
  assert.equal(downsized.players[0].skipTurns, 2);
  assert.equal(downsized.players[0].charityTurns, 0);

  const fastGame = cfeCreateGame(2, "balanced", () => 0.2);
  const player = fastGame.players[0];
  const requiredIncome = cfeFinancials(player).totalExpenses + 1;
  player.assets = [{ ...CFE_DEALS[0], income: requiredIncome, acquiredTurn: 1 }];
  const fast = cfeRoll(fastGame, 0, () => 0);
  assert.equal(fast.players[0].stage, "growth");
  assert.equal(fast.lastRoll.values.length, 2);
  assert.equal(fast.players[0].growthIncome, requiredIncome * 100);
  assert.equal(fast.players[0].growthTarget, requiredIncome * 100 + 5000);
  const loanAttempt = cfeBorrow(fast, 0, 100);
  assert.equal(loanAttempt.players[0].bankLoan, fast.players[0].bankLoan);

  const fastCharityGame = cfeCreateGame(2, "balanced", () => 0.2);
  Object.assign(fastCharityGame.players[0], { stage: "growth", position: 0, cash: 20000, growthIncome: 1000, growthTarget: 6000 });
  const fastCharity = cfeRoll(fastCharityGame, 0, () => 0);
  assert.equal(CFE_GROWTH_TRACK[fastCharity.players[0].position], "charity-fast");
  assert.equal(fastCharity.pending?.kind, "charity-fast");
  const permanent = cfeResolvePending(fastCharity, 0, "accept");
  assert.equal(permanent.players[0].growthCharity, true);
  assert.equal(permanent.players[0].cash, 10000);
});

test("applies official Fast Track losses and bankruptcy outcomes", () => {
  const growthAt = (position, cash = 1000) => {
    const game = cfeCreateGame(2, "balanced", () => 0.2);
    Object.assign(game.players[0], { stage: "growth", position, cash, growthIncome: 100, growthTarget: 5100 });
    return game;
  };
  const lawsuit = cfeRoll(growthAt(4), 0, () => 0);
  assert.equal(CFE_GROWTH_TRACK[lawsuit.players[0].position], "lawsuit");
  assert.equal(lawsuit.players[0].cash, 500);
  const tax = cfeRoll(growthAt(9), 0, () => 0);
  assert.equal(CFE_GROWTH_TRACK[tax.players[0].position], "tax");
  assert.equal(tax.players[0].cash, 500);
  const divorce = cfeRoll(growthAt(11), 0, () => 0);
  assert.equal(CFE_GROWTH_TRACK[divorce.players[0].position], "divorce");
  assert.equal(divorce.players[0].cash, 0);

  const recoveredGame = cfeCreateGame(2, "balanced", () => 0.2);
  const recoveredPlayer = recoveredGame.players[0];
  const openingFlow = cfeFinancials(recoveredPlayer).monthlyCashflow;
  recoveredPlayer.position = 23;
  recoveredPlayer.cash = 0;
  recoveredPlayer.bankLoan = (openingFlow + 5) * 10;
  recoveredPlayer.assets = [{ ...CFE_DEALS[0], cost: 200, value: 200, income: 0, acquiredTurn: 1 }];
  const recovered = cfeRoll(recoveredGame, 0, () => 0);
  assert.equal(recovered.players[0].eliminated, false);
  assert.equal(recovered.players[0].skipTurns, 2);
  assert.ok(cfeFinancials(recovered.players[0]).monthlyCashflow > 0);

  const failedGame = cfeCreateGame(2, "balanced", () => 0.2);
  const failedPlayer = failedGame.players[0];
  failedPlayer.position = 23;
  failedPlayer.cash = 0;
  failedPlayer.bankLoan = (cfeFinancials(failedPlayer).monthlyCashflow + 100) * 10;
  failedPlayer.assets = [];
  const failed = cfeRoll(failedGame, 0, () => 0);
  assert.equal(failed.players[0].eliminated, true);
  assert.equal(failed.phase, "finished");
  assert.equal(failed.winner, 1);
});

test("uses asset income terminology throughout Cashflow Escape", async () => {
  const files = await Promise.all([
    readFile(new URL("../app/cashflow-escape-game.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cashflow-escape-engine.js", import.meta.url), "utf8"),
    readFile(new URL("../app/game-objectives.js", import.meta.url), "utf8"),
  ]);
  const copy = files.join("\n");
  const legacyTerms = [
    [49688, 46041, 49548, 46301],
    [49688, 46041, 51201, 32, 49548, 46301],
    [51088, 49328, 32, 49688, 51077],
  ].map((codePoints) => String.fromCodePoint(...codePoints));
  assert.match(copy, /자산소득이 총지출보다/);
  for (const legacyTerm of legacyTerms) assert.equal(copy.includes(legacyTerm), false);
  assert.doesNotMatch(files[0] + files[1], /passiveIncome|\bpassive\b/);
  assert.match(files[0], /확인하고 계속/);
  assert.match(files[0], /TURN HISTORY/);

  const migrated = cfeMigrateSavedGame({
    lastEvent: `${legacyTerms[0]}으로 지출을 덮으세요`,
    log: [`${legacyTerms[1]} 증가`, `${legacyTerms[2]} 확인`],
    standings: [{ id: 0, passive: 120 }],
  });
  assert.equal(migrated.lastEvent, "자산소득으로 지출을 덮으세요");
  assert.deepEqual(migrated.log, ["자산소득 증가", "자산소득 확인"]);
  assert.equal(migrated.standings[0].assetIncome, 120);
  assert.equal("passive" in migrated.standings[0], false);
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
  assert.equal(SY_MAX_ROUNDS, 24);
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

  const throughOccupied = wcPoliceMoves("c1", ["c2"], 2);
  assert.ok(!throughOccupied.some((move) => move.id === "c2"));
  assert.ok(throughOccupied.some((move) => move.id === "c3" && move.distance === 2));

  const laterNight = wcCreateNightSetup(2, 4, () => 0, [2, 7, 11]);
  assert.ok(laterNight.women.every((site) => ![2, 7, 11].includes(site)));

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

  assert.deepEqual(
    Array.from({ length: 6 }, (_, index) => epicMovementRoll(() => (index + 0.1) / 6)),
    [
      { value: 3, all: false }, { value: 4, all: false }, { value: 5, all: false },
      { value: 2, all: true }, { value: 3, all: true }, { value: 4, all: true },
    ],
  );

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

test("uses grammatically correct Korean subject particles in Pick Picnic events", () => {
  assert.equal(hasKoreanFinalConsonant("보람"), true);
  assert.equal(hasKoreanFinalConsonant("모모"), false);
  assert.equal(withKoreanSubject("보람"), "보람이");
  assert.equal(withKoreanSubject("모모"), "모모가");
  assert.equal(withKoreanSubject("나"), "내가");
  assert.equal(withKoreanSubject("AI"), "AI가");
  assert.equal(withKoreanSubject("AI 1"), "AI 1이");

  const card = { uid: "subject-card", yardId: "yellow", kind: "bird", value: 3, name: "닭" };
  const game = {
    players: [{ id: 0, name: "모모", hand: [card], grains: { green: 0, blue: 0, gold: 0 }, captured: [] }],
    yards: PICK_PICNIC_YARDS.map((yard) => ({ ...yard, grains: yard.id === "yellow" ? ["green"] : [] })),
    deck: [], discard: [], bag: [], lastRound: false,
  };
  const result = pickPicnicResolveRound(game, [{ playerId: 0, card }], {}, () => 0);
  assert.equal(result.events[0], "꼬꼬 마당: 모모가 먹이 1개를 모두 먹었습니다.");
});

test("applies Korean particles to dynamic copy across every game", async () => {
  assert.equal(withKoreanTopic("보람"), "보람은");
  assert.equal(withKoreanTopic("모모"), "모모는");
  assert.equal(withKoreanObject("용"), "용을");
  assert.equal(withKoreanObject("여우"), "여우를");
  assert.equal(withKoreanAnd("보람"), "보람과");
  assert.equal(withKoreanAnd("모모"), "모모와");
  assert.equal(withKoreanDirection("왼쪽"), "왼쪽으로");
  assert.equal(withKoreanDirection("마을"), "마을로");
  assert.equal(withKoreanDirection(1), "1로");
  assert.equal(withKoreanDirection(3), "3으로");

  const files = (await readdir(new URL("../app/", import.meta.url), { recursive: true }))
    .filter((file) => /\.(?:js|jsx|ts|tsx)$/.test(file));
  const rawParticlePatterns = [
    /\$\{[^}\r\n]+\}(?:이\(가\)|을\(를\)|[이가은는을를과와]|(?:으)?로)(?=[^가-힣]|$)/g,
    /\{[A-Za-z_$][^{}\r\n]*\}(?:이\(가\)|을\(를\)|[이가은는을를과와]|(?:으)?로)(?=[^가-힣]|$)/g,
    /\b(?:name|label|title|role)\s*\+\s*["'](?:이\(가\)|을\(를\)|[이가은는을를과와]|(?:으)?로)/g,
  ];
  const violations = [];
  for (const file of files) {
    const source = await readFile(new URL(`../app/${file.replaceAll("\\", "/")}`, import.meta.url), "utf8");
    for (const pattern of rawParticlePatterns) {
      for (const match of source.matchAll(pattern)) violations.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(violations, []);
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

test("keeps Pick Picnic player scores horizontal on desktop and renders a font-independent goose", async () => {
  const source = await readFile(new URL("../app/pick-picnic-game.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/pick-picnic.css", import.meta.url), "utf8");
  assert.match(source, /className="picnic-score-strip" aria-label="참가자별 점수"/);
  assert.match(source, /className=\{`\$\{className\} picnic-goose-icon`\}/);
  assert.match(styles, /\.picnic-score-strip \{\s*width: 100%;/);
  assert.match(styles, /\.picnic-goose-icon::before/);
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

test("explains every Love Letter action and highlights events involving the player", async () => {
  const source = await readFile(new URL("../app/love-letter-game.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/love-letter.css", import.meta.url), "utf8");

  assert.match(source, /type ActionLog = \{/);
  assert.match(source, /withKoreanSubject\(actor\.name\)/);
  assert.match(source, /withKoreanObject\(cardName\(card, state\.theme\)\)/);
  assert.match(source, /방금 일어난 일/);
  assert.match(source, /나와 관련된 행동/);
  assert.match(source, /행동 기록/);
  assert.match(source, /정확히 추측했습니다/);
  assert.match(source, /최고 카드를 버린 효과/);
  assert.match(styles, /\.love-latest-action\.danger/);
  assert.match(styles, /\.love-log li\.involves-human/);
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
