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
import { WinnersCircleGame } from "./winners-circle-game";
import { IncanGoldGame } from "./incan-gold-game";
import { QwixxGame } from "./qwixx-game";
import { ConfrontationGame } from "./confrontation-game";
import { LoveLetterGame } from "./love-letter-game";
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
  | "love-letter";
type Category = "전체" | "전략" | "기억력" | "추리" | "주사위" | "경주";

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
  {
    id: "winners-circle",
    title: "위너스 서클",
    subtitle: "베팅한 말을 결승선까지 이끄세요",
    category: "경주",
    players: "AI 2~6인",
    tone: "navy",
  },
  {
    id: "nine-mens-morris",
    title: "나인 멘스 모리스",
    subtitle: "세 말을 잇고 상대의 길을 막으세요",
    category: "전략",
    players: "AI 1:1",
    tone: "violet",
  },
  {
    id: "gonu",
    title: "고누",
    subtitle: "전통 말판에서 상대의 퇴로를 막으세요",
    category: "전략",
    players: "AI 1:1",
    tone: "gold",
  },
  {
    id: "domino",
    title: "도미노",
    subtitle: "같은 눈을 맞춰 패를 먼저 비우세요",
    category: "전략",
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
    category: "전략",
    players: "AI 1:1",
    tone: "blue",
  },
  {
    id: "diamond",
    title: "다이아몬드 게임",
    subtitle: "한국식 소형 별판을 2~3인이 건너세요",
    category: "전략",
    players: "AI 2~3인",
    tone: "gold",
  },
  {
    id: "incan-gold",
    title: "잉카 골드",
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

function suggestionDate(value: string) {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

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
          <h2>다음 게임은?</h2>
          <p>추가 되면 좋을 게임을 추천해주세요.</p>
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
              placeholder="예: 카탄, 루미큐브, 스플렌더"
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
              <strong>게임 추천 게시판</strong>
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
                  <time dateTime={suggestion.createdAt}>{suggestionDate(suggestion.createdAt)}</time>
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
  if (activeGame === "winners-circle") {
    return <WinnersCircleGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "nine-mens-morris") {
    return <NineMensMorrisGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "gonu") {
    return <GonuGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "domino") {
    return <DominoGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "backgammon") {
    return <BackgammonGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "chinese-checkers") {
    return <ChineseCheckersGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "diamond") {
    return <DiamondGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "incan-gold") {
    return <IncanGoldGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "qwixx") {
    return <QwixxGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "confrontation") {
    return <ConfrontationGame onExit={() => setActiveGame(null)} />;
  }
  if (activeGame === "love-letter") {
    return <LoveLetterGame onExit={() => setActiveGame(null)} />;
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
          {(["전체", "전략", "기억력", "추리", "주사위", "경주"] as Category[]).map((item) => (
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
              <a className="coming-card" href="#game-suggestions">
                <span className="plus-mark">+</span>
                <div>
                  <strong>다음 게임은?</strong>
                  <p>추가 되면 좋을 게임을 추천해주세요.</p>
                </div>
                <span className="suggestion-arrow" aria-hidden="true">↓</span>
              </a>
            )}
          </div>
        ) : (
          <EmptyState query={query} />
        )}
      </section>

      <SuggestionBoard />

      <footer>
        <div className="footer-brand"><BrandMark /> PLAYROOM</div>
        <p>오늘도 즐거운 한 판 되세요.</p>
        <span>AI BOARD GAME CLUB</span>
      </footer>
    </main>
  );
}
