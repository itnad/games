export const CU_CAMELS = [
  { id: "red", name: "홍련", color: "#d65245", glyph: "◆" },
  { id: "yellow", name: "황금", color: "#e5ae37", glyph: "●" },
  { id: "green", name: "초원", color: "#4c9b67", glyph: "▲" },
  { id: "blue", name: "청람", color: "#4386b8", glyph: "■" },
  { id: "purple", name: "자옥", color: "#8a5ba6", glyph: "✦" },
];

export const CU_CRAZY_CAMELS = [
  { id: "white", name: "하얀 역주자", color: "#e9e4d9", glyph: "◇", crazy: true },
  { id: "black", name: "검은 역주자", color: "#343238", glyph: "⬟", crazy: true },
];

const ALL_CAMELS = [...CU_CAMELS, ...CU_CRAZY_CAMELS];
const LEG_TICKETS = [5, 3, 2, 2];
const FINISH_REWARDS = [8, 5, 3, 2, 1];

function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function emptyTrack() {
  return Object.fromEntries(Array.from({ length: 19 }, (_, index) => [index - 1, []]));
}

function addToTrack(track, position, camelId) {
  if (!track[position]) track[position] = [];
  track[position].push(camelId);
}

export function cuCreateGame(playerCount = 4, difficulty = "balanced", random = Math.random) {
  const track = emptyTrack();
  for (const camel of shuffle(CU_CAMELS, random)) addToTrack(track, 1 + Math.floor(random() * 3), camel.id);
  for (const camel of shuffle(CU_CRAZY_CAMELS, random)) addToTrack(track, 14 + Math.floor(random() * 3), camel.id);
  return {
    playerCount,
    difficulty,
    players: Array.from({ length: playerCount }, (_, index) => ({
      id: index,
      name: index === 0 ? "나" : `AI ${index}`,
      coins: 3,
      legBets: [],
      pyramidTickets: 0,
      finishUsed: [],
      spectator: null,
      partner: null,
    })),
    track,
    dice: [...CU_CAMELS.map((camel) => camel.id), "gray"],
    revealed: [],
    legTickets: Object.fromEntries(CU_CAMELS.map((camel) => [camel.id, [...LEG_TICKETS]])),
    winnerBets: [],
    loserBets: [],
    currentPlayer: 0,
    leg: 1,
    phase: "race",
    winner: null,
    lastRoll: null,
    log: ["낙타들이 출발 위치에 섰습니다. 첫 구간을 시작합니다."],
  };
}

export function cuFindCamel(track, camelId) {
  for (const [position, stack] of Object.entries(track)) {
    const level = stack.indexOf(camelId);
    if (level >= 0) return { position: Number(position), level };
  }
  return null;
}

export function cuRanking(track) {
  const ranked = [];
  for (const camel of CU_CAMELS) {
    const found = cuFindCamel(track, camel.id);
    if (found) ranked.push({ id: camel.id, ...found });
  }
  return ranked.sort((a, b) => b.position - a.position || b.level - a.level).map((item) => item.id);
}

function cloneState(state) {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      legBets: player.legBets.map((bet) => ({ ...bet })),
      finishUsed: [...player.finishUsed],
      spectator: player.spectator ? { ...player.spectator } : null,
    })),
    track: Object.fromEntries(Object.entries(state.track).map(([position, stack]) => [position, [...stack]])),
    dice: [...state.dice],
    revealed: state.revealed.map((die) => ({ ...die })),
    legTickets: Object.fromEntries(Object.entries(state.legTickets).map(([camel, tickets]) => [camel, [...tickets]])),
    winnerBets: state.winnerBets.map((bet) => ({ ...bet })),
    loserBets: state.loserBets.map((bet) => ({ ...bet })),
    log: [...state.log],
  };
}

function spectators(state) {
  return state.players.filter((player) => player.spectator).map((player) => ({ ...player.spectator, owner: player.id }));
}

function placeUnit(track, destination, unit, underneath = false) {
  if (!track[destination]) track[destination] = [];
  track[destination] = underneath ? [...unit, ...track[destination]] : [...track[destination], ...unit];
}

export function cuMoveCamel(state, camelId, distance) {
  const next = cloneState(state);
  const found = cuFindCamel(next.track, camelId);
  if (!found) return next;
  const meta = ALL_CAMELS.find((camel) => camel.id === camelId);
  const unit = next.track[found.position].splice(found.level);
  const direction = meta?.crazy ? -1 : 1;
  let destination = found.position + distance * direction;
  placeUnit(next.track, destination, unit);

  const tile = spectators(next).find((item) => item.position === destination);
  if (tile) {
    next.players[tile.owner].coins += 1;
    const currentStack = next.track[destination];
    const unitStart = currentStack.length - unit.length;
    next.track[destination].splice(unitStart, unit.length);
    const boost = tile.side === "cheer" ? direction : -direction;
    destination += boost;
    placeUnit(next.track, destination, unit, tile.side === "boo");
    next.log.push(`${next.players[tile.owner].name}의 ${tile.side === "cheer" ? "응원" : "야유"} 타일 발동 (+1 EP)`);
  }
  return next;
}

function crazyCamelForRoll(state, faceColor) {
  const carrying = CU_CRAZY_CAMELS.filter((camel) => {
    const found = cuFindCamel(state.track, camel.id);
    if (!found) return false;
    return state.track[found.position].slice(found.level + 1).some((id) => CU_CAMELS.some((racer) => racer.id === id));
  });
  if (carrying.length === 1) return carrying[0].id;
  const white = cuFindCamel(state.track, "white");
  const black = cuFindCamel(state.track, "black");
  if (white && black && white.position === black.position) {
    return white.level > black.level ? "white" : "black";
  }
  return faceColor;
}

function finishCrossed(state) {
  return CU_CAMELS.some((camel) => (cuFindCamel(state.track, camel.id)?.position || 0) >= 17)
    || CU_CRAZY_CAMELS.some((camel) => (cuFindCamel(state.track, camel.id)?.position || 17) <= 0);
}

function ticketReward(bet, ranking) {
  if (bet.camel === ranking[0]) return bet.value;
  if (bet.camel === ranking[1]) return 1;
  return -1;
}

function scoreLeg(state) {
  const next = cloneState(state);
  const ranking = cuRanking(next.track);
  const baseRewards = next.players.map((player) => {
    const rewards = player.legBets.map((bet) => ticketReward(bet, ranking));
    rewards.push(...Array.from({ length: player.pyramidTickets }, () => 1));
    return rewards;
  });
  next.players = next.players.map((player, index) => {
    const own = baseRewards[index].reduce((sum, value) => sum + value, 0);
    const partnerRewards = player.partner == null ? [] : baseRewards[player.partner].filter((value) => value > 0);
    const copied = partnerRewards.length ? Math.max(...partnerRewards) : 0;
    return {
      ...player,
      coins: Math.max(0, player.coins + own + copied),
      legBets: [],
      pyramidTickets: 0,
      spectator: null,
      partner: null,
    };
  });
  next.log.push(`${next.leg}구간 정산: ${camelName(ranking[0])} 선두 · ${camelName(ranking[1])} 2위`);
  return next;
}

function scoreFinishDeck(bets, correctCamel, players) {
  let correctIndex = 0;
  for (const bet of bets) {
    const reward = bet.camel === correctCamel ? (FINISH_REWARDS[correctIndex++] ?? 1) : -1;
    players[bet.player].coins = Math.max(0, players[bet.player].coins + reward);
  }
}

function finishGame(state) {
  const next = scoreLeg(state);
  const ranking = cuRanking(next.track);
  scoreFinishDeck(next.winnerBets, ranking[0], next.players);
  scoreFinishDeck(next.loserBets, ranking[ranking.length - 1], next.players);
  const standings = next.players
    .map((player) => ({ id: player.id, name: player.name, coins: player.coins }))
    .sort((a, b) => b.coins - a.coins);
  next.phase = "finished";
  next.winner = standings[0];
  next.standings = standings;
  next.log.push(`경주 종료! ${camelName(ranking[0])} 우승, ${camelName(ranking[ranking.length - 1])} 최하위`);
  return next;
}

function advanceTurn(state) {
  state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
  return state;
}

function completeAction(state) {
  if (finishCrossed(state)) return finishGame(state);
  if (state.revealed.length === 5) {
    const next = scoreLeg(state);
    next.leg += 1;
    next.dice = [...CU_CAMELS.map((camel) => camel.id), "gray"];
    next.revealed = [];
    next.legTickets = Object.fromEntries(CU_CAMELS.map((camel) => [camel.id, [...LEG_TICKETS]]));
    next.currentPlayer = state.currentPlayer;
    next.log.push(`${next.leg}구간 시작 · 주사위가 피라미드로 돌아갑니다.`);
    return next;
  }
  return advanceTurn(state);
}

export function cuRollPyramid(state, playerId, random = Math.random) {
  if (state.phase !== "race" || state.currentPlayer !== playerId || !state.dice.length) return state;
  let next = cloneState(state);
  const dieIndex = Math.floor(random() * next.dice.length);
  const die = next.dice.splice(dieIndex, 1)[0];
  const value = 1 + Math.floor(random() * 3);
  let camel = die;
  if (die === "gray") camel = crazyCamelForRoll(next, random() < 0.5 ? "white" : "black");
  next.players[playerId].pyramidTickets += 1;
  next.revealed.push({ die, camel, value });
  next.lastRoll = { die, camel, value };
  next.log.push(`${next.players[playerId].name}: 피라미드 → ${camelName(camel)} ${value}칸`);
  next = cuMoveCamel(next, camel, value);
  return completeAction(next);
}

export function cuTakeLegBet(state, playerId, camelId) {
  if (state.phase !== "race" || state.currentPlayer !== playerId) return state;
  const next = cloneState(state);
  const tickets = next.legTickets[camelId];
  if (!tickets?.length) return state;
  const value = tickets.shift();
  next.players[playerId].legBets.push({ camel: camelId, value });
  next.log.push(`${next.players[playerId].name}: ${camelName(camelId)} 구간 베팅 (${value} EP)`);
  return advanceTurn(next);
}

export function cuPlaceSpectator(state, playerId, position, side) {
  if (state.phase !== "race" || state.currentPlayer !== playerId || !cuLegalSpectatorSpaces(state).includes(position)) return state;
  const next = cloneState(state);
  next.players[playerId].spectator = { position, side };
  next.log.push(`${next.players[playerId].name}: ${position}번 칸에 ${side === "cheer" ? "응원" : "야유"} 타일`);
  return advanceTurn(next);
}

export function cuLegalSpectatorSpaces(state) {
  const occupied = new Set(Object.entries(state.track).filter(([, stack]) => stack.length).map(([position]) => Number(position)));
  const tiles = spectators(state).map((tile) => tile.position);
  return Array.from({ length: 15 }, (_, index) => index + 2).filter((position) => (
    !occupied.has(position)
    && !tiles.includes(position)
    && !tiles.some((tile) => Math.abs(tile - position) === 1)
  ));
}

export function cuPlaceFinishBet(state, playerId, camelId, type) {
  if (state.phase !== "race" || state.currentPlayer !== playerId) return state;
  const player = state.players[playerId];
  if (player.finishUsed.includes(camelId)) return state;
  const next = cloneState(state);
  next.players[playerId].finishUsed.push(camelId);
  const target = type === "winner" ? next.winnerBets : next.loserBets;
  target.push({ player: playerId, camel: camelId });
  next.log.push(`${next.players[playerId].name}: 최종 ${type === "winner" ? "우승" : "최하위"} 비밀 베팅`);
  return advanceTurn(next);
}

export function cuPartner(state, playerId, partnerId) {
  if (state.playerCount < 6 || state.currentPlayer !== playerId || playerId === partnerId) return state;
  if (state.players[playerId].partner != null || state.players[partnerId].partner != null) return state;
  const next = cloneState(state);
  next.players[playerId].partner = partnerId;
  next.players[partnerId].partner = playerId;
  next.log.push(`${next.players[playerId].name} ↔ ${next.players[partnerId].name} 구간 제휴`);
  return advanceTurn(next);
}

export function cuChooseAiAction(state, playerId, random = Math.random) {
  const player = state.players[playerId];
  const ranking = cuRanking(state.track);
  const leader = ranking[0];
  const loser = ranking[ranking.length - 1];
  const topTicket = state.legTickets[leader]?.[0];
  const progress = Math.max(...CU_CAMELS.map((camel) => cuFindCamel(state.track, camel.id)?.position || 0));

  if (topTicket >= 3 && random() < (state.difficulty === "sharp" ? 0.72 : 0.52)) {
    return cuTakeLegBet(state, playerId, leader);
  }
  if (progress >= 9 && !player.finishUsed.includes(leader) && random() < 0.24) {
    return cuPlaceFinishBet(state, playerId, leader, "winner");
  }
  if (progress >= 11 && !player.finishUsed.includes(loser) && random() < 0.2) {
    return cuPlaceFinishBet(state, playerId, loser, "loser");
  }
  if (state.playerCount >= 6 && player.partner == null && random() < 0.08) {
    const partner = state.players.find((candidate) => candidate.id !== playerId && candidate.partner == null);
    if (partner) return cuPartner(state, playerId, partner.id);
  }
  if (random() < 0.12) {
    const spaces = cuLegalSpectatorSpaces(state);
    if (spaces.length) {
      const target = spaces.reduce((best, space) => Math.abs(space - progress) < Math.abs(best - progress) ? space : best, spaces[0]);
      return cuPlaceSpectator(state, playerId, target, random() < 0.68 ? "cheer" : "boo");
    }
  }
  return cuRollPyramid(state, playerId, random);
}

export function camelName(id) {
  return ALL_CAMELS.find((camel) => camel.id === id)?.name || id;
}

export function cuTrackView(track) {
  return Array.from({ length: 16 }, (_, index) => {
    const position = index + 1;
    return { position, camels: track[position] || [] };
  });
}
