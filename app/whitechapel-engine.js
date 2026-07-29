export const WC_NIGHTS = Object.freeze([
  { night: 1, date: "1888년 8월 31일", women: 8, marked: 5, kills: 1, coaches: 3, alleys: 2, maxMoves: 15 },
  { night: 2, date: "1888년 9월 8일", women: 7, marked: 4, kills: 1, coaches: 2, alleys: 2, maxMoves: 15 },
  { night: 3, date: "1888년 9월 30일", women: 6, marked: 3, kills: 2, coaches: 2, alleys: 1, maxMoves: 15 },
  { night: 4, date: "1888년 11월 9일", women: 4, marked: 1, kills: 1, coaches: 1, alleys: 1, maxMoves: 15 },
]);

const LOCATION_COLS = 12;
const LOCATION_ROWS = 7;
const CROSSING_COLS = 11;
const CROSSING_ROWS = 6;

const districtNames = [
  "SPITALFIELDS",
  "WHITECHAPEL",
  "MILE END",
  "ALDGATE",
  "BETHNAL GREEN",
  "ST. GEORGE",
];

export const WC_LOCATIONS = Object.freeze(
  Array.from({ length: LOCATION_COLS * LOCATION_ROWS }, (_, index) => {
    const row = Math.floor(index / LOCATION_COLS);
    const column = index % LOCATION_COLS;
    return Object.freeze({
      id: index + 1,
      row,
      column,
      x: Number((4.5 + column * 8.25 + (row % 2 ? 0.75 : 0)).toFixed(2)),
      y: Number((7 + row * 14.1 + ((column % 3) - 1) * 0.65).toFixed(2)),
      block: `${Math.floor(row / 2)}-${Math.floor(column / 3)}`,
      district: districtNames[(Math.floor(row / 3) * 3 + Math.floor(column / 4)) % districtNames.length],
    });
  }),
);

export const WC_CROSSINGS = Object.freeze(
  Array.from({ length: CROSSING_COLS * CROSSING_ROWS }, (_, index) => {
    const row = Math.floor(index / CROSSING_COLS);
    const column = index % CROSSING_COLS;
    return Object.freeze({
      id: `c${index + 1}`,
      row,
      column,
      x: Number((9 + column * 8.25 + (row % 2 ? 0.75 : 0)).toFixed(2)),
      y: Number((14 + row * 14.1 + ((column % 3) - 1) * 0.35).toFixed(2)),
    });
  }),
);

function crossingId(row, column) {
  if (row < 0 || row >= CROSSING_ROWS || column < 0 || column >= CROSSING_COLS) return null;
  return `c${row * CROSSING_COLS + column + 1}`;
}

function locationId(row, column) {
  if (row < 0 || row >= LOCATION_ROWS || column < 0 || column >= LOCATION_COLS) return null;
  return row * LOCATION_COLS + column + 1;
}

const links = [];
for (const crossing of WC_CROSSINGS) {
  for (const [row, column] of [
    [crossing.row, crossing.column],
    [crossing.row, crossing.column + 1],
    [crossing.row + 1, crossing.column],
    [crossing.row + 1, crossing.column + 1],
  ]) {
    const location = locationId(row, column);
    if (location) links.push(Object.freeze({ crossing: crossing.id, location }));
  }
}
export const WC_STREET_LINKS = Object.freeze(links);

const crossingEdges = [];
for (const crossing of WC_CROSSINGS) {
  const right = crossingId(crossing.row, crossing.column + 1);
  const down = crossingId(crossing.row + 1, crossing.column);
  if (right) crossingEdges.push(Object.freeze({ a: crossing.id, b: right }));
  if (down) crossingEdges.push(Object.freeze({ a: crossing.id, b: down }));
}
export const WC_CROSSING_EDGES = Object.freeze(crossingEdges);

export const WC_VICTIM_SITES = Object.freeze([
  2, 7, 11, 14, 20, 24, 27, 31, 36, 39, 43, 48, 51, 56, 60, 63, 68, 72, 77, 82,
]);
export const WC_PATROL_STARTS = Object.freeze([
  "c2", "c7", "c11", "c17", "c22", "c29", "c34", "c40", "c45", "c52", "c57", "c63",
]);
export const WC_HIDEOUT_SITES = Object.freeze([
  4, 9, 16, 19, 26, 33, 37, 45, 50, 58, 64, 69, 75, 80,
]);

const linksByLocation = new Map(WC_LOCATIONS.map((location) => [location.id, []]));
const linksByCrossing = new Map(WC_CROSSINGS.map((crossing) => [crossing.id, []]));
for (const link of WC_STREET_LINKS) {
  linksByLocation.get(link.location).push(link.crossing);
  linksByCrossing.get(link.crossing).push(link.location);
}

const crossingAdjacency = new Map(WC_CROSSINGS.map((crossing) => [crossing.id, []]));
for (const edge of WC_CROSSING_EDGES) {
  crossingAdjacency.get(edge.a).push(edge.b);
  crossingAdjacency.get(edge.b).push(edge.a);
}

export function wcAdjacentLocations(crossingIdValue) {
  return [...(linksByCrossing.get(crossingIdValue) ?? [])];
}

export function wcSharedCrossings(from, to) {
  const fromCrossings = new Set(linksByLocation.get(from) ?? []);
  return (linksByLocation.get(to) ?? []).filter((crossing) => fromCrossings.has(crossing));
}

export function wcJackNormalMoves(location, policeCrossings = [], ignorePolice = false) {
  const blocked = new Set(policeCrossings);
  const result = new Set();
  for (const crossing of linksByLocation.get(location) ?? []) {
    if (!ignorePolice && blocked.has(crossing)) continue;
    for (const destination of linksByCrossing.get(crossing) ?? []) {
      if (destination !== location) result.add(destination);
    }
  }
  return [...result].sort((a, b) => a - b);
}

export function wcAlleyMoves(location) {
  const current = WC_LOCATIONS[location - 1];
  if (!current) return [];
  return WC_LOCATIONS
    .filter((candidate) => candidate.block === current.block && candidate.id !== location)
    .map((candidate) => candidate.id);
}

export function wcPoliceMoves(start, occupied = [], maxDistance = 2) {
  const blocked = new Set(occupied.filter((id) => id !== start));
  const result = new Map([[start, 0]]);
  const queue = [{ id: start, distance: 0 }];
  while (queue.length) {
    const current = queue.shift();
    if (current.distance >= maxDistance) continue;
    for (const next of crossingAdjacency.get(current.id) ?? []) {
      if (blocked.has(next) || result.has(next)) continue;
      result.set(next, current.distance + 1);
      queue.push({ id: next, distance: current.distance + 1 });
    }
  }
  return [...result.entries()].map(([id, distance]) => ({ id, distance }));
}

export function wcLocationDistance(start, targets, policeCrossings = [], ignorePolice = false) {
  const targetSet = new Set(targets);
  if (targetSet.has(start)) return 0;
  const visited = new Set([start]);
  const queue = [{ id: start, distance: 0 }];
  while (queue.length) {
    const current = queue.shift();
    for (const next of wcJackNormalMoves(current.id, policeCrossings, ignorePolice)) {
      if (visited.has(next)) continue;
      if (targetSet.has(next)) return current.distance + 1;
      visited.add(next);
      queue.push({ id: next, distance: current.distance + 1 });
    }
  }
  return Number.POSITIVE_INFINITY;
}

export function wcAdvanceCandidates(candidates, moveType, policeCrossings = []) {
  const result = new Set();
  for (const location of candidates) {
    if (moveType === "alley") {
      wcAlleyMoves(location).forEach((next) => result.add(next));
      continue;
    }
    const first = wcJackNormalMoves(location, policeCrossings, moveType === "coach");
    if (moveType === "coach") {
      for (const middle of first) {
        wcJackNormalMoves(middle, policeCrossings, true)
          .filter((next) => next !== location && next !== middle)
          .forEach((next) => result.add(next));
      }
    } else {
      first.forEach((next) => result.add(next));
    }
  }
  return [...result].sort((a, b) => a - b);
}

function crossingDistanceToLocation(crossing, location) {
  const crossingNode = WC_CROSSINGS.find((item) => item.id === crossing);
  const locationNode = WC_LOCATIONS[location - 1];
  if (!crossingNode || !locationNode) return 99;
  return Math.hypot(crossingNode.x - locationNode.x, crossingNode.y - locationNode.y);
}

function chooseBestNormal(location, hideout, police, difficulty, random) {
  const moves = wcJackNormalMoves(location, police);
  if (!moves.length) return null;
  return [...moves].sort((a, b) => {
    const score = (candidate) => {
      const home = wcLocationDistance(candidate, [hideout], police);
      const danger = Math.min(...police.map((crossing) => crossingDistanceToLocation(crossing, candidate)));
      const exits = wcJackNormalMoves(candidate, police).length;
      const noise = difficulty === "rookie" ? random() * 12 : random() * 2;
      return -home * 7 + danger * 0.8 + exits * 1.5 + noise;
    };
    return score(b) - score(a);
  })[0];
}

export function wcChooseJackMove({
  location,
  hideout,
  policeCrossings,
  coaches,
  alleys,
  movesUsed,
  difficulty = "inspector",
  random = Math.random,
}) {
  const normal = chooseBestNormal(location, hideout, policeCrossings, difficulty, random);
  if (normal === hideout) return { type: "normal", to: normal, path: [normal] };

  const danger = Math.min(...policeCrossings.map((crossing) => crossingDistanceToLocation(crossing, location)));
  const remaining = 15 - movesUsed;
  const normalHomeDistance = wcLocationDistance(location, [hideout], policeCrossings);
  const shouldUseSpecial = danger < 8 || normalHomeDistance >= remaining - 1 || !normal;

  if (shouldUseSpecial && coaches > 0 && movesUsed <= 13) {
    const options = [];
    for (const middle of wcJackNormalMoves(location, policeCrossings, true)) {
      for (const to of wcJackNormalMoves(middle, policeCrossings, true)) {
        if (to === location || to === middle || to === hideout) continue;
        options.push({ type: "coach", to, path: [middle, to] });
      }
    }
    if (options.length) {
      options.sort((a, b) =>
        wcLocationDistance(a.to, [hideout], [], true) -
        wcLocationDistance(b.to, [hideout], [], true),
      );
      return options[0];
    }
  }

  if (shouldUseSpecial && alleys > 0) {
    const options = wcAlleyMoves(location).filter((to) => to !== hideout);
    if (options.length) {
      options.sort((a, b) =>
        wcLocationDistance(a, [hideout], policeCrossings) -
        wcLocationDistance(b, [hideout], policeCrossings),
      );
      return { type: "alley", to: options[0], path: [options[0]] };
    }
  }

  return normal ? { type: "normal", to: normal, path: [normal] } : null;
}

function pickMany(values, count, random) {
  const pool = [...values];
  const result = [];
  while (pool.length && result.length < count) {
    result.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return result;
}

export function wcCreateNightSetup(night, existingHideout = null, random = Math.random) {
  const config = WC_NIGHTS[night - 1];
  const women = pickMany(WC_VICTIM_SITES, config.women, random);
  const targets = pickMany(women, config.marked, random);
  const hideout = existingHideout ?? WC_HIDEOUT_SITES[Math.floor(random() * WC_HIDEOUT_SITES.length)];
  const victims = [...targets]
    .sort((a, b) =>
      wcLocationDistance(a, [hideout], [], true) -
      wcLocationDistance(b, [hideout], [], true),
    )
    .slice(0, config.kills);
  return { config, women, targets, victims, hideout };
}

export function wcCreateGame(difficulty = "inspector", random = Math.random) {
  const setup = wcCreateNightSetup(1, null, random);
  return {
    difficulty,
    night: 1,
    phase: "patrol",
    winner: null,
    message: "다섯 명의 순찰 위치를 선택하세요.",
    hideout: setup.hideout,
    women: setup.women,
    targets: setup.targets,
    crimes: [],
    allCrimes: [],
    police: [],
    selectedPolice: null,
    movedPolice: [],
    actedPolice: [],
    searched: [],
    clues: [],
    jack: {
      location: null,
      coaches: setup.config.coaches,
      alleys: setup.config.alleys,
      movesUsed: 0,
      route: [],
    },
    candidates: [],
    log: [],
  };
}

export function wcBeginHunt(game) {
  const setup = wcCreateNightSetup(game.night, game.hideout, () => 0.5);
  const crimes = game.targets
    .slice()
    .sort((a, b) =>
      wcLocationDistance(a, [game.hideout], [], true) -
      wcLocationDistance(b, [game.hideout], [], true),
    )
    .slice(0, setup.config.kills);
  const start = crimes.at(-1);
  return {
    ...game,
    phase: "jack",
    crimes,
    allCrimes: [...game.allCrimes, ...crimes],
    jack: {
      location: start,
      coaches: setup.config.coaches,
      alleys: setup.config.alleys,
      movesUsed: game.night === 3 ? 1 : 0,
      route: [...crimes],
    },
    candidates: [...crimes],
    log: game.night === 3
      ? [{ move: 1, type: "double-event", label: "두 번째 사건 현장" }]
      : [],
    message: game.night === 3
      ? "두 사건 중 어느 곳에서 도주를 시작했는지 알 수 없습니다."
      : "사건이 발생했습니다. 범인의 첫 이동을 기다리세요.",
  };
}

export function wcPrepareNextNight(game, random = Math.random) {
  const night = game.night + 1;
  const setup = wcCreateNightSetup(night, game.hideout, random);
  return {
    ...game,
    night,
    phase: "patrol",
    message: `${night}번째 밤의 순찰 위치를 다시 정하세요.`,
    women: setup.women,
    targets: setup.targets,
    crimes: [],
    police: [],
    selectedPolice: null,
    movedPolice: [],
    actedPolice: [],
    searched: [],
    clues: [],
    candidates: [],
    log: [],
    jack: {
      location: null,
      coaches: setup.config.coaches,
      alleys: setup.config.alleys,
      movesUsed: 0,
      route: [],
    },
  };
}
