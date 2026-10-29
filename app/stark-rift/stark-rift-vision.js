import { STARK_RIFT_ZONES } from "./stark-rift-data.js";

export const STARK_RIFT_SCOUT_HOLD = 24;
const CURRENT_VISION_WINDOW = 0.25;

const ZONE_BY_ID = Object.fromEntries(STARK_RIFT_ZONES.map((zone) => [zone.id, zone]));

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
    scoutedUntil: Object.fromEntries(STARK_RIFT_ZONES.map((zone) => [zone.id, -Infinity])),
  };
}

function reveal(state, side, zoneId) {
  if (ZONE_BY_ID[zoneId]) state.sides[side].intel.lastSeen[zoneId] = state.time;
}

export function refreshStarkRiftVision(state, side, neighborsOf) {
  const record = state.sides[side];
  for (const building of state.buildings) {
    if (building.side !== side || building.progress < 1 || (building.type !== "hq" && building.type !== "outpost")) continue;
    reveal(state, side, building.zone);
    for (const neighbor of neighborsOf(building.zone)) reveal(state, side, neighbor);
  }
  for (const unit of state.units) {
    if (unit.side !== side || unit.hp <= 0) continue;
    const zoneId = nearestZone(unit.x, unit.y);
    reveal(state, side, zoneId);
    const squad = record.squads[unit.squad];
    if (squad?.order === "scout" && unit.mode === "station" && squad.zone === zoneId) {
      record.intel.scoutedUntil[zoneId] = Math.max(record.intel.scoutedUntil[zoneId], state.time + STARK_RIFT_SCOUT_HOLD);
    }
  }
  for (const zone of STARK_RIFT_ZONES) {
    if (record.intel.scoutedUntil[zone.id] < state.time) continue;
    reveal(state, side, zone.id);
    for (const neighbor of neighborsOf(zone.id)) reveal(state, side, neighbor);
  }
}

export function starkRiftZoneIntel(state, side, zoneId) {
  const lastSeen = state.sides[side].intel?.lastSeen?.[zoneId] ?? -Infinity;
  if (state.time - lastSeen <= CURRENT_VISION_WINDOW) return "visible";
  return Number.isFinite(lastSeen) ? "explored" : "unknown";
}

export function starkRiftEntityVisible(state, viewer, entity) {
  if (entity.side === viewer) return true;
  const zoneId = entity.zone ?? nearestZone(entity.x, entity.y);
  return starkRiftZoneIntel(state, viewer, zoneId) === "visible";
}

export function starkRiftHasVisibleEnemy(state, viewer) {
  return state.units.some((unit) => unit.side !== viewer && starkRiftEntityVisible(state, viewer, unit))
    || state.buildings.some((building) => building.side !== viewer && starkRiftEntityVisible(state, viewer, building));
}
