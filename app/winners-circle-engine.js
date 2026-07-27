export const WC_TRACK_FINISH = 32;
export const WC_PACE_AT = 16;
export const WC_BET_VALUES = [1, 1, 2];

export const WC_SYMBOLS = [
  { id: "horse", label: "말", icon: "♞", sides: 3 },
  { id: "cap", label: "모자", icon: "♟", sides: 1 },
  { id: "saddle", label: "안장", icon: "◒", sides: 1 },
  { id: "shoe", label: "편자", icon: "Ω", sides: 1 },
];

export const WC_PAYOUTS = {
  win: [0, 500, 350, 250, 200, 150, 100],
  place: [0, 350, 250, 200, 150, 100, 100],
  show: [0, 250, 200, 150, 100, 100, 50],
};

const HORSE_IDENTITIES = [
  { name: "새벽별", color: "#d9a431" },
  { name: "청풍", color: "#4e91c5" },
  { name: "홍염", color: "#d95f54" },
  { name: "은하", color: "#8e929c" },
  { name: "초원", color: "#4f9e69" },
  { name: "자수정", color: "#8463b8" },
  { name: "흑진주", color: "#343440" },
];

const PROFILES = [
  { horse: 7, cap: 4, saddle: 2, shoe: 1 },
  { horse: 6, cap: 2, saddle: 5, shoe: 1 },
  { horse: 5, cap: 7, saddle: 2, shoe: 1 },
  { horse: 5, cap: 3, saddle: 6, shoe: 2 },
  { horse: 4, cap: 8, saddle: 3, shoe: 2 },
  { horse: 4, cap: 5, saddle: 7, shoe: 2 },
  { horse: 3, cap: 6, saddle: 4, shoe: 8 },
];

export function createRaceHorses(race = 1) {
  const offset = ((race - 1) * 2) % PROFILES.length;
  return HORSE_IDENTITIES.map((identity, index) => ({
    id: index,
    ...identity,
    position: -index,
    finishedRank: null,
    stats: { ...PROFILES[(index + offset) % PROFILES.length] },
  }));
}

export function wcRollSymbol(random = Math.random) {
  const face = Math.floor(random() * 6);
  return face < 3 ? "horse" : WC_SYMBOLS[face - 2].id;
}

export function wcAvailableHorseIds(horses, usedHorseIds = []) {
  const live = horses.filter((horse) => !horse.finishedRank);
  const used = new Set(usedHorseIds.filter((id) => live.some((horse) => horse.id === id)));
  const unused = live.filter((horse) => !used.has(horse.id));
  return (unused.length ? unused : live).map((horse) => horse.id);
}

/**
 * @param {Array<any>} horses
 * @param {number} horseId
 * @param {string} symbol
 * @param {number[]} usedHorseIds
 * @param {number|null} paceHorseId
 */
export function wcMoveHorse(horses, horseId, symbol, usedHorseIds = [], paceHorseId = null) {
  const available = wcAvailableHorseIds(horses, usedHorseIds);
  if (!available.includes(horseId)) {
    return { horses, usedHorseIds, paceHorseId, moved: 0 };
  }

  const current = horses.find((horse) => horse.id === horseId);
  const distance = current?.stats?.[symbol] ?? 0;
  const occupied = new Set(
    horses
      .filter((horse) => horse.id !== horseId && !horse.finishedRank)
      .map((horse) => horse.position),
  );

  let target = (current?.position ?? 0) + distance;
  if (target < WC_TRACK_FINISH) {
    while (target > (current?.position ?? 0) && occupied.has(target)) target -= 1;
  }

  const rank = target >= WC_TRACK_FINISH
    ? horses.filter((horse) => horse.finishedRank).length + 1
    : null;
  const nextHorses = horses.map((horse) =>
    horse.id === horseId
      ? { ...horse, position: rank ? WC_TRACK_FINISH : target, finishedRank: rank }
      : horse,
  );

  const nextPaceHorseId =
    paceHorseId == null &&
    (current?.position ?? 0) < WC_PACE_AT &&
    target >= WC_PACE_AT
      ? horseId
      : paceHorseId;

  const stillLive = nextHorses.filter((horse) => !horse.finishedRank);
  let nextUsed = [...usedHorseIds.filter((id) => stillLive.some((horse) => horse.id === id)), horseId]
    .filter((id, index, list) => list.indexOf(id) === index);
  if (stillLive.every((horse) => nextUsed.includes(horse.id))) nextUsed = [];

  return {
    horses: nextHorses,
    usedHorseIds: nextUsed,
    paceHorseId: nextPaceHorseId,
    moved: Math.max(0, target - (current?.position ?? 0)),
  };
}

function betValue(bets, horseId) {
  return bets.find((bet) => bet.horseId === horseId)?.value ?? 0;
}

export function wcSettleRace(horses, playerBets, aiBets, paceHorseId, race) {
  const podium = horses
    .filter((horse) => horse.finishedRank && horse.finishedRank <= 3)
    .sort((a, b) => a.finishedRank - b.finishedRank);
  const lastHorse = horses
    .filter((horse) => !horse.finishedRank)
    .sort((a, b) => a.position - b.position)[0] ?? null;
  const payoutKeys = ["win", "place", "show"];
  const multiplier = race === 3 ? 2 : 1;

  function calculate(bets) {
    let gross = 0;
    const lines = [];

    podium.forEach((horse, index) => {
      const value = betValue(bets, horse.id);
      if (!value) return;
      const totalUnits = betValue(playerBets, horse.id) + betValue(aiBets, horse.id);
      const table = WC_PAYOUTS[payoutKeys[index]];
      const perUnit = table[Math.max(1, Math.min(totalUnits, table.length - 1))];
      let amount = perUnit * value;
      if (horse.id === paceHorseId) amount += 100 * value;
      gross += amount;
      lines.push({
        horseId: horse.id,
        label: `${index + 1}위${horse.id === paceHorseId ? " · 선두마 보너스" : ""}`,
        amount: amount * multiplier,
      });
    });

    const lastValue = lastHorse ? betValue(bets, lastHorse.id) : 0;
    const penalty = lastValue * 100;
    if (penalty) {
      lines.push({ horseId: lastHorse.id, label: "최하위 감점", amount: -penalty * multiplier });
    }

    return { delta: (gross - penalty) * multiplier, lines };
  }

  const player = calculate(playerBets);
  const ai = calculate(aiBets);
  return {
    podium,
    lastHorse,
    multiplier,
    playerDelta: player.delta,
    aiDelta: ai.delta,
    playerLines: player.lines,
    aiLines: ai.lines,
  };
}

function expectedDistance(horse) {
  const stats = horse.stats;
  return (stats.horse * 3 + stats.cap + stats.saddle + stats.shoe) / 6;
}

export function wcChooseAiBets(horses, random = Math.random) {
  const ranked = horses
    .map((horse) => ({ horse, score: expectedDistance(horse) + random() * 1.8 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return [
    { horseId: ranked[1].horse.id, value: 1 },
    { horseId: ranked[2].horse.id, value: 1 },
    { horseId: ranked[0].horse.id, value: 2 },
  ];
}

export function wcChooseAiHorse(
  horses,
  usedHorseIds,
  symbol,
  aiBets,
  playerBets,
  random = Math.random,
) {
  const available = new Set(wcAvailableHorseIds(horses, usedHorseIds));
  return horses
    .filter((horse) => available.has(horse.id))
    .map((horse) => {
      const move = horse.stats[symbol];
      const mine = betValue(aiBets, horse.id);
      const theirs = betValue(playerBets, horse.id);
      const canFinish = horse.position + move >= WC_TRACK_FINISH;
      let score = move * (mine ? 2.2 : 0.4) + mine * 8 - theirs * 2;
      if (theirs && !mine) score -= move;
      if (canFinish) score += mine ? 45 : 4 - theirs * 12;
      return { id: horse.id, score: score + random() };
    })
    .sort((a, b) => b.score - a.score)[0]?.id;
}
