// 스타즈워 AI. 플레이어와 같은 stwCommand만 쓴다.
// 성향(질럿 러시, 드라군 운영, 템플러 테크)마다 빌드 순서와 출격 규모가 다르다.
import { STW_BUILDINGS, STW_DIFFICULTIES, STW_RESEARCH, STW_UNITS } from "./starswar-data.js";
import {
  stwArmy,
  stwBuildCheck,
  stwCommand,
  stwDone,
  stwHas,
  stwNexus,
  stwOpponent,
  stwOwnBuildings,
  stwResearchCheck,
  stwSupply,
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

export function stwAiThink(state, side) {
  const record = state.sides[side];
  const settings = STW_DIFFICULTIES[state.difficulty];
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
    const nexus = stwNexus(state, side, base);
    return nexus && stwDone(nexus);
  }).length;
  const gasBuildings = stwOwnBuildings(state, side, "assimilator").length;
  const probeTarget = Math.min(44, bases * 16 + gasBuildings * 3);
  const queued = stwOwnBuildings(state, side, "nexus").reduce((sum, nexus) => sum + nexus.queue.length, 0);
  if (record.probes + queued < probeTarget && queued < 2 * bases) stwCommand(state, side, { type: "probe" });

  // 2. 인구
  const supply = stwSupply(state, side);
  const gateways = stwOwnBuildings(state, side, "gateway").length;
  const pylonsBuilding = stwOwnBuildings(state, side, "pylon").filter((building) => !stwDone(building)).length;
  if (supply.cap < 100 && supply.used + 3 + gateways * 2 >= supply.cap && pylonsBuilding < (supply.used > 40 ? 2 : 1)) {
    const result = stwCommand(state, side, { type: "build", building: "pylon" });
    if (!result.ok && /광물/.test(result.reason ?? "")) save(STW_BUILDINGS.pylon.minerals, 0);
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
    const cost = step.build ? STW_BUILDINGS[step.build === "expand" ? "nexus" : step.build] : STW_RESEARCH[step.research];
    const fitsReserve = record.minerals - reserve.minerals >= cost.minerals && record.gas - reserve.gas >= cost.gas;
    if (check.ok && (blocked === 0 || fitsReserve)) {
      stwCommand(state, side, step.build ? { type: "build", building: step.build } : { type: "research", research: step.research });
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
  if (memory.step >= order.length && gateways < GATEWAY_CAP[persona] && record.minerals > 350) stwCommand(state, side, { type: "build", building: "gateway" });
  if (memory.step >= order.length) {
    for (const research of ["weapons2", "shields1", "armor1"]) {
      if (STW_RESEARCH[research] && stwResearchCheck(state, side, research).ok && record.gas > 200) stwCommand(state, side, { type: "research", research });
    }
  }

  // 4. 생산 라인: 테크를 모을 때는 잠시 멈춘다.
  const gatewayList = stwOwnBuildings(state, side, "gateway").sort((a, b) => a.id - b.id);
  gatewayList.forEach((gateway, index) => {
    let unit = "zealot";
    if (persona === "dragoon" && stwHas(state, side, "core")) unit = index % 4 === 3 ? "zealot" : "dragoon";
    if (persona === "templar") {
      if (stwHas(state, side, "archives")) unit = index % 3 === 0 ? "templar" : "zealot";
      else if (stwHas(state, side, "core")) unit = index % 2 ? "dragoon" : "zealot";
    }
    if (persona === "rush" && stwHas(state, side, "core") && state.time > 360) unit = index % 2 ? "dragoon" : "zealot";
    if (STW_UNITS[unit].gas && record.gas < STW_UNITS[unit].gas + reserve.gas && record.minerals > 250) unit = "zealot";
    const def = STW_UNITS[unit];
    const starving = (reserve.minerals && record.minerals - def.minerals < reserve.minerals) || (reserve.gas && def.gas && record.gas - def.gas < reserve.gas);
    const thin = stwArmy(state, side).rally.length + stwArmy(state, side).attack.length < 3;
    const desired = starving && !thin && !gateway.current ? null : unit;
    if (gateway.line !== desired) stwCommand(state, side, { type: "line", gatewayId: gateway.id, unit: desired });
  });

  // 5. 병력
  manageArmy(state, side, persona, memory, settings);
}

function manageArmy(state, side, persona, memory, settings) {
  const record = state.sides[side];
  const desiredRally = stwNexus(state, side, "natural") ? "natural" : "main";
  if (record.rally !== desiredRally) stwCommand(state, side, { type: "rally", point: desiredRally });
  const army = stwArmy(state, side);
  const foe = stwOpponent(side);

  // 본진·앞마당이 공격받으면 공격 병력을 불러들인다.
  const own = ["main", "natural"].map((base) => stwNexus(state, side, base)).filter(Boolean);
  const threat = state.units.filter((unit) => unit.side === foe && unit.type !== "probe" && own.some((nexus) => Math.hypot(unit.x - nexus.x, unit.y - nexus.y) < 16)).length;
  if (threat >= 3 && army.attack.length && army.attack.length < threat * 1.5) {
    stwCommand(state, side, { type: "retreat" });
    memory.attacking = false;
    return;
  }

  if (memory.attacking) {
    if (army.attack.length < Math.max(1, memory.waveStart * 0.35)) {
      if (army.attack.length) stwCommand(state, side, { type: "retreat" });
      memory.attacking = false;
      memory.wave += 1;
    }
    return;
  }
  const waves = WAVES[persona];
  const size = Math.round(waves[Math.min(memory.wave, waves.length - 1)] * settings.waveScale);
  if (army.rally.length >= size) {
    stwCommand(state, side, { type: "attack" });
    memory.attacking = true;
    memory.waveStart = army.rally.length;
  }
}
