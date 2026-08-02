import { withKoreanSubject } from "./korean-particles.js";

export const PICK_PICNIC_YARDS = [
  { id: "yellow", name: "꼬꼬 마당", bird: "닭", icon: "🐔", color: "#efbf45" },
  { id: "blue", name: "뒤뚱 연못", bird: "오리", icon: "🦆", color: "#70b8d4" },
  { id: "purple", name: "보랏빛 뜰", bird: "꿩", icon: "🦃", color: "#a786c7" },
  { id: "green", name: "푸른 목장", bird: "거위", icon: "🪿", color: "#79b887" },
  { id: "red", name: "붉은 헛간", bird: "칠면조", icon: "🐓", color: "#df7464" },
  { id: "black", name: "별밤 우리", bird: "뿔닭", icon: "🐦", color: "#5a5e70" },
];

export const PICK_PICNIC_GRAINS = {
  green: { name: "초록", value: 1, color: "#7eb86d" },
  blue: { name: "파랑", value: 2, color: "#67a9d0" },
  gold: { name: "노랑", value: 3, color: "#e8b83e" },
};

const POULTRY_VALUES = [-2, 3, 4, 5, 6];
const FOX_VALUES = [4, 6];

export function pickPicnicShuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function pickPicnicCreateDeck(random = Math.random) {
  const cards = [];
  for (const yard of PICK_PICNIC_YARDS) {
    for (const value of POULTRY_VALUES) {
      cards.push({
        uid: `${yard.id}-bird-${value}`,
        yardId: yard.id,
        kind: "bird",
        value,
        name: value === -2 ? `겁쟁이 ${yard.bird}` : yard.bird,
      });
    }
    for (const value of FOX_VALUES) {
      cards.push({
        uid: `${yard.id}-fox-${value}`,
        yardId: yard.id,
        kind: "fox",
        value,
        name: "여우",
      });
    }
  }
  return pickPicnicShuffle(cards, random);
}

export function pickPicnicCreateBag(random = Math.random) {
  return pickPicnicShuffle([
    ...Array(33).fill("green"),
    ...Array(22).fill("blue"),
    ...Array(11).fill("gold"),
  ], random);
}

export function pickPicnicHandSize(playerCount) {
  return playerCount <= 3 ? 6 : 5;
}

function clonePlayer(player) {
  return {
    ...player,
    hand: [...player.hand],
    grains: { ...player.grains },
    captured: [...player.captured],
  };
}

export function pickPicnicDraw(players, deck, discard, playerCount, random = Math.random) {
  let drawPile = [...deck];
  let discardPile = [...discard];
  const nextPlayers = players.map(clonePlayer);
  const handSize = pickPicnicHandSize(playerCount);

  for (const player of nextPlayers) {
    while (player.hand.length < handSize) {
      if (!drawPile.length && discardPile.length) {
        drawPile = pickPicnicShuffle(discardPile, random);
        discardPile = [];
      }
      const card = drawPile.pop();
      if (!card) break;
      player.hand.push(card);
    }
  }
  return { players: nextPlayers, deck: drawPile, discard: discardPile };
}

export function pickPicnicSupply(yards, bag) {
  const nextYards = yards.map((yard) => ({ ...yard, grains: [...yard.grains] }));
  const nextBag = [...bag];
  let supplied = 0;
  for (const yard of nextYards) {
    const grain = nextBag.pop();
    if (!grain) break;
    yard.grains.push(grain);
    supplied += 1;
  }
  return { yards: nextYards, bag: nextBag, supplied, lastRound: nextBag.length < 6 };
}

export function pickPicnicCreateGame(playerCount, random = Math.random) {
  const names = ["나", "토리", "모모", "루루", "피코", "보리"];
  const players = Array.from({ length: playerCount }, (_, id) => ({
    id,
    name: names[id],
    hand: [],
    grains: { green: 0, blue: 0, gold: 0 },
    captured: [],
  }));
  const draw = pickPicnicDraw(players, pickPicnicCreateDeck(random), [], playerCount, random);
  const supplied = pickPicnicSupply(
    PICK_PICNIC_YARDS.map((yard) => ({ ...yard, grains: [] })),
    pickPicnicCreateBag(random),
  );
  return {
    players: draw.players,
    deck: draw.deck,
    discard: draw.discard,
    yards: supplied.yards,
    bag: supplied.bag,
    lastRound: supplied.lastRound,
  };
}

export function pickPicnicGrainScore(grains) {
  return Object.entries(PICK_PICNIC_GRAINS).reduce(
    (sum, [color, grain]) => sum + (grains[color] ?? 0) * grain.value,
    0,
  );
}

export function pickPicnicPlayerScore(player) {
  return pickPicnicGrainScore(player.grains) +
    player.captured.reduce((sum, card) => sum + card.value, 0);
}

export function pickPicnicDuel(entries, random = Math.random) {
  let contenders = [...entries];
  const rounds = [];
  let guard = 0;
  while (contenders.length > 1 && guard < 20) {
    const rolls = contenders.map((entry) => {
      const die = Math.floor(random() * 6) + 1;
      return { ...entry, die, total: die + entry.card.value };
    });
    const best = Math.max(...rolls.map((entry) => entry.total));
    contenders = rolls.filter((entry) => entry.total === best);
    rounds.push(rolls);
    guard += 1;
  }
  return { winner: contenders[0], rounds };
}

function giveGrains(player, grains) {
  for (const grain of grains) player.grains[grain] = (player.grains[grain] ?? 0) + 1;
}

export function pickPicnicFairShare(grains, entries) {
  const order = [...entries].sort((a, b) => b.card.value - a.card.value || a.playerId - b.playerId);
  const valuable = [...grains].sort(
    (a, b) => PICK_PICNIC_GRAINS[b].value - PICK_PICNIC_GRAINS[a].value,
  );
  const shares = Object.fromEntries(order.map((entry) => [entry.playerId, []]));
  valuable.forEach((grain, index) => shares[order[index % order.length].playerId].push(grain));
  return shares;
}

export function pickPicnicHumanConflicts(plays) {
  return PICK_PICNIC_YARDS.filter((yard) => {
    const entries = plays.filter((entry) => entry.card.yardId === yard.id);
    const birds = entries.filter((entry) => entry.card.kind === "bird" && entry.card.value !== -2);
    return !entries.some((entry) => entry.card.kind === "fox") &&
      birds.length > 1 &&
      birds.some((entry) => entry.playerId === 0);
  }).map((yard) => yard.id);
}

function summarizeDuel(duel, players) {
  const finalRound = duel.rounds.at(-1) ?? [];
  return finalRound.map((entry) =>
    `${players[entry.playerId].name} ${entry.card.value}+⚄${entry.die}=${entry.total}`,
  ).join(" · ");
}

export function pickPicnicResolveRound(game, plays, decisions = {}, random = Math.random) {
  const players = game.players.map(clonePlayer);
  const yards = game.yards.map((yard) => ({ ...yard, grains: [...yard.grains] }));
  const discarded = [];
  const capturedIds = new Set();
  const events = [];
  const duels = [];

  for (const yard of yards) {
    const entries = plays.filter((entry) => entry.card.yardId === yard.id);
    if (!entries.length) continue;
    const foxes = entries.filter((entry) => entry.card.kind === "fox");
    const birds = entries.filter((entry) => entry.card.kind === "bird");
    const fleet = birds.filter((entry) => entry.card.value === -2);
    const company = entries.length > 1;

    if (company) {
      for (const entry of fleet) {
        const greenIndex = yard.grains.indexOf("green");
        if (greenIndex >= 0) {
          yard.grains.splice(greenIndex, 1);
          giveGrains(players[entry.playerId], ["green"]);
          events.push(`${players[entry.playerId].name}의 겁쟁이가 초록 먹이 하나를 낚아챘습니다.`);
        }
      }
    }

    if (foxes.length) {
      if (!birds.length) {
        events.push(`${yard.name}: 여우만 찾아와 빈손으로 돌아갔습니다.`);
      } else {
        const duel = foxes.length === 1 ? { winner: foxes[0], rounds: [] } : pickPicnicDuel(foxes, random);
        const winner = duel.winner;
        for (const bird of birds) {
          players[winner.playerId].captured.push(bird.card);
          capturedIds.add(bird.card.uid);
        }
        if (duel.rounds.length) {
          const detail = summarizeDuel(duel, players);
          duels.push({ yardId: yard.id, detail, winnerId: winner.playerId });
          events.push(`${yard.name}: ${detail} · ${players[winner.playerId].name}의 여우 승리!`);
        } else {
          events.push(`${yard.name}: ${players[winner.playerId].name}의 여우가 새 ${birds.length}마리를 잡았습니다.`);
        }
      }
      discarded.push(...foxes.map((entry) => entry.card));
      for (const bird of birds) if (!capturedIds.has(bird.card.uid)) discarded.push(bird.card);
      continue;
    }

    const contenders = company ? birds.filter((entry) => entry.card.value !== -2) : birds;
    for (const entry of fleet) {
      if (company) discarded.push(entry.card);
    }
    if (!contenders.length) continue;
    if (contenders.length === 1) {
      const winner = contenders[0];
      giveGrains(players[winner.playerId], yard.grains);
      events.push(`${yard.name}: ${withKoreanSubject(players[winner.playerId].name)} 먹이 ${yard.grains.length}개를 모두 먹었습니다.`);
      yard.grains = [];
    } else {
      const mode = decisions[yard.id] ?? (random() < 0.55 ? "share" : "duel");
      if (mode === "share") {
        const shares = pickPicnicFairShare(yard.grains, contenders);
        for (const entry of contenders) giveGrains(players[entry.playerId], shares[entry.playerId]);
        events.push(`${yard.name}: 새들이 먹이를 사이좋게 나눴습니다.`);
        yard.grains = [];
      } else {
        const duel = pickPicnicDuel(contenders, random);
        giveGrains(players[duel.winner.playerId], yard.grains);
        const detail = summarizeDuel(duel, players);
        duels.push({ yardId: yard.id, detail, winnerId: duel.winner.playerId });
        events.push(`${yard.name}: ${detail} · ${withKoreanSubject(players[duel.winner.playerId].name)} 먹이를 차지했습니다.`);
        yard.grains = [];
      }
    }
    discarded.push(...contenders.map((entry) => entry.card));
  }

  const playedIds = new Set(plays.map((entry) => entry.card.uid));
  for (const player of players) player.hand = player.hand.filter((card) => !playedIds.has(card.uid));
  return {
    players,
    yards,
    discard: [...game.discard, ...discarded],
    events,
    duels,
  };
}

export function pickPicnicChooseAiCards(player, yards, count, random = Math.random) {
  const scored = player.hand.map((card) => {
    const yard = yards.find((item) => item.id === card.yardId);
    const food = pickPicnicGrainScore(
      yard.grains.reduce((counts, grain) => ({ ...counts, [grain]: (counts[grain] ?? 0) + 1 }), {}),
    );
    const score = card.kind === "fox"
      ? food * 0.65 + card.value * 0.35 + random() * 4
      : food + Math.max(card.value, 0) * 0.25 + (card.value === -2 && yard.grains.includes("green") ? 1.5 : 0) + random() * 4;
    return { card, score };
  }).sort((a, b) => b.score - a.score);

  const chosen = [];
  for (const item of scored) {
    if (chosen.some((card) => card.yardId === item.card.yardId)) continue;
    chosen.push(item.card);
    if (chosen.length === count) break;
  }
  return chosen;
}

export function pickPicnicNextRound(game, random = Math.random) {
  const draw = pickPicnicDraw(game.players, game.deck, game.discard, game.players.length, random);
  const supplied = pickPicnicSupply(game.yards, game.bag);
  return {
    ...game,
    players: draw.players,
    deck: draw.deck,
    discard: draw.discard,
    yards: supplied.yards,
    bag: supplied.bag,
    lastRound: supplied.lastRound,
  };
}
