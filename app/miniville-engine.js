export const MINIVILLE_ESTABLISHMENTS = [
  { id: "wheat", name: "밀밭", cost: 1, rolls: [1], color: "blue", symbol: "grain", icon: "🌾", effect: "누구의 턴이든 은행에서 1코인", income: 1 },
  { id: "ranch", name: "목장", cost: 1, rolls: [2], color: "blue", symbol: "cow", icon: "🐄", effect: "누구의 턴이든 은행에서 1코인", income: 1 },
  { id: "bakery", name: "빵집", cost: 1, rolls: [2, 3], color: "green", symbol: "bread", icon: "🥐", effect: "내 턴에 은행에서 1코인", income: 1 },
  { id: "cafe", name: "카페", cost: 2, rolls: [3], color: "red", symbol: "cup", icon: "☕", effect: "주사위를 굴린 사람에게 1코인", income: 1 },
  { id: "convenience", name: "편의점", cost: 2, rolls: [4], color: "green", symbol: "bread", icon: "🏪", effect: "내 턴에 은행에서 3코인", income: 3 },
  { id: "forest", name: "숲", cost: 3, rolls: [5], color: "blue", symbol: "gear", icon: "🌲", effect: "누구의 턴이든 은행에서 1코인", income: 1 },
  { id: "stadium", name: "경기장", cost: 6, rolls: [6], color: "purple", symbol: "major", icon: "🏟", effect: "모든 상대에게 2코인씩 받기", income: 2 },
  { id: "tv-station", name: "방송국", cost: 7, rolls: [6], color: "purple", symbol: "major", icon: "📺", effect: "선택한 상대에게 최대 5코인 받기", income: 5 },
  { id: "business-center", name: "비즈니스 센터", cost: 8, rolls: [6], color: "purple", symbol: "major", icon: "🏢", effect: "상대와 일반 건물 한 장 교환", income: 0 },
  { id: "cheese-factory", name: "치즈 공장", cost: 5, rolls: [7], color: "green", symbol: "factory", icon: "🧀", effect: "목장 한 장마다 3코인", income: 3, counts: ["ranch"] },
  { id: "furniture-factory", name: "가구 공장", cost: 3, rolls: [8], color: "green", symbol: "factory", icon: "🪑", effect: "숲·광산 한 장마다 3코인", income: 3, counts: ["forest", "mine"] },
  { id: "mine", name: "광산", cost: 6, rolls: [9], color: "blue", symbol: "gear", icon: "⛏", effect: "누구의 턴이든 은행에서 5코인", income: 5 },
  { id: "family-restaurant", name: "패밀리 레스토랑", cost: 3, rolls: [9, 10], color: "red", symbol: "cup", icon: "🍽", effect: "주사위를 굴린 사람에게 2코인", income: 2 },
  { id: "apple-orchard", name: "사과 과수원", cost: 3, rolls: [10], color: "blue", symbol: "grain", icon: "🍎", effect: "누구의 턴이든 은행에서 3코인", income: 3 },
  { id: "produce-market", name: "청과물 시장", cost: 2, rolls: [11, 12], color: "green", symbol: "market", icon: "🧺", effect: "밀밭·과수원 한 장마다 2코인", income: 2, counts: ["wheat", "apple-orchard"] },
];

export const MINIVILLE_LANDMARKS = [
  { id: "station", name: "기차역", cost: 4, icon: "🚉", effect: "매 턴 주사위 1개 또는 2개를 선택할 수 있습니다." },
  { id: "mall", name: "쇼핑몰", cost: 10, icon: "🏬", effect: "빵·카페 건물 한 장이 주는 수입이 1코인 늘어납니다." },
  { id: "amusement", name: "놀이공원", cost: 16, icon: "🎡", effect: "주사위 2개가 같은 눈이면 한 번 더 턴을 진행합니다." },
  { id: "radio", name: "라디오 타워", cost: 22, icon: "📡", effect: "턴마다 주사위를 한 번 다시 굴릴 수 있습니다." },
];

export function minivilleEstablishment(id) {
  return MINIVILLE_ESTABLISHMENTS.find((card) => card.id === id);
}

export function minivilleLandmark(id) {
  return MINIVILLE_LANDMARKS.find((card) => card.id === id);
}

export function minivilleCreateMarket() {
  return Object.fromEntries(
    MINIVILLE_ESTABLISHMENTS.map((card) => [card.id, card.color === "purple" ? 4 : 6]),
  );
}

export function minivilleCreatePlayer(id, name) {
  return {
    id,
    name,
    coins: 3,
    cards: { wheat: 1, bakery: 1 },
    landmarks: [],
  };
}

export function minivilleOwns(player, id) {
  return (player.cards[id] ?? 0) > 0;
}

export function minivilleHasLandmark(player, id) {
  return player.landmarks.includes(id);
}

function mallBonus(player, card) {
  return minivilleHasLandmark(player, "mall") && ["bread", "cup"].includes(card.symbol) ? 1 : 0;
}

function matchingCards(player, roll, color) {
  return MINIVILLE_ESTABLISHMENTS.filter(
    (card) => card.color === color && card.rolls.includes(roll) && (player.cards[card.id] ?? 0) > 0,
  );
}

function cardIncome(player, card) {
  const copies = player.cards[card.id] ?? 0;
  if (card.counts) {
    const matching = card.counts.reduce((sum, id) => sum + (player.cards[id] ?? 0), 0);
    return copies * matching * card.income;
  }
  return copies * (card.income + mallBonus(player, card));
}

export function minivilleResolveBaseIncome(players, rollerId, roll) {
  const next = players.map((player) => ({ ...player, cards: { ...player.cards }, landmarks: [...player.landmarks] }));
  const events = [];
  const roller = next[rollerId];

  for (let offset = 1; offset < next.length; offset += 1) {
    const ownerId = (rollerId - offset + next.length) % next.length;
    const owner = next[ownerId];
    for (const card of matchingCards(owner, roll, "red")) {
      const requested = cardIncome(owner, card);
      const paid = Math.min(roller.coins, requested);
      roller.coins -= paid;
      owner.coins += paid;
      if (paid > 0) events.push(`${owner.name}의 ${card.name} +${paid}`);
    }
  }

  for (const owner of next) {
    for (const card of matchingCards(owner, roll, "blue")) {
      const amount = cardIncome(owner, card);
      owner.coins += amount;
      if (amount > 0) events.push(`${owner.name}의 ${card.name} +${amount}`);
    }
  }

  for (const card of matchingCards(roller, roll, "green")) {
    const amount = cardIncome(roller, card);
    roller.coins += amount;
    if (amount > 0) events.push(`${roller.name}의 ${card.name} +${amount}`);
  }

  if (roll === 6 && minivilleOwns(roller, "stadium")) {
    let total = 0;
    for (const opponent of next) {
      if (opponent.id === rollerId) continue;
      const paid = Math.min(opponent.coins, 2);
      opponent.coins -= paid;
      roller.coins += paid;
      total += paid;
    }
    if (total > 0) events.push(`${roller.name}의 경기장 +${total}`);
  }

  return { players: next, events };
}

export function minivilleApplyTvStation(players, rollerId, targetId) {
  const next = players.map((player) => ({ ...player, cards: { ...player.cards }, landmarks: [...player.landmarks] }));
  const roller = next[rollerId];
  const target = next[targetId];
  const paid = Math.min(target.coins, 5);
  target.coins -= paid;
  roller.coins += paid;
  return { players: next, paid };
}

export function minivilleApplyTrade(players, rollerId, targetId, giveId, receiveId) {
  const give = minivilleEstablishment(giveId);
  const receive = minivilleEstablishment(receiveId);
  if (
    !give || !receive || give.color === "purple" || receive.color === "purple" ||
    !(players[rollerId].cards[giveId] > 0) || !(players[targetId].cards[receiveId] > 0) ||
    rollerId === targetId
  ) return players;
  return players.map((player) => {
    const cards = { ...player.cards };
    if (player.id === rollerId) {
      cards[giveId] -= 1;
      cards[receiveId] = (cards[receiveId] ?? 0) + 1;
    }
    if (player.id === targetId) {
      cards[receiveId] -= 1;
      cards[giveId] = (cards[giveId] ?? 0) + 1;
    }
    return { ...player, cards };
  });
}

export function minivilleCanBuyEstablishment(player, market, id) {
  const card = minivilleEstablishment(id);
  if (!card || (market[id] ?? 0) <= 0 || player.coins < card.cost) return false;
  return card.color !== "purple" || !minivilleOwns(player, id);
}

export function minivilleBuyEstablishment(players, market, playerId, id) {
  if (!minivilleCanBuyEstablishment(players[playerId], market, id)) return { players, market, bought: false };
  const card = minivilleEstablishment(id);
  return {
    players: players.map((player) => player.id === playerId ? {
      ...player,
      coins: player.coins - card.cost,
      cards: { ...player.cards, [id]: (player.cards[id] ?? 0) + 1 },
    } : player),
    market: { ...market, [id]: market[id] - 1 },
    bought: true,
  };
}

export function minivilleCanBuildLandmark(player, id) {
  const landmark = minivilleLandmark(id);
  return Boolean(landmark && !minivilleHasLandmark(player, id) && player.coins >= landmark.cost);
}

export function minivilleBuildLandmark(players, playerId, id) {
  if (!minivilleCanBuildLandmark(players[playerId], id)) return { players, built: false };
  const landmark = minivilleLandmark(id);
  return {
    players: players.map((player) => player.id === playerId ? {
      ...player,
      coins: player.coins - landmark.cost,
      landmarks: [...player.landmarks, id],
    } : player),
    built: true,
  };
}

export function minivilleWinner(players) {
  return players.find((player) => player.landmarks.length === MINIVILLE_LANDMARKS.length)?.id ?? null;
}

