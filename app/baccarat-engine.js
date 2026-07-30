export const BACCARAT_SUITS = [
  { id: "spade", symbol: "♠", color: "black" },
  { id: "heart", symbol: "♥", color: "red" },
  { id: "diamond", symbol: "♦", color: "red" },
  { id: "club", symbol: "♣", color: "black" },
];

export const BACCARAT_BETS = {
  player: { label: "플레이어", payout: "1 : 1" },
  banker: { label: "뱅커", payout: "0.95 : 1" },
  tie: { label: "타이", payout: "8 : 1" },
};

const RANKS = [
  { rank: "A", value: 1 },
  ...Array.from({ length: 9 }, (_, index) => ({ rank: String(index + 2), value: index + 2 })),
  { rank: "J", value: 0 },
  { rank: "Q", value: 0 },
  { rank: "K", value: 0 },
];

function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function baccaratBuildShoe(decks = 8, random = Math.random) {
  const cards = [];
  for (let deck = 0; deck < decks; deck += 1) {
    for (const suit of BACCARAT_SUITS) {
      for (const item of RANKS) {
        cards.push({
          id: `${deck}-${suit.id}-${item.rank}`,
          suit: suit.id,
          symbol: suit.symbol,
          color: suit.color,
          rank: item.rank,
          value: item.value,
        });
      }
    }
  }
  return shuffled(cards, random);
}

export function baccaratPoint(cards) {
  return cards.reduce((sum, card) => sum + card.value, 0) % 10;
}

export function baccaratShouldBankerDraw(bankerTotal, playerThirdValue = null) {
  if (playerThirdValue == null) return bankerTotal <= 5;
  if (bankerTotal <= 2) return true;
  if (bankerTotal === 3) return playerThirdValue !== 8;
  if (bankerTotal === 4) return playerThirdValue >= 2 && playerThirdValue <= 7;
  if (bankerTotal === 5) return playerThirdValue >= 4 && playerThirdValue <= 7;
  if (bankerTotal === 6) return playerThirdValue === 6 || playerThirdValue === 7;
  return false;
}

export function baccaratResolveHands(initialPlayer, initialBanker, drawCard) {
  const playerCards = [...initialPlayer];
  const bankerCards = [...initialBanker];
  const initialPlayerTotal = baccaratPoint(playerCards);
  const initialBankerTotal = baccaratPoint(bankerCards);
  const natural = initialPlayerTotal >= 8 || initialBankerTotal >= 8;
  let playerDrew = false;
  let bankerDrew = false;

  if (!natural && initialPlayerTotal <= 5) {
    playerCards.push(drawCard());
    playerDrew = true;
  }

  const playerThirdValue = playerDrew ? playerCards[2].value : null;
  if (!natural && baccaratShouldBankerDraw(initialBankerTotal, playerThirdValue)) {
    bankerCards.push(drawCard());
    bankerDrew = true;
  }

  const playerTotal = baccaratPoint(playerCards);
  const bankerTotal = baccaratPoint(bankerCards);
  const winner = playerTotal === bankerTotal ? "tie" : playerTotal > bankerTotal ? "player" : "banker";
  return {
    playerCards,
    bankerCards,
    playerTotal,
    bankerTotal,
    initialPlayerTotal,
    initialBankerTotal,
    natural,
    playerDrew,
    bankerDrew,
    winner,
  };
}

function cloneState(state) {
  return {
    ...state,
    shoe: [...state.shoe],
    history: state.history.map((item) => ({ ...item })),
    stats: { ...state.stats },
    lastRound: state.lastRound
      ? {
          ...state.lastRound,
          playerCards: [...state.lastRound.playerCards],
          bankerCards: [...state.lastRound.bankerCards],
        }
      : null,
  };
}

export function baccaratCreateGame(options = {}, random = Math.random) {
  const roundLimit = Math.min(30, Math.max(5, options.roundLimit || 10));
  const startingChips = Math.max(100, options.startingChips || 1000);
  return {
    phase: "betting",
    round: 1,
    roundLimit,
    startingChips,
    chips: startingChips,
    shoe: baccaratBuildShoe(8, random),
    history: [],
    stats: { player: 0, banker: 0, tie: 0 },
    lastRound: null,
    message: "플레이어, 뱅커, 타이 중 결과를 예측하세요.",
  };
}

export function baccaratPayout(betType, winner, amount) {
  if (winner === "tie" && betType !== "tie") return 0;
  if (betType !== winner) return -amount;
  if (winner === "banker") return amount * 0.95;
  if (winner === "tie") return amount * 8;
  return amount;
}

export function baccaratPlayRound(state, betType, amount) {
  if (state.phase !== "betting" || !BACCARAT_BETS[betType]) return state;
  if (!Number.isFinite(amount) || amount < 10 || amount > state.chips) return state;
  const next = cloneState(state);
  if (next.shoe.length < 12) next.shoe = baccaratBuildShoe(8);
  const draw = () => next.shoe.shift();
  const playerInitial = [draw()];
  const bankerInitial = [draw()];
  playerInitial.push(draw());
  bankerInitial.push(draw());
  const result = baccaratResolveHands(playerInitial, bankerInitial, draw);
  const profit = baccaratPayout(betType, result.winner, amount);
  next.chips = Math.round((next.chips + profit) * 100) / 100;
  next.stats[result.winner] += 1;
  next.lastRound = {
    ...result,
    betType,
    amount,
    profit,
    round: next.round,
  };
  next.history.push({
    round: next.round,
    winner: result.winner,
    playerTotal: result.playerTotal,
    bankerTotal: result.bankerTotal,
  });
  next.phase = "result";
  const resultLabel = BACCARAT_BETS[result.winner].label;
  next.message = profit > 0
    ? `${resultLabel} 적중 · ${profit}칩 획득`
    : profit === 0
      ? `타이 · ${amount}칩이 반환됩니다`
      : `${resultLabel} 승리 · ${Math.abs(profit)}칩 손실`;
  return next;
}

export function baccaratNextRound(state) {
  if (state.phase !== "result") return state;
  const next = cloneState(state);
  if (next.round >= next.roundLimit || next.chips < 10) {
    next.phase = "finished";
    next.message = next.chips > next.startingChips
      ? `시작보다 ${next.chips - next.startingChips}칩을 늘렸습니다.`
      : next.chips === next.startingChips
        ? "시작 칩을 그대로 지켰습니다."
        : `시작보다 ${next.startingChips - next.chips}칩이 줄었습니다.`;
    return next;
  }
  next.round += 1;
  next.phase = "betting";
  next.lastRound = null;
  next.message = "다음 결과를 예측하고 가상 칩을 놓으세요.";
  return next;
}

export function baccaratFinishGame(state) {
  if (state.phase === "finished") return state;
  const next = cloneState(state);
  next.phase = "finished";
  next.message = next.chips >= next.startingChips
    ? `시작보다 ${next.chips - next.startingChips}칩 앞선 채 마쳤습니다.`
    : `시작보다 ${next.startingChips - next.chips}칩 적은 채 마쳤습니다.`;
  return next;
}
