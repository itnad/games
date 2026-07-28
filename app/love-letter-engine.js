export const LOVE_LETTER_CARD_COUNTS = {
  0: 2,
  1: 6,
  2: 2,
  3: 2,
  4: 2,
  5: 2,
  6: 2,
  7: 1,
  8: 1,
  9: 1,
};

export const LOVE_LETTER_CARD_DEFS = [
  { value: 0, classic: "첩자", cookie: "부스러기 정찰대", icon: "◌", effect: "효과는 없지만 혼자만 사용했다면 호감 토큰을 하나 더 얻습니다." },
  { value: 1, classic: "경비병", cookie: "젤리 경비대", icon: "⌕", effect: "상대의 카드를 추측합니다. 맞히면 그 상대가 탈락합니다." },
  { value: 2, classic: "성직자", cookie: "설탕 예언가", icon: "◉", effect: "상대 한 명의 손패를 몰래 확인합니다." },
  { value: 3, classic: "남작", cookie: "크림 결투가", icon: "⚔", effect: "상대와 손패를 비교해 낮은 쪽이 탈락합니다." },
  { value: 4, classic: "시녀", cookie: "머랭 수호자", icon: "♢", effect: "다음 자기 차례까지 다른 카드 효과의 대상이 되지 않습니다." },
  { value: 5, classic: "왕자", cookie: "잼 왕자", icon: "♙", effect: "한 명이 손패를 버리고 새 카드를 뽑게 합니다." },
  { value: 6, classic: "재상", cookie: "오븐 재상", icon: "♜", effect: "두 장을 더 뽑아 한 장만 남기고 나머지를 덱 아래에 둡니다." },
  { value: 7, classic: "왕", cookie: "쿠키 왕", icon: "♔", effect: "상대 한 명과 손패를 교환합니다." },
  { value: 8, classic: "백작부인", cookie: "슈가 백작", icon: "♕", effect: "왕이나 왕자와 함께 들고 있다면 반드시 이 카드를 냅니다." },
  { value: 9, classic: "공주", cookie: "왕관 쿠키", icon: "♥", effect: "어떤 이유로든 이 카드를 버리면 즉시 탈락합니다." },
];

export const LOVE_LETTER_FAVOR_TARGETS = { 2: 6, 3: 5, 4: 4, 5: 3, 6: 3 };

export function loveLetterCardDef(value) {
  return LOVE_LETTER_CARD_DEFS.find((card) => card.value === value);
}

export function loveLetterBuildDeck(random = Math.random) {
  const cards = [];
  for (const [rawValue, count] of Object.entries(LOVE_LETTER_CARD_COUNTS)) {
    const value = Number(rawValue);
    for (let copy = 0; copy < count; copy += 1) {
      cards.push({ uid: `ll-${value}-${copy}`, value });
    }
  }
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [cards[index], cards[swap]] = [cards[swap], cards[index]];
  }
  return cards;
}

export function loveLetterFavorTarget(playerCount) {
  return LOVE_LETTER_FAVOR_TARGETS[playerCount] ?? 3;
}

export function loveLetterMustPlay(hand) {
  const values = hand.map((card) => card.value);
  if (values.includes(8) && (values.includes(7) || values.includes(5))) {
    return hand.find((card) => card.value === 8)?.uid ?? null;
  }
  return null;
}

export function loveLetterValidTargets(players, actorId, cardValue) {
  const otherTargets = players.filter(
    (player) => player.id !== actorId && player.alive && !player.protected,
  );
  if ([1, 2, 3, 7].includes(cardValue)) return otherTargets.map((player) => player.id);
  if (cardValue === 5) {
    if (otherTargets.length) return [
      ...otherTargets.map((player) => player.id),
      ...players.filter((player) => player.id === actorId && player.alive).map((player) => player.id),
    ];
    return players.filter((player) => player.id === actorId && player.alive).map((player) => player.id);
  }
  return [];
}

export function loveLetterRoundWinners(players) {
  const alive = players.filter((player) => player.alive);
  if (alive.length === 1) return [alive[0].id];
  if (!alive.length) return [];
  const highest = Math.max(...alive.map((player) => player.hand[0]?.value ?? -1));
  return alive.filter((player) => (player.hand[0]?.value ?? -1) === highest).map((player) => player.id);
}

export function loveLetterSpyBonus(players) {
  const eligible = players.filter(
    (player) => player.alive && player.discarded.some((card) => card.value === 0),
  );
  return eligible.length === 1 ? eligible[0].id : null;
}

export function loveLetterRemainingCounts(players, deck, setAside) {
  const counts = { ...LOVE_LETTER_CARD_COUNTS };
  for (const player of players) {
    for (const card of player.discarded) counts[card.value] -= 1;
  }
  for (const card of deck) counts[card.value] -= 1;
  if (setAside) counts[setAside.value] -= 1;
  return counts;
}
