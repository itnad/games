export const TICHU_SUITS = [
  { id: "jade", name: "옥", symbol: "◆", color: "#299476" },
  { id: "sword", name: "검", symbol: "⚔", color: "#3975b7" },
  { id: "pagoda", name: "탑", symbol: "♜", color: "#c84f4f" },
  { id: "star", name: "별", symbol: "★", color: "#8d62b7" },
];

export const TICHU_SPECIALS = [
  { id: "mahjong", name: "마작", rank: 1, symbol: "一", points: 0 },
  { id: "dog", name: "개", rank: 0, symbol: "犬", points: 0 },
  { id: "phoenix", name: "봉황", rank: 15, symbol: "鳳", points: -25 },
  { id: "dragon", name: "용", rank: 16, symbol: "龍", points: 25 },
];

const RANK_LABELS = { 11: "J", 12: "Q", 13: "K", 14: "A" };

export function tichuRankLabel(rank) {
  return RANK_LABELS[rank] || String(rank);
}

export function tichuBuildDeck() {
  const cards = [];
  for (const suit of TICHU_SUITS) {
    for (let rank = 2; rank <= 14; rank += 1) {
      cards.push({
        id: `${suit.id}-${rank}`,
        suit: suit.id,
        rank,
        label: tichuRankLabel(rank),
        name: `${suit.name} ${tichuRankLabel(rank)}`,
        symbol: suit.symbol,
        special: null,
        points: rank === 5 ? 5 : rank === 10 || rank === 13 ? 10 : 0,
      });
    }
  }
  return [
    ...cards,
    ...TICHU_SPECIALS.map((card) => ({
      ...card,
      suit: "special",
      label: card.name,
      special: card.id,
    })),
  ];
}

function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function cloneState(state) {
  return {
    ...state,
    scores: [...state.scores],
    players: state.players.map((player) => ({
      ...player,
      hand: [...player.hand],
      tricks: [...player.tricks],
    })),
    table: state.table.map((play) => ({ ...play, cards: [...play.cards] })),
    passes: [...state.passes],
    finishOrder: [...state.finishOrder],
    declarations: state.declarations.map((item) => ({ ...item })),
    log: [...state.log],
  };
}

function strengthOfHand(hand) {
  const ranks = {};
  for (const card of hand) if (!card.special) ranks[card.rank] = (ranks[card.rank] || 0) + 1;
  const pairs = Object.values(ranks).filter((count) => count >= 2).length;
  const triples = Object.values(ranks).filter((count) => count >= 3).length;
  const high = hand.filter((card) => card.rank >= 12 || ["dragon", "phoenix"].includes(card.special)).length;
  const bomb = Object.values(ranks).some((count) => count === 4);
  return high * 2 + pairs + triples * 2 + (bomb ? 6 : 0);
}

function newRound(previous, random = Math.random) {
  const deck = shuffled(tichuBuildDeck(), random);
  const players = Array.from({ length: 4 }, (_, id) => ({
    id,
    team: id % 2,
    name: id === 0 ? "나" : ["", "AI 청룡", "AI 백호", "AI 주작"][id],
    isHuman: id === 0,
    hand: deck.slice(id * 14, id * 14 + 8),
    reserve: deck.slice(id * 14 + 8, id * 14 + 14),
    tricks: [],
    playedAny: false,
  }));
  return {
    difficulty: previous?.difficulty || "balanced",
    targetScore: previous?.targetScore || 1000,
    scores: previous?.scores ? [...previous.scores] : [0, 0],
    round: (previous?.round || 0) + 1,
    players,
    phase: "grand",
    currentPlayer: 0,
    table: [],
    currentCombo: null,
    lastPlayer: null,
    passes: [],
    finishOrder: [],
    wish: null,
    declarations: players.map(() => ({ type: null, success: null })),
    log: [`${(previous?.round || 0) + 1}라운드: 첫 8장을 확인합니다.`],
    roundResult: null,
    winner: null,
  };
}

export function tichuCreateGame(difficulty = "balanced", targetScore = 1000, random = Math.random) {
  return newRound({ difficulty, targetScore, scores: [0, 0], round: 0 }, random);
}

export function tichuCompleteGrand(state, declareGrand = false) {
  if (state.phase !== "grand") return state;
  const next = cloneState(state);
  if (declareGrand) {
    next.declarations[0] = { type: "grand", success: null };
    next.log.push("나: 그랜드 티츄 선언! 성공하면 +200점, 실패하면 -200점");
  }
  for (const player of next.players) {
    if (!player.isHuman && strengthOfHand(player.hand) >= 13) {
      next.declarations[player.id] = { type: "grand", success: null };
      next.log.push(`${player.name}: 그랜드 티츄 선언`);
    }
    player.hand.push(...player.reserve);
    delete player.reserve;
  }
  next.phase = "passing";
  return next;
}

function aiPassCards(player) {
  const sorted = [...player.hand].sort((a, b) => {
    const aKeep = a.points + (a.rank || 0) + (["dragon", "phoenix"].includes(a.special) ? 20 : 0);
    const bKeep = b.points + (b.rank || 0) + (["dragon", "phoenix"].includes(b.special) ? 20 : 0);
    return aKeep - bKeep;
  });
  return [sorted[0].id, sorted[1].id, sorted[2].id];
}

export function tichuResolvePassing(state, humanCardIds) {
  if (state.phase !== "passing" || humanCardIds.length !== 3 || new Set(humanCardIds).size !== 3) return state;
  const next = cloneState(state);
  if (!humanCardIds.every((id) => next.players[0].hand.some((card) => card.id === id))) return state;

  const assignments = next.players.map((player) => player.id === 0 ? [...humanCardIds] : aiPassCards(player));
  const incoming = next.players.map(() => []);
  for (let playerId = 0; playerId < 4; playerId += 1) {
    const targets = [(playerId + 1) % 4, (playerId + 2) % 4, (playerId + 3) % 4];
    assignments[playerId].forEach((cardId, index) => {
      const card = next.players[playerId].hand.find((item) => item.id === cardId);
      next.players[playerId].hand = next.players[playerId].hand.filter((item) => item.id !== cardId);
      if (card) incoming[targets[index]].push(card);
    });
  }
  next.players.forEach((player, index) => {
    player.hand.push(...incoming[index]);
    player.hand.sort(cardSort);
  });
  next.currentPlayer = next.players.find((player) => player.hand.some((card) => card.special === "mahjong"))?.id ?? 0;
  next.phase = "playing";
  next.log.push(`카드 교환 완료 · ${next.players[next.currentPlayer].name}가 마작으로 시작합니다.`);
  return next;
}

function cardSort(a, b) {
  const aRank = a.special === "dog" ? 0 : a.special === "mahjong" ? 1 : a.special === "phoenix" ? 15 : a.special === "dragon" ? 16 : a.rank;
  const bRank = b.special === "dog" ? 0 : b.special === "mahjong" ? 1 : b.special === "phoenix" ? 15 : b.special === "dragon" ? 16 : b.rank;
  return aRank - bRank || a.suit.localeCompare(b.suit);
}

function rankCounts(cards) {
  return cards.reduce((counts, card) => {
    if (!card.special || card.special === "mahjong") counts[card.rank] = (counts[card.rank] || 0) + 1;
    return counts;
  }, {});
}

function isConsecutive(values) {
  return values.every((value, index) => index === 0 || value === values[index - 1] + 1);
}

function straightWithPhoenix(cards) {
  const phoenix = cards.some((card) => card.special === "phoenix");
  if (cards.some((card) => ["dog", "dragon"].includes(card.special))) return null;
  const ranks = cards.filter((card) => card.special !== "phoenix").map((card) => card.rank);
  if (new Set(ranks).size !== ranks.length) return null;
  for (let low = 1; low <= 14 - cards.length + 1; low += 1) {
    const sequence = Array.from({ length: cards.length }, (_, index) => low + index);
    const missing = sequence.filter((rank) => !ranks.includes(rank));
    if ((!phoenix && missing.length === 0) || (phoenix && missing.length === 1)) return sequence.at(-1);
  }
  return null;
}

function pairSequenceWithPhoenix(cards) {
  if (cards.length < 4 || cards.length % 2 || cards.some((card) => ["dog", "dragon", "mahjong"].includes(card.special))) return null;
  const phoenix = cards.some((card) => card.special === "phoenix");
  const counts = rankCounts(cards.filter((card) => card.special !== "phoenix"));
  const ranks = Object.keys(counts).map(Number).sort((a, b) => a - b);
  if (!ranks.length || !isConsecutive(ranks)) return null;
  const singles = ranks.filter((rank) => counts[rank] === 1).length;
  const invalid = ranks.some((rank) => counts[rank] > 2);
  if (invalid || (!phoenix && singles) || (phoenix && singles !== 1)) return null;
  return ranks.at(-1);
}

function fullHouseWithPhoenix(cards) {
  if (cards.length !== 5 || cards.some((card) => ["dog", "dragon", "mahjong"].includes(card.special))) return null;
  const phoenix = cards.some((card) => card.special === "phoenix");
  const base = cards.filter((card) => card.special !== "phoenix");
  const tryRanks = phoenix ? Array.from({ length: 13 }, (_, index) => index + 2) : [null];
  for (const rank of tryRanks) {
    const counts = rankCounts(rank ? [...base, { rank }] : base);
    const values = Object.entries(counts);
    const triple = values.find(([, count]) => count === 3);
    const pair = values.find(([, count]) => count === 2);
    if (triple && pair) return Number(triple[0]);
  }
  return null;
}

export function tichuClassify(cards, currentCombo = null) {
  if (!cards?.length) return null;
  if (cards.length === 1) {
    const card = cards[0];
    if (card.special === "dog") return { type: "dog", count: 1, strength: 0, label: "개" };
    let strength = card.rank;
    if (card.special === "phoenix") strength = currentCombo?.type === "single" ? Math.min(14.5, currentCombo.strength + 0.5) : 1.5;
    return { type: "single", count: 1, strength, label: "싱글" };
  }
  if (cards.some((card) => ["dog", "dragon"].includes(card.special))) return null;

  const noPhoenix = cards.filter((card) => card.special !== "phoenix");
  const counts = rankCounts(noPhoenix);
  const entries = Object.entries(counts);
  const sameRank = entries.length === 1;

  if (cards.length === 4 && !cards.some((card) => card.special) && sameRank) {
    return { type: "bomb", bombType: "four", count: 4, strength: 100 + Number(entries[0][0]), label: "포카드 폭탄" };
  }
  if (cards.length >= 5 && !cards.some((card) => card.special) && new Set(cards.map((card) => card.suit)).size === 1) {
    const ranks = cards.map((card) => card.rank).sort((a, b) => a - b);
    if (new Set(ranks).size === ranks.length && isConsecutive(ranks)) {
      return { type: "bomb", bombType: "straight", count: cards.length, strength: 1000 + cards.length * 20 + ranks.at(-1), label: "스트레이트 플러시 폭탄" };
    }
  }
  if (cards.length === 2 && (sameRank || (cards.some((card) => card.special === "phoenix") && noPhoenix.length === 1))) {
    return { type: "pair", count: 2, strength: noPhoenix[0]?.rank || 1, label: "페어" };
  }
  if (cards.length === 3 && ((sameRank && entries[0][1] === 3) || (cards.some((card) => card.special === "phoenix") && sameRank && entries[0][1] === 2))) {
    return { type: "triple", count: 3, strength: Number(entries[0][0]), label: "트리플" };
  }
  const fullHouse = fullHouseWithPhoenix(cards);
  if (fullHouse) return { type: "full-house", count: 5, strength: fullHouse, label: "풀하우스" };
  const pairs = pairSequenceWithPhoenix(cards);
  if (pairs) return { type: "pair-run", count: cards.length, strength: pairs, label: "연속 페어" };
  const straight = cards.length >= 5 ? straightWithPhoenix(cards) : null;
  if (straight) return { type: "straight", count: cards.length, strength: straight, label: "스트레이트" };
  return null;
}

export function tichuBeats(combo, current) {
  if (!combo) return false;
  if (!current) return true;
  if (combo.type === "bomb") return current.type !== "bomb" || combo.strength > current.strength;
  if (current.type === "bomb" || combo.type !== current.type || combo.count !== current.count) return false;
  return combo.strength > current.strength;
}

function candidateSelections(hand, currentCombo) {
  const result = [];
  const limit = 1 << hand.length;
  for (let mask = 1; mask < limit; mask += 1) {
    const cards = hand.filter((_, index) => mask & (1 << index));
    const combo = tichuClassify(cards, currentCombo);
    if (combo && tichuBeats(combo, currentCombo)) result.push({ cards, combo });
  }
  return result;
}

function containsWish(cards, wish) {
  return cards.some((card) => !card.special && card.rank === wish);
}

export function tichuLegalSelections(state, playerId) {
  const player = state.players[playerId];
  if (!player || state.phase !== "playing" || player.hand.length === 0) return [];
  let candidates = candidateSelections(player.hand, state.currentCombo);
  if (state.wish) {
    const fulfilling = candidates.filter((candidate) => containsWish(candidate.cards, state.wish));
    if (fulfilling.length) {
      candidates = candidates.filter((candidate) => candidate.combo.type === "bomb" || containsWish(candidate.cards, state.wish));
    }
  }
  return candidates;
}

function nextActivePlayer(state, from, preferred = null) {
  if (preferred != null && state.players[preferred].hand.length) return preferred;
  for (let step = 1; step <= 4; step += 1) {
    const id = (from + step) % 4;
    if (state.players[id].hand.length) return id;
  }
  return from;
}

export function tichuDeclare(state, playerId, type = "tichu") {
  if (state.phase !== "playing" || state.players[playerId].playedAny || state.declarations[playerId].type) return state;
  const next = cloneState(state);
  next.declarations[playerId] = { type, success: null };
  next.log.push(`${next.players[playerId].name}: 티츄 선언!`);
  return next;
}

function awardTrick(state, playerId) {
  const cards = state.table.flatMap((play) => play.cards);
  state.players[playerId].tricks.push(...cards);
  const hadDragon = cards.some((card) => card.special === "dragon");
  if (hadDragon) {
    const opponents = state.players.filter((player) => player.team !== state.players[playerId].team);
    const target = opponents.sort((a, b) => a.tricks.reduce((sum, card) => sum + card.points, 0) - b.tricks.reduce((sum, card) => sum + card.points, 0))[0];
    target.tricks.push(...cards);
    state.players[playerId].tricks.splice(state.players[playerId].tricks.length - cards.length, cards.length);
    state.log.push(`${state.players[playerId].name}: 용이 든 트릭을 ${target.name}에게 전달`);
  }
  state.table = [];
  state.currentCombo = null;
  state.lastPlayer = null;
  state.passes = [];
  state.currentPlayer = nextActivePlayer(state, playerId);
}

function cardPoints(cards) {
  return cards.reduce((sum, card) => sum + (card.points || 0), 0);
}

function declarationPoints(state, team) {
  let score = 0;
  state.declarations.forEach((declaration, playerId) => {
    if (!declaration.type || state.players[playerId].team !== team) return;
    const value = declaration.type === "grand" ? 200 : 100;
    score += state.finishOrder[0] === playerId ? value : -value;
  });
  return score;
}

function settleRound(state) {
  const next = cloneState(state);
  if (next.table.length && next.lastPlayer != null) awardTrick(next, next.lastPlayer);
  const first = next.finishOrder[0];
  const last = next.players.find((player) => !next.finishOrder.includes(player.id))?.id ?? next.finishOrder.at(-1);
  const doubleVictory = next.finishOrder.length >= 2 && next.players[next.finishOrder[0]].team === next.players[next.finishOrder[1]].team;
  let roundScores = [0, 0];

  if (doubleVictory) {
    roundScores[next.players[first].team] = 200;
  } else {
    const firstPlayer = next.players[first];
    const lastPlayer = next.players[last];
    firstPlayer.tricks.push(...lastPlayer.tricks);
    lastPlayer.tricks = [];
    const oppositeTeam = 1 - lastPlayer.team;
    roundScores[oppositeTeam] += cardPoints(lastPlayer.hand);
    roundScores[0] += next.players.filter((player) => player.team === 0).reduce((sum, player) => sum + cardPoints(player.tricks), 0);
    roundScores[1] += next.players.filter((player) => player.team === 1).reduce((sum, player) => sum + cardPoints(player.tricks), 0);
  }
  roundScores[0] += declarationPoints(next, 0);
  roundScores[1] += declarationPoints(next, 1);
  next.scores[0] += roundScores[0];
  next.scores[1] += roundScores[1];
  next.roundResult = { roundScores, doubleVictory, first, last };
  next.declarations = next.declarations.map((declaration, playerId) => ({
    ...declaration,
    success: declaration.type ? playerId === first : null,
  }));
  const reached = next.scores[0] >= next.targetScore || next.scores[1] >= next.targetScore;
  if (reached) {
    next.phase = "finished";
    next.winner = next.scores[0] === next.scores[1] ? null : next.scores[0] > next.scores[1] ? 0 : 1;
  } else {
    next.phase = "round-end";
  }
  next.log.push(`${next.round}라운드 종료 · 우리 팀 ${roundScores[0]} : ${roundScores[1]} 상대 팀`);
  return next;
}

export function tichuPlay(state, playerId, cardIds, wish = null) {
  if (state.phase !== "playing" || state.currentPlayer !== playerId) return state;
  const legal = tichuLegalSelections(state, playerId);
  const selected = legal.find((candidate) => candidate.cards.length === cardIds.length && candidate.cards.every((card) => cardIds.includes(card.id)));
  if (!selected) return state;
  if (!state.currentCombo && selected.combo.type === "dog") {
    const next = cloneState(state);
    next.players[playerId].hand = next.players[playerId].hand.filter((item) => item.id !== cardIds[0]);
    next.players[playerId].playedAny = true;
    next.log.push(`${next.players[playerId].name}: 개 → 파트너에게 선`);
    if (next.players[playerId].hand.length === 0 && !next.finishOrder.includes(playerId)) next.finishOrder.push(playerId);
    const partnerId = (playerId + 2) % 4;
    next.currentPlayer = next.players[partnerId].hand.length ? partnerId : nextActivePlayer(next, partnerId);
    if (next.finishOrder.length === 3) return settleRound(next);
    return next;
  }

  const next = cloneState(state);
  const cards = cardIds.map((id) => next.players[playerId].hand.find((card) => card.id === id)).filter(Boolean);
  next.players[playerId].hand = next.players[playerId].hand.filter((card) => !cardIds.includes(card.id));
  next.players[playerId].playedAny = true;
  next.table.push({ playerId, cards, combo: selected.combo });
  next.currentCombo = selected.combo;
  next.lastPlayer = playerId;
  next.passes = [];
  if (cards.some((card) => card.special === "mahjong")) {
    next.wish = wish && wish >= 2 && wish <= 14 ? wish : null;
    if (next.wish) next.log.push(`${next.players[playerId].name}: 마작 · ${tichuRankLabel(next.wish)} 소원`);
  } else {
    next.log.push(`${next.players[playerId].name}: ${selected.combo.label} ${cards.map((card) => card.label).join("·")}`);
  }
  if (next.wish && containsWish(cards, next.wish)) {
    next.log.push(`${tichuRankLabel(next.wish)} 소원이 이루어졌습니다.`);
    next.wish = null;
  }
  if (next.players[playerId].hand.length === 0 && !next.finishOrder.includes(playerId)) {
    next.finishOrder.push(playerId);
    next.log.push(`${next.players[playerId].name}: ${next.finishOrder.length}등으로 완주`);
  }
  if (next.finishOrder.length === 3) return settleRound(next);
  next.currentPlayer = nextActivePlayer(next, playerId);
  return next;
}

export function tichuBomb(state, playerId, cardIds) {
  if (state.phase !== "playing" || !state.currentCombo || !state.players[playerId]?.hand.length) return state;
  const cards = cardIds.map((id) => state.players[playerId].hand.find((card) => card.id === id)).filter(Boolean);
  const combo = tichuClassify(cards, state.currentCombo);
  if (combo?.type !== "bomb" || !tichuBeats(combo, state.currentCombo)) return state;
  const next = cloneState(state);
  const playedCards = cardIds.map((id) => next.players[playerId].hand.find((card) => card.id === id)).filter(Boolean);
  next.players[playerId].hand = next.players[playerId].hand.filter((card) => !cardIds.includes(card.id));
  next.players[playerId].playedAny = true;
  next.table.push({ playerId, cards: playedCards, combo });
  next.currentCombo = combo;
  next.lastPlayer = playerId;
  next.passes = [];
  next.log.push(`${next.players[playerId].name}: ${combo.label} 난입!`);
  if (next.wish && containsWish(playedCards, next.wish)) {
    next.log.push(`${tichuRankLabel(next.wish)} 소원이 이루어졌습니다.`);
    next.wish = null;
  }
  if (next.players[playerId].hand.length === 0 && !next.finishOrder.includes(playerId)) {
    next.finishOrder.push(playerId);
    next.log.push(`${next.players[playerId].name}: ${next.finishOrder.length}등으로 완주`);
  }
  if (next.finishOrder.length === 3) return settleRound(next);
  next.currentPlayer = nextActivePlayer(next, playerId);
  return next;
}

export function tichuPass(state, playerId) {
  if (state.phase !== "playing" || state.currentPlayer !== playerId || !state.currentCombo) return state;
  const next = cloneState(state);
  if (!next.passes.includes(playerId)) next.passes.push(playerId);
  next.log.push(`${next.players[playerId].name}: 패스`);
  const activeOthers = next.players.filter((player) => player.hand.length && player.id !== next.lastPlayer).length;
  if (next.passes.length >= activeOthers) {
    const winner = next.lastPlayer;
    next.log.push(`${next.players[winner].name}: 트릭 획득`);
    awardTrick(next, winner);
    return next;
  }
  next.currentPlayer = nextActivePlayer(next, playerId);
  return next;
}

export function tichuChooseAiAction(state, playerId, random = Math.random) {
  if (state.phase !== "playing" || state.currentPlayer !== playerId) return state;
  let working = state;
  const player = working.players[playerId];
  if (!player.playedAny && !working.declarations[playerId].type) {
    const threshold = working.difficulty === "sharp" ? 18 : working.difficulty === "casual" ? 22 : 20;
    if (strengthOfHand(player.hand) >= threshold) working = tichuDeclare(working, playerId);
  }
  const candidates = tichuLegalSelections(working, playerId);
  if (!candidates.length) return tichuPass(working, playerId);

  const partnerId = (playerId + 2) % 4;
  const partnerWinning = working.lastPlayer === partnerId;
  if (working.currentCombo && partnerWinning && random() < 0.72) return tichuPass(working, playerId);

  const sorted = [...candidates].sort((a, b) => {
    const aBomb = a.combo.type === "bomb" ? 1 : 0;
    const bBomb = b.combo.type === "bomb" ? 1 : 0;
    if (aBomb !== bBomb) return aBomb - bBomb;
    if (!working.currentCombo && a.cards.length !== b.cards.length) return b.cards.length - a.cards.length;
    return a.combo.strength - b.combo.strength;
  });
  let choice = sorted[0];
  if (working.currentCombo && choice.combo.type === "bomb" && random() < 0.55) return tichuPass(working, playerId);
  if (working.difficulty === "casual" && sorted.length > 1 && random() < 0.25) choice = sorted[Math.min(sorted.length - 1, 1)];
  const hasMahjong = choice.cards.some((card) => card.special === "mahjong");
  const wish = hasMahjong
    ? Object.entries(rankCounts(working.players[playerId].hand)).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null;
  return tichuPlay(working, playerId, choice.cards.map((card) => card.id), wish ? Number(wish) : null);
}

export function tichuNextRound(state, random = Math.random) {
  if (state.phase !== "round-end") return state;
  return newRound(state, random);
}

export function tichuCardPoints(cards) {
  return cardPoints(cards);
}
