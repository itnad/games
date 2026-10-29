// Stark Rift 규칙 엔진. React나 DOM에 의존하지 않는 순수 시뮬레이션이다.
// 같은 시드와 같은 명령 순서는 항상 같은 결과를 만든다.
import {
  withKoreanDirection,
  withKoreanObject,
  withKoreanSubject,
} from "../korean-particles.js";
import {
  STARK_RIFT_BUILDINGS,
  STARK_RIFT_DIFFICULTIES,
  STARK_RIFT_ECONOMY,
  STARK_RIFT_EDGES,
  STARK_RIFT_FACTIONS,
  STARK_RIFT_FORMATIONS,
  STARK_RIFT_HIGH_GROUND_REDUCTION,
  STARK_RIFT_MAP_HEIGHT,
  STARK_RIFT_MAP_WIDTH,
  STARK_RIFT_SQUAD_IDS,
  STARK_RIFT_STRATEGIES,
  STARK_RIFT_TICK,
  STARK_RIFT_UNITS,
  STARK_RIFT_ZONES,
} from "./stark-rift-data.js";

export const STARK_RIFT_SIDES = ["player", "enemy"];
const ROLE_ORDER = { melee: 0, ranged: 1, siege: 2 };
const ZONE_BY_ID = Object.fromEntries(STARK_RIFT_ZONES.map((zone) => [zone.id, zone]));
const MIRROR_ZONE = { home: "enemy", enemy: "home", south: "north", north: "south", east: "west", west: "east", center: "center" };

export function starkRiftZone(id) {
  return ZONE_BY_ID[id];
}

export function starkRiftOpponent(side) {
  return side === "player" ? "enemy" : "player";
}

/** 진영 기준 지역 id. 적 진영에게 "home"은 "enemy" 지역이다. */
export function starkRiftSideZone(side, zoneId) {
  return side === "player" ? zoneId : MIRROR_ZONE[zoneId];
}

export function starkRiftHomeZone(side) {
  return side === "player" ? "home" : "enemy";
}

export function starkRiftSquadName(squadId) {
  return `${squadId}부대`;
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function createRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function starkRiftRandom(state) {
  const rng = createRng(state.rngState);
  const value = rng();
  state.rngState = (state.rngState + 0x9e3779b9) >>> 0;
  return value;
}

/* ───────── 지도 ───────── */

const NEIGHBORS = (() => {
  const map = Object.fromEntries(STARK_RIFT_ZONES.map((zone) => [zone.id, []]));
  for (const [a, b] of STARK_RIFT_EDGES) {
    map[a].push(b);
    map[b].push(a);
  }
  return map;
})();

export function starkRiftNeighbors(zoneId) {
  return NEIGHBORS[zoneId] ?? [];
}

/** 지역 그래프에서 거리 기준 최단 경로(시작과 끝 포함). */
export function starkRiftPath(fromZone, toZone) {
  if (fromZone === toZone) return [fromZone];
  const dist = Object.fromEntries(STARK_RIFT_ZONES.map((zone) => [zone.id, Infinity]));
  const prev = {};
  const open = new Set(STARK_RIFT_ZONES.map((zone) => zone.id));
  dist[fromZone] = 0;
  while (open.size) {
    let current = null;
    for (const id of open) if (current === null || dist[id] < dist[current]) current = id;
    if (current === null || dist[current] === Infinity) break;
    open.delete(current);
    if (current === toZone) break;
    for (const next of NEIGHBORS[current]) {
      const a = ZONE_BY_ID[current];
      const b = ZONE_BY_ID[next];
      const candidate = dist[current] + distance(a.x, a.y, b.x, b.y);
      if (candidate < dist[next]) {
        dist[next] = candidate;
        prev[next] = current;
      }
    }
  }
  if (dist[toZone] === Infinity) return [];
  const path = [toZone];
  while (path[0] !== fromZone) path.unshift(prev[path[0]]);
  return path;
}

export function starkRiftPathLength(path) {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    const a = ZONE_BY_ID[path[index - 1]];
    const b = ZONE_BY_ID[path[index]];
    total += distance(a.x, a.y, b.x, b.y);
  }
  return total;
}

export function starkRiftNearestZone(x, y) {
  let best = STARK_RIFT_ZONES[0];
  let bestDistance = Infinity;
  for (const zone of STARK_RIFT_ZONES) {
    const d = distance(x, y, zone.x, zone.y);
    if (d < bestDistance) {
      best = zone;
      bestDistance = d;
    }
  }
  return best;
}

/** 지도 터치 좌표를 지역으로 바꾼다. 지역 반경 밖이면 null. */
export function starkRiftZoneAt(x, y, slack = 4) {
  const zone = starkRiftNearestZone(x, y);
  return distance(x, y, zone.x, zone.y) <= zone.radius + slack ? zone.id : null;
}

/** 광산은 지도 중앙의 반대쪽, 지역 바깥 가장자리에 둔다. */
export function starkRiftMinePosition(zoneId) {
  const zone = ZONE_BY_ID[zoneId];
  const cx = STARK_RIFT_MAP_WIDTH / 2;
  const cy = STARK_RIFT_MAP_HEIGHT / 2;
  let dx = zone.x - cx;
  let dy = zone.y - cy;
  const length = Math.hypot(dx, dy) || 1;
  dx /= length;
  dy /= length;
  const offset = zone.radius * 0.72;
  return {
    x: Math.min(STARK_RIFT_MAP_WIDTH - 3, Math.max(3, zone.x + dx * offset)),
    y: Math.min(STARK_RIFT_MAP_HEIGHT - 3, Math.max(3, zone.y + dy * offset)),
  };
}

/** 건물 자리. 0번은 지역 중심(사령부·전진기지), 나머지는 광산 방향을 피한 고리 위에 배치한다. */
export function starkRiftSlotPosition(zoneId, slot) {
  const zone = ZONE_BY_ID[zoneId];
  if (slot === 0) return { x: zone.x, y: zone.y };
  const mine = starkRiftMinePosition(zoneId);
  const mineAngle = Math.atan2(mine.y - zone.y, mine.x - zone.x);
  const gap = zone.mine ? 1.7 : 0;
  const span = Math.PI * 2 - gap;
  const angle = mineAngle + gap / 2 + (span * (slot - 0.5)) / zone.slots;
  const ring = zone.radius * 0.78;
  return {
    x: Math.min(STARK_RIFT_MAP_WIDTH - 3, Math.max(3, zone.x + Math.cos(angle) * ring)),
    y: Math.min(STARK_RIFT_MAP_HEIGHT - 3, Math.max(3, zone.y + Math.sin(angle) * ring)),
  };
}

/* ───────── 생성 ───────── */

function createSide(id, faction, strategy) {
  const home = starkRiftHomeZone(id);
  return {
    id,
    faction,
    strategy,
    ore: STARK_RIFT_ECONOMY.startOre,
    workers: { [home]: STARK_RIFT_ECONOMY.startWorkers },
    transit: [],
    workerDamage: {},
    autoWorkers: true,
    rallySquad: 1,
    squads: Object.fromEntries(STARK_RIFT_SQUAD_IDS.map((squadId) => [squadId, {
      id: squadId,
      order: "move",
      zone: home,
      formation: "line",
      engagedAt: -99,
    }])),
    stats: { oreMined: 0, unitsProduced: 0, unitsLost: 0, kills: 0, buildingsLost: 0, buildingsDestroyed: 0, workersLost: 0 },
    ai: null,
  };
}

export function createStarkRiftGame({
  difficulty = "normal",
  seed = 20261029,
  aiSides = ["enemy"],
  playerFaction = "vanguard",
  enemyFaction = "brood",
  playerStrategy = "balanced",
  enemyStrategy = "balanced",
} = {}) {
  const validPlayerFaction = STARK_RIFT_FACTIONS[playerFaction] ? playerFaction : "vanguard";
  const validEnemyFaction = STARK_RIFT_FACTIONS[enemyFaction] ? enemyFaction : "brood";
  const validPlayerStrategy = STARK_RIFT_STRATEGIES[playerStrategy] ? playerStrategy : "balanced";
  const validEnemyStrategy = STARK_RIFT_STRATEGIES[enemyStrategy] ? enemyStrategy : "balanced";
  const state = {
    version: 2,
    time: 0,
    difficulty: STARK_RIFT_DIFFICULTIES[difficulty] ? difficulty : "normal",
    rngState: seed >>> 0,
    status: "playing",
    winner: null,
    nextId: 1,
    accumulator: 0,
    zones: Object.fromEntries(STARK_RIFT_ZONES.map((zone) => [zone.id, { id: zone.id, ore: zone.mine }])),
    sides: {
      player: createSide("player", validPlayerFaction, validPlayerStrategy),
      enemy: createSide("enemy", validEnemyFaction, validEnemyStrategy),
    },
    buildings: [],
    units: [],
    effects: [],
    pendingHits: [],
    log: [],
    alerts: {},
    aiSides: [...aiSides],
  };
  for (const side of STARK_RIFT_SIDES) {
    const hq = placeBuilding(state, side, "hq", starkRiftHomeZone(side), 0);
    hq.progress = 1;
    hq.hp = hq.maxHp;
  }
  pushLog(state, "player", `${STARK_RIFT_FACTIONS[validPlayerFaction].name} 출격. 일꾼을 늘리고 병영을 세워 전선을 준비하세요.`, "info");
  return state;
}

/** 종족과 개전 전략의 보정을 한 번에 합친다. */
export function starkRiftModifiers(state, side) {
  const record = state.sides[side];
  const faction = STARK_RIFT_FACTIONS[record.faction] ?? STARK_RIFT_FACTIONS.vanguard;
  const strategy = STARK_RIFT_STRATEGIES[record.strategy] ?? STARK_RIFT_STRATEGIES.balanced;
  return Object.fromEntries(Object.keys(faction.modifiers).map((key) => [key, faction.modifiers[key] * strategy.modifiers[key]]));
}

export function starkRiftUnitCost(state, side, type) {
  return Math.max(1, Math.round(STARK_RIFT_UNITS[type].cost * starkRiftModifiers(state, side).unitCost));
}

export function starkRiftBuildingCost(state, side, type) {
  return Math.max(1, Math.round(STARK_RIFT_BUILDINGS[type].cost * starkRiftModifiers(state, side).buildCost));
}

function placeBuilding(state, side, type, zoneId, slot) {
  const def = STARK_RIFT_BUILDINGS[type];
  const modifiers = starkRiftModifiers(state, side);
  const position = starkRiftSlotPosition(zoneId, slot);
  const maxHp = Math.round(def.hp * modifiers.buildingHp);
  const building = {
    id: state.nextId++,
    kind: "building",
    side,
    type,
    zone: zoneId,
    slot,
    x: position.x,
    y: position.y,
    radius: def.size / 2,
    hp: Math.max(1, Math.round(maxHp * 0.1)),
    maxHp,
    cost: starkRiftBuildingCost(state, side, type),
    buildTime: def.time * modifiers.buildTime,
    armor: def.armor ?? 0,
    progress: 0,
    queue: [],
    cooldown: 0,
    targetId: null,
    lastFiredAt: -99,
  };
  state.buildings.push(building);
  return building;
}

/* ───────── 조회 ───────── */

export function starkRiftBuildingDone(building) {
  return building.progress >= 1;
}

export function starkRiftBaseAt(state, zoneId) {
  return state.buildings.find((building) => building.zone === zoneId && (building.type === "hq" || building.type === "outpost")) ?? null;
}

/** 지역의 지배 진영: 완성 여부와 무관하게 사령부·전진기지를 가진 쪽. */
export function starkRiftZoneOwner(state, zoneId) {
  return starkRiftBaseAt(state, zoneId)?.side ?? null;
}

export function starkRiftOwnsZone(state, side, zoneId) {
  const base = starkRiftBaseAt(state, zoneId);
  return Boolean(base && base.side === side && starkRiftBuildingDone(base));
}

export function starkRiftWorkerTotal(state, side) {
  const record = state.sides[side];
  const placed = Object.values(record.workers).reduce((sum, count) => sum + count, 0);
  return placed + record.transit.length;
}

export function starkRiftSupply(state, side) {
  let cap = 0;
  let used = starkRiftWorkerTotal(state, side);
  for (const building of state.buildings) {
    if (building.side !== side) continue;
    if (starkRiftBuildingDone(building)) cap += STARK_RIFT_BUILDINGS[building.type].supply ?? 0;
    for (const item of building.queue) used += STARK_RIFT_UNITS[item.unit].supply;
  }
  for (const unit of state.units) if (unit.side === side) used += STARK_RIFT_UNITS[unit.type].supply;
  return { used, cap: Math.min(STARK_RIFT_ECONOMY.supplyLimit, cap) };
}

export function starkRiftSlotsFree(state, zoneId) {
  const zone = ZONE_BY_ID[zoneId];
  const used = new Set(state.buildings.filter((building) => building.zone === zoneId).map((building) => building.slot));
  const free = [];
  for (let slot = 1; slot <= zone.slots; slot += 1) if (!used.has(slot)) free.push(slot);
  return free;
}

export function starkRiftMiningRate(workers) {
  const { fullSaturation, maxSaturation, overflowRate, orePerWorker } = STARK_RIFT_ECONOMY;
  const full = Math.min(workers, fullSaturation);
  const overflow = Math.max(0, Math.min(workers, maxSaturation) - fullSaturation);
  return (full + overflow * overflowRate) * orePerWorker;
}

/** 진영의 분당 예상 수입(난이도 보정 포함). */
export function starkRiftIncomePerMinute(state, side) {
  let rate = 0;
  for (const [zoneId, count] of Object.entries(state.sides[side].workers)) {
    if (!starkRiftOwnsZone(state, side, zoneId) || state.zones[zoneId].ore <= 0) continue;
    rate += starkRiftMiningRate(count);
  }
  return Math.round(rate * incomeMultiplier(state, side) * 60);
}

function incomeMultiplier(state, side) {
  const factionAndStrategy = starkRiftModifiers(state, side).mining;
  if (!state.aiSides.includes(side) || side === "player") return factionAndStrategy;
  return STARK_RIFT_DIFFICULTIES[state.difficulty].income * factionAndStrategy;
}

export function starkRiftSquadUnits(state, side, squadId) {
  return state.units.filter((unit) => unit.side === side && unit.squad === squadId);
}

export function starkRiftArmySupply(state, side) {
  return state.units.filter((unit) => unit.side === side).reduce((sum, unit) => sum + STARK_RIFT_UNITS[unit.type].supply, 0);
}

/** UI용 부대 요약. */
export function starkRiftSquadSummary(state, side, squadId) {
  const squad = state.sides[side].squads[squadId];
  const units = starkRiftSquadUnits(state, side, squadId);
  const counts = { rifle: 0, guard: 0, tank: 0 };
  let hp = 0;
  let maxHp = 0;
  let traveling = 0;
  for (const unit of units) {
    counts[unit.type] += 1;
    hp += unit.hp;
    maxHp += unit.maxHp;
    if (unit.mode === "travel") traveling += 1;
  }
  let status = "대기";
  if (!units.length) status = "병력 없음";
  else if (state.time - squad.engagedAt < 1.5) status = "교전 중";
  else if (traveling) status = squad.order === "attack" ? "진격 중" : "이동 중";
  else status = "주둔";
  return {
    id: squadId,
    name: starkRiftSquadName(squadId),
    zone: squad.zone,
    zoneName: ZONE_BY_ID[squad.zone].name,
    order: squad.order,
    formation: squad.formation,
    counts,
    size: units.length,
    supply: units.reduce((sum, unit) => sum + STARK_RIFT_UNITS[unit.type].supply, 0),
    health: maxHp ? hp / maxHp : 0,
    status,
  };
}

/* ───────── 로그 ───────── */

function pushLog(state, side, text, tone = "info") {
  state.log.push({ id: state.nextId++, time: state.time, side, text, tone });
  if (state.log.length > 40) state.log.splice(0, state.log.length - 40);
}

function alertOnce(state, key, cooldown, side, text, tone) {
  const last = state.alerts[key] ?? -Infinity;
  if (state.time - last < cooldown) return;
  state.alerts[key] = state.time;
  pushLog(state, side, text, tone);
}

/* ───────── 명령 ───────── */

function fail(reason) {
  return { ok: false, reason };
}

/**
 * 플레이어와 AI가 공통으로 쓰는 명령 처리기.
 * @returns {{ok: boolean, reason?: string}}
 */
export function starkRiftCommand(state, side, command) {
  if (state.status !== "playing") return fail("전투가 끝났습니다.");
  const record = state.sides[side];
  switch (command.type) {
    case "train": return trainCommand(state, side, record, command);
    case "cancel": return cancelCommand(state, side, record, command);
    case "build": return buildCommand(state, side, record, command);
    case "order": return orderCommand(state, side, record, command);
    case "formation": {
      if (!STARK_RIFT_FORMATIONS[command.formation]) return fail("알 수 없는 대형입니다.");
      record.squads[command.squad].formation = command.formation;
      return { ok: true };
    }
    case "rally": {
      if (!record.squads[command.squad]) return fail("알 수 없는 부대입니다.");
      record.rallySquad = command.squad;
      return { ok: true };
    }
    case "transfer": return transferCommand(state, side, record, command);
    case "workers": return workersCommand(state, side, record, command);
    case "autoWorkers": {
      record.autoWorkers = Boolean(command.enabled);
      return { ok: true };
    }
    default: return fail("알 수 없는 명령입니다.");
  }
}

/** 생산 가능 여부와 이유. 상태를 바꾸지 않는다. */
export function starkRiftTrainCheck(state, side, buildingId, unit) {
  const building = state.buildings.find((item) => item.id === buildingId && item.side === side);
  const def = STARK_RIFT_UNITS[unit];
  if (!building || !def) return fail("생산 건물을 찾을 수 없습니다.");
  if (!starkRiftBuildingDone(building)) return fail("건설이 끝나야 생산할 수 있습니다.");
  if (!(STARK_RIFT_BUILDINGS[building.type].trains ?? []).includes(unit)) return fail("이 건물에서는 생산할 수 없습니다.");
  if (building.queue.length >= STARK_RIFT_ECONOMY.queueLimit) return fail("생산 대기열이 가득 찼습니다.");
  const cost = starkRiftUnitCost(state, side, unit);
  if (state.sides[side].ore < cost) return fail(`광석이 ${cost - Math.floor(state.sides[side].ore)} 부족합니다.`);
  const supply = starkRiftSupply(state, side);
  if (supply.used + def.supply > supply.cap) return fail("보급이 부족합니다. 보급고를 지으세요.");
  return { ok: true };
}

function trainCommand(state, side, record, { buildingId, unit }) {
  const check = starkRiftTrainCheck(state, side, buildingId, unit);
  if (!check.ok) return check;
  const building = state.buildings.find((item) => item.id === buildingId);
  const def = STARK_RIFT_UNITS[unit];
  const cost = starkRiftUnitCost(state, side, unit);
  record.ore -= cost;
  const duration = def.time * starkRiftModifiers(state, side).trainTime;
  building.queue.push({ unit, cost, duration, remaining: duration });
  return { ok: true };
}

function cancelCommand(state, side, record, { buildingId }) {
  const building = state.buildings.find((item) => item.id === buildingId && item.side === side);
  if (!building) return fail("건물을 찾을 수 없습니다.");
  if (!starkRiftBuildingDone(building)) {
    record.ore += Math.floor(building.cost * 0.75);
    state.buildings = state.buildings.filter((item) => item !== building);
    return { ok: true };
  }
  const item = building.queue.pop();
  if (!item) return fail("취소할 생산이 없습니다.");
  record.ore += item.cost ?? starkRiftUnitCost(state, side, item.unit);
  return { ok: true };
}

/** 특정 지역에 건물을 지을 수 있는지와 이유. */
export function starkRiftBuildCheck(state, side, zoneId, type) {
  const def = STARK_RIFT_BUILDINGS[type];
  const zone = ZONE_BY_ID[zoneId];
  if (!def || !zone || type === "hq") return fail("지을 수 없는 건물입니다.");
  if (type === "outpost") {
    const base = starkRiftBaseAt(state, zoneId);
    if (base) return fail(base.side === side ? "이미 기지가 있는 지역입니다." : "적 기지가 있는 지역입니다.");
    const hostile = state.units.some((unit) => unit.side !== side && distance(unit.x, unit.y, zone.x, zone.y) <= zone.radius + 2);
    if (hostile) return fail("적 병력이 있는 지역에는 기지를 세울 수 없습니다.");
    const adjacent = starkRiftNeighbors(zoneId).some((id) => starkRiftZoneOwner(state, id) === side);
    if (!adjacent) return fail("아군 기지와 맞닿은 지역에만 세울 수 있습니다.");
  } else {
    if (!starkRiftOwnsZone(state, side, zoneId)) return fail("완성된 아군 기지가 있는 지역에만 지을 수 있습니다.");
    if (!starkRiftSlotsFree(state, zoneId).length) return fail("이 지역에는 빈 건설 부지가 없습니다.");
    if (def.requires && !state.buildings.some((item) => item.side === side && item.type === def.requires && starkRiftBuildingDone(item))) {
      return fail(`${withKoreanSubject(STARK_RIFT_BUILDINGS[def.requires].name)} 먼저 필요합니다.`);
    }
  }
  const cost = starkRiftBuildingCost(state, side, type);
  if (state.sides[side].ore < cost) return fail(`광석이 ${cost - Math.floor(state.sides[side].ore)} 부족합니다.`);
  return { ok: true };
}

function buildCommand(state, side, record, { zone, building: type }) {
  const check = starkRiftBuildCheck(state, side, zone, type);
  if (!check.ok) return check;
  const def = STARK_RIFT_BUILDINGS[type];
  record.ore -= starkRiftBuildingCost(state, side, type);
  const slot = type === "outpost" ? 0 : starkRiftSlotsFree(state, zone)[0];
  placeBuilding(state, side, type, zone, slot);
  if (side === "player") pushLog(state, side, `${ZONE_BY_ID[zone].name}에서 ${def.name} 건설을 시작했습니다.`, "info");
  return { ok: true };
}

function orderCommand(state, side, record, { squad: squadId, order, zone }) {
  const squad = record.squads[squadId];
  if (!squad) return fail("알 수 없는 부대입니다.");
  if (!ZONE_BY_ID[zone]) return fail("목표 지역을 고르세요.");
  if (order !== "attack" && order !== "move") return fail("알 수 없는 명령입니다.");
  squad.order = order;
  squad.zone = zone;
  for (const unit of starkRiftSquadUnits(state, side, squadId)) routeUnit(unit, zone);
  if (side === "player") {
    const units = starkRiftSquadUnits(state, side, squadId).length;
    const verb = order === "attack" ? "진격합니다" : "이동합니다";
    pushLog(state, side, units
      ? `${withKoreanSubject(starkRiftSquadName(squadId))} ${withKoreanDirection(ZONE_BY_ID[zone].name)} ${verb}.`
      : `${starkRiftSquadName(squadId)} 집결지를 ${withKoreanDirection(ZONE_BY_ID[zone].name)} 지정했습니다.`, "order");
  }
  return { ok: true };
}

function transferCommand(state, side, record, { from, to, unitType = null }) {
  if (!record.squads[from] || !record.squads[to] || from === to) return fail("부대를 다시 고르세요.");
  const moving = starkRiftSquadUnits(state, side, from).filter((unit) => !unitType || unit.type === unitType);
  if (!moving.length) return fail("보낼 병력이 없습니다.");
  for (const unit of moving) {
    unit.squad = to;
    routeUnit(unit, record.squads[to].zone);
  }
  return { ok: true };
}

function workersCommand(state, side, record, { from, to, count = 1 }) {
  if (!starkRiftOwnsZone(state, side, to)) return fail("완성된 아군 기지가 있는 광산으로만 보낼 수 있습니다.");
  if (ZONE_BY_ID[to].mine <= 0) return fail("광석이 없는 지역입니다.");
  const available = record.workers[from] ?? 0;
  if (!available || from === to) return fail("보낼 일꾼이 없습니다.");
  const moving = Math.min(available, count);
  record.workers[from] = available - moving;
  for (let index = 0; index < moving; index += 1) sendWorker(state, side, from, to);
  return { ok: true };
}

function sendWorker(state, side, from, to) {
  const length = starkRiftPathLength(starkRiftPath(from, to));
  state.sides[side].transit.push({ from, to, eta: state.time + length / STARK_RIFT_ECONOMY.workerSpeed, start: state.time });
}

/* ───────── 이동 ───────── */

function routeUnit(unit, targetZone) {
  const start = starkRiftNearestZone(unit.x, unit.y).id;
  const path = starkRiftPath(start, targetZone);
  if (path.length >= 2) {
    const first = ZONE_BY_ID[path[0]];
    const second = ZONE_BY_ID[path[1]];
    // 이미 출발 지역 안에 있으면 그 중심(건물이 있는 곳)을 거치지 않고 다음 지역으로 바로 간다.
    const insideStart = distance(unit.x, unit.y, first.x, first.y) <= first.radius;
    if (insideStart || distance(unit.x, unit.y, second.x, second.y) < distance(first.x, first.y, second.x, second.y)) path.shift();
  }
  unit.path = path;
  unit.mode = "travel";
  unit.targetId = null;
}

function squadFacing(side, zoneId) {
  const zone = ZONE_BY_ID[zoneId];
  const foe = ZONE_BY_ID[starkRiftHomeZone(starkRiftOpponent(side))];
  const own = ZONE_BY_ID[starkRiftHomeZone(side)];
  let dx = foe.x - zone.x;
  let dy = foe.y - zone.y;
  if (Math.hypot(dx, dy) < 1) {
    dx = zone.x - own.x;
    dy = zone.y - own.y;
  }
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

/** 대형에 따라 부대원별 목표 위치를 계산한다. 근접 → 원거리 → 전차 순으로 앞에서 뒤로 선다. */
export function starkRiftFormationSlots(side, zoneId, formationId, units) {
  const formation = STARK_RIFT_FORMATIONS[formationId] ?? STARK_RIFT_FORMATIONS.line;
  const zone = ZONE_BY_ID[zoneId];
  const facing = squadFacing(side, zoneId);
  const lateral = { x: -facing.y, y: facing.x };
  const ordered = [...units].sort((a, b) => (ROLE_ORDER[STARK_RIFT_UNITS[a.type].role] - ROLE_ORDER[STARK_RIFT_UNITS[b.type].role]) || a.id - b.id);
  // 병종마다 새 줄에서 시작한다: 근접 → 원거리 → 공성 순으로 앞에서 뒤.
  const rowsOf = [];
  let previousRole = null;
  for (const unit of ordered) {
    const role = STARK_RIFT_UNITS[unit.type].role;
    const last = rowsOf.at(-1);
    if (!last || role !== previousRole || last.length >= formation.rowWidth) rowsOf.push([unit]);
    else last.push(unit);
    previousRole = role;
  }
  const slots = new Map();
  const frontOffset = zone.radius * 0.5 + Math.min(zone.radius * 0.3, (rowsOf.length - 1) * formation.spacing * 0.5);
  rowsOf.forEach((row, rowIndex) => {
    row.forEach((unit, column) => {
      const across = (column - (row.length - 1) / 2) * formation.spacing;
      let depth = frontOffset - rowIndex * formation.spacing;
      if (formation.id === "wedge") depth -= Math.abs(across) * 0.65;
      const x = zone.x + facing.x * depth + lateral.x * across;
      const y = zone.y + facing.y * depth + lateral.y * across;
      slots.set(unit.id, {
        x: Math.min(STARK_RIFT_MAP_WIDTH - 1.5, Math.max(1.5, x)),
        y: Math.min(STARK_RIFT_MAP_HEIGHT - 1.5, Math.max(1.5, y)),
      });
    });
  });
  return slots;
}

/* ───────── 시뮬레이션 ───────── */

/**
 * 실제 경과 시간만큼 고정 간격으로 진행한다.
 * @param {any} state
 * @param {number} seconds
 * @param {((state: any, side: string) => void) | null} [aiThink]
 */
export function advanceStarkRift(state, seconds, aiThink = null) {
  state.accumulator += Math.min(seconds, 1);
  let steps = 0;
  while (state.accumulator >= STARK_RIFT_TICK && steps < 40) {
    state.accumulator -= STARK_RIFT_TICK;
    stepStarkRift(state, aiThink);
    steps += 1;
  }
  return steps;
}

/**
 * 0.1초 한 틱을 진행한다.
 * @param {any} state
 * @param {((state: any, side: string) => void) | null} [aiThink]
 */
export function stepStarkRift(state, aiThink = null) {
  if (state.status !== "playing") return;
  const dt = STARK_RIFT_TICK;
  state.time = Math.round((state.time + dt) * 1000) / 1000;
  if (aiThink) for (const side of state.aiSides) aiThink(state, side);
  for (const side of STARK_RIFT_SIDES) {
    stepEconomy(state, side, dt);
  }
  state.pendingHits = [];
  stepBuildings(state, dt);
  stepUnits(state, dt);
  applyPendingHits(state);
  stepEffects(state, dt);
  cleanupDead(state);
  checkVictory(state);
}

function stepEconomy(state, side, dt) {
  const record = state.sides[side];
  const multiplier = incomeMultiplier(state, side);
  for (const [zoneId, count] of Object.entries(record.workers)) {
    if (!count) continue;
    const zone = state.zones[zoneId];
    if (!starkRiftOwnsZone(state, side, zoneId) || zone.ore <= 0) continue;
    const def = ZONE_BY_ID[zoneId];
    const threatened = state.units.some((unit) => unit.side !== side && distance(unit.x, unit.y, def.x, def.y) <= def.radius);
    const mined = Math.min(zone.ore, starkRiftMiningRate(count) * dt * incomeMultiplier(state, side) * (threatened ? 0.3 : 1));
    zone.ore -= mined;
    record.ore += mined * multiplier;
    record.stats.oreMined += mined * multiplier;
    if (zone.ore <= 0 && side === "player") alertOnce(state, `depleted:${zoneId}`, 9999, side, `${withKoreanSubject(def.name)} 바닥났습니다. 일꾼을 다른 광산으로 옮기세요.`, "warn");
  }
  const arrived = record.transit.filter((item) => item.eta <= state.time);
  if (arrived.length) {
    record.transit = record.transit.filter((item) => item.eta > state.time);
    for (const item of arrived) {
      const destination = starkRiftOwnsZone(state, side, item.to) ? item.to : fallbackMine(state, side);
      if (destination) record.workers[destination] = (record.workers[destination] ?? 0) + 1;
    }
  }
  for (const zoneId of Object.keys(record.workers)) {
    if (record.workers[zoneId] && starkRiftZoneOwner(state, zoneId) !== side) {
      const target = fallbackMine(state, side);
      const count = record.workers[zoneId];
      record.workers[zoneId] = 0;
      if (target) for (let index = 0; index < count; index += 1) sendWorker(state, side, zoneId, target);
    }
  }
  if (record.autoWorkers && Math.round(state.time * 10) % 20 === 0) balanceWorkers(state, side);
}

function ownedMines(state, side) {
  const home = starkRiftHomeZone(side);
  return STARK_RIFT_ZONES
    .filter((zone) => zone.mine > 0 && starkRiftOwnsZone(state, side, zone.id) && state.zones[zone.id].ore > 0)
    .map((zone) => zone.id)
    .sort((a, b) => starkRiftPathLength(starkRiftPath(home, a)) - starkRiftPathLength(starkRiftPath(home, b)));
}

function fallbackMine(state, side) {
  return ownedMines(state, side)[0] ?? (starkRiftOwnsZone(state, side, starkRiftHomeZone(side)) ? starkRiftHomeZone(side) : null);
}

function balanceWorkers(state, side) {
  const record = state.sides[side];
  const mines = ownedMines(state, side);
  if (!mines.length) return;
  const incoming = Object.fromEntries(mines.map((id) => [id, record.transit.filter((item) => item.to === id).length]));
  const load = (id) => (record.workers[id] ?? 0) + (incoming[id] ?? 0);
  const total = Object.values(record.workers).reduce((sum, count) => sum + count, 0) + record.transit.length;
  const target = {};
  let remaining = total;
  for (const cap of [STARK_RIFT_ECONOMY.fullSaturation, STARK_RIFT_ECONOMY.maxSaturation]) {
    for (const id of mines) {
      const add = Math.max(0, Math.min(cap - (target[id] ?? 0), remaining));
      target[id] = (target[id] ?? 0) + add;
      remaining -= add;
    }
  }
  const sources = Object.keys(record.workers).filter((id) => (record.workers[id] ?? 0) > 0 && load(id) > (target[id] ?? 0));
  for (const to of mines) {
    let need = target[to] - load(to);
    for (const from of sources) {
      while (need > 0 && (record.workers[from] ?? 0) > 0 && load(from) > (target[from] ?? 0)) {
        record.workers[from] -= 1;
        sendWorker(state, side, from, to);
        incoming[to] = (incoming[to] ?? 0) + 1;
        need -= 1;
      }
    }
  }
}

function stepBuildings(state, dt) {
  for (const building of [...state.buildings]) {
    const def = STARK_RIFT_BUILDINGS[building.type];
    if (!starkRiftBuildingDone(building)) {
      building.progress = Math.min(1, building.progress + dt / building.buildTime);
      building.hp = Math.min(building.maxHp, building.hp + (building.maxHp * 0.9 * dt) / building.buildTime);
      if (starkRiftBuildingDone(building)) {
        building.hp = Math.max(building.hp, Math.round(building.maxHp * 0.98));
        if (building.side === "player") pushLog(state, "player", `${withKoreanSubject(def.name)} 완성되었습니다.`, "good");
      }
      continue;
    }
    if (building.queue.length) {
      const item = building.queue[0];
      item.remaining -= dt;
      if (item.remaining <= 0) {
        building.queue.shift();
        spawnUnit(state, building, item.unit);
      }
    }
    if (def.damage) turretStep(state, building, def, dt);
  }
}

function spawnUnit(state, building, type) {
  const record = state.sides[building.side];
  record.stats.unitsProduced += 1;
  if (type === "worker") {
    record.workers[building.zone] = (record.workers[building.zone] ?? 0) + 1;
    return;
  }
  const def = STARK_RIFT_UNITS[type];
  const maxHp = Math.round(def.hp * starkRiftModifiers(state, building.side).unitHp);
  const spread = (starkRiftRandom(state) - 0.5) * 3;
  const facing = squadFacing(building.side, building.zone);
  const unit = {
    id: state.nextId++,
    kind: "unit",
    side: building.side,
    type,
    x: building.x + facing.x * (building.radius + 1.5) + spread,
    y: building.y + facing.y * (building.radius + 1.5),
    hp: maxHp,
    maxHp,
    armor: def.armor,
    radius: def.radius,
    cooldown: 0,
    squad: record.rallySquad,
    path: [],
    mode: "travel",
    targetId: null,
    lastFiredAt: -99,
    heading: Math.atan2(facing.y, facing.x),
  };
  state.units.push(unit);
  routeUnit(unit, record.squads[unit.squad].zone);
  if (building.side === "player") {
    alertOnce(state, `spawn:${type}`, 6, "player", `${withKoreanSubject(def.name)} ${starkRiftSquadName(unit.squad)}에 합류했습니다.`, "info");
  }
}

/** 지정 위치에 유닛을 바로 배치한다. 테스트와 내부 점검용. */
export function starkRiftSpawnUnitAt(state, side, type, x, y, squad = 1) {
  const def = STARK_RIFT_UNITS[type];
  const maxHp = Math.round(def.hp * starkRiftModifiers(state, side).unitHp);
  const unit = {
    id: state.nextId++,
    kind: "unit",
    side,
    type,
    x,
    y,
    hp: maxHp,
    maxHp,
    armor: def.armor,
    radius: def.radius,
    cooldown: 0,
    squad,
    path: [],
    mode: "station",
    targetId: null,
    lastFiredAt: -99,
    heading: side === "player" ? -Math.PI / 2 : Math.PI / 2,
  };
  state.units.push(unit);
  return unit;
}

function findTarget(state, attacker, radius, { unitsOnly = false } = {}) {
  const foe = starkRiftOpponent(attacker.side);
  let best = null;
  let bestScore = Infinity;
  for (const unit of state.units) {
    if (unit.side !== foe || unit.hp <= 0) continue;
    const d = distance(attacker.x, attacker.y, unit.x, unit.y) - unit.radius;
    if (d > radius) continue;
    if (d < bestScore) {
      best = unit;
      bestScore = d;
    }
  }
  if (unitsOnly) return best;
  for (const building of state.buildings) {
    if (building.side !== foe || building.hp <= 0) continue;
    const d = distance(attacker.x, attacker.y, building.x, building.y) - building.radius;
    if (d > radius) continue;
    const score = d + (STARK_RIFT_BUILDINGS[building.type].damage ? 0 : 6);
    if (score < bestScore) {
      best = building;
      bestScore = score;
    }
  }
  for (const [zoneId, count] of Object.entries(state.sides[foe].workers)) {
    if (!count) continue;
    const point = starkRiftWorkerPoint(state, zoneId);
    const d = distance(attacker.x, attacker.y, point.x, point.y) - 2;
    if (d > radius) continue;
    if (d + 3 < bestScore) {
      best = { kind: "workers", side: foe, zone: zoneId, x: point.x, y: point.y, radius: 2, id: `w:${foe}:${zoneId}` };
      bestScore = d + 3;
    }
  }
  return best;
}

/** 일꾼 무리의 대표 위치: 기지와 광산 사이. */
export function starkRiftWorkerPoint(state, zoneId) {
  const mine = starkRiftMinePosition(zoneId);
  const base = starkRiftBaseAt(state, zoneId);
  return base ? { x: (mine.x + base.x) / 2, y: (mine.y + base.y) / 2 } : mine;
}

function resolveTarget(state, targetId, side) {
  if (targetId === null || targetId === undefined) return null;
  if (typeof targetId === "string") {
    const [, foe, zoneId] = targetId.split(":");
    if (foe === side || !(state.sides[foe].workers[zoneId] > 0)) return null;
    const point = starkRiftWorkerPoint(state, zoneId);
    return { kind: "workers", side: foe, zone: zoneId, x: point.x, y: point.y, radius: 2, id: targetId };
  }
  return state.units.find((unit) => unit.id === targetId && unit.hp > 0)
    ?? state.buildings.find((building) => building.id === targetId && building.hp > 0)
    ?? null;
}

function unitInHighGround(unit) {
  const zone = starkRiftNearestZone(unit.x, unit.y);
  return Boolean(zone.highGround && distance(unit.x, unit.y, zone.x, zone.y) <= zone.radius);
}

function formationOf(state, unit) {
  if (unit.kind !== "unit") return STARK_RIFT_FORMATIONS.line;
  return STARK_RIFT_FORMATIONS[state.sides[unit.side].squads[unit.squad].formation] ?? STARK_RIFT_FORMATIONS.line;
}

/** 공격 1회의 피해량. 대형·고지·방어력·건물 보정을 모두 반영한다. */
export function starkRiftDamage(state, attacker, target, { splash = false } = {}) {
  const isUnit = attacker.kind === "unit";
  const def = isUnit ? STARK_RIFT_UNITS[attacker.type] : STARK_RIFT_BUILDINGS[attacker.type];
  let damage = def.damage;
  damage *= starkRiftModifiers(state, attacker.side).damage;
  if (isUnit) {
    const formation = formationOf(state, attacker);
    damage *= def.role === "melee" ? formation.meleeDamage : formation.rangedDamage;
    if (target.kind === "building" && def.buildingBonus) damage *= def.buildingBonus;
  }
  if (splash) damage *= 0.5;
  damage = Math.max(1, damage - (target.armor ?? 0));
  if (target.kind === "unit") {
    const formation = formationOf(state, target);
    damage *= formation.damageTaken;
    if (splash) damage *= formation.splashTaken;
    if (unitInHighGround(target)) damage *= STARK_RIFT_HIGH_GROUND_REDUCTION;
  }
  return damage;
}

function applyDamage(state, attacker, target, damage) {
  if (target.kind === "workers") {
    const record = state.sides[target.side];
    record.workerDamage[target.zone] = (record.workerDamage[target.zone] ?? 0) + damage;
    while (record.workerDamage[target.zone] >= STARK_RIFT_ECONOMY.workerHp && record.workers[target.zone] > 0) {
      record.workerDamage[target.zone] -= STARK_RIFT_ECONOMY.workerHp;
      record.workers[target.zone] -= 1;
      record.stats.workersLost += 1;
      state.sides[attacker.side].stats.kills += 1;
    }
    if (target.side === "player") alertOnce(state, `workers:${target.zone}`, 12, "player", `${ZONE_BY_ID[target.zone].name}의 일꾼들이 공격받고 있습니다!`, "danger");
    return;
  }
  target.hp -= damage;
  if (target.kind === "building" && target.side === "player") {
    alertOnce(state, `base:${target.zone}`, 12, "player", `${withKoreanSubject(ZONE_BY_ID[target.zone].name)} 공격받고 있습니다!`, "danger");
  }
  if (target.kind === "unit") {
    const squad = state.sides[target.side].squads[target.squad];
    if (squad) squad.engagedAt = state.time;
  }
}

/** 같은 틱의 공격은 모두 모았다가 한꺼번에 적용해 처리 순서에 따른 선제 이득을 없앤다. */
function queueHit(state, attacker, target, damage) {
  state.pendingHits.push({ attacker, target, damage });
}

function applyPendingHits(state) {
  const hits = state.pendingHits;
  state.pendingHits = [];
  for (const hit of hits) applyDamage(state, hit.attacker, hit.target, hit.damage);
}

function fireAt(state, attacker, target, def) {
  attacker.cooldown = def.cooldown;
  attacker.lastFiredAt = state.time;
  if (attacker.kind === "unit") {
    attacker.heading = Math.atan2(target.y - attacker.y, target.x - attacker.x);
    state.sides[attacker.side].squads[attacker.squad].engagedAt = state.time;
  }
  queueHit(state, attacker, target, starkRiftDamage(state, attacker, target));
  const kind = def.splash ? "shell" : def.range > 3 ? "shot" : "slash";
  state.effects.push({ kind, side: attacker.side, x1: attacker.x, y1: attacker.y, x2: target.x, y2: target.y, ttl: kind === "shell" ? 0.45 : 0.18, max: kind === "shell" ? 0.45 : 0.18 });
  if (def.splash && target.kind !== "workers") {
    state.effects.push({ kind: "boom", side: attacker.side, x1: target.x, y1: target.y, x2: target.x, y2: target.y, ttl: 0.5, max: 0.5, radius: def.splash });
    for (const other of state.units) {
      if (other === target || other.side === attacker.side || other.hp <= 0) continue;
      if (distance(other.x, other.y, target.x, target.y) <= def.splash + other.radius) {
        queueHit(state, attacker, other, starkRiftDamage(state, attacker, other, { splash: true }));
      }
    }
  }
}

function turretStep(state, building, def, dt) {
  building.cooldown = Math.max(0, building.cooldown - dt);
  let target = resolveTarget(state, building.targetId, building.side);
  if (target && (target.kind !== "unit" || distance(building.x, building.y, target.x, target.y) - target.radius > def.range)) target = null;
  if (!target) target = findTarget(state, building, def.range, { unitsOnly: true });
  building.targetId = target?.id ?? null;
  if (target && building.cooldown <= 0) fireAt(state, building, target, def);
}

function moveToward(unit, x, y, speed, dt) {
  const dx = x - unit.x;
  const dy = y - unit.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.01) return true;
  const step = Math.min(d, speed * dt);
  unit.x += (dx / d) * step;
  unit.y += (dy / d) * step;
  unit.heading = Math.atan2(dy, dx);
  return step >= d - 0.01;
}

function stepUnits(state, dt) {
  const squadSlots = new Map();
  const squadSpeed = new Map();
  for (const side of STARK_RIFT_SIDES) {
    for (const squadId of STARK_RIFT_SQUAD_IDS) {
      const units = starkRiftSquadUnits(state, side, squadId);
      if (!units.length) continue;
      const squad = state.sides[side].squads[squadId];
      const key = `${side}:${squadId}`;
      squadSlots.set(key, starkRiftFormationSlots(side, squad.zone, squad.formation, units));
      const travelling = units.filter((unit) => unit.mode === "travel");
      squadSpeed.set(key, travelling.length ? Math.min(...travelling.map((unit) => STARK_RIFT_UNITS[unit.type].speed)) : Infinity);
    }
  }

  for (const unit of state.units) {
    if (unit.hp <= 0) continue;
    const def = STARK_RIFT_UNITS[unit.type];
    const squad = state.sides[unit.side].squads[unit.squad];
    const formation = STARK_RIFT_FORMATIONS[squad.formation] ?? STARK_RIFT_FORMATIONS.line;
    const key = `${unit.side}:${unit.squad}`;
    const slot = squadSlots.get(key)?.get(unit.id) ?? { x: unit.x, y: unit.y };
    const groupSpeed = Math.min(def.speed, squadSpeed.get(key) ?? def.speed);
    const speed = (unit.mode === "travel" ? groupSpeed : def.speed) * formation.speed;
    unit.cooldown = Math.max(0, unit.cooldown - dt);

    const fighting = !(unit.mode === "travel" && squad.order === "move");
    let target = fighting ? resolveTarget(state, unit.targetId, unit.side) : null;
    const acquire = def.range + (unit.mode === "station" ? 7 : 5);
    if (target) {
      const d = distance(unit.x, unit.y, target.x, target.y) - (target.radius ?? 0);
      const leash = unit.mode === "station" ? distance(unit.x, unit.y, slot.x, slot.y) > 12 : false;
      if (d > acquire + 3 || leash) target = null;
    }
    if (fighting && !target) target = findTarget(state, unit, acquire);
    unit.targetId = target?.id ?? null;

    if (target) {
      const d = distance(unit.x, unit.y, target.x, target.y) - (target.radius ?? 0) - unit.radius * 0.5;
      if (d <= def.range) {
        if (unit.cooldown <= 0) fireAt(state, unit, target, def);
      } else {
        moveToward(unit, target.x, target.y, def.speed * formation.speed, dt);
      }
      continue;
    }

    if (unit.mode === "travel") {
      while (unit.path.length > 1) {
        const waypoint = ZONE_BY_ID[unit.path[0]];
        if (distance(unit.x, unit.y, waypoint.x, waypoint.y) > Math.max(3, waypoint.radius * 0.75)) break;
        unit.path.shift();
      }
      // 건물 사이에 끼어 1초 넘게 제자리면 지금 경유지를 건너뛰거나(마지막이면) 그 자리에 주둔한다.
      if (unit.stuckSince !== undefined && state.time - unit.stuckSince > 1) {
        unit.stuckSince = undefined;
        if (unit.path.length > 1) unit.path.shift();
        else {
          unit.mode = "station";
          unit.path = [];
          continue;
        }
      }
      if (unit.path.length > 1) {
        const waypoint = ZONE_BY_ID[unit.path[0]];
        moveToward(unit, waypoint.x, waypoint.y, speed, dt);
      } else if (distance(unit.x, unit.y, slot.x, slot.y) <= 1.5 || moveToward(unit, slot.x, slot.y, speed, dt)) {
        unit.mode = "station";
        unit.path = [];
      }
    } else if (distance(unit.x, unit.y, slot.x, slot.y) > 1) {
      moveToward(unit, slot.x, slot.y, def.speed * 0.8, dt);
    }
  }
  separateUnits(state);
  for (const unit of state.units) {
    const moved = unit.lastX === undefined ? Infinity : Math.hypot(unit.x - unit.lastX, unit.y - unit.lastY);
    if (unit.mode === "travel" && unit.targetId === null && moved < 0.03) unit.stuckSince ??= state.time;
    else unit.stuckSince = undefined;
    unit.lastX = unit.x;
    unit.lastY = unit.y;
  }
}

function separateUnits(state) {
  const units = state.units;
  for (let i = 0; i < units.length; i += 1) {
    const a = units[i];
    for (let j = i + 1; j < units.length; j += 1) {
      const b = units[j];
      const min = (a.radius + b.radius) * (a.side === b.side ? 0.92 : 1);
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
    // 이동 중인 유닛은 건물을 통과한다(기지 안 건물 틈에 갇히지 않도록). 주둔한 유닛만 건물 위에 서지 않게 밀어낸다.
    for (const building of a.mode === "station" ? state.buildings : []) {
      const min = building.radius + a.radius * 0.8;
      const dx = a.x - building.x;
      const dy = a.y - building.y;
      if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
      const d = Math.hypot(dx, dy);
      if (d >= min) continue;
      const nx = d > 0.001 ? dx / d : 0;
      const ny = d > 0.001 ? dy / d : 1;
      // 바깥으로 밀어내면서 접선 방향으로도 조금 밀어 건물 둘레를 따라 돌아가게 한다.
      const slide = (min - d) * 0.6 * (a.id % 2 ? 1 : -1);
      a.x = building.x + nx * min - ny * slide;
      a.y = building.y + ny * min + nx * slide;
    }
    a.x = Math.min(STARK_RIFT_MAP_WIDTH - 1, Math.max(1, a.x));
    a.y = Math.min(STARK_RIFT_MAP_HEIGHT - 1, Math.max(1, a.y));
  }
}

function stepEffects(state, dt) {
  for (const effect of state.effects) effect.ttl -= dt;
  state.effects = state.effects.filter((effect) => effect.ttl > 0);
}

function cleanupDead(state) {
  const deadUnits = state.units.filter((unit) => unit.hp <= 0);
  if (deadUnits.length) {
    for (const unit of deadUnits) {
      state.sides[unit.side].stats.unitsLost += 1;
      state.sides[starkRiftOpponent(unit.side)].stats.kills += 1;
      state.effects.push({ kind: "death", side: unit.side, x1: unit.x, y1: unit.y, x2: unit.x, y2: unit.y, ttl: 0.6, max: 0.6, radius: unit.radius * 2 });
    }
    state.units = state.units.filter((unit) => unit.hp > 0);
  }
  const deadBuildings = state.buildings.filter((building) => building.hp <= 0);
  if (deadBuildings.length) {
    for (const building of deadBuildings) {
      const name = STARK_RIFT_BUILDINGS[building.type].name;
      state.sides[building.side].stats.buildingsLost += 1;
      state.sides[starkRiftOpponent(building.side)].stats.buildingsDestroyed += 1;
      state.effects.push({ kind: "collapse", side: building.side, x1: building.x, y1: building.y, x2: building.x, y2: building.y, ttl: 1.1, max: 1.1, radius: building.radius * 1.6 });
      if (building.side === "player") pushLog(state, "player", `${ZONE_BY_ID[building.zone].name}의 ${withKoreanSubject(name)} 파괴되었습니다.`, "danger");
      else pushLog(state, "player", `적 ${withKoreanObject(name)} 파괴했습니다.`, "good");
    }
    state.buildings = state.buildings.filter((building) => building.hp > 0);
  }
}

function checkVictory(state) {
  const playerHq = state.buildings.some((building) => building.side === "player" && building.type === "hq");
  const enemyHq = state.buildings.some((building) => building.side === "enemy" && building.type === "hq");
  if (playerHq && enemyHq) return;
  state.status = "over";
  state.winner = playerHq ? "player" : enemyHq ? "enemy" : "draw";
  pushLog(state, "player", state.winner === "player" ? "적 사령부를 무너뜨렸습니다. 승리!" : "아군 사령부가 함락되었습니다.", state.winner === "player" ? "good" : "danger");
}

/** 전투 시간 표기 (분:초). */
export function starkRiftClock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}
