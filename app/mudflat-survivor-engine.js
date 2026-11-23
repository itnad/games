export const MUDFLAT_RUN_SECONDS = 240;
export const MUDFLAT_TIDE_FILL_SECONDS = 1;
export const MUDFLAT_JOYSTICK_RADIUS = 72;
export const MUDFLAT_RETURN_GUIDE_SECONDS = 10;
// 생물 수 상한: 살아 있는 생물이 이만큼이면 일반 출현을 멈춘다(해산물 무리는 조금 일찍 멈춘다). 이벤트 생물은 상한 밖이다.
export const MUDFLAT_CREATURE_LIMIT = 240;
export const MUDFLAT_SWARM_CREATURE_LIMIT = MUDFLAT_CREATURE_LIMIT - 15;
// 먼 생물 되돌리기: 플레이어에서 이만큼(px) 넘게 떨어진 생물은 이 시간(초) 뒤에 화면 가장자리 바깥에서 다시 들어온다.
// 돌아다니거나 달아나는 생물이 닿을 수 없는 곳에 쌓여 상한을 채우면, 후반에 화면 주변이 텅 비었다.
export const MUDFLAT_FAR_CREATURE_DISTANCE = 1000;
export const MUDFLAT_FAR_CREATURE_RETURN_SECONDS = 5;

/** 멀어지면 되돌아오는 생물인지. 대왕 박하지, 이벤트 생물(게 돌진·돌진 복어·해파리·펄에서 나오는 게), 랜턴으로만 찾는 숨은 패류, 채집할 수 없는 생물은 그대로 둔다. */
export function mudflatCreatureCanReturn(creature) {
  return Boolean(creature) && creature.hp > 0 && !creature.boss && creature.eventKind === undefined && creature.eventLife === undefined
    && !creature.requiresHeadlamp && !creature.uncollectible && (creature.emergeSeconds ?? 0) <= 0;
}

/**
 * 먼 생물 되돌리기의 한 프레임. 생물의 대기 시간(returnSeconds)을 진행하고, 지금 돌아와야 하는지 알려 준다.
 * 기다리는 5초 사이에 플레이어가 다가와 다시 가까워졌거나, 되돌릴 수 없는 상태(그물에 걸림 등)가 되면 그만둔다.
 * blocked: 이번 프레임에 되돌리기를 하지 않는 경우(튜토리얼, 그물에 걸린 생물).
 */
export function mudflatFarCreatureStep(creature, distance, dt, { blocked = false } = {}) {
  const far = Number(distance) >= MUDFLAT_FAR_CREATURE_DISTANCE;
  if (blocked || !far || !mudflatCreatureCanReturn(creature)) return { returnSeconds: undefined, returnNow: false };
  const waiting = Number.isFinite(creature.returnSeconds) ? creature.returnSeconds : MUDFLAT_FAR_CREATURE_RETURN_SECONDS;
  const left = waiting - Math.max(0, Number(dt) || 0);
  return left > 0 ? { returnSeconds: left, returnNow: false } : { returnSeconds: undefined, returnNow: true };
}

// 운석: 떨어질 자리가 표시된 뒤 실제로 떨어지기까지의 시간(초). 예전 2.1초의 4배 속도다.
export const MUDFLAT_METEOR_FALL_SECONDS = .525;
export const MUDFLAT_TIDE_SPEED_MULTIPLIER = .2;
export const MUDFLAT_TIDE_DAMAGE_RATIO_PER_SECOND = .05;
export const MUDFLAT_TIDE_MESSAGE_INTERVAL = 15;

export const MUDFLAT_CREATURES = [
  { id: "small-crab", name: "작은게", family: "crab", sprite: "/mudflat-creatures/small-crab.svg", icon: "♋", color: "#d6a177", hp: 2, speed: 25, size: 11, xp: 1, score: 6, unlock: 0 },
  { id: "crab", name: "칠게", family: "crab", sprite: "/mudflat-creatures/chilge.svg", icon: "♋", color: "#ef6d52", hp: 4, speed: 34, size: 13, xp: 2, score: 15, unlock: 15 },
  { id: "shore-crab", name: "방게", family: "crab", sprite: "/mudflat-creatures/shore-crab.svg", icon: "♋", color: "#bd8058", hp: 7, speed: 38, size: 15, xp: 3, score: 24, unlock: 40 },
  { id: "fiddler-crab", name: "농게", family: "crab", sprite: "/mudflat-creatures/fiddler-crab.svg", icon: "♋", color: "#e3a449", hp: 12, speed: 43, size: 17, xp: 4, score: 38, unlock: 70 },
  { id: "blue-crab", name: "민꽃게", family: "crab", sprite: "/mudflat-creatures/blue-crab.svg", icon: "♋", color: "#6bafa7", hp: 20, speed: 46, size: 20, xp: 6, score: 62, unlock: 105 },
  { id: "purple-crab", name: "보라돌이", family: "crab", sprite: "/mudflat-creatures/purple-crab.svg", icon: "♋", color: "#a66cb0", hp: 36, speed: 40, size: 24, xp: 10, score: 110, unlock: 150 },
  { id: "shrimp", name: "작은 새우", family: "seafood", sprite: "/mudflat-creatures/shrimp.png", icon: "⌁", color: "#e7c3aa", hp: 5, speed: 34, size: 14 * .8, xp: 3, score: 22, unlock: 32, movement: "wander" },
  { id: "large-shrimp", name: "새우", family: "seafood", sprite: "/mudflat-creatures/shrimp.png", icon: "⌁", color: "#eda584", hp: 5 * 1.5, speed: 34, size: 14 * 1.2, xp: 5, score: 22, unlock: 32, movement: "wander", spawnVariant: true },
  { id: "whelk", name: "소라", family: "seafood", sprite: "/mudflat-creatures/whelk.png", icon: "@", color: "#c99a68", hp: 14, speed: 7.75, size: 9, visualScale: 1.2, xp: 5, score: 45, unlock: 65, movement: "flee", requiresHeadlamp: true },
  { id: "octopus", name: "낙지", family: "seafood", sprite: "/mudflat-creatures/octopus.png", icon: "✣", color: "#c9cdd0", hp: 22, speed: 38, size: 20, xp: 8, score: 75, unlock: 110, movement: "flee" },
  { id: "golbaengi", name: "골뱅이", family: "seafood", sprite: "/mudflat-creatures/golbaengi-v2.png", icon: "@", color: "#b97b42", hp: 16, speed: 7.75, size: 19, visualScale: .8, xp: 6, score: 52, unlock: 90, movement: "chase", requiresHeadlamp: true },
  { id: "flounder", name: "광어", family: "seafood", sprite: "/mudflat-creatures/flounder.png", icon: "◇", color: "#a59369", hp: 30, speed: 52, size: 22, xp: 10, score: 95, unlock: 145, movement: "flee" },
  { id: "pufferfish", name: "복어", family: "seafood", sprite: "/mudflat-creatures/pufferfish.png", icon: "●", color: "#d69a38", hp: 118, speed: 108.5, size: 17.6, xp: 7, score: 68, unlock: 0, movement: "oval", spawnVariant: true },
  { id: "fist-whelk", name: "주먹소라", family: "seafood", sprite: "/mudflat-creatures/whelk.png", icon: "@", color: "#b77f4d", hp: 14, speed: 7.75, size: 18, visualScale: .8, xp: 5, score: 45, unlock: 65, movement: "flee", requiresHeadlamp: true, spawnVariant: true },
  { id: "king-crab", name: "대왕 박하지", family: "crab", sprite: "/mudflat-creatures/king-crab.svg", icon: "♛", color: "#3a195b", hp: 420, speed: 28, size: 43, xp: 80, score: 1800, unlock: 200, boss: true },
];

export const MUDFLAT_ROCK_FINDINGS = [
  { type: "shrimp", name: "작은 새우", movement: "wander", level1Chance: 0.2 * .95, level6Chance: 0.1 * .95 },
  { type: "large-shrimp", name: "새우", movement: "wander", level1Chance: 0.2 * .05, level6Chance: 0.1 * .05 },
  { type: "small-crab", name: "작은게", movement: "chase", level1Chance: 0.3, level6Chance: 0.2 },
  { type: "crab", name: "칠게", movement: "chase", level1Chance: 0.1, level6Chance: 0.1 },
  { type: "blue-crab", name: "민꽃게", movement: "chase", level1Chance: 0.1, level6Chance: 0.1 },
  { type: "octopus", name: "낙지", movement: "flee", level1Chance: 0.1, level6Chance: 0.2 },
  { type: "pufferfish", name: "복어", movement: "oval", level1Chance: 0.05, level6Chance: 0.15 },
];

export const MUDFLAT_CLAM_GRADES = [
  { id: "small-clam", name: "작은조개", xp: 1, score: 5, price: 0, visualSize: 32 },
  { id: "clam", name: "바지락", xp: 2, score: 9, price: 1, visualSize: 39 },
  { id: "dongjuk", name: "동죽", xp: 3, score: 16, price: 2, visualSize: 46 },
  { id: "hard-clam", name: "백합", xp: 5, score: 28, price: 3, visualSize: 53 },
  { id: "ark-shell", name: "피조개", xp: 7, score: 42, price: 10, visualSize: 62 },
  // A razor clam is intentionally a little shorter than before so the long,
  // upright silhouette reads clearly without crowding nearby catches.
  { id: "razor-clam", name: "맛조개", xp: 9, score: 62, price: 12, visualSize: 56, vertical: true },
];

export const MUDFLAT_PEARL = { id: "pearl", name: "진주", xp: 30, score: 500, price: 10000 };
export const MUDFLAT_PEARL_TEST_TAP_COUNT = 5;
export const MUDFLAT_PEARL_TEST_TAP_WINDOW_MS = 850;

export function mudflatPearlTestTapProgress(count = 0, lastTapAt = 0, now = 0) {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  const safeLastTapAt = Math.max(0, Number(lastTapAt) || 0);
  const safeNow = Math.max(0, Number(now) || 0);
  const continued = safeCount > 0
    && safeNow >= safeLastTapAt
    && safeNow - safeLastTapAt <= MUDFLAT_PEARL_TEST_TAP_WINDOW_MS;
  const nextCount = (continued ? safeCount : 0) + 1;
  const triggered = nextCount >= MUDFLAT_PEARL_TEST_TAP_COUNT;
  return { count: triggered ? 0 : nextCount, lastTapAt: safeNow, triggered };
}
export const MUDFLAT_GAEBUL = { id: "gaebul", name: "개불", xp: 11, score: 88, price: 24 };

const MUDFLAT_CLAM_WEIGHTS = [
  [6, 3, 1, 0, 0, 0],
  [5, 2, 1, 1, 1, 0],
  [3, 2, 2, 1, 1, 1],
  [1, 2, 2, 2, 2, 1],
  [1, 1, 2, 2, 2, 2],
  [0, 1, 2, 3, 2, 2],
];

export const MUDFLAT_SEAFOOD_MARKET = [
  { type: "small-crab", name: "작은게", image: "/mudflat-creatures/small-crab.svg", price: 2 },
  { type: "crab", name: "칠게", image: "/mudflat-creatures/chilge.svg", price: 3 },
  { type: "shore-crab", name: "방게", image: "/mudflat-creatures/shore-crab.svg", price: 4 },
  { type: "fiddler-crab", name: "농게", image: "/mudflat-creatures/fiddler-crab.svg", price: 5 },
  { type: "blue-crab", name: "민꽃게", image: "/mudflat-creatures/blue-crab.svg", price: 7 },
  { type: "purple-crab", name: "보라돌이", image: "/mudflat-creatures/purple-crab.svg", price: 9 },
  { type: "shrimp", name: "작은 새우", image: "/mudflat-creatures/shrimp.png", price: 1 },
  { type: "large-shrimp", name: "새우", image: "/mudflat-creatures/shrimp.png", price: 8 },
  { type: "whelk", name: "소라", image: "/mudflat-creatures/whelk.png", price: 2 },
  { type: "fist-whelk", name: "주먹소라", image: "/mudflat-creatures/whelk.png", price: 8 },
  { type: "octopus", name: "낙지", image: "/mudflat-creatures/octopus.png", price: 20 },
  { type: "golbaengi", name: "골뱅이", image: "/mudflat-creatures/golbaengi-v2.png", price: 6 },
  { type: "flounder", name: "광어", image: "/mudflat-creatures/flounder.png", price: 50 },
  { type: "pufferfish", name: "복어", image: "/mudflat-creatures/pufferfish.png", price: 15 },
  ...MUDFLAT_CLAM_GRADES.map((item) => ({ type: item.id, name: item.name, image: item.id === "razor-clam" ? "/mudflat-creatures/razor-clam.svg" : "/mudflat-creatures/clam.png", price: item.price })),
  { type: MUDFLAT_PEARL.id, name: MUDFLAT_PEARL.name, image: "/mudflat-creatures/pearl.png", price: MUDFLAT_PEARL.price, unit: "개" },
  { type: MUDFLAT_GAEBUL.id, name: MUDFLAT_GAEBUL.name, image: "/mudflat-creatures/gaebul.svg", price: MUDFLAT_GAEBUL.price },
  { type: "king-crab", name: "대왕 박하지", image: "/mudflat-creatures/king-crab.svg", price: 100 },
];

// Settlement cards have much less room than the field. Keep each family's
// in-game size relationships readable while reserving the full tile for the
// boss catch.
export function mudflatMarketImageScale(type) {
  const creature = MUDFLAT_CREATURES.find((item) => item.id === type);
  if (creature?.family === "crab") {
    if (creature.boss) return 1;

    const smallestCrabSize = 11;
    const largestRegularCrabSize = 24;
    const normalized = (creature.size - smallestCrabSize) / (largestRegularCrabSize - smallestCrabSize);
    return Math.max(.52, Math.min(.74, .52 + normalized * .22));
  }

  if (type === "whelk") return .62;
  if (type === "fist-whelk") return .82;
  if (type === "golbaengi") return .76;
  if (type === "gaebul") return .9;
  if (type === "shrimp") return .82;
  if (type === "large-shrimp") return 1;

  const clamGrade = MUDFLAT_CLAM_GRADES.find((item) => item.id === type);
  if (clamGrade) {
    const smallestClamSize = 32;
    const largestClamSize = 62;
    const normalized = (clamGrade.visualSize - smallestClamSize) / (largestClamSize - smallestClamSize);
    return Math.max(.62, Math.min(1, .62 + normalized * .38));
  }

  return 1;
}

export const MUDFLAT_SHOP_EQUIPMENT = [
  { id: "cooler", icon: "▣", name: "조과통 업그레이드", description: "한 번에 담을 수 있는 채집 한도를 늘립니다.", max: 6 },
  { id: "headlamp", icon: "◉", name: "헤드랜턴", description: "소라·골뱅이 발견 범위와 어두운 갯벌 시야가 넓어집니다.", max: 6 },
  { id: "vest", icon: "♥", name: "작업 조끼", description: "최대 체력이 늘고 복어 접촉 출혈 시간이 줄어듭니다.", max: 6 },
  { id: "gloves", icon: "⌁", name: "장갑 업그레이드", description: "집게·호미질·뜰채·작살·전기·그물 피해가 상승합니다.", max: 6 },
  { id: "waders", icon: "≫", name: "장화 밑창 업그레이드", description: "물골·깊은 펄 이동 페널티가 줄고 최대 체력이 늘어납니다.", max: 6 },
];

export const MUDFLAT_CATCH_CAPACITIES = [500, 800, 1200, 1700, 2300, 3000, 3800];
export const MUDFLAT_VEST_HP_BONUSES = [0, 25, 50, 100, 200, 400, 800];
export const MUDFLAT_VEST_BLEED_REDUCTIONS = [0, .5, .55, .6, .65, .7, .75];
export const MUDFLAT_GLOVE_POWER_BONUSES = [0, .06, .11, .15, .18, .2, .21];
export const MUDFLAT_WADER_TERRAIN_REDUCTIONS = [0, .3, .4, .5, .6, .7, .75];
export const MUDFLAT_WADER_HP_BONUSES = [0, .1, .12, .14, .16, .18, .2];
export const MUDFLAT_HEADLAMP_DISCOVERY_RANGES = [0, 155, 185, 215, 245, 275, 305];

export const MUDFLAT_RECOVERY_FOODS = [
  { id: "fishcake", icon: "♨", name: "따뜻한 어묵국", description: "체력을 35 회복합니다.", price: 35, heal: 35 },
  { id: "riceball", icon: "●", name: "든든한 주먹밥", description: "체력을 70 회복합니다.", price: 65, heal: 70 },
  { id: "porridge", icon: "◉", name: "해물죽 한 그릇", description: "체력을 모두 회복합니다.", price: 110, heal: Infinity },
];

export const MUDFLAT_UPGRADES = [
  { id: "hoe", icon: "⌁", name: "갯벌 파동", description: "빛나는 갯벌 파동의 범위와 위력이 커집니다.", max: 6 },
  { id: "net", icon: "◇", name: "장거리 자동 뜰채", description: "화면 안에 보이는 해산물에 자동으로 뜰채를 던집니다.", max: 6 },
  { id: "salt", icon: "✦", name: "소금 결정의 정령", description: "반짝이는 결정 정령이 주위를 돌며 해산물을 채집합니다.", max: 6 },
  { id: "boots", icon: "≫", name: "갯벌 장화", description: "진흙 저항이 줄고 이동속도가 빨라집니다.", max: 5 },
  { id: "basket", icon: "◉", name: "쓸어담기", description: "경험치와 보상을 끌어당기는 범위가 넓어집니다.", max: 5 },
  { id: "stamina", icon: "♥", name: "든든한 간식", description: "최대 체력과 현재 체력을 회복합니다.", max: 5 },
];

export const MUDFLAT_GENERAL_UPGRADES = [
  { id: "basket", icon: "◉", name: "쓸어담기", description: "경험치와 보상을 끌어당기는 범위가 넓어집니다.", max: 6 },
  { id: "tongs", icon: "⌁", name: "집게 숙련도", description: "집게 회전 속도와 위력이 상승합니다.", max: 6 },
  { id: "harpoon", icon: "➶", name: "작살던지기", description: "가장 가까운 해산물을 향해 여러 대상을 관통하는 작살을 던집니다.", max: 6 },
  { id: "boots", icon: "≫", name: "갯벌 장화", description: "깊은 펄에서 발 빠짐이 줄고, 이동속도가 빨라집니다.", max: 6 },
  { id: "snack", icon: "♥", name: "든든한 간식", description: "최대 체력이 기본 대비 20% 상승하며 현재 체력을 전부 회복합니다.", max: 6 },
  { id: "rocker", icon: "◆", name: "돌뒤집개", description: "돌 밑에 숨어있는 해산물을 더 빨리 더 잘 찾아낼 수 있습니다.", max: 6 },
  { id: "net", icon: "◇", name: "뜰채", description: "화면 안의 가까운 해산물에게 자동으로 뜰채를 던집니다.", max: 6 },
  { id: "digging", icon: "⌁", name: "호미질", description: "조개 구멍에서 더 좋은 조개를 찾을 확률이 높아집니다.", max: 6 },
  { id: "electric", icon: "ϟ", name: "전기 스파크", description: "체력이 충분할 때 집게 범위의 해산물에게 주기적으로 전기 피해를 줍니다.", max: 6, advanced: true, requiredMasteries: 1 },
  { id: "cast-net", icon: "⌗", name: "그물 투척", description: "해산물이 모인 빈 갯벌에 그물을 펼쳐 잠시 붙잡고 피해를 줍니다.", max: 6, advanced: true, requiredMasteries: 2 },
  { id: "guard-basket", icon: "◍", name: "소쿠리의 달인", description: "소쿠리를 휘둘러 화면의 경험치 보석을 쓸어 담고, 충전된 소쿠리가 물살·운석·접촉 피해를 한 번 막아 줍니다.", max: 6, advanced: true, requiredGems: 100 },
  { id: "hoe-bot", icon: "⚙", name: "호미봇", description: "호미 모양 로봇이 따라다니며 가까운 조개 구멍을 찾아 대신 파냅니다. 조개 등급은 호미질 레벨을 따릅니다.", max: 6, advanced: true, requiredDigs: 20 },
  { id: "rock-lift", icon: "⌾", name: "건곤대나이", description: "갯벌을 들썩여 가까운 바위를 띄웠다 떨어뜨립니다. 떨어진 자리의 해산물이 피해를 입고 바위는 사라지며, 바위 밑 발견물은 돌뒤집개 레벨을 따릅니다.", max: 6, advanced: true, requiredSkills: 5 },
  { id: "smash", icon: "✊", name: "뻘권", description: "조작 방향으로 한 걸음 내디디며 주먹을 내질러 앞의 해산물에 피해를 주고 멀리 밀쳐 냅니다. 바위에 부딪히면 추가 피해, Lv.5부터는 날아가다 부딪힌 해산물도 함께 밀립니다.", max: 6, advanced: true, requiredLevel3Skills: 4 },
  { id: "fireball", icon: "☄", name: "파이어볼", description: "1초마다 제멋대로 흔들리며 날아가는 불덩이를 쏩니다. 처음 맞은 해산물과 그 근처에 피해를 주고, 레벨이 오르면 한 번에 더 많이 쏩니다.", max: 6, advanced: true, requiredSelectableSkills: 6, requiredSelectableLevel: 1, requiredHitFamily: "crab" },
  { id: "flame-burst", icon: "♨", name: "화염 방사", description: "5초마다 바라보는 방향을 시작으로 사방에 불줄기를 뿜어 닿는 모든 해산물에 큰 피해를 줍니다.", max: 6, advanced: true, requiredSelectableSkills: 5, requiredSelectableLevel: 2, requiredHitFamily: "shrimp" },
  { id: "frost-trail", icon: "❄", name: "서리 발자국", description: "지나간 자리에 서리 바닥을 남깁니다. 바닥 위의 해산물은 느려지고 조금씩 얼어붙는 피해를 받습니다.", max: 6, advanced: true, requiredSelectableSkills: 5, requiredSelectableLevel: 1, requiredHitFamily: "rock" },
  { id: "frost-wave", icon: "❆", name: "빙결 파동", description: "주위에 냉기 고리를 퍼뜨려 닿는 모든 해산물에 피해를 주고 느리게 합니다. Lv.6은 잠시 얼립니다.", max: 6, advanced: true, requiredSelectableSkills: 4, requiredSelectableLevel: 3, requiredHitFamily: "tide" },
  { id: "chain-lightning", icon: "⚡", name: "번개 체인", description: "가까운 해산물에 번개를 꽂고 근처 해산물로 번지게 합니다. 맞은 해산물은 잠깐 감전됩니다.", max: 6, advanced: true, requiredSelectableSkills: 5, requiredSelectableLevel: 1, requiredHitFamily: "mosquito" },
  { id: "thunderbolt", icon: "☇", name: "낙뢰", description: "화면 안에서 체력이 가장 높은 해산물에게 하늘에서 번개를 떨어뜨립니다. Lv.5부터 연달아 떨어집니다.", max: 6, advanced: true, requiredSelectableSkills: 4, requiredSelectableLevel: 2, requiredHitFamily: "pufferfish" },
];

// 소쿠리의 달인은 캠페인 누적으로 경험치 보석 100개를 주워야 열린다.
export const MUDFLAT_GUARD_BASKET_UNLOCK_GEMS = 100;
// 호미봇은 플레이어가 직접 조개 구멍을 20번 파야 열린다(캠페인 누적). 호미질
// 레벨과 무관하므로 호미질 Lv.1에서도 로봇의 차이를 겪어 볼 수 있다.
export const MUDFLAT_HOE_BOT_UNLOCK_DIGS = 20;
// 건곤대나이는 집게·호미질을 뺀 선택 기술 5종을 인벤토리에 익히면 열린다(보관 포함).
export const MUDFLAT_ROCK_LIFT_UNLOCK_SKILLS = 5;
// 뻘권은 기본 기술을 포함한 채집기술 중 Lv.3 이상이 4개면 열린다.
export const MUDFLAT_SMASH_UNLOCK_SKILLS = 4;
export const MUDFLAT_SMASH_UNLOCK_LEVEL = 3;
// 화염 계열: 파이어볼은 기본 기술을 뺀 선택 기술 6개(Lv.1 이상) + 게에게 피해를 받은 경험,
// 화염 방사는 선택 기술 5개(Lv.2 이상) + 새우에게 피해를 받은 경험으로 연다.
export const MUDFLAT_FIREBALL_UNLOCK_SKILLS = 6;
export const MUDFLAT_FLAME_BURST_UNLOCK_SKILLS = 5;
export const MUDFLAT_FLAME_BURST_UNLOCK_LEVEL = 2;
export const MUDFLAT_SHRIMP_TYPES = ["shrimp", "large-shrimp"];
// 빙결 계열: 서리 발자국은 선택 기술 5개(Lv.1 이상) + 바위 피격, 빙결 파동은 선택 기술 4개(Lv.3 이상) + 돌발 물살 피격.
export const MUDFLAT_FROST_TRAIL_UNLOCK_SKILLS = 5;
export const MUDFLAT_FROST_WAVE_UNLOCK_SKILLS = 4;
export const MUDFLAT_FROST_WAVE_UNLOCK_LEVEL = 3;
// 피격 경험 종류별 잠긴 카드 문구.
export const MUDFLAT_HIT_LABELS = { crab: "게에게 피격", shrimp: "새우에게 피격", rock: "바위에 피격", tide: "돌발 물살에 피격", mosquito: "모기떼에게 피격", pufferfish: "복어에게 피격" };
// 번개 계열: 번개 체인은 선택 기술 5개(Lv.1 이상) + 모기떼 피격, 낙뢰는 선택 기술 4개(Lv.2 이상) + 복어 피격.
export const MUDFLAT_CHAIN_LIGHTNING_UNLOCK_SKILLS = 5;
export const MUDFLAT_THUNDERBOLT_UNLOCK_SKILLS = 4;
export const MUDFLAT_THUNDERBOLT_UNLOCK_LEVEL = 2;
// 번개를 맞은 해산물(대왕 박하지 제외)은 0.2초 감전되어 멈춘다.
export const MUDFLAT_SHOCK_SECONDS = .2;

// 감전: shockUntil(원정 경과 시각)까지 이동 0. 둔화와 별개 상태라 둔화 시간을 늘리지 않는다.
export function mudflatShockMultiplier(creature, elapsed = 0) {
  return creature && creature.shockUntil > elapsed ? 0 : 1;
}

// 번개 체인 경로: origin에서 checkRadius 안의 가장 가까운 생물에서 시작해, 아직 맞지 않은 가장 가까운 생물로
// jump 거리 안에서 최대 chain번 번진다. 한 생물은 한 번만. 체력 0 이하는 제외.
export function mudflatChainLightningPath(creatures = [], origin = { x: 0, y: 0 }, stats = {}) {
  const alive = (Array.isArray(creatures) ? creatures : []).filter((creature) => creature && creature.hp > 0);
  const nearest = (from, candidates, limit) => {
    let best = null; let bestDistance = Infinity;
    for (const creature of candidates) {
      const distance = Math.hypot(creature.x - from.x, creature.y - from.y) - (creature.size ?? 0);
      if (distance <= limit && distance < bestDistance) { best = creature; bestDistance = distance; }
    }
    return best;
  };
  const first = nearest(origin, alive, Math.max(0, Number(stats.checkRadius) || 0));
  if (!first) return [];
  const path = [first];
  const maxChain = Math.max(1, Math.floor(Number(stats.chain) || 1));
  while (path.length < maxChain) {
    const last = path[path.length - 1];
    const next = nearest(last, alive.filter((creature) => !path.includes(creature)), Math.max(0, Number(stats.jump) || 0));
    if (!next) break;
    path.push(next);
  }
  return path;
}

// 둔화 상태. slowUntil(원정 경과 시각)까지 이동 속도에 (1 - slowFactor)를 곱한다. factor 1은 빙결(이동 0).
export function mudflatSlowMultiplier(creature, elapsed = 0) {
  if (!creature || !(creature.slowUntil > elapsed)) return 1;
  return Math.max(0, 1 - Math.max(0, Math.min(1, Number(creature.slowFactor) || 0)));
}

// 새 둔화는 더 강한 배율과 더 긴 시간 쪽으로 덮어쓴다(겹쳐 쌓지 않음).
export function mudflatApplySlow(creature, factor = 0, seconds = 0, elapsed = 0) {
  if (!creature) return;
  const active = (creature.slowUntil ?? -Infinity) > elapsed;
  const currentFactor = active ? Math.max(0, Math.min(1, Number(creature.slowFactor) || 0)) : 0;
  creature.slowFactor = Math.max(currentFactor, Math.max(0, Math.min(1, factor)));
  creature.slowUntil = Math.max(active ? creature.slowUntil : 0, elapsed + Math.max(0, seconds));
}
// 플레이어에게 피해를 준 생물이 어느 피격 경험에 해당하는지("crab" | "shrimp" | null).
export function mudflatHitFamily(creature) {
  if (!creature) return null;
  if (creature.family === "crab") return "crab";
  if (MUDFLAT_SHRIMP_TYPES.includes(creature.type)) return "shrimp";
  if (creature.type === "pufferfish") return "pufferfish";
  return null;
}

// 집게와 호미질은 모든 일반 원정에 기본으로 장착되는 채집 도구다.
// 나머지 기술 여섯 개만 빌드를 구성하는 선택 기술 슬롯을 사용한다.
export const MUDFLAT_FIXED_GENERAL_SKILL_IDS = ["tongs", "digging"];
export const MUDFLAT_SELECTABLE_SKILL_LIMIT = 6;
const MUDFLAT_BASE_TONG_REACH = 84;
// Lv.1~6 전기 스파크는 기본 집게 범위를 유지한다. 이후 단계는 이 값만
// 조정하면 확장 범위를 별도로 설계할 수 있다.
const MUDFLAT_ELECTRIC_POST_SIX_REACH_STEP = 12;

function mudflatSafeLevel(level = 0) {
  return Math.max(0, Math.min(6, Math.floor(Number(level) || 0)));
}

export function mudflatCatchCapacity(level = 0) {
  return MUDFLAT_CATCH_CAPACITIES[mudflatSafeLevel(level)];
}

export function mudflatHeadlampDiscoveryRange(level = 0) {
  return MUDFLAT_HEADLAMP_DISCOVERY_RANGES[mudflatSafeLevel(level)];
}

export function mudflatHeadlampEncounterLimit(level = 0) {
  return [0, 1, 2, 2, 3, 3, 4][mudflatSafeLevel(level)];
}

export function mudflatEquipmentDescription(id, level = 1) {
  const safeLevel = Math.max(1, mudflatSafeLevel(level));
  if (id === "headlamp") return `반경 ${mudflatHeadlampDiscoveryRange(safeLevel)} 안에서 소라와 골뱅이를 밝힙니다.`;
  if (id === "cooler") return `${mudflatCatchCapacity(safeLevel).toLocaleString()}마리까지 채집 가능합니다.`;
  if (id === "vest") return `기본 최대 체력보다 ${MUDFLAT_VEST_HP_BONUSES[safeLevel]} 높아지고 출혈 시간이 ${Math.round(MUDFLAT_VEST_BLEED_REDUCTIONS[safeLevel] * 100)}% 감소합니다.`;
  if (id === "gloves") return `모든 채집 도구의 위력이 기본 수치보다 ${Math.round(MUDFLAT_GLOVE_POWER_BONUSES[safeLevel] * 100)}% 증가합니다.`;
  if (id === "waders") return `지형 이동 페널티가 ${Math.round(MUDFLAT_WADER_TERRAIN_REDUCTIONS[safeLevel] * 100)}% 감소하고 기본 최대 체력보다 ${Math.round(MUDFLAT_WADER_HP_BONUSES[safeLevel] * 100)}% 상승합니다.`;
  return "장비 효과를 확인할 수 없습니다.";
}

export function mudflatEquipmentStats(equipment = {}, baseMaxHp = 100, snackLevel = 0) {
  const vestLevel = mudflatSafeLevel(equipment.vest);
  const gloveLevel = mudflatSafeLevel(equipment.gloves);
  const waderLevel = mudflatSafeLevel(equipment.waders);
  const safeBaseHp = Math.max(1, Number(baseMaxHp) || 100);
  // Every maximum-HP effect is calculated independently from the immutable
  // base HP and then added. Purchasing one item must never compound or replace
  // a bonus already supplied by another item.
  const waderHpBonus = safeBaseHp * MUDFLAT_WADER_HP_BONUSES[waderLevel];
  const snackHpBonus = safeBaseHp * mudflatSafeLevel(snackLevel) * .2;
  return {
    catchCapacity: mudflatCatchCapacity(equipment.cooler),
    maxHp: safeBaseHp + waderHpBonus + snackHpBonus + MUDFLAT_VEST_HP_BONUSES[vestLevel],
    vestHpBonus: MUDFLAT_VEST_HP_BONUSES[vestLevel],
    bleedDurationReduction: MUDFLAT_VEST_BLEED_REDUCTIONS[vestLevel],
    toolPowerMultiplier: 1 + MUDFLAT_GLOVE_POWER_BONUSES[gloveLevel],
    terrainPenaltyReduction: MUDFLAT_WADER_TERRAIN_REDUCTIONS[waderLevel],
  };
}

export function mudflatTerrainSpeedMultiplier(baseMultiplier = 1, waderLevel = 0) {
  const safeBase = Math.max(0, Math.min(1, Number(baseMultiplier) || 0));
  const reduction = MUDFLAT_WADER_TERRAIN_REDUCTIONS[mudflatSafeLevel(waderLevel)];
  return 1 - (1 - safeBase) * (1 - reduction);
}

export function mudflatBleedDamage(maxHp = 0) {
  return Math.max(0, Number(maxHp) || 0) * .01;
}

/**
 * 해금형 기술 판정. 마스터리는 인벤토리 기준이고, 소쿠리의 달인은 캠페인 누적
 * 경험치 보석 수(stats.gemsCollected)로 연다.
 * @param {Record<string, number>} levels
 * @param {{ gemsCollected?: number, digsCompleted?: number, hitByCrab?: boolean, hitByShrimp?: boolean, hitByRock?: boolean, hitByTide?: boolean, hitByMosquito?: boolean, hitByPufferfish?: boolean }} [stats]
 */
export function mudflatAdvancedSkillUnlocks(levels = {}, stats = {}) {
  const masteryCount = MUDFLAT_GENERAL_UPGRADES.filter((skill) => !skill.advanced && (levels[skill.id] ?? 0) >= 5).length;
  const gemsCollected = Math.max(0, Math.floor(Number(stats?.gemsCollected) || 0));
  const digsCompleted = Math.max(0, Math.floor(Number(stats?.digsCompleted) || 0));
  const skillCount = mudflatSelectableSkillIds(levels).length;
  const level3Count = MUDFLAT_GENERAL_UPGRADES.filter((skill) => (levels[skill.id] ?? 0) >= MUDFLAT_SMASH_UNLOCK_LEVEL).length;
  const selectableLevel2Count = MUDFLAT_GENERAL_UPGRADES.filter((skill) => !MUDFLAT_FIXED_GENERAL_SKILL_IDS.includes(skill.id) && (levels[skill.id] ?? 0) >= MUDFLAT_FLAME_BURST_UNLOCK_LEVEL).length;
  const selectableLevel3Count = MUDFLAT_GENERAL_UPGRADES.filter((skill) => !MUDFLAT_FIXED_GENERAL_SKILL_IDS.includes(skill.id) && (levels[skill.id] ?? 0) >= MUDFLAT_FROST_WAVE_UNLOCK_LEVEL).length;
  const hitByCrab = stats?.hitByCrab === true;
  const hitByShrimp = stats?.hitByShrimp === true;
  const hitByRock = stats?.hitByRock === true;
  const hitByTide = stats?.hitByTide === true;
  const hitByMosquito = stats?.hitByMosquito === true;
  const hitByPufferfish = stats?.hitByPufferfish === true;
  return {
    masteryCount, gemsCollected, digsCompleted, skillCount, level3Count, selectableLevel2Count, selectableLevel3Count, hitByCrab, hitByShrimp, hitByRock, hitByTide, hitByMosquito, hitByPufferfish,
    electric: masteryCount >= 1, castNet: masteryCount >= 2,
    guardBasket: gemsCollected >= MUDFLAT_GUARD_BASKET_UNLOCK_GEMS,
    hoeBot: digsCompleted >= MUDFLAT_HOE_BOT_UNLOCK_DIGS,
    rockLift: skillCount >= MUDFLAT_ROCK_LIFT_UNLOCK_SKILLS,
    smash: level3Count >= MUDFLAT_SMASH_UNLOCK_SKILLS,
    fireball: skillCount >= MUDFLAT_FIREBALL_UNLOCK_SKILLS && hitByCrab,
    flameBurst: selectableLevel2Count >= MUDFLAT_FLAME_BURST_UNLOCK_SKILLS && hitByShrimp,
    frostTrail: skillCount >= MUDFLAT_FROST_TRAIL_UNLOCK_SKILLS && hitByRock,
    frostWave: selectableLevel3Count >= MUDFLAT_FROST_WAVE_UNLOCK_SKILLS && hitByTide,
    chainLightning: skillCount >= MUDFLAT_CHAIN_LIGHTNING_UNLOCK_SKILLS && hitByMosquito,
    thunderbolt: selectableLevel2Count >= MUDFLAT_THUNDERBOLT_UNLOCK_SKILLS && hitByPufferfish,
  };
}

// 두 해금 상태를 비교해 새로 열린 기술이 있는지 알려 준다(발견 문구용).
/** @param {Record<string, unknown>} before @param {Record<string, unknown>} after */
export function mudflatNewUnlocks(before, after) {
  return Object.entries(after).some(([key, value]) => value === true && before[key] !== true);
}

/** @param {{ id: string, advanced?: boolean }} skill @param {ReturnType<typeof mudflatAdvancedSkillUnlocks>} unlocks */
export function mudflatSkillUnlocked(skill, unlocks) {
  if (!skill?.advanced) return true;
  if (skill.id === "electric") return unlocks.electric;
  if (skill.id === "cast-net") return unlocks.castNet;
  if (skill.id === "guard-basket") return unlocks.guardBasket;
  if (skill.id === "hoe-bot") return unlocks.hoeBot;
  if (skill.id === "rock-lift") return unlocks.rockLift;
  if (skill.id === "smash") return unlocks.smash;
  if (skill.id === "fireball") return unlocks.fireball;
  if (skill.id === "flame-burst") return unlocks.flameBurst;
  if (skill.id === "frost-trail") return unlocks.frostTrail;
  if (skill.id === "frost-wave") return unlocks.frostWave;
  if (skill.id === "chain-lightning") return unlocks.chainLightning;
  if (skill.id === "thunderbolt") return unlocks.thunderbolt;
  return false;
}

// 정비 화면 잠긴 카드용 진행 표시.
/**
 * @param {{ id: string, advanced?: boolean, requiredMasteries?: number, requiredGems?: number, requiredDigs?: number, requiredSkills?: number, requiredLevel3Skills?: number, requiredSelectableSkills?: number, requiredSelectableLevel?: number, requiredHitFamily?: string }} skill
 * @param {Record<string, number>} levels
 * @param {{ gemsCollected?: number, digsCompleted?: number, hitByCrab?: boolean, hitByShrimp?: boolean, hitByRock?: boolean, hitByTide?: boolean, hitByMosquito?: boolean, hitByPufferfish?: boolean }} [stats]
 */
export function mudflatSkillUnlockProgress(skill, levels = {}, stats = {}) {
  const unlocks = mudflatAdvancedSkillUnlocks(levels, stats);
  if (!skill?.advanced) return { unlocked: true, current: 0, target: 0, label: "" };
  if (skill.id === "hoe-bot") {
    const target = skill.requiredDigs ?? MUDFLAT_HOE_BOT_UNLOCK_DIGS;
    return { unlocked: unlocks.hoeBot, current: Math.min(unlocks.digsCompleted, target), target, label: `호미질 ${Math.min(unlocks.digsCompleted, target)} / ${target}` };
  }
  if (skill.id === "rock-lift") {
    const target = skill.requiredSkills ?? MUDFLAT_ROCK_LIFT_UNLOCK_SKILLS;
    return { unlocked: unlocks.rockLift, current: Math.min(unlocks.skillCount, target), target, label: `선택 기술 ${Math.min(unlocks.skillCount, target)} / ${target}` };
  }
  if (skill.id === "smash") {
    const target = skill.requiredLevel3Skills ?? MUDFLAT_SMASH_UNLOCK_SKILLS;
    return { unlocked: unlocks.smash, current: Math.min(unlocks.level3Count, target), target, label: `Lv.${MUDFLAT_SMASH_UNLOCK_LEVEL} 이상 기술 ${Math.min(unlocks.level3Count, target)} / ${target}` };
  }
  if (skill.requiredSelectableSkills) {
    // 선택 기술 수 조건 + 피격 경험 조건을 함께 보여 준다.
    const minLevel = skill.requiredSelectableLevel ?? 1;
    const count = Math.min(minLevel >= 3 ? unlocks.selectableLevel3Count : minLevel >= 2 ? unlocks.selectableLevel2Count : unlocks.skillCount, skill.requiredSelectableSkills);
    const hitFlags = { crab: unlocks.hitByCrab, shrimp: unlocks.hitByShrimp, rock: unlocks.hitByRock, tide: unlocks.hitByTide, mosquito: unlocks.hitByMosquito, pufferfish: unlocks.hitByPufferfish };
    const hitDone = skill.requiredHitFamily ? hitFlags[skill.requiredHitFamily] === true : true;
    const hitLabel = skill.requiredHitFamily ? (MUDFLAT_HIT_LABELS[skill.requiredHitFamily] ?? "") : "";
    return { unlocked: mudflatSkillUnlocked(skill, unlocks), current: count, target: skill.requiredSelectableSkills, label: `Lv.${minLevel} 이상 선택 기술 ${count} / ${skill.requiredSelectableSkills}${hitLabel ? ` · ${hitLabel} ${hitDone ? "○" : "×"}` : ""}` };
  }
  if (skill.id === "guard-basket") {
    const target = skill.requiredGems ?? MUDFLAT_GUARD_BASKET_UNLOCK_GEMS;
    return { unlocked: unlocks.guardBasket, current: Math.min(unlocks.gemsCollected, target), target, label: `경험치 보석 ${Math.min(unlocks.gemsCollected, target)} / ${target}` };
  }
  const target = skill.requiredMasteries ?? 1;
  return { unlocked: mudflatSkillUnlocked(skill, unlocks), current: Math.min(unlocks.masteryCount, target), target, label: `숙련 Lv.5 기술 ${Math.min(unlocks.masteryCount, target)} / ${target}` };
}

// 소쿠리의 달인 수치. 난수 없이 레벨만으로 정해진다.
export function mudflatGuardBasketStats(level = 0) {
  const safeLevel = mudflatSafeLevel(level);
  if (!safeLevel) return { pullInterval: Infinity, pullRadius: 0, rechargeSeconds: Infinity, charges: 0, bleedStop: false, invulnerableSeconds: 0 };
  return {
    pullInterval: [10, 10, 9, 9, 8, 7][safeLevel - 1],
    pullRadius: [360, 450, 540, 640, 760, 1200][safeLevel - 1],
    rechargeSeconds: [60, 55, 50, 45, 40, 35][safeLevel - 1],
    charges: 1,
    bleedStop: safeLevel >= 3,
    invulnerableSeconds: safeLevel >= 6 ? 1 : safeLevel >= 5 ? .8 : 0,
  };
}

// 호미봇 수치. 로봇 레벨은 작업 속도·탐색 범위·이동 속도·대수만 정하고,
// 파낸 조개의 등급은 플레이어의 호미질 레벨로 굴린다.
export function mudflatHoeBotStats(level = 0) {
  const safeLevel = mudflatSafeLevel(level);
  if (!safeLevel) return { digSeconds: Infinity, searchRange: 0, speedMultiplier: 0, bots: 0, gaebul: false };
  return {
    digSeconds: [4, 3.5, 3, 2.6, 2.2, 1.8][safeLevel - 1],
    searchRange: [260, 320, 380, 440, 1200, 1200][safeLevel - 1],
    speedMultiplier: [.9, 1, 1.1, 1.2, 1.3, 1.4][safeLevel - 1],
    bots: safeLevel >= 6 ? 2 : 1,
    gaebul: safeLevel >= 4,
  };
}

// 건곤대나이 수치. 주기·반경·바위 수·낙하 피해만 정하고, 바위 밑 발견물은
// 돌뒤집개 레벨로 굴린다. 체공 0.9초 뒤 0.15초에 걸쳐 떨어진다.
export const MUDFLAT_ROCK_LIFT_SECONDS = .9;
export const MUDFLAT_ROCK_LIFT_FALL_SECONDS = .15;
export function mudflatRockLiftStats(level = 0) {
  const safeLevel = mudflatSafeLevel(level);
  if (!safeLevel) return { interval: Infinity, radius: 0, rocks: 0, damage: 0, impactPadding: 0 };
  return {
    interval: [14, 13, 12, 10, 9, 8][safeLevel - 1],
    radius: [220, 260, 300, 340, 400, 1200][safeLevel - 1],
    rocks: [2, 3, 4, 5, 6, 7][safeLevel - 1],
    damage: [12, 16, 20, 26, 32, 40][safeLevel - 1],
    impactPadding: [18, 20, 22, 24, 26, 28][safeLevel - 1],
  };
}

// 뻘권 수치. 타격 통로는 플레이어 앞 length × width, 넉백은 0.35초 동안 knockback px.
// 바위에 부딪히면 rockBonus 추가 피해, Lv.5부터 날아가다 닿은 해산물에 50% 피해와 넉백을 전파한다.
export const MUDFLAT_SMASH_KNOCKBACK_SECONDS = .35;
export const MUDFLAT_SMASH_CHAIN_RATIO = .5;
export function mudflatSmashStats(level = 0) {
  const safeLevel = mudflatSafeLevel(level);
  if (!safeLevel) return { cooldown: Infinity, length: 0, width: 0, damage: 0, knockback: 0, rockBonus: 0, chain: false, triggerRange: 0, triggerHalfWidth: 0 };
  return {
    cooldown: [12, 10, 8, 6, 5, 4][safeLevel - 1],
    length: [120, 135, 150, 165, 180, 200][safeLevel - 1],
    width: [70, 78, 86, 94, 102, 110][safeLevel - 1],
    damage: [10, 15, 20, 30, 40, 50][safeLevel - 1],
    knockback: [120, 150, 180, 210, 240, 270][safeLevel - 1],
    rockBonus: [10, 13, 16, 20, 25, 30][safeLevel - 1],
    chain: safeLevel >= 5,
    triggerRange: 48,
    triggerHalfWidth: 40,
  };
}

// 파이어볼 수치. 1초마다 한 묶음(shots발)을 spacing 간격으로 쏜다. 불덩이는 speed로 range까지
// 날아가며 좌우로 wobble px 흔들리고, 처음 맞은 해산물 반경 splash 안에 같은 피해를 준다.
export function mudflatFireballStats(level = 0) {
  const safeLevel = mudflatSafeLevel(level);
  if (!safeLevel) return { interval: Infinity, shots: 0, spacing: 0, damage: 0, speed: 0, range: 0, splash: 0, wobble: 0, wobblePeriod: 1, sectorHalfAngle: 0 };
  return {
    interval: 1,
    shots: safeLevel,
    spacing: [0, .4, .2, .1, .1, .1][safeLevel - 1],
    damage: safeLevel * 10,
    speed: 240,
    range: 260,
    splash: 40,
    wobble: 14,
    wobblePeriod: .35,
    sectorHalfAngle: Math.PI / 4,
  };
}

// 화염 방사 수치. interval마다 바라보는 방향을 첫 줄기로 rays방향에 길이 length·폭 width 불줄기를
// 뿜어 닿는 모든 해산물에 damage를 준다. 반경 checkRadius 안에 해산물이 있을 때만 발동한다.
export function mudflatFlameBurstStats(level = 0) {
  const safeLevel = mudflatSafeLevel(level);
  if (!safeLevel) return { interval: Infinity, rays: 0, damage: 0, length: 0, width: 0, sweepSeconds: 0, checkRadius: 0 };
  return {
    interval: 5,
    rays: [4, 5, 6, 7, 8, 8][safeLevel - 1],
    damage: safeLevel >= 6 ? 150 : 100,
    length: 170,
    width: 34,
    sweepSeconds: .35,
    checkRadius: 170,
  };
}

// 서리 발자국 수치. interval마다 플레이어 자리에 반경 radius·수명 life의 서리 바닥을 남기고(최대 maxPatches),
// 바닥 위 해산물에 tickSeconds마다 tickDamage와 둔화 slow를 준다. 둔화는 바닥을 벗어난 뒤 lingerSeconds 더 간다.
export function mudflatFrostTrailStats(level = 0) {
  const safeLevel = mudflatSafeLevel(level);
  if (!safeLevel) return { interval: Infinity, radius: 0, life: 0, slow: 0, tickDamage: 0, tickSeconds: .5, lingerSeconds: 1, maxPatches: 0 };
  return {
    interval: .9,
    radius: [34, 38, 42, 46, 50, 56][safeLevel - 1],
    life: [2.5, 3, 3.5, 4, 4.5, 5][safeLevel - 1],
    slow: [.3, .35, .4, .45, .5, .55][safeLevel - 1],
    tickDamage: [3, 4, 5, 6, 8, 10][safeLevel - 1],
    tickSeconds: .5,
    lingerSeconds: 1,
    maxPatches: 12,
  };
}

// 빙결 파동 수치. interval마다(반경 checkRadius 안에 해산물이 있을 때) 반경 radius 안 모든 해산물에 damage와
// slowSeconds 동안 둔화 slow. Lv.6은 둔화 대신 빙결(이동 0). 대왕 박하지는 둔화 절반·빙결 시간 절반.
export function mudflatFrostWaveStats(level = 0) {
  const safeLevel = mudflatSafeLevel(level);
  if (!safeLevel) return { interval: Infinity, radius: 0, damage: 0, slow: 0, slowSeconds: 0, freeze: false, sweepSeconds: .4, checkRadius: 0 };
  return {
    interval: [6, 6, 6, 5, 5, 5][safeLevel - 1],
    radius: [150, 160, 170, 180, 190, 200][safeLevel - 1],
    damage: [30, 40, 50, 60, 70, 80][safeLevel - 1],
    slow: safeLevel >= 6 ? 1 : [.4, .45, .5, .55, .6][safeLevel - 1],
    slowSeconds: safeLevel >= 6 ? 1.2 : [2, 2.2, 2.4, 2.6, 2.8][safeLevel - 1],
    freeze: safeLevel >= 6,
    sweepSeconds: .4,
    checkRadius: 170,
  };
}

// 번개 체인 수치. interval마다 checkRadius 안의 가장 가까운 해산물에 damage를 주고, jump 거리 안의 다음 해산물로
// 최대 chain마리까지 번진다. 번질 때마다 피해가 decay만큼 줄어든다(Lv.6 5%).
export function mudflatChainLightningStats(level = 0) {
  const safeLevel = mudflatSafeLevel(level);
  if (!safeLevel) return { interval: Infinity, damage: 0, chain: 0, jump: 0, decay: 0, checkRadius: 0, flashSeconds: .25 };
  return {
    interval: [4, 3.5, 3, 3, 2.5, 2.5][safeLevel - 1],
    damage: [40, 50, 60, 70, 80, 90][safeLevel - 1],
    chain: [2, 3, 4, 5, 6, 8][safeLevel - 1],
    jump: [90, 95, 100, 110, 120, 130][safeLevel - 1],
    decay: [.2, .2, .15, .15, .1, .05][safeLevel - 1],
    checkRadius: 220,
    flashSeconds: .25,
  };
}

// 낙뢰 수치. interval마다 화면 안에서 체력이 가장 높은 해산물(대왕 박하지 우선) 발밑에 warnSeconds 예고 뒤 번개가 떨어져
// 대상에 damage, 반경 splash 안의 다른 해산물에 damage × splashRatio. Lv.5는 0.1초 뒤 1번, Lv.6은 0.1초 간격으로 2번 더 떨어진다.
export function mudflatThunderboltStats(level = 0) {
  const safeLevel = mudflatSafeLevel(level);
  if (!safeLevel) return { interval: Infinity, damage: 0, splash: 0, splashRatio: 0, strikes: 0, strikeGap: .1, warnSeconds: .4, boltSeconds: .3 };
  return {
    interval: [8, 7, 7, 6, 6, 5][safeLevel - 1],
    damage: [100, 120, 140, 160, 180, 200][safeLevel - 1],
    splash: 50,
    splashRatio: [.5, .5, .5, .6, .6, .6][safeLevel - 1],
    strikes: [1, 1, 1, 1, 2, 3][safeLevel - 1],
    strikeGap: .1,
    warnSeconds: .4,
    boltSeconds: .3,
  };
}

// 낙뢰 대상: 화면 안 생물 중 대왕 박하지가 있으면 그것, 없으면 현재 체력이 가장 높은 생물.
export function mudflatThunderboltTarget(creatures = []) {
  let best = null;
  for (const creature of Array.isArray(creatures) ? creatures : []) {
    if (!creature || creature.hp <= 0) continue;
    if (creature.boss) return creature;
    if (!best || creature.hp > best.hp) best = creature;
  }
  return best;
}

// 기술 인벤토리: 일반 모드의 `levels`는 익힌 모든 선택 기술의 레벨을 보관하고,
// 그중 `activeSkills`에 든 최대 여섯 개만 원정에서 작동한다. 보관(비활성) 기술은
// 레벨을 잃지 않는다. 전기 스파크·그물 투척 해금은 인벤토리 기준으로 센다.
/** @param {Record<string, number>} levels */
export function mudflatSelectableSkillIds(levels = {}) {
  return MUDFLAT_GENERAL_UPGRADES.filter((item) => !MUDFLAT_FIXED_GENERAL_SKILL_IDS.includes(item.id) && (levels[item.id] ?? 0) > 0).map((item) => item.id);
}

// 저장값이나 예전 세이브의 활성 목록을 정리한다. 목록이 없으면 익힌 선택 기술을
// 기술 순서대로 여섯 개까지 활성으로 본다(예전 규칙과 동일한 결과).
/**
 * @param {Record<string, number>} levels
 * @param {unknown} [activeSkills]
 * @param {string} [mode]
 * @returns {string[]}
 */
export function mudflatNormalizeActiveSkills(levels = {}, activeSkills = undefined, mode = "normal") {
  if (mode !== "normal") return [];
  const owned = mudflatSelectableSkillIds(levels);
  if (!Array.isArray(activeSkills)) return owned.slice(0, MUDFLAT_SELECTABLE_SKILL_LIMIT);
  const seen = new Set();
  const normalized = [];
  for (const id of activeSkills) {
    if (typeof id !== "string" || seen.has(id) || !owned.includes(id)) continue;
    seen.add(id); normalized.push(id);
    if (normalized.length >= MUDFLAT_SELECTABLE_SKILL_LIMIT) break;
  }
  return normalized;
}

// 원정에서 실제로 작동하는 레벨 맵: 기본 기술 + 활성 선택 기술만 남긴다.
/**
 * @param {Record<string, number>} levels
 * @param {unknown} [activeSkills]
 * @param {string} [mode]
 * @returns {Record<string, number>}
 */
export function mudflatActiveLevels(levels = {}, activeSkills = undefined, mode = "normal") {
  if (mode !== "normal") return { ...levels };
  const active = mudflatNormalizeActiveSkills(levels, activeSkills, mode);
  /** @type {Record<string, number>} */
  const result = {};
  for (const [id, level] of Object.entries(levels)) {
    if (MUDFLAT_FIXED_GENERAL_SKILL_IDS.includes(id) || active.includes(id)) result[id] = level;
    else if (!MUDFLAT_GENERAL_UPGRADES.some((item) => item.id === id)) result[id] = level;
  }
  return result;
}

// 빈 활성 슬롯에 바로 넣을 수 있는지. false면 기존 활성 기술 하나를 보관으로
// 내려야 한다(원정 중 교체 선택 화면, 정비 화면 토글).
/**
 * @param {Record<string, number>} levels
 * @param {string} skillId
 * @param {string} [mode]
 * @param {unknown} [activeSkills]
 */
export function mudflatCanLearnSkill(levels = {}, skillId = "", mode = "normal", activeSkills = undefined) {
  if (mode !== "normal" || MUDFLAT_FIXED_GENERAL_SKILL_IDS.includes(skillId)) return true;
  const skill = MUDFLAT_GENERAL_UPGRADES.find((item) => item.id === skillId);
  if (!skill) return false;
  const active = mudflatNormalizeActiveSkills(levels, activeSkills, mode);
  if (active.includes(skillId)) return true;
  // Mastery techniques share the same six active slots.  This keeps
  // powerful late-game tools meaningful choices rather than free extras.
  return active.length < MUDFLAT_SELECTABLE_SKILL_LIMIT;
}

// 정비 화면의 기술 훈련 버튼 상태. 클릭 뒤 거절하는 trainSkill 방어 로직과
// 같은 mudflatCanLearnSkill 판정을 표시 단계에서도 미리 반영한다.
// 인벤토리의 모든 기술을 훈련할 수 있다. 활성 슬롯이 가득 찬 상태에서 새 기술을
// 사면 보관(비활성)으로 들어가므로 `stored`로 미리 알린다.
/**
 * @param {Record<string, number>} levels
 * @param {string} skillId
 * @param {string} [mode]
 * @param {number} [coins]
 * @param {unknown} [activeSkills]
 */
export function mudflatTrainingButtonState(levels = {}, skillId = "", mode = "normal", coins = 0, activeSkills = undefined) {
  const upgrades = mode === "normal" ? MUDFLAT_GENERAL_UPGRADES : MUDFLAT_UPGRADES;
  const skill = upgrades.find((item) => item.id === skillId);
  const level = levels[skillId] ?? 0;
  const price = mudflatTrainingPrice(level);
  const maxed = !skill || level >= skill.max;
  const stored = !maxed && level === 0 && !mudflatCanLearnSkill(levels, skillId, mode, activeSkills);
  const affordable = (Number(coins) || 0) >= price;
  const label = maxed ? "최고 레벨" : `${price}코인 · Lv.${level} → ${level + 1}${stored ? " · 보관" : ""}`;
  return { level, price, maxed, stored, affordable, disabled: maxed || !affordable, label };
}

export function mudflatElectricStats(level = 0) {
  const rawLevel = Math.max(0, Math.floor(Number(level) || 0));
  const safeLevel = mudflatSafeLevel(level);
  if (!safeLevel) return { interval: Infinity, damage: 0, reach: 0, selfInterval: Infinity, selfDamage: 0 };
  const reach = MUDFLAT_BASE_TONG_REACH + Math.max(0, rawLevel - 6) * MUDFLAT_ELECTRIC_POST_SIX_REACH_STEP;
  return { interval: [1, .8, .6, .4, .2, .1][safeLevel - 1], damage: 100, reach, selfInterval: 10, selfDamage: 5 };
}

export function mudflatCastNetStats(level = 0) {
  const safeLevel = mudflatSafeLevel(level);
  if (!safeLevel) return { interval: Infinity, damage: 0, radius: 0, holdSeconds: 0, range: 0 };
  return {
    interval: [3.2, 3, 2.8, 2.6, 2.4, 2.2][safeLevel - 1], damage: 200,
    radius: [45, 49, 53, 57, 61, 65][safeLevel - 1],
    holdSeconds: [1.8, 2, 2.2, 2.4, 2.6, 2.8][safeLevel - 1],
    range: 210 + (safeLevel - 1) * 10,
  };
}

export function mudflatJoystickVector(deltaX, deltaY, radius = MUDFLAT_JOYSTICK_RADIUS, deadzone = 5) {
  const length = Math.hypot(deltaX, deltaY);
  if (!Number.isFinite(length) || length <= deadzone) return { x: 0, y: 0, strength: 0 };
  const clamped = Math.min(radius, length);
  const strength = Math.min(1, (clamped - deadzone) / Math.max(1, radius - deadzone));
  return { x: deltaX / length * strength, y: deltaY / length * strength, strength };
}

export function mudflatBossPulse(elapsedSeconds = 0, phase = 0) {
  const safeElapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
  const safePhase = Number.isFinite(phase) ? phase : 0;
  const wave = (Math.sin(safeElapsed * 3.2 + safePhase) + 1) / 2;
  const purple = [58, 25, 91];
  const navy = [18, 43, 77];
  const mixed = purple.map((value, index) => Math.round(value + (navy[index] - value) * wave));
  return {
    wave,
    scaleX: .96 + wave * .12,
    scaleY: 1.08 - wave * .12,
    color: `rgb(${mixed.join(",")})`,
  };
}

export function mudflatEmptySeafoodHazard(emptySeconds = 0) {
  const safeSeconds = Math.max(0, Number.isFinite(emptySeconds) ? emptySeconds : 0);
  if (safeSeconds >= 30) return { damagePerSecond: 10, message: "너무 춥다. 되돌아가야해" };
  if (safeSeconds >= 10) return { damagePerSecond: 1, message: "너무 깊게 들어온 것 같다." };
  return { damagePerSecond: 0, message: "" };
}

export function mudflatSpawnInterval(elapsedSeconds, mode = "kids") {
  const base = Math.max(0.14, 0.62 - Math.max(0, elapsedSeconds) * 0.002);
  return mode === "normal" ? Math.max(0.11, base * 0.82) : base;
}

export function mudflatOpeningWaveCount(stage = 1, mode = "normal") {
  const safeStage = Math.max(1, Math.floor(Number(stage) || 1));
  if (mode !== "normal" || safeStage < 3) return 0;
  return Math.min(18, 8 + (safeStage - 3) * 2);
}

export function mudflatStageSpawnInterval(stage = 1, mode = "kids", regularInterval = 1) {
  const safeStage = Math.max(1, Math.floor(Number(stage) || 1));
  const safeInterval = Math.max(0.08, Number(regularInterval) || 1);
  if (mode !== "normal" || safeStage < 3) return safeInterval;
  // Later expeditions never begin more slowly than this pressure curve. The
  // ordinary elapsed-time curve takes over as soon as it becomes faster.
  const openingCeiling = Math.max(0.26, 0.42 - (safeStage - 3) * 0.025);
  return Math.min(safeInterval, openingCeiling);
}

const MUDFLAT_OPENING_FAST_CREATURES = new Set(["small-crab", "crab", "shrimp", "large-shrimp"]);

export function mudflatOpeningCreatureSpeedMultiplier(stage = 1, elapsedSeconds = 0, creatureType = "", mode = "normal") {
  const safeStage = Math.max(1, Math.floor(Number(stage) || 1));
  const safeElapsed = Math.max(0, Number(elapsedSeconds) || 0);
  if (mode !== "normal" || safeStage < 3 || safeElapsed >= 60 || !MUDFLAT_OPENING_FAST_CREATURES.has(creatureType)) return 1;
  const maximumBonus = Math.min(.22, .1 + (safeStage - 3) * .025);
  return 1 + maximumBonus * (1 - safeElapsed / 60);
}

// Silent field events add pressure without interrupting play with banners or
// scripted announcements. These helpers keep stage scaling explicit and easy
// to verify independently from the canvas runtime.
export function mudflatPufferEventInterval(stage = 1, roll = 0) {
  const safeStage = Math.max(1, Math.floor(Number(stage) || 1));
  if (safeStage < 3) return Infinity;
  return Math.max(25, 38 - (safeStage - 3) * 1.25) + Math.max(0, Math.min(.999999, Number(roll) || 0)) * 12;
}

export function mudflatCrabRushRows(stage = 1) {
  const safeStage = Math.max(1, Math.floor(Number(stage) || 1));
  if (safeStage < 4) return 0;
  return Math.min(5, safeStage - 2);
}

export function mudflatCrabRushCrabsPerRow(stage = 1, elapsed = 0) {
  const safeStage = Math.max(1, Math.floor(Number(stage) || 1));
  if (safeStage < 4) return 0;
  const safeElapsed = Math.max(0, Number(elapsed) || 0);
  const laterWaveBonus = Math.floor(safeElapsed / 45) * 3;
  return Math.min(20, 8 + (safeStage - 4) * 2 + laterWaveBonus);
}

export function mudflatCrabRushInterval(stage = 1, roll = 0) {
  const safeStage = Math.max(1, Math.floor(Number(stage) || 1));
  if (safeStage < 4) return Infinity;
  return Math.max(31, 44 - (safeStage - 4)) + Math.max(0, Math.min(.999999, Number(roll) || 0)) * 14;
}

export function mudflatMudZombieCount(stage = 1) {
  const safeStage = Math.max(1, Math.floor(Number(stage) || 1));
  if (safeStage < 6) return 0;
  return Math.min(40, 20 + (safeStage - 6) * 10);
}

export function mudflatJellyfishInterval(stage = 1) {
  return Math.max(1, Math.floor(Number(stage) || 1)) >= 8 ? 30 : Infinity;
}

export function mudflatSeafoodSwarmCount(stage = 6, roll = 0) {
  const safeStage = Math.max(1, Math.floor(Number(stage) || 1));
  if (safeStage < 6) return 0;
  const safeRoll = Math.max(0, Math.min(.999999, Number(roll) || 0));
  const range = Math.min(9, 5 + (safeStage - 6));
  return 8 + Math.floor(safeRoll * range);
}

export function mudflatSeafoodSwarmInterval(stage = 6, roll = 0, patternRoll = 0, initial = false) {
  const safeStage = Math.max(1, Math.floor(Number(stage) || 1));
  if (safeStage < 6) return Infinity;
  const safeRoll = Math.max(0, Math.min(.999999, Number(roll) || 0));
  const safePattern = Math.max(0, Math.min(.999999, Number(patternRoll) || 0));
  const stagePressure = Math.max(.72, 1 - (safeStage - 6) * .035);
  if (initial) return (9 + safeRoll * 20) * stagePressure;
  if (safePattern < .2) return (8 + safeRoll * 10) * stagePressure;
  if (safePattern < .82) return (18 + safeRoll * 24) * stagePressure;
  return (44 + safeRoll * 30) * stagePressure;
}

export function mudflatJellyfishPoisonDamage() {
  return 4;
}

export function mudflatCreatureForTime(elapsedSeconds, roll = 0, options = {}) {
  const available = MUDFLAT_CREATURES.filter((item) => !item.boss && !item.spawnVariant && item.unlock <= elapsedSeconds && (!item.requiresHeadlamp || options.headlamp));
  const safeRoll = Math.max(0, Math.min(0.9999, roll));
  const scaledRoll = safeRoll * available.length;
  const index = Math.min(available.length - 1, Math.floor(scaledRoll));
  const selected = available[Math.max(0, index)];
  const localRoll = scaledRoll - Math.floor(scaledRoll);
  if (selected?.id === "shrimp" && localRoll >= .95) {
    return MUDFLAT_CREATURES.find((item) => item.id === "large-shrimp") ?? selected;
  }
  if (selected?.id === "whelk" && scaledRoll - Math.floor(scaledRoll) < 0.1) {
    return MUDFLAT_CREATURES.find((item) => item.id === "fist-whelk") ?? selected;
  }
  return selected;
}

export function mudflatClamRewardForRoll(level = 1, roll = 0) {
  const safeLevel = Math.max(1, Math.min(6, Math.floor(level)));
  const safeRoll = Math.max(0, Math.min(0.999999, Number.isFinite(roll) ? roll : 0));
  if (safeLevel === 6 && safeRoll < 0.01) return MUDFLAT_PEARL;
  const shellRoll = safeLevel === 6 ? (safeRoll - 0.01) / 0.99 : safeRoll;
  const weights = MUDFLAT_CLAM_WEIGHTS[safeLevel - 1];
  const total = weights.reduce((sum, value) => sum + value, 0);
  let threshold = Math.max(0, shellRoll) * total;
  for (let index = 0; index < weights.length; index += 1) {
    threshold -= weights[index];
    if (threshold < 0 && weights[index] > 0) return MUDFLAT_CLAM_GRADES[index];
  }
  return MUDFLAT_CLAM_GRADES.at(-1);
}

// `levels`는 기술 인벤토리(보관 포함)다. 활성 슬롯이 가득 차도 비활성·미습득
// 기술이 선택지에 나오며, 고르면 교체 선택으로 이어진다.
export function mudflatUpgradeChoices(_level, levels = {}, mode = "kids", random = Math.random, stats = {}) {
  const upgrades = mode === "normal" ? MUDFLAT_GENERAL_UPGRADES : MUDFLAT_UPGRADES;
  const unlocks = mudflatAdvancedSkillUnlocks(levels, stats);
  const available = upgrades.filter((item) => {
    const currentLevel = levels[item.id] ?? 0;
    return mudflatSkillUnlocked(item, unlocks) && currentLevel < item.max;
  });
  if (available.length <= 3) return available;
  const shuffled = [...available];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, 3);
}

export function mudflatTongStats(level = 1) {
  const safeLevel = Math.max(1, Math.floor(level));
  const multiplier = 1.5 ** (safeLevel - 1);
  return { rotationSpeed: 1.55 * multiplier, power: 5.5 * multiplier, reach: MUDFLAT_BASE_TONG_REACH };
}

// Use the live camera viewport, not the offscreen spawning/reveal radius.
// Reserve room for the children's 30px net head and the target's body.
export function mudflatKidsNetCanTarget(target, player, width, height) {
  const inset = Math.max(36, target.size ?? 0);
  const x = width / 2 + target.x - player.x;
  const y = height / 2 + target.y - player.y;
  return x >= inset && x <= width - inset && y >= inset && y <= height - inset;
}

export function mudflatNetStats(level = 0) {
  const safeLevel = Math.max(0, Math.min(6, Math.floor(level)));
  if (safeLevel === 0) return { range: 0, radius: 0, width: 0, headDepth: 0, scale: 0 };
  const tongRange = mudflatTongStats(1).reach;
  // The net grows in five equal steps: level 1 is the tong reach and level 6
  // is exactly twice that reach.  `radius`/`headDepth` describe the visible
  // oval net head, so the damage area can use the same shape rather than a
  // large circular splash around the target.
  const scale = 1 + (safeLevel - 1) / 5;
  const radius = tongRange * 0.43 * scale;
  return {
    range: tongRange * scale,
    radius,
    width: radius * 2,
    headDepth: tongRange * 0.28 * scale,
    scale,
  };
}

export function mudflatHarpoonStats(level = 0, netLevel = 1) {
  const safeLevel = Math.max(0, Math.floor(level));
  if (safeLevel === 0) return { range: 0, damage: 0, speed: 304, interval: Infinity };
  const referenceNetRange = mudflatNetStats(Math.max(1, netLevel)).range;
  return {
    range: referenceNetRange * (safeLevel + 1),
    damage: 30 * 1.5 ** (safeLevel - 1),
    speed: 304,
    interval: 2.2,
  };
}

export function mudflatRockTurnerStats(level = 0) {
  const safeLevel = Math.max(0, Math.min(6, Math.floor(level)));
  if (safeLevel === 0) return { processingTime: Infinity, cooldown: Infinity, interval: Infinity, activationsPerSecond: 0 };
  const processingTime = [1, 0.8, 0.6, 0.4, 0.2, 0.2][safeLevel - 1];
  const cooldown = [2, 1.7, 1.4, 1.1, .8, .5][safeLevel - 1];
  return {
    processingTime,
    cooldown,
    interval: processingTime + cooldown,
    activationsPerSecond: 1 / (processingTime + cooldown),
  };
}

export function mudflatRockCreatureForRoll(roll = 0, level = 1) {
  const safeRoll = Math.max(0, Math.min(0.999999, Number.isFinite(roll) ? roll : 0));
  const safeLevel = Math.max(1, Math.min(6, Math.floor(level)));
  const levelRatio = (safeLevel - 1) / 5;
  let accumulated = 0;
  for (const finding of MUDFLAT_ROCK_FINDINGS) {
    accumulated += finding.level1Chance + (finding.level6Chance - finding.level1Chance) * levelRatio;
    if (safeRoll < accumulated) return finding;
  }
  return null;
}

export function mudflatPufferBleedOnContact(seconds = 0, tickClock = 1, vestLevel = 0) {
  const reduction = MUDFLAT_VEST_BLEED_REDUCTIONS[mudflatSafeLevel(vestLevel)];
  return { seconds: 50 * (1 - reduction), tickClock: seconds > 0 ? tickClock : 1 };
}

export function mudflatPufferMovementForAge(ageSeconds = 0) {
  const safeAge = Math.max(0, Number(ageSeconds) || 0);
  return safeAge < 8 ? "wander" : "oval";
}

export function mudflatShellMovementSpeed(playerMovementSpeed = 0) {
  return Math.max(0, Number(playerMovementSpeed) || 0) * 0.05;
}

export function mudflatPufferBleedStep(seconds = 0, tickClock = 1, deltaSeconds = 0) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const activeTime = Math.min(Math.max(0, Number(deltaSeconds) || 0), safeSeconds);
  let nextTickClock = Number.isFinite(tickClock) ? tickClock - activeTime : 1;
  let ticks = 0;
  while (nextTickClock <= 0 && ticks < 100) {
    ticks += 1;
    nextTickClock += 1;
  }
  return { seconds: Math.max(0, safeSeconds - activeTime), tickClock: nextTickClock, ticks };
}

export function mudflatStageStats(stage = 1) {
  const safeStage = Math.max(1, Math.floor(stage));
  const profile = mudflatStageProfile(safeStage);
  const endlessDepth = Math.max(0, safeStage - 8);
  const baseRockLimit = Math.round((20 + (safeStage - 1) * 2) * profile.rockMultiplier);
  const rockHeavyStage = safeStage === 3 || safeStage === 4 || profile.fallingRocks > 0;
  return {
    creatureHpMultiplier: 1 + (safeStage - 1) * 0.16 + (profile.finalBoss ? .24 : 0),
    creatureSpeedMultiplier: 1 + (safeStage - 1) * 0.045,
    spawnIntervalMultiplier: Math.max(0.5, 1 - (safeStage - 1) * 0.04) * profile.seafoodSpawnMultiplier,
    contactDamageBonus: Math.min(24, (safeStage - 1) * 2 + Math.floor(endlessDepth / 3)),
    rockLimit: rockHeavyStage ? 100 : Math.min(100, baseRockLimit),
  };
}

export function mudflatMosquitoChance(stage = 1) {
  const safeStage = Math.max(1, Math.floor(Number(stage) || 1));
  return Math.min(.9, Math.max(0, (safeStage - 1) * .1));
}

export function mudflatMosquitoRunEnabled(stage = 1, roll = Math.random()) {
  return roll < mudflatMosquitoChance(stage);
}

export function mudflatMosquitoAppears(stage = 1, runEnabled = false, roll = Math.random()) {
  return Boolean(runEnabled) && roll < mudflatMosquitoChance(stage);
}

export const MUDFLAT_REGULAR_STAGES = [
  { stage: 1, name: "초입 갯벌", subtitle: "기본 조작과 채집 수단을 익히는 잔잔한 초입", modifiers: ["초입"], waterChannels: false, tideInterval: 0, safeZone: "none", rockMultiplier: .65, fallingRocks: 0, darkness: 0, mudSlow: 1, seafoodSpawnMultiplier: 1, wind: 0, mosquitoes: false, swarms: false, coldThresholdMultiplier: 1, finalBoss: false },
  { stage: 2, name: "차오르는 물골", subtitle: "돌발 물살을 피해 밝은 언덕배기로 피하세요", modifiers: ["물골", "돌발 물살", "언덕배기"], waterChannels: true, tideInterval: 48, safeZone: "fixed", rockMultiplier: .8, fallingRocks: 0, darkness: 0, mudSlow: 1, seafoodSpawnMultiplier: .96, wind: 0, mosquitoes: true, swarms: false, coldThresholdMultiplier: 1, finalBoss: false },
  { stage: 3, name: "바위 갯벌", subtitle: "바위 사이 물골을 건너며 가까이 숨은 돌을 조심하세요", modifiers: ["바위 증가", "숨은 돌", "물골"], waterChannels: true, tideInterval: 0, safeZone: "none", rockMultiplier: 1.55, fallingRocks: 0, darkness: 0, mudSlow: .96, seafoodSpawnMultiplier: 1, wind: 0, mosquitoes: true, swarms: false, coldThresholdMultiplier: 1, finalBoss: false },
  { stage: 4, name: "어두운 갯벌", subtitle: "좁아진 시야에서 가까이에 나타난 숨은 패류를 찾으세요", modifiers: ["시야 감소", "패류 가치 2배"], waterChannels: false, tideInterval: 0, safeZone: "none", rockMultiplier: 1, fallingRocks: 0, darkness: .78, mudSlow: 1, seafoodSpawnMultiplier: 1, wind: 0, mosquitoes: true, swarms: false, coldThresholdMultiplier: 1, finalBoss: false },
  { stage: 5, name: "깊은 펄", subtitle: "두 개의 숨구멍을 보고 깊이 숨어 있는 개불을 찾아보세요", modifiers: ["이동 감속", "빠른 추위", "개불 숨구멍"], waterChannels: false, tideInterval: 0, safeZone: "none", rockMultiplier: .9, fallingRocks: 0, darkness: .18, mudSlow: .78, seafoodSpawnMultiplier: 1.22, wind: 0, mosquitoes: true, swarms: false, coldThresholdMultiplier: .65, finalBoss: false },
  { stage: 6, name: "거센 갯벌", subtitle: "거센 바람 사이로 몰려오는 해산물 무리를 버티세요", modifiers: ["바람", "해산물 무리"], waterChannels: true, tideInterval: 43, safeZone: "fixed", rockMultiplier: 1, fallingRocks: 0, darkness: 0, mudSlow: .93, seafoodSpawnMultiplier: .92, wind: 32, mosquitoes: true, swarms: true, coldThresholdMultiplier: .9, finalBoss: false },
  { stage: 7, name: "대조기 갯벌", subtitle: "잦은 돌발 물살을 피해 바뀌는 언덕배기를 따라가세요", modifiers: ["잦은 돌발 물살", "바뀌는 언덕배기"], waterChannels: true, tideInterval: 27, safeZone: "moving", rockMultiplier: 1.08, fallingRocks: 0, darkness: .08, mudSlow: .9, seafoodSpawnMultiplier: .88, wind: 18, mosquitoes: true, swarms: false, coldThresholdMultiplier: .85, finalBoss: false },
  { stage: 8, name: "마지막 물때", subtitle: "모든 환경과 강화된 대왕 박하지를 넘어 귀환하세요", modifiers: ["복합 환경", "강화 대왕 박하지", "최종 귀환"], waterChannels: true, tideInterval: 31, safeZone: "moving", rockMultiplier: 1.35, fallingRocks: 22, darkness: .62, mudSlow: .84, seafoodSpawnMultiplier: .82, wind: 30, mosquitoes: true, swarms: true, coldThresholdMultiplier: .72, finalBoss: true },
];

const MUDFLAT_ENDLESS_MODIFIERS = [
  { id: "channels", name: "깊은 물골", patch: { waterChannels: true, mudSlow: .9 } },
  { id: "dark", name: "짙은 어둠", patch: { darkness: .7 } },
  { id: "rocks", name: "운석 지대", patch: { rockMultiplier: 1.5, fallingRocks: 18 } },
  { id: "wind", name: "거센 돌풍", patch: { wind: 38 } },
  { id: "tide", name: "거센 돌발 물살", patch: { tideInterval: 25, safeZone: "moving" } },
  { id: "swarm", name: "해산물 대이동", patch: { swarms: true, seafoodSpawnMultiplier: .78 } },
  { id: "mud", name: "끝없는 깊은 펄", patch: { mudSlow: .74, coldThresholdMultiplier: .62 } },
];

function mudflatSeed(stage, salt = 0) {
  const value = Math.sin(stage * 91.731 + salt * 37.117) * 43758.5453;
  return value - Math.floor(value);
}

export function mudflatStageProfile(stage = 1) {
  const safeStage = Math.max(1, Math.floor(stage));
  if (safeStage <= 8) return { ...MUDFLAT_REGULAR_STAGES[safeStage - 1], endless: false, objective: null };
  const chosen = [...MUDFLAT_ENDLESS_MODIFIERS]
    .sort((left, right) => mudflatSeed(safeStage, left.id.length) - mudflatSeed(safeStage, right.id.length))
    .slice(0, 3 + (safeStage % 4 === 0 ? 1 : 0));
  const profile = {
    stage: safeStage, name: "끝없는 물때", subtitle: "지형·날씨·생물이 다시 섞인 끝없는 원정",
    modifiers: chosen.map((item) => item.name), waterChannels: false, tideInterval: 0, safeZone: "none",
    rockMultiplier: 1, fallingRocks: 0, darkness: 0, mudSlow: 1, seafoodSpawnMultiplier: .86,
    wind: 0, mosquitoes: true, swarms: false, coldThresholdMultiplier: .82, finalBoss: safeStage % 3 === 0,
    endless: true,
  };
  for (const modifier of chosen) Object.assign(profile, modifier.patch);
  const objectiveIndex = Math.floor(mudflatSeed(safeStage, 19) * 3);
  profile.objective = [
    { id: "catch", label: `해산물 ${110 + (safeStage - 9) * 10}마리 채집`, target: 110 + (safeStage - 9) * 10, bonus: 140 + safeStage * 18 },
    { id: "rocks", label: `돌 ${8 + Math.floor((safeStage - 9) / 2)}개 뒤집기`, target: 8 + Math.floor((safeStage - 9) / 2), bonus: 160 + safeStage * 20 },
    { id: "health", label: "체력 50% 이상으로 귀환", target: .5, bonus: 180 + safeStage * 22 },
  ][objectiveIndex];
  return profile;
}

const MUDFLAT_ROCK_CHANNEL_SPACING = 520;

// World-anchored lanes keep water in the same place when the camera moves.
export function mudflatWaterChannelLanes(minX = 0, maxX = minX, stage = 2) {
  const profile = mudflatStageProfile(stage);
  if (!profile.waterChannels) return [];
  if (profile.stage === 3) {
    const margin = 176; // Maximum bend (134) plus the bank width.
    const first = Math.ceil((Math.min(minX, maxX) - margin) / MUDFLAT_ROCK_CHANNEL_SPACING);
    const last = Math.floor((Math.max(minX, maxX) + margin) / MUDFLAT_ROCK_CHANNEL_SPACING);
    return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);
  }
  return profile.endless || profile.stage === 8 ? [0, 1] : [0];
}

export function mudflatWaterChannelCenterX(y = 0, stage = 2, channel = 0) {
  const safeStage = Math.max(1, Math.floor(stage));
  if (safeStage === 3) {
    return channel * MUDFLAT_ROCK_CHANNEL_SPACING
      + Math.sin((y + channel * 173 + safeStage * 83) / 210) * 92
      + Math.sin((y - channel * 97 - safeStage * 41) / 470) * 42;
  }
  if (channel === 0) return Math.sin((y + safeStage * 83) / 175) * 92 + Math.sin((y - safeStage * 41) / 430) * 52;
  return 265 + Math.sin((y - safeStage * 63) / 210) * 74;
}

export function mudflatWaterChannelHalfWidth(stage = 2, channel = 0) {
  return Math.floor(stage) === 3 ? 32 : channel === 0 ? 42 : 34;
}

export function mudflatInWaterChannel(x = 0, y = 0, stage = 2) {
  return mudflatWaterChannelLanes(x, x, stage).some((channel) =>
    Math.abs(x - mudflatWaterChannelCenterX(y, stage, channel)) < mudflatWaterChannelHalfWidth(stage, channel));
}

export function mudflatStageEmptySeafoodHazard(emptySeconds = 0, stage = 1) {
  const profile = mudflatStageProfile(stage);
  return mudflatEmptySeafoodHazard(Math.max(0, Number(emptySeconds) || 0) / Math.max(.35, profile.coldThresholdMultiplier));
}

// 보조 목표 진행률. HUD 카운터와 단계 성공 정산이 같은 판정을 공유한다.
export function mudflatEndlessObjectiveProgress(profile, { caught = 0, rocksFlipped = 0, hp = 0, maxHp = 1 } = {}) {
  const objective = profile?.objective;
  if (!objective) return null;
  const safeTarget = Math.max(0, Number(objective.target) || 0);
  if (objective.id === "health") {
    const percent = Math.max(0, Math.min(1, (Number(hp) || 0) / Math.max(1, Number(maxHp) || 1)));
    const targetPercent = Math.round(safeTarget * 100);
    return {
      id: objective.id, label: objective.label, current: Math.floor(percent * 100), target: targetPercent,
      ratio: safeTarget > 0 ? Math.min(1, percent / safeTarget) : 1, complete: percent >= safeTarget,
      text: `체력 ${Math.floor(percent * 100)}% / ${targetPercent}%`,
    };
  }
  const current = Math.max(0, Math.floor(objective.id === "catch" ? Number(caught) || 0 : Number(rocksFlipped) || 0));
  const complete = current >= safeTarget;
  return {
    id: objective.id, label: objective.label, current, target: safeTarget,
    ratio: safeTarget > 0 ? Math.min(1, current / safeTarget) : 1, complete,
    text: `${objective.id === "catch" ? "채집" : "돌"} ${Math.min(current, safeTarget)} / ${safeTarget}`,
  };
}

export function mudflatEndlessObjectiveResult(profile, stats = {}) {
  const progress = mudflatEndlessObjectiveProgress(profile, stats);
  if (!progress) return { complete: false, bonus: 0, label: "" };
  return { complete: progress.complete, bonus: progress.complete ? profile.objective.bonus : 0, label: progress.label };
}

export function mudflatSeafoodSaleValue(type, count = 1, _coolerLevel = 0, stage = 1) {
  const market = MUDFLAT_SEAFOOD_MARKET.find((item) => item.type === type);
  const safeCount = Math.max(0, Math.floor(count));
  if (!market || safeCount === 0) return 0;
  const profile = mudflatStageProfile(stage);
  const darkShellBonus = (profile.darkness >= .6 && ["whelk", "fist-whelk", "golbaengi"].includes(type)) ? 2 : 1;
  const saleMultiplier = darkShellBonus;
  return Math.floor(market.price * safeCount * saleMultiplier);
}

export function mudflatAutoSellInventory(inventory = {}, coolerLevel = 0, stage = 1) {
  const knownTypes = new Set(MUDFLAT_SEAFOOD_MARKET.map((item) => item.type));
  const haul = {};
  for (const [type, count] of Object.entries(inventory ?? {})) {
    if (!knownTypes.has(type)) continue;
    const safeCount = Math.max(0, Math.floor(Number(count) || 0));
    if (safeCount > 0) haul[type] = safeCount;
  }
  const count = Object.values(haul).reduce((sum, quantity) => sum + quantity, 0);
  const value = Object.entries(haul).reduce((sum, [type, quantity]) => sum + mudflatSeafoodSaleValue(type, quantity, coolerLevel, stage), 0);
  return { haul, count, value };
}

export function mudflatSettleCatch(inventory = {}, basket = {}, caught = 0, coolerLevel = 0) {
  const knownTypes = new Set(MUDFLAT_SEAFOOD_MARKET.map((item) => item.type));
  const normalizedInventory = {};
  const haul = {};
  for (const [type, count] of Object.entries(inventory ?? {})) {
    if (!knownTypes.has(type)) continue;
    const safeCount = Math.max(0, Math.floor(Number(count) || 0));
    if (safeCount > 0) normalizedInventory[type] = safeCount;
  }
  for (const [type, count] of Object.entries(basket ?? {})) {
    if (!knownTypes.has(type)) continue;
    const safeCount = Math.max(0, Math.floor(Number(count) || 0));
    if (safeCount > 0) haul[type] = safeCount;
  }
  const recordedCount = Object.values(haul).reduce((sum, count) => sum + count, 0);
  const expectedCount = Math.max(recordedCount, Math.max(0, Math.floor(Number(caught) || 0)));
  const recoveredCount = Math.max(0, expectedCount - recordedCount);
  if (recoveredCount > 0) haul.clam = (haul.clam ?? 0) + recoveredCount;
  const nextInventory = { ...normalizedInventory };
  for (const [type, count] of Object.entries(haul)) nextInventory[type] = (nextInventory[type] ?? 0) + count;
  const value = Object.entries(haul).reduce((sum, [type, count]) => sum + mudflatSeafoodSaleValue(type, count, coolerLevel), 0);
  return { inventory: nextInventory, haul, catchCount: expectedCount, recoveredCount, value };
}

export function mudflatEquipmentPrice(id, currentLevel = 0) {
  const equipment = MUDFLAT_SHOP_EQUIPMENT.find((item) => item.id === id);
  if (!equipment) return Infinity;
  const nextLevel = Math.max(1, Math.min(6, Math.floor(currentLevel) + 1));
  return nextLevel * 1000;
}

export function mudflatTrainingPrice(currentLevel = 0) {
  const nextLevel = Math.max(1, Math.min(6, Math.floor(currentLevel) + 1));
  return nextLevel * 1000;
}

export function mudflatFinalScore({ catchScore = 0, caught = 0, elapsed = 0, bossCaught = false }) {
  const survivalBonus = Math.floor(Math.min(MUDFLAT_RUN_SECONDS, elapsed) * 4);
  return Math.max(0, Math.floor(catchScore + caught * 3 + survivalBonus + (bossCaught ? 2500 : 0)));
}

export function mudflatTideStats(elapsed = 0, maxHp = 0) {
  const safeElapsed = Math.max(0, Number(elapsed) || 0);
  const tideActive = safeElapsed >= MUDFLAT_RUN_SECONDS;
  return {
    guideVisible: safeElapsed >= MUDFLAT_RUN_SECONDS - MUDFLAT_RETURN_GUIDE_SECONDS,
    active: tideActive,
    speedMultiplier: tideActive ? MUDFLAT_TIDE_SPEED_MULTIPLIER : 1,
    damagePerSecond: tideActive ? Math.max(0, Number(maxHp) || 0) * MUDFLAT_TIDE_DAMAGE_RATIO_PER_SECOND : 0,
  };
}

// A periodic tide rises for one second, hits at its crest, then drains for one
// second. Cycle zero is dry; the final return tide owns the water after 240s.
export function mudflatStageTideState(elapsed = 0, interval = 0) {
  const time = Math.max(0, Number(elapsed) || 0);
  if (!(interval > 0) || time >= MUDFLAT_RUN_SECONDS) {
    return { cycle: 0, fill: 0, impactCycle: 0, settled: false };
  }
  const cycle = Math.floor(time / interval);
  const phase = time - cycle * interval;
  const fill = cycle === 0 ? 0 : Math.max(0, Math.min(phase / MUDFLAT_TIDE_FILL_SECONDS, 2 - phase / MUDFLAT_TIDE_FILL_SECONDS));
  return {
    cycle,
    fill,
    impactCycle: Math.max(0, Math.floor((time - MUDFLAT_TIDE_FILL_SECONDS) / interval)),
    settled: cycle > 0 && phase >= MUDFLAT_TIDE_FILL_SECONDS * 2,
  };
}

// Include an object's footprint and a shoreline buffer, not just its center.
export function mudflatCampObstacleAllowed(point, camp, radii, active, clearance = 0) {
  if (!active) return true;
  const dx = (point.x - camp.x) / (radii.radiusX + clearance);
  const dy = (point.y - camp.y) / (radii.radiusY + clearance);
  return dx * dx + dy * dy > 1;
}

// Entering camp cancels work, rather than hiding attacks that could resume or
// land later. Keep earned rewards, world pickups, hazards, and cooldowns intact.
export function mudflatStopHarvestInCamp(runtime, radii) {
  if (mudflatCampObstacleAllowed(runtime.player, runtime.baseCamp, radii, runtime.baseCampGuideShown)) return false;
  runtime.hoeEffect = 0;
  runtime.electricPulseLife = 0;
  runtime.rockFlipEffect = null;
  for (const key of ["projectiles", "harpoons", "netSlams", "castNets", "clamReveals"]) runtime[key].length = 0;
  for (const hole of runtime.clamHoles) hole.progress = 0;
  runtime.bursts = runtime.bursts.filter((burst) => burst.kind !== "harvest");
  runtime.floatTexts = runtime.floatTexts.filter((label) => label.kind !== "harvest");
  return true;
}

// Put the entire camp beyond the nearer viewport edge at the return signal.
// Measure from the player's current position, not the stage's starting point.
export function mudflatReturnCampPosition(player, width, height, radii) {
  const margin = 72;
  if (width <= height) {
    const direction = Math.cos(player.facing) >= 0 ? 1 : -1;
    return { x: player.x + direction * (width / 2 + radii.radiusX + margin), y: player.y };
  }
  const direction = Math.sin(player.facing) >= 0 ? 1 : -1;
  return { x: player.x, y: player.y + direction * (height / 2 + radii.radiusY + margin) };
}
