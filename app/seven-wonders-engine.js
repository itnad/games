export const SW_RESOURCES = ["wood", "stone", "clay", "ore", "glass", "papyrus", "textile"];

export const SW_RESOURCE_LABELS = {
  wood: "목재",
  stone: "석재",
  clay: "점토",
  ore: "광석",
  glass: "유리",
  papyrus: "파피루스",
  textile: "직물",
};

export const SW_COLORS = {
  brown: "원자재",
  gray: "제조품",
  blue: "시민",
  red: "군사",
  green: "과학",
  yellow: "상업",
  purple: "길드",
};

const WONDERS = [
  {
    id: "giza",
    name: "기자의 대피라미드",
    city: "기자",
    symbol: "△",
    resource: "stone",
    stages: [
      { cost: { stone: 2 }, points: 3, label: "석조 기단" },
      { cost: { wood: 3 }, points: 5, label: "왕의 회랑" },
      { cost: { stone: 4 }, points: 7, label: "황금 정상" },
    ],
  },
  {
    id: "ephesos",
    name: "에페소스의 신전",
    city: "에페소스",
    symbol: "☾",
    resource: "papyrus",
    stages: [
      { cost: { stone: 2 }, points: 2, coins: 4, label: "신성한 뜰" },
      { cost: { wood: 2 }, points: 3, coins: 6, label: "여신의 전당" },
      { cost: { papyrus: 2 }, points: 4, coins: 4, label: "대신전" },
    ],
  },
  {
    id: "rhodos",
    name: "로도스의 거상",
    city: "로도스",
    symbol: "♜",
    resource: "ore",
    stages: [
      { cost: { wood: 2 }, points: 3, label: "항구 기단" },
      { cost: { clay: 3 }, military: 2, coins: 3, label: "청동 거상" },
      { cost: { ore: 4 }, points: 4, military: 1, label: "횃불 전망대" },
    ],
  },
  {
    id: "babylon",
    name: "바빌론의 공중정원",
    city: "바빌론",
    symbol: "✿",
    resource: "clay",
    stages: [
      { cost: { clay: 2 }, points: 3, label: "관개 수로" },
      { cost: { wood: 2, glass: 1 }, scienceWild: 1, label: "학자의 정원" },
      { cost: { clay: 3, papyrus: 1 }, points: 5, label: "왕실 정원" },
    ],
  },
  {
    id: "alexandria",
    name: "알렉산드리아의 등대",
    city: "알렉산드리아",
    symbol: "☀",
    resource: "glass",
    stages: [
      { cost: { stone: 2 }, points: 3, label: "방파제" },
      { cost: { ore: 2 }, anyResource: 1, label: "교역 창고" },
      { cost: { glass: 2, papyrus: 1 }, points: 7, label: "대등대" },
    ],
  },
  {
    id: "olympia",
    name: "올림피아의 제우스상",
    city: "올림피아",
    symbol: "⚡",
    resource: "wood",
    stages: [
      { cost: { wood: 2 }, points: 3, label: "성역" },
      { cost: { stone: 2 }, discountAll: true, label: "장인의 공방" },
      { cost: { ore: 2, textile: 1 }, points: 6, label: "제우스상" },
    ],
  },
  {
    id: "halikarnassos",
    name: "할리카르나소스의 영묘",
    city: "할리카르나소스",
    symbol: "◇",
    resource: "textile",
    stages: [
      { cost: { clay: 2 }, points: 3, label: "기념 정원" },
      { cost: { ore: 2, textile: 1 }, points: 4, coins: 4, label: "왕실 묘실" },
      { cost: { stone: 3, glass: 1 }, points: 7, label: "대영묘" },
    ],
  },
];

const CITY_NAMES = [
  "아르고스", "밀레토스", "코린토스", "델포이", "테베", "사르디스", "시돈",
  "수사", "티레", "멤피스", "펠라", "비블로스", "크노소스", "우르", "니네베",
  "페르가몬", "키레네", "타렌툼", "셀레우키아", "안티오키아", "카르타고",
  "시라쿠사", "나우크라티스", "마살리아", "아비도스", "파로스", "델로스",
];

const SCIENCE = ["gear", "tablet", "compass"];

function card(id, age, name, color, cost, effect, chainFrom = null, chainTo = null) {
  return { id, age, name, color, cost, effect, chainFrom, chainTo };
}

function ageOneCards() {
  const deck = [];
  for (let i = 0; i < 49; i += 1) {
    const city = CITY_NAMES[i % CITY_NAMES.length];
    const slot = i % 7;
    if (slot === 0) {
      const resource = ["wood", "stone", "clay", "ore"][i % 4];
      deck.push(card(`I-${i}`, 1, `${city} 채집장`, "brown", {}, { resources: { [resource]: 1 } }));
    } else if (slot === 1) {
      const resource = ["glass", "papyrus", "textile"][i % 3];
      deck.push(card(`I-${i}`, 1, `${city} 공방`, "gray", {}, { resources: { [resource]: 1 } }));
    } else if (slot === 2) {
      deck.push(card(`I-${i}`, 1, `${city} 제단`, "blue", i % 3 ? { wood: 1 } : {}, { points: 3 }, null, `civic-${i % 6}`));
    } else if (slot === 3) {
      deck.push(card(`I-${i}`, 1, `${city} 병영`, "red", i % 2 ? { ore: 1 } : { wood: 1 }, { military: 1 }, null, `military-${i % 5}`));
    } else if (slot === 4) {
      const science = SCIENCE[i % SCIENCE.length];
      deck.push(card(`I-${i}`, 1, `${city} 학당`, "green", { [i % 2 ? "papyrus" : "glass"]: 1 }, { science }, null, `science-${i % 6}`));
    } else if (slot === 5) {
      const side = i % 2 ? "raw" : "manufactured";
      deck.push(card(`I-${i}`, 1, `${city} 시장`, "yellow", {}, { coins: 3, discount: side }, null, `trade-${i % 5}`));
    } else {
      const resource = ["wood", "stone", "clay", "ore"][Math.floor(i / 7) % 4];
      deck.push(card(`I-${i}`, 1, `${city} 저장소`, "brown", { coins: 1 }, { resources: { [resource]: 1 }, points: 1 }));
    }
  }
  return deck;
}

function ageTwoCards() {
  const deck = [];
  for (let i = 0; i < 49; i += 1) {
    const city = CITY_NAMES[(i + 7) % CITY_NAMES.length];
    const slot = i % 7;
    if (slot === 0) {
      const resource = ["wood", "stone", "clay", "ore"][i % 4];
      deck.push(card(`II-${i}`, 2, `${city} 대형 채석장`, "brown", { coins: 1 }, { resources: { [resource]: 2 } }));
    } else if (slot === 1) {
      const resource = ["glass", "papyrus", "textile"][i % 3];
      deck.push(card(`II-${i}`, 2, `${city} 제조소`, { glass: "gray", papyrus: "gray", textile: "gray" }[resource], { clay: 1 }, { resources: { [resource]: 1 }, points: 2 }));
    } else if (slot === 2) {
      deck.push(card(`II-${i}`, 2, `${city} 법정`, "blue", { stone: 2, wood: 1 }, { points: 5 }, `civic-${i % 6}`, `civic3-${i % 6}`));
    } else if (slot === 3) {
      deck.push(card(`II-${i}`, 2, `${city} 성벽`, "red", { ore: 2, stone: 1 }, { military: 2 }, `military-${i % 5}`, `military3-${i % 5}`));
    } else if (slot === 4) {
      const science = SCIENCE[(i + 1) % SCIENCE.length];
      deck.push(card(`II-${i}`, 2, `${city} 연구원`, "green", { wood: 1, [i % 2 ? "textile" : "papyrus"]: 1 }, { science }, `science-${i % 6}`, `science3-${i % 6}`));
    } else if (slot === 5) {
      deck.push(card(`II-${i}`, 2, `${city} 교역소`, "yellow", { wood: 1 }, { coinsPerColor: i % 2 ? "brown" : "gray", pointsPerColor: i % 2 ? "brown" : "gray" }, `trade-${i % 5}`));
    } else {
      const resources = i % 2 ? { wood: 1, stone: 1 } : { clay: 1, ore: 1 };
      deck.push(card(`II-${i}`, 2, `${city} 대상로`, "yellow", { glass: 1 }, { resources, coins: 2 }));
    }
  }
  return deck;
}

function ageThreeCards(playerCount) {
  const regular = [];
  for (let i = 0; i < 42; i += 1) {
    const city = CITY_NAMES[(i + 14) % CITY_NAMES.length];
    const slot = i % 6;
    if (slot === 0) {
      regular.push(card(`III-${i}`, 3, `${city} 원로원`, "blue", { stone: 3, ore: 1 }, { points: 7 }, `civic3-${i % 6}`));
    } else if (slot === 1) {
      regular.push(card(`III-${i}`, 3, `${city} 요새`, "red", { ore: 3, stone: 1 }, { military: 3 }, `military3-${i % 5}`));
    } else if (slot === 2) {
      regular.push(card(`III-${i}`, 3, `${city} 학술원`, "green", { wood: 1, glass: 1, papyrus: 1 }, { science: SCIENCE[(i + 2) % 3] }, `science3-${i % 6}`));
    } else if (slot === 3) {
      regular.push(card(`III-${i}`, 3, `${city} 상업항`, "yellow", { textile: 1, ore: 1 }, { coinsPerColor: "yellow", pointsPerColor: "yellow" }));
    } else if (slot === 4) {
      regular.push(card(`III-${i}`, 3, `${city} 궁전`, "blue", { wood: 1, stone: 1, clay: 1, ore: 1, glass: 1, papyrus: 1, textile: 1 }, { points: 8 }));
    } else {
      regular.push(card(`III-${i}`, 3, `${city} 상인 조합`, "yellow", { papyrus: 1, textile: 1 }, { coinsPerStage: 2, pointsPerStage: 1 }));
    }
  }

  const guilds = [
    ["건축가 길드", "wonder"],
    ["철학자 길드", "green"],
    ["장군 길드", "red"],
    ["행정관 길드", "blue"],
    ["상인 길드", "yellow"],
    ["장인 길드", "brown-gray"],
    ["과학자 길드", "science-wild"],
    ["탐험가 길드", "mixed"],
    ["도시계획가 길드", "wonder-self"],
  ].slice(0, playerCount + 2).map(([name, guild], index) => (
    card(`G-${index}`, 3, name, "purple", { stone: 1, ore: 1, textile: 1 }, { guild })
  ));

  return { regular, guilds };
}

function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function swBuildAgeDeck(age, playerCount, random = Math.random) {
  if (age === 1) return shuffled(ageOneCards(), random).slice(0, playerCount * 7);
  if (age === 2) return shuffled(ageTwoCards(), random).slice(0, playerCount * 7);
  const { regular, guilds } = ageThreeCards(playerCount);
  return shuffled([
    ...shuffled(regular, random).slice(0, playerCount * 7 - guilds.length),
    ...guilds,
  ], random);
}

function blankProduction(resource) {
  return Object.fromEntries(SW_RESOURCES.map((item) => [item, item === resource ? 1 : 0]));
}

export function swCreatePlayer(index, wonder, isHuman = false) {
  const startingProduction = blankProduction(wonder.resource);
  return {
    id: index,
    name: isHuman ? "나" : `AI ${index}`,
    isHuman,
    wonder,
    coins: 3,
    production: startingProduction,
    // Official 2nd-edition trade rule: only a Wonder's printed starting
    // resource and resources on brown/gray cards may be bought by neighbors.
    tradeProduction: { ...startingProduction },
    cards: [],
    stages: [],
    military: 0,
    conflict: [],
    discounts: [],
    scienceWild: 0,
    anyResource: 0,
    log: [],
  };
}

export function swCreateGame(playerCount = 3, difficulty = "balanced", random = Math.random) {
  const wonders = shuffled(WONDERS, random).slice(0, playerCount);
  const players = wonders.map((wonder, index) => swCreatePlayer(index, wonder, index === 0));
  const deck = swBuildAgeDeck(1, playerCount, random);
  const hands = players.map((_, index) => deck.slice(index * 7, index * 7 + 7));
  return {
    playerCount,
    difficulty,
    players,
    hands,
    age: 1,
    pick: 1,
    phase: "draft",
    history: [],
    result: null,
  };
}

function ownResourcePool(player) {
  const pool = [];
  for (const resource of SW_RESOURCES) {
    for (let count = 0; count < (player.production[resource] || 0); count += 1) pool.push(resource);
  }
  return pool;
}

function removeOwnedNeeds(cost, player) {
  const needs = [];
  const pool = ownResourcePool(player);
  for (const resource of SW_RESOURCES) {
    const missing = Math.max(0, (cost?.[resource] || 0) - pool.filter((item) => item === resource).length);
    for (let count = 0; count < missing; count += 1) needs.push(resource);
  }
  let wild = player.anyResource || 0;
  while (wild > 0 && needs.length) {
    needs.pop();
    wild -= 1;
  }
  return needs;
}

function resourcePrice(player, resource) {
  if (player.discounts.includes("all")) return 1;
  if (["wood", "stone", "clay", "ore"].includes(resource) && player.discounts.includes("raw")) return 1;
  if (["glass", "papyrus", "textile"].includes(resource) && player.discounts.includes("manufactured")) return 1;
  return 2;
}

export function swPaymentForCost(players, playerIndex, cost = {}) {
  const player = players[playerIndex];
  const coinCost = cost.coins || 0;
  const needs = removeOwnedNeeds(cost, player);
  const leftIndex = (playerIndex - 1 + players.length) % players.length;
  const rightIndex = (playerIndex + 1) % players.length;
  const left = { ...(players[leftIndex].tradeProduction ?? players[leftIndex].production) };
  const right = { ...(players[rightIndex].tradeProduction ?? players[rightIndex].production) };
  let best = null;

  function visit(index, paymentLeft, paymentRight) {
    if (index >= needs.length) {
      const total = coinCost + paymentLeft + paymentRight;
      if (!best || total < best.total) best = { total, bank: coinCost, left: paymentLeft, right: paymentRight };
      return;
    }
    const resource = needs[index];
    const price = resourcePrice(player, resource);
    if ((left[resource] || 0) > 0) {
      left[resource] -= 1;
      visit(index + 1, paymentLeft + price, paymentRight);
      left[resource] += 1;
    }
    if ((right[resource] || 0) > 0) {
      right[resource] -= 1;
      visit(index + 1, paymentLeft, paymentRight + price);
      right[resource] += 1;
    }
  }

  visit(0, 0, 0);
  if (!best || best.total > player.coins) return null;
  return { ...best, leftIndex, rightIndex };
}

export function swCanBuildCard(players, playerIndex, selectedCard) {
  const player = players[playerIndex];
  if (player.cards.some((built) => built.name === selectedCard.name)) return null;
  if (selectedCard.chainFrom && player.cards.some((built) => built.chainTo === selectedCard.chainFrom)) {
    return { total: 0, bank: 0, left: 0, right: 0, leftIndex: null, rightIndex: null, chain: true };
  }
  return swPaymentForCost(players, playerIndex, selectedCard.cost);
}

export function swCanBuildWonder(players, playerIndex) {
  const player = players[playerIndex];
  const stage = player.wonder.stages[player.stages.length];
  if (!stage) return null;
  return swPaymentForCost(players, playerIndex, stage.cost);
}

function countColors(player) {
  return player.cards.reduce((counts, built) => {
    counts[built.color] = (counts[built.color] || 0) + 1;
    return counts;
  }, {});
}

function applyEffect(player, effect, players, tradeable = false) {
  const next = {
    ...player,
    production: { ...player.production },
    tradeProduction: { ...(player.tradeProduction ?? player.production) },
  };
  if (effect.resources) {
    for (const [resource, count] of Object.entries(effect.resources)) {
      next.production[resource] = (next.production[resource] || 0) + count;
      if (tradeable) next.tradeProduction[resource] = (next.tradeProduction[resource] || 0) + count;
    }
  }
  if (effect.military) next.military += effect.military;
  if (effect.scienceWild) next.scienceWild += effect.scienceWild;
  if (effect.anyResource) next.anyResource += effect.anyResource;
  if (effect.discount && !next.discounts.includes(effect.discount)) next.discounts = [...next.discounts, effect.discount];
  if (effect.discountAll && !next.discounts.includes("all")) next.discounts = [...next.discounts, "all"];
  let coins = effect.coins || 0;
  if (effect.coinsPerColor) {
    const colors = countColors(next);
    const ownIndex = players.findIndex((item) => item.id === player.id);
    const neighbors = ownIndex < 0 ? [] : [
      players[(ownIndex - 1 + players.length) % players.length],
      players[(ownIndex + 1) % players.length],
    ];
    coins += (colors[effect.coinsPerColor] || 0) + neighbors.reduce((sum, item) => sum + (countColors(item)[effect.coinsPerColor] || 0), 0);
  }
  if (effect.coinsPerStage) coins += next.stages.length * effect.coinsPerStage;
  next.coins += coins;
  return next;
}

function applyPayment(players, playerIndex, payment) {
  const result = players.map((player) => ({ ...player }));
  result[playerIndex].coins -= payment.total;
  if (payment.left) result[payment.leftIndex].coins += payment.left;
  if (payment.right) result[payment.rightIndex].coins += payment.right;
  return result;
}

export function swResolveSelections(state, selections) {
  let players = state.players.map((player) => ({
    ...player,
    production: { ...player.production },
    tradeProduction: { ...(player.tradeProduction ?? player.production) },
    cards: [...player.cards],
    stages: [...player.stages],
    conflict: [...player.conflict],
    log: [...player.log],
  }));
  const chosen = selections.map((selection, index) => ({
    ...selection,
    card: state.hands[index][selection.cardIndex],
  }));
  const planned = chosen.map((selection, index) => {
    if (selection.action === "wonder") {
      return {
        payment: swCanBuildWonder(state.players, index),
        stage: state.players[index].wonder.stages[state.players[index].stages.length],
      };
    }
    if (selection.action === "build") {
      return { payment: swCanBuildCard(state.players, index, selection.card), stage: null };
    }
    return { payment: null, stage: null };
  });

  for (let index = 0; index < chosen.length; index += 1) {
    const selection = chosen[index];
    if (!selection.card) continue;
    if (selection.action === "discard") {
      players[index].coins += 3;
      players[index].log.push(`${selection.card.name} 폐기 (+3 코인)`);
      continue;
    }
    if (selection.action === "wonder") {
      const { payment, stage } = planned[index];
      if (!payment || !stage) {
        players[index].coins += 3;
        continue;
      }
      players = applyPayment(players, index, payment);
      players[index].stages.push({ ...stage, buriedCard: selection.card.name });
      players[index] = applyEffect(players[index], stage, players, false);
      players[index].log.push(`${stage.label} 완성`);
      continue;
    }
    const { payment } = planned[index];
    if (!payment) {
      players[index].coins += 3;
      continue;
    }
    players = applyPayment(players, index, payment);
    players[index].cards.push(selection.card);
    players[index] = applyEffect(
      players[index],
      selection.card.effect,
      players,
      selection.card.color === "brown" || selection.card.color === "gray",
    );
    players[index].log.push(`${selection.card.name} 건설`);
  }

  const remaining = state.hands.map((hand, index) => hand.filter((_, cardIndex) => cardIndex !== chosen[index].cardIndex));
  const history = [...state.history, {
    age: state.age,
    pick: state.pick,
    choices: chosen.map((choice, index) => ({
      player: players[index].name,
      card: choice.card?.name,
      action: choice.action,
    })),
  }];

  if (state.pick < 6) {
    const receiveOffset = state.age === 2 ? -1 : 1;
    const hands = remaining.map((_, index) => remaining[(index + receiveOffset + players.length) % players.length]);
    return { ...state, players, hands, pick: state.pick + 1, history };
  }

  players = swResolveMilitary(players, state.age);
  if (state.age === 3) {
    const result = swFinalRanking(players);
    return { ...state, players, hands: [], phase: "finished", history, result };
  }

  const age = state.age + 1;
  const deck = swBuildAgeDeck(age, state.playerCount);
  const hands = players.map((_, index) => deck.slice(index * 7, index * 7 + 7));
  return { ...state, players, hands, age, pick: 1, history };
}

export function swResolveMilitary(players, age) {
  const reward = [0, 1, 3, 5][age];
  const tokens = players.map(() => []);
  for (let index = 0; index < players.length; index += 1) {
    const right = (index + 1) % players.length;
    if (players[index].military > players[right].military) {
      tokens[index].push(reward);
      tokens[right].push(-1);
    } else if (players[index].military < players[right].military) {
      tokens[index].push(-1);
      tokens[right].push(reward);
    }
  }
  return players.map((player, index) => ({ ...player, conflict: [...player.conflict, ...tokens[index]] }));
}

function scienceScore(symbols, wild) {
  let best = 0;
  function search(gear, tablet, compass, remaining) {
    if (!remaining) {
      best = Math.max(best, gear ** 2 + tablet ** 2 + compass ** 2 + Math.min(gear, tablet, compass) * 7);
      return;
    }
    search(gear + 1, tablet, compass, remaining - 1);
    search(gear, tablet + 1, compass, remaining - 1);
    search(gear, tablet, compass + 1, remaining - 1);
  }
  search(symbols.gear || 0, symbols.tablet || 0, symbols.compass || 0, wild);
  return best;
}

export function swScorePlayer(player, players) {
  const colors = countColors(player);
  const science = player.cards.reduce((result, built) => {
    if (built.effect.science) result[built.effect.science] = (result[built.effect.science] || 0) + 1;
    return result;
  }, {});
  let civic = 0;
  let commerce = 0;
  let guilds = 0;
  for (const built of player.cards) {
    civic += built.effect.points || 0;
    if (built.effect.pointsPerColor) commerce += colors[built.effect.pointsPerColor] || 0;
    if (built.effect.pointsPerStage) commerce += player.stages.length * built.effect.pointsPerStage;
    if (built.effect.guild) {
      const neighbors = players.filter((_, index) => {
        const ownIndex = players.indexOf(player);
        return index === (ownIndex - 1 + players.length) % players.length || index === (ownIndex + 1) % players.length;
      });
      if (built.effect.guild === "wonder") guilds += neighbors.reduce((sum, item) => sum + item.stages.length, 0);
      else if (built.effect.guild === "wonder-self") guilds += player.stages.length * 2;
      else if (built.effect.guild === "brown-gray") guilds += neighbors.reduce((sum, item) => {
        const c = countColors(item);
        return sum + (c.brown || 0) + (c.gray || 0);
      }, 0);
      else if (built.effect.guild === "science-wild") player = { ...player, scienceWild: player.scienceWild + 1 };
      else if (built.effect.guild === "mixed") guilds += new Set(player.cards.map((item) => item.color)).size;
      else guilds += neighbors.reduce((sum, item) => sum + (countColors(item)[built.effect.guild] || 0), 0);
    }
  }
  const wonder = player.stages.reduce((sum, stage) => sum + (stage.points || 0), 0);
  const military = player.conflict.reduce((sum, token) => sum + token, 0);
  const scientific = scienceScore(science, player.scienceWild);
  const treasury = Math.floor(player.coins / 3);
  const total = civic + commerce + guilds + wonder + military + scientific + treasury;
  return { civic, commerce, guilds, wonder, military, science: scientific, treasury, total };
}

export function swFinalRanking(players) {
  return players
    .map((player) => ({ playerId: player.id, name: player.name, city: player.wonder.city, score: swScorePlayer(player, players), coins: player.coins }))
    .sort((a, b) => b.score.total - a.score.total || b.coins - a.coins);
}

export function swWinningEntries(players) {
  const ranking = swFinalRanking(players);
  const first = ranking[0];
  if (!first) return [];
  return ranking.filter((entry) => entry.score.total === first.score.total && entry.coins === first.coins);
}

function estimateCardValue(state, playerIndex, selectedCard, difficulty) {
  const player = state.players[playerIndex];
  const effect = selectedCard.effect;
  const payment = swCanBuildCard(state.players, playerIndex, selectedCard);
  if (!payment) return -50;
  let value = (effect.points || 0) * 2.2 + (effect.military || 0) * (2 + state.age);
  if (effect.resources) value += Object.values(effect.resources).reduce((sum, count) => sum + count, 0) * (state.age === 1 ? 5 : 2.5);
  if (effect.science) {
    const same = player.cards.filter((built) => built.effect.science === effect.science).length;
    value += 5 + same * 3;
  }
  if (effect.discount) value += state.age === 1 ? 4 : 1;
  if (effect.pointsPerColor || effect.guild) value += 5;
  value += (effect.coins || 0) * 0.55;
  value -= payment.total * 0.7;
  if (difficulty === "strategist") {
    const left = state.players[(playerIndex - 1 + state.players.length) % state.players.length];
    const right = state.players[(playerIndex + 1) % state.players.length];
    if (effect.military && player.military <= Math.max(left.military, right.military)) value += 4;
    if (effect.science && [left, right].some((item) => item.cards.filter((built) => built.effect.science === effect.science).length >= 2)) value += 2;
  }
  return value + Math.random() * (difficulty === "builder" ? 4 : 1.2);
}

export function swChooseAiSelection(state, playerIndex) {
  const hand = state.hands[playerIndex];
  const scored = hand.map((selectedCard, cardIndex) => ({
    cardIndex,
    value: estimateCardValue(state, playerIndex, selectedCard, state.difficulty),
  })).sort((a, b) => b.value - a.value);
  if (scored[0]?.value > -20) return { cardIndex: scored[0].cardIndex, action: "build" };

  const wonderPayment = swCanBuildWonder(state.players, playerIndex);
  if (wonderPayment && state.players[playerIndex].stages.length < 3) {
    const weakest = [...scored].sort((a, b) => a.value - b.value)[0];
    return { cardIndex: weakest.cardIndex, action: "wonder" };
  }
  return { cardIndex: scored[0]?.cardIndex ?? 0, action: "discard" };
}

export function swCardSummary(selectedCard) {
  const effect = selectedCard.effect;
  if (effect.resources) return Object.entries(effect.resources).map(([resource, count]) => `${SW_RESOURCE_LABELS[resource]} ${count}`).join(" · ");
  if (effect.points) return `승점 ${effect.points}`;
  if (effect.military) return `방패 ${effect.military}`;
  if (effect.science) return { gear: "톱니", tablet: "서판", compass: "컴퍼스" }[effect.science];
  if (effect.guild) return "이웃 문명에 따른 보너스";
  if (effect.discount) return "이웃 자원 거래 할인";
  if (effect.coinsPerColor) return "건물 색상별 보너스";
  return `코인 ${effect.coins || 0}`;
}

export function swCostLabel(cost = {}) {
  const parts = Object.entries(cost)
    .filter(([key, value]) => key !== "coins" && value)
    .map(([resource, count]) => `${SW_RESOURCE_LABELS[resource]}×${count}`);
  if (cost.coins) parts.push(`${cost.coins}코인`);
  return parts.length ? parts.join(" ") : "무료";
}
