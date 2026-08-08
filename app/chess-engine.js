export const CHESS_SIZE = 8;
export const CHESS_FILES = "abcdefgh";
export const CHESS_PIECE_LABELS = { k: "킹", q: "퀸", r: "룩", b: "비숍", n: "나이트", p: "폰" };
export const CHESS_PIECE_SYMBOLS = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

const BACK_RANK = ["r", "n", "b", "q", "k", "b", "n", "r"];
const otherColor = (color) => color === "w" ? "b" : "w";
const inside = (x, y) => x >= 0 && x < CHESS_SIZE && y >= 0 && y < CHESS_SIZE;
const cloneBoard = (board) => board.map((row) => row.map((piece) => piece ? { ...piece } : null));

export function createChessState() {
  const board = Array.from({ length: CHESS_SIZE }, () => Array(CHESS_SIZE).fill(null));
  for (let x = 0; x < CHESS_SIZE; x += 1) {
    board[0][x] = { color: "b", type: BACK_RANK[x], moved: false };
    board[1][x] = { color: "b", type: "p", moved: false };
    board[6][x] = { color: "w", type: "p", moved: false };
    board[7][x] = { color: "w", type: BACK_RANK[x], moved: false };
  }
  return { board, turn: "w", enPassant: null, halfmove: 0, fullmove: 1 };
}

export function chessSquareName(x, y) {
  return `${CHESS_FILES[x]}${8 - y}`;
}

export function isChessSquareAttacked(board, x, y, byColor) {
  const pawnDirection = byColor === "w" ? -1 : 1;
  const pawnY = y - pawnDirection;
  for (const pawnX of [x - 1, x + 1]) {
    const piece = inside(pawnX, pawnY) ? board[pawnY][pawnX] : null;
    if (piece?.color === byColor && piece.type === "p") return true;
  }
  for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) {
    const piece = inside(x + dx, y + dy) ? board[y + dy][x + dx] : null;
    if (piece?.color === byColor && piece.type === "n") return true;
  }
  for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) {
    if (!dx && !dy) continue;
    const piece = inside(x + dx, y + dy) ? board[y + dy][x + dx] : null;
    if (piece?.color === byColor && piece.type === "k") return true;
  }
  const rays = [
    [1, 0, ["r", "q"]], [-1, 0, ["r", "q"]], [0, 1, ["r", "q"]], [0, -1, ["r", "q"]],
    [1, 1, ["b", "q"]], [1, -1, ["b", "q"]], [-1, 1, ["b", "q"]], [-1, -1, ["b", "q"]],
  ];
  for (const [dx, dy, types] of rays) {
    let nx = x + dx; let ny = y + dy;
    while (inside(nx, ny)) {
      const piece = board[ny][nx];
      if (piece) {
        if (piece.color === byColor && types.includes(piece.type)) return true;
        break;
      }
      nx += dx; ny += dy;
    }
  }
  return false;
}

export function isChessInCheck(state, color = state.turn) {
  for (let y = 0; y < CHESS_SIZE; y += 1) for (let x = 0; x < CHESS_SIZE; x += 1) {
    const piece = state.board[y][x];
    if (piece?.color === color && piece.type === "k") return isChessSquareAttacked(state.board, x, y, otherColor(color));
  }
  return true;
}

function addSlidingMoves(state, moves, from, color, directions) {
  for (const [dx, dy] of directions) {
    let x = from.x + dx; let y = from.y + dy;
    while (inside(x, y)) {
      const target = state.board[y][x];
      if (!target) moves.push({ from, to: { x, y } });
      else {
        if (target.color !== color) moves.push({ from, to: { x, y }, capture: true });
        break;
      }
      x += dx; y += dy;
    }
  }
}

function pseudoMoves(state, x, y) {
  const piece = state.board[y][x];
  if (!piece) return [];
  const from = { x, y };
  const moves = [];
  const pushTarget = (tx, ty, extra = {}) => {
    if (!inside(tx, ty)) return;
    const target = state.board[ty][tx];
    if (!target || target.color !== piece.color) moves.push({ from, to: { x: tx, y: ty }, capture: Boolean(target), ...extra });
  };

  if (piece.type === "p") {
    const direction = piece.color === "w" ? -1 : 1;
    const startRow = piece.color === "w" ? 6 : 1;
    const promotionRow = piece.color === "w" ? 0 : 7;
    if (inside(x, y + direction) && !state.board[y + direction][x]) {
      moves.push({ from, to: { x, y: y + direction }, promotion: y + direction === promotionRow });
      if (y === startRow && !state.board[y + direction * 2][x]) moves.push({ from, to: { x, y: y + direction * 2 }, doublePawn: true });
    }
    for (const tx of [x - 1, x + 1]) {
      const ty = y + direction;
      if (!inside(tx, ty)) continue;
      const target = state.board[ty][tx];
      if (target && target.color !== piece.color) moves.push({ from, to: { x: tx, y: ty }, capture: true, promotion: ty === promotionRow });
      else if (state.enPassant?.x === tx && state.enPassant?.y === ty) moves.push({ from, to: { x: tx, y: ty }, capture: true, enPassant: true });
    }
  } else if (piece.type === "n") {
    for (const [dx, dy] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) pushTarget(x + dx, y + dy);
  } else if (piece.type === "b") addSlidingMoves(state, moves, from, piece.color, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
  else if (piece.type === "r") addSlidingMoves(state, moves, from, piece.color, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
  else if (piece.type === "q") addSlidingMoves(state, moves, from, piece.color, [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
  else if (piece.type === "k") {
    for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) if (dx || dy) pushTarget(x + dx, y + dy);
    if (!piece.moved && !isChessSquareAttacked(state.board, x, y, otherColor(piece.color))) {
      const tryCastle = (rookX, throughX, destinationX, emptySquares, castle) => {
        const rook = state.board[y][rookX];
        if (rook?.type !== "r" || rook.color !== piece.color || rook.moved || emptySquares.some((emptyX) => state.board[y][emptyX])) return;
        if (isChessSquareAttacked(state.board, throughX, y, otherColor(piece.color)) || isChessSquareAttacked(state.board, destinationX, y, otherColor(piece.color))) return;
        moves.push({ from, to: { x: destinationX, y }, castle });
      };
      tryCastle(7, 5, 6, [5, 6], "king");
      tryCastle(0, 3, 2, [1, 2, 3], "queen");
    }
  }
  return moves;
}

function applyMoveUnchecked(state, move, promotion = "q") {
  const board = cloneBoard(state.board);
  const piece = { ...board[move.from.y][move.from.x], moved: true };
  const captured = board[move.to.y][move.to.x];
  board[move.from.y][move.from.x] = null;
  if (move.enPassant) {
    const direction = piece.color === "w" ? -1 : 1;
    board[move.to.y - direction][move.to.x] = null;
  }
  if (move.promotion) piece.type = promotion;
  board[move.to.y][move.to.x] = piece;
  if (move.castle) {
    const rookFromX = move.castle === "king" ? 7 : 0;
    const rookToX = move.castle === "king" ? 5 : 3;
    board[move.to.y][rookToX] = { ...board[move.to.y][rookFromX], moved: true };
    board[move.to.y][rookFromX] = null;
  }
  const pawnMove = piece.type === "p" || move.promotion;
  return {
    ...state,
    board,
    turn: otherColor(piece.color),
    enPassant: move.doublePawn ? { x: move.from.x, y: (move.from.y + move.to.y) / 2 } : null,
    halfmove: pawnMove || captured || move.enPassant ? 0 : state.halfmove + 1,
    fullmove: piece.color === "b" ? state.fullmove + 1 : state.fullmove,
  };
}

export function chessLegalMoves(state, color = state.turn) {
  const view = color === state.turn ? state : { ...state, turn: color };
  const moves = [];
  for (let y = 0; y < CHESS_SIZE; y += 1) for (let x = 0; x < CHESS_SIZE; x += 1) {
    const piece = view.board[y][x];
    if (piece?.color !== color) continue;
    for (const move of pseudoMoves(view, x, y)) {
      const next = applyMoveUnchecked(view, move);
      if (!isChessInCheck(next, color)) moves.push(move);
    }
  }
  return moves;
}

export function applyChessMove(state, move, promotion = "q") {
  return applyMoveUnchecked(state, move, promotion);
}

export function chessGameStatus(state) {
  const moves = chessLegalMoves(state);
  const check = isChessInCheck(state);
  if (moves.length) return { phase: "playing", check, winner: null };
  if (check) return { phase: "checkmate", check: true, winner: otherColor(state.turn) };
  return { phase: "stalemate", check: false, winner: null };
}

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
function evaluateForBlack(state) {
  const status = chessGameStatus(state);
  if (status.phase === "checkmate") return status.winner === "b" ? 100000 : -100000;
  let score = 0;
  for (let y = 0; y < CHESS_SIZE; y += 1) for (let x = 0; x < CHESS_SIZE; x += 1) {
    const piece = state.board[y][x];
    if (!piece) continue;
    const center = 7 - (Math.abs(3.5 - x) + Math.abs(3.5 - y));
    const value = PIECE_VALUES[piece.type] + (piece.type === "p" || piece.type === "n" || piece.type === "b" ? center * 2 : 0);
    score += piece.color === "b" ? value : -value;
  }
  return score;
}

export function chooseChessAiMove(state, random = Math.random) {
  const moves = chessLegalMoves(state, "b");
  if (!moves.length) return null;
  const scored = moves.map((move) => {
    const next = applyMoveUnchecked(state, move);
    const status = chessGameStatus(next);
    if (status.phase === "checkmate") return { move, value: 100000 };
    const replies = chessLegalMoves(next, "w");
    let value = evaluateForBlack(next);
    if (replies.length) value = Math.min(...replies.map((reply) => evaluateForBlack(applyMoveUnchecked(next, reply))));
    if (move.capture) value += 12;
    return { move, value };
  }).sort((a, b) => b.value - a.value);
  const candidates = scored.filter((entry) => entry.value >= scored[0].value - 18).slice(0, 3);
  return candidates[Math.floor(random() * candidates.length)].move;
}

export function chessMoveDescription(state, move, promotion = "q") {
  const piece = state.board[move.from.y][move.from.x];
  if (move.castle) return move.castle === "king" ? "킹사이드 캐슬링" : "퀸사이드 캐슬링";
  const capture = move.capture ? " 잡기" : " 이동";
  const promoted = move.promotion ? ` · ${CHESS_PIECE_LABELS[promotion]} 승격` : "";
  return `${CHESS_PIECE_LABELS[piece.type]} ${chessSquareName(move.from.x, move.from.y)}→${chessSquareName(move.to.x, move.to.y)}${capture}${promoted}`;
}

