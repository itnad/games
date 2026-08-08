export const TETRIS_WIDTH = 10;
export const TETRIS_HEIGHT = 20;
export const TETRIS_TYPES = ["I", "J", "L", "O", "S", "T", "Z"];

const BASE_CELLS = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
};

export function createTetrisBoard() {
  return Array.from({ length: TETRIS_HEIGHT }, () => Array(TETRIS_WIDTH).fill(null));
}

export function tetrisShape(type, rotation = 0) {
  let cells = BASE_CELLS[type].map(([x, y]) => [x, y]);
  if (type === "O") return cells;
  for (let turn = 0; turn < ((rotation % 4) + 4) % 4; turn += 1) {
    cells = cells.map(([x, y]) => [3 - y, x]);
    const minX = Math.min(...cells.map(([x]) => x));
    const minY = Math.min(...cells.map(([, y]) => y));
    cells = cells.map(([x, y]) => [x - minX, y - minY]);
  }
  return cells;
}

export function tetrisPieceCells(piece) {
  return tetrisShape(piece.type, piece.rotation).map(([x, y]) => [piece.x + x, piece.y + y]);
}

export function canPlaceTetrisPiece(board, piece) {
  return tetrisPieceCells(piece).every(([x, y]) => x >= 0 && x < TETRIS_WIDTH && y < TETRIS_HEIGHT && (y < 0 || !board[y][x]));
}

export function lockTetrisPiece(board, piece) {
  const next = board.map((row) => [...row]);
  for (const [x, y] of tetrisPieceCells(piece)) {
    if (y >= 0) next[y][x] = piece.type;
  }
  return next;
}

export function clearTetrisLines(board) {
  const remaining = board.filter((row) => row.some((cell) => !cell));
  const cleared = TETRIS_HEIGHT - remaining.length;
  return {
    board: [...Array.from({ length: cleared }, () => Array(TETRIS_WIDTH).fill(null)), ...remaining],
    cleared,
  };
}

export function tetrisLineScore(cleared, level) {
  return ([0, 100, 300, 500, 800][cleared] ?? 0) * level;
}

export function tetrisDropDelay(level) {
  return Math.max(90, 760 - (level - 1) * 62);
}

export function shuffleTetrisBag(random = Math.random) {
  const bag = [...TETRIS_TYPES];
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [bag[index], bag[swap]] = [bag[swap], bag[index]];
  }
  return bag;
}

