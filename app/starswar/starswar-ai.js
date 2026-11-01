// 스타즈워 AI. 플레이어와 같은 stwCommand만 쓴다.
// 성향마다 빌드 순서와 출격 규모가 다르다. 프로토스·테란·저그가 같은 틀을 쓴다.
import { STW_BUILDINGS, STW_DIFFICULTIES, STW_RACES, STW_RESEARCH, STW_UNITS } from "./starswar-data.js";
import {
  stwArmy,
  stwBuildCheck,
  stwCommand,
  stwDone,
  stwHas,
  stwIncome,
  stwNexus,
  stwOpponent,
  stwOwnBuildings,
  stwResearchCheck,
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
    { build: "forge" }, { research: "weapons1" }, { build: "gateway" }, { build: "citadel" }, { research: "charge" }, { research: "armor1" },
  ],
  templar: [
    { build: "pylon" }, { build: "gateway" }, { build: "assimilator" }, { build: "core" }, { build: "pylon" },
    { build: "gateway" }, { build: "assimilator" }, { build: "citadel" }, { build: "archives" }, { research: "storm" },
    { build: "forge" }, { research: "weapons1" }, { build: "expand", at: 300 }, { build: "gateway" }, { research: "charge" }, { build: "gateway" },
  ],
  dark: [
    { build: "pylon" }, { build: "gateway" }, { build: "assimilator" }, { build: "core" }, { build: "pylon" },
    { build: "assimilator" }, { build: "citadel" }, { build: "archives" }, { build: "gateway" }, { build: "pylon" },
    { build: "forge" }, { build: "expand", at: 330 }, { build: "gateway" }, { research: "weapons1" }, { research: "charge" },
  ],
  robo: [
    { build: "pylon" }, { build: "gateway" }, { build: "assimilator" }, { build: "core" }, { build: "pylon" },
    { build: "assimilator" }, { build: "gateway" }, { research: "range" }, { build: "robo" }, { build: "bay" },
    { build: "expand", at: 260 }, { build: "gateway" }, { build: "forge" }, { research: "weapons1" }, { research: "scarab" }, { build: "gateway" },
  ],
  bio: [
    { build: "depot" }, { build: "barracks" }, { build: "barracks" }, { build: "refinery" }, { build: "depot" },
    { build: "academy" }, { build: "barracks" }, { research: "stim" }, { build: "ebay" }, { research: "infWeapons1" },
    { build: "expand", at: 300 }, { research: "u238" }, { build: "comsat" }, { build: "refinery" }, { research: "infArmor1" }, { build: "barracks" },
  ],
  mech: [
    { build: "depot" }, { build: "barracks" }, { build: "refinery" }, { build: "depot" }, { build: "factory" },
    { build: "refinery" }, { build: "shop" }, { build: "bunker" }, { research: "siege" }, { build: "factory" },
    { build: "expand", at: 280 }, { build: "academy" }, { research: "ion" }, { build: "comsat" }, { build: "ebay" }, { build: "turret" },
  ],
  tankbio: [
    { build: "depot" }, { build: "barracks" }, { build: "refinery" }, { build: "barracks" }, { build: "depot" },
    { build: "academy" }, { build: "factory" }, { research: "stim" }, { build: "shop" }, { research: "siege" },
    { build: "expand", at: 300 }, { build: "barracks" }, { build: "ebay" }, { research: "infWeapons1" }, { research: "u238" }, { build: "comsat" }, { build: "refinery" },
  ],
  vulture: [
    { build: "depot" }, { build: "barracks" }, { build: "refinery" }, { build: "factory" }, { build: "depot" },
    { build: "factory" }, { build: "refinery" }, { build: "shop" }, { research: "ion" }, { research: "siege" },
    { build: "expand", at: 320 }, { build: "factory" }, { build: "academy" }, { build: "comsat" }, { build: "ebay" }, { build: "turret" },
  ],
  pool: [
    { build: "pool" }, { build: "overlord" }, { build: "extractor" }, { research: "metabolic" }, { build: "hatch" },
    { build: "overlord" }, { build: "hatch" }, { build: "evo", at: 300 }, { research: "zMelee1" }, { build: "expand", at: 330 },
    { build: "den" }, { research: "zCarapace1" }, { build: "extractor" },
  ],
  ultra: [
    { build: "overlord" }, { build: "pool" }, { build: "expand", at: 150 }, { build: "extractor" }, { build: "sunken" },
    { build: "overlord" }, { build: "sunken" }, { build: "den" }, { build: "extractor" }, { research: "lair", at: 270 },
    { build: "evo" }, { research: "zMelee1" }, { research: "zCarapace1" }, { build: "cavern" }, { research: "chitin" },
    { research: "metabolic" }, { build: "hatch" }, { research: "zMelee2" },
  ],
  ling: [
    { build: "pool" }, { build: "overlord" }, { build: "extractor" }, { research: "metabolic" }, { build: "hatch" },
    { build: "overlord" }, { build: "evo", at: 220 }, { research: "zMelee1" }, { build: "expand", at: 280 }, { build: "hatch" },
    { build: "den" }, { research: "zCarapace1" }, { build: "extractor" }, { research: "lair" }, { research: "spines" },
  ],
  hydra: [
    { build: "overlord" }, { build: "pool" }, { build: "extractor" }, { build: "hatch" }, { build: "sunken" }, { build: "den" },
    { build: "extractor" }, { build: "overlord" }, { research: "spines" }, { build: "hatch" }, { build: "expand", at: 300 },
    { research: "lair", at: 300 }, { research: "lurkerAspect" }, { build: "evo" }, { research: "zMissile1" }, { research: "augments" },
    { build: "cavern", at: 560 }, { research: "chitin" }, { research: "zCarapace1" },
  ],
};

const WAVES = { rush: [4, 6, 8, 10, 12], dragoon: [8, 12, 16, 20], templar: [10, 14, 18, 22], dark: [3, 6, 10, 14], robo: [10, 14, 18, 22], bio: [8, 12, 16, 22], mech: [8, 12, 16, 20],
  tankbio: [10, 14, 20, 26], vulture: [5, 8, 12, 16, 20], ling: [12, 16, 22, 28, 34], hydra: [14, 18, 24, 30], pool: [6, 10, 14, 20, 26], ultra: [12, 18, 24, 30] };
const GATEWAY_CAP = { rush: 6, dragoon: 6, templar: 5, dark: 4, robo: 4, bio: 6, mech: 4, tankbio: 5, vulture: 4, ling: 3, hydra: 3, pool: 3, ultra: 3 };
/** 빌드 순서가 끝난 뒤 남는 자원으로 더 짓는 생산 건물. */
const EXTRA_PRODUCER = { bio: "barracks", mech: "factory", tankbio: "barracks", vulture: "factory", ling: "hatch", hydra: "hatch", pool: "hatch", ultra: "hatch" };
/** 일꾼을 적게 뽑고 일찍 찌르는 성향: 이 시간(초)까지는 일꾼 수를 제한한다. */
const EARLY_WORKER_CAP = { pool: { until: 210, cap: 14 } };
/** 광물이 크게 쌓이면 성향과 상관없이 늘리는 기본 생산 건물. */
const FALLBACK_PRODUCER = { terran: "barracks", zerg: "hatch" };
const LATE_UPGRADES = { protoss: ["weapons2", "shields1", "armor1"], terran: ["infWeapons2", "infArmor1"], zerg: ["zMelee2", "zMissile2", "zCarapace1"] };
const DEFAULT_PERSONA = { protoss: "dragoon", terran: "bio", zerg: "hydra" };

export function stwAiThink(state, side) {
  const record = state.sides[side];
  const settings = STW_DIFFICULTIES[state.difficulty];
  record.ai ??= { nextThink: 0, step: 0, wave: 0, attacking: false, waveStart: 0 };
  const memory = record.ai;
  if (state.time < memory.nextThink) return;
  memory.nextThink = state.time + settings.thinkEvery;
  const race = STW_RACES[record.race ?? "protoss"];
  const persona = record.persona ?? DEFAULT_PERSONA[race.id];

  // 다음 건물·연구에 필요한 자원만 아껴 둔다(모자란 쪽만).
  const reserve = { minerals: 0, gas: 0 };
  const save = (minerals, gas) => {
    if (record.minerals < minerals) reserve.minerals = Math.max(reserve.minerals, minerals);
    if (record.gas < gas) reserve.gas = Math.max(reserve.gas, gas);
  };
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
  const probeTarget = Math.min(early && state.time < early.until ? early.cap : 44, bases * 16 + gasBuildings * 3);
  const queued = stwOwnBuildings(state, side, race.base).reduce((sum, nexus) => sum + nexus.queue.length, 0);
  if (record.probes + queued < probeTarget && queued < 2 * bases) stwCommand(state, side, { type: "probe" });

  // 2. 인구
  const supply = stwSupply(state, side);
  const gateways = race.producers.reduce((sum, type) => sum + stwOwnBuildings(state, side, type).length, 0);
  const pylonsBuilding = stwOwnBuildings(state, side, race.supply).filter((building) => !stwDone(building)).length;
  if (supply.cap < 100 && supply.used + 3 + gateways * 2 >= supply.cap && pylonsBuilding < (supply.used > 40 ? 2 : 1)) {
    const result = stwCommand(state, side, { type: "build", building: race.supply });
    if (!result.ok && /광물/.test(result.reason ?? "")) save(STW_BUILDINGS[race.supply].minerals, 0);
  }

  // 3. 빌드 순서: 막힌 단계가 있으면 그 자원만 아껴 두고, 남는 자원으로 할 수 있는 다음 단계(최대 4개 앞)를 먼저 한다.
  const order = BUILD_ORDERS[persona];
  memory.done ??= [];
  let blocked = 0;
  for (let index = 0; index < order.length && blocked < 4; index += 1) {
    if (memory.done.includes(index)) continue;
    const step = order[index];
    if (step.at && state.time < step.at * STW_DIFFICULTIES[state.difficulty].waveScale) {
      blocked += 1;
      continue;
    }
    const check = step.build ? stwBuildCheck(state, side, step.build) : stwResearchCheck(state, side, step.research);
    const cost = step.build ? STW_BUILDINGS[step.build === "expand" ? race.base : step.build] : STW_RESEARCH[step.research];
    const fitsReserve = record.minerals - reserve.minerals >= cost.minerals && record.gas - reserve.gas >= cost.gas;
    if (check.ok && ((blocked === 0 && !signature) || fitsReserve)) {
      stwCommand(state, side, step.build ? { type: "build", building: step.build } : { type: "research", research: step.research });
      memory.done.push(index);
      continue;
    }
    // "다른 연구 중"은 건물이 비면 다시 시도해야 하므로 건너뛴 것으로 치지 않는다.
    if (/이미|완료|자리|찼습니다|^연구 중$/.test(check.reason ?? "")) {
      memory.done.push(index);
      continue;
    }
    if (blocked === 0 && /부족/.test(check.reason ?? "")) save(cost.minerals, cost.gas);
    blocked += 1;
  }
  memory.step = memory.done.length;
  const extra = EXTRA_PRODUCER[persona] ?? race.mainProducer;
  // 광물이 남으면 생산 건물을 더 짓는다. 빌드 순서가 끝나기 전이라도 크게 남으면 짓는다.
  // 저그는 해처리 하나가 한 번에 한 마리씩만 만들므로 광물이 쌓이면 일찍 해처리를 늘린다.
  const floating = record.minerals > (memory.step >= order.length || race.id === "zerg" ? 300 : 600);
  if (floating && stwOwnBuildings(state, side, extra).length < GATEWAY_CAP[persona]) stwCommand(state, side, { type: "build", building: extra });
  else if (FALLBACK_PRODUCER[race.id] && record.minerals > 700 && stwOwnBuildings(state, side, FALLBACK_PRODUCER[race.id]).length < 5) stwCommand(state, side, { type: "build", building: FALLBACK_PRODUCER[race.id] });
  if (memory.step >= order.length) {
    for (const research of LATE_UPGRADES[race.id]) {
      if (STW_RESEARCH[research] && stwResearchCheck(state, side, research).ok && record.gas > 200) stwCommand(state, side, { type: "research", research });
    }
  }

  // 3-1. 은폐 유닛에 당했으면 탐지기를 갖춘다: 로보가 있으면 옵저버, 없으면 포지와 포톤 캐논.
  const units = state.units.filter((unit) => unit.side === side);
  const needDetection = record.sawCloakAt !== undefined && state.time - record.sawCloakAt < 150;
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

  // 3-1-1. 저그 상대: 저글링 물량에 대비해 테란은 벙커 하나를 세운다.
  const versusZerg = state.sides[stwOpponent(side)].race === "zerg";
  if (versusZerg && race.id === "terran" && stwHas(state, side, "barracks") && state.time > 150) {
    // 저글링·울트라리스크가 많이 보이면 벙커를 하나 더.
    const mix = foeMix(state, side);
    const bunkers = mix && mix.zergling + mix.ultra > 0.5 ? 2 : 1;
    if (stwOwnBuildings(state, side, "bunker").length < bunkers) stwCommand(state, side, { type: "build", building: "bunker" });
  }

  // 3-2. 하이템플러가 넷 이상 쌓이면 에너지가 적은 둘을 아콘으로 합친다.
  if (race.id === "protoss" && units.filter((unit) => unit.type === "templar").length >= 4) stwCommand(state, side, { type: "merge" });

  // 3-4. 테란 생산 라인: 배럭(해병·메딕·파이어뱃), 팩토리(벌처·시즈 탱크).
  if (race.id === "terran") {
    terranLines(state, side, persona, units, reserve);
    manageArmy(state, side, persona, memory, settings);
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
    // 저그는 들고 다닐 탐지기가 없으므로, 은폐 유닛에 당하는 동안에는 스포어가 있는 기지에서 기다린다.
    manageArmy(state, side, persona, memory, settings, { holdHome: needDetection && units.filter((unit) => !STW_UNITS[unit.type].worker).length < 30 });
    return;
  }

  // 3-3. 로보틱스 라인: 옵저버 1~2기를 유지하고, 지원 베이가 있으면 리버.
  const observers = units.filter((unit) => unit.type === "observer").length;
  for (const robo of stwOwnBuildings(state, side, "robo", { doneOnly: true })) {
    let unit = null;
    if (observers < (needDetection || persona === "robo" ? 1 : 0) + (persona === "robo" && state.time > 480 ? 1 : 0)) unit = "observer";
    else if (persona === "robo" && stwHas(state, side, "bay")) unit = "reaver";
    // 리버는 로보 운영의 핵심이라 연구용 가스보다 먼저 만든다.
    if (robo.line !== unit) stwCommand(state, side, { type: "line", buildingId: robo.id, unit });
  }

  // 4. 생산 라인(프로토스 게이트웨이): 테크를 모을 때는 셋 중 둘까지만 잠시 멈춘다.
  const gatewayList = stwOwnBuildings(state, side, "gateway").sort((a, b) => a.id - b.id);
  const counter = protossCounter(state, side);
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
    // 상대 병력 구성에 맞춘 대응(다크템플러·하이템플러 라인은 건드리지 않는다).
    if (counter && stwHas(state, side, "core") && (unit === "zealot" || unit === "dragoon")) {
      unit = shareOf(index, gatewayList.length, counter.zealotShare) ? "zealot" : "dragoon";
      if (counter.storm && stwHas(state, side, "archives") && index % 4 === 3) unit = "templar";
    }
    // 가스가 남고 광물이 모자라면 가스를 많이 쓰는 유닛으로.
    if (unit === "zealot" && record.gas > 300 && record.minerals < 150 && stwHas(state, side, "core")) unit = stwHas(state, side, "archives") && persona !== "dark" ? "templar" : "dragoon";
    if (STW_UNITS[unit].gas && record.gas < STW_UNITS[unit].gas + reserve.gas && record.minerals > 250) unit = "zealot";
    const def = STW_UNITS[unit];
    const starving = (reserve.minerals && record.minerals - def.minerals < reserve.minerals) || (reserve.gas && def.gas && record.gas - def.gas < reserve.gas);
    const thin = stwArmy(state, side).rally.length + stwArmy(state, side).attack.length < 3;
    // 게이트웨이 셋 중 하나는 아끼는 중에도 계속 소환한다.
    const keepRunning = index < Math.floor(gatewayList.length / 3);
    const desired = starving && !thin && !keepRunning && !gateway.current ? null : unit;
    if (gateway.line !== desired) stwCommand(state, side, { type: "line", gatewayId: gateway.id, unit: desired });
  });

  // 5. 병력
  manageArmy(state, side, persona, memory, settings);
}

/** 생산 건물 n개 중 비율 share만큼을 뒤쪽 번호부터 고른다(앞쪽은 주력 유닛). */
function shareOf(index, n, share) {
  return index >= n - Math.round(n * share);
}

const MIX_TYPES = ["zealot", "dragoon", "dark", "archon", "reaver", "templar", "marine", "firebat", "medic", "vulture", "tank", "zergling", "hydra", "lurker", "ultra"];

/** 보이는 적 지상 병력 구성(비율). 4기 이상 보였을 때 갱신하고, 그 전에는 마지막으로 본 구성을 쓴다. */
function foeMix(state, side) {
  const foe = stwOpponent(side);
  const seen = state.units.filter((unit) => unit.side === foe && !STW_UNITS[unit.type].worker && !STW_UNITS[unit.type].flying && stwVisible(state, side, unit.x, unit.y));
  const memory = state.sides[side].ai;
  if (seen.length >= 4) memory.foeMix = Object.fromEntries(MIX_TYPES.map((type) => [type, seen.filter((unit) => unit.type === type).length / seen.length]));
  return memory.foeMix ?? null;
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
  stwOwnBuildings(state, side, "barracks").sort((a, b) => a.id - b.id).forEach((barracks, index) => {
    let unit = "marine";
    // 저그 상대로는 저글링에 강한 파이어뱃을 더 섞는다.
    if (academy && bioLike) unit = medics * 4 < marines ? "medic" : index % (versusZerg || meleeHeavy ? 3 : 4) === (versusZerg || meleeHeavy ? 2 : 3) ? "firebat" : "marine";
    // 메카닉 성향은 배럭을 광물이 남을 때만 돌린다.
    if ((persona === "mech" || persona === "vulture") && units.length > 10 && record.minerals < 300) unit = null;
    if (unit && STW_UNITS[unit].gas && record.gas < STW_UNITS[unit].gas + reserve.gas) unit = "marine";
    const starving = unit && reserve.minerals && record.minerals - STW_UNITS[unit].minerals < reserve.minerals && units.length >= 3;
    const desired = starving && !barracks.current ? null : unit;
    if (barracks.line !== desired) stwCommand(state, side, { type: "line", buildingId: barracks.id, unit: desired });
  });
  stwOwnBuildings(state, side, "factory").sort((a, b) => a.id - b.id).forEach((factory, index) => {
    let unit = null;
    if (persona === "mech") unit = shop && (index % 2 === 0 || count("vulture") >= (versusZerg ? 8 : 4)) ? "tank" : "vulture";
    // 벌처 러시: 벌처 위주, 시즈 모드가 끝나면 팩토리 셋 중 하나는 탱크.
    else if (persona === "vulture") unit = shop && record.research.siege === "done" && index % 3 === 2 ? "tank" : "vulture";
    else if (shop) unit = meleeHeavy && index % 2 === 1 ? "vulture" : "tank";
    else if (meleeHeavy) unit = "vulture";
    // 대형 상대로는 벌처 대신 탱크를 늘린다.
    if (armoredHeavy && shop && unit === "vulture" && index % 2 === 0) unit = "tank";
    if (unit === "tank" && record.gas < STW_UNITS.tank.gas + reserve.gas) unit = persona === "mech" || persona === "vulture" ? "vulture" : null;
    if (factory.line !== unit) stwCommand(state, side, { type: "line", buildingId: factory.id, unit });
  });
}

/** 지금 아껴 둘 상위 유닛(저그 울트라리스크·럴커). */
function signatureUnit(state, side, persona) {
  const record = state.sides[side];
  if (record.race !== "zerg") return null;
  const units = state.units.filter((unit) => unit.side === side);
  const count = (type) => units.filter((unit) => unit.type === type).length;
  const army = units.filter((unit) => !STW_UNITS[unit.type].worker).length;
  if (stwHas(state, side, "cavern") && count("ultra") * (persona === "ultra" ? 4 : 6) < army) return "ultra";
  if (record.research.lurkerAspect === "done" && count("lurker") * 3 < count("hydra")) return "lurker";
  return null;
}

/** 성향별 저글링 비율(나머지는 히드라). 덴이 없으면 모두 저글링. */
function baseLingShare(state, side, persona) {
  const versusTerran = state.sides[stwOpponent(side)].race === "terran";
  if (persona === "ling") return state.time > 420 ? 0.67 : 1;
  if (persona === "pool") return state.time > 480 ? 0.75 : 1;
  if (persona === "hydra") return versusTerran ? 0.5 : 0.33;
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
  const mix = foeMix(state, side);
  let lingShare = baseLingShare(state, side, persona);
  let lurkerEvery = 4;
  if (mix) {
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
    // 히드라는 주력이라 초반(6분 전)에는 연구용 가스를 절반만 아끼고 만든다. 그 뒤에는 상위 테크를 위해 다 아낀다. 럴커·울트라는 연구보다 먼저 만든다.
    const gasFor = (type) => STW_UNITS[type].gas + (type === "lurker" || type === "ultra" ? 0 : type === "hydra" && state.time < 360 ? reserve.gas / 2 : reserve.gas);
    if (STW_UNITS[unit].gas && record.gas < gasFor(unit)) unit = (unit === "lurker" || unit === "ultra") && den ? "hydra" : "zergling";
    if (STW_UNITS[unit].gas && record.gas < gasFor(unit)) unit = "zergling";
    const starving = reserve.minerals && record.minerals - STW_UNITS[unit].minerals < reserve.minerals && army >= 4;
    // 본진 해처리는 아끼는 중에도 계속 변태시킨다.
    const desired = starving && index > 0 && !hatchery.current ? null : unit;
    if (hatchery.line !== desired) stwCommand(state, side, { type: "line", buildingId: hatchery.id, unit: desired });
  });
}

function manageArmy(state, side, persona, memory, settings, { holdHome = false } = {}) {
  const record = state.sides[side];
  const desiredRally = stwNexus(state, side, "natural") ? "natural" : "main";
  if (record.rally !== desiredRally) stwCommand(state, side, { type: "rally", point: desiredRally });
  const army = stwArmy(state, side);
  const foe = stwOpponent(side);

  // 본진·앞마당이 공격받으면 공격 병력을 불러들인다.
  const own = ["main", "natural"].map((base) => stwNexus(state, side, base)).filter(Boolean);
  const threat = state.units.filter((unit) => unit.side === foe && !STW_UNITS[unit.type].worker && !STW_UNITS[unit.type].flying && own.some((nexus) => Math.hypot(unit.x - nexus.x, unit.y - nexus.y) < 16)).length;
  if (threat >= 3 && army.attack.length && army.attack.length < threat * 1.5) {
    stwCommand(state, side, { type: "retreat" });
    memory.attacking = false;
    return;
  }

  // 총공격: 광물이 바닥나 더 모을 수 없거나 인구가 거의 찼으면 기다릴 이유가 없다.
  const supply = stwSupply(state, side);
  const allIn = (stwIncome(state, side).minerals < 60 && record.minerals < 100) || supply.used >= 92;

  if (memory.attacking) {
    if (!allIn && army.attack.length < Math.max(1, memory.waveStart * 0.35)) {
      if (army.attack.length) stwCommand(state, side, { type: "retreat" });
      memory.attacking = false;
      memory.wave += 1;
    }
    if (allIn && army.rally.length >= 4 && army.attack.length) stwCommand(state, side, { type: "attack" });
    return;
  }
  if (holdHome && !allIn) {
    if (army.attack.length) stwCommand(state, side, { type: "retreat" });
    memory.attacking = false;
    return;
  }
  const waves = WAVES[persona];
  // 목록이 끝난 뒤에는 실패할 때마다 출격 규모를 4기씩 키운다(최대 40기).
  const listed = waves[Math.min(memory.wave, waves.length - 1)] + Math.max(0, memory.wave - waves.length + 1) * 4;
  const size = allIn ? 1 : Math.round(Math.min(40, listed) * settings.waveScale);
  if (army.rally.length >= size) {
    stwCommand(state, side, { type: "attack" });
    memory.attacking = true;
    memory.waveStart = army.rally.length;
  }
}
