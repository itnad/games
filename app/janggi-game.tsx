"use client";

import { useEffect, useMemo, useState } from "react";

type Side = "cho" | "han";
type PieceType = "K" | "G" | "R" | "C" | "H" | "E" | "S";
type Piece = { side: Side; type: PieceType };
type Board = Array<Piece | null>;
type Move = { from: number; to: number };

const COLS = 9;
const ROWS = 10;
const opponent = (side: Side): Side => side === "cho" ? "han" : "cho";
const at = (row: number, col: number) => row * COLS + col;
const rowOf = (index: number) => Math.floor(index / COLS);
const colOf = (index: number) => index % COLS;
const inside = (row: number, col: number) => row >= 0 && row < ROWS && col >= 0 && col < COLS;

const PALACE_LINES = [
  [at(0, 3), at(1, 4), at(2, 5)],
  [at(0, 5), at(1, 4), at(2, 3)],
  [at(7, 3), at(8, 4), at(9, 5)],
  [at(7, 5), at(8, 4), at(9, 3)],
];

const PIECE_LABEL: Record<Side, Record<PieceType, string>> = {
  cho: { K: "楚", G: "士", R: "車", C: "包", H: "馬", E: "象", S: "卒" },
  han: { K: "漢", G: "士", R: "車", C: "包", H: "馬", E: "象", S: "兵" },
};

const PIECE_NAME: Record<PieceType, string> = {
  K: "궁",
  G: "사",
  R: "차",
  C: "포",
  H: "마",
  E: "상",
  S: "졸",
};
const CAPTURE_PREVIEW_COUNT = 4;

function makePiece(side: Side, type: PieceType): Piece {
  return { side, type };
}

function newJanggiBoard(): Board {
  const board: Board = Array.from({ length: COLS * ROWS }, () => null);
  const back: PieceType[] = ["R", "H", "E", "G", "G", "E", "H", "R"];
  const backCols = [0, 1, 2, 3, 5, 6, 7, 8];

  back.forEach((type, index) => {
    board[at(0, backCols[index])] = makePiece("han", type);
    board[at(9, backCols[index])] = makePiece("cho", type);
  });
  board[at(1, 4)] = makePiece("han", "K");
  board[at(8, 4)] = makePiece("cho", "K");
  board[at(2, 1)] = makePiece("han", "C");
  board[at(2, 7)] = makePiece("han", "C");
  board[at(7, 1)] = makePiece("cho", "C");
  board[at(7, 7)] = makePiece("cho", "C");
  [0, 2, 4, 6, 8].forEach((col) => {
    board[at(3, col)] = makePiece("han", "S");
    board[at(6, col)] = makePiece("cho", "S");
  });
  return board;
}

function isInOwnPalace(side: Side, index: number) {
  const row = rowOf(index);
  const col = colOf(index);
  return col >= 3 && col <= 5 && (side === "han" ? row >= 0 && row <= 2 : row >= 7 && row <= 9);
}

function samePalace(first: number, second: number) {
  const firstTop = rowOf(first) <= 2;
  const secondTop = rowOf(second) <= 2;
  const firstBottom = rowOf(first) >= 7;
  const secondBottom = rowOf(second) >= 7;
  return (firstTop && secondTop) || (firstBottom && secondBottom);
}

function palaceNeighbors(index: number) {
  const row = rowOf(index);
  const col = colOf(index);
  const neighbors: number[] = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nextRow = row + dr;
    const nextCol = col + dc;
    if (inside(nextRow, nextCol)) {
      const next = at(nextRow, nextCol);
      if (samePalace(index, next) && nextCol >= 3 && nextCol <= 5) neighbors.push(next);
    }
  }
  for (const line of PALACE_LINES) {
    const position = line.indexOf(index);
    if (position >= 0) {
      if (position > 0) neighbors.push(line[position - 1]);
      if (position < 2) neighbors.push(line[position + 1]);
    }
  }
  return [...new Set(neighbors)];
}

function addDestination(board: Board, piece: Piece, from: number, to: number, moves: Move[]) {
  if (!inside(rowOf(to), colOf(to))) return;
  const target = board[to];
  if (!target || target.side !== piece.side) moves.push({ from, to });
}

function rayMoves(board: Board, piece: Piece, from: number, dr: number, dc: number, moves: Move[]) {
  let row = rowOf(from) + dr;
  let col = colOf(from) + dc;
  while (inside(row, col)) {
    const to = at(row, col);
    const target = board[to];
    if (!target) moves.push({ from, to });
    else {
      if (target.side !== piece.side) moves.push({ from, to });
      break;
    }
    row += dr;
    col += dc;
  }
}

function rookPalaceMoves(board: Board, piece: Piece, from: number, moves: Move[]) {
  for (const line of PALACE_LINES) {
    const position = line.indexOf(from);
    if (position < 0) continue;
    for (const direction of [-1, 1]) {
      let cursor = position + direction;
      while (cursor >= 0 && cursor < line.length) {
        const to = line[cursor];
        const target = board[to];
        if (!target) moves.push({ from, to });
        else {
          if (target.side !== piece.side) moves.push({ from, to });
          break;
        }
        cursor += direction;
      }
    }
  }
}

function cannonRayMoves(board: Board, piece: Piece, from: number, dr: number, dc: number, moves: Move[]) {
  let row = rowOf(from) + dr;
  let col = colOf(from) + dc;
  let screenFound = false;
  while (inside(row, col)) {
    const to = at(row, col);
    const target = board[to];
    if (!screenFound) {
      if (target) {
        if (target.type === "C") break;
        screenFound = true;
      }
    } else if (!target) {
      moves.push({ from, to });
    } else {
      if (target.type !== "C" && target.side !== piece.side) moves.push({ from, to });
      break;
    }
    row += dr;
    col += dc;
  }
}

function cannonPalaceMoves(board: Board, piece: Piece, from: number, moves: Move[]) {
  for (const line of PALACE_LINES) {
    if (line[0] !== from && line[2] !== from) continue;
    const screen = board[line[1]];
    const to = line[0] === from ? line[2] : line[0];
    const target = board[to];
    if (!screen || screen.type === "C") continue;
    if (!target || (target.side !== piece.side && target.type !== "C")) moves.push({ from, to });
  }
}

function pieceMoves(board: Board, from: number): Move[] {
  const piece = board[from];
  if (!piece) return [];
  const moves: Move[] = [];
  const row = rowOf(from);
  const col = colOf(from);

  if (piece.type === "K" || piece.type === "G") {
    if (!isInOwnPalace(piece.side, from)) return moves;
    palaceNeighbors(from)
      .filter((to) => isInOwnPalace(piece.side, to))
      .forEach((to) => addDestination(board, piece, from, to, moves));
  }

  if (piece.type === "R") {
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      rayMoves(board, piece, from, dr, dc, moves);
    }
    rookPalaceMoves(board, piece, from, moves);
  }

  if (piece.type === "C") {
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      cannonRayMoves(board, piece, from, dr, dc, moves);
    }
    cannonPalaceMoves(board, piece, from, moves);
  }

  if (piece.type === "H") {
    const patterns = [
      [-2, -1, -1, 0], [-2, 1, -1, 0],
      [2, -1, 1, 0], [2, 1, 1, 0],
      [-1, -2, 0, -1], [1, -2, 0, -1],
      [-1, 2, 0, 1], [1, 2, 0, 1],
    ];
    for (const [dr, dc, blockDr, blockDc] of patterns) {
      const toRow = row + dr;
      const toCol = col + dc;
      if (inside(toRow, toCol) && !board[at(row + blockDr, col + blockDc)]) {
        addDestination(board, piece, from, at(toRow, toCol), moves);
      }
    }
  }

  if (piece.type === "E") {
    const patterns = [
      [-3, -2, -1, 0, -2, -1], [-3, 2, -1, 0, -2, 1],
      [3, -2, 1, 0, 2, -1], [3, 2, 1, 0, 2, 1],
      [-2, -3, 0, -1, -1, -2], [2, -3, 0, -1, 1, -2],
      [-2, 3, 0, 1, -1, 2], [2, 3, 0, 1, 1, 2],
    ];
    for (const [dr, dc, block1Dr, block1Dc, block2Dr, block2Dc] of patterns) {
      const toRow = row + dr;
      const toCol = col + dc;
      if (
        inside(toRow, toCol) &&
        !board[at(row + block1Dr, col + block1Dc)] &&
        !board[at(row + block2Dr, col + block2Dc)]
      ) {
        addDestination(board, piece, from, at(toRow, toCol), moves);
      }
    }
  }

  if (piece.type === "S") {
    const forward = piece.side === "cho" ? -1 : 1;
    for (const [dr, dc] of [[forward, 0], [0, -1], [0, 1]]) {
      const toRow = row + dr;
      const toCol = col + dc;
      if (inside(toRow, toCol)) addDestination(board, piece, from, at(toRow, toCol), moves);
    }
    palaceNeighbors(from).forEach((to) => {
      if (rowOf(to) - row === forward && Math.abs(colOf(to) - col) === 1) {
        addDestination(board, piece, from, to, moves);
      }
    });
  }

  return [...new Map(moves.map((move) => [`${move.from}-${move.to}`, move])).values()];
}

function pseudoMoves(board: Board, side: Side) {
  return board.flatMap((piece, index) => piece?.side === side ? pieceMoves(board, index) : []);
}

function applyMove(board: Board, move: Move): Board {
  const next = [...board];
  next[move.to] = next[move.from];
  next[move.from] = null;
  return next;
}

function kingIndex(board: Board, side: Side) {
  return board.findIndex((piece) => piece?.side === side && piece.type === "K");
}

function isInCheck(board: Board, side: Side) {
  const king = kingIndex(board, side);
  if (king < 0) return true;
  return pseudoMoves(board, opponent(side)).some((move) => move.to === king);
}

function legalMoves(board: Board, side: Side) {
  return pseudoMoves(board, side).filter((move) => !isInCheck(applyMove(board, move), side));
}

const PIECE_VALUE: Record<PieceType, number> = {
  K: 10000,
  R: 130,
  C: 70,
  H: 50,
  E: 32,
  G: 30,
  S: 20,
};

function evaluate(board: Board) {
  let score = 0;
  board.forEach((piece) => {
    if (!piece) return;
    score += PIECE_VALUE[piece.type] * (piece.side === "han" ? 1 : -1);
  });
  score += (pseudoMoves(board, "han").length - pseudoMoves(board, "cho").length) * 0.15;
  if (isInCheck(board, "cho")) score += 8;
  if (isInCheck(board, "han")) score -= 8;
  return score;
}

function minimax(board: Board, depth: number, maximizing: boolean, alpha: number, beta: number): number {
  if (kingIndex(board, "cho") < 0) return 100000 + depth;
  if (kingIndex(board, "han") < 0) return -100000 - depth;
  const side: Side = maximizing ? "han" : "cho";
  const moves = legalMoves(board, side);
  if (!moves.length && isInCheck(board, side)) return maximizing ? -90000 - depth : 90000 + depth;
  if (depth === 0 || !moves.length) return evaluate(board);

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      best = Math.max(best, minimax(applyMove(board, move), depth - 1, false, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    best = Math.min(best, minimax(applyMove(board, move), depth - 1, true, alpha, beta));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

function chooseAiMove(board: Board) {
  const moves = legalMoves(board, "han");
  if (!moves.length) return null;
  return moves
    .map((move) => {
      const captured = board[move.to];
      const tactical = captured ? PIECE_VALUE[captured.type] * 2 : 0;
      const score = minimax(applyMove(board, move), 1, false, -Infinity, Infinity);
      return { move, score: score + tactical + Math.random() * 0.35 };
    })
    .sort((a, b) => b.score - a.score)[0].move;
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}

function JanggiTopbar({ onExit }: { onExit: () => void }) {
  return (
    <header className="game-topbar">
      <button className="back-button" onClick={onExit} aria-label="게임 목록으로">←</button>
      <div className="game-title-lockup">
        <BrandMark />
        <div><span>PLAYROOM</span><strong>장기</strong></div>
      </div>
      <button className="exit-button" onClick={onExit}>나가기</button>
    </header>
  );
}

export function JanggiGame({ onExit }: { onExit: () => void }) {
  const [board, setBoard] = useState<Board>(newJanggiBoard);
  const [turn, setTurn] = useState<Side>("cho");
  const [selected, setSelected] = useState<number | null>(null);
  const [winner, setWinner] = useState<Side | null>(null);
  const [lastAiMove, setLastAiMove] = useState<Move | null>(null);
  const [capturedCho, setCapturedCho] = useState<Piece[]>([]);
  const [capturedHan, setCapturedHan] = useState<Piece[]>([]);
  const [showAllCaptured, setShowAllCaptured] = useState(false);
  const [notice, setNotice] = useState("움직일 기물을 선택하세요");
  const [moveNumber, setMoveNumber] = useState(1);

  const moves = useMemo(() => turn === "cho" && !winner ? legalMoves(board, "cho") : [], [board, turn, winner]);
  const selectedMoves = selected === null ? [] : moves.filter((move) => move.from === selected);
  const destinations = new Set(selectedMoves.map((move) => move.to));
  const choCount = board.filter((piece) => piece?.side === "cho").length;
  const hanCount = board.filter((piece) => piece?.side === "han").length;
  const choChecked = isInCheck(board, "cho");
  const hanChecked = isInCheck(board, "han");
  const lastAiPieceAlive = Boolean(
    lastAiMove && board[lastAiMove.to]?.side === "han",
  );
  const visibleCapturedCho = showAllCaptured
    ? capturedCho
    : capturedCho.slice(-CAPTURE_PREVIEW_COUNT);
  const visibleCapturedHan = showAllCaptured
    ? capturedHan
    : capturedHan.slice(-CAPTURE_PREVIEW_COUNT);
  const hiddenCapturedCho = Math.max(0, capturedCho.length - visibleCapturedCho.length);
  const hiddenCapturedHan = Math.max(0, capturedHan.length - visibleCapturedHan.length);
  const hasMoreCaptured = capturedCho.length > CAPTURE_PREVIEW_COUNT || capturedHan.length > CAPTURE_PREVIEW_COUNT;

  const play = (index: number) => {
    if (turn !== "cho" || winner) return;
    const piece = board[index];
    if (piece?.side === "cho") {
      if (selected === index) {
        setSelected(null);
        setNotice("선택을 취소했습니다. 다른 기물을 선택하세요");
        return;
      }
      setSelected(index);
      setNotice(`${PIECE_NAME[piece.type]}의 이동 위치를 선택하세요`);
      return;
    }
    if (selected === null) return;
    const move = selectedMoves.find((candidate) => candidate.to === index);
    if (!move) {
      setSelected(null);
      setNotice("움직일 기물을 선택하세요");
      return;
    }

    const captured = board[move.to];
    const next = applyMove(board, move);
    setBoard(next);
    if (captured?.side === "han") {
      setCapturedHan((pieces) => [...pieces, captured]);
    }
    setSelected(null);
    setMoveNumber((value) => value + 1);
    const checked = isInCheck(next, "han");
    const replies = legalMoves(next, "han");
    if (kingIndex(next, "han") < 0 || (checked && replies.length === 0)) {
      setWinner("cho");
      setNotice("외통수입니다");
    } else {
      setTurn("han");
      setNotice(checked ? "장군!" : "AI가 수를 읽는 중…");
    }
  };

  const pass = () => {
    if (turn !== "cho" || winner || choChecked) return;
    setSelected(null);
    setTurn("han");
    setMoveNumber((value) => value + 1);
    setNotice("한 수를 쉬었습니다");
  };

  useEffect(() => {
    if (turn !== "han" || winner) return;
    const timer = window.setTimeout(() => {
      const aiMove = chooseAiMove(board);
      if (!aiMove) {
        if (isInCheck(board, "han")) {
          setWinner("cho");
          setNotice("외통수입니다");
        } else {
          setTurn("cho");
          setNotice("AI가 한 수 쉬었습니다");
        }
        return;
      }
      const captured = board[aiMove.to];
      const next = applyMove(board, aiMove);
      setBoard(next);
      setLastAiMove(aiMove);
      if (captured?.side === "cho") {
        setCapturedCho((pieces) => [...pieces, captured]);
      }
      setMoveNumber((value) => value + 1);
      const checked = isInCheck(next, "cho");
      const replies = legalMoves(next, "cho");
      if (kingIndex(next, "cho") < 0 || (checked && replies.length === 0)) {
        setWinner("han");
        setNotice("AI가 외통을 만들었습니다");
      } else {
        setTurn("cho");
        setNotice(checked ? "장군! 궁을 피하세요" : "내 차례입니다");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [board, turn, winner]);

  const reset = () => {
    setBoard(newJanggiBoard());
    setTurn("cho");
    setSelected(null);
    setWinner(null);
    setLastAiMove(null);
    setCapturedCho([]);
    setCapturedHan([]);
    setShowAllCaptured(false);
    setNotice("움직일 기물을 선택하세요");
    setMoveNumber(1);
  };

  const status = winner
    ? winner === "cho" ? "초의 승리!" : "한의 승리"
    : turn === "cho"
      ? choChecked ? "장군!" : "초 · 내 차례"
      : hanChecked ? "장군을 불렀어요" : "한 · AI 차례";

  return (
    <main className="game-shell janggi-shell">
      <JanggiTopbar onExit={onExit} />
      <section className="game-content">
        <div className="game-info-panel">
          <div>
            <span className="eyebrow">KOREAN CHESS</span>
            <h1>궁을 지키고<br />외통을 만드세요</h1>
            <p>초 진영으로 먼저 시작합니다. 기물의 길을 열고 상대 궁이 피할 수 없는 장군을 만드세요.</p>
          </div>
          <div className="mode-switch" aria-label="대전 모드">
            <button className="active"><span className="bot-face">•ᴗ•</span>초급 AI</button>
            <button disabled><span>♙</span>친구 대전<small>준비 중</small></button>
          </div>
          <div className="janggi-score-card">
            <div className={turn === "cho" && !winner ? "active" : ""}>
              <span className="side-seal cho">楚</span>
              <strong>초 · 나</strong>
              <small>기물 {choCount}</small>
            </div>
            <b>第 {moveNumber} 手</b>
            <div className={turn === "han" && !winner ? "active" : ""}>
              <span className="side-seal han">漢</span>
              <strong>한 · AI</strong>
              <small>기물 {hanCount}</small>
            </div>
          </div>
        </div>

        <div className="board-panel janggi-panel">
          <div className="board-status" role="status">
            <span className={`janggi-status-icon ${turn}`}>{turn === "cho" ? "楚" : "漢"}</span>
            <strong>{status}</strong>
            <span>{notice}</span>
          </div>

          <div className="janggi-frame">
            <div className="janggi-board" role="grid" aria-label="9 곱하기 10 장기판">
              <span className="palace-lines top" aria-hidden="true" />
              <span className="palace-lines bottom" aria-hidden="true" />
              {board.map((piece, index) => {
                const selectable = piece?.side === "cho" && moves.some((move) => move.from === index);
                const destination = destinations.has(index);
                const isSelected = selected === index;
                const isOpponentFrom = lastAiPieceAlive && lastAiMove?.from === index;
                const isOpponentTo = lastAiPieceAlive && lastAiMove?.to === index;
                return (
                  <button
                    key={index}
                    onClick={() => play(index)}
                    disabled={turn !== "cho" || Boolean(winner) || (!selectable && !destination)}
                    className={`${destination ? "destination" : ""} ${isSelected ? "selected" : ""} ${isOpponentFrom ? "opponent-from" : ""} ${isOpponentTo ? "opponent-to" : ""}`}
                    role="gridcell"
                    aria-label={`${rowOf(index) + 1}행 ${colOf(index) + 1}열${piece ? ` ${piece.side === "cho" ? "초" : "한"} ${PIECE_NAME[piece.type]}` : destination ? " 이동 가능" : ""}${isOpponentFrom ? " AI의 최근 출발 위치" : isOpponentTo ? " AI가 최근 이동한 위치" : ""}`}
                  >
                    {piece && (
                      <span className={`janggi-piece ${piece.side} type-${piece.type.toLowerCase()}`}>
                        {PIECE_LABEL[piece.side][piece.type]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <section className="janggi-captured-panel" aria-label="잡힌 기물">
            <header>
              <div>
                <strong>잡힌 기물</strong>
                <span>최근에 잡힌 말부터 확인할 수 있습니다</span>
              </div>
              {hasMoreCaptured && (
                <button
                  onClick={() => setShowAllCaptured((visible) => !visible)}
                  aria-expanded={showAllCaptured}
                >
                  {showAllCaptured ? "최근만 보기" : "전체 보기"}
                  <span aria-hidden="true">{showAllCaptured ? "⌃" : "⌄"}</span>
                </button>
              )}
            </header>
            <div className="janggi-captured-row">
              <div className="janggi-captured-owner">
                <span className="cho">楚</span>
                <strong>내가 잃은 말</strong>
              </div>
              <div className="janggi-captured-pieces">
                {visibleCapturedCho.length ? visibleCapturedCho.map((piece, index) => (
                  <span
                    key={`cho-${capturedCho.length - visibleCapturedCho.length + index}`}
                    className={`captured-piece cho type-${piece.type.toLowerCase()}`}
                    title={`초 ${PIECE_NAME[piece.type]}`}
                    aria-label={`잡힌 초 ${PIECE_NAME[piece.type]}`}
                  >
                    {PIECE_LABEL.cho[piece.type]}
                  </span>
                )) : <small>아직 없음</small>}
                {hiddenCapturedCho > 0 && <b>+{hiddenCapturedCho}</b>}
              </div>
            </div>
            <div className="janggi-captured-row">
              <div className="janggi-captured-owner">
                <span className="han">漢</span>
                <strong>AI가 잃은 말</strong>
              </div>
              <div className="janggi-captured-pieces">
                {visibleCapturedHan.length ? visibleCapturedHan.map((piece, index) => (
                  <span
                    key={`han-${capturedHan.length - visibleCapturedHan.length + index}`}
                    className={`captured-piece han type-${piece.type.toLowerCase()}`}
                    title={`한 ${PIECE_NAME[piece.type]}`}
                    aria-label={`잡힌 한 ${PIECE_NAME[piece.type]}`}
                  >
                    {PIECE_LABEL.han[piece.type]}
                  </span>
                )) : <small>아직 없음</small>}
                {hiddenCapturedHan > 0 && <b>+{hiddenCapturedHan}</b>}
              </div>
            </div>
          </section>

          <div className="game-actions janggi-actions">
            <button className="text-action" onClick={reset}>↻ 새 대국</button>
            <button className="pass-action" onClick={pass} disabled={turn !== "cho" || Boolean(winner) || choChecked}>한 수 쉼</button>
            <span className="game-hint">기물을 선택하면 이동할 수 있는 교차점이 표시됩니다</span>
            {winner && <button className="primary-action" onClick={reset}>다시 대국</button>}
          </div>
        </div>
      </section>
    </main>
  );
}
