"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BattleshipGame,
  CheckersGame,
  DiceDuelGame,
  MancalaGame,
  ReversiGame,
} from "./more-games";
import { JanggiGame } from "./janggi-game";
import { WinnersCircleGame } from "./winners-circle-game";
import { IncanGoldGame } from "./incan-gold-game";
import { QwixxGame } from "./qwixx-game";
import { ConfrontationGame } from "./confrontation-game";
import { LoveLetterGame } from "./love-letter-game";
import { MinivilleGame } from "./miniville-game";
import { PickPicnicGame } from "./pick-picnic-game";
import { EpicDuelsGame } from "./epic-duels-game";
import { SdGundamDeluxeGame } from "./sd-gundam-deluxe-game";
import { ScotlandYardGame } from "./scotland-yard-game";
import { WhitechapelGame } from "./whitechapel-game";
import { SevenWondersGame } from "./seven-wonders-game";
import { CamelUpGame } from "./camel-up-game";
import { TichuGame } from "./tichu-game";
import { CashflowEscapeGame } from "./cashflow-escape-game";
import { BaccaratGame } from "./baccarat-game";
import { ClocktowersGame } from "./clocktowers-game";
import {
  ColorChainGame,
  DotSurvivorGame,
  NumberDropGame,
  ParkingEscapeGame,
  PocketStackGame,
  UntangleGame,
} from "./casual-games";
import { PaperDungeonGame } from "./paper-dungeon-game";
import { TenSecondsGame } from "./ten-seconds-game";
import { MudflatSurvivorGame } from "./mudflat-survivor-game";
import { TetrisGame } from "./tetris-game";
import { ChessGame } from "./chess-game";
import { GameObjectiveGuide } from "./game-objective-guide";
import {
  BackgammonGame,
  ChineseCheckersGame,
  DiamondGame,
  DominoGame,
  GonuGame,
  NineMensMorrisGame,
} from "./classic-games";

type GameId =
  | "gomoku"
  | "memory"
  | "reversi"
  | "mancala"
  | "battleship"
  | "dice"
  | "checkers"
  | "chess"
  | "janggi"
  | "winners-circle"
  | "nine-mens-morris"
  | "gonu"
  | "domino"
  | "backgammon"
  | "chinese-checkers"
  | "diamond"
  | "incan-gold"
  | "qwixx"
  | "confrontation"
  | "love-letter"
  | "miniville"
  | "pick-picnic"
  | "epic-duels"
  | "sd-gundam-deluxe"
  | "scotland-yard"
  | "whitechapel"
  | "seven-wonders"
  | "camel-up"
  | "tichu"
  | "cashflow-escape"
  | "baccarat"
  | "clocktowers"
  | "pocket-stack"
  | "color-chain"
  | "number-drop"
  | "dot-survivor"
  | "untangle"
  | "parking-escape"
  | "paper-dungeon"
  | "ten-seconds"
  | "mudflat-survivor"
  | "tetris";
type Category = "전체" | "전략" | "고전게임" | "기억력" | "추리" | "퍼즐" | "주사위" | "경주" | "터치류" | "RPG";

const CATEGORIES: Category[] = ["전체", "전략", "고전게임", "기억력", "추리", "퍼즐", "주사위", "경주", "터치류", "RPG"];
const GAME_CATEGORIES: Exclude<Category, "전체">[] = ["전략", "고전게임", "기억력", "추리", "퍼즐", "주사위", "경주", "터치류", "RPG"];

type GameDefinition = {
  id: GameId;
  title: string;
  subtitle: string;
  category: Exclude<Category, "전체">;
  players: string;
  tone: "violet" | "orange" | "teal" | "gold" | "blue" | "red" | "green" | "navy";
};

const GAMES: GameDefinition[] = [
  {
    id: "gomoku",
    title: "오목",
    subtitle: "다섯 돌을 먼저 이으세요",
    category: "고전게임",
    players: "AI 1:1",
    tone: "violet",
  },
  {
    id: "memory",
    title: "짝 맞추기",
    subtitle: "같은 그림의 위치를 기억하세요",
    category: "기억력",
    players: "AI 1:1",
    tone: "orange",
  },
  {
    id: "reversi",
    title: "리버시",
    subtitle: "상대의 돌을 뒤집어 판을 채우세요",
    category: "고전게임",
    players: "AI 1:1",
    tone: "teal",
  },
  {
    id: "mancala",
    title: "만칼라",
    subtitle: "돌을 나누어 보물창고를 채우세요",
    category: "고전게임",
    players: "AI 1:1",
    tone: "gold",
  },
  {
    id: "battleship",
    title: "해전",
    subtitle: "좌표를 추리해 숨은 함대를 격침하세요",
    category: "추리",
    players: "AI 1:1",
    tone: "blue",
  },
  {
    id: "scotland-yard",
    title: "스코틀랜드 야드",
    subtitle: "이동 티켓을 추리해 미스터 X의 도주로를 봉쇄하세요",
    category: "추리",
    players: "AI 1:1",
    tone: "navy",
  },
  {
    id: "whitechapel",
    title: "화이트채플",
    subtitle: "네 번의 밤 동안 단서를 수색해 숨은 범인을 체포하세요",
    category: "추리",
    players: "AI 1:1",
    tone: "navy",
  },
  {
    id: "seven-wonders",
    title: "7대 문명",
    subtitle: "카드를 드래프트해 찬란한 고대 문명을 완성하세요",
    category: "전략",
    players: "AI 포함 3~7인",
    tone: "gold",
  },
  {
    id: "dice",
    title: "주사위 대결 Yahtzee",
    subtitle: "최적의 주사위를 남겨 높은 점수를 만드세요",
    category: "주사위",
    players: "AI 1:1",
    tone: "red",
  },
  {
    id: "checkers",
    title: "체커",
    subtitle: "대각선 전진과 점프로 상대 말을 잡으세요",
    category: "고전게임",
    players: "AI 1:1",
    tone: "green",
  },
  {
    id: "chess",
    title: "체스",
    subtitle: "기물의 역할을 살려 상대 킹을 체크메이트하세요",
    category: "고전게임",
    players: "AI 1:1",
    tone: "navy",
  },
  {
    id: "janggi",
    title: "장기",
    subtitle: "궁을 지키며 한 수 앞을 내다보세요",
    category: "고전게임",
    players: "AI 1:1",
    tone: "green",
  },
  {
    id: "winners-circle",
    title: "위너스 서클",
    subtitle: "베팅한 말을 결승선까지 이끄세요",
    category: "경주",
    players: "AI 2~6인",
    tone: "navy",
  },
  {
    id: "camel-up",
    title: "카멜 업",
    subtitle: "쌓이고 뒤집히는 낙타 경주의 순위를 예측하세요",
    category: "경주",
    players: "AI 포함 3~8인",
    tone: "orange",
  },
  {
    id: "tichu",
    title: "티츄",
    subtitle: "파트너와 호흡을 맞춰 손의 카드를 먼저 비우세요",
    category: "전략",
    players: "AI 포함 4인 팀전",
    tone: "red",
  },
  {
    id: "cashflow-escape",
    title: "현금흐름 탈출",
    subtitle: "자산이 일하는 구조를 만들어 재무 자유에 도전하세요",
    category: "전략",
    players: "AI 포함 2~6인",
    tone: "teal",
  },
  {
    id: "baccarat",
    title: "바카라",
    subtitle: "9에 가까운 패를 예측하는 가상 칩 카드게임",
    category: "전략",
    players: "AI 딜러 1인",
    tone: "green",
  },
  {
    id: "nine-mens-morris",
    title: "나인 멘스 모리스",
    subtitle: "세 말을 잇고 상대의 길을 막으세요",
    category: "고전게임",
    players: "AI 1:1",
    tone: "violet",
  },
  {
    id: "gonu",
    title: "고누",
    subtitle: "전통 말판에서 상대의 퇴로를 막으세요",
    category: "고전게임",
    players: "AI 1:1",
    tone: "gold",
  },
  {
    id: "domino",
    title: "도미노",
    subtitle: "같은 눈을 맞춰 패를 먼저 비우세요",
    category: "고전게임",
    players: "AI 1:1",
    tone: "teal",
  },
  {
    id: "backgammon",
    title: "백개먼",
    subtitle: "주사위를 읽고 모든 말을 귀환시키세요",
    category: "주사위",
    players: "AI 1:1",
    tone: "red",
  },
  {
    id: "chinese-checkers",
    title: "차이니즈 체커",
    subtitle: "연속 도약으로 별 모양 판을 건너세요",
    category: "고전게임",
    players: "AI 1:1",
    tone: "blue",
  },
  {
    id: "diamond",
    title: "다이아몬드 게임",
    subtitle: "한국식 소형 별판을 2~3인이 건너세요",
    category: "고전게임",
    players: "AI 2~3인",
    tone: "gold",
  },
  {
    id: "incan-gold",
    title: "잉카의 다이아몬드",
    subtitle: "더 깊이 들어갈지 보물을 챙겨 돌아올지 결정하세요",
    category: "전략",
    players: "AI 포함 3~8인",
    tone: "orange",
  },
  {
    id: "qwixx",
    title: "큐윅스",
    subtitle: "색깔 숫자 줄을 왼쪽부터 채워 높은 점수를 만드세요",
    category: "주사위",
    players: "AI 포함 2~5인",
    tone: "red",
  },
  {
    id: "confrontation",
    title: "빛과 그림자의 대결",
    subtitle: "정체를 숨긴 기물로 적진을 돌파하세요",
    category: "전략",
    players: "AI 1:1",
    tone: "navy",
  },
  {
    id: "love-letter",
    title: "러브레터",
    subtitle: "한 장의 비밀로 상대의 편지를 추리하세요",
    category: "추리",
    players: "AI 포함 2~6인",
    tone: "red",
  },
  {
    id: "miniville",
    title: "미니빌",
    subtitle: "주사위 수입으로 나만의 작은 도시를 완성하세요",
    category: "주사위",
    players: "AI 포함 2~4인",
    tone: "blue",
  },
  {
    id: "clocktowers",
    title: "시계탑",
    subtitle: "층과 시계, 색 지붕을 조합해 도시의 탑을 완성하세요",
    category: "전략",
    players: "AI 포함 2~4인",
    tone: "gold",
  },
  {
    id: "pick-picnic",
    title: "픽 피크닉",
    subtitle: "먹이를 노리는 새와 여우의 눈치 싸움을 즐기세요",
    category: "전략",
    players: "AI 포함 2~6인",
    tone: "green",
  },
  {
    id: "epic-duels",
    title: "스타워즈 에픽 듀얼",
    subtitle: "전설적인 캐릭터 팀을 이끌어 카드와 전술로 결투하세요",
    category: "전략",
    players: "AI 1:1",
    tone: "navy",
  },
  {
    id: "sd-gundam-deluxe",
    title: "SD 건담 디럭스",
    subtitle: "우주 기지를 점령하거나 요새에서 SD 부대를 지휘하세요",
    category: "전략",
    players: "AI 포함 2~6인",
    tone: "blue",
  },
  {
    id: "pocket-stack",
    title: "포켓 스택",
    subtitle: "흔들리는 블록을 정확히 맞춰 높이 쌓으세요",
    category: "터치류",
    players: "1인 기록 도전",
    tone: "red",
  },
  {
    id: "color-chain",
    title: "컬러 체인",
    subtitle: "같은 색 점을 길게 이어 한 번에 터뜨리세요",
    category: "터치류",
    players: "1인 기록 도전",
    tone: "violet",
  },
  {
    id: "number-drop",
    title: "넘버 드롭",
    subtitle: "같은 숫자를 합쳐 더 큰 타일을 만드세요",
    category: "터치류",
    players: "1인 기록 도전",
    tone: "blue",
  },
  {
    id: "dot-survivor",
    title: "도트 서바이버",
    subtitle: "몰려오는 점을 피해 60초를 버티세요",
    category: "터치류",
    players: "1인 생존 도전",
    tone: "teal",
  },
  {
    id: "untangle",
    title: "줄 풀기",
    subtitle: "점을 옮겨 얽힌 선의 교차를 없애세요",
    category: "터치류",
    players: "1인 퍼즐",
    tone: "orange",
  },
  {
    id: "parking-escape",
    title: "주차 탈출",
    subtitle: "차량을 밀어 빨간 차의 출구를 여세요",
    category: "퍼즐",
    players: "1인 퍼즐",
    tone: "green",
  },
  {
    id: "paper-dungeon",
    title: "종이 던전",
    subtitle: "직업을 고르고 열 장의 던전을 되찾으세요",
    category: "RPG",
    players: "1인 로그라이트",
    tone: "navy",
  },
  {
    id: "ten-seconds",
    title: "10.00",
    subtitle: "시간 감각만으로 정확히 10초를 맞추세요",
    category: "터치류",
    players: "1인 기록 도전",
    tone: "red",
  },
  {
    id: "mudflat-survivor",
    title: "해루질럿",
    subtitle: "어린이·일반 모드에서 밀물 전 해산물을 채집하세요",
    category: "터치류",
    players: "1인 생존 채집",
    tone: "teal",
  },
  {
    id: "tetris",
    title: "테트리스",
    subtitle: "블록을 쌓아 가로줄을 완성하고 지우세요",
    category: "터치류",
    players: "1인 기록 도전",
    tone: "violet",
  },
];

const DEFAULT_HIDDEN_GAME_IDS = new Set<GameId>([
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
  "mudflat-survivor",
  "paper-dungeon",
  "tetris",
]);

const SHOW_ALL_GAMES_STORAGE_KEY = "paperoid-show-all-games";

const IconSearch = () => (
  <span className="search-icon" aria-hidden="true" />
);

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function GuidedGame({ gameId, children }: { gameId: GameId; children: ReactNode }) {
  return (
    <div className="game-readability-scope" data-game-id={gameId}>
      <GameObjectiveGuide gameId={gameId} />
      {children}
    </div>
  );
}

function GameArtwork({ game }: { game: GameDefinition }) {
  if (game.id === "gomoku") {
    return (
      <div className="card-art gomoku-art" aria-hidden="true">
        <div className="mini-board">
          <span className="mini-stone dark s1" />
          <span className="mini-stone light s2" />
          <span className="mini-stone dark s3" />
          <span className="mini-stone light s4" />
          <span className="mini-stone dark s5" />
          <span className="mini-stone light s6" />
        </div>
        <span className="float-chip">15 × 15</span>
      </div>
    );
  }

  if (game.id === "memory") return (
    <div className="card-art memory-art" aria-hidden="true">
      <span className="memory-tile tile-a"><img className="memory-character" src={memoryCharacterImage("moon-jelly")} alt="" /></span>
      <span className="memory-tile tile-b"><img className="memory-character" src={memoryCharacterImage("lantern-owl")} alt="" /></span>
      <span className="memory-tile tile-c"><img className="memory-character" src={memoryCharacterImage("moon-jelly")} alt="" /></span>
      <span className="memory-tile tile-d"><img className="memory-character" src={memoryCharacterImage("paper-dragon")} alt="" /></span>
      <span className="float-chip">8 pairs</span>
    </div>
  );

  if (game.id === "reversi") {
    return (
      <div className="card-art reversi-art" aria-hidden="true">
        <div className="preview-grid reversi-preview">
          {Array.from({ length: 16 }, (_, index) => (
            <i key={index} className={[5, 10].includes(index) ? "light" : [6, 9, 11].includes(index) ? "dark" : ""} />
          ))}
        </div>
        <span className="float-chip">8 × 8</span>
      </div>
    );
  }

  if (game.id === "mancala") {
    return (
      <div className="card-art mancala-art" aria-hidden="true">
        <div className="mancala-preview">
          <i className="store" />
          <span>{Array.from({ length: 6 }, (_, index) => <b key={index}>{index % 2 ? "•••" : "••"}</b>)}</span>
          <span>{Array.from({ length: 6 }, (_, index) => <b key={index}>{index % 3 ? "••" : "••••"}</b>)}</span>
          <i className="store" />
        </div>
        <span className="float-chip">48 stones</span>
      </div>
    );
  }

  if (game.id === "battleship") {
    return (
      <div className="card-art battleship-art" aria-hidden="true">
        <div className="preview-grid battleship-preview">
          {Array.from({ length: 25 }, (_, index) => <i key={index} className={[6, 7, 8, 17, 22].includes(index) ? "ship" : [3, 14].includes(index) ? "hit" : ""} />)}
        </div>
        <span className="float-chip">Fleet 3</span>
      </div>
    );
  }

  if (game.id === "scotland-yard") {
    return (
      <div className="card-art scotland-yard-card-art" aria-hidden="true">
        <div className="scotland-yard-preview">
          <i className="one" />
          <i className="two" />
          <i className="three" />
          <span className="a">18</span>
          <span className="b">?</span>
          <span className="c">71</span>
        </div>
        <span className="float-chip">22 rounds</span>
      </div>
    );
  }

  if (game.id === "whitechapel") {
    return (
      <div className="card-art whitechapel-card-art" aria-hidden="true">
        <div className="whitechapel-preview">
          <i className="x1" /><i className="x2" /><i className="x3" />
          <span className="a">27</span>
          <span className="b">?</span>
          <span className="c">68</span>
        </div>
        <span className="float-chip">4 nights</span>
      </div>
    );
  }

  if (game.id === "seven-wonders") {
    return (
      <div className="card-art seven-wonders-card-art" aria-hidden="true">
        <div className="seven-wonders-preview">
          <span className="sun">✦</span>
          <div className="temple"><i /><i /><i /><i /><b /></div>
          <span className="age one">Ⅰ</span>
          <span className="age two">Ⅱ</span>
          <span className="age three">Ⅲ</span>
        </div>
        <span className="float-chip">3–7 civilizations</span>
      </div>
    );
  }

  if (game.id === "dice") {
    return (
      <div className="card-art dice-art" aria-hidden="true">
        <div className="dice-preview">
          <i>⚄</i><i>⚅</i><i>⚂</i>
        </div>
        <span className="float-chip">5 rounds</span>
      </div>
    );
  }

  if (game.id === "janggi") {
    return (
      <div className="card-art janggi-art" aria-hidden="true">
        <div className="janggi-preview">
          <span className="preview-piece han">漢</span>
          <span className="preview-piece cho">楚</span>
          <span className="preview-piece small han">車</span>
          <span className="preview-piece small cho">包</span>
        </div>
        <span className="float-chip">9 × 10</span>
      </div>
    );
  }

  if (game.id === "chess") {
    return (
      <div className="card-art chess-card-art" aria-hidden="true">
        <div className="chess-card-preview">
          <span className="black-king">♚</span>
          <span className="white-queen">♕</span>
          <span className="white-knight">♘</span>
          <i /><i /><i /><i />
        </div>
        <span className="float-chip">8 × 8</span>
      </div>
    );
  }

  if (game.id === "winners-circle") {
    return (
      <div className="card-art winners-art" aria-hidden="true">
        <div className="winner-preview-track">
          <span className="preview-runner r1">♞</span>
          <span className="preview-runner r2">♞</span>
          <span className="preview-runner r3">♞</span>
          <span className="preview-runner r4">♞</span>
          <i className="preview-finish" />
        </div>
        <span className="float-chip">3 races</span>
      </div>
    );
  }

  if (game.id === "camel-up") {
    return (
      <div className="card-art camel-up-card-art" aria-hidden="true">
        <div className="camel-up-preview">
          <span className="sun">☀</span>
          <span className="pyramid">△</span>
          <div className="camel-stack">
            <span className="preview-camel red">♞</span>
            <span className="preview-camel yellow">♞</span>
            <span className="preview-camel purple">♞</span>
          </div>
        </div>
        <span className="float-chip">3–8 bettors</span>
      </div>
    );
  }

  if (game.id === "tichu") {
    return (
      <div className="card-art tichu-card-art" aria-hidden="true">
        <div className="tichu-preview">
          <span className="seal">龍</span>
          <div className="fan">
            <i className="jade">A<small>◆</small></i>
            <i className="sword">K<small>⚔</small></i>
            <i className="pagoda">Q<small>♜</small></i>
            <i className="star">J<small>★</small></i>
          </div>
        </div>
        <span className="float-chip">2 vs 2 teams</span>
      </div>
    );
  }

  if (game.id === "cashflow-escape") {
    return (
      <div className="card-art cashflow-escape-card-art" aria-hidden="true">
        <div className="cashflow-escape-preview">
          <i className="orbit one" /><i className="orbit two" />
          <span className="won">₩</span>
          <div className="flow"><i>INCOME</i><i>−</i><i>EXPENSE</i><i>= +45</i></div>
        </div>
        <span className="float-chip">2–6 investors</span>
      </div>
    );
  }

  if (game.id === "baccarat") {
    return (
      <div className="card-art baccarat-card-art" aria-hidden="true">
        <div className="baccarat-preview">
          <i className="preview-card red">A<small>♦</small></i>
          <i className="preview-card black">8<small>♠</small></i>
          <span>9</span>
        </div>
        <span className="float-chip">virtual chips</span>
      </div>
    );
  }

  if (game.id === "incan-gold") {
    return (
      <div className="card-art incan-card-art" aria-hidden="true">
        <div className="incan-preview-cave">
          <span className="preview-gem one">◆</span>
          <span className="preview-gem two">◆</span>
          <span className="preview-relic">✦</span>
          <i className="preview-danger">〰</i>
        </div>
        <span className="float-chip">5 expeditions</span>
      </div>
    );
  }

  if (game.id === "qwixx") {
    return (
      <div className="card-art qwixx-card-art" aria-hidden="true">
        <div className="qwixx-preview-sheet">
          <span className="red">2 3 4 5 6 7 8</span>
          <span className="yellow">2 3 4 5 6 7 8</span>
          <span className="green">12 11 10 9 8 7</span>
          <span className="blue">12 11 10 9 8 7</span>
          <i>⚃</i><i>⚅</i>
        </div>
        <span className="float-chip">2–5 players</span>
      </div>
    );
  }

  if (game.id === "confrontation") {
    return (
      <div className="card-art confrontation-card-art" aria-hidden="true">
        <div className="confrontation-preview-map">
          <span className="preview-faction dawn">✦</span>
          <i className="preview-route one" />
          <i className="preview-route two" />
          <i className="preview-hidden h1">?</i>
          <i className="preview-hidden h2">?</i>
          <i className="preview-hidden h3">?</i>
          <span className="preview-faction shadow">◆</span>
        </div>
        <span className="float-chip">9 vs 9</span>
      </div>
    );
  }

  if (game.id === "love-letter") {
    return (
      <div className="card-art love-letter-card-art" aria-hidden="true">
        <div className="love-preview-cards">
          <i className="one"><b>1</b><span>⌕</span></i>
          <i className="two"><b>4</b><span>♢</span></i>
          <i className="three"><b>9</b><span>♥</span></i>
        </div>
        <span className="love-preview-seal">♥</span>
        <span className="float-chip">2~6 players</span>
      </div>
    );
  }

  if (game.id === "miniville") {
    return (
      <div className="card-art miniville-card-art" aria-hidden="true">
        <div className="miniville-preview-town">
          <i className="sun">☀</i>
          <i className="building">▥</i>
          <i className="tree">♣</i>
        </div>
        <span className="float-chip">2~4 players</span>
      </div>
    );
  }

  if (game.id === "clocktowers") {
    return (
      <div className="card-art clocktowers-card-art" aria-hidden="true">
        <div className="clocktowers-preview">
          <span className="ct-preview-tower tall"><i /><b>Ⅻ</b><em>▥</em><em>▥</em></span>
          <span className="ct-preview-tower short"><i /><b>Ⅻ</b><em>▥</em></span>
          <span className="ct-preview-moon">☾</span>
        </div>
        <span className="float-chip">2–4 architects</span>
      </div>
    );
  }

  if (game.id === "pick-picnic") {
    return (
      <div className="card-art pick-picnic-card-art" aria-hidden="true">
        <div className="picnic-preview-farm">
          <span className="bird-a">🐔</span>
          <span className="bird-b">🦆</span>
          <span className="fox">🦊</span>
          <i /><i /><i />
        </div>
        <span className="float-chip">2~6 players</span>
      </div>
    );
  }

  if (game.id === "epic-duels") {
    return (
      <div className="card-art epic-duels-card-art" aria-hidden="true">
        <div className="epic-preview-duel">
          <span className="light">✦</span>
          <i>VS</i>
          <span className="dark">◆</span>
        </div>
        <span className="float-chip">12 teams</span>
      </div>
    );
  }

  if (game.id === "sd-gundam-deluxe") {
    return (
      <div className="card-art sd-deluxe-card-art" aria-hidden="true">
        <div className="sd-preview-space">
          <span className="one">G-1</span>
          <span className="two">Z-2</span>
          <span className="three">G-3</span>
          <i /><i /><i />
        </div>
        <span className="float-chip">SIDE A · B</span>
      </div>
    );
  }

  if (game.id === "paper-dungeon") {
    return <div className="card-art casual-card-art rpg" aria-hidden="true"><span>Ⅹ</span><i /><span className="float-chip">10 CHAPTERS</span></div>;
  }

  if (game.id === "ten-seconds") {
    return <div className="card-art casual-card-art ten-seconds" aria-hidden="true"><span>10.00</span><i /><span className="float-chip">± 0.001</span></div>;
  }

  if (game.id === "mudflat-survivor") {
    return <div className="card-art casual-card-art mudflat" aria-hidden="true"><span>해루질럿</span><i /><span className="float-chip">2 MODES</span></div>;
  }

  if (game.id === "tetris") {
    return <div className="card-art casual-card-art tetris" aria-hidden="true"><span>▆\n ▆▆\n  ▆</span><i /><span className="float-chip">10 × 20</span></div>;
  }

  if (["pocket-stack", "color-chain", "number-drop", "dot-survivor", "untangle", "parking-escape"].includes(game.id)) {
    const artwork = {
      "pocket-stack": { symbol: "▰\n ▰\n  ▰", detail: "ONE TAP", className: "stack" },
      "color-chain": { symbol: "● ●\n ● ● ●", detail: "CHAIN × 3", className: "chain" },
      "number-drop": { symbol: "2  4\n  8", detail: "MERGE", className: "numbers" },
      "dot-survivor": { symbol: "·  ◎  ·\n  ·   ·", detail: "60 SEC", className: "survivor" },
      untangle: { symbol: "●╲╱●\n●╱╲●", detail: "0 CROSS", className: "knot" },
      "parking-escape": { symbol: "▮ ▬\n▬  →", detail: "EXIT", className: "parking" },
    }[game.id as "pocket-stack" | "color-chain" | "number-drop" | "dot-survivor" | "untangle" | "parking-escape"];
    return (
      <div className={`card-art casual-card-art ${artwork.className}`} aria-hidden="true">
        <span>{artwork.symbol}</span>
        <i />
        <span className="float-chip">{artwork.detail}</span>
      </div>
    );
  }

  if (["nine-mens-morris", "gonu", "domino", "backgammon", "chinese-checkers", "diamond"].includes(game.id)) {
    const artwork = {
      "nine-mens-morris": { symbol: "●━●━●", detail: "9 pieces", className: "morris" },
      gonu: { symbol: "○╳●╳○", detail: "4 × 4", className: "gonu" },
      domino: { symbol: "⚄│⚂  ⚁│⚅", detail: "28 tiles", className: "domino" },
      backgammon: { symbol: "▲▼ ⚂⚄ ▲▼", detail: "24 points", className: "backgammon" },
      "chinese-checkers": { symbol: "  ●\n● ● ●\n  ●", detail: "10 marbles", className: "chinese" },
      diamond: { symbol: "  ◆\n◆ ◆ ◆\n  ◆", detail: "73 holes", className: "diamond" },
    }[game.id as "nine-mens-morris" | "gonu" | "domino" | "backgammon" | "chinese-checkers" | "diamond"];
    return (
      <div className={`card-art classic-card-art ${artwork.className}`} aria-hidden="true">
        <span className="classic-card-symbol">{artwork.symbol}</span>
        <span className="float-chip">{artwork.detail}</span>
      </div>
    );
  }

  return (
    <div className="card-art checkers-art" aria-hidden="true">
      <div className="preview-grid checkers-preview">
        {Array.from({ length: 25 }, (_, index) => <i key={index} className={[3, 7, 11].includes(index) ? "cream" : [13, 17, 21].includes(index) ? "coral" : ""} />)}
      </div>
      <span className="float-chip">8 × 8</span>
    </div>
  );
}

function GameCard({
  game,
  onPlay,
}: {
  game: GameDefinition;
  onPlay: (id: GameId) => void;
}) {
  return (
    <article className={`game-card ${game.tone}`}>
      <GameArtwork game={game} />
      <div className="game-card-body">
        <div className="game-meta">
          <span className="category-tag">{game.category}</span>
          <span className="player-tag">
            <span className="status-dot" /> {game.players}
          </span>
        </div>
        <h3>{game.title}</h3>
        <p>{game.subtitle}</p>
        <button className="play-button" onClick={() => onPlay(game.id)}>
          플레이
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}

function ShelfGameCard({
  game,
  isFavorite,
  onPlay,
  onToggleFavorite,
}: {
  game: GameDefinition;
  isFavorite: boolean;
  onPlay: (id: GameId) => void;
  onToggleFavorite: (id: GameId) => void;
}) {
  return (
    <article className={`shelf-game-card ${game.tone}`}>
      <button
        className="shelf-favorite-button"
        type="button"
        onClick={() => onToggleFavorite(game.id)}
        aria-label={`${game.title} ${isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}`}
        aria-pressed={isFavorite}
      >
        <span aria-hidden="true">{isFavorite ? "★" : "☆"}</span>
      </button>
      <button className="shelf-game-play" type="button" onClick={() => onPlay(game.id)}>
        <div className="shelf-game-art">
          <GameArtwork game={game} />
        </div>
        <div className="shelf-game-copy">
          <span className="shelf-game-category">{game.category}</span>
          <h3>{game.title}</h3>
          <p>{game.subtitle}</p>
          <span className="shelf-game-players">
            <span className="status-dot" /> {game.players}
          </span>
        </div>
      </button>
    </article>
  );
}

function GameShelf({
  title,
  description,
  games,
  favorites,
  onPlay,
  onToggleFavorite,
  onViewAll,
}: {
  title: string;
  description?: string;
  games: GameDefinition[];
  favorites: GameId[];
  onPlay: (id: GameId) => void;
  onToggleFavorite: (id: GameId) => void;
  onViewAll?: () => void;
}) {
  if (!games.length) return null;
  return (
    <section className="game-shelf" aria-label={title}>
      <header className="game-shelf-heading">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {onViewAll && (
          <button type="button" onClick={onViewAll}>
            전체 보기 <span aria-hidden="true">→</span>
          </button>
        )}
      </header>
      <div className="game-shelf-track">
        {games.map((game) => (
          <ShelfGameCard
            key={game.id}
            game={game}
            isFavorite={favorites.includes(game.id)}
            onPlay={onPlay}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">?</div>
      <h3>찾는 게임이 없어요</h3>
      <p>
        “{query}”과 일치하는 게임이 없습니다.
        <br />
        다른 이름으로 검색해 보세요.
      </p>
    </div>
  );
}

type GameSuggestion = {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
};

function sortSuggestions(items: GameSuggestion[]) {
  return [...items].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
    return b.id - a.id;
  });
}

function SuggestionBoard() {
  const [suggestions, setSuggestions] = useState<GameSuggestion[]>([]);
  const [draft, setDraft] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const characterCount = Array.from(draft).length;

  useEffect(() => {
    const controller = new AbortController();
    const loadSuggestions = async () => {
      try {
        const response = await fetch("/api/game-suggestions", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          suggestions?: GameSuggestion[];
          isAdmin?: boolean;
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error);
        setSuggestions(sortSuggestions(payload.suggestions ?? []));
        setIsAdmin(Boolean(payload.isAdmin));
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessage(error instanceof Error && error.message ? error.message : "추천 게시판을 불러오지 못했습니다.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadSuggestions();
    return () => controller.abort();
  }, []);

  const submitSuggestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = draft.trim().replace(/\s+/g, " ");
    if (!title || submitting) return;

    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/game-suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const payload = (await response.json()) as { suggestion?: GameSuggestion; error?: string };
      if (!response.ok || !payload.suggestion) {
        throw new Error(payload.error ?? "추천을 등록하지 못했습니다.");
      }
      setSuggestions((current) => sortSuggestions([payload.suggestion!, ...current]));
      setDraft("");
      setMessage("추천이 등록되었습니다. 좋은 의견 감사합니다!");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "추천을 등록하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCompleted = async (suggestion: GameSuggestion) => {
    if (!isAdmin || updatingId !== null) return;
    setUpdatingId(suggestion.id);
    setMessage("");
    try {
      const response = await fetch("/api/game-suggestions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: suggestion.id, completed: !suggestion.completed }),
      });
      const payload = (await response.json()) as { suggestion?: GameSuggestion; error?: string };
      if (!response.ok || !payload.suggestion) {
        throw new Error(payload.error ?? "완료 상태를 변경하지 못했습니다.");
      }
      setSuggestions((current) =>
        sortSuggestions(current.map((item) => item.id === suggestion.id ? payload.suggestion! : item)),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "완료 상태를 변경하지 못했습니다.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <section className="suggestion-section" id="game-suggestions">
      <div className="suggestion-heading">
        <span className="section-number">02</span>
        <div>
          <h2>사용자 의견 :</h2>
          <p>개선안 또는 추가 되면 좋을 게임을 의견 남겨주세요</p>
        </div>
      </div>

      <div className="suggestion-layout">
        <form className="suggestion-form" onSubmit={submitSuggestion}>
          <label htmlFor="game-suggestion">추천할 게임</label>
          <div className="suggestion-input-row">
            <input
              id="game-suggestion"
              value={draft}
              onChange={(event) => setDraft(Array.from(event.target.value).slice(0, 50).join(""))}
              placeholder=""
              maxLength={50}
              disabled={submitting}
            />
            <span className={characterCount === 50 ? "limit" : ""}>{characterCount}/50</span>
          </div>
          <button type="submit" disabled={!draft.trim() || submitting}>
            {submitting ? "등록 중…" : "추천하기"}
            <span aria-hidden="true">→</span>
          </button>
          <small>게임 이름이나 간단한 아이디어를 50자 이내로 남겨주세요.</small>
          {message && <p className="suggestion-message" aria-live="polite">{message}</p>}
        </form>

        <div className="suggestion-board">
          <header>
            <div>
              <strong>사용자 의견 게시판</strong>
              <span>{suggestions.length}개의 추천</span>
            </div>
            {isAdmin && <b className="admin-badge">관리자 체크 가능</b>}
          </header>

          {loading ? (
            <div className="suggestion-empty">추천 목록을 불러오는 중…</div>
          ) : suggestions.length === 0 ? (
            <div className="suggestion-empty">
              <span>✦</span>
              첫 번째 게임을 추천해 주세요.
            </div>
          ) : (
            <ul>
              {suggestions.map((suggestion) => (
                <li key={suggestion.id} className={suggestion.completed ? "completed" : ""}>
                  {isAdmin ? (
                    <label className="suggestion-check">
                      <input
                        type="checkbox"
                        checked={suggestion.completed}
                        disabled={updatingId === suggestion.id}
                        onChange={() => void toggleCompleted(suggestion)}
                        aria-label={`${suggestion.title} 게임 추가 완료 표시`}
                      />
                      <span aria-hidden="true">✓</span>
                    </label>
                  ) : (
                    <span className="suggestion-status" aria-hidden="true">
                      {suggestion.completed ? "✓" : "·"}
                    </span>
                  )}
                  <div>
                    <strong>{suggestion.title}</strong>
                    <small>{suggestion.completed ? "게임 추가 완료" : "추천 검토 중"}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

const BOARD_SIZE = 15;
type Stone = 0 | 1 | 2;
type GomokuResult = 0 | 1 | 2 | 3;
type GomokuRule = "exact" | "freestyle";

const newBoard = (): Stone[] =>
  Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => 0 as Stone);

function checkWinner(board: Stone[], index: number, player: Stone, rule: GomokuRule) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  for (const [dr, dc] of directions) {
    let count = 1;
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (
        r >= 0 &&
        r < BOARD_SIZE &&
        c >= 0 &&
        c < BOARD_SIZE &&
        board[r * BOARD_SIZE + c] === player
      ) {
        count += 1;
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (rule === "exact" ? count === 5 : count >= 5) return true;
  }
  return false;
}

function lineStrength(board: Stone[], index: number, player: Stone) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  let score = 0;

  for (const [dr, dc] of directions) {
    let linked = 1;
    let open = 0;
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (
        r >= 0 &&
        r < BOARD_SIZE &&
        c >= 0 &&
        c < BOARD_SIZE &&
        board[r * BOARD_SIZE + c] === player
      ) {
        linked += 1;
        r += dr * sign;
        c += dc * sign;
      }
      if (
        r >= 0 &&
        r < BOARD_SIZE &&
        c >= 0 &&
        c < BOARD_SIZE &&
        board[r * BOARD_SIZE + c] === 0
      ) {
        open += 1;
      }
    }
    score += linked ** 3 * (open + 1);
  }
  return score;
}

function pickAiMove(board: Stone[], rule: GomokuRule) {
  const occupied = board.some(Boolean);
  if (!occupied) return Math.floor(BOARD_SIZE / 2) * BOARD_SIZE + 7;

  const candidates: number[] = [];
  board.forEach((value, index) => {
    if (value !== 0) return;
    const row = Math.floor(index / BOARD_SIZE);
    const col = index % BOARD_SIZE;
    let nearby = false;
    for (let dr = -2; dr <= 2 && !nearby; dr += 1) {
      for (let dc = -2; dc <= 2; dc += 1) {
        const r = row + dr;
        const c = col + dc;
        if (
          r >= 0 &&
          r < BOARD_SIZE &&
          c >= 0 &&
          c < BOARD_SIZE &&
          board[r * BOARD_SIZE + c] !== 0
        ) {
          nearby = true;
          break;
        }
      }
    }
    if (nearby) candidates.push(index);
  });

  for (const candidate of candidates) {
    const test = [...board];
    test[candidate] = 2;
    if (checkWinner(test, candidate, 2, rule)) return candidate;
  }
  for (const candidate of candidates) {
    const test = [...board];
    test[candidate] = 1;
    if (checkWinner(test, candidate, 1, rule)) return candidate;
  }

  return candidates
    .map((index) => {
      const attack = lineStrength(board, index, 2);
      const defense = lineStrength(board, index, 1);
      const row = Math.floor(index / BOARD_SIZE);
      const col = index % BOARD_SIZE;
      const center = 14 - (Math.abs(7 - row) + Math.abs(7 - col));
      return { index, score: attack * 1.1 + defense + center + Math.random() * 2 };
    })
    .sort((a, b) => b.score - a.score)[0]?.index ?? 112;
}

function ModeSwitch() {
  return (
    <div className="mode-switch" aria-label="대전 모드">
      <button className="active">
        <span className="bot-face" aria-hidden="true">•ᴗ•</span>
        AI 대전
      </button>
      <button disabled title="친구 대전은 추후 제공됩니다">
        <span aria-hidden="true">♙</span>
        친구 대전
        <small>준비 중</small>
      </button>
    </div>
  );
}

function GameTopbar({
  title,
  onExit,
}: {
  title: string;
  onExit: () => void;
}) {
  return (
    <header className="game-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로">
        ←
      </button>
      <div className="game-title-lockup">
        <BrandMark />
        <div>
          <span>paperoid</span>
          <strong title={title}>{title}</strong>
        </div>
      </div>
      <button className="exit-button" onClick={onExit}>
        나가기
      </button>
    </header>
  );
}

function GomokuGame({ onExit }: { onExit: () => void }) {
  const [board, setBoard] = useState<Stone[]>(newBoard);
  const [turn, setTurn] = useState<1 | 2>(1);
  const [winner, setWinner] = useState<GomokuResult>(0);
  const [lastMove, setLastMove] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [rule, setRule] = useState<GomokuRule | null>("freestyle");
  const [nextRule, setNextRule] = useState<GomokuRule | null>("freestyle");
  const [started, setStarted] = useState(false);

  const reset = () => {
    const selectedRule = nextRule ?? rule;
    setBoard(newBoard());
    setTurn(1);
    setWinner(0);
    setLastMove(null);
    setRule(selectedRule);
    setNextRule(selectedRule);
    setRound((value) => value + 1);
  };

  const start = () => {
    if (!rule) return;
    setBoard(newBoard());
    setTurn(1);
    setWinner(0);
    setLastMove(null);
    setRound(1);
    setNextRule(rule);
    setStarted(true);
  };

  const playAt = (index: number) => {
    if (!started || !rule || board[index] !== 0 || turn !== 1 || winner) return;
    const next = [...board];
    next[index] = 1;
    setBoard(next);
    setLastMove(index);
    if (checkWinner(next, index, 1, rule)) {
      setWinner(1);
      return;
    }
    if (next.every(Boolean)) {
      setWinner(3);
      return;
    }
    setTurn(2);
  };

  useEffect(() => {
    if (!started || !rule || turn !== 2 || winner) return;
    const timer = window.setTimeout(() => {
      const move = pickAiMove(board, rule);
      const next = [...board];
      next[move] = 2;
      setBoard(next);
      setLastMove(move);
      if (checkWinner(next, move, 2, rule)) setWinner(2);
      else if (next.every(Boolean)) setWinner(3);
      else setTurn(1);
    }, 520);
    return () => window.clearTimeout(timer);
  }, [board, rule, started, turn, winner]);

  const status =
    winner === 1
      ? "승리했어요!"
      : winner === 2
        ? "AI가 승리했어요"
        : winner === 3
          ? "무승부예요"
          : turn === 1
            ? "내 차례"
            : "AI가 생각 중…";

  return (
    <main className="game-shell">
      <GameTopbar title="오목" onExit={onExit} />
      <section className="game-content">
        <div className="game-info-panel">
          <div>
            <span className="eyebrow">{started ? `ROUND ${String(round).padStart(2, "0")}` : "SELECT RULE"}</span>
            <h1>다섯 돌을<br />먼저 이으세요</h1>
            <p>
              {!started
                ? "대국을 시작하기 전에 장목을 인정할지 선택하세요."
                : rule === "exact"
                  ? "가로, 세로, 대각선으로 정확히 다섯 개를 연결해야 승리합니다."
                  : "가로, 세로, 대각선으로 다섯 개 이상 연결하면 승리합니다."}
            </p>
          </div>
          <ModeSwitch />
          <div className="versus-card">
            <div className={`player-side ${started && turn === 1 && !winner ? "thinking" : ""}`}>
              <span className="avatar user-avatar">나</span>
              <strong>플레이어</strong>
              <small>흑돌</small>
            </div>
            <span className="versus">VS</span>
            <div className={`player-side ${started && turn === 2 && !winner ? "thinking" : ""}`}>
              <span className="avatar ai-avatar">AI</span>
              <strong>모모</strong>
              <small>백돌</small>
            </div>
          </div>
        </div>
        <div className="board-panel">
          {!started ? (
            <div className="gomoku-setup" aria-labelledby="gomoku-rule-title">
              <span className="gomoku-setup-kicker">GAME RULES</span>
              <h2 id="gomoku-rule-title">승리 규칙을 선택하세요</h2>
              <p>선택한 규칙은 대국 화면에도 계속 표시됩니다.</p>
              <div className="gomoku-rule-options" role="radiogroup" aria-label="오목 승리 규칙">
                <button
                  className={rule === "exact" ? "selected" : ""}
                  onClick={() => setRule("exact")}
                  role="radio"
                  aria-checked={rule === "exact"}
                >
                  <span className="gomoku-rule-icon">5</span>
                  <strong>정확히 5목</strong>
                  <small>6목 이상의 장목은 승리가 아닙니다</small>
                </button>
                <button
                  className={rule === "freestyle" ? "selected" : ""}
                  onClick={() => setRule("freestyle")}
                  role="radio"
                  aria-checked={rule === "freestyle"}
                >
                  <span className="gomoku-rule-icon">5+</span>
                  <strong>5목 이상</strong>
                  <small>6목 이상의 장목도 승리로 인정합니다</small>
                </button>
              </div>
              <button className="gomoku-start-button" onClick={start} disabled={!rule}>
                {rule ? "선택한 규칙으로 시작" : "규칙을 선택해 주세요"}
              </button>
            </div>
          ) : (
            <>
              <div className="gomoku-status-row">
                <div className="board-status" role="status">
                  <span className={`turn-stone ${turn === 1 ? "black" : "white"}`} />
                  <strong>{status}</strong>
                  <span>{winner ? "한 판 더 도전해 볼까요?" : turn === 1 ? "교차점을 선택하세요" : "잠시만 기다려 주세요"}</span>
                </div>
                <span className="gomoku-rule-pill">
                  {rule === "exact" ? "정확히 5목" : "5목 이상"}
                </span>
              </div>
              <div className="gomoku-frame">
                <div className="gomoku-board" role="grid" aria-label={`15 곱하기 15 오목판, ${rule === "exact" ? "정확히 5목" : "5목 이상"} 규칙`}>
                  {board.map((stone, index) => (
                    <button
                      key={index}
                      className={`gomoku-cell ${stone ? "placed" : ""}`}
                      onClick={() => playAt(index)}
                      disabled={stone !== 0 || turn !== 1 || Boolean(winner)}
                      role="gridcell"
                      aria-label={`${Math.floor(index / BOARD_SIZE) + 1}행 ${(index % BOARD_SIZE) + 1}열${stone === 1 ? " 흑돌" : stone === 2 ? " 백돌" : ""}`}
                    >
                      {stone !== 0 && (
                        <span
                          className={`stone ${stone === 1 ? "black" : "white"} ${lastMove === index ? "last" : ""}`}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="game-actions gomoku-actions">
                <button
                  className="gomoku-rule-switch"
                  type="button"
                  role="switch"
                  aria-checked={(nextRule ?? rule) === "freestyle"}
                  aria-label={`다음 판 규칙: ${(nextRule ?? rule) === "exact" ? "정확히 5목" : "5목 이상"}. 누르면 규칙이 바뀝니다.`}
                  onClick={() =>
                    setNextRule((current) =>
                      (current ?? rule) === "exact" ? "freestyle" : "exact",
                    )
                  }
                >
                  <span className="gomoku-switch-track" aria-hidden="true">
                    <i />
                  </span>
                  <span className="gomoku-switch-label">
                    <small>다음 판 규칙</small>
                    <strong>{(nextRule ?? rule) === "exact" ? "정확히 5목" : "5목 이상"}</strong>
                  </span>
                </button>
                {winner ? (
                  <button className="primary-action" onClick={reset}>다시 플레이</button>
                ) : (
                  <button className="text-action" onClick={reset}>↻ 새 게임</button>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

const MEMORY_CHARACTERS = [
  ["moon-jelly", "달빛 해파리"],
  ["teapot-snail", "주전자 달팽이"],
  ["lantern-owl", "등불 부엉이"],
  ["coral-cat", "산호 고양이"],
  ["paper-dragon", "종이 아기용"],
  ["star-moth", "별날개 나방"],
  ["mushroom-diver", "버섯 잠수부"],
  ["cloud-whale", "구름 아기고래"],
] as const;

const MEMORY_SYMBOLS = MEMORY_CHARACTERS.map(([id]) => id);

function memoryCharacterLabel(id: string) {
  return MEMORY_CHARACTERS.find(([characterId]) => characterId === id)?.[1] ?? "신비한 친구";
}

function memoryCharacterImage(id: string) {
  return `/memory-characters/${id}.png`;
}

type MemoryCard = {
  id: number;
  symbol: string;
  matched: boolean;
};

function createMemoryDeck(): MemoryCard[] {
  return [...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS]
    .map((symbol, index) => ({
      id: index,
      symbol,
      matched: false,
      order: Math.random(),
    }))
    .sort((a, b) => a.order - b.order)
    .map(({ id: _id, symbol, matched }, index) => ({ id: index, symbol, matched }));
}

function MemoryGame({ onExit }: { onExit: () => void }) {
  const [cards, setCards] = useState<MemoryCard[]>(createMemoryDeck);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [turn, setTurn] = useState<"player" | "ai">("player");
  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [moves, setMoves] = useState(0);
  const [round, setRound] = useState(1);
  const memory = useRef<Map<string, Set<number>>>(new Map());
  const busy = useRef(false);

  const remember = useCallback((indexes: number[], currentCards: MemoryCard[]) => {
    indexes.forEach((index) => {
      const symbol = currentCards[index].symbol;
      const known = memory.current.get(symbol) ?? new Set<number>();
      known.add(index);
      memory.current.set(symbol, known);
    });
  }, []);

  const resolvePair = useCallback(
    (first: number, second: number, owner: "player" | "ai") => {
      const isMatch = cards[first].symbol === cards[second].symbol;
      window.setTimeout(() => {
        if (isMatch) {
          setCards((current) =>
            current.map((card, index) =>
              index === first || index === second ? { ...card, matched: true } : card,
            ),
          );
          setScore((current) => ({ ...current, [owner]: current[owner] + 1 }));
          const symbol = cards[first].symbol;
          memory.current.delete(symbol);
        }
        setRevealed([]);
        busy.current = false;
        setTurn(owner === "player" ? "ai" : "player");
      }, 760);
    },
    [cards],
  );

  const chooseCard = (index: number) => {
    if (
      turn !== "player" ||
      busy.current ||
      cards[index].matched ||
      revealed.includes(index)
    ) return;
    const nextRevealed = [...revealed, index];
    setRevealed(nextRevealed);
    remember([index], cards);
    if (nextRevealed.length === 2) {
      busy.current = true;
      setMoves((value) => value + 1);
      resolvePair(nextRevealed[0], nextRevealed[1], "player");
    }
  };

  useEffect(() => {
    if (turn !== "ai" || busy.current || cards.every((card) => card.matched)) return;
    busy.current = true;
    const available = cards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => !card.matched)
      .map(({ index }) => index);

    const knownPair = [...memory.current.values()]
      .map((indexes) => [...indexes].filter((index) => available.includes(index)))
      .find((indexes) => indexes.length >= 2);

    const first = knownPair?.[0] ?? available[Math.floor(Math.random() * available.length)];
    const secondPool = available.filter((index) => index !== first);
    const firstKnown = memory.current.get(cards[first].symbol);
    const rememberedMatch = firstKnown
      ? [...firstKnown].find((index) => index !== first && secondPool.includes(index))
      : undefined;
    const second =
      knownPair?.[1] ??
      rememberedMatch ??
      secondPool[Math.floor(Math.random() * secondPool.length)];

    const firstTimer = window.setTimeout(() => {
      setRevealed([first]);
      remember([first], cards);
      const secondTimer = window.setTimeout(() => {
        setRevealed([first, second]);
        remember([second], cards);
        setMoves((value) => value + 1);
        resolvePair(first, second, "ai");
      }, 620);
      return () => window.clearTimeout(secondTimer);
    }, 580);
    return () => window.clearTimeout(firstTimer);
  }, [cards, remember, resolvePair, turn]);

  const finished = cards.every((card) => card.matched);
  const result =
    score.player > score.ai
      ? "기억력 챔피언!"
      : score.player < score.ai
        ? "AI가 한발 앞섰어요"
        : "멋진 무승부!";

  const reset = () => {
    memory.current.clear();
    busy.current = false;
    setCards(createMemoryDeck());
    setRevealed([]);
    setTurn("player");
    setScore({ player: 0, ai: 0 });
    setMoves(0);
    setRound((value) => value + 1);
  };

  return (
    <main className="game-shell memory-shell">
      <GameTopbar title="짝 맞추기" onExit={onExit} />
      <section className="game-content">
        <div className="game-info-panel">
          <div>
            <span className="eyebrow">ROUND {String(round).padStart(2, "0")}</span>
            <h1>같은 그림을<br />찾아보세요</h1>
            <p>카드의 위치를 기억해 같은 그림을 한 쌍씩 찾아보세요.</p>
          </div>
          <ModeSwitch />
          <div className="memory-score-card">
            <div className={turn === "player" && !finished ? "active" : ""}>
              <span>나</span>
              <strong>{score.player}</strong>
              <small>PAIRS</small>
            </div>
            <i />
            <div className={turn === "ai" && !finished ? "active" : ""}>
              <span>AI</span>
              <strong>{score.ai}</strong>
              <small>PAIRS</small>
            </div>
          </div>
        </div>
        <div className="board-panel memory-panel">
          <div className="board-status" role="status">
            <span className="memory-status-icon">{finished ? "✓" : turn === "player" ? "✦" : "…"}</span>
            <strong>{finished ? result : turn === "player" ? "내 차례" : "AI가 기억을 더듬는 중…"}</strong>
            <span>{finished ? `${moves}번 만에 모든 짝을 찾았습니다` : turn === "player" ? "카드 두 장을 뒤집으세요" : "AI의 선택을 지켜보세요"}</span>
          </div>
          <div className="memory-grid" role="grid" aria-label="4 곱하기 4 기억력 카드">
            {cards.map((card, index) => {
              const open = card.matched || revealed.includes(index);
              return (
                <button
                  key={card.id}
                  className={`memory-card ${open ? "open" : ""} ${card.matched ? "matched" : ""}`}
                  onClick={() => chooseCard(index)}
                  disabled={turn !== "player" || busy.current || card.matched}
                  aria-label={open ? `${memoryCharacterLabel(card.symbol)} 카드${card.matched ? ", 짝 맞춤" : ""}` : "뒤집힌 카드"}
                  role="gridcell"
                >
                  <span className="card-inner">
                    <span className="card-back"><BrandMark /></span>
                    <span className="card-front">
                      <img
                        className="memory-character"
                        src={memoryCharacterImage(card.symbol)}
                        alt=""
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="game-actions">
            <button className="text-action" onClick={reset}>↻ 새 게임</button>
            <span className="game-hint">{moves}번 선택 · {cards.filter((card) => card.matched).length / 2}/8 짝</span>
            {finished && <button className="primary-action" onClick={reset}>다시 플레이</button>}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [category, setCategory] = useState<Category>("전체");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<GameId[]>([]);
  const [recentIds, setRecentIds] = useState<GameId[]>([]);
  const [finderOpen, setFinderOpen] = useState(false);
  const [showAllGames, setShowAllGames] = useState(false);

  useEffect(() => {
    const knownIds = new Set<GameId>(GAMES.map((game) => game.id));
    const readGameIds = (key: string) => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(key) ?? "[]") as string[];
        return saved.filter((id): id is GameId => knownIds.has(id as GameId));
      } catch {
        return [];
      }
    };
    const legacyPrefix = ["play", "room"].join("");
    const favorites = readGameIds("paperoid-favorites");
    const recent = readGameIds("paperoid-recent-games");
    const migratedFavorites = favorites.length ? favorites : readGameIds(`${legacyPrefix}-favorites`);
    const migratedRecent = recent.length ? recent : readGameIds(`${legacyPrefix}-recent-games`);
    setFavorites(migratedFavorites);
    setRecentIds(migratedRecent);
    setShowAllGames(window.localStorage.getItem(SHOW_ALL_GAMES_STORAGE_KEY) === "true");
    if (migratedFavorites.length) window.localStorage.setItem("paperoid-favorites", JSON.stringify(migratedFavorites));
    if (migratedRecent.length) window.localStorage.setItem("paperoid-recent-games", JSON.stringify(migratedRecent));
  }, []);

  useEffect(() => {
    if (!finderOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFinderOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [finderOpen]);

  useEffect(() => {
    if (!activeGame) return;
    const scrollGameToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };
    scrollGameToTop();
    const frame = window.requestAnimationFrame(scrollGameToTop);
    return () => window.cancelAnimationFrame(frame);
  }, [activeGame]);

  const launchGame = (id: GameId) => {
    setRecentIds((current) => {
      const next = [id, ...current.filter((item) => item !== id)].slice(0, 8);
      window.localStorage.setItem("paperoid-recent-games", JSON.stringify(next));
      return next;
    });
    setFinderOpen(false);
    setActiveGame(id);
  };

  const toggleFavorite = (id: GameId) => {
    setFavorites((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [id, ...current];
      window.localStorage.setItem("paperoid-favorites", JSON.stringify(next));
      return next;
    });
  };

  const openFinder = (nextCategory: Category = "전체") => {
    setCategory(nextCategory);
    setQuery("");
    setFinderOpen(true);
  };

  const toggleAllGames = () => {
    setShowAllGames((current) => {
      const next = !current;
      if (next) {
        window.localStorage.setItem(SHOW_ALL_GAMES_STORAGE_KEY, "true");
      } else {
        window.localStorage.removeItem(SHOW_ALL_GAMES_STORAGE_KEY);
      }
      return next;
    });
  };

  const availableGames = useMemo(
    () => showAllGames ? GAMES : GAMES.filter((game) => !DEFAULT_HIDDEN_GAME_IDS.has(game.id)),
    [showAllGames],
  );

  const filteredGames = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko");
    return availableGames.filter(
      (game) =>
        (category === "전체" || game.category === category) &&
        (!normalized ||
          game.title.toLocaleLowerCase("ko").includes(normalized) ||
          game.subtitle.toLocaleLowerCase("ko").includes(normalized) ||
          game.category.includes(normalized)),
    );
  }, [availableGames, category, query]);

  const recentGames = recentIds
    .map((id) => availableGames.find((game) => game.id === id))
    .filter((game): game is GameDefinition => Boolean(game));
  const favoriteGames = favorites
    .map((id) => availableGames.find((game) => game.id === id))
    .filter((game): game is GameDefinition => Boolean(game));
  const quickStartGames = recentGames.length ? recentGames : availableGames.slice(0, 6);

  if (activeGame === "gomoku") {
    return <GuidedGame gameId={activeGame}><GomokuGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "memory") {
    return <GuidedGame gameId={activeGame}><MemoryGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "reversi") {
    return <GuidedGame gameId={activeGame}><ReversiGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "mancala") {
    return <GuidedGame gameId={activeGame}><MancalaGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "battleship") {
    return <GuidedGame gameId={activeGame}><BattleshipGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "scotland-yard") {
    return <GuidedGame gameId={activeGame}><ScotlandYardGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "whitechapel") {
    return <GuidedGame gameId={activeGame}><WhitechapelGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "seven-wonders") {
    return <GuidedGame gameId={activeGame}><SevenWondersGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "dice") {
    return <GuidedGame gameId={activeGame}><DiceDuelGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "checkers") {
    return <GuidedGame gameId={activeGame}><CheckersGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "chess") {
    return <GuidedGame gameId={activeGame}><ChessGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "janggi") {
    return <GuidedGame gameId={activeGame}><JanggiGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "winners-circle") {
    return <GuidedGame gameId={activeGame}><WinnersCircleGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "camel-up") {
    return <GuidedGame gameId={activeGame}><CamelUpGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "tichu") {
    return <GuidedGame gameId={activeGame}><TichuGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "cashflow-escape") {
    return <GuidedGame gameId={activeGame}><CashflowEscapeGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "baccarat") {
    return <GuidedGame gameId={activeGame}><BaccaratGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "nine-mens-morris") {
    return <GuidedGame gameId={activeGame}><NineMensMorrisGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "gonu") {
    return <GuidedGame gameId={activeGame}><GonuGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "domino") {
    return <GuidedGame gameId={activeGame}><DominoGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "backgammon") {
    return <GuidedGame gameId={activeGame}><BackgammonGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "chinese-checkers") {
    return <GuidedGame gameId={activeGame}><ChineseCheckersGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "diamond") {
    return <GuidedGame gameId={activeGame}><DiamondGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "incan-gold") {
    return <GuidedGame gameId={activeGame}><IncanGoldGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "qwixx") {
    return <GuidedGame gameId={activeGame}><QwixxGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "confrontation") {
    return <GuidedGame gameId={activeGame}><ConfrontationGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "love-letter") {
    return <GuidedGame gameId={activeGame}><LoveLetterGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "miniville") {
    return <GuidedGame gameId={activeGame}><MinivilleGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "clocktowers") {
    return <GuidedGame gameId={activeGame}><ClocktowersGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "pick-picnic") {
    return <GuidedGame gameId={activeGame}><PickPicnicGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "epic-duels") {
    return <GuidedGame gameId={activeGame}><EpicDuelsGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "sd-gundam-deluxe") {
    return <GuidedGame gameId={activeGame}><SdGundamDeluxeGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "pocket-stack") {
    return <GuidedGame gameId={activeGame}><PocketStackGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "color-chain") {
    return <GuidedGame gameId={activeGame}><ColorChainGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "number-drop") {
    return <GuidedGame gameId={activeGame}><NumberDropGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "dot-survivor") {
    return <GuidedGame gameId={activeGame}><DotSurvivorGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "untangle") {
    return <GuidedGame gameId={activeGame}><UntangleGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "parking-escape") {
    return <GuidedGame gameId={activeGame}><ParkingEscapeGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "paper-dungeon") {
    return <GuidedGame gameId={activeGame}><PaperDungeonGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "ten-seconds") {
    return <GuidedGame gameId={activeGame}><TenSecondsGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "mudflat-survivor") {
    return <GuidedGame gameId={activeGame}><MudflatSurvivorGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }
  if (activeGame === "tetris") {
    return <GuidedGame gameId={activeGame}><TetrisGame onExit={() => setActiveGame(null)} /></GuidedGame>;
  }

  return (
    <main className="hub-shell">
      <header className="hub-header">
        <a className="brand" href="#" aria-label="플레이룸 홈">
          <BrandMark />
          <span>paperoid</span>
        </a>
        <div className="header-note">
          <span className="status-dot" />
          AI 플레이 가능
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">YOUR NEXT MOVE</span>
          <h1>
            잠깐의 여유,{" "}
            <br />
            <em>한 판</em> 어때요?
          </h1>
          <p>혼자여도 즐거운 보드게임 아지트.<br />원하는 게임을 골라 AI와 바로 시작하세요.</p>
          <button className="hero-finder-button" type="button" onClick={() => openFinder()}>
            게임 찾기 <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <span className="orbit-line one" />
          <span className="orbit-line two" />
          <span className="hero-piece piece-black" />
          <span className="hero-piece piece-white" />
          <span className="hero-card-piece">✦</span>
          <span className="hero-spark spark-one">✦</span>
          <span className="hero-spark spark-two">·</span>
        </div>
      </section>

      <section className="library">
        <div className="library-discovery">
          <div className="library-heading">
            <div>
              <span className="section-number">01</span>
              <h2>게임 고르기</h2>
            </div>
            <button className="game-finder-trigger" type="button" onClick={() => openFinder()}>
              <IconSearch />
              <span>이름·장르로 게임 찾기</span>
              <b>{availableGames.length}</b>
            </button>
          </div>

          <div className="category-row home-category-row" aria-label="게임 분류">
            {CATEGORIES.map((item) => (
              <button key={item} type="button" onClick={() => openFinder(item)}>
                {item}
                <span>{item === "전체" ? availableGames.length : availableGames.filter((game) => game.category === item).length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="home-game-shelves">
          <GameShelf
            title={recentGames.length ? "최근 플레이" : "빠른 시작"}
            description={recentGames.length ? "최근에 즐긴 게임을 바로 이어서 시작하세요." : "처음이라면 인기 게임부터 가볍게 시작해 보세요."}
            games={quickStartGames}
            favorites={favorites}
            onPlay={launchGame}
            onToggleFavorite={toggleFavorite}
            onViewAll={() => openFinder()}
          />

          {favoriteGames.length > 0 && (
            <GameShelf
              title="즐겨찾기"
              description="별표한 게임만 한곳에 모았습니다."
              games={favoriteGames}
              favorites={favorites}
              onPlay={launchGame}
              onToggleFavorite={toggleFavorite}
              onViewAll={() => openFinder()}
            />
          )}

          {GAME_CATEGORIES.map((item) => (
            <GameShelf
              key={item}
              title={item === "고전게임" ? item : `${item} 게임`}
              games={availableGames.filter((game) => game.category === item)}
              favorites={favorites}
              onPlay={launchGame}
              onToggleFavorite={toggleFavorite}
              onViewAll={() => openFinder(item)}
            />
          ))}

          <a className="hub-suggestion-link" href="#game-suggestions">
            <span className="plus-mark">+</span>
            <div>
              <strong>찾는 게임이 없나요?</strong>
              <p>paperoid에 추가되면 좋을 게임을 추천해 주세요.</p>
            </div>
            <span className="suggestion-arrow" aria-hidden="true">↓</span>
          </a>
        </div>
      </section>

      {finderOpen && (
        <div className="game-finder-layer" role="dialog" aria-modal="true" aria-labelledby="game-finder-title">
          <button
            className="game-finder-backdrop"
            type="button"
            onClick={() => setFinderOpen(false)}
            aria-label="게임 찾기 닫기"
          />
          <section className="game-finder-panel">
            <header className="game-finder-header">
              <div>
                <span className="eyebrow">GAME FINDER</span>
                <h2 id="game-finder-title">어떤 게임을 할까요?</h2>
              </div>
              <button className="game-finder-close" type="button" onClick={() => setFinderOpen(false)} aria-label="닫기">
                ×
              </button>
            </header>

            <label className="finder-search-box">
              <IconSearch />
              <input
                type="search"
                placeholder="게임 이름이나 장르를 입력하세요"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="게임 이름이나 장르 검색"
              />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>}
            </label>

            <div className="category-row finder-category-row" role="tablist" aria-label="게임 분류">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={category === item}
                  className={category === item ? "active" : ""}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="finder-result-heading">
              <strong>{category === "전체" ? "전체 게임" : `${category} 게임`}</strong>
              <span>{filteredGames.length}개</span>
            </div>

            {filteredGames.length ? (
              <div className="finder-game-list">
                {filteredGames.map((game) => (
                  <article className={`finder-game-row ${game.tone}`} key={game.id}>
                    <button className="finder-game-select" type="button" onClick={() => launchGame(game.id)}>
                      <span className="finder-game-thumb" aria-hidden="true">
                        <GameArtwork game={game} />
                      </span>
                      <span className="finder-game-copy">
                        <span>
                          <b>{game.title}</b>
                          <em>{game.category}</em>
                        </span>
                        <small>{game.subtitle}</small>
                        <small className="finder-game-player">{game.players}</small>
                      </span>
                      <span className="finder-play-arrow" aria-hidden="true">→</span>
                    </button>
                    <button
                      className="finder-favorite-button"
                      type="button"
                      onClick={() => toggleFavorite(game.id)}
                      aria-label={`${game.title} ${favorites.includes(game.id) ? "즐겨찾기 해제" : "즐겨찾기 추가"}`}
                      aria-pressed={favorites.includes(game.id)}
                    >
                      <span aria-hidden="true">{favorites.includes(game.id) ? "★" : "☆"}</span>
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState query={query} />
            )}
          </section>
        </div>
      )}

      <button className="mobile-finder-button" type="button" onClick={() => openFinder()}>
        <IconSearch /> 게임 찾기 <span>{availableGames.length}</span>
      </button>

      <SuggestionBoard />

      <footer>
        <div className="footer-brand"><BrandMark /> paperoid</div>
        <p>
          오늘도{" "}
          <button
            className="footer-game-visibility-toggle"
            type="button"
            onClick={toggleAllGames}
            aria-label={showAllGames ? "검증 완료 게임만 표시" : "모든 게임 표시"}
            aria-pressed={showAllGames}
          >
            즐거운
          </button>{" "}
          한 판 되세요.
        </p>
        <span>AI BOARD GAME CLUB</span>
      </footer>
    </main>
  );
}
