"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BattleshipGame,
  CheckersGame,
  DiceDuelGame,
  MancalaGame,
  ReversiGame,
} from "./more-games";
import { JanggiGame } from "./janggi-game";

type GameId =
  | "gomoku"
  | "memory"
  | "reversi"
  | "mancala"
  | "battleship"
  | "dice"
  | "checkers"
  | "janggi";
type Category = "전체" | "전략" | "기억력" | "추리" | "주사위";

type GameDefinition = {
  id: GameId;
  title: string;
  subtitle: string;
  category: Exclude<Category, "전체">;
  players: string;
  tone: "violet" | "orange" | "teal" | "gold" | "blue" | "red" | "green";
};

const GAMES: GameDefinition[] = [
  {
    id: "gomoku",
    title: "오목",
    subtitle: "다섯 돌을 먼저 이으세요",
    category: "전략",
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
    category: "전략",
    players: "AI 1:1",
    tone: "teal",
  },
  {
    id: "mancala",
    title: "만칼라",
    subtitle: "돌을 나누어 보물창고를 채우세요",
    category: "전략",
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
    id: "dice",
    title: "주사위 대결",
    subtitle: "최적의 주사위를 남겨 높은 점수를 만드세요",
    category: "주사위",
    players: "AI 1:1",
    tone: "red",
  },
  {
    id: "checkers",
    title: "체커",
    subtitle: "대각선 전진과 점프로 상대 말을 잡으세요",
    category: "전략",
    players: "AI 1:1",
    tone: "green",
  },
  {
    id: "janggi",
    title: "장기",
    subtitle: "궁을 지키며 한 수 앞을 내다보세요",
    category: "전략",
    players: "AI 1:1",
    tone: "green",
  },
];

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
      <span className="memory-tile tile-a">☀</span>
      <span className="memory-tile tile-b">✿</span>
      <span className="memory-tile tile-c">☀</span>
      <span className="memory-tile tile-d">✦</span>
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

const BOARD_SIZE = 15;
type Stone = 0 | 1 | 2;
type GomokuResult = 0 | 1 | 2 | 3;

const newBoard = (): Stone[] =>
  Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => 0 as Stone);

function checkWinner(board: Stone[], index: number, player: Stone) {
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
    if (count >= 5) return true;
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

function pickAiMove(board: Stone[]) {
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
    if (checkWinner(test, candidate, 2)) return candidate;
  }
  for (const candidate of candidates) {
    const test = [...board];
    test[candidate] = 1;
    if (checkWinner(test, candidate, 1)) return candidate;
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
          <span>PLAYROOM</span>
          <strong>{title}</strong>
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

  const reset = () => {
    setBoard(newBoard());
    setTurn(1);
    setWinner(0);
    setLastMove(null);
    setRound((value) => value + 1);
  };

  const playAt = (index: number) => {
    if (board[index] !== 0 || turn !== 1 || winner) return;
    const next = [...board];
    next[index] = 1;
    setBoard(next);
    setLastMove(index);
    if (checkWinner(next, index, 1)) {
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
    if (turn !== 2 || winner) return;
    const timer = window.setTimeout(() => {
      const move = pickAiMove(board);
      const next = [...board];
      next[move] = 2;
      setBoard(next);
      setLastMove(move);
      if (checkWinner(next, move, 2)) setWinner(2);
      else if (next.every(Boolean)) setWinner(3);
      else setTurn(1);
    }, 520);
    return () => window.clearTimeout(timer);
  }, [board, turn, winner]);

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
            <span className="eyebrow">ROUND {String(round).padStart(2, "0")}</span>
            <h1>다섯 돌을<br />먼저 이으세요</h1>
            <p>가로, 세로, 대각선 어느 방향이든 다섯 개를 연결하면 승리합니다.</p>
          </div>
          <ModeSwitch />
          <div className="versus-card">
            <div className={`player-side ${turn === 1 && !winner ? "thinking" : ""}`}>
              <span className="avatar user-avatar">나</span>
              <strong>플레이어</strong>
              <small>흑돌</small>
            </div>
            <span className="versus">VS</span>
            <div className={`player-side ${turn === 2 && !winner ? "thinking" : ""}`}>
              <span className="avatar ai-avatar">AI</span>
              <strong>모모</strong>
              <small>백돌</small>
            </div>
          </div>
        </div>
        <div className="board-panel">
          <div className="board-status" role="status">
            <span className={`turn-stone ${turn === 1 ? "black" : "white"}`} />
            <strong>{status}</strong>
            <span>{winner ? "한 판 더 도전해 볼까요?" : turn === 1 ? "교차점을 선택하세요" : "잠시만 기다려 주세요"}</span>
          </div>
          <div className="gomoku-frame">
            <div className="gomoku-board" role="grid" aria-label="15 곱하기 15 오목판">
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
          <div className="game-actions">
            <button className="text-action" onClick={reset}>↻ 새 게임</button>
            {winner ? (
              <button className="primary-action" onClick={reset}>다시 플레이</button>
            ) : (
              <span className="game-hint">마지막 돌에는 작은 점이 표시됩니다</span>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

const MEMORY_SYMBOLS = ["☀", "✿", "◆", "☂", "♬", "☾", "★", "♣"];

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
                  aria-label={open ? `${card.symbol} 카드${card.matched ? ", 짝 맞춤" : ""}` : "뒤집힌 카드"}
                  role="gridcell"
                >
                  <span className="card-inner">
                    <span className="card-back"><BrandMark /></span>
                    <span className="card-front">{card.symbol}</span>
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

  const filteredGames = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko");
    return GAMES.filter(
      (game) =>
        (category === "전체" || game.category === category) &&
        (!normalized ||
          game.title.toLocaleLowerCase("ko").includes(normalized) ||
          game.subtitle.toLocaleLowerCase("ko").includes(normalized) ||
          game.category.includes(normalized)),
    );
  }, [category, query]);

  if (activeGame === "gomoku") {
    return <GomokuGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "memory") {
    return <MemoryGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "reversi") {
    return <ReversiGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "mancala") {
    return <MancalaGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "battleship") {
    return <BattleshipGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "dice") {
    return <DiceDuelGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "checkers") {
    return <CheckersGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "janggi") {
    return <JanggiGame onExit={() => setActiveGame(null)} />;
  }

  return (
    <main className="hub-shell">
      <header className="hub-header">
        <a className="brand" href="#" aria-label="플레이룸 홈">
          <BrandMark />
          <span>PLAYROOM</span>
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
            잠깐의 여유,
            <br />
            <em>한 판</em> 어때요?
          </h1>
          <p>혼자여도 즐거운 보드게임 아지트.<br />원하는 게임을 골라 AI와 바로 시작하세요.</p>
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
        <div className="library-heading">
          <div>
            <span className="section-number">01</span>
            <h2>게임 고르기</h2>
          </div>
          <label className="search-box">
            <IconSearch />
            <input
              type="search"
              placeholder="게임 이름 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="게임 이름 검색"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>
            )}
          </label>
        </div>

        <div className="category-row" role="tablist" aria-label="게임 분류">
          {(["전체", "전략", "기억력", "추리", "주사위"] as Category[]).map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={category === item}
              className={category === item ? "active" : ""}
              onClick={() => setCategory(item)}
            >
              {item}
              {item === "전체" && <span>{GAMES.length}</span>}
            </button>
          ))}
        </div>

        {filteredGames.length ? (
          <div className="game-grid">
            {filteredGames.map((game) => (
              <GameCard key={game.id} game={game} onPlay={setActiveGame} />
            ))}
            {!query && category === "전체" && (
              <article className="coming-card">
                <span className="plus-mark">+</span>
                <div>
                  <strong>다음 게임은?</strong>
                  <p>새로운 게임이 계속 추가됩니다.</p>
                </div>
              </article>
            )}
          </div>
        ) : (
          <EmptyState query={query} />
        )}
      </section>

      <footer>
        <div className="footer-brand"><BrandMark /> PLAYROOM</div>
        <p>오늘도 즐거운 한 판 되세요.</p>
        <span>AI BOARD GAME CLUB</span>
      </footer>
    </main>
  );
}
