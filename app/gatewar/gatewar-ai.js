// 관문 전쟁 AI. 플레이어와 같은 gwCommand만 쓴다.
// 성향(질럿 러시, 드라군 운영, 템플러 테크)마다 빌드 순서와 출격 규모가 다르다.
import { GW_BUILDINGS, GW_DIFFICULTIES, GW_RESEARCH, GW_UNITS } from "./gatewar-data.js";
import {
  gwArmy,
  gwBuildCheck,
  gwCommand,
  gwDone,
  gwHas,
  gwNexus,
  gwOpponent,
  gwOwnBuildings,
  gwResearchCheck,
  gwSupply,
} from "./gatewar-engine.js";

/** 빌드 순서. at: 이 시간(초) 전에는 시도하지 않음. */
const BUILD_ORDERS = {
  rush: [
    { build: "pylon" }, { build: "gateway" }, { build: "gateway" }, { build: "pylon" }, { build: "gateway" },
    { build: "assimilator", at: 170 }, { build: "core" }, { build: "forge", at: 240 }, { research: "weapons1" },
    { build: "expand", at: 330 }, { build: "gateway" }, { research: "range" }, { build: "citadel" }, { research: "charge" },
  ],
  dragoon: [
    { build: "pylon" }, { build: "gateway" }, { build: "assimilator" }, { build: "core" }, { build: "pylon" },
    { build: "assimilator" }, { build: "gateway" }, { research: "range" }, { build: "expand", at: 200 }, { build: "gateway" },
    { build: "forge" }, { research: "weapons1" }, { build: "gateway" }, { research: "armor1" }, { build: "citadel" }, { research: "charge" },
  ],
  templar: [
    { build: "pylon" }, { build: "gateway" }, { build: "assimilator" }, { build: "core" }, { build: "pylon" },
    { build: "gateway" }, { build: "assimilator" }, { build: "citadel" }, { build: "archives" }, { research: "storm" },
    { build: "forge" }, { research: "weapons1" }, { build: "expand", at: 300 }, { build: "gateway" }, { research: "charge" }, { build: "gateway" },
  ],
};

const WAVES = { rush: [4, 6, 8, 10, 12], dragoon: [8, 12, 16, 20], templar: [10, 14, 18, 22] };
const GATEWAY_CAP = { rush: 6, dragoon: 6, templar: 5 };

export function gwAiThink(state, side) {
  const record = state.sides[side];
  const settings = GW_DIFFICULTIES[state.difficulty];
  record.ai ??= { nextThink: 0, step: 0, wave: 0, attacking: false, waveStart: 0 };
  const memory = record.ai;
  if (state.time < memory.nextThink) return;
  memory.nextThink = state.time + settings.thinkEvery;
  const persona = record.persona ?? "dragoon";

  // 다음 건물·연구에 필요한 자원만 아껴 둔다(모자란 쪽만).
  const reserve = { minerals: 0, gas: 0 };
  const save = (minerals, gas) => {
    if (record.minerals < minerals) reserve.minerals = Math.max(reserve.minerals, minerals);
    if (record.gas < gas) reserve.gas = Math.max(reserve.gas, gas);
  };
  // 1. 프로브
  const bases = ["main", "natural"].filter((base) => {
    const nexus = gwNexus(state, side, base);
    return nexus && gwDone(nexus);
  }).length;
  const gasBuildings = gwOwnBuildings(state, side, "assimilator").length;
  const probeTarget = Math.min(44, bases * 16 + gasBuildings * 3);
  const queued = gwOwnBuildings(state, side, "nexus").reduce((sum, nexus) => sum + nexus.queue.length, 0);
  if (record.probes + queued < probeTarget && queued < 2 * bases) gwCommand(state, side, { type: "probe" });

  // 2. 인구
  const supply = gwSupply(state, side);
  const gateways = gwOwnBuildings(state, side, "gateway").length;
  const pylonsBuilding = gwOwnBuildings(state, side, "pylon").filter((building) => !gwDone(building)).length;
  if (supply.cap < 100 && supply.used + 3 + gateways * 2 >= supply.cap && pylonsBuilding < (supply.used > 40 ? 2 : 1)) {
    const result = gwCommand(state, side, { type: "build", building: "pylon" });
    if (!result.ok && /광물/.test(result.reason ?? "")) save(GW_BUILDINGS.pylon.minerals, 0);
  }

  // 3. 빌드 순서: 막힌 단계가 있으면 그 자원만 아껴 두고, 남는 자원으로 할 수 있는 다음 단계(최대 4개 앞)를 먼저 한다.
  const order = BUILD_ORDERS[persona];
  memory.done ??= [];
  let blocked = 0;
  for (let index = 0; index < order.length && blocked < 4; index += 1) {
    if (memory.done.includes(index)) continue;
    const step = order[index];
    if (step.at && state.time < step.at * GW_DIFFICULTIES[state.difficulty].waveScale) {
      blocked += 1;
      continue;
    }
    const check = step.build ? gwBuildCheck(state, side, step.build) : gwResearchCheck(state, side, step.research);
    const cost = step.build ? GW_BUILDINGS[step.build === "expand" ? "nexus" : step.build] : GW_RESEARCH[step.research];
    const fitsReserve = record.minerals - reserve.minerals >= cost.minerals && record.gas - reserve.gas >= cost.gas;
    if (check.ok && (blocked === 0 || fitsReserve)) {
      gwCommand(state, side, step.build ? { type: "build", building: step.build } : { type: "research", research: step.research });
      memory.done.push(index);
      continue;
    }
    if (/이미|완료|자리|찼습니다|연구 중/.test(check.reason ?? "")) {
      memory.done.push(index);
      continue;
    }
    if (blocked === 0 && /부족/.test(check.reason ?? "")) save(cost.minerals, cost.gas);
    blocked += 1;
  }
  memory.step = memory.done.length;
  if (memory.step >= order.length && gateways < GATEWAY_CAP[persona] && record.minerals > 350) gwCommand(state, side, { type: "build", building: "gateway" });
  if (memory.step >= order.length) {
    for (const research of ["weapons2", "shields1", "armor1"]) {
      if (GW_RESEARCH[research] && gwResearchCheck(state, side, research).ok && record.gas > 200) gwCommand(state, side, { type: "research", research });
    }
  }

  // 4. 생산 라인: 테크를 모을 때는 잠시 멈춘다.
  const gatewayList = gwOwnBuildings(state, side, "gateway").sort((a, b) => a.id - b.id);
  gatewayList.forEach((gateway, index) => {
    let unit = "zealot";
    if (persona === "dragoon" && gwHas(state, side, "core")) unit = index % 4 === 3 ? "zealot" : "dragoon";
    if (persona === "templar") {
      if (gwHas(state, side, "archives")) unit = index % 3 === 0 ? "templar" : "zealot";
      else if (gwHas(state, side, "core")) unit = index % 2 ? "dragoon" : "zealot";
    }
    if (persona === "rush" && gwHas(state, side, "core") && state.time > 360) unit = index % 2 ? "dragoon" : "zealot";
    if (GW_UNITS[unit].gas && record.gas < GW_UNITS[unit].gas + reserve.gas && record.minerals > 250) unit = "zealot";
    const def = GW_UNITS[unit];
    const starving = (reserve.minerals && record.minerals - def.minerals < reserve.minerals) || (reserve.gas && def.gas && record.gas - def.gas < reserve.gas);
    const thin = gwArmy(state, side).rally.length + gwArmy(state, side).attack.length < 3;
    const desired = starving && !thin && !gateway.current ? null : unit;
    if (gateway.line !== desired) gwCommand(state, side, { type: "line", gatewayId: gateway.id, unit: desired });
  });

  // 5. 병력
  manageArmy(state, side, persona, memory, settings);
}

function manageArmy(state, side, persona, memory, settings) {
  const record = state.sides[side];
  const desiredRally = gwNexus(state, side, "natural") ? "natural" : "main";
  if (record.rally !== desiredRally) gwCommand(state, side, { type: "rally", point: desiredRally });
  const army = gwArmy(state, side);
  const foe = gwOpponent(side);

  // 본진·앞마당이 공격받으면 공격 병력을 불러들인다.
  const own = ["main", "natural"].map((base) => gwNexus(state, side, base)).filter(Boolean);
  const threat = state.units.filter((unit) => unit.side === foe && unit.type !== "probe" && own.some((nexus) => Math.hypot(unit.x - nexus.x, unit.y - nexus.y) < 16)).length;
  if (threat >= 3 && army.attack.length && army.attack.length < threat * 1.5) {
    gwCommand(state, side, { type: "retreat" });
    memory.attacking = false;
    return;
  }

  if (memory.attacking) {
    if (army.attack.length < Math.max(1, memory.waveStart * 0.35)) {
      if (army.attack.length) gwCommand(state, side, { type: "retreat" });
      memory.attacking = false;
      memory.wave += 1;
    }
    return;
  }
  const waves = WAVES[persona];
  const size = Math.round(waves[Math.min(memory.wave, waves.length - 1)] * settings.waveScale);
  if (army.rally.length >= size) {
    gwCommand(state, side, { type: "attack" });
    memory.attacking = true;
    memory.waveStart = army.rally.length;
  }
}
