import assert from "node:assert/strict";
import test from "node:test";
import { GW_LANE_LENGTH, GW_LANE_WIDTH, GW_UNITS } from "../app/gatewar/gatewar-data.js";
import {
  createGatewarGame,
  gwArmy,
  gwBuildCheck,
  gwCommand,
  gwDone,
  gwHitDamage,
  gwIncome,
  gwNexus,
  gwOwnBuildings,
  gwPoint,
  gwResearchCheck,
  gwSpawnUnitAt,
  gwSupply,
  gwWorkerSplit,
  stepGatewar,
} from "../app/gatewar/gatewar-engine.js";
import { gwAiThink } from "../app/gatewar/gatewar-ai.js";
import { GW_MAX_ZOOM, gwFillZoom, gwScreenToMap, gwViewport } from "../app/gatewar/gatewar-camera.js";

const run = (state, seconds, ai = null) => {
  const steps = Math.round(seconds * 10);
  for (let index = 0; index < steps && state.status === "playing"; index += 1) stepGatewar(state, ai);
};
const quiet = () => createGatewarGame({ seed: 5, aiSides: [] });
const finishAll = (state) => {
  for (const building of state.buildings) {
    building.progress = 1;
    building.hp = building.maxHp;
    building.shields = building.maxShields;
  }
};

test("gatewar mirrors both bases and mines at the documented rate", () => {
  const state = quiet();
  const mine = gwNexus(state, "player", "main");
  const theirs = gwNexus(state, "enemy", "main");
  assert.equal(mine.x + theirs.x, GW_LANE_WIDTH);
  assert.equal(mine.y + theirs.y, GW_LANE_LENGTH);
  assert.deepEqual(gwPoint("enemy", { x: 5, y: 98 }), { x: 35, y: 2 });
  assert.equal(state.sides.player.minerals, 50);
  assert.equal(state.sides.player.probes, 4);
  run(state, 60);
  assert.ok(Math.abs(state.sides.player.minerals - (50 + 4 * 0.95 * 60)) < 0.01, `1분 채취 ${state.sides.player.minerals}`);
  assert.deepEqual(gwIncome(state, "player"), { minerals: 228, gas: 0 });
});

test("gatewar tech tree gates buildings, units, and research", () => {
  const state = quiet();
  state.sides.player.minerals = 5000;
  state.sides.player.gas = 5000;
  assert.match(gwBuildCheck(state, "player", "gateway").reason, /파일런이 필요합니다/);
  assert.match(gwBuildCheck(state, "player", "archives").reason, /아둔의 성소가 필요합니다/);
  assert.equal(gwCommand(state, "player", { type: "build", building: "pylon" }).ok, true);
  finishAll(state);
  for (const building of ["gateway", "assimilator", "forge"]) assert.equal(gwCommand(state, "player", { type: "build", building }).ok, true, building);
  finishAll(state);
  const gateway = gwOwnBuildings(state, "player", "gateway")[0];
  assert.equal(gateway.line, "zealot", "새 게이트웨이는 질럿부터 소환");
  assert.equal(gwCommand(state, "player", { type: "line", gatewayId: gateway.id, unit: "dragoon" }).ok, true);
  assert.equal(gwCommand(state, "player", { type: "build", building: "core" }).ok, true);
  assert.match(gwCommand(state, "player", { type: "build", building: "core" }).reason, /이미 있습니다/);
  finishAll(state);
  assert.match(gwResearchCheck(state, "player", "storm").reason, /템플러 아카이브가 필요합니다/);
  assert.equal(gwCommand(state, "player", { type: "research", research: "range" }).ok, true);
  assert.match(gwResearchCheck(state, "player", "range").reason, /연구 중/);
  run(state, 46);
  assert.equal(state.sides.player.research.range, "done");

  assert.deepEqual(gwArmy(state, "player").counts, { zealot: 0, dragoon: 2, templar: 0 }, "코어 완성 후 드라군 라인 가동");
});

test("gatewar production lines wait for supply and resources", () => {
  const state = quiet();
  state.sides.player.minerals = 2000;
  gwCommand(state, "player", { type: "build", building: "pylon" });
  finishAll(state);
  gwCommand(state, "player", { type: "build", building: "gateway" });
  finishAll(state);
  state.sides.player.probes = 16;
  run(state, 0.2);
  const gateway = gwOwnBuildings(state, "player", "gateway")[0];
  assert.equal(gateway.current.unit, "zealot");
  assert.deepEqual(gwSupply(state, "player"), { used: 18, cap: 18 });
  run(state, GW_UNITS.zealot.time + 0.2);
  assert.equal(gwArmy(state, "player").counts.zealot, 1);
  assert.equal(gateway.blocked, "인구 부족");
  assert.equal(gwCommand(state, "player", { type: "line", gatewayId: gateway.id, unit: "dragoon" }).ok, true);
  run(state, 0.2);
  assert.equal(gateway.blocked, "사이버네틱스 코어 필요");
});

test("gatewar damage applies explosive size rules, shields, armor, and upgrades", () => {
  const state = quiet();
  const zealot = gwSpawnUnitAt(state, "player", "zealot", 20, 50);
  const dragoon = gwSpawnUnitAt(state, "player", "dragoon", 22, 50);
  const enemyZealot = gwSpawnUnitAt(state, "enemy", "zealot", 20, 40);
  const enemyDragoon = gwSpawnUnitAt(state, "enemy", "dragoon", 22, 40);
  assert.deepEqual(gwHitDamage(state, dragoon, enemyZealot), [10]);
  assert.deepEqual(gwHitDamage(state, dragoon, enemyDragoon), [20]);
  assert.deepEqual(gwHitDamage(state, zealot, enemyDragoon), [8, 8]);
  state.sides.player.research.weapons1 = "done";
  assert.deepEqual(gwHitDamage(state, zealot, enemyDragoon), [9, 9]);
  assert.deepEqual(gwHitDamage(state, dragoon, enemyDragoon), [22]);
});

test("gatewar armies rally, sail out as a wave, and destroy the enemy main", () => {
  const state = quiet();
  for (let index = 0; index < 8; index += 1) gwSpawnUnitAt(state, "player", index % 2 ? "dragoon" : "zealot", 10 + index * 2, 80);
  run(state, 8);
  assert.equal(gwArmy(state, "player").rally.length, 8);
  assert.match(gwCommand(state, "player", { type: "retreat" }).reason, /공격 중인 병력이 없습니다/);
  assert.equal(gwCommand(state, "player", { type: "attack" }).ok, true);
  assert.equal(gwArmy(state, "player").attack.length, 8);
  run(state, 240);
  assert.equal(state.status, "over");
  assert.equal(state.winner, "player");
  assert.ok(state.log.some((entry) => entry.text === "대기 병력 8기가 출격합니다!"));
});

test("gatewar auto waves launch when enough units gather", () => {
  const state = quiet();
  gwCommand(state, "player", { type: "autoWave", size: 6 });
  for (let index = 0; index < 5; index += 1) gwSpawnUnitAt(state, "player", "zealot", 12 + index * 3, 77);
  run(state, 3);
  assert.equal(gwArmy(state, "player").attack.length, 0);
  gwSpawnUnitAt(state, "player", "zealot", 28, 77);
  run(state, 3);
  assert.equal(gwArmy(state, "player").attack.length, 6);
});

test("gatewar high templar storm hits clumps once researched", () => {
  const state = quiet();
  const templar = gwSpawnUnitAt(state, "player", "templar", 20, 60);
  templar.energy = 120;
  for (let index = 0; index < 4; index += 1) gwSpawnUnitAt(state, "enemy", "zealot", 19 + (index % 2) * 1.5, 54 + Math.floor(index / 2) * 1.5, "attack");
  run(state, 0.5);
  assert.equal(state.storms.length, 0, "연구 전에는 스톰이 없음");
  state.sides.player.research.storm = "done";
  for (const unit of state.units) if (unit.side === "enemy") { unit.x = 19 + (unit.id % 2) * 1.5; unit.y = 54; }
  stepGatewar(state);
  assert.equal(state.storms.length, 1);
  assert.ok(templar.energy < 50);
  assert.equal(state.sides.player.stats.storms, 1);
});

test("gatewar scouting reveals the enemy tech and returns the probe", () => {
  const state = quiet();
  state.sides.player.probes = 6;
  assert.equal(gwCommand(state, "player", { type: "scout" }).ok, true);
  assert.equal(state.sides.player.probes, 5);
  assert.match(gwCommand(state, "player", { type: "scout" }).reason, /정찰 중/);
  run(state, 70);
  assert.ok(state.sides.player.intel, "적 본진 정보");
  assert.equal(state.sides.player.intel.buildings.nexus, 1);
  assert.equal(state.units.some((unit) => unit.group === "scout"), false);
  assert.equal(state.sides.player.probes, 6);
  assert.ok(state.log.some((entry) => /정찰 성공/.test(entry.text)));
});

test("gatewar workers fill gas first, then the main, then the natural", () => {
  const state = quiet();
  state.sides.player.minerals = 2000;
  gwCommand(state, "player", { type: "build", building: "assimilator" });
  gwCommand(state, "player", { type: "build", building: "expand" });
  finishAll(state);
  state.sides.player.probes = 30;
  assert.deepEqual(gwWorkerSplit(state, "player"), { gas: 3, main: 16, natural: 11, idle: 0 });
  assert.ok(gwDone(gwNexus(state, "player", "natural")));
});

test("gatewar AI personas play deterministic, rule-abiding games", () => {
  const summary = (state) => JSON.stringify({
    time: state.time,
    units: state.units.map((unit) => [unit.type, Math.round(unit.x * 10), Math.round(unit.y * 10)]),
    buildings: state.buildings.map((building) => [building.side, building.type]),
  });
  const a = createGatewarGame({ seed: 11, aiSides: ["player", "enemy"], personas: { player: "dragoon", enemy: "templar" } });
  const b = createGatewarGame({ seed: 11, aiSides: ["player", "enemy"], personas: { player: "dragoon", enemy: "templar" } });
  run(a, 420, gwAiThink);
  run(b, 420, gwAiThink);
  assert.equal(summary(a), summary(b));
  for (const side of ["player", "enemy"]) {
    assert.ok(gwOwnBuildings(a, side, "gateway").length >= 2, `${side} 게이트웨이`);
    assert.ok(a.sides[side].stats.produced > 20, `${side} 소환 ${a.sides[side].stats.produced}`);
    assert.ok(a.sides[side].minerals >= 0 && a.sides[side].gas >= 0);
  }
  assert.ok(a.units.every((unit) => Number.isFinite(unit.x) && Number.isFinite(unit.y) && Number.isFinite(unit.hp)));
  const rush = createGatewarGame({ seed: 3, aiSides: ["enemy"], personas: { enemy: "rush" } });
  run(rush, 330, gwAiThink);
  assert.equal(rush.status, "over", "아무것도 안 하면 질럿 러시에 무너짐");
  assert.equal(rush.winner, "enemy");
});

test("gatewar camera fits the lane, clamps, and caps zoom", () => {
  const full = gwViewport(390, 450, { zoom: 1, cx: 0, cy: 0 });
  assert.ok(Math.abs(full.scale - 4.5) < 1e-9);
  assert.equal(full.cx, 20);
  const fill = gwFillZoom(390, 450);
  const view = gwViewport(390, 450, { zoom: fill, cx: 20, cy: 999 });
  assert.ok(Math.abs(view.scale - 390 / 40) < 1e-9);
  assert.ok(Math.abs(view.oy + 100 * view.scale - 450) < 1e-9);
  const capped = gwViewport(390, 450, { zoom: 50, cx: 20, cy: 50 });
  assert.equal(capped.zoom, GW_MAX_ZOOM);
  const center = gwScreenToMap(capped, 195, 225);
  assert.ok(Math.abs(center.x - 20) < 1e-9 && Math.abs(center.y - 50) < 1e-9);
});
