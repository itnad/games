export const BATTLESHIP_SEA_SIZE = 10;
export const BATTLESHIP_SHIP_LENGTHS = [5, 4, 3, 3, 2];

export function createBattleshipFleet(random = Math.random) {
  const cells = new Set();
  const ships = [];
  for (const length of BATTLESHIP_SHIP_LENGTHS) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 10000) {
      const horizontal = random() >= 0.5;
      const row = Math.floor(random() * (horizontal ? BATTLESHIP_SEA_SIZE : BATTLESHIP_SEA_SIZE - length + 1));
      const col = Math.floor(random() * (horizontal ? BATTLESHIP_SEA_SIZE - length + 1 : BATTLESHIP_SEA_SIZE));
      const ship = Array.from({ length }, (_, offset) =>
        (row + (horizontal ? 0 : offset)) * BATTLESHIP_SEA_SIZE + col + (horizontal ? offset : 0),
      );
      if (ship.every((cell) => !cells.has(cell))) {
        ship.forEach((cell) => cells.add(cell));
        ships.push(ship);
        placed = true;
      }
      attempts += 1;
    }
    if (!placed) throw new Error("함대를 배치할 수 없습니다.");
  }
  return { cells, ships };
}

export function battleshipRemainingShips(fleet, shots) {
  return fleet.ships.filter((ship) => !ship.every((cell) => shots.has(cell))).length;
}

export function checkerOwner(piece) {
  if (piece === 1 || piece === 3) return 1;
  if (piece === 2 || piece === 4) return 2;
  return 0;
}

export function checkerMoves(board, player, onlyFrom) {
  const captures = [];
  const normals = [];
  board.forEach((piece, from) => {
    if (checkerOwner(piece) !== player || (onlyFrom !== undefined && from !== onlyFrom)) return;
    const row = Math.floor(from / 8);
    const col = from % 8;
    const rows = piece >= 3 ? [-1, 1] : player === 1 ? [-1] : [1];
    for (const dr of rows) {
      for (const dc of [-1, 1]) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
        const near = r * 8 + c;
        if (board[near] === 0) {
          normals.push({ from, to: near });
        } else if (checkerOwner(board[near]) === (player === 1 ? 2 : 1)) {
          const jumpR = row + dr * 2;
          const jumpC = col + dc * 2;
          if (jumpR >= 0 && jumpR < 8 && jumpC >= 0 && jumpC < 8 && board[jumpR * 8 + jumpC] === 0) {
            captures.push({ from, to: jumpR * 8 + jumpC, capture: near });
          }
        }
      }
    }
  });
  return captures.length ? captures : normals;
}

export function applyCheckerMove(board, move) {
  const next = [...board];
  let piece = next[move.from];
  const wasKing = piece >= 3;
  next[move.from] = 0;
  if (move.capture !== undefined) next[move.capture] = 0;
  const row = Math.floor(move.to / 8);
  if (piece === 1 && row === 0) piece = 3;
  if (piece === 2 && row === 7) piece = 4;
  next[move.to] = piece;
  return { board: next, crowned: !wasKing && piece >= 3 };
}

export function checkersWinner(board) {
  const playerPieces = board.filter((piece) => checkerOwner(piece) === 1).length;
  const aiPieces = board.filter((piece) => checkerOwner(piece) === 2).length;
  if (!playerPieces || !checkerMoves(board, 1).length) return 2;
  if (!aiPieces || !checkerMoves(board, 2).length) return 1;
  return 0;
}
