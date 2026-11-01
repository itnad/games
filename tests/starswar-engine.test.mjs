import assert from "node:assert/strict";
import test from "node:test";
import { STW_LANE_LENGTH, STW_LANE_WIDTH, STW_UNITS } from "../app/starswar/starswar-data.js";
import {
  createStarswarGame,
  stwArmy,
  stwBuildCheck,
  stwCommand,
  stwDone,
  stwHitDamage,
  stwIncome,
  stwNexus,
  stwOwnBuildings,
  stwPoint,
  stwRallyY,
  stwResearchCheck,
  stwSpawnUnitAt,
  stwSupply,
  stwWorkerSplit,
  stepStarswar,
} from "../app/starswar/starswar-engine.js";
import { stwAiThink } from "../app/starswar/starswar-ai.js";
import { STW_MAX_ZOOM, stwFillZoom, stwScreenToMap, stwViewport } from "../app/starswar/starswar-camera.js";

const run = (state, seconds, ai = null) => {
  const steps = Math.round(seconds * 10);
  for (let index = 0; index < steps && state.status === "playing"; index += 1) stepStarswar(state, ai);
};
const quiet = () => createStarswarGame({ seed: 5, aiSides: [] });
const finishAll = (state) => {
  for (const building of state.buildings) {
    building.progress = 1;
    building.hp = building.maxHp;
    building.shields = building.maxShields;
  }
};

test("starswar mirrors both bases and mines at the documented rate", () => {
  const state = quiet();
  const mine = stwNexus(state, "player", "main");
  const theirs = stwNexus(state, "enemy", "main");
  assert.equal(mine.x + theirs.x, STW_LANE_WIDTH);
  assert.equal(mine.y + theirs.y, STW_LANE_LENGTH);
  assert.deepEqual(stwPoint("enemy", { x: 5, y: 98 }), { x: 35, y: 2 });
  assert.equal(state.sides.player.minerals, 50);
  assert.equal(state.sides.player.probes, 4);
  run(state, 60);
  assert.ok(Math.abs(state.sides.player.minerals - (50 + 4 * 0.95 * 60)) < 0.01, `1분 채취 ${state.sides.player.minerals}`);
  assert.deepEqual(stwIncome(state, "player"), { minerals: 228, gas: 0 });
});

test("starswar tech tree gates buildings, units, and research", () => {
  const state = quiet();
  state.sides.player.minerals = 5000;
  state.sides.player.gas = 5000;
  assert.match(stwBuildCheck(state, "player", "gateway").reason, /파일런이 필요합니다/);
  assert.match(stwBuildCheck(state, "player", "archives").reason, /아둔의 성소가 필요합니다/);
  assert.equal(stwCommand(state, "player", { type: "build", building: "pylon" }).ok, true);
  finishAll(state);
  for (const building of ["gateway", "assimilator", "forge"]) assert.equal(stwCommand(state, "player", { type: "build", building }).ok, true, building);
  finishAll(state);
  const gateway = stwOwnBuildings(state, "player", "gateway")[0];
  assert.equal(gateway.line, "zealot", "새 게이트웨이는 질럿부터 소환");
  assert.equal(stwCommand(state, "player", { type: "line", gatewayId: gateway.id, unit: "dragoon" }).ok, true);
  assert.equal(stwCommand(state, "player", { type: "build", building: "core" }).ok, true);
  assert.match(stwCommand(state, "player", { type: "build", building: "core" }).reason, /이미 있습니다/);
  finishAll(state);
  assert.match(stwResearchCheck(state, "player", "storm").reason, /템플러 아카이브가 필요합니다/);
  assert.equal(stwCommand(state, "player", { type: "research", research: "range" }).ok, true);
  assert.match(stwResearchCheck(state, "player", "range").reason, /연구 중/);
  run(state, 46);
  assert.equal(state.sides.player.research.range, "done");

  assert.deepEqual(stwArmy(state, "player").counts, { zealot: 0, dragoon: 2, templar: 0 }, "코어 완성 후 드라군 라인 가동");
});

test("starswar production lines wait for supply and resources", () => {
  const state = quiet();
  state.sides.player.minerals = 2000;
  stwCommand(state, "player", { type: "build", building: "pylon" });
  finishAll(state);
  stwCommand(state, "player", { type: "build", building: "gateway" });
  finishAll(state);
  state.sides.player.probes = 16;
  run(state, 0.2);
  const gateway = stwOwnBuildings(state, "player", "gateway")[0];
  assert.equal(gateway.current.unit, "zealot");
  assert.deepEqual(stwSupply(state, "player"), { used: 18, cap: 18 });
  run(state, STW_UNITS.zealot.time + 0.2);
  assert.equal(stwArmy(state, "player").counts.zealot, 1);
  assert.equal(gateway.blocked, "인구 부족");
  assert.equal(stwCommand(state, "player", { type: "line", gatewayId: gateway.id, unit: "dragoon" }).ok, true);
  run(state, 0.2);
  assert.equal(gateway.blocked, "사이버네틱스 코어 필요");
});

test("starswar damage applies explosive size rules, shields, armor, and upgrades", () => {
  const state = quiet();
  const zealot = stwSpawnUnitAt(state, "player", "zealot", 20, 50);
  const dragoon = stwSpawnUnitAt(state, "player", "dragoon", 22, 50);
  const enemyZealot = stwSpawnUnitAt(state, "enemy", "zealot", 20, 40);
  const enemyDragoon = stwSpawnUnitAt(state, "enemy", "dragoon", 22, 40);
  assert.deepEqual(stwHitDamage(state, dragoon, enemyZealot), [10]);
  assert.deepEqual(stwHitDamage(state, dragoon, enemyDragoon), [20]);
  assert.deepEqual(stwHitDamage(state, zealot, enemyDragoon), [8, 8]);
  state.sides.player.research.weapons1 = "done";
  assert.deepEqual(stwHitDamage(state, zealot, enemyDragoon), [9, 9]);
  assert.deepEqual(stwHitDamage(state, dragoon, enemyDragoon), [22]);
});

test("starswar armies rally, sail out as a wave, and destroy the enemy main", () => {
  const state = quiet();
  for (let index = 0; index < 8; index += 1) stwSpawnUnitAt(state, "player", index % 2 ? "dragoon" : "zealot", 10 + index * 2, 80);
  run(state, 8);
  assert.equal(stwArmy(state, "player").rally.length, 8);
  assert.match(stwCommand(state, "player", { type: "retreat" }).reason, /공격 중인 병력이 없습니다/);
  assert.equal(stwCommand(state, "player", { type: "attack" }).ok, true);
  assert.equal(stwArmy(state, "player").attack.length, 8);
  run(state, 240);
  assert.equal(state.status, "over");
  assert.equal(state.winner, "player");
  assert.ok(state.log.some((entry) => entry.text === "대기 병력 8기가 출격합니다!"));
});

test("starswar auto waves launch when enough units gather", () => {
  const state = quiet();
  stwCommand(state, "player", { type: "autoWave", size: 6 });
  for (let index = 0; index < 5; index += 1) stwSpawnUnitAt(state, "player", "zealot", 12 + index * 3, 77);
  run(state, 3);
  assert.equal(stwArmy(state, "player").attack.length, 0);
  stwSpawnUnitAt(state, "player", "zealot", 28, 77);
  run(state, 3);
  assert.equal(stwArmy(state, "player").attack.length, 6);
});

test("starswar high templar storm hits clumps once researched", () => {
  const state = quiet();
  const templar = stwSpawnUnitAt(state, "player", "templar", 20, 60);
  templar.energy = 120;
  for (let index = 0; index < 4; index += 1) stwSpawnUnitAt(state, "enemy", "zealot", 19 + (index % 2) * 1.5, 54 + Math.floor(index / 2) * 1.5, "attack");
  run(state, 0.5);
  assert.equal(state.storms.length, 0, "연구 전에는 스톰이 없음");
  state.sides.player.research.storm = "done";
  for (const unit of state.units) if (unit.side === "enemy") { unit.x = 19 + (unit.id % 2) * 1.5; unit.y = 54; }
  stepStarswar(state);
  assert.equal(state.storms.length, 1);
  assert.ok(templar.energy < 50);
  assert.equal(state.sides.player.stats.storms, 1);
});

test("starswar scouting reveals the enemy tech and returns the probe", () => {
  const state = quiet();
  state.sides.player.probes = 6;
  assert.equal(stwCommand(state, "player", { type: "scout" }).ok, true);
  assert.equal(state.sides.player.probes, 5);
  assert.match(stwCommand(state, "player", { type: "scout" }).reason, /정찰 중/);
  run(state, 70);
  assert.ok(state.sides.player.intel, "적 본진 정보");
  assert.equal(state.sides.player.intel.buildings.nexus, 1);
  assert.equal(state.units.some((unit) => unit.group === "scout"), false);
  assert.equal(state.sides.player.probes, 6);
  assert.ok(state.log.some((entry) => /정찰 성공/.test(entry.text)));
});

test("starswar workers fill gas first, then the main, then the natural", () => {
  const state = quiet();
  state.sides.player.minerals = 2000;
  stwCommand(state, "player", { type: "build", building: "assimilator" });
  stwCommand(state, "player", { type: "build", building: "expand" });
  finishAll(state);
  state.sides.player.probes = 30;
  assert.deepEqual(stwWorkerSplit(state, "player"), { gas: 3, main: 16, natural: 11, idle: 0 });
  assert.ok(stwDone(stwNexus(state, "player", "natural")));
});

test("starswar AI personas play deterministic, rule-abiding games", () => {
  const summary = (state) => JSON.stringify({
    time: state.time,
    units: state.units.map((unit) => [unit.type, Math.round(unit.x * 10), Math.round(unit.y * 10)]),
    buildings: state.buildings.map((building) => [building.side, building.type]),
  });
  const a = createStarswarGame({ seed: 11, aiSides: ["player", "enemy"], personas: { player: "dragoon", enemy: "templar" } });
  const b = createStarswarGame({ seed: 11, aiSides: ["player", "enemy"], personas: { player: "dragoon", enemy: "templar" } });
  run(a, 420, stwAiThink);
  run(b, 420, stwAiThink);
  assert.equal(summary(a), summary(b));
  for (const side of ["player", "enemy"]) {
    assert.ok(stwOwnBuildings(a, side, "gateway").length >= 2, `${side} 게이트웨이`);
    assert.ok(a.sides[side].stats.produced > 20, `${side} 소환 ${a.sides[side].stats.produced}`);
    assert.ok(a.sides[side].minerals >= 0 && a.sides[side].gas >= 0);
  }
  assert.ok(a.units.every((unit) => Number.isFinite(unit.x) && Number.isFinite(unit.y) && Number.isFinite(unit.hp)));
  const rush = createStarswarGame({ seed: 3, aiSides: ["enemy"], personas: { enemy: "rush" } });
  run(rush, 330, stwAiThink);
  assert.equal(rush.status, "over", "아무것도 안 하면 질럿 러시에 무너짐");
  assert.equal(rush.winner, "enemy");
});

test("starswar camera fits the lane, clamps, and caps zoom", () => {
  const full = stwViewport(390, 450, { zoom: 1, cx: 0, cy: 0 });
  assert.ok(Math.abs(full.scale - 4.5) < 1e-9);
  assert.equal(full.cx, 20);
  const fill = stwFillZoom(390, 450);
  const view = stwViewport(390, 450, { zoom: fill, cx: 20, cy: 999 });
  assert.ok(Math.abs(view.scale - 390 / 40) < 1e-9);
  assert.ok(Math.abs(view.oy + 100 * view.scale - 450) < 1e-9);
  const capped = stwViewport(390, 450, { zoom: 50, cx: 20, cy: 50 });
  assert.equal(capped.zoom, STW_MAX_ZOOM);
  const center = stwScreenToMap(capped, 195, 225);
  assert.ok(Math.abs(center.x - 20) < 1e-9 && Math.abs(center.y - 50) < 1e-9);
});

test("starswar cancels buildings, probes, research, and units with the right refunds", () => {
  const state = quiet();
  const record = state.sides.player;
  record.minerals = 1000;
  record.gas = 1000;

  assert.equal(stwCommand(state, "player", { type: "probe" }).ok, true);
  assert.equal(stwCommand(state, "player", { type: "probe" }).ok, true);
  assert.equal(record.minerals, 900);
  assert.deepEqual(stwCommand(state, "player", { type: "cancelProbe" }), { ok: true, minerals: 50, gas: 0 });
  assert.equal(record.minerals, 950);
  assert.equal(stwNexus(state, "player", "main").queue.length, 1);

  assert.equal(stwCommand(state, "player", { type: "build", building: "pylon" }).ok, true);
  const pylon = state.buildings.find((building) => building.type === "pylon");
  assert.deepEqual(stwCommand(state, "player", { type: "cancelBuild", buildingId: pylon.id }), { ok: true, minerals: 75, gas: 0 });
  assert.equal(record.minerals, 925);
  assert.equal(state.buildings.some((building) => building.type === "pylon"), false);
  assert.ok(state.log.some((entry) => entry.text === "파일런을 취소했습니다. 광물 75 환불"));

  assert.equal(stwCommand(state, "player", { type: "build", building: "pylon" }).ok, true);
  finishAll(state);
  const done = state.buildings.find((building) => building.type === "pylon");
  assert.match(stwCommand(state, "player", { type: "cancelBuild", buildingId: done.id }).reason, /이미 완성/);

  for (const building of ["gateway", "forge"]) stwCommand(state, "player", { type: "build", building });
  finishAll(state);
  const before = { minerals: record.minerals, gas: record.gas };
  assert.equal(stwCommand(state, "player", { type: "research", research: "weapons1" }).ok, true);
  assert.equal(stwCommand(state, "player", { type: "cancelResearch", research: "weapons1" }).ok, true);
  assert.deepEqual({ minerals: record.minerals, gas: record.gas }, before);
  assert.equal(record.research.weapons1, undefined);
  assert.equal(stwResearchCheck(state, "player", "weapons1").ok, true, "취소한 연구는 다시 할 수 있음");

  const gateway = stwOwnBuildings(state, "player", "gateway")[0];
  run(state, 0.2);
  assert.equal(gateway.current.unit, "zealot");
  const beforeUnit = record.minerals;
  assert.equal(stwCommand(state, "player", { type: "cancelUnit", gatewayId: gateway.id }).ok, true);
  assert.equal(record.minerals, beforeUnit + 100);
  assert.equal(gateway.current, null);
  assert.equal(gateway.line, null, "취소 후 라인은 정지");
  run(state, 1);
  assert.equal(gateway.current, null, "정지한 라인은 다시 소환하지 않음");
  assert.match(stwCommand(state, "player", { type: "cancelUnit", gatewayId: gateway.id }).reason, /소환 중인 유닛이 없습니다/);
});

test("starswar rally units automatically defend buildings from flanking attackers", () => {
  const state = quiet();
  state.sides.player.minerals = 2000;
  stwCommand(state, "player", { type: "build", building: "pylon" });
  finishAll(state);
  stwCommand(state, "player", { type: "build", building: "gateway" });
  finishAll(state);
  const gateway = stwOwnBuildings(state, "player", "gateway")[0];
  stwCommand(state, "player", { type: "line", gatewayId: gateway.id, unit: null });
  const defenders = [0, 1, 2, 3].map((index) => stwSpawnUnitAt(state, "player", "zealot", 16 + index * 2.7, 79));
  const raider = stwSpawnUnitAt(state, "enemy", "zealot", gateway.x + 2, gateway.y - 3, "attack");
  run(state, 30);
  assert.ok(raider.hp <= 0 || !state.units.includes(raider), "옆으로 들어온 적을 요격");
  assert.ok(gateway.hp + gateway.shields > (gateway.maxHp + gateway.maxShields) * 0.8, "건물이 거의 피해 없이 버팀");
  assert.ok(state.log.some((entry) => entry.text === "대기 병력이 기지에 들어온 적을 요격합니다."));
  run(state, 15);
  const rallyY = stwRallyY("player", "main");
  assert.ok(defenders.every((unit) => Math.abs(unit.y - rallyY) < 6), "처리 후 집결지로 복귀");

  const scout = stwSpawnUnitAt(state, "enemy", "probe", 34, 93, "scout");
  scout.scoutPhase = "back";
  run(state, 2);
  assert.ok(defenders.every((unit) => Math.abs(unit.y - rallyY) < 6), "정찰 프로브 하나에 전군이 끌려가지 않음");
});

test("starswar recall pulls attacking units out of a fight to any position", () => {
  const state = quiet();
  const attackers = [0, 1, 2, 3, 4, 5].map((index) => stwSpawnUnitAt(state, "player", "dragoon", 12 + index * 3, 30, "attack"));
  for (let index = 0; index < 4; index += 1) stwSpawnUnitAt(state, "enemy", "zealot", 14 + index * 3, 24);
  run(state, 2);
  assert.ok(attackers.some((unit) => unit.targetId !== null), "적진에서 교전 중");
  assert.match(stwCommand(state, "player", { type: "recall", point: "nowhere" }).reason, /알 수 없는 위치/);
  assert.deepEqual(stwCommand(state, "player", { type: "recall", point: "natural" }), { ok: true, recalled: 6 });
  assert.equal(state.sides.player.rally, "natural");
  assert.equal(stwArmy(state, "player").attack.length, 0);
  run(state, 1);
  const alive = state.units.filter((unit) => attackers.includes(unit));
  assert.ok(alive.every((unit) => unit.targetId === null), "후퇴 중에는 싸우지 않음");
  run(state, 25);
  const rallyY = stwRallyY("player", "natural");
  assert.ok(alive.length >= 4, `살아 돌아온 드라군 ${alive.length}`);
  assert.ok(alive.every((unit) => Math.abs(unit.y - rallyY) < 7), "앞마당 집결지에 도착");
  assert.ok(state.log.some((entry) => /^전군 6기가 앞마당으로 물러나 수비합니다\.$/.test(entry.text)));
});
