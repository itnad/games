export const SD_SPACE_ROUTE_LENGTH = 32;

export const SD_SPACE_BASES = [
  { id: "luna", name: "루나 기지", position: 2, hp: 120, points: 2 },
  { id: "side3", name: "사이드 3", position: 5, hp: 150, points: 3 },
  { id: "axis", name: "액시즈", position: 8, hp: 180, points: 4 },
  { id: "solomon", name: "솔로몬", position: 11, hp: 210, points: 5 },
  { id: "jaburo", name: "자브로", position: 14, hp: 240, points: 6 },
  { id: "a-baoa-qu", name: "아 바오아 쿠", position: 18, hp: 270, points: 7 },
  { id: "moon2", name: "문 2", position: 21, hp: 300, points: 8 },
  { id: "granada", name: "그라나다", position: 24, hp: 330, points: 9 },
  { id: "colony", name: "콜로니", position: 27, hp: 360, points: 10 },
  { id: "earth", name: "지구 연방", position: 30, hp: 400, points: 12 },
];

export const SD_SPACE_SPECIALS = {
  service: [6, 16, 26],
  duel: [4, 12, 20, 28],
  event: [9, 23],
};

const BATTLE_VALUES = [
  40, 40, 50, 50, 60, 60, 70, 70, 80, 80, 90, 90,
  100, 100, 110, 110, 120, 120, 130, 130, 140, 140, 150, 150,
  160, 160, 170, 180, 190, 200, 210, 220, 230, 240, 260, 300,
];

export function sdShuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function sdCreateBattleDeck(random = Math.random) {
  return sdShuffle(
    BATTLE_VALUES.map((hp, index) => ({
      id: `battle-${index}`,
      name: hp >= 220 ? "결전 병기" : hp >= 150 ? "에이스 기체" : hp >= 90 ? "전투 기체" : "지원 기체",
      hp,
    })),
    random,
  );
}

export function sdDrawCards(deck, discard, count, random = Math.random) {
  const nextDeck = [...deck];
  const nextDiscard = [...discard];
  const cards = [];
  while (cards.length < count) {
    if (!nextDeck.length) {
      if (!nextDiscard.length) break;
      nextDeck.push(...sdShuffle(nextDiscard.splice(0), random));
    }
    cards.push(nextDeck.shift());
  }
  return { cards, deck: nextDeck, discard: nextDiscard };
}

export function sdSpaceKind(position) {
  if (position === 0) return "start";
  if (SD_SPACE_BASES.some((base) => base.position === position)) return "base";
  if (SD_SPACE_SPECIALS.service.includes(position)) return "service";
  if (SD_SPACE_SPECIALS.duel.includes(position)) return "duel";
  if (SD_SPACE_SPECIALS.event.includes(position)) return "event";
  return "route";
}

export function sdCaptureResult(cards, base, bonus = 0) {
  const total = cards.reduce((sum, card) => sum + card.hp, 0) + bonus;
  return { total, success: total > base.hp };
}

export function sdDuelResult(firstCard, secondCard, firstBonus = 0, secondBonus = 0) {
  const first = firstCard.hp + firstBonus;
  const second = secondCard.hp + secondBonus;
  return {
    first,
    second,
    winner: first === second ? null : first > second ? 0 : 1,
  };
}

export function sdCreateSpaceGame(playerCount = 2, random = Math.random) {
  const deck = sdCreateBattleDeck(random);
  const colors = ["#ec665d", "#55aee1", "#f1c34f", "#69b987", "#a783dc", "#e68e42"];
  const names = ["나", "AI 루나", "AI 액시즈", "AI 솔로몬", "AI 자브로", "AI 그라나다"];
  const players = Array.from({ length: playerCount }, (_, id) => ({
    id,
    name: names[id],
    color: colors[id],
    position: 0,
    hand: deck.splice(0, 3),
    bases: [],
    skip: false,
  }));
  return {
    players,
    deck,
    discard: [],
    bases: SD_SPACE_BASES.map((base) => ({ ...base, owner: null })),
    current: 0,
    turn: 1,
    log: ["우주 기지 쟁탈전이 시작되었습니다."],
    winner: null,
  };
}

export const SD_FORTRESS_SIZE = 9;
export const SD_FORTRESS_OBSTACLES = [[4, 4], [2, 4], [6, 4]];
export const SD_FORTRESS_CANNONS = [[4, 0], [4, 8]];
export const SD_FORTRESS_BONUSES = [
  { row: 1, column: 2, value: 20 },
  { row: 1, column: 6, value: 30 },
  { row: 7, column: 2, value: 30 },
  { row: 7, column: 6, value: 20 },
];

function samePosition(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

export function sdFortressCreateGame(playerCount = 2, random = Math.random) {
  const positions = [
    Array.from({ length: 9 }, (_, column) => [8, column]),
    Array.from({ length: 9 }, (_, column) => [0, column]),
    [...Array.from({ length: 7 }, (_, index) => [index + 1, 0]), [3, 1], [5, 1]],
    [...Array.from({ length: 7 }, (_, index) => [index + 1, 8]), [3, 7], [5, 7]],
  ];
  return {
    pieces: positions.slice(0, playerCount).flatMap((sidePositions, side) =>
      sidePositions.map((position, index) => ({ id: `${side}-${index}`, side, position, alive: true })),
    ),
    playerCount,
    deck: sdCreateBattleDeck(random),
    discard: [],
    current: 0,
    round: 1,
    winner: null,
    log: ["양 진영의 SD 부대가 요새에 배치되었습니다."],
  };
}

export function sdFortressBonus(position) {
  return SD_FORTRESS_BONUSES.find(
    (tile) => tile.row === position[0] && tile.column === position[1],
  )?.value ?? 0;
}

export function sdFortressReachable(game, pieceId, distance = 5) {
  const piece = game.pieces.find((item) => item.id === pieceId && item.alive);
  if (!piece) return [];
  const obstacleKeys = new Set(SD_FORTRESS_OBSTACLES.map(([row, column]) => `${row}-${column}`));
  const ownKeys = new Set(
    game.pieces
      .filter((item) => item.alive && item.side === piece.side && item.id !== piece.id)
      .map((item) => `${item.position[0]}-${item.position[1]}`),
  );
  const result = [];
  const queue = [{ position: piece.position, steps: 0 }];
  const seen = new Set([`${piece.position[0]}-${piece.position[1]}`]);
  while (queue.length) {
    const current = queue.shift();
    if (current.steps > 0) result.push(current.position);
    if (current.steps === distance) continue;
    for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next = [current.position[0] + dr, current.position[1] + dc];
      const key = `${next[0]}-${next[1]}`;
      if (
        next[0] < 0 || next[0] >= SD_FORTRESS_SIZE ||
        next[1] < 0 || next[1] >= SD_FORTRESS_SIZE ||
        seen.has(key) || obstacleKeys.has(key) || ownKeys.has(key)
      ) continue;
      seen.add(key);
      queue.push({ position: next, steps: current.steps + 1 });
    }
  }
  return result;
}

export function sdFortressCannonCells(position, direction, range) {
  const deltas = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
  const delta = deltas[direction];
  if (!delta) return [];
  const cells = [];
  for (let step = 1; step <= range; step += 1) {
    const next = [position[0] + delta[0] * step, position[1] + delta[1] * step];
    if (next[0] < 0 || next[0] >= SD_FORTRESS_SIZE || next[1] < 0 || next[1] >= SD_FORTRESS_SIZE) break;
    if (SD_FORTRESS_OBSTACLES.some((item) => samePosition(item, next))) break;
    cells.push(next);
  }
  return cells;
}

export function sdFortressResolveBattle(attackerCard, defenderCard, attackerPosition, defenderPosition) {
  const attack = attackerCard.hp + sdFortressBonus(attackerPosition);
  const defense = defenderCard.hp + sdFortressBonus(defenderPosition);
  return { attack, defense, winner: attack === defense ? null : attack > defense ? 0 : 1 };
}
