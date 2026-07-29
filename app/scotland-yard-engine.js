export const SY_MAX_ROUNDS = 22;
export const SY_REVEAL_MOVES = Object.freeze([3, 8, 13, 18, 24]);

export const SY_TRANSPORTS = Object.freeze({
  taxi: { id: "taxi", label: "택시", color: "#e6b84c", icon: "T" },
  bus: { id: "bus", label: "버스", color: "#4d9d73", icon: "B" },
  underground: { id: "underground", label: "지하철", color: "#d75358", icon: "U" },
  ferry: { id: "ferry", label: "수상 이동", color: "#5b86c5", icon: "F" },
  black: { id: "black", label: "검은 티켓", color: "#27313b", icon: "?" },
});

const COLS = 12;
const ROWS = 8;

function nodeId(row, column) {
  return row * COLS + column + 1;
}

export const SY_NODES = Object.freeze(
  Array.from({ length: ROWS * COLS }, (_, index) => {
    const row = Math.floor(index / COLS);
    const column = index % COLS;
    const x = 5.2 + column * 8.15 + (row % 2 ? 0.8 : 0);
    const y = 7.2 + row * 12.2 + ((column % 3) - 1) * 0.65;
    return Object.freeze({
      id: index + 1,
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
      district: row < 2 ? "북부" : row < 4 ? "서부" : row < 6 ? "중앙" : "남부",
    });
  }),
);

function edgeKey(a, b, transport) {
  return `${Math.min(a, b)}-${Math.max(a, b)}-${transport}`;
}

function createEdges() {
  const edges = [];
  const seen = new Set();
  const add = (a, b, transport) => {
    if (!a || !b || a === b) return;
    const key = edgeKey(a, b, transport);
    if (seen.has(key)) return;
    seen.add(key);
    edges.push(Object.freeze({ a, b, transport }));
  };

  // 촘촘한 골목길. 강을 가로지르는 세로 길은 다리 위치에만 둔다.
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLS; column += 1) {
      const current = nodeId(row, column);
      if (column < COLS - 1) add(current, nodeId(row, column + 1), "taxi");
      if (row < ROWS - 1) {
        const crossesRiver = row === 3;
        if (!crossesRiver || [1, 4, 7, 10].includes(column)) {
          add(current, nodeId(row + 1, column), "taxi");
        }
      }
    }
  }

  // 간선이 드문 간선도로. 택시보다 빠르지만 모든 역에 정차하지 않는다.
  for (const row of [0, 2, 5, 7]) {
    for (let column = 0; column < COLS - 2; column += 2) {
      add(nodeId(row, column), nodeId(row, column + 2), "bus");
    }
  }
  for (const column of [1, 4, 7, 10]) {
    for (let row = 0; row < ROWS - 2; row += 2) {
      add(nodeId(row, column), nodeId(row + 2, column), "bus");
    }
  }
  [
    [nodeId(1, 0), nodeId(3, 2)],
    [nodeId(1, 5), nodeId(3, 7)],
    [nodeId(3, 3), nodeId(5, 5)],
    [nodeId(4, 9), nodeId(6, 11)],
  ].forEach(([a, b]) => add(a, b, "bus"));

  // 환승 거점만 잇는 지하철.
  [
    [nodeId(0, 1), nodeId(2, 4)],
    [nodeId(2, 4), nodeId(4, 7)],
    [nodeId(4, 7), nodeId(7, 10)],
    [nodeId(0, 10), nodeId(2, 7)],
    [nodeId(2, 7), nodeId(4, 4)],
    [nodeId(4, 4), nodeId(7, 1)],
    [nodeId(1, 5), nodeId(4, 1)],
    [nodeId(1, 5), nodeId(6, 8)],
  ].forEach(([a, b]) => add(a, b, "underground"));

  // 미스터 X만 검은 티켓으로 이용할 수 있는 강 노선.
  [
    [nodeId(3, 0), nodeId(4, 3)],
    [nodeId(3, 3), nodeId(4, 6)],
    [nodeId(3, 6), nodeId(4, 9)],
    [nodeId(3, 9), nodeId(4, 11)],
  ].forEach(([a, b]) => add(a, b, "ferry"));

  return Object.freeze(edges);
}

export const SY_EDGES = createEdges();

export const SY_DETECTIVE_STARTS = Object.freeze([
  1, 8, 12, 25, 36, 61, 72, 85, 89, 96,
]);
export const SY_X_STARTS = Object.freeze([
  16, 20, 30, 34, 43, 54, 63, 67, 78, 81,
]);

const adjacency = new Map(SY_NODES.map((node) => [node.id, []]));
for (const edge of SY_EDGES) {
  adjacency.get(edge.a).push({ to: edge.b, transport: edge.transport });
  adjacency.get(edge.b).push({ to: edge.a, transport: edge.transport });
}

export function syEdgesFrom(id, allowFerry = true) {
  return (adjacency.get(id) ?? []).filter((edge) => allowFerry || edge.transport !== "ferry");
}

function hasTicket(tickets, transport) {
  return Number(tickets?.[transport] ?? 0) > 0;
}

export function syLegalMoves(
  id,
  {
    tickets = {},
    occupied = [],
    isBobby = false,
    isMrX = false,
    blackTickets = 0,
  } = {},
) {
  const occupiedSet = new Set(occupied);
  return syEdgesFrom(id, isMrX)
    .filter((edge) => !occupiedSet.has(edge.to))
    .filter((edge) => {
      if (isBobby) return edge.transport !== "ferry";
      if (isMrX) {
        return edge.transport === "ferry" ? blackTickets > 0 : true;
      }
      return edge.transport !== "ferry" && hasTicket(tickets, edge.transport);
    });
}

export function syAdvanceCandidates(candidates, observedTransport, occupied = []) {
  const occupiedSet = new Set(occupied);
  const result = new Set();
  for (const candidate of candidates) {
    for (const edge of syEdgesFrom(candidate, observedTransport === "black")) {
      if (occupiedSet.has(edge.to)) continue;
      if (observedTransport === "black" || edge.transport === observedTransport) {
        result.add(edge.to);
      }
    }
  }
  return [...result].sort((a, b) => a - b);
}

export function syShortestDistance(start, targets, allowFerry = false) {
  const targetSet = new Set(targets);
  if (targetSet.has(start)) return 0;
  const queue = [{ id: start, distance: 0 }];
  const visited = new Set([start]);

  while (queue.length) {
    const current = queue.shift();
    for (const edge of syEdgesFrom(current.id, allowFerry)) {
      if (visited.has(edge.to)) continue;
      if (targetSet.has(edge.to)) return current.distance + 1;
      visited.add(edge.to);
      queue.push({ id: edge.to, distance: current.distance + 1 });
    }
  }
  return Number.POSITIVE_INFINITY;
}

function moveScore(move, detectiveNodes, difficulty, random) {
  const distance = syShortestDistance(move.to, detectiveNodes, true);
  const exits = syEdgesFrom(move.to, true).length;
  const hubBonus = syEdgesFrom(move.to, true).filter((edge) => edge.transport !== "taxi").length;
  const ferryBonus = move.transport === "ferry" ? 2 : 0;
  const noise = difficulty === "rookie" ? random() * 6 : random() * 1.4;
  return distance * 7 + exits * 1.5 + hubBonus + ferryBonus + noise;
}

export function syChooseMrXMove({
  node,
  detectiveNodes,
  difficulty = "inspector",
  blackTickets = 0,
  random = Math.random,
}) {
  const legal = syLegalMoves(node, {
    occupied: detectiveNodes,
    isMrX: true,
    blackTickets,
  });
  if (!legal.length) return null;
  return [...legal].sort(
    (a, b) =>
      moveScore(b, detectiveNodes, difficulty, random) -
      moveScore(a, detectiveNodes, difficulty, random),
  )[0];
}

export function syShouldUseBlack({
  move,
  candidates,
  detectiveNodes,
  blackTickets,
}) {
  if (!move || blackTickets <= 0) return false;
  if (move.transport === "ferry") return true;
  const visible = syAdvanceCandidates(candidates, move.transport, detectiveNodes);
  const hidden = syAdvanceCandidates(candidates, "black", detectiveNodes);
  return visible.length <= 4 && hidden.length >= visible.length + 3;
}

export function syShouldDouble({
  node,
  detectiveNodes,
  moveNumber,
  doubleTickets,
}) {
  if (doubleTickets <= 0 || moveNumber >= 23) return false;
  const danger = syShortestDistance(node, detectiveNodes, false);
  return danger <= 2 && !SY_REVEAL_MOVES.includes(moveNumber + 1);
}

function sampleWithoutReplacement(values, count, random) {
  const pool = [...values];
  const result = [];
  while (pool.length && result.length < count) {
    result.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return result;
}

export function syCreateInitialState(random = Math.random) {
  const starts = sampleWithoutReplacement(SY_DETECTIVE_STARTS, 4, random);
  const blocked = new Set(starts);
  const xPool = SY_X_STARTS.filter((id) => !blocked.has(id));
  const mrX = xPool[Math.floor(random() * xPool.length)];
  return {
    round: 1,
    moveNumber: 0,
    phase: "ai",
    winner: null,
    message: "미스터 X가 첫 이동을 준비합니다.",
    selectedId: null,
    movedIds: [],
    detectives: [
      { id: "d1", name: "셜록", node: starts[0], kind: "detective", tickets: { taxi: 11, bus: 8, underground: 4 } },
      { id: "d2", name: "아이리스", node: starts[1], kind: "detective", tickets: { taxi: 11, bus: 8, underground: 4 } },
      { id: "b1", name: "순경 A", node: starts[2], kind: "bobby", tickets: { taxi: 0, bus: 0, underground: 0 } },
      { id: "b2", name: "순경 B", node: starts[3], kind: "bobby", tickets: { taxi: 0, bus: 0, underground: 0 } },
    ],
    mrX: {
      node: mrX,
      blackTickets: 5,
      doubleTickets: 2,
    },
    candidates: SY_NODES.map((node) => node.id).filter((id) => !blocked.has(id)),
    log: [],
  };
}
