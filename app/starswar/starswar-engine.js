// 스타즈워 규칙 엔진. React와 DOM에 의존하지 않는 결정적 시뮬레이션.
// 플레이어와 AI는 같은 stwCommand만 쓴다.
import { withKoreanDirection, withKoreanObject, withKoreanSubject } from "../korean-particles.js";
import {
  STW_ARMY_UNITS,
  STW_BUILDINGS,
  STW_CANCEL_REFUND,
  STW_DIFFICULTIES,
  STW_ECONOMY,
  STW_LANE_LENGTH,
  STW_LANE_WIDTH,
  STW_LAYOUT,
  STW_AI_PERSONAS,
  STW_PRODUCERS,
  STW_PRODUCER_UNITS,
  STW_RACES,
  STW_RALLY_POINTS,
  STW_RESEARCH,
  STW_SIZE_MULTIPLIER,
  STW_STORM,
  STW_TICK,
  STW_UNITS,
} from "./starswar-data.js";

export const STW_SIDES = ["player", "enemy"];

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

/** 지금 은폐 상태인지: 다크템플러·옵저버는 항상, 럴커는 땅속에 숨어 있을 때. */
function isCloaked(unit) {
  const def = STW_UNITS[unit.type];
  return Boolean(def?.cloaked || (def?.burrow && unit.burrowed));
}

/** 생산에 드는 인구: 저글링처럼 2기씩 나오면 두 배. */
function batchSupply(def) {
  return def.supply * (def.pair ? 2 : 1);
}

/** 전투에 직접 끼지 않는 유닛(일꾼, 비행 탐지기). */
function isPassive(unit) {
  return isWorker(unit) || isFlying(unit);
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

export function stwRallyY(side, rallyId) {
  const point = STW_RALLY_POINTS.find((item) => item.id === rallyId) ?? STW_RALLY_POINTS[0];
  return side === "player" ? point.y : STW_LANE_LENGTH - point.y;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function nextRandom(state) {
  state.rngState = (state.rngState * 1664525 + 1013904223) >>> 0;
  return state.rngState / 4294967296;
}

/* ───────── 생성 ───────── */

function createSide(id, persona, race) {
  return {
    id,
    race,
    minerals: STW_ECONOMY.startMinerals,
    gas: 0,
    probes: STW_ECONOMY.startProbes,
    bases: { main: { minerals: STW_ECONOMY.mainMinerals }, natural: { minerals: STW_ECONOMY.naturalMinerals } },
    research: {},
    rally: "main",
    autoWave: 0,
    intel: null,
    seen: {},
    persona,
    escort: false,
    stats: { minerals: 0, gas: 0, produced: 0, lost: 0, kills: 0, buildingsLost: 0, buildingsDestroyed: 0, storms: 0 },
    ai: null,
  };
}

export function createStarswarGame({ difficulty = "normal", seed = 20261101, aiSides = ["enemy"], personas = {}, races = {} } = {}) {
  const state = {
    version: 1,
    time: 0,
    difficulty: STW_DIFFICULTIES[difficulty] ? difficulty : "normal",
    rngState: seed >>> 0,
    status: "playing",
    winner: null,
    nextId: 1,
    accumulator: 0,
    sides: {
      player: createSide("player", personas.player ?? null, STW_RACES[races.player] ? races.player : "protoss"),
      enemy: createSide("enemy", personas.enemy ?? null, STW_RACES[races.enemy] ? races.enemy : "protoss"),
    },
    units: [],
    buildings: [],
    storms: [],
    scans: [],
    effects: [],
    pendingHits: [],
    log: [],
    alerts: {},
    aiSides: [...aiSides],
  };
  for (const side of STW_SIDES) {
    if (!state.sides[side].persona && state.aiSides.includes(side)) {
      const race = state.sides[side].race;
      const personas = Object.values(STW_AI_PERSONAS)
        .filter((persona) => persona.race === race && !(state.difficulty === "easy" && EASY_EXCLUDED_PERSONAS.includes(persona.id)))
        .map((persona) => persona.id);
      state.sides[side].persona = personas[Math.floor(nextRandom(state) * personas.length)];
    }
    const nexus = placeBuilding(state, side, stwRace(state, side).base, stwPoint(side, STW_LAYOUT.mainNexus), "main", "nexus-main");
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
  // 저글링 반 칸은 올림해서 보여 준다.
  return { used: Math.ceil(used - 1e-9), cap: Math.min(STW_ECONOMY.supplyLimit, cap) };
}

/** 프로브 배치: 가스, 본진 광물, 앞마당 광물, 놀고 있는 수. */
export function stwWorkerSplit(state, side) {
  const record = state.sides[side];
  const gasSlots = state.buildings.filter((building) => building.side === side && STW_BUILDINGS[building.type].refinery && stwDone(building)).length * STW_ECONOMY.probesPerGas;
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

function mineralRate(count) {
  const full = Math.min(count, STW_ECONOMY.fullSaturation);
  const over = Math.max(0, Math.min(count, STW_ECONOMY.maxSaturation) - STW_ECONOMY.fullSaturation);
  return (full + over * STW_ECONOMY.overflowRate) * STW_ECONOMY.mineralRate;
}

function incomeMultiplier(state, side) {
  return side === "enemy" && state.aiSides.includes("enemy") && !state.aiSides.includes("player") ? STW_DIFFICULTIES[state.difficulty].income : 1;
}

/** 분당 예상 수입. */
export function stwIncome(state, side) {
  const split = stwWorkerSplit(state, side);
  const multiplier = incomeMultiplier(state, side);
  return {
    minerals: Math.round((mineralRate(split.main) + mineralRate(split.natural)) * multiplier * 60),
    gas: Math.round(split.gas * STW_ECONOMY.gasPerProbe * multiplier * 60),
  };
}

/**
 * @param {any} state
 * @param {string} side
 * @returns {{ rally: any[], attack: any[], counts: Record<string, number> }}
 */
export function stwArmy(state, side) {
  const army = { rally: [], attack: [], counts: Object.fromEntries(STW_ARMY_UNITS.map((type) => [type, 0])) };
  for (const unit of state.units) {
    if (unit.side !== side || isWorker(unit)) continue;
    army[unit.group === "attack" ? "attack" : "rally"].push(unit);
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
  const order = list.map((_, i) => i);
  // 목록은 뒤쪽(본진 안쪽)부터 정렬돼 있다. 캐논은 앞줄부터 채운다.
  if (frontFirst) order.reverse();
  const index = order.find((i) => !used.has(`${prefix}-${i}`));
  return index === undefined ? null : { key: `${prefix}-${index}`, point: stwPoint(side, list[index]) };
}

function placementFor(state, side, type) {
  if (STW_BUILDINGS[type]?.refinery) {
    const slot = freeSlot(state, side, STW_LAYOUT.geysers, "geyser");
    return slot ? { ...slot, base: "main" } : null;
  }
  const natural = stwNexus(state, side, "natural");
  if (STW_BUILDINGS[type]?.defense) {
    if (natural) {
      const slot = freeSlot(state, side, STW_LAYOUT.naturalSlots, "natural");
      if (slot) return { ...slot, base: "natural" };
    }
    const front = freeSlot(state, side, STW_LAYOUT.mainSlots, "main", { frontFirst: true });
    return front ? { ...front, base: "main" } : null;
  }
  const main = freeSlot(state, side, STW_LAYOUT.mainSlots, "main");
  if (main) return { ...main, base: "main" };
  if (natural && stwDone(natural)) {
    const slot = freeSlot(state, side, STW_LAYOUT.naturalSlots, "natural");
    if (slot) return { ...slot, base: "natural" };
  }
  return null;
}

export function stwBuildCheck(state, side, type) {
  const record = state.sides[side];
  if (type === "expand") {
    if (stwNexus(state, side, "natural")) return fail("이미 앞마당에 기지가 있습니다");
    const point = stwPoint(side, STW_LAYOUT.naturalNexus);
    if (state.units.some((unit) => unit.side !== side && distance(unit.x, unit.y, point.x, point.y) < 12)) return fail("앞마당에 적이 있습니다");
    return costCheck(record, STW_BUILDINGS[stwRace(state, side).base].minerals, 0);
  }
  const def = STW_BUILDINGS[type];
  if (!def || def.base) return fail("지을 수 없는 건물입니다");
  if (def.race !== record.race) return fail("이 종족은 지을 수 없는 건물입니다");
  if (def.requires && !stwHas(state, side, def.requires)) return fail(`${withKoreanSubject(STW_BUILDINGS[def.requires].name)} 필요합니다`);
  if (def.requiresResearch && !stwResearchDone(state, side, def.requiresResearch)) return fail(`${withKoreanSubject(STW_RESEARCH[def.requiresResearch].name)} 필요합니다`);
  if (def.unique && stwOwnBuildings(state, side, type).length) return fail("이미 있습니다");
  if (!placementFor(state, side, type)) return fail(def.refinery ? "가스 간헐천이 모두 찼습니다" : "지을 자리가 없습니다");
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
  if (state.units.some((unit) => unit.side === side && unit.group === "scout")) return fail("정찰 중");
  if (state.sides[side].probes < 5) return fail(`${STW_UNITS[stwRace(state, side).worker].name} 5기 이상 필요`);
  return { ok: true };
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

export function stwCommand(state, side, command) {
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
        placeBuilding(state, side, race.base, stwPoint(side, STW_LAYOUT.naturalNexus), "natural", "nexus-natural");
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
    case "rally": {
      if (!STW_RALLY_POINTS.some((point) => point.id === command.point)) return fail("알 수 없는 위치입니다");
      record.rally = command.point;
      if (side === "player") {
        const name = STW_RALLY_POINTS.find((point) => point.id === command.point).name;
        pushLog(state, side, `집결지를 ${withKoreanDirection(name)} 옮깁니다.`, "order");
      }
      return { ok: true };
    }
    case "attack": {
      const army = stwArmy(state, side);
      if (!army.rally.length) return fail("출격할 대기 병력이 없습니다");
      for (const unit of army.rally) unit.group = "attack";
      if (side === "player") pushLog(state, side, `대기 병력 ${army.rally.length}기가 출격합니다!`, "order");
      return { ok: true };
    }
    case "retreat": {
      const army = stwArmy(state, side);
      if (!army.attack.length) return fail("공격 중인 병력이 없습니다");
      for (const unit of army.attack) unit.group = "rally";
      if (side === "player") pushLog(state, side, `공격 병력 ${army.attack.length}기를 집결지로 물립니다.`, "order");
      return { ok: true };
    }
    case "recall": {
      const point = STW_RALLY_POINTS.find((item) => item.id === command.point);
      if (!point) return fail("알 수 없는 위치입니다");
      const army = stwArmy(state, side);
      record.rally = point.id;
      for (const unit of army.attack) unit.group = "rally";
      if (side === "player") {
        const total = army.attack.length + army.rally.length;
        const stance = point.id === "main" || point.id === "natural" ? "수비합니다" : "대기합니다";
        pushLog(state, side, total ? `전군 ${total}기가 ${withKoreanDirection(point.name)} 물러나 ${stance}.` : `집결지를 ${withKoreanDirection(point.name)} 옮깁니다.`, "order");
      }
      return { ok: true, recalled: army.attack.length };
    }
    case "escort": {
      // 오버로드 동행: 완성된 오버로드 1기가 떠올라 병력을 따라다닌다(저그 전용).
      if (record.race !== "zerg") return fail("저그만 쓸 수 있습니다");
      const on = Boolean(command.on);
      if (on && !state.units.some((unit) => unit.side === side && unit.type === "overlord") && !stwOwnBuildings(state, side, "overlord", { doneOnly: true }).length) return fail("완성된 오버로드가 없습니다");
      record.escort = on;
      if (on) escortStep(state, side);
      if (side === "player") pushLog(state, side, on ? "오버로드 1기가 병력과 동행합니다. 잃으면 인구 상한이 8 줄어듭니다." : "동행 오버로드가 기지로 돌아갑니다.", "order");
      return { ok: true };
    }
    case "autoWave": {
      record.autoWave = Math.max(0, Math.round(command.size ?? 0));
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
      if (side === "player") pushLog(state, side, `${STW_UNITS[workerType].name} 1기를 적 본진으로 정찰 보냅니다.`, "order");
      return { ok: true };
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
  if (aiThink) for (const side of state.aiSides) aiThink(state, side);
  for (const side of STW_SIDES) {
    stepEconomy(state, side, dt);
    if (state.sides[side].escort) escortStep(state, side);
  }
  state.pendingHits = [];
  stepBuildings(state, dt);
  stepUnits(state, dt);
  stepStorms(state, dt);
  applyHits(state);
  regenerate(state, dt);
  stepEffects(state, dt);
  cleanup(state);
  if (Math.round(state.time * 10) % 5 === 0) updateVision(state);
  autoWaves(state);
  checkVictory(state);
}

function stepEconomy(state, side, dt) {
  const record = state.sides[side];
  const split = stwWorkerSplit(state, side);
  const multiplier = incomeMultiplier(state, side);
  for (const base of ["main", "natural"]) {
    if (!split[base]) continue;
    const nexus = stwNexus(state, side, base);
    const threatened = nexus && state.units.some((unit) => unit.side !== side && !isPassive(unit) && distance(unit.x, unit.y, nexus.x, nexus.y) < 12);
    const mined = Math.min(record.bases[base].minerals, mineralRate(split[base]) * dt * (threatened ? 0.5 : 1));
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

function stepProducer(state, building, record, dt) {
  if (building.current) {
    building.current.remaining -= dt;
    if (building.current.remaining > 0) return;
    const unitType = building.current.unit;
    building.current = null;
    const forward = stwForward(building.side);
    // 저글링은 한 번에 2기가 나온다.
    for (let index = 0; index < (STW_UNITS[unitType].pair ? 2 : 1); index += 1) {
      const unit = spawnUnit(state, building.side, unitType, building.x + (nextRandom(state) - 0.5) * 2 + index * 1.4, building.y + forward * (building.radius + 1.5));
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
  if (state.units.some((unit) => unit.side === side && unit.type === "overlord")) return;
  const building = stwOwnBuildings(state, side, "overlord", { doneOnly: true }).sort((a, b) => b.id - a.id)[0];
  if (!building) return;
  state.buildings = state.buildings.filter((item) => item !== building);
  const unit = spawnUnit(state, side, "overlord", building.x, building.y);
  unit.hp = Math.min(unit.maxHp, building.hp);
  unit.group = "rally";
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
export function stwHitDamage(state, attacker, target) {
  const def = attacker.kind === "unit" ? STW_UNITS[attacker.type] : STW_BUILDINGS[attacker.type];
  let perHit = (attacker.sieged ? def.siege.damage : def.damage) + (attacker.kind === "unit" ? weaponLevel(state, attacker) * (def.weaponStep ?? 0) : 0);
  if (attacker.type === "reaver" && stwResearchDone(state, attacker.side, "scarab")) perHit += 25;
  const raw = perHit * STW_SIZE_MULTIPLIER[def.damageType][target.size ?? "large"];
  const hits = [];
  for (let i = 0; i < (def.hits ?? 1); i += 1) hits.push(raw);
  return hits;
}

function applyDamage(state, target, amount, { ignoreArmor = false } = {}) {
  let remaining = amount;
  if (target.shields > 0) {
    const reduced = ignoreArmor ? remaining : Math.max(0.5, remaining - shieldArmor(state, target));
    const absorbed = Math.min(target.shields, reduced);
    target.shields -= absorbed;
    remaining = reduced - absorbed;
    if (remaining <= 0) return;
  }
  const armor = ignoreArmor ? 0 : target.armor + armorBonus(state, target);
  target.hp -= Math.max(0.5, remaining - armor);
}

function queueHit(state, attacker, target) {
  state.pendingHits.push({ attacker, target, hits: stwHitDamage(state, attacker, target) });
  const splash = attacker.kind === "unit" ? (attacker.sieged ? STW_UNITS[attacker.type].siege.splash : STW_UNITS[attacker.type].splash) : null;
  if (!splash) return;
  // 범위 공격: 대상 주변의 다른 적 지상 유닛에도 비율만큼 피해(은폐 여부와 무관).
  for (const other of state.units) {
    if (other === target || other.side === attacker.side || other.hp <= 0 || isFlying(other)) continue;
    if (distance(other.x, other.y, target.x, target.y) > splash.radius + other.radius * 0.5) continue;
    state.pendingHits.push({ attacker, target: other, hits: stwHitDamage(state, attacker, other).map((amount) => amount * splash.factor) });
  }
}

/** 은폐 유닛이 상대 진영의 탐지기(옵저버, 완성된 포톤 캐논) 범위 안에 있는지. */
export function stwDetected(state, unit, bySide) {
  if (!isCloaked(unit)) return true;
  for (const scan of state.scans ?? []) {
    if (scan.side === bySide && distance(scan.x, scan.y, unit.x, unit.y) <= scan.radius) return true;
  }
  for (const other of state.units) {
    const radius = other.side === bySide ? STW_UNITS[other.type].detector : 0;
    if (radius && other.hp > 0 && distance(other.x, other.y, unit.x, unit.y) <= radius) return true;
  }
  for (const building of state.buildings) {
    const radius = building.side === bySide && stwDone(building) ? STW_BUILDINGS[building.type].detector : 0;
    if (radius && distance(building.x, building.y, unit.x, unit.y) <= radius) return true;
  }
  return false;
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

const DETECT_HINT = {
  protoss: "보이지 않는 적에게 공격받고 있습니다! 포톤 캐논이나 옵저버로 탐지하세요.",
  terran: "보이지 않는 적에게 공격받고 있습니다! 미사일 터렛이나 컴샛 스테이션으로 탐지하세요.",
  zerg: "보이지 않는 적에게 공격받고 있습니다! 스포어 콜로니나 오버로드로 탐지하세요.",
};

/** 공격자가 대상을 노릴 수 있는지: 은폐 유닛은 탐지되어야 한다. */
function targetable(state, attacker, target) {
  return target.kind !== "unit" || stwDetected(state, target, attacker.side);
}

function applyHits(state) {
  for (const hit of state.pendingHits) {
    if (hit.target.hp <= 0) continue;
    for (const amount of hit.hits) applyDamage(state, hit.target, amount);
    hit.target.lastHit = state.time;
    const unseen = hit.attacker.kind === "unit" && isCloaked(hit.attacker) && !stwDetected(state, hit.attacker, hit.target.side);
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

function findTarget(state, attacker, radius, { unitsOnly = false } = {}) {
  let best = null;
  let bestScore = Infinity;
  for (const unit of state.units) {
    if (unit.side === attacker.side || unit.hp <= 0) continue;
    const d = distance(attacker.x, attacker.y, unit.x, unit.y) - unit.radius;
    if (d > radius || !targetable(state, attacker, unit)) continue;
    const score = d + (isPassive(unit) ? 3 : 0);
    if (score < bestScore) {
      best = unit;
      bestScore = score;
    }
  }
  if (unitsOnly) return best;
  for (const building of state.buildings) {
    if (building.side === attacker.side || building.hp <= 0) continue;
    const d = distance(attacker.x, attacker.y, building.x, building.y) - building.radius;
    if (d > radius) continue;
    const score = d + (STW_BUILDINGS[building.type].damage ? 1 : 6);
    if (score < bestScore) {
      best = building;
      bestScore = score;
    }
  }
  return best;
}

function resolve(state, id, attacker = null) {
  if (id === null || id === undefined) return null;
  const unit = state.units.find((item) => item.id === id && item.hp > 0);
  if (unit) return !attacker || targetable(state, attacker, unit) ? unit : null;
  return state.buildings.find((building) => building.id === id && building.hp > 0) ?? null;
}

/** 공격하는 방어 건물(포톤 캐논, 벙커). */
function cannonStep(state, building, dt) {
  const def = STW_BUILDINGS[building.type];
  building.cooldown = Math.max(0, building.cooldown - dt);
  let target = resolve(state, building.targetId, building);
  if (target && (target.kind !== "unit" || distance(building.x, building.y, target.x, target.y) - target.radius > def.range)) target = null;
  if (!target) target = findTarget(state, building, def.range, { unitsOnly: true });
  building.targetId = target?.id ?? null;
  if (!target || building.cooldown > 0) return;
  building.cooldown = def.cooldown;
  queueHit(state, building, target);
  const kind = building.type === "cannon" ? "photon" : building.type === "sunken" ? "tentacle" : "bullet";
  const ttl = kind === "photon" ? 0.3 : kind === "tentacle" ? 0.45 : 0.12;
  state.effects.push({ kind, side: building.side, x1: building.x, y1: building.y, x2: target.x, y2: target.y, ttl, max: ttl });
}

function stimmed(state, unit) {
  return unit.stimAt !== undefined && state.time - unit.stimAt < 10;
}

function unitRange(state, unit) {
  const def = STW_UNITS[unit.type];
  if (unit.type === "dragoon" && stwResearchDone(state, unit.side, "range")) return 8;
  if (unit.type === "marine" && stwResearchDone(state, unit.side, "u238")) return def.range + 1;
  if (unit.type === "hydra" && stwResearchDone(state, unit.side, "spines")) return def.range + 1.5;
  return def.range ?? 0;
}

function unitSpeed(state, unit) {
  const def = STW_UNITS[unit.type];
  if (unit.type === "zealot" && stwResearchDone(state, unit.side, "charge")) return def.speed * 1.5;
  if (unit.type === "vulture" && stwResearchDone(state, unit.side, "ion")) return def.speed * 1.4;
  if (unit.type === "zergling" && stwResearchDone(state, unit.side, "metabolic")) return def.speed * 1.5;
  if (unit.type === "hydra" && stwResearchDone(state, unit.side, "augments")) return def.speed * 1.35;
  if (unit.type === "overlord" && stwResearchDone(state, unit.side, "pneumatized")) return def.speed * 1.5;
  if (stimmed(state, unit)) return def.speed * 1.5;
  return def.speed;
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

const ROLE_DEPTH = { melee: 2, ranged: 0, siege: -1.8, caster: -3.8, support: -5.5 };
const ROLE_ORDER = { overlord: 12, ultra: -1, zealot: 0, zergling: 0.5, dark: 1, archon: 2, firebat: 3, dragoon: 4, hydra: 4.5, marine: 5, vulture: 6, reaver: 7, lurker: 7.5, tank: 8, templar: 9, medic: 10, observer: 11 };
const ATTACK_EFFECT = { zealot: "slash", dark: "slash", dragoon: "plasma", archon: "shock", reaver: "scarab", marine: "bullet", firebat: "flame", vulture: "grenade", tank: "tankshot", zergling: "bite", ultra: "bite", hydra: "spine" };

/** 집결지에서의 자리: 근접은 앞, 원거리는 가운데, 템플러는 뒤. 한 줄 12자리. */
function rallySlots(state, side, units, anchorY) {
  const forward = stwForward(side);
  const sorted = [...units].sort((a, b) => ROLE_ORDER[a.type] - ROLE_ORDER[b.type] || a.id - b.id);
  const slots = new Map();
  const byRole = { melee: [], ranged: [], siege: [], caster: [], support: [] };
  for (const unit of sorted) byRole[STW_UNITS[unit.type].role].push(unit);
  for (const [role, list] of Object.entries(byRole)) {
    list.forEach((unit, index) => {
      const row = Math.floor(index / 12);
      const inRow = Math.min(12, list.length - row * 12);
      const column = index % 12;
      slots.set(unit.id, {
        x: STW_LANE_WIDTH / 2 + (column - (inRow - 1) / 2) * 2.7,
        y: anchorY + forward * (ROLE_DEPTH[role] - row * 2.6),
      });
    });
  }
  return slots;
}

function stepUnits(state, dt) {
  for (const unit of state.units) {
    const def = STW_UNITS[unit.type];
    if (def.energyRegen) unit.energy = Math.min(def.maxEnergy, unit.energy + def.energyRegen * dt);
  }
  const plans = {};
  for (const side of STW_SIDES) {
    const army = stwArmy(state, side);
    const rallyY = stwRallyY(side, state.sides[side].rally);
    const attackSlots = rallySlots(state, side, army.attack, 0);
    // 공격 병력은 가장 느린 지상 유닛에 맞춰 움직인다. 동행 오버로드도 같이 다니므로 속도에 포함한다.
    const speeds = army.attack.filter((unit) => !isFlying(unit) || unit.type === "overlord").map((unit) => unitSpeed(state, unit));
    plans[side] = {
      rallySlots: rallySlots(state, side, army.rally, rallyY),
      attackSlots,
      waveSpeed: speeds.length ? Math.min(...speeds) : 3,
      goal: stwPoint(side, { x: 20, y: 6 }),
      intruders: findIntruders(state, side, rallyY),
    };
    if (side === "player" && plans[side].intruders.length && army.rally.length) {
      alertOnce(state, "defend", 15, "player", "대기 병력이 기지에 들어온 적을 요격합니다.", "order");
    }
  }
  for (const unit of state.units) {
    if (unit.hp <= 0) continue;
    unit.cooldown = Math.max(0, unit.cooldown - dt);
    if (isWorker(unit)) {
      scoutStep(state, unit, dt);
      continue;
    }
    const def = STW_UNITS[unit.type];
    const plan = plans[unit.side];
    const range = unitRange(state, unit);
    const speed = unitSpeed(state, unit);
    if (unit.type === "templar") {
      templarStep(state, unit, plan, dt);
      continue;
    }
    if (unit.type === "observer" || unit.type === "overlord") {
      observerStep(state, unit, plan, dt);
      continue;
    }
    if (unit.type === "medic") {
      medicStep(state, unit, plan, dt);
      continue;
    }
    const isAttack = unit.group === "attack";
    const slot = isAttack ? plan.attackSlots.get(unit.id) : plan.rallySlots.get(unit.id);
    const sight = range + (isAttack ? 6 : 7);
    const retreating = !isAttack && slot && isRetreating(unit, slot);
    if (unit.type === "tank" && tankSiegeStep(state, unit, Boolean(retreating))) continue;
    if (unit.type === "lurker" && lurkerStep(state, unit, Boolean(retreating))) continue;
    if (retreating) {
      // 후퇴 중: 교전을 끊고 전속력으로 집결지에 돌아온다.
      unit.targetId = null;
      moveToward(unit, slot.x, slot.y, speed, dt);
      continue;
    }
    let target = resolve(state, unit.targetId, unit);
    const intruders = isAttack ? [] : plan.intruders.filter((enemy) => targetable(state, unit, enemy));
    if (intruders.length) {
      // 자동 수비: 기지에 들어온 적을 거리와 상관없이 쫓아가 잡는다.
      if (!target || !intruders.includes(target)) target = nearestOf(unit, intruders);
    } else {
      const leashed = (item) => !isAttack && slot && distance(item.x, item.y, slot.x, slot.y) - item.radius > RALLY_LEASH;
      if (target) {
        const d = distance(unit.x, unit.y, target.x, target.y) - target.radius;
        if (d > sight + 3 || leashed(target)) target = null;
      }
      if (!target) {
        target = findTarget(state, unit, sight);
        if (target && leashed(target)) target = null;
      }
    }
    unit.targetId = target?.id ?? null;
    if (target) {
      const d = distance(unit.x, unit.y, target.x, target.y) - target.radius - unit.radius * 0.5;
      if (d <= range) {
        unit.heading = Math.atan2(target.y - unit.y, target.x - unit.x);
        // 스팀팩: 연구 후 교전을 시작하면 체력 10을 써서 10초 동안 공격·이동 속도 +50%.
        if (def.stim && stwResearchDone(state, unit.side, "stim") && unit.hp > 20 && (unit.stimAt === undefined || state.time - unit.stimAt > 11)) {
          unit.stimAt = state.time;
          unit.hp -= 10;
          state.effects.push({ kind: "stim", side: unit.side, x1: unit.x, y1: unit.y, x2: unit.x, y2: unit.y, ttl: 0.4, max: 0.4 });
        }
        // 물러나며 사격: 재장전 중에 근접 적이 붙어 있으면 한 걸음 물러난다(테란 컨트롤을 자동으로 흉내).
        if (def.kite && unit.cooldown > 0.12) {
          const melee = nearestMelee(state, unit, 2.2);
          // 붙은 근접 유닛보다 빠를 때만 물러난다(해병은 스팀팩을 써야 질럿보다 빠르다).
          if (melee && speed > unitSpeed(state, melee)) {
            const away = Math.atan2(unit.y - melee.y, unit.x - melee.x);
            moveToward(unit, unit.x + Math.cos(away) * 2, unit.y + Math.sin(away) * 2, speed, dt);
            continue;
          }
        }
        if (unit.cooldown <= 0) {
          unit.cooldown = def.cooldown * (stimmed(state, unit) ? 0.67 : 1);
          queueHit(state, unit, target);
          const kind = ATTACK_EFFECT[unit.type] ?? "plasma";
          const ttl = kind === "slash" || kind === "bullet" || kind === "bite" ? 0.15 : kind === "flame" ? 0.3 : kind === "scarab" ? 0.6 : kind === "shock" || kind === "spine" ? 0.25 : 0.35;
          state.effects.push({ kind, side: unit.side, x1: unit.x, y1: unit.y, x2: target.x, y2: target.y, ttl, max: ttl, radius: STW_UNITS[unit.type].splash?.radius });
        }
      } else {
        moveToward(unit, target.x, target.y, speed, dt);
      }
      continue;
    }
    if (isAttack) {
      // 공격 병력은 가장 느린 유닛 속도에 맞춰 함께 전진하고, 적 본진 넥서스까지 간다.
      const x = slot ? slot.x : unit.x;
      moveToward(unit, unit.x + (x - unit.x) * 0.15, plan.goal.y, Math.min(speed, plan.waveSpeed), dt);
    } else if (slot) {
      moveToward(unit, slot.x, slot.y, speed, dt);
    }
  }
  separate(state);
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
function findTargetBand(state, attacker, minRange, maxRange) {
  let best = null;
  let bestScore = Infinity;
  const consider = (item, bias) => {
    if (item.side === attacker.side || item.hp <= 0) return;
    if (item.kind === "unit" && (isFlying(item) || !targetable(state, attacker, item))) return;
    const d = distance(attacker.x, attacker.y, item.x, item.y) - item.radius;
    if (d > maxRange || d < minRange) return;
    if (d + bias < bestScore) {
      best = item;
      bestScore = d + bias;
    }
  };
  for (const unit of state.units) consider(unit, isWorker(unit) ? 3 : 0);
  for (const building of state.buildings) consider(building, 6);
  return best;
}

/**
 * 시즈 탱크: 시즈 모드 연구 후 사거리 12 안에 적이 들어오면 자동으로 시즈한다(2초).
 * 시즈 중에는 움직이지 않고 범위 포격을 하며, 적이 2초 넘게 없거나 후퇴 명령이 오면 시즈를 푼다(2초).
 * 이 틱을 처리했으면 true.
 */
function tankSiegeStep(state, unit, retreating) {
  const def = STW_UNITS.tank;
  const siege = def.siege;
  if (unit.siegeUntil !== undefined && state.time < unit.siegeUntil) return true;
  if (unit.sieged) {
    const target = findTargetBand(state, unit, siege.minRange, siege.range);
    if (target) unit.lastSiegeTargetAt = state.time;
    if (retreating || (!target && state.time - (unit.lastSiegeTargetAt ?? 0) > 2)) {
      unit.sieged = false;
      unit.siegeUntil = state.time + siege.setup;
      return true;
    }
    unit.targetId = target?.id ?? null;
    if (target && unit.cooldown <= 0) {
      unit.heading = Math.atan2(target.y - unit.y, target.x - unit.x);
      unit.cooldown = siege.cooldown;
      queueHit(state, unit, target);
      state.effects.push({ kind: "shell", side: unit.side, x1: unit.x, y1: unit.y, x2: target.x, y2: target.y, ttl: 0.55, max: 0.55, radius: siege.splash.radius });
    }
    return true;
  }
  if (retreating || !stwResearchDone(state, unit.side, "siege")) return false;
  const threat = findTargetBand(state, unit, 0, siege.range);
  if (!threat) return false;
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
    if (retreating || (!target && state.time - (unit.lastBurrowTargetAt ?? 0) > 2)) {
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

/**
 * 집결지보다 적진 쪽으로 멀리 나가 있는 대기 병력은 후퇴 중으로 본다.
 * 한 번 후퇴를 시작하면 집결지 가까이 올 때까지 교전하지 않는다(경계에서 들락거리지 않도록 차이를 둔다).
 */
function isRetreating(unit, slot) {
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
  if (unit.type === "overlord" && !state.sides[unit.side].escort) {
    // 동행을 끄면 본진 위로 돌아가 기지를 지킨다.
    const home = stwNexus(state, unit.side, "main") ?? stwNexus(state, unit.side, "natural");
    goal = home ? { x: home.x + 4, y: home.y - stwForward(unit.side) * 2 } : stwPoint(unit.side, { x: 20, y: 90 });
  } else if (escort.length) {
    const cx = escort.reduce((sum, ally) => sum + ally.x, 0) / escort.length;
    const lead = escort.reduce((best, ally) => (forward < 0 ? Math.min(best, ally.y) : Math.max(best, ally.y)), escort[0].y);
    goal = { x: cx, y: lead - forward * 2 };
  } else {
    goal = plan.rallySlots.get(unit.id) ?? { x: 20, y: stwRallyY(unit.side, state.sides[unit.side].rally) };
  }
  moveToward(unit, goal.x, goal.y, unitSpeed(state, unit), dt);
}

function templarStep(state, unit, plan, dt) {
  const slot = unit.group === "attack" ? plan.attackSlots.get(unit.id) : plan.rallySlots.get(unit.id);
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
  if (unit.group !== "attack" && slot && isRetreating(unit, slot)) {
    moveToward(unit, slot.x, slot.y, STW_UNITS.templar.speed, dt);
    return;
  }
  const nearest = findTarget(state, unit, 6, { unitsOnly: true });
  if (nearest) {
    // 무기가 없으므로 적과 거리를 벌린다.
    const away = Math.atan2(unit.y - nearest.y, unit.x - nearest.x);
    moveToward(unit, unit.x + Math.cos(away) * 2, unit.y + Math.sin(away) * 2, STW_UNITS.templar.speed, dt);
    return;
  }
  if (unit.group === "attack") {
    const front = state.units.filter((ally) => ally.side === unit.side && ally.group === "attack" && !isPassive(ally) && STW_UNITS[ally.type].role !== "caster");
    const forward = stwForward(unit.side);
    const lead = front.length ? front.reduce((best, ally) => (forward < 0 ? Math.min(best, ally.y) : Math.max(best, ally.y)), front[0].y) : plan.goal.y;
    const goalY = lead - forward * 5;
    moveToward(unit, slot ? slot.x : unit.x, goalY, Math.min(STW_UNITS.templar.speed, plan.waveSpeed), dt);
  } else if (slot) {
    moveToward(unit, slot.x, slot.y, STW_UNITS.templar.speed, dt);
  }
}

function stormSpot(state, caster) {
  let best = null;
  let bestCount = STW_STORM.minTargets - 1;
  for (const enemy of state.units) {
    if (enemy.side === caster.side || isPassive(enemy)) continue;
    if (distance(caster.x, caster.y, enemy.x, enemy.y) > STW_STORM.castRange || !targetable(state, caster, enemy)) continue;
    if (state.storms.some((storm) => storm.side === caster.side && distance(storm.x, storm.y, enemy.x, enemy.y) < STW_STORM.radius)) continue;
    let count = 0;
    let sx = 0;
    let sy = 0;
    for (const other of state.units) {
      if (other.side === caster.side) continue;
      if (distance(enemy.x, enemy.y, other.x, other.y) <= STW_STORM.radius) {
        count += 1;
        sx += other.x;
        sy += other.y;
      }
    }
    if (count > bestCount) {
      bestCount = count;
      best = { x: sx / count, y: sy / count };
    }
  }
  return best;
}

function stepStorms(state, dt) {
  for (const storm of state.storms) storm.ttl -= dt;
  state.storms = state.storms.filter((storm) => storm.ttl > 0);
  const hit = new Set();
  for (const storm of state.storms) {
    for (const unit of state.units) {
      if (unit.side === storm.side || hit.has(unit.id)) continue;
      if (distance(unit.x, unit.y, storm.x, storm.y) > STW_STORM.radius + unit.radius * 0.5) continue;
      hit.add(unit.id);
      applyDamage(state, unit, STW_STORM.dps * dt, { ignoreArmor: true });
      unit.lastHit = state.time;
    }
  }
}

function scoutStep(state, unit, dt) {
  const def = STW_UNITS[unit.type];
  if (unit.scoutPhase === "out") {
    const goal = stwPoint(unit.side, { x: 26, y: 9 });
    if (moveToward(unit, goal.x, goal.y, def.speed, dt)) unit.scoutPhase = "back";
    return;
  }
  const home = stwPoint(unit.side, { x: 20, y: 90 });
  if (moveToward(unit, home.x, home.y, def.speed, dt)) {
    unit.hp = 0;
    unit.returned = true;
    state.sides[unit.side].probes += 1;
  }
}

function separate(state) {
  const units = state.units;
  for (let i = 0; i < units.length; i += 1) {
    const a = units[i];
    if (isFlying(a)) continue;
    for (let j = i + 1; j < units.length; j += 1) {
      const b = units[j];
      if (isFlying(b)) continue;
      const min = (a.radius + b.radius) * (a.side === b.side ? 0.9 : 1);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
      const d = Math.hypot(dx, dy);
      if (d >= min) continue;
      const push = (min - d) / 2;
      const nx = d > 0.001 ? dx / d : (a.id % 2 ? 1 : -1);
      const ny = d > 0.001 ? dy / d : 0;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
    }
    a.x = Math.min(STW_LANE_WIDTH - 1, Math.max(1, a.x));
    a.y = Math.min(STW_LANE_LENGTH - 1, Math.max(1, a.y));
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
  for (const scan of state.scans ?? []) scan.ttl -= dt;
  if (state.scans?.length) state.scans = state.scans.filter((scan) => scan.ttl > 0);
}

function stepEffects(state, dt) {
  for (const effect of state.effects) effect.ttl -= dt;
  state.effects = state.effects.filter((effect) => effect.ttl > 0);
}

function cleanup(state) {
  const dead = state.units.filter((unit) => unit.hp <= 0);
  for (const unit of dead) {
    if (unit.returned) continue;
    state.sides[unit.side].stats.lost += 1;
    state.sides[stwOpponent(unit.side)].stats.kills += 1;
    state.effects.push({ kind: "death", side: unit.side, x1: unit.x, y1: unit.y, x2: unit.x, y2: unit.y, ttl: 0.7, max: 0.7, radius: ["dragoon", "reaver", "archon", "tank", "vulture", "lurker", "ultra", "overlord"].includes(unit.type) ? 3.6 : unit.radius * 2 });
    if (isWorker(unit) && unit.group === "scout" && unit.side === "player") pushLog(state, "player", `정찰 ${withKoreanObject(STW_UNITS[unit.type].name)} 잃었습니다.`, "warn");
    if (unit.type === "overlord" && unit.side === "player") pushLog(state, "player", "동행 오버로드를 잃었습니다. 인구 상한이 8 줄었습니다.", "danger");
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
  protoss: ["archives", "robo", "citadel", "core"],
  terran: ["shop", "factory", "academy", "barracks"],
  zerg: ["cavern", "den", "pool"],
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

function autoWaves(state) {
  for (const side of STW_SIDES) {
    const record = state.sides[side];
    if (!record.autoWave) continue;
    const army = stwArmy(state, side);
    const rallyY = stwRallyY(side, record.rally);
    const ready = army.rally.filter((unit) => Math.abs(unit.y - rallyY) < 8);
    if (ready.length >= record.autoWave) stwCommand(state, side, { type: "attack" });
  }
}

/** 양쪽 모두 수입·병력·생산이 없어 더 이상 승부가 날 수 없는 상태인지. */
function exhausted(state, side) {
  const record = state.sides[side];
  if (stwIncome(state, side).minerals > 0 || record.minerals >= 50) return false;
  if (state.units.some((unit) => unit.side === side && !isWorker(unit))) return false;
  return !state.buildings.some((building) => building.side === side && (building.current || building.queue.length));
}

function checkVictory(state) {
  const playerMain = stwNexus(state, "player", "main");
  const enemyMain = stwNexus(state, "enemy", "main");
  if (playerMain && enemyMain) {
    // 양쪽 다 자원이 바닥나고 병력도 없으면 30초 뒤 무승부로 끝낸다.
    state.stalemate = exhausted(state, "player") && exhausted(state, "enemy") ? (state.stalemate ?? 0) + STW_TICK : 0;
    if (state.stalemate < 30) return;
    state.status = "over";
    state.winner = "draw";
    pushLog(state, "player", "양쪽 모두 자원과 병력이 바닥나 무승부입니다.", "info");
    return;
  }
  state.status = "over";
  state.winner = playerMain ? "player" : enemyMain ? "enemy" : "draw";
  const lostBase = STW_BUILDINGS[stwRace(state, state.winner === "player" ? "enemy" : "player").base].name;
  pushLog(state, "player", state.winner === "player" ? `적 본진 ${withKoreanObject(lostBase)} 파괴했습니다. 승리!` : `본진 ${withKoreanSubject(lostBase)} 파괴되었습니다.`, state.winner === "player" ? "good" : "danger");
}

export function stwClock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}
