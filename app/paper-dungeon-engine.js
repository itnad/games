import { withKoreanObject, withKoreanSubject } from "./korean-particles.js";

export const PAPER_DUNGEON_CLASSES = [
  {
    id: "guardian",
    name: "종이 수호자",
    icon: "♜",
    tagline: "튼튼한 방어와 묵직한 일격",
    hp: 76,
    mp: 8,
    attack: 10,
    defense: 5,
    crit: 0.08,
    skill: { name: "방패 강타", cost: 3, power: 1.75, description: "방어력 일부를 공격력으로 더합니다." },
  },
  {
    id: "scribe",
    name: "잉크 마도사",
    icon: "✦",
    tagline: "강력한 주문과 넉넉한 마력",
    hp: 56,
    mp: 13,
    attack: 8,
    defense: 2,
    crit: 0.12,
    skill: { name: "별빛 잉크", cost: 4, power: 2.35, description: "적 방어력의 절반을 무시합니다." },
  },
  {
    id: "folder",
    name: "접기 도적",
    icon: "◆",
    tagline: "높은 치명타와 빠른 연속 공격",
    hp: 62,
    mp: 10,
    attack: 9,
    defense: 3,
    crit: 0.22,
    skill: { name: "그림자 접기", cost: 3, power: 1.95, description: "치명타 확률이 두 배가 됩니다." },
  },
];

export const PAPER_DUNGEON_ENEMIES = [
  { name: "잉크 슬라임", icon: "●", hp: 26, attack: 6, defense: 1, xp: 14, gold: 9, flavor: "번지는 몸으로 길을 막습니다." },
  { name: "접힌 박쥐", icon: "⌁", hp: 32, attack: 7, defense: 1, xp: 17, gold: 11, flavor: "천장 틈에서 날카롭게 접혀 내려옵니다." },
  { name: "찢긴 골렘", icon: "▧", hp: 41, attack: 8, defense: 3, xp: 20, gold: 13, flavor: "버려진 종잇조각이 단단하게 뭉쳤습니다." },
  { name: "가위 도적", icon: "✂", hp: 45, attack: 10, defense: 2, xp: 22, gold: 16, flavor: "빈틈을 발견하면 빠르게 파고듭니다." },
  { name: "붉은 제본사", icon: "♛", hp: 68, attack: 11, defense: 4, xp: 32, gold: 28, flavor: "다섯 번째 장을 지키는 중간 보스입니다.", boss: true },
  { name: "유령 책갈피", icon: "†", hp: 55, attack: 12, defense: 3, xp: 27, gold: 20, flavor: "읽히지 못한 이야기 사이를 떠돕니다." },
  { name: "먹구름 마도사", icon: "☁", hp: 62, attack: 13, defense: 4, xp: 30, gold: 23, flavor: "검은 잉크 주문을 준비하고 있습니다." },
  { name: "강철 종이학", icon: "⌃", hp: 72, attack: 14, defense: 5, xp: 34, gold: 26, flavor: "금속처럼 날카로운 날개를 펼칩니다." },
  { name: "봉인 기사", icon: "♞", hp: 82, attack: 15, defense: 6, xp: 38, gold: 30, flavor: "마지막 장으로 향하는 문을 지킵니다." },
  { name: "백지의 용", icon: "♢", hp: 128, attack: 17, defense: 6, xp: 60, gold: 60, flavor: "모든 이야기를 지우려는 최종 보스입니다.", boss: true },
];

const WEAPONS = ["연필검", "은빛 재단검", "별철 만년필", "황금 제본검"];
const ARMORS = ["두꺼운 표지", "은실 망토", "강철 책갑", "용비늘 표지"];

export function paperDungeonEnemy(floor) {
  const template = PAPER_DUNGEON_ENEMIES[Math.max(0, Math.min(9, floor - 1))];
  return { ...template, maxHp: template.hp };
}

export function paperDungeonRewards(floor) {
  const tier = Math.min(3, Math.floor((floor - 1) / 3));
  return [
    { id: "weapon", icon: "⚔", title: WEAPONS[tier], description: `공격력 +${2 + tier}`, attack: 2 + tier },
    { id: "armor", icon: "⬟", title: ARMORS[tier], description: `최대 체력 +${8 + tier * 2} · 방어력 +1`, maxHp: 8 + tier * 2, defense: 1 },
    { id: "essence", icon: "✦", title: "빛나는 잉크", description: "최대 마력 +2 · 물약 +1 · 치명타 +3%", maxMp: 2, potions: 1, crit: 0.03 },
  ];
}

export function createPaperDungeonRun(classId, heroName = "모험가") {
  const heroClass = PAPER_DUNGEON_CLASSES.find((item) => item.id === classId) ?? PAPER_DUNGEON_CLASSES[0];
  return {
    version: 1,
    phase: "battle",
    floor: 1,
    turn: 1,
    defeated: 0,
    classId: heroClass.id,
    player: {
      name: String(heroName || "모험가").trim().slice(0, 8) || "모험가",
      level: 1,
      xp: 0,
      nextXp: 24,
      hp: heroClass.hp,
      maxHp: heroClass.hp,
      mp: heroClass.mp,
      maxMp: heroClass.mp,
      attack: heroClass.attack,
      defense: heroClass.defense,
      crit: heroClass.crit,
      gold: 0,
      potions: 2,
      weapon: "낡은 연필",
      armor: "여행자 표지",
    },
    enemy: paperDungeonEnemy(1),
    rewards: [],
    logs: [`${withKoreanSubject(heroName || "모험가")} 종이 던전의 첫 장을 펼쳤습니다.`],
  };
}

function randomInt(random, minimum, maximum) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function appendLog(state, message) {
  state.logs = [message, ...state.logs].slice(0, 8);
}

function levelUp(state) {
  while (state.player.xp >= state.player.nextXp) {
    state.player.xp -= state.player.nextXp;
    state.player.level += 1;
    state.player.nextXp = 20 + state.player.level * 8;
    state.player.maxHp += 7;
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 14);
    state.player.maxMp += 1;
    state.player.mp = state.player.maxMp;
    state.player.attack += 2;
    state.player.defense += state.player.level % 2;
    appendLog(state, `레벨 ${state.player.level}에 도달해 체력과 능력치가 올랐습니다.`);
  }
}

function winBattle(state) {
  const enemy = state.enemy;
  state.player.xp += enemy.xp;
  state.player.gold += enemy.gold;
  state.defeated += 1;
  appendLog(state, `${withKoreanObject(enemy.name)} 물리치고 경험치 ${enemy.xp}, 금화 ${enemy.gold}개를 얻었습니다.`);
  levelUp(state);
  if (state.floor >= 10) {
    state.phase = "victory";
    return state;
  }
  state.phase = "reward";
  state.rewards = paperDungeonRewards(state.floor);
  return state;
}

export function resolvePaperDungeonAction(current, action, random = Math.random) {
  if (!current || current.phase !== "battle") return current;
  const state = structuredClone(current);
  const heroClass = PAPER_DUNGEON_CLASSES.find((item) => item.id === state.classId) ?? PAPER_DUNGEON_CLASSES[0];
  let defending = false;

  if (action === "attack") {
    const critical = random() < state.player.crit;
    const damage = Math.max(1, state.player.attack + randomInt(random, -1, 2) - state.enemy.defense) * (critical ? 2 : 1);
    state.enemy.hp = Math.max(0, state.enemy.hp - damage);
    state.player.mp = Math.min(state.player.maxMp, state.player.mp + 1);
    appendLog(state, `${withKoreanObject(state.enemy.name)} 공격해 ${damage} 피해를 주었습니다${critical ? " · 치명타!" : ""}`);
  } else if (action === "skill") {
    if (state.player.mp < heroClass.skill.cost) {
      appendLog(state, `${heroClass.skill.name} 사용에 필요한 마력이 부족합니다.`);
      return state;
    }
    state.player.mp -= heroClass.skill.cost;
    const defense = state.classId === "scribe" ? Math.floor(state.enemy.defense / 2) : state.enemy.defense;
    const critical = state.classId === "folder" && random() < Math.min(0.8, state.player.crit * 2);
    const guardBonus = state.classId === "guardian" ? Math.floor(state.player.defense * 0.7) : 0;
    const damage = Math.max(2, Math.floor(state.player.attack * heroClass.skill.power) + guardBonus + randomInt(random, 0, 3) - defense) * (critical ? 2 : 1);
    state.enemy.hp = Math.max(0, state.enemy.hp - damage);
    appendLog(state, `${heroClass.skill.name} 기술로 ${damage} 피해를 주었습니다${critical ? " · 치명타!" : ""}`);
  } else if (action === "defend") {
    defending = true;
    state.player.mp = Math.min(state.player.maxMp, state.player.mp + 2);
    appendLog(state, "방어 자세를 취해 다음 피해를 줄이고 마력 2를 회복했습니다.");
  } else if (action === "potion") {
    if (state.player.potions < 1 || state.player.hp >= state.player.maxHp) {
      appendLog(state, state.player.potions < 1 ? "남은 회복 물약이 없습니다." : "이미 체력이 가득합니다.");
      return state;
    }
    const healed = Math.min(28, state.player.maxHp - state.player.hp);
    state.player.hp += healed;
    state.player.potions -= 1;
    appendLog(state, `회복 물약을 사용해 체력 ${withKoreanObject(healed)} 회복했습니다.`);
  } else {
    return state;
  }

  if (state.enemy.hp <= 0) return winBattle(state);

  const heavy = random() < 0.18;
  const rawDamage = Math.max(1, state.enemy.attack + randomInt(random, -1, 2) + (heavy ? 3 : 0) - state.player.defense);
  const damage = defending ? Math.max(1, Math.ceil(rawDamage / 2)) : rawDamage;
  state.player.hp = Math.max(0, state.player.hp - damage);
  appendLog(state, `${withKoreanSubject(state.enemy.name)} ${heavy ? "강한 공격으로" : "공격해"} ${damage} 피해를 주었습니다.`);
  state.turn += 1;
  if (state.player.hp <= 0) state.phase = "defeat";
  return state;
}

export function choosePaperDungeonReward(current, rewardId) {
  if (!current || current.phase !== "reward") return current;
  const state = structuredClone(current);
  const reward = state.rewards.find((item) => item.id === rewardId);
  if (!reward) return current;

  if (reward.attack) { state.player.attack += reward.attack; state.player.weapon = reward.title; }
  if (reward.defense) { state.player.defense += reward.defense; state.player.armor = reward.title; }
  if (reward.maxHp) { state.player.maxHp += reward.maxHp; state.player.hp += reward.maxHp; }
  if (reward.maxMp) { state.player.maxMp += reward.maxMp; state.player.mp = state.player.maxMp; }
  if (reward.potions) state.player.potions += reward.potions;
  if (reward.crit) state.player.crit = Math.min(0.55, state.player.crit + reward.crit);
  appendLog(state, `${withKoreanObject(reward.title)} 선택했습니다.`);

  state.floor += 1;
  state.phase = "battle";
  state.enemy = paperDungeonEnemy(state.floor);
  state.rewards = [];
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + Math.ceil(state.player.maxHp * 0.12));
  state.player.mp = Math.min(state.player.maxMp, state.player.mp + 2);
  appendLog(state, `${state.floor}층에서 ${withKoreanSubject(state.enemy.name)} 길을 막았습니다.`);
  return state;
}

export function isPaperDungeonSave(value) {
  return Boolean(value && value.version === 1 && value.player && value.enemy && value.floor >= 1 && value.floor <= 10);
}
