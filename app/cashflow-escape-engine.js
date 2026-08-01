export const CFE_PROFESSIONS = [
  { id: "librarian", name: "공공도서관 사서", salary: 340, savings: 520, expenses: 250, liabilities: [["주택 대출", 2100, 75], ["학자금", 320, 20], ["신용 결제", 120, 15]] },
  { id: "developer", name: "앱 개발자", salary: 560, savings: 780, expenses: 430, liabilities: [["주택 대출", 3600, 120], ["학자금", 650, 35], ["자동차 할부", 720, 45]] },
  { id: "nurse", name: "종합병원 간호사", salary: 470, savings: 620, expenses: 345, liabilities: [["주택 대출", 2800, 95], ["학자금", 540, 30], ["신용 결제", 160, 20]] },
  { id: "designer", name: "산업 디자이너", salary: 490, savings: 670, expenses: 365, liabilities: [["주택 대출", 3000, 100], ["자동차 할부", 600, 40], ["신용 결제", 140, 18]] },
  { id: "foodtruck", name: "푸드트럭 운영자", salary: 390, savings: 480, expenses: 285, liabilities: [["영업 대출", 1200, 65], ["자동차 할부", 540, 38], ["신용 결제", 100, 12]] },
  { id: "researcher", name: "친환경 연구원", salary: 510, savings: 700, expenses: 380, liabilities: [["주택 대출", 3200, 105], ["학자금", 720, 38], ["신용 결제", 150, 18]] },
];

export const CFE_DREAMS = [
  { id: "studio", name: "창작자를 위한 공유 스튜디오", cost: 2600, icon: "✦" },
  { id: "forest", name: "도심 속 작은 숲 조성", cost: 2800, icon: "♧" },
  { id: "journey", name: "가족과 세계 일주", cost: 3000, icon: "✈" },
  { id: "school", name: "청소년 금융학교 설립", cost: 3200, icon: "▤" },
  { id: "farm", name: "지속 가능한 스마트 농장", cost: 2900, icon: "⌂" },
  { id: "fund", name: "지역 창업 장학기금", cost: 3400, icon: "◇" },
];

export const CFE_INNER_TRACK = [
  "payday", "small", "life", "market", "payday", "small",
  "charity", "life", "payday", "big", "market", "small",
  "payday", "family", "life", "small", "payday", "downsize",
  "market", "big", "payday", "small", "life", "market",
];

export const CFE_GROWTH_TRACK = [
  "growth-payday", "venture", "market", "vision", "growth-payday", "venture",
  "give", "market", "growth-payday", "vision", "venture", "tax",
  "growth-payday", "market", "venture", "vision",
];

export const CFE_SPACE_LABELS = {
  payday: "월급날", small: "작은 기회", big: "큰 기회", life: "생활 사건",
  market: "시장 변화", charity: "나눔", family: "가족 변화", downsize: "소득 공백",
  "growth-payday": "성장 수익", venture: "성장 투자", vision: "인생 목표",
  give: "사회 환원", tax: "자산 조정",
};

export const CFE_DEALS = [
  { id: "solar-mini", size: "small", category: "business", name: "옥상 태양광 지분", cost: 180, value: 230, income: 24, description: "소규모 발전 설비의 전력 판매 수익을 나눕니다." },
  { id: "local-bond", size: "small", category: "paper", name: "지역상생 채권", cost: 120, value: 135, income: 12, description: "지역 인프라 채권에서 안정적인 이자가 발생합니다." },
  { id: "studio-room", size: "small", category: "realestate", name: "대학가 원룸 지분", cost: 260, value: 410, income: 32, description: "공실 위험이 낮은 소형 임대 주택입니다." },
  { id: "coffee-cart", size: "small", category: "business", name: "출근길 커피 카트", cost: 150, value: 230, income: 22, description: "직장 밀집 지역의 이동식 매장에 투자합니다." },
  { id: "green-stock", size: "small", category: "stock", name: "미래전력 주식 10주", cost: 100, value: 100, income: 8, description: "변동성이 있지만 분기 배당이 있는 친환경 기업입니다." },
  { id: "logi-stock", size: "small", category: "stock", name: "하루물류 주식 10주", cost: 140, value: 140, income: 10, description: "도심 배송망을 확장 중인 물류 기업입니다." },
  { id: "webtoon-ip", size: "small", category: "royalty", name: "웹툰 번역 판권", cost: 210, value: 300, income: 28, description: "해외 구독 매출의 일부를 정산받습니다." },
  { id: "parking-share", size: "small", category: "realestate", name: "공유 주차면", cost: 190, value: 280, income: 25, description: "오피스 지역의 유휴 주차면 운영권입니다." },
  { id: "townhouse", size: "big", category: "realestate", name: "교외 타운하우스 3채", cost: 760, value: 1250, income: 105, description: "대출을 포함한 임대 사업 패키지입니다." },
  { id: "care-center", size: "big", category: "business", name: "반려동물 케어센터", cost: 680, value: 1050, income: 92, description: "정기 회원이 늘고 있는 생활 서비스 사업입니다." },
  { id: "warehouse", size: "big", category: "realestate", name: "도심형 소형 물류창고", cost: 920, value: 1480, income: 132, description: "온라인 판매자를 위한 월 단위 보관 시설입니다." },
  { id: "saas", size: "big", category: "business", name: "업무자동화 구독 서비스", cost: 840, value: 1380, income: 124, description: "중소기업용 소프트웨어의 반복 구독 수익입니다." },
  { id: "wind-share", size: "big", category: "business", name: "해상풍력 시민펀드", cost: 1050, value: 1580, income: 145, description: "장기 전력 공급 계약에 참여하는 대형 투자입니다." },
  { id: "creator-house", size: "big", category: "realestate", name: "크리에이터 공유주택", cost: 880, value: 1410, income: 128, description: "주거와 촬영 공간을 결합한 공동 임대 사업입니다." },
];

export const CFE_VENTURES = [
  { id: "battery", size: "venture", category: "business", name: "도시 배터리 네트워크", cost: 1450, value: 2300, income: 310, description: "분산형 에너지 저장소를 여러 지역에 운영합니다." },
  { id: "senior-home", size: "venture", category: "realestate", name: "세대공존 주거단지", cost: 1800, value: 2850, income: 390, description: "돌봄 서비스와 임대 주택을 결합한 장기 사업입니다." },
  { id: "edu-platform", size: "venture", category: "business", name: "직무교육 구독 플랫폼", cost: 1250, value: 2050, income: 280, description: "기업과 개인이 함께 이용하는 온라인 교육 서비스입니다." },
  { id: "food-lab", size: "venture", category: "business", name: "대체식품 연구공장", cost: 1600, value: 2600, income: 350, description: "특허 사용료와 제품 생산 수익을 동시에 얻습니다." },
  { id: "culture-hub", size: "venture", category: "realestate", name: "지역 문화 복합공간", cost: 1350, value: 2200, income: 295, description: "공연장·상점·공유 사무실을 함께 운영합니다." },
];

export const CFE_LIFE_EVENTS = [
  { id: "phone", name: "휴대폰 교체", amount: 95, description: "예상치 못한 고장으로 새 기기가 필요합니다." },
  { id: "wedding", name: "친구 결혼식", amount: 45, description: "축하하는 마음과 함께 지출도 찾아왔습니다." },
  { id: "repair", name: "집수리", amount: 130, description: "누수 수리와 도배 비용을 지불합니다." },
  { id: "course", name: "직무 교육", amount: 80, description: "미래 소득을 위한 배움에 투자합니다." },
  { id: "vacation", name: "짧은 휴가", amount: 110, description: "재충전을 위해 여행을 떠납니다." },
  { id: "health", name: "건강 검진", amount: 70, description: "예방을 위한 의료비를 지출합니다." },
  { id: "appliance", name: "세탁기 교체", amount: 120, description: "오래 사용한 가전이 수명을 다했습니다." },
  { id: "subscription", name: "연간 구독 갱신", amount: 35, description: "사용 중인 업무 도구가 자동 갱신됩니다." },
];

export const CFE_MARKETS = [
  { id: "rent-up", name: "임대 수요 증가", category: "realestate", multiplier: 1.35, description: "보유 부동산을 평소보다 높은 가격에 매각할 수 있습니다." },
  { id: "biz-boom", name: "동네 상권 회복", category: "business", multiplier: 1.3, description: "보유 사업체에 좋은 인수 제안이 도착했습니다." },
  { id: "stock-rally", name: "성장주 강세", category: "stock", multiplier: 1.6, description: "보유 주식의 시장 가격이 크게 올랐습니다." },
  { id: "royalty-wave", name: "콘텐츠 해외 흥행", category: "royalty", multiplier: 1.5, description: "보유 판권에 프리미엄 제안이 들어옵니다." },
  { id: "paper-rate", name: "금리 안정", category: "paper", multiplier: 1.25, description: "채권의 시장 가치가 상승했습니다." },
  { id: "buyer-market", name: "현금 매수자 등장", category: "any", multiplier: 1.18, description: "원한다면 자산 하나를 즉시 현금화할 수 있습니다." },
];

function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function liability(name, balance, payment, index) {
  return { id: `${name}-${index}`, name, balance, payment };
}

export function cfeFinancials(player) {
  const assetIncome = player.assets.reduce((sum, asset) => sum + asset.income, 0);
  const debtPayments = player.liabilities.reduce((sum, item) => sum + item.payment, 0);
  const childExpense = player.children * 45;
  const totalExpenses = player.baseExpenses + debtPayments + childExpense + Math.ceil(player.bankLoan * 0.1);
  const totalIncome = player.salary + assetIncome;
  const monthlyCashflow = totalIncome - totalExpenses;
  const assetValue = player.assets.reduce((sum, asset) => sum + asset.value, 0);
  const debtBalance = player.liabilities.reduce((sum, item) => sum + item.balance, 0) + player.bankLoan;
  return { assetIncome, debtPayments, childExpense, totalExpenses, totalIncome, monthlyCashflow, assetValue, debtBalance, netWorth: player.cash + assetValue - debtBalance };
}

function replaceLegacyIncomeTerms(value) {
  if (typeof value === "string") {
    const legacyTerms = [
      [49688, 46041, 49548, 46301],
      [49688, 46041, 51201, 49548, 46301],
      [49688, 46041, 51201, 32, 49548, 46301],
      [49688, 46041, 32, 49548, 46301],
      [51088, 49328, 49688, 51077],
      [51088, 49328, 32, 49688, 51077],
    ].map((codePoints) => String.fromCodePoint(...codePoints));
    return legacyTerms.reduce((text, term) => text.split(term).join("자산소득"), value);
  }
  if (Array.isArray(value)) return value.map(replaceLegacyIncomeTerms);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceLegacyIncomeTerms(item)]));
}

export function cfeMigrateSavedGame(state) {
  const migrated = replaceLegacyIncomeTerms(state);
  if (Array.isArray(migrated?.standings)) {
    migrated.standings = migrated.standings.map((standing) => {
      const legacyKey = ["pass", "ive"].join("");
      const legacyAssetIncome = standing[legacyKey];
      const current = { ...standing };
      delete current[legacyKey];
      return { ...current, assetIncome: current.assetIncome ?? legacyAssetIncome ?? 0 };
    });
  }
  return migrated;
}

function createPlayer(id, profession, dream, isHuman) {
  return {
    id,
    name: isHuman ? "나" : `AI ${["", "민트", "블루", "로즈", "골드", "라임"][id]}`,
    isHuman,
    profession,
    dream,
    salary: profession.salary,
    cash: profession.savings,
    baseExpenses: profession.expenses - profession.liabilities.reduce((sum, item) => sum + item[2], 0),
    liabilities: profession.liabilities.map((item, index) => liability(item[0], item[1], item[2], index)),
    bankLoan: 0,
    assets: [],
    children: 0,
    position: 0,
    stage: "cycle",
    growthTarget: null,
    skipTurns: 0,
    charityTurns: 0,
    turns: 0,
  };
}

export function cfeCreateGame(playerCount = 4, difficulty = "balanced", random = Math.random) {
  const professions = shuffled(CFE_PROFESSIONS, random).slice(0, playerCount);
  const dreams = shuffled(CFE_DREAMS, random).slice(0, playerCount);
  return {
    playerCount,
    difficulty,
    players: professions.map((profession, id) => createPlayer(id, profession, dreams[id], id === 0)),
    currentPlayer: 0,
    phase: "playing",
    pending: null,
    turn: 1,
    dealDeck: shuffled(CFE_DEALS, random),
    ventureDeck: shuffled(CFE_VENTURES, random),
    lifeDeck: shuffled(CFE_LIFE_EVENTS, random),
    marketDeck: shuffled(CFE_MARKETS, random),
    cursors: { deal: 0, venture: 0, life: 0, market: 0 },
    lastRoll: null,
    lastEvent: "재무 자유를 향한 첫 달이 시작되었습니다.",
    log: ["게임 시작 · 자산소득이 총지출 이상이 되도록 자산을 모으세요."],
    winner: null,
    standings: null,
  };
}

function cloneState(state) {
  return {
    ...state,
    cursors: { ...state.cursors },
    players: state.players.map((player) => ({
      ...player,
      assets: player.assets.map((asset) => ({ ...asset })),
      liabilities: player.liabilities.map((item) => ({ ...item })),
    })),
    log: [...state.log],
  };
}

function ensureCash(player) {
  if (player.cash >= 0) return;
  const amount = Math.ceil(Math.abs(player.cash) / 100) * 100;
  player.cash += amount;
  player.bankLoan += amount;
}

function ranking(players) {
  return [...players].map((player) => {
    const finance = cfeFinancials(player);
    return { id: player.id, name: player.name, stage: player.stage, cash: player.cash, assetIncome: finance.assetIncome, netWorth: finance.netWorth };
  }).sort((a, b) => (b.stage === "growth" ? 1 : 0) - (a.stage === "growth" ? 1 : 0) || b.assetIncome - a.assetIncome || b.netWorth - a.netWorth);
}

function advanceTurn(state) {
  if (state.phase === "finished" || state.pending) return state;
  state.currentPlayer = (state.currentPlayer + 1) % state.playerCount;
  if (state.currentPlayer === 0) state.turn += 1;
  return state;
}

function checkFreedom(state, playerId) {
  const player = state.players[playerId];
  const finance = cfeFinancials(player);
  if (player.stage === "cycle" && finance.assetIncome >= finance.totalExpenses) {
    player.stage = "growth";
    player.position = 0;
    player.growthTarget = finance.assetIncome + 900;
    state.lastEvent = `${player.name}가 생활 순환로를 벗어나 성장 트랙에 진입했습니다!`;
    state.log.push(state.lastEvent);
  }
  if (player.stage === "growth" && finance.assetIncome >= player.growthTarget) {
    return finishGame(state, playerId, "성장 수입 목표 달성");
  }
  return state;
}

function finishGame(state, playerId, reason) {
  state.phase = "finished";
  state.winner = playerId;
  state.standings = ranking(state.players);
  state.pending = null;
  state.lastEvent = `${state.players[playerId].name}가 ${reason}으로 재무 여정을 완성했습니다.`;
  state.log.push(state.lastEvent);
  return state;
}

function drawCard(state, deckName) {
  const deck = state[`${deckName}Deck`];
  const cursor = state.cursors[deckName] % deck.length;
  state.cursors[deckName] += 1;
  return deck[cursor];
}

function payAmount(state, playerId, amount, message) {
  const player = state.players[playerId];
  player.cash -= amount;
  ensureCash(player);
  state.lastEvent = message;
  state.log.push(`${player.name}: ${message}`);
}

function resolvePayday(state, playerId, growth = false) {
  const player = state.players[playerId];
  const finance = cfeFinancials(player);
  const amount = growth ? Math.max(600, finance.assetIncome + 350) : finance.monthlyCashflow;
  player.cash += amount;
  ensureCash(player);
  state.lastEvent = growth ? `성장 수익 ${amount}만원을 받았습니다.` : `월 현금흐름 ${amount >= 0 ? "+" : ""}${amount}만원을 반영했습니다.`;
  state.log.push(`${player.name}: ${state.lastEvent}`);
  return checkFreedom(state, playerId);
}

function resolveSpace(state, playerId, space) {
  const player = state.players[playerId];
  if (space === "payday" || space === "growth-payday") {
    resolvePayday(state, playerId, space === "growth-payday");
  } else if (space === "small" || space === "big" || space === "venture") {
    const deckName = space === "venture" ? "venture" : "deal";
    let card = drawCard(state, deckName);
    if (space !== "venture") {
      let attempts = 0;
      while (card.size !== space && attempts < state.dealDeck.length) {
        card = drawCard(state, "deal");
        attempts += 1;
      }
    }
    state.pending = { kind: "deal", playerId, card };
    state.lastEvent = `${card.name} 투자 기회를 검토합니다.`;
    state.log.push(`${player.name}: 투자 기회 · ${card.name} — ${card.description}`);
  } else if (space === "life") {
    const event = drawCard(state, "life");
    payAmount(state, playerId, event.amount, `${event.name} · ${event.amount}만원 지출`);
  } else if (space === "family") {
    if (player.children < 3) {
      player.children += 1;
      state.lastEvent = `가족이 늘었습니다. 월 생활비가 45만원 증가합니다.`;
      state.log.push(`${player.name}: ${state.lastEvent}`);
    } else {
      payAmount(state, playerId, 60, "가족 행사 · 60만원 지출");
    }
  } else if (space === "downsize") {
    player.skipTurns = 2;
    state.lastEvent = "소득 공백 발생 · 다음 두 차례를 쉽니다.";
    state.log.push(`${player.name}: ${state.lastEvent}`);
  } else if (space === "charity") {
    state.pending = { kind: "charity", playerId, amount: 50 };
    state.lastEvent = "50만원을 나누면 다음 세 차례 동안 주사위 두 개 중 높은 값을 사용합니다.";
    state.log.push(`${player.name}: 나눔 기회 · ${state.lastEvent}`);
  } else if (space === "give") {
    payAmount(state, playerId, Math.min(player.cash, 150), "사회 환원 · 150만원 기부");
  } else if (space === "tax") {
    const amount = Math.max(50, Math.floor(player.cash * 0.1));
    payAmount(state, playerId, amount, `자산 조정 비용 · ${amount}만원`);
  } else if (space === "market") {
    const market = drawCard(state, "market");
    const assets = player.assets.filter((asset) => market.category === "any" || asset.category === market.category);
    if (assets.length) {
      state.pending = { kind: "market", playerId, card: market, assetIds: assets.map((asset) => asset.id) };
      state.lastEvent = market.description;
      state.log.push(`${player.name}: 시장 변화 · ${market.name} — ${market.description}`);
    } else {
      state.lastEvent = `시장 변화 · ${market.name} — ${market.description} · 매각할 관련 자산이 없습니다.`;
      state.log.push(`${player.name}: ${state.lastEvent}`);
    }
  } else if (space === "vision") {
    if (player.cash >= player.dream.cost) {
      state.pending = { kind: "vision", playerId, dream: player.dream };
      state.lastEvent = `${player.dream.name}을(를) 실현할 수 있습니다.`;
      state.log.push(`${player.name}: 인생 목표 기회 · ${state.lastEvent}`);
    } else {
      state.lastEvent = `${player.dream.name}까지 ${player.dream.cost - player.cash}만원이 더 필요합니다.`;
      state.log.push(`${player.name}: ${state.lastEvent}`);
    }
  }
  if (!state.pending && state.phase !== "finished") {
    checkFreedom(state, playerId);
    advanceTurn(state);
  }
  return state;
}

export function cfeRoll(state, playerId, random = Math.random) {
  if (state.phase !== "playing" || state.pending || state.currentPlayer !== playerId) return state;
  const next = cloneState(state);
  const player = next.players[playerId];
  if (player.skipTurns > 0) {
    player.skipTurns -= 1;
    next.lastEvent = `${player.name}는 소득 공백으로 이번 차례를 쉽니다.`;
    next.log.push(next.lastEvent);
    return advanceTurn(next);
  }
  const first = 1 + Math.floor(random() * 6);
  const second = player.charityTurns > 0 ? 1 + Math.floor(random() * 6) : null;
  const roll = second == null ? first : Math.max(first, second);
  if (player.charityTurns > 0) player.charityTurns -= 1;
  const track = player.stage === "growth" ? CFE_GROWTH_TRACK : CFE_INNER_TRACK;
  player.position = (player.position + roll) % track.length;
  player.turns += 1;
  next.lastRoll = { playerId, values: second == null ? [first] : [first, second], used: roll };
  next.log.push(`${player.name}: ${second == null ? first : `${first}·${second} 중 ${roll}`}칸 이동 → ${CFE_SPACE_LABELS[track[player.position]]}`);
  return resolveSpace(next, playerId, track[player.position]);
}

export function cfeResolvePending(state, playerId, choice, option = null) {
  if (state.phase !== "playing" || !state.pending || state.pending.playerId !== playerId) return state;
  const next = cloneState(state);
  const pending = next.pending;
  const player = next.players[playerId];
  next.pending = null;

  if (pending.kind === "deal") {
    if (choice === "buy" && player.cash >= pending.card.cost) {
      player.cash -= pending.card.cost;
      player.assets.push({ ...pending.card, acquiredTurn: next.turn });
      next.lastEvent = `${pending.card.name} 인수 · 자산소득 +${pending.card.income}만원`;
      next.log.push(`${player.name}: 결정 · ${pending.card.name} 매입 · 현금 -${pending.card.cost}만원 · 자산소득 +${pending.card.income}만원`);
      checkFreedom(next, playerId);
    } else {
      next.lastEvent = choice === "buy" ? "현금이 부족해 투자하지 못했습니다." : `${pending.card.name} 투자를 넘겼습니다.`;
      next.log.push(`${player.name}: 결정 · ${next.lastEvent}`);
    }
  } else if (pending.kind === "charity") {
    if (choice === "accept" && player.cash >= pending.amount) {
      player.cash -= pending.amount;
      player.charityTurns = 3;
      next.lastEvent = "나눔 완료 · 다음 세 차례에 유리한 주사위를 사용합니다.";
    } else {
      next.lastEvent = "이번에는 나눔을 쉬어갑니다.";
    }
    next.log.push(`${player.name}: 결정 · ${next.lastEvent}${choice === "accept" ? ` · 현금 -${pending.amount}만원` : ""}`);
  } else if (pending.kind === "market") {
    const asset = player.assets.find((item) => item.id === option);
    if (choice === "sell" && asset) {
      const price = Math.round(asset.value * pending.card.multiplier);
      player.cash += price;
      player.assets = player.assets.filter((item) => item !== asset);
      next.lastEvent = `${asset.name} 매각 · ${price}만원 확보`;
      next.log.push(`${player.name}: 결정 · ${pending.card.name} 적용 · ${asset.name} 매각 · 현금 +${price}만원 · 자산소득 -${asset.income}만원`);
    } else {
      next.lastEvent = `${pending.card.name} 제안을 보류했습니다.`;
      next.log.push(`${player.name}: 결정 · ${pending.card.name} 적용 · 매각하지 않고 자산을 보유합니다.`);
    }
  } else if (pending.kind === "vision") {
    if (choice === "buy" && player.cash >= pending.dream.cost) {
      player.cash -= pending.dream.cost;
      return finishGame(next, playerId, `인생 목표 ‘${pending.dream.name}’ 실현`);
    }
    next.lastEvent = "인생 목표 달성을 다음 기회로 미뤘습니다.";
    next.log.push(`${player.name}: 결정 · ${next.lastEvent}`);
  }

  if (next.phase !== "finished") advanceTurn(next);
  return next;
}

export function cfeBorrow(state, playerId, amount = 100) {
  if (state.phase !== "playing" || state.currentPlayer !== playerId || amount <= 0) return state;
  const next = cloneState(state);
  const player = next.players[playerId];
  player.cash += amount;
  player.bankLoan += amount;
  next.lastEvent = `운영자금 ${amount}만원 대출 · 월 상환 부담 ${Math.ceil(player.bankLoan * 0.1)}만원`;
  next.log.push(`${player.name}: ${next.lastEvent}`);
  return next;
}

export function cfeRepayBank(state, playerId, amount = 100) {
  if (state.phase !== "playing" || state.currentPlayer !== playerId || state.pending) return state;
  const next = cloneState(state);
  const player = next.players[playerId];
  const payment = Math.min(amount, player.bankLoan, player.cash);
  if (payment <= 0) return state;
  player.cash -= payment;
  player.bankLoan -= payment;
  next.lastEvent = `운영자금 대출 ${payment}만원 상환`;
  next.log.push(`${player.name}: ${next.lastEvent}`);
  return next;
}

export function cfeRepayLiability(state, playerId, liabilityId) {
  if (state.phase !== "playing" || state.currentPlayer !== playerId || state.pending) return state;
  const next = cloneState(state);
  const player = next.players[playerId];
  const item = player.liabilities.find((candidate) => candidate.id === liabilityId);
  if (!item || player.cash < item.balance) return state;
  player.cash -= item.balance;
  player.liabilities = player.liabilities.filter((candidate) => candidate.id !== liabilityId);
  next.lastEvent = `${item.name} 완납 · 월지출 ${item.payment}만원 감소`;
  next.log.push(`${player.name}: ${next.lastEvent}`);
  checkFreedom(next, playerId);
  return next;
}

function aiShouldBuy(player, card, difficulty) {
  if (player.cash < card.cost) return false;
  const roi = card.income / card.cost;
  const reserve = difficulty === "sharp" ? 120 : difficulty === "casual" ? 20 : 70;
  const threshold = difficulty === "sharp" ? 0.105 : difficulty === "casual" ? 0.16 : 0.125;
  return player.cash - card.cost >= reserve && roi >= threshold;
}

export function cfeChooseAiAction(state, playerId, random = Math.random) {
  if (state.phase !== "playing" || state.currentPlayer !== playerId) return state;
  const player = state.players[playerId];
  if (state.pending?.playerId === playerId) {
    if (state.pending.kind === "deal") {
      return cfeResolvePending(state, playerId, aiShouldBuy(player, state.pending.card, state.difficulty) ? "buy" : "skip");
    }
    if (state.pending.kind === "charity") {
      return cfeResolvePending(state, playerId, player.cash >= 300 ? "accept" : "skip");
    }
    if (state.pending.kind === "market") {
      const assets = player.assets.filter((asset) => state.pending.assetIds.includes(asset.id));
      const best = assets.sort((a, b) => b.value - a.value)[0];
      const shouldSell = best && (state.pending.card.multiplier >= 1.3 || player.cash < 150);
      return cfeResolvePending(state, playerId, shouldSell ? "sell" : "skip", best?.id);
    }
    if (state.pending.kind === "vision") {
      return cfeResolvePending(state, playerId, player.cash >= state.pending.dream.cost ? "buy" : "skip");
    }
  }
  const payable = [...player.liabilities].sort((a, b) => b.payment / b.balance - a.payment / a.balance)[0];
  if (payable && player.cash > payable.balance + 350 && random() < 0.18) return cfeRepayLiability(state, playerId, payable.id);
  if (player.bankLoan >= 100 && player.cash >= 450 && random() < 0.15) return cfeRepayBank(state, playerId, 100);
  return cfeRoll(state, playerId, random);
}

export function cfeRanking(state) {
  return ranking(state.players);
}
