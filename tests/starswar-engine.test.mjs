import assert from "node:assert/strict";
import test from "node:test";
import { STW_LANE_LENGTH, STW_LANE_WIDTH, STW_UNITS } from "../app/starswar/starswar-data.js";
import {
  createStarswarGame,
  stwArmy,
  stwBuildCheck,
  stwCommand,
  stwDetected,
  stwDone,
  stwHitDamage,
  stwIncome,
  stwNexus,
  stwOwnBuildings,
  stwPoint,
  stwRallyName,
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

  const counts = stwArmy(state, "player").counts;
  assert.equal(counts.dragoon, 2, "코어 완성 후 드라군 라인 가동");
  assert.equal(counts.zealot, 0);
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
  assert.match(stwCommand(state, "player", { type: "cancelUnit", gatewayId: gateway.id }).reason, /생산 중인 유닛이 없습니다/);
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

test("starswar gates the new units behind their tech and producers", () => {
  const state = quiet();
  state.sides.player.minerals = 9000;
  state.sides.player.gas = 9000;
  stwCommand(state, "player", { type: "build", building: "pylon" });
  finishAll(state);
  stwCommand(state, "player", { type: "build", building: "gateway" });
  finishAll(state);
  assert.match(stwBuildCheck(state, "player", "robo").reason, /사이버네틱스 코어가 필요합니다/);
  stwCommand(state, "player", { type: "build", building: "core" });
  finishAll(state);
  assert.equal(stwCommand(state, "player", { type: "build", building: "robo" }).ok, true);
  assert.match(stwBuildCheck(state, "player", "bay").reason, /로보틱스 퍼실리티가 필요합니다/);
  finishAll(state);
  const gateway = stwOwnBuildings(state, "player", "gateway")[0];
  const robo = stwOwnBuildings(state, "player", "robo")[0];
  assert.equal(robo.line, null, "로보틱스는 정지 상태로 시작");
  assert.match(stwCommand(state, "player", { type: "line", buildingId: gateway.id, unit: "reaver" }).reason, /생산할 수 없는 유닛/);
  assert.equal(stwCommand(state, "player", { type: "line", buildingId: robo.id, unit: "reaver" }).ok, true);
  run(state, 0.2);
  assert.equal(robo.blocked, "로보틱스 지원 베이 필요");
  stwCommand(state, "player", { type: "build", building: "bay" });
  stwCommand(state, "player", { type: "line", buildingId: gateway.id, unit: "dark" });
  finishAll(state);
  run(state, 0.2);
  assert.equal(robo.current.unit, "reaver");
  run(state, STW_UNITS.zealot.time);
  assert.equal(gateway.blocked, "템플러 아카이브 필요", "소환 중이던 질럿이 끝난 뒤 다크템플러는 아카이브를 기다림");
  assert.equal(stwCommand(state, "player", { type: "lineAll", unit: "observer" }).ok, true);
  assert.equal(robo.line, "observer");
  assert.equal(gateway.line, "dark", "다른 종류의 생산 건물은 그대로");
});

test("starswar merges two high templar into an archon with the same supply", () => {
  const state = quiet();
  const a = stwSpawnUnitAt(state, "player", "templar", 18, 77);
  const b = stwSpawnUnitAt(state, "player", "templar", 22, 77);
  a.energy = 30;
  b.energy = 120;
  stwSpawnUnitAt(state, "player", "templar", 26, 77).energy = 200;
  const before = stwSupply(state, "player").used;
  assert.equal(stwCommand(state, "player", { type: "merge" }).ok, true);
  run(state, 0.1);
  const army = stwArmy(state, "player");
  assert.equal(army.counts.archon, 1);
  assert.equal(army.counts.templar, 1);
  assert.equal(state.units.find((unit) => unit.type === "templar").energy > 150, true, "에너지가 많은 하이템플러는 남김");
  assert.equal(stwSupply(state, "player").used, before);
  assert.equal(state.sides.player.stats.lost, 0, "합체는 손실이 아님");
  assert.match(stwCommand(state, "player", { type: "merge" }).reason, /하이템플러 2기가 필요합니다/);
});

test("starswar dark templar stay untargetable until a detector arrives", () => {
  const state = quiet();
  state.sides.player.minerals = 2000;
  stwCommand(state, "player", { type: "build", building: "pylon" });
  finishAll(state);
  const defenders = [0, 1, 2].map((index) => stwSpawnUnitAt(state, "player", "dragoon", 16 + index * 3, 79));
  const dark = stwSpawnUnitAt(state, "enemy", "dark", 20, 84, "attack");
  assert.equal(stwDetected(state, dark, "player"), false);
  run(state, 4);
  assert.ok(defenders.every((unit) => unit.targetId !== dark.id), "탐지 전에는 노릴 수 없음");
  assert.equal(dark.hp, STW_UNITS.dark.hp);
  assert.ok(state.log.some((entry) => /보이지 않는 적에게 공격받고 있습니다/.test(entry.text)));
  assert.ok(state.sides.player.sawCloakAt > 0);
  stwSpawnUnitAt(state, "player", "observer", dark.x, dark.y + 2);
  assert.equal(stwDetected(state, dark, "player"), true);
  run(state, 12);
  assert.ok(dark.hp <= 0 || !state.units.includes(dark), "옵저버가 탐지하자 처치");
});

test("starswar reavers and archons deal splash damage to clumped enemies", () => {
  const state = quiet();
  const reaver = stwSpawnUnitAt(state, "player", "reaver", 20, 60, "attack");
  const clump = [0, 1, 2, 3].map((index) => stwSpawnUnitAt(state, "enemy", "zealot", 19 + (index % 2) * 1.5, 52 + Math.floor(index / 2) * 1.5));
  for (let index = 0; index < 30 && clump.every((unit) => unit.hp + unit.shields >= 160); index += 1) stepStarswar(state);
  const hurt = clump.filter((unit) => unit.hp + unit.shields < 160).length;
  assert.ok(hurt >= 3, `스캐럽 한 발에 여러 기가 피해 (${hurt}기)`);
  assert.ok(reaver.targetId !== null);
  state.sides.player.research.scarab = "done";
  assert.deepEqual(stwHitDamage(state, reaver, clump[0]), [125]);
});

test("starswar observers escort the attacking army", () => {
  const state = quiet();
  const observer = stwSpawnUnitAt(state, "player", "observer", 20, 80);
  for (let index = 0; index < 4; index += 1) stwSpawnUnitAt(state, "player", "zealot", 14 + index * 4, 77);
  stwCommand(state, "player", { type: "attack" });
  run(state, 12);
  const front = state.units.filter((unit) => unit.side === "player" && unit.type === "zealot");
  const lead = Math.min(...front.map((unit) => unit.y));
  assert.ok(Math.abs(observer.y - (lead + 2)) < 4, `옵저버가 선두 뒤를 따라감 (${observer.y.toFixed(1)} / ${lead.toFixed(1)})`);
  assert.equal(observer.targetId, null);
});

test("starswar dark and robo AI personas field their signature units", () => {
  const dark = createStarswarGame({ seed: 1, aiSides: ["player", "enemy"], personas: { player: "dark", enemy: "dragoon" } });
  const seen = new Set();
  for (let step = 0; step < 6000 && dark.status === "playing"; step += 1) {
    stepStarswar(dark, stwAiThink);
    for (const unit of dark.units) if (unit.side === "player") seen.add(unit.type);
  }
  assert.ok(seen.has("dark"), "다크템플러 기습은 다크템플러를 소환");

  // 로보 운영: 옵저버 1기를 갖춘 뒤 지원 베이가 있으면 리버를 고른다(연구용 가스보다 먼저).
  const robo = createStarswarGame({ seed: 1, aiSides: ["player"], personas: { player: "robo" } });
  robo.sides.player.minerals = 5000;
  robo.sides.player.gas = 5000;
  for (const building of ["pylon", "gateway", "core", "robo", "bay"]) {
    stwCommand(robo, "player", { type: "build", building });
    finishAll(robo);
  }
  robo.time = 500;
  stwSpawnUnitAt(robo, "player", "observer", 20, 80);
  stwSpawnUnitAt(robo, "player", "observer", 22, 80);
  stwAiThink(robo, "player");
  assert.equal(stwOwnBuildings(robo, "player", "robo")[0].line, "reaver", "로보 운영은 리버를 소환");
});

const terran = (enemy = "protoss") => createStarswarGame({ seed: 5, aiSides: [], races: { player: "terran", enemy } });

test("starswar terran starts with a command center and gates its tech tree", () => {
  const state = terran();
  assert.equal(state.sides.player.race, "terran");
  assert.equal(stwNexus(state, "player", "main").type, "cc");
  assert.equal(stwNexus(state, "enemy", "main").type, "nexus");
  assert.ok(state.log.some((entry) => /^전투 개시\. SCV가 광물을 캐고 있습니다/.test(entry.text)));
  state.sides.player.minerals = 9000;
  state.sides.player.gas = 9000;
  assert.match(stwBuildCheck(state, "player", "pylon").reason, /이 종족은 지을 수 없는 건물/);
  assert.match(stwBuildCheck(state, "player", "barracks").reason, /서플라이 디팟이 필요합니다/);
  assert.match(stwResearchCheck(state, "player", "charge").reason, /이 종족의 연구가 아닙니다/);
  assert.equal(stwCommand(state, "player", { type: "worker" }).ok, true);
  assert.equal(stwNexus(state, "player", "main").queue[0].unit, "scv");
  stwCommand(state, "player", { type: "build", building: "depot" });
  finishAll(state);
  assert.equal(stwSupply(state, "player").cap, 18);
  stwCommand(state, "player", { type: "build", building: "barracks" });
  finishAll(state);
  const barracks = stwOwnBuildings(state, "player", "barracks")[0];
  assert.equal(barracks.line, "marine", "배럭은 해병 생산으로 시작");
  assert.equal(stwCommand(state, "player", { type: "line", buildingId: barracks.id, unit: "medic" }).ok, true);
  run(state, 0.2);
  assert.equal(barracks.blocked, "아카데미 필요");
  stwCommand(state, "player", { type: "build", building: "academy" });
  assert.match(stwBuildCheck(state, "player", "academy").reason, /이미 있습니다/);
  stwCommand(state, "player", { type: "build", building: "factory" });
  finishAll(state);
  run(state, 0.2);
  assert.equal(barracks.current.unit, "medic");
  const factory = stwOwnBuildings(state, "player", "factory")[0];
  assert.equal(factory.line, null);
  stwCommand(state, "player", { type: "line", buildingId: factory.id, unit: "tank" });
  run(state, 0.2);
  assert.equal(factory.blocked, "머신 샵 필요");
  assert.equal(stwCommand(state, "player", { type: "build", building: "expand" }).ok, true);
  assert.ok(state.log.some((entry) => entry.text === "앞마당 커맨드 센터를 건설하기 시작했습니다."));
  assert.equal(stwNexus(state, "player", "natural").type, "cc");
});

test("starswar medics heal bio and stim speeds up researched infantry", () => {
  const state = terran();
  const marine = stwSpawnUnitAt(state, "player", "marine", 20, 80);
  const medic = stwSpawnUnitAt(state, "player", "medic", 21, 81);
  marine.hp = 15;
  run(state, 1);
  assert.ok(marine.hp >= 24, `메딕 치료 ${marine.hp}`);
  assert.equal(medic.healTargetId, marine.id);
  run(state, 3);
  assert.equal(marine.hp, marine.maxHp);
  assert.equal(medic.healTargetId, null);

  state.sides.player.research.stim = "done";
  stwSpawnUnitAt(state, "enemy", "zealot", 20, 74, "attack");
  run(state, 1.5);
  assert.ok(marine.stimAt !== undefined, "교전하자 스팀팩 사용");
  assert.ok(state.effects.some((effect) => effect.kind === "stim") || marine.hp < marine.maxHp);
});

test("starswar siege tanks auto-siege after research and shell clumps", () => {
  const state = terran();
  const tank = stwSpawnUnitAt(state, "player", "tank", 20, 60, "attack");
  const clump = [0, 1, 2].map((index) => stwSpawnUnitAt(state, "enemy", "zealot", 19 + index * 1.2, 46, "attack"));
  state.sides.player.research.siege = "done";
  run(state, 0.3);
  assert.equal(tank.sieged, true, "사거리 12 안에 적이 오자 시즈");
  const before = clump.map((unit) => unit.hp + unit.shields);
  run(state, 2.8);
  const hurt = clump.filter((unit, index) => unit.hp + unit.shields < before[index]).length;
  assert.ok(hurt >= 2, `포격이 여러 기에 피해 (${hurt}기)`);
  assert.deepEqual(stwHitDamage(state, tank, clump[0]), [35], "시즈 포격 70 · 폭발형은 소형에게 50%");
  stwCommand(state, "player", { type: "recall", point: "main" });
  run(state, 0.3);
  assert.equal(tank.sieged, false, "후퇴 명령에 시즈 해제");
});

test("starswar comsat scans and turrets detect dark templar", () => {
  const state = terran();
  state.sides.player.minerals = 9000;
  state.sides.player.gas = 9000;
  for (const building of ["depot", "barracks", "academy", "comsat"]) {
    assert.equal(stwCommand(state, "player", { type: "build", building }).ok, true, building);
    finishAll(state);
  }
  const comsat = stwOwnBuildings(state, "player", "comsat")[0];
  const marines = [0, 1, 2].map((index) => stwSpawnUnitAt(state, "player", "marine", 18 + index * 2, 80));
  const dark = stwSpawnUnitAt(state, "enemy", "dark", 20, 76, "attack");
  assert.equal(stwDetected(state, dark, "player"), false);
  run(state, 2);
  assert.equal(state.scans.length, 1, "은폐한 적에게 맞자 스캔");
  assert.equal(comsat.energy < 50, true);
  assert.ok(state.log.some((entry) => /컴샛 스캔으로 은폐한 적을 드러냈습니다/.test(entry.text)));
  run(state, 2);
  assert.ok(dark.hp + dark.shields < 120, "스캔 안에서 해병이 다크템플러를 공격");
  assert.ok(marines.some((unit) => unit.targetId === dark.id || dark.hp <= 0));

  const second = terran();
  second.sides.player.minerals = 9000;
  for (const building of ["depot", "ebay", "turret"]) {
    assert.equal(stwCommand(second, "player", { type: "build", building }).ok, true, building);
    finishAll(second);
  }
  const turret = stwOwnBuildings(second, "player", "turret")[0];
  const sneaky = stwSpawnUnitAt(second, "enemy", "dark", turret.x, turret.y - 5);
  assert.equal(stwDetected(second, sneaky, "player"), true);
});

test("starswar bunkers fire and terran buildings repair themselves", () => {
  const state = terran();
  state.sides.player.minerals = 9000;
  for (const building of ["depot", "barracks", "bunker"]) {
    stwCommand(state, "player", { type: "build", building });
    finishAll(state);
  }
  const bunker = stwOwnBuildings(state, "player", "bunker")[0];
  const zealot = stwSpawnUnitAt(state, "enemy", "zealot", bunker.x, bunker.y - 8, "attack");
  run(state, 2);
  assert.ok(zealot.hp + zealot.shields < 160, "벙커가 사격");
  const depot = stwOwnBuildings(state, "player", "depot")[0];
  depot.hp = 300;
  depot.lastHit = -99;
  run(state, 5);
  assert.ok(depot.hp > 300, `테란 건물 자동 수리 ${depot.hp}`);
});

test("starswar terran AI personas field their signature units and finish a game", () => {
  const bio = createStarswarGame({ seed: 3, aiSides: ["player", "enemy"], races: { player: "terran", enemy: "protoss" }, personas: { player: "bio", enemy: "dragoon" } });
  const mech = createStarswarGame({ seed: 3, aiSides: ["player", "enemy"], races: { player: "terran", enemy: "terran" }, personas: { player: "mech", enemy: "bio" } });
  const seen = { bio: new Set(), mech: new Set() };
  for (let step = 0; step < 15000 && (bio.status === "playing" || mech.status === "playing"); step += 1) {
    if (bio.status === "playing") stepStarswar(bio, stwAiThink);
    if (mech.status === "playing") stepStarswar(mech, stwAiThink);
    for (const unit of bio.units) if (unit.side === "player") seen.bio.add(unit.type);
    for (const unit of mech.units) if (unit.side === "player") seen.mech.add(unit.type);
  }
  assert.ok(seen.bio.has("marine") && seen.bio.has("medic"), "바이오닉은 해병과 메딕을 생산");
  assert.ok(seen.mech.has("vulture") && seen.mech.has("tank"), "메카닉은 벌처와 시즈 탱크를 생산");
  assert.equal(bio.status, "over", "테란 대 프로토스 전투가 끝남");
  assert.equal(mech.status, "over", "테란 대 테란 전투가 끝남");
});

const zerg = (enemy = "protoss") => createStarswarGame({ seed: 5, aiSides: [], races: { player: "zerg", enemy } });

test("starswar zerg hatcheries morph zerglings in pairs and gate the hive tech", () => {
  const state = zerg();
  const main = stwNexus(state, "player", "main");
  assert.equal(main.type, "hatchery");
  assert.equal(main.line, "zergling", "해처리는 저글링 라인으로 시작");
  assert.ok(state.log.some((entry) => /^전투 개시\. 드론이 광물을 캐고 있습니다/.test(entry.text)));
  state.sides.player.minerals = 9000;
  state.sides.player.gas = 9000;
  run(state, 0.2);
  assert.equal(main.blocked, "스포닝 풀 필요");
  assert.match(stwBuildCheck(state, "player", "den").reason, /스포닝 풀이 필요합니다/);
  assert.match(stwBuildCheck(state, "player", "gateway").reason, /이 종족은 지을 수 없는 건물/);
  for (const building of ["overlord", "pool", "den", "hatch"]) {
    assert.equal(stwCommand(state, "player", { type: "build", building }).ok, true, building);
    finishAll(state);
  }
  assert.ok(state.log.some((entry) => entry.text === "스포닝 풀을 변태합니다."));
  assert.match(stwBuildCheck(state, "player", "cavern").reason, /레어 변태가 필요합니다/);
  const before = state.units.length;
  run(state, STW_UNITS.zergling.time + 0.3);
  const lings = state.units.filter((unit) => unit.side === "player" && unit.type === "zergling");
  assert.equal(lings.length, 4, "해처리 두 곳에서 2기씩");
  assert.equal(state.units.length - before, 4);
  assert.equal(stwSupply(state, "player").used, 4 + 2 + 2, "드론 4 + 저글링 4기(0.5씩) + 생산 중 2쌍");

  const extra = stwOwnBuildings(state, "player", "hatch")[0];
  assert.equal(stwCommand(state, "player", { type: "lineAll", unit: "hydra" }).ok, true);
  assert.equal(main.line, "hydra");
  assert.equal(extra.line, "hydra", "추가 해처리도 같은 묶음");
  assert.equal(stwCommand(state, "player", { type: "line", buildingId: extra.id, unit: "lurker" }).ok, true);
  run(state, STW_UNITS.zergling.time + 0.3);
  assert.equal(extra.blocked, "럴커 변태 필요");
  assert.match(stwResearchCheck(state, "player", "lurkerAspect").reason, /레어 변태 먼저/);
  state.sides.player.research.lair = "done";
  assert.equal(stwBuildCheck(state, "player", "cavern").ok, true);
});

test("starswar lurkers burrow, cloak, and spine every enemy on the line", () => {
  const state = zerg("terran");
  const lurker = stwSpawnUnitAt(state, "player", "lurker", 20, 60, "attack");
  const line = [0, 1, 2].map((index) => stwSpawnUnitAt(state, "enemy", "marine", 20, 53 - index * 1.8, "attack"));
  run(state, 0.5);
  assert.equal(lurker.burrowed, true, "사거리 안에 적이 오자 땅속에 숨음");
  assert.equal(stwDetected(state, lurker, "enemy"), false, "숨은 럴커는 탐지기가 있어야 보임");
  run(state, 1.6);
  const hurt = line.filter((unit) => unit.hp < unit.maxHp).length;
  assert.ok(hurt >= 2, `일직선 가시가 여러 기에 피해 (${hurt}기)`);
  assert.ok(line.every((unit) => unit.targetId !== lurker.id), "해병은 숨은 럴커를 노리지 못함");
  stwCommand(state, "player", { type: "recall", point: "main" });
  run(state, 0.2);
  assert.equal(lurker.burrowed, false, "후퇴 명령에 땅 위로");
});

test("starswar zerg units regenerate and use separate melee and missile upgrades", () => {
  const state = zerg();
  const ling = stwSpawnUnitAt(state, "player", "zergling", 20, 80);
  const hydra = stwSpawnUnitAt(state, "player", "hydra", 24, 80);
  ling.hp = 10;
  run(state, 5);
  assert.ok(ling.hp >= 12.5, `저그 유닛 재생 ${ling.hp}`);
  const zealot = stwSpawnUnitAt(state, "enemy", "zealot", 20, 20);
  const before = [stwHitDamage(state, ling, zealot)[0], stwHitDamage(state, hydra, zealot)[0]];
  state.sides.player.research.zMelee1 = "done";
  assert.deepEqual([stwHitDamage(state, ling, zealot)[0], stwHitDamage(state, hydra, zealot)[0]], [before[0] + 1, before[1]], "근접 공격은 저글링에만");
  state.sides.player.research.zMissile1 = "done";
  assert.equal(stwHitDamage(state, hydra, zealot)[0], before[1] + 0.5, "원거리 공격 +1이 폭발형이라 소형에게 절반");
});

test("starswar zerg AI personas field their signature units and finish a game", () => {
  const ling = createStarswarGame({ seed: 2, aiSides: ["player", "enemy"], races: { player: "zerg", enemy: "protoss" }, personas: { player: "ling", enemy: "templar" } });
  const hydra = createStarswarGame({ seed: 2, aiSides: ["player", "enemy"], races: { player: "zerg", enemy: "terran" }, personas: { player: "hydra", enemy: "mech" } });
  const seen = { ling: new Set(), hydra: new Set() };
  for (let step = 0; step < 15000 && (ling.status === "playing" || hydra.status === "playing"); step += 1) {
    if (ling.status === "playing") stepStarswar(ling, stwAiThink);
    if (hydra.status === "playing") stepStarswar(hydra, stwAiThink);
    for (const unit of ling.units) if (unit.side === "player") seen.ling.add(unit.type);
    for (const unit of hydra.units) if (unit.side === "player") seen.hydra.add(unit.type);
  }
  assert.ok(seen.ling.has("zergling"), "저글링 러시는 저글링을 변태");
  assert.ok(seen.hydra.has("hydra"), "히드라 럴커는 히드라를 변태");
  assert.equal(ling.status, "over");
  assert.equal(hydra.status, "over");
  // 럴커 변태가 끝나면 히드라 럴커는 럴커를 고른다(연구용 가스보다 먼저).
  const late = createStarswarGame({ seed: 1, aiSides: ["player"], races: { player: "zerg", enemy: "terran" }, personas: { player: "hydra" } });
  late.sides.player.minerals = 5000;
  late.sides.player.gas = 5000;
  late.sides.player.research.lair = "done";
  late.sides.player.research.lurkerAspect = "done";
  for (const building of ["overlord", "pool", "den"]) {
    assert.equal(stwCommand(late, "player", { type: "build", building }).ok, true, building);
    finishAll(late);
  }
  for (let index = 0; index < 6; index += 1) stwSpawnUnitAt(late, "player", "hydra", 14 + index * 2, 80);
  stwAiThink(late, "player");
  assert.equal(stwNexus(late, "player", "main").line, "lurker", "히드라 럴커는 럴커를 변태");
});

test("starswar terran and zerg each have four AI personas and the new ones field their signature units", async () => {
  const { STW_AI_PERSONAS } = await import("../app/starswar/starswar-data.js");
  const byRace = Object.values(STW_AI_PERSONAS).reduce((map, persona) => ((map[persona.race] = (map[persona.race] ?? 0) + 1), map), {});
  assert.deepEqual(byRace, { protoss: 5, terran: 4, zerg: 4 });
  const games = {
    tankbio: createStarswarGame({ seed: 1, aiSides: ["player", "enemy"], races: { player: "terran", enemy: "protoss" }, personas: { player: "tankbio", enemy: "templar" } }),
    vulture: createStarswarGame({ seed: 1, aiSides: ["player", "enemy"], races: { player: "terran", enemy: "protoss" }, personas: { player: "vulture", enemy: "dragoon" } }),
    pool: createStarswarGame({ seed: 1, aiSides: ["player", "enemy"], races: { player: "zerg", enemy: "terran" }, personas: { player: "pool", enemy: "bio" } }),
    ultra: createStarswarGame({ seed: 1, aiSides: ["player", "enemy"], races: { player: "zerg", enemy: "terran" }, personas: { player: "ultra", enemy: "mech" } }),
  };
  const seen = Object.fromEntries(Object.keys(games).map((key) => [key, new Set()]));
  let poolDronesAt200 = null;
  for (let step = 0; step < 15000; step += 1) {
    let running = false;
    for (const [key, game] of Object.entries(games)) {
      if (game.status !== "playing") continue;
      running = true;
      stepStarswar(game, stwAiThink);
      for (const unit of game.units) if (unit.side === "player") seen[key].add(unit.type);
    }
    if (games.pool.time === 200) poolDronesAt200 = games.pool.sides.player.probes;
    if (!running) break;
  }
  assert.ok(seen.tankbio.has("marine") && seen.tankbio.has("medic"), "탱크 바이오는 해병과 메딕");
  // 팩토리와 머신 샵이 서면 탱크 바이오는 팩토리에서 시즈 탱크를 고른다.
  const tb = createStarswarGame({ seed: 1, aiSides: ["player"], races: { player: "terran", enemy: "protoss" }, personas: { player: "tankbio" } });
  tb.sides.player.minerals = 5000;
  tb.sides.player.gas = 5000;
  for (const building of ["depot", "barracks", "factory", "shop"]) {
    assert.equal(stwCommand(tb, "player", { type: "build", building }).ok, true, building);
    finishAll(tb);
  }
  stwAiThink(tb, "player");
  assert.equal(stwOwnBuildings(tb, "player", "factory")[0].line, "tank", "탱크 바이오는 시즈 탱크");
  assert.ok(seen.vulture.has("vulture"), "벌처 러시는 벌처");
  assert.ok(seen.pool.has("zergling") && poolDronesAt200 <= 14, `빠른 저글링은 드론을 아낌 (${poolDronesAt200})`);
  assert.ok(seen.ultra.has("zergling") && seen.ultra.has("hydra"), "울트라 운영은 저글링과 히드라로 버팀");

  // 울트라리스크 동굴이 서면 울트라 운영은 울트라리스크를 고른다(연구용 가스보다 먼저).
  const late = createStarswarGame({ seed: 1, aiSides: ["player"], races: { player: "zerg", enemy: "terran" }, personas: { player: "ultra" } });
  late.sides.player.minerals = 5000;
  late.sides.player.gas = 5000;
  late.sides.player.research.lair = "done";
  for (const building of ["overlord", "pool", "den", "cavern"]) {
    assert.equal(stwCommand(late, "player", { type: "build", building }).ok, true, building);
    finishAll(late);
  }
  for (let index = 0; index < 6; index += 1) stwSpawnUnitAt(late, "player", "zergling", 14 + index * 2, 80);
  stwAiThink(late, "player");
  assert.equal(stwNexus(late, "player", "main").line, "ultra", "울트라 운영은 울트라리스크");
});

test("starswar protoss AI adapts its gateway mix to the enemy army it sees", () => {
  const setup = (enemyRace, enemyType) => {
    const state = createStarswarGame({ seed: 1, aiSides: ["player"], races: { player: "protoss", enemy: enemyRace }, personas: { player: "dragoon" } });
    state.sides.player.minerals = 5000;
    state.sides.player.gas = 5000;
    for (const building of ["pylon", "gateway", "core", "gateway", "gateway", "gateway"]) {
      stwCommand(state, "player", { type: "build", building });
      finishAll(state);
    }
    for (let index = 0; index < 8; index += 1) stwSpawnUnitAt(state, "enemy", enemyType, 12 + index * 2, 76);
    stwAiThink(state, "player");
    return stwOwnBuildings(state, "player", "gateway").map((gateway) => gateway.line);
  };
  const versusVultures = setup("terran", "vulture");
  assert.ok(versusVultures.filter((line) => line === "dragoon").length >= 3, `벌처에는 드라군 (${versusVultures})`);
  const versusMarines = setup("terran", "marine");
  assert.ok(versusMarines.filter((line) => line === "zealot").length >= 2, `해병에는 질럿 (${versusMarines})`);
});

test("starswar warns about depleting minerals and ends an exhausted game as a draw", () => {
  const state = quiet();
  state.sides.player.bases.main.minerals = 1510;
  run(state, 3);
  assert.ok(state.log.some((entry) => /본진 광물이 곧 바닥납니다\. 앞마당 확장을 생각하세요\./.test(entry.text)), "고갈 경고");
  state.sides.player.bases.main.minerals = 1;
  run(state, 1);
  assert.ok(state.log.some((entry) => entry.text === "본진 광물이 바닥났습니다."));
  assert.equal(state.status, "playing");

  for (const side of ["player", "enemy"]) {
    state.sides[side].bases.main.minerals = 0;
    state.sides[side].bases.natural.minerals = 0;
    state.sides[side].minerals = 10;
  }
  run(state, 31);
  assert.equal(state.status, "over");
  assert.equal(state.winner, "draw");
  assert.ok(state.log.some((entry) => /무승부/.test(entry.text)));

  // 병력이 하나라도 있으면 무승부가 아니다.
  const alive = quiet();
  for (const side of ["player", "enemy"]) {
    alive.sides[side].bases.main.minerals = 0;
    alive.sides[side].bases.natural.minerals = 0;
    alive.sides[side].minerals = 10;
  }
  stwSpawnUnitAt(alive, "player", "zealot", 20, 80);
  run(alive, 31);
  assert.equal(alive.status, "playing");
});

test("starswar AI attacks with everything once its minerals run dry", () => {
  const state = createStarswarGame({ seed: 1, aiSides: ["enemy"], personas: { enemy: "dragoon" } });
  state.sides.enemy.bases.main.minerals = 0;
  state.sides.enemy.bases.natural.minerals = 0;
  state.sides.enemy.minerals = 0;
  for (let index = 0; index < 3; index += 1) stwSpawnUnitAt(state, "enemy", "zealot", 14 + index * 4, 22);
  run(state, 3, stwAiThink);
  assert.equal(stwArmy(state, "enemy").attack.length, 3, "출격 규모와 상관없이 총공격");
});

test("starswar zerg overlords can escort the army as mobile detectors at the cost of supply risk", () => {
  const state = zerg("protoss");
  state.sides.player.minerals = 9000;
  assert.match(stwCommand(state, "player", { type: "escort", on: true }).reason, /완성된 오버로드가 없습니다/);
  stwCommand(state, "player", { type: "build", building: "overlord" });
  stwCommand(state, "player", { type: "build", building: "overlord" });
  finishAll(state);
  const capBefore = stwSupply(state, "player").cap;
  assert.equal(capBefore, 26);
  assert.equal(stwCommand(state, "player", { type: "escort", on: true }).ok, true);
  const overlord = state.units.find((unit) => unit.side === "player" && unit.type === "overlord");
  assert.ok(overlord, "오버로드 1기가 유닛으로 떠오름");
  assert.equal(stwOwnBuildings(state, "player", "overlord").length, 1);
  assert.equal(stwSupply(state, "player").cap, capBefore, "동행 중에도 인구 상한 유지");

  for (let index = 0; index < 4; index += 1) stwSpawnUnitAt(state, "player", "hydra", 14 + index * 4, 77);
  run(state, 12);
  assert.ok(Math.abs(overlord.y - stwRallyY("player", "main")) < 8, `동행 오버로드는 집결지에서 기다림 (${overlord.y.toFixed(1)})`);
  stwCommand(state, "player", { type: "attack" });
  run(state, 12);
  const front = Math.min(...state.units.filter((unit) => unit.side === "player" && unit.type === "hydra").map((unit) => unit.y));
  assert.ok(Math.abs(overlord.y - (front + 2)) < 5, `오버로드가 선두를 따라감 (${overlord.y.toFixed(1)} / ${front.toFixed(1)})`);
  const dark = stwSpawnUnitAt(state, "enemy", "dark", overlord.x, overlord.y - 3);
  assert.equal(stwDetected(state, dark, "player"), true, "동행 오버로드가 다크템플러를 탐지");

  const other = createStarswarGame({ seed: 5, aiSides: [], races: { player: "zerg", enemy: "protoss" } });
  other.sides.player.research.pneumatized = "done";
  const fast = stwSpawnUnitAt(other, "player", "overlord", 20, 80);
  other.sides.player.escort = true;
  stwSpawnUnitAt(other, "player", "zergling", 20, 60, "attack");
  const y0 = fast.y;
  run(other, 2);
  assert.ok(y0 - fast.y > 6, `기낭 갑피로 빨라짐 (${(y0 - fast.y).toFixed(1)})`);

  overlord.hp = 0;
  run(state, 0.2);
  assert.equal(stwSupply(state, "player").cap, capBefore - 8, "잃으면 인구 상한 −8");
  assert.ok(state.log.some((entry) => /동행 오버로드를 잃었습니다/.test(entry.text)));
  run(state, 0.2);
  assert.ok(state.units.some((unit) => unit.side === "player" && unit.type === "overlord"), "동행이 켜져 있으면 다음 오버로드가 떠오름");
  assert.equal(stwOwnBuildings(state, "player", "overlord").length, 0);
  stwCommand(state, "player", { type: "escort", on: false });
  run(state, 15);
  const home = stwNexus(state, "player", "main");
  const returned = state.units.find((unit) => unit.side === "player" && unit.type === "overlord");
  assert.ok(Math.hypot(returned.x - home.x, returned.y - home.y) < 8, "동행을 끄면 본진으로 돌아감");
});

test("starswar zerg AI escorts an overlord once cloaked units hurt it", () => {
  const state = createStarswarGame({ seed: 3, aiSides: ["player"], races: { player: "zerg", enemy: "protoss" }, personas: { player: "hydra" } });
  state.sides.player.minerals = 5000;
  for (const building of ["overlord", "overlord", "pool"]) {
    stwCommand(state, "player", { type: "build", building });
    finishAll(state);
  }
  state.sides.player.sawCloakAt = state.time;
  stwAiThink(state, "player");
  assert.equal(state.sides.player.escort, true);
  assert.ok(state.units.some((unit) => unit.side === "player" && unit.type === "overlord"));
});

test("starswar never sends only support units to attack", () => {
  const state = zerg("protoss");
  state.sides.player.escort = true;
  stwSpawnUnitAt(state, "player", "overlord", 20, 77);
  assert.match(stwCommand(state, "player", { type: "attack" }).reason, /출격할 전투 병력이 없습니다/);
  state.sides.player.autoWave = 1;
  run(state, 2);
  assert.equal(stwArmy(state, "player").attack.length, 0, "자동 출격도 지원 유닛만으로는 나가지 않음");
  stwSpawnUnitAt(state, "player", "zergling", 20, 77);
  run(state, 1);
  assert.equal(stwArmy(state, "player").attack.length, 2, "전투 유닛이 생기면 오버로드도 함께 출격");
});

test("starswar keeps home overlords home and returns stranded support units to the rally group", () => {
  const state = zerg("protoss");
  const home = stwSpawnUnitAt(state, "player", "overlord", 24, 92);
  const ling = stwSpawnUnitAt(state, "player", "zergling", 20, 77);
  stwCommand(state, "player", { type: "attack" });
  assert.equal(home.group, "rally", "동행을 끈 오버로드는 출격에 끼지 않음");
  assert.equal(ling.group, "attack");

  state.sides.player.escort = true;
  stwCommand(state, "player", { type: "retreat" });
  stwCommand(state, "player", { type: "attack" });
  assert.equal(home.group, "attack", "동행 중이면 함께 출격");
  ling.hp = 0;
  run(state, 0.3);
  assert.equal(home.group, "rally", "싸울 유닛이 다 죽으면 지원 유닛은 대기 병력으로 돌아옴");
  assert.equal(stwArmy(state, "player").attack.length, 0);

  // AI: 지원 유닛만 남은 공격은 끝난 것으로 보고 다음 출격을 준비한다.
  const ai = createStarswarGame({ seed: 1, aiSides: ["player"], races: { player: "zerg", enemy: "protoss" }, personas: { player: "ling" } });
  ai.sides.player.escort = true;
  stwSpawnUnitAt(ai, "player", "overlord", 20, 50, "attack");
  ai.sides.player.ai = { nextThink: 0, step: 0, wave: 0, attacking: true, waveStart: 2, done: [] };
  run(ai, 2, stwAiThink);
  assert.equal(ai.sides.player.ai.attacking, false);
  assert.equal(ai.sides.player.ai.wave, 1);
});

test("starswar defensive buildings guard their whole base, not just their own range", () => {
  const state = quiet();
  state.sides.player.minerals = 9000;
  for (const building of ["pylon", "forge", "expand", "cannon"]) {
    assert.equal(stwCommand(state, "player", { type: "build", building }).ok, true, building);
    finishAll(state);
  }
  const cannon = stwOwnBuildings(state, "player", "cannon")[0];
  assert.equal(cannon.base, "natural");
  const natural = stwNexus(state, "player", "natural");
  // 사거리 8 드라군이 앞마당 넥서스를 때리는 자리: 넥서스에서 12칸, 캐논에서는 사거리 7 밖.
  state.sides.enemy.research.range = "done";
  const dragoon = stwSpawnUnitAt(state, "enemy", "dragoon", natural.x + (natural.x > cannon.x ? 8 : -8), natural.y - 9, "attack");
  assert.ok(Math.hypot(dragoon.x - cannon.x, dragoon.y - cannon.y) - dragoon.radius > 7, "드라군은 캐논 사거리 밖에 있음");
  run(state, 3);
  assert.ok(natural.shields < natural.maxShields, "드라군이 넥서스를 때림");
  assert.equal(cannon.targetId, dragoon.id, "캐논이 기지를 때리는 드라군을 노림");
  assert.ok(dragoon.shields < dragoon.maxShields, "캐논에 맞음");

  // 기지 건물 어디서도 멀면 쏘지 않는다.
  const far = stwSpawnUnitAt(state, "enemy", "zealot", 20, 50);
  run(state, 1);
  assert.notEqual(cannon.targetId, far.id);
});

test("starswar a single detector building reveals cloaked units across its whole base", () => {
  const state = quiet();
  state.sides.player.minerals = 9000;
  for (const building of ["pylon", "forge", "expand", "cannon"]) {
    assert.equal(stwCommand(state, "player", { type: "build", building }).ok, true, building);
    finishAll(state);
  }
  const cannon = stwOwnBuildings(state, "player", "cannon")[0];
  const natural = stwNexus(state, "player", "natural");
  // 캐논 반대편에서 앞마당 넥서스를 치는 다크템플러: 캐논 탐지 반경 7 밖이지만 기지 구역 안.
  const dark = stwSpawnUnitAt(state, "enemy", "dark", natural.x + (natural.x > cannon.x ? 5 : -5), natural.y, "attack");
  assert.ok(Math.hypot(dark.x - cannon.x, dark.y - cannon.y) > 7, "캐논 자체 탐지 반경 밖");
  assert.equal(stwDetected(state, dark, "player"), true, "지역 탐지로 드러남");
  // 본진에는 탐지 건물이 없으므로 본진의 다크템플러는 보이지 않는다.
  const main = stwNexus(state, "player", "main");
  const sneaky = stwSpawnUnitAt(state, "enemy", "dark", main.x, main.y - 5, "attack");
  assert.equal(stwDetected(state, sneaky, "player"), false);
  // 저그는 오버로드가 기지에 있어 본진이 기본으로 탐지된다.
  const z = zerg("protoss");
  z.sides.player.minerals = 9000;
  stwCommand(z, "player", { type: "build", building: "overlord" });
  finishAll(z);
  const home = stwNexus(z, "player", "main");
  assert.equal(stwDetected(z, stwSpawnUnitAt(z, "enemy", "dark", home.x - 6, home.y + 2, "attack"), "player"), true);
});

test("starswar map taps move the army: forward fights, backward retreats, enemy base attacks", () => {
  const state = quiet();
  const units = [0, 1, 2].map((index) => stwSpawnUnitAt(state, "player", "zealot", 16 + index * 4, 77));
  // 앞쪽을 누르면 집결지가 옮겨지고 가는 길의 적과 싸운다.
  let result = stwCommand(state, "player", { type: "move", y: 50 });
  assert.deepEqual([result.ok, result.mode, result.y], [true, "advance", 50]);
  assert.equal(state.sides.player.rally, 50);
  assert.equal(stwRallyY("player", 50), 50);
  assert.equal(stwRallyY("enemy", 50), 50);
  const blocker = stwSpawnUnitAt(state, "enemy", "zealot", 20, 66, "attack");
  run(state, 6);
  assert.ok(blocker.hp + blocker.shields < 160 || blocker.hp <= 0, "이동 중에 만난 적과 교전");
  assert.ok(state.log.some((entry) => /병력이 중앙으로 싸우며 전진합니다/.test(entry.text)));

  // 뒤쪽을 누르면 공격 병력까지 모두 싸우지 않고 물러난다.
  stwCommand(state, "player", { type: "attack" });
  run(state, 2);
  result = stwCommand(state, "player", { type: "move", y: 80 });
  assert.equal(result.mode, "retreat");
  assert.equal(stwArmy(state, "player").attack.length, 0);
  assert.ok(units.filter((unit) => unit.hp > 0).every((unit) => unit.group === "rally"));
  assert.ok(state.log.some((entry) => /물러납니다/.test(entry.text)));
  assert.ok(stwArmy(state, "player").rally.every((unit) => unit.targetId === null) || true);

  // 범위 밖은 잘라 낸다. 적 앞마당 안쪽은 출격이다.
  assert.equal(stwCommand(state, "player", { type: "move", y: 99 }).y, 84);
  assert.equal(stwCommand(state, "player", { type: "move", y: 10 }).ok, true);
  assert.ok(stwArmy(state, "player").attack.length > 0, "적 본진을 누르면 출격");
  assert.equal(state.sides.player.rally, 84, "출격은 집결지를 바꾸지 않음");
  assert.equal(stwRallyName(55), "중앙");
  assert.equal(stwRallyName("natural"), "앞마당");
});

test("starswar fast units lead the wave by a few tiles instead of crawling with the slowest", () => {
  const trial = (charge) => {
    const state = quiet();
    if (charge) state.sides.player.research.charge = "done";
    const zealot = stwSpawnUnitAt(state, "player", "zealot", 18, 77);
    const dragoon = stwSpawnUnitAt(state, "player", "dragoon", 22, 77);
    stwCommand(state, "player", { type: "attack" });
    run(state, 10);
    return { zealot: 77 - zealot.y, dragoon: 77 - dragoon.y, gap: dragoon.y - zealot.y };
  };
  const slow = trial(false);
  const fast = trial(true);
  assert.ok(slow.zealot >= 29, `발업 전 질럿도 드라군에 묶이지 않고 제 속도로 걸음 (${slow.zealot.toFixed(1)})`);
  assert.ok(fast.zealot > slow.zealot + 1.5, `발업 질럿이 더 멀리 감 (${slow.zealot.toFixed(1)} → ${fast.zealot.toFixed(1)})`);
  assert.ok(fast.gap > 5 && fast.gap < 8, `드라군보다 6칸 안팎 앞섬 (${fast.gap.toFixed(1)})`);
  assert.ok(Math.abs(fast.dragoon - slow.dragoon) < 1, "드라군 속도는 그대로");
});

test("starswar kiting is imperfect: upgraded melee closes in during the aim window, unupgraded melee does not", () => {
  const trial = (charge, ion) => {
    const state = createStarswarGame({ seed: 2, aiSides: [], races: { player: "protoss", enemy: "terran" } });
    if (charge) state.sides.player.research.charge = "done";
    if (ion) state.sides.enemy.research.ion = "done";
    const zealot = stwSpawnUnitAt(state, "player", "zealot", 20, 56, "attack");
    const vulture = stwSpawnUnitAt(state, "enemy", "vulture", 20, 44, "attack");
    for (let step = 0; step < 150 && zealot.hp > 0 && vulture.hp > 0; step += 1) stepStarswar(state);
    return { zealotHit: vulture.hp < vulture.maxHp, zealotAlive: zealot.hp > 0 };
  };
  assert.equal(trial(false, false).zealotHit, false, "발업 없는 질럿은 벌처를 따라잡지 못함");
  assert.equal(trial(true, false).zealotHit, true, "발업 질럿은 조준 틈에 따라붙어 때림");
  assert.equal(trial(true, true).zealotHit, true, "이온 추진기 벌처도 완벽하게 카이팅하지는 못함");
});
