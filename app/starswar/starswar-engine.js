// 스타드래프트 규칙 엔진. React와 DOM에 의존하지 않는 결정적 시뮬레이션.
// 플레이어와 AI는 같은 stwCommand만 쓴다.
import { withKoreanDirection, withKoreanObject, withKoreanSubject } from "../korean-particles.js";
import { stwLearnPick } from "./starswar-learn.js";
import {
  STW_ARMY_UNITS,
  STW_BUILDINGS,
  STW_CANCEL_REFUND,
  STW_DEFENSE_REACH,
  STW_REPAIR,
  STW_DIFFICULTIES,
  STW_ECONOMY,
  STW_LANE_LENGTH,
  STW_LANE_WIDTH,
  STW_AI_PERSONAS,
  STW_PRODUCERS,
  STW_PRODUCER_UNITS,
  STW_RACES,
  STW_RAID_UNITS,
  STW_RESEARCH,
  STW_SIZE_MULTIPLIER,
  STW_SLOTS,
  STW_SPELLS,
  STW_STORM,
  STW_TICK,
  STW_TRANSPORT,
  STW_UNITS,
  STW_WORKER_HP,
  stwGroundSpan,
  stwMapData,
} from "./starswar-data.js";

export const STW_SIDES = ["player", "enemy"];

/**
 * 경기의 맵 묶음(위치·집결 눈금·지형). 맵 이름이 없는 옛 저장 경기는 평원이다.
 * @param {any} [state]
 */
export function stwMap(state) {
  return stwMapData(state?.map);
}

/** 진영의 종족 설정. */
export function stwRace(state, side) {
  return STW_RACES[state.sides[side].race ?? "protoss"];
}

function isWorker(unit) {
  return Boolean(STW_UNITS[unit.type].worker);
}

function isFlying(unit) {
  return Boolean(STW_UNITS[unit.type].flying);
}

/**
 * 지금 은폐 상태인지: 다크템플러·옵저버는 항상, 럴커는 땅속에 숨어 있을 때, 레이스·고스트는 은폐 연구 뒤,
 * 그리고 아군 아비터의 은폐장 안. 인스네어에 걸리면 드러난다.
 */
function isCloaked(unit, state = null) {
  const def = STW_UNITS[unit.type];
  if (!def) return false;
  if (state && ensnared(state, unit)) return false;
  if (def.cloakResearch && state && stwResearchDone(state, unit.side, def.cloakResearch)) return true;
  if (def.cloaked || (def.burrow && unit.burrowed)) return true;
  if (state && !def.cloakField && !isWorker(unit)) {
    for (const arbiter of cloakFields(state)) {
      if (arbiter.side === unit.side && arbiter !== unit && distance(arbiter.x, arbiter.y, unit.x, unit.y) <= STW_UNITS[arbiter.type].cloakField) return true;
    }
  }
  return false;
}

/** 화면용: 지금 은폐 상태인지(아비터 은폐장·연구·인스네어 포함). */
export function stwIsCloaked(state, unit) {
  return isCloaked(unit, state);
}

/** 아비터(은폐장) 목록. 같은 틱 안에서는 한 번만 모은다. */
const cloakFieldCache = new WeakMap();
function cloakFields(state) {
  const cached = cloakFieldCache.get(state);
  if (cached && cached.time === state.time) return cached.list;
  const list = state.units.filter((unit) => unit.hp > 0 && STW_UNITS[unit.type].cloakField);
  cloakFieldCache.set(state, { time: state.time, list });
  return list;
}

/** 작전 중인 수송선(셔틀·드랍십, 병력을 나르는 오버로드). */
function inFlight(unit) {
  return unit.kind === "unit" && (STW_UNITS[unit.type].transport || unit.op !== undefined) && (unit.group === "drop" || unit.op !== undefined);
}

/** 생체 유닛: 기계도 사이오닉 에너지 존재(아콘·다크 아콘)도 아닌 유닛. 마엘스트롬·브루들링·이레디에이트 대상. */
function isBiological(unit) {
  const def = STW_UNITS[unit.type];
  return !def.mech && !def.psionic;
}

function inStasis(state, unit) {
  return unit.stasisUntil !== undefined && state.time < unit.stasisUntil;
}

/** 마엘스트롬·락다운·스테이시스로 꼼짝 못 하는지. */
function stunned(state, unit) {
  return unit.stunUntil !== undefined && state.time < unit.stunUntil;
}

function ensnared(state, unit) {
  return unit.ensnareUntil !== undefined && state.time < unit.ensnareUntil;
}

/** 공격자의 무기가 노릴 수 있는 대상: 지상만, 공중만, 둘 다. 무기 없는 시전자(스톰)는 둘 다. */
function weaponTargets(def) {
  return def.targets ?? (def.damage ? "ground" : "both");
}

/** 떠 있는 대상인지(옵저버·오버로드·공중 유닛, 그리고 떠 있는 오버로드 건물). */
function isAirborne(item) {
  const def = item.kind === "unit" ? STW_UNITS[item.type] : STW_BUILDINGS[item.type];
  return Boolean(def?.flying);
}

/** 공격자의 무기로 그 대상을 때릴 수 있는지(지상 무기는 공중을, 공중 전용 무기는 지상을 못 때린다). */
function canHit(attacker, target) {
  const def = attacker.kind === "unit" ? STW_UNITS[attacker.type] : STW_BUILDINGS[attacker.type];
  const targets = weaponTargets(def);
  if (targets === "both") return true;
  return isAirborne(target) ? targets === "air" : targets === "ground";
}

/** 생산에 드는 인구: 저글링처럼 2기씩 나오면 두 배. */
function batchSupply(def) {
  return def.supply * (def.pair ? 2 : 1);
}

/** 무기 없이 따라다니기만 하는 지원 유닛(옵저버, 동행 오버로드). */
function isSupport(unit) {
  return STW_UNITS[unit.type].role === "support";
}

/** 전투에 직접 끼지 않는 유닛(일꾼, 비행 탐지기). 무기 있는 공중 유닛은 전투 유닛이다. */
function isPassive(unit) {
  return isWorker(unit) || (isFlying(unit) && isSupport(unit));
}

/** 쉬움에서는 초반에 몰아치는 성향을 빼고 고른다. */
const EASY_EXCLUDED_PERSONAS = ["rush", "dark", "bio", "ling", "vulture", "pool"];

export function stwOpponent(side) {
  return side === "player" ? "enemy" : "player";
}

/** 아군 기준 좌표를 진영 좌표로 바꾼다(적은 점대칭). */
export function stwPoint(side, point) {
  return side === "player" ? { x: point.x, y: point.y } : { x: STW_LANE_WIDTH - point.x, y: STW_LANE_LENGTH - point.y };
}

/** 전진 방향: 아군은 y가 줄어드는 쪽, 적은 늘어나는 쪽. */
export function stwForward(side) {
  return side === "player" ? -1 : 1;
}

/**
 * 집결지의 전장 세로 위치. rally는 이름표나 아군 기준 숫자. 이름표의 위치는 맵마다 다르므로 경기(state)를 함께 준다.
 * @param {string} side
 * @param {string | number} rally
 * @param {any} [state]
 */
export function stwRallyY(side, rally, state = null) {
  const points = stwMap(state).rallyPoints;
  const own = typeof rally === "number" ? rally : (points.find((item) => item.id === rally) ?? points[0]).y;
  return side === "player" ? own : STW_LANE_LENGTH - own;
}

/**
 * 아군 기준 세로 위치에 가장 가까운 집결 위치 이름(로그용).
 * @param {string | number} rally
 * @param {any} [state]
 */
export function stwRallyName(rally, state = null) {
  const points = stwMap(state).rallyPoints;
  if (typeof rally !== "number") return (points.find((item) => item.id === rally) ?? points[0]).name;
  return points.reduce((best, item) => (Math.abs(item.y - rally) < Math.abs(best.y - rally) ? item : best), points[0]).name;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function nextRandom(state) {
  state.rngState = (state.rngState * 1664525 + 1013904223) >>> 0;
  return state.rngState / 4294967296;
}

/* ───────── 생성 ───────── */

function createSide(id, persona, race, map) {
  return {
    id,
    race,
    minerals: STW_ECONOMY.startMinerals,
    gas: 0,
    probes: STW_ECONOMY.startProbes,
    bases: { main: { minerals: STW_ECONOMY.mainMinerals }, natural: { minerals: map.naturalMinerals } },
    research: {},
    rally: "main",
    autoWave: 0,
    intel: null,
    seen: {},
    persona,
    escort: false,
    focus: "fight",
    stats: { minerals: 0, gas: 0, produced: 0, lost: 0, kills: 0, buildingsLost: 0, buildingsDestroyed: 0, storms: 0, overkill: 0, workersLost: 0, workersKilled: 0, valueLost: 0, supplyPeak: 0 },
    dropPlan: { mission: "raid", target: "main", repeat: false, sync: false },
    /** 유닛 종류별로 따로 둔 부대: { 종류: { y } }. */
    squads: {},
    ai: null,
  };
}

/**
 * learned: 최상급 경기에서 AI가 쓸 학습 묶음(stwLearnSnapshot). 재현 정보에 함께 남아 같은 경기가 다시 돌아간다.
 */
export function createStarswarGame({ difficulty = "normal", seed = 20261101, aiSides = ["enemy"], personas = {}, races = {}, hiddenEnemyRace = false, learned = null, map = "plain" } = {}) {
  const mapData = stwMapData(map);
  const state = {
    version: 1,
    map: mapData.id,
    hiddenEnemyRace,
    time: 0,
    difficulty: STW_DIFFICULTIES[difficulty] ? difficulty : "normal",
    rngState: seed >>> 0,
    status: "playing",
    winner: null,
    nextId: 1,
    accumulator: 0,
    sides: {
      player: createSide("player", personas.player ?? null, STW_RACES[races.player] ? races.player : "protoss", mapData),
      enemy: createSide("enemy", personas.enemy ?? null, STW_RACES[races.enemy] ? races.enemy : "protoss", mapData),
    },
    units: [],
    buildings: [],
    storms: [],
    zones: [],
    ops: [],
    scans: [],
    effects: [],
    pendingHits: [],
    log: [],
    alerts: {},
    aiSides: [...aiSides],
    history: [],
    // 재현 정보: 경기를 만든 설정과 사람이 내린 명령(틱, 명령). 같은 코드에서 그대로 다시 돌리면 같은 경기가 된다.
    replay: { setup: { difficulty, seed, aiSides: [...aiSides], personas: { ...personas }, races: { ...races }, hiddenEnemyRace, ...(mapData.id !== "plain" ? { map: mapData.id } : {}), ...(learned ? { learned } : {}) }, commands: [] },
    // 양쪽이 성공한 명령의 시간순 기록(빌드 순서·연구·공격 시점). 결과 화면의 리포트에 쓴다.
    chronicle: [],
  };
  const master = Boolean(STW_DIFFICULTIES[state.difficulty].master);
  if (master) state.learned = learned ? JSON.parse(JSON.stringify(learned)) : { v: 1, plans: [], stats: {}, tagStats: {}, foeTags: {} };
  for (const side of STW_SIDES) {
    if (!state.sides[side].persona && state.aiSides.includes(side) && master) {
      // 최상급: 지난 경기들의 승패와 상대가 자주 쓰는 전략으로 고른다(이긴 사람의 운영을 따라 한 계획도 후보).
      const pick = stwLearnPick(state.learned, state.sides[side].race, state.sides[stwOpponent(side)].race, () => nextRandom(state), state.map);
      state.sides[side].persona = pick.persona;
      if (pick.plan) state.sides[side].plan = JSON.parse(JSON.stringify(pick.plan));
    } else if (!state.sides[side].persona && state.aiSides.includes(side)) {
      const race = state.sides[side].race;
      const personas = Object.values(STW_AI_PERSONAS)
        .filter((persona) => persona.race === race && !(state.difficulty === "easy" && EASY_EXCLUDED_PERSONAS.includes(persona.id)))
        .map((persona) => persona.id);
      state.sides[side].persona = personas[Math.floor(nextRandom(state) * personas.length)];
    }
    const nexus = placeBuilding(state, side, stwRace(state, side).base, stwPoint(side, stwMap(state).layout.mainNexus), "main", "nexus-main");
    nexus.progress = 1;
    nexus.hp = nexus.maxHp;
    nexus.shields = nexus.maxShields;
  }
  const workerName = STW_UNITS[stwRace(state, "player").worker].name;
  pushLog(state, "player", `전투 개시. ${withKoreanSubject(workerName)} 광물을 캐고 있습니다. 첫 선택을 내리세요.`, "info");
  return state;
}

function placeBuilding(state, side, type, position, base, slot) {
  const def = STW_BUILDINGS[type];
  const building = {
    id: state.nextId++,
    kind: "building",
    side,
    type,
    x: position.x,
    y: position.y,
    base,
    slot,
    radius: def.size / 2,
    hp: Math.max(1, Math.round(def.hp * 0.1)),
    maxHp: def.hp,
    shields: Math.round(def.shields * 0.1),
    maxShields: def.shields,
    armor: def.armor ?? 0,
    size: "large",
    progress: 0,
    queue: [],
    line: STW_RACES[state.sides[side].race ?? "protoss"].startLines[type] ?? null,
    energy: def.energy ?? 0,
    current: null,
    research: null,
    blocked: null,
    cooldown: 0,
    targetId: null,
    lastHit: -99,
  };
  state.buildings.push(building);
  return building;
}

/* ───────── 조회 ───────── */

export function stwDone(building) {
  return building.progress >= 1;
}

/**
 * @param {any} state
 * @param {string} side
 * @param {string | null} [type]
 * @param {{ doneOnly?: boolean }} [options]
 * @returns {any[]}
 */
export function stwOwnBuildings(state, side, type = null, { doneOnly = false } = {}) {
  return state.buildings.filter((building) => building.side === side && (!type || building.type === type) && (!doneOnly || stwDone(building)));
}

export function stwHas(state, side, type) {
  return state.buildings.some((building) => building.side === side && building.type === type && stwDone(building));
}

export function stwNexus(state, side, base) {
  return state.buildings.find((building) => building.side === side && STW_BUILDINGS[building.type].base && building.base === base) ?? null;
}

export function stwSupply(state, side) {
  const record = state.sides[side];
  let cap = 0;
  let used = record.probes;
  for (const building of state.buildings) {
    if (building.side !== side) continue;
    if (stwDone(building)) cap += STW_BUILDINGS[building.type].supply ?? 0;
    for (const item of building.queue) used += STW_UNITS[item.unit].supply;
    if (building.current) used += batchSupply(STW_UNITS[building.current.unit]);
  }
  for (const unit of state.units) {
    if (unit.side !== side) continue;
    used += STW_UNITS[unit.type].supply;
    // 동행 중인 오버로드는 건물일 때처럼 인구를 제공한다.
    cap += STW_UNITS[unit.type].supplyProvided ?? 0;
  }
  // 실험실 상황은 인구 건물 없이 상한을 채운다(건물 자리가 모자라 파일런을 다 지을 수 없다).
  cap += record.bonusSupply ?? 0;
  // 저글링 반 칸은 올림해서 보여 준다.
  return { used: Math.ceil(used - 1e-9), cap: Math.min(STW_ECONOMY.supplyLimit, cap) };
}

/** 프로브 배치: 가스, 본진 광물, 앞마당 광물, 놀고 있는 수. */
export function stwWorkerSplit(state, side) {
  const record = state.sides[side];
  // 앞마당 가스 건물은 앞마당 기지가 서 있어야 캔다(기지가 부서지면 일꾼이 붙지 않는다).
  const naturalBase = stwNexus(state, side, "natural");
  const naturalReady = Boolean(naturalBase && stwDone(naturalBase));
  const gasSlots = state.buildings.filter((building) => building.side === side && STW_BUILDINGS[building.type].refinery && stwDone(building) && (building.base !== "natural" || naturalReady)).length * STW_ECONOMY.probesPerGas;
  const gas = Math.min(gasSlots, Math.max(0, record.probes - STW_ECONOMY.minMineralProbes));
  let mineral = record.probes - gas;
  const split = { gas, main: 0, natural: 0, idle: 0 };
  const bases = ["main", "natural"].filter((base) => {
    const nexus = stwNexus(state, side, base);
    return nexus && stwDone(nexus) && record.bases[base].minerals > 0;
  });
  for (const cap of [STW_ECONOMY.fullSaturation, STW_ECONOMY.maxSaturation]) {
    for (const base of bases) {
      const add = Math.max(0, Math.min(cap - split[base], mineral));
      split[base] += add;
      mineral -= add;
    }
  }
  split.idle = mineral;
  return split;
}

/** 광물 채취 속도(초당). rate는 그 기지 광물의 배율(황금 앞마당은 1보다 크다). */
function mineralRate(count, rate = 1) {
  const full = Math.min(count, STW_ECONOMY.fullSaturation);
  const over = Math.max(0, Math.min(count, STW_ECONOMY.maxSaturation) - STW_ECONOMY.fullSaturation);
  return (full + over * STW_ECONOMY.overflowRate) * STW_ECONOMY.mineralRate * rate;
}

function incomeMultiplier(state, side) {
  return side === "enemy" && state.aiSides.includes("enemy") && !state.aiSides.includes("player") ? STW_DIFFICULTIES[state.difficulty].income : 1;
}

/** 분당 예상 수입. */
export function stwIncome(state, side) {
  const split = stwWorkerSplit(state, side);
  const multiplier = incomeMultiplier(state, side);
  return {
    minerals: Math.round((mineralRate(split.main) + mineralRate(split.natural, stwMap(state).naturalRate)) * multiplier * 60),
    gas: Math.round(split.gas * STW_ECONOMY.gasPerProbe * multiplier * 60),
  };
}

/**
 * @param {any} state
 * @param {string} side
 * @returns {{ rally: any[], attack: any[], fighters: any[], attackers: any[], counts: Record<string, number> }}
 */
export function stwArmy(state, side) {
  // fighters: 대기 병력 가운데 실제로 싸우는 유닛. attackers: 공격 병력 가운데 싸우는 유닛. 지원 유닛(옵저버·동행 오버로드)은 뺀다.
  const army = { rally: [], attack: [], fighters: [], attackers: [], counts: Object.fromEntries(STW_ARMY_UNITS.map((type) => [type, 0])) };
  for (const unit of state.units) {
    // 수송선에 탄 병력과 침투 중인 수송선은 대기·공격 병력에 넣지 않는다.
    // 게릴라 드랍으로 나가 있는 병력(raid)도 작전이 끝날 때까지 빼 둔다(후퇴·출격 명령에 끌려가지 않도록).
    if (unit.side !== side || isWorker(unit) || unit.group === "cargo" || unit.group === "drop" || unit.group === "board" || unit.raid !== undefined) continue;
    const attacking = unit.group === "attack";
    army[attacking ? "attack" : "rally"].push(unit);
    if (!isSupport(unit)) army[attacking ? "attackers" : "fighters"].push(unit);
    army.counts[unit.type] += 1;
  }
  return army;
}

export function stwResearchDone(state, side, id) {
  return state.sides[side].research[id] === "done";
}

/* ───────── 기록 ───────── */

function pushLog(state, side, text, tone = "info") {
  state.log.push({ id: state.nextId++, time: state.time, side, text, tone });
  if (state.log.length > 40) state.log.splice(0, state.log.length - 40);
}

function alertOnce(state, key, cooldown, side, text, tone) {
  if (state.time - (state.alerts[key] ?? -Infinity) < cooldown) return;
  state.alerts[key] = state.time;
  pushLog(state, side, text, tone);
}

/* ───────── 선택 가능 여부 ───────── */

function fail(reason) {
  return { ok: false, reason };
}

function costCheck(record, minerals, gas) {
  if (record.minerals < minerals) return fail(`광물 ${Math.ceil(minerals - record.minerals)} 부족`);
  if (record.gas < gas) return fail(`가스 ${Math.ceil(gas - record.gas)} 부족`);
  return { ok: true };
}

function freeSlot(state, side, list, prefix, { frontFirst = false } = {}) {
  const used = new Set(state.buildings.filter((building) => building.side === side).map((building) => building.slot));
  // 일반 건물은 뒤쪽(본진 안쪽) 줄부터 채운다(목록 끝에 붙인 뒷줄 칸도 먼저 쓴다). 같은 줄에서는 목록 순서.
  // 방어 건물은 앞줄부터, 같은 줄에서는 가운데부터 채운다(적이 들어오는 길목).
  const order = list.map((_, i) => i).sort((a, b) => (prefix === "main" ? list[b].y - list[a].y : 0) || a - b);
  if (frontFirst) order.sort((a, b) => list[a].y - list[b].y || Math.abs(list[a].x - STW_LANE_WIDTH / 2) - Math.abs(list[b].x - STW_LANE_WIDTH / 2));
  const index = order.find((i) => !list[i].blocked && !used.has(`${prefix}-${i}`));
  return index === undefined ? null : { key: `${prefix}-${index}`, point: stwPoint(side, list[index]) };
}

/** 일반 건물을 더 지을 수 있는 자리 수(본진 + 완성된 앞마당). AI가 꼭 필요한 테크 건물 자리를 남겨 둘 때 쓴다. */
export function stwFreeSlots(state, side) {
  const used = new Set(state.buildings.filter((building) => building.side === side).map((building) => building.slot));
  let free = stwMap(state).layout.mainSlots.filter((slot, index) => !slot.blocked && !used.has(`main-${index}`)).length;
  const natural = stwNexus(state, side, "natural");
  if (natural && stwDone(natural)) free += stwMap(state).layout.naturalSlots.filter((_, index) => !used.has(`natural-${index}`)).length;
  return free;
}

function placementFor(state, side, type) {
  if (STW_BUILDINGS[type]?.refinery) {
    // 본진 간헐천 둘을 먼저, 앞마당 간헐천은 앞마당 기지가 완성된 뒤에 쓴다.
    const used = new Set(state.buildings.filter((building) => building.side === side).map((building) => building.slot));
    const naturalBase = stwNexus(state, side, "natural");
    const naturalReady = Boolean(naturalBase && stwDone(naturalBase));
    const index = stwMap(state).layout.geysers.findIndex((point, i) => (point.base === "main" || naturalReady) && !used.has(`geyser-${i}`));
    if (index < 0) return null;
    const geyser = stwMap(state).layout.geysers[index];
    return { key: `geyser-${index}`, point: stwPoint(side, geyser), base: geyser.base };
  }
  const natural = stwNexus(state, side, "natural");
  if (STW_BUILDINGS[type]?.defense) {
    // 상대 수송선을 본 뒤에는 같은 종류의 방어 건물이 본진에 하나도 없으면 본진(광물 줄 가까운 뒤쪽)에 먼저 세운다.
    const record = state.sides[side];
    if (natural && record.sawTransportAt !== undefined && !state.buildings.some((building) => building.side === side && building.type === type && building.base === "main")) {
      const back = freeSlot(state, side, stwMap(state).layout.mainSlots, "main");
      if (back) return { ...back, base: "main" };
    }
    if (natural) {
      const slot = freeSlot(state, side, stwMap(state).layout.naturalSlots, "natural");
      if (slot) return { ...slot, base: "natural" };
    }
    const front = freeSlot(state, side, stwMap(state).layout.mainSlots, "main", { frontFirst: true });
    return front ? { ...front, base: "main" } : null;
  }
  const main = freeSlot(state, side, stwMap(state).layout.mainSlots, "main");
  if (main) return { ...main, base: "main" };
  if (natural && stwDone(natural)) {
    const slot = freeSlot(state, side, stwMap(state).layout.naturalSlots, "natural");
    if (slot) return { ...slot, base: "natural" };
  }
  return null;
}

export function stwBuildCheck(state, side, type) {
  const record = state.sides[side];
  if (type === "expand") {
    if (stwNexus(state, side, "natural")) return fail("이미 앞마당에 기지가 있습니다");
    const point = stwPoint(side, stwMap(state).layout.naturalNexus);
    if (state.units.some((unit) => unit.side !== side && distance(unit.x, unit.y, point.x, point.y) < 12)) return fail("앞마당에 적이 있습니다");
    return costCheck(record, STW_BUILDINGS[stwRace(state, side).base].minerals, 0);
  }
  const def = STW_BUILDINGS[type];
  if (!def || def.base) return fail("지을 수 없는 건물입니다");
  if (def.race !== record.race) return fail("이 종족은 지을 수 없는 건물입니다");
  if (def.requires && !stwHas(state, side, def.requires)) return fail(`${withKoreanSubject(STW_BUILDINGS[def.requires].name)} 필요합니다`);
  if (def.requiresResearch && !stwResearchDone(state, side, def.requiresResearch)) return fail(`${withKoreanSubject(STW_RESEARCH[def.requiresResearch].name)} 필요합니다`);
  if (def.unique && stwOwnBuildings(state, side, type).length) return fail("이미 있습니다");
  if (!placementFor(state, side, type)) {
    if (!def.refinery) return fail("지을 자리가 없습니다");
    const naturalTaken = state.buildings.some((building) => building.side === side && building.slot === `geyser-${stwMap(state).layout.geysers.findIndex((point) => point.base === "natural")}`);
    return fail(naturalTaken ? "가스 간헐천이 모두 찼습니다" : "앞마당 기지가 서면 앞마당 간헐천에 지을 수 있습니다");
  }
  return costCheck(record, def.minerals, def.gas);
}

export function stwProbeCheck(state, side) {
  const race = stwRace(state, side);
  const nexus = ["main", "natural"].map((base) => stwNexus(state, side, base)).filter((item) => item && stwDone(item)).sort((a, b) => a.queue.length - b.queue.length)[0];
  if (!nexus) return fail("기지가 없습니다");
  if (nexus.queue.length >= STW_ECONOMY.probeQueueLimit) return fail("생산 대기열이 찼습니다");
  const supply = stwSupply(state, side);
  if (supply.used + 1 > supply.cap) return fail(`인구 부족 · ${STW_BUILDINGS[race.supply].name} 필요`);
  const cost = costCheck(state.sides[side], STW_UNITS[race.worker].minerals, 0);
  return cost.ok ? { ok: true, nexus } : cost;
}

export function stwResearchCheck(state, side, id) {
  const def = STW_RESEARCH[id];
  const record = state.sides[side];
  if (!def) return fail("알 수 없는 연구입니다");
  if (def.race !== record.race) return fail("이 종족의 연구가 아닙니다");
  if (record.research[id] === "done") return fail("완료됨");
  if (record.research[id] === "running") return fail("연구 중");
  const building = stwOwnBuildings(state, side, def.at, { doneOnly: true }).find((item) => !item.research);
  if (!stwHas(state, side, def.at)) return fail(`${withKoreanSubject(STW_BUILDINGS[def.at].name)} 필요합니다`);
  for (const need of def.requires ?? []) {
    if (STW_RESEARCH[need] && record.research[need] !== "done") return fail(`${STW_RESEARCH[need].name} 먼저`);
    if (STW_BUILDINGS[need] && !stwHas(state, side, need)) return fail(`${withKoreanSubject(STW_BUILDINGS[need].name)} 필요합니다`);
  }
  if (!building) return fail("다른 연구 중");
  const cost = costCheck(record, def.minerals, def.gas);
  return cost.ok ? { ok: true, building } : cost;
}

export function stwScoutCheck(state, side) {
  // 정찰은 시차를 두고 몇 번이든 보낼 수 있다. 일꾼 5기 이상이면 된다.
  if (state.sides[side].probes < 5) return fail(`${STW_UNITS[stwRace(state, side).worker].name} 5기 이상 필요`);
  return { ok: true };
}

/** 수송 칸: 원작처럼 소형 1, 중형 2, 대형 4(예외는 STW_SLOTS). */
export function stwSlots(type) {
  const def = STW_UNITS[type];
  return STW_SLOTS[type] ?? (def.size === "small" ? 1 : def.size === "medium" ? 2 : 4);
}

/** 쉬고 있는 수송선. 저그는 복부 주머니 뒤, 침투를 마치고 떠 있는 오버로드를 먼저 쓰고 기지의 오버로드를 2기 남기고 띄운다. */
function idleCarriers(state, side) {
  const record = state.sides[side];
  if (record.race === "zerg") {
    const floating = state.units.filter((unit) => unit.side === side && unit.type === "overlord" && !unit.escort && !unit.cargo?.length && !unit.dropPath?.length && unit.op === undefined);
    const parked = stwOwnBuildings(state, side, "overlord", { doneOnly: true }).sort((a, b) => b.id - a.id);
    return [...floating, ...parked.slice(0, Math.max(0, parked.length - 2))];
  }
  return state.units.filter((unit) => unit.side === side && STW_UNITS[unit.type].transport && unit.group === "rally" && !unit.cargo?.length && !unit.dropPath?.length && unit.op === undefined);
}

/**
 * 태울 병력: 게릴라는 빠르고 싼 유닛부터(STW_RAID_UNITS 순서), 폭탄은 대기 중인 지상 병력 전부를 비싼 것부터.
 * 사람이 지휘하는 진영의 게릴라는 빠른 유닛이 없으면 다른 지상 병력을 싼 것부터 태운다(골리앗·탱크만 있어도 견제를 나갈 수 있게).
 * AI는 예전처럼 빠른 유닛만 쓴다(AI 균형을 그대로 둔다).
 */
function dropPassengers(state, side, mission) {
  const pool = state.units.filter((unit) => unit.side === side && unit.group === "rally" && unit.squad === undefined && unit.hp > 0 && !isWorker(unit) && !isFlying(unit) && !isSupport(unit));
  if (mission === "raid") {
    const order = STW_RAID_UNITS[state.sides[side].race] ?? [];
    const fast = pool.filter((unit) => order.includes(unit.type)).sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.id - b.id);
    if (state.aiSides.includes(side)) return fast;
    const rest = pool.filter((unit) => !order.includes(unit.type)).sort((a, b) => unitValue(a) - unitValue(b) || a.id - b.id);
    return [...fast, ...rest];
  }
  return pool.sort((a, b) => unitValue(b) - unitValue(a) || a.id - b.id);
}

/** 작전 목표 이름(기록용). */
const DROP_TARGET_NAME = { main: "적 본진 광물 줄", natural: "적 앞마당 광물 줄", alternate: "적 본진·앞마당 광물 줄", tech: "적 기술 건물", production: "적 생산 건물" };

function transportName(race) {
  return race === "terran" ? "드랍십" : race === "zerg" ? "오버로드" : "셔틀";
}

/**
 * 수송 작전이 지금 가능한지. 게릴라 드랍은 쉬는 수송선 1기, 폭탄 드랍은 2기 이상과 태울 병력이 있어야 한다.
 * 저그는 복부 주머니 연구가 먼저다.
 */
export function stwDropCheck(state, side, mission = state.sides[side].dropPlan?.mission ?? "raid") {
  const record = state.sides[side];
  if (record.race === "zerg" && !stwResearchDone(state, side, "ventral")) return fail("복부 주머니 연구 필요");
  const carriers = idleCarriers(state, side);
  const name = transportName(record.race);
  if (!carriers.length) return fail(record.race === "zerg" ? "기지에 남길 오버로드 2기 말고 쓸 오버로드가 없습니다" : `쉬는 ${name} 필요`);
  // 사람은 수송선 1기로도 폭탄 드랍을 할 수 있다(8칸 가득). AI는 예전처럼 2기 이상 모아서 간다.
  if (mission === "bomb" && carriers.length < (state.aiSides.includes(side) ? 2 : 1)) return fail(`폭탄 드랍은 쉬는 ${name} 2기 이상 필요`);
  const passengers = dropPassengers(state, side, mission);
  if (!passengers.length) return fail(mission === "raid" && state.aiSides.includes(side) ? "견제에 쓸 빠른 지상 병력이 없습니다" : "대기 병력(집결지)에 태울 지상 병력이 없습니다");
  return { ok: true, carriers, passengers };
}

/** 건물 분류: 생산(생산 라인), 기술(연구·해금 건물), 본진(기지 건물). */
function buildingKind(type) {
  const def = STW_BUILDINGS[type];
  if (def.base) return "main";
  if (STW_PRODUCERS.includes(type)) return "production";
  if (def.supply || def.refinery || def.defense || type === "overlord") return "other";
  return "tech";
}

/** 지상을 쏘는 적 방어 건물. */
function groundDefenses(state, side) {
  return state.buildings.filter((building) => building.side === side && stwDone(building) && STW_BUILDINGS[building.type].damage && STW_BUILDINGS[building.type].targets !== "air");
}

/**
 * 착륙 지점: 지상을 쏘는 방어 건물에서 가장 먼 후보. 게릴라 본진은 광물 줄 양옆을 먼저, 기술·생산 건물이 목표면 그 건물에 가까운 쪽을 고른다.
 */
function landingPoint(state, side, target, base) {
  const foe = stwOpponent(side);
  const list = (base === "natural" ? stwMap(state).landNatural : stwMap(state).landMain).map((point, index) => ({ ...stwPoint(foe, point), index }));
  const defenses = groundDefenses(state, foe);
  const goals = target === "tech" || target === "production" ? state.buildings.filter((building) => building.side === foe && buildingKind(building.type) === target) : [];
  const focus = goals.length ? { x: goals.reduce((sum, item) => sum + item.x, 0) / goals.length, y: goals.reduce((sum, item) => sum + item.y, 0) / goals.length } : null;
  const score = (point) => (defenses.length ? Math.min(...defenses.map((item) => distance(item.x, item.y, point.x, point.y))) : 20)
    - (focus ? distance(point.x, point.y, focus.x, focus.y) * 0.6 : 0)
    + (target !== "tech" && target !== "production" && base === "main" && point.index < 2 ? 4 : 0);
  return list.reduce((best, point) => (score(point) > score(best) ? point : best), list[0]);
}

/** 가까운 가장자리(절대 좌표 x 1 또는 39)를 타고 간다. */
function edgeX(x) {
  return x < STW_LANE_WIDTH / 2 ? 1 : STW_LANE_WIDTH - 1;
}

function dropPath(transport, land) {
  const x = edgeX(land.x);
  return [{ x, y: transport.y }, { x, y: land.y }, { x: land.x, y: land.y }];
}

function homePath(side, transport) {
  const x = edgeX(transport.x);
  const home = stwPoint(side, { x: 20, y: 88 });
  return [{ x, y: transport.y }, { x, y: home.y }];
}

/** 광물 줄 한가운데(광물과 기지 건물 사이). */
function mineralCenter(state, side, base) {
  const layout = stwMap(state).layout;
  const minerals = stwPoint(side, base === "natural" ? layout.naturalMinerals : layout.mainMinerals);
  const nexus = stwPoint(side, base === "natural" ? layout.naturalNexus : layout.mainNexus);
  return { x: minerals.x, y: minerals.y + (nexus.y - minerals.y) * 0.35 };
}

/** 저그 오버로드 건물은 떠올라 수송선이 된다(인구 +8은 그대로). */
function liftCarrier(state, side, carrier) {
  if (carrier.kind !== "building") return carrier;
  state.buildings = state.buildings.filter((item) => item !== carrier);
  const transport = spawnUnit(state, side, "overlord", carrier.x, carrier.y);
  transport.hp = Math.min(transport.maxHp, carrier.hp);
  return transport;
}

function boardUnit(unit, transport) {
  unit.group = "cargo";
  unit.boardTo = undefined;
  unit.targetId = null;
  unit.x = transport.x;
  unit.y = transport.y;
  transport.cargo ??= [];
  transport.cargo.push(unit.id);
}

/**
 * 칸 수만큼 태울 병력을 정한다. 게릴라에 해병과 메딕이 함께 있으면 해병은 6기까지만 태워 메딕 자리를 남긴다.
 * 바로 싣지 않는다: 정한 병력은 수송선으로 걸어가고(board, boardTo) 수송선은 그 병력 쪽으로 날아가 1.8칸 안에서 싣는다(작전 "load" 단계).
 * 예전에는 출발 버튼을 누르는 순간 거리와 상관없이 수송선 안으로 옮겨져, 본진 곳곳의 오버로드가 따로따로 출발했다.
 */
function loadTransport(state, transport, passengers, mission) {
  transport.cargo = [];
  transport.boarding = [];
  let room = STW_TRANSPORT.capacity;
  let marines = 0;
  const medicWaiting = () => passengers.some((unit) => unit.type === "medic");
  for (let index = 0; index < passengers.length && room > 0;) {
    const unit = passengers[index];
    const slots = stwSlots(unit.type);
    if (slots > room || (mission === "raid" && unit.type === "marine" && marines >= 6 && medicWaiting())) {
      index += 1;
      continue;
    }
    passengers.splice(index, 1);
    room -= slots;
    if (unit.type === "marine") marines += 1;
    if (distance(unit.x, unit.y, transport.x, transport.y) <= 1.8) boardUnit(unit, transport);
    else {
      unit.group = "board";
      unit.boardTo = transport.id;
      unit.targetId = null;
      delete unit.squad;
      delete unit.fresh;
      transport.boarding.push(unit.id);
    }
  }
}

/** 수송선에 태우기로 정했지만 아직 타지 않은 병력. */
function pendingBoarders(state, transport) {
  return (transport.boarding ?? []).map((id) => state.units.find((item) => item.id === id && item.hp > 0)).filter((unit) => unit && unit.group === "board" && unit.boardTo === transport.id);
}

/** 생산 라인 유닛이 지금 해금되어 있는지. */
export function stwUnitUnlocked(state, side, unit) {
  return stwUnitLock(state, side, unit) === null;
}

/** 생산 라인 유닛이 잠겨 있으면 "○○ 필요" 사유, 아니면 null. */
export function stwUnitLock(state, side, unit) {
  const def = STW_UNITS[unit];
  if (def.requires && !stwHas(state, side, def.requires)) return `${STW_BUILDINGS[def.requires].name} 필요`;
  if (def.requiresResearch && !stwResearchDone(state, side, def.requiresResearch)) return `${STW_RESEARCH[def.requiresResearch].name} 필요`;
  return null;
}

/** 같은 생산 목록을 쓰는 건물들(저그 해처리는 본진·앞마당·추가 해처리가 한 묶음). */
function producerGroup(state, side, producer) {
  const list = STW_PRODUCER_UNITS[producer];
  return state.buildings.filter((building) => building.side === side && STW_PRODUCER_UNITS[building.type] === list);
}

/* ───────── 명령 ───────── */

/** 기록에 남길 명령 수 상한(저장 크기를 묶어 둔다). */
const CHRONICLE_LIMIT = 900;

/**
 * 명령을 실행한다. 플레이어와 AI가 같은 함수를 쓴다.
 * 성공한 명령은 경기 연대기(state.chronicle)에 [시각, 진영, 명령]으로 남긴다. 일꾼 생산은 너무 잦아 빼고,
 * 같은 진영이 30초 안에 똑같은 명령을 되풀이하면 한 번만 남긴다(AI가 생각할 때마다 같은 공격 명령을 내린다).
 */
export function stwCommand(state, side, command) {
  // 최종 결전 중에는 사람도 AI도 지휘하지 않는다(남은 병력이 끝까지 적진으로 간다).
  if (state.finalBattle && state.status === "playing") return fail("최종 결전 중에는 지휘할 수 없습니다");
  const result = runCommand(state, side, command);
  if (result.ok && command.type !== "probe" && command.type !== "worker") chronicle(state, side, command);
  return result;
}

/**
 * 연대기에 남긴다. 생산 라인은 AI가 자원을 아끼느라 멈췄다 켰다를 되풀이하므로, 건물마다 "다른 유닛으로 바꾼" 때만 남기고
 * 나중에 건물이 부서져도 읽을 수 있게 건물 종류(at)를 붙인다.
 */
function chronicle(state, side, command) {
  state.chronicle ??= [];
  if (state.chronicle.length >= CHRONICLE_LIMIT) return;
  const entry = JSON.parse(JSON.stringify(command));
  if (command.type === "line") {
    const id = command.buildingId ?? command.gatewayId;
    if (!command.unit) return;
    const previous = state.chronicle.findLast((item) => item[1] === side && item[2].type === "line" && (item[2].buildingId ?? item[2].gatewayId) === id);
    if (previous?.[2].unit === command.unit) return;
    entry.at = state.buildings.find((building) => building.id === id)?.type;
  }
  const text = JSON.stringify(entry);
  const last = state.chronicle.findLast((item) => item[1] === side);
  if (last && JSON.stringify(last[2]) === text && state.time - last[0] < 30) return;
  state.chronicle.push([state.time, side, entry]);
}

/**
 * 사람이 내린 명령: 재현 정보(state.replay.commands)에 [틱, 명령]으로 남기고 실행한다.
 * 화면의 버튼·지도 조작은 모두 이 함수를 쓴다. AI는 stwCommand를 바로 쓴다.
 */
export function stwIssue(state, side, command) {
  if (state.status === "playing" && state.replay) state.replay.commands.push([Math.round(state.time * 10), side, JSON.parse(JSON.stringify(command))]);
  return stwCommand(state, side, command);
}

function runCommand(state, side, command) {
  if (state.status !== "playing") return fail("전투가 끝났습니다");
  const record = state.sides[side];
  switch (command.type) {
    case "probe":
    case "worker": {
      const check = stwProbeCheck(state, side);
      if (!check.ok) return check;
      const worker = STW_UNITS[stwRace(state, side).worker];
      record.minerals -= worker.minerals;
      check.nexus.queue.push({ unit: worker.id, remaining: worker.time });
      return { ok: true };
    }
    case "build": {
      const check = stwBuildCheck(state, side, command.building);
      if (!check.ok) return check;
      const race = stwRace(state, side);
      if (command.building === "expand") {
        const base = STW_BUILDINGS[race.base];
        record.minerals -= base.minerals;
        placeBuilding(state, side, race.base, stwPoint(side, stwMap(state).layout.naturalNexus), "natural", "nexus-natural");
        if (side === "player") pushLog(state, side, `앞마당 ${withKoreanObject(base.name)} ${race.buildVerb}하기 시작했습니다.`, "info");
        return { ok: true };
      }
      const def = STW_BUILDINGS[command.building];
      const place = placementFor(state, side, command.building);
      record.minerals -= def.minerals;
      record.gas -= def.gas;
      placeBuilding(state, side, command.building, place.point, place.base, place.key);
      if (side === "player") pushLog(state, side, `${withKoreanObject(def.name)} ${race.buildVerb}합니다.`, "info");
      return { ok: true };
    }
    case "research": {
      const check = stwResearchCheck(state, side, command.research);
      if (!check.ok) return check;
      const def = STW_RESEARCH[command.research];
      record.minerals -= def.minerals;
      record.gas -= def.gas;
      record.research[def.id] = "running";
      check.building.research = { id: def.id, remaining: def.time };
      if (side === "player") pushLog(state, side, `${withKoreanObject(def.name)} 연구합니다.`, "info");
      return { ok: true };
    }
    case "line": {
      const id = command.buildingId ?? command.gatewayId;
      const building = state.buildings.find((item) => item.id === id && item.side === side && STW_PRODUCERS.includes(item.type));
      if (!building) return fail("생산 건물을 찾을 수 없습니다");
      if (command.unit && !STW_PRODUCER_UNITS[building.type].includes(command.unit)) return fail("이 건물에서는 생산할 수 없는 유닛입니다");
      building.line = command.unit ?? null;
      return { ok: true };
    }
    case "lineAll": {
      const producer = command.unit ? STW_UNITS[command.unit]?.from : command.producer ?? stwRace(state, side).mainProducer;
      if (!STW_PRODUCERS.includes(producer)) return fail("알 수 없는 유닛입니다");
      const buildings = producerGroup(state, side, producer);
      if (!buildings.length) return fail(`${withKoreanSubject(STW_BUILDINGS[producer].name)} 없습니다`);
      for (const building of buildings) building.line = command.unit ?? null;
      return { ok: true };
    }
    case "merge": {
      // 하이템플러 2기를 아콘으로 합친다. 에너지가 적은 쌍부터. 프로토스 전용.
      if (record.race !== "protoss") return fail("프로토스만 쓸 수 있습니다");
      const templars = state.units.filter((unit) => unit.side === side && unit.type === "templar").sort((a, b) => a.energy - b.energy || a.id - b.id);
      if (templars.length < 2) return fail("하이템플러 2기가 필요합니다");
      const [first, second] = templars;
      first.hp = 0;
      second.hp = 0;
      first.returned = true;
      second.returned = true;
      const archon = spawnUnit(state, side, "archon", (first.x + second.x) / 2, (first.y + second.y) / 2);
      archon.group = first.group === "attack" || second.group === "attack" ? "attack" : "rally";
      state.effects.push({ kind: "warp", side, x1: archon.x, y1: archon.y, x2: archon.x, y2: archon.y, ttl: 0.9, max: 0.9, radius: 5 });
      if (side === "player") pushLog(state, side, "하이템플러 2기가 아콘으로 합체했습니다.", "good");
      return { ok: true };
    }
    case "darkMerge": {
      // 다크템플러 2기를 다크 아콘으로 합친다. 프로토스 전용.
      if (record.race !== "protoss") return fail("프로토스만 쓸 수 있습니다");
      const darks = state.units.filter((unit) => unit.side === side && unit.type === "dark" && unit.group !== "cargo").sort((a, b) => a.id - b.id);
      if (darks.length < 2) return fail("다크템플러 2기가 필요합니다");
      const [first, second] = darks;
      first.hp = 0;
      second.hp = 0;
      first.returned = true;
      second.returned = true;
      const darkArchon = spawnUnit(state, side, "darkArchon", (first.x + second.x) / 2, (first.y + second.y) / 2);
      darkArchon.group = first.group === "attack" || second.group === "attack" ? "attack" : "rally";
      state.effects.push({ kind: "warp", side, x1: darkArchon.x, y1: darkArchon.y, x2: darkArchon.x, y2: darkArchon.y, ttl: 0.9, max: 0.9, radius: 5 });
      if (side === "player") pushLog(state, side, "다크템플러 2기가 다크 아콘으로 합체했습니다.", "good");
      return { ok: true };
    }
    case "dropPlan": {
      const plan = { ...(record.dropPlan ?? { mission: "raid", target: "main", repeat: false, sync: false }) };
      if ((command.mission === "raid" || command.mission === "bomb") && command.mission !== plan.mission) {
        plan.mission = command.mission;
        // 작전을 바꾸면 목표는 그 작전의 기본값으로(게릴라 본진 광물, 폭탄 생산 건물).
        if (command.target === undefined) plan.target = command.mission === "raid" ? "main" : "production";
      }
      if (["main", "natural", "tech", "alternate", "production"].includes(command.target)) plan.target = command.target;
      if (typeof command.repeat === "boolean") plan.repeat = command.repeat;
      if (typeof command.sync === "boolean") plan.sync = command.sync;
      // 작전 종류와 맞지 않는 목표는 기본값으로.
      if (plan.mission === "raid" && plan.target === "production") plan.target = "main";
      if (plan.mission === "bomb" && (plan.target === "natural" || plan.target === "alternate")) plan.target = "production";
      record.dropPlan = plan;
      if (!plan.repeat) record.raidRelaunchAt = undefined;
      return { ok: true, plan };
    }
    case "squadMove": {
      // 유닛 종류별 부대: 고른 종류만 그 자리로 옮긴다(앞이면 싸우며 전진, 뒤면 교전을 끊고). 적 앞마당 안쪽이면 그 부대만 출격.
      // 그 종류의 새 유닛도 이 부대로 간다. 본대 지시(지도 탭·후퇴·본진 수비)와 자동 출격은 따로 둔 부대에 닿지 않고, 출격 버튼은 모두 합친다.
      const types = (command.units ?? []).filter((type) => STW_UNITS[type] && !STW_UNITS[type].worker);
      if (!types.length) return fail("옮길 부대를 고르세요");
      if (typeof command.y !== "number" || Number.isNaN(command.y)) return fail("알 수 없는 위치입니다");
      record.squads ??= {};
      // 침투 중인 유닛도 부대 명령을 따른다: 작전에서 빼고 이 명령대로 움직인다(뒤쪽이면 교전을 끊고 후퇴).
      const members = state.units.filter((unit) => unit.side === side && unit.hp > 0 && types.includes(unit.type) && ((unit.group === "rally" || unit.group === "attack") && unit.raid === undefined || inWalkOp(state, unit)));
      if (!members.length) return fail("옮길 유닛이 없습니다");
      const names = types.map((type) => STW_UNITS[type].name).join("·");
      const stopped = leaveWalkOps(state, members);
      if (stopped && side === "player") pushLog(state, side, `${names} ${stopped}기가 침투를 멈춥니다.`, "order");
      if (command.y <= stwMap(state).attackZoneY) {
        for (const type of types) delete record.squads[type];
        for (const unit of members) {
          delete unit.squad;
          if (!STW_UNITS[unit.type].transport) unit.group = "attack";
          unit.passing = true;
        }
        if (side === "player") pushLog(state, side, `${names} 부대 ${members.length}기가 출격합니다!`, "order");
        return { ok: true, mode: "attack" };
      }
      const y = Math.round(Math.min(stwMap(state).rallyRange.max, Math.max(stwMap(state).rallyRange.min, command.y)));
      for (const type of types) record.squads[type] = { y };
      for (const unit of members) {
        unit.group = "rally";
        unit.squad = unit.type;
        delete unit.fresh;
        // 따로 옮기는 부대는 길을 막는 아군을 비키게 하며 지나간다.
        unit.passing = true;
      }
      if (side === "player") pushLog(state, side, `${names} 부대 ${members.length}기가 ${withKoreanDirection(stwRallyName(y, state))} 갑니다.`, "order");
      return { ok: true, mode: "squad", y };
    }
    case "squadRelease": {
      // 따로 둔 부대를 본대로 되돌린다(새 유닛도 다시 본대 집결지로).
      record.squads ??= {};
      const walking = state.units.filter((unit) => unit.side === side && unit.hp > 0 && inWalkOp(state, unit) && (!command.units || command.units.includes(unit.type)));
      const types = [...new Set([...(command.units ?? Object.keys(record.squads)).filter((type) => record.squads[type]), ...walking.map((unit) => unit.type)])];
      if (!types.length) return fail("따로 둔 부대가 없습니다");
      // 침투 중이던 유닛은 작전을 멈추고 본대 집결지로 돌아온다(교전을 끊고).
      if (leaveWalkOps(state, walking)) for (const unit of walking) unit.group = "rally";
      for (const type of types) delete record.squads[type];
      for (const unit of state.units) if (unit.side === side && types.includes(unit.squad)) delete unit.squad;
      if (side === "player") pushLog(state, side, `${types.map((type) => STW_UNITS[type].name).join("·")} 부대가 본대로 돌아갑니다.`, "order");
      return { ok: true };
    }
    case "infiltrate": {
      // 침투: 고른 종류의 부대가 교전 없이 전장 가장자리를 따라 적 본진·앞마당 광물 줄까지 걸어가, 게릴라 드랍 병력처럼 일꾼을 친다.
      // 적 병력이 몰려오거나 25초가 지나거나 회수하면 다시 가장자리를 따라 걸어서 돌아온다.
      const types = (command.units ?? []).filter((type) => STW_UNITS[type] && !STW_UNITS[type].worker && !STW_UNITS[type].transport && type !== "overlord");
      if (!types.length) return fail("침투할 부대를 고르세요");
      const members = state.units.filter((unit) => unit.side === side && unit.hp > 0 && types.includes(unit.type) && (unit.group === "rally" || unit.group === "attack") && unit.raid === undefined);
      if (!members.some((unit) => STW_UNITS[unit.type].damage)) return fail("침투할 전투 유닛이 없습니다");
      const base = command.base === "natural" ? "natural" : "main";
      const foe = stwOpponent(side);
      const op = { id: state.nextId++, side, kind: "walk", target: base, base, transports: [], riders: members.map((unit) => unit.id), phase: "out", since: state.time, sync: false, repeat: false, value: members.reduce((sum, unit) => sum + unitValue(unit), 0) };
      state.ops ??= [];
      state.ops.push(op);
      record.squads ??= {};
      for (const type of types) delete record.squads[type];
      const goal = mineralCenter(state, foe, base);
      for (const unit of members) {
        unit.group = "walk";
        unit.raid = op.id;
        unit.targetId = null;
        delete unit.squad;
        delete unit.fresh;
        unit.walkPath = walkPath(unit, { x: goal.x + ((unit.id % 5) - 2) * 1.2, y: goal.y });
      }
      if (side === "player") {
        const names = types.filter((type) => members.some((unit) => unit.type === type)).map((type) => STW_UNITS[type].name).join("·");
        pushLog(state, side, `${names} ${members.length}기가 적 ${base === "natural" ? "앞마당" : "본진"} 광물 줄로 침투합니다.`, "order");
      }
      return { ok: true, opId: op.id };
    }
    case "dropRecall": {
      // 진행 중인 수송 작전을 지금 거둔다. 게릴라는 내렸으면 태워서, 가는 중이면 그대로 돌아온다.
      // 폭탄은 내리기 전(집결·진입 중)에만 거둘 수 있다(내린 병력은 끝까지 싸운다).
      const ops = (state.ops ?? []).filter((op) => op.side === side && (command.opId === undefined || op.id === command.opId));
      let recalled = 0;
      for (const op of ops) {
        const transports = op.transports.map((id) => state.units.find((item) => item.id === id && item.hp > 0)).filter(Boolean);
        if (op.phase === "load") {
          // 아직 출발 전: 타러 가던 병력과 이미 탄 병력을 그 자리에 내려 대기 병력으로 돌리고 수송선도 쉰다.
          for (const transport of transports) {
            for (const rider of pendingBoarders(state, transport)) {
              rider.group = "rally";
              rider.boardTo = undefined;
            }
            if (transport.cargo?.length) unloadCargo(state, transport, (rider) => { rider.group = "rally"; });
            transport.boarding = [];
            transport.op = undefined;
            transport.group = "rally";
            transport.dropPath = [];
          }
          op.done = true;
          recalled += 1;
          continue;
        }
        if (op.kind === "walk") {
          if (op.phase === "out" || op.phase === "fight") {
            walkHome(state, op);
            recalled += 1;
          }
        } else if (op.kind === "raid") {
          if (op.phase === "out") {
            for (const transport of transports) transport.dropPath = homePath(side, transport);
            op.phase = "home";
            recalled += 1;
          } else if (op.phase === "fight") {
            op.recallNow = true;
            recalled += 1;
          }
        } else if (op.phase === "gather" || op.phase === "in") {
          for (const transport of transports) if (transport.cargo?.length) transport.dropPath = homePath(side, transport);
          op.phase = "home";
          recalled += 1;
        }
      }
      if (!recalled) return fail("거둘 수 있는 수송 작전이 없습니다");
      if (side === "player") pushLog(state, side, "수송 작전 병력을 거둬들입니다.", "order");
      return { ok: true, recalled };
    }
    case "drop": {
      const plan = { ...(record.dropPlan ?? { mission: "raid", target: "main", repeat: false, sync: false }) };
      for (const key of ["mission", "target", "repeat", "sync"]) if (command[key] !== undefined) plan[key] = command[key];
      const check = stwDropCheck(state, side, plan.mission);
      if (!check.ok) return check;
      const passengers = [...check.passengers];
      const transports = [];
      for (const carrier of check.carriers) {
        if (!passengers.length) break;
        const transport = liftCarrier(state, side, carrier);
        loadTransport(state, transport, passengers, plan.mission);
        if (transport.cargo.length || transport.boarding.length) transports.push(transport);
      }
      if (!transports.length) return fail("태울 수 있는 병력이 없습니다");
      state.ops ??= [];
      const loaded = transports.reduce((sum, transport) => sum + transport.cargo.length + transport.boarding.length, 0);
      const name = transportName(record.race);
      if (plan.mission === "raid") {
        // 게릴라: 수송선마다 따로 작전. "번갈아"는 본진과 앞마당을 교대로.
        for (const transport of transports) {
          let base = plan.target === "natural" ? "natural" : "main";
          if (plan.target === "alternate") {
            base = record.raidAlt === "main" ? "natural" : "main";
            record.raidAlt = base;
          }
          if (base === "natural" && !stwNexus(state, stwOpponent(side), "natural")) base = "main";
          const op = { id: state.nextId++, side, kind: "raid", target: plan.target === "tech" ? "tech" : base, base, transports: [transport.id], riders: [], phase: "load", since: state.time, sync: false, repeat: Boolean(plan.repeat), value: 0 };
          state.ops.push(op);
          transport.op = op.id;
          transport.group = "drop";
          transport.dropPath = [];
        }
        if (side === "player") pushLog(state, side, `${name} ${transports.length}기가 견제 병력 ${loaded}기를 싣고 ${withKoreanDirection(DROP_TARGET_NAME[plan.target])} 향합니다.`, "order");
      } else {
        // 폭탄: 모두 가장자리 집결점에 모였다가 한꺼번에 들어간다.
        // 폭탄: 병력을 태운 뒤 우리 진영 가장자리에 모두 모였다가, 가장 느린 수송선 속도에 맞춰 함께 날아가 한꺼번에 내린다.
        // 예전에는 적 앞마당 바깥 집결점으로 따로따로 날아가 한 줄로 늘어섰고, 25초가 지나면 다 모이지 않아도 하나씩 들어가 차례로 격추됐다.
        const op = { id: state.nextId++, side, kind: "bomb", target: plan.target, base: "main", transports: transports.map((item) => item.id), riders: [], phase: "load", since: state.time, sync: Boolean(plan.sync), repeat: false, value: 0 };
        state.ops.push(op);
        for (const transport of transports) {
          transport.op = op.id;
          transport.group = "drop";
          transport.dropPath = [];
        }
        if (side === "player") pushLog(state, side, `${name} ${transports.length}기가 병력 ${loaded}기를 태워 우리 진영 가장자리에 모인 뒤 함께 갑니다.`, "order");
        // 정면 출격과 동시에: 남은 대기 병력을 지금 내보낸다(수송선은 정면이 맞붙을 때 들어간다).
        if (plan.sync && stwArmy(state, side).fighters.length) stwCommand(state, side, { type: "attack" });
      }
      // 기낭 갑피 없이 오버로드로 나가면 알려 준다(오버로드 2.4는 셔틀 4.4·드랍십 3.8보다 훨씬 느려 대공에 오래 노출된다).
      if (side === "player" && transports.some((item) => item.type === "overlord") && !stwResearchDone(state, side, "pneumatized")) {
        pushLog(state, side, "오버로드가 느립니다. 기낭 갑피를 연구하면 이동 속도가 1.5배(2.4 → 3.6)가 됩니다.", "warn");
      }
      return { ok: true, transports: transports.length, loaded, mission: plan.mission };
    }
    case "rally": {
      if (!stwMap(state).rallyPoints.some((point) => point.id === command.point)) return fail("알 수 없는 위치입니다");
      record.rally = command.point;
      for (const unit of state.units) if (unit.side === side && unit.squad === undefined) delete unit.fresh;
      if (side === "player") {
        const name = stwMap(state).rallyPoints.find((point) => point.id === command.point).name;
        pushLog(state, side, `집결지를 ${withKoreanDirection(name)} 옮깁니다.`, "order");
      }
      return { ok: true };
    }
    case "move": {
      // 지도 탭: 적 앞마당 안쪽이면 출격, 병력 앞쪽이면 싸우며 전진, 뒤쪽이면 교전을 끊고 후퇴.
      if (typeof command.y !== "number" || Number.isNaN(command.y)) return fail("알 수 없는 위치입니다");
      if (command.y <= stwMap(state).attackZoneY) return stwCommand(state, side, { type: "attack" });
      const y = Math.round(Math.min(stwMap(state).rallyRange.max, Math.max(stwMap(state).rallyRange.min, command.y)));
      const army = stwArmy(state, side);
      // 아군 기준 좌표로 병력 선두를 잰다(작을수록 앞). 따로 둔 부대는 본대 지시를 따르지 않으므로 세지 않는다.
      const units = [...army.fighters, ...army.attackers].filter((unit) => unit.squad === undefined);
      const front = units.length ? Math.min(...units.map((unit) => (side === "player" ? unit.y : STW_LANE_LENGTH - unit.y))) : null;
      const name = stwRallyName(y, state);
      record.rally = y;
      // 지휘관이 위치를 정하면 갓 나와 이동 공격 중이던 유닛도 그 지시(후퇴 포함)를 따른다.
      for (const unit of state.units) if (unit.side === side && unit.squad === undefined) delete unit.fresh;
      if (front !== null && y > front + 2 && (army.attack.length || units.some((unit) => (side === "player" ? unit.y : STW_LANE_LENGTH - unit.y) < y - 2))) {
        // 뒤쪽: 전군 후퇴.
        for (const unit of army.attack) unit.group = "rally";
        if (side === "player") pushLog(state, side, `전군 ${army.attack.length + army.rally.length}기가 ${withKoreanDirection(name)} 물러납니다.`, "order");
        holdAutoWave(state, side);
        return { ok: true, mode: "retreat", y };
      }
      record.autoWaveHold = false;
      if (side === "player") pushLog(state, side, units.length ? `병력이 ${withKoreanDirection(name)} 싸우며 전진합니다.` : `집결지를 ${withKoreanDirection(name)} 옮깁니다.`, "order");
      return { ok: true, mode: "advance", y };
    }
    case "attack": {
      const army = stwArmy(state, side);
      if (!army.rally.length) return fail("출격할 대기 병력이 없습니다");
      // 옵저버·오버로드만 있으면 혼자 나가 죽을 뿐이다. 동행을 끈 오버로드는 기지에 남는다.
      if (!army.fighters.length) return fail("출격할 전투 병력이 없습니다");
      // 수송선은 출격하지 않는다(본진 침투로만 움직인다).
      // 출격 버튼은 따로 둔 부대까지 모두 합쳐 내보낸다. 자동 출격(keepSquads)은 본대만 내보낸다.
      const going = army.rally.filter((unit) => (unit.type !== "overlord" || (record.escort && unit.escort)) && !STW_UNITS[unit.type].transport && (!command.keepSquads || unit.squad === undefined));
      if (!going.length) return fail("출격할 대기 병력이 없습니다");
      if (!command.keepSquads) {
        record.squads = {};
        for (const unit of army.rally) delete unit.squad;
      }
      for (const unit of going) unit.group = "attack";
      record.autoWaveHold = false;
      if (side === "player") pushLog(state, side, `대기 병력 ${going.length}기가 출격합니다!`, "order");
      return { ok: true };
    }
    case "retreat": {
      const army = stwArmy(state, side);
      if (!army.attack.length) return fail("공격 중인 병력이 없습니다");
      for (const unit of army.attack) unit.group = "rally";
      if (side === "player") pushLog(state, side, `공격 병력 ${army.attack.length}기를 집결지로 물립니다.`, "order");
      holdAutoWave(state, side);
      return { ok: true };
    }
    case "recall": {
      const point = stwMap(state).rallyPoints.find((item) => item.id === command.point);
      if (!point) return fail("알 수 없는 위치입니다");
      const army = stwArmy(state, side);
      record.rally = point.id;
      for (const unit of army.attack) unit.group = "rally";
      if (side === "player") {
        const total = army.attack.length + army.rally.length;
        const stance = point.id === "main" || point.id === "natural" ? "수비합니다" : "대기합니다";
        pushLog(state, side, total ? `전군 ${total}기가 ${withKoreanDirection(point.name)} 물러나 ${stance}.` : `집결지를 ${withKoreanDirection(point.name)} 옮깁니다.`, "order");
      }
      if (army.attack.length) holdAutoWave(state, side);
      return { ok: true, recalled: army.attack.length };
    }
    case "escort": {
      // 오버로드 동행: 완성된 오버로드 1기가 떠올라 병력을 따라다닌다(저그 전용).
      if (record.race !== "zerg") return fail("저그만 쓸 수 있습니다");
      const on = Boolean(command.on);
      if (on && !state.units.some((unit) => unit.side === side && unit.type === "overlord") && !stwOwnBuildings(state, side, "overlord", { doneOnly: true }).length) return fail("완성된 오버로드가 없습니다");
      record.escort = on;
      if (!on) for (const unit of state.units) if (unit.side === side && unit.type === "overlord") unit.escort = false;
      if (on) escortStep(state, side);
      if (side === "player") pushLog(state, side, on ? "오버로드 1기가 병력과 동행합니다. 잃으면 인구 상한이 8 줄어듭니다." : "동행 오버로드가 기지로 돌아갑니다.", "order");
      return { ok: true };
    }
    case "focus": {
      // 공격 목표: 교전 우선(맞으면 반격하고 싸울 수 있는 적부터) 또는 건물 우선(생산·기술 건물부터 깨고 유닛은 무시).
      if (command.mode !== "fight" && command.mode !== "buildings") return fail("알 수 없는 공격 목표입니다");
      record.focus = command.mode;
      if (side === "player") pushLog(state, side, command.mode === "fight" ? "공격 병력이 싸울 수 있는 적과 방어 건물부터 칩니다." : "공격 병력이 맞아도 생산·기술 건물부터 깹니다.", "order");
      return { ok: true };
    }
    case "autoWave": {
      record.autoWave = Math.max(0, Math.round(command.size ?? 0));
      record.autoWaveHold = false;
      return { ok: true };
    }
    case "scout": {
      const check = stwScoutCheck(state, side);
      if (!check.ok) return check;
      record.probes -= 1;
      const start = stwPoint(side, { x: 20, y: 88 });
      const workerType = stwRace(state, side).worker;
      const unit = spawnUnit(state, side, workerType, start.x, start.y);
      unit.group = "scout";
      unit.scoutPhase = "out";
      // 자원 정찰: 레인 왼쪽 가장자리로 들어가 적 본진 광물 줄 뒤(가스 둘과 광물)를 훑고 오른쪽 가장자리로 빠져나온다.
      // 일꾼 수·가스·확장을 보고 돌아온다. 가운데로 가면 적 앞마당(초반 적 병력이 모이는 자리)을 그대로 지나가 잡힌다.
      if (command.target === "resources") {
        const foe = stwOpponent(side);
        unit.scoutMode = "resources";
        unit.scoutPath = stwMap(state).scoutPath.map((point) => stwPoint(foe, point));
      }
      if (side === "player") pushLog(state, side, `${STW_UNITS[workerType].name} 1기를 ${withKoreanDirection(unit.scoutMode === "resources" ? "적 자원 지대" : "적 본진")} 정찰 보냅니다.`, "order");
      return { ok: true };
    }
    case "scoutRecall": {
      // 정찰 되돌리기: 가는 중인 정찰 일꾼을 불러들인다. 기본은 가장 최근에 보낸 1기(잘못 보낸 정찰 취소), all이면 그 종류 전부.
      const outgoing = state.units.filter((unit) => unit.side === side && unit.hp > 0 && unit.group === "scout" && unit.scoutPhase === "out"
        && (!command.target || (command.target === "resources") === (unit.scoutMode === "resources")));
      if (!outgoing.length) return fail("되돌릴 정찰 일꾼이 없습니다");
      const picked = command.all ? outgoing : [outgoing.reduce((latest, unit) => (unit.id > latest.id ? unit : latest))];
      for (const unit of picked) {
        unit.scoutPhase = "back";
        unit.scoutPath = undefined;
        unit.scoutRecalled = true;
      }
      if (side === "player") pushLog(state, side, `정찰 ${STW_UNITS[picked[0].type].name} ${picked.length}기를 되돌립니다.`, "order");
      return { ok: true, count: picked.length };
    }
    case "cancelBuild": {
      const building = state.buildings.find((item) => item.id === command.buildingId && item.side === side);
      if (!building) return fail("건물을 찾을 수 없습니다");
      if (stwDone(building)) return fail("이미 완성된 건물입니다");
      const def = STW_BUILDINGS[building.type];
      const minerals = Math.floor(def.minerals * STW_CANCEL_REFUND);
      const gas = Math.floor(def.gas * STW_CANCEL_REFUND);
      record.minerals += minerals;
      record.gas += gas;
      state.buildings = state.buildings.filter((item) => item !== building);
      const name = def.base ? `앞마당 ${def.name}` : def.name;
      if (side === "player") pushLog(state, side, `${withKoreanObject(name)} 취소했습니다. ${refundText(minerals, gas)} 환불`, "info");
      return { ok: true, minerals, gas };
    }
    case "cancelProbe": {
      const worker = STW_UNITS[stwRace(state, side).worker];
      const nexus = stwOwnBuildings(state, side, stwRace(state, side).base).filter((item) => item.queue.length).sort((a, b) => b.queue.length - a.queue.length)[0];
      if (!nexus) return fail(`대기 중인 ${withKoreanSubject(worker.name)} 없습니다`);
      nexus.queue.pop();
      record.minerals += worker.minerals;
      if (side === "player") pushLog(state, side, `${worker.name} 생산을 취소했습니다. ${refundText(worker.minerals, 0)} 환불`, "info");
      return { ok: true, minerals: worker.minerals, gas: 0 };
    }
    case "cancelResearch": {
      const building = state.buildings.find((item) => item.side === side && item.research?.id === command.research);
      if (!building) return fail("진행 중인 연구가 아닙니다");
      const def = STW_RESEARCH[command.research];
      building.research = null;
      delete record.research[command.research];
      record.minerals += def.minerals;
      record.gas += def.gas;
      if (side === "player") pushLog(state, side, `${withKoreanObject(def.name)} 취소했습니다. ${refundText(def.minerals, def.gas)} 환불`, "info");
      return { ok: true, minerals: def.minerals, gas: def.gas };
    }
    case "cancelUnit": {
      const producerId = command.buildingId ?? command.gatewayId;
      const gateway = state.buildings.find((item) => item.id === producerId && item.side === side && STW_PRODUCERS.includes(item.type));
      if (!gateway?.current) return fail("생산 중인 유닛이 없습니다");
      const def = STW_UNITS[gateway.current.unit];
      gateway.current = null;
      // 라인을 그대로 두면 다음 틱에 같은 유닛을 다시 소환하므로 라인도 멈춘다.
      gateway.line = null;
      gateway.blocked = "정지";
      record.minerals += def.minerals;
      record.gas += def.gas;
      if (side === "player") pushLog(state, side, `${withKoreanObject(def.name)} 취소하고 ${withKoreanObject(STW_BUILDINGS[gateway.type].name)} 멈췄습니다. ${refundText(def.minerals, def.gas)} 환불`, "info");
      return { ok: true, minerals: def.minerals, gas: def.gas };
    }
    default:
      return fail("알 수 없는 명령입니다");
  }
}

function refundText(minerals, gas) {
  return gas ? `광물 ${minerals} · 가스 ${gas}` : `광물 ${minerals}`;
}

function spawnUnit(state, side, type, x, y) {
  const def = STW_UNITS[type];
  const unit = {
    id: state.nextId++,
    kind: "unit",
    side,
    type,
    x,
    y,
    hp: def.hp,
    maxHp: def.hp,
    shields: def.shields,
    maxShields: def.shields,
    armor: def.armor,
    size: def.size,
    radius: def.radius,
    cooldown: 0,
    energy: def.energy ?? 0,
    group: "rally",
    targetId: null,
    heading: side === "player" ? -Math.PI / 2 : Math.PI / 2,
    lastHit: -99,
    scoutPhase: null,
  };
  state.units.push(unit);
  return unit;
}

/** 테스트와 점검용: 지정 위치에 유닛을 바로 배치. */
export function stwSpawnUnitAt(state, side, type, x, y, group = "rally") {
  const unit = spawnUnit(state, side, type, x, y);
  unit.group = group;
  return unit;
}

/* ───────── 시뮬레이션 ───────── */

/**
 * @param {any} state
 * @param {number} seconds
 * @param {((state: any, side: string) => void) | null} [aiThink]
 */
export function advanceStarswar(state, seconds, aiThink = null) {
  state.accumulator += Math.min(seconds, 1);
  let steps = 0;
  while (state.accumulator >= STW_TICK && steps < 40) {
    state.accumulator -= STW_TICK;
    stepStarswar(state, aiThink);
    steps += 1;
  }
  return steps;
}

/**
 * @param {any} state
 * @param {((state: any, side: string) => void) | null} [aiThink]
 */
export function stepStarswar(state, aiThink = null) {
  if (state.status !== "playing") return;
  const dt = STW_TICK;
  state.time = Math.round((state.time + dt) * 1000) / 1000;
  if (aiThink && !state.finalBattle) for (const side of state.aiSides) aiThink(state, side);
  for (const side of STW_SIDES) {
    stepEconomy(state, side, dt);
    if (state.sides[side].escort) escortStep(state, side);
  }
  state.pendingHits = [];
  stepBuildings(state, dt);
  stepOps(state);
  stepUnits(state, dt);
  stepStorms(state, dt);
  stepStatuses(state, dt);
  applyHits(state);
  regenerate(state, dt);
  stepEffects(state, dt);
  cleanup(state);
  if (Math.round(state.time * 10) % 5 === 0) updateVision(state);
  autoWaves(state);
  checkVictory(state);
  if (Math.round(state.time * 10) % (STW_HISTORY_EVERY * 10) === 0 || state.status === "over") recordHistory(state);
}

/** 경기 기록 간격(초): 결과 화면의 병력 가치 그래프와 최대 인구에 쓴다. */
const STW_HISTORY_EVERY = 10;

/** 유닛 하나의 값(광물 + 가스). 두 마리씩 나오는 저글링은 절반. */
function armyValueOf(unit) {
  const def = STW_UNITS[unit.type];
  return (def.minerals + def.gas) / (def.pair ? 2 : 1);
}

/** 양쪽의 인구·병력 가치(일꾼 제외)·일꾼 수를 기록한다. */
function recordHistory(state) {
  state.history ??= [];
  const point = { t: Math.round(state.time) };
  for (const side of STW_SIDES) {
    const supply = stwSupply(state, side).used;
    const army = state.units.filter((unit) => unit.side === side && !isWorker(unit) && unit.group !== "scout").reduce((sum, unit) => sum + armyValueOf(unit), 0);
    // 병력 구성(일꾼·정찰 제외, 종류별 수)과 쓰지 않고 쌓아 둔 자원도 남긴다(AI 개선 자료에 쓴다).
    const mix = {};
    for (const unit of state.units) if (unit.side === side && !isWorker(unit) && unit.group !== "scout" && unit.hp > 0) mix[unit.type] = (mix[unit.type] ?? 0) + 1;
    const record = state.sides[side];
    point[side] = { supply, army: Math.round(army), workers: record.probes, minerals: Math.floor(record.minerals), gas: Math.floor(record.gas), mix };
    const stats = state.sides[side].stats;
    stats.supplyPeak = Math.max(stats.supplyPeak ?? 0, supply);
  }
  if (state.history.at(-1)?.t !== point.t) state.history.push(point);
}

/* ───────── 실험실 ───────── */

/** 선행 조건 하나(건물 id 또는 연구 id)를 갖춘다: 연구는 끝난 것으로, 건물은 지어서 완성한다. 자리가 없으면 건너뛴다. */
function grantPrerequisite(state, side, id, seen = new Set()) {
  if (seen.has(id)) return;
  seen.add(id);
  const record = state.sides[side];
  const research = STW_RESEARCH[id];
  if (research) {
    for (const need of research.requires ?? []) grantPrerequisite(state, side, need, seen);
    if (research.at) grantPrerequisite(state, side, research.at, seen);
    record.research[id] = "done";
    return;
  }
  const def = STW_BUILDINGS[id];
  if (!def || def.base || (def.race && def.race !== record.race)) return;
  if (stwOwnBuildings(state, side, id).length) return;
  if (def.requires) grantPrerequisite(state, side, def.requires, seen);
  if (def.requiresResearch) grantPrerequisite(state, side, def.requiresResearch, seen);
  const minerals = record.minerals;
  const gas = record.gas;
  record.minerals = 1e6;
  record.gas = 1e6;
  stwCommand(state, side, { type: "build", building: id });
  record.minerals = minerals;
  record.gas = gas;
  for (const building of stwOwnBuildings(state, side, id)) {
    building.progress = 1;
    building.hp = building.maxHp;
    building.shields = building.maxShields;
  }
}

/** 실험실 병력의 대형: 근접 앞, 원거리 가운데, 마법·지원 뒤. 한 줄 12기, 아군 기준 y에서 뒤로 쌓는다. */
function labFormation(state, side, units, frontY, group) {
  const order = { melee: 0, ranged: 1, siege: 2, air: 3, caster: 4, support: 5 };
  const list = units.sort((a, b) => order[STW_UNITS[a].role] - order[STW_UNITS[b].role]);
  list.forEach((type, index) => {
    const row = Math.floor(index / 12);
    const inRow = Math.min(12, list.length - row * 12);
    const column = index % 12;
    const point = stwPoint(side, { x: STW_LANE_WIDTH / 2 + (column - (inRow - 1) / 2) * 2.7, y: frontY + row * 2.6 });
    const unit = spawnUnit(state, side, type, point.x, point.y);
    unit.group = group;
  });
}

/**
 * 실험실: 원하는 시각·건물·병력·연구·전략으로 경기를 바로 세운다(테스트용).
 * sides.{player,enemy}:
 * - control: 아군은 "manual"(직접 지휘) 또는 "ai", 적은 "fight"(운영하지 않고 주어진 병력으로만 싸움) 또는 "ai"
 * - persona: AI 운영일 때의 전략(그 종족의 성향 id). 없으면 무작위
 * - buildings {건물: 수}, units {유닛: 수}, research [연구 id], workers, minerals, gas, natural(앞마당 있음)
 * - energy: 마법 유닛의 에너지. "full"(기본, 최대치) 또는 "fresh"(갓 나온 유닛의 시작 에너지)
 * placement: "clash"(두 병력이 맵 가운데에서 마주 보고 공격 병력으로 시작) 또는 "home"(각자 집결지에서 대기).
 * 옛 설정의 enemyAi("fight" | "full")도 받는다.
 * 필요한 생산·테크 건물과 선행 연구는 자동으로 갖추고, 인구 상한은 건물 없이 100으로 채운다.
 * 자리가 모자라 짓지 못한 건물은 기록으로 알린다.
 */
export function stwCreateScenario({ difficulty = "normal", seed = 1, time = 0, races = {}, placement = "clash", enemyAi = "fight", sides = {}, map = "plain" } = {}) {
  const control = {
    player: sides.player?.control === "ai" ? "ai" : "manual",
    enemy: sides.enemy?.control ? (sides.enemy.control === "ai" ? "ai" : "fight") : enemyAi === "full" ? "ai" : "fight",
  };
  const personas = {};
  for (const side of STW_SIDES) {
    const persona = sides[side]?.persona;
    const race = STW_RACES[races[side]] ? races[side] : "protoss";
    if (persona && STW_AI_PERSONAS[persona]?.race === race) personas[side] = persona;
  }
  const aiSides = STW_SIDES.filter((side) => control[side] === "ai");
  const state = createStarswarGame({ difficulty, seed, races, aiSides, personas, map });
  state.lab = { placement, control };
  state.time = Math.max(0, Math.round(time));
  const missing = [];
  for (const side of STW_SIDES) {
    const plan = sides[side] ?? {};
    const record = state.sides[side];
    const race = record.race;
    record.bonusSupply = STW_ECONOMY.supplyLimit;
    if (plan.natural) {
      record.minerals = 1e6;
      stwCommand(state, side, { type: "build", building: "expand" });
    }
    const types = Object.entries(plan.units ?? {}).filter(([type, count]) => STW_UNITS[type] && (STW_UNITS[type].race ?? "protoss") === race && count > 0);
    for (const [type] of types) {
      const def = STW_UNITS[type];
      if (def.from && STW_BUILDINGS[def.from] && !STW_BUILDINGS[def.from].base) grantPrerequisite(state, side, def.from);
      if (def.requires) grantPrerequisite(state, side, def.requires);
      if (def.requiresResearch) grantPrerequisite(state, side, def.requiresResearch);
    }
    // 고른 건물을 그 수만큼(이미 있는 것 포함) 짓는다. 선행 건물·연구는 먼저 갖춘다.
    for (const [type, wanted] of Object.entries(plan.buildings ?? {})) {
      const def = STW_BUILDINGS[type];
      if (!def || def.base || (def.race ?? "protoss") !== race || !(wanted > 0)) continue;
      grantPrerequisite(state, side, type);
      const count = def.unique ? 1 : Math.min(30, Math.round(wanted));
      while (stwOwnBuildings(state, side, type).length < count) {
        const before = stwOwnBuildings(state, side, type).length;
        record.minerals = 1e6;
        record.gas = 1e6;
        stwCommand(state, side, { type: "build", building: type });
        if (stwOwnBuildings(state, side, type).length === before) {
          missing.push({ side, type, short: count - before });
          break;
        }
      }
    }
    for (const id of plan.research ?? []) if (STW_RESEARCH[id]) grantPrerequisite(state, side, id);
    for (const building of state.buildings) {
      if (building.side !== side) continue;
      building.progress = 1;
      building.hp = building.maxHp;
      building.shields = building.maxShields;
    }
    record.probes = Math.max(0, Math.round(plan.workers ?? 20));
    record.minerals = Math.max(0, plan.minerals ?? 500);
    record.gas = Math.max(0, plan.gas ?? 300);
    const army = types.flatMap(([type, count]) => Array(Math.round(count)).fill(type));
    const before = state.units.length;
    if (placement === "clash") labFormation(state, side, army, 60, "attack");
    else labFormation(state, side, army, 78, "rally");
    // 마법 에너지: 기본은 가득(그 시각까지 쌓였다고 본다). "fresh"면 갓 나온 유닛처럼 시작 에너지.
    if (plan.energy !== "fresh") {
      for (const unit of state.units.slice(before)) if (STW_UNITS[unit.type].maxEnergy) unit.energy = STW_UNITS[unit.type].maxEnergy;
    }
  }
  // 생산 라인은 비운 채 시작한다(기본 라인이 걸려 있으면 "교전만"인 적도 저글링·질럿을 계속 뽑는다). 아군 생산은 직접 켠다.
  for (const building of state.buildings) {
    building.line = null;
    building.current = null;
    building.queue = [];
  }
  // 상황을 세우며 지은 건물 기록은 지우고, 시작 시점의 인구·병력을 첫 기록으로 남긴다.
  // 재현 정보는 실험실 설정 자체다(설정을 다시 넣으면 같은 상황이 선다).
  state.log = [];
  state.history = [];
  state.chronicle = [];
  state.replay = { scenario: JSON.parse(JSON.stringify({ difficulty, seed, time, races, placement, enemyAi, sides, ...(state.map !== "plain" ? { map: state.map } : {}) })), commands: [] };
  recordHistory(state);
  const enemyName = STW_RACES[state.sides.enemy.race].name;
  pushLog(state, "player", `실험실: ${stwClock(state.time)} 상황, ${enemyName} 상대로 시작합니다.`, "info");
  for (const item of missing) {
    pushLog(state, "player", `실험실: ${item.side === "player" ? "아군" : "적"} ${STW_BUILDINGS[item.type].name} ${item.short}개는 자리가 모자라 짓지 못했습니다.`, "warn");
  }
  return state;
}

/** 저장 형식 판. 엔진 상태의 모양이 바뀌어 옛 저장을 읽을 수 없게 되면 올린다. */
export const STW_SAVE_VERSION = 1;

/** 진행 중인 경기를 문자열로(브라우저 저장용). 이번 틱의 예약 피해(객체 참조)는 비운다. */
export function stwSerialize(state) {
  return JSON.stringify({ ...state, pendingHits: [], saveVersion: STW_SAVE_VERSION });
}

/** 저장한 경기를 되살린다. 형식이 맞지 않거나 끝난 경기면 null. */
export function stwRestore(text) {
  try {
    const state = JSON.parse(text);
    if (!state || state.saveVersion !== STW_SAVE_VERSION || state.status !== "playing") return null;
    if (!Array.isArray(state.units) || !Array.isArray(state.buildings) || !state.sides?.player || !state.sides?.enemy) return null;
    state.pendingHits = [];
    state.effects ??= [];
    state.history ??= [];
    return state;
  } catch {
    return null;
  }
}

function stepEconomy(state, side, dt) {
  const record = state.sides[side];
  const split = stwWorkerSplit(state, side);
  const multiplier = incomeMultiplier(state, side);
  for (const base of ["main", "natural"]) {
    if (!split[base]) continue;
    const nexus = stwNexus(state, side, base);
    // 대피: 기지 건물 12칸 안이나 광물 줄 구역에 적 전투 유닛이 있으면 일꾼이 피해 채취가 줄어든다.
    const line = mineralCenter(state, side, base);
    const threatened = nexus && state.units.some((unit) => unit.side !== side && unit.hp > 0 && !isPassive(unit) && unit.group !== "cargo"
      && (distance(unit.x, unit.y, nexus.x, nexus.y) < 12 || distance(unit.x, unit.y, line.x, line.y) < STW_ECONOMY.mineralZone));
    const mined = Math.min(record.bases[base].minerals, mineralRate(split[base], base === "natural" ? stwMap(state).naturalRate : 1) * dt * (threatened ? STW_ECONOMY.evacuation : 1));
    record.bases[base].minerals -= mined;
    record.minerals += mined * multiplier;
    record.stats.minerals += mined * multiplier;
    if (side === "player") {
      const name = base === "main" ? "본진" : "앞마당";
      if (record.bases[base].minerals <= 0) alertOnce(state, `dry:${base}`, Infinity, side, `${name} 광물이 바닥났습니다.`, "danger");
      else if (record.bases[base].minerals < STW_ECONOMY.lowMinerals) alertOnce(state, `low:${base}`, Infinity, side, base === "main" && !stwNexus(state, side, "natural") ? "본진 광물이 곧 바닥납니다. 앞마당 확장을 생각하세요." : `${name} 광물이 곧 바닥납니다.`, "warn");
    }
  }
  const gas = split.gas * STW_ECONOMY.gasPerProbe * dt * multiplier;
  record.gas += gas;
  record.stats.gas += gas;
}

function stepBuildings(state, dt) {
  for (const building of [...state.buildings]) {
    const def = STW_BUILDINGS[building.type];
    const record = state.sides[building.side];
    if (!stwDone(building)) {
      building.progress = Math.min(1, building.progress + dt / def.time);
      building.hp = Math.min(building.maxHp, building.hp + (building.maxHp * 0.9 * dt) / def.time);
      building.shields = Math.min(building.maxShields, building.shields + (building.maxShields * 0.9 * dt) / def.time);
      if (stwDone(building) && building.side === "player") pushLog(state, "player", `${withKoreanSubject(def.name)} 완성되었습니다.`, "good");
      continue;
    }
    if (building.queue.length) {
      const item = building.queue[0];
      item.remaining -= dt;
      if (item.remaining <= 0) {
        building.queue.shift();
        record.probes += 1;
        record.stats.produced += 1;
      }
    }
    if (STW_PRODUCERS.includes(building.type)) stepProducer(state, building, record, dt);
    if (building.research) {
      building.research.remaining -= dt;
      if (building.research.remaining <= 0) {
        const id = building.research.id;
        building.research = null;
        record.research[id] = "done";
        if (building.side === "player") pushLog(state, "player", `${withKoreanSubject(STW_RESEARCH[id].name)} 완료되었습니다.`, "good");
      }
    }
    const fullDef = STW_BUILDINGS[building.type];
    if (fullDef.damage) cannonStep(state, building, dt);
    if (fullDef.energyRegen) building.energy = Math.min(fullDef.maxEnergy, building.energy + fullDef.energyRegen * dt);
  }
}

/**
 * 사람이 지휘하는 진영이 공격 병력을 내보내 싸우는 동안에는 새로 나온 전투 유닛이 집결지 대신 공격 병력에 합류한다.
 * 출격한 병력은 앞에서 싸우는데 새 병력만 집결지에 쌓이던 것을 막는다. 후퇴하거나 공격 병력이 없으면 예전처럼 집결지로 간다.
 * 일꾼·수송선·오버로드는 따르지 않는다. AI는 출격 판단(manageArmy)이 따로 있어 쓰지 않는다.
 */
function joinsAttack(state, side, unitType) {
  if (state.aiSides.includes(side)) return false;
  const def = STW_UNITS[unitType];
  if (def.worker || def.transport || unitType === "overlord") return false;
  if (!stwArmy(state, side).attackers.length) return false;
  if (side === "player") alertOnce(state, "reinforce", 20, "player", "새 병력이 공격 병력에 합류하러 갑니다.", "order");
  return true;
}

function stepProducer(state, building, record, dt) {
  if (building.current) {
    building.current.remaining -= dt;
    if (building.current.remaining > 0) return;
    const unitType = building.current.unit;
    building.current = null;
    const forward = stwForward(building.side);
    // 저글링은 한 번에 2기가 나온다.
    // 그 종류를 따로 둔 부대가 있으면 새 유닛은 그 부대로 간다. 아니면 싸우는 공격 병력에 합류하거나 집결지로.
    const squad = record.squads?.[unitType] !== undefined;
    const reinforce = !squad && joinsAttack(state, building.side, unitType);
    for (let index = 0; index < (STW_UNITS[unitType].pair ? 2 : 1); index += 1) {
      const unit = spawnUnit(state, building.side, unitType, building.x + (nextRandom(state) - 0.5) * 2 + index * 1.4, building.y + forward * (building.radius + 1.5));
      // 갓 나온 유닛은 제자리에 닿을 때까지 이동 공격: 가는 길에 만난 적과 싸운다(후퇴로 보지 않는다).
      unit.fresh = true;
      if (squad) unit.squad = unitType;
      if (reinforce) {
        unit.group = "attack";
        unit.reinforcing = true;
      }
      record.stats.produced += 1;
      state.effects.push({ kind: "warp", side: building.side, x1: unit.x, y1: unit.y, x2: unit.x, y2: unit.y, ttl: 0.6, max: 0.6, radius: unit.radius * 2 });
    }
  }
  if (!building.line) {
    building.blocked = "정지";
    return;
  }
  const def = STW_UNITS[building.line];
  const lock = stwUnitLock(state, building.side, building.line);
  if (lock) {
    building.blocked = lock;
    return;
  }
  const supply = stwSupply(state, building.side);
  if (supply.used + batchSupply(def) > supply.cap) {
    building.blocked = "인구 부족";
    return;
  }
  if (record.minerals < def.minerals || record.gas < def.gas) {
    building.blocked = record.minerals < def.minerals ? "광물 대기" : "가스 대기";
    return;
  }
  record.minerals -= def.minerals;
  record.gas -= def.gas;
  building.current = { unit: building.line, remaining: def.time, total: def.time };
  building.blocked = null;
}

/** 동행이 켜져 있는데 떠 있는 오버로드가 없으면 완성된 오버로드 건물 하나를 유닛으로 띄운다. */
function escortStep(state, side) {
  if (state.units.some((unit) => unit.side === side && unit.type === "overlord" && unit.escort)) return;
  // 침투를 마치고 돌아와 떠 있는 오버로드가 있으면 그것을 먼저 동행시킨다.
  const idle = state.units.find((unit) => unit.side === side && unit.type === "overlord" && !unit.cargo?.length && !unit.dropPath?.length);
  if (idle) {
    idle.escort = true;
    idle.group = "rally";
    return;
  }
  const building = stwOwnBuildings(state, side, "overlord", { doneOnly: true }).sort((a, b) => b.id - a.id)[0];
  if (!building) return;
  state.buildings = state.buildings.filter((item) => item !== building);
  const unit = spawnUnit(state, side, "overlord", building.x, building.y);
  unit.hp = Math.min(unit.maxHp, building.hp);
  unit.group = "rally";
  unit.escort = true;
}

/* ───────── 전투 ───────── */

/** 업그레이드가 적용되는 유닛: 프로토스·저그는 모든 지상 유닛, 테란은 보병(bio)만. */
function upgradable(unit) {
  const def = STW_UNITS[unit.type];
  return def.race === "protoss" || def.race === "zerg" || Boolean(def.bio);
}

function researchCount(state, side, ids) {
  return ids.filter((id) => stwResearchDone(state, side, id)).length;
}

function weaponLevel(state, unit) {
  if (!upgradable(unit)) return 0;
  const race = stwRace(state, unit.side);
  // 저그는 근접·원거리 공격 업그레이드가 따로 있다.
  const group = race.weaponGroups?.[STW_UNITS[unit.type].weaponGroup];
  return researchCount(state, unit.side, group ?? race.weapons);
}

function armorBonus(state, target) {
  if (target.kind !== "unit" || !upgradable(target)) return 0;
  const chitin = target.type === "ultra" && stwResearchDone(state, target.side, "chitin") ? 2 : 0;
  return researchCount(state, target.side, stwRace(state, target.side).armor) + chitin;
}

function shieldArmor(state, target) {
  return researchCount(state, target.side, stwRace(state, target.side).shields);
}

/** 한 번 공격의 (보호막, 체력) 피해. 폭발형은 크기별 배율, 보호막 먼저, 체력에는 방어력 적용. */
/** 쓸 무기: 공중 대상에 따로 공중 무기가 있으면 그것(스카웃·레이스·골리앗), 아니면 기본 무기. */
function weaponFor(def, target) {
  return def.air && target && isAirborne(target) ? def.air : def;
}

export function stwHitDamage(state, attacker, target) {
  const def = attacker.kind === "unit" ? STW_UNITS[attacker.type] : STW_BUILDINGS[attacker.type];
  const weapon = attacker.sieged ? { ...def.siege, damageType: def.siege.damageType ?? def.damageType } : weaponFor(def, target);
  let perHit = weapon.damage + (attacker.kind === "unit" ? weaponLevel(state, attacker) * (def.weaponStep ?? 0) : 0);
  if (attacker.type === "reaver" && stwResearchDone(state, attacker.side, "scarab")) perHit += 25;
  const raw = perHit * STW_SIZE_MULTIPLIER[weapon.damageType][target.size ?? "large"];
  const hits = [];
  // 캐리어: 인터셉터 수만큼 맞힌다(수용량 연구 뒤 8기).
  const count = attacker.type === "carrier" && stwResearchDone(state, attacker.side, "carrierCapacity") ? 8 : weapon.hits ?? 1;
  for (let i = 0; i < count; i += 1) hits.push(raw);
  return hits;
}

function applyDamage(state, target, amount, { ignoreArmor = false } = {}) {
  // 스테이시스 필드 안의 유닛은 다치지 않는다.
  if (target.kind === "unit" && inStasis(state, target)) return;
  // 마지막으로 무엇이든 맞은 때(자원이 바닥난 뒤 싸움이 멈췄는지 판단한다).
  if (amount > 0) state.lastDamageAt = state.time;
  let remaining = amount;
  // 디펜시브 매트릭스가 먼저 흡수한다.
  if (target.matrix && state.time < target.matrix.until && target.matrix.hp > 0) {
    const absorbed = Math.min(target.matrix.hp, remaining);
    target.matrix.hp -= absorbed;
    remaining -= absorbed;
    if (remaining <= 0) return;
  }
  if (target.shields > 0) {
    const reduced = ignoreArmor ? remaining : Math.max(0.5, remaining - shieldArmor(state, target));
    const absorbed = Math.min(target.shields, reduced);
    target.shields -= absorbed;
    remaining = reduced - absorbed;
    if (remaining <= 0) return;
  }
  // 디바우러의 산성 포자는 쌓인 만큼 방어력을 깎는다.
  const acid = target.acid && state.time < target.acid.until ? target.acid.stacks : 0;
  const armor = ignoreArmor ? 0 : target.armor + armorBonus(state, target) - acid;
  target.hp -= Math.max(0.5, remaining - armor);
}

function queueHit(state, attacker, target) {
  const def = attacker.kind === "unit" ? STW_UNITS[attacker.type] : STW_BUILDINGS[attacker.type];
  // 다크 스웜 안의 지상 유닛에는 원거리 공격이 통하지 않는다(범위 공격 대상에서도 빠진다).
  if (blockedBySwarm(state, attacker, target)) return;
  // 캐리어: 둘레를 나는 인터셉터가 공격 일부를 대신 맞는다.
  const decoy = target.kind === "unit" ? STW_UNITS[target.type].decoy : 0;
  if (decoy && nextRandom(state) < decoy) {
    state.effects.push({ kind: "decoy", side: target.side, x1: target.x, y1: target.y, x2: target.x, y2: target.y, ttl: 0.2, max: 0.2 });
    return;
  }
  state.pendingHits.push({ attacker, target, hits: stwHitDamage(state, attacker, target) });
  if (def.acid && target.kind === "unit") {
    const stacks = target.acid && state.time < target.acid.until ? target.acid.stacks : 0;
    target.acid = { stacks: Math.min(9, stacks + 1), until: state.time + 20 };
  }
  // 뮤탈리스크 튕김: 처음 맞은 적 옆의 다른 적(지상·공중 가리지 않음)에게 1/3, 다시 1/9.
  if (def.bounce && target.kind === "unit") {
    let from = target;
    let factor = 1;
    const hit = new Set([target]);
    for (let step = 1; step < def.bounce.count; step += 1) {
      factor *= def.bounce.factor;
      let next = null;
      let best = 3;
      for (const other of state.units) {
        if (hit.has(other) || other.side === attacker.side || other.hp <= 0 || !targetable(state, attacker, other)) continue;
        const d = distance(other.x, other.y, from.x, from.y) - other.radius;
        if (d < best) {
          best = d;
          next = other;
        }
      }
      if (!next) break;
      hit.add(next);
      state.pendingHits.push({ attacker, target: next, hits: stwHitDamage(state, attacker, next).map((amount) => amount * factor) });
      from = next;
    }
  }
  const splash = attacker.kind === "unit" ? (attacker.sieged ? def.siege.splash : def.splash) : null;
  if (!splash) return;
  // 범위 공격: 대상 주변의 다른 적에게도 비율만큼 피해(은폐 여부와 무관). 지상 범위는 지상만, 커세어의 공중 범위는 공중만.
  for (const other of state.units) {
    if (other === target || other.side === attacker.side || other.hp <= 0 || other.group === "cargo" || isFlying(other) !== Boolean(splash.air)) continue;
    if (distance(other.x, other.y, target.x, target.y) > splash.radius + other.radius * 0.5) continue;
    if (blockedBySwarm(state, attacker, other)) continue;
    state.pendingHits.push({ attacker, target: other, hits: stwHitDamage(state, attacker, other).map((amount) => amount * splash.factor) });
  }
}

/** 다크 스웜이 덮고 있는 지상 유닛인지. */
function underSwarm(state, unit) {
  if (unit.kind !== "unit" || isFlying(unit)) return false;
  return (state.zones ?? []).some((zone) => zone.kind === "swarm" && distance(zone.x, zone.y, unit.x, unit.y) <= zone.radius + unit.radius * 0.5);
}

/** 원거리 공격이 다크 스웜에 막히는지. 근접 공격과 리버·아콘·성큰(땅속 촉수)은 통한다. 럴커·스톰·플레이그는 다른 길로 맞힌다. */
function blockedBySwarm(state, attacker, target) {
  if (!state.zones?.length || !underSwarm(state, target)) return false;
  if (attacker.kind === "building") return attacker.type !== "sunken";
  const def = STW_UNITS[attacker.type];
  return def.role !== "melee" && attacker.type !== "reaver" && attacker.type !== "archon";
}

/**
 * 은폐 유닛이 상대 진영에 탐지되는지: 스캔 범위, 탐지 유닛(옵저버·동행 오버로드) 반경, 탐지 건물 반경,
 * 그리고 지역 탐지 — 완성된 탐지 건물이 하나라도 있는 기지의 구역 안이면 드러난다.
 */
export function stwDetected(state, unit, bySide) {
  if (!isCloaked(unit, state)) return true;
  return detectionCovers(state, bySide, unit);
}

/** bySide의 탐지(스캔, 탐지 유닛, 탐지 건물과 그 기지 구역)가 이 자리(x, y, radius)에 닿는지. */
function detectionCovers(state, bySide, spot) {
  for (const scan of state.scans ?? []) {
    if (scan.side === bySide && distance(scan.x, scan.y, spot.x, spot.y) <= scan.radius) return true;
  }
  for (const other of state.units) {
    const radius = other.side === bySide ? STW_UNITS[other.type].detector : 0;
    if (radius && other.hp > 0 && distance(other.x, other.y, spot.x, spot.y) <= radius) return true;
  }
  for (const building of state.buildings) {
    const radius = building.side === bySide && stwDone(building) ? STW_BUILDINGS[building.type].detector : 0;
    if (!radius) continue;
    if (distance(building.x, building.y, spot.x, spot.y) <= radius) return true;
    if (inBaseZone(state, bySide, building.base, spot)) return true;
  }
  return false;
}

/** 스스로 은폐하는 공격 유닛(다크템플러, 은폐 연구 뒤의 레이스·고스트). 땅속 럴커와 아비터 은폐장에 기댄 유닛은 뺀다. */
function selfCloaked(state, unit) {
  const def = STW_UNITS[unit.type];
  if (!def.damage || def.burrow || ensnared(state, unit)) return false;
  return Boolean(def.cloaked) || Boolean(def.cloakResearch && stwResearchDone(state, unit.side, def.cloakResearch));
}

/** 비킨 뒤 탐지 안으로 다시 들어가지 않는 시간(초). 그동안 탐지 밖의 적만 치고, 탐지 안으로 들어가는 걸음은 무른다. */
const CLOAK_WARY = 10;

/** 탐지에 맞고 비킨 지 얼마 안 된 은폐 유닛. */
function wary(state, unit) {
  return (unit.waryUntil ?? 0) > state.time && selfCloaked(state, unit);
}

/**
 * 경계 중인 은폐 유닛은 탐지 안으로 걸어 들어가지 않는다: 이번 틱에 탐지 밖에서 안으로 들어갔으면 제자리로 되돌린다.
 * 그래서 탐지 경계 밖에서 기다리다가 탐지 밖으로 나온 적만 친다(들어갔다 맞고 비키기를 되풀이하지 않는다).
 */
function holdOutsideDetection(state, starts) {
  for (const [unit, start] of starts) {
    if (unit.hp <= 0 || !detectionCovers(state, stwOpponent(unit.side), unit)) continue;
    unit.x = start.x;
    unit.y = start.y;
  }
}

/**
 * 은폐 유닛의 회피: 적에게 탐지된 채 맞으면(1초 안) 적 탐지가 닿지 않는 가장 가까운 자리로 비켜선다(최대 5초).
 * 비킨 뒤에는 탐지 밖의 적부터 노린다(findTarget). 숨을 데가 없으면 그 자리에서 싸운다.
 */
/** 한 기(유닛·건물)의 지금 전투력: √(초당 피해 × 남은 체력·보호막). 무기가 없으면 0. */
function livePower(item) {
  const def = item.kind === "unit" ? STW_UNITS[item.type] : STW_BUILDINGS[item.type];
  if (!def?.damage) return 0;
  const dps = (def.damage * (def.hits ?? 1)) / (def.cooldown ?? 1);
  return Math.sqrt(dps * Math.max(1, item.hp + (item.shields ?? 0)));
}

/** 탐지된 은폐 유닛이 싸울지 따지는 반경과 문턱. */
const CLOAK_FIGHT_RADIUS = 9;
/** 이 반경 안의 탐지원(탐지 건물·탐지 유닛)은 직접 깨러 간다. 방어 건물은 기지 구역 전체를 쏘므로 사거리보다 넓게 본다. */
const CLOAK_DETECTOR_REACH = 12;
/** 우리 힘이 상대 힘의 이 배수를 넘으면: 깰 수 있는 탐지원이 있을 때(1.2) / 없어도(1.6) 비키지 않고 싸운다. */
const CLOAK_FIGHT_WITH_DETECTOR = 1.2;
const CLOAK_FIGHT_ANYWAY = 1.6;
/** 한 번 싸우기로 하면 이만큼(초) 다시 따지지 않는다(비켰다 들어갔다를 되풀이하지 않게). */
const CLOAK_COMMIT = 6;

/**
 * 탐지된 은폐 유닛이 비킬지, 맞더라도 싸울지.
 * - 우리 힘: 이 유닛 곁 9칸 안의 아군 전투 유닛(이 유닛 포함)의 지금 전투력 합
 * - 상대 힘: 9칸 안에서 이 유닛을 때릴 수 있는 적 유닛 + 이 유닛을 쏠 수 있는 방어 건물(사거리 안이거나 기지 구역 안, 1.5배)
 * - 깰 수 있는 탐지원: 이 유닛을 탐지하고 있고 12칸 안에 있으며 이 유닛이 때릴 수 있는 탐지 건물(캐논·터렛·스포어 등)이나 탐지 유닛(옵저버·오버로드·베슬)
 * 탐지원이 있고 우리 힘이 1.2배를 넘으면 그 탐지원부터 깨고, 없어도 1.6배를 넘으면 그 자리에서 싸운다. 아니면 예전처럼 비킨다.
 * 이 유닛이 체력·보호막 30% 아래면 따지지 않고 비킨다. 컴샛 스캔은 깰 수 없어 탐지원으로 치지 않는다.
 */
function cloakFight(state, unit, foe) {
  if (unit.hp + unit.shields < (unit.maxHp + unit.maxShields) * 0.3) return null;
  const near = (item, radius) => distance(item.x, item.y, unit.x, unit.y) <= radius;
  const ours = state.units
    .filter((ally) => ally.side === unit.side && ally.hp > 0 && ally.group !== "cargo" && !isWorker(ally) && near(ally, CLOAK_FIGHT_RADIUS))
    .reduce((sum, ally) => sum + livePower(ally), 0);
  const threats = state.units
    .filter((enemy) => enemy.side === foe && enemy.hp > 0 && enemy.group !== "cargo" && near(enemy, CLOAK_FIGHT_RADIUS) && canHit(enemy, unit))
    .reduce((sum, enemy) => sum + livePower(enemy), 0);
  const towers = state.buildings
    .filter((building) => building.side === foe && stwDone(building) && STW_BUILDINGS[building.type].damage && canHit(building, unit)
      && (distance(building.x, building.y, unit.x, unit.y) - unit.radius <= STW_BUILDINGS[building.type].range || inBaseZone(state, foe, building.base, unit)))
    .reduce((sum, building) => sum + livePower(building) * 1.5, 0);
  const ratio = ours / Math.max(1, threats + towers);
  if (ratio < CLOAK_FIGHT_WITH_DETECTOR) return null;
  const detectors = [
    ...state.units.filter((item) => item.side === foe && item.hp > 0 && STW_UNITS[item.type].detector && distance(item.x, item.y, unit.x, unit.y) <= STW_UNITS[item.type].detector),
    ...state.buildings.filter((item) => item.side === foe && stwDone(item) && STW_BUILDINGS[item.type].detector
      && (distance(item.x, item.y, unit.x, unit.y) <= STW_BUILDINGS[item.type].detector || inBaseZone(state, foe, item.base, unit))),
  ].filter((item) => near(item, CLOAK_DETECTOR_REACH + item.radius) && canHit(unit, item));
  const detector = detectors.sort((a, b) => distance(a.x, a.y, unit.x, unit.y) - distance(b.x, b.y, unit.x, unit.y))[0] ?? null;
  if (detector) return { detector };
  return ratio >= CLOAK_FIGHT_ANYWAY ? { detector: null } : null;
}

function cloakEvade(state, unit, speed, dt) {
  if (!selfCloaked(state, unit)) {
    unit.evadeTo = undefined;
    return false;
  }
  // 싸우기로 했으면 정한 시간 동안은 비키지 않는다(그 사이 체력이 25% 아래로 떨어지면 다시 따진다).
  if ((unit.commitUntil ?? 0) > state.time && unit.hp + unit.shields >= (unit.maxHp + unit.maxShields) * 0.25) return false;
  if (unit.evadeTo && state.time < (unit.evadeUntil ?? 0)) {
    if (moveToward(unit, unit.evadeTo.x, unit.evadeTo.y, speed, dt)) unit.evadeTo = undefined;
    return true;
  }
  unit.evadeTo = undefined;
  const foe = stwOpponent(unit.side);
  const hit = unit.hitAt !== undefined && state.time - unit.hitAt < 1;
  if (!hit || !detectionCovers(state, foe, unit)) return false;
  const fight = cloakFight(state, unit, foe);
  if (fight) {
    unit.commitUntil = state.time + CLOAK_COMMIT;
    unit.commitTarget = fight.detector?.id;
    unit.waryUntil = 0;
    if (fight.detector) unit.targetId = fight.detector.id;
    return false;
  }
  const hitter = resolve(state, unit.hitBy);
  let best = null;
  let bestScore = Infinity;
  for (const reach of [4, 7, 10, 14, 18]) {
    for (let step = 0; step < 16; step += 1) {
      const angle = (step / 16) * Math.PI * 2;
      const spot = { x: unit.x + Math.cos(angle) * reach, y: unit.y + Math.sin(angle) * reach, radius: unit.radius };
      if (spot.x < 1 || spot.x > STW_LANE_WIDTH - 1 || spot.y < 1 || spot.y > STW_LANE_LENGTH - 1) continue;
      if (detectionCovers(state, foe, spot)) continue;
      // 가까울수록, 때린 적에게서 멀어질수록 좋다.
      const score = reach - (hitter ? distance(spot.x, spot.y, hitter.x, hitter.y) * 0.3 : 0);
      if (score < bestScore) {
        best = spot;
        bestScore = score;
      }
    }
    if (best) break;
  }
  if (!best) return false;
  unit.evadeTo = { x: best.x, y: best.y };
  unit.evadeUntil = state.time + 5;
  unit.waryUntil = state.time + 5 + CLOAK_WARY;
  unit.targetId = null;
  moveToward(unit, best.x, best.y, speed, dt);
  return true;
}

/** 컴샛 스테이션: 탐지되지 않은 은폐 유닛에게 맞으면 에너지 50으로 그 자리를 8초 동안 스캔한다. */
function comsatScan(state, side, attacker) {
  if ((state.scans ?? []).some((scan) => scan.side === side && distance(scan.x, scan.y, attacker.x, attacker.y) < scan.radius * 0.6)) return;
  const comsat = state.buildings.find((building) => building.side === side && building.type === "comsat" && stwDone(building) && building.energy >= 50);
  if (!comsat) return;
  comsat.energy -= 50;
  state.scans ??= [];
  state.scans.push({ id: state.nextId++, side, x: attacker.x, y: attacker.y, radius: 10, ttl: 8 });
  state.effects.push({ kind: "scan", side, x1: attacker.x, y1: attacker.y, x2: attacker.x, y2: attacker.y, ttl: 1.2, max: 1.2, radius: 10 });
  if (side === "player") pushLog(state, side, "컴샛 스캔으로 은폐한 적을 드러냈습니다.", "good");
}

const AIR_HINT = {
  protoss: "공중 유닛에게 공격받고 있습니다. 드라군·포톤 캐논·커세어가 공중을 쏩니다.",
  terran: "공중 유닛에게 공격받고 있습니다. 해병·골리앗·미사일 터렛이 공중을 쏩니다.",
  zerg: "공중 유닛에게 공격받고 있습니다. 히드라리스크·스포어 콜로니·스커지가 공중을 쏩니다.",
};
const DETECT_HINT = {
  protoss: "보이지 않는 적에게 공격받고 있습니다! 포톤 캐논이나 옵저버로 탐지하세요.",
  terran: "보이지 않는 적에게 공격받고 있습니다! 미사일 터렛이나 컴샛 스테이션으로 탐지하세요.",
  zerg: "보이지 않는 적에게 공격받고 있습니다! 스포어 콜로니나 오버로드로 탐지하세요.",
};

/** 공격자가 대상을 노릴 수 있는지: 은폐 유닛은 탐지되어야 한다. */
function targetable(state, attacker, target) {
  if (target.kind === "unit" && (target.group === "cargo" || inStasis(state, target))) return false;
  if (!canHit(attacker, target)) return false;
  return target.kind !== "unit" || stwDetected(state, target, attacker.side);
}

function applyHits(state) {
  for (const hit of state.pendingHits) {
    if (hit.target.hp <= 0) {
      // 이미 죽은 목표에 들어간 공격(낭비). 시뮬레이션 지표로만 쓴다.
      state.sides[hit.attacker.side].stats.overkill += 1;
      continue;
    }
    for (const amount of hit.hits) applyDamage(state, hit.target, amount);
    hit.target.lastHit = state.time;
    // 누구에게 맞았는지 기억해 둔다(교전 우선이면 건물을 치던 유닛이 반격한다).
    if (hit.target.kind === "unit") {
      hit.target.hitBy = hit.attacker.id;
      hit.target.hitAt = state.time;
    }
    // 공중 유닛에게 맞았으면 기억해 둔다(AI가 대공을 갖추고, 플레이어에게 알린다).
    if (hit.attacker.kind === "unit" && isFlying(hit.attacker)) {
      state.sides[hit.target.side].sawAirAt = state.time;
      if (hit.target.side === "player") alertOnce(state, "air", 30, "player", AIR_HINT[state.sides.player.race] ?? AIR_HINT.protoss, "danger");
    }
    const unseen = hit.attacker.kind === "unit" && isCloaked(hit.attacker, state) && !stwDetected(state, hit.attacker, hit.target.side);
    if (unseen) {
      state.sides[hit.target.side].sawCloakAt = state.time;
      comsatScan(state, hit.target.side, hit.attacker);
      if (hit.target.side === "player") alertOnce(state, "cloak", 20, "player", DETECT_HINT[state.sides.player.race] ?? DETECT_HINT.protoss, "danger");
    }
    if (hit.target.kind === "building" && hit.target.side === "player") {
      alertOnce(state, `base:${hit.target.base}`, 12, "player", hit.target.base === "natural" ? "앞마당이 공격받고 있습니다!" : "본진이 공격받고 있습니다!", "danger");
    }
  }
  state.pendingHits = [];
}

/** 판마다 "같은 편 근접 유닛들이 노리는 적의 수"(id → 수). stepUnits가 틱마다 새로 만들고, 목표를 고를 때마다 바로 갱신한다. */
const meleeFocusByState = new WeakMap();

function meleeFocusOf(state) {
  let focus = meleeFocusByState.get(state);
  if (!focus) {
    focus = new Map();
    meleeFocusByState.set(state, focus);
  }
  return focus;
}

/** 이번 틱에 이미 예약된 피해(목표 id → 합). 같은 틱에 여럿이 같은 적을 쏴서 죽은 뒤에도 때리는 낭비를 줄인다. */
function pendingDamageOf(state) {
  const map = new Map();
  for (const hit of state.pendingHits) map.set(hit.target.id, (map.get(hit.target.id) ?? 0) + hit.hits.reduce((sum, amount) => sum + amount, 0));
  return map;
}

/** 막혔거나 꽉 찬 목표의 점수 벌점: 다른 목표가 하나도 없을 때만 고른다. */
const LAST_RESORT = 1000;

/** 막힌 목표: 다가가지 못해 잠시 포기한 목표(근접 유닛이 꽉 들어찬 건물 등). */
function blockedFrom(state, unit, id) {
  return unit.blocked !== undefined && unit.blocked.id === id && state.time < unit.blocked.until;
}

/**
 * 근접 유닛이 건물 둘레에 붙을 수 있는 자리 수(대략). 둘레를 몸 폭으로 나눈다.
 * 이미 이만큼 붙어 있으면 그 건물은 "꽉 찼다"고 보고 다른 목표를 먼저 고른다.
 */
function meleeRoom(state, unit, building) {
  const ring = building.radius + unit.radius * 0.5 + unitRange(state, unit) * 0.6;
  return Math.max(2, Math.floor((2 * Math.PI * ring) / (unit.radius * 1.6)));
}

/** 건물이 근접 유닛으로 꽉 찼는지. */
function crowdedBuilding(state, attacker, building) {
  if (attacker.kind !== "unit" || STW_UNITS[attacker.type].role !== "melee") return false;
  return (meleeFocusOf(state).get(building.id) ?? 0) >= meleeRoom(state, attacker, building);
}

/** 목표 점수: 거리에 일꾼·지원 유닛 벌점, 근접 유닛에는 이미 둘 넘게 붙은 적의 벌점을 더한다. 작을수록 좋다. */
function targetScore(state, attacker, unit, d) {
  const melee = attacker.kind === "unit" && STW_UNITS[attacker.type].role === "melee";
  const crowd = melee ? Math.max(0, (meleeFocusOf(state).get(unit.id) ?? 0) - 2) * 1.2 : 0;
  return d + (isPassive(unit) ? 3 : 0) + crowd;
}

function findTarget(state, attacker, radius, { unitsOnly = false, threatsOnly = false } = {}) {
  // 스스로 은폐하는 유닛은 적 탐지 밖에 있는 목표를 먼저 고른다(탐지 안의 목표는 다른 목표보다 10칸 먼 것으로 친다).
  // 탐지에 맞고 비킨 지 얼마 안 됐으면(경계 중) 탐지 안의 목표는 아예 고르지 않는다.
  // 싸우기로 한 은폐 유닛(cloakFight)은 탐지 안의 목표도 가리지 않는다.
  const cloaker = attacker.kind === "unit" && selfCloaked(state, attacker) && !((attacker.commitUntil ?? 0) > state.time);
  const cautious = cloaker && wary(state, attacker);
  const exposed = (target) => (cloaker && detectionCovers(state, target.side, { x: target.x, y: target.y, radius: attacker.radius }) ? (cautious ? Infinity : 10) : 0);
  let best = null;
  let bestScore = Infinity;
  let doomedBest = null;
  let doomedScore = Infinity;
  const pending = pendingDamageOf(state);
  const reach = attacker.kind === "unit" ? unitRange(state, attacker) + 0.5 : radius;
  for (const unit of state.units) {
    if (unit.side === attacker.side || unit.hp <= 0) continue;
    const d = distance(attacker.x, attacker.y, unit.x, unit.y) - unit.radius;
    if (d > radius || !targetable(state, attacker, unit)) continue;
    if (threatsOnly && !isThreat(unit)) continue;
    // 다가가지 못해 미룬 목표는 고르지 않는다. 공격 병력은 목표가 없으면 계속 전진하므로 더 안쪽의 다른 적을 찾는다.
    if (attacker.kind === "unit" && blockedFrom(state, attacker, unit.id)) continue;
    // 날아가는 수송선은 쫓아가지 않는다. 사거리 안을 지날 때만 쏜다.
    if (inFlight(unit) && d > reach) continue;
    const score = targetScore(state, attacker, unit, d) + exposed(unit);
    // 이번 틱의 예약 피해만으로 이미 죽을 적은 뒤로 미룬다(다른 적이 없으면 그래도 고른다).
    if ((pending.get(unit.id) ?? 0) >= unit.hp + unit.shields) {
      if (score < doomedScore) {
        doomedBest = unit;
        doomedScore = score;
      }
      continue;
    }
    if (score < bestScore) {
      best = unit;
      bestScore = score;
    }
  }
  if (!best && doomedBest) {
    best = doomedBest;
    bestScore = doomedScore;
  }
  if (unitsOnly) return best;
  for (const building of state.buildings) {
    if (building.side === attacker.side || building.hp <= 0 || !canHit(attacker, building)) continue;
    if (threatsOnly && !isThreat(building)) continue;
    const d = distance(attacker.x, attacker.y, building.x, building.y) - building.radius;
    if (d > radius) continue;
    // 다가가지 못해 미룬 건물은 고르지 않고, 근접 유닛이 꽉 들어찬 건물은 다른 목표가 없을 때만 고른다
    // (위협을 다시 찾을 때는 아예 빼서, 비었다 찼다 오가지 않게 한다).
    if (attacker.kind === "unit" && blockedFrom(state, attacker, building.id)) continue;
    const full = crowdedBuilding(state, attacker, building);
    if (threatsOnly && full) continue;
    const score = d + (STW_BUILDINGS[building.type].damage ? 1 : 6) + (full ? LAST_RESORT : 0) + exposed(building);
    if (score < bestScore) {
      best = building;
      bestScore = score;
    }
  }
  return best;
}

/** 위협: 싸울 수 있는 적 유닛(일꾼·비행 탐지기·수송선 제외)과 공격하는 방어 건물. */
function isThreat(target) {
  if (target.kind === "building") return Boolean(STW_BUILDINGS[target.type].damage) && stwDone(target);
  const def = STW_UNITS[target.type];
  return !isPassive(target) && !def.transport;
}

/** 건물 우선에서 노릴 건물의 점수: 거리에 종류 벌점(생산·기술 0, 본진 3, 그 밖 5, 방어 8)을 더한다. 작을수록 좋다. */
const SIEGE_PENALTY = { production: 0, tech: 0, main: 3, other: 5 };

function siegeScore(attacker, building) {
  const d = distance(attacker.x, attacker.y, building.x, building.y) - building.radius;
  return d + (STW_BUILDINGS[building.type].defense ? 8 : SIEGE_PENALTY[buildingKind(building.type)]);
}

/** 건물 우선: 반경 안에서 깰 건물(생산·기술 건물 먼저). */
function findSiegeTarget(state, attacker, radius) {
  let best = null;
  let bestScore = Infinity;
  for (const building of state.buildings) {
    if (building.side === attacker.side || building.hp <= 0 || !canHit(attacker, building)) continue;
    if (distance(attacker.x, attacker.y, building.x, building.y) - building.radius > radius) continue;
    if (blockedFrom(state, attacker, building.id)) continue;
    const score = siegeScore(attacker, building) + (crowdedBuilding(state, attacker, building) ? LAST_RESORT : 0);
    if (score < bestScore) {
      best = building;
      bestScore = score;
    }
  }
  return best;
}

/** 반격 거리: 시야 밖의 적 유닛(시즈 탱크 등)에게 맞아도 시야 + 이만큼 안이면 찾아가 친다. */
const RETALIATE_REACH = 9;

/**
 * 공격 목표 고르기의 마지막 단계.
 * - 교전 우선: 일반 건물이나 일꾼을 치다가 맞으면 때린 적에게 반격하고, 1초마다 시야 안의 위협을 다시 찾는다.
 * - 건물 우선(공격 병력만): 맞아도 무시하고 근처 건물을 생산·기술 건물부터 깬다. 칠 건물이 없을 때만 유닛과 싸운다.
 */
function focusTarget(state, unit, target, { isAttack, sight, leashed }) {
  const focus = state.sides[unit.side].focus ?? "fight";
  if (isAttack && focus === "buildings") {
    const rescan = state.time >= (unit.threatScanAt ?? 0);
    if (target?.kind === "building" && !rescan) return target;
    unit.threatScanAt = state.time + 1;
    const building = findSiegeTarget(state, unit, sight + 6);
    if (!building) return target;
    if (target?.kind === "building" && siegeScore(unit, target) <= siegeScore(unit, building) + 2) return target;
    return building;
  }
  if (target && isThreat(target)) return target;
  const recent = unit.hitAt !== undefined && state.time - unit.hitAt < 1;
  const hitter = recent ? resolve(state, unit.hitBy, unit) : null;
  if (hitter && isThreat(hitter) && !leashed(hitter) && !blockedFrom(state, unit, hitter.id) && !(hitter.kind === "building" && crowdedBuilding(state, unit, hitter)) && !(hitter.kind === "unit" && inFlight(hitter))) {
    // 방어 건물은 기지 구역 어디든 쏘므로 거리와 상관없이 찾아간다. 유닛(탱크 등)은 반격 거리 안일 때만.
    const d = distance(unit.x, unit.y, hitter.x, hitter.y) - hitter.radius;
    if (hitter.kind === "building" || d <= sight + RETALIATE_REACH) return hitter;
  }
  if (!target || state.time < (unit.threatScanAt ?? 0)) return target;
  unit.threatScanAt = state.time + 1;
  const threat = findTarget(state, unit, sight, { threatsOnly: true });
  return threat && !leashed(threat) ? threat : target;
}

function resolve(state, id, attacker = null) {
  if (id === null || id === undefined) return null;
  const unit = state.units.find((item) => item.id === id && item.hp > 0);
  if (unit) return !attacker || targetable(state, attacker, unit) ? unit : null;
  const building = state.buildings.find((item) => item.id === id && item.hp > 0) ?? null;
  return building && (!attacker || canHit(attacker, building)) ? building : null;
}

/** 기지 구역: 그 기지의 어떤 건물이든 STW_DEFENSE_REACH 안에서 때릴 수 있는 자리에 있는지. 지역 방어와 지역 탐지가 함께 쓴다. */
function inBaseZone(state, side, base, unit) {
  return state.buildings.some((item) => item.side === side && item.base === base && distance(item.x, item.y, unit.x, unit.y) - item.radius - unit.radius * 0.5 <= STW_DEFENSE_REACH);
}

/**
 * 지역 방어: 방어 건물이 노릴 수 있는 적. 자기 사거리 안이거나 기지 구역 안이면 모두.
 * 가장 가까운 적부터(일꾼·지원 유닛은 뒤로).
 */
function defenseTarget(state, building) {
  const def = STW_BUILDINGS[building.type];
  // 지역 방어는 기지 구역 안의 적을 모두 쏘지만, 지나가는 수송선은 제 사거리 안에서만 쏜다.
  const inZone = (unit) => distance(building.x, building.y, unit.x, unit.y) - unit.radius <= def.range || (!inFlight(unit) && inBaseZone(state, building.side, building.base, unit));
  const current = resolve(state, building.targetId, building);
  if (current && current.kind === "unit" && inZone(current)) return current;
  let best = null;
  let bestScore = Infinity;
  for (const unit of state.units) {
    if (unit.side === building.side || unit.hp <= 0 || !targetable(state, building, unit) || !inZone(unit)) continue;
    const score = distance(building.x, building.y, unit.x, unit.y) + (isPassive(unit) ? 3 : 0);
    if (score < bestScore) {
      best = unit;
      bestScore = score;
    }
  }
  return best;
}

/** 공격하는 방어 건물(포톤 캐논, 벙커, 성큰 콜로니). 자기 기지 전체를 지킨다. */
function cannonStep(state, building, dt) {
  const def = STW_BUILDINGS[building.type];
  building.cooldown = Math.max(0, building.cooldown - dt);
  const target = defenseTarget(state, building);
  building.targetId = target?.id ?? null;
  if (!target || building.cooldown > 0) return;
  building.cooldown = def.cooldown;
  queueHit(state, building, target);
  const kind = building.type === "cannon" ? "photon" : building.type === "sunken" ? "tentacle" : building.type === "turret" ? "flak" : building.type === "spore" ? "sporeShot" : "bullet";
  const ttl = kind === "photon" ? 0.3 : kind === "tentacle" ? 0.8 : kind === "flak" || kind === "sporeShot" ? 0.3 : 0.12;
  state.effects.push({ kind, side: building.side, x1: building.x, y1: building.y, x2: target.x, y2: target.y, ttl, max: ttl, attackerId: building.id, targetId: target.id });
}

/** 공격 간격: 스팀팩 해병·파이어뱃과 아드레날린 분비선 저글링은 1.5배 빠르게 친다. */
function attackCooldown(state, unit, def, target = null) {
  // 인스네어에 걸리면 공격도 느려진다.
  const cooldown = weaponFor(def, target).cooldown * (ensnared(state, unit) ? 1.33 : 1);
  if (stimmed(state, unit)) return cooldown * 0.67;
  if (unit.type === "zergling" && stwResearchDone(state, unit.side, "adrenal")) return cooldown * 0.67;
  return cooldown;
}

function stimmed(state, unit) {
  return unit.stimAt !== undefined && state.time - unit.stimAt < 10;
}

function unitRange(state, unit) {
  const def = STW_UNITS[unit.type];
  // 특이점 충전: 7(캐논·성큰과 같다). 8이던 때는 캐논 밖에서 건물을 쳐서 지역 방어 구역을 넓게 잡아야 했다.
  if (unit.type === "dragoon" && stwResearchDone(state, unit.side, "range")) return 7;
  if (unit.type === "marine" && stwResearchDone(state, unit.side, "u238")) return def.range + 1;
  if (unit.type === "hydra" && stwResearchDone(state, unit.side, "spines")) return def.range + 1.5;
  return def.range ?? 0;
}

function unitSpeed(state, unit) {
  return baseSpeed(state, unit) * (ensnared(state, unit) ? 0.5 : 1);
}

function baseSpeed(state, unit) {
  const def = STW_UNITS[unit.type];
  if (unit.type === "zealot" && stwResearchDone(state, unit.side, "charge")) return def.speed * 1.5;
  if (unit.type === "vulture" && stwResearchDone(state, unit.side, "ion")) return def.speed * 1.4;
  if (unit.type === "zergling" && stwResearchDone(state, unit.side, "metabolic")) return def.speed * 1.5;
  if (unit.type === "hydra" && stwResearchDone(state, unit.side, "augments")) return def.speed * 1.35;
  if (unit.type === "overlord" && stwResearchDone(state, unit.side, "pneumatized")) return def.speed * 1.5;
  if (stimmed(state, unit)) return def.speed * 1.5;
  return def.speed;
}

/** 막힘 판정 간격과 포기 시간(초). */
const STUCK_WINDOW = 1.2;
const STUCK_GIVE_UP = 6;
const STUCK_SEARCH = 8;

/**
 * 목표에 다가가는 중인 지상 유닛이 막혔는지. STUCK_WINDOW마다 위치를 재서, 낼 수 있는 속도의 25%도 못 움직였으면 막힌 것이다.
 * 도망가는 적을 쫓는 경우는 실제로 움직이므로 걸리지 않는다.
 */
function stuckOn(state, unit, target, speed) {
  if (isFlying(unit)) return false;
  const anchor = unit.approach;
  if (!anchor || anchor.id !== target.id) {
    unit.approach = { id: target.id, x: unit.x, y: unit.y, at: state.time };
    return false;
  }
  if (state.time - anchor.at < STUCK_WINDOW) return false;
  const moved = distance(unit.x, unit.y, anchor.x, anchor.y);
  unit.approach = { id: target.id, x: unit.x, y: unit.y, at: state.time };
  return moved < speed * STUCK_WINDOW * 0.25;
}

function moveToward(unit, x, y, speed, dt) {
  const dx = x - unit.x;
  const dy = y - unit.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.05) return true;
  const step = Math.min(d, speed * dt);
  unit.x += (dx / d) * step;
  unit.y += (dy / d) * step;
  unit.heading = Math.atan2(dy, dx);
  return step >= d - 0.01;
}

const ROLE_DEPTH = { melee: 2, ranged: 0, siege: -1.8, air: -2.6, caster: -3.8, support: -5.5 };
const ROLE_ORDER = {
  overlord: 12, ultra: -1, zealot: 0, zergling: 0.5, broodling: 0.6, infested: 0.7, dark: 1, archon: 2, firebat: 3, dragoon: 4, hydra: 4.5, goliath: 4.7, marine: 5, ghost: 5.2, vulture: 6,
  reaver: 7, lurker: 7.5, tank: 8, mutalisk: 8.2, scourge: 8.3, devourer: 8.35, corsair: 8.4, valkyrie: 8.45, wraith: 8.5, guardian: 8.55, scout: 8.6, carrier: 8.7, arbiter: 8.8, battlecruiser: 8.9,
  templar: 9, darkArchon: 9.2, defiler: 9.4, queen: 9.5, medic: 10, vessel: 10.5, observer: 11, shuttle: 11.2, dropship: 11.3,
};
const ATTACK_EFFECT = {
  zealot: "slash", dark: "slash", dragoon: "plasma", archon: "shock", reaver: "scarab", marine: "bullet", firebat: "flame", vulture: "grenade", tank: "tankshot", zergling: "bite", ultra: "bite", hydra: "spine",
  scout: "laser", wraith: "laser", goliath: "flak", corsair: "neutron", mutalisk: "glaive", scourge: "burst", carrier: "interceptor", arbiter: "plasma", ghost: "bullet", valkyrie: "flak",
  battlecruiser: "laser", guardian: "glaive", devourer: "sporeShot", infested: "burst", broodling: "bite",
};

/** 집결지에서의 자리: 근접은 앞, 원거리는 가운데, 템플러는 뒤. 한 줄 12자리. */
function rallySlots(state, side, units, anchorY) {
  const forward = stwForward(side);
  const sorted = [...units].sort((a, b) => ROLE_ORDER[a.type] - ROLE_ORDER[b.type] || a.id - b.id);
  const slots = new Map();
  const byRole = { melee: [], ranged: [], siege: [], air: [], caster: [], support: [] };
  for (const unit of sorted) byRole[STW_UNITS[unit.type].role].push(unit);
  // 좁은 길(협곡)에 서면 한 줄에 설 수 있는 만큼만 세우고, 역할 순서대로 줄을 뒤로 이어 쌓는다.
  const [left, right] = stwGroundSpan(stwMap(state), anchorY);
  const perRow = Math.max(3, Math.min(12, Math.floor((right - left - 2) / 2.7) + 1));
  let stacked = 0;
  for (const [role, list] of Object.entries(byRole)) {
    list.forEach((unit, index) => {
      const row = Math.floor(index / perRow);
      const inRow = Math.min(perRow, list.length - row * perRow);
      const column = index % perRow;
      // 본진 맨 뒤(광물 줄)에 모일 때 뒷줄이 전장 밖으로 나가지 않게 가장자리 안에 둔다.
      slots.set(unit.id, {
        x: STW_LANE_WIDTH / 2 + (column - (inRow - 1) / 2) * 2.7,
        y: Math.min(STW_LANE_LENGTH - 1.5, Math.max(1.5, anchorY + forward * (perRow < 12 ? 2 - (stacked + row) * 2.6 : ROLE_DEPTH[role] - row * 2.6))),
      });
    });
    stacked += Math.ceil(list.length / perRow);
  }
  return slots;
}

function stepUnits(state, dt) {
  for (const unit of state.units) {
    const def = STW_UNITS[unit.type];
    if (def.energyRegen) unit.energy = Math.min(def.maxEnergy, unit.energy + def.energyRegen * dt);
    // 브루들링처럼 수명이 있는 유닛은 때가 되면 사라진다.
    if (def.lifetime && state.time - (unit.bornAt ?? 0) >= def.lifetime) {
      unit.hp = 0;
      unit.returned = true;
    }
  }
  const plans = {};
  for (const side of STW_SIDES) {
    let army = stwArmy(state, side);
    // 싸울 유닛이 다 죽고 지원 유닛만 공격 그룹에 남으면 대기 병력으로 되돌린다.
    if (army.attack.length && !army.attackers.length) {
      for (const unit of army.attack) unit.group = "rally";
      army = stwArmy(state, side);
    }
    const rallyY = stwRallyY(side, state.sides[side].rally, state);
    const attackSlots = rallySlots(state, side, army.attack, 0);
    // 공격 병력은 가장 느린 지상 유닛에 맞춰 움직인다. 동행 오버로드도 같이 다니므로 속도에 포함한다.
    const speeds = army.attack.filter((unit) => !isFlying(unit) || unit.type === "overlord").map((unit) => unitSpeed(state, unit));
    // 웨이브의 꼬리(가장 뒤처진 전투 유닛). 빠른 유닛은 여기서 WAVE_LEAD칸까지만 앞서 나간다.
    const forwardSign = stwForward(side);
    // 합류하러 오는 새 병력은 꼬리로 치지 않는다(앞에서 싸우는 병력이 기다리느라 느려지지 않게). 꼬리 6칸 안에 닿으면 본대가 된다.
    const marching = army.attack.filter((unit) => (!isFlying(unit) || unit.type === "overlord") && !unit.reinforcing);
    const rearY = marching.length ? marching.reduce((rear, unit) => (unit.y * forwardSign < rear * forwardSign ? unit.y : rear), marching[0].y) : null;
    for (const unit of army.attack) if (unit.reinforcing && (rearY === null || (unit.y - rearY) * -forwardSign < 6)) delete unit.reinforcing;
    for (const unit of army.rally) if (unit.reinforcing) delete unit.reinforcing;
    // 따로 둔 부대는 종류마다 제 자리에 선다(집결지 규칙을 그 자리로 쓴다). 부대가 사라진 유닛은 본대로.
    const squads = state.sides[side].squads ?? {};
    const mainRally = [];
    const squadMembers = new Map();
    for (const unit of army.rally) {
      if (unit.squad !== undefined && squads[unit.squad]) {
        if (!squadMembers.has(unit.squad)) squadMembers.set(unit.squad, []);
        squadMembers.get(unit.squad).push(unit);
      } else {
        delete unit.squad;
        mainRally.push(unit);
      }
    }
    const allRallySlots = rallySlots(state, side, mainRally, rallyY);
    for (const [type, members] of squadMembers) for (const [id, slot] of rallySlots(state, side, members, stwRallyY(side, squads[type].y, state))) allRallySlots.set(id, slot);
    plans[side] = {
      rallySlots: allRallySlots,
      attackSlots,
      waveSpeed: speeds.length ? Math.min(...speeds) : 3,
      rearY,
      goal: stwPoint(side, { x: 20, y: 6 }),
      intruders: findIntruders(state, side, rallyY),
    };
    if (side === "player" && plans[side].intruders.length && army.rally.length) {
      alertOnce(state, "defend", 15, "player", "대기 병력이 기지에 들어온 적을 요격합니다.", "order");
    }
  }
  // 근접 유닛의 목표 분산용: 지금 각 적을 노리는 같은 편 근접 유닛 수. 틱 안에서 목표를 바꿀 때마다 갱신한다.
  const meleeFocus = meleeFocusOf(state);
  meleeFocus.clear();
  for (const unit of state.units) {
    if (unit.targetId !== null && unit.hp > 0 && STW_UNITS[unit.type].role === "melee") meleeFocus.set(unit.targetId, (meleeFocus.get(unit.targetId) ?? 0) + 1);
  }
  // 경계 중인 은폐 유닛의 이번 틱 시작 자리(탐지 밖일 때만). 틱 끝에 탐지 안으로 들어갔으면 되돌린다.
  const stormStarts = stormSafeStarts(state);
  const waryStarts = new Map();
  for (const unit of state.units) {
    if (unit.hp > 0 && wary(state, unit) && !detectionCovers(state, stwOpponent(unit.side), unit)) waryStarts.set(unit, { x: unit.x, y: unit.y });
  }
  const retarget = (unit, from, to) => {
    if (STW_UNITS[unit.type].role !== "melee" || from === to) return;
    if (from !== null) meleeFocus.set(from, Math.max(0, (meleeFocus.get(from) ?? 1) - 1));
    if (to !== null) meleeFocus.set(to, (meleeFocus.get(to) ?? 0) + 1);
  };
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;
    unit.cooldown = Math.max(0, unit.cooldown - dt);
    // 수송선에 탄 병력은 수송선이 데리고 다닌다.
    if (unit.group === "cargo") continue;
    // 회수 중: 교전을 끊고 수송선으로 달려간다.
    if (unit.group === "board") {
      // 출발 전 탑승(boardTo: 정해진 수송선) 또는 게릴라 회수(작전의 수송선)로 걸어간다.
      const op = unit.boardTo === undefined ? (state.ops ?? []).find((item) => item.id === unit.raid) : null;
      const transportId = unit.boardTo ?? op?.transports[0];
      const transport = transportId !== undefined ? state.units.find((item) => item.id === transportId && item.hp > 0) : null;
      if (transport) {
        unit.targetId = null;
        moveToward(unit, transport.x, transport.y, unitSpeed(state, unit), dt);
        continue;
      }
      // 타러 가던 수송선이 없어졌으면 대기 병력으로 돌아간다(회수 중이던 견제 병력은 그 자리에서 싸운다).
      unit.group = unit.boardTo !== undefined ? "rally" : "attack";
      unit.boardTo = undefined;
      unit.raid = undefined;
    }
    // 침투 중: 교전 없이 경로를 따라 걷는다(마엘스트롬 등에 묶이면 아래에서 멈춘다).
    if (unit.group === "walk" && !stunned(state, unit) && !inStasis(state, unit)) {
      walkStep(state, unit, dt);
      continue;
    }
    // 마엘스트롬·락다운·스테이시스: 꼼짝 못 한다.
    if (stunned(state, unit) || inStasis(state, unit)) {
      unit.targetId = null;
      continue;
    }
    if (isWorker(unit)) {
      scoutStep(state, unit, dt);
      continue;
    }
    const def = STW_UNITS[unit.type];
    const plan = plans[unit.side];
    const range = unitRange(state, unit);
    const speed = unitSpeed(state, unit);
    if (def.transport || unit.op !== undefined || unit.dropPath?.length || unit.cargo?.length) {
      transportStep(state, unit, plan, dt);
      continue;
    }
    if (unit.type === "templar") {
      templarStep(state, unit, plan, dt);
      continue;
    }
    if (unit.type === "observer" || unit.type === "overlord") {
      observerStep(state, unit, plan, dt);
      continue;
    }
    // 무기 없는 마법 유닛(다크 아콘, 사이언스 베슬, 퀸, 디파일러).
    if (def.role === "caster" && def.spells) {
      if (!castSpells(state, unit)) casterMove(state, unit, plan, speed, dt);
      continue;
    }
    // 무기와 마법을 함께 가진 유닛(고스트, 배틀크루저, 아비터)은 마법이 먼저다.
    if (def.spells && castSpells(state, unit)) continue;
    // 수송 작전으로 내린 병력.
    // 무기 없는 유닛(메딕)은 내린 동료를 따라다니며 치료만 한다(위의 메딕 처리).
    if (unit.raid !== undefined && def.damage && unit.type !== "tank" && unit.type !== "lurker" && raidRiderStep(state, unit, dt)) continue;
    if (unit.bomb !== undefined && def.damage && unit.type !== "tank" && unit.type !== "lurker" && bombRiderStep(state, unit, dt)) continue;
    // 아비터: 은폐장이 병력을 덮도록 공격 병력 한가운데 위에 떠 있고, 사거리 안의 적만 쏜다(쫓아가지 않는다).
    if (def.cloakField && unit.group === "attack") {
      const escort = state.units.filter((ally) => ally.side === unit.side && ally.group === "attack" && ally !== unit && !isPassive(ally) && !isFlying(ally));
      if (escort.length) {
        const cx = escort.reduce((sum, ally) => sum + ally.x, 0) / escort.length;
        const cy = escort.reduce((sum, ally) => sum + ally.y, 0) / escort.length;
        moveToward(unit, cx, cy, speed, dt);
        const near = findTarget(state, unit, range + unit.radius, { unitsOnly: false });
        unit.targetId = near?.id ?? null;
        if (near && unit.cooldown <= 0) {
          unit.cooldown = attackCooldown(state, unit, def, near);
          queueHit(state, unit, near);
          state.effects.push({ kind: "plasma", side: unit.side, x1: unit.x, y1: unit.y, x2: near.x, y2: near.y, ttl: 0.35, max: 0.35, attackerId: unit.id, targetId: near.id });
        }
        continue;
      }
    }
    if (unit.type === "medic") {
      medicStep(state, unit, plan, dt);
      continue;
    }
    const isAttack = unit.group === "attack";
    const slot = isAttack ? plan.attackSlots.get(unit.id) : plan.rallySlots.get(unit.id);
    const sight = range + (isAttack ? 6 : 7);
    const retreating = !isAttack && slot && isRetreating(unit, slot);
    if (unit.type === "tank" && tankSiegeStep(state, unit, Boolean(retreating), isAttack ? null : slot)) continue;
    if (unit.type === "lurker" && lurkerStep(state, unit, Boolean(retreating))) continue;
    if (retreating) {
      // 후퇴 중: 교전을 끊고 전속력으로 집결지에 돌아온다.
      unit.targetId = null;
      moveToward(unit, slot.x, slot.y, speed, dt);
      continue;
    }
    // 아군 스톰 안에 있으면(시전 순간 걸쳤거나 밀려 들어감) 싸움을 멈추고 스톰 중심에서 멀어지는 쪽으로 빠져나온다(피해는 없다).
    const ownStorm = !isFlying(unit) && state.storms.find((storm) => storm.side === unit.side && inStorm(unit, storm));
    if (ownStorm) {
      const away = Math.atan2(unit.y - ownStorm.y, unit.x - ownStorm.x);
      const edge = STW_STORM.radius + unit.radius + 0.5;
      moveToward(unit, ownStorm.x + Math.cos(away) * edge, ownStorm.y + Math.sin(away) * edge, speed, dt);
      unit.approach = undefined;
      continue;
    }
    const before = unit.targetId;
    if (cloakEvade(state, unit, speed, dt)) {
      if (before !== null && unit.targetId === null) retarget(unit, before, null);
      continue;
    }
    let target = resolve(state, unit.targetId, unit);
    // 따로 둔 부대는 제 자리 가까이(14칸) 들어온 적만 쫓는다(기지로 불려 가지 않는다).
    const intruders = isAttack ? [] : plan.intruders.filter((enemy) => targetable(state, unit, enemy) && (unit.squad === undefined || !slot || distance(enemy.x, enemy.y, slot.x, slot.y) < 14));
    // 집결지에 와 있는 대기 병력은 멀리 있는 적을 쫓지 않는다. 집결지로 이동 중(싸우며 전진)일 때는 만나는 적과 모두 싸운다.
    const settled = slot && distance(unit.x, unit.y, slot.x, slot.y) < RALLY_LEASH;
    if (settled && unit.fresh) delete unit.fresh;
    // 따로 옮긴 부대가 제자리에 닿으면 비키게 하기를 끝낸다(공격하는 부대는 싸우기 시작하면 끝낸다).
    if (unit.passing && ((slot && !isAttack && distance(unit.x, unit.y, slot.x, slot.y) < 2.5) || (isAttack && unit.targetId !== null))) delete unit.passing;
    // 갓 나와 이동 공격 중인 유닛은 가는 길의 적만 친다: 제자리에서 자기보다(4칸 넘게) 더 먼 적은 쫓지 않는다
    // (방어 건물 뒤 집결지로 가던 질럿이 저글링을 쫓아 열린 곳으로 나가 녹았다).
    const leashed = (item) => !isAttack && slot && (settled
      ? distance(item.x, item.y, slot.x, slot.y) - item.radius > RALLY_LEASH
      : unit.fresh && distance(item.x, item.y, slot.x, slot.y) - item.radius > distance(unit.x, unit.y, slot.x, slot.y) + 4);
    if (intruders.length) {
      // 자동 수비: 기지에 들어온 적을 거리와 상관없이 쫓아가 잡는다.
      if (!target || !intruders.includes(target)) target = nearestOf(unit, intruders);
    } else {
      if (target) {
        const d = distance(unit.x, unit.y, target.x, target.y) - target.radius;
        if (d > sight + 3 || leashed(target)) target = null;
      }
      if (!target) {
        // 방금 막혀 목표를 놓친 유닛은 시야보다 넓게 찾는다(근처 건물 둘레가 모두 차 있으면 조금 먼 건물로 간다).
        const wide = unit.blocked !== undefined && state.time < unit.blocked.until;
        target = findTarget(state, unit, sight + (wide ? STUCK_SEARCH : 0));
        if (target && leashed(target)) target = null;
      } else {
        // 목표가 사거리 밖으로 벗어났고 멀어지는 중이면, 점수가 1 넘게 좋은 다른 적 유닛으로 바꾼다(도망가는 적에게 끌려다니지 않는다).
        const dTarget = distance(unit.x, unit.y, target.x, target.y) - target.radius;
        const outOfReach = dTarget - unit.radius * 0.5 > range + 0.6;
        const receding = unit.lastTargetDistance !== undefined && dTarget > unit.lastTargetDistance + 0.01;
        unit.lastTargetDistance = dTarget;
        if (outOfReach && receding && target.kind === "unit") {
          const other = findTarget(state, unit, sight, { unitsOnly: true });
          if (other && other !== target && !leashed(other)) {
            const dOther = distance(unit.x, unit.y, other.x, other.y) - other.radius;
            if (targetScore(state, unit, other, dOther) < targetScore(state, unit, target, dTarget) - 1) target = other;
          }
        }
      }
    }
    if (!intruders.length) target = focusTarget(state, unit, target, { isAttack, sight, leashed });
    // 싸우기로 한 은폐 유닛은 자기를 드러낸 탐지원부터 깬다.
    if ((unit.commitUntil ?? 0) > state.time && unit.commitTarget !== undefined) {
      const detector = resolve(state, unit.commitTarget, unit);
      if (detector) target = detector;
      else unit.commitTarget = undefined;
    }
    if ((target?.id ?? null) !== unit.targetId) {
      retarget(unit, unit.targetId, target?.id ?? null);
      unit.lastTargetDistance = undefined;
    }
    unit.targetId = target?.id ?? null;
    if (target) {
      const d = distance(unit.x, unit.y, target.x, target.y) - target.radius - unit.radius * 0.5;
      if (d <= range) {
        unit.approach = undefined;
        // 사거리 안에서 적 유닛과 싸우는 유닛은 자리를 잡는다(separate에서 밀리지 않는다). 물러나며 쏘는 걸음은 아래에서 따로 움직인다.
        // 건물을 치는 유닛은 자리를 잡지 않는다: 둘레에서 서로 비켜 줘야 뒤의 유닛이 빈자리를 찾는다.
        if (target.kind === "unit") unit.plantedAt = state.time;
        unit.heading = Math.atan2(target.y - unit.y, target.x - unit.x);
        // 스팀팩: 연구 후 교전을 시작하면 체력 10을 써서 10초 동안 공격·이동 속도 +50%.
        if (def.stim && stwResearchDone(state, unit.side, "stim") && unit.hp > 20 && (unit.stimAt === undefined || state.time - unit.stimAt > 11)) {
          unit.stimAt = state.time;
          unit.hp -= 10;
          state.effects.push({ kind: "stim", side: unit.side, x1: unit.x, y1: unit.y, x2: unit.x, y2: unit.y, ttl: 0.4, max: 0.4 });
        }
        // 물러나며 사격: 재장전의 앞 75% 동안 근접 적이 붙어 있으면 한 걸음 물러난다(테란 컨트롤을 자동으로 흉내).
        // 마지막 25%는 서서 조준하므로, 충분히 빠른 근접 유닛(발업 질럿)은 그 틈에 따라붙어 때릴 수 있다. 완벽한 컨트롤은 아니다.
        if (def.kite && unit.cooldown > def.cooldown * KITE_HOLD) {
          const melee = nearestMelee(state, unit, KITE_DISTANCE);
          // 붙은 근접 유닛보다 빠를 때만 물러난다(해병은 스팀팩을 써야 질럿보다 빠르다).
          if (melee && speed > unitSpeed(state, melee)) {
            const away = Math.atan2(unit.y - melee.y, unit.x - melee.x);
            moveToward(unit, unit.x + Math.cos(away) * 2, unit.y + Math.sin(away) * 2, speed, dt);
            continue;
          }
        }
        if (unit.cooldown <= 0) {
          unit.cooldown = attackCooldown(state, unit, def, target);
          queueHit(state, unit, target);
          const kind = ATTACK_EFFECT[unit.type] ?? "plasma";
          // 캐리어 인터셉터는 날아갔다 돌아오는 데 0.9초(재장전 1초) 동안 그린다.
          const ttl = kind === "slash" || kind === "bullet" || kind === "bite" ? 0.15 : kind === "flame" ? 0.3 : kind === "scarab" ? 0.6 : kind === "shock" || kind === "spine" ? 0.25 : kind === "burst" ? 0.5 : kind === "interceptor" ? 0.9 : 0.35;
          const count = kind === "interceptor" ? stwHitDamage(state, unit, target).length : undefined;
          state.effects.push({ kind, side: unit.side, x1: unit.x, y1: unit.y, x2: target.x, y2: target.y, ttl, max: ttl, radius: STW_UNITS[unit.type].splash?.radius, attackerId: unit.id, targetId: target.id, count });
          // 스커지: 몸을 던져 터진다.
          if (def.suicide) {
            unit.hp = 0;
            unit.shields = 0;
          }
        }
      } else {
        // 막힘: 1.2초 동안 거의 못 움직였으면(앞을 아군이 막아 둘레에 자리가 없다) 그 목표를 6초 동안 미루고,
        // 시야보다 넓게(STUCK_SEARCH칸 더) 다른 목표를 찾아간다. 없으면 공격 병력은 계속 전진하고, 대기 병력은 집결지로 돌아간다.
        if (stuckOn(state, unit, target, speed)) {
          unit.blocked = { id: target.id, until: state.time + STUCK_GIVE_UP };
          const other = findTarget(state, unit, sight + STUCK_SEARCH);
          const next = other && !leashed(other) ? other : null;
          retarget(unit, unit.targetId, next?.id ?? null);
          unit.targetId = next?.id ?? null;
          unit.lastTargetDistance = undefined;
          continue;
        }
        moveToward(unit, target.x, target.y, speed, dt);
      }
      continue;
    }
    if (isAttack) {
      // 공격 병력은 함께 전진해 적 본진까지 간다. 빠른 유닛(발업 질럿, 벌처, 저글링)은 꼬리에서 WAVE_LEAD칸까지 앞서 달리고, 그 너머에서는 가장 느린 유닛 속도로 맞춘다.
      const x = slot ? slot.x : unit.x;
      // 물러나며 쏘는 유닛(해병·벌처)은 앞서 나가지 않는다. 먼저 닿아 혼자 카이팅하면 너무 유리하다.
      const aheadBy = plan.rearY === null ? 0 : (plan.rearY - unit.y) * -stwForward(unit.side);
      // 공중 유닛도 앞서 나가지 않는다. 혼자 먼저 닿으면 대공에 각개격파당하거나, 대공 없는 상대를 혼자 끝내 버린다.
      moveToward(unit, unit.x + (x - unit.x) * 0.15, plan.goal.y, aheadBy < (def.kite || def.flying ? 0 : WAVE_LEAD) ? speed : Math.min(speed, plan.waveSpeed), dt);
    } else if (slot) {
      moveToward(unit, slot.x, slot.y, speed, dt);
    }
  }
  holdOutsideDetection(state, waryStarts);
  holdOutsideOwnStorms(state, stormStarts);
  separate(state);
  spreadFlyers(state);
  keepOutOfTargets(state);
  // 밀어내기에 밀려 들어간 것도 되돌린다.
  holdOutsideOwnStorms(state, stormStarts);
}

/**
 * 건물을 치는 지상 유닛은 그 건물 테두리 밖에 선다. 뒤에서 미는 아군 때문에 맨 앞 유닛이 건물 안으로 파고들지 않고,
 * 뒤의 유닛이 둘레를 돌아 빈자리를 찾는다. 이동 중에는 건물이 길을 막지 않는다(길찾기 막힘이 없도록).
 */
function keepOutOfTargets(state) {
  for (const unit of state.units) {
    if (unit.targetId === null || isFlying(unit) || unit.group === "cargo") continue;
    const building = state.buildings.find((item) => item.id === unit.targetId);
    if (!building) continue;
    const min = building.radius + unit.radius * 0.3;
    const dx = unit.x - building.x;
    const dy = unit.y - building.y;
    const d = Math.hypot(dx, dy);
    if (d >= min) continue;
    const nx = d > 0.001 ? dx / d : 0;
    const ny = d > 0.001 ? dy / d : -stwForward(building.side);
    unit.x = building.x + nx * min;
    unit.y = building.y + ny * min;
  }
}

/** 가까이 붙은 적 근접 유닛. */
function nearestMelee(state, unit, radius) {
  let best = null;
  let bestDistance = radius;
  for (const other of state.units) {
    if (other.side === unit.side || other.hp <= 0 || STW_UNITS[other.type].role !== "melee") continue;
    const d = distance(unit.x, unit.y, other.x, other.y) - other.radius - unit.radius;
    if (d < bestDistance) {
      best = other;
      bestDistance = d;
    }
  }
  return best;
}

/** 사거리 안이면서 최소 사거리 밖에 있는 가장 가까운 적(유닛 우선). */
function findTargetBand(state, attacker, minRange, maxRange, { unitsOnly = false } = {}) {
  let best = null;
  let bestScore = Infinity;
  const consider = (item, bias) => {
    if (item.side === attacker.side || item.hp <= 0) return;
    if (item.kind === "unit" ? isFlying(item) || !targetable(state, attacker, item) : !canHit(attacker, item)) return;
    const d = distance(attacker.x, attacker.y, item.x, item.y) - item.radius;
    if (d > maxRange || d < minRange) return;
    if (d + bias < bestScore) {
      best = item;
      bestScore = d + bias;
    }
  };
  for (const unit of state.units) consider(unit, isWorker(unit) ? 3 : 0);
  if (!unitsOnly) for (const building of state.buildings) consider(building, 6);
  return best;
}

/**
 * 시즈 탱크: 시즈 모드 연구 후 사거리 12 안에 적이 들어오면 자동으로 시즈한다(2초).
 * 시즈 중에는 움직이지 않고 범위 포격을 하며, 적이 2초 넘게 없거나 후퇴 명령이 오면 시즈를 푼다(2초).
 * 이 틱을 처리했으면 true.
 */
function tankSiegeStep(state, unit, retreating, rallySlot) {
  const def = STW_UNITS.tank;
  const siege = def.siege;
  if (unit.siegeUntil !== undefined && state.time < unit.siegeUntil) return true;
  // 집결지에 자리 잡은 대기 탱크는 적이 오기 전에 미리 시즈해 둔다(적이 보인 뒤 2초를 버리지 않도록). 집결지가 옮겨지면 푼다.
  const holding = rallySlot && distance(unit.x, unit.y, rallySlot.x, rallySlot.y) < 2.5;
  if (unit.sieged) {
    const target = findTargetBand(state, unit, siege.minRange, siege.range);
    if (target) unit.lastSiegeTargetAt = state.time;
    const idleTooLong = !target && !holding && state.time - (unit.lastSiegeTargetAt ?? 0) > 2;
    const rallyMoved = rallySlot && !holding && distance(unit.x, unit.y, rallySlot.x, rallySlot.y) > 4 && !target;
    if (retreating || idleTooLong || rallyMoved) {
      unit.sieged = false;
      unit.siegeUntil = state.time + siege.setup;
      return true;
    }
    unit.targetId = target?.id ?? null;
    if (target && unit.cooldown <= 0) {
      unit.heading = Math.atan2(target.y - unit.y, target.x - unit.x);
      unit.cooldown = siege.cooldown;
      queueHit(state, unit, target);
      state.effects.push({ kind: "shell", side: unit.side, x1: unit.x, y1: unit.y, x2: target.x, y2: target.y, ttl: 0.55, max: 0.55, radius: siege.splash.radius, attackerId: unit.id, targetId: target.id });
    }
    return true;
  }
  if (retreating || !stwResearchDone(state, unit.side, "siege")) return false;
  const threat = findTargetBand(state, unit, 0, siege.range);
  if (!threat && !holding) return false;
  unit.sieged = true;
  unit.lastSiegeTargetAt = state.time;
  unit.siegeUntil = state.time + siege.setup;
  unit.targetId = null;
  return true;
}

/**
 * 럴커: 사거리 안에 적이 들어오면 1초 동안 땅속에 숨고(은폐), 숨은 동안만 일직선 가시로 공격한다.
 * 가시는 대상 방향으로 사거리 끝까지 뻗어 그 줄 위의 모든 적 지상 유닛에 같은 피해를 준다.
 * 후퇴 명령이 오거나 2초 넘게 대상이 없으면 1초 동안 땅 위로 나온다. 이 틱을 처리했으면 true.
 */
function lurkerStep(state, unit, retreating) {
  const def = STW_UNITS.lurker;
  const range = unitRange(state, unit);
  if (unit.burrowUntil !== undefined && state.time < unit.burrowUntil) return true;
  if (unit.burrowed) {
    const target = findTargetBand(state, unit, 0, range + unit.radius * 0.5);
    if (target) unit.lastBurrowTargetAt = state.time;
    // 사거리 조금 밖에 적 유닛이 다가오는 중이면 계속 숨어 있는다(들락거리며 1초씩 버리지 않도록).
    // 건물은 다가오지 않으므로 세지 않는다: 건물을 부순 뒤 다음 건물이 사거리 바로 밖(6~10칸)에 있으면 영영 땅속에서 기다렸다
    // (적 병력이 없는 후반에 럴커 둘이 적 앞마당 옆에서 10분 가까이 멈춰 경기가 끝나지 않았다).
    const approaching = !target && findTargetBand(state, unit, 0, range + 4, { unitsOnly: true });
    if (retreating || (!target && !approaching && state.time - (unit.lastBurrowTargetAt ?? 0) > 3)) {
      unit.burrowed = false;
      unit.burrowUntil = state.time + def.burrow.setup;
      unit.targetId = null;
      return true;
    }
    unit.targetId = target?.id ?? null;
    if (target && unit.cooldown <= 0) {
      const angle = Math.atan2(target.y - unit.y, target.x - unit.x);
      unit.heading = angle;
      unit.cooldown = def.cooldown;
      state.pendingHits.push({ attacker: unit, target, hits: stwHitDamage(state, unit, target) });
      const reach = range + 1;
      const end = { x: unit.x + Math.cos(angle) * reach, y: unit.y + Math.sin(angle) * reach };
      for (const other of state.units) {
        if (other === target || other.side === unit.side || other.hp <= 0 || isFlying(other)) continue;
        if (segmentDistance(other.x, other.y, unit.x, unit.y, end.x, end.y) > def.burrow.width + other.radius * 0.5) continue;
        state.pendingHits.push({ attacker: unit, target: other, hits: stwHitDamage(state, unit, other) });
      }
      state.effects.push({ kind: "spines", side: unit.side, x1: unit.x, y1: unit.y, x2: end.x, y2: end.y, ttl: 0.5, max: 0.5 });
    }
    return true;
  }
  if (retreating) return false;
  const threat = findTargetBand(state, unit, 0, range + unit.radius * 0.5);
  if (!threat) return false;
  unit.burrowed = true;
  unit.lastBurrowTargetAt = state.time;
  unit.burrowUntil = state.time + def.burrow.setup;
  unit.heading = Math.atan2(threat.y - unit.y, threat.x - unit.x);
  unit.targetId = null;
  return true;
}

/** 점과 선분 사이 거리. */
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
  return distance(px, py, ax + dx * t, ay + dy * t);
}

/** 메딕: 하이템플러처럼 병력 뒤를 따라다니며 체력이 가장 많이 깎인 근처 보병을 치료한다. */
function medicStep(state, unit, plan, dt) {
  const def = STW_UNITS.medic;
  let patient = null;
  let worst = 1;
  for (const ally of state.units) {
    if (ally.side !== unit.side || ally === unit || !STW_UNITS[ally.type].bio || ally.hp >= ally.maxHp) continue;
    const d = distance(unit.x, unit.y, ally.x, ally.y);
    if (d > def.healRange + 3) continue;
    const ratio = ally.hp / ally.maxHp;
    if (ratio < worst) {
      worst = ratio;
      patient = ally;
    }
  }
  unit.targetId = null;
  unit.healTargetId = null;
  if (patient) {
    const d = distance(unit.x, unit.y, patient.x, patient.y);
    if (d <= def.healRange) {
      patient.hp = Math.min(patient.maxHp, patient.hp + def.heal * dt);
      unit.healTargetId = patient.id;
      unit.heading = Math.atan2(patient.y - unit.y, patient.x - unit.x);
      return;
    }
    if (!(unit.group !== "attack" && plan.rallySlots.get(unit.id) && isRetreating(unit, plan.rallySlots.get(unit.id)))) {
      moveToward(unit, patient.x, patient.y, def.speed, dt);
      return;
    }
  }
  supportFollow(state, unit, plan, def.speed, dt);
}

/** 무기가 없는 후방 유닛의 이동: 후퇴, 적과 거리 두기, 공격 병력 선두 뒤 따라가기, 집결지 대기. */
function supportFollow(state, unit, plan, speed, dt) {
  const slot = unit.group === "attack" ? plan.attackSlots.get(unit.id) : plan.rallySlots.get(unit.id);
  if (unit.group !== "attack" && slot && isRetreating(unit, slot)) {
    moveToward(unit, slot.x, slot.y, speed, dt);
    return;
  }
  const nearest = findTarget(state, unit, 4, { unitsOnly: true });
  if (nearest && !isPassive(nearest)) {
    const away = Math.atan2(unit.y - nearest.y, unit.x - nearest.x);
    moveToward(unit, unit.x + Math.cos(away) * 2, unit.y + Math.sin(away) * 2, speed, dt);
    return;
  }
  if (unit.group === "attack") {
    const forward = stwForward(unit.side);
    const front = state.units.filter((ally) => ally.side === unit.side && ally.group === "attack" && !isPassive(ally) && STW_UNITS[ally.type].role !== "caster");
    const lead = front.length ? front.reduce((best, ally) => (forward < 0 ? Math.min(best, ally.y) : Math.max(best, ally.y)), front[0].y) : plan.goal.y;
    moveToward(unit, slot ? slot.x : unit.x, lead - forward * 4, Math.min(speed, plan.waveSpeed), dt);
  } else if (slot) {
    moveToward(unit, slot.x, slot.y, speed, dt);
  }
}

/** 대기 병력이 집결지에서 이만큼 넘게 떨어진 적은 쫓지 않는다. */
const RALLY_LEASH = 12;
/** 공격 웨이브에서 빠른 유닛이 가장 뒤처진 유닛보다 앞서 나갈 수 있는 거리. */
const WAVE_LEAD = 6;
/** 물러나며 쏘는 유닛이 재장전 끝 무렵 서서 조준하는 비율. 남은 재장전이 이 비율 아래로 내려가면 더 물러나지 않는다. */
const KITE_HOLD = 0.25;
/** 근접 적이 이 거리(표면 기준) 안에 들어오면 물러나기 시작한다. */
const KITE_DISTANCE = 2.2;

/**
 * 집결지보다 적진 쪽으로 멀리 나가 있는 대기 병력은 후퇴 중으로 본다.
 * 한 번 후퇴를 시작하면 집결지 가까이 올 때까지 교전하지 않는다(경계에서 들락거리지 않도록 차이를 둔다).
 */
function isRetreating(unit, slot) {
  // 생산 건물에서 갓 나와 제자리로 가는 유닛은 후퇴가 아니라 이동 공격이다. 앞마당 생산 건물처럼 집결지보다 앞에서 나오면
  // 예전에는 후퇴로 보고 교전을 끊은 채 달려가다 그대로 맞아 죽었다.
  if (unit.fresh) {
    unit.retreating = false;
    return false;
  }
  const ahead = (unit.y - slot.y) * stwForward(unit.side);
  unit.retreating = unit.retreating ? ahead > 4 : ahead > RALLY_LEASH + 2;
  return unit.retreating;
}

/** 자동 수비 대상: 집결선 뒤(아군 기지 쪽)에 들어왔거나 아군 건물 가까이 있는 적 전투 유닛. 정찰 프로브는 제외. */
function findIntruders(state, side, rallyY) {
  const forward = stwForward(side);
  const own = state.buildings.filter((building) => building.side === side);
  return state.units.filter((unit) => {
    if (unit.side === side || isPassive(unit) || unit.hp <= 0) return false;
    if ((unit.y - rallyY) * forward < 2) return true;
    return own.some((building) => distance(unit.x, unit.y, building.x, building.y) < building.radius + 6);
  });
}

function nearestOf(unit, list) {
  let best = null;
  let bestDistance = Infinity;
  for (const item of list) {
    const d = distance(unit.x, unit.y, item.x, item.y);
    if (d < bestDistance) {
      best = item;
      bestDistance = d;
    }
  }
  return best;
}

/** 옵저버: 공격 병력이 있으면 그 중심 바로 뒤를, 없으면 집결지를 따라다니며 탐지와 시야를 제공한다. */
function observerStep(state, unit, plan, dt) {
  const forward = stwForward(unit.side);
  const escort = state.units.filter((ally) => ally.side === unit.side && ally.group === "attack" && !isPassive(ally));
  let goal;
  if (unit.type === "overlord" && (!state.sides[unit.side].escort || !unit.escort)) {
    // 동행을 끄면 본진 위로 돌아가 기지를 지킨다.
    const home = stwNexus(state, unit.side, "main") ?? stwNexus(state, unit.side, "natural");
    goal = home ? { x: home.x + 4, y: home.y - stwForward(unit.side) * 2 } : stwPoint(unit.side, { x: 20, y: 90 });
  } else if (escort.length) {
    const cx = escort.reduce((sum, ally) => sum + ally.x, 0) / escort.length;
    const lead = escort.reduce((best, ally) => (forward < 0 ? Math.min(best, ally.y) : Math.max(best, ally.y)), escort[0].y);
    goal = { x: cx, y: lead - forward * 2 };
  } else {
    goal = plan.rallySlots.get(unit.id) ?? { x: 20, y: stwRallyY(unit.side, state.sides[unit.side].rally, state) };
  }
  moveToward(unit, goal.x, goal.y, unitSpeed(state, unit), dt);
}

function templarStep(state, unit, plan, dt) {
  const castable = stwResearchDone(state, unit.side, "storm") && unit.energy >= STW_STORM.energy;
  if (castable) {
    const spot = stormSpot(state, unit);
    if (spot) {
      unit.energy -= STW_STORM.energy;
      unit.heading = Math.atan2(spot.y - unit.y, spot.x - unit.x);
      state.storms.push({ id: state.nextId++, side: unit.side, x: spot.x, y: spot.y, ttl: STW_STORM.duration });
      state.sides[unit.side].stats.storms += 1;
      if (unit.side === "player") alertOnce(state, "storm", 4, "player", "사이오닉 스톰!", "good");
      return;
    }
  }
  casterMove(state, unit, plan, unitSpeed(state, unit), dt);
}

/** 지금 쓸 수 있는 마법이 있는지(에너지와 연구). 하이템플러는 사이오닉 스톰. */
function spellReady(state, unit) {
  if (unit.type === "templar") return stwResearchDone(state, unit.side, "storm") && unit.energy >= STW_STORM.energy;
  return (STW_UNITS[unit.type].spells ?? []).some((id) => {
    const spell = STW_SPELLS[id];
    return unit.energy >= spell.energy && (!spell.research || stwResearchDone(state, unit.side, spell.research));
  });
}

/**
 * 무기 없는 마법 유닛의 이동.
 * - 쓸 수 있는 마법이 없으면(에너지 부족·연구 전) 부대 맨 뒤(가장 뒤처진 아군보다 3칸 뒤)에 서고, 6칸 안의 적에게서 물러난다.
 * - 마법을 쓸 수 있으면 부대 최전방(선두와 같은 줄)으로 나가 시전을 시도한다. 물러나지 않는다.
 * - 집결지에서는 자리를 지키다가, 마법을 쓸 수 있고 14칸 안에 적이 오면 7칸까지 다가간다.
 */
function casterMove(state, unit, plan, speed, dt) {
  const slot = unit.group === "attack" ? plan.attackSlots.get(unit.id) : plan.rallySlots.get(unit.id);
  if (unit.group !== "attack" && slot && isRetreating(unit, slot)) {
    moveToward(unit, slot.x, slot.y, speed, dt);
    return;
  }
  const ready = spellReady(state, unit);
  if (!ready) {
    const nearest = findTarget(state, unit, 6, { unitsOnly: true });
    if (nearest && !isPassive(nearest)) {
      // 무기가 없으므로 적과 거리를 벌린다.
      const away = Math.atan2(unit.y - nearest.y, unit.x - nearest.x);
      moveToward(unit, unit.x + Math.cos(away) * 2, unit.y + Math.sin(away) * 2, speed, dt);
      return;
    }
  }
  if (unit.group === "attack") {
    const army = state.units.filter((ally) => ally.side === unit.side && ally.group === "attack" && !isPassive(ally) && STW_UNITS[ally.type].role !== "caster");
    const forward = stwForward(unit.side);
    // 아군 기준으로 앞(적 쪽)일수록 작은 값.
    const ahead = (ally) => ally.y * forward;
    if (!army.length) {
      moveToward(unit, slot ? slot.x : unit.x, plan.goal.y, Math.min(speed, plan.waveSpeed), dt);
      return;
    }
    const lead = army.reduce((best, ally) => (ahead(ally) > ahead(best) ? ally : best), army[0]).y;
    const rear = army.reduce((best, ally) => (ahead(ally) < ahead(best) ? ally : best), army[0]).y;
    const goalY = ready ? lead : rear - forward * 3;
    moveToward(unit, slot ? slot.x : unit.x, goalY, speed, dt);
    return;
  }
  if (ready) {
    const foe = findTarget(state, unit, 14, { unitsOnly: true });
    if (foe && !isPassive(foe)) {
      if (distance(unit.x, unit.y, foe.x, foe.y) > 7) moveToward(unit, foe.x, foe.y, speed, dt);
      return;
    }
  }
  if (slot) moveToward(unit, slot.x, slot.y, speed, dt);
}

/* ───────── 수송 ───────── */

/**
 * 수송선: 작전 경로를 따라 날고, 게릴라 드랍에서는 내린 뒤 근처에 떠서 기다리다 회수한다. 작전이 없으면 집결지 뒤에서 쉰다.
 * 탄 병력은 수송선 자리에 붙어 다니고, 수송선이 떨어지면 함께 죽는다(cleanup).
 */
function transportStep(state, unit, plan, dt) {
  const op = unit.op !== undefined ? (state.ops ?? []).find((item) => item.id === unit.op) : null;
  // 폭탄 드랍으로 함께 날아가는 동안은 가장 느린 수송선 속도에 맞춘다(대형 유지).
  const speed = op && unit.groupSpeed ? Math.min(unitSpeed(state, unit), unit.groupSpeed) : unitSpeed(state, unit);
  if (op?.phase === "load") {
    // 출발 전 탑승: 태울 병력 한가운데로 날아가고, 1.8칸 안에 들어온 병력을 싣는다(병력도 수송선으로 걸어온다).
    const boarding = pendingBoarders(state, unit);
    if (boarding.length) {
      const cx = boarding.reduce((sum, rider) => sum + rider.x, 0) / boarding.length;
      const cy = boarding.reduce((sum, rider) => sum + rider.y, 0) / boarding.length;
      moveToward(unit, cx, cy, speed, dt);
      for (const rider of boarding) if (distance(rider.x, rider.y, unit.x, unit.y) <= 1.8) boardUnit(rider, unit);
    }
  } else if (op?.phase === "pickup") {
    // 회수: 탈 병력 한가운데로 내려앉고, 1.8칸 안에 들어온 병력을 싣는다.
    const boarding = op.riders.map((id) => state.units.find((item) => item.id === id)).filter((rider) => rider && rider.hp > 0 && rider.group === "board");
    if (boarding.length) {
      const cx = boarding.reduce((sum, rider) => sum + rider.x, 0) / boarding.length;
      const cy = boarding.reduce((sum, rider) => sum + rider.y, 0) / boarding.length;
      moveToward(unit, cx, cy, speed, dt);
      for (const rider of boarding) if (distance(rider.x, rider.y, unit.x, unit.y) <= 1.8) boardUnit(rider, unit);
    }
  } else if (op?.phase === "fight") {
    // 내린 병력 가까이(가장자리 쪽 3칸)에 떠서 기다린다. 대공 건물에는 여기서도 맞는다.
    if (unit.hover) moveToward(unit, unit.hover.x, unit.hover.y, speed, dt);
  } else if (unit.dropPath?.length) {
    const next = unit.dropPath[0];
    if (moveToward(unit, next.x, next.y, speed, dt)) unit.dropPath.shift();
  } else if (!op) {
    unit.group = "rally";
    if (unit.type === "overlord") observerStep(state, unit, plan, dt);
    else supportFollow(state, unit, plan, speed, dt);
  }
  for (const id of unit.cargo ?? []) {
    const rider = state.units.find((item) => item.id === id);
    if (rider) {
      rider.x = unit.x;
      rider.y = unit.y;
    }
  }
}

/** 탄 병력을 수송선 둘레에 내려놓는다. */
function unloadCargo(state, unit, setup) {
  const riders = (unit.cargo ?? []).map((id) => state.units.find((item) => item.id === id)).filter(Boolean);
  riders.forEach((rider, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, riders.length);
    rider.x = Math.min(STW_LANE_WIDTH - 1, Math.max(1, unit.x + Math.cos(angle) * 1.6));
    rider.y = Math.min(STW_LANE_LENGTH - 1, Math.max(1, unit.y + Math.sin(angle) * 1.6));
    rider.targetId = null;
    setup(rider);
  });
  unit.cargo = [];
  return riders;
}

/** 적 기지에 내렸음을 알린다(내린 쪽 기록, 맞은 쪽 경보와 수송선 목격). */
function announceLanding(state, unit, riders, kind) {
  state.effects.push({ kind: "warp", side: unit.side, x1: unit.x, y1: unit.y, x2: unit.x, y2: unit.y, ttl: 0.6, max: 0.6, radius: 3 });
  const foe = stwOpponent(unit.side);
  state.sides[foe].droppedAt = state.time;
  state.sides[foe].sawTransportAt = state.time;
  if (unit.side === "player") pushLog(state, "player", kind === "raid" ? `견제 병력 ${riders.length}기가 적 기지에 내렸습니다!` : `폭탄 드랍! 병력 ${riders.length}기가 적 본진에 내렸습니다!`, "good");
  else alertOnce(state, `drop:${kind}`, 15, "player", kind === "raid" ? "적이 광물 줄에 견제 병력을 내렸습니다!" : "적이 본진에 대규모 병력을 내렸습니다!", "danger");
}

/** 다가오는 적 전투 병력 값(지원·일꾼·수송선 제외, 체력 비율 반영). */
function threatValue(state, side, x, y, radius) {
  let value = 0;
  for (const unit of state.units) {
    if (unit.side === side || unit.hp <= 0 || isPassive(unit) || unit.group === "cargo" || STW_UNITS[unit.type].transport) continue;
    if (distance(unit.x, unit.y, x, y) > radius) continue;
    value += unitValue(unit) * (unit.hp + unit.shields) / (unit.maxHp + unit.maxShields);
  }
  return value;
}

/** 정면이 맞붙었는지: 공격 병력 가운데 적 유닛을 노리는 유닛이 있다. */
function frontEngaged(state, side) {
  return state.units.some((unit) => unit.side === side && unit.group === "attack" && unit.raid === undefined && unit.bomb === undefined && unit.targetId !== null
    && state.units.some((other) => other.id === unit.targetId && other.side !== side));
}

/** 폭탄 드랍 집결점(아군 기준 세로 위치): 우리 앞마당 가장자리. 적 대공이 닿지 않는 곳에서 모인다. */
const DROP_STAGE_Y = 72;

/**
 * 출발 전 탑승(load): 정한 병력이 모두 타면(또는 20초가 지나면 못 탄 병력은 두고) 작전을 시작한다.
 * 게릴라는 바로 목표로(out), 폭탄은 우리 진영 가장자리 집결점으로(gather). 아무도 못 탔으면 작전을 접는다.
 */
function stepLoad(state, op, transports) {
  const waiting = transports.flatMap((transport) => pendingBoarders(state, transport));
  if (waiting.length && state.time - op.since <= 20) return;
  for (const rider of waiting) {
    rider.group = "rally";
    rider.boardTo = undefined;
  }
  const loaded = transports.filter((transport) => transport.cargo?.length);
  for (const transport of transports) {
    transport.boarding = [];
    if (transport.cargo?.length) continue;
    transport.op = undefined;
    transport.group = "rally";
    transport.dropPath = [];
  }
  op.transports = loaded.map((transport) => transport.id);
  op.since = state.time;
  if (!loaded.length) {
    op.done = true;
    return;
  }
  if (op.kind === "raid") {
    op.phase = "out";
    for (const transport of loaded) transport.dropPath = dropPath(transport, landingPoint(state, op.side, op.target, op.base));
    return;
  }
  op.phase = "gather";
  const land = landingPoint(state, op.side, op.target, "main");
  const x = edgeX(land.x);
  const stageY = stwPoint(op.side, { x: 0, y: DROP_STAGE_Y }).y;
  loaded.forEach((transport, index) => {
    const offset = (index - (loaded.length - 1) / 2) * 1.6;
    transport.dropPath = [{ x, y: transport.y }, { x, y: stageY + offset }];
  });
}

/**
 * 수송 작전 진행(틱마다).
 * 게릴라: 이동(out) → 내려서 견제(fight) → 회수(pickup) → 귀환(home). 버틴 시간, 다가오는 적, 남은 체력으로 회수를 정한다.
 * 폭탄: 집결(gather) → 정면이 맞붙거나 시간이 차면 동시에 진입(in) → 귀환(home). 내린 병력은 끝까지 싸운다.
 */
function stepOps(state) {
  const find = (id) => state.units.find((item) => item.id === id && item.hp > 0);
  for (const op of state.ops ?? []) {
    const transports = op.transports.map(find).filter(Boolean);
    const record = state.sides[op.side];
    if (op.kind === "walk") {
      stepWalkOp(state, op);
      continue;
    }
    if (op.phase === "load") {
      stepLoad(state, op, transports);
      continue;
    }
    if (op.kind === "raid") {
      const transport = transports[0];
      const riders = op.riders.map(find).filter(Boolean);
      if (!transport) {
        // 수송선을 잃으면 내려 있던 병력은 그 자리에서 끝까지 싸운다.
        for (const rider of riders) {
          rider.raid = undefined;
          if (rider.group === "board") rider.group = "attack";
        }
        op.done = true;
        continue;
      }
      if (op.phase === "out" && !transport.dropPath.length) {
        const landed = unloadCargo(state, transport, (rider) => {
          rider.group = "attack";
          rider.raid = op.id;
        });
        op.riders = landed.map((rider) => rider.id);
        op.value = landed.reduce((sum, rider) => sum + unitValue(rider), 0);
        op.phase = "fight";
        op.since = state.time;
        transport.hover = { x: transport.x + (edgeX(transport.x) - transport.x) * 0.4, y: transport.y };
        announceLanding(state, transport, landed, "raid");
      } else if (op.phase === "fight") {
        const alive = riders.filter((rider) => rider.group !== "cargo");
        if (!alive.length) {
          op.phase = "home";
          transport.dropPath = homePath(op.side, transport);
          continue;
        }
        const cx = alive.reduce((sum, rider) => sum + rider.x, 0) / alive.length;
        const cy = alive.reduce((sum, rider) => sum + rider.y, 0) / alive.length;
        const aliveValue = alive.reduce((sum, rider) => sum + unitValue(rider) * (rider.hp + rider.shields) / (rider.maxHp + rider.maxShields), 0);
        const health = alive.reduce((sum, rider) => sum + rider.hp + rider.shields, 0) / alive.reduce((sum, rider) => sum + rider.maxHp + rider.maxShields, 0);
        const timeUp = state.time - op.since > STW_TRANSPORT.raidDwell || Boolean(op.recallNow);
        const outnumbered = threatValue(state, op.side, cx, cy, 10) > aliveValue * STW_TRANSPORT.retreatRatio;
        if (timeUp || outnumbered || health < STW_TRANSPORT.hpRatio) {
          op.phase = "pickup";
          op.since = state.time;
          for (const rider of alive) {
            rider.group = "board";
            rider.targetId = null;
          }
          if (op.side === "player" && !op.recallNow) pushLog(state, "player", timeUp ? "견제를 마치고 병력을 회수합니다." : "적 병력이 몰려와 견제 병력을 회수합니다.", "order");
        }
      } else if (op.phase === "pickup") {
        const waiting = riders.filter((rider) => rider.group === "board");
        if (!waiting.length || state.time - op.since > STW_TRANSPORT.pickupTimeout) {
          for (const rider of waiting) {
            rider.group = "attack";
            rider.raid = undefined;
          }
          op.phase = "home";
          transport.dropPath = homePath(op.side, transport);
        }
      } else if (op.phase === "home" && !transport.dropPath.length) {
        unloadCargo(state, transport, (rider) => {
          rider.group = "rally";
          rider.raid = undefined;
        });
        transport.op = undefined;
        transport.hover = undefined;
        transport.group = "rally";
        op.done = true;
        if (op.repeat && record.dropPlan?.repeat) record.raidRelaunchAt = state.time + STW_TRANSPORT.relaunchDelay;
      }
      continue;
    }
    // 폭탄 드랍
    if (!transports.length) {
      op.done = true;
      continue;
    }
    if (op.phase === "gather") {
      // 우리 진영 가장자리 집결점에서 모두 모일 때까지 기다린다(안전한 곳이라 오래 기다려도 된다). 정면 출격과 동시에면 정면이 맞붙을 때까지.
      const arrived = transports.every((transport) => !transport.dropPath.length);
      const waited = state.time - op.since;
      const ready = (arrived || waited > STW_TRANSPORT.gatherTimeout) && (!op.sync || frontEngaged(state, op.side) || waited > STW_TRANSPORT.syncTimeout);
      if (ready) {
        op.phase = "in";
        const land = landingPoint(state, op.side, op.target, "main");
        // 함께 날아간다: 가장 느린 수송선 속도에 맞춰 같은 길로 가서 2.4칸 간격으로 동시에 내린다.
        const groupSpeed = Math.min(...transports.map((transport) => unitSpeed(state, transport)));
        transports.forEach((transport, index) => {
          const spread = (index - (transports.length - 1) / 2) * 2.4;
          transport.groupSpeed = groupSpeed;
          transport.dropPath = dropPath(transport, { x: Math.min(STW_LANE_WIDTH - 2, Math.max(2, land.x + spread)), y: land.y });
        });
      }
    } else if (op.phase === "in") {
      for (const transport of transports) {
        if (transport.dropPath.length || !transport.cargo?.length) continue;
        const landed = unloadCargo(state, transport, (rider) => {
          rider.group = "attack";
          rider.bomb = op.target;
        });
        op.riders.push(...landed.map((rider) => rider.id));
        announceLanding(state, transport, landed, "bomb");
        transport.dropPath = homePath(op.side, transport);
      }
      if (transports.every((transport) => !transport.cargo?.length)) op.phase = "home";
    } else if (op.phase === "home" && transports.every((transport) => !transport.dropPath.length)) {
      for (const transport of transports) {
        transport.groupSpeed = undefined;
        // 내리기 전에 거둔 폭탄 드랍은 태운 병력을 집결지에 내린다.
        if (transport.cargo?.length) unloadCargo(state, transport, (rider) => {
          rider.group = "rally";
          rider.bomb = undefined;
        });
        transport.op = undefined;
        transport.group = "rally";
      }
      op.done = true;
    }
  }
  if (state.ops?.length) state.ops = state.ops.filter((op) => !op.done);
  // 계속 견제: 돌아와서 잠시 뒤 다시 나간다(병력이 모자라면 기다린다).
  for (const side of STW_SIDES) {
    const record = state.sides[side];
    if (record.raidRelaunchAt === undefined || state.time < record.raidRelaunchAt) continue;
    if (!record.dropPlan?.repeat || record.dropPlan.mission !== "raid") {
      record.raidRelaunchAt = undefined;
      continue;
    }
    if (stwDropCheck(state, side, "raid").ok) {
      record.raidRelaunchAt = undefined;
      stwCommand(state, side, { type: "drop", mission: "raid" });
    } else record.raidRelaunchAt = state.time + 3;
  }
}

/**
 * 게릴라 드랍으로 내린 병력: 가까이(사거리+2) 온 적 유닛과는 싸우고, 아니면 목표 광물 줄의 일꾼을 친다(기술 건물이 목표면 그 건물).
 * 일꾼이 다 없으면 보통 공격으로 돌아간다. 처리했으면 true.
 */
function raidRiderStep(state, unit, dt) {
  const op = (state.ops ?? []).find((item) => item.id === unit.raid);
  if (!op) {
    unit.raid = undefined;
    return false;
  }
  const near = findTarget(state, unit, unitRange(state, unit) + 2, { unitsOnly: true });
  if (near && !isPassive(near)) {
    unit.targetId = near.id;
    return false;
  }
  const foe = stwOpponent(unit.side);
  if (op.target === "tech") {
    const goal = nearestBuilding(state, unit, foe, "tech");
    if (goal) return chaseBuilding(state, unit, goal, dt);
  }
  const split = stwWorkerSplit(state, foe);
  const workers = op.base === "natural" ? split.natural : split.main + split.idle;
  if (!workers) return false;
  const center = mineralCenter(state, foe, op.base);
  if (distance(unit.x, unit.y, center.x, center.y) > 3) {
    unit.targetId = null;
    moveToward(unit, center.x + ((unit.id % 5) - 2) * 1.2, center.y, unitSpeed(state, unit), dt);
    return true;
  }
  if (unit.cooldown <= 0) hitWorkers(state, unit, foe, op.base, workers, center);
  return true;
}

/** 침투 작전(walk) 중인 유닛인지(걷는 중이든 광물 줄에서 싸우는 중이든). */
function inWalkOp(state, unit) {
  return unit.raid !== undefined && (state.ops ?? []).some((op) => op.id === unit.raid && op.kind === "walk");
}

/** 유닛들을 침투 작전에서 뺀다(부대 명령을 받았을 때). 남은 유닛이 없는 작전은 다음 틱에 끝난다. 뺀 수를 돌려준다. */
function leaveWalkOps(state, units) {
  let count = 0;
  for (const unit of units) {
    if (!inWalkOp(state, unit)) continue;
    unit.raid = undefined;
    unit.walkPath = undefined;
    unit.targetId = null;
    if (unit.group === "walk") unit.group = "rally";
    count += 1;
  }
  return count;
}

/**
 * 침투 경로: 가까운 가장자리로 비켜서 그 가장자리를 따라 목표 높이까지 간 뒤 목표로(게릴라 드랍 수송선의 길과 같다).
 * 협곡에서는 지상 유닛이 절벽 안쪽 길로 밀려 길 가장자리를 타고 간다.
 */
function walkPath(unit, goal) {
  const x = edgeX(unit.x);
  return [{ x, y: unit.y }, { x, y: goal.y }, goal];
}

/** 침투 병력의 이동: 교전하지 않고 경로를 따라 걷는다. 다 걸으면 도착(가는 길이면 광물 줄 견제, 돌아오는 길이면 대기 병력). */
function walkStep(state, unit, dt) {
  unit.targetId = null;
  const next = unit.walkPath?.[0];
  if (next) {
    // 서로 밀려 정확한 점에 못 서도 1.2칸 안이면 닿은 것으로 친다.
    if (moveToward(unit, next.x, next.y, unitSpeed(state, unit), dt) || distance(unit.x, unit.y, next.x, next.y) < 1.2) unit.walkPath.shift();
    if (unit.walkPath.length) return;
  }
  unit.walkPath = undefined;
  const op = (state.ops ?? []).find((item) => item.id === unit.raid);
  if (op && op.phase !== "home") {
    // 광물 줄에 닿았다: 게릴라 드랍 병력처럼 싸운다(raidRiderStep).
    unit.group = "attack";
    return;
  }
  unit.group = "rally";
  unit.raid = undefined;
}

/** 침투 병력을 모두 돌려보낸다(가장자리를 따라 집결지로, 교전하지 않고). */
function walkHome(state, op) {
  const home = { x: STW_LANE_WIDTH / 2, y: stwRallyY(op.side, state.sides[op.side].rally, state) };
  for (const id of op.riders) {
    const unit = state.units.find((item) => item.id === id && item.hp > 0);
    if (!unit || unit.raid !== op.id) continue;
    unit.group = "walk";
    unit.targetId = null;
    unit.walkPath = walkPath(unit, { x: home.x + ((unit.id % 5) - 2) * 1.6, y: home.y });
  }
  op.phase = "home";
  op.since = state.time;
}

/** 침투 작전: 걷는 중 → 광물 줄 견제(게릴라 드랍과 같은 철수 규칙) → 걸어서 귀환. */
function stepWalkOp(state, op) {
  const riders = op.riders.map((id) => state.units.find((item) => item.id === id && item.hp > 0)).filter((unit) => unit && unit.raid === op.id);
  if (!riders.length) {
    op.done = true;
    return;
  }
  if (op.phase === "out") {
    if (riders.some((unit) => unit.group !== "walk")) {
      op.phase = "fight";
      op.since = state.time;
      if (op.side === "player") pushLog(state, "player", `침투 병력이 적 ${op.base === "natural" ? "앞마당" : "본진"} 광물 줄에 닿았습니다.`, "good");
    }
    return;
  }
  if (op.phase === "fight") {
    // 침투 병력은 스스로 물러나지 않는다: 일꾼을 치고, 일꾼이 없으면 기지를 치며 죽거나 회수("지금 회수")할 때까지 싸운다.
    // 예전에는 게릴라 드랍의 철수 규칙(25초·적 병력·체력 절반)을 그대로 써서, 수송선 없이 걸어 나오다 같은 방어선에 죽거나
    // 오는 길에 깎인 다크템플러가 광물 줄에 닿자마자 공격 없이 돌아서기도 했다. 회수는 dropRecall이 바로 walkHome으로 돌린다.
    return;
  }
  if (riders.every((unit) => unit.group !== "walk")) op.done = true;
}

/** 폭탄 드랍으로 내린 병력: 가까운 적 유닛과 싸우고, 아니면 목표 종류의 건물(생산·기술·본진)을 먼저 친다. */
function bombRiderStep(state, unit, dt) {
  const near = findTarget(state, unit, unitRange(state, unit) + 2, { unitsOnly: true });
  if (near && !isPassive(near)) {
    unit.targetId = near.id;
    return false;
  }
  const goal = nearestBuilding(state, unit, stwOpponent(unit.side), unit.bomb);
  if (!goal) {
    unit.bomb = undefined;
    return false;
  }
  return chaseBuilding(state, unit, goal, dt);
}

function nearestBuilding(state, unit, side, kind) {
  let best = null;
  let bestDistance = Infinity;
  for (const building of state.buildings) {
    if (building.side !== side || building.hp <= 0 || !canHit(unit, building)) continue;
    if (kind && kind !== "any" && buildingKind(building.type) !== kind) continue;
    const d = distance(unit.x, unit.y, building.x, building.y);
    if (d < bestDistance) {
      best = building;
      bestDistance = d;
    }
  }
  return best;
}

/** 멀면 건물 쪽으로 걷고(true), 가까우면 그 건물을 목표로 넘겨 보통 공격이 치게 한다(false). */
function chaseBuilding(state, unit, building, dt) {
  const d = distance(unit.x, unit.y, building.x, building.y) - building.radius;
  if (d > unitRange(state, unit) + 5) {
    unit.targetId = null;
    moveToward(unit, building.x, building.y, unitSpeed(state, unit), dt);
    return true;
  }
  unit.targetId = building.id;
  return false;
}

/** 광물 줄 일꾼을 친다: 피해가 일꾼 체력만큼 쌓일 때마다 1기가 죽는다. 범위 공격은 두 배로 친다. */
function hitWorkers(state, unit, foe, base, workers, center) {
  const def = STW_UNITS[unit.type];
  const workerType = stwRace(state, foe).worker;
  const dummy = { kind: "unit", type: workerType, size: "small" };
  const damage = stwHitDamage(state, unit, dummy).reduce((sum, amount) => sum + amount, 0) * (def.splash ? 2 : 1);
  unit.cooldown = attackCooldown(state, unit, def, null);
  const spot = { x: center.x + (nextRandom(state) - 0.5) * 6, y: center.y + (nextRandom(state) - 0.5) * 1.5 };
  unit.heading = Math.atan2(spot.y - unit.y, spot.x - unit.x);
  state.effects.push({ kind: ATTACK_EFFECT[unit.type] ?? "plasma", side: unit.side, x1: unit.x, y1: unit.y, x2: spot.x, y2: spot.y, ttl: 0.2, max: 0.2, attackerId: unit.id });
  const record = state.sides[foe];
  record.workerDamage ??= { main: 0, natural: 0 };
  record.workerDamage[base] += damage;
  const hp = STW_WORKER_HP[workerType] ?? 40;
  let killed = 0;
  while (record.workerDamage[base] >= hp && killed < workers && record.probes > 0) {
    record.workerDamage[base] -= hp;
    record.probes -= 1;
    killed += 1;
    state.effects.push({ kind: "death", side: foe, x1: spot.x, y1: spot.y, x2: spot.x, y2: spot.y, ttl: 0.5, max: 0.5, radius: 1.2 });
  }
  if (def.suicide) unit.hp = 0;
  if (!killed) return;
  record.stats.workersLost = (record.stats.workersLost ?? 0) + killed;
  const own = state.sides[unit.side].stats;
  own.workersKilled = (own.workersKilled ?? 0) + killed;
  const workerName = STW_UNITS[workerType].name;
  if (foe === "player") alertOnce(state, `workers:${base}`, 6, "player", `${base === "natural" ? "앞마당" : "본진"} 광물 줄의 ${withKoreanSubject(workerName)} 죽고 있습니다! 지금까지 ${record.stats.workersLost}기 잃음`, "danger");
  else alertOnce(state, "workersKilled", 6, "player", `적 ${workerName} ${own.workersKilled}기 처치`, "good");
}

/* ───────── 마법 ───────── */

/** 마법 대상이 될 수 있는 적 유닛: 살아 있고, 수송선 밖이고, 탐지되고, 스테이시스 밖. */
function spellFoes(state, caster, range) {
  return state.units.filter((unit) => unit.side !== caster.side && unit.hp > 0 && unit.group !== "cargo" && !inStasis(state, unit)
    && distance(caster.x, caster.y, unit.x, unit.y) <= range + unit.radius && stwDetected(state, unit, caster.side));
}

/** 깨끗한 마법 자리를 찾는 거리: 시전 사거리 밖 이만큼까지는 다가가서 쓴다(스톰과 범위 마법 공통). */
const SPELL_LOOKAHEAD = 6;

/** 범위 마법 판정: 유닛 반경의 절반까지 걸치면 맞는다(foesAround·스톰과 같은 식). */
const inArea = (unit, spot, radius) => distance(unit.x, unit.y, spot.x, spot.y) <= radius + unit.radius * 0.5;

/**
 * 범위 마법을 떨어뜨릴 자리(스톰·플레이그·인스네어·EMP·마엘스트롬·스테이시스 공통).
 * 마법은 아군에게 걸리지 않지만, 원작의 시전 습관처럼 아군과 맞붙은 적 최전선보다 아군이 없는 적 무리를 노린다.
 * - 적 무리 한가운데와, 아군에게서 멀어지는 쪽으로 1·2칸 민 자리를 함께 따진다.
 * - 아군이 반경에 걸리지 않는 자리 중 적 가치가 가장 큰 곳에 쓴다.
 * - 그런 자리가 사거리 밖 SPELL_LOOKAHEAD칸 안에 있으면 이번에는 쓰지 않는다(다가가서 쓴다).
 * - 없으면 (적 가치 − 아군 가치 × 2)가 가장 큰, 아군이 걸리는 자리에 쓴다.
 * pool은 노릴 적, value는 유닛 하나의 가치, skip은 쓰면 안 되는 자리(겹치는 스톰 등)다.
 */
function areaSpot(state, caster, { pool, range, radius, minTargets, value, skip }) {
  const allies = state.units.filter((unit) => unit.side === caster.side && unit.hp > 0 && unit.group !== "cargo");
  let clean = null;
  let cleanScore = -Infinity;
  let cleanReachable = false;
  let mixed = null;
  let mixedScore = -Infinity;
  const reach = range + SPELL_LOOKAHEAD;
  for (const enemy of pool) {
    if (distance(caster.x, caster.y, enemy.x, enemy.y) > reach) continue;
    let count = 0;
    let sx = 0;
    let sy = 0;
    for (const other of pool) {
      if (distance(enemy.x, enemy.y, other.x, other.y) <= radius) {
        count += 1;
        sx += other.x;
        sy += other.y;
      }
    }
    if (count < minTargets) continue;
    const center = { x: sx / count, y: sy / count };
    // 아군에게서 멀어지는 쪽: 반경 + 3칸 안 아군들의 무게중심에서 무리 중심으로 향하는 방향.
    const near = allies.filter((ally) => distance(ally.x, ally.y, center.x, center.y) <= radius + 3);
    const spots = [center];
    if (near.length) {
      const ax = near.reduce((sum, ally) => sum + ally.x, 0) / near.length;
      const ay = near.reduce((sum, ally) => sum + ally.y, 0) / near.length;
      const length = distance(ax, ay, center.x, center.y);
      if (length > 0.01) for (const shift of [1, 2]) spots.push({ x: center.x + ((center.x - ax) / length) * shift, y: center.y + ((center.y - ay) / length) * shift });
    }
    for (const spot of spots) {
      const far = distance(caster.x, caster.y, spot.x, spot.y);
      if (far > reach + 1) continue;
      if (skip?.(spot)) continue;
      const probe = { x: spot.x, y: spot.y };
      const foes = pool.filter((unit) => inArea(unit, probe, radius));
      if (foes.length < minTargets) continue;
      const friends = allies.filter((unit) => inArea(unit, probe, radius));
      const foeValue = foes.reduce((sum, unit) => sum + value(unit), 0);
      const inRange = far <= range + 1;
      if (!friends.length) {
        cleanReachable = true;
        if (inRange && foeValue > cleanScore) {
          cleanScore = foeValue;
          clean = probe;
        }
      } else if (inRange) {
        const score = foeValue - friends.reduce((sum, unit) => sum + value(unit), 0) * 2;
        if (score > mixedScore) {
          mixedScore = score;
          mixed = probe;
        }
      }
    }
  }
  if (clean) return clean;
  return cleanReachable ? null : mixed;
}

/** 범위 마법 자리: 조건에 맞는 적이 minTargets 이상 걸리는 곳(마릿수로 센다). 고르는 규칙은 areaSpot. */
function clusterSpot(state, caster, spell, filter) {
  const pool = spellFoes(state, caster, spell.range + SPELL_LOOKAHEAD + spell.radius).filter((unit) => !isPassive(unit) && filter(unit));
  return areaSpot(state, caster, { pool, range: spell.range, radius: spell.radius, minTargets: spell.minTargets, value: () => 1 });
}

function foesAround(state, caster, spot, radius) {
  return state.units.filter((unit) => unit.side !== caster.side && unit.hp > 0 && unit.group !== "cargo" && distance(spot.x, spot.y, unit.x, unit.y) <= radius + unit.radius * 0.5);
}

const unitValue = (unit) => STW_UNITS[unit.type].minerals + STW_UNITS[unit.type].gas;

/** 마법마다 대상을 고르고 효과를 건다. 걸었으면 시전 지점을, 쓸 만한 대상이 없으면 null을 돌려준다. */
const SPELL_CASTERS = {
  feedback(state, caster, spell) {
    const target = spellFoes(state, caster, spell.range).filter((unit) => unit.energy >= 50 && STW_UNITS[unit.type].energyRegen).sort((a, b) => b.energy - a.energy)[0];
    if (!target) return null;
    applyDamage(state, target, target.energy, { ignoreArmor: true });
    target.energy = 0;
    target.lastHit = state.time;
    return { x: target.x, y: target.y, targetId: target.id };
  },
  maelstrom(state, caster, spell) {
    const spot = clusterSpot(state, caster, spell, (unit) => isBiological(unit) && !stunned(state, unit));
    if (!spot) return null;
    for (const unit of foesAround(state, caster, spot, spell.radius)) if (isBiological(unit)) unit.stunUntil = Math.max(unit.stunUntil ?? 0, state.time + spell.duration);
    return spot;
  },
  stasis(state, caster, spell) {
    const spot = clusterSpot(state, caster, spell, (unit) => !stunned(state, unit));
    if (!spot) return null;
    for (const unit of foesAround(state, caster, spot, spell.radius)) {
      unit.stasisUntil = state.time + spell.duration;
      unit.stunUntil = Math.max(unit.stunUntil ?? 0, state.time + spell.duration);
      unit.targetId = null;
    }
    return spot;
  },
  lockdown(state, caster, spell) {
    const target = spellFoes(state, caster, spell.range).filter((unit) => STW_UNITS[unit.type].mech && !isPassive(unit) && !stunned(state, unit) && unitValue(unit) >= 150).sort((a, b) => unitValue(b) - unitValue(a))[0];
    if (!target) return null;
    target.stunUntil = state.time + spell.duration;
    target.targetId = null;
    return { x: target.x, y: target.y, targetId: target.id };
  },
  matrix(state, caster, spell) {
    const target = state.units
      .filter((unit) => unit.side === caster.side && unit.hp > 0 && unit.group !== "cargo" && !isPassive(unit) && state.time - unit.lastHit < 1 && unit.maxHp + unit.maxShields >= 100
        && !(unit.matrix && state.time < unit.matrix.until && unit.matrix.hp > 0) && distance(caster.x, caster.y, unit.x, unit.y) <= spell.range)
      .sort((a, b) => b.maxHp + b.maxShields - (a.maxHp + a.maxShields))[0];
    if (!target) return null;
    target.matrix = { hp: spell.absorb, until: state.time + spell.duration };
    return { x: target.x, y: target.y, targetId: target.id };
  },
  emp(state, caster, spell) {
    const spot = clusterSpot(state, caster, spell, (unit) => unit.shields >= 30 || unit.energy >= 50);
    if (!spot) return null;
    for (const unit of foesAround(state, caster, spot, spell.radius)) {
      unit.shields = 0;
      unit.energy = 0;
      unit.lastHit = state.time;
    }
    for (const building of state.buildings) {
      if (building.side !== caster.side && distance(spot.x, spot.y, building.x, building.y) <= spell.radius + building.radius) building.shields = 0;
    }
    return spot;
  },
  irradiate(state, caster, spell) {
    // 아군이 바로 옆(반경 + 1칸)에 붙어 있지 않은 대상을 먼저 고른다. 그런 대상이 사거리 밖 SPELL_LOOKAHEAD칸 안에 있으면
    // 다가가서 쓰고, 없을 때만 아군과 맞붙은 대상에게 쓴다(이레디에이트는 대상 편 생체 유닛에게만 피해를 준다).
    const allies = state.units.filter((unit) => unit.side === caster.side && unit.hp > 0 && unit.group !== "cargo");
    let clean = null;
    let cleanScore = 1.5;
    let cleanReachable = false;
    let mixed = null;
    let mixedScore = 1.5;
    for (const unit of spellFoes(state, caster, spell.range + SPELL_LOOKAHEAD)) {
      if (!isBiological(unit) || isPassive(unit) || (unit.irradiateUntil ?? 0) > state.time) continue;
      const near = state.units.filter((other) => other.side === unit.side && other.hp > 0 && isBiological(other) && distance(other.x, other.y, unit.x, unit.y) <= spell.radius).length;
      const score = near + (unitValue(unit) >= 150 ? 2 : 0);
      if (score <= 1.5) continue;
      const inRange = distance(caster.x, caster.y, unit.x, unit.y) <= spell.range + unit.radius;
      if (!allies.some((ally) => inArea(ally, unit, spell.radius + 1))) {
        cleanReachable = true;
        if (inRange && score > cleanScore) {
          cleanScore = score;
          clean = unit;
        }
      } else if (inRange && score > mixedScore) {
        mixedScore = score;
        mixed = unit;
      }
    }
    const best = clean ?? (cleanReachable ? null : mixed);
    if (!best) return null;
    best.irradiateUntil = state.time + spell.duration;
    return { x: best.x, y: best.y, targetId: best.id };
  },
  yamato(state, caster, spell) {
    // 체력(보호막 포함) 100 이상인 목표만 노린다(저글링·히드라 같은 작은 유닛에는 아낀다). 순서: 싸우는 유닛 → 공격하는 방어 건물 → 싸우지 않는 유닛(오버로드·수송선 등) → 그 밖의 건물.
    // 예전에는 싸우지 않는 유닛과 일반 건물은 노리지 않아, 저글링·히드라·뮤탈만 상대하는 동안 배틀크루저가 8분 넘게 한 번도 쏘지 못했다.
    const sturdy = (item) => item.hp + item.shields >= YAMATO_MIN_HP && !((item.yamatoAt ?? -99) > state.time - 2);
    const toughest = (list) => list.sort((a, b) => b.hp + b.shields - (a.hp + a.shields))[0];
    const foes = spellFoes(state, caster, spell.range).filter(sturdy);
    const buildings = state.buildings.filter((building) => building.side !== caster.side && building.hp > 0 && sturdy(building)
      && distance(caster.x, caster.y, building.x, building.y) - building.radius <= spell.range);
    const target = toughest(foes.filter((unit) => !isPassive(unit)))
      ?? toughest(buildings.filter((building) => STW_BUILDINGS[building.type].damage))
      ?? toughest(foes.filter((unit) => isPassive(unit)))
      ?? toughest(buildings.filter((building) => !STW_BUILDINGS[building.type].damage));
    if (!target) return null;
    target.yamatoAt = state.time;
    state.pendingHits.push({ attacker: caster, target, hits: [spell.damage] });
    state.effects.push({ kind: "yamato", side: caster.side, x1: caster.x, y1: caster.y, x2: target.x, y2: target.y, ttl: 0.9, max: 0.9, attackerId: caster.id, targetId: target.id });
    return { x: target.x, y: target.y, targetId: target.id };
  },
  ensnare(state, caster, spell) {
    const spot = clusterSpot(state, caster, spell, (unit) => !ensnared(state, unit));
    if (!spot) return null;
    for (const unit of foesAround(state, caster, spot, spell.radius)) unit.ensnareUntil = state.time + spell.duration;
    return spot;
  },
  broodling(state, caster, spell) {
    const target = spellFoes(state, caster, spell.range).filter((unit) => !isFlying(unit) && isBiological(unit) && !isPassive(unit) && unitValue(unit) >= 100).sort((a, b) => unitValue(b) - unitValue(a))[0];
    if (!target) return null;
    target.hp = 0;
    for (let index = 0; index < 2; index += 1) {
      const brood = spawnUnit(state, caster.side, "broodling", target.x + (index ? 0.8 : -0.8), target.y);
      brood.bornAt = state.time;
      brood.group = caster.group === "attack" ? "attack" : "rally";
    }
    return { x: target.x, y: target.y, targetId: target.id };
  },
  darkSwarm(state, caster, spell) {
    // 원거리 적에게 맞고 있는 아군 지상 전투 유닛이 셋 이상 뭉친 곳을 덮는다.
    const shooters = state.units.filter((unit) => unit.side !== caster.side && unit.hp > 0 && !isPassive(unit) && STW_UNITS[unit.type].role !== "melee" && (unitRange(state, unit) >= 3 || unit.sieged))
      .concat(state.buildings.filter((building) => building.side !== caster.side && STW_BUILDINGS[building.type].damage && building.type !== "sunken"));
    if (!shooters.length) return null;
    const allies = state.units.filter((unit) => unit.side === caster.side && unit.hp > 0 && unit.group !== "cargo" && !isFlying(unit) && !isPassive(unit) && STW_UNITS[unit.type].role !== "caster"
      && distance(caster.x, caster.y, unit.x, unit.y) <= spell.range && !underSwarm(state, unit)
      && shooters.some((shooter) => distance(shooter.x, shooter.y, unit.x, unit.y) <= 12));
    let best = null;
    let bestCount = 2;
    for (const center of allies) {
      const near = allies.filter((other) => distance(center.x, center.y, other.x, other.y) <= spell.radius);
      if (near.length > bestCount) {
        bestCount = near.length;
        best = { x: near.reduce((sum, other) => sum + other.x, 0) / near.length, y: near.reduce((sum, other) => sum + other.y, 0) / near.length };
      }
    }
    if (!best) return null;
    state.zones ??= [];
    state.zones.push({ id: state.nextId++, kind: "swarm", side: caster.side, x: best.x, y: best.y, radius: spell.radius, ttl: spell.duration, max: spell.duration });
    return best;
  },
  plague(state, caster, spell) {
    const spot = clusterSpot(state, caster, spell, (unit) => !((unit.plagueUntil ?? 0) > state.time) && unit.hp > 20);
    if (!spot) return null;
    for (const unit of foesAround(state, caster, spot, spell.radius)) unit.plagueUntil = state.time + spell.duration;
    return spot;
  },
};

/** 야마토 포가 노리는 목표의 최소 체력(보호막 포함). 뮤탈리스크(120)·레이스(120)·드라군(180)까지 노리고, 히드라(80)·해병(45)·저글링(35)에는 아낀다. */
const YAMATO_MIN_HP = 100;

/** 쓸 수 있는 마법을 하나 쓴다(데이터의 spells 순서대로 확인). 썼으면 true. */
function castSpells(state, unit) {
  const def = STW_UNITS[unit.type];
  if (!def.spells || (unit.castReadyAt ?? 0) > state.time) return false;
  for (const id of def.spells) {
    const spell = STW_SPELLS[id];
    if (unit.energy < spell.energy) continue;
    if (spell.research && !stwResearchDone(state, unit.side, spell.research)) continue;
    const cast = SPELL_CASTERS[id](state, unit, spell);
    if (!cast) continue;
    unit.energy -= spell.energy;
    unit.castReadyAt = state.time + 1;
    unit.heading = Math.atan2(cast.y - unit.y, cast.x - unit.x);
    state.effects.push({ kind: "spell", spell: id, side: unit.side, x1: unit.x, y1: unit.y, x2: cast.x, y2: cast.y, ttl: 1, max: 1, radius: spell.radius ?? 1.4, attackerId: unit.id, targetId: cast.targetId });
    const stats = state.sides[unit.side].stats;
    stats.spells = (stats.spells ?? 0) + 1;
    if (id === "yamato") {
      // 야마토 포는 쏠 때마다 무엇을 노렸는지 적는다(한 방이 커서 어디에 썼는지가 중요하다).
      const target = state.units.find((item) => item.id === cast.targetId) ?? state.buildings.find((item) => item.id === cast.targetId);
      const name = target ? (STW_UNITS[target.type] ?? STW_BUILDINGS[target.type]).name : "목표";
      if (unit.side === "player") pushLog(state, "player", `야마토 포가 적 ${withKoreanObject(name)} 노립니다 (피해 ${spell.damage}).`, "good");
      else pushLog(state, "player", `적 배틀크루저의 야마토 포가 우리 ${withKoreanObject(name)} 노립니다 (피해 ${spell.damage})!`, "danger");
    } else if (unit.side === "player") alertOnce(state, `spell:${id}`, 4, "player", `${spell.name}!`, "good");
    else if (["stasis", "maelstrom", "lockdown", "plague", "irradiate", "emp", "broodling"].includes(id)) alertOnce(state, `foeSpell:${id}`, 8, "player", `적의 ${spell.name}!`, "danger");
    return true;
  }
  return false;
}

/** 지속 효과: 플레이그(체력 1까지), 이레디에이트(주변 생체 유닛까지), 다크 스웜 구역 시간. */
function stepStatuses(state, dt) {
  for (const zone of state.zones ?? []) zone.ttl -= dt;
  if (state.zones?.length) state.zones = state.zones.filter((zone) => zone.ttl > 0);
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;
    if ((unit.plagueUntil ?? 0) > state.time && unit.hp > 1 && !inStasis(state, unit)) {
      unit.hp = Math.max(1, unit.hp - STW_SPELLS.plague.dps * dt);
      unit.lastHit = state.time;
    }
    if ((unit.irradiateUntil ?? 0) > state.time) {
      for (const other of state.units) {
        if (other.side !== unit.side || other.hp <= 0 || other.group === "cargo" || !isBiological(other) || inStasis(state, other)) continue;
        if (distance(unit.x, unit.y, other.x, other.y) > STW_SPELLS.irradiate.radius + other.radius * 0.5) continue;
        other.hp -= STW_SPELLS.irradiate.dps * dt;
        other.lastHit = state.time;
      }
    }
    if (unit.matrix && (state.time >= unit.matrix.until || unit.matrix.hp <= 0)) delete unit.matrix;
  }
}

/** 유닛이 스톰 판정 안에 있는지(유닛 반경의 절반까지 걸치면 맞는다). */
function inStorm(unit, storm) {
  return inArea(unit, storm, STW_STORM.radius);
}

/**
 * 스톰 자리: 아직 아군 스톰에 맞지 않는 적이 3기 이상 뭉친 곳. 고르는 규칙은 areaSpot(아군이 걸리지 않는 자리 우선, 적은 가치로 센다).
 * 새 스톰의 중심은 기존 아군 스톰 중심에서 반경 이상 떨어져야 한다.
 */
function stormSpot(state, caster) {
  const own = state.storms.filter((storm) => storm.side === caster.side);
  // 스톰에 맞는 판정(stepStorms)과 같은 식으로 "이미 맞고 있는" 적을 가린다. 일꾼·지원·죽은·안 보이는 유닛은 세지 않는다.
  const candidates = state.units.filter((unit) => unit.side !== caster.side && unit.hp > 0 && !isPassive(unit) && targetable(state, caster, unit));
  const pool = candidates.filter((unit) => !own.some((storm) => inStorm(unit, storm)));
  return areaSpot(state, caster, {
    pool, range: STW_STORM.castRange, radius: STW_STORM.radius, minTargets: STW_STORM.minTargets, value: armyValueOf,
    skip: (spot) => own.some((storm) => distance(storm.x, storm.y, spot.x, spot.y) < STW_STORM.radius),
  });
}

/**
 * 아군 스톰을 피하는 걸음(보이는 모습을 원작처럼): 스톰은 아군에게 피해를 주지 않지만, 이번 틱 시작 때 아군 스톰 밖에 있던
 * 지상 유닛이 그 안으로 들어갔으면 제자리로 되돌린다. 스톰은 3초면 끝나므로 경계에서 기다렸다가 다시 들어간다.
 * 적은 원작처럼 피하지 않는다.
 */
function stormSafeStarts(state) {
  const starts = new Map();
  if (!state.storms.length) return starts;
  for (const unit of state.units) {
    if (unit.hp <= 0 || isFlying(unit)) continue;
    if (!state.storms.some((storm) => storm.side === unit.side && inStorm(unit, storm))) starts.set(unit, { x: unit.x, y: unit.y });
  }
  return starts;
}

function holdOutsideOwnStorms(state, starts) {
  for (const [unit, start] of starts) {
    if (unit.hp <= 0 || !state.storms.some((storm) => storm.side === unit.side && inStorm(unit, storm))) continue;
    unit.x = start.x;
    unit.y = start.y;
    // 스톰 경계에서 기다리는 것은 막힌 것이 아니다(막힘 판정이 목표를 포기하지 않게 잰 자리를 새로 잡는다).
    unit.approach = undefined;
  }
}

function stepStorms(state, dt) {
  for (const storm of state.storms) storm.ttl -= dt;
  state.storms = state.storms.filter((storm) => storm.ttl > 0);
  const hit = new Set();
  for (const storm of state.storms) {
    for (const unit of state.units) {
      // 적만 맞는다(아군·건물은 맞지 않는다). 겹친 스톰은 한 번만 맞는다.
      if (unit.side === storm.side || hit.has(unit.id) || unit.group === "cargo") continue;
      if (!inStorm(unit, storm)) continue;
      hit.add(unit.id);
      applyDamage(state, unit, STW_STORM.dps * dt, { ignoreArmor: true });
      unit.lastHit = state.time;
    }
  }
}

function scoutStep(state, unit, dt) {
  const def = STW_UNITS[unit.type];
  if (unit.scoutPhase === "out") {
    if (unit.scoutPath?.length) {
      const next = unit.scoutPath[0];
      if (moveToward(unit, next.x, next.y, def.speed, dt)) unit.scoutPath.shift();
      if (!unit.scoutPath.length) unit.scoutPhase = "back";
      return;
    }
    const goal = stwPoint(unit.side, { x: 26, y: 9 });
    if (moveToward(unit, goal.x, goal.y, def.speed, dt)) unit.scoutPhase = "back";
    return;
  }
  const home = stwPoint(unit.side, { x: 20, y: 90 });
  // 함께 돌아온 정찰 일꾼끼리 서로 밀어내 복귀 지점에 닿지 못하고 맴돌던 일이 있어, 곁에 다른 정찰 일꾼이 있으면 1.5칸 안을 복귀로 친다.
  const jammed = Math.hypot(home.x - unit.x, home.y - unit.y) < 1.5
    && state.units.some((other) => other !== unit && other.side === unit.side && other.hp > 0 && other.group === "scout" && Math.hypot(other.x - unit.x, other.y - unit.y) < 2);
  if (moveToward(unit, home.x, home.y, def.speed, dt) || jammed) {
    unit.hp = 0;
    unit.returned = true;
    state.sides[unit.side].probes += 1;
    if (unit.scoutMode === "resources" && unit.side === "player" && !unit.scoutRecalled) reportResources(state, unit.side);
  }
}

/** 자원 정찰 보고: 적 일꾼 수, 가스 건물 수, 앞마당 확장 여부(정찰하며 본 적 본진 기준). */
function reportResources(state, side) {
  const intel = state.sides[side].intel;
  if (!intel) {
    pushLog(state, side, "자원 정찰 보고: 적 본진을 보지 못했습니다.", "warn");
    return;
  }
  const race = STW_RACES[intel.race ?? "protoss"];
  const gas = intel.buildings[race.refinery] ?? 0;
  const expanded = (intel.buildings[race.base] ?? 0) > 1;
  pushLog(state, side, `자원 정찰 보고: 적 ${STW_UNITS[race.worker].name} ${intel.probes}기 · 가스 ${gas}곳 · 앞마당 ${expanded ? "확장함" : "확장 안 함"}`, "info");
}

/** 자리를 잡은 유닛: 이번 틱에 사거리 안의 적 유닛과 싸우고 있거나, 시즈 모드 탱크·땅속 럴커. */
function planted(state, unit) {
  return unit.plantedAt === state.time || Boolean(unit.sieged) || Boolean(unit.burrowed);
}

/** 같은 편 공중 유닛끼리 떨어지는 거리(두 반지름 합에 곱함)와, 한 틱에 겹친 만큼의 몇 분의 일을 밀어낼지. */
const FLYER_SPACING = 0.85;
const FLYER_PUSH = 0.25;

/**
 * 같은 편 공중 유닛은 서로 겹치지 않게 조금씩 벌린다. 지상 밀어내기(separate)는 공중 유닛을 빼므로, 같은 목표로 날아가는
 * 캐리어 셋이 한 점에 겹쳐 하나로 보였다. 한 번에 다 밀지 않고 겹친 만큼의 1/4씩 밀어, 이동과 맞서며 부드럽게 퍼진다.
 * 적 공중 유닛과는 밀지 않는다(공중전은 서로 겹쳐도 된다).
 */
function spreadFlyers(state) {
  const flyers = state.units.filter((unit) => isFlying(unit) && unit.group !== "cargo" && unit.hp > 0);
  for (let i = 0; i < flyers.length; i += 1) {
    const a = flyers[i];
    for (let j = i + 1; j < flyers.length; j += 1) {
      const b = flyers[j];
      if (a.side !== b.side) continue;
      const min = (a.radius + b.radius) * FLYER_SPACING;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
      const d = Math.hypot(dx, dy);
      if (d >= min) continue;
      const push = (min - d) * 0.5 * FLYER_PUSH;
      const nx = d > 0.001 ? dx / d : (a.id % 2 ? 1 : -1);
      const ny = d > 0.001 ? dy / d : 0;
      a.x = clampX(a.x - nx * push);
      a.y -= ny * push;
      b.x = clampX(b.x + nx * push);
      b.y += ny * push;
    }
  }
}

const clampX = (x) => Math.min(STW_LANE_WIDTH - 0.5, Math.max(0.5, x));

function separate(state) {
  const units = state.units;
  const map = stwMap(state);
  for (let i = 0; i < units.length; i += 1) {
    const a = units[i];
    if (isFlying(a) || a.group === "cargo") continue;
    for (let j = i + 1; j < units.length; j += 1) {
      const b = units[j];
      if (isFlying(b) || b.group === "cargo") continue;
      const min = (a.radius + b.radius) * (a.side === b.side ? 0.9 : 1);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
      const d = Math.hypot(dx, dy);
      if (d >= min) continue;
      // 교전선 유지: 아군이 자리를 잡고 싸우는 앞줄을 앞뒤로 밀지 못한다. 그 몫은 뒤의 아군이 떠안고,
      // 옆으로는 반씩 비켜 준다(그래야 뒤의 근접 유닛이 틈으로 들어온다).
      // 예전에는 앞줄이 아군에게 밀려 적 몸으로 들어가고, 겹친 적을 다시 반씩 밀어내 교전선이 한쪽으로 쭉 밀렸다.
      // 적끼리는 어느 한쪽이라도 자리를 잡았으면 가로로만 반씩 비켜 준다(세로로 밀면 교전선이 밀린다).
      // (서로 자리를 잡은 적을 아예 밀지 않으면 수가 많은 저글링이 질럿 몸 안으로 겹쳐 들어가 지나치게 둘러쌌고,
      // 움직이는 쪽이 모두 비켜 주게 하면 프로토스 : 저그가 44 : 124까지 기울었다.)
      const overlap = min - d;
      const nx = d > 0.001 ? dx / d : (a.id % 2 ? 1 : -1);
      const ny = d > 0.001 ? dy / d : 0;
      const holdA = planted(state, a);
      const holdB = planted(state, b);
      let ax = -nx * overlap * 0.5;
      let ay = -ny * overlap * 0.5;
      let bx = nx * overlap * 0.5;
      let by = ny * overlap * 0.5;
      if (a.side !== b.side && (holdA || holdB)) {
        const sideways = Math.sign(dx) || (a.id % 2 ? 1 : -1);
        [ax, ay, bx, by] = [-sideways * overlap * 0.5, 0, sideways * overlap * 0.5, 0];
      }
      // 따로 옮기는 부대·침투 병력이 지나가면 막고 선 아군이 옆으로 비켜 준다(지나가는 쪽은 밀리지 않는다).
      // 예전에는 앞에 몰려 선 질럿이 자리를 지켜, 뒤의 다크템플러만 따로 보내도 길이 막혀 나가지 못했다.
      const passA = Boolean(a.passing) || a.group === "walk";
      const passB = Boolean(b.passing) || b.group === "walk";
      if (a.side === b.side && passA !== passB && !(passA ? b : a).sieged && !(passA ? b : a).burrowed) {
        const away = (Math.sign(dx) || (a.id % 2 ? 1 : -1)) * (passA ? 1 : -1);
        if (passA) [ax, ay, bx, by] = [0, 0, away * overlap, ny * overlap * 0.3];
        else [ax, ay, bx, by] = [away * overlap, -ny * overlap * 0.3, 0, 0];
      } else if (a.side === b.side && (holdA || holdB)) {
        // 자리 잡은 유닛은 아군에게 밀릴 때 레인 세로(교전선 앞뒤)로는 움직이지 않고 가로로만 비켜 준다.
        // 그 몫은 움직이는 아군이 떠안고, 둘 다 자리를 잡았으면 버린다(앞뒤로 조금 겹친 채 둔다).
        if (holdA) {
          if (!holdB) by -= ay;
          ay = 0;
        }
        if (holdB) {
          if (!holdA) ay -= by;
          by = 0;
        }
      }
      a.x += ax;
      a.y += ay;
      b.x += bx;
      b.y += by;
    }
    // 지상 유닛은 전장 안에, 협곡에서는 절벽 사이 길 안에 둔다(공중 유닛은 위에서 걸러져 절벽을 넘는다).
    a.y = Math.min(STW_LANE_LENGTH - 1, Math.max(1, a.y));
    const [left, right] = stwGroundSpan(map, a.y);
    a.x = Math.min(right, Math.max(left, a.x));
  }
}

function regenerate(state, dt) {
  for (const list of [state.units, state.buildings]) {
    for (const item of list) {
      if (item.hp <= 0) continue;
      if (item.kind === "building" && !stwDone(item)) continue;
      // 저그 유닛은 싸우는 중에도 체력이 조금씩 회복된다.
      if (item.kind === "unit" && STW_UNITS[item.type].race === "zerg" && item.hp < item.maxHp) item.hp = Math.min(item.maxHp, item.hp + STW_ECONOMY.zergRegen * dt);
      if (state.time - item.lastHit < STW_ECONOMY.shieldRegenDelay) continue;
      if (item.shields < item.maxShields) item.shields = Math.min(item.maxShields, item.shields + STW_ECONOMY.shieldRegen * dt);
      // 테란·저그 건물: 공격받지 않으면 체력이 천천히 회복된다(테란은 SCV 수리, 저그는 재생).
      if (item.kind === "building" && STW_BUILDINGS[item.type].race !== "protoss" && item.hp < item.maxHp) item.hp = Math.min(item.maxHp, item.hp + STW_ECONOMY.shieldRegen * dt);
    }
  }
  repairMech(state, dt);
  for (const scan of state.scans ?? []) scan.ttl -= dt;
  if (state.scans?.length) state.scans = state.scans.filter((scan) => scan.ttl > 0);
}

/** 테란 기계 유닛을 고칠 수 있는 자리: 같은 편의 완성된 커맨드 센터 가장자리에서 STW_REPAIR.reach칸 안. */
export function stwNearRepair(state, unit) {
  return state.buildings.some((building) => building.side === unit.side && building.hp > 0 && STW_BUILDINGS[building.type].base
    && STW_BUILDINGS[building.type].race === "terran" && stwDone(building)
    && distance(building.x, building.y, unit.x, unit.y) - building.radius - unit.radius <= STW_REPAIR.reach);
}

/**
 * SCV 수리: 커맨드 센터 곁에 STW_REPAIR.delay초 넘게 머문 테란 기계 유닛의 체력을 생산 시간 동안 모두 채우고,
 * 채운 비율만큼 값의 STW_REPAIR.costRatio를 쓴다. 채취 인원은 줄지 않는다(SCV가 붙는 모습은 렌더러가 그린다).
 */
function repairMech(state, dt) {
  for (const unit of state.units) {
    const def = STW_UNITS[unit.type];
    if (def.race !== "terran" || !def.mech || def.worker) continue;
    const near = unit.hp > 0 && unit.group !== "cargo" && stwNearRepair(state, unit);
    unit.repairWait = near ? Math.round(((unit.repairWait ?? 0) + dt) * 1000) / 1000 : 0;
    unit.repairing = false;
    if (!near || unit.repairWait < STW_REPAIR.delay || unit.hp >= unit.maxHp) continue;
    const gain = Math.min(unit.maxHp - unit.hp, (unit.maxHp / def.time) * dt);
    const share = (gain / unit.maxHp) * STW_REPAIR.costRatio;
    const minerals = def.minerals * share;
    const gas = def.gas * share;
    const record = state.sides[unit.side];
    if (record.minerals < minerals || record.gas < gas) continue;
    record.minerals -= minerals;
    record.gas -= gas;
    record.stats.repaired = (record.stats.repaired ?? 0) + gain;
    record.stats.repairCost = (record.stats.repairCost ?? 0) + minerals + gas;
    unit.hp += gain;
    unit.repairing = true;
  }
}

function stepEffects(state, dt) {
  for (const effect of state.effects) effect.ttl -= dt;
  state.effects = state.effects.filter((effect) => effect.ttl > 0);
}

function cleanup(state) {
  // 떨어진 수송선에 탄 병력은 함께 죽는다.
  for (const unit of state.units) {
    if (unit.hp > 0 || !unit.cargo?.length) continue;
    for (const id of unit.cargo) {
      const rider = state.units.find((item) => item.id === id);
      if (rider) rider.hp = 0;
    }
    if (unit.side === "player") pushLog(state, "player", `수송선이 격추되어 탄 병력 ${unit.cargo.length}기를 잃었습니다.`, "danger");
    unit.cargo = [];
  }
  const dead = state.units.filter((unit) => unit.hp <= 0);
  for (const unit of dead) {
    if (!unit.returned && !isWorker(unit)) state.sides[unit.side].stats.valueLost = (state.sides[unit.side].stats.valueLost ?? 0) + armyValueOf(unit);
    if (unit.returned) continue;
    state.sides[unit.side].stats.lost += 1;
    state.sides[stwOpponent(unit.side)].stats.kills += 1;
    // 지도 위의 일꾼(정찰 등)이 죽으면 잃은 일꾼·처치한 일꾼에도 센다(결과 표에 정찰 일꾼이 빠졌다).
    if (isWorker(unit)) {
      state.sides[unit.side].stats.workersLost = (state.sides[unit.side].stats.workersLost ?? 0) + 1;
      state.sides[stwOpponent(unit.side)].stats.workersKilled = (state.sides[stwOpponent(unit.side)].stats.workersKilled ?? 0) + 1;
    }
    state.effects.push({ kind: "death", side: unit.side, x1: unit.x, y1: unit.y, x2: unit.x, y2: unit.y, ttl: 0.7, max: 0.7, radius: ["dragoon", "reaver", "archon", "tank", "vulture", "lurker", "ultra", "overlord"].includes(unit.type) ? 3.6 : STW_UNITS[unit.type].supply >= 4 ? 5 : unit.radius * 2 });
    if (isWorker(unit) && unit.group === "scout" && unit.side === "player") pushLog(state, "player", `정찰 ${withKoreanObject(STW_UNITS[unit.type].name)} 잃었습니다.`, "warn");
    if (unit.type === "overlord" && unit.side === "player") pushLog(state, "player", state.sides.player.escort ? "동행 오버로드를 잃었습니다. 인구 상한이 8 줄었습니다." : "기지를 떠난 오버로드를 잃었습니다. 인구 상한이 8 줄었습니다.", "danger");
  }
  if (dead.length) state.units = state.units.filter((unit) => unit.hp > 0);
  const fallen = state.buildings.filter((building) => building.hp <= 0);
  for (const building of fallen) {
    const name = STW_BUILDINGS[building.type].base && building.base === "natural" ? `앞마당 ${STW_BUILDINGS[building.type].name}` : STW_BUILDINGS[building.type].name;
    state.sides[building.side].stats.buildingsLost += 1;
    state.sides[stwOpponent(building.side)].stats.buildingsDestroyed += 1;
    state.effects.push({ kind: "collapse", side: building.side, x1: building.x, y1: building.y, x2: building.x, y2: building.y, ttl: 1.1, max: 1.1, radius: building.radius * 1.5 });
    if (building.research) state.sides[building.side].research[building.research.id] = undefined;
    if (building.side === "player") pushLog(state, "player", `${withKoreanSubject(name)} 파괴되었습니다.`, "danger");
    else pushLog(state, "player", `적 ${withKoreanObject(name)} 파괴했습니다!`, "good");
  }
  if (fallen.length) state.buildings = state.buildings.filter((building) => building.hp > 0);
}

/* ───────── 시야와 정찰 ───────── */

/** 해당 진영이 지금 그 지점을 볼 수 있는지. */
export function stwVisible(state, side, x, y, pad = 0) {
  for (const unit of state.units) {
    if (unit.side === side && distance(unit.x, unit.y, x, y) <= STW_UNITS[unit.type].sight + pad) return true;
  }
  for (const building of state.buildings) {
    if (building.side === side && distance(building.x, building.y, x, y) <= (STW_BUILDINGS[building.type].sight ?? 8) + pad) return true;
  }
  for (const scan of state.scans ?? []) {
    if (scan.side === side && distance(scan.x, scan.y, x, y) <= scan.radius + pad) return true;
  }
  return false;
}

function updateVision(state) {
  for (const side of STW_SIDES) {
    const record = state.sides[side];
    const foe = stwOpponent(side);
    const alive = new Set();
    for (const building of state.buildings) {
      if (building.side !== foe) continue;
      alive.add(building.id);
      if (stwVisible(state, side, building.x, building.y, building.radius)) {
        record.seen[building.id] = { id: building.id, type: building.type, x: building.x, y: building.y, base: building.base, radius: building.radius, at: state.time };
      }
    }
    for (const [id, memory] of Object.entries(record.seen)) {
      // 지금 보이는 자리에서 사라진 건물은 기억에서 지운다.
      if (!alive.has(Number(id)) && stwVisible(state, side, memory.x, memory.y)) delete record.seen[id];
    }
    // 적 수송선(셔틀·드랍십, 병력을 실은 오버로드)이 우리 쪽 절반에 보이면 기억하고 알린다.
    for (const unit of state.units) {
      if (unit.side !== foe || unit.hp <= 0) continue;
      const carrying = STW_UNITS[unit.type].transport || (unit.type === "overlord" && (unit.cargo?.length || unit.dropPath?.length));
      if (!carrying || (side === "player" ? unit.y < 50 : unit.y > 50) || !stwVisible(state, side, unit.x, unit.y)) continue;
      record.sawTransportAt = state.time;
      if (side === "player") alertOnce(state, "transport", 30, "player", "적 수송선이 다가옵니다! 본진에 방어 건물을 갖추세요.", "danger");
    }
    const foeMain = stwNexus(state, foe, "main");
    if (foeMain && stwVisible(state, side, foeMain.x, foeMain.y, 2)) {
      const fresh = !record.intel || state.time - record.intel.time > 20;
      record.intel = takeIntel(state, foe);
      if (fresh && side === "player") pushLog(state, "player", `정찰 성공: ${intelSummary(record.intel)}`, "good");
    }
  }
}

function takeIntel(state, foe) {
  const buildings = {};
  for (const building of state.buildings) if (building.side === foe) buildings[building.type] = (buildings[building.type] ?? 0) + 1;
  const units = Object.fromEntries(STW_ARMY_UNITS.map((type) => [type, 0]));
  for (const unit of state.units) if (unit.side === foe && units[unit.type] !== undefined) units[unit.type] += 1;
  const research = Object.entries(state.sides[foe].research).filter(([, value]) => value).map(([id, value]) => ({ id, status: value }));
  return { time: state.time, race: state.sides[foe].race, buildings, units, research, probes: state.sides[foe].probes };
}

/** 테크 단계: 위 건물이 있으면 그 이름을 보여 준다. */
const TECH_LADDER = {
  protoss: ["tribunal", "beacon", "archives", "stargate", "robo", "citadel", "core"],
  terran: ["science", "starport", "armory", "shop", "factory", "academy", "barracks"],
  zerg: ["mound", "nest", "cavern", "spire", "den", "pool"],
};

export function intelSummary(intel) {
  if (!intel) return "정보 없음";
  const race = STW_RACES[intel.race ?? "protoss"];
  const producers = intel.buildings[race.mainProducer] ?? 0;
  const techId = TECH_LADDER[race.id].find((id) => intel.buildings[id]);
  const tech = techId ? STW_BUILDINGS[techId].name : "기본 테크";
  const main = Object.entries(intel.units).sort((a, b) => b[1] - a[1])[0];
  const army = main && main[1] > 0 ? `${STW_UNITS[main[0]].name} 위주` : "병력 거의 없음";
  return `${race.name} · ${STW_BUILDINGS[race.mainProducer].name} ${producers} · ${tech} · ${army}${(intel.buildings[race.base] ?? 0) > 1 ? " · 앞마당 있음" : ""}`;
}

/**
 * 후퇴 명령(지도 뒤쪽 탭, 후퇴, 본진 수비, 집결지로 소환)은 자동 출격을 잠시 멈춘다. 멈추지 않으면 "즉시"나 작은 출격 규모에서
 * 물러난 병력이 집결지에 닿자마자(또는 바로) 다시 출격해 후퇴가 먹히지 않는다. 출격하거나 앞쪽을 누르거나 자동 출격을 다시 고르면 풀린다.
 */
function holdAutoWave(state, side) {
  const record = state.sides[side];
  if (!record.autoWave || record.autoWaveHold) return;
  record.autoWaveHold = true;
  if (side === "player") pushLog(state, side, "자동 출격을 잠시 멈춥니다. 출격하거나 지도 앞쪽을 누르면 다시 켜집니다.", "order");
}

function autoWaves(state) {
  for (const side of STW_SIDES) {
    const record = state.sides[side];
    if (!record.autoWave || record.autoWaveHold) continue;
    const army = stwArmy(state, side);
    const rallyY = stwRallyY(side, record.rally, state);
    // "즉시"(1)는 집결지에 모이기를 기다리지 않고 생산되는 대로 내보낸다.
    // 따로 둔 부대는 세지도 내보내지도 않는다.
    const main = army.fighters.filter((unit) => unit.squad === undefined);
    const ready = record.autoWave <= 1 ? main : main.filter((unit) => Math.abs(unit.y - rallyY) < 8);
    if (ready.length && ready.length >= record.autoWave) stwCommand(state, side, { type: "attack", keepSquads: true });
  }
}

/** 광물 수입이 없고 남은 광물로 아무것도 만들 수 없으며 만드는 중인 것도 없는지(모든 유닛에 광물이 든다. 가스만 남아도 못 만든다). */
function cannotProduce(state, side) {
  const record = state.sides[side];
  if (stwIncome(state, side).minerals > 0 || record.minerals >= 50) return false;
  return !state.buildings.some((building) => building.side === side && (building.current || building.queue.length));
}

/** 양쪽 모두 수입·공격할 수 있는 병력·생산이 없어 더 이상 승부가 날 수 없는 상태인지. 오버로드·수송선·메딕처럼 공격하지 못하는 유닛은 세지 않는다. */
function exhausted(state, side) {
  if (!cannotProduce(state, side)) return false;
  return !state.units.some((unit) => unit.side === side && !isWorker(unit) && unit.hp > 0 && STW_UNITS[unit.type].damage);
}

function checkVictory(state) {
  const playerMain = stwNexus(state, "player", "main");
  const enemyMain = stwNexus(state, "enemy", "main");
  if (playerMain && enemyMain) {
    // 양쪽 다 자원이 바닥나고 병력도 없으면 30초 뒤 무승부로 끝낸다.
    state.stalemate = exhausted(state, "player") && exhausted(state, "enemy") ? (state.stalemate ?? 0) + STW_TICK : 0;
    // 양쪽 다 더 만들 수 없는데 90초 동안 아무것도 맞지 않았으면: 공격할 수 있는 병력이 남아 있으면 최종 결전,
    // 결전 중에 또 90초 동안 아무것도 맞지 않으면 무승부(병력이 남아도 서로 닿지 않으면 끝나지 않던 문제).
    const stuck = cannotProduce(state, "player") && cannotProduce(state, "enemy") && state.time - (state.lastDamageAt ?? 0) >= 90;
    if (stuck && !state.finalBattle && STW_SIDES.some((side) => hasAttackers(state, side))) {
      startFinalBattle(state);
      return;
    }
    if (state.finalBattle) keepFinalBattle(state);
    if (state.stalemate < 30 && !stuck) return;
    state.status = "over";
    state.winner = "draw";
    pushLog(state, "player", state.finalBattle ? "최종 결전에서도 승부가 나지 않아 무승부입니다." : stuck ? "양쪽 모두 자원이 바닥나고 90초 동안 싸움이 없어 무승부입니다." : "양쪽 모두 자원과 병력이 바닥나 무승부입니다.", "info");
    return;
  }
  state.status = "over";
  state.winner = playerMain ? "player" : enemyMain ? "enemy" : "draw";
  const lostBase = STW_BUILDINGS[stwRace(state, state.winner === "player" ? "enemy" : "player").base].name;
  pushLog(state, "player", state.winner === "player" ? `적 본진 ${withKoreanObject(lostBase)} 파괴했습니다. 승리!` : `본진 ${withKoreanSubject(lostBase)} 파괴되었습니다.`, state.winner === "player" ? "good" : "danger");
}

/** 공격할 수 있는 유닛(무기가 있는 유닛)이 하나라도 있는지. */
function hasAttackers(state, side) {
  return state.units.some((unit) => unit.side === side && unit.hp > 0 && !isWorker(unit) && STW_UNITS[unit.type].damage);
}

/**
 * 최종 결전: 양쪽 다 자원이 바닥나 더 만들 수 없고 90초 동안 싸움이 없으면, 남은 병력이 모두 적진으로 나가 끝까지 싸운다.
 * 이때부터 사람도 AI도 지휘하지 않는다. 본진이 무너지면 승패가 나고, 다시 90초 동안 아무것도 맞지 않으면 무승부다.
 */
function startFinalBattle(state) {
  state.finalBattle = { at: state.time };
  state.lastDamageAt = state.time;
  for (const side of STW_SIDES) state.sides[side].squads = {};
  keepFinalBattle(state);
  pushLog(state, "player", "자원이 모두 바닥났습니다. 최종 결전! 남은 병력이 모두 적진으로 나갑니다(지휘할 수 없습니다).", "danger");
}

/** 최종 결전 중: 대기·부대·침투 중인 병력(일꾼·수송선 제외)을 모두 공격 병력으로 둔다. 수송선에 탄 병력은 내리면 합류한다. */
function keepFinalBattle(state) {
  for (const unit of state.units) {
    if (unit.hp <= 0 || isWorker(unit) || STW_UNITS[unit.type].transport) continue;
    if (unit.group === "attack" || unit.group === "cargo" || unit.group === "board" || unit.group === "scout" || unit.group === "drop") continue;
    unit.group = "attack";
    delete unit.squad;
    unit.raid = undefined;
    unit.walkPath = undefined;
    unit.fresh = false;
  }
}

export function stwClock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}
