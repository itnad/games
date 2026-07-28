"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

type ExitProps = { onExit: () => void };
type Player = 1 | 2;
type Winner = 0 | 1 | 2 | 3;

function ClassicBrand() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>;
}

function ClassicTopbar({ title, onExit }: { title: string; onExit: () => void }) {
  return (
    <header className="game-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로">←</button>
      <div className="game-title-lockup">
        <ClassicBrand />
        <div><span>PLAYROOM</span><strong>{title}</strong></div>
      </div>
      <button className="exit-button" onClick={onExit}>나가기</button>
    </header>
  );
}

function ClassicModeSwitch() {
  return (
    <div className="mode-switch" aria-label="대전 모드">
      <button className="active"><span className="bot-face">•ᴗ•</span>AI 대전</button>
      <button disabled><span>♙</span>친구 대전<small>준비 중</small></button>
    </div>
  );
}

function ClassicScore({
  player,
  ai,
  playerLabel = "나",
  aiLabel = "AI",
  turn,
}: {
  player: ReactNode;
  ai: ReactNode;
  playerLabel?: string;
  aiLabel?: string;
  turn: Player;
}) {
  return (
    <div className="classic-score">
      <div className={turn === 1 ? "active" : ""}><span>{playerLabel}</span><strong>{player}</strong></div>
      <i>VS</i>
      <div className={turn === 2 ? "active" : ""}><span>{aiLabel}</span><strong>{ai}</strong></div>
    </div>
  );
}

function ClassicGameLayout({
  game,
  theme,
  eyebrow,
  title,
  description,
  turn,
  playerScore,
  aiScore,
  status,
  substatus,
  rules,
  children,
  actions,
  onExit,
}: {
  game: string;
  theme: string;
  eyebrow: string;
  title: ReactNode;
  description: string;
  turn: Player;
  playerScore: ReactNode;
  aiScore: ReactNode;
  status: string;
  substatus: string;
  rules: string[];
  children: ReactNode;
  actions: ReactNode;
  onExit: () => void;
}) {
  return (
    <main className={`game-shell classic-shell ${theme}-shell`}>
      <ClassicTopbar title={game} onExit={onExit} />
      <section className="game-content">
        <aside className="game-info-panel">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <ClassicModeSwitch />
          <ClassicScore player={playerScore} ai={aiScore} turn={turn} />
        </aside>
        <div className="board-panel classic-board-panel">
          <div className="board-status" role="status">
            <span className="classic-status-icon" aria-hidden="true">◆</span>
            <strong>{status}</strong>
            <span>{substatus}</span>
          </div>
          <details className="classic-rules">
            <summary>ⓘ 게임 방법</summary>
            <ol>{rules.map((rule, index) => <li key={rule}><b>{index + 1}</b><span>{rule}</span></li>)}</ol>
          </details>
          {children}
          <div className="game-actions classic-actions">{actions}</div>
        </div>
      </section>
    </main>
  );
}

/* Nine Men's Morris */

const MORRIS_POINTS = [
  [5, 5], [50, 5], [95, 5], [18, 18], [50, 18], [82, 18], [31, 31], [50, 31],
  [69, 31], [5, 50], [18, 50], [31, 50], [69, 50], [82, 50], [95, 50], [31, 69],
  [50, 69], [69, 69], [18, 82], [50, 82], [82, 82], [5, 95], [50, 95], [95, 95],
] as const;

const MORRIS_ADJACENCY: number[][] = [
  [1, 9], [0, 2, 4], [1, 14], [4, 10], [1, 3, 5, 7], [4, 13],
  [7, 11], [4, 6, 8], [7, 12], [0, 10, 21], [3, 9, 11, 18], [6, 10, 15],
  [8, 13, 17], [5, 12, 14, 20], [2, 13, 23], [11, 16], [15, 17, 19],
  [12, 16], [10, 19], [16, 18, 20, 22], [13, 19], [9, 22], [19, 21, 23], [14, 22],
];

const MORRIS_MILLS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17],
  [18, 19, 20], [21, 22, 23], [0, 9, 21], [3, 10, 18], [6, 11, 15],
  [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23],
] as const;

type MorrisMove = { from: number; to: number };
type MorrisState = {
  board: number[];
  placed: [number, number];
  turn: Player;
  selected: number | null;
  pendingCapture: Player | null;
  winner: Winner;
};

function newMorrisState(): MorrisState {
  return {
    board: Array(24).fill(0),
    placed: [0, 0],
    turn: 1,
    selected: null,
    pendingCapture: null,
    winner: 0,
  };
}

function morrisCount(board: number[], player: Player) {
  return board.filter((piece) => piece === player).length;
}

function isMorrisMill(board: number[], point: number, player: Player) {
  return MORRIS_MILLS.some((mill) => (mill as readonly number[]).includes(point) && mill.every((index) => board[index] === player));
}

function morrisCaptureTargets(board: number[], player: Player) {
  const opponent = player === 1 ? 2 : 1;
  const all = board.flatMap((piece, index) => piece === opponent ? [index] : []);
  const outsideMills = all.filter((index) => !isMorrisMill(board, index, opponent));
  return outsideMills.length ? outsideMills : all;
}

function morrisMoves(board: number[], player: Player, placed: [number, number]): MorrisMove[] {
  if (placed[player - 1] < 9) {
    return board.flatMap((piece, index) => piece === 0 ? [{ from: -1, to: index }] : []);
  }
  const flying = morrisCount(board, player) === 3;
  const empty = board.flatMap((piece, index) => piece === 0 ? [index] : []);
  return board.flatMap((piece, from) => {
    if (piece !== player) return [];
    const targets = flying ? empty : MORRIS_ADJACENCY[from].filter((to) => board[to] === 0);
    return targets.map((to) => ({ from, to }));
  });
}

function applyMorrisMove(board: number[], player: Player, move: MorrisMove) {
  const next = [...board];
  if (move.from >= 0) next[move.from] = 0;
  next[move.to] = player;
  return next;
}

function morrisWinner(board: number[], placed: [number, number], next: Player): Winner {
  if (placed[next - 1] < 9) return 0;
  if (morrisCount(board, next) < 3 || morrisMoves(board, next, placed).length === 0) {
    return next === 1 ? 2 : 1;
  }
  return 0;
}

function chooseMorrisMove(board: number[], placed: [number, number]) {
  const moves = morrisMoves(board, 2, placed);
  const playerThreats = new Set(
    morrisMoves(board, 1, placed)
      .filter((move) => isMorrisMill(applyMorrisMove(board, 1, move), move.to, 1))
      .map((move) => move.to),
  );
  return [...moves].sort((a, b) => {
    const score = (move: MorrisMove) => {
      const next = applyMorrisMove(board, 2, move);
      return (isMorrisMill(next, move.to, 2) ? 100 : 0) +
        (playerThreats.has(move.to) ? 42 : 0) +
        MORRIS_ADJACENCY[move.to].length * 2 +
        Math.random();
    };
    return score(b) - score(a);
  })[0];
}

export function NineMensMorrisGame({ onExit }: ExitProps) {
  const [state, setState] = useState<MorrisState>(newMorrisState);
  const legalMoves = useMemo(
    () => morrisMoves(state.board, 1, state.placed),
    [state.board, state.placed],
  );
  const captureTargets = useMemo(
    () => state.pendingCapture === 1 ? morrisCaptureTargets(state.board, 1) : [],
    [state.board, state.pendingCapture],
  );

  useEffect(() => {
    if (state.turn !== 2 || state.winner) return;
    const timer = window.setTimeout(() => {
      setState((current) => {
        if (current.turn !== 2 || current.winner) return current;
        if (current.pendingCapture === 2) {
          const targets = morrisCaptureTargets(current.board, 2);
          if (!targets.length) return { ...current, pendingCapture: null, turn: 1 };
          const target = [...targets].sort((a, b) =>
            MORRIS_ADJACENCY[b].length - MORRIS_ADJACENCY[a].length,
          )[0];
          const board = [...current.board];
          board[target] = 0;
          const winner = morrisWinner(board, current.placed, 1);
          return { ...current, board, pendingCapture: null, turn: 1, winner };
        }
        const move = chooseMorrisMove(current.board, current.placed);
        if (!move) return { ...current, winner: 1 };
        const board = applyMorrisMove(current.board, 2, move);
        const placed: [number, number] = [...current.placed];
        if (move.from < 0) placed[1] += 1;
        const madeMill = isMorrisMill(board, move.to, 2);
        const winner = madeMill ? 0 : morrisWinner(board, placed, 1);
        return {
          ...current,
          board,
          placed,
          selected: null,
          pendingCapture: madeMill ? 2 : null,
          turn: madeMill ? 2 : 1,
          winner,
        };
      });
    }, 520);
    return () => window.clearTimeout(timer);
  }, [state.turn, state.pendingCapture, state.winner]);

  const handlePoint = (index: number) => {
    setState((current) => {
      if (current.turn !== 1 || current.winner) return current;
      if (current.pendingCapture === 1) {
        if (!morrisCaptureTargets(current.board, 1).includes(index)) return current;
        const board = [...current.board];
        board[index] = 0;
        return {
          ...current,
          board,
          pendingCapture: null,
          turn: 2,
          selected: null,
          winner: morrisWinner(board, current.placed, 2),
        };
      }
      if (current.placed[0] < 9) {
        if (current.board[index] !== 0) return current;
        const board = [...current.board];
        board[index] = 1;
        const placed: [number, number] = [current.placed[0] + 1, current.placed[1]];
        const madeMill = isMorrisMill(board, index, 1);
        return {
          ...current,
          board,
          placed,
          pendingCapture: madeMill ? 1 : null,
          turn: madeMill ? 1 : 2,
          winner: madeMill ? 0 : morrisWinner(board, placed, 2),
        };
      }
      if (current.board[index] === 1) {
        return { ...current, selected: current.selected === index ? null : index };
      }
      if (current.selected === null) return current;
      const move = morrisMoves(current.board, 1, current.placed)
        .find((candidate) => candidate.from === current.selected && candidate.to === index);
      if (!move) return current;
      const board = applyMorrisMove(current.board, 1, move);
      const madeMill = isMorrisMill(board, index, 1);
      return {
        ...current,
        board,
        selected: null,
        pendingCapture: madeMill ? 1 : null,
        turn: madeMill ? 1 : 2,
        winner: madeMill ? 0 : morrisWinner(board, current.placed, 2),
      };
    });
  };

  const destinations = new Set(
    state.selected === null ? [] : legalMoves.filter((move) => move.from === state.selected).map((move) => move.to),
  );
  const phase = state.placed[0] < 9 || state.placed[1] < 9 ? "배치 단계" : "이동 단계";
  const status = state.winner
    ? state.winner === 1 ? "승리했어요!" : "AI가 승리했어요"
    : state.pendingCapture === 1 ? "상대 말을 하나 제거하세요"
    : state.turn === 2 ? "AI가 수를 고르는 중…"
    : state.placed[0] < 9 ? "빈 교차점에 말을 놓으세요"
    : "움직일 말을 선택하세요";

  return (
    <ClassicGameLayout
      game="나인 멘스 모리스"
      theme="morris"
      eyebrow="FORM A MILL"
      title={<>세 말을 잇고<br />길을 막으세요</>}
      description="세 말을 한 줄로 연결해 상대 말을 제거하세요. 말이 세 개만 남으면 빈 곳으로 날아갈 수 있습니다."
      turn={state.turn}
      playerScore={`${morrisCount(state.board, 1)} · ${9 - state.placed[0]}`}
      aiScore={`${morrisCount(state.board, 2)} · ${9 - state.placed[1]}`}
      status={status}
      substatus={`${phase} · 판 위 말 / 남은 말`}
      rules={[
        "두 사람이 번갈아 말 9개를 빈 교차점에 놓습니다.",
        "가로·세로로 세 말을 잇는 밀을 만들면 상대 말 하나를 제거합니다.",
        "배치가 끝나면 선을 따라 인접한 빈 교차점으로 한 칸 이동합니다.",
        "말이 세 개만 남으면 연결선과 관계없이 빈 교차점으로 이동할 수 있습니다.",
      ]}
      actions={<>
        <button className="text-action" onClick={() => setState(newMorrisState())}>↻ 새 게임</button>
        <span className="game-hint">밝은 테두리는 현재 선택하거나 이동할 수 있는 자리입니다</span>
        {state.winner > 0 && <button className="primary-action" onClick={() => setState(newMorrisState())}>다시 플레이</button>}
      </>}
      onExit={onExit}
    >
      <div className="morris-board" role="grid" aria-label="나인 멘스 모리스 판">
        <span className="morris-square outer" /><span className="morris-square middle" /><span className="morris-square inner" />
        <span className="morris-line vertical top" /><span className="morris-line vertical bottom" />
        <span className="morris-line horizontal left" /><span className="morris-line horizontal right" />
        {MORRIS_POINTS.map(([x, y], index) => {
          const selectable = state.turn === 1 && !state.winner && (
            captureTargets.includes(index) ||
            (state.pendingCapture === null && (
              (state.placed[0] < 9 && state.board[index] === 0) ||
              (state.placed[0] >= 9 && state.board[index] === 1) ||
              destinations.has(index)
            ))
          );
          return (
            <button
              key={index}
              className={`morris-point ${state.board[index] === 1 ? "player" : state.board[index] === 2 ? "ai" : ""} ${state.selected === index ? "selected" : ""} ${destinations.has(index) || captureTargets.includes(index) ? "target" : ""}`}
              style={{ "--x": `${x}%`, "--y": `${y}%` } as CSSProperties}
              onClick={() => handlePoint(index)}
              disabled={!selectable}
              aria-label={`${index + 1}번 교차점${state.board[index] === 1 ? " 내 말" : state.board[index] === 2 ? " AI 말" : " 빈칸"}`}
            />
          );
        })}
      </div>
    </ClassicGameLayout>
  );
}

/* Gonu — a compact four-line blocking variant */

type GonuMove = { from: number; to: number };
type GonuState = {
  board: number[];
  turn: Player;
  selected: number | null;
  winner: Winner;
  moves: number;
};

function newGonuState(): GonuState {
  return {
    board: [2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
    turn: 1,
    selected: null,
    winner: 0,
    moves: 0,
  };
}

function gonuNeighbors(index: number) {
  const row = Math.floor(index / 4);
  const col = index % 4;
  const result: number[] = [];
  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
    for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
      if (rowDelta === 0 && colDelta === 0) continue;
      const nextRow = row + rowDelta;
      const nextCol = col + colDelta;
      if (nextRow < 0 || nextRow > 3 || nextCol < 0 || nextCol > 3) continue;
      if (rowDelta !== 0 && colDelta !== 0 && (row + col) % 2 === 1) continue;
      result.push(nextRow * 4 + nextCol);
    }
  }
  return result;
}

function gonuMoves(board: number[], player: Player): GonuMove[] {
  return board.flatMap((piece, from) => piece === player
    ? gonuNeighbors(from).filter((to) => board[to] === 0).map((to) => ({ from, to }))
    : []);
}

function applyGonuMove(board: number[], move: GonuMove) {
  const next = [...board];
  next[move.to] = next[move.from];
  next[move.from] = 0;
  return next;
}

function chooseGonuMove(board: number[]) {
  return [...gonuMoves(board, 2)].sort((a, b) => {
    const score = (move: GonuMove) => {
      const next = applyGonuMove(board, move);
      const row = Math.floor(move.to / 4);
      const col = move.to % 4;
      return (12 - gonuMoves(next, 1).length * 3) +
        (3 - Math.abs(1.5 - row) - Math.abs(1.5 - col)) * 2 +
        Math.random();
    };
    return score(b) - score(a);
  })[0];
}

export function GonuGame({ onExit }: ExitProps) {
  const [state, setState] = useState<GonuState>(newGonuState);
  const playerMoves = useMemo(() => gonuMoves(state.board, 1), [state.board]);

  useEffect(() => {
    if (state.turn !== 2 || state.winner) return;
    const timer = window.setTimeout(() => {
      setState((current) => {
        if (current.turn !== 2 || current.winner) return current;
        const move = chooseGonuMove(current.board);
        if (!move) return { ...current, winner: 1 };
        const board = applyGonuMove(current.board, move);
        const moves = current.moves + 1;
        const winner: Winner = gonuMoves(board, 1).length === 0 ? 2 : moves >= 100 ? 3 : 0;
        return { board, turn: 1, selected: null, winner, moves };
      });
    }, 480);
    return () => window.clearTimeout(timer);
  }, [state.turn, state.winner]);

  const handlePoint = (index: number) => {
    setState((current) => {
      if (current.turn !== 1 || current.winner) return current;
      if (current.board[index] === 1) {
        return { ...current, selected: current.selected === index ? null : index };
      }
      if (current.selected === null) return current;
      const move = gonuMoves(current.board, 1)
        .find((candidate) => candidate.from === current.selected && candidate.to === index);
      if (!move) return current;
      const board = applyGonuMove(current.board, move);
      const moves = current.moves + 1;
      const winner: Winner = gonuMoves(board, 2).length === 0 ? 1 : moves >= 100 ? 3 : 0;
      return { board, turn: winner ? 1 : 2, selected: null, winner, moves };
    });
  };

  const destinations = new Set(
    state.selected === null ? [] : playerMoves.filter((move) => move.from === state.selected).map((move) => move.to),
  );
  const status = state.winner
    ? state.winner === 3 ? "무승부예요" : state.winner === 1 ? "길을 막아 승리했어요!" : "AI가 길을 막았어요"
    : state.turn === 2 ? "AI가 길을 찾는 중…" : "움직일 말을 선택하세요";

  return (
    <ClassicGameLayout
      game="고누"
      theme="gonu"
      eyebrow="KOREAN LINE GAME"
      title={<>한 칸씩 움직여<br />퇴로를 막으세요</>}
      description="전통 고누의 막기 방식을 네 줄 말판에 담았습니다. 상대의 모든 이동로를 먼저 차단하세요."
      turn={state.turn}
      playerScore={`${playerMoves.length}길`}
      aiScore={`${gonuMoves(state.board, 2).length}길`}
      status={status}
      substatus={`${state.moves}수 진행 · 선택한 말을 다시 누르면 취소됩니다`}
      rules={[
        "각자 네 개의 말을 가지고 아래와 위에서 시작합니다.",
        "자기 말 하나를 연결선을 따라 인접한 빈 교차점으로 한 칸 옮깁니다.",
        "대각선은 대각선 연결선이 그어진 교차점에서만 이용할 수 있습니다.",
        "상대가 움직일 수 있는 길을 모두 막으면 승리합니다.",
      ]}
      actions={<>
        <button className="text-action" onClick={() => setState(newGonuState())}>↻ 새 게임</button>
        <span className="game-hint">고누는 지역에 따라 말판과 세부 규칙이 다양합니다</span>
        {state.winner > 0 && <button className="primary-action" onClick={() => setState(newGonuState())}>다시 플레이</button>}
      </>}
      onExit={onExit}
    >
      <div className="gonu-board" role="grid" aria-label="네 줄 고누판">
        <span className="gonu-diagonal one" /><span className="gonu-diagonal two" />
        {state.board.map((piece, index) => {
          const selectable = state.turn === 1 && !state.winner && (
            piece === 1 || destinations.has(index)
          );
          return (
            <button
              key={index}
              className={`gonu-point ${piece === 1 ? "player" : piece === 2 ? "ai" : ""} ${state.selected === index ? "selected" : ""} ${destinations.has(index) ? "target" : ""}`}
              onClick={() => handlePoint(index)}
              disabled={!selectable}
              aria-label={`${Math.floor(index / 4) + 1}행 ${index % 4 + 1}열${piece === 1 ? " 내 말" : piece === 2 ? " AI 말" : " 빈칸"}`}
            />
          );
        })}
      </div>
    </ClassicGameLayout>
  );
}

/* Dominoes */

type DominoTile = { id: string; a: number; b: number };
type OrientedDomino = DominoTile & { left: number; right: number };
type DominoState = {
  playerHand: DominoTile[];
  aiHand: DominoTile[];
  boneyard: DominoTile[];
  chain: OrientedDomino[];
  turn: Player;
  winner: Winner;
  passes: number;
  note: string;
};

function dominoSet() {
  const tiles: DominoTile[] = [];
  for (let a = 0; a <= 6; a += 1) {
    for (let b = a; b <= 6; b += 1) tiles.push({ id: `${a}-${b}`, a, b });
  }
  return tiles;
}

function seededShuffle<T>(items: T[], seed: number) {
  const next = [...items];
  let value = seed || 1;
  for (let index = next.length - 1; index > 0; index -= 1) {
    value = (value * 9301 + 49297) % 233280;
    const target = Math.floor((value / 233280) * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

function newDominoState(seed = 7): DominoState {
  const tiles = seededShuffle(dominoSet(), seed);
  return {
    playerHand: tiles.slice(0, 7),
    aiHand: tiles.slice(7, 14),
    boneyard: tiles.slice(14),
    chain: [],
    turn: 1,
    winner: 0,
    passes: 0,
    note: "내 패 하나를 선택해 첫 도미노를 놓으세요",
  };
}

function dominoEnds(chain: OrientedDomino[]) {
  return chain.length ? [chain[0].left, chain[chain.length - 1].right] as const : [null, null] as const;
}

function dominoSides(tile: DominoTile, chain: OrientedDomino[]) {
  if (!chain.length) return ["right"] as const;
  const [left, right] = dominoEnds(chain);
  const result: ("left" | "right")[] = [];
  if (tile.a === left || tile.b === left) result.push("left");
  if (tile.a === right || tile.b === right) result.push("right");
  return result;
}

function placeDomino(chain: OrientedDomino[], tile: DominoTile, side: "left" | "right") {
  if (!chain.length) return [{ ...tile, left: tile.a, right: tile.b }];
  const [left, right] = dominoEnds(chain);
  if (side === "left") {
    const oriented = tile.b === left
      ? { ...tile, left: tile.a, right: tile.b }
      : { ...tile, left: tile.b, right: tile.a };
    return [oriented, ...chain];
  }
  const oriented = tile.a === right
    ? { ...tile, left: tile.a, right: tile.b }
    : { ...tile, left: tile.b, right: tile.a };
  return [...chain, oriented];
}

function dominoPips(hand: DominoTile[]) {
  return hand.reduce((sum, tile) => sum + tile.a + tile.b, 0);
}

function blockedDominoWinner(playerHand: DominoTile[], aiHand: DominoTile[]): Winner {
  const player = dominoPips(playerHand);
  const ai = dominoPips(aiHand);
  return player === ai ? 3 : player < ai ? 1 : 2;
}

function PipFace({ value }: { value: number }) {
  return <span className={`pip-face pips-${value}`} aria-label={`${value}점`}>{value || "·"}</span>;
}

function DominoPiece({ tile, compact = false }: { tile: { left: number; right: number }; compact?: boolean }) {
  return (
    <span className={`domino-piece ${compact ? "compact" : ""}`}>
      <PipFace value={tile.left} /><i /><PipFace value={tile.right} />
    </span>
  );
}

export function DominoGame({ onExit }: ExitProps) {
  const [state, setState] = useState<DominoState>(() => newDominoState(7));

  useEffect(() => {
    if (state.turn !== 2 || state.winner) return;
    const timer = window.setTimeout(() => {
      setState((current) => {
        if (current.turn !== 2 || current.winner) return current;
        let hand = [...current.aiHand];
        let boneyard = [...current.boneyard];
        let playable = hand.filter((tile) => dominoSides(tile, current.chain).length);
        while (!playable.length && boneyard.length) {
          const drawn = boneyard[0];
          boneyard = boneyard.slice(1);
          hand.push(drawn);
          playable = dominoSides(drawn, current.chain).length ? [drawn] : [];
        }
        if (!playable.length) {
          const passes = current.passes + 1;
          const winner = passes >= 2 ? blockedDominoWinner(current.playerHand, hand) : 0;
          return {
            ...current,
            aiHand: hand,
            boneyard,
            turn: 1,
            passes,
            winner,
            note: winner ? "양쪽 모두 놓을 수 없어 남은 눈을 비교했습니다" : "AI가 놓을 패가 없어 차례를 넘겼습니다",
          };
        }
        const tile = [...playable].sort((a, b) => b.a + b.b - a.a - a.b)[0];
        const side = dominoSides(tile, current.chain).includes("right") ? "right" : "left";
        const chain = placeDomino(current.chain, tile, side);
        hand = hand.filter((candidate) => candidate.id !== tile.id);
        const winner: Winner = hand.length === 0 ? 2 : 0;
        return {
          ...current,
          aiHand: hand,
          boneyard,
          chain,
          turn: 1,
          winner,
          passes: 0,
          note: winner ? "AI가 모든 패를 내려놓았습니다" : `AI가 ${tile.a}-${tile.b} 패를 놓았습니다`,
        };
      });
    }, 560);
    return () => window.clearTimeout(timer);
  }, [state.turn, state.winner]);

  const playTile = (tile: DominoTile) => {
    setState((current) => {
      if (current.turn !== 1 || current.winner) return current;
      const sides = dominoSides(tile, current.chain);
      if (!sides.length) return { ...current, note: "현재 양 끝 숫자와 맞는 패를 선택하세요" };
      const side = sides.includes("right") ? "right" : "left";
      const chain = placeDomino(current.chain, tile, side);
      const playerHand = current.playerHand.filter((candidate) => candidate.id !== tile.id);
      const winner: Winner = playerHand.length === 0 ? 1 : 0;
      return {
        ...current,
        playerHand,
        chain,
        turn: winner ? 1 : 2,
        winner,
        passes: 0,
        note: winner ? "모든 패를 내려놓았습니다" : `${tile.a}-${tile.b} 패를 놓았습니다`,
      };
    });
  };

  const drawOrPass = () => {
    setState((current) => {
      if (current.turn !== 1 || current.winner) return current;
      const hasMove = current.playerHand.some((tile) => dominoSides(tile, current.chain).length);
      if (hasMove) return { ...current, note: "놓을 수 있는 패가 있습니다" };
      if (current.boneyard.length) {
        const drawn = current.boneyard[0];
        return {
          ...current,
          playerHand: [...current.playerHand, drawn],
          boneyard: current.boneyard.slice(1),
          note: `${drawn.a}-${drawn.b} 패를 가져왔습니다`,
        };
      }
      const passes = current.passes + 1;
      const winner = passes >= 2 ? blockedDominoWinner(current.playerHand, current.aiHand) : 0;
      return {
        ...current,
        passes,
        winner,
        turn: winner ? 1 : 2,
        note: winner ? "양쪽 모두 놓을 수 없어 남은 눈을 비교했습니다" : "놓을 패가 없어 차례를 넘겼습니다",
      };
    });
  };

  const reset = () => setState(newDominoState(Date.now() % 233280));
  const [left, right] = dominoEnds(state.chain);
  const status = state.winner
    ? state.winner === 3 ? "같은 점수로 비겼어요" : state.winner === 1 ? "도미노 승리!" : "AI가 먼저 패를 비웠어요"
    : state.turn === 2 ? "AI가 패를 고르는 중…" : "놓을 도미노를 선택하세요";

  return (
    <ClassicGameLayout
      game="도미노"
      theme="domino"
      eyebrow="MATCH THE PIPS"
      title={<>같은 눈을 맞춰<br />패를 비우세요</>}
      description="양끝의 숫자와 같은 도미노를 이어 붙이세요. 손에 든 패를 먼저 모두 내려놓으면 승리합니다."
      turn={state.turn}
      playerScore={`${state.playerHand.length}장`}
      aiScore={`${state.aiHand.length}장`}
      status={status}
      substatus={`${state.note} · 더미 ${state.boneyard.length}장`}
      rules={[
        "내 패에서 체인의 왼쪽 또는 오른쪽 끝 숫자와 같은 패를 선택합니다.",
        "양쪽 모두 맞는 패는 자동으로 오른쪽에 놓이며, 한쪽만 맞으면 해당 방향에 놓입니다.",
        "놓을 수 있는 패가 없으면 더미에서 한 장씩 가져옵니다.",
        "패를 먼저 모두 놓으면 승리하며, 막히면 남은 눈의 합이 작은 쪽이 이깁니다.",
      ]}
      actions={<>
        <button className="text-action" onClick={reset}>↻ 새 게임</button>
        <span className="game-hint">현재 끝 숫자 {left ?? "없음"} · {right ?? "없음"}</span>
        {!state.winner && state.turn === 1 && <button className="primary-action" onClick={drawOrPass}>뽑기 / 패스</button>}
        {state.winner > 0 && <button className="primary-action" onClick={reset}>다시 플레이</button>}
      </>}
      onExit={onExit}
    >
      <div className="domino-table">
        <div className="domino-ai-rack" aria-label={`AI 패 ${state.aiHand.length}장`}>
          {state.aiHand.map((tile) => <span key={tile.id} className="domino-back" />)}
        </div>
        <div className="domino-chain" aria-label="놓인 도미노">
          {state.chain.length
            ? state.chain.map((tile) => <DominoPiece key={tile.id} tile={tile} compact />)
            : <span className="domino-empty">첫 패를 놓아주세요</span>}
        </div>
        <div className="domino-hand" aria-label="내 도미노 패">
          {state.playerHand.map((tile) => {
            const playable = state.turn === 1 && dominoSides(tile, state.chain).length > 0;
            return (
              <button
                key={tile.id}
                className={playable ? "playable" : ""}
                onClick={() => playTile(tile)}
                disabled={state.turn !== 1 || Boolean(state.winner)}
                aria-label={`${tile.a}-${tile.b} 도미노${playable ? " 놓을 수 있음" : ""}`}
              >
                <DominoPiece tile={{ left: tile.a, right: tile.b }} />
              </button>
            );
          })}
        </div>
      </div>
    </ClassicGameLayout>
  );
}

/* Backgammon */

type BgSource = number | "bar";
type BgDestination = number | "off";
type BgMove = { from: BgSource; to: BgDestination; die: number };
type BackgammonState = {
  board: number[];
  bar: [number, number];
  off: [number, number];
  turn: Player;
  dice: number[];
  selected: BgSource | null;
  winner: Winner;
  note: string;
};

function newBackgammonState(): BackgammonState {
  const board = Array(24).fill(0);
  board[23] = 2; board[12] = 5; board[7] = 3; board[5] = 5;
  board[0] = -2; board[11] = -5; board[16] = -3; board[18] = -5;
  return { board, bar: [0, 0], off: [0, 0], turn: 1, dice: [], selected: null, winner: 0, note: "주사위를 굴려 시작하세요" };
}

function bgOwner(value: number): Player | 0 {
  return value > 0 ? 1 : value < 0 ? 2 : 0;
}

function bgAllHome(state: BackgammonState, player: Player) {
  if (state.bar[player - 1] > 0) return false;
  return state.board.every((value, index) => {
    if (bgOwner(value) !== player) return true;
    return player === 1 ? index <= 5 : index >= 18;
  });
}

function bgCanLand(board: number[], player: Player, point: number) {
  const value = board[point];
  return player === 1 ? value >= -1 : value <= 1;
}

function bgMovesForDie(state: BackgammonState, player: Player, die: number): BgMove[] {
  if (state.bar[player - 1] > 0) {
    const to = player === 1 ? 24 - die : die - 1;
    return bgCanLand(state.board, player, to) ? [{ from: "bar", to, die }] : [];
  }
  const moves: BgMove[] = [];
  state.board.forEach((value, from) => {
    if (bgOwner(value) !== player) return;
    const target = player === 1 ? from - die : from + die;
    if (target >= 0 && target < 24) {
      if (bgCanLand(state.board, player, target)) moves.push({ from, to: target, die });
      return;
    }
    if (!bgAllHome(state, player)) return;
    if (player === 1) {
      const exact = from === die - 1;
      const noHigher = !state.board.some((piece, index) => piece > 0 && index > from);
      if (exact || (die > from + 1 && noHigher)) moves.push({ from, to: "off", die });
    } else {
      const exact = 24 - from === die;
      const noLower = !state.board.some((piece, index) => piece < 0 && index < from);
      if (exact || (die > 24 - from && noLower)) moves.push({ from, to: "off", die });
    }
  });
  return moves;
}

function bgLegalMoves(state: BackgammonState, player: Player) {
  return state.dice.flatMap((die) => bgMovesForDie(state, player, die));
}

function applyBgMove(state: BackgammonState, player: Player, move: BgMove) {
  const board = [...state.board];
  const bar: [number, number] = [...state.bar];
  const off: [number, number] = [...state.off];
  if (move.from === "bar") bar[player - 1] -= 1;
  else board[move.from] += player === 1 ? -1 : 1;
  if (move.to === "off") {
    off[player - 1] += 1;
  } else {
    if (player === 1 && board[move.to] === -1) {
      board[move.to] = 0;
      bar[1] += 1;
    }
    if (player === 2 && board[move.to] === 1) {
      board[move.to] = 0;
      bar[0] += 1;
    }
    board[move.to] += player === 1 ? 1 : -1;
  }
  const dieIndex = state.dice.indexOf(move.die);
  const dice = state.dice.filter((_, index) => index !== dieIndex);
  return { ...state, board, bar, off, dice, selected: null };
}

function rollBackgammonDice() {
  const first = 1 + Math.floor(Math.random() * 6);
  const second = 1 + Math.floor(Math.random() * 6);
  return first === second ? [first, first, first, first] : [first, second];
}

function bgPointLabel(index: number) {
  return index + 1;
}

export function BackgammonGame({ onExit }: ExitProps) {
  const [state, setState] = useState<BackgammonState>(newBackgammonState);
  const legalMoves = useMemo(() => bgLegalMoves(state, 1), [state]);

  useEffect(() => {
    if (state.turn !== 2 || state.winner) return;
    const timer = window.setTimeout(() => {
      setState((current) => {
        if (current.turn !== 2 || current.winner) return current;
        let next: BackgammonState = { ...current, dice: rollBackgammonDice(), note: "AI가 주사위를 굴렸습니다" };
        let guard = 0;
        while (next.dice.length && guard < 4) {
          guard += 1;
          const moves = bgLegalMoves(next, 2);
          if (!moves.length) break;
          const move = [...moves].sort((a, b) => {
            const score = (candidate: BgMove) => {
              const hit = typeof candidate.to === "number" && next.board[candidate.to] === 1 ? 30 : 0;
              const bear = candidate.to === "off" ? 50 : 0;
              const advance = typeof candidate.to === "number" && typeof candidate.from === "number"
                ? candidate.to - candidate.from : candidate.die;
              return hit + bear + advance + Math.random();
            };
            return score(b) - score(a);
          })[0];
          next = applyBgMove(next, 2, move);
          if (next.off[1] >= 15) return { ...next, winner: 2, turn: 2, note: "AI가 모든 말을 내보냈습니다" };
        }
        return { ...next, dice: [], turn: 1, selected: null, note: "내 차례입니다. 주사위를 굴리세요" };
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [state.turn, state.winner]);

  useEffect(() => {
    if (state.turn !== 1 || !state.dice.length || state.winner) return;
    if (bgLegalMoves(state, 1).length) return;
    const timer = window.setTimeout(() => {
      setState((current) => current.turn === 1
        ? { ...current, dice: [], selected: null, turn: 2, note: "움직일 수 없어 차례를 넘겼습니다" }
        : current);
    }, 550);
    return () => window.clearTimeout(timer);
  }, [state]);

  const roll = () => {
    setState((current) => {
      if (current.turn !== 1 || current.dice.length || current.winner) return current;
      const dice = rollBackgammonDice();
      return { ...current, dice, selected: current.bar[0] ? "bar" : null, note: `${dice[0]} · ${dice[1]} 주사위가 나왔습니다` };
    });
  };

  const selectSource = (source: BgSource) => {
    setState((current) => {
      if (current.turn !== 1 || !current.dice.length || current.winner) return current;
      const moves = bgLegalMoves(current, 1).filter((move) => move.from === source);
      if (!moves.length) return current;
      return { ...current, selected: current.selected === source ? null : source };
    });
  };

  const moveTo = (destination: BgDestination) => {
    setState((current) => {
      if (current.selected === null || current.turn !== 1 || current.winner) return current;
      const move = bgLegalMoves(current, 1)
        .find((candidate) => candidate.from === current.selected && candidate.to === destination);
      if (!move) return current;
      let next = applyBgMove(current, 1, move);
      if (next.off[0] >= 15) return { ...next, winner: 1, note: "모든 말을 내보냈습니다!" };
      if (!next.dice.length || !bgLegalMoves(next, 1).length) {
        next = { ...next, dice: [], turn: 2, note: "AI 차례입니다" };
      }
      return next;
    });
  };

  const sourceSet = new Set(legalMoves.map((move) => move.from));
  const destinations = new Set(
    state.selected === null ? [] : legalMoves.filter((move) => move.from === state.selected).map((move) => move.to),
  );
  const reset = () => setState(newBackgammonState());
  const status = state.winner
    ? state.winner === 1 ? "백개먼 승리!" : "AI가 먼저 모든 말을 내보냈어요"
    : state.turn === 2 ? "AI가 이동하는 중…"
    : state.dice.length ? "주사위에 맞춰 말을 이동하세요" : "주사위를 굴리세요";
  const renderPoint = (index: number, top: boolean) => {
    const value = state.board[index];
    const count = Math.abs(value);
    const selectable = state.turn === 1 && sourceSet.has(index);
    const destination = destinations.has(index);
    return (
      <button
        key={index}
        className={`bg-point ${top ? "top" : "bottom"} ${index % 2 ? "dark" : "light"} ${state.selected === index ? "selected" : ""} ${destination ? "destination" : ""}`}
        onClick={() => destination ? moveTo(index) : selectSource(index)}
        disabled={!selectable && !destination}
        aria-label={`${bgPointLabel(index)}번 포인트${value > 0 ? ` 내 말 ${count}개` : value < 0 ? ` AI 말 ${count}개` : " 빈칸"}`}
      >
        <span className="bg-number">{bgPointLabel(index)}</span>
        {count > 0 && (
          <span className={`bg-stack ${value > 0 ? "player" : "ai"}`}>
            {Array.from({ length: Math.min(count, 5) }, (_, piece) => <i key={piece} />)}
            {count > 5 && <b>{count}</b>}
          </span>
        )}
      </button>
    );
  };

  return (
    <ClassicGameLayout
      game="백개먼"
      theme="backgammon"
      eyebrow="RACE THEM HOME"
      title={<>주사위를 읽고<br />말을 귀환시키세요</>}
      description="상대의 외톨이 말을 잡아 바로 보내고, 내 말 열다섯 개를 먼저 모두 판 밖으로 내보내세요."
      turn={state.turn}
      playerScore={`${state.off[0]} / 15`}
      aiScore={`${state.off[1]} / 15`}
      status={status}
      substatus={`${state.note} · 바 나 ${state.bar[0]} / AI ${state.bar[1]}`}
      rules={[
        "플레이어는 24번에서 1번 방향으로, AI는 반대 방향으로 이동합니다.",
        "주사위 두 눈을 각각 한 번 사용하며 같은 눈이면 네 번 움직입니다.",
        "상대 말이 하나뿐인 포인트에 도착하면 그 말을 바로 보내고, 두 개 이상이면 들어갈 수 없습니다.",
        "내 모든 말이 마지막 여섯 칸에 모이면 주사위 눈에 맞춰 판 밖으로 내보낼 수 있습니다.",
      ]}
      actions={<>
        <button className="text-action" onClick={reset}>↻ 새 게임</button>
        <div className="bg-dice" aria-label={`남은 주사위 ${state.dice.join(", ") || "없음"}`}>
          {state.dice.map((die, index) => <b key={`${die}-${index}`}>{die}</b>)}
        </div>
        {!state.winner && state.turn === 1 && !state.dice.length && <button className="primary-action bg-roll" onClick={roll}>⚂ 주사위 굴리기</button>}
        {state.bar[0] > 0 && state.turn === 1 && state.dice.length > 0 && (
          <button className={`primary-action ${state.selected === "bar" ? "active" : ""}`} onClick={() => selectSource("bar")}>바에서 입장</button>
        )}
        {destinations.has("off") && <button className="primary-action" onClick={() => moveTo("off")}>말 내보내기</button>}
        {state.winner > 0 && <button className="primary-action" onClick={reset}>다시 플레이</button>}
      </>}
      onExit={onExit}
    >
      <div className="backgammon-board" role="grid" aria-label="백개먼 보드">
        <div className="bg-half top">{[12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].map((index) => renderPoint(index, true))}</div>
        <div className="bg-bar" aria-label={`바 내 말 ${state.bar[0]}개 AI 말 ${state.bar[1]}개`}>
          <span>{state.bar[1] ? `AI ${state.bar[1]}` : ""}</span><i /><span>{state.bar[0] ? `나 ${state.bar[0]}` : ""}</span>
        </div>
        <div className="bg-half bottom">{[11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((index) => renderPoint(index, false))}</div>
      </div>
    </ClassicGameLayout>
  );
}

/* Chinese Checkers */

type CheckerHole = { id: string; row: number; x: number };
type ChineseMove = { from: string; to: string; hops: number };
type ChineseState = {
  board: Record<string, number>;
  turn: Player;
  selected: string | null;
  winner: Winner;
  moves: number;
};

const CHINESE_ROW_COUNTS = [1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1];
const CHINESE_HOLES: CheckerHole[] = CHINESE_ROW_COUNTS.flatMap((count, row) => {
  const start = -(count - 1);
  return Array.from({ length: count }, (_, index) => ({
    id: `${row}:${start + index * 2}`,
    row,
    x: start + index * 2,
  }));
});
const CHINESE_HOLE_IDS = new Set(CHINESE_HOLES.map((hole) => hole.id));
const CHINESE_TOP = new Set(CHINESE_HOLES.filter((hole) => hole.row <= 3).map((hole) => hole.id));
const CHINESE_BOTTOM = new Set(CHINESE_HOLES.filter((hole) => hole.row >= 13).map((hole) => hole.id));

function chineseNeighbors(id: string) {
  const [row, x] = id.split(":").map(Number);
  return [
    `${row}:${x - 2}`, `${row}:${x + 2}`,
    `${row - 1}:${x - 1}`, `${row - 1}:${x + 1}`,
    `${row + 1}:${x - 1}`, `${row + 1}:${x + 1}`,
  ].filter((candidate) => CHINESE_HOLE_IDS.has(candidate));
}

function chineseHopDestinations(board: Record<string, number>, from: string) {
  const visited = new Set<string>([from]);
  const queue = [from];
  while (queue.length) {
    const current = queue.shift()!;
    const [row, x] = current.split(":").map(Number);
    const vectors = [[0, -2], [0, 2], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    vectors.forEach(([rowDelta, xDelta]) => {
      const middle = `${row + rowDelta}:${x + xDelta}`;
      const landing = `${row + rowDelta * 2}:${x + xDelta * 2}`;
      if (!CHINESE_HOLE_IDS.has(landing) || !board[middle] || board[landing] || visited.has(landing)) return;
      visited.add(landing);
      queue.push(landing);
    });
  }
  visited.delete(from);
  return [...visited];
}

function chineseMoves(board: Record<string, number>, player: Player): ChineseMove[] {
  return Object.entries(board).flatMap(([from, piece]) => {
    if (piece !== player) return [];
    const steps = chineseNeighbors(from).filter((to) => !board[to]).map((to) => ({ from, to, hops: 0 }));
    const hops = chineseHopDestinations(board, from).map((to) => ({ from, to, hops: 1 }));
    return [...steps, ...hops];
  });
}

function applyChineseMove(board: Record<string, number>, move: ChineseMove) {
  const next = { ...board };
  next[move.to] = next[move.from];
  delete next[move.from];
  return next;
}

function newChineseState(): ChineseState {
  const board: Record<string, number> = {};
  CHINESE_TOP.forEach((id) => { board[id] = 2; });
  CHINESE_BOTTOM.forEach((id) => { board[id] = 1; });
  return { board, turn: 1, selected: null, winner: 0, moves: 0 };
}

function chineseWinner(board: Record<string, number>): Winner {
  const playerWon = [...CHINESE_TOP].every((id) => board[id] === 1);
  const aiWon = [...CHINESE_BOTTOM].every((id) => board[id] === 2);
  return playerWon ? 1 : aiWon ? 2 : 0;
}

function chooseChineseMove(board: Record<string, number>) {
  return [...chineseMoves(board, 2)].sort((a, b) => {
    const score = (move: ChineseMove) => {
      const fromRow = Number(move.from.split(":")[0]);
      const toRow = Number(move.to.split(":")[0]);
      return (toRow - fromRow) * 12 + (CHINESE_BOTTOM.has(move.to) ? 22 : 0) + move.hops * 4 + Math.random();
    };
    return score(b) - score(a);
  })[0];
}

export function ChineseCheckersGame({ onExit }: ExitProps) {
  const [state, setState] = useState<ChineseState>(newChineseState);
  const playerMoves = useMemo(() => chineseMoves(state.board, 1), [state.board]);

  useEffect(() => {
    if (state.turn !== 2 || state.winner) return;
    const timer = window.setTimeout(() => {
      setState((current) => {
        if (current.turn !== 2 || current.winner) return current;
        const move = chooseChineseMove(current.board);
        if (!move) return { ...current, winner: 1 };
        const board = applyChineseMove(current.board, move);
        return {
          board,
          turn: 1,
          selected: null,
          winner: chineseWinner(board),
          moves: current.moves + 1,
        };
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [state.turn, state.winner]);

  const handleHole = (id: string) => {
    setState((current) => {
      if (current.turn !== 1 || current.winner) return current;
      if (current.board[id] === 1) {
        return { ...current, selected: current.selected === id ? null : id };
      }
      if (!current.selected) return current;
      const move = chineseMoves(current.board, 1)
        .find((candidate) => candidate.from === current.selected && candidate.to === id);
      if (!move) return current;
      const board = applyChineseMove(current.board, move);
      const winner = chineseWinner(board);
      return { board, turn: winner ? 1 : 2, selected: null, winner, moves: current.moves + 1 };
    });
  };

  const destinations = new Set(
    state.selected ? playerMoves.filter((move) => move.from === state.selected).map((move) => move.to) : [],
  );
  const playerGoal = [...CHINESE_TOP].filter((id) => state.board[id] === 1).length;
  const aiGoal = [...CHINESE_BOTTOM].filter((id) => state.board[id] === 2).length;
  const status = state.winner
    ? state.winner === 1 ? "모든 말을 옮겨 승리했어요!" : "AI가 먼저 반대편에 도착했어요"
    : state.turn === 2 ? "AI가 도약 경로를 찾는 중…" : "움직일 말을 선택하세요";

  return (
    <ClassicGameLayout
      game="차이니즈 체커"
      theme="chinese-checkers"
      eyebrow="HOP ACROSS"
      title={<>연속 도약으로<br />별을 건너세요</>}
      description="내 말 열 개를 반대편 삼각형으로 먼저 옮기세요. 여러 말을 연속으로 뛰어넘으면 빠르게 전진할 수 있습니다."
      turn={state.turn}
      playerScore={`${playerGoal} / 10`}
      aiScore={`${aiGoal} / 10`}
      status={status}
      substatus={`${state.moves}수 진행 · 점 표시된 모든 연속 도약 목적지로 한 번에 이동할 수 있습니다`}
      rules={[
        "플레이어는 아래쪽 청록색 말, AI는 위쪽 산호색 말로 시작합니다.",
        "인접한 빈 구멍으로 한 칸 이동하거나, 바로 옆 말 하나를 넘어 빈 구멍으로 도약합니다.",
        "도약 뒤 다시 넘을 수 있으면 한 차례에 여러 번 이어서 도약할 수 있습니다.",
        "내 말 열 개를 모두 반대편 삼각형에 먼저 채우면 승리합니다.",
      ]}
      actions={<>
        <button className="text-action" onClick={() => setState(newChineseState())}>↻ 새 게임</button>
        <span className="game-hint">말을 다시 누르면 선택이 취소됩니다</span>
        {state.winner > 0 && <button className="primary-action" onClick={() => setState(newChineseState())}>다시 플레이</button>}
      </>}
      onExit={onExit}
    >
      <div className="chinese-board" role="grid" aria-label="차이니즈 체커 별 모양 보드">
        {CHINESE_HOLES.map((hole) => {
          const piece = state.board[hole.id] ?? 0;
          const selectable = state.turn === 1 && !state.winner && (piece === 1 || destinations.has(hole.id));
          return (
            <button
              key={hole.id}
              className={`chinese-hole ${piece === 1 ? "player" : piece === 2 ? "ai" : ""} ${state.selected === hole.id ? "selected" : ""} ${destinations.has(hole.id) ? "destination" : ""} ${CHINESE_TOP.has(hole.id) ? "top-goal" : CHINESE_BOTTOM.has(hole.id) ? "bottom-goal" : ""}`}
              style={{ "--cx": hole.x, "--cy": hole.row } as CSSProperties}
              onClick={() => handleHole(hole.id)}
              disabled={!selectable}
              aria-label={`${hole.row + 1}행${piece === 1 ? " 내 말" : piece === 2 ? " AI 말" : " 빈 구멍"}`}
            />
          );
        })}
      </div>
    </ClassicGameLayout>
  );
}
