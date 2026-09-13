import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { installGameRefreshGuard } from "../app/game-refresh.js";
import { GAME_OBJECTIVES } from "../app/game-objectives.js";
import { advanceLumiMotion, clearLumiAtlasMatte, createLumiMotion, lumiPose, lumiTongPose } from "../app/mudflat-lumi-animation.js";
import { distributeRemainingGemsAcrossCards } from "../app/incan-gold-gems.js";
import {
  applyChessMove,
  chessGameStatus,
  chessLegalMoves,
  chooseChessAiMove,
  createChessState,
} from "../app/chess-engine.js";
import { chooseAiHeld, describeAiHeld, shouldAiStop } from "../app/dice-ai.js";
import { scoreDice } from "../app/dice-scoring.js";
import { PARKING_LEVELS, parkingMinimumMoves } from "../app/parking-levels.js";
import {
  TETRIS_HEIGHT,
  TETRIS_TYPES,
  TETRIS_WIDTH,
  canPlaceTetrisPiece,
  clearTetrisLines,
  createTetrisBoard,
  lockTetrisPiece,
  shuffleTetrisBag,
  tetrisDropDelay,
  tetrisLineScore,
  tetrisShape,
} from "../app/tetris-engine.js";
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
  MUDFLAT_CLAM_GRADES,
  MUDFLAT_CREATURES,
  MUDFLAT_FIXED_GENERAL_SKILL_IDS,
  MUDFLAT_GENERAL_UPGRADES,
  MUDFLAT_JOYSTICK_RADIUS,
  MUDFLAT_RECOVERY_FOODS,
  MUDFLAT_REGULAR_STAGES,
  MUDFLAT_RETURN_GUIDE_SECONDS,
  MUDFLAT_RUN_SECONDS,
  MUDFLAT_SEAFOOD_MARKET,
  MUDFLAT_SHOP_EQUIPMENT,
  MUDFLAT_TIDE_DAMAGE_RATIO_PER_SECOND,
  MUDFLAT_TIDE_MESSAGE_INTERVAL,
  MUDFLAT_TIDE_FILL_SECONDS,
  MUDFLAT_UPGRADES,
  MUDFLAT_TIDE_SPEED_MULTIPLIER,
  MUDFLAT_PEARL,
  mudflatAutoSellInventory,
  mudflatAdvancedSkillUnlocks,
  mudflatCanLearnSkill,
  mudflatBleedDamage,
  mudflatBossPulse,
  mudflatEmptySeafoodHazard,
  mudflatClamRewardForRoll,
  mudflatEquipmentPrice,
  mudflatEquipmentDescription,
  mudflatEquipmentStats,
  mudflatCatchCapacity,
  mudflatCastNetStats,
  mudflatCreatureForTime,
  mudflatFinalScore,
  mudflatElectricStats,
  mudflatHarpoonStats,
  mudflatHeadlampEncounterLimit,
  mudflatHeadlampDiscoveryRange,
  mudflatJoystickVector,
  mudflatNetStats,
  mudflatMarketImageScale,
  mudflatPufferBleedOnContact,
  mudflatPufferBleedStep,
  mudflatPufferMovementForAge,
  mudflatShellMovementSpeed,
  mudflatRockCreatureForRoll,
  mudflatRockTurnerStats,
  mudflatStageProfile,
  mudflatStageEmptySeafoodHazard,
  mudflatInWaterChannel,
  mudflatEndlessObjectiveResult,
  mudflatSeafoodSaleValue,
  mudflatSettleCatch,
  mudflatSpawnInterval,
  mudflatStageStats,
  mudflatTideStats,
  mudflatStageTideState,
  mudflatCampObstacleAllowed,
  mudflatReturnCampPosition,
  mudflatTongStats,
  mudflatTerrainSpeedMultiplier,
  mudflatTrainingPrice,
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
  SW_AI_STRATEGIES,
  swBuildAgeDeck,
  swCanBuildCard,
  swChooseAiSelection,
  swCreateGame,
  swAssignAiStrategies,
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

test("implements legal chess movement, special moves, and game-ending checks", () => {
  const coordinates = (square) => ({ x: square.charCodeAt(0) - 97, y: 8 - Number(square[1]) });
  const play = (state, from, to, promotion = "q") => {
    const start = coordinates(from);
    const end = coordinates(to);
    const move = chessLegalMoves(state).find((candidate) =>
      candidate.from.x === start.x && candidate.from.y === start.y
      && candidate.to.x === end.x && candidate.to.y === end.y,
    );
    assert.ok(move, `${from}→${to}는 합법적인 수여야 합니다.`);
    return applyChessMove(state, move, promotion);
  };

  const initial = createChessState();
  assert.equal(initial.board.flat().filter(Boolean).length, 32);
  assert.equal(chessLegalMoves(initial).length, 20);

  let mate = play(initial, "f2", "f3");
  mate = play(mate, "e7", "e5");
  mate = play(mate, "g2", "g4");
  mate = play(mate, "d8", "h4");
  assert.deepEqual(chessGameStatus(mate), { phase: "checkmate", check: true, winner: "b" });

  let enPassant = play(createChessState(), "e2", "e4");
  enPassant = play(enPassant, "a7", "a6");
  enPassant = play(enPassant, "e4", "e5");
  enPassant = play(enPassant, "d7", "d5");
  const epMove = chessLegalMoves(enPassant).find((move) => move.enPassant);
  assert.ok(epMove, "앙파상 수가 생성되어야 합니다.");
  enPassant = applyChessMove(enPassant, epMove);
  assert.equal(enPassant.board[3][3], null);
  assert.equal(enPassant.board[2][3]?.type, "p");

  const castling = createChessState();
  castling.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  castling.board[7][4] = { color: "w", type: "k", moved: false };
  castling.board[7][7] = { color: "w", type: "r", moved: false };
  castling.board[0][4] = { color: "b", type: "k", moved: false };
  assert.ok(chessLegalMoves(castling).some((move) => move.castle === "king"));

  const promotion = createChessState();
  promotion.board = Array.from({ length: 8 }, () => Array(8).fill(null));
  promotion.board[7][4] = { color: "w", type: "k", moved: false };
  promotion.board[0][4] = { color: "b", type: "k", moved: false };
  promotion.board[1][0] = { color: "w", type: "p", moved: true };
  const promoted = play(promotion, "a7", "a8", "n");
  assert.equal(promoted.board[0][0]?.type, "n");

  const afterE4 = play(createChessState(), "e2", "e4");
  const aiMove = chooseChessAiMove(afterE4, () => 0);
  assert.ok(aiMove);
  assert.ok(chessLegalMoves(afterE4).some((move) =>
    move.from.x === aiMove.from.x && move.from.y === aiMove.from.y
    && move.to.x === aiMove.to.x && move.to.y === aiMove.to.y,
  ));
});

test("hides unverified games by default and reveals them from the footer phrase", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const hiddenIds = [
    "mancala",
    "gonu",
    "nine-mens-morris",
    "diamond",
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
    "paper-dungeon",
    "tetris",
  ];

  for (const id of hiddenIds) {
    assert.match(pageSource, new RegExp(`DEFAULT_HIDDEN_GAME_IDS[\\s\\S]*?"${id}"`));
  }
  assert.match(pageSource, /className="footer-game-visibility-toggle"[\s\S]*?>\s*즐거운\s*<\/button>/);
  assert.match(pageSource, /className="footer-mudflat-shortcut"[\s\S]*?onClick=\{\(\) => launchGame\("mudflat-survivor"\)\}[\s\S]*?>\s*한\s*<\/button>/);
  assert.match(pageSource, /showAllGames \? GAMES : GAMES\.filter/);
  assert.match(pageSource, /paperoid-show-all-games/);
});

test("uses the game guide as a normal topbar action instead of a duplicate exit action", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const janggiSource = await readFile(new URL("../app/janggi-game.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(pageSource, /<GameObjectiveGuide gameId=\{gameId\} \/>/);
  assert.doesNotMatch(janggiSource, /GameObjectiveGuide/);
  assert.match(styles, /\.game-objective-trigger\s*\{[\s\S]*?position:\s*absolute;/);
  assert.match(styles, /\.game-readability-scope \.exit-button\s*\{\s*display:\s*none;/);
  assert.match(styles, /\.game-readability-scope \.game-topbar\s*\{[\s\S]*?grid-template-columns:\s*48px minmax\(0, 1fr\) 128px;/);
  assert.match(styles, /\.game-title-lockup strong\s*\{[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/);
  assert.match(pageSource, /<strong title=\{title\}>\{title\}<\/strong>/);
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
    "chess",
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
    "tetris",
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
  assert.match(guideSource, /game-objective-steps/);
  assert.deepEqual(GAME_OBJECTIVES["mudflat-survivor"].steps.map((step) => step.title), ["이동", "채집과 위험", "정비와 다음 물때"]);
  assert.match(GAME_OBJECTIVES["mudflat-survivor"].summary, /4분 동안 채집/);

  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.equal(
    [...pageSource.matchAll(/<GuidedGame gameId=\{activeGame\}>/g)].length,
    expectedGameIds.length,
  );
});

test("uses independently centered Paperoid character images in the memory game", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const characterIds = [
    "moon-jelly",
    "teapot-snail",
    "lantern-owl",
    "coral-cat",
    "paper-dragon",
    "star-moth",
    "mushroom-diver",
    "cloud-whale",
  ];

  for (const id of characterIds) {
    const image = await readFile(new URL(`../public/memory-characters/${id}.png`, import.meta.url));
    assert.equal(image.subarray(1, 4).toString(), "PNG");
    assert.ok(image.length > 100_000);
  }
  assert.match(pageSource, /\["moon-jelly", "달빛 해파리"\]/);
  assert.match(pageSource, /\["cloud-whale", "구름 아기고래"\]/);
  assert.match(pageSource, /memoryCharacterLabel\(card\.symbol\)/);
  assert.match(pageSource, /return `\/memory-characters\/\$\{id\}\.png`/);
  assert.match(pageSource, /<img\s+className="memory-character"/);
  assert.match(styles, /\.memory-character \{[\s\S]*object-fit: contain;[\s\S]*object-position: center;/);
  assert.doesNotMatch(styles, /memory-character-atlas\.png|--memory-atlas-/);
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
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
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
  assert.match(html, /해전/);
  assert.match(html, /주사위 대결 Yahtzee/);
  assert.match(html, /체커/);
  for (const title of [
    "체스",
    "장기",
    "도미노",
    "백개먼",
    "차이니즈 체커",
    "잉카의 다이아몬드",
    "큐윅스",
    "러브레터",
    "바카라",
    "포켓 스택",
    "컬러 체인",
    "넘버 드롭",
    "도트 서바이버",
    "줄 풀기",
    "주차 탈출",
    "종이 던전",
    "10.00",
    "해루질럿",
  ]) {
    assert.match(pageSource, new RegExp(`title: "${title.replace(".", "\\.")}"`));
  }
  for (const hiddenTitle of [
    "만칼라",
    "고누",
    "나인 멘스 모리스",
    "다이아몬드 게임",
    "위너스 서클",
    "빛과 그림자의 대결",
    "미니빌",
    "픽 피크닉",
    "스타워즈 에픽 듀얼",
    "SD 건담 디럭스",
    "스코틀랜드 야드",
    "화이트채플",
    "7대 문명",
    "카멜 업",
    "티츄",
    "현금흐름 탈출",
    "테트리스",
  ]) {
    assert.doesNotMatch(html, new RegExp(hiddenTitle));
  }
  assert.match(html, /모든 게임 표시/);
  assert.match(html, /게임 찾기/);
  assert.match(html, /전체 게임 보기/);
  assert.match(html, /사용자 의견/);
  assert.match(html, /개선안 또는 추가되면 좋을 게임을 남겨주세요/);
  assert.match(html, /의견 남기기/);
  assert.doesNotMatch(html, /게임 추천 게시판/);
  assert.doesNotMatch(html, /id="game-suggestion"/i);
  assert.match(pageSource, /id="game-suggestion"/i);
  assert.match(pageSource, /maxLength=\{50\}/i);
  assert.doesNotMatch(html, /예: 카탄, 루미큐브, 스플렌더/);
  assert.doesNotMatch(pageSource, /suggestionDate|<time dateTime=\{suggestion\.createdAt\}/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("separates traditional classics from the strategy category", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const classicGames = [
    "gomoku",
    "reversi",
    "mancala",
    "checkers",
    "chess",
    "janggi",
    "nine-mens-morris",
    "gonu",
    "domino",
    "chinese-checkers",
    "diamond",
  ];

  assert.match(pageSource, /type Category = [^;]*"고전게임"/);
  assert.match(pageSource, /const CATEGORIES:[\s\S]*?"고전게임"/);
  assert.match(pageSource, /type Category = [^;]*"카드"/);
  assert.match(pageSource, /id: "baccarat",[\s\S]*?category: "카드"/);
  assert.doesNotMatch(pageSource, /category: "카드게임"/);
  assert.match(pageSource, /id: "love-letter",[\s\S]*?category: "전략"/);
  for (const id of classicGames) {
    assert.match(pageSource, new RegExp(`id: "${id}",[\\s\\S]*?category: "고전게임"`));
  }
  assert.match(pageSource, /CATEGORIES\.map\(\(item\) => \([\s\S]*?onClick=\{\(\) => openFinder\(item\)\}/);
});

test("publishes Mudflat Maniac in a front-loaded mobile category", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const categoryOrder = '["전체", "전략", "모바일", "고전게임", "주사위", "터치류"';
  const hiddenSet = pageSource.match(/const DEFAULT_HIDDEN_GAME_IDS[\s\S]*?\]\);/)?.[0] ?? "";

  assert.match(pageSource, /type Category = [^;]*"모바일"/);
  assert.ok(pageSource.includes(`const CATEGORIES: Category[] = ${categoryOrder}`));
  assert.match(pageSource, /id: "mudflat-survivor",[\s\S]*?category: "모바일"/);
  assert.doesNotMatch(hiddenSet, /"mudflat-survivor"/);
});

test("detects published site updates and refreshes only through safe user actions", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const versionRoute = await readFile(new URL("../app/api/version/route.ts", import.meta.url), "utf8");
  const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(viteConfig, /VITE_PAPEROID_BUILD_ID/);
  assert.match(versionRoute, /Cache-Control[\s\S]*?no-store/);
  assert.match(pageSource, /UPDATE_CHECK_INTERVAL_MS = 5 \* 60 \* 1000/);
  assert.match(pageSource, /fetch\(`\/api\/version\?t=\$\{Date\.now\(\)\}`[\s\S]*?cache: "no-store"/);
  assert.match(pageSource, /window\.addEventListener\("pageshow", checkNow\)/);
  assert.match(pageSource, /window\.addEventListener\("focus", checkNow\)/);
  assert.match(pageSource, /window\.addEventListener\("online", checkNow\)/);
  assert.match(pageSource, /document\.addEventListener\("visibilitychange", checkWhenVisible\)/);
  assert.match(pageSource, /if \(updateAvailable\) \{\s*applyUpdate\(id\);\s*return;/);
  assert.match(pageSource, /const exitGame = \(\) => \{\s*if \(updateAvailable\) \{\s*applyUpdate\(null\);/);
  assert.match(pageSource, /onExit=\{exitGame\}/);
  assert.match(pageSource, /PENDING_GAME_AFTER_UPDATE_KEY/);
  assert.match(pageSource, /const activeGameRef = useRef<GameId \| null>\(null\)/);
  assert.match(pageSource, /const gameToRestore = pendingGame === undefined \? activeGameRef\.current : pendingGame/);
  assert.match(pageSource, /onActiveGameChange\(activeGame\)/);
  assert.match(pageSource, /새 버전이 준비되었습니다/);
  assert.match(pageSource, /const \[isUpdating, setIsUpdating\] = useState\(false\)/);
  assert.match(pageSource, /const \[isCollapsed, setIsCollapsed\] = useState\(false\)/);
  assert.match(pageSource, /window\.setTimeout\(\(\) => setIsCollapsed\(true\), 2000\)/);
  assert.match(pageSource, /setIsUpdating\(true\)[\s\S]*?requestAnimationFrame\(\(\) => window\.requestAnimationFrame\(onUpdate\)\)/);
  assert.match(pageSource, /disabled=\{isUpdating\} aria-busy=\{isUpdating\}/);
  assert.match(pageSource, /app-update-spinner/);
  assert.match(pageSource, /app-update-refresh-icon/);
  assert.match(pageSource, /app-update-refresh-icon[\s\S]*?<svg viewBox="0 0 24 24" focusable="false">[\s\S]*?<path[\s\S]*?<path/);
  assert.match(pageSource, /isUpdating \? "새로고침 중" : "새로고침"/);
  assert.doesNotMatch(pageSource, /지금 업데이트/);
  assert.match(styles, /\.app-update-notice\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*10000;/);
  assert.match(styles, /\.app-update-notice\.is-collapsed\s*\{[\s\S]*?width:\s*56px;[\s\S]*?min-height:\s*56px;/);
  assert.match(styles, /\.app-update-notice\.is-collapsed button\s*\{[\s\S]*?display:\s*grid;[\s\S]*?place-items:\s*center;[\s\S]*?gap:\s*0;/);
  assert.match(styles, /\.app-update-notice\.is-collapsed \.app-update-label\s*\{[^}]*display:\s*none;/);
  assert.match(styles, /\.app-update-notice\.is-collapsed > span\s*\{[^}]*display:\s*none;/);
  assert.match(styles, /\.app-update-refresh-icon svg\s*\{[\s\S]*?width:\s*22px;[\s\S]*?height:\s*22px;[\s\S]*?stroke:\s*currentColor;/);
  assert.doesNotMatch(styles, /\.app-update-notice\.is-collapsed \.app-update-refresh-icon\s*\{\s*translate:/);
  assert.match(styles, /transition:\s*width \.5s/);
  assert.match(styles, /\.app-update-spinner\s*\{[\s\S]*?border-radius:\s*50%;[\s\S]*?animation:\s*app-update-spin/);
  assert.match(styles, /@keyframes app-update-spin/);
});

test("keeps the home introduction compact on mobile", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(pageSource, /지금, <em>한 판<\/em> 즐겨볼까요/);
  assert.match(pageSource, /className=\"hero-mudflat-shortcut\"[\s\S]*?onClick=\{\(\) => launchGame\(\"mudflat-survivor\"\)\}[\s\S]*?>\s*\?\s*<\/button>/);
  assert.match(styles, /\.hero-mudflat-shortcut \{[\s\S]*?font: inherit/);
  assert.match(styles, /\.hub-hero \{[\s\S]*?min-height: 132px/);
  assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.hub-hero \{[\s\S]*?min-height: 104px/);
  assert.match(pageSource, /className="home-explore-bar"/);
  assert.match(pageSource, /className="all-games-trigger"/);
  assert.match(pageSource, /const \[expanded, setExpanded\] = useState\(false\)/);
});

test("opens the game finder with visible categories and without summoning the keyboard", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(pageSource, /<input\s+[\s\S]*?autoFocus[\s\S]*?type="search"/);
  assert.match(pageSource, /className="finder-game-thumb"[\s\S]*?<GameArtwork game=\{game\} \/>/);
  assert.doesNotMatch(pageSource, /finder-game-thumb"[^>]*>\{game\.title\.slice/);
  assert.match(styles, /\.finder-category-row\s*\{[\s\S]*?flex:\s*0 0 auto;/);
  assert.match(styles, /\.finder-game-list\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?overflow-y:\s*auto;/);
  assert.match(styles, /\.finder-game-thumb \.card-art\s*\{[\s\S]*?transform:\s*translate\(-50%, -50%\) scale\(\.24\);/);
});

test("registers six responsive casual games with touch, keyboard, and saved records", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const source = await readFile(new URL("../app/casual-games.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/casual-games.css", import.meta.url), "utf8");

  for (const id of ["pocket-stack", "color-chain", "number-drop", "dot-survivor", "untangle", "parking-escape"]) {
    assert.match(pageSource, new RegExp(`activeGame === "${id}"`));
    assert.match(pageSource, new RegExp(`id: "${id}"`));
  }
  assert.match(pageSource, /category: "터치류"/);
  assert.match(pageSource, /type Category = [^;]*"퍼즐"/);
  assert.match(pageSource, /id: "parking-escape",[\s\S]*?category: "퍼즐"/);
  assert.doesNotMatch(pageSource, /category: "캐주얼"/);
  assert.match(source, /window\.localStorage/);
  assert.match(source, /onPointerDown/);
  assert.match(source, /ArrowLeft/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /touch-action: none/);
  assert.match(styles, /\.parking-board\s*\{[\s\S]*?width:\s*calc\(100% - 48px\)/);
  assert.match(styles, /\.parking-exit\s*\{[\s\S]*?width:\s*48px/);
  assert.match(source, /className="cg-brand">paperoid<\/span>/);
  assert.doesNotMatch(source, /paperoid · CASUAL/);
  assert.match(styles, /\.cg-topbar\s*\{[\s\S]*?color:\s*#17202b/);
  assert.match(styles, /\.cg-topbar > button:first-child\s*\{[\s\S]*?background:\s*#fff/);
});

test("provides 50 ordered and valid Parking Escape levels", () => {
  assert.equal(PARKING_LEVELS.length, 50);
  assert.equal(PARKING_LEVELS.filter((level) => level.difficulty === "초급").length, 5);
  assert.equal(PARKING_LEVELS.filter((level) => level.difficulty === "중급").length, 20);
  assert.equal(PARKING_LEVELS.filter((level) => level.difficulty === "고급").length, 25);
  const minimumByDifficulty = { 초급: 5, 중급: 10, 고급: 15 };

  for (const [index, level] of PARKING_LEVELS.entries()) {
    assert.equal(level.number, index + 1);
    assert.ok(level.minMoves >= minimumByDifficulty[level.difficulty]);
    assert.equal(parkingMinimumMoves(level.cars), level.minMoves, `level ${level.number} minimum-move label must match its actual shortest solution`);
    assert.equal(level.cars[0].id, "T");
    assert.equal(level.cars[0].axis, "h");
    assert.equal(level.cars[0].y, 2);
    const occupied = new Set();
    for (const car of level.cars) {
      for (let step = 0; step < car.len; step += 1) {
        const x = car.x + (car.axis === "h" ? step : 0);
        const y = car.y + (car.axis === "v" ? step : 0);
        assert.ok(x >= 0 && x < 6 && y >= 0 && y < 6, `level ${level.number} has an out-of-bounds car`);
        assert.ok(!occupied.has(`${x},${y}`), `level ${level.number} has overlapping cars`);
        occupied.add(`${x},${y}`);
      }
    }
  }

  assert.ok(PARKING_LEVELS[0].minMoves < PARKING_LEVELS[24].minMoves);
  assert.ok(PARKING_LEVELS[24].minMoves <= PARKING_LEVELS[25].minMoves);
  assert.ok(PARKING_LEVELS[25].minMoves < PARKING_LEVELS[49].minMoves);
});

test("runs a private touch-friendly Tetris with seven-bag scoring and speed levels", async () => {
  assert.equal(TETRIS_WIDTH, 10);
  assert.equal(TETRIS_HEIGHT, 20);
  assert.equal(new Set(TETRIS_TYPES).size, 7);
  assert.equal(new Set(shuffleTetrisBag(() => 0.42)).size, 7);
  assert.ok(TETRIS_TYPES.every((type) => tetrisShape(type, 0).length === 4));
  assert.equal(tetrisLineScore(4, 2), 1600);
  assert.ok(tetrisDropDelay(8) < tetrisDropDelay(1));

  const board = createTetrisBoard();
  const piece = { type: "O", x: 4, y: 18, rotation: 0 };
  assert.equal(canPlaceTetrisPiece(board, piece), true);
  const locked = lockTetrisPiece(board, piece);
  assert.equal(locked[18][4], "O");
  const fullBoard = locked.map((row, index) => index === 19 ? Array(10).fill("I") : row);
  assert.equal(clearTetrisLines(fullBoard).cleared, 1);

  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const source = await readFile(new URL("../app/tetris-game.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/tetris.css", import.meta.url), "utf8");
  assert.match(pageSource, /id: "tetris",[\s\S]*?category: "터치류"/);
  assert.match(pageSource, /DEFAULT_HIDDEN_GAME_IDS[\s\S]*?"tetris"/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /onClick=\{rotate\}/);
  assert.match(source, /paperoid-tetris-best/);
  assert.match(styles, /touch-action:manipulation/);
});

test("moves Dot Survivor with relative drag instead of tap teleportation", async () => {
  const source = await readFile(new URL("../app/casual-games.tsx", import.meta.url), "utf8");

  assert.match(source, /originX: event\.clientX, originY: event\.clientY/);
  assert.match(source, /event\.clientX - dragRef\.current\.originX/);
  assert.match(source, /pointerInputRef\.current = \{ x: 0, y: 0 \}/);
  assert.match(source, /onPointerUp=\{pointerEnd\}/);
  assert.match(source, /onPointerCancel=\{pointerEnd\}/);
  assert.match(source, /onLostPointerCapture=\{pointerEnd\}/);
  assert.doesNotMatch(source, /onPointerDown=\{move\} onPointerMove=\{move\}/);
  assert.match(source, /한 번의 터치로 순간이동하지 않습니다/);
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
  assert.equal(MUDFLAT_RETURN_GUIDE_SECONDS, 10);
  assert.equal(MUDFLAT_TIDE_SPEED_MULTIPLIER, .2);
  assert.equal(MUDFLAT_TIDE_DAMAGE_RATIO_PER_SECOND, .05);
  assert.equal(MUDFLAT_TIDE_MESSAGE_INTERVAL, 15);
  assert.deepEqual(mudflatTideStats(229, 100), { guideVisible: false, active: false, speedMultiplier: 1, damagePerSecond: 0 });
  assert.deepEqual(mudflatTideStats(230, 100), { guideVisible: true, active: false, speedMultiplier: 1, damagePerSecond: 0 });
  assert.deepEqual(mudflatTideStats(240, 100), { guideVisible: true, active: true, speedMultiplier: .2, damagePerSecond: 5 });
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

  assert.equal(mudflatCreatureForTime(0, 0.99).id, "small-crab");
  assert.notEqual(mudflatCreatureForTime(130, 0.99).id, "small-crab");
  assert.equal(mudflatCreatureForTime(80, 0.99).id, "shrimp");
  assert.equal(mudflatCreatureForTime(80, 0.99, { headlamp: true }).id, "whelk");
  assert.equal(mudflatCreatureForTime(80, 0.834, { headlamp: true }).id, "fist-whelk");
  assert.equal(mudflatCreatureForTime(80, 0.851, { headlamp: true }).id, "whelk");
  assert.equal(mudflatCreatureForTime(100, 0.99, { headlamp: true }).id, "golbaengi");
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(mudflatHeadlampDiscoveryRange), [0, 155, 185, 215, 245, 275, 305]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(mudflatHeadlampEncounterLimit), [0, 1, 2, 2, 3, 3, 4]);
  assert.equal(mudflatEquipmentDescription("headlamp", 1), "반경 155 안에서 소라와 골뱅이를 밝힙니다.");
  assert.equal(mudflatEquipmentDescription("headlamp", 6), "반경 305 안에서 소라와 골뱅이를 밝힙니다.");
  const whelk = MUDFLAT_CREATURES.find((creature) => creature.id === "whelk");
  const golbaengi = MUDFLAT_CREATURES.find((creature) => creature.id === "golbaengi");
  assert.equal(whelk.speed, 155 * .05);
  assert.equal(whelk.movement, "flee");
  assert.equal(golbaengi.speed, 155 * .05);
  assert.equal(golbaengi.movement, "chase");
  assert.equal(golbaengi.sprite, "/mudflat-creatures/golbaengi-v2.png");
  assert.equal(MUDFLAT_CREATURES.find((creature) => creature.id === "fist-whelk").speed, 155 * .05);
  assert.equal(mudflatShellMovementSpeed(155), 7.75);
  assert.equal(mudflatShellMovementSpeed(200), 10);
  assert.ok(mudflatSpawnInterval(200) < mudflatSpawnInterval(0));
  assert.ok(mudflatSpawnInterval(0, "normal") < mudflatSpawnInterval(0, "kids"));
  assert.equal(mudflatUpgradeChoices(2, {}).length, 3);
  assert.deepEqual(MUDFLAT_GENERAL_UPGRADES.map((upgrade) => upgrade.name), ["쓸어담기", "집게 숙련도", "작살던지기", "갯벌 장화", "든든한 간식", "돌뒤집개", "뜰채", "호미질", "전기 스파크", "그물 투척"]);
  assert.equal(MUDFLAT_GENERAL_UPGRADES.find((upgrade) => upgrade.id === "basket").description, "경험치와 보상을 끌어당기는 범위가 넓어집니다.");
  assert.equal(MUDFLAT_GENERAL_UPGRADES.find((upgrade) => upgrade.id === "rocker").description, "돌 밑에 숨어있는 해산물을 더 빨리 더 잘 찾아낼 수 있습니다.");
  assert.equal(MUDFLAT_GENERAL_UPGRADES.find((upgrade) => upgrade.id === "snack").description, "최대 체력이 기본 대비 20% 상승하며 현재 체력을 전부 회복합니다.");
  assert.equal(MUDFLAT_GENERAL_UPGRADES.find((upgrade) => upgrade.id === "electric").description, "기본 집게 사거리 안의 해산물 모두에 주기적으로 전기 피해를 줍니다.");
  const generalChoices = mudflatUpgradeChoices(2, {}, "normal");
  assert.equal(generalChoices.length, 3);
  assert.ok(generalChoices.every((choice) => ["basket", "tongs", "harpoon", "boots", "snack", "rocker", "net", "digging"].includes(choice.id)));
  assert.equal(new Set(generalChoices.map((choice) => choice.id)).size, 3);
  assert.ok(generalChoices.every((choice) => !["electric", "cast-net"].includes(choice.id)));
  assert.deepEqual(mudflatAdvancedSkillUnlocks({ tongs: 5 }), { masteryCount: 1, electric: true, castNet: false });
  assert.deepEqual(mudflatAdvancedSkillUnlocks({ tongs: 5, digging: 5 }), { masteryCount: 2, electric: true, castNet: true });
  assert.deepEqual(MUDFLAT_FIXED_GENERAL_SKILL_IDS, ["tongs", "digging"]);
  const sixChoiceLoadout = { tongs: 5, digging: 5, harpoon: 1, net: 1, rocker: 1, boots: 1, basket: 1, snack: 1 };
  assert.equal(mudflatCanLearnSkill(sixChoiceLoadout, "electric", "normal"), false);
  assert.equal(mudflatCanLearnSkill(sixChoiceLoadout, "cast-net", "normal"), false);
  assert.equal(mudflatCanLearnSkill(sixChoiceLoadout, "harpoon", "normal"), true);
  const cappedChoices = mudflatUpgradeChoices(4, sixChoiceLoadout, "normal", () => .5);
  assert.ok(cappedChoices.every((choice) => ["harpoon", "net", "rocker", "boots", "basket", "snack", "tongs", "digging"].includes(choice.id)));
  assert.equal(mudflatTongStats(2).rotationSpeed, mudflatTongStats(1).rotationSpeed * 1.5);
  assert.equal(mudflatTongStats(2).power, mudflatTongStats(1).power * 1.5);
  assert.equal(mudflatElectricStats(1).reach, mudflatTongStats(1).reach);
  assert.equal(mudflatElectricStats(6).reach, mudflatTongStats(1).reach);
  assert.equal(mudflatElectricStats(7).reach, mudflatTongStats(1).reach + 12);
  assert.equal(mudflatNetStats(1).range, mudflatTongStats(1).reach);
  assert.equal(mudflatNetStats(2).range, mudflatTongStats(1).reach * 1.2);
  assert.equal(mudflatNetStats(3).range, mudflatTongStats(1).reach * 1.4);
  assert.equal(mudflatNetStats(4).range, mudflatTongStats(1).reach * 1.6);
  assert.equal(mudflatNetStats(5).range, mudflatTongStats(1).reach * 1.8);
  assert.equal(mudflatNetStats(6).range, mudflatTongStats(1).reach * 2);
  assert.equal(mudflatNetStats(6).radius, mudflatNetStats(1).radius * 2);
  assert.equal(mudflatNetStats(6).headDepth, mudflatNetStats(1).headDepth * 2);
  assert.ok(mudflatNetStats(1).radius < mudflatNetStats(1).range);
  assert.equal(mudflatHarpoonStats(1, 1).range, mudflatNetStats(1).range * 2);
  assert.equal(mudflatHarpoonStats(2, 2).range, mudflatNetStats(2).range * 3);
  assert.equal(mudflatHarpoonStats(3, 3).range, mudflatNetStats(3).range * 4);
  assert.equal(mudflatHarpoonStats(4, 4).range, mudflatNetStats(4).range * 5);
  assert.equal(mudflatHarpoonStats(1, 1).damage, 30);
  assert.equal(mudflatHarpoonStats(2, 2).damage, 45);
  assert.equal(mudflatHarpoonStats(1, 1).speed, 760 * 0.4);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((level) => mudflatRockTurnerStats(level).processingTime), [1, .8, .6, .4, .2, .2]);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((level) => mudflatRockTurnerStats(level).cooldown), [2, 1.7, 1.4, 1.1, .8, .5]);
  assert.equal(mudflatRockTurnerStats(2).activationsPerSecond, 1 / 2.5);
  assert.equal(mudflatRockCreatureForRoll(0).type, "shrimp");
  assert.equal(mudflatRockCreatureForRoll(.1999, 1).type, "shrimp");
  assert.equal(mudflatRockCreatureForRoll(.2001, 1).type, "small-crab");
  assert.equal(mudflatRockCreatureForRoll(.5001, 1).type, "crab");
  assert.equal(mudflatRockCreatureForRoll(.6001, 1).type, "blue-crab");
  assert.equal(mudflatRockCreatureForRoll(.7001, 1).type, "octopus");
  assert.equal(mudflatRockCreatureForRoll(.8001, 1).type, "pufferfish");
  assert.equal(mudflatRockCreatureForRoll(.8501, 1), null);
  assert.equal(mudflatRockCreatureForRoll(.0999, 6).type, "shrimp");
  assert.equal(mudflatRockCreatureForRoll(.1001, 6).type, "small-crab");
  assert.equal(mudflatRockCreatureForRoll(.3001, 6).type, "crab");
  assert.equal(mudflatRockCreatureForRoll(.4001, 6).type, "blue-crab");
  assert.equal(mudflatRockCreatureForRoll(.5001, 6).type, "octopus");
  assert.equal(mudflatRockCreatureForRoll(.7001, 6).type, "pufferfish");
  assert.equal(mudflatRockCreatureForRoll(.8501, 6), null);
  assert.deepEqual(mudflatPufferBleedOnContact(), { seconds: 50, tickClock: 1 });
  assert.deepEqual(mudflatPufferBleedOnContact(12, .4), { seconds: 50, tickClock: .4 });
  assert.deepEqual(mudflatPufferBleedOnContact(0, 1, 1), { seconds: 25, tickClock: 1 });
  assert.deepEqual(mudflatPufferBleedOnContact(0, 1, 6), { seconds: 12.5, tickClock: 1 });
  assert.equal(mudflatBleedDamage(100), 1);
  assert.equal(mudflatBleedDamage(925), 9.25);
  assert.deepEqual(mudflatPufferBleedStep(50, 1, 1), { seconds: 49, tickClock: 1, ticks: 1 });
  assert.deepEqual(mudflatPufferBleedStep(50, 1, 50), { seconds: 0, tickClock: 1, ticks: 50 });
  assert.deepEqual(MUDFLAT_CLAM_GRADES.map((grade) => grade.name), ["작은조개", "바지락", "동죽", "백합", "피조개", "맛조개"]);
  assert.deepEqual(MUDFLAT_CLAM_GRADES.map((grade) => grade.visualSize), [32, 39, 46, 53, 62, 56]);
  assert.equal(MUDFLAT_CLAM_GRADES.find((grade) => grade.id === "razor-clam").vertical, true);
  assert.equal(MUDFLAT_CLAM_GRADES.find((grade) => grade.id === "razor-clam").visualSize, 56);
  assert.equal(mudflatClamRewardForRoll(1, 0).id, "small-clam");
  assert.equal(mudflatClamRewardForRoll(1, 0.5999).id, "small-clam");
  assert.equal(mudflatClamRewardForRoll(1, 0.6).id, "clam");
  assert.equal(mudflatClamRewardForRoll(1, 0.9).id, "dongjuk");
  assert.equal(mudflatClamRewardForRoll(6, 0.009).id, "pearl");
  assert.equal(mudflatClamRewardForRoll(6, 0.01).id, "clam");
  assert.equal(mudflatClamRewardForRoll(6, 0.999).id, "razor-clam");
  assert.equal(MUDFLAT_PEARL.price, 10000);
  assert.deepEqual(mudflatEmptySeafoodHazard(9.99), { damagePerSecond: 0, message: "" });
  assert.deepEqual(mudflatEmptySeafoodHazard(10), { damagePerSecond: 1, message: "너무 깊게 들어온 것 같다." });
  assert.deepEqual(mudflatEmptySeafoodHazard(30), { damagePerSecond: 10, message: "너무 춥다. 되돌아가야해" });
  assert.equal(MUDFLAT_SEAFOOD_MARKET.find((item) => item.type === "razor-clam").image, "/mudflat-creatures/razor-clam.svg");
  assert.deepEqual(mudflatBossPulse(0, 0), { wave: .5, scaleX: 1.02, scaleY: 1.02, color: "rgb(38,34,84)" });
  const swollenBoss = mudflatBossPulse(0, Math.PI / 2);
  assert.equal(swollenBoss.scaleX, 1.08);
  assert.ok(Math.abs(swollenBoss.scaleY - .96) < 1e-9);
  assert.equal(swollenBoss.color, "rgb(18,43,77)");
  assert.deepEqual(
    Object.fromEntries(MUDFLAT_SEAFOOD_MARKET.map((item) => [item.type, item.price])),
    {
      "small-crab": 2, crab: 3, "shore-crab": 4, "fiddler-crab": 5, "blue-crab": 7, "purple-crab": 9,
      shrimp: 1, whelk: 2, "fist-whelk": 8, octopus: 20, golbaengi: 6, flounder: 50, pufferfish: 15,
      "small-clam": 0, clam: 1, dongjuk: 2, "hard-clam": 3, "ark-shell": 10, "razor-clam": 12,
      pearl: 10000, "king-crab": 100,
    },
  );
  const crabTypes = ["small-crab", "crab", "shore-crab", "fiddler-crab", "blue-crab", "purple-crab", "king-crab"];
  assert.ok(crabTypes.every((type) => MUDFLAT_CREATURES.find((creature) => creature.id === type)?.sprite?.endsWith(".svg")));
  assert.ok(crabTypes.every((type) => MUDFLAT_SEAFOOD_MARKET.find((item) => item.type === type)?.image === MUDFLAT_CREATURES.find((creature) => creature.id === type)?.sprite));
  assert.ok(mudflatMarketImageScale("small-crab") < mudflatMarketImageScale("crab"));
  assert.ok(mudflatMarketImageScale("crab") < mudflatMarketImageScale("blue-crab"));
  assert.ok(mudflatMarketImageScale("blue-crab") < mudflatMarketImageScale("king-crab"));
  assert.equal(mudflatMarketImageScale("king-crab"), 1);
  assert.ok(mudflatMarketImageScale("small-crab") > .4);
  assert.ok(mudflatMarketImageScale("whelk") < mudflatMarketImageScale("fist-whelk"));
  assert.ok(mudflatMarketImageScale("small-clam") < mudflatMarketImageScale("clam"));
  assert.ok(mudflatMarketImageScale("clam") < mudflatMarketImageScale("dongjuk"));
  assert.ok(mudflatMarketImageScale("dongjuk") < mudflatMarketImageScale("hard-clam"));
  assert.ok(mudflatMarketImageScale("hard-clam") < mudflatMarketImageScale("ark-shell"));
  assert.ok(mudflatMarketImageScale("razor-clam") < mudflatMarketImageScale("ark-shell"));
  assert.equal(mudflatMarketImageScale("shrimp"), 1);
  assert.equal(MUDFLAT_SEAFOOD_MARKET.find((item) => item.type === "pearl").unit, "개");
  assert.equal(MUDFLAT_CREATURES.find((item) => item.id === "whelk").size, 9);
  assert.equal(MUDFLAT_CREATURES.find((item) => item.id === "fist-whelk").size, 18);
  assert.equal(MUDFLAT_CREATURES.find((item) => item.id === "whelk").visualScale, 1.2);
  assert.equal(MUDFLAT_CREATURES.find((item) => item.id === "fist-whelk").visualScale, .8);
  assert.equal(MUDFLAT_CREATURES.find((item) => item.id === "golbaengi").visualScale, .8);
  const pufferfish = MUDFLAT_CREATURES.find((item) => item.id === "pufferfish");
  assert.equal(pufferfish.hp, 118);
  assert.equal(pufferfish.speed, 155 * .7);
  assert.equal(pufferfish.size, 22 * .8);
  assert.equal(pufferfish.movement, "oval");
  assert.equal(pufferfish.spawnVariant, true);
  assert.equal(mudflatPufferMovementForAge(0), "wander");
  assert.equal(mudflatPufferMovementForAge(7.999), "wander");
  assert.equal(mudflatPufferMovementForAge(8), "oval");
  assert.ok((await readFile(new URL("../public/mudflat-creatures/pufferfish.png", import.meta.url))).byteLength > 10_000);
  assert.ok((await readFile(new URL("../public/mudflat-creatures/golbaengi-v2.png", import.meta.url))).byteLength > 10_000);
  const lumiWalkSprites = await Promise.all(["side", "front", "back"].map((direction) => readFile(new URL(`../public/mudflat-illustrations/lumi-${direction}-tongs-walk-transparent.png`, import.meta.url))));
  assert.ok(lumiWalkSprites.every((sprite) => sprite[25] === 6), "Every directional Lumi walk sheet must retain PNG alpha transparency");
  assert.equal(MUDFLAT_SHOP_EQUIPMENT.length, 5);
  assert.deepEqual(MUDFLAT_SHOP_EQUIPMENT.map((item) => item.name), ["헤드랜턴", "조과통 업그레이드", "작업 조끼", "장갑 업그레이드", "장화 밑창 업그레이드"]);
  assert.ok(MUDFLAT_SHOP_EQUIPMENT.every((item) => item.max === 6));
  assert.equal(MUDFLAT_SHOP_EQUIPMENT.find((item) => item.id === "cooler").description, "채집 한도를 늘립니다.");
  assert.equal(MUDFLAT_SHOP_EQUIPMENT.find((item) => item.id === "vest").description, "최대 체력과 출혈 저항을 높입니다.");
  assert.equal(mudflatEquipmentPrice("headlamp", 0), 1000);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(mudflatCatchCapacity), [500, 800, 1200, 1700, 2300, 3000, 3800]);
  assert.equal(mudflatEquipmentDescription("cooler", 6), "3,800마리까지 채집 가능합니다.");
  assert.equal(mudflatEquipmentDescription("vest", 6), "기본 최대 체력보다 800 높아지고 출혈 시간이 75% 감소합니다.");
  assert.equal(mudflatEquipmentDescription("gloves", 6), "모든 채집 도구의 위력이 기본 수치보다 21% 증가합니다.");
  assert.equal(mudflatEquipmentDescription("waders", 6), "지형 이동 페널티가 75% 감소하고 기본 최대 체력보다 20% 상승합니다.");
  assert.deepEqual(mudflatEquipmentStats({ cooler: 0, vest: 0, gloves: 0, waders: 0 }, 100, 0), { catchCapacity: 500, maxHp: 100, vestHpBonus: 0, bleedDurationReduction: 0, toolPowerMultiplier: 1, terrainPenaltyReduction: 0 });
  assert.equal(mudflatEquipmentStats({ vest: 6, gloves: 6, waders: 6 }, 100, 1).maxHp, 940);
  assert.equal(mudflatEquipmentStats({ vest: 1, waders: 1 }, 100, 0).maxHp, 135, "work vest and boot sole bonuses must add independently from base HP");
  assert.equal(mudflatEquipmentStats({ vest: 6, gloves: 6, waders: 6 }, 100, 1).toolPowerMultiplier, 1.21);
  assert.equal(mudflatTerrainSpeedMultiplier(.5, 1), .65);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((level) => mudflatElectricStats(level).interval), [1, .8, .6, .4, .2, .1]);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((level) => mudflatCastNetStats(level).interval), [2, 1.7, 1.4, 1.1, .8, .5]);
  assert.equal(MUDFLAT_RECOVERY_FOODS.length, 3);
  assert.equal(mudflatSeafoodSaleValue("clam", 10, 0), 10);
  assert.equal(mudflatSeafoodSaleValue("clam", 10, 2), 10);
  const settledCatch = mudflatSettleCatch({ crab: 2 }, { clam: 3, octopus: 1 }, 4, 0);
  assert.deepEqual(settledCatch.inventory, { crab: 2, clam: 3, octopus: 1 });
  assert.equal(settledCatch.catchCount, 4);
  assert.equal(settledCatch.value, 23);
  const recoveredCatch = mudflatSettleCatch({}, { clam: 1 }, 3, 0);
  assert.deepEqual(recoveredCatch.inventory, { clam: 3 });
  assert.equal(recoveredCatch.recoveredCount, 2);
  assert.equal(recoveredCatch.value, 3);
  const autoSale = mudflatAutoSellInventory({ clam: 3, octopus: 1, unknown: 99 }, 0);
  assert.deepEqual(autoSale.haul, { clam: 3, octopus: 1 });
  assert.equal(autoSale.count, 4);
  assert.equal(autoSale.value, 23);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((level) => mudflatEquipmentPrice("gloves", level)), [1000, 2000, 3000, 4000, 5000, 6000]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(mudflatTrainingPrice), [1000, 2000, 3000, 4000, 5000, 6000]);
  assert.ok(mudflatStageStats(3).creatureHpMultiplier > mudflatStageStats(2).creatureHpMultiplier);
  assert.ok(mudflatStageStats(3).spawnIntervalMultiplier < mudflatStageStats(2).spawnIntervalMultiplier);
  assert.equal(MUDFLAT_REGULAR_STAGES.length, 8);
  assert.deepEqual(MUDFLAT_REGULAR_STAGES.map((stage) => stage.name), ["초입 갯벌", "차오르는 물골", "바위 갯벌", "어두운 갯벌", "깊은 펄", "거센 갯벌", "대조기 갯벌", "마지막 물때"]);
  assert.equal(mudflatStageProfile(4).darkness, .78);
  assert.equal(mudflatStageProfile(8).finalBoss, true);
  assert.equal(mudflatStageProfile(9).name, "끝없는 물때");
  assert.ok(mudflatStageProfile(9).modifiers.length >= 3);
  assert.deepEqual(mudflatStageProfile(11), mudflatStageProfile(11), "endless combinations must remain deterministic after reload");
  assert.ok(mudflatStageEmptySeafoodHazard(20, 5).damagePerSecond > mudflatStageEmptySeafoodHazard(20, 1).damagePerSecond);
  assert.equal(typeof mudflatInWaterChannel(0, 0, 2), "boolean");
  assert.equal(mudflatEndlessObjectiveResult({ objective: { id: "rocks", label: "돌 3개", target: 3, bonus: 50 } }, { rocksFlipped: 3 }).bonus, 50);
  assert.ok(mudflatFinalScore({ catchScore: 1000, caught: 50, elapsed: 240, bossCaught: true }) > 4000);

  const source = await readFile(new URL("../app/mudflat-survivor-game.tsx", import.meta.url), "utf8");
  const engineSource = await readFile(new URL("../app/mudflat-survivor-engine.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/mudflat-survivor.css", import.meta.url), "utf8");
  assert.match(source, /event\.clientX - joystick\.originX/);
  assert.match(source, /const \[mode, setMode\] = useState<GameMode>\("normal"\)/);
  assert.match(source, /const defaultCharacterId = \(mode: GameMode\) => mode === "normal" \? "beginner" : "digger";/);
  assert.match(source, /const \[characterId, setCharacterId\] = useState\(defaultCharacterId\("normal"\)\)/);
  assert.match(source, /const lastMode = window\.localStorage\.getItem\(LAST_MODE_KEY\)[\s\S]*?if \(lastMode === "kids" \|\| lastMode === "normal"\) \{\s*setMode\(lastMode\);\s*setCharacterId\(defaultCharacterId\(lastMode\)\);/);
  assert.match(source, /setMode\("normal"\); window\.localStorage\.setItem\(LAST_MODE_KEY, "normal"\)/);
  assert.match(source, /setMode\("kids"\); window\.localStorage\.setItem\(LAST_MODE_KEY, "kids"\)/);
  assert.match(source, /const LUMI_HOLD_MS = 3_000;/);
  assert.match(source, /setCharacterId\(LUMI_CHARACTER\.id\)/);
  assert.match(source, /onPointerDown=\{isLumi \? startLumiPointerHold : undefined\}/);
  assert.doesNotMatch(source, /3초 길게 눌러 선택|초 더 누르기|lumiHoldProgress/);
  assert.match(source, /<em>\{isLumi \? "준비중" : item\.startLabel\}<\/em>/);
  assert.match(source, /event\.clientY - joystick\.originY/);
  assert.match(source, /onPointerCancel=\{pointerEnd\}/);
  assert.match(source, /onLostPointerCapture=\{pointerEnd\}/);
  assert.match(source, /const resetMovementInput = useCallback/);
  assert.match(source, /joystickRef\.current = \{ pointerId: -1, originX: 0, originY: 0, x: 0, y: 0 \}/);
  assert.match(source, /keysRef\.current\.clear\(\)/);
  assert.match(source, /const resume = \(\) => \{ const runtime = runtimeRef\.current; if \(!runtime\) return; resetMovementInput\(\); runtime\.paused = false/);
  assert.match(source, /window\.localStorage\.removeItem\(CAMPAIGN_KEY\);/);
  assert.match(source, /setSavedCampaign\(null\);/);
  assert.match(source, /EXPEDITION ENDED/);
  assert.match(source, /className="ms-defeat-art" src="\/mudflat-illustrations\/defeat-gatherer\.png"/);
  assert.match(source, /onClick=\{onExit\}>메인 화면으로/);
  assert.match(source, /onClick=\{\(\) => beginAtStage\(hud\.stage\)\}/);
  assert.match(source, /hud\.stage === 9 \? "끝없는 물때 재도전" : `\$\{hud\.stage\}단계 재도전`/);
  assert.doesNotMatch(source, /onClick=\{\(\) => setScreen\("camp"\)\}>정비소에서 재도전/);
  assert.doesNotMatch(source, /virtual-joystick|joystick-knob|joystick-base/);
  assert.match(source, /totalScore: number; lastBossCaught: boolean/);
  assert.match(source, /lastBossCaught: runtime\.bossCaught/);
  assert.match(source, /단계에서 잡은 \$\{settlement\.catchCount\}마리를 판매해서 \$\{autoSale\.value\}코인을 얻었습니다/);
  assert.match(source, /<small>대왕 박하지<\/small><b>\{campaign\.lastBossCaught \? "포획" : "미포획"\}<\/b>/);
  assert.match(styles, /\.ms-layer button:not\(:disabled\)\{-webkit-tap-highlight-color:transparent;touch-action:manipulation/);
  assert.match(styles, /\.ms-defeat-art\{display:block;width:min\(310px,76vw\);height:auto;margin:0 auto 16px;/);
  assert.match(styles, /\.ms-layer section>div button:not\(:disabled\):active\{transform:translateY\(1px\) scale\(\.982\)/);
  assert.match(styles, /\.ms-layer\.pause \.ms-primary:not\(:disabled\):active/);
  assert.match(source, /function drawMudflat\(/);
  assert.match(source, /function drawCreatureSprite\(/);
  assert.match(source, /const DIRECTIONAL_SEAFOOD_TYPES = new Set\(\["pufferfish", "whelk", "fist-whelk", "golbaengi", "shrimp"\]\)/);
  assert.match(source, /function creatureSpriteHorizontalScale\(creature: Creature\)/);
  assert.match(source, /const artworkFacesRight = creature\.type !== "shrimp"/);
  assert.match(source, /context\.scale\(creatureSpriteHorizontalScale\(creature\), 1\)/);
  assert.match(source, /const previousX = creature\.x/);
  assert.match(source, /creature\.facing = creature\.x > previousX \? 1 : -1/);
  assert.match(source, /const sprite = creature\.sprite && !creature\.boss \? sprites\.get\(creature\.type\) : undefined/);
  assert.match(source, /mudflatBossPulse\(elapsed, creature\.phase\)/);
  assert.match(source, /let spawnPoint = \{ x: runtime\.player\.x \+ Math\.cos\(angle\) \* distance, y: runtime\.player\.y \+ Math\.sin\(angle\) \* distance \};/);
  assert.match(source, /isInsideBaseCamp\(spawnPoint, runtime\.baseCamp, runtime\.stage, template\.size \+ 12\)/);
  assert.match(source, /id: sequenceRef\.current\+\+, type: template\.id, x: spawnPoint\.x/);
  assert.match(source, /const revealRockCreature = \(rock: Rock, finding:[\s\S]*?id: sequenceRef\.current\+\+,\s*type: template\.id,/);
  assert.match(source, /function drawGatherer\(/);
  assert.match(source, /function drawExperiencePickup\(context: CanvasRenderingContext2D, pickup: Pickup, elapsed: number\)/);
  assert.match(source, /if \(pickup\.xp <= 5\)/);
  assert.match(source, /pickup\.xp === 1\) drawDot\(0, 0\)/);
  assert.match(source, /pickup\.xp === 2\) \{ drawDot\(0, -4\); drawDot\(0, 4\); \}/);
  assert.match(source, /pickup\.xp === 3\) \{ drawDot\(0, -5\); drawDot\(-4, 3\); drawDot\(4, 3\); \}/);
  assert.match(source, /pickup\.xp === 4\) \{ drawDot\(-4, -4\); drawDot\(4, -4\); drawDot\(-4, 4\); drawDot\(4, 4\); \}/);
  assert.match(source, /else \{ drawDot\(0, 0, 5\.25\); \}/);
  assert.match(source, /else if \(pickup\.xp <= 10\)/);
  assert.match(source, /else if \(pickup\.xp <= 20\)/);
  assert.match(source, /else if \(pickup\.xp <= 30\)/);
  assert.match(source, /const glint = \.45 \+ \.55/);
  assert.match(source, /function drawRotatingTongs\(/);
  assert.match(source, /function drawHarpoonSprite\(/);
  assert.match(source, /function drawRockHookBar\(/);
  assert.match(source, /function drawRock\(context:[\s\S]*?const shake =[\s\S]*?const liftProgress =/);
  assert.match(source, /context\.fillText\(`돌뒤집기 \$\{Math\.ceil\(progress \* 100\)\}%`/);
  assert.match(source, /const ACTION_PROGRESS_RING_RADIUS = 18/);
  assert.equal((source.match(/context\.arc\(0, 0, ACTION_PROGRESS_RING_RADIUS/g) ?? []).length, 4);
  assert.match(source, /rockId: target\.id[\s\S]*?life: stats\.processingTime, maxLife: stats\.processingTime/);
  assert.match(source, /runtime\.rockFlipEffect && runtime\.rockFlipEffect\.life <= 0[\s\S]*?mudflatRockCreatureForRoll\(Math\.random\(\), runtime\.levels\.rocker \?\? 1\)/);
  assert.match(source, /const stillInRange = target &&[\s\S]*?runtime\.rockFlipEffect = null;[\s\S]*?runtime\.rockTurnClock = mudflatRockTurnerStats\(runtime\.levels\.rocker \?\? 1\)\.cooldown/);
  assert.doesNotMatch(source, /text: "빈 돌"/);
  assert.match(source, /mudflatPufferMovementForAge\(creature\.age\)/);
  assert.match(source, /\["whelk", "fist-whelk", "golbaengi"\]\.includes\(creature\.type\) \? mudflatShellMovementSpeed\(speed\)/);
  assert.match(source, /creature\.age \+= dt/);
  assert.match(source, /activeMovement === "oval"/);
  assert.match(source, /const retreatSpeed = travelSpeed \* \.62/);
  assert.match(source, /const orbitSpeed = travelSpeed \* \.34/);
  assert.match(source, /creature\.type === "pufferfish"/);
  assert.match(source, /speed: finding\.type === "pufferfish" \? template\.speed/);
  assert.match(source, /mudflatPufferBleedOnContact/);
  assert.match(source, /mudflatPufferBleedStep/);
  assert.match(source, /creature\.type === "pufferfish" \|\| creature\.type === "king-crab"/);
  assert.match(source, /damagePlayer\(mudflatBleedDamage\(runtime\.player\.maxHp\)/);
  assert.match(source, /mudflatCatchCapacity\(runtime\.equipment\.cooler \?\? 0\)/);
  assert.match(source, /const CATCH_FULL_MESSAGE = "더 담을 수가 없어\. 다음에는 큰 통을 가져와야겠다\."/);
  assert.match(source, /runtime\.catchFullNoticeClock = 15/);
  assert.match(source, /A full container prevents selling the catch, not learning from it\./);
  assert.match(source, /mudflatElectricStats\(electricLevel\)/);
  assert.match(source, /const tide = mudflatTideStats\(runtime\.elapsed, runtime\.player\.maxHp\);/);
  assert.match(source, /const speed = tide\.active \? runtime\.player\.speed \* tide\.speedMultiplier : regularSpeed;/);
  assert.match(source, /damagePlayer\(tide\.damagePerSecond, "#73d4ea"\);/);
  assert.match(source, /TIDE_RETURN_MESSAGE = "물이 가득찼어\. 빨리 복귀해야해!"/);
  assert.match(source, /runtime\.tideMessageClock \+= MUDFLAT_TIDE_MESSAGE_INTERVAL;/);
  assert.match(source, /const BASE_CAMP_STAGE_ONE_WIDTH_MULTIPLIER = 5;/);
  assert.match(source, /function baseCampDimensions\(stage: number\)/);
  assert.match(source, /function keepCreatureOutsideBaseCamp\(creature: Creature, baseCamp: Point, stage: number\)/);
  assert.match(source, /const inBaseCamp = runtime\.baseCampGuideShown && isInsideBaseCamp\(runtime\.player, runtime\.baseCamp, runtime\.stage\);/);
  assert.match(source, /keepCreatureOutsideBaseCamp\(creature, runtime\.baseCamp, runtime\.stage\);/);
  assert.match(source, /if \(inBaseCamp \|\| hasVisibleSeafood\)/);
  assert.match(source, /if \(tide\.active && inBaseCamp\) \{ completeStage\(runtime\); return; \}/);
  assert.match(source, /drawBaseCampDirectionGuide\(context, width, height, runtime\.player, runtime\.baseCamp, returnTide\.active\)/);
  assert.equal(MUDFLAT_TIDE_FILL_SECONDS, 1);
  assert.match(source, /const returnTideFill = returnTide\.active \? returnTideFillProgress\(runtime\.elapsed\) : 0;/);
  assert.match(source, /const waterFill = returnTide\.active \? returnTideFill : stageTide\.fill;/);
  assert.match(source, /const waterHeight = height \* waterFill;/);
  assert.match(source, /context\.rect\(0, waterTop, width, waterHeight\); context\.clip\(\);/);
  assert.match(source, /context\.globalAlpha = waterFill/);
  assert.match(source, /const tideCycle = stageTide\.impactCycle;/);
  assert.doesNotMatch(source, /tidePhase \/ 7|runtime\.tideFlash = \.7/);
  assert.doesNotMatch(source, /else if \(runtime\.elapsed >= MUDFLAT_RUN_SECONDS\) completeStage\(runtime\)/);
  assert.match(source, /const reach = electric\.reach;/);
  assert.match(source, /const reach = mudflatElectricStats\(runtime\.levels\.electric \?\? 0\)\.reach;/);
  assert.match(source, /runtime\.player\.hp > 50/);
  assert.match(source, /runtime\.selfShockClock = electric\.selfInterval/);
  assert.match(source, /selfShockNotified: false/);
  assert.match(source, /악 찌릿찌릿해, 이거 계속 쓸 수는 없겠네\./);
  assert.match(source, /악 찌릿찌릿해!/);
  assert.match(source, /hasSelfShockMessage \? 1 : 3, hasSelfShockMessage \? \.7 : 1/);
  assert.match(source, /runtime\.playerMessageOpacity/);
  assert.match(source, /체력이 부족해서 지금은 전기 스파크를 못 쓰겠어\./);
  assert.match(source, /runtime\.electricStopNotified = false/);
  assert.match(source, /context\.globalCompositeOperation = "lighter"/);
  assert.match(source, /const cloud = context\.createRadialGradient/);
  assert.match(source, /for \(let bolt = 0; bolt < 10; bolt \+= 1\)/);
  assert.match(source, /mudflatCastNetStats\(castNetLevel\)/);
  assert.match(source, /const creatureRevealStrength = \(creature: Creature\) =>/);
  assert.match(source, /const isCreatureRevealed = \(creature: Creature\)/);
  assert.match(source, /mudflatHeadlampEncounterLimit\(headlampLevel\)/);
  assert.match(source, /runtime\.headlampSpawnClock = Math\.max\(runtime\.headlampSpawnClock, 4\.8\)/);
  assert.match(source, /const headlampRetentionDistance = Math\.max\(Math\.hypot\(width, height\) \* 1\.15/);
  assert.match(source, /originX: runtime\.player\.x, originY: runtime\.player\.y, angle/);
  assert.match(source, /const maximumDistance = Math\.max\(minimumDistance \+ 18/);
  assert.match(source, /drawCastNetThrow\(context, screenPoint\(\{ x: castNet\.originX, y: castNet\.originY \}\), screenPoint\(castNet\), castNet\)/);
  assert.doesNotMatch(source, /mudflatCastNetTarget/);
  assert.match(source, /신기술을 알게되었다\./);
  assert.match(source, /runtime\.bleedSeconds = 0; runtime\.bleedTickClock = 1/);
  assert.match(source, /hasVisibleSeafood[\s\S]*?runtime\.emptySeafoodSeconds = 0[\s\S]*?runtime\.emptySeafoodDamageClock = 0/);
  assert.match(source, /runtime\.player\.hp = Math\.max\(0, runtime\.player\.hp - emptyHazard\.damagePerSecond\)/);
  assert.match(source, /const emptyHazard = mudflatStageEmptySeafoodHazard\(runtime\.emptySeafoodSeconds, runtime\.stage\)/);
  assert.match(source, /stageProfile\.waterChannels && mudflatInWaterChannel/);
  assert.match(source, /incomingTideSlow/);
  assert.match(source, /function waterChannelCenterX\(/);
  assert.match(source, /function drawWaterChannelArrows\(/);
  assert.match(source, /stageProfile\.waterChannels && tideSurge > 0/);
  assert.match(source, /lastHillCycle: number; safeZoneTransition: number/);
  assert.match(source, /if \(afterTide && hillCycle > runtime\.lastHillCycle\)/);
  assert.match(source, /runtime\.safeZone = nextHillPosition\(/);
  assert.match(source, /function drawHillDirectionGuide\(/);
  assert.match(source, /밀물 접근 · \$\{Math\.max\(1, Math\.ceil\(warning\)\)\}초/);
  assert.doesNotMatch(source, /runtime\.safeZone\.x \+= \(targetX - runtime\.safeZone\.x\)/);
  assert.doesNotMatch(source, /elapsed \* 36 \+ channel/);
  assert.match(source, /stageProfile\.fallingRocks/);
  assert.match(source, /stageProfile\.safeZone/);
  assert.match(engineSource, /밝은 언덕배기로 피하세요/);
  assert.match(source, /밀물 물살에 휩쓸렸다! 밝은 언덕배기로!/);
  assert.match(source, /언덕배기 · 밀물 피난처/);
  assert.match(source, /rgba\(239,241,242,\.97\)/);
  assert.doesNotMatch(source, /모래톱/);
  assert.match(source, /stageProfile\.darkness/);
  assert.match(source, /mudflatHeadlampDiscoveryRange\(runtime\.equipment\.headlamp \?\? 0\)/);
  assert.match(source, /const lightMargin = template\.requiresHeadlamp \? headlampRange \+ 96 : 0/);
  assert.match(source, /if \(stageProfile\.darkness > 0\) \{\s*const radius = mudflatHeadlampDiscoveryRange\(runtime\.equipment\.headlamp \?\? 0\) \|\| 112;/);
  assert.doesNotMatch(source, /const radius = headlamp \? 215 : 112/);
  assert.match(source, /해산물 무리가 몰려옵니다/);
  assert.match(source, /정규 원정을 완주해 끝없는 물때가 열렸습니다/);
  assert.match(source, /context\.fillText\(emptyHazard\.message, width \/ 2, height \/ 2 - 69\)/);
  assert.match(source, /drawRockHookBar\(context, \{ x: width \/ 2, y: height \/ 2 \}, point, runtime\.rockFlipEffect\)/);
  assert.doesNotMatch(source, /rockFlipEffect\.originX|rockFlipEffect\.originY/);
  assert.match(source, /function drawDipNetSlam\(/);
  assert.match(source, /runtime\.netSlams\.push/);
  assert.match(source, /progress >= \.54/);
  assert.match(source, /function isInsideDipNetArea\(/);
  assert.match(source, /isInsideDipNetArea\(creature, netSlam\)/);
  assert.match(source, /const gripLength = 24/);
  assert.match(source, /const DAMAGE_TEXT_COLOR = "#ffd29a"/);
  assert.match(source, /const damageCreature = \(creature: Creature, damage: number, hitFlash = \.12\)/);
  assert.match(source, /text: damageText/);
  assert.match(source, /color: DAMAGE_TEXT_COLOR/);
  assert.match(source, /const playerDamage = baseDamage \+ stageStats\.contactDamageBonus/);
  assert.match(source, /kind: "playerDamage"/);
  assert.match(source, /const PLAYER_DAMAGE_TEXT_COLOR = "#ff695f"/);
  assert.match(source, /function isInsideDipNetArea\(/);
  assert.match(source, /const rerollUpgradeChoices/);
  assert.match(source, /최대 체력 20%/);
  assert.match(styles, /\.ms-layer \.ms-reroll\{width:fit-content;max-width:100%;min-height:62px/);
  assert.match(styles, /content:"채집기술 새로고침"/);
  assert.match(styles, /content:"- 최대 체력의 20% 사용"/);
  assert.match(source, /GENERAL_SKILL_ORDER/);
  assert.match(source, /MUDFLAT_FIXED_GENERAL_SKILL_IDS/);
  assert.match(source, /선택 기술 \{normalSkills\.length\} \/ 6/);
  assert.match(source, /className="ms-base-tools"/);
  assert.match(source, /className="ms-skill-detail"/);
  assert.match(source, /onClick=\{\(\) => setSelectedSkillId\(skill\.id\)\}/);
  assert.match(styles, /\.ms-skill-detail\{position:fixed/);
  assert.doesNotMatch(source, /damageCreature\([^\n]+#[0-9a-fA-F]{6}/);
  assert.doesNotMatch(source, /text: `\+\$\{item\.score\}`/);
  assert.match(source, /runtime\.harpoons/);
  assert.match(source, /hitIds: new Set<number>\(\)/);
  assert.doesNotMatch(source, /function drawRockSkewer\(/);
  assert.match(source, /activeMovement === "wander"/);
  assert.match(source, /activeMovement === "flee"/);
  assert.doesNotMatch(source, /stats\.xpChance/);
  assert.match(source, /CATCH SUMMARY/);
  assert.match(source, /ms-camp-auto-sale/);
  assert.match(source, /className="ms-departure-status" aria-label="현재 원정 상태"/);
  assert.match(source, /new ResizeObserver\(updateSpace\)/);
  assert.match(source, /--ms-departure-space/);
  assert.match(source, /mudflatCanLearnSkill\(current\.levels, id, current\.mode\)/);
  assert.match(source, /className="ms-departure-coins"[\s\S]*?\{campaign\.coins\.toLocaleString\(\)\}C/);
  assert.match(source, /aria-label="현재 체력"[\s\S]*?campHpPercent/);
  assert.match(source, /aria-label="현재 경험치"[\s\S]*?campXpPercent/);
  assert.match(source, /event\.target instanceof Element \? event\.target\.closest\("\.ms-shell button:not\(:disabled\)"\)/);
  assert.match(source, /button\.classList\.add\("ms-touch-confirmed"\)/);
  assert.match(styles, /\.ms-shell button\.ms-touch-confirmed\{animation:ms-button-confirm \.26s ease-out\}/);
  assert.match(source, /className="ms-market-table" role="table"/);
  assert.match(source, /<small>\{count\.toLocaleString\(\)\}×\{item\.price\}C<\/small>/);
  assert.match(source, /<span>전체 판매 가격<\/span>/);
  assert.doesNotMatch(source, /자동 판매 합계/);
  assert.match(styles, /\.ms-market-table\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)[^}]*overflow:hidden/);
  assert.doesNotMatch(source, /코인 자동 입금/);
  assert.doesNotMatch(source, /자동 정산했습니다|정산 복구| · 대왕 박하지/);
  assert.doesNotMatch(source, /1개 판매|바구니 모두 판매/);
  assert.match(source, /EQUIPMENT SHOP/);
  assert.match(source, /RECOVERY FOOD/);
  assert.match(source, /SKILL TRAINING/);
  assert.match(source, /paperoid-mudflat-survivor-campaign-v1/);
  assert.match(source, /runtime\.basket\[item\.type\]/);
  assert.match(source, /runtime\.rocks/);
  assert.match(source, /기본 스킨/);
  assert.match(source, /어린이 모드/);
  assert.match(source, /일반 모드/);
  assert.match(source, /GENERAL_CHARACTER = \{[^\n]+hp: 100 \}/);
  assert.match(source, /ms-mode-picker[\s\S]*?<b>일반 모드<\/b>[\s\S]*?<b>어린이 모드<\/b>/);
  assert.match(source, /className="ms-hero-crab" src="\/mudflat-creatures\/crab\.png"/);
  assert.match(styles, /\.ms-hero-crab\{position:absolute/);
  assert.doesNotMatch(source, /화면 아무 곳이나 누른 뒤 가고 싶은 방향으로 드래그하세요/);
  assert.match(source, /className="ms-setup-details ms-saved-expedition"/);
  assert.match(source, /className="ms-setup-details ms-route-select-details"/);
  assert.match(source, /<b>원정 경로·단계 선택<\/b>/);
  assert.match(source, /className="ms-stage-route-list"/);
  assert.match(source, /disabled=\{!unlocked\}/);
  assert.doesNotMatch(source, /ms-reentry-details|ms-roadmap-details/);
  assert.match(styles, /\.ms-setup-details\{margin-top:10px/);
  assert.match(styles, /\.ms-stage-route-list\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.ms-setup \.ms-character-select>\.ms-primary\{margin:18px auto 0/);
  assert.match(source, /runtime\.stage === 1 && runtime\.elapsed < 3[\s\S]*?일단 저 구멍들을 파봐야겠다\./);
  assert.match(source, /앗 따가워, 몸이 이상해\./);
  assert.match(source, /아 깜짝이야, 여기 돌이 있었네!/);
  assert.match(source, /HIGHEST_STAGE_KEY/);
  assert.match(source, /장비·기술·경험치·코인은 모두 초기화됩니다/);
  assert.match(source, /\{Math\.floor\(hud\.hp\)\} \/ \{Math\.floor\(hud\.maxHp\)\}/);
  assert.match(source, /createRadialGradient[\s\S]*?rgba\(3,8,15,0\)/);
  assert.match(source, /const bubbleTop = height \/ 2 - 116/);
  assert.match(styles, /\.ms-touch-hint\{display:none\}/);
  assert.match(source, /function MudflatTopbar/);
  assert.match(source, /className="game-topbar ms-topbar"/);
  assert.match(source, /<h1><span>갯벌에서<\/span>\{" "\}<span>힘이 다했습니다<\/span><\/h1>/);
  assert.match(source, /<span>갯벌에는 여러가지 위험이 도사리고 있습니다\.<\/span><br \/><span>절대로 자만하지 말고 안전한 해루질 하세요\.<\/span>/);
  assert.match(styles, /\.ms-result h1\{word-break:keep-all;text-wrap:balance\}/);
  assert.match(await readFile(new URL("../app/globals.css", import.meta.url), "utf8"), /\.game-title-lockup strong \{[\s\S]*?color: #211d21;/);
  assert.doesNotMatch(source, /paperoid · MUDFLAT ACTION/);
  assert.match(source, /creature\.family === "crab"/);
  assert.match(await readFile(new URL("../app/page.tsx", import.meta.url), "utf8"), /mudflat-creatures\/crab\.png/);
  assert.match(engineSource, /mudflat-creatures\/shrimp\.png/);
  assert.match(engineSource, /mudflat-creatures\/whelk\.png/);
  assert.match(engineSource, /mudflat-creatures\/golbaengi-v2\.png/);
  assert.match(engineSource, /mudflat-creatures\/octopus\.png/);
  assert.match(engineSource, /mudflat-creatures\/flounder\.png/);
  assert.match(engineSource, /requiresHeadlamp: true/);
  assert.match(source, /function drawClamHole\(/);
  assert.match(source, /function drawClamDigging\(/);
  assert.match(source, /progress >= 2/);
  assert.match(source, /mudflatClamRewardForRoll/);
  assert.match(source, /const clamSize = clamGrade\?\.visualSize \?\? 42/);
  assert.match(source, /context\.rotate\(Math\.PI \/ 2\)/);
  assert.match(source, /isVertical \? " is-vertical" : ""/);
  assert.match(source, /equipment\.headlamp/);
  assert.match(source, /function drawGatherer\([^)]*hasHeadlamp: boolean/);
  assert.match(source, /lumi-side-tongs-walk-transparent\.png/);
  assert.match(source, /lumi-front-tongs-walk-transparent\.png/);
  assert.match(source, /runtime\.player\.walking = Math\.hypot\(inputX, inputY\) > \.05/);
  assert.match(source, /runtime\.mode === "normal" && characterId !== "lumi" && \(runtime\.levels\.tongs \?\? 0\) > 0/);
  assert.match(source, /runtime\.equipment\.headlamp \?\? 0\) > 0/);
  assert.match(source, /rgba\(255,232,151,\.27\)/);
  assert.match(source, /rgba\(164,105,193,\.24\)/);
  assert.match(source, /color: "#aa72c6"/);
  assert.doesNotMatch(source, /color: "#8fdac5"/);
  assert.doesNotMatch(source, /const grid = 80/);
  assert.match(styles, /touch-action:none/);
  assert.match(styles, /data-game-id="mudflat-survivor"/);
  assert.doesNotMatch(styles, /\.ms-tools b\{display:none\}/);
});

test("uses official classic Battleship fleet and American checkers crowning", async () => {
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

  const battleshipSource = await readFile(new URL("../app/more-games.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(battleshipSource, /style=\{\{ "--sea-size": SEA_SIZE \} as CSSProperties\}/);
  assert.match(battleshipSource, /theme: "reversi" \| "mancala" \| "checkers" \| "battleship"/);
  assert.match(battleshipSource, /명중한 방향을 추리하세요/);
  assert.match(battleshipSource, /다섯 척을 모두 격침하세요/);
  assert.match(styles, /grid-template-columns: repeat\(var\(--sea-size\), minmax\(0, 1fr\)\)/);
  assert.match(styles, /grid-template-rows: repeat\(var\(--sea-size\), minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.learning-modal\.battleship \{ --learning-color: #277da3; --learning-soft: #e3f3f8; --learning-dark: #173f52; \}/);
  assert.match(styles, /\.learning-modal\.battleship \.tutorial-visual/);
  assert.doesNotMatch(styles, /\.sea-grid button\.ship/);
  assert.doesNotMatch(battleshipSource, /className=\{`\$\{!conceal && ship \? "ship"/);

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

test("renders the 64-cell Reversi board as a complete 8 by 8 grid", async () => {
  const gameSource = await readFile(new URL("../app/more-games.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(gameSource, /Array\.from\(\{ length: 64 \}/);
  assert.match(gameSource, /aria-label="8 곱하기 8 리버시 판"/);
  assert.match(styles, /\.reversi-board\s*\{[\s\S]*?grid-template-columns:\s*repeat\(8, minmax\(0, 1fr\)\);[\s\S]*?grid-template-rows:\s*repeat\(8, minmax\(0, 1fr\)\);/);
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
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /잉카의 다이아몬드/);
  assert.match(source, /\[1, 2, 3, 4, 5, 5, 7, 7, 9, 11, 11, 13, 14, 15, 17\]/);
  assert.match(source, /\[5, 7, 8, 10, 12\]/);
  assert.match(source, /IELLO 2016 규칙/);
  assert.match(source, /총점이 같으면 해당 탐험가들이 공동 승리/);
  assert.match(source, /scrollIntoView\(\{ behavior: "smooth", block: "nearest", inline: "center" \}\)/);
  assert.match(source, /aria-current=\{latest \? "step" : undefined\}/);
  assert.match(source, /latest-card-label/);
  assert.match(source, /남은 보석 \{card\.remaining\}/);
  assert.match(source, /카드 위 보석/);
  assert.doesNotMatch(source, /길에 \{card\.remaining\}|길의 보석|redistributeTrail/);
  assert.match(styles, /\.cave-card\.latest[\s\S]*?incan-latest-glow/);
  assert.match(styles, /\.cave-card > small \{[\s\S]*?font-size: 12px;[\s\S]*?white-space: nowrap;/);

  const cards = [
    { id: "a", type: "treasure", remaining: 3 },
    { id: "b", type: "hazard", hazard: "뱀" },
    { id: "c", type: "treasure", remaining: 2 },
    { id: "d", type: "treasure", remaining: 1 },
  ];
  const distributed = distributeRemainingGemsAcrossCards(cards, 4);
  assert.deepEqual(distributed.filter((card) => card.type === "treasure").map((card) => card.remaining), [2, 1, 1]);
  assert.equal(distributed.reduce((sum, card) => sum + (card.type === "treasure" ? card.remaining : 0), 0), 4);
});

test("offers all four standard Janggi horse-elephant setups", async () => {
  const source = await readFile(new URL("../app/janggi-game.tsx", import.meta.url), "utf8");

  assert.match(source, /안상 차림/);
  assert.match(source, /바깥상 차림/);
  assert.match(source, /왼상 차림/);
  assert.match(source, /오른상 차림/);
  assert.match(source, /이 차림으로 대국 시작/);
});

test("makes Janggi start action prominent and varies the AI setup", async () => {
  const source = await readFile(new URL("../app/janggi-game.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /className="janggi-start-button"[\s\S]*?차림 선택 완료 · AI 차림 무작위[\s\S]*?이 차림으로 대국 시작/);
  assert.match(source, /setupKeys\.filter\(\(setup\) => setup !== previous\)/);
  assert.match(source, /randomJanggiSetup\(previousHanSetup\.current\)/);
  assert.match(styles, /\.janggi-setup-picker \.janggi-start-button[\s\S]*?animation: janggi-start-glow/);
});

test("starts every game at the top and keeps the latest Janggi AI piece distinct", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(pageSource, /if \(!activeGame\) return;[\s\S]*?window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/);
  assert.match(pageSource, /window\.requestAnimationFrame\(scrollGameToTop\)/);
  assert.match(pageSource, /return installGameRefreshGuard\(document, window\)/);
  assert.match(styles, /html\.paperoid-game-active:not\(:has\(\.game-readability-scope \[data-game-menu\]\)\)[\s\S]*?overscroll-behavior-y: none/);
  assert.match(styles, /\.janggi-board button\.opponent-to \.janggi-piece \{[\s\S]*?background: #d9ba85/);
});

test("allows native refresh in game menus, protects play, and releases the guard on exit", () => {
  let menuVisible = true;
  const classes = new Set();
  const listeners = new Map();
  const root = { scrollTop: 0, classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) } };
  const document = { documentElement: root, querySelector: () => menuVisible ? {} : null };
  const window = {
    scrollY: 0,
    addEventListener: (type, listener, options) => {
      if (type === "touchmove") assert.equal(options.passive, false);
      listeners.set(type, listener);
    },
    removeEventListener: (type, listener) => {
      assert.equal(listeners.get(type), listener);
      listeners.delete(type);
    },
  };
  const touch = (type, positions, cancelable = true) => {
    let prevented = false;
    listeners.get(type)?.({ touches: positions.map((clientY) => ({ clientY })), cancelable, preventDefault: () => { prevented = true; } });
    return prevented;
  };
  const pull = () => { touch("touchstart", [50]); return touch("touchmove", [140]); };
  const cleanup = installGameRefreshGuard(document, window);
  assert.ok(classes.has("paperoid-game-active"));
  assert.equal(pull(), false, "menu keeps the native downward gesture");
  menuVisible = false;
  assert.equal(pull(), true, "starting play immediately protects progress");
  menuVisible = true;
  assert.equal(pull(), false, "returning to the same game's menu restores refresh");
  menuVisible = false;
  window.scrollY = 80;
  assert.equal(pull(), false, "ordinary page scrolling stays available");
  window.scrollY = 0;
  root.scrollTop = 80;
  assert.equal(pull(), false);
  root.scrollTop = 0;
  touch("touchstart", [140]);
  assert.equal(touch("touchmove", [50]), false, "upward swipes are not blocked");
  touch("touchstart", [50]);
  assert.equal(touch("touchmove", [140], false), false, "non-cancelable events are left alone");
  touch("touchstart", [50, 60]);
  assert.equal(touch("touchmove", [140, 150]), false, "pinch gestures are not blocked");
  assert.equal(touch("touchmove", [140]), false, "a remaining finger does not reuse a stale start");
  for (const end of ["touchend", "touchcancel"]) {
    touch("touchstart", [50]);
    touch(end, []);
    assert.equal(touch("touchmove", [140]), false);
  }
  cleanup();
  assert.equal(classes.size, 0);
  assert.equal(listeners.size, 0);
  assert.equal(pull(), false, "leaving the game restores unrestricted home refresh");
});

test("resets the home view and game shelves after a browser refresh", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /window\.history\.scrollRestoration = "manual"/);
  assert.match(pageSource, /document\.querySelectorAll<HTMLElement>\("\.game-shelf-track"\)/);
  assert.match(pageSource, /track\.scrollLeft = 0/);
  assert.match(pageSource, /window\.addEventListener\("pageshow", resetHomeView\)/);
  assert.match(pageSource, /setShowAllGames\(false\)/);
  assert.match(pageSource, /window\.localStorage\.removeItem\(SHOW_ALL_GAMES_STORAGE_KEY\)/);
  assert.match(pageSource, /key=\{recentGames\.length \? "recent-games" : "quick-start-games"\}/);
});

test("balances distinct AI personalities automatically in Seven Civilizations", async () => {
  const strategyIds = Object.keys(SW_AI_STRATEGIES);
  for (const playerCount of [3, 4, 5, 6, 7]) {
    const strategies = swAssignAiStrategies(playerCount, () => 0.37);
    assert.equal(strategies.length, playerCount - 1);
    assert.ok(strategies.every((strategy) => strategyIds.includes(strategy)));
    const counts = strategyIds.map((strategy) => strategies.filter((entry) => entry === strategy).length);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);

    const game = swCreateGame(playerCount, () => 0.37);
    assert.deepEqual(game.players.slice(1).map((player) => player.strategy), game.aiStrategies);
  }

  const source = await readFile(new URL("../app/seven-wonders-game.tsx", import.meta.url), "utf8");
  assert.match(source, /성향을 균형 있게 자동 배정합니다/);
  assert.match(source, /AI 성향 · \{SW_AI_STRATEGIES\[player\.strategy\]\.label\}/);
  assert.doesNotMatch(source, /<legend>AI 전략<\/legend>|setDifficulty/);
  assert.equal((source.match(/<strong>7대 문명<\/strong>/g) ?? []).length, 3);
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

    let game = swCreateGame(playerCount, () => 0.37);
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
  const game = swCreateGame(3, () => 0.37);
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

test("keeps Baccarat tutorial navigation on one horizontal row", async () => {
  const source = await readFile(new URL("../app/baccarat-game.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/baccarat.css", import.meta.url), "utf8");

  assert.match(source, /카드는 아직 공개되지 않았습니다/);
  assert.match(source, /베팅을 확정하면 플레이어와 뱅커의 카드가 공개됩니다/);
  assert.match(source, /aria-label="뒷면 카드"/);
  assert.match(source, /0~2점에서 항상 받고/);
  assert.match(source, /타이 적중 수익은 이 게임이 채택한 8:1/);
  assert.match(styles, /\.bc-card-reveal-notice\{/);
  assert.match(source, /className="bc-tutorial-nav"/);
  assert.match(styles, /\.bc-tutorial \.bc-tutorial-nav\{[^}]*display:grid;[^}]*grid-template-columns:1fr 1fr;/);
  assert.match(styles, /\.bc-tutorial-nav button:first-child\{justify-self:start\}/);
  assert.match(styles, /\.bc-tutorial-nav button:last-child\{justify-self:end\}/);
});

test("uses the shared Paperoid brand copy in the Baccarat topbar", async () => {
  const source = await readFile(new URL("../app/baccarat-game.tsx", import.meta.url), "utf8");

  assert.match(source, /<small>paperoid<\/small><strong>바카라<\/strong>/);
  assert.doesNotMatch(source, /TABLE CLASSIC/);
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
  assert.match(source, /eliminatedIds: number\[\]/);
  assert.match(source, /패배 원인/);
  assert.match(source, /덱 소진 · 최종 손패 비교/);
  assert.match(source, /결정적 행동/);
  assert.match(source, /라운드 최종 상태/);
  assert.match(styles, /\.love-latest-action\.danger/);
  assert.match(styles, /\.love-log li\.involves-human/);
  assert.match(styles, /\.love-result-cause\.loss/);
  assert.match(styles, /\.love-final-hands/);
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

test("opens public games from direct URLs and keeps history URLs in sync", async () => {
  const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const directRoute = await readFile(new URL("../app/[gameId]/page.tsx", import.meta.url), "utf8");

  assert.match(directRoute, /return <Home \/>/);
  assert.match(pageSource, /function publicGameIdFromPath\(value: string \| null \| undefined\): GameId \| null/);
  assert.match(pageSource, /haeru: "mudflat-survivor"/);
  assert.match(pageSource, /if \(gameId === "mudflat-survivor"\) return "\/haeru"/);
  assert.match(pageSource, /DEFAULT_HIDDEN_GAME_IDS\.has\(gameId\) \? null : gameId/);
  assert.match(pageSource, /function gamePath\(gameId: GameId \| null\)/);
  assert.match(pageSource, /const directPath = requestedGameId \?\? window\.location\.pathname\.replace/);
  assert.match(pageSource, /const directGame = publicGameIdFromPath\(directPath\)/);
  assert.match(pageSource, /const openingGame = pendingGame \?\? directGame/);
  assert.match(pageSource, /canonicalUrl\.pathname = gamePath\(directGame\)/);
  assert.match(pageSource, /window\.history\.pushState\(window\.history\.state, "", nextUrl\.toString\(\)\)/);
  assert.match(pageSource, /window\.addEventListener\("popstate", restoreGameFromHistory\)/);
  assert.match(pageSource, /syncGameUrl\(id\);/);
  assert.match(pageSource, /syncGameUrl\(null\);/);
});

test("keeps Lumi's walk, turning, and tong collision in independent motion", () => {
  const motion = createLumiMotion();
  const tick = (values = {}) => advanceLumiMotion(motion, { facing: 0, distance: 0, walking: false, tongSpeed: 1.55, dt: .1, ...values });
  tick();
  assert.equal(motion.phase, 0, "standing must not advance the walking cycle");
  assert.ok(motion.tongAngle > 0, "the tongs must continue while standing");
  const startAngle = motion.tongAngle;
  tick({ walking: true, distance: 21, tongSpeed: 3.1 });
  assert.equal(motion.phase, .25);
  assert.ok(Math.abs(motion.tongAngle - startAngle - .31) < 1e-9, "upgrading changes speed, not angular position");
  tick({ facing: 49 * Math.PI / 180 });
  assert.equal(motion.direction, "side", "small diagonal changes must not flicker directions");
  tick({ facing: 60 * Math.PI / 180 });
  assert.equal(motion.direction, "front");
  tick({ facing: 41 * Math.PI / 180 });
  assert.equal(motion.direction, "front");
  tick({ facing: Math.PI });
  assert.equal(lumiPose(motion).mirror, -1);
  for (let step = 0; step < 60; step += 1) {
    tick();
    const tool = lumiTongPose(motion, 105);
    assert.ok(Math.abs(Math.hypot(tool.tipX, tool.tipY) - 105) < 1e-9);
    assert.ok(Math.abs(tool.handX + Math.cos(tool.angle) * tool.length - tool.tipX) < 1e-9);
    assert.ok(Math.abs(tool.handY + Math.sin(tool.angle) * tool.length - tool.tipY) < 1e-9);
  }
  assert.equal(lumiPose(motion).frame, 0, "stopping settles into a stable pose");
});

test("clears the atlas matte without clearing enclosed character highlights", () => {
  const width = 80; const height = 30;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 2; y <= 7; y += 1) for (let x = 2; x <= 7; x += 1) {
    if (x !== 2 && x !== 7 && y !== 2 && y !== 7) continue;
    const index = (y * width + x) * 4;
    pixels[index] = 40; pixels[index + 1] = 50; pixels[index + 2] = 45;
  }
  clearLumiAtlasMatte(pixels, width, height);
  assert.equal(pixels[3], 0);
  assert.equal(pixels[(4 * width + 4) * 4 + 3], 255, "enclosed whites in the face must stay opaque");
  assert.equal(pixels[(4 * width + 2) * 4 + 3], 255, "dark outlines must survive");
});

test("places the return camp wholly offscreen relative to the current player", () => {
  for (const [width, height] of [[360, 640], [1024, 600], [768, 768]]) {
    for (const radii of [{ radiusX: 460, radiusY: 92 }, { radiusX: 165.6, radiusY: 68.08 }]) {
      for (const facing of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const player = { x: 2345, y: -6789, facing };
        const camp = mudflatReturnCampPosition(player, width, height, radii);
        const dx = Math.abs(camp.x - player.x); const dy = Math.abs(camp.y - player.y);
        assert.ok(dx - radii.radiusX > width / 2 || dy - radii.radiusY > height / 2);
        const approach = width <= height ? dx - radii.radiusX : dy - radii.radiusY;
        assert.ok(approach <= Math.min(width, height) / 2 + 72.001);
      }
    }
  }
  assert.equal(mudflatTideStats(229.999, 100).guideVisible, false);
  assert.equal(mudflatTideStats(230, 100).guideVisible, true);
});

test("periodic tides rise for one second, hit at the crest, and drain in one second", () => {
  for (const interval of [25, 27, 31, 43, 48]) {
    for (const elapsed of [0, .5, 1, 2, interval - .01]) {
      assert.equal(mudflatStageTideState(elapsed, interval).fill, 0, "no phantom starting tide");
      assert.equal(mudflatStageTideState(elapsed, interval).impactCycle, 0);
    }
    for (const [offset, fill, impactCycle, settled] of [
      [0, 0, 0, false], [.25, .25, 0, false], [.5, .5, 0, false],
      [1, 1, 1, false], [1.5, .5, 1, false], [1.75, .25, 1, false],
      [2, 0, 1, true], [3, 0, 1, true],
    ]) {
      assert.deepEqual(mudflatStageTideState(interval + offset, interval), { cycle: 1, fill, impactCycle, settled });
    }
    let lastImpact = 0;
    const hits = [];
    for (let frame = 0; frame < 240 * 60; frame += 1) {
      const elapsed = frame / 60;
      const state = mudflatStageTideState(elapsed, interval);
      assert.ok(state.fill >= 0 && state.fill <= 1);
      if (state.impactCycle > lastImpact) {
        lastImpact = state.impactCycle;
        hits.push(elapsed);
        assert.equal(state.fill, 1, "each damage check occurs only at the full-water crest");
      }
    }
    assert.deepEqual(hits, Array.from({ length: Math.floor((239 - 1) / interval) }, (_, index) => (index + 1) * interval + 1));
    assert.equal(mudflatStageTideState(240, interval).fill, 0, "final return tide takes over without periodic damage");
  }
  assert.equal(mudflatStageTideState(49, 0).fill, 0);
  assert.equal(mudflatStageTideState(49, 0).impactCycle, 0);
  assert.equal(mudflatTideStats(242, 100).active, true, "return tide stays full instead of draining");
});

test("children's collection effects preserve range, orbit, and canvas state", async () => {
  const { HARVEST_PULSE_SECONDS, harvestPulseFrame, saltSpiritPose, drawHarvestPulse, drawSaltSpirit } = await import("../app/mudflat-kids-effects.js");
  assert.equal(harvestPulseFrame(0, 102).opacity, 0);
  let previousRadius = 0;
  for (let frame = 0; frame <= 60; frame += 1) {
    const pulse = harvestPulseFrame(HARVEST_PULSE_SECONDS * (1 - frame / 60), 102);
    assert.ok(pulse.waveRadius >= previousRadius && pulse.waveRadius <= 102);
    assert.ok(pulse.opacity >= 0 && pulse.opacity <= 1);
    previousRadius = pulse.waveRadius;
  }
  const states = [];
  let drawCalls = 0;
  const context = new Proxy({ globalAlpha: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "save") return () => states.push({ ...target });
      if (key === "restore") return () => { assert.ok(states.length > 0); Object.assign(target, states.pop()); };
      return (...args) => {
        drawCalls += 1;
        for (const value of args) if (typeof value === "number") assert.ok(Number.isFinite(value));
        if (String(key).startsWith("create")) return { addColorStop(offset) { assert.ok(offset >= 0 && offset <= 1); } };
      };
    },
  });
  for (const level of [1, 2, 6]) {
    const count = 1 + Math.floor(level / 2);
    for (const elapsed of [0, .25, 240]) {
      for (let index = 0; index < count; index += 1) {
        const pose = saltSpiritPose(elapsed, level, index);
        assert.ok(Math.abs(Math.hypot(pose.x, pose.y) - (66 + level * 3)) < 1e-8);
        assert.equal(pose.angle, elapsed * (1.8 + level * .08) + index / count * Math.PI * 2);
        drawSaltSpirit(context, 180, 320, elapsed, level, index);
        assert.equal(states.length, 0);
        assert.equal(context.globalAlpha, 1);
      }
      drawHarvestPulse(context, 180, 320, 78 + level * 12, HARVEST_PULSE_SECONDS * .5, elapsed);
      assert.equal(states.length, 0);
      assert.equal(context.globalAlpha, 1);
    }
  }
  assert.ok(drawCalls > 0);
});

test("uses the salt spirit name throughout the children's mode without renaming normal digging", async () => {
  const source = await readFile(new URL("../app/mudflat-survivor-game.tsx", import.meta.url), "utf8");
  assert.equal(MUDFLAT_UPGRADES.find((skill) => skill.id === "salt").name, "소금 결정의 정령");
  assert.equal(MUDFLAT_GENERAL_UPGRADES.find((skill) => skill.id === "digging").name, "호미질");
  assert.equal(MUDFLAT_UPGRADES.find((skill) => skill.id === "hoe").name, "갯벌 파동");
  assert.equal(MUDFLAT_UPGRADES.find((skill) => skill.id === "net").name, "장거리 자동 뜰채");
  assert.doesNotMatch(source, /왕소금|radius, -\.18, Math\.PI \* 1\.55/);
  assert.match(source, /갯벌 파동 Lv\.2/);
  assert.match(source, /뜰채장인 채리/);
  assert.match(source, /장거리 자동 뜰채 Lv\.2/);
  assert.match(source, /갯벌소년 펄럭/);
  assert.match(source, /바다요정 바요/);
  assert.match(source, /saltSpiritPose\(runtime\.elapsed, saltLevel, index\)/);
  assert.match(source, /drawSaltSpirit\(context/);
  assert.match(source, /drawHarvestPulse\(context/);
  assert.match(source, /소금 결정의 정령 Lv\.2/);
});

test("entering camp cancels every harvest effect without deleting rewards or world state", async () => {
  const { mudflatStopHarvestInCamp } = await import("../app/mudflat-survivor-engine.js");
  const queues = ["projectiles", "harpoons", "netSlams", "castNets", "clamReveals"];
  for (const mode of ["normal", "kids"]) {
    for (const stage of [1, 2, 8]) {
      const progress = (stage - 1) / 7;
      const radii = { radiusX: 92 * (5 - 3.2 * progress), radiusY: 92 * (1 - .26 * progress) };
      const runtime = {
        mode, stage, player: { x: 0, y: 0, hp: 82, walking: true },
        baseCamp: { x: 0, y: 0 }, baseCampGuideShown: false,
        ...Object.fromEntries(queues.map((key) => [key, [{ id: key, life: .01 }]])),
        hoeEffect: .3, electricPulseLife: .2, rockFlipEffect: { rockId: 1, life: .001 },
        clamHoles: [{ id: 1, progress: 1.99 }],
        bursts: [{ id: 1, kind: "harvest" }, { id: 2 }],
        floatTexts: [{ id: 1, kind: "harvest" }, { id: 2, kind: "playerDamage" }, { id: 3 }],
        pickups: [{ x: 0, y: 0, xp: 8 }], creatures: [{ id: 1, hp: 20 }], rocks: [{ id: 1 }],
        basket: { clam: 4 }, caught: 4, xp: 12, hoeClock: .3, electricClock: .4, selfShockClock: 2,
        elapsed: 230, paused: false,
      };
      const before = structuredClone(runtime);
      assert.equal(mudflatStopHarvestInCamp(runtime, radii), false, "an unrevealed camp has no effect");
      assert.deepEqual(runtime, before);
      runtime.baseCampGuideShown = true;
      runtime.player.x = radii.radiusX + .01;
      const outside = structuredClone(runtime);
      assert.equal(mudflatStopHarvestInCamp(runtime, radii), false);
      assert.deepEqual(runtime, outside, "harvesting outside the camp is untouched");
      runtime.player.x = radii.radiusX;
      assert.equal(mudflatStopHarvestInCamp(runtime, radii), true, "the shoreline is inside the camp");
      for (const key of queues) assert.deepEqual(runtime[key], [], key);
      assert.equal(runtime.hoeEffect, 0);
      assert.equal(runtime.electricPulseLife, 0);
      assert.equal(runtime.rockFlipEffect, null, "a nearly finished rock cannot complete on entry");
      assert.equal(runtime.clamHoles[0].progress, 0);
      assert.deepEqual(runtime.bursts, [{ id: 2 }], "keep environmental effects");
      assert.deepEqual(runtime.floatTexts, [{ id: 2, kind: "playerDamage" }, { id: 3 }]);
      for (const key of ["pickups", "creatures", "rocks", "basket", "caught", "xp", "hoeClock", "electricClock", "selfShockClock", "elapsed", "paused"]) {
        assert.deepEqual(runtime[key], before[key], `preserve ${key}`);
      }
      assert.equal(runtime.player.hp, 82);
      assert.equal(runtime.player.walking, true);
      const stopped = structuredClone(runtime);
      assert.equal(mudflatStopHarvestInCamp(runtime, radii), true);
      assert.deepEqual(runtime, stopped, "staying in camp is idempotent");
      runtime.player.x = 0; runtime.player.y = radii.radiusY + .01;
      assert.equal(mudflatStopHarvestInCamp(runtime, radii), false, "leaving camp re-enables actions");
      assert.deepEqual(runtime.castNets, [], "cancelled casts never return after leaving");
    }
  }
});

test("camp obstacle exclusion accounts for the full footprint at every stage size", () => {
  const camp = { x: 987, y: -654 };
  for (let stage = 1; stage <= 8; stage += 1) {
    const progress = (stage - 1) / 7;
    const radii = { radiusX: 92 * (5 - 3.2 * progress), radiusY: 92 * (1 - .26 * progress) };
    for (const clearance of [37, 46, 48, 49]) {
      assert.equal(mudflatCampObstacleAllowed(camp, camp, radii, false, clearance), true, "hidden camp does not affect initial spawns");
      assert.equal(mudflatCampObstacleAllowed(camp, camp, radii, true, clearance), false);
      for (const angle of [0, .3, Math.PI / 2, Math.PI, -Math.PI / 4]) {
        const point = { x: camp.x + Math.cos(angle) * (radii.radiusX + clearance * .9), y: camp.y + Math.sin(angle) * (radii.radiusY + clearance * .9) };
        assert.equal(mudflatCampObstacleAllowed(point, camp, radii, true, clearance), false, "camp edge and shoreline buffer remain clear");
      }
      assert.equal(mudflatCampObstacleAllowed({ x: camp.x + radii.radiusX + clearance + 1, y: camp.y }, camp, radii, true, clearance), true);
    }
  }
});

test("all rock, hole, and falling-rock spawn paths respect the camp exclusion", async () => {
  const source = await readFile(new URL("../app/mudflat-survivor-game.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/runtime\.rocks\.push\(/g) ?? []).length, 1, "all rocks use the guarded addRock helper");
  assert.match(source, /if \(!campObstacleAllowed\(rock, rock\.radius \+ 20\)\) return false;\s*runtime\.rocks\.push\(rock\)/);
  assert.match(source, /if \(campObstacleAllowed\(hole, 48\)\) runtime\.clamHoles\.push\(hole\)/);
  assert.match(source, /if \(campObstacleAllowed\(falling, falling\.radius \+ 20\)\) runtime\.fallingRocks\.push\(falling\)/);
  for (const collection of ["rocks", "clamHoles", "fallingRocks"]) {
    assert.ok(source.includes(`runtime.${collection} = runtime.${collection}.filter((`), `existing ${collection} are cleared when camp appears`);
  }
});

test("uses a throttled character speech bubble when the Mudflat haul container is full", async () => {
  const source = await readFile(new URL("../app/mudflat-survivor-game.tsx", import.meta.url), "utf8");
  assert.match(source, /const showCatchFullMessage = \(\) =>/);
  assert.match(source, /const CATCH_FULL_MESSAGE = "더 담을 수가 없어\. 다음에는 큰 통을 가져와야겠다\."/);
  assert.match(source, /showPlayerMessage\(CATCH_FULL_MESSAGE, 1\.2\)/);
  assert.match(source, /runtime\.catchFullNoticeClock = 15/);
  assert.match(source, /isCatchFullMessage \? Math\.min\(1, runtime\.playerMessageLife \/ \.45\)/);
  assert.doesNotMatch(source, /조과통이 가득 찼습니다/);
});
