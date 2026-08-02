const BASIC_SETS = {
  red: [[5, 1, 4], [4, 1, 1], [4, 2, 2], [3, 2, 1], [2, 3, 1], [1, 4, 1]],
  blue: [[5, 1, 2], [4, 1, 1], [4, 2, 2], [3, 3, 2], [2, 3, 1], [1, 4, 2]],
  green: [[4, 2, 4], [3, 3, 2], [1, 4, 1], [2, 4, 2], [1, 5, 1]],
  yellow: [[4, 1, 3], [3, 1, 2], [3, 2, 1], [2, 2, 2], [1, 4, 2]],
  "yellow+": [[4, 1, 3], [3, 1, 2], [3, 2, 1], [2, 2, 1], [2, 3, 1], [1, 4, 2]],
  weak: [[3, 1, 2], [2, 1, 3], [1, 2, 4]],
  strong: [[4, 1, 2], [3, 1, 2], [3, 2, 1], [2, 3, 2], [1, 4, 2]],
  "strong+": [[5, 1, 1], [4, 1, 1], [3, 1, 2], [3, 2, 1], [2, 3, 2], [1, 4, 2]],
  "strong++": [[5, 1, 1], [4, 1, 1], [3, 1, 2], [3, 2, 1], [2, 3, 2], [1, 4, 1], [2, 4, 1]],
};

const pc = (name, character, attack, defense, copies, effect = "none", text = "") => ({
  name, character, type: "power", attack, defense, copies, effect, text,
});
const sp = (name, character, copies, effect, text, target = "none", free = false) => ({
  name, character, type: "special", attack: null, defense: null, copies, effect, text, target, free,
});

export const EPIC_DUELS_TEAMS = [
  {
    id: "anakin", name: "Anakin Skywalker & Padmé Amidala", side: "light", color: "#4b8ed8",
    major: { name: "Anakin Skywalker", hp: 18, ranged: false, basic: "red", mark: "AS" },
    minors: [{ name: "Padmé Amidala", hp: 10, ranged: true, basic: "strong", mark: "PA" }],
    talents: [
      pc("Anger", "major", 8, null, 2, "discard-to-one", "공격 후 손패를 한 장만 남깁니다."),
      pc("Counterattack", "major", null, "all", 2, "counter-one", "피해를 막고 공격자에게 1피해를 줍니다."),
      pc("Precise Shot", "minor", 9, null, 1, "cycle-one", "공격 후 카드 한 장을 교체할 수 있습니다."),
      pc("Shot on the Run", "minor", 6, null, 1, "retreat-six", "공격 후 최대 6칸 이동합니다."),
      sp("Calm", "major", 2, "calm", "최대 8칸 이동하고 손패가 비면 5장까지 뽑습니다."),
      sp("Protection", "minor", 1, "protect-padme", "파드메가 최대 4체력을 회복합니다."),
      sp("Wrath", "major", 3, "minor-seven", "보조 캐릭터 하나에게 7피해를 줍니다.", "enemy-minor"),
    ],
  },
  {
    id: "boba", name: "Boba Fett & Greedo", side: "fringe", color: "#d9a442",
    major: { name: "Boba Fett", hp: 14, ranged: true, basic: "yellow", mark: "BF" },
    minors: [{ name: "Greedo", hp: 7, ranged: true, basic: "strong", mark: "GR" }],
    talents: [
      pc("Deadly Aim", "major", 7, null, 1, "draw-two", "공격 후 카드 2장을 뽑습니다."),
      pc("Desperate Shot", "minor", 7, null, 1, "greedo-risk", "대상을 쓰러뜨리지 못하면 그리도가 파괴됩니다."),
      pc("Kyber Dart", "major", 9, null, 1, "kill-draw-three", "대상을 쓰러뜨리면 카드 3장을 뽑습니다."),
      pc("Rocket Retreat", "major", 4, null, 3, "retreat-any", "공격 후 빈 위치로 이동합니다."),
      sp("Sudden Arrival", "minor", 2, "minor-arrival", "그리도가 선택한 적에게 접근합니다.", "enemy", true),
      sp("Thermal Detonator", "major", 2, "blast-four", "선택한 적과 인접한 캐릭터에게 4피해를 줍니다.", "enemy"),
      sp("Wrist Cable", "major", 2, "cable", "적에게 2피해를 주고 다음 행동을 하나 줄입니다.", "enemy"),
    ],
  },
  {
    id: "dooku", name: "Count Dooku & Super Battle Droids", side: "dark", color: "#8c5bd0",
    major: { name: "Count Dooku", hp: 18, ranged: false, basic: "blue", mark: "CD" },
    minors: [
      { name: "Super Battle Droid 1", hp: 5, ranged: true, basic: "strong+", mark: "D1" },
      { name: "Super Battle Droid 2", hp: 5, ranged: true, basic: "strong+", mark: "D2" },
    ],
    talents: [
      pc("Taunting", "major", 7, null, 4, "draw-one", "공격 후 카드 한 장을 뽑습니다."),
      sp("Force Drain", "major", 1, "discard-random-two", "상대 손패 두 장을 무작위로 버립니다."),
      sp("Force Push", "major", 2, "push-one", "인접한 캐릭터를 밀고 1피해를 줍니다.", "adjacent"),
      sp("Gain Power", "major", 2, "draw-three", "카드 3장을 뽑습니다."),
      sp("Give Orders", "major", 3, "move-team", "두쿠와 드로이드들을 각각 최대 4칸 이동합니다."),
    ],
  },
  {
    id: "maul", name: "Darth Maul & Battle Droids", side: "dark", color: "#d64e45",
    major: { name: "Darth Maul", hp: 18, ranged: false, basic: "red", mark: "DM" },
    minors: [
      { name: "Battle Droid 1", hp: 3, ranged: true, basic: "weak", mark: "B1" },
      { name: "Battle Droid 2", hp: 3, ranged: true, basic: "weak", mark: "B2" },
    ],
    talents: [
      pc("Athletic Surge", "major", 8, null, 3, "retreat-six", "공격 후 최대 6칸 이동합니다."),
      pc("Blinding Surge", "major", null, 0, 2, "counter-three", "피해를 받은 뒤 공격자에게 3피해를 줍니다."),
      pc("Martial Defense", "major", null, 10, 1, "draw-one", "방어 후 카드 한 장을 뽑습니다."),
      pc("Sith Speed", "major", 3, null, 3, "free-attack", "이 공격은 행동을 소비하지 않습니다."),
      pc("Super Sith Speed", "major", 4, null, 3, "free-attack", "이 공격은 행동을 소비하지 않습니다."),
    ],
  },
  {
    id: "vader", name: "Darth Vader & Stormtroopers", side: "dark", color: "#313444",
    major: { name: "Darth Vader", hp: 20, ranged: false, basic: "red", mark: "DV" },
    minors: [
      { name: "Stormtrooper 1", hp: 4, ranged: true, basic: "weak", mark: "S1" },
      { name: "Stormtrooper 2", hp: 4, ranged: true, basic: "weak", mark: "S2" },
    ],
    talents: [
      pc("All Too Easy", "major", 3, null, 1, "unblocked-twenty", "방어되지 않으면 20피해를 줍니다."),
      pc("Dark Side Drain", "major", 3, null, 2, "life-steal", "준 피해만큼 베이더가 회복합니다."),
      sp("Choke", "major", 3, "minor-six", "보조 캐릭터 하나에게 6피해를 줍니다.", "enemy-minor"),
      sp("Throw Debris", "major", 2, "damage-four", "캐릭터 하나에게 4피해를 줍니다.", "enemy"),
      sp("Wrath", "major", 3, "damage-all-two", "상대 팀 전체에 2피해를 줍니다."),
      sp("Your Skills Are Not Complete", "major", 1, "discard-specials", "상대의 특수 카드를 모두 버립니다."),
    ],
  },
  {
    id: "emperor", name: "Emperor Palpatine & Royal Guards", side: "dark", color: "#6c4f84",
    major: { name: "Emperor Palpatine", hp: 13, ranged: false, basic: "green", mark: "EP" },
    minors: [
      { name: "Royal Guard 1", hp: 5, ranged: true, basic: "strong++", mark: "R1" },
      { name: "Royal Guard 2", hp: 5, ranged: true, basic: "strong++", mark: "R2" },
    ],
    talents: [
      sp("Force Lightning", "major", 4, "lightning", "3피해를 주고 상대 손패 한 장을 버립니다.", "enemy"),
      sp("Future Foreseen", "major", 2, "foresee", "덱 위 네 장 중 한 장을 가져옵니다."),
      sp("Let Go of Your Hatred", "major", 2, "discard-random-two", "상대 손패 두 장을 버립니다."),
      sp("Meditation", "major", 2, "meditate", "황제가 4회복하고 상대의 다음 뽑기를 막습니다."),
      sp("Royal Command", "major", 1, "swap-guard", "황제와 근위대의 위치를 교환합니다."),
      sp("You Will Die", "major", 1, "discard-all", "상대 손패를 모두 버립니다."),
    ],
  },
  {
    id: "han", name: "Han Solo & Chewbacca", side: "light", color: "#d2933d",
    major: { name: "Han Solo", hp: 13, ranged: true, basic: "yellow+", mark: "HS" },
    minors: [{ name: "Chewbacca", hp: 15, ranged: true, basic: "strong+", mark: "CH" }],
    talents: [
      pc("Bowcaster Attack", "minor", 11, null, 1, "draw-one", "공격 후 카드 한 장을 뽑습니다."),
      pc("Gambler’s Luck", "major", 4, null, 3, "damage-discard", "피해를 주면 상대 손패 한 장을 버립니다."),
      pc("Heroic Retreat", "major", 5, null, 2, "retreat-five", "공격 후 최대 5칸 이동합니다."),
      sp("It’s Not Wise", "minor", 2, "push-three", "츄바카에 인접한 적에게 3피해를 줍니다.", "adjacent"),
      sp("Never Tell Me the Odds", "major", 2, "ranged-all-two", "한이 공격 가능한 모든 적에게 2피해를 줍니다."),
      sp("Wookiee Healing", "minor", 1, "heal-minor-three", "츄바카가 3회복하고 이동합니다."),
      sp("Wookiee Instincts", "minor", 1, "find-bowcaster", "보우캐스터 공격을 덱에서 찾아옵니다."),
    ],
  },
  {
    id: "jango", name: "Jango Fett & Zam Wesell", side: "fringe", color: "#5b91ae",
    major: { name: "Jango Fett", hp: 15, ranged: true, basic: "yellow", mark: "JF" },
    minors: [{ name: "Zam Wesell", hp: 10, ranged: true, basic: "strong", mark: "ZW" }],
    talents: [
      pc("Assassination", "minor", 7, null, 1, "retreat-any", "공격 후 빈 위치로 이동합니다."),
      pc("Missile Launch", "major", 7, null, 1, "draw-three", "공격 후 카드 3장을 뽑습니다."),
      pc("Rocket Retreat", "major", 4, null, 3, "retreat-any", "공격 후 빈 위치로 이동합니다."),
      pc("Sniper Shot", "minor", 3, null, 3, "unblocked-six", "방어되지 않으면 6피해를 줍니다."),
      sp("Fire Up the Jet Pack", "major", 1, "teleport-major", "장고를 원하는 빈 위치로 이동합니다.", "none", true),
      sp("Flamethrower", "major", 1, "adjacent-all-two", "장고 주변 모든 캐릭터에게 2피해를 줍니다."),
      sp("Wrist Cable", "major", 2, "cable", "적에게 2피해를 주고 다음 행동을 하나 줄입니다.", "enemy"),
    ],
  },
  {
    id: "luke", name: "Luke Skywalker & Princess Leia", side: "light", color: "#5c80c3",
    major: { name: "Luke Skywalker", hp: 17, ranged: false, basic: "red", mark: "LS" },
    minors: [{ name: "Princess Leia", hp: 10, ranged: true, basic: "strong", mark: "PL" }],
    talents: [
      pc("Justice", "major", 4, null, 2, "justice", "레아가 쓰러졌다면 공격력이 10이 됩니다."),
      pc("Latent Force Abilities", "minor", 7, 7, 2, "draw-one", "사용 후 카드 한 장을 뽑습니다."),
      sp("Children of the Force", "major", 3, "move-both-draw-two", "루크와 레아를 이동하고 카드 2장을 뽑습니다."),
      sp("I Will Not Fight You", "major", 3, "discard-high-attacks", "양측 손패에서 공격력 2 이상 카드를 버립니다."),
      sp("Luke’s in Trouble", "minor", 2, "heal-luke-three", "조건에 맞는 캐릭터가 3회복합니다."),
    ],
  },
  {
    id: "mace", name: "Mace Windu & Clone Troopers", side: "light", color: "#7455b7",
    major: { name: "Mace Windu", hp: 19, ranged: false, basic: "blue", mark: "MW" },
    minors: [
      { name: "Clone Trooper 1", hp: 4, ranged: true, basic: "weak", mark: "C1" },
      { name: "Clone Trooper 2", hp: 4, ranged: true, basic: "weak", mark: "C2" },
    ],
    talents: [
      pc("Battlemind", "major", "hand", "hand", 4, "none", "공격·방어 값은 사용 후 남은 손패 수입니다."),
      pc("Masterful Fighting", "major", 5, null, 2, "draw-one", "공격 후 카드 한 장을 뽑습니다."),
      sp("Whirlwind Attack", "major", 2, "ranged-all-four", "메이스가 공격 가능한 모든 적에게 4피해를 줍니다."),
      sp("Wisdom", "major", 4, "move-major-draw", "메이스를 최대 5칸 이동하고 한 장을 뽑습니다."),
    ],
  },
  {
    id: "obiwan", name: "Obi-Wan Kenobi & Clone Troopers", side: "light", color: "#3e8bc1",
    major: { name: "Obi-Wan Kenobi", hp: 18, ranged: false, basic: "blue", mark: "OW" },
    minors: [
      { name: "Clone Trooper 1", hp: 4, ranged: true, basic: "weak", mark: "C1" },
      { name: "Clone Trooper 2", hp: 4, ranged: true, basic: "weak", mark: "C2" },
    ],
    talents: [
      pc("Force Control", "major", 7, null, 2, "scatter", "공격 후 전장의 캐릭터를 재배치합니다."),
      pc("Jedi Attack", "major", 6, null, 3, "retreat-six", "공격 후 최대 6칸 이동합니다."),
      pc("Jedi Block", "major", null, 12, 3, "draw-one", "방어 후 카드 한 장을 뽑습니다."),
      sp("Force Balance", "major", 1, "force-balance", "양측 손패를 버리고 각각 3장씩 뽑습니다."),
      sp("Force Quickness", "major", 2, "move-major-draw", "오비완을 최대 8칸 이동하고 한 장을 뽑습니다."),
      sp("Jedi Mind Trick", "major", 1, "recover-discard", "버린 카드 한 장을 손패로 가져옵니다."),
    ],
  },
  {
    id: "yoda", name: "Yoda & Clone Troopers", side: "light", color: "#67985f",
    major: { name: "Yoda", hp: 15, ranged: false, basic: "green", mark: "YO" },
    minors: [
      { name: "Clone Trooper 1", hp: 4, ranged: true, basic: "weak", mark: "C1" },
      { name: "Clone Trooper 2", hp: 4, ranged: true, basic: "weak", mark: "C2" },
    ],
    talents: [
      pc("Force Rebound", "major", null, "all", 1, "reflect-attack", "피해를 막고 공격력만큼 되돌립니다."),
      pc("Force Strike", "major", 6, null, 2, "draw-one", "공격 후 카드 한 장을 뽑습니다."),
      pc("Serenity", "major", null, 15, 2, "draw-one", "방어 후 카드 한 장을 뽑습니다."),
      sp("Force Lift", "major", 3, "stun", "인접한 캐릭터를 행동 불가 상태로 만듭니다.", "adjacent"),
      sp("Force Push", "major", 2, "push-three", "인접한 캐릭터를 밀고 3피해를 줍니다.", "adjacent"),
      sp("Insight", "major", 2, "inspect-discard", "상대 손패 한 장을 선택해 버립니다."),
    ],
  },
];

export const EPIC_DUELS_MAPS = [
  { id: "kamino", name: "Kamino Platform", subtitle: "빗속의 좁은 연결 통로", obstacles: [[1,1],[1,7],[3,3],[3,5],[5,3],[5,5],[7,1],[7,7]] },
  { id: "geonosis", name: "Geonosis Arena", subtitle: "기둥이 흩어진 원형 경기장", obstacles: [[2,2],[2,6],[4,4],[6,2],[6,6]] },
  { id: "carbon", name: "Carbon-Freezing Chamber", subtitle: "중앙 설비와 측면 회랑", obstacles: [[2,4],[3,4],[4,2],[4,6],[5,4],[6,4]] },
  { id: "throne", name: "Emperor’s Throne Room", subtitle: "계단과 왕좌가 막는 결전장", obstacles: [[1,3],[1,5],[2,3],[2,5],[6,1],[6,7],[7,1],[7,7]] },
];

function expandBasic(setName, character, prefix) {
  return BASIC_SETS[setName].flatMap(([attack, defense, copies], groupIndex) =>
    Array.from({ length: copies }, (_, copyIndex) => ({
      uid: `${prefix}-basic-${groupIndex}-${copyIndex}`,
      name: "Combat",
      character,
      type: "basic",
      attack,
      defense,
      effect: "none",
      text: "",
    })),
  );
}

export function epicTeam(id) {
  return EPIC_DUELS_TEAMS.find((team) => team.id === id);
}

export function epicCreateDeck(teamId, random = Math.random) {
  const team = epicTeam(teamId);
  const cards = [
    ...expandBasic(team.major.basic, "major", `${teamId}-major`),
    ...expandBasic(team.minors[0].basic, "minor", `${teamId}-minor`),
    ...team.talents.flatMap((card, talentIndex) =>
      Array.from({ length: card.copies }, (_, copyIndex) => ({
        ...card,
        uid: `${teamId}-talent-${talentIndex}-${copyIndex}`,
      })),
    ),
  ];
  return epicShuffle(cards, random);
}

export function epicShuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function epicDraw(player, count, random = Math.random) {
  const next = { ...player, deck: [...player.deck], hand: [...player.hand], discard: [...player.discard] };
  let exhaustedTwice = false;
  for (let index = 0; index < count; index += 1) {
    if (!next.deck.length) {
      if (next.recycles >= 1 || !next.discard.length) {
        exhaustedTwice = true;
        break;
      }
      next.deck = epicShuffle(next.discard, random);
      next.discard = [];
      next.recycles += 1;
    }
    if (next.hand.length >= 10) break;
    const card = next.deck.pop();
    if (card) next.hand.push(card);
  }
  return { player: next, exhaustedTwice };
}

function createPlayer(teamId, side, random) {
  const team = epicTeam(teamId);
  const positions = side === 0 ? [[8,4],[8,3],[8,5]] : [[0,4],[0,3],[0,5]];
  const figures = [
    { id: `${side}-major`, role: "major", name: team.major.name, mark: team.major.mark, hp: team.major.hp, maxHp: team.major.hp, ranged: team.major.ranged, pos: positions[0], alive: true, stunned: false },
    ...team.minors.map((minor, index) => ({
      id: `${side}-minor-${index}`, role: "minor", name: minor.name, mark: minor.mark, hp: minor.hp, maxHp: minor.hp, ranged: minor.ranged, pos: positions[index + 1], alive: true, stunned: false,
    })),
  ];
  const deck = epicCreateDeck(teamId, random);
  const player = { id: side, teamId, team, figures, deck, hand: [], discard: [], recycles: 0, skipActions: 0, blockDraw: false };
  return epicDraw(player, 4, random).player;
}

export function epicCreateMatch(playerTeamId, aiTeamId, mapId = "geonosis", random = Math.random) {
  return {
    mapId,
    players: [createPlayer(playerTeamId, 0, random), createPlayer(aiTeamId, 1, random)],
    current: 0,
    round: 1,
    winner: null,
    log: ["결투가 시작되었습니다."],
  };
}

export function epicCardValue(card, mode, handCount, context = {}) {
  let value = mode === "attack" ? card.attack : card.defense;
  if (value === "hand") value = Math.max(0, handCount);
  if (value === "all") return 99;
  if (mode === "attack" && card.effect === "justice" && context.minorDead) return 10;
  return Number(value ?? 0);
}

export function epicResolveCombat(attacker, defender, attackCard, defenseCard, context = {}) {
  const attack = epicCardValue(attackCard, "attack", context.attackerHandCount ?? 0, context);
  const defense = defenseCard
    ? epicCardValue(defenseCard, "defense", context.defenderHandCount ?? 0, context)
    : 0;
  let damage = Math.max(0, attack - defense);
  if (!defenseCard && attackCard.effect === "unblocked-twenty") damage = 20;
  if (!defenseCard && attackCard.effect === "unblocked-six") damage = 6;
  const reflected = defenseCard?.effect === "counter-one" ? 1
    : defenseCard?.effect === "counter-three" ? 3
      : defenseCard?.effect === "reflect-attack" ? attack
        : 0;
  if (["counter-one", "reflect-attack"].includes(defenseCard?.effect)) damage = 0;
  return {
    attack,
    defense,
    damage: Math.min(defender.hp, damage),
    reflected: Math.min(attacker.hp, reflected),
  };
}

function cellKey(row, column) {
  return `${row},${column}`;
}

export function epicReachableCells(match, figureId, steps) {
  const map = EPIC_DUELS_MAPS.find((item) => item.id === match.mapId);
  const figures = match.players.flatMap((player) => player.figures).filter((figure) => figure.alive);
  const figure = figures.find((item) => item.id === figureId);
  if (!figure || figure.stunned) return [];
  const obstacles = new Set(map.obstacles.map(([row, column]) => cellKey(row, column)));
  const occupied = new Set(figures.filter((item) => item.id !== figureId).map((item) => cellKey(...item.pos)));
  const visited = new Map([[cellKey(...figure.pos), 0]]);
  const queue = [figure.pos];
  const result = [];
  const directions = [[1,0],[-1,0],[0,1],[0,-1]];
  while (queue.length) {
    const [row, column] = queue.shift();
    const distance = visited.get(cellKey(row, column));
    if (distance >= steps) continue;
    for (const [dr, dc] of directions) {
      const next = [row + dr, column + dc];
      const key = cellKey(...next);
      if (next[0] < 0 || next[0] > 8 || next[1] < 0 || next[1] > 8 || obstacles.has(key) || visited.has(key)) continue;
      visited.set(key, distance + 1);
      if (!occupied.has(key)) result.push(next);
      if (!occupied.has(key) || figures.find((item) => item.pos[0] === next[0] && item.pos[1] === next[1])?.id.startsWith(`${match.current}-`)) queue.push(next);
    }
  }
  return result;
}

export function epicLineOfSight(match, attacker, defender) {
  if (!attacker.alive || !defender.alive) return false;
  const [ar, ac] = attacker.pos;
  const [dr, dc] = defender.pos;
  const rowStep = Math.sign(dr - ar);
  const columnStep = Math.sign(dc - ac);
  if (!(ar === dr || ac === dc || Math.abs(dr - ar) === Math.abs(dc - ac))) return false;
  if (!attacker.ranged) return Math.max(Math.abs(dr - ar), Math.abs(dc - ac)) === 1;
  const map = EPIC_DUELS_MAPS.find((item) => item.id === match.mapId);
  const blocked = new Set([
    ...map.obstacles.map(([row, column]) => cellKey(row, column)),
    ...match.players.flatMap((player) => player.figures).filter((figure) => figure.alive && figure.id !== attacker.id && figure.id !== defender.id).map((figure) => cellKey(...figure.pos)),
  ]);
  let row = ar + rowStep;
  let column = ac + columnStep;
  while (row !== dr || column !== dc) {
    if (blocked.has(cellKey(row, column))) return false;
    row += rowStep;
    column += columnStep;
  }
  return true;
}

export function epicValidTargets(match, attackerId) {
  const attackerOwner = match.players.find((player) => player.figures.some((figure) => figure.id === attackerId));
  const attacker = attackerOwner?.figures.find((figure) => figure.id === attackerId);
  if (!attacker) return [];
  return match.players
    .filter((player) => player.id !== attackerOwner.id)
    .flatMap((player) => player.figures)
    .filter((figure) => epicLineOfSight(match, attacker, figure))
    .map((figure) => figure.id);
}

export function epicMovementRoll(random = Math.random) {
  const faces = [
    { value: 3, all: false }, { value: 4, all: false }, { value: 5, all: false },
    { value: 2, all: true }, { value: 3, all: true }, { value: 4, all: true },
  ];
  return faces[Math.floor(random() * faces.length)];
}

export function epicWinner(match) {
  const deadMajor = match.players.find((player) => !player.figures.find((figure) => figure.role === "major")?.alive);
  return deadMajor ? (deadMajor.id === 0 ? 1 : 0) : null;
}
