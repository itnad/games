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
  STW_RALLY_POINTS,
  STW_RESEARCH,
  STW_SIZE_MULTIPLIER,
  STW_STORM,
  STW_TICK,
  STW_UNITS,
} from "./starswar-data.js";

export const STW_SIDES = ["player", "enemy"];

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

function createSide(id, persona) {
  return {
    id,
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
    stats: { minerals: 0, gas: 0, produced: 0, lost: 0, kills: 0, buildingsLost: 0, buildingsDestroyed: 0, storms: 0 },
    ai: null,
  };
}

export function createStarswarGame({ difficulty = "normal", seed = 20261101, aiSides = ["enemy"], personas = {} } = {}) {
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
      player: createSide("player", personas.player ?? null),
      enemy: createSide("enemy", personas.enemy ?? null),
    },
    units: [],
    buildings: [],
    storms: [],
    effects: [],
    pendingHits: [],
    log: [],
    alerts: {},
    aiSides: [...aiSides],
  };
  for (const side of STW_SIDES) {
    if (!state.sides[side].persona && state.aiSides.includes(side)) {
      // 쉬움에서는 4분 질럿 러시가 나오지 않게 한다.
      const personas = state.difficulty === "easy" ? ["dragoon", "templar"] : ["rush", "dragoon", "templar"];
      state.sides[side].persona = personas[Math.floor(nextRandom(state) * personas.length)];
    }
    const nexus = placeBuilding(state, side, "nexus", stwPoint(side, STW_LAYOUT.mainNexus), "main", "nexus-main");
    nexus.progress = 1;
    nexus.hp = nexus.maxHp;
    nexus.shields = nexus.maxShields;
  }
  pushLog(state, "player", "전투 개시. 프로브가 광물을 캐고 있습니다. 첫 선택을 내리세요.", "info");
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
    line: type === "gateway" ? defaultLine() : null,
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

function defaultLine() {
  return "zealot";
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
  return state.buildings.find((building) => building.side === side && building.type === "nexus" && building.base === base) ?? null;
}

export function stwSupply(state, side) {
  const record = state.sides[side];
  let cap = 0;
  let used = record.probes;
  for (const building of state.buildings) {
    if (building.side !== side) continue;
    if (stwDone(building)) cap += STW_BUILDINGS[building.type].supply ?? 0;
    for (const item of building.queue) used += STW_UNITS[item.unit].supply;
    if (building.current) used += STW_UNITS[building.current.unit].supply;
  }
  for (const unit of state.units) if (unit.side === side) used += STW_UNITS[unit.type].supply;
  return { used, cap: Math.min(STW_ECONOMY.supplyLimit, cap) };
}

/** 프로브 배치: 가스, 본진 광물, 앞마당 광물, 놀고 있는 수. */
export function stwWorkerSplit(state, side) {
  const record = state.sides[side];
  const gasSlots = stwOwnBuildings(state, side, "assimilator", { doneOnly: true }).length * STW_ECONOMY.probesPerGas;
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
  const army = { rally: [], attack: [], counts: { zealot: 0, dragoon: 0, templar: 0 } };
  for (const unit of state.units) {
    if (unit.side !== side || unit.type === "probe") continue;
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

function freeSlot(state, side, list, prefix) {
  const used = new Set(state.buildings.filter((building) => building.side === side).map((building) => building.slot));
  const index = list.findIndex((_, i) => !used.has(`${prefix}-${i}`));
  return index < 0 ? null : { key: `${prefix}-${index}`, point: stwPoint(side, list[index]) };
}

function placementFor(state, side, type) {
  if (type === "assimilator") {
    const slot = freeSlot(state, side, STW_LAYOUT.geysers, "geyser");
    return slot ? { ...slot, base: "main" } : null;
  }
  const natural = stwNexus(state, side, "natural");
  if (type === "cannon") {
    if (natural) {
      const slot = freeSlot(state, side, STW_LAYOUT.naturalSlots, "natural");
      if (slot) return { ...slot, base: "natural" };
    }
    const front = freeSlot(state, side, STW_LAYOUT.frontSlots, "front");
    if (front) return { ...front, base: "main" };
  }
  const main = freeSlot(state, side, STW_LAYOUT.mainSlots, "main");
  if (main) return { ...main, base: "main" };
  if (natural && stwDone(natural)) {
    const slot = freeSlot(state, side, STW_LAYOUT.naturalSlots, "natural");
    if (slot) return { ...slot, base: "natural" };
  }
  if (type !== "cannon") {
    const front = freeSlot(state, side, STW_LAYOUT.frontSlots, "front");
    if (front) return { ...front, base: "main" };
  }
  return null;
}

export function stwBuildCheck(state, side, type) {
  const record = state.sides[side];
  if (type === "expand") {
    if (stwNexus(state, side, "natural")) return fail("이미 앞마당에 넥서스가 있습니다");
    const point = stwPoint(side, STW_LAYOUT.naturalNexus);
    if (state.units.some((unit) => unit.side !== side && distance(unit.x, unit.y, point.x, point.y) < 12)) return fail("앞마당에 적이 있습니다");
    return costCheck(record, STW_BUILDINGS.nexus.minerals, 0);
  }
  const def = STW_BUILDINGS[type];
  if (!def || type === "nexus") return fail("지을 수 없는 건물입니다");
  if (def.requires && !stwHas(state, side, def.requires)) return fail(`${withKoreanSubject(STW_BUILDINGS[def.requires].name)} 필요합니다`);
  if (type === "core" && stwOwnBuildings(state, side, "core").length) return fail("이미 있습니다");
  if (type === "forge" && stwOwnBuildings(state, side, "forge").length) return fail("이미 있습니다");
  if (type === "citadel" && stwOwnBuildings(state, side, "citadel").length) return fail("이미 있습니다");
  if (type === "archives" && stwOwnBuildings(state, side, "archives").length) return fail("이미 있습니다");
  if (!placementFor(state, side, type)) return fail(type === "assimilator" ? "가스 간헐천이 모두 찼습니다" : "지을 자리가 없습니다");
  return costCheck(record, def.minerals, def.gas);
}

export function stwProbeCheck(state, side) {
  const nexus = ["main", "natural"].map((base) => stwNexus(state, side, base)).filter((item) => item && stwDone(item)).sort((a, b) => a.queue.length - b.queue.length)[0];
  if (!nexus) return fail("넥서스가 없습니다");
  if (nexus.queue.length >= STW_ECONOMY.probeQueueLimit) return fail("생산 대기열이 찼습니다");
  const supply = stwSupply(state, side);
  if (supply.used + 1 > supply.cap) return fail("인구 부족 · 파일런 필요");
  const cost = costCheck(state.sides[side], STW_UNITS.probe.minerals, 0);
  return cost.ok ? { ok: true, nexus } : cost;
}

export function stwResearchCheck(state, side, id) {
  const def = STW_RESEARCH[id];
  const record = state.sides[side];
  if (!def) return fail("알 수 없는 연구입니다");
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
  if (state.sides[side].probes < 5) return fail("프로브 5기 이상 필요");
  return { ok: true };
}

/** 생산 라인 유닛이 지금 해금되어 있는지. */
export function stwUnitUnlocked(state, side, unit) {
  const def = STW_UNITS[unit];
  return !def.requires || stwHas(state, side, def.requires);
}

/* ───────── 명령 ───────── */

export function stwCommand(state, side, command) {
  if (state.status !== "playing") return fail("전투가 끝났습니다");
  const record = state.sides[side];
  switch (command.type) {
    case "probe": {
      const check = stwProbeCheck(state, side);
      if (!check.ok) return check;
      record.minerals -= STW_UNITS.probe.minerals;
      check.nexus.queue.push({ unit: "probe", remaining: STW_UNITS.probe.time });
      return { ok: true };
    }
    case "build": {
      const check = stwBuildCheck(state, side, command.building);
      if (!check.ok) return check;
      if (command.building === "expand") {
        record.minerals -= STW_BUILDINGS.nexus.minerals;
        placeBuilding(state, side, "nexus", stwPoint(side, STW_LAYOUT.naturalNexus), "natural", "nexus-natural");
        if (side === "player") pushLog(state, side, "앞마당 넥서스 소환을 시작했습니다.", "info");
        return { ok: true };
      }
      const def = STW_BUILDINGS[command.building];
      const place = placementFor(state, side, command.building);
      record.minerals -= def.minerals;
      record.gas -= def.gas;
      placeBuilding(state, side, command.building, place.point, place.base, place.key);
      if (side === "player") pushLog(state, side, `${withKoreanObject(def.name)} 소환합니다.`, "info");
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
      const building = state.buildings.find((item) => item.id === command.gatewayId && item.side === side && item.type === "gateway");
      if (!building) return fail("게이트웨이를 찾을 수 없습니다");
      if (command.unit && !STW_ARMY_UNITS.includes(command.unit)) return fail("알 수 없는 유닛입니다");
      building.line = command.unit ?? null;
      return { ok: true };
    }
    case "lineAll": {
      const gateways = stwOwnBuildings(state, side, "gateway");
      if (!gateways.length) return fail("게이트웨이가 없습니다");
      for (const gateway of gateways) gateway.line = command.unit ?? null;
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
    case "autoWave": {
      record.autoWave = Math.max(0, Math.round(command.size ?? 0));
      return { ok: true };
    }
    case "scout": {
      const check = stwScoutCheck(state, side);
      if (!check.ok) return check;
      record.probes -= 1;
      const start = stwPoint(side, { x: 20, y: 88 });
      const unit = spawnUnit(state, side, "probe", start.x, start.y);
      unit.group = "scout";
      unit.scoutPhase = "out";
      if (side === "player") pushLog(state, side, "프로브 1기를 적 본진으로 정찰 보냅니다.", "order");
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
      const name = building.type === "nexus" ? "앞마당 넥서스" : def.name;
      if (side === "player") pushLog(state, side, `${withKoreanObject(name)} 취소했습니다. ${refundText(minerals, gas)} 환불`, "info");
      return { ok: true, minerals, gas };
    }
    case "cancelProbe": {
      const nexus = stwOwnBuildings(state, side, "nexus").filter((item) => item.queue.length).sort((a, b) => b.queue.length - a.queue.length)[0];
      if (!nexus) return fail("대기 중인 프로브가 없습니다");
      nexus.queue.pop();
      record.minerals += STW_UNITS.probe.minerals;
      if (side === "player") pushLog(state, side, `프로브 소환을 취소했습니다. ${refundText(STW_UNITS.probe.minerals, 0)} 환불`, "info");
      return { ok: true, minerals: STW_UNITS.probe.minerals, gas: 0 };
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
      const gateway = state.buildings.find((item) => item.id === command.gatewayId && item.side === side && item.type === "gateway");
      if (!gateway?.current) return fail("소환 중인 유닛이 없습니다");
      const def = STW_UNITS[gateway.current.unit];
      gateway.current = null;
      // 라인을 그대로 두면 다음 틱에 같은 유닛을 다시 소환하므로 라인도 멈춘다.
      gateway.line = null;
      gateway.blocked = "정지";
      record.minerals += def.minerals;
      record.gas += def.gas;
      if (side === "player") pushLog(state, side, `${withKoreanObject(def.name)} 취소하고 게이트웨이를 멈췄습니다. ${refundText(def.minerals, def.gas)} 환불`, "info");
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
  for (const side of STW_SIDES) stepEconomy(state, side, dt);
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
    const threatened = nexus && state.units.some((unit) => unit.side !== side && unit.type !== "probe" && distance(unit.x, unit.y, nexus.x, nexus.y) < 12);
    const mined = Math.min(record.bases[base].minerals, mineralRate(split[base]) * dt * (threatened ? 0.5 : 1));
    record.bases[base].minerals -= mined;
    record.minerals += mined * multiplier;
    record.stats.minerals += mined * multiplier;
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
    if (building.type === "gateway") stepGateway(state, building, record, dt);
    if (building.research) {
      building.research.remaining -= dt;
      if (building.research.remaining <= 0) {
        const id = building.research.id;
        building.research = null;
        record.research[id] = "done";
        if (building.side === "player") pushLog(state, "player", `${withKoreanSubject(STW_RESEARCH[id].name)} 완료되었습니다.`, "good");
      }
    }
    if (building.type === "cannon") cannonStep(state, building, dt);
  }
}

function stepGateway(state, building, record, dt) {
  if (building.current) {
    building.current.remaining -= dt;
    if (building.current.remaining > 0) return;
    const unitType = building.current.unit;
    building.current = null;
    const forward = stwForward(building.side);
    const unit = spawnUnit(state, building.side, unitType, building.x + (nextRandom(state) - 0.5) * 2, building.y + forward * (building.radius + 1.5));
    record.stats.produced += 1;
    state.effects.push({ kind: "warp", side: building.side, x1: unit.x, y1: unit.y, x2: unit.x, y2: unit.y, ttl: 0.6, max: 0.6, radius: unit.radius * 2 });
  }
  if (!building.line) {
    building.blocked = "정지";
    return;
  }
  const def = STW_UNITS[building.line];
  if (!stwUnitUnlocked(state, building.side, building.line)) {
    building.blocked = `${STW_BUILDINGS[def.requires].name} 필요`;
    return;
  }
  const supply = stwSupply(state, building.side);
  if (supply.used + def.supply > supply.cap) {
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

/* ───────── 전투 ───────── */

function weaponLevel(state, side) {
  return (stwResearchDone(state, side, "weapons1") ? 1 : 0) + (stwResearchDone(state, side, "weapons2") ? 1 : 0);
}

function armorBonus(state, target) {
  if (target.kind !== "unit") return 0;
  return stwResearchDone(state, target.side, "armor1") ? 1 : 0;
}

function shieldArmor(state, target) {
  return stwResearchDone(state, target.side, "shields1") ? 1 : 0;
}

/** 한 번 공격의 (보호막, 체력) 피해. 폭발형은 크기별 배율, 보호막 먼저, 체력에는 방어력 적용. */
export function stwHitDamage(state, attacker, target) {
  const def = attacker.kind === "unit" ? STW_UNITS[attacker.type] : STW_BUILDINGS[attacker.type];
  const perHit = def.damage + (attacker.kind === "unit" ? weaponLevel(state, attacker.side) * (def.weaponStep ?? 0) : 0);
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
}

function applyHits(state) {
  for (const hit of state.pendingHits) {
    if (hit.target.hp <= 0) continue;
    for (const amount of hit.hits) applyDamage(state, hit.target, amount);
    hit.target.lastHit = state.time;
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
    if (d > radius) continue;
    const score = d + (unit.type === "probe" ? 3 : 0);
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
    const score = d + (building.type === "cannon" ? 1 : 6);
    if (score < bestScore) {
      best = building;
      bestScore = score;
    }
  }
  return best;
}

function resolve(state, id) {
  if (id === null || id === undefined) return null;
  return state.units.find((unit) => unit.id === id && unit.hp > 0) ?? state.buildings.find((building) => building.id === id && building.hp > 0) ?? null;
}

function cannonStep(state, building, dt) {
  const def = STW_BUILDINGS.cannon;
  building.cooldown = Math.max(0, building.cooldown - dt);
  let target = resolve(state, building.targetId);
  if (target && (target.kind !== "unit" || distance(building.x, building.y, target.x, target.y) - target.radius > def.range)) target = null;
  if (!target) target = findTarget(state, building, def.range, { unitsOnly: true });
  building.targetId = target?.id ?? null;
  if (!target || building.cooldown > 0) return;
  building.cooldown = def.cooldown;
  queueHit(state, building, target);
  state.effects.push({ kind: "photon", side: building.side, x1: building.x, y1: building.y, x2: target.x, y2: target.y, ttl: 0.3, max: 0.3 });
}

function unitRange(state, unit) {
  const def = STW_UNITS[unit.type];
  if (unit.type === "dragoon" && stwResearchDone(state, unit.side, "range")) return 8;
  return def.range ?? 0;
}

function unitSpeed(state, unit) {
  const def = STW_UNITS[unit.type];
  if (unit.type === "zealot" && stwResearchDone(state, unit.side, "charge")) return def.speed * 1.5;
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

const ROLE_DEPTH = { melee: 2, ranged: 0, caster: -3.5 };

/** 집결지에서의 자리: 근접은 앞, 원거리는 가운데, 템플러는 뒤. 한 줄 12자리. */
function rallySlots(state, side, units, anchorY) {
  const forward = stwForward(side);
  const order = { zealot: 0, dragoon: 1, templar: 2 };
  const sorted = [...units].sort((a, b) => order[a.type] - order[b.type] || a.id - b.id);
  const slots = new Map();
  const byRole = { melee: [], ranged: [], caster: [] };
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
    if (unit.type === "templar") unit.energy = Math.min(STW_UNITS.templar.maxEnergy, unit.energy + STW_UNITS.templar.energyRegen * dt);
  }
  const plans = {};
  for (const side of STW_SIDES) {
    const army = stwArmy(state, side);
    const rallyY = stwRallyY(side, state.sides[side].rally);
    const attackSlots = rallySlots(state, side, army.attack, 0);
    const speeds = army.attack.map((unit) => unitSpeed(state, unit));
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
    if (unit.type === "probe") {
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
    const isAttack = unit.group === "attack";
    const slot = isAttack ? plan.attackSlots.get(unit.id) : plan.rallySlots.get(unit.id);
    const sight = range + (isAttack ? 6 : 7);
    if (!isAttack && slot && isRetreating(unit, slot)) {
      // 후퇴 중: 교전을 끊고 전속력으로 집결지에 돌아온다.
      unit.targetId = null;
      moveToward(unit, slot.x, slot.y, speed, dt);
      continue;
    }
    let target = resolve(state, unit.targetId);
    const intruders = isAttack ? [] : plan.intruders;
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
        if (unit.cooldown <= 0) {
          unit.cooldown = def.cooldown;
          queueHit(state, unit, target);
          state.effects.push({ kind: unit.type === "zealot" ? "slash" : "plasma", side: unit.side, x1: unit.x, y1: unit.y, x2: target.x, y2: target.y, ttl: unit.type === "zealot" ? 0.2 : 0.35, max: unit.type === "zealot" ? 0.2 : 0.35 });
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
    if (unit.side === side || unit.type === "probe" || unit.hp <= 0) return false;
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
    const front = state.units.filter((ally) => ally.side === unit.side && ally.group === "attack" && ally.type !== "templar");
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
    if (enemy.side === caster.side || enemy.type === "probe") continue;
    if (distance(caster.x, caster.y, enemy.x, enemy.y) > STW_STORM.castRange) continue;
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
  const def = STW_UNITS.probe;
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
    for (let j = i + 1; j < units.length; j += 1) {
      const b = units[j];
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
      if (item.hp <= 0 || item.shields >= item.maxShields) continue;
      if (item.kind === "building" && !stwDone(item)) continue;
      if (state.time - item.lastHit < STW_ECONOMY.shieldRegenDelay) continue;
      item.shields = Math.min(item.maxShields, item.shields + STW_ECONOMY.shieldRegen * dt);
    }
  }
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
    state.effects.push({ kind: "death", side: unit.side, x1: unit.x, y1: unit.y, x2: unit.x, y2: unit.y, ttl: 0.7, max: 0.7, radius: unit.type === "dragoon" ? 3.6 : unit.radius * 2 });
    if (unit.type === "probe" && unit.group === "scout" && unit.side === "player") pushLog(state, "player", "정찰 프로브를 잃었습니다.", "warn");
  }
  if (dead.length) state.units = state.units.filter((unit) => unit.hp > 0);
  const fallen = state.buildings.filter((building) => building.hp <= 0);
  for (const building of fallen) {
    const name = building.type === "nexus" && building.base === "natural" ? "앞마당 넥서스" : STW_BUILDINGS[building.type].name;
    state.sides[building.side].stats.buildingsLost += 1;
    state.sides[stwOpponent(building.side)].stats.buildingsDestroyed += 1;
    state.effects.push({ kind: "collapse", side: building.side, x1: building.x, y1: building.y, x2: building.x, y2: building.y, ttl: 1.1, max: 1.1, radius: building.radius * 1.5 });
    if (building.research) state.sides[building.side].research[building.research.id] = undefined;
    if (building.side === "player") pushLog(state, "player", `${withKoreanSubject(name)} 파괴되었습니다.`, "danger");
    else pushLog(state, "player", `적 ${withKoreanObject(name)} 파괴했습니다!`, "good");
    if (building.type === "nexus" && building.base === "natural") {
      // 앞마당 넥서스를 잃으면 그곳 광물을 다시 쓸 수 있게 남겨 둔다.
    }
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
  const units = { zealot: 0, dragoon: 0, templar: 0 };
  for (const unit of state.units) if (unit.side === foe && units[unit.type] !== undefined) units[unit.type] += 1;
  const research = Object.entries(state.sides[foe].research).filter(([, value]) => value).map(([id, value]) => ({ id, status: value }));
  return { time: state.time, buildings, units, research, probes: state.sides[foe].probes };
}

export function intelSummary(intel) {
  if (!intel) return "정보 없음";
  const gateways = intel.buildings.gateway ?? 0;
  const tech = intel.buildings.archives ? "템플러 테크" : intel.buildings.citadel ? "아둔의 성소" : intel.buildings.core ? "사이버네틱스 코어" : "기본 테크";
  const main = Object.entries(intel.units).sort((a, b) => b[1] - a[1])[0];
  const army = main && main[1] > 0 ? `${STW_UNITS[main[0]].name} 위주` : "병력 거의 없음";
  return `게이트웨이 ${gateways} · ${tech} · ${army}${intel.buildings.nexus > 1 ? " · 앞마당 있음" : ""}`;
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

function checkVictory(state) {
  const playerMain = stwNexus(state, "player", "main");
  const enemyMain = stwNexus(state, "enemy", "main");
  if (playerMain && enemyMain) return;
  state.status = "over";
  state.winner = playerMain ? "player" : enemyMain ? "enemy" : "draw";
  pushLog(state, "player", state.winner === "player" ? "적 본진 넥서스를 파괴했습니다. 승리!" : "본진 넥서스가 파괴되었습니다.", state.winner === "player" ? "good" : "danger");
}

export function stwClock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}
