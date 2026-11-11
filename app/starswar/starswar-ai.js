// 스타즈워 AI. 플레이어와 같은 stwCommand만 쓴다.
// 성향마다 빌드 순서와 출격 규모가 다르다. 프로토스·테란·저그가 같은 틀을 쓴다.
import { STW_BUILDINGS, STW_DIFFICULTIES, STW_RACES, STW_RESEARCH, STW_UNITS } from "./starswar-data.js";
import { stwIntelTag, stwLearnSwitch } from "./starswar-learn.js";
import {
  stwArmy,
  stwBuildCheck,
  stwCommand,
  stwDone,
  stwDropCheck,
  stwFreeSlots,
  stwHas,
  stwIncome,
  stwMap,
  stwNexus,
  stwOpponent,
  stwOwnBuildings,
  stwResearchCheck,
  stwResearchDone,
  stwSupply,
  stwVisible,
} from "./starswar-engine.js";

/** 빌드 순서. at: 이 시간(초) 전에는 시도하지 않음. */
const BUILD_ORDERS = {
  rush: [
    { build: "pylon" }, { build: "gateway" }, { build: "gateway" }, { build: "pylon" }, { build: "gateway" },
    { build: "assimilator", at: 170 }, { build: "core" }, { build: "forge", at: 240 }, { research: "weapons1" },
    { build: "expand", at: 330 }, { build: "gateway" }, { research: "range" }, { build: "citadel" }, { research: "charge" },
  ],
  dragoon: [
    { build: "pylon" }, { build: "gateway" }, { build: "assimilator" }, { build: "core" }, { build: "pylon" },
    { build: "gateway" }, { research: "range" }, { build: "expand", at: 220 }, { build: "assimilator" }, { build: "gateway" },
    { build: "forge" }, { build: "cannon" }, { research: "weapons1" }, { build: "gateway" }, { build: "citadel" }, { research: "charge" }, { research: "armor1" },
  ],
  templar: [
    { build: "pylon" }, { build: "gateway" }, { build: "assimilator" }, { build: "core" }, { build: "pylon" },
    { build: "gateway" }, { build: "assimilator" }, { build: "citadel" }, { build: "archives" }, { research: "storm" },
    { build: "forge" }, { research: "weapons1" }, { build: "expand", at: 300 }, { build: "cannon" }, { build: "gateway" }, { research: "charge" }, { build: "gateway" },
    { build: "stargate", at: 540 }, { build: "tribunal" }, { research: "stasis" },
  ],
  dark: [
    { build: "pylon" }, { build: "gateway" }, { build: "assimilator" }, { build: "core" }, { build: "pylon" },
    { build: "assimilator" }, { build: "citadel" }, { build: "archives" }, { build: "gateway" }, { build: "pylon" },
    { build: "forge" }, { build: "expand", at: 330 }, { build: "cannon" }, { build: "gateway" }, { research: "weapons1" }, { research: "charge" },
    { research: "maelstrom", at: 420 },
  ],
  // 로보틱스 퍼실리티가 드라군 사거리 연구(150/150)보다 먼저다(사거리를 먼저 하면 리버가 10분 넘어 나왔다).
  robo: [
    { build: "pylon" }, { build: "gateway" }, { build: "assimilator" }, { build: "core" }, { build: "pylon" },
    { build: "assimilator" }, { build: "gateway" }, { build: "robo" }, { research: "range" }, { build: "bay" },
    { build: "expand", at: 260 }, { build: "gateway" }, { build: "forge" }, { build: "cannon" }, { research: "weapons1" }, { research: "scarab" }, { build: "gateway" },
  ],
  // 커세어 질럿: 드라군 운영에 스타게이트 하나를 얹어 커세어로 하늘을 잡는다(공중만으로는 어떤 상대도 못 이긴다).
  corsair: [
    { build: "pylon" }, { build: "gateway" }, { build: "assimilator" }, { build: "core" }, { build: "pylon" },
    { build: "gateway" }, { build: "stargate" }, { research: "range" }, { build: "expand", at: 220 }, { build: "assimilator" },
    { build: "gateway" }, { build: "forge" }, { build: "cannon" }, { research: "weapons1" }, { build: "gateway" }, { build: "citadel" }, { research: "charge" },
  ],
  // 캐리어 함대: 드라군 운영으로 버티며 스타게이트 둘과 플릿 비컨을 올려 캐리어를 모은다.
  // (앞마당을 스타게이트보다 먼저 먹게 해 봤는데 오히려 승률이 42% → 29%로 떨어져 되돌렸다.)
  carrier: [
    { build: "pylon" }, { build: "gateway" }, { build: "assimilator" }, { build: "core" }, { build: "assimilator" },
    { build: "pylon" }, { build: "stargate" }, { build: "gateway" }, { build: "beacon" }, { build: "expand", at: 270 },
    { build: "forge" }, { build: "cannon" }, { build: "stargate" }, { research: "carrierCapacity" }, { research: "range" }, { build: "cannon" }, { research: "weapons1" },
  ],
  bio: [
    { build: "depot" }, { build: "barracks" }, { build: "barracks" }, { build: "refinery" }, { build: "depot" },
    { build: "academy" }, { build: "barracks" }, { research: "stim" }, { build: "ebay" }, { research: "infWeapons1" },
    { build: "expand", at: 300 }, { research: "u238" }, { build: "comsat" }, { build: "refinery" }, { research: "infArmor1" }, { build: "barracks" },
    { build: "factory", at: 480 }, { build: "starport" }, { build: "science" }, { research: "irradiate" }, { research: "emp" },
  ],
  mech: [
    { build: "depot" }, { build: "barracks" }, { build: "refinery" }, { build: "depot" }, { build: "factory" },
    { build: "refinery" }, { build: "shop" }, { build: "bunker" }, { research: "siege" }, { build: "factory" },
    { build: "expand", at: 280 }, { build: "academy" }, { research: "ion" }, { build: "comsat" }, { build: "ebay" }, { build: "turret" },
    { build: "starport", at: 480 }, { build: "science" }, { research: "lockdown" },
  ],
  tankbio: [
    { build: "depot" }, { build: "barracks" }, { build: "refinery" }, { build: "barracks" }, { build: "depot" },
    { build: "academy" }, { build: "factory" }, { research: "stim" }, { build: "shop" }, { research: "siege" },
    { build: "expand", at: 300 }, { build: "barracks" }, { build: "ebay" }, { research: "infWeapons1" }, { research: "u238" }, { build: "comsat" }, { build: "refinery" },
    { build: "starport", at: 360 }, { build: "science" }, { research: "irradiate" }, { research: "emp" },
  ],
  // 배틀크루저: 탱크와 벙커로 버티며 스타포트 둘과 사이언스 퍼실리티를 올려 배틀크루저를 모은다.
  bc: [
    { build: "depot" }, { build: "barracks" }, { build: "refinery" }, { build: "depot" }, { build: "factory" },
    { build: "refinery" }, { build: "shop" }, { build: "factory" }, { build: "bunker" }, { research: "siege" },
    { build: "expand", at: 280 }, { build: "starport" }, { build: "science" }, { build: "starport" }, { research: "yamato" }, { build: "ebay" }, { build: "turret" }, { build: "academy" }, { build: "comsat" },
  ],
  // 두 번째 가스는 4분 뒤: 일찍 지으면 일꾼 15기 중 6기가 가스에 붙어 질럿 러시를 막을 광물이 모자랐다.
  vulture: [
    { build: "depot" }, { build: "barracks" }, { build: "refinery" }, { build: "factory" }, { build: "depot" },
    { build: "factory" }, { build: "refinery", at: 240 }, { build: "shop" }, { research: "siege" }, { research: "ion" },
    { build: "bunker" }, { build: "expand", at: 320 }, { build: "factory" }, { build: "academy" }, { build: "comsat" }, { build: "ebay" }, { build: "turret" },
  ],
  // 레이스 메카닉: 메카닉 운영에 스타포트 하나를 얹어 레이스를 섞는다. 공중이 많이 보이면 아머리와 골리앗.
  wraith: [
    { build: "depot" }, { build: "barracks" }, { build: "refinery" }, { build: "depot" }, { build: "factory" },
    { build: "refinery" }, { build: "shop" }, { build: "starport" }, { build: "bunker" }, { research: "siege" },
    { build: "expand", at: 280 }, { build: "factory" }, { build: "refinery" }, { build: "armory" }, { research: "wraithCloak" }, { build: "academy" }, { build: "comsat" }, { build: "ebay" }, { build: "turret" },
  ],
  // 뮤탈 저글링: 저글링 물량의 경제 위에 레어·스파이어를 얹어 해처리 절반에서 뮤탈리스크를 띄운다.
  // 레어는 3분 30초, 스파이어는 레어 바로 뒤. 발업은 스파이어 다음이다(예전에는 발업·확장·해처리 뒤에 레어가 4분 50초,
  // 첫 뮤탈이 평균 8분 43초라 그 전에 13판 중 11판을 졌다).
  muta: [
    { build: "pool" }, { build: "overlord" }, { build: "extractor" }, { build: "hatch" }, { build: "overlord" },
    { research: "lair", at: 210 }, { build: "expand", at: 210 }, { build: "extractor" }, { build: "spire" }, { research: "metabolic" },
    { build: "hatch" }, { build: "evo" }, { build: "sunken" }, { research: "zCarapace1" }, { research: "zMelee1" }, { build: "hatch" },
    { build: "nest", at: 480 }, { research: "hive" }, { research: "greaterSpire" },
  ],
  // 빠른 저글링: 첫 찌르기 뒤 4분에 앞마당을 먹는다(예전에는 5분 30초 뒤 단계라 일꾼 14~19기에 묶인 채 56%가 끝까지 확장을 못 했다).
  pool: [
    { build: "pool" }, { build: "overlord" }, { build: "extractor" }, { research: "metabolic" }, { build: "hatch" },
    { build: "overlord" }, { build: "expand", at: 240 }, { build: "hatch" }, { build: "evo", at: 300 }, { research: "zMelee1" },
    { build: "den" }, { research: "zCarapace1" }, { build: "extractor" },
  ],
  // 울트라리스크 동굴은 레어와 덴만 있으면 된다. 레어 바로 뒤에 동굴을 올린다(예전에는 업그레이드 둘 뒤라 13판 중 한 번도 울트라를 못 뽑았다).
  ultra: [
    { build: "overlord" }, { build: "pool" }, { build: "expand", at: 150 }, { build: "extractor" }, { build: "sunken" },
    { build: "overlord" }, { build: "den" }, { build: "extractor" }, { research: "lair", at: 240 }, { build: "sunken" },
    { build: "cavern" }, { build: "evo" }, { research: "zMelee1" }, { research: "chitin" }, { research: "zCarapace1" },
    { research: "metabolic" }, { build: "hatch" }, { research: "zMelee2" },
    { build: "nest", at: 480 }, { research: "hive" }, { build: "mound" }, { research: "plague" },
  ],
  // 저글링 물량: 앞마당을 일찍 먹고 해처리를 늘리며, 저글링만 끝까지 업그레이드한다(공격 2단계·갑피·아드레날린). 덴은 올리지 않는다.
  ling: [
    { build: "pool" }, { build: "overlord" }, { build: "extractor" }, { research: "metabolic" }, { build: "hatch" },
    { build: "overlord" }, { build: "expand", at: 200 }, { build: "hatch" }, { build: "evo", at: 240 }, { research: "zMelee1" },
    { research: "lair", at: 300 }, { research: "ventral" }, { build: "extractor" }, { research: "zCarapace1" }, { research: "zMelee2" }, { research: "adrenal" }, { build: "hatch" },
  ],
  hydra: [
    { build: "overlord" }, { build: "pool" }, { build: "extractor" }, { build: "hatch" }, { build: "sunken" }, { build: "den" },
    { build: "extractor" }, { build: "overlord" }, { research: "spines" }, { build: "hatch" }, { build: "expand", at: 300 },
    { research: "lair", at: 300 }, { research: "lurkerAspect" }, { build: "evo" }, { research: "zMissile1" }, { research: "augments" },
    { build: "cavern", at: 560 }, { research: "chitin" }, { research: "zCarapace1" },
  ],
  // 디파일러 하이브: 히드라·럴커로 버티며 하이브를 올려 디파일러(다크 스웜·플레이그)와 가디언, 퀸을 섞는다.
  hive: [
    { build: "overlord" }, { build: "pool" }, { build: "extractor" }, { build: "hatch" }, { build: "sunken" }, { build: "den" },
    { build: "extractor" }, { research: "lair", at: 210 }, { build: "overlord" }, { build: "nest" }, { research: "spines" },
    { research: "hive" }, { build: "expand", at: 330 }, { build: "mound" }, { build: "sunken" }, { research: "plague" }, { build: "evo" },
    { build: "spire" }, { research: "ensnare" }, { research: "greaterSpire" }, { research: "zMissile1" }, { research: "zCarapace1" },
  ],
};

/**
 * 프로토스의 저그전 시작: 파일런 → 게이트웨이 → 4분 앞마당 → 포지, 그 뒤 성향의 빌드 순서. 이 단계들은 경계 중에도 짓는다.
 * 빌드 순서는 막힌 단계를 4개까지만 건너뛰는데, 경계 중에는 테크 단계가 "경계라서 막힘"으로 그 4칸을 채워 순서 뒤쪽의
 * 앞마당에 닿지 못했다("6분 뒤에는 경계 중에도 확장" 규칙이 사실상 작동하지 않았다). 그래서 저그가 앞마당을 먹고 일꾼을
 * 38기까지 늘리는 동안 프로토스는 본진 하나에 일꾼 22기로 묶였다.
 * 시작 빌드별 프로토스 : 저그(성향 쌍마다 시드 8개): 없음 107 : 228, 포지→2분 30초 앞마당→캐논 280 : 56,
 * 게이트웨이→4분 앞마당 210 : 126, 게이트웨이→포지→4분 앞마당 180 : 156(채택).
 * 그 뒤 처음 2분의 인구 건물 중복(파일런 둘)을 없애자 게이트웨이가 14초 빨라져 같은 시작이 121 : 47(시드 4개)로 기울었다.
 * 시드 4개로: 포지→5분 앞마당 112 : 56, 포지→6분 앞마당 123 : 45, 포지 없음 71 : 97, 4분 앞마당→포지 87 : 81(채택), 4분 30초 앞마당→포지 113 : 55.
 * 질럿 러시 성향은 이미 저그를 잘 이겨서 쓰지 않는다.
 */
const PVZ_OPENER = [
  { build: "pylon", opener: true }, { build: "gateway", opener: true }, { build: "expand", at: 240, opener: true }, { build: "forge", opener: true },
];

function buildOrder(state, side, persona) {
  // 최상급의 따라 하기 계획: 이긴 사람의 빌드 순서를 그대로 밟는다.
  if (state.sides[side].plan) return state.sides[side].plan.order;
  const versusZerg = state.sides[stwOpponent(side)].race === "zerg";
  if (state.sides[side].race !== "protoss" || !versusZerg || persona === "rush") return BUILD_ORDERS[persona];
  return [...PVZ_OPENER, ...BUILD_ORDERS[persona]];
}

/**
 * 이미 끝낸 빌드 단계의 건물을 잃었는지: 앞마당이 없거나, 이 단계까지 지은 같은 종류(생산·테크 건물)보다 지금 가진 수가 적다.
 * 방어·인구·가스 건물은 따로 챙기므로 세지 않는다.
 */
function lostStep(state, side, order, index, memory) {
  const step = order[index];
  if (!step.build) return false;
  if (step.build === "expand") return !stwNexus(state, side, "natural");
  if (!memory.built.includes(index)) return false;
  const def = STW_BUILDINGS[step.build];
  if (!def || def.defense || def.supply || def.refinery) return false;
  const needed = memory.built.filter((item) => item <= index && order[item].build === step.build).length;
  return stwOwnBuildings(state, side, step.build).length < needed;
}

const WAVES = { rush: [4, 6, 8, 10, 12], dragoon: [8, 12, 16, 20], templar: [10, 14, 18, 22], dark: [3, 6, 10, 14], robo: [10, 14, 18, 22], bio: [8, 12, 16, 22], mech: [8, 12, 16, 20],
  tankbio: [10, 14, 20, 26], vulture: [8, 12, 16, 20], ling: [12, 20, 30, 42, 56], hydra: [14, 18, 24, 30], pool: [6, 10, 14, 20, 26], ultra: [12, 18, 24, 30],
  corsair: [8, 12, 16, 20], wraith: [8, 12, 16, 20], muta: [12, 18, 26, 36], carrier: [8, 12, 16, 20], bc: [8, 12, 16, 20], hive: [14, 18, 24, 30] };
const GATEWAY_CAP = { rush: 6, dragoon: 6, templar: 5, dark: 4, robo: 4, bio: 6, mech: 4, tankbio: 5, vulture: 4, ling: 9, hydra: 3, pool: 3, ultra: 3, corsair: 6, wraith: 4, muta: 7, carrier: 4, bc: 3, hive: 4 };
/** 출격 규모 상한. 저글링 물량만 더 크게 모은다(저글링은 인구 0.5). */
const WAVE_CAP = { ling: 80 };
/** 빌드 순서가 끝난 뒤 남는 자원으로 더 짓는 생산 건물. */
const EXTRA_PRODUCER = { bio: "barracks", mech: "factory", tankbio: "barracks", vulture: "factory", ling: "hatch", hydra: "hatch", pool: "hatch", ultra: "hatch", corsair: "gateway", wraith: "factory", muta: "hatch", carrier: "gateway", bc: "factory", hive: "hatch" };
/** 일꾼을 적게 뽑고 일찍 찌르는 성향: 이 시간(초)까지는 일꾼 수를 제한한다. */
const EARLY_WORKER_CAP = { pool: { until: 210, cap: 14 } };
/** 광물이 크게 쌓이면 성향과 상관없이 늘리는 기본 생산 건물. */
const FALLBACK_PRODUCER = { terran: "barracks", zerg: "hatch" };
/** 광물이 쌓일 때 늘리는 기본 생산 건물의 상한. 해처리는 한 번에 한 마리씩만 만들므로 저그는 더 많이 둔다. */
const FALLBACK_CAP = { terran: 5, zerg: 8 };
const LATE_UPGRADES = { protoss: ["weapons2", "shields1", "armor1"], terran: ["infWeapons2", "infArmor1"], zerg: ["zMelee2", "zMissile2", "zCarapace1"] };
/**
 * 수송 작전 성향: 게릴라 드랍은 2분마다 한 분대(계속 견제), 폭탄 드랍은 정면 출격과 동시에.
 * 로보 운영은 셔틀로 질럿·드라군, 레이스 메카닉은 드랍십으로 벌처·해병, 저글링 물량은 오버로드로 저글링, 탱크 바이오는 드랍십 둘로 폭탄 드랍.
 */
const DROP_PLANS = {
  robo: { mission: "raid", target: "alternate" },
  wraith: { mission: "raid", target: "main" },
  ling: { mission: "raid", target: "alternate" },
  tankbio: { mission: "bomb", target: "production", sync: true },
};
const DEFAULT_PERSONA = { protoss: "dragoon", terran: "bio", zerg: "hydra" };
/**
 * 경계 중에도 짓는 1단계 유닛 해금 건물: 질럿 러시에 드라군·파이어뱃·히드라로 맞서야 한다.
 * 머신 샵도 넣는다: 메카닉은 시즈 탱크가 수비의 중심인데, 질럿 압박으로 경계가 길어지면 샵을 못 지어 가스가 수백씩 쌓인 채
 * 벌처·해병만 뽑았다(질럿 러시 상대로 6분부터 9분 30초까지 샵 없이 가스 470).
 */
const ALERT_TECH = new Set(["core", "academy", "den", "evo", "shop"]);

/**
 * 테크 성향의 핵심 테크 단계: 이 단계가 빌드 순서의 맨 앞에서 자원을 기다리면, 병력이 안전한 동안 생산을 멈춰서라도 그 비용을 모은다.
 * 예전에는 저그가 맨 앞 단계를 아끼지 않고(확장만 아꼈다) 프로토스·테란은 경계 중 테크를 막아, 테크 성향이 본진 일꾼 22기로
 * 8~9분까지 묶인 채 대표 유닛을 못 뽑았다(평원, 다른 종족 상대: 울트라 0/13판, 리버 2/12, 디파일러·가디언 3/13, 캐리어 4/12, 배틀크루저 5/13).
 */
const TECH_STEPS = {
  muta: ["lair", "spire"], ultra: ["lair", "cavern"], hive: ["lair", "nest", "hive", "mound"],
  carrier: ["core", "stargate", "beacon"], bc: ["factory", "starport", "science"], templar: ["core", "citadel", "archives", "storm"],
  robo: ["core", "robo", "bay"], dark: ["core", "citadel", "archives"], wraith: ["factory", "starport"],
};

/**
 * 늦게 정하는 성향: 프로토스·저그의 테크·운영 성향은 처음에 그 종족의 기본 빌드(드라군 운영·히드라 운영)로 시작하고,
 * 수비가 안정되면 그때 자기 전략으로 넘어간다. 처음부터 테크를 올리면 병력이 얇아 첫 압박에 무너졌다.
 * 질럿 러시·다크템플러 기습·빠른 저글링·저글링 물량은 시점이 생명인 전략이라 처음부터 자기 빌드를 따른다.
 */
const DELAYED_PERSONAS = new Set(["templar", "robo", "carrier", "corsair", "ultra", "hive", "muta"]);
/** 기본 빌드에서 자기 전략으로 넘어가는 조건: 4분 30초 뒤, 경계가 아니고, 전투 병력이 이만큼 있고(저글링은 반 기), 병력이 안전할 때. 늦어도 7분 30초에는 넘어간다. */
const COMMIT_ARMY = { protoss: 6, zerg: 10 };
const COMMIT_EARLIEST = 270;
const COMMIT_LATEST = 450;

function openingPersona(state, side, memory, race, alert) {
  const record = state.sides[side];
  const chosen = record.persona ?? DEFAULT_PERSONA[race.id];
  if (record.plan || memory.committedAt !== undefined || !DELAYED_PERSONAS.has(chosen) || !COMMIT_ARMY[race.id]) return chosen;
  const opener = DEFAULT_PERSONA[race.id];
  const army = stwArmy(state, side);
  const fighters = [...army.fighters, ...army.attackers].reduce((sum, unit) => sum + (unit.type === "zergling" ? 0.5 : 1), 0);
  const stable = state.time >= COMMIT_EARLIEST && !alert && fighters >= COMMIT_ARMY[race.id] && armySafe(state, side, memory, opener);
  if (!stable && state.time < COMMIT_LATEST) return opener;
  // 넘어갈 때는 자기 빌드 순서를 처음부터 다시 보되, 이미 가진 건물·끝낸 연구는 한 것으로 친다(게이트웨이를 또 짓지 않게).
  memory.committedAt = state.time;
  memory.done = [];
  memory.built = [];
  markOwnedSteps(state, side, buildOrder(state, side, chosen), memory);
  return chosen;
}

/** 빌드 순서에서 이미 해 둔 단계를 끝낸 것으로 표시한다: 같은 건물은 순서에 나온 횟수만큼 가졌으면, 연구는 끝났거나 하는 중이면, 확장은 앞마당이 있으면. */
function markOwnedSteps(state, side, order, memory) {
  const record = state.sides[side];
  const seen = {};
  order.forEach((step, index) => {
    let owned = false;
    if (step.build === "expand") owned = Boolean(stwNexus(state, side, "natural"));
    else if (step.build) {
      seen[step.build] = (seen[step.build] ?? 0) + 1;
      owned = stwOwnBuildings(state, side, step.build).length >= seen[step.build];
    } else if (step.research) owned = Boolean(record.research[step.research]);
    if (owned) {
      memory.done.push(index);
      if (step.build) memory.built.push(index);
    }
  });
}

/**
 * 병력이 안전한지: 지금 싸울 수 있는 병력의 힘이 최근 본 가장 큰 적 병력의 80%(최소 질럿 1.5기쯤) 이상.
 * 안전할 때만 생산을 멈추고 테크·확장 자원을 모은다. 병력이 얇은데 생산을 멈추면 첫 웨이브에 무너지고, 그 뒤로는 새 유닛이 나오는 대로 잡힌다.
 */
function armySafe(state, side, memory, persona) {
  const army = stwArmy(state, side);
  const discount = persona !== "ling";
  const own = armyPower(army.fighters, 0, discount) + armyPower(army.attackers, 0, discount);
  return own >= Math.max(seenFoePower(state, side, memory) * 0.8, 70);
}

export function stwAiThink(state, side) {
  const record = state.sides[side];
  const settings = STW_DIFFICULTIES[state.difficulty];
  record.ai ??= { nextThink: 0, step: 0, wave: 0, attacking: false, waveStart: 0 };
  const memory = record.ai;
  if (state.time < memory.nextThink) return;
  memory.nextThink = state.time + settings.thinkEvery;
  const race = STW_RACES[record.race ?? "protoss"];
  switchStrategy(state, side, memory);

  // 0. 정찰과 위협 판단: 일꾼 1기를 두 번 정찰 보내고, 이른 러시 조짐이나 침입을 보면 경계 태세로 들어간다.
  // 2분에 첫 정찰(상대 두 번째 생산 건물이 설 무렵 도착), 3분 30초에 두 번째 정찰.
  if (!memory.scouted && state.time >= 120 && record.probes >= 7 && stwCommand(state, side, { type: "scout" }).ok) memory.scouted = true;
  if (memory.scouted && !memory.scouted2 && state.time >= 210 && record.probes >= 8 && stwCommand(state, side, { type: "scout" }).ok) memory.scouted2 = true;
  if (settings.master) readOpponent(state, side, record, memory);
  const alert = assessThreat(state, side, memory);
  trackFoe(state, side, memory);
  // 지금 따르는 성향: 프로토스·저그의 테크 성향은 수비가 안정될 때까지 기본 빌드(드라군·히드라 운영)로 시작한다.
  const persona = openingPersona(state, side, memory, race, alert);
  // 리포트용 기록: 경계 상태로 보낸 시간과 처음 경계에 들어간 시각(판단에는 쓰지 않는다).
  if (alert) {
    memory.alertSeconds = Math.round(((memory.alertSeconds ?? 0) + settings.thinkEvery) * 10) / 10;
    memory.alertFirst ??= state.time;
  }
  const scoutingNow = state.units.filter((unit) => unit.side === side && unit.group === "scout").length;

  // 다음 건물·연구에 필요한 자원만 아껴 둔다(모자란 쪽만). 생산 건물이 유닛을 멈추고 기다리는 것은
  // 확장·인구·경계 중 방어 건물처럼 늦으면 크게 손해인 것(hard)뿐이고, 연구·테크 건물은 남는 자원으로만 한다.
  // expand: 확장이 30초 넘게 자원 부족으로 막혀 있으면 첫 생산 건물만 남기고 모두 멈춰 확장부터 한다(경계가 길어지면 경제가 영영 멈추던 문제).
  // safe: 병력이 안전한 동안만 생산 건물을 멈춰 가며 자원을 모은다(armySafe). 생산 라인 규칙이 함께 본다.
  const safe = armySafe(state, side, memory, persona);
  const reserve = { minerals: 0, gas: 0, hard: 0, expand: false, safe };
  const save = (minerals, gas, hard = false) => {
    if (record.minerals < minerals) {
      reserve.minerals = Math.max(reserve.minerals, minerals);
      if (hard) reserve.hard = Math.max(reserve.hard, minerals);
    }
    if (record.gas < gas) reserve.gas = Math.max(reserve.gas, gas);
  };
  // 경계 중에는 방어 건물이 가장 먼저다: 못 지으면 그 비용을 아껴 둔다(병력이 3기 미만일 때만 생산이 이를 무시한다).
  // 순서: 방어 건물 하나(프로토스는 포지부터) → 생산 건물 셋 → 방어 건물 둘(저그는 셋).
  if (alert) {
    const producersNow = race.producers.reduce((sum, type) => sum + stwOwnBuildings(state, side, type).length, 0);
    const alertProducer = alertProducerFor(state, side, race, persona);
    let waiting = ensureDefense(state, side, race, 1);
    if (!waiting && producersNow < 3) {
      const result = stwCommand(state, side, { type: "build", building: alertProducer });
      if (!result.ok && /부족/.test(result.reason ?? "")) waiting = STW_BUILDINGS[alertProducer];
    }
    // 캐논은 포지까지 450이라 하나로 그치고, 벙커 둘, 성큰 셋.
    if (!waiting && producersNow >= 3) waiting = ensureDefense(state, side, race, race.id === "protoss" ? 1 : race.id === "terran" ? 2 : 3);
    if (waiting) save(waiting.minerals, waiting.gas, true);
  }
  // 0. 상위 유닛 몫: 울트라리스크·럴커를 만들 차례면 연구보다 먼저 그 자원을 아껴 둔다.
  const signature = signatureUnit(state, side, persona);
  if (signature) save(STW_UNITS[signature].minerals, STW_UNITS[signature].gas);

  // 1. 프로브
  const bases = ["main", "natural"].filter((base) => {
    const nexus = stwNexus(state, side, base);
    return nexus && stwDone(nexus);
  }).length;
  const gasBuildings = stwOwnBuildings(state, side, race.refinery).length;
  const early = EARLY_WORKER_CAP[persona];
  // 이른 러시 경계 중(5분 전)에는 일꾼을 더 뽑지 않고 그 돈을 방어와 병력에 쓴다.
  const probeTarget = alert && state.time < 300 ? Math.min(record.probes, 44) : Math.min(early && state.time < early.until ? early.cap : 44, bases * 16 + gasBuildings * 3);
  const queued = stwOwnBuildings(state, side, race.base).reduce((sum, nexus) => sum + nexus.queue.length, 0);
  if (record.probes + queued + scoutingNow < probeTarget && queued < 2 * bases) stwCommand(state, side, { type: "probe" });
  // 저글링 물량은 해처리마다 저글링이 50씩 쉬지 않고 광물을 먹어 드론 차례가 오지 않는다. 일꾼이 모자라면 드론 두 마리 값을 먼저 챙긴다.
  if ((persona === "ling" || persona === "muta") && record.probes + queued < probeTarget) save(STW_UNITS[race.worker].minerals * 2, 0, true);

  // 1-1. 테란은 아머리가 없는 동안 건물 자리 하나를 비워 둔다(1기지 본진 20칸은 8~9분에 서플라이 디팟·생산 건물로 다 찬다).
  // 자리가 없으면 캐리어·배틀크루저가 나온 뒤 아머리를 못 지어 골리앗 없이 졌다. 인구 건물·생산 건물·빌드 순서의 건물이 마지막 칸을 쓰지 않는다.
  const keepSlot = race.id === "terran" && !stwOwnBuildings(state, side, "armory").length && stwFreeSlots(state, side) <= 1;

  // 2. 인구
  const supply = stwSupply(state, side);
  const gateways = race.producers.reduce((sum, type) => sum + stwOwnBuildings(state, side, type).length, 0);
  const pylonsBuilding = stwOwnBuildings(state, side, race.supply).filter((building) => !stwDone(building)).length;
  if (!keepSlot && supply.cap < 100 && supply.used + 3 + gateways * 2 >= supply.cap && pylonsBuilding < (supply.used > 40 ? 2 : 1)) {
    const result = stwCommand(state, side, { type: "build", building: race.supply });
    if (!result.ok && /광물/.test(result.reason ?? "")) save(STW_BUILDINGS[race.supply].minerals, 0, true);
  }

  // 3. 빌드 순서: 막힌 단계가 있으면 그 자원만 아껴 두고, 남는 자원으로 할 수 있는 다음 단계(최대 4개 앞)를 먼저 한다.
  const order = buildOrder(state, side, persona);
  memory.done ??= [];
  memory.built ??= [];
  let blocked = 0;
  for (let index = 0; index < order.length && blocked < 4; index += 1) {
    const step = order[index];
    if (memory.done.includes(index)) {
      // 부서진 앞마당·생산·테크 건물은 그 단계를 되살려 다시 짓는다(한 번 끝난 단계는 다시 보지 않아, 짓던 앞마당이 부서지면
      // 끝까지 본진 하나에 일꾼 22기로 묶였다).
      if (!lostStep(state, side, order, index, memory)) continue;
      memory.done = memory.done.filter((item) => item !== index);
      memory.built = memory.built.filter((item) => item !== index);
    }
    if (step.at && state.time < step.at * STW_DIFFICULTIES[state.difficulty].waveScale) {
      blocked += 1;
      continue;
    }
    // 경계 중에는 확장·상위 테크를 미루고 인구·생산 건물·방어 건물과 그에 필요한 가스만 짓는다.
    // 5분이 지나면 1단계 유닛 해금 건물(코어·아카데미·덴·에볼루션 챔버)을, 방어 건물 비용을 기다리는 중이 아니면 연구도 허용한다
    // (경계가 길어지면 업그레이드까지 10분씩 밀린다).
    // 6분이 지나면 확장도 허용한다(견제로 경계가 끝없이 이어지면 경제가 영영 멈춘다). 확장 비용은 바로 아끼므로 노는 생산 건물이 멈춰 돈이 모인다.
    // 가스가 150 넘게 쌓였으면 1단계 해금 건물(코어 등)은 5분 전에도 짓는다. 가스를 쓸 유닛이 없으면 쌓이기만 한다.
    const gasIdle = record.gas >= 150;
    const techStep = Boolean(TECH_STEPS[persona]?.includes(step.build ?? step.research));
    // 테크 성향의 핵심 테크는 병력이 안전하면 경계 중에도 올린다(경계가 길면 대표 유닛이 영영 늦었다).
    const allowedInAlert = step.opener || (techStep && safe) || (step.research ? state.time >= 300 && !reserve.hard : step.build === "expand" ? state.time >= 360 : step.build === race.supply || race.producers.includes(step.build) || STW_BUILDINGS[step.build]?.defense || (ALERT_TECH.has(step.build) && (state.time >= 300 || gasIdle)) || (step.build === race.refinery && !stwOwnBuildings(state, side, race.refinery).length));
    if (alert && !allowedInAlert) {
      blocked += 1;
      continue;
    }
    // 인구 건물 단계는, 처음 2분 동안 이미 짓는 인구 건물이 있으면 그것으로 친다. 인구 규칙과 빌드 순서가 같은 생각에서
    // 파일런을 둘 지어 광물 100을 버렸다(이른 질럿 압박 리포트에서는 이 100이 5분 30초 패배와 버팀을 갈랐다).
    if (state.time < 120 && step.build === race.supply && stwOwnBuildings(state, side, race.supply).some((building) => !stwDone(building))) {
      memory.done.push(index);
      continue;
    }
    // 둘째 가스 건물은 일꾼이 18기는 돼야 짓는다. 13기에 둘째 가스를 지어 6기가 가스에 붙자, 광물이 모자라 코어도 질럿도 못 뽑고
    // 가스만 626 쌓인 채 질럿 압박에 5분 30초에 졌다.
    // 가스를 많이 쓰는 테크 성향(캐리어·배틀크루저·템플러·다크·로보·레이스)은 16기에 짓는다.
    if (step.build === race.refinery && race.id !== "zerg" && stwOwnBuildings(state, side, race.refinery).length >= 1 && record.probes < (TECH_STEPS[persona] ? 16 : 18)) {
      blocked += 1;
      continue;
    }
    if (keepSlot && step.build && step.build !== "expand" && step.build !== "armory" && !STW_BUILDINGS[step.build]?.refinery && !STW_BUILDINGS[step.build]?.defense) {
      blocked += 1;
      continue;
    }
    const check = step.build ? stwBuildCheck(state, side, step.build) : stwResearchCheck(state, side, step.research);
    // 본진 간헐천이 다 찼고 앞마당 간헐천은 앞마당을 기다리는 가스 단계는, 막힌 단계로 세지도 끝내지도 않고 앞마당이 서면 짓는다.
    if (/앞마당 기지가 서면/.test(check.reason ?? "")) continue;
    const cost = step.build ? STW_BUILDINGS[step.build === "expand" ? race.base : step.build] : STW_RESEARCH[step.research];
    const fitsReserve = record.minerals - reserve.minerals >= cost.minerals && record.gas - reserve.gas >= cost.gas;
    if (check.ok && ((blocked === 0 && !signature) || fitsReserve)) {
      stwCommand(state, side, step.build ? { type: "build", building: step.build } : { type: "research", research: step.research });
      memory.done.push(index);
      if (step.build) memory.built.push(index);
      continue;
    }
    // 앞마당에 적이 얼쩡거려 확장을 못 하면 대기 병력을 앞마당으로 옮겨 치운다(그냥 두면 영영 확장을 못 한다).
    if (step.build === "expand") memory.clearNatural = /앞마당에 적/.test(check.reason ?? "");
    // 경계가 아닌데 확장이 앞 단계들 뒤에서 45초 넘게 광물 부족으로 밀리면 맨 앞 단계처럼 그 비용을 아낀다. 맨 앞 단계만 아끼면
    // 앞의 연구·테크가 가스나 선행 건물을 기다리는 동안 광물이 병력으로 다 나간다. 경계 중에는 아끼지 않는다: 질럿 압박을 받는
    // 메카닉이 7분 30초에 앞마당을 먹자 병력이 모자라 8판을 모두 졌다(아끼지 않으면 8판 모두 이긴다).
    if (step.build === "expand" && blocked > 0 && !alert && /광물/.test(check.reason ?? "")) {
      memory.expandWaitSince ??= state.time;
      if (state.time - memory.expandWaitSince > 45) save(cost.minerals, 0, true);
    } else if (step.build === "expand") memory.expandWaitSince = undefined;
    // "다른 연구 중"은 건물이 비면 다시 시도해야 하므로 건너뛴 것으로 치지 않는다.
    if (/이미|완료|자리|찼습니다|^연구 중$/.test(check.reason ?? "")) {
      memory.done.push(index);
      continue;
    }
    // 맨 앞 단계가 자원 부족으로 막히면 그 비용을 아껴 둔다. 확장은 바로, 나머지는 15초 넘게 기다려도 안 모이면 생산을 멈추고 모은다
    // (생산 건물이 많으면 남는 자원이 영영 생기지 않아 빌드가 멈춰 버리기 때문).
    if (blocked === 0 && /부족/.test(check.reason ?? "")) {
      if (memory.headStep !== index) {
        memory.headStep = index;
        memory.headSince = state.time;
      }
      // 프로토스·테란은 바로 아낀다(놀고 있는 생산 건물만 멈추므로 손해가 작다). 저그는 확장만 바로 아끼고,
      // 저글링 물량은 15초 넘게 막힌 단계도 아낀다(해처리를 멈추지 않으면 연구 자금이 영영 안 모인다. 다른 저그 성향은 이 규칙으로 러시 방어가 약해져 쓰지 않는다).
      // 경계 중에는 방어 건물·인구 건물이 아니면 생산을 멈춰 가며 모으지 않는다(팩토리를 기다리느라 배럭이 놀다가 러시에 무너지던 문제).
      // 테크 성향의 핵심 테크 단계도 병력이 안전하면 반드시 아낀다(저그도).
      const strict = step.build === "expand" || race.id !== "zerg" || (persona === "ling" && state.time - memory.headSince > 15) || (techStep && safe);
      // 가스가 놀고 있으면 그 가스를 쓰게 하는 해금 건물(코어 등)도 반드시 산다(경계 중 질럿에 광물을 다 써 코어가 11분에야 섰다).
      const unlocksGas = gasIdle && ALERT_TECH.has(step.build);
      save(cost.minerals, cost.gas, (strict && (!alert || step.build === race.supply || Boolean(STW_BUILDINGS[step.build]?.defense) || (techStep && safe))) || unlocksGas);
      if (step.build === "expand" && state.time - memory.headSince > 30) reserve.expand = true;
    }
    blocked += 1;
  }
  memory.step = memory.done.length;
  // 리포트용: 이번 생각에서 아껴 둔 자원(판단에는 다시 쓰지 않는다).
  memory.reserve = { minerals: reserve.minerals, gas: reserve.gas, hard: reserve.hard, expand: reserve.expand };
  const extra = EXTRA_PRODUCER[persona] ?? race.mainProducer;
  // 광물이 남으면 생산 건물을 더 짓는다. 빌드 순서가 끝나기 전이라도 크게 남으면 짓는다.
  // 저그는 해처리 하나가 한 번에 한 마리씩만 만들므로 광물이 쌓이면 일찍 해처리를 늘린다.
  const floating = record.minerals > (memory.step >= order.length || race.id === "zerg" ? 300 : 600);
  if (keepSlot) {
    // 마지막 자리는 아머리 몫이다.
  } else if (floating && stwOwnBuildings(state, side, extra).length < GATEWAY_CAP[persona]) stwCommand(state, side, { type: "build", building: extra });
  else if (FALLBACK_PRODUCER[race.id] && record.minerals > 700 && stwOwnBuildings(state, side, FALLBACK_PRODUCER[race.id]).length < FALLBACK_CAP[race.id]) stwCommand(state, side, { type: "build", building: FALLBACK_PRODUCER[race.id] });
  if (memory.step >= order.length) {
    for (const research of LATE_UPGRADES[race.id]) {
      if (STW_RESEARCH[research] && stwResearchCheck(state, side, research).ok && record.gas > 200) stwCommand(state, side, { type: "research", research });
    }
  }

  // 3-0. 경계 중 방어 건물까지 갖춘 뒤 광물이 남으면 생산 건물을 넷까지 늘린다.
  const alertProducer = alertProducerFor(state, side, race, persona);
  if (alert && race.producers.reduce((sum, type) => sum + stwOwnBuildings(state, side, type).length, 0) < 4 && record.minerals - reserve.minerals >= STW_BUILDINGS[alertProducer].minerals + 100) stwCommand(state, side, { type: "build", building: alertProducer });

  // 3-1. 은폐 유닛에 당했으면 탐지기를 갖춘다: 로보가 있으면 옵저버, 없으면 포지와 포톤 캐논.
  const units = state.units.filter((unit) => unit.side === side);
  const needDetection = (record.sawCloakAt !== undefined && state.time - record.sawCloakAt < 150) || (memory.expectCloak && state.time > 300);
  if (needDetection && race.id === "protoss") {
    const hasRobo = stwHas(state, side, "robo");
    const cannons = stwOwnBuildings(state, side, "cannon").length;
    if (!hasRobo && cannons < 2) {
      if (!stwOwnBuildings(state, side, "forge").length) stwCommand(state, side, { type: "build", building: "forge" });
      else stwCommand(state, side, { type: "build", building: "cannon" });
    }
  }
  if (needDetection && race.id === "terran") {
    // 테란: 엔지니어링 베이와 미사일 터렛 2개, 아카데미가 있으면 컴샛 스테이션.
    if (!stwOwnBuildings(state, side, "ebay").length) stwCommand(state, side, { type: "build", building: "ebay" });
    else if (stwOwnBuildings(state, side, "turret").length < 2) stwCommand(state, side, { type: "build", building: "turret" });
    if (stwHas(state, side, "academy") && !stwOwnBuildings(state, side, "comsat").length) stwCommand(state, side, { type: "build", building: "comsat" });
  }
  if (needDetection && race.id === "zerg") {
    // 저그: 에볼루션 챔버와 스포어 콜로니 2개.
    if (!stwOwnBuildings(state, side, "evo").length) stwCommand(state, side, { type: "build", building: "evo" });
    else if (stwOwnBuildings(state, side, "spore").length < 2) stwCommand(state, side, { type: "build", building: "spore" });
  }

  // 3-1-0. 공중에 당했거나 적 병력의 1/4 넘게 공중이면 대공 건물을 둘 갖춘다(캐논·터렛·스포어). 터렛·스포어는 탐지도 겸한다.
  const needAA = (record.sawAirAt !== undefined && state.time - record.sawAirAt < 150) || airThreat(state, side) > 0.25;
  if (needAA && race.id === "protoss" && stwOwnBuildings(state, side, "cannon").length < 2) {
    if (!stwOwnBuildings(state, side, "forge").length) stwCommand(state, side, { type: "build", building: "forge" });
    else stwCommand(state, side, { type: "build", building: "cannon" });
  }
  if (needAA && race.id === "terran" && stwOwnBuildings(state, side, "turret").length < 2) {
    if (!stwOwnBuildings(state, side, "ebay").length) stwCommand(state, side, { type: "build", building: "ebay" });
    else stwCommand(state, side, { type: "build", building: "turret" });
  }
  if (needAA && race.id === "zerg" && stwOwnBuildings(state, side, "spore").length < 2) {
    if (!stwOwnBuildings(state, side, "evo").length) stwCommand(state, side, { type: "build", building: "evo" });
    else stwCommand(state, side, { type: "build", building: "spore" });
  }

  // 3-1-0-1. 상대 수송선을 봤거나 드랍을 맞았으면 본진에 지상을 쏘는 방어 건물 하나(캐논·벙커·성큰). 배치 규칙이 본진에 먼저 세운다.
  if (record.sawTransportAt !== undefined && stwNexus(state, side, "natural") && state.time > 300) {
    const guard = race.id === "protoss" ? "cannon" : race.id === "terran" ? "bunker" : "sunken";
    if (!state.buildings.some((building) => building.side === side && building.type === guard && building.base === "main")) ensureDefense(state, side, race, stwOwnBuildings(state, side, guard).length + 1);
  }

  // 3-1-1. 저그 상대: 저글링 물량에 대비해 테란은 벙커 하나를 세운다.
  const versusZerg = state.sides[stwOpponent(side)].race === "zerg";
  if (versusZerg && race.id === "terran" && stwHas(state, side, "barracks") && state.time > 150) {
    // 벙커는 기지 전체를 지키므로 하나면 된다.
    if (!stwOwnBuildings(state, side, "bunker").length) stwCommand(state, side, { type: "build", building: "bunker" });
  }

  // 3-1-2. 프로토스 대 저그: 앞마당이 서면 캐논을 하나 더 세운다(저글링 물량 대비).
  if (versusZerg && race.id === "protoss" && stwHas(state, side, "forge") && stwNexus(state, side, "natural") && stwOwnBuildings(state, side, "cannon").length < 2 && record.minerals > 300) {
    stwCommand(state, side, { type: "build", building: "cannon" });
  }

  // 3-2. 하이템플러가 넷 이상 쌓이면 에너지가 적은 둘을 아콘으로 합친다.
  if (race.id === "protoss" && units.filter((unit) => unit.type === "templar").length >= 4) stwCommand(state, side, { type: "merge" });
  // 다크템플러 기습: 마엘스트롬 연구 뒤 다크템플러가 넷 이상이면 둘을 다크 아콘으로(다크 아콘은 둘까지).
  if (persona === "dark" && stwResearchDone(state, side, "maelstrom") && units.filter((unit) => unit.type === "dark").length >= 4 && units.filter((unit) => unit.type === "darkArchon").length < 2) stwCommand(state, side, { type: "darkMerge" });

  // 3-3-9. 테란이 공중에 밀리면 아머리를 먼저 세운다(골리앗·발키리 해금). 모자라면 그 비용을 아껴 둔다.
  // 예전에는 팩토리 라인을 정할 때 돈이 있으면 짓는 정도라, 캐리어가 나온 뒤에도 아머리 없이 벌처·탱크만 뽑다 졌다.
  if (race.id === "terran" && terranAirHeavy(state, side) && stwHas(state, side, "factory") && !stwOwnBuildings(state, side, "armory").length) {
    const result = stwCommand(state, side, { type: "build", building: "armory" });
    if (!result.ok && /부족/.test(result.reason ?? "")) save(STW_BUILDINGS.armory.minerals, STW_BUILDINGS.armory.gas, true);
  }

  // 3-4. 테란 생산 라인: 배럭(해병·메딕·파이어뱃), 팩토리(벌처·시즈 탱크).
  if (race.id === "terran") {
    terranLines(state, side, persona, units, reserve);
    manageArmy(state, side, persona, memory, settings, { alert });
    return;
  }
  if (race.id === "zerg") {
    // 이른 질럿 압박: 성큰을 3개까지 세운다.
    const mix = foeMix(state, side);
    memory.extraSunkens ??= 0;
    if (mix && mix.zealot > 0.5 && state.time < 480 && memory.extraSunkens < 3 && stwHas(state, side, "pool") && stwOwnBuildings(state, side, "sunken").length < 3) {
      if (stwCommand(state, side, { type: "build", building: "sunken" }).ok) memory.extraSunkens += 1;
    }
    zergLines(state, side, persona, units, reserve);
    // 오버로드 동행: 은폐 유닛에 당하면 오버로드가 둘 이상일 때 하나를 병력에 붙인다. 하나뿐이면 끈다.
    const overlordBuildings = stwOwnBuildings(state, side, "overlord", { doneOnly: true }).length;
    const escorting = units.some((unit) => unit.type === "overlord" && unit.escort);
    if (needDetection && !record.escort && overlordBuildings >= 2) stwCommand(state, side, { type: "escort", on: true });
    else if (record.escort && !escorting && overlordBuildings < 2) stwCommand(state, side, { type: "escort", on: false });
    if (record.escort && record.gas > 300 && stwResearchCheck(state, side, "pneumatized").ok) stwCommand(state, side, { type: "research", research: "pneumatized" });
    // 동행 오버로드가 없는 동안 은폐 유닛에 당하면 스포어가 있는 기지에서 기다린다.
    manageArmy(state, side, persona, memory, settings, { holdHome: needDetection && !escorting && units.filter((unit) => !STW_UNITS[unit.type].worker).length < 30, alert });
    return;
  }

  // 3-3. 로보틱스 라인: 옵저버 1~2기를 유지하고, 지원 베이가 있으면 리버.
  const observers = units.filter((unit) => unit.type === "observer").length;
  for (const robo of stwOwnBuildings(state, side, "robo", { doneOnly: true })) {
    let unit = null;
    if (observers < (needDetection || persona === "robo" ? 1 : 0) + (persona === "robo" && state.time > 480 ? 1 : 0)) unit = "observer";
    // 로보 운영은 8분 뒤 셔틀 하나로 본진 침투를 노린다.
    // 로보 운영은 5분 뒤 셔틀 하나로 게릴라 드랍을 다닌다(지원 베이가 있으면 첫 리버 다음).
    else if (persona === "robo" && state.time > 300 && !units.some((item) => item.type === "shuttle") && (units.some((item) => item.type === "reaver") || !stwHas(state, side, "bay"))) unit = "shuttle";
    else if (persona === "robo" && stwHas(state, side, "bay")) unit = "reaver";
    // 리버는 로보 운영의 핵심이라 연구용 가스보다 먼저 만든다.
    if (robo.line !== unit) stwCommand(state, side, { type: "line", buildingId: robo.id, unit });
  }

  // 3-3-1. 스타게이트 라인: 커세어 질럿은 커세어 6기까지, 그 뒤 가스가 남으면 스카웃. 다른 성향은 적 공중이 많을 때만 커세어.
  const corsairs = units.filter((unit) => unit.type === "corsair").length;
  const foeAirHeavy = airThreat(state, side) > 0.3 || (record.sawAirAt !== undefined && state.time - record.sawAirAt < 150);
  for (const stargate of stwOwnBuildings(state, side, "stargate", { doneOnly: true })) {
    let unit = null;
    // 상대가 대공 위주(절반 넘게 공중을 쏨)면 커세어는 4기에서 그치고 가스를 드라군에 쓴다.
    const foeAntiAir = antiAirShare(foeMix(state, side)) > 0.5;
    if (persona === "corsair") unit = corsairs < (foeAirHeavy ? 10 : foeAntiAir ? 4 : 6) ? "corsair" : record.gas > 500 && !foeAntiAir ? "scout" : null;
    else if (persona === "carrier") unit = stwHas(state, side, "beacon") ? "carrier" : foeAirHeavy && corsairs < 4 ? "corsair" : null;
    else if (stwHas(state, side, "tribunal") && units.filter((item) => item.type === "arbiter").length < 1) unit = "arbiter";
    else if (foeAirHeavy && corsairs < 6) unit = "corsair";
    // 커세어·캐리어는 그 성향의 핵심이라 연구용 가스보다 먼저 만든다.
    const core = persona === "corsair" || persona === "carrier";
    if (unit && !core && record.gas < STW_UNITS[unit].gas + reserve.gas && record.minerals < 400) unit = null;
    // 확장·방어 비용을 모으는 중에 놀고 있으면 멈춘다. 커세어·캐리어 성향도 반드시 사야 할 비용(hard)은 지킨다:
    // 예전에는 핵심 유닛이라 빼 줬더니, 캐논에 녹는 커세어를 계속 다시 뽑느라 확장 400을 9분 넘게 못 모았다.
    if (unit && safe && ((reserve.hard && record.minerals - STW_UNITS[unit].minerals < reserve.hard && !stargate.current) || (!core && reserve.expand))) unit = null;
    if (stargate.line !== unit) stwCommand(state, side, { type: "line", buildingId: stargate.id, unit });
  }

  // 4. 생산 라인(프로토스 게이트웨이): 테크를 모을 때는 셋 중 둘까지만 잠시 멈춘다.
  const gatewayList = stwOwnBuildings(state, side, "gateway").sort((a, b) => a.id - b.id);
  const counter = protossCounter(state, side);
  const armyNow = stwArmy(state, side);
  const thin = armyNow.fighters.length + armyNow.attackers.length < 3;
  gatewayList.forEach((gateway, index) => {
    let unit = "zealot";
    // 저그 상대로는 저글링에 강한 질럿을 더 섞는다.
    if (persona === "dragoon" && stwHas(state, side, "core")) unit = index % (versusZerg ? 3 : 4) === (versusZerg ? 2 : 3) ? "zealot" : "dragoon";
    if (persona === "templar") {
      if (stwHas(state, side, "archives")) unit = index % 3 === 0 ? "templar" : "zealot";
      else if (stwHas(state, side, "core")) unit = index % 2 ? "dragoon" : "zealot";
    }
    if (persona === "rush" && stwHas(state, side, "core") && state.time > 360) unit = index % 2 ? "dragoon" : "zealot";
    if (persona === "dark") {
      if (stwHas(state, side, "archives")) unit = index % 2 === 0 ? "dark" : stwHas(state, side, "core") ? "dragoon" : "zealot";
      else if (stwHas(state, side, "core")) unit = index % 2 ? "dragoon" : "zealot";
    }
    if (persona === "robo" && stwHas(state, side, "core")) unit = index % (versusZerg ? 2 : 3) === (versusZerg ? 1 : 2) ? "zealot" : "dragoon";
    // 커세어 질럿: 드라군 운영처럼 뽑되 셋 중 하나는 질럿(가스는 커세어와 나눈다).
    if ((persona === "corsair" || persona === "carrier") && stwHas(state, side, "core")) unit = index % 3 === 2 ? "zealot" : "dragoon";
    // 상대 병력 구성에 맞춘 대응(다크템플러·하이템플러 라인은 건드리지 않는다).
    if (counter && stwHas(state, side, "core") && (unit === "zealot" || unit === "dragoon")) {
      unit = shareOf(index, gatewayList.length, counter.zealotShare) ? "zealot" : "dragoon";
      if (counter.storm && stwHas(state, side, "archives") && index % 4 === 3) unit = "templar";
    }
    // 가스가 남고 광물이 모자라면 가스를 많이 쓰는 유닛으로.
    if (unit === "zealot" && record.gas > 300 && record.minerals < 150 && stwHas(state, side, "core")) unit = stwHas(state, side, "archives") && persona !== "dark" ? "templar" : "dragoon";
    // 가스를 아끼는 중이면 가스 유닛 대신 질럿. 광물이 250 넘을 때만 바꾸면, 드라군·커세어가 가스를 계속 먹어
    // 사거리 연구(가스 100)가 13분 동안 한 번도 안 끝나고 그 뒤의 확장까지 막혔다. 30초 넘게 막힌 단계면 광물과 상관없이 바꾼다.
    const gasStarved = reserve.gas > 0 && memory.headSince !== undefined && state.time - memory.headSince > 30;
    if (STW_UNITS[unit].gas && record.gas < STW_UNITS[unit].gas + reserve.gas && (record.minerals > 250 || gasStarved)) unit = "zealot";
    const def = STW_UNITS[unit];
    const starving = reserve.hard && record.minerals - def.minerals < reserve.hard;
    // 게이트웨이 셋 중 하나는 아끼는 중에도 계속 소환한다.
    const keepRunning = index < Math.floor(gatewayList.length / 3);
    // 광물을 기다리며 놀고 있는 게이트웨이만 멈춘다(만드는 중이면 그것까지는 끝낸다).
    // 확장을 기다릴 때 커세어 질럿은 스타게이트만 남기고 게이트웨이를 모두 멈춘다. 스타게이트가 광물을 기다리면 첫 게이트웨이만 돌린다.
    const stargateWaiting = persona === "corsair" && stwOwnBuildings(state, side, "stargate", { doneOnly: true }).some((stargate) => stargate.line && !stargate.current);
    // 병력이 안전하지 않으면 멈추지 않는다(생산을 멈춘 채 첫 웨이브를 맞으면 무너진다).
    const desired = (starving && !thin && safe && !keepRunning && !gateway.current) || (reserve.expand && safe && index > 0) || (stargateWaiting && safe && index > 1) ? null : unit;
    if (gateway.line !== desired) stwCommand(state, side, { type: "line", gatewayId: gateway.id, unit: desired });
  });

  // 5. 병력
  manageArmy(state, side, persona, memory, settings, { alert });
}

/** 생산 건물 n개 중 비율 share만큼을 뒤쪽 번호부터 고른다(앞쪽은 주력 유닛). */
function shareOf(index, n, share) {
  return index >= n - Math.round(n * share);
}

const MIX_TYPES = ["zealot", "dragoon", "dark", "archon", "darkArchon", "reaver", "templar", "scout", "corsair", "carrier", "arbiter", "marine", "firebat", "medic", "ghost", "vulture", "tank", "goliath", "wraith",
  "valkyrie", "battlecruiser", "zergling", "hydra", "lurker", "ultra", "mutalisk", "scourge", "guardian", "devourer", "queen", "defiler", "infested"];
const AIR_TYPES = ["scout", "corsair", "carrier", "arbiter", "wraith", "valkyrie", "battlecruiser", "mutalisk", "scourge", "guardian", "devourer"];
const ANTI_AIR_TYPES = ["marine", "ghost", "dragoon", "hydra", "goliath", "archon", "scout", "corsair", "carrier", "arbiter", "wraith", "valkyrie", "battlecruiser", "mutalisk", "scourge", "devourer"];
/** 본 적 병력 중 공중 전투 유닛의 비율. */
function airShare(mix) {
  return mix ? AIR_TYPES.reduce((sum, type) => sum + (mix[type] ?? 0), 0) : 0;
}
/** 본 적 병력 중 공중을 쏠 수 있는 유닛의 비율. 이게 높으면 공중 유닛을 더 띄워 봐야 손해다. */
function antiAirShare(mix) {
  return mix ? ANTI_AIR_TYPES.reduce((sum, type) => sum + (mix[type] ?? 0), 0) : 0;
}

/**
 * 보이는 적 지상 병력 구성(비율). 4기 이상 보였을 때 갱신하고, 그 전에는 마지막으로 본 구성을 쓴다.
 * 같이 공중 전투 유닛의 값(광물 + 가스) 비율도 남긴다(memory.foeAirValue): 캐리어 넷은 질럿 열일곱 사이에서 수로는 19%지만 값으로는 절반이 넘는다.
 */
function foeMix(state, side) {
  const foe = stwOpponent(side);
  const seen = state.units.filter((unit) => unit.side === foe && !STW_UNITS[unit.type].worker && STW_UNITS[unit.type].role !== "support" && stwVisible(state, side, unit.x, unit.y));
  const memory = state.sides[side].ai;
  if (seen.length >= 4) {
    memory.foeMix = Object.fromEntries(MIX_TYPES.map((type) => [type, seen.filter((unit) => unit.type === type).length / seen.length]));
    const value = (unit) => STW_UNITS[unit.type].minerals + STW_UNITS[unit.type].gas;
    const total = seen.reduce((sum, unit) => sum + value(unit), 0);
    memory.foeAirValue = total ? seen.filter((unit) => AIR_TYPES.includes(unit.type)).reduce((sum, unit) => sum + value(unit), 0) / total : 0;
  }
  return memory.foeMix ?? null;
}

/** 적 공중 위협: 본 적 병력 중 공중의 비율(수와 값 중 큰 쪽). 최상급이 정찰로 공중 테크를 봤으면 5분 뒤부터 0.35로 본다. */
function airThreat(state, side) {
  const memory = state.sides[side].ai;
  const expected = memory?.expectAir && state.time > 300 ? 0.35 : 0;
  return Math.max(airShare(foeMix(state, side)), memory?.foeAirValue ?? 0, expected);
}

/**
 * 최상급: 정찰 정보로 상대 전략 꼬리표를 짐작하고(stwIntelTag), 지난 경기에서 그 전략에 확실히 더 잘 싸운 선택이 있으면
 * 5분 전에 한 번 갈아탄다(stwLearnSwitch). 꼬리표마다 미리 대비한다.
 * - 러시: 7분까지 경계 상태로(방어 건물·생산 건물 먼저)
 * - 공중: 5분 뒤부터 공중 위협이 있다고 보고 대공을 갖춘다
 * - 은폐: 5분 뒤부터 탐지기를 갖춘다
 */
function readOpponent(state, side, record, memory) {
  const intel = record.intel;
  if (!intel || intel.time === memory.readIntelAt) return;
  memory.readIntelAt = intel.time;
  const tag = stwIntelTag(intel, state.time);
  memory.readTag = tag;
  if (tag === "rush") memory.alertUntil = Math.max(memory.alertUntil ?? 0, 420);
  if (tag === "air") memory.expectAir = true;
  if (tag === "cloak") memory.expectCloak = true;
  if (memory.readSwitch || state.time >= 300) return;
  const foeRace = state.sides[stwOpponent(side)].race;
  const current = record.plan ? `plan:${record.plan.id}` : record.persona;
  const pick = stwLearnSwitch(state.learned, record.race, foeRace, tag, current, state.map);
  if (!pick) return;
  memory.readSwitch = { from: current, to: pick.key, tag, at: state.time };
  record.persona = pick.persona;
  if (pick.plan) record.plan = JSON.parse(JSON.stringify(pick.plan));
  else delete record.plan;
  memory.done = [];
  memory.built = [];
}

/** 테란이 대공을 갖춰야 하는지: 공중 위협이 30%를 넘거나 최근 2분 30초 안에 공중 유닛에게 맞았다. */
function terranAirHeavy(state, side) {
  const record = state.sides[side];
  return airThreat(state, side) > 0.3 || (record.sawAirAt !== undefined && state.time - record.sawAirAt < 150);
}

/**
 * 프로토스 대응: 적 구성을 보고 질럿 비율과 스톰 필요 여부를 정한다.
 * 소형 보병·저글링·히드라가 많으면 질럿과 스톰, 벌처·탱크처럼 진동형·폭발형 차량이 많으면 드라군.
 */
function protossCounter(state, side) {
  const mix = foeMix(state, side);
  if (!mix) return null;
  const swarm = mix.zergling + mix.hydra;
  const bio = mix.marine + mix.firebat + mix.medic;
  const vehicles = mix.vulture + mix.tank;
  // 공중이 많으면 드라군 위주(질럿은 공중을 못 때린다).
  if (airThreat(state, side) > 0.3) return { zealotShare: 0.15, storm: false };
  if (vehicles > 0.5) return { zealotShare: 0.15, storm: false };
  if (bio > 0.6) return { zealotShare: 0.55, storm: true };
  if (swarm > 0.6) return { zealotShare: 0.3, storm: mix.hydra > 0.4 };
  if (mix.ultra + mix.lurker > 0.25) return { zealotShare: 0.2, storm: false };
  return null;
}

function terranLines(state, side, persona, units, reserve) {
  const record = state.sides[side];
  const count = (type) => units.filter((unit) => unit.type === type).length;
  const marines = count("marine");
  const medics = count("medic");
  const academy = stwHas(state, side, "academy");
  const shop = stwHas(state, side, "shop");
  const versusZerg = state.sides[stwOpponent(side)].race === "zerg";
  const bioLike = persona === "bio" || persona === "tankbio";
  // 상대 구성 대응: 소형 근접(질럿·저글링)이 많으면 파이어뱃·벌처, 대형(드라군·리버)·히드라가 많으면 시즈 탱크.
  const mix = foeMix(state, side);
  const meleeHeavy = mix && mix.zealot + mix.dark + mix.zergling + mix.ultra > 0.5;
  const armoredHeavy = mix && mix.dragoon + mix.reaver + mix.hydra + mix.lurker > 0.45;
  const airHeavy = terranAirHeavy(state, side);
  // 적 병력 값의 절반 넘게 공중(캐리어·배틀크루저 함대)이면 팩토리를 모두 골리앗으로, 메카닉 배럭도 쉬지 않고 해병을 뽑는다.
  const airDominant = airThreat(state, side) > 0.5;
  const armory = stwHas(state, side, "armory");
  stwOwnBuildings(state, side, "barracks").sort((a, b) => a.id - b.id).forEach((barracks, index) => {
    let unit = "marine";
    // 저그 상대로는 저글링에 강한 파이어뱃을 더 섞는다. 공중이 많으면 파이어뱃 대신 해병.
    if (academy && bioLike) unit = medics * 4 < marines ? "medic" : !airHeavy && index % (versusZerg || meleeHeavy ? 3 : 4) === (versusZerg || meleeHeavy ? 2 : 3) ? "firebat" : "marine";
    // 메카닉 성향은 배럭을 광물이 남을 때만 돌린다.
    if ((persona === "mech" || persona === "vulture" || persona === "wraith" || persona === "bc") && units.length > 10 && record.minerals < 300 && !airDominant) unit = null;
    // 락다운을 연구했으면 배럭 하나는 고스트(셋까지): 드라군·리버·캐리어 같은 기계 유닛을 묶는다.
    if (index === 0 && stwResearchDone(state, side, "lockdown") && count("ghost") < 3) unit = "ghost";
    if (unit && STW_UNITS[unit].gas && record.gas < STW_UNITS[unit].gas + reserve.gas) unit = "marine";
    const starving = unit && reserve.hard && record.minerals - STW_UNITS[unit].minerals < reserve.hard && units.length >= 3 && reserve.safe;
    // 광물을 기다리며 놀고 있는 배럭만 멈춘다(만드는 중이면 그것까지는 끝낸다). 병력이 안전하지 않으면 멈추지 않는다.
    const desired = (starving && !barracks.current) || (reserve.expand && reserve.safe && index > 0) ? null : unit;
    if (barracks.line !== desired) stwCommand(state, side, { type: "line", buildingId: barracks.id, unit: desired });
  });
  stwOwnBuildings(state, side, "factory").sort((a, b) => a.id - b.id).forEach((factory, index) => {
    let unit = null;
    if (persona === "mech" || persona === "wraith" || persona === "bc") unit = shop && (index % 2 === 0 || count("vulture") >= (versusZerg ? 8 : 4)) ? "tank" : "vulture";
    // 벌처 러시: 벌처 위주, 시즈 모드가 끝나면 팩토리 셋 중 하나는 탱크.
    // 벌처 러시: 머신 샵이 서면 팩토리 둘 중 하나는 탱크(완벽한 카이팅이 사라진 뒤 벌처만으로는 못 민다).
    else if (persona === "vulture") unit = shop && index % 2 === 1 ? "tank" : "vulture";
    else if (shop) unit = meleeHeavy && index % 2 === 1 ? "vulture" : "tank";
    else if (meleeHeavy) unit = "vulture";
    // 대형 상대로는 벌처 대신 탱크를 늘린다.
    if (armoredHeavy && shop && unit === "vulture" && index % 2 === 0) unit = "tank";
    // 공중이 많으면 팩토리 절반은 골리앗(아머리가 없으면 먼저 짓는다).
    if (airHeavy) {
      if (!armory) {
        if (!stwOwnBuildings(state, side, "armory").length) stwCommand(state, side, { type: "build", building: "armory" });
      } else if (airDominant || index % 2 === 0 || unit === null) unit = "goliath";
    }
    // 가스가 모자라 탱크를 못 뽑으면 벌처(레이스 메카닉도: 예전에는 팩토리가 가스를 기다리며 경기당 몇 분씩 놀았다).
    if (unit === "tank" && record.gas < STW_UNITS.tank.gas + reserve.gas) unit = persona === "mech" || persona === "vulture" || persona === "bc" || persona === "wraith" ? "vulture" : null;
    if (unit === "goliath" && record.gas < STW_UNITS.goliath.gas + reserve.gas) unit = "vulture";
    if (reserve.expand && reserve.safe && index > 0) unit = null;
    if (factory.line !== unit) stwCommand(state, side, { type: "line", buildingId: factory.id, unit });
  });
  // 스타포트: 레이스 메카닉은 레이스를 계속, 다른 성향은 가스가 남을 때만.
  const wraiths = count("wraith");
  const science = stwHas(state, side, "science");
  stwOwnBuildings(state, side, "starport", { doneOnly: true }).sort((a, b) => a.id - b.id).forEach((starport, index) => {
    // 상대가 대공 위주면 레이스는 3기에서 그치고 가스를 탱크에 쓴다.
    let unit = (persona === "wraith" && wraiths < (antiAirShare(mix) > 0.5 ? 3 : 6)) || (record.gas > 400 && wraiths < 4) ? "wraith" : null;
    // 배틀크루저: 사이언스 퍼실리티가 서면 배틀크루저만.
    if (persona === "bc") unit = science ? "battlecruiser" : null;
    // 바이오닉·탱크 바이오는 사이언스 베슬 둘(이레디에이트·EMP·탐지).
    else if ((persona === "bio" || persona === "tankbio") && science && count("vessel") < 2) unit = "vessel";
    // 레이스 메카닉은 8분 뒤 드랍십 하나로 본진 침투를 노린다.
    else if (persona === "wraith" && state.time > 360 && !count("dropship") && index === 0) unit = "dropship";
    // 탱크 바이오는 7분 뒤 폭탄 드랍용 드랍십 둘(베슬보다 먼저).
    if (persona === "tankbio" && state.time > 420 && count("dropship") < 2) unit = "dropship";
    // 적 공중이 많으면 아머리가 있을 때 발키리를 섞는다.
    if (airHeavy && stwHas(state, side, "armory") && count("valkyrie") < 4 && (index === 1 || unit === null)) unit = "valkyrie";
    // 레이스·배틀크루저는 그 성향의 핵심이라 연구용 가스보다 먼저 만든다.
    const core = persona === "wraith" || persona === "bc";
    if (unit && !core && record.gas < STW_UNITS[unit].gas + reserve.gas && record.minerals < 400) unit = null;
    if (unit && !core && reserve.safe && ((reserve.hard && record.minerals - STW_UNITS[unit].minerals < reserve.hard && !starport.current) || reserve.expand)) unit = null;
    if (starport.line !== unit) stwCommand(state, side, { type: "line", buildingId: starport.id, unit });
  });
}

/** 지금 아껴 둘 상위 유닛(저그 울트라리스크·럴커). */
function signatureUnit(state, side, persona) {
  const record = state.sides[side];
  const units = state.units.filter((unit) => unit.side === side);
  const count = (type) => units.filter((unit) => unit.type === type).length;
  const army = units.filter((unit) => !STW_UNITS[unit.type].worker).length;
  // 캐리어 함대·배틀크루저: 함선을 만들 수 있게 되면 가스를 먼저 그쪽에 모은다(드라군·탱크 대신 질럿·벌처).
  if (persona === "carrier" && stwHas(state, side, "beacon") && count("carrier") < 8) return "carrier";
  if (persona === "bc" && stwHas(state, side, "science") && count("battlecruiser") < 8) return "battlecruiser";
  if (record.race !== "zerg") return null;
  // 디파일러 하이브: 디파일러 둘, 그 뒤 가디언.
  if (stwHas(state, side, "mound") && count("defiler") < 2) return "defiler";
  if ((persona === "muta" || persona === "hive") && stwResearchDone(state, side, "greaterSpire") && count("guardian") < 6) return "guardian";
  if (stwHas(state, side, "cavern") && count("ultra") * (persona === "ultra" ? 4 : 6) < army) return "ultra";
  if (record.research.lurkerAspect === "done" && count("lurker") * 3 < count("hydra")) return "lurker";
  return null;
}

/** 성향별 저글링 비율(나머지는 히드라). 덴이 없으면 모두 저글링. */
function baseLingShare(state, side, persona) {
  const versusTerran = state.sides[stwOpponent(side)].race === "terran";
  if (persona === "ling") return 1;
  if (persona === "pool") return state.time > 480 ? 0.75 : 1;
  if (persona === "hydra" || persona === "hive") return versusTerran ? 0.5 : 0.33;
  return 0.5;
}

function zergLines(state, side, persona, units, reserve) {
  const record = state.sides[side];
  const count = (type) => units.filter((unit) => unit.type === type).length;
  const hydras = count("hydra");
  const army = units.filter((unit) => !STW_UNITS[unit.type].worker).length;
  const den = stwHas(state, side, "den");
  const lurkers = record.research.lurkerAspect === "done";
  const cavern = stwHas(state, side, "cavern");
  const spire = stwHas(state, side, "spire");
  const greater = stwResearchDone(state, side, "greaterSpire");
  const mix = foeMix(state, side);
  const foeAir = state.units.filter((unit) => unit.side === stwOpponent(side) && STW_UNITS[unit.type].flying && STW_UNITS[unit.type].role !== "support").length;
  const airHeavy = airThreat(state, side) > 0.3 || (record.sawAirAt !== undefined && state.time - record.sawAirAt < 150);
  let lingShare = baseLingShare(state, side, persona);
  let lurkerEvery = 4;
  // 공중이 많으면 저글링을 줄이고 히드라(없으면 스커지)로 대공한다.
  if (airHeavy && den) lingShare = Math.min(lingShare, 0.3);
  if (mix && !airHeavy) {
    // 상대 구성 대응: 질럿에는 히드라·럴커, 드라군에는 저글링, 차량에는 히드라, 보병에는 럴커.
    if (mix.zealot + mix.dark + mix.archon > 0.5) {
      lingShare = Math.min(lingShare, 0.25);
      lurkerEvery = 2.5;
    } else if (mix.dragoon + mix.reaver > 0.4) lingShare = Math.max(lingShare, 0.6);
    else if (mix.vulture + mix.tank > 0.5) lingShare = Math.min(lingShare, 0.2);
    else if (mix.marine + mix.medic + mix.firebat > 0.5) lurkerEvery = 2.5;
  }
  const hatcheries = state.buildings.filter((building) => building.side === side && (building.type === "hatchery" || building.type === "hatch")).sort((a, b) => a.id - b.id);
  hatcheries.forEach((hatchery, index) => {
    let unit = den && !shareOf(index, hatcheries.length, lingShare) ? "hydra" : "zergling";
    if (lurkers && count("lurker") * lurkerEvery < hydras) unit = "lurker";
    else if (cavern && count("ultra") * (persona === "ultra" ? 4 : 6) < army) unit = "ultra";
    // 뮤탈 저글링: 스파이어가 서면 해처리 절반은 뮤탈리스크. 적 공중이 보이면 그 수만큼 스커지(2기씩)를 둔다.
    if (spire && persona === "muta" && index % 2 === 0) unit = "mutalisk";
    if (spire && foeAir > 0 && count("scourge") < foeAir * 1.5 && index % 2 === 1) unit = "scourge";
    // 하이브 테크: 그레이터 스파이어 뒤 뮤탈 저글링·디파일러 하이브는 해처리 셋 중 하나에서 가디언, 적 공중이 많으면 디바우러.
    if (greater && (persona === "muta" || persona === "hive") && index % 3 === 0) unit = "guardian";
    if (greater && airHeavy && count("devourer") < 4 && index % 3 === 1) unit = "devourer";
    // 디파일러 마운드가 서면 디파일러 둘, 디파일러 하이브는 퀸의 둥지에서 퀸 하나.
    if (stwHas(state, side, "mound") && count("defiler") < 2 && index === 1) unit = "defiler";
    if (persona === "hive" && stwHas(state, side, "nest") && stwResearchDone(state, side, "ensnare") && count("queen") < 1 && index === 2) unit = "queen";
    // 히드라는 주력이라 초반(6분 전)에는 연구용 가스를 절반만 아끼고 만든다. 그 뒤에는 상위 테크를 위해 다 아낀다. 상위 유닛은 연구보다 먼저 만든다.
    const gasFor = (type) => STW_UNITS[type].gas + (["lurker", "ultra", "mutalisk", "scourge", "guardian", "devourer", "defiler", "queen"].includes(type) ? 0 : type === "hydra" && state.time < 360 ? reserve.gas / 2 : reserve.gas);
    // 가스가 모자란 상위 유닛 대신에는 저글링(가스 0)을 뽑아 가스를 모은다. 럴커만 히드라로 바꾼다.
    // 예전에는 울트라리스크 대신 히드라(가스 25)를 뽑아 가스가 200에 영영 닿지 않았다(동굴이 7분 42초에 서고도 울트라 0기).
    if (STW_UNITS[unit].gas && record.gas < gasFor(unit)) unit = unit === "lurker" && den ? "hydra" : "zergling";
    if (unit === "zergling" && (airHeavy || mix?.wraith > 0.2) && !den && spire && record.gas >= 75) unit = "scourge";
    if (STW_UNITS[unit].gas && record.gas < gasFor(unit)) unit = "zergling";
    const starving = reserve.hard && record.minerals - STW_UNITS[unit].minerals < reserve.hard && army >= 4 && reserve.safe;
    // 본진 해처리는 아끼는 중에도 계속 변태시킨다. 저글링 물량은 나머지를 지금 만드는 것까지만 끝내고 멈춘다
    // (저글링은 50이라 해처리가 노는 때가 없어, 노는 해처리만 멈추는 규칙으로는 앞마당·연구 자금이 영영 안 모인다). 다른 성향은 노는 해처리만 멈춘다.
    // 뮤탈 저글링도 예전에는 저글링 물량처럼 멈췄는데, 레어·스파이어를 모으는 5분 30초부터 해처리를 세워 둔 채 병력이 0이 되어 졌다.
    const desired = index > 0 && ((reserve.expand && reserve.safe) || (starving && (persona === "ling" || !hatchery.current))) ? null : unit;
    if (hatchery.line !== desired) stwCommand(state, side, { type: "line", buildingId: hatchery.id, unit: desired });
  });
}

/**
 * 전략 전환. 제대로 모은 물량이 8분 뒤에 두 번(12분 뒤에는 한 번) 막혔으면 그 성향만으로는 안 되는 상대다.
 * 저글링 물량·뮤탈 저글링·커세어 질럿·레이스 메카닉이 SWITCH_TO 표를 따라 갈아탄다. 빌드 순서는 새 성향의 것을 처음부터 따르되
 * 이미 지은 건물·끝난 연구는 건너뛴다. 저글링은 덴·동굴이 설 때까지 계속 나온다.
 */
function switchStrategy(state, side, memory) {
  const record = state.sides[side];
  const from = record.persona;
  if (!SWITCH_TO[from] || memory.switched) return;
  const failed = memory.bigFails ?? 0;
  // 저글링 물량이 5분 넘게 질럿·다크템플러 러시에 눌려 있으면(경계 중, 보이는 적 절반 이상이 그 둘) 큰 물량이 막히기를 기다리지 않고 바로 갈아탄다.
  // 저글링은 질럿에게 손해를 보는 유닛이라 집에서 성큰을 끼고 막아도 웨이브마다 20기씩 녹는다.
  const mix = foeMix(state, side) ?? {};
  const pressured = from === "ling" && state.time >= 300 && (memory.alertUntil ?? 0) > state.time && (mix.zealot ?? 0) + (mix.dark ?? 0) >= 0.5;
  if (pressured) {
    memory.switched = { from, to: SWITCH_TO[from](mix), at: state.time };
    memory.done = [];
    memory.built = [];
    record.persona = memory.switched.to;
    delete record.plan;
    return;
  }
  // 공중 성향은 스타게이트·스타포트·스파이어가 서고 주력이 나와 본 뒤(11분)에야 갈아탄다. 그 전의 실패는 테크를 올리는 중의 일이다.
  const since = SWITCH_AFTER[from] ?? 480;
  // 빠른 저글링은 한 번 막히면 바로 갈아탄다.
  if (state.time < since || failed < (from === "pool" || state.time >= since + 240 ? 1 : 2)) return;
  const next = SWITCH_TO[from](foeMix(state, side) ?? {});
  memory.switched = { from, to: next, at: state.time };
  memory.done = [];
  memory.built = [];
  memory.wave = Math.max(0, memory.wave - 2);
  record.persona = next;
  delete record.plan;
}

/** 전략 전환 표: 큰 물량이 거듭 막힌 성향이 상대 구성을 보고 갈아타는 곳. 공중 성향은 대공이 두꺼운 상대에게 지상 운영으로 돌아선다. */
const SWITCH_TO = {
  // 빠른 저글링: 첫 웨이브가 막히면 바로 운영으로 넘어간다(그대로 두면 일꾼 14기에 묶여 7분 안에 40%를 졌다).
  pool: (mix) => ((mix.zealot ?? 0) + (mix.dark ?? 0) + (mix.marine ?? 0) + (mix.medic ?? 0) + (mix.firebat ?? 0) + (mix.vulture ?? 0) + (mix.tank ?? 0) > 0.5 ? "hydra" : "ling"),
  ling: (mix) => ((mix.vulture ?? 0) + (mix.tank ?? 0) + (mix.firebat ?? 0) > 0.4 ? "ultra" : "hydra"),
  muta: (mix) => ((mix.vulture ?? 0) + (mix.tank ?? 0) + (mix.goliath ?? 0) > 0.4 ? "ultra" : "hydra"),
  corsair: (mix) => ((mix.marine ?? 0) + (mix.medic ?? 0) + (mix.zergling ?? 0) + (mix.hydra ?? 0) > 0.5 ? "templar" : "dragoon"),
  wraith: (mix) => ((mix.dragoon ?? 0) + (mix.hydra ?? 0) + (mix.goliath ?? 0) > 0.4 ? "mech" : "tankbio"),
};
/** 전략 전환 판단에 세는 "제대로 모은 물량"의 크기와, 전환을 생각하기 시작하는 시각(초). */
/** 출격 규모를 셀 때 저글링을 반 기로 치는 성향(저글링이 주력이 아닌 저그 운영). */
const HALF_LING = new Set(["hydra", "hive", "ultra", "muta"]);
const BIG_WAVE = { pool: 6, ling: 24, muta: 14, corsair: 12, wraith: 12 };
const SWITCH_AFTER = { pool: 0, ling: 480, muta: 660, corsair: 660, wraith: 660 };

/**
 * 위협 판단. 다음 중 하나면 경계 상태(memory.alertUntil)로 들어간다.
 * - 정찰 정보에서 적 생산 건물이 3개 이상인데 6분 전(이른 러시 조짐) → 7분까지
 * - 적 전투 유닛 3기 이상이 자기 진영 절반 안에 보임 → 45초
 * - 자기 건물이 최근 10초 안에 맞음 → 45초
 */
function assessThreat(state, side, memory) {
  // 경계 태세는 초반 러시 방어용이다. 10분이 지나면 평소 규칙(위협 시 후퇴, 출격 규모)만 쓴다.
  if (state.time >= 600) return false;
  const record = state.sides[side];
  const foe = stwOpponent(side);
  const foeRace = STW_RACES[state.sides[foe].race ?? "protoss"];
  let until = memory.alertUntil ?? 0;
  if (record.intel && state.time - record.intel.time < 120 && state.time < 360) {
    const producers = foeRace.producers.reduce((sum, type) => sum + (record.intel.buildings[type] ?? 0), 0) + (foeRace.id === "zerg" ? (record.intel.buildings.hatchery ?? 0) - 1 : 0);
    const gasBuildings = record.intel.buildings[foeRace.refinery] ?? 0;
    // 생산 건물 3개 이상, 또는 가스 없이 생산 건물 2개(테크를 버린 물량 러시) → 8분까지 경계.
    if (producers >= 3 || (producers >= 2 && gasBuildings === 0)) until = Math.max(until, 480);
  }
  const ownHalf = (y) => (side === "player" ? y > 50 : y < 50);
  const intruders = state.units.filter((unit) => unit.side === foe && !STW_UNITS[unit.type].worker && STW_UNITS[unit.type].role !== "support" && ownHalf(unit.y) && stwVisible(state, side, unit.x, unit.y)).length;
  if (intruders >= 3) until = Math.max(until, state.time + 45);
  if (state.buildings.some((building) => building.side === side && state.time - building.lastHit < 10)) until = Math.max(until, state.time + 45);
  memory.alertUntil = until;
  return state.time < until;
}

/**
 * 적 전투 병력 짐작: 최근 90초 동안 한 번에 본 가장 많은 수와, 정찰 때 센 병력에 그 뒤 생산 건물이 뽑았을 만큼(20초에 하나)을 더한 값 중 큰 쪽.
 * 보이는 적만 세면 적 본진에 모여 있는 러시 병력을 모른 채 출격해 길에서 맞붙는다.
 * power는 우리 병력의 평균 방어력(ownArmor)을 뺀 화력으로, armor는 적 한 기의 평균 방어력이다(우리 전투력을 셀 때 쓴다).
 */
/**
 * 지금 보이는 적 전투 병력을 기억한다: 최근 90초 동안 한 번에 본 가장 많은 수(peakFoe)와 그 구성(foeTypes).
 * 생각할 때마다 부른다. 예전에는 경계 중에만 갱신해서, 경계가 아닐 때의 출격 판단이 오래된(또는 빈) 기억을 썼다.
 */
function trackFoe(state, side, memory) {
  const foe = stwOpponent(side);
  const visible = state.units.filter((unit) => unit.side === foe && !STW_UNITS[unit.type].worker && STW_UNITS[unit.type].role !== "support" && stwVisible(state, side, unit.x, unit.y));
  if (visible.length >= (memory.peakFoe ?? 0) || state.time - (memory.peakFoeAt ?? 0) > 90) {
    memory.peakFoe = visible.length;
    memory.peakFoeAt = state.time;
    if (visible.length) memory.peakTypes = visible.map((unit) => unit.type);
  }
  return visible;
}

function foeArmyEstimate(state, side, memory, ownArmor = 0) {
  const record = state.sides[side];
  const foe = stwOpponent(side);
  const foeRace = STW_RACES[state.sides[foe].race ?? "protoss"];
  const visible = trackFoe(state, side, memory);
  // 적 병력 구성: 지금 보이는 적, 없으면 정찰 때 본 적, 그것도 없으면 마지막으로 본 구성이나 그 종족의 기본 유닛.
  const intel = record.intel && state.time - record.intel.time < 180 ? record.intel : null;
  const mix = visible.length ? visible.map((unit) => unit.type) : Object.entries(intel?.units ?? {}).flatMap(([type, count]) => (STW_UNITS[type] && STW_UNITS[type].role !== "support" ? Array(count).fill(type) : []));
  if (mix.length) memory.foeTypes = mix;
  const types = memory.foeTypes ?? [FIRST_UNIT[foeRace.id]];
  const each = types.reduce((sum, type) => sum + unitPower(type, ownArmor), 0) / types.length;
  const armor = types.reduce((sum, type) => sum + STW_UNITS[type].armor, 0) / types.length;
  // 정찰 뒤 생산 건물이 뽑았을 만큼을 더하고, 그 뒤 우리가 잡은 적만큼 뺀다. 오래된 정찰이라도 버리지 않는다(버리면 웨이브 하나만 보고 적 본진의 병력을 잊는다).
  let count = memory.peakFoe;
  const scouted = record.intel;
  if (scouted) {
    if (memory.intelAt !== scouted.time) {
      memory.intelAt = scouted.time;
      memory.killsAtIntel = record.stats.kills;
    }
    const fighters = Object.entries(scouted.units ?? {}).reduce((sum, [type, n]) => sum + (STW_UNITS[type] && STW_UNITS[type].role !== "support" ? n : 0), 0);
    const producers = foeRace.producers.reduce((sum, type) => sum + (scouted.buildings[type] ?? 0), 0);
    const killed = record.stats.kills - memory.killsAtIntel;
    count = Math.max(count, fighters + (producers * (state.time - scouted.time)) / 20 - killed);
  }
  return { count, power: count * each, armor };
}

/** 적 전투 병력 3기 이상이 우리 진영 절반 안에 보이는지(들어오는 웨이브). */
function incomingWave(state, side) {
  const foe = stwOpponent(side);
  const ownHalf = (y) => (side === "player" ? y > 50 : y < 50);
  return state.units.filter((unit) => unit.side === foe && !STW_UNITS[unit.type].worker && STW_UNITS[unit.type].role !== "support" && ownHalf(unit.y) && stwVisible(state, side, unit.x, unit.y)).length >= 3;
}

/** 종족의 첫 전투 유닛(적 병력 구성을 모를 때 쓴다). */
const FIRST_UNIT = { protoss: "zealot", terran: "marine", zerg: "zergling" };

/**
 * 한 기의 전투력: √(초당 피해 × 체력·보호막). 란체스터 제곱 법칙에서 병력의 힘은 (Σ√(화력×체력))²이므로 합으로 비교할 수 있다.
 * 화력은 상대 방어력(targetArmor)을 뺀 값이다. 저글링(공격력 5)은 방어력 1인 질럿에게 20% 덜 들어간다.
 * 해병(√(8×45) ≈ 19)은 질럿(√(14.5×160) ≈ 48)의 약 0.4다. 무기 없는 유닛(메딕 등)은 화력 2로 친다.
 */
function unitPower(type, targetArmor = 0, own = false) {
  const def = STW_UNITS[type];
  const dps = def.damage ? (Math.max(0.5, def.damage - targetArmor) * (def.hits ?? 1)) / def.cooldown : 2;
  return Math.sqrt(Math.max(2, dps) * (def.hp + def.shields)) * (own ? MELEE_DISCOUNT[type] ?? 1 : 1);
}

/**
 * 우리 병력으로 쳐들어갈 때 공식보다 약한 근접 유닛의 보정. 저글링은 몸이 작고 체력이 낮아 사거리 유닛에게 다가가는 동안 많이 녹는다.
 * 실측: 저글링 16기는 해병 7기에게 지고 24기는 이긴다(공식대로면 16기가 해병 13기 몫이라, 저그 AI가 4분에 저글링 16기를 해병에 던져 잃었다).
 * 상대 저글링을 셀 때는 쓰지 않는다: 막는 쪽의 저글링은 그대로 세다(프로토스가 저글링을 얕보고 질럿 7기로 저글링 21기에 들이받았다).
 */
const MELEE_DISCOUNT = { zergling: 0.55 };

/** 우리 병력의 전투력(discount면 쳐들어갈 때의 보정을 넣는다). */
function armyPower(units, targetArmor = 0, discount = true) {
  return units.reduce((sum, unit) => sum + unitPower(unit.type, targetArmor, discount), 0);
}

/**
 * 본 적 방어 건물의 힘: 한 개마다 √(초당 피해 × 체력·보호막) × 1.5. 방어 건물은 사거리가 길고 병력이 그 뒤에서 함께 싸우므로 유닛보다 무겁게 친다.
 * 포톤 캐논은 약 85(질럿 1.8기 몫)다.
 */
function defensePower(state, side) {
  return Object.values(state.sides[side].seen ?? {}).reduce((sum, item) => {
    const def = STW_BUILDINGS[item.type];
    if (!def?.damage || !def.defense) return sum;
    const dps = (def.damage * (def.hits ?? 1)) / (def.cooldown ?? 1);
    return sum + Math.sqrt(dps * (def.hp + def.shields)) * 1.5;
  }, 0);
}

/** 최근 90초 안에 한 번에 본 가장 많은 적 전투 병력의 힘(정찰로 짐작한 생산량은 더하지 않는다). */
function seenFoePower(state, side, memory) {
  const types = memory.peakTypes ?? memory.foeTypes ?? [];
  if (!types.length || !memory.peakFoe) return 0;
  const each = types.reduce((sum, type) => sum + unitPower(type), 0) / types.length;
  return memory.peakFoe * each;
}

/**
 * 경계 중에 늘리는 생산 건물: 성향의 추가 생산 건물(메카닉의 팩토리 등)이 가스를 먹는데 가스가 모자라면 광물만 드는 기본 생산 건물(배럭·게이트웨이).
 * 가스가 모자라 팩토리를 못 짓는 동안 광물이 500 넘게 쌓인 채 러시를 맞던 문제. 가스가 있으면 그대로 짓는다(벌처는 질럿에 강하다).
 */
function alertProducerFor(state, side, race, persona) {
  const extra = EXTRA_PRODUCER[persona] ?? race.mainProducer;
  return STW_BUILDINGS[extra].gas > state.sides[side].gas ? race.mainProducer : extra;
}

/** 방어 건물을 count개까지 갖춘다. 프로토스는 포지, 저그는 스포닝 풀, 테란은 배럭이 먼저 있어야 한다. */
function ensureDefense(state, side, race, count) {
  const defense = race.id === "protoss" ? "cannon" : race.id === "terran" ? "bunker" : "sunken";
  const prerequisite = STW_BUILDINGS[defense].requires;
  if (prerequisite && !stwHas(state, side, prerequisite)) {
    if (stwOwnBuildings(state, side, prerequisite).length) return null;
    const result = stwCommand(state, side, { type: "build", building: prerequisite });
    return result.ok ? null : STW_BUILDINGS[prerequisite];
  }
  if (stwOwnBuildings(state, side, defense).length >= count) return null;
  const result = stwCommand(state, side, { type: "build", building: defense });
  return result.ok ? null : STW_BUILDINGS[defense];
}

function manageArmy(state, side, persona, memory, settings, { holdHome = false, alert = false } = {}) {
  const record = state.sides[side];
  // 경계 중이고 앞마당이 없으면 방어 건물 뒤(본진 안쪽, 아군 기준 84)에 모여 싸운다. 방어 건물은 앞줄 가운데(적이 들어오는 길목)에 서므로,
  // 들어온 근접 유닛은 가장 가까운 위협인 방어 건물부터 치고, 병력은 그 뒤에서 쏜다. 앞에 나가 서 있으면 해병·드라군이 질럿에게 먼저 잡힌다.
  const natural = stwNexus(state, side, "natural");
  if (alert && !natural) {
    const back = stwMap(state).rallyRange.max;
    if (record.rally !== back) stwCommand(state, side, { type: "move", y: back });
  } else {
    const desiredRally = natural || (memory.clearNatural && stwArmy(state, side).fighters.length >= 4) ? "natural" : "main";
    if (record.rally !== desiredRally) stwCommand(state, side, { type: "rally", point: desiredRally });
  }
  const army = stwArmy(state, side);
  const foe = stwOpponent(side);

  // 게릴라 드랍: 쉬는 수송선이 있고 대기 병력이 6기 이상이면 1분 30초마다 한 분대를 광물 줄로(정면 웨이브와 따로).
  const dropPlan = DROP_PLANS[persona];
  if (dropPlan?.mission === "raid" && army.fighters.length >= 6 && state.time - (memory.lastDrop ?? -999) > 90 && stwDropCheck(state, side, "raid").ok) {
    if (stwCommand(state, side, { type: "drop", ...dropPlan }).ok) memory.lastDrop = state.time;
  }

  // 본진·앞마당이 공격받으면 공격 병력을 불러들인다.
  const own = ["main", "natural"].map((base) => stwNexus(state, side, base)).filter(Boolean);
  const threat = state.units.filter((unit) => unit.side === foe && !STW_UNITS[unit.type].worker && STW_UNITS[unit.type].role !== "support" && own.some((nexus) => Math.hypot(unit.x - nexus.x, unit.y - nexus.y) < 16)).length;
  if (threat >= 3 && army.attack.length && army.attack.length < threat * 1.5) {
    stwCommand(state, side, { type: "retreat" });
    memory.attacking = false;
    return;
  }

  // 총공격: 광물이 바닥나 더 모을 수 없거나 인구가 거의 찼으면 기다릴 이유가 없다.
  const supply = stwSupply(state, side);
  const allIn = (stwIncome(state, side).minerals < 60 && record.minerals < 100) || supply.used >= 92;

  if (memory.attacking) {
    // 지원 유닛은 세지 않는다. 싸우는 유닛이 출격 때의 35% 아래로 줄면 후퇴.
    if (!army.attackers.length || (!allIn && army.attackers.length < Math.max(1, memory.waveStart * 0.35))) {
      if (army.attack.length) stwCommand(state, side, { type: "retreat" });
      memory.attacking = false;
      memory.wave += 1;
      // 제대로 모은 물량(성향별 기준 이상)이 막힌 횟수. 전략 전환은 이것으로 판단한다.
      if (memory.waveStart >= (BIG_WAVE[persona] ?? 16)) memory.bigFails = (memory.bigFails ?? 0) + 1;
    }
    if (allIn && army.fighters.length >= 4 && army.attackers.length) stwCommand(state, side, { type: "attack" });
    // 저글링 물량은 끊임없이 밀어붙인다: 싸우는 동안 새로 나온 저글링이 12기 모이면 바로 뒤따라 보낸다.
    else if (persona === "ling" && army.fighters.length >= 12 && army.attackers.length) stwCommand(state, side, { type: "attack" });
    return;
  }
  if (holdHome && !allIn) {
    if (army.attack.length) stwCommand(state, side, { type: "retreat" });
    memory.attacking = false;
    return;
  }
  const waves = record.plan?.waves ?? WAVES[persona];
  // 목록이 끝난 뒤에는 실패할 때마다 출격 규모를 4기씩 키운다(최대 40기).
  const listed = waves[Math.min(memory.wave, waves.length - 1)] + Math.max(0, memory.wave - waves.length + 1) * 4;
  // 적 방어 건물(캐논·벙커·성큰)을 본 만큼 더 모아서 간다(하나당 4기, 최대 12기). 방어 건물은 기지 전체를 지키므로 소수로 찔러 봐야 손해다.
  const defenses = Object.values(record.seen).filter((memoryItem) => STW_BUILDINGS[memoryItem.type]?.damage).length;
  let size = allIn ? 1 : Math.round(Math.min(WAVE_CAP[persona] ?? 40, listed + Math.min(12, defenses * 4)) * settings.waveScale);
  // 경계 중에는 짐작한 적 병력보다 전투력이 넉넉히(1.5배) 앞설 때까지 집에서 버틴다(보이지 않는 적 본진의 병력까지 센다).
  // 수로만 세면 해병 16기가 질럿 8기를 이길 줄 알고 나갔다가 열린 곳에서 녹는다.
  // 적 전투 병력이 우리 진영 절반에 보이면(웨이브가 들어오는 중) 나가지 않고 방어 건물 곁에서 먼저 받아친다. 길 한가운데서 맞붙으면 방어 건물이 놀고, 저글링처럼 열린 곳에서 약한 병력은 녹는다.
  const ownArmor = army.fighters.length ? army.fighters.reduce((sum, unit) => sum + STW_UNITS[unit.type].armor, 0) / army.fighters.length : 0;
  const estimate = alert && !allIn ? foeArmyEstimate(state, side, memory, ownArmor) : null;
  const outgunned = estimate !== null && (armyPower(army.fighters, estimate.armor) < estimate.power * 1.5 || incomingWave(state, side));
  // 방어 건물 앞에서는 수가 아니라 힘을 본다: 본 적 방어 건물(캐논·벙커·성큰)의 힘과 최근 본 적 병력의 힘을 더한 것보다
  // 우리 전투력이 커야 나간다. 출격 규모만 보고 캐논 7~8개가 선 앞마당에 들이받아 두 번에 걸쳐 병력을 다 잃었다(사람의 캐논 수비 + 캐리어).
  // 방어 건물을 못 봤어도 같은 규칙으로 본다: 최근 본 적 병력보다 힘이 모자라면 나가지 않는다. 예전에는 방어 건물을 봐야만 따져서,
  // 저그가 4분에 저글링 16기를 해병·메딕에 던져 잃고 무너지는 일이 잦았다(바이오닉이 저그를 100% 이겼다).
  // 저그는 8분 전에 본 병력만으로 판단하지 않는다(정찰 뒤 생산 건물이 더 뽑았다). 경계 때 쓰는 짐작(정찰 + 그 뒤 생산량)과 견줘 큰 쪽을 쓴다.
  // 저글링을 해병·벙커에 던져 잃던 문제(빠른 저글링 승률 8% → 27%, 히드라 50% → 65%). 프로토스·테란에도 쓰면 이른 압박을 못 해
  // 프로토스 성향 평균이 52%에서 44%로 떨어져 저그만 쓴다(평원, 성향마다 다른 종족 상대 24~26판).
  const foeSeen = Math.max(seenFoePower(state, side, memory), !estimate && record.race === "zerg" && persona !== "ling" && state.time < 480 ? foeArmyEstimate(state, side, memory).power : 0);
  // 저글링 물량은 쉬지 않고 밀어붙이는 성향이라 예전 규칙(본 방어 건물이 있을 때만, 보정 없이)을 그대로 쓴다.
  // 새 규칙을 쓰면 너무 망설여 승률이 50%에서 29%(협곡·황금 앞마당 13%)로 떨어졌다.
  const fortified = persona === "ling"
    ? !allIn && !estimate && defensePower(state, side) > 0 && armyPower(army.fighters, 0, false) < (defensePower(state, side) + seenFoePower(state, side, memory)) * 1.1
    : !allIn && !estimate && armyPower(army.fighters) < (defensePower(state, side) + foeSeen) * 1.1;
  // 기지에 적이 3기 이상 들어와 있으면 나가지 않고 집에서 받아친다. 총공격 조건(광물 바닥)과 기지 방어(후퇴)가 번갈아 걸려
  // 2초마다 공격·후퇴를 오가며 병력이 길에서 녹던 문제.
  // 히드라·하이브·울트라·뮤탈 운영은 저글링을 반 기로 센다(인구 0.5). 그대로 세면 "14기"가 저글링 14기라 4분에 저글링만으로 나갔다.
  const fighterCount = HALF_LING.has(persona) ? army.fighters.reduce((sum, unit) => sum + (unit.type === "zergling" ? 0.5 : 1), 0) : army.fighters.length;
  if (fighterCount >= size && !outgunned && !fortified && threat < 3) {
    // 폭탄 드랍 성향은 쉬는 수송선이 둘 이상이면 출격과 동시에 폭탄 드랍(남은 병력은 정면으로).
    if (dropPlan?.mission === "bomb" && stwDropCheck(state, side, "bomb").ok) stwCommand(state, side, { type: "drop", ...dropPlan });
    else stwCommand(state, side, { type: "attack" });
    keepHomeGuard(state, side, record);
    memory.attacking = true;
    memory.waveStart = stwArmy(state, side).attackers.length;
  }
}

/** 상대에게 수송선이 있으면(최근 5분 안에 봤거나 드랍을 맞았으면) 출격할 때 대기 병력 4기를 집에 남긴다. AI만 쓴다. */
function keepHomeGuard(state, side, record) {
  if (record.sawTransportAt === undefined || state.time - record.sawTransportAt > 300) return;
  const attackers = stwArmy(state, side).attackers;
  if (attackers.length < 8) return;
  // 원거리·대공 유닛을 먼저 남긴다(수송선과 내린 병력을 함께 막도록).
  const guards = [...attackers].sort((a, b) => Number(STW_UNITS[b.type].targets === "both") - Number(STW_UNITS[a.type].targets === "both") || STW_UNITS[a.type].minerals - STW_UNITS[b.type].minerals).slice(0, 4);
  for (const unit of guards) unit.group = "rally";
}
