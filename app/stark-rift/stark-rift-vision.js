import { STARK_RIFT_EDGES, STARK_RIFT_ZONES } from "./stark-rift-data.js";

export const STARK_RIFT_CONTACT_MEMORY = 30;

const ZONE_BY_ID = Object.fromEntries(STARK_RIFT_ZONES.map((zone) => [zone.id, zone]));
const NEIGHBORS = Object.fromEntries(STARK_RIFT_ZONES.map((zone) => [zone.id, []]));
for (const [a, b] of STARK_RIFT_EDGES) {
  NEIGHBORS[a].push(b);
  NEIGHBORS[b].push(a);
}

function nearestZone(x, y) {
  let best = STARK_RIFT_ZONES[0];
  let bestDistance = Infinity;
  for (const zone of STARK_RIFT_ZONES) {
    const distance = Math.hypot(x - zone.x, y - zone.y);
    if (distance < bestDistance) {
      best = zone;
      bestDistance = distance;
    }
  }
  return best.id;
}

export function createStarkRiftIntel() {
  return {
    lastSeen: Object.fromEntries(STARK_RIFT_ZONES.map((zone) => [zone.id, -Infinity])),
    contacts: {},
  };
}

function revealZone(zones, zoneId, includeNeighbors = false) {
  if (!ZONE_BY_ID[zoneId]) return;
  zones.add(zoneId);
  if (includeNeighbors) for (const neighbor of NEIGHBORS[zoneId]) zones.add(neighbor);
}

/** 현재 배치된 아군만으로 계산한 실시간 시야. 과거 정찰 기록은 포함하지 않는다. */
export function starkRiftVisibleZones(state, side) {
  const zones = new Set();
  const record = state.sides[side];
  for (const building of state.buildings) {
    if (building.side !== side || building.progress < 1 || (building.type !== "hq" && building.type !== "outpost")) continue;
    revealZone(zones, building.zone, true);
  }
  for (const unit of state.units) {
    if (unit.side !== side || unit.hp <= 0) continue;
    const zoneId = nearestZone(unit.x, unit.y);
    revealZone(zones, zoneId);
    const squad = record.squads[unit.squad];
    if (squad?.order === "scout" && unit.mode === "station" && squad.zone === zoneId) revealZone(zones, zoneId, true);
  }
  return zones;
}

function snapshotEntity(entity, seenAt) {
  return {
    key: `${entity.kind}:${entity.id}`,
    kind: entity.kind,
    seenAt,
    expiresAt: seenAt + STARK_RIFT_CONTACT_MEMORY,
    entity: {
      id: entity.id,
      kind: entity.kind,
      side: entity.side,
      type: entity.type,
      zone: entity.zone ?? nearestZone(entity.x, entity.y),
      x: entity.x,
      y: entity.y,
      radius: entity.radius,
      heading: entity.heading ?? 0,
    },
  };
}

/** 탐색 기록과 마지막 접촉 정보를 현재 실시간 시야에서만 갱신한다. */
export function refreshStarkRiftVision(state, side) {
  const record = state.sides[side];
  const visibleZones = starkRiftVisibleZones(state, side);
  for (const zoneId of visibleZones) record.intel.lastSeen[zoneId] = state.time;

  const enemies = [...state.units, ...state.buildings].filter((entity) => entity.side !== side && entity.hp > 0);
  const enemyByKey = new Map(enemies.map((entity) => [`${entity.kind}:${entity.id}`, entity]));
  for (const entity of enemies) {
    const zoneId = entity.zone ?? nearestZone(entity.x, entity.y);
    if (!visibleZones.has(zoneId)) continue;
    const contact = snapshotEntity(entity, state.time);
    record.intel.contacts[contact.key] = contact;
  }

  for (const [key, contact] of Object.entries(record.intel.contacts)) {
    if (contact.expiresAt <= state.time) {
      delete record.intel.contacts[key];
      continue;
    }
    if (!visibleZones.has(contact.entity.zone)) continue;
    const current = enemyByKey.get(key);
    const currentZone = current ? (current.zone ?? nearestZone(current.x, current.y)) : null;
    if (!current || !visibleZones.has(currentZone)) delete record.intel.contacts[key];
  }
}

export function starkRiftZoneIntel(state, side, zoneId) {
  if (starkRiftVisibleZones(state, side).has(zoneId)) return "visible";
  const lastSeen = state.sides[side].intel?.lastSeen?.[zoneId] ?? -Infinity;
  return Number.isFinite(lastSeen) ? "explored" : "unknown";
}

export function starkRiftEntityVisible(state, viewer, entity) {
  if (entity.side === viewer) return true;
  const zoneId = entity.zone ?? nearestZone(entity.x, entity.y);
  return starkRiftVisibleZones(state, viewer).has(zoneId);
}

/** 실시간 시야 밖에 있는, 마지막 관측 당시 위치가 고정된 적 접촉 정보. */
export function starkRiftRememberedContacts(state, viewer) {
  const contacts = state.sides[viewer].intel?.contacts ?? {};
  return Object.values(contacts)
    .filter((contact) => contact.expiresAt > state.time && !starkRiftEntityVisible(state, viewer, contact.entity))
    .map((contact) => ({ ...contact, age: Math.max(0, state.time - contact.seenAt) }));
}

export function starkRiftHasVisibleEnemy(state, viewer) {
  return state.units.some((unit) => unit.side !== viewer && starkRiftEntityVisible(state, viewer, unit))
    || state.buildings.some((building) => building.side !== viewer && starkRiftEntityVisible(state, viewer, building));
}
