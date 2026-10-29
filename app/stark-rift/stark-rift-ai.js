// Stark Rift AI. 플레이어와 같은 starkRiftCommand만 사용하므로 규칙상 반칙이 없다.
// 난이도는 수입 보정, 판단 주기, 공격 시점과 규모로만 조절한다.
import { STARK_RIFT_BUILDINGS, STARK_RIFT_DIFFICULTIES, STARK_RIFT_UNITS, STARK_RIFT_ZONES } from "./stark-rift-data.js";
import {
  starkRiftArmySupply,
  starkRiftBaseAt,
  starkRiftBuildingDone,
  starkRiftCommand,
  starkRiftHomeZone,
  starkRiftOpponent,
  starkRiftOwnsZone,
  starkRiftPath,
  starkRiftPathLength,
  starkRiftSideZone,
  starkRiftSupply,
  starkRiftWorkerTotal,
  starkRiftZone,
} from "./stark-rift-engine.js";

const AI_SQUAD = 1;

function createMemory() {
  return { nextThink: 0, wave: 0, attacking: false, attackStart: 0, target: null, defending: null };
}

export function starkRiftAiThink(state, side) {
  const settings = STARK_RIFT_DIFFICULTIES[state.difficulty];
  const record = state.sides[side];
  record.ai ??= createMemory();
  const memory = record.ai;
  if (state.time < memory.nextThink) return;
  memory.nextThink = state.time + settings.thinkEvery;
  const reserve = manageEconomy(state, side, settings);
  manageArmyProduction(state, side, reserve);
  manageMilitary(state, side, settings, memory);
}

function own(state, side) {
  return state.buildings.filter((building) => building.side === side);
}

function manageEconomy(state, side, settings) {
  const record = state.sides[side];
  const buildings = own(state, side);
  const zone = (id) => starkRiftSideZone(side, id);
  const count = (type) => buildings.filter((building) => building.type === type).length;
  let reserve = 0;
  const tryBuild = (type, zoneId) => {
    const result = starkRiftCommand(state, side, { type: "build", zone: zoneId, building: type });
    if (!result.ok && /광석/.test(result.reason ?? "")) reserve = Math.max(reserve, STARK_RIFT_BUILDINGS[type].cost);
    return result.ok;
  };

  const mines = STARK_RIFT_ZONES.filter((item) => item.mine > 0 && starkRiftOwnsZone(state, side, item.id) && state.zones[item.id].ore > 0);
  const workerTarget = Math.min(36, mines.length * 10 + 2);
  const bases = buildings.filter((building) => (building.type === "hq" || building.type === "outpost") && starkRiftBuildingDone(building));
  for (const base of bases) {
    if (starkRiftWorkerTotal(state, side) + bases.reduce((sum, item) => sum + item.queue.length, 0) >= workerTarget) break;
    if (!base.queue.length) starkRiftCommand(state, side, { type: "train", buildingId: base.id, unit: "worker" });
  }

  const supply = starkRiftSupply(state, side);
  const depotsBuilding = buildings.filter((building) => building.type === "depot" && !starkRiftBuildingDone(building)).length;
  const producers = count("barracks") + count("factory") * 1.5;
  if (supply.cap < 100 && supply.used + 3 + producers * 1.5 >= supply.cap && depotsBuilding < (supply.used > 40 ? 2 : 1)) {
    const homeZone = starkRiftHomeZone(side);
    const depotZone = [homeZone, ...bases.map((base) => base.zone)].find((id) => starkRiftOwnsZone(state, side, id));
    if (depotZone) tryBuild("depot", depotZone);
  }

  const barracksWanted = state.time > 260 && state.difficulty !== "easy" ? 3 : state.time > 130 ? 2 : state.time > 30 ? 1 : 0;
  if (count("barracks") < barracksWanted) tryBuild("barracks", starkRiftHomeZone(side));

  const factoryAt = state.difficulty === "easy" ? 330 : state.difficulty === "hard" ? 170 : 200;
  if (state.time > factoryAt && count("factory") < 1) tryBuild("factory", starkRiftHomeZone(side));

  const expandAt = state.difficulty === "easy" ? 360 : state.difficulty === "hard" ? 200 : 260;
  const outposts = buildings.filter((building) => building.type === "outpost");
  if (state.time > expandAt && outposts.length < 1) tryBuild("outpost", zone("south"));
  if (state.time > expandAt + 240 && outposts.length < 2) tryBuild("outpost", zone("east"));

  if (state.time > 240) {
    for (const outpost of outposts.filter(starkRiftBuildingDone)) {
      const turrets = buildings.filter((building) => building.type === "turret" && building.zone === outpost.zone).length;
      if (!turrets) tryBuild("turret", outpost.zone);
    }
  }
  if (state.time > 320 && !buildings.some((building) => building.type === "turret" && building.zone === starkRiftHomeZone(side))) {
    tryBuild("turret", starkRiftHomeZone(side));
  }
  if (settings.id === "hard" && record.ore > 500 && count("barracks") < 4) tryBuild("barracks", starkRiftHomeZone(side));
  return reserve;
}

function manageArmyProduction(state, side, reserve) {
  const record = state.sides[side];
  const units = state.units.filter((unit) => unit.side === side);
  const rifles = units.filter((unit) => unit.type === "rifle").length;
  const guards = units.filter((unit) => unit.type === "guard").length;
  for (const building of own(state, side)) {
    if (!starkRiftBuildingDone(building) || building.queue.length >= 2) continue;
    let unit = null;
    if (building.type === "factory") unit = "tank";
    if (building.type === "barracks") unit = guards * 2 < rifles ? "guard" : "rifle";
    if (!unit || record.ore - reserve < STARK_RIFT_UNITS[unit].cost) continue;
    starkRiftCommand(state, side, { type: "train", buildingId: building.id, unit });
  }
}

function stagingZone(state, side) {
  const natural = starkRiftSideZone(side, "south");
  return starkRiftOwnsZone(state, side, natural) ? natural : starkRiftHomeZone(side);
}

function threatenedZone(state, side) {
  const foe = starkRiftOpponent(side);
  let best = null;
  let bestSupply = 0;
  for (const zone of STARK_RIFT_ZONES) {
    const base = starkRiftBaseAt(state, zone.id);
    if (!base || base.side !== side) continue;
    const supply = state.units
      .filter((unit) => unit.side === foe && Math.hypot(unit.x - zone.x, unit.y - zone.y) <= zone.radius + 5)
      .reduce((sum, unit) => sum + STARK_RIFT_UNITS[unit.type].supply, 0);
    if (supply > bestSupply) {
      best = zone.id;
      bestSupply = supply;
    }
  }
  return bestSupply >= 2 ? best : null;
}

function chooseTarget(state, side) {
  const foe = starkRiftOpponent(side);
  const home = starkRiftHomeZone(side);
  const zones = [...new Set(state.buildings.filter((building) => building.side === foe).map((building) => building.zone))];
  if (!zones.length) return starkRiftHomeZone(foe);
  const foeHome = starkRiftHomeZone(foe);
  const outer = zones.filter((id) => id !== foeHome);
  const pool = outer.length ? outer : zones;
  return pool.sort((a, b) => starkRiftPathLength(starkRiftPath(home, a)) - starkRiftPathLength(starkRiftPath(home, b)))[0];
}

function chooseFormation(state, side) {
  const foe = starkRiftOpponent(side);
  const foeTanks = state.units.filter((unit) => unit.side === foe && unit.type === "tank").length;
  const mine = state.units.filter((unit) => unit.side === side);
  const guards = mine.filter((unit) => unit.type === "guard").length;
  if (foeTanks >= 2) return "spread";
  if (mine.length >= 6 && guards / mine.length >= 0.6) return "wedge";
  return "line";
}

function manageMilitary(state, side, settings, memory) {
  const record = state.sides[side];
  const squad = record.squads[AI_SQUAD];
  const army = starkRiftArmySupply(state, side);
  const order = (type, zone) => {
    if (squad.order === type && squad.zone === zone) return;
    starkRiftCommand(state, side, { type: "order", squad: AI_SQUAD, order: type, zone });
  };
  const formation = chooseFormation(state, side);
  if (squad.formation !== formation) starkRiftCommand(state, side, { type: "formation", squad: AI_SQUAD, formation });

  const threat = threatenedZone(state, side);
  if (threat && army > 0 && (!memory.attacking || threat === starkRiftHomeZone(side))) {
    memory.defending = threat;
    memory.attacking = false;
    order("attack", threat);
    return;
  }
  if (!threat && memory.defending) memory.defending = null;

  if (memory.attacking) {
    if (army < memory.attackStart * 0.4) {
      memory.attacking = false;
      memory.wave += 1;
      order("move", stagingZone(state, side));
      return;
    }
    const foe = starkRiftOpponent(side);
    const targetHasBuildings = state.buildings.some((building) => building.side === foe && building.zone === memory.target);
    if (!targetHasBuildings) {
      memory.target = chooseTarget(state, side);
    }
    order("attack", memory.target);
    return;
  }

  const waveSize = settings.firstWave + memory.wave * settings.waveGrowth;
  if (state.time >= settings.firstAttackAt && army >= Math.min(60, waveSize)) {
    memory.attacking = true;
    memory.attackStart = army;
    memory.target = chooseTarget(state, side);
    order("attack", memory.target);
    return;
  }
  order("move", stagingZone(state, side));
}

export function starkRiftAiStatus(state, side) {
  const memory = state.sides[side].ai;
  if (!memory) return "준비 중";
  if (memory.defending) return "방어 중";
  if (memory.attacking) return `${starkRiftZone(memory.target)?.name ?? "전선"} 공격 중`;
  return "병력 집결 중";
}
