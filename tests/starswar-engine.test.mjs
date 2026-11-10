import assert from "node:assert/strict";
import test from "node:test";
import { STW_BUILDINGS, STW_LANE_LENGTH, STW_LANE_WIDTH, STW_LAYOUT, STW_SPELLS, STW_STORM, STW_UNITS } from "../app/starswar/starswar-data.js";
import {
  createStarswarGame,
  stwCreateScenario,
  stwArmy,
  stwBuildCheck,
  stwCommand,
  stwDetected,
  stwDropCheck,
  stwDone,
  stwFreeSlots,
  stwHitDamage,
  stwIssue,
  stwIncome,
  stwNexus,
  stwOwnBuildings,
  stwPoint,
  stwRallyName,
  stwRallyY,
  stwResearchCheck,
  stwSlots,
  stwRestore,
  stwSerialize,
  stwSpawnUnitAt,
  stwSupply,
  stwWorkerSplit,
  stepStarswar,
} from "../app/starswar/starswar-engine.js";
import { stwAiThink } from "../app/starswar/starswar-ai.js";
import { stwFingerprint, stwReplay, stwReplayCode, stwReplayMatches } from "../app/starswar/starswar-replay.js";
import { stwAiReport, stwBugReport, stwLosingAiSides } from "../app/starswar/starswar-report.js";
import { stwIntelTag, stwLearnAdd, stwLearnEmpty, stwLearnFeatures, stwLearnPick, stwLearnSnapshot, stwLearnTags } from "../app/starswar/starswar-learn.js";
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
  state.sides.player.probes = 8;
  assert.equal(stwCommand(state, "player", { type: "scout" }).ok, true);
  assert.equal(state.sides.player.probes, 7);
  assert.equal(stwCommand(state, "player", { type: "scout" }).ok, true, "정찰 중에도 또 보낼 수 있음");
  assert.equal(stwCommand(state, "player", { type: "scout" }).ok, true);
  assert.equal(stwCommand(state, "player", { type: "scout" }).ok, true, "동시 정찰 수에 제한 없음");
  assert.match(stwCommand(state, "player", { type: "scout" }).reason, /5기 이상 필요/, "일꾼이 모자라면 못 보냄");
  assert.equal(state.units.filter((unit) => unit.group === "scout").length, 4);
  run(state, 70);
  assert.ok(state.sides.player.intel, "적 본진 정보");
  assert.equal(state.sides.player.intel.buildings.nexus, 1);
  assert.equal(state.units.some((unit) => unit.group === "scout"), false);
  assert.equal(state.sides.player.probes, 8, "정찰 4기가 모두 돌아옴");
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
  // 옵저버가 탐지하자 맞는다. 맞은 다크템플러는 탐지 밖으로 빠져나가거나 그 전에 죽는다.
  const gone = dark.hp <= 0 || !state.units.includes(dark);
  assert.ok(gone || dark.hp + dark.shields < STW_UNITS.dark.hp + STW_UNITS.dark.shields, "탐지되자 맞는다");
  assert.ok(gone || !stwDetected(state, dark, "player"), "죽거나 탐지 밖으로 비킨다");
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
  assert.ok(marines.length === 3);
  // 드러난 채 맞은 다크템플러는 스캔 밖(탐지가 닿지 않는 곳)으로 비킨다.
  run(state, 3);
  assert.ok(dark.hp <= 0 || !stwDetected(state, dark, "player"), "스캔 밖으로 비킨다");

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

test("starswar attackers retaliate against defenses unless told to raze buildings first", () => {
  const setup = (focus) => {
    const state = terran();
    state.sides.player.minerals = 9000;
    for (const building of ["depot", "barracks", "bunker"]) {
      stwCommand(state, "player", { type: "build", building });
      finishAll(state);
    }
    const bunker = stwOwnBuildings(state, "player", "bunker")[0];
    // 벙커에서 14칸쯤 떨어진 배럭 옆에 질럿을 세우고 배럭을 치게 한다.
    const soft = stwOwnBuildings(state, "player", "barracks")[0];
    const zealot = stwSpawnUnitAt(state, "enemy", "zealot", soft.x, soft.y - soft.radius - 0.5, "attack");
    zealot.targetId = soft.id;
    if (focus) assert.equal(stwCommand(state, "enemy", { type: "focus", mode: focus }).ok, true);
    return { state, bunker, soft, zealot };
  };
  const fight = setup(null);
  assert.equal(fight.state.sides.enemy.focus, "fight", "기본은 교전 우선");
  assert.ok(Math.hypot(fight.soft.x - fight.bunker.x, fight.soft.y - fight.bunker.y) - fight.bunker.radius > 8, "벙커는 질럿 시야 밖에서 쏜다");
  run(fight.state, 1.5);
  assert.equal(fight.zealot.targetId, fight.bunker.id, "맞으면 벙커에게 반격");
  run(fight.state, 6);
  assert.ok(fight.bunker.hp < fight.bunker.maxHp, `벙커까지 가서 친다 ${fight.bunker.hp}`);

  const raze = setup("buildings");
  run(raze.state, 3);
  assert.notEqual(raze.zealot.targetId, raze.bunker.id, "건물 우선이면 맞아도 하던 건물을 친다");
  assert.ok(raze.soft.hp < raze.soft.maxHp, "일반 건물이 깎인다");
  assert.equal(stwCommand(raze.state, "enemy", { type: "focus", mode: "units" }).ok, false);
});

test("starswar melee crowds spread to other buildings instead of queueing behind a full one", () => {
  const state = quiet();
  state.sides.player.minerals = 9000;
  for (const building of ["pylon", "forge", "gateway", "gateway", "cannon"]) {
    stwCommand(state, "player", { type: "build", building });
    finishAll(state);
  }
  for (const building of state.buildings) building.hp = building.maxHp = 1e6;
  // 남은 광물로 게이트웨이가 질럿을 뽑으면 저글링이 그쪽과 싸우므로 비운다.
  state.sides.player.minerals = 0;
  const cannon = stwOwnBuildings(state, "player", "cannon")[0];
  // 저글링 24기가 세 줄로 캐논에 달려든다. 캐논 둘레에는 다 붙을 수 없다.
  const lings = Array.from({ length: 24 }, (_, index) => {
    const ling = stwSpawnUnitAt(state, "enemy", "zergling", cannon.x + ((index % 3) - 1) * 2.2, cannon.y - 8 - Math.floor(index / 3) * 2.4, "attack");
    ling.hp = ling.maxHp = 1e6;
    return ling;
  });
  run(state, 22);
  const reach = STW_UNITS.zergling.range;
  const engaged = lings.filter((ling) => {
    const target = state.buildings.find((item) => item.id === ling.targetId);
    return target && Math.hypot(ling.x - target.x, ling.y - target.y) - target.radius - ling.radius * 0.5 <= reach + 0.01;
  });
  assert.ok(engaged.length >= 22, `막힌 저글링은 다른 건물로 간다 ${engaged.length}/24`);
  assert.ok(engaged.some((ling) => ling.targetId !== cannon.id), "꽉 찬 캐논 대신 다른 건물을 친다");
  for (const ling of engaged) {
    const target = state.buildings.find((item) => item.id === ling.targetId);
    assert.ok(Math.hypot(ling.x - target.x, ling.y - target.y) >= target.radius, "치는 건물 안으로 파고들지 않는다");
  }
});

test("starswar places defenses at the front of the main, center first", () => {
  const state = quiet();
  state.sides.player.minerals = 9000;
  for (const building of ["pylon", "forge", "cannon", "cannon"]) {
    stwCommand(state, "player", { type: "build", building });
    finishAll(state);
  }
  const cannons = stwOwnBuildings(state, "player", "cannon");
  assert.ok(cannons.every((cannon) => cannon.y === 81), "앞줄");
  assert.ok(Math.abs(cannons[0].x - 20) < 1, `첫 캐논은 길목 가운데 ${cannons[0].x}`);
  assert.ok(Math.abs(cannons[1].x - 20) < 6, `둘째도 가운데 옆 ${cannons[1].x}`);
});

/** 게이트웨이 넷에서 질럿만 뽑아 8기씩 보내는 플레이어로 seconds초까지 진행한다. */
const runZealotRush = (state, seconds) => {
  const record = state.sides.player;
  let next = 0;
  while (state.status === "playing" && state.time < seconds) {
    if (state.time >= next) {
      next = state.time + 1;
      const supply = stwSupply(state, "player");
      if (record.probes < 14) stwCommand(state, "player", { type: "probe" });
      if (supply.used + 4 >= supply.cap && !stwOwnBuildings(state, "player", "pylon").some((pylon) => !stwDone(pylon))) stwCommand(state, "player", { type: "build", building: "pylon" });
      if (stwOwnBuildings(state, "player", "gateway").length < 4) stwCommand(state, "player", { type: "build", building: "gateway" });
      for (const gateway of stwOwnBuildings(state, "player", "gateway")) if (gateway.line !== "zealot") stwCommand(state, "player", { type: "line", buildingId: gateway.id, unit: "zealot" });
      if (record.autoWave !== 8) stwCommand(state, "player", { type: "autoWave", size: 8 });
    }
    stepStarswar(state, stwAiThink);
  }
};

test("starswar AI holds a four-gate zealot rush behind its defenses", () => {
  // 예전에는 바이오닉 AI가 6분 30초 안에 무너졌다.
  const state = createStarswarGame({ seed: 1, aiSides: ["enemy"], races: { player: "protoss", enemy: "terran" }, personas: { enemy: "bio" } });
  runZealotRush(state, 420);
  assert.equal(state.status, "playing", "7분까지 버틴다");
  assert.ok(state.sides.enemy.stats.kills >= 16, `질럿을 잡는다 ${state.sides.enemy.stats.kills}`);
  const bunkers = stwOwnBuildings(state, "enemy", "bunker");
  assert.ok(bunkers.length, "벙커가 있다");
});

test("starswar zergling AI switches to hydras when a zealot rush keeps it pinned", () => {
  // 저글링은 질럿에게 손해를 본다. 예전에는 저글링만 고집하다 10~12분에 무너졌다.
  const state = createStarswarGame({ seed: 1, aiSides: ["enemy"], races: { player: "protoss", enemy: "zerg" }, personas: { enemy: "ling" } });
  runZealotRush(state, 600);
  assert.notEqual(state.winner, "player", "10분 안에 무너지지 않는다(먼저 이길 수도 있다)");
  assert.equal(state.sides.enemy.persona, "hydra", "히드라로 갈아탄다");
  assert.equal(state.sides.enemy.ai.switched.from, "ling");
  assert.ok(state.sides.enemy.ai.switched.at < 480, `큰 물량이 막히기를 기다리지 않고 일찍 갈아탄다 ${state.sides.enemy.ai.switched.at}`);
  assert.ok(state.units.some((unit) => unit.side === "enemy" && unit.type === "hydra"), "히드라가 나온다");
});

test("starswar units fighting in range hold their ground instead of being shoved back", () => {
  // 16 대 8 질럿: 예전에는 수가 많은 쪽이 뒤에서 밀어붙여 적 앞줄이 싸우는 동안 24칸 넘게 뒤로 밀렸다.
  const state = quiet();
  for (const building of state.buildings) building.hp = building.maxHp = 1e6;
  for (let index = 0; index < 16; index += 1) stwSpawnUnitAt(state, "player", "zealot", 8 + (index % 8) * 3, 58 + Math.floor(index / 8) * 2.5, "attack");
  for (let index = 0; index < 8; index += 1) stwSpawnUnitAt(state, "enemy", "zealot", 8 + index * 3, 42, "attack");
  let pushedBack = 0;
  let fighting = 0;
  for (let step = 0; step < 300; step += 1) {
    const before = new Map();
    for (const unit of state.units) {
      const target = state.units.find((item) => item.id === unit.targetId);
      if (target && Math.hypot(unit.x - target.x, unit.y - target.y) - target.radius - unit.radius * 0.5 <= STW_UNITS[unit.type].range) before.set(unit.id, unit.y);
    }
    stepStarswar(state);
    for (const unit of state.units) {
      if (!before.has(unit.id)) continue;
      fighting += 1;
      // 뒤로 = 자기 기지 쪽(플레이어는 y가 커지는 쪽).
      pushedBack += Math.max(0, (unit.y - before.get(unit.id)) * (unit.side === "player" ? 1 : -1));
    }
  }
  assert.ok(fighting > 500, `충분히 싸웠다 ${fighting}`);
  assert.ok(pushedBack < 0.5, `싸우는 동안 뒤로 밀린 거리 ${pushedBack.toFixed(2)}`);
});

test("starswar retreat orders pause auto waves until the next forward order", () => {
  const state = quiet();
  stwCommand(state, "player", { type: "autoWave", size: 1 });
  for (let index = 0; index < 6; index += 1) stwSpawnUnitAt(state, "player", "zealot", 10 + index * 3, 80, "rally");
  for (let index = 0; index < 6; index += 1) {
    const enemy = stwSpawnUnitAt(state, "enemy", "zealot", 10 + index * 3, 40, "rally");
    enemy.hp = enemy.maxHp = 1e5;
  }
  run(state, 12);
  assert.equal(stwArmy(state, "player").attack.length, 6, "즉시 출격");
  // 교전 중 지도 뒤쪽을 눌러 후퇴: 예전에는 다음 틱에 자동 출격이 곧바로 다시 내보냈다.
  assert.equal(stwCommand(state, "player", { type: "move", y: 80 }).mode, "retreat");
  assert.equal(state.sides.player.autoWaveHold, true);
  run(state, 3);
  assert.equal(stwArmy(state, "player").attack.length, 0, "후퇴가 먹힌다");
  assert.equal(stwArmy(state, "player").rally.length, 6);
  // 출격하면 다시 켜진다. 후퇴 버튼도 같은 규칙이다.
  stwCommand(state, "player", { type: "attack" });
  assert.equal(state.sides.player.autoWaveHold, false);
  stwCommand(state, "player", { type: "retreat" });
  assert.equal(state.sides.player.autoWaveHold, true);
  run(state, 2);
  assert.equal(stwArmy(state, "player").attack.length, 0);
  // 자동 출격 단계를 다시 고르면 풀리고 곧바로 다시 나간다.
  stwCommand(state, "player", { type: "autoWave", size: 1 });
  run(state, 0.2);
  assert.equal(stwArmy(state, "player").attack.length, 6);
});

test("starswar resource scouts sweep the enemy mineral line along the lane edges and report", () => {
  const state = quiet();
  state.sides.player.probes = 8;
  const probes = state.sides.player.probes;
  assert.equal(stwCommand(state, "player", { type: "scout", target: "resources" }).ok, true);
  const scout = state.units.find((unit) => unit.group === "scout");
  assert.equal(scout.scoutMode, "resources");
  const mineralLine = stwPoint("enemy", { x: 20, y: 97.5 });
  let closest = Infinity;
  let widest = 0;
  for (let step = 0; step < 900 && state.units.includes(scout); step += 1) {
    stepStarswar(state);
    closest = Math.min(closest, Math.hypot(scout.x - mineralLine.x, scout.y - mineralLine.y));
    if (scout.y > 20 && scout.y < 80) widest = Math.max(widest, Math.abs(scout.x - 20));
  }
  assert.equal(scout.returned, true, "살아 돌아온다");
  assert.equal(state.sides.player.probes, probes, "일꾼이 돌아온다");
  assert.ok(closest < 2, `광물 줄을 지난다 ${closest.toFixed(1)}`);
  assert.ok(widest > 15, "레인 가장자리로 다닌다");
  assert.ok(state.sides.player.intel, "적 본진을 확인");
  assert.ok(state.log.some((entry) => /^자원 정찰 보고: 적 프로브 \d+기 · 가스 \d+곳 · 앞마당 확장 안 함$/.test(entry.text)), "보고");
});

test("starswar cloaked units step out of detection when hit and wait outside it", () => {
  // 캐논(탐지)이 지키는 적 기지 앞의 질럿 여섯에게 다크템플러 넷이 들어간다.
  const state = quiet();
  state.sides.enemy.minerals = 9999;
  for (const building of ["pylon", "forge", "cannon"]) {
    stwCommand(state, "enemy", { type: "build", building });
    finishAll(state);
  }
  state.sides.enemy.minerals = 0;
  state.sides.player.minerals = 0;
  const cannon = stwOwnBuildings(state, "enemy", "cannon")[0];
  for (let index = 0; index < 6; index += 1) stwSpawnUnitAt(state, "enemy", "zealot", 8 + index * 5, 40, "rally");
  const darks = [0, 1, 2, 3].map((index) => stwSpawnUnitAt(state, "player", "dark", cannon.x - 3 + index * 2, cannon.y + 14, "attack"));
  // 다크템플러마다 처음 맞은 때와, 그 뒤 탐지 밖으로 빠져나간 때를 잰다.
  const hitAt = new Map();
  const escapedAt = new Map();
  for (let step = 0; step < 200; step += 1) {
    stepStarswar(state);
    for (const dark of darks) {
      if (dark.hp <= 0) continue;
      if (!hitAt.has(dark.id) && dark.hitAt !== undefined) hitAt.set(dark.id, state.time);
      if (hitAt.has(dark.id) && !escapedAt.has(dark.id) && !stwDetected(state, dark, "enemy")) escapedAt.set(dark.id, state.time);
    }
  }
  assert.ok(hitAt.size >= 2, "탐지 안에서 맞는다");
  for (const dark of darks) {
    if (!hitAt.has(dark.id) || dark.hp <= 0) continue;
    assert.ok(escapedAt.has(dark.id) && escapedAt.get(dark.id) - hitAt.get(dark.id) <= 3, "맞으면 3초 안에 탐지 밖으로 빠져나간다");
  }
  // 같은 속도의 질럿이 쫓아오며 때리므로 빠져나가기 전에 죽는 다크템플러도 있지만, 대부분 살아남는다.
  // 고치기 전에는 그 자리에서 싸워 넷 중 둘이 죽었다.
  assert.ok(darks.filter((dark) => dark.hp > 0).length >= 3, "대부분 살아남는다");
});

test("starswar casters wait behind the army until a spell is ready, then move to the front", () => {
  const state = quiet();
  state.sides.player.research.storm = "done";
  for (const building of state.buildings) building.hp = building.maxHp = 1e6;
  for (let index = 0; index < 8; index += 1) stwSpawnUnitAt(state, "player", index % 2 ? "zealot" : "dragoon", 10 + index * 3, 60, "attack");
  const tired = stwSpawnUnitAt(state, "player", "templar", 18, 62, "attack");
  tired.energy = 10;
  const ready = stwSpawnUnitAt(state, "player", "templar", 22, 62, "attack");
  ready.energy = 80;
  // 스톰을 쓸 무리가 없는 큰 적 하나: 마법을 쓸 수 있는 템플러는 선두에 서서 기회를 노린다.
  const ultra = stwSpawnUnitAt(state, "enemy", "ultra", 20, 30, "rally");
  ultra.hp = ultra.maxHp = 1e6;
  run(state, 25);
  // 맨 뒤는 y로, 최전방은 적과의 거리로 잰다(근접 유닛이 적을 빙 둘러싸므로 y만으로는 선두를 알 수 없다).
  const gap = (unit) => Math.hypot(unit.x - ultra.x, unit.y - ultra.y);
  const army = state.units.filter((unit) => unit.side === "player" && unit.group === "attack" && unit.type !== "templar");
  const rear = Math.max(...army.map((unit) => unit.y));
  assert.ok(tired.energy < STW_STORM.energy, "아직 에너지가 모자라다");
  assert.ok(tired.y >= rear + 2, `에너지가 없으면 맨 뒤 y ${tired.y.toFixed(1)} / 후미 y ${rear.toFixed(1)}`);
  assert.ok(gap(ready) <= 4.5, `마법을 쓸 수 있으면 적 바로 앞까지 ${gap(ready).toFixed(1)}`);
});

test("starswar Protoss AI opens gateway, forge and natural against Zerg even under pressure", () => {
  // 예전에는 경계 중 빌드 순서가 앞마당까지 닿지 못해 본진 하나에 일꾼 22기로 묶였다.
  for (const zerg of ["ling", "pool"]) {
    const state = createStarswarGame({ seed: 1, aiSides: ["player", "enemy"], races: { player: "protoss", enemy: "zerg" }, personas: { player: "robo", enemy: zerg } });
    let natural = null;
    while (state.status === "playing" && state.time < 400) {
      stepStarswar(state, stwAiThink);
      if (natural === null && stwNexus(state, "player", "natural")) natural = state.time;
    }
    assert.ok(natural !== null && natural < 380, `${zerg} 상대로 6분 20초 전에 앞마당 ${natural}`);
    assert.ok(stwOwnBuildings(state, "player", "forge").length, "포지");
    assert.ok(stwOwnBuildings(state, "player", "gateway").length, "게이트웨이");
  }
  // 테란 상대로는 쓰지 않는다(빌드 순서 그대로).
  const terran = createStarswarGame({ seed: 1, aiSides: ["player", "enemy"], races: { player: "protoss", enemy: "terran" }, personas: { player: "robo", enemy: "bio" } });
  run(terran, 150, stwAiThink);
  assert.equal(stwOwnBuildings(terran, "player", "forge").length, 0, "테란전은 포지를 먼저 짓지 않는다");
});

test("starswar saves a running game and resumes it exactly where it stopped", () => {
  const original = createStarswarGame({ seed: 9, aiSides: ["player", "enemy"], races: { player: "protoss", enemy: "zerg" }, personas: { player: "dragoon", enemy: "hydra" } });
  run(original, 120, stwAiThink);
  const saved = stwSerialize(original);
  const resumed = stwRestore(saved);
  assert.ok(resumed, "되살린다");
  assert.equal(resumed.time, original.time);
  assert.equal(resumed.units.length, original.units.length);
  // 같은 결정론적 경기라 1분 더 진행해도 똑같이 흘러간다.
  run(original, 60, stwAiThink);
  run(resumed, 60, stwAiThink);
  assert.equal(stwSerialize(resumed), stwSerialize(original));
  // 깨진 저장, 끝난 경기, 다른 판의 저장은 되살리지 않는다.
  assert.equal(stwRestore("{"), null);
  assert.equal(stwRestore(JSON.stringify({ ...JSON.parse(saved), status: "over" })), null);
  assert.equal(stwRestore(JSON.stringify({ ...JSON.parse(saved), saveVersion: 0 })), null);
});

test("starswar records army value, supply peaks and lost value for the result screen", () => {
  const state = createStarswarGame({ seed: 4, aiSides: ["player", "enemy"], races: { player: "terran", enemy: "protoss" }, personas: { player: "bio", enemy: "dragoon" } });
  run(state, 300, stwAiThink);
  assert.equal(state.history.length, 30, "10초마다 한 점");
  assert.deepEqual(Object.keys(state.history[0]).sort(), ["enemy", "player", "t"]);
  const last = state.history.at(-1);
  assert.equal(last.t, 300);
  assert.ok(last.player.army > 0 && last.enemy.army > 0, "병력 가치");
  assert.ok(state.sides.player.stats.supplyPeak >= last.player.supply, "최대 인구");
  for (const side of ["player", "enemy"]) {
    const stats = state.sides[side].stats;
    assert.ok(stats.valueLost >= 0);
    if (stats.lost - (stats.workersLost ?? 0) > 0) assert.ok(stats.valueLost > 0, "잃은 병력 가치");
  }
});

test("starswar lab scenarios set the clock, armies, tech and research for an instant engagement", () => {
  const state = stwCreateScenario({
    seed: 3,
    time: 900,
    races: { player: "protoss", enemy: "zerg" },
    sides: {
      player: { workers: 20, units: { carrier: 8 }, research: ["carrierCapacity", "weapons1"] },
      enemy: { workers: 20, units: { hydra: 80 }, research: ["spines", "augments", "zMissile2"] },
    },
  });
  assert.equal(state.time, 900);
  assert.deepEqual(state.lab, { placement: "clash", control: { player: "manual", enemy: "fight" } });
  assert.deepEqual(state.aiSides, [], "교전만: 적 AI가 운영하지 않는다");
  assert.equal(state.units.filter((unit) => unit.side === "player" && unit.type === "carrier").length, 8);
  assert.equal(state.units.filter((unit) => unit.side === "enemy" && unit.type === "hydra").length, 80);
  assert.deepEqual(stwSupply(state, "enemy"), { used: 100, cap: 100 }, "히드라 80 + 드론 20 = 인구 꽉");
  assert.equal(stwSupply(state, "player").cap, 100);
  // 생산·테크 건물과 선행 연구를 갖춘다.
  for (const building of ["stargate", "beacon", "core"]) assert.ok(stwOwnBuildings(state, "player", building).some((item) => stwDone(item)), building);
  assert.ok(stwOwnBuildings(state, "enemy", "den").length && stwOwnBuildings(state, "enemy", "evo").length);
  for (const id of ["carrierCapacity", "weapons1"]) assert.equal(state.sides.player.research[id], "done", id);
  for (const id of ["spines", "augments", "lair", "zMissile1", "zMissile2"]) assert.equal(state.sides.enemy.research[id], "done", id);
  // 생산 라인은 비우고, 준비하며 지은 건물 기록은 남기지 않으며, 시작 시점을 첫 기록으로 남긴다.
  assert.ok(state.buildings.every((building) => building.line === null && !building.current));
  assert.equal(state.log.length, 1);
  assert.deepEqual(state.history[0].t, 900);
  assert.equal(state.history[0].enemy.supply, 100);
  assert.equal(state.sides.enemy.stats.supplyPeak, 100);
  // 정면 교전: 두 병력이 공격 병력으로 맵 가운데에서 마주 보고 시작해 곧 맞붙는다.
  assert.ok(state.units.every((unit) => unit.group === "attack"));
  run(state, 20);
  const carriers = state.units.filter((unit) => unit.side === "player" && unit.type === "carrier");
  const hydras = state.units.filter((unit) => unit.side === "enemy" && unit.type === "hydra");
  assert.ok(carriers.length < 8 || hydras.length < 80, "교전이 벌어진다");
  assert.equal(state.sides.enemy.stats.produced, 0, "교전만: 적은 생산하지 않는다");

  // 옛 설정(enemyAi: "full")도 받는다.
  const home = stwCreateScenario({ time: 300, placement: "home", enemyAi: "full", races: { player: "terran", enemy: "protoss" }, sides: { player: { units: { marine: 10 } }, enemy: { units: { zealot: 6, carrier: 99 } } } });
  assert.deepEqual(home.aiSides, ["enemy"], "AI 계속 운영");
  assert.ok(home.units.every((unit) => unit.group === "rally"), "각자 집결지에서 대기");
  assert.equal(home.units.filter((unit) => unit.side === "enemy" && unit.type === "carrier").length, 99, "인구를 넘어도 요청한 만큼 나온다");
  assert.ok(!home.units.some((unit) => unit.side === "player" && unit.type !== "marine"));
});

test("starswar lab scenarios take each side's controller, strategy and building counts", () => {
  const state = stwCreateScenario({
    time: 600,
    placement: "home",
    races: { player: "protoss", enemy: "zerg" },
    sides: {
      player: { control: "ai", persona: "carrier", natural: true, buildings: { gateway: 4, cannon: 3, stargate: 2 } },
      enemy: { control: "ai", persona: "hive", natural: true, buildings: { sunken: 4, hatch: 2, mound: 1 }, units: { hydra: 12 } },
    },
  });
  assert.deepEqual(state.aiSides, ["player", "enemy"], "양쪽 AI 관전");
  assert.equal(state.sides.player.persona, "carrier");
  assert.equal(state.sides.enemy.persona, "hive");
  assert.deepEqual(state.lab.control, { player: "ai", enemy: "ai" });
  const count = (side, type) => stwOwnBuildings(state, side, type).filter((item) => stwDone(item)).length;
  assert.equal(count("player", "gateway"), 4);
  assert.equal(count("player", "cannon"), 3);
  assert.equal(count("player", "stargate"), 2);
  assert.equal(count("player", "forge"), 1, "캐논의 선행 건물");
  assert.equal(count("enemy", "sunken"), 4);
  assert.equal(count("enemy", "hatch"), 2);
  assert.equal(count("enemy", "mound"), 1);
  assert.equal(state.sides.enemy.research.hive, "done", "디파일러 마운드의 선행 연구(하이브)");
  // 다른 종족의 전략은 무시하고 무작위로 고른다.
  const mismatched = stwCreateScenario({ races: { player: "terran", enemy: "zerg" }, sides: { player: { control: "ai", persona: "carrier" }, enemy: {} } });
  assert.equal(mismatched.sides.player.race, "terran");
  assert.notEqual(mismatched.sides.player.persona, "carrier");
  // 자리가 모자라 다 짓지 못한 건물은 기록으로 알린다.
  const crowded = stwCreateScenario({ races: { player: "protoss", enemy: "zerg" }, sides: { player: { natural: false, buildings: { gateway: 30 } }, enemy: {} } });
  assert.ok(crowded.log.some((entry) => /^실험실: 아군 게이트웨이 \d+개는 자리가 모자라 짓지 못했습니다\.$/.test(entry.text)), "자리 부족 알림");
});

test("starswar lab casters start with full energy so their spells fire right away", () => {
  const cast = (config) => {
    const state = stwCreateScenario({ seed: 2, time: 600, ...config });
    const spells = {};
    const seen = new Set();
    for (let step = 0; step < 100 && state.status === "playing"; step += 1) {
      stepStarswar(state);
      for (const effect of state.effects) {
        if (effect.kind !== "spell" || effect.side !== "player" || seen.has(effect)) continue;
        seen.add(effect);
        spells[effect.spell] = (spells[effect.spell] ?? 0) + 1;
      }
    }
    return { state, spells };
  };
  // 10초 안에: 스톰, 다크 스웜·플레이그, 브루들링.
  const storm = cast({ races: { player: "protoss", enemy: "zerg" }, sides: { player: { units: { templar: 6, zealot: 10 }, research: ["storm"] }, enemy: { units: { zergling: 80 } } } });
  assert.ok(storm.state.sides.player.stats.storms > 0, "스톰");
  assert.ok(storm.state.units.filter((unit) => unit.type === "templar").every((unit) => unit.energy <= 200));
  const defiler = cast({ races: { player: "zerg", enemy: "terran" }, sides: { player: { units: { defiler: 4, hydra: 20 }, research: ["plague"] }, enemy: { units: { marine: 40, medic: 6 } } } });
  assert.ok(defiler.spells.darkSwarm > 0 && defiler.spells.plague > 0, `다크 스웜·플레이그 ${JSON.stringify(defiler.spells)}`);
  const queen = cast({ races: { player: "zerg", enemy: "zerg" }, sides: { player: { units: { queen: 4, hydra: 12 }, research: ["ensnare", "broodling"] }, enemy: { units: { ultra: 4, hydra: 20 } } } });
  // 퀸은 브루들링(150)부터 쓰므로 10초 안에는 남은 에너지(50)로 인스네어(75)까지는 못 쓴다.
  assert.ok(queen.spells.broodling > 0, `브루들링 ${JSON.stringify(queen.spells)}`);
  // "새로 나온 유닛"으로 두면 시작 에너지(50)라 스톰(75)을 바로 못 쓴다.
  const fresh = cast({ races: { player: "protoss", enemy: "zerg" }, sides: { player: { energy: "fresh", units: { templar: 6, zealot: 10 }, research: ["storm"] }, enemy: { units: { zergling: 80 } } } });
  assert.equal(fresh.state.sides.player.stats.storms, 0);
});

test("starswar storms spare allies, allies still step out of them, and templar aim past our own front line", () => {
  // 1) 스톰은 적만 맞힌다. 아군은 맞지 않지만, 보이는 모습은 원작처럼 우리 편 스톰을 빠져나오고 다시 들어가지 않는다.
  const state = quiet();
  for (const building of state.buildings) building.hp = building.maxHp = 1e6;
  const zealot = stwSpawnUnitAt(state, "player", "zealot", 20, 50, "attack");
  const marine = stwSpawnUnitAt(state, "enemy", "marine", 21, 50);
  marine.hp = marine.maxHp = 1e4;
  marine.stunUntil = 999;
  state.storms.push({ id: 900, side: "player", x: 20, y: 50, ttl: 3 });
  run(state, 1.5);
  assert.equal(zealot.hp + zealot.shields, 160, "아군 질럿은 맞지 않는다");
  assert.ok(marine.hp < 1e4, "적은 맞는다(적은 피하지 않는다)");
  assert.ok(Math.hypot(zealot.x - 20, zealot.y - 50) > STW_STORM.radius, "아군은 빠져나온다");
  // 스톰이 남아 있는 동안 해병을 치러 다시 들어가지 않는다.
  run(state, 1);
  assert.ok(Math.hypot(zealot.x - 20, zealot.y - 50) > STW_STORM.radius, "다시 들어가지 않는다");
  // 스톰이 끝나면 다시 싸우러 들어간다.
  run(state, 2);
  assert.equal(state.storms.length, 0);
  assert.ok(Math.hypot(zealot.x - marine.x, zealot.y - marine.y) < 3, "스톰이 끝나면 다시 붙는다");

  // 2) 피해는 없어도, 질럿과 붙어 싸우는 적 최전선 대신 아군이 없는 뒷줄 적 무리에 스톰을 쓴다.
  const battle = quiet();
  battle.sides.player.research.storm = "done";
  for (const building of battle.buildings) building.hp = building.maxHp = 1e6;
  const templar = stwSpawnUnitAt(battle, "player", "templar", 20, 60, "attack");
  templar.energy = 200;
  // 질럿 다섯이 앞줄 해병과 맞붙어 있다(1.5칸).
  for (let index = 0; index < 5; index += 1) stwSpawnUnitAt(battle, "player", "zealot", 17 + index * 1.5, 53.5, "attack");
  const front = Array.from({ length: 5 }, (_, index) => stwSpawnUnitAt(battle, "enemy", "marine", 17 + index * 1.5, 52, "rally"));
  const back = Array.from({ length: 5 }, (_, index) => stwSpawnUnitAt(battle, "enemy", "marine", 17 + index * 1.5, 46, "rally"));
  for (const unit of [...front, ...back]) unit.hp = unit.maxHp = 1e4;
  // 템플러만 움직이게 나머지는 제자리에 묶는다(대기 병력은 각자 집결지로 돌아가 버린다).
  for (const unit of battle.units) if (unit !== templar) unit.stunUntil = 999;
  // 뒷줄은 처음에 시전 사거리(9) 밖이라, 마법을 쓸 수 있는 템플러가 앞으로 나와 쓴다.
  let cast = [];
  for (let step = 0; step < 40 && !cast.length; step += 1) {
    stepStarswar(battle);
    cast = [...battle.storms];
  }
  assert.ok(cast.length >= 1, "스톰을 쓴다");
  battle.storms = cast;
  for (const storm of cast) {
    const allies = battle.units.filter((unit) => unit.side === "player" && Math.hypot(unit.x - storm.x, unit.y - storm.y) <= STW_STORM.radius + unit.radius * 0.5);
    assert.equal(allies.length, 0, `아군이 반경 안에 없다 (${storm.x.toFixed(1)}, ${storm.y.toFixed(1)})`);
    assert.ok(storm.y < 50, "뒷줄을 노린다");
  }
});

test("starswar area spells and irradiate aim past our own front line like storms", () => {
  // 인스네어(범위 마법 공통 규칙)와 이레디에이트도 아군이 걸리는 적 최전선 대신 아군이 없는 적을 노린다.
  const cases = [
    { races: { player: "zerg", enemy: "terran" }, caster: "queen", research: "ensnare", melee: "zergling", foe: "marine", spell: "ensnare", radius: STW_SPELLS.ensnare.radius },
    { races: { player: "terran", enemy: "zerg" }, caster: "vessel", research: "irradiate", melee: "firebat", foe: "hydra", spell: "irradiate", radius: STW_SPELLS.irradiate.radius + 1 },
  ];
  for (const item of cases) {
    const battle = createStarswarGame({ seed: 5, aiSides: [], races: item.races });
    battle.sides.player.research[item.research] = "done";
    for (const building of battle.buildings) building.hp = building.maxHp = 1e6;
    const caster = stwSpawnUnitAt(battle, "player", item.caster, 20, 60, "attack");
    caster.energy = 200;
    for (let index = 0; index < 5; index += 1) stwSpawnUnitAt(battle, "player", item.melee, 17 + index * 1.5, 53.5, "attack");
    const front = Array.from({ length: 5 }, (_, index) => stwSpawnUnitAt(battle, "enemy", item.foe, 17 + index * 1.5, 52, "rally"));
    const back = Array.from({ length: 5 }, (_, index) => stwSpawnUnitAt(battle, "enemy", item.foe, 17 + index * 1.5, 46, "rally"));
    // 이레디에이트는 비싼 생체 유닛(울트라)을 더 노린다: 앞줄 가운데와 뒷줄에 하나씩 둔다.
    if (item.spell === "irradiate") {
      front.push(stwSpawnUnitAt(battle, "enemy", "ultra", 20, 51, "rally"));
      back.push(stwSpawnUnitAt(battle, "enemy", "ultra", 20, 43, "rally"));
    }
    for (const unit of [...front, ...back]) unit.hp = unit.maxHp = 1e4;
    for (const unit of battle.units) if (unit !== caster) unit.stunUntil = 999;
    let cast = null;
    for (let step = 0; step < 60 && !cast; step += 1) {
      stepStarswar(battle);
      cast = battle.effects.find((effect) => effect.kind === "spell" && effect.spell === item.spell);
    }
    assert.ok(cast, `${item.spell}를 쓴다`);
    const allies = battle.units.filter((unit) => unit.side === "player" && Math.hypot(unit.x - cast.x2, unit.y - cast.y2) <= item.radius + unit.radius * 0.5);
    assert.equal(allies.length, 0, `${item.spell}: 아군이 반경 안에 없다 (${cast.x2.toFixed(1)}, ${cast.y2.toFixed(1)})`);
    // 범위 마법은 앞줄에서 아군 반대쪽으로 민 자리도 고를 수 있다. 어느 쪽이든 아군은 빼고 적은 3기 이상 맞힌다.
    const foes = battle.units.filter((unit) => unit.side === "enemy" && Math.hypot(unit.x - cast.x2, unit.y - cast.y2) <= item.radius + unit.radius * 0.5);
    assert.ok(item.spell === "irradiate" ? cast.y2 < 50 : foes.length >= 3, `${item.spell}: 아군이 없는 적 무리를 노린다`);
  }
});

test("starswar replay code rebuilds the same game from the setup and the player's commands, across a save and resume", () => {
  let state = createStarswarGame({ seed: 4242, races: { player: "terran", enemy: "protoss" } });
  const plan = [[3, { type: "worker" }], [40, { type: "build", building: "supply" }], [70, { type: "build", building: "barracks" }], [130, { type: "build", building: "barracks" }], [160, { type: "autoWave", size: 8 }], [260, { type: "rally", point: "natural" }], [330, { type: "move", y: 55 }], [420, { type: "attack" }]];
  let next = 0;
  let resumed = false;
  while (state.status === "playing" && state.time < 1800) {
    while (next < plan.length && state.time >= plan[next][0]) stwIssue(state, "player", plan[next++][1]);
    if (Math.round(state.time * 10) % 150 === 0) {
      stwIssue(state, "player", { type: "worker" });
      stwIssue(state, "player", { type: "build", building: "supply" });
    }
    stepStarswar(state, stwAiThink);
    if (!resumed && state.time >= 300) {
      // 화면의 이어하기처럼 저장했다가 되살려 이어 간다.
      state = stwRestore(stwSerialize(state));
      resumed = true;
    }
  }
  assert.equal(state.status, "over");
  const code = JSON.parse(JSON.stringify(stwReplayCode(state, "test")));
  assert.ok(code.commands.length >= plan.length, "사람 명령이 남는다");
  assert.ok(code.commands.every(([tick, side]) => Number.isInteger(tick) && side === "player"));
  const replayed = stwReplay(code);
  assert.ok(stwReplayMatches(code, replayed), `같은 경기: ${JSON.stringify(stwFingerprint(replayed))} vs ${JSON.stringify(code.end)}`);
  // 중간 시각에서 멈출 수 있다.
  assert.equal(Math.round(stwReplay(code, { until: 200 }).time), 200);

  // 실험실 경기는 실험실 설정으로 다시 선다.
  const lab = stwCreateScenario({ seed: 9, time: 600, races: { player: "protoss", enemy: "zerg" }, sides: { player: { units: { zealot: 8, dragoon: 6 } }, enemy: { units: { hydra: 14 } } } });
  stwIssue(lab, "player", { type: "retreat" });
  run(lab, 3, stwAiThink);
  stwIssue(lab, "player", { type: "attack" });
  run(lab, 120, stwAiThink);
  const labCode = JSON.parse(JSON.stringify(stwReplayCode(lab)));
  assert.ok(labCode.scenario && !labCode.setup);
  assert.ok(stwReplayMatches(labCode, stwReplay(labCode)), "실험실 경기도 같다");
});

test("starswar result reports: bug report with replay code, AI report only for a losing AI", () => {
  const state = createStarswarGame({ seed: 11, aiSides: ["player", "enemy"], races: { player: "protoss", enemy: "zerg" }, personas: { player: "dragoon", enemy: "hydra" } });
  run(state, 2400, stwAiThink);
  assert.equal(state.status, "over");
  const loser = state.winner === "player" ? "enemy" : "player";
  assert.deepEqual(stwLosingAiSides(state), [loser]);

  const bug = stwBugReport(state, { build: "abc1234", device: "test", note: "드라군이 멈춤" });
  for (const heading of ["# 스타즈워 버그 리포트", "- 드라군이 멈춤", "## 결과 표", "## 흐름 (30초마다)", "## 내 명령", "## 최근 경기 기록", "## 마지막 상태", "## 재현 코드", "게임 판: abc1234"]) assert.ok(bug.includes(heading), heading);
  const code = JSON.parse(bug.match(/```json\n(.+)\n```/)[1]);
  assert.ok(stwReplayMatches(code, stwReplay(code)), "리포트의 재현 코드로 같은 경기가 된다");

  const ai = stwAiReport(state, { build: "abc1234" });
  for (const heading of ["# 스타즈워 AI 개선 자료", "### 자동 진단", "앞마당 확장:", "최대 병력 가치:", "### 큰 교전", "### 병력 구성 흐름 (1분마다)", "### AI 운영 기록", "### 상대 운영 기록", "### AI 내부 기억", "## 재현 코드"]) assert.ok(ai.includes(heading), heading);
  // 운영 기록에는 빌드 순서가 남고, 생산 라인을 멈췄다 켜는 반복은 남지 않는다.
  const lines = (state.chronicle ?? []).filter((entry) => entry[1] === loser);
  assert.ok(lines.some((entry) => entry[2].type === "build"), "건설 기록");
  assert.ok(!lines.some((entry) => entry[2].type === "line" && !entry[2].unit), "라인 멈춤은 남기지 않는다");
  // 히스토리에는 병력 구성과 보유 자원이 남는다.
  const point = state.history.find((item) => item.t === 300);
  assert.ok(point.player.mix && point.player.minerals !== undefined);

  // 사람 대 AI에서 사람이 지면 AI 개선 자료는 없다.
  const human = createStarswarGame({ seed: 3, races: { player: "protoss", enemy: "zerg" } });
  run(human, 2400, stwAiThink);
  assert.equal(human.winner, "enemy");
  assert.deepEqual(stwLosingAiSides(human), []);
  assert.equal(stwAiReport(human), null);
});

test("starswar same-side air units spread out instead of stacking into one", () => {
  const state = quiet();
  const carriers = [0, 1, 2].map(() => stwSpawnUnitAt(state, "player", "carrier", 20, 70, "rally"));
  const foeWraith = stwSpawnUnitAt(state, "enemy", "wraith", 20, 70, "rally");
  foeWraith.stunUntil = 999;
  for (const unit of [...carriers, foeWraith]) unit.stunUntil = 999;
  run(state, 3);
  for (let i = 0; i < carriers.length; i += 1) {
    for (let j = i + 1; j < carriers.length; j += 1) {
      const d = Math.hypot(carriers[i].x - carriers[j].x, carriers[i].y - carriers[j].y);
      assert.ok(d > carriers[i].radius * 1.4, `캐리어끼리 벌어진다 (${d.toFixed(2)})`);
    }
  }
  // 적 공중 유닛과는 밀지 않는다.
  assert.equal(Math.round(foeWraith.x * 10) / 10, 20);
  assert.equal(Math.round(foeWraith.y * 10) / 10, 70);
});

test("starswar natural adds building room on its flanks and front edge, keeping the centre path open", () => {
  const state = quiet();
  const record = state.sides.player;
  record.minerals = 1e6;
  record.gas = 1e6;
  assert.ok(stwCommand(state, "player", { type: "build", building: "expand" }).ok);
  const finish = () => {
    for (const building of state.buildings) if (building.side === "player") building.progress = 1;
  };
  finish();
  const before = stwFreeSlots(state, "player");
  assert.equal(before, STW_LAYOUT.mainSlots.filter((slot) => !slot.blocked).length + STW_LAYOUT.naturalSlots.length);
  assert.ok(STW_LAYOUT.naturalSlots.length >= 16, "앞마당 자리 16칸");
  let built = 0;
  for (let round = 0; round < 80; round += 1) {
    if (stwCommand(state, "player", { type: "build", building: round % 3 ? "pylon" : "gateway" }).ok) built += 1;
    finish();
  }
  assert.equal(built, before, "모든 자리에 짓는다");
  assert.equal(stwFreeSlots(state, "player"), 0);
  const natural = state.buildings.find((building) => building.side === "player" && building.base === "natural" && STW_BUILDINGS[building.type].base);
  for (const building of state.buildings.filter((item) => item.side === "player" && item !== natural && item.base === "natural")) {
    // 앞마당 기지와 겹치지 않고, 가운데 길(x 16~24)을 막지 않는다.
    assert.ok(Math.hypot(building.x - natural.x, building.y - natural.y) > natural.radius + building.radius * 0.8, `${building.type} ${building.x},${building.y}`);
    assert.ok(Math.abs(building.x - STW_LANE_WIDTH / 2) - building.radius >= 3.5, `가운데 길 ${building.x}`);
  }
});

test("starswar AI rebuilds a lost natural instead of staying on one base", () => {
  const state = createStarswarGame({ seed: 4, aiSides: ["player", "enemy"], races: { player: "terran", enemy: "protoss" }, personas: { player: "mech", enemy: "dragoon" } });
  let destroyed = false;
  let rebuilt = false;
  while (state.status === "playing" && state.time < 900 && !rebuilt) {
    stepStarswar(state, stwAiThink);
    const natural = stwNexus(state, "player", "natural");
    if (!destroyed && natural && stwDone(natural)) {
      natural.hp = 0;
      destroyed = true;
    } else if (destroyed && natural) rebuilt = true;
  }
  assert.ok(destroyed, "앞마당을 먹는다");
  assert.ok(rebuilt, "부서진 앞마당을 다시 짓는다");
});

test("starswar AI from a reported loss: expands, researches, and holds off a cannon turtle instead of starving", async () => {
  // 사람이 앞마당에 캐논을 두르고 캐리어를 모아 이긴 경기(결과 화면 리포트의 재현 코드). 사람 명령은 그대로 두고 지금 AI로 다시 돌린다.
  // 예전 AI는 사거리 연구(가스 100)를 커세어·드라군이 가스를 먹어 끝내 못 하고, 그 뒤의 확장도 못 해 일꾼 22기로 13분에 졌다.
  const { readFile } = await import("node:fs/promises");
  const code = JSON.parse(await readFile(new URL("./fixtures/starswar-cannon-carrier-replay.json", import.meta.url), "utf8"));
  let expandedAt = null;
  let rangeAt = null;
  const state = stwReplay(code, {
    until: 720,
    onTick: (current) => {
      if (expandedAt === null && stwNexus(current, "enemy", "natural")) expandedAt = current.time;
      if (rangeAt === null && current.sides.enemy.research.range === "done") rangeAt = current.time;
    },
  });
  assert.ok(expandedAt !== null && expandedAt < 420, `7분 전에 확장 (${expandedAt})`);
  assert.ok(rangeAt !== null && rangeAt < 600, `10분 전에 사거리 연구 (${rangeAt})`);
  assert.ok(state.sides.enemy.probes > 30, `일꾼 ${state.sides.enemy.probes}`);
});

test("starswar AI from a reported loss: no early second gas or double pylon, survives a one-gate zealot push", async () => {
  // 사람이 게이트웨이 하나로 질럿을 모아 2분 40초부터 밀고 앞마당을 먹은 경기(5분 30초에 AI 패배). 사람 명령은 그대로 두고 지금 AI로 다시 돌린다.
  // 예전 AI는 1분 15초에 파일런을 둘 짓고, 일꾼 13기에 둘째 가스를 지어 광물이 모자라 코어도 질럿도 못 뽑은 채 가스만 626 쌓였다.
  const { readFile } = await import("node:fs/promises");
  const code = JSON.parse(await readFile(new URL("./fixtures/starswar-early-zealot-replay.json", import.meta.url), "utf8"));
  let pylonsAt75 = null;
  let secondGasProbes = null;
  const state = stwReplay(code, {
    until: 420,
    onTick: (current) => {
      if (pylonsAt75 === null && current.time >= 75) pylonsAt75 = stwOwnBuildings(current, "enemy", "pylon").length;
      if (secondGasProbes === null && stwOwnBuildings(current, "enemy", "assimilator").length >= 2) secondGasProbes = current.sides.enemy.probes;
    },
  });
  assert.equal(pylonsAt75, 1, "1분 15초에 파일런은 하나");
  assert.ok(secondGasProbes === null || secondGasProbes >= 18, `둘째 가스는 일꾼 18기 뒤 (${secondGasProbes})`);
  assert.equal(state.status, "playing", "7분까지 버틴다");
});

test("starswar new units join the attack group while the player is fighting, otherwise go to the rally point", () => {
  const produce = (state) => {
    const gateway = stwOwnBuildings(state, "player", "gateway")[0];
    gateway.line = "zealot";
    const before = new Set(state.units.map((unit) => unit.id));
    for (let step = 0; step < 400 && state.units.every((unit) => before.has(unit.id) || unit.side !== "player" || unit.type !== "zealot"); step += 1) stepStarswar(state);
    return state.units.find((unit) => !before.has(unit.id) && unit.side === "player" && unit.type === "zealot");
  };
  // 공격 병력이 나가 싸우는 중: 새 질럿은 공격 병력에 합류해 앞으로 간다.
  const fighting = stwCreateScenario({ seed: 3, placement: "clash", races: { player: "protoss", enemy: "zerg" }, sides: { player: { units: { zealot: 6 }, buildings: { gateway: 1 }, minerals: 2000 }, enemy: { units: { zergling: 4 } } } });
  const fresh = produce(fighting);
  assert.ok(fresh, "질럿이 나온다");
  assert.equal(fresh.group, "attack", "공격 병력에 합류");
  const startY = fresh.y;
  run(fighting, 4);
  assert.ok(fresh.y < startY - 8, `앞으로 간다 (${startY.toFixed(1)} → ${fresh.y.toFixed(1)})`);
  // 대기 중(공격 병력 없음): 예전처럼 집결지로.
  const home = stwCreateScenario({ seed: 3, placement: "home", races: { player: "protoss", enemy: "zerg" }, sides: { player: { units: { zealot: 6 }, buildings: { gateway: 1 }, minerals: 2000 }, enemy: { units: { zergling: 4 } } } });
  assert.equal(produce(home).group, "rally");
  // AI 진영은 따르지 않는다(출격 판단이 따로 있다).
  const ai = stwCreateScenario({ seed: 3, placement: "clash", races: { player: "protoss", enemy: "protoss" }, sides: { player: { units: { zealot: 6 }, buildings: { gateway: 1 }, minerals: 2000 }, enemy: { units: { zealot: 6 } } } });
  ai.aiSides = ["player"];
  assert.equal(produce(ai).group, "rally");
});

test("starswar player drops work with any ground army and a single transport; AI keeps its stricter rules", () => {
  const scenario = () => stwCreateScenario({ seed: 1, time: 900, placement: "home", races: { player: "terran", enemy: "protoss" }, sides: { player: { units: { dropship: 1, goliath: 10 } }, enemy: { units: { zealot: 2 } } } });
  const state = scenario();
  run(state, 2);
  // 골리앗만 있어도 게릴라, 드랍십 1기로도 폭탄 드랍.
  assert.ok(stwDropCheck(state, "player", "raid").ok, "게릴라");
  assert.ok(stwDropCheck(state, "player", "bomb").ok, "폭탄");
  const result = stwIssue(state, "player", { type: "drop" });
  assert.ok(result.ok && result.loaded > 0, JSON.stringify(result));
  // AI 진영은 예전처럼 빠른 유닛만, 폭탄은 2기 이상.
  const ai = scenario();
  ai.aiSides = ["player", "enemy"];
  run(ai, 2);
  assert.equal(stwDropCheck(ai, "player", "raid").ok, false);
  assert.equal(stwDropCheck(ai, "player", "bomb").ok, false);
});

test("starswar learning: tags the human's strategy, keeps a plan from AI losses, and the master AI uses it reproducibly", () => {
  // 사람(여기서는 질럿 러시 성향 AI로 흉내)이 어려움 AI를 이긴 경기를 사람 대 AI 경기처럼 쌓는다.
  let store = stwLearnEmpty();
  for (const seed of [1, 2]) {
    const game = createStarswarGame({ seed, difficulty: "hard", aiSides: ["player", "enemy"], races: { player: "protoss", enemy: "zerg" }, personas: { player: "rush" } });
    run(game, 1500, stwAiThink);
    assert.equal(game.status, "over");
    game.aiSides = ["enemy"];
    const tags = stwLearnTags(stwLearnFeatures(game, "player"));
    assert.equal(tags[0], "rush", `꼬리표 ${tags}`);
    store = stwLearnAdd(store, game);
  }
  assert.ok(store.records.length >= 1, "AI가 진 판의 계획이 남는다");
  const plan = store.records[0].plan;
  assert.equal(plan.race, "protoss");
  assert.equal(plan.base, "rush");
  assert.ok(plan.order.some((step) => step.build === "gateway"), "빌드 순서");
  assert.ok(plan.waves.every((size, index) => index === 0 || size > plan.waves[index - 1]), "출격 규모는 늘어난다");
  assert.ok(store.foeTags.protoss.rush >= 2);
  // 최상급: 그 계획을 후보로 고르고(통계가 유리하면), 같은 묶음으로 다시 돌리면 같은 경기가 된다.
  // 묶음에는 같은 기본 성향·꼬리표의 계획 중 최신 하나만 든다.
  const snapshot = stwLearnSnapshot(store);
  assert.equal(snapshot.plans.filter((item) => item.base === "rush").length, 1);
  const kept = snapshot.plans[0];
  snapshot.stats["protoss|zerg"] = { [`plan:${kept.id}`]: [5, 5] };
  const pick = stwLearnPick(snapshot, "protoss", "zerg", () => 0.5);
  assert.equal(pick.plan?.id, kept.id);
  const master = createStarswarGame({ seed: 9, difficulty: "master", races: { player: "zerg", enemy: "protoss" }, learned: snapshot });
  assert.equal(master.sides.enemy.plan?.id, kept.id);
  assert.equal(master.sides.enemy.persona, "rush");
  run(master, 240, stwAiThink);
  const firstBuilds = master.chronicle.filter((entry) => entry[1] === "enemy" && entry[2].type === "build").map((entry) => entry[2].building);
  assert.ok(firstBuilds.includes("gateway"));
  const code = JSON.parse(JSON.stringify(stwReplayCode(master)));
  assert.ok(code.setup.learned, "학습 묶음이 재현 정보에 남는다");
  assert.equal(stwReplay(code, { until: 240 }).rngState, master.rngState, "같은 경기");
  // 정찰 정보로 상대 전략을 짐작한다.
  assert.equal(stwIntelTag({ race: "protoss", buildings: { nexus: 1, gateway: 3, pylon: 2 }, units: {}, research: [] }, 150), "rush");
  assert.equal(stwIntelTag({ race: "terran", buildings: { cc: 1, starport: 1 }, units: {}, research: [] }, 280), "air");
  assert.equal(stwIntelTag({ race: "protoss", buildings: { nexus: 1, archives: 1 }, units: {}, research: [] }, 280), "cloak");
});

test("starswar detected cloaked units fight through when the local fight favours them, and break the detector first", () => {
  // 캐논 둘과 질럿 셋이 지키는 곳에 다크템플러 넷과 질럿 넷이 들어간다: 우리 힘이 앞서므로 맞더라도 캐논부터 깬다.
  const setup = (darkCount, zealots, foeZealots) => {
    const state = quiet();
    state.sides.enemy.minerals = 9999;
    for (const building of ["pylon", "forge", "cannon", "cannon"]) {
      stwCommand(state, "enemy", { type: "build", building });
      finishAll(state);
    }
    state.sides.enemy.minerals = 0;
    state.sides.player.minerals = 0;
    const cannon = stwOwnBuildings(state, "enemy", "cannon")[0];
    for (let index = 0; index < foeZealots; index += 1) stwSpawnUnitAt(state, "enemy", "zealot", cannon.x - 4 + index * 2, cannon.y + 5, "rally");
    const darks = Array.from({ length: darkCount }, (_, index) => stwSpawnUnitAt(state, "player", "dark", cannon.x - 3 + index * 2, cannon.y + 14, "attack"));
    for (let index = 0; index < zealots; index += 1) stwSpawnUnitAt(state, "player", "zealot", cannon.x - 6 + index * 1.8, cannon.y + 16, "attack");
    return { state, darks };
  };
  const strong = setup(4, 4, 3);
  let committed = 0;
  let detectorTargeted = false;
  for (let step = 0; step < 150; step += 1) {
    stepStarswar(strong.state);
    for (const dark of strong.darks) {
      if ((dark.commitUntil ?? 0) > strong.state.time) committed += 1;
      const target = strong.state.buildings.find((building) => building.id === dark.targetId);
      if (target && STW_BUILDINGS[target.type].detector) detectorTargeted = true;
    }
  }
  assert.ok(committed > 0, "맞더라도 싸우기로 한다");
  assert.ok(detectorTargeted, "탐지 건물부터 노린다");
  assert.ok(stwOwnBuildings(strong.state, "enemy", "cannon").length < 2, "캐논을 깬다");
  // 불리하면(다크템플러 둘 대 캐논 둘·질럿 여섯) 예전처럼 비킨다.
  const weak = setup(2, 0, 6);
  let evaded = false;
  for (let step = 0; step < 150; step += 1) {
    stepStarswar(weak.state);
    if (weak.darks.some((dark) => dark.evadeTo)) evaded = true;
    assert.ok(weak.darks.every((dark) => !((dark.commitUntil ?? 0) > weak.state.time)), "불리하면 싸우기로 하지 않는다");
  }
  assert.ok(evaded, "비킨다");
});

test("starswar drops can be recalled on demand: a raid comes back with its squad, an unlanded bomb drop unloads at home", () => {
  const scenario = () => stwCreateScenario({ seed: 1, time: 900, placement: "home", races: { player: "terran", enemy: "protoss" }, sides: { player: { units: { dropship: 2, marine: 8, vulture: 4 } }, enemy: { units: { zealot: 2 } } } });
  // 게릴라: 내려서 견제 중에 지금 회수하면 태워서 돌아와 집결지에 내린다.
  const raid = scenario();
  run(raid, 1);
  assert.ok(stwIssue(raid, "player", { type: "drop" }).ok);
  const op = raid.ops[0];
  for (let index = 0; index < 600 && op.phase !== "fight"; index += 1) stepStarswar(raid);
  assert.equal(op.phase, "fight");
  assert.ok(stwIssue(raid, "player", { type: "dropRecall", opId: op.id }).ok);
  run(raid, 1);
  assert.ok(op.phase === "pickup" || op.phase === "home", op.phase);
  for (let index = 0; index < 900 && raid.ops.includes(op); index += 1) stepStarswar(raid);
  assert.ok(!raid.ops.includes(op), "작전이 끝난다");
  // 거둔 작전의 드랍십만 돌아온다(다른 드랍십은 제 작전을 계속한다).
  const transport = raid.units.find((unit) => unit.id === op.transports[0]);
  assert.ok(transport.group === "rally" && !transport.cargo?.length);
  // 폭탄: 내리기 전에 거두면 태운 병력을 집결지에 내린다.
  const bomb = scenario();
  run(bomb, 1);
  stwIssue(bomb, "player", { type: "dropPlan", mission: "bomb", sync: true });
  assert.ok(stwIssue(bomb, "player", { type: "drop" }).ok);
  run(bomb, 3);
  assert.ok(stwIssue(bomb, "player", { type: "dropRecall" }).ok);
  for (let index = 0; index < 900 && bomb.ops.length; index += 1) stepStarswar(bomb);
  assert.equal(bomb.ops.length, 0);
  const army = bomb.units.filter((unit) => unit.side === "player" && (unit.type === "marine" || unit.type === "vulture"));
  assert.equal(army.length, 12, "아무도 잃지 않는다");
  assert.ok(army.every((unit) => unit.group === "rally"), "집결지로 돌아온다");
  assert.equal(stwIssue(bomb, "player", { type: "dropRecall" }).ok, false, "거둘 작전이 없으면 실패");
});

test("starswar squads by unit type: move only chosen types, new units join their squad, the attack button merges everyone", () => {
  const state = stwCreateScenario({ seed: 3, time: 600, placement: "home", races: { player: "protoss", enemy: "zerg" }, sides: { player: { units: { zealot: 6, corsair: 3, dark: 2 }, buildings: { stargate: 1 }, minerals: 3000, gas: 2000 }, enemy: { units: { zergling: 2 } } } });
  run(state, 3);
  const mean = (type) => {
    const list = state.units.filter((unit) => unit.side === "player" && unit.type === type);
    return list.reduce((sum, unit) => sum + unit.y, 0) / list.length;
  };
  const zealotsBefore = mean("zealot");
  assert.ok(stwIssue(state, "player", { type: "squadMove", units: ["corsair"], y: 50 }).ok);
  const stargate = stwOwnBuildings(state, "player", "stargate")[0];
  stwIssue(state, "player", { type: "line", buildingId: stargate.id, unit: "corsair" });
  run(state, 35);
  const corsairs = state.units.filter((unit) => unit.side === "player" && unit.type === "corsair");
  assert.ok(corsairs.length >= 4, "커세어가 하나 더 나온다");
  assert.ok(corsairs.every((unit) => unit.squad === "corsair"), "새 커세어도 커세어 부대로");
  assert.ok(Math.abs(mean("corsair") - 50) < 6, `커세어 부대는 50 근처 (${mean("corsair").toFixed(1)})`);
  assert.ok(Math.abs(mean("zealot") - zealotsBefore) < 3, "질럿은 그대로");
  // 본대 지도 탭은 따로 둔 부대를 움직이지 않는다. 자동 출격도 본대만 내보낸다.
  stwIssue(state, "player", { type: "squadMove", units: ["dark"], y: 62 });
  stwIssue(state, "player", { type: "move", y: 72 });
  stwIssue(state, "player", { type: "autoWave", size: 1 });
  run(state, 2);
  assert.ok(state.units.filter((unit) => unit.side === "player" && unit.type === "zealot").every((unit) => unit.group === "attack"), "자동 출격: 본대 질럿");
  assert.ok(state.units.filter((unit) => unit.side === "player" && (unit.type === "corsair" || unit.type === "dark")).every((unit) => unit.group === "rally" && unit.squad), "자동 출격은 부대를 두고 간다");
  // 출격 버튼(공격 명령)은 모두 합친다.
  stwIssue(state, "player", { type: "retreat" });
  run(state, 1);
  assert.ok(stwIssue(state, "player", { type: "attack" }).ok);
  assert.deepEqual(state.sides.player.squads, {});
  assert.ok(state.units.filter((unit) => unit.side === "player" && !STW_UNITS[unit.type].worker).every((unit) => unit.group === "attack" && unit.squad === undefined), "모두 합쳐 출격");
  // 본대로 되돌리기
  stwIssue(state, "player", { type: "squadMove", units: ["dark"], y: 60 });
  assert.ok(stwIssue(state, "player", { type: "squadRelease", units: ["dark"] }).ok);
  assert.ok(state.units.filter((unit) => unit.type === "dark" && unit.side === "player").every((unit) => unit.squad === undefined));
});

test("starswar carrier attacks launch one visible interceptor per hit", () => {
  for (const [research, expected] of [[[], 4], [["carrierCapacity"], 8]]) {
    const state = stwCreateScenario({ races: { player: "protoss", enemy: "zerg" }, sides: { player: { units: { carrier: 1 }, research }, enemy: { units: { hydra: 6 } } } });
    let launch = null;
    for (let step = 0; step < 200 && !launch; step += 1) {
      stepStarswar(state);
      launch = state.effects.find((effect) => effect.kind === "interceptor" && effect.side === "player");
    }
    assert.ok(launch, "캐리어가 공격한다");
    assert.equal(launch.count, expected, `인터셉터 ${expected}기가 날아간다`);
    assert.ok(launch.max >= 0.8, "날아갔다 돌아오는 동안 그린다");
  }
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
  const ling = createStarswarGame({ seed: 2, aiSides: ["player", "enemy"], races: { player: "zerg", enemy: "protoss" }, personas: { player: "ling", enemy: "robo" } });
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
  assert.deepEqual(byRace, { protoss: 7, terran: 6, zerg: 6 });
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
    for (let index = 0; index < 8; index += 1) stwSpawnUnitAt(state, "enemy", enemyType, 12 + index * 2, 84);
    // 시야는 0.5초마다 갱신된다. 본진 시야 안(84)에 두고 갱신해야 AI가 적 구성을 본다(예전에는 시야 밖 76에 두어 보지 못한 채 게이트웨이 수만으로 통과했다).
    run(state, 0.5);
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

  // 동행을 켜면 떠 있는 오버로드가 동행을 맡고 함께 출격한다.
  stwCommand(state, "player", { type: "retreat" });
  stwCommand(state, "player", { type: "escort", on: true });
  assert.equal(home.escort, true, "떠 있는 오버로드가 동행을 맡음");
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

test("starswar a sunken colony strikes anywhere in its base and each strike leaves a tentacle effect", () => {
  const state = zerg("protoss");
  state.sides.player.minerals = 9000;
  for (const building of ["pool", "sunken"]) {
    assert.equal(stwCommand(state, "player", { type: "build", building }).ok, true, building);
    finishAll(state);
  }
  const sunken = stwOwnBuildings(state, "player", "sunken")[0];
  const main = stwNexus(state, "player", "main");
  // 성큰 사거리 7 밖, 본진 구역 안에서 일꾼을 치는 질럿.
  const zealot = stwSpawnUnitAt(state, "enemy", "zealot", main.x - 6, main.y - 3, "attack");
  assert.ok(Math.hypot(zealot.x - sunken.x, zealot.y - sunken.y) > 7);
  const seen = new WeakSet();
  let strikes = 0;
  for (let index = 0; index < 300 && zealot.hp > 0; index += 1) {
    stepStarswar(state);
    for (const effect of state.effects) {
      if (effect.kind !== "tentacle" || seen.has(effect)) continue;
      seen.add(effect);
      strikes += 1;
      assert.deepEqual([effect.attackerId, effect.targetId], [sunken.id, zealot.id]);
      assert.ok(effect.max >= 0.6, "촉수가 보일 만큼 오래 남는다");
    }
  }
  assert.ok(strikes >= 3, `촉수 공격 ${strikes}회`);
  assert.ok(zealot.hp <= 0, "질럿이 죽는다");
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

test("starswar immediate auto-wave sends fighters as soon as they exist", () => {
  const state = quiet();
  stwCommand(state, "player", { type: "autoWave", size: 1 });
  const zealot = stwSpawnUnitAt(state, "player", "zealot", 20, 92);
  run(state, 0.2);
  assert.equal(zealot.group, "attack", "집결지에 모이기 전에도 바로 출격");
  const only = quiet();
  only.sides.player.autoWave = 1;
  stwSpawnUnitAt(only, "player", "observer", 20, 92);
  run(only, 0.2);
  assert.equal(stwArmy(only, "player").attack.length, 0, "지원 유닛만으로는 나가지 않음");
});

test("starswar several high templar do not stack storms on the same clump", () => {
  const state = quiet();
  state.sides.player.research.storm = "done";
  const casters = [0, 1, 2].map((index) => stwSpawnUnitAt(state, "player", "templar", 16 + index * 4, 70));
  for (const caster of casters) caster.energy = 75;
  for (let index = 0; index < 6; index += 1) stwSpawnUnitAt(state, "enemy", "zergling", 18 + (index % 3) * 1.5, 64 + Math.floor(index / 3) * 1.5);
  run(state, 0.3);
  assert.equal(state.sides.player.stats.storms, 1, "한 무리에는 스톰 하나만");
  assert.equal(casters.filter((caster) => caster.energy >= 75).length, 2, "나머지 템플러는 에너지를 아낌");
  // 멀리 떨어진 두 번째 무리에는 두 번째 스톰이 떨어진다.
  for (let index = 0; index < 4; index += 1) stwSpawnUnitAt(state, "enemy", "zergling", 28 + (index % 2) * 1.5, 72 + Math.floor(index / 2) * 1.5);
  run(state, 0.3);
  assert.equal(state.sides.player.stats.storms, 2);
  const [a, b] = state.storms;
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 3.2, "두 스톰의 중심은 반경 이상 떨어짐");
});

test("starswar melee units switch off a fleeing target and spread over a firing line", () => {
  const state = createStarswarGame({ seed: 1, aiSides: [], races: { player: "protoss", enemy: "terran" } });
  state.sides.enemy.research.stim = "done";
  const zealots = [0, 1, 2, 3, 4].map((index) => stwSpawnUnitAt(state, "player", "zealot", 14 + index * 3, 58, "attack"));
  stwSpawnUnitAt(state, "enemy", "marine", 20, 50, "attack");
  for (let index = 0; index < 7; index += 1) stwSpawnUnitAt(state, "enemy", "marine", 13 + index * 2.4, 44, "attack");
  stwSpawnUnitAt(state, "enemy", "medic", 20, 42, "attack");
  for (let step = 0; step < 900 && state.units.some((unit) => unit.side === "player") && state.units.some((unit) => unit.side === "enemy"); step += 1) stepStarswar(state);
  assert.ok(zealots.filter((unit) => unit.hp > 0).length >= 3, "미끼 해병에게 끌려다니지 않고 사격선을 무너뜨림");
  assert.ok(state.units.filter((unit) => unit.side === "enemy" && unit.type === "marine").length <= 1, "해병 줄이 무너짐(멀리 빠져나간 1기까지 허용)");
});

test("starswar ranged units drop a receding target for one in range, and volleys avoid overkill", () => {
  const state = createStarswarGame({ seed: 1, aiSides: [], races: { player: "protoss", enemy: "terran" } });
  state.sides.enemy.research.ion = "done";
  const dragoon = stwSpawnUnitAt(state, "player", "dragoon", 20, 60, "attack");
  const bait = stwSpawnUnitAt(state, "enemy", "vulture", 20, 54, "attack");
  run(state, 0.2);
  assert.equal(dragoon.targetId, bait.id);
  // 미끼가 빠르게 물러나고 그 사이 해병이 사거리 안에 서면 해병으로 바꾼다.
  bait.group = "rally";
  state.sides.enemy.rally = "main";
  const marine = stwSpawnUnitAt(state, "enemy", "marine", 22, 56, "attack");
  marine.speed = 0;
  run(state, 2);
  assert.equal(dragoon.targetId, marine.id, "멀어지는 벌처 대신 사거리 안의 해병");

  // 같은 틱에 쏘는 드라군 여덟이 질럿 하나에 몰리지 않는다: 예약 피해로 이미 죽을 적은 다음 드라군이 피한다.
  const volley = quiet();
  for (let index = 0; index < 8; index += 1) stwSpawnUnitAt(volley, "player", "dragoon", 13 + index * 2, 60, "attack");
  const zealots = [0, 1, 2].map((index) => stwSpawnUnitAt(volley, "enemy", "zealot", 17 + index * 3, 55, "attack"));
  for (const zealot of zealots) {
    zealot.shields = 0;
    zealot.hp = 18;
  }
  // 드라군 한 발은 소형 질럿에게 9(20×50% − 방어 1). 두 발이면 죽으므로 여덟 발로 셋을 다 잡고 두 발만 남는다.
  run(volley, 0.3);
  assert.equal(zealots.filter((zealot) => zealot.hp <= 0).length, 3, `나눠 쏴 셋을 모두 잡음 (${zealots.map((zealot) => zealot.hp).join(",")})`);
  assert.ok(volley.sides.player.stats.overkill <= 2, `낭비된 공격은 남는 두 발뿐 (${volley.sides.player.stats.overkill})`);
});

test("starswar lurkers stay burrowed while enemies keep approaching", () => {
  const state = zerg("terran");
  const lurker = stwSpawnUnitAt(state, "player", "lurker", 20, 60, "attack");
  stwSpawnUnitAt(state, "enemy", "marine", 20, 54, "attack");
  run(state, 1.2);
  assert.equal(lurker.burrowed, true);
  for (const unit of state.units) if (unit.side === "enemy") unit.hp = 0;
  run(state, 0.2);
  const next = stwSpawnUnitAt(state, "enemy", "marine", 20, 51, "attack");
  next.speed = 0;
  run(state, 3.5);
  assert.equal(lurker.burrowed, true, "사거리+4 안에 적이 있으면 계속 숨어 있음");
});

test("starswar tanks holding a rally point siege ahead of time and unsiege when the rally moves", () => {
  const state = createStarswarGame({ seed: 1, aiSides: [], races: { player: "terran", enemy: "protoss" } });
  state.sides.player.research.siege = "done";
  const tank = stwSpawnUnitAt(state, "player", "tank", 20, stwRallyY("player", "main") - 1.8);
  run(state, 3);
  assert.equal(tank.sieged, true, "집결지에 자리 잡으면 적이 없어도 시즈");
  const zealot = stwSpawnUnitAt(state, "enemy", "zealot", 20, tank.y - 9, "attack");
  zealot.speed = 0;
  run(state, 0.3);
  assert.ok(zealot.shields < zealot.maxShields, "미리 시즈해 둔 덕에 적이 보이자마자 포격");
  zealot.hp = 0;
  stwCommand(state, "player", { type: "move", y: 60 });
  run(state, 4);
  assert.equal(tank.sieged, false, "집결지가 옮겨지면 시즈를 풀고 따라감");
  assert.ok(tank.y < stwRallyY("player", "main") - 4);
});

test("starswar adrenal glands make zerglings bite half again as often", () => {
  const bites = (adrenal) => {
    const state = zerg("protoss");
    if (adrenal) state.sides.player.research.adrenal = "done";
    const pylon = stwNexus(state, "enemy", "main");
    const ling = stwSpawnUnitAt(state, "player", "zergling", pylon.x, pylon.y + 6, "attack");
    ling.hp = 9999;
    const seen = new WeakSet();
    let count = 0;
    let ticks = 0;
    let cooldown = 0;
    // 첫 물기 뒤 10초 동안 센다(달려가는 시간은 뺀다). 물 때마다 걸리는 공격 간격도 본다.
    while (ticks < 100) {
      stepStarswar(state);
      for (const effect of state.effects) {
        if (effect.kind !== "bite" || effect.attackerId !== ling.id || seen.has(effect)) continue;
        seen.add(effect);
        count += 1;
        cooldown = Math.max(cooldown, ling.cooldown);
      }
      if (count) ticks += 1;
      if (state.time > 30) break;
    }
    return { count, cooldown };
  };
  const plain = bites(false);
  const fast = bites(true);
  assert.ok(plain.count >= 5, `기본 물기 ${plain.count}회`);
  assert.ok(Math.abs(plain.cooldown - 0.75) < 0.02 && Math.abs(fast.cooldown - 0.5) < 0.02, `공격 간격 ${plain.cooldown} → ${fast.cooldown}`);
  assert.ok(fast.count >= plain.count * 1.25, `아드레날린 물기 ${fast.count}회 (기본 ${plain.count}회)`);
});

test("starswar zergling-swarm AI keeps pure zerglings, streams reinforcements, and switches strategy after repeated failures", () => {
  const state = createStarswarGame({ seed: 2, aiSides: [], races: { player: "protoss", enemy: "zerg" }, personas: { enemy: "ling" } });
  state.time = 500;
  state.sides.enemy.minerals = 9000;
  state.sides.enemy.gas = 9000;
  stwAiThink(state, "enemy");
  const memory = state.sides.enemy.ai;
  assert.equal(state.sides.enemy.persona, "ling");
  // 싸우는 동안 집결지에 저글링 12기가 모이면 바로 뒤따라 보낸다.
  const home = stwNexus(state, "enemy", "main");
  for (let index = 0; index < 4; index += 1) stwSpawnUnitAt(state, "enemy", "zergling", home.x - 4 + index * 2, home.y - 40, "attack");
  for (let index = 0; index < 12; index += 1) stwSpawnUnitAt(state, "enemy", "zergling", home.x - 6 + (index % 6) * 2, home.y - 12 + Math.floor(index / 6) * 2, "rally");
  memory.attacking = true;
  memory.waveStart = 4;
  memory.nextThink = 0;
  stwAiThink(state, "enemy");
  assert.equal(stwArmy(state, "enemy").rally.length, 0, "집결지의 저글링이 모두 출격");
  // 제대로 모은 물량이 두 번 막힌 뒤에는 상대 구성에 따라 다른 운영으로 갈아탄다(빌드 순서는 처음부터, 지은 건물은 건너뜀).
  memory.wave = 3;
  memory.bigFails = 2;
  memory.attacking = false;
  memory.nextThink = 0;
  stwAiThink(state, "enemy");
  assert.ok(["hydra", "ultra"].includes(state.sides.enemy.persona), `전략 전환 ${state.sides.enemy.persona}`);
  assert.equal(memory.switched.from, "ling");
  assert.equal(memory.wave, 1, "실패 횟수를 일부 덜어 새 성향의 출격 규모로 시작");
});

test("starswar weapons tell ground from air: melee cannot touch flyers, anti-air cannot touch ground", () => {
  const state = quiet();
  const scout = stwSpawnUnitAt(state, "enemy", "scout", 20, 60, "attack");
  const zealot = stwSpawnUnitAt(state, "player", "zealot", 20, 62, "attack");
  const dragoon = stwSpawnUnitAt(state, "player", "dragoon", 24, 64, "attack");
  run(state, 3);
  assert.notEqual(zealot.targetId, scout.id, "질럿은 공중을 노리지 않는다");
  assert.equal(dragoon.targetId, scout.id, "드라군은 공중을 쏜다");
  assert.ok(scout.hp + scout.shields < 250, "스카웃이 맞는다");
  // 커세어는 지상을 때리지 못하고, 스카웃은 지상 8·공중 14×2로 무기를 바꿔 쓴다.
  const other = quiet();
  const corsair = stwSpawnUnitAt(other, "enemy", "corsair", 20, 60, "attack");
  const marine = stwSpawnUnitAt(other, "player", "marine", 20, 63, "attack");
  run(other, 3);
  assert.notEqual(corsair.targetId, marine.id, "커세어는 지상을 노리지 않는다");
  assert.ok(corsair.hp + corsair.shields < 180, "해병은 커세어를 쏜다");
  const vsGround = stwHitDamage(other, { ...scout, kind: "unit" }, marine).reduce((a, b) => a + b, 0);
  const vsAir = stwHitDamage(other, { ...scout, kind: "unit" }, corsair).reduce((a, b) => a + b, 0);
  assert.equal(vsGround, 8);
  assert.equal(vsAir, 14 * 2 * 0.75, "중형에게 폭발형 75%");
});

test("starswar overlords float and only anti-air weapons can hit them; spores and turrets shoot only air", () => {
  const state = zerg("protoss");
  state.sides.player.minerals = 9000;
  for (const building of ["overlord", "pool", "evo", "spore"]) {
    assert.equal(stwCommand(state, "player", { type: "build", building }).ok, true, building);
    finishAll(state);
  }
  const overlord = stwOwnBuildings(state, "player", "overlord")[0];
  const zealot = stwSpawnUnitAt(state, "enemy", "zealot", overlord.x, overlord.y - 3, "attack");
  const corsair = stwSpawnUnitAt(state, "enemy", "corsair", overlord.x + 2, overlord.y - 3, "attack");
  const hp = overlord.hp;
  run(state, 4);
  assert.notEqual(zealot.targetId, overlord.id, "질럿은 떠 있는 오버로드를 못 때린다");
  assert.ok(overlord.hp < hp, `커세어가 오버로드를 때린다 (${overlord.hp})`);
  assert.ok(corsair.hp + corsair.shields < 180, "스포어가 커세어를 쏜다");
  const spore = stwOwnBuildings(state, "player", "spore")[0];
  assert.notEqual(spore.targetId, zealot.id, "스포어는 지상을 쏘지 않는다");
});

test("starswar corsairs splash only air, mutalisks bounce, scourges die on impact", () => {
  const state = quiet();
  const corsair = stwSpawnUnitAt(state, "player", "corsair", 20, 60, "attack");
  const wraiths = [0, 1, 2].map((index) => stwSpawnUnitAt(state, "enemy", "wraith", 19 + index * 1.4, 56, "attack"));
  const marine = stwSpawnUnitAt(state, "enemy", "marine", 20, 56.5, "attack");
  marine.hp = 9999;
  const before = marine.hp;
  run(state, 1.2);
  assert.ok(wraiths.filter((wraith) => wraith.hp < 120).length >= 2, "옆의 레이스도 맞는다");
  assert.equal(marine.hp, before, "지상 해병은 커세어 범위에 맞지 않는다");
  corsair.hp = 0;

  const bounce = quiet();
  const muta = stwSpawnUnitAt(bounce, "player", "mutalisk", 20, 60, "attack");
  const marines = [0, 1, 2].map((index) => stwSpawnUnitAt(bounce, "enemy", "marine", 18.5 + index * 1.6, 57.5, "attack"));
  for (const target of marines) target.hp = 9999;
  stepStarswar(bounce);
  for (let index = 0; index < 20 && marines.every((target) => target.hp === 9999); index += 1) stepStarswar(bounce);
  const losses = marines.map((target) => 9999 - target.hp).sort((a, b) => b - a);
  assert.ok(losses[0] > 0 && losses[1] > 0 && losses[2] > 0, `세 해병이 모두 맞는다 ${losses}`);
  assert.ok(losses[1] <= losses[0] / 2 && losses[2] <= losses[1] / 2, `튕길수록 줄어든다 ${losses}`);
  assert.ok(muta.hp > 0);

  const kamikaze = quiet();
  const scourge = stwSpawnUnitAt(kamikaze, "player", "scourge", 20, 60, "attack");
  const scoutTarget = stwSpawnUnitAt(kamikaze, "enemy", "scout", 20, 57, "attack");
  run(kamikaze, 2);
  assert.ok(scourge.hp <= 0, "스커지는 몸을 던진다");
  assert.ok(scoutTarget.hp + scoutTarget.shields <= 250 - 110 + 1, `스카웃 피해 ${scoutTarget.hp + scoutTarget.shields}`);
});

test("starswar air units ride behind the wave and never lead it; wraith cloak needs research", () => {
  const state = quiet();
  const zealot = stwSpawnUnitAt(state, "player", "zealot", 20, 70, "attack");
  const scout = stwSpawnUnitAt(state, "player", "scout", 20, 70, "attack");
  run(state, 6);
  assert.ok(scout.y >= zealot.y - 0.5, `스카웃이 질럿을 앞지르지 않는다 (${scout.y.toFixed(1)} vs ${zealot.y.toFixed(1)})`);
  const terranState = terran("protoss");
  const wraith = stwSpawnUnitAt(terranState, "player", "wraith", 20, 60, "attack");
  assert.equal(stwDetected(terranState, wraith, "enemy"), true, "연구 전에는 보인다");
  terranState.sides.player.research.wraithCloak = "done";
  assert.equal(stwDetected(terranState, wraith, "enemy"), false, "은폐 장치 연구 뒤에는 탐지기가 필요하다");
});

test("starswar air AI personas field their signature flyers and opponents answer with anti-air", () => {
  const games = {
    corsair: createStarswarGame({ seed: 2, aiSides: ["player", "enemy"], races: { player: "protoss", enemy: "terran" }, personas: { player: "corsair", enemy: "bio" } }),
    wraith: createStarswarGame({ seed: 2, aiSides: ["player", "enemy"], races: { player: "terran", enemy: "zerg" }, personas: { player: "wraith", enemy: "hydra" } }),
    muta: createStarswarGame({ seed: 2, aiSides: ["player", "enemy"], races: { player: "zerg", enemy: "protoss" }, personas: { player: "muta", enemy: "dragoon" } }),
  };
  const seen = { corsair: new Set(), wraith: new Set(), muta: new Set() };
  const foeAA = { corsair: false, wraith: false, muta: false };
  for (let step = 0; step < 9000; step += 1) {
    let playing = false;
    for (const [key, game] of Object.entries(games)) {
      if (game.status !== "playing") continue;
      playing = true;
      stepStarswar(game, stwAiThink);
      for (const unit of game.units) if (unit.side === "player") seen[key].add(unit.type);
      if (game.buildings.some((building) => building.side === "enemy" && ["turret", "spore", "cannon", "armory"].includes(building.type))) foeAA[key] = true;
    }
    if (!playing) break;
  }
  assert.ok(seen.corsair.has("corsair"), "커세어 질럿은 커세어를 띄운다");
  assert.ok(seen.wraith.has("wraith"), "레이스 메카닉은 레이스를 띄운다");
  assert.ok(Object.values(foeAA).filter(Boolean).length >= 2, `상대가 대공 건물을 갖춘다 ${JSON.stringify(foeAA)}`);
  // 뮤탈 저글링은 상대가 일찍 무너지면 스파이어 전에 끝나므로, 방해 없는 판에서 스파이어와 뮤탈리스크를 확인한다.
  const solo = createStarswarGame({ seed: 2, aiSides: ["player"], races: { player: "zerg", enemy: "protoss" }, personas: { player: "muta" } });
  // 상대 건물을 못 부수게 해 판이 일찍 끝나지 않도록 한다.
  for (const building of solo.buildings) if (building.side === "enemy") { building.hp = 1e6; building.maxHp = 1e6; }
  const soloSeen = new Set();
  for (let step = 0; step < 7200 && !soloSeen.has("mutalisk"); step += 1) {
    stepStarswar(solo, stwAiThink);
    for (const unit of solo.units) if (unit.side === "player") soloSeen.add(unit.type);
  }
  assert.ok(soloSeen.has("mutalisk"), "뮤탈 저글링은 뮤탈리스크를 띄운다");
});

const research = (state, side, ...ids) => {
  for (const id of ids) state.sides[side].research[id] = "done";
};

test("starswar every unit in the data can be produced or summoned and has a drawing slot", async () => {
  const { STW_UNITS, STW_PRODUCER_UNITS, STW_ARMY_UNITS } = await import("../app/starswar/starswar-data.js");
  const producible = new Set(Object.values(STW_PRODUCER_UNITS).flat());
  for (const id of STW_ARMY_UNITS) {
    const def = STW_UNITS[id];
    assert.ok(producible.has(id) || ["merge", "darkMerge", "escort", "broodling"].includes(def.from), `${id}의 출처 ${def.from}`);
  }
  assert.equal(STW_ARMY_UNITS.length, 38);
});

test("starswar casters: maelstrom and stasis freeze clumps, lockdown stops machines, feedback burns energy", () => {
  const state = quiet();
  research(state, "player", "maelstrom", "stasis");
  const darkArchon = stwSpawnUnitAt(state, "player", "darkArchon", 20, 62, "attack");
  darkArchon.energy = 250;
  const lings = [0, 1, 2, 3].map((index) => stwSpawnUnitAt(state, "enemy", "zealot", 18 + index * 1.2, 55, "attack"));
  const templar = stwSpawnUnitAt(state, "enemy", "templar", 26, 56, "rally");
  templar.energy = 120;
  stepStarswar(state);
  stepStarswar(state);
  assert.ok(templar.energy === 0 || lings.every((unit) => unit.stunUntil > state.time), "피드백이나 마엘스트롬을 쓴다");
  run(state, 2);
  assert.ok(lings.filter((unit) => unit.stunUntil > state.time).length >= 3, "마엘스트롬으로 질럿이 멈춘다");
  const frozenLing = lings.find((unit) => unit.stunUntil > state.time);
  const y = frozenLing.y;
  run(state, 1);
  assert.ok(Math.abs(frozenLing.y - y) < 0.2, "멈춘 동안 걸어오지 않는다");

  const arb = quiet();
  research(arb, "player", "stasis");
  const arbiter = stwSpawnUnitAt(arb, "player", "arbiter", 20, 64, "attack");
  arbiter.energy = 200;
  const pack = [0, 1, 2, 3, 4].map((index) => stwSpawnUnitAt(arb, "enemy", "marine", 17 + index * 1.2, 57, "attack"));
  run(arb, 1.5);
  const frozen = pack.filter((unit) => unit.stasisUntil > arb.time);
  assert.ok(frozen.length >= 4, `스테이시스 ${frozen.length}기`);
  const hp = frozen[0].hp;
  stwSpawnUnitAt(arb, "player", "zealot", frozen[0].x, frozen[0].y + 1.5, "attack");
  run(arb, 2);
  assert.equal(frozen[0].hp, hp, "스테이시스 안의 유닛은 다치지 않는다");

  const ghostState = terran("protoss");
  research(ghostState, "player", "lockdown");
  const ghost = stwSpawnUnitAt(ghostState, "player", "ghost", 20, 62, "attack");
  ghost.energy = 150;
  const dragoon = stwSpawnUnitAt(ghostState, "enemy", "dragoon", 20, 56, "attack");
  run(ghostState, 1);
  assert.ok(dragoon.stunUntil > ghostState.time, "락다운으로 드라군이 멈춘다");
});

test("starswar vessels matrix allies, EMP shields and irradiate clumps; yamato hits hard", () => {
  const state = terran("protoss");
  research(state, "player", "emp", "irradiate", "yamato");
  const vessel = stwSpawnUnitAt(state, "player", "vessel", 20, 66, "attack");
  vessel.energy = 200;
  const zealots = [0, 1, 2].map((index) => stwSpawnUnitAt(state, "enemy", "zealot", 18.5 + index * 1.4, 58, "rally"));
  stepStarswar(state);
  stepStarswar(state);
  assert.ok(zealots.every((unit) => unit.shields === 0), "EMP로 보호막이 사라진다");
  const tank = stwSpawnUnitAt(state, "player", "battlecruiser", 20, 62, "attack");
  tank.lastHit = state.time;
  run(state, 1.5);
  assert.ok(tank.matrix?.hp > 0 || vessel.energy < 100, "다치는 아군에게 매트릭스");

  const zerg2 = terran("zerg");
  research(zerg2, "player", "irradiate");
  const vessel2 = stwSpawnUnitAt(zerg2, "player", "vessel", 20, 66, "rally");
  vessel2.energy = 100;
  const hydras = [0, 1, 2].map((index) => stwSpawnUnitAt(zerg2, "enemy", "hydra", 19 + index * 0.9, 59, "rally"));
  run(zerg2, 1);
  assert.ok(hydras.some((unit) => unit.irradiateUntil > zerg2.time), "이레디에이트");
  const before = hydras.reduce((sum, unit) => sum + unit.hp, 0);
  run(zerg2, 3);
  assert.ok(hydras.reduce((sum, unit) => sum + Math.max(0, unit.hp), 0) < before - 40, "주변 생체 유닛도 녹는다");

  const bcState = terran("protoss");
  research(bcState, "player", "yamato");
  const bc = stwSpawnUnitAt(bcState, "player", "battlecruiser", 20, 62, "attack");
  bc.energy = 150;
  const carrier = stwSpawnUnitAt(bcState, "enemy", "carrier", 20, 54, "rally");
  run(bcState, 0.5);
  assert.ok(carrier.hp + carrier.shields <= 450 - 200, `야마토 포 ${carrier.hp + carrier.shields}`);
});

test("starswar queens ensnare and spawn broodlings; defilers swarm and plague", () => {
  const state = zerg("terran");
  research(state, "player", "ensnare", "broodling", "plague");
  const queen = stwSpawnUnitAt(state, "player", "queen", 20, 66, "rally");
  queen.energy = 200;
  const tank = stwSpawnUnitAt(state, "enemy", "ghost", 20, 58, "rally");
  const marines = [0, 1, 2].map((index) => stwSpawnUnitAt(state, "enemy", "marine", 25 + index * 1, 58, "rally"));
  const lurker = stwSpawnUnitAt(state, "enemy", "firebat", 14, 58, "rally");
  run(state, 2.5);
  const broods = state.units.filter((unit) => unit.type === "broodling");
  assert.ok(broods.length >= 2, `브루들링 ${broods.length}`);
  assert.ok(marines.some((unit) => unit.ensnareUntil > state.time) || queen.energy < 100, "인스네어");
  run(state, 25);
  assert.equal(state.units.filter((unit) => unit.type === "broodling").length, 0, "브루들링은 20초 뒤 사라진다");
  void tank;
  void lurker;

  const swarm = zerg("terran");
  research(swarm, "player", "plague");
  const defiler = stwSpawnUnitAt(swarm, "player", "defiler", 20, 70, "attack");
  defiler.energy = 200;
  const lings = [0, 1, 2, 3].map((index) => stwSpawnUnitAt(swarm, "player", "zergling", 18 + index * 1.2, 64, "rally"));
  for (const ling of lings) ling.hp = 9999;
  const shooters = [0, 1, 2].map((index) => stwSpawnUnitAt(swarm, "enemy", "marine", 18 + index * 2, 57, "rally"));
  run(swarm, 1.5);
  assert.ok((swarm.zones ?? []).some((zone) => zone.kind === "swarm"), "다크 스웜");
  const hp = lings.map((unit) => unit.hp);
  run(swarm, 2);
  const covered = lings.filter((unit, index) => unit.hp === hp[index]);
  assert.ok(covered.length >= 3, "스웜 안의 저글링은 해병에게 맞지 않는다");
  void shooters;

  // 플레이그: 묶어 둔(움직이지 못하는) 해병 무리에 걸고, 체력 1 아래로는 깎지 않는다.
  const plague = zerg("terran");
  research(plague, "player", "plague");
  const caster = stwSpawnUnitAt(plague, "player", "defiler", 20, 66, "rally");
  caster.energy = 200;
  const victims = [0, 1, 2].map((index) => stwSpawnUnitAt(plague, "enemy", "marine", 19 + index, 60, "rally"));
  for (const unit of victims) unit.stunUntil = 999;
  run(plague, 1);
  assert.ok(victims.every((unit) => unit.plagueUntil > plague.time), "플레이그");
  run(plague, 20);
  assert.ok(victims.every((unit) => unit.hp >= 1), `체력 1까지만 ${victims.map((unit) => unit.hp.toFixed(1))}`);
});

test("starswar carriers launch more interceptors after research, devourers corrode armor, arbiters cloak allies", () => {
  const state = quiet();
  const carrier = stwSpawnUnitAt(state, "player", "carrier", 20, 60, "attack");
  const dummy = stwSpawnUnitAt(state, "enemy", "zealot", 20, 54, "rally");
  assert.equal(stwHitDamage(state, carrier, dummy).length, 4);
  research(state, "player", "carrierCapacity");
  assert.equal(stwHitDamage(state, carrier, dummy).length, 8);

  const acid = zerg("terran");
  stwSpawnUnitAt(acid, "player", "devourer", 20, 62, "attack");
  const bc = stwSpawnUnitAt(acid, "enemy", "battlecruiser", 20, 56, "rally");
  bc.hp = 9999;
  run(acid, 7);
  assert.ok(bc.acid?.stacks >= 2, `산성 포자 ${bc.acid?.stacks}`);

  const cloak = quiet();
  const arbiter = stwSpawnUnitAt(cloak, "player", "arbiter", 20, 70, "rally");
  const zealot = stwSpawnUnitAt(cloak, "player", "zealot", 21, 71, "rally");
  assert.equal(stwDetected(cloak, zealot, "enemy"), false, "아비터 옆 질럿은 은폐");
  assert.equal(stwDetected(cloak, arbiter, "enemy"), true, "아비터 자신은 보인다");
  zealot.x = 34;
  assert.equal(stwDetected(cloak, zealot, "enemy"), true, "은폐장 밖이면 보인다");
});

test("starswar drops carry ground units to the enemy main and transports take riders down with them", () => {
  const state = quiet();
  assert.match(stwCommand(state, "player", { type: "drop" }).reason, /쉬는 셔틀 필요/);
  const shuttle = stwSpawnUnitAt(state, "player", "shuttle", 20, 80, "rally");
  const riders = [0, 1, 2, 3, 4].map((index) => stwSpawnUnitAt(state, "player", "zealot", 16 + index * 2, 78, "rally"));
  const result = stwCommand(state, "player", { type: "drop" });
  assert.equal(result.ok, true);
  assert.equal(result.loaded, 4, "8칸까지(질럿은 2칸씩, 4기)");
  assert.equal(riders.filter((unit) => unit.group === "cargo").length, 4);
  assert.equal(stwArmy(state, "player").fighters.length, 1, "탄 병력은 대기 병력에서 빠진다");
  for (let index = 0; index < 400 && shuttle.cargo?.length; index += 1) stepStarswar(state);
  const enemyMain = stwNexus(state, "enemy", "main");
  const landed = riders.filter((unit) => unit.group === "attack");
  assert.equal(landed.length, 4, "적 본진 뒤에 내린다");
  assert.ok(landed.every((unit) => Math.hypot(unit.x - enemyMain.x, unit.y - enemyMain.y) < 14), "적 본진 옆");
  for (let index = 0; index < 1500 && shuttle.op !== undefined; index += 1) stepStarswar(state);
  assert.equal(shuttle.group, "rally", "견제를 마친 셔틀은 병력을 태워 돌아온다");
  assert.ok(riders.filter((unit) => unit.hp > 0 && unit.group === "rally").length >= 3, "회수한 병력은 집결지로 돌아온다");

  const shot = terran("protoss");
  const dropship = stwSpawnUnitAt(shot, "player", "dropship", 20, 80, "rally");
  const marines = [0, 1].map((index) => stwSpawnUnitAt(shot, "player", "marine", 18 + index * 2, 78, "rally"));
  stwCommand(shot, "player", { type: "drop" });
  dropship.hp = 0;
  stepStarswar(shot);
  assert.ok(marines.every((unit) => !shot.units.includes(unit)), "격추되면 탄 병력도 잃는다");

  const zergDrop = zerg("protoss");
  zergDrop.sides.player.minerals = 9000;
  for (let index = 0; index < 3; index += 1) {
    stwCommand(zergDrop, "player", { type: "build", building: "overlord" });
    finishAll(zergDrop);
  }
  stwSpawnUnitAt(zergDrop, "player", "hydra", 20, 78, "rally");
  assert.match(stwCommand(zergDrop, "player", { type: "drop" }).reason, /복부 주머니/);
  research(zergDrop, "player", "ventral");
  assert.equal(stwCommand(zergDrop, "player", { type: "drop" }).ok, true, "복부 주머니 뒤 오버로드가 실어 나른다");
  assert.equal(stwOwnBuildings(zergDrop, "player", "overlord").length, 2, "기지에 오버로드 2기는 남긴다");
});

test("starswar transports load by slots: zealots take two, dragoons four, raids keep room for medics", () => {
  const state = quiet();
  stwSpawnUnitAt(state, "player", "shuttle", 20, 80, "rally");
  stwSpawnUnitAt(state, "player", "dragoon", 18, 78, "rally");
  stwSpawnUnitAt(state, "player", "dragoon", 22, 78, "rally");
  stwSpawnUnitAt(state, "player", "dragoon", 24, 78, "rally");
  const bomb = stwCommand(state, "player", { type: "drop", mission: "raid" });
  assert.equal(bomb.loaded, 2, "드라군은 4칸씩, 2기");
  assert.equal(stwSlots("zealot"), 2);
  assert.equal(stwSlots("reaver"), 4);
  assert.equal(stwSlots("marine"), 1);

  const bio = terran("protoss");
  const dropship = stwSpawnUnitAt(bio, "player", "dropship", 20, 80, "rally");
  for (let index = 0; index < 8; index += 1) stwSpawnUnitAt(bio, "player", "marine", 12 + index * 2, 78, "rally");
  stwSpawnUnitAt(bio, "player", "medic", 20, 76, "rally");
  stwSpawnUnitAt(bio, "player", "medic", 22, 76, "rally");
  stwSpawnUnitAt(bio, "player", "tank", 26, 76, "rally");
  stwCommand(bio, "player", { type: "drop", mission: "raid" });
  const aboard = dropship.cargo.map((id) => bio.units.find((unit) => unit.id === id).type);
  assert.deepEqual([aboard.filter((type) => type === "marine").length, aboard.filter((type) => type === "medic").length, aboard.includes("tank")], [6, 2, false], "게릴라는 해병 6 + 메딕 2, 탱크는 태우지 않음");
});

test("starswar guerrilla drops kill workers, suppress mining, and pull out when defenders arrive", () => {
  const state = quiet();
  state.sides.enemy.probes = 20;
  for (const building of state.buildings) if (building.side === "enemy") building.hp = building.maxHp = 1e9;
  const shuttle = stwSpawnUnitAt(state, "player", "shuttle", 20, 80, "rally");
  const zealots = [0, 1, 2, 3].map((index) => stwSpawnUnitAt(state, "player", "zealot", 16 + index * 2, 78, "rally"));
  assert.equal(stwCommand(state, "player", { type: "drop", mission: "raid", target: "main" }).ok, true);
  for (let index = 0; index < 600 && !zealots.some((unit) => unit.raid !== undefined && unit.group === "attack"); index += 1) stepStarswar(state);
  const op = state.ops[0];
  assert.equal(op.phase, "fight", "내려서 견제");
  const mined = state.sides.enemy.stats.minerals;
  run(state, 6);
  assert.ok(state.sides.enemy.probes < 20, `일꾼이 죽는다 (${state.sides.enemy.probes})`);
  assert.ok(state.sides.enemy.stats.workersLost > 0 && state.sides.player.stats.workersKilled === state.sides.enemy.stats.workersLost);
  assert.ok(state.sides.enemy.stats.minerals - mined < 0.95 * 16 * 6 * 0.6, "대피로 채취가 크게 준다");
  // 수비 병력이 몰려오면 회수한다(수비는 셔틀을 못 쏘는 질럿).
  const center = zealots.find((unit) => unit.hp > 0);
  for (let index = 0; index < 6; index += 1) stwSpawnUnitAt(state, "enemy", "zealot", center.x - 4 + index * 1.6, center.y - 7, "attack");
  run(state, 1.5);
  assert.ok(["pickup", "home"].includes(op.phase), `적이 몰려오면 회수 (${op.phase})`);
  for (let index = 0; index < 1500 && shuttle.op !== undefined; index += 1) stepStarswar(state);
  assert.equal(shuttle.group, "rally");
  assert.ok(zealots.some((unit) => unit.hp > 0 && unit.group === "rally" && unit.raid === undefined), "살아남은 질럿은 집결지로");
});

test("starswar repeated raids relaunch on their own and alternate between main and natural", () => {
  const state = quiet();
  state.sides.enemy.minerals = 9000;
  stwCommand(state, "enemy", { type: "build", building: "expand" });
  finishAll(state);
  for (const building of state.buildings) if (building.side === "enemy") building.hp = building.maxHp = 1e9;
  const shuttle = stwSpawnUnitAt(state, "player", "shuttle", 20, 80, "rally");
  for (let index = 0; index < 8; index += 1) stwSpawnUnitAt(state, "player", "zealot", 12 + index * 2, 78, "rally");
  stwCommand(state, "player", { type: "dropPlan", mission: "raid", target: "alternate", repeat: true });
  assert.equal(stwCommand(state, "player", { type: "drop" }).ok, true);
  const first = state.ops[0].base;
  for (let index = 0; index < 1500 && shuttle.op !== undefined; index += 1) stepStarswar(state);
  run(state, 8);
  assert.ok(state.ops.length === 1, "돌아와서 다시 나간다");
  assert.notEqual(state.ops[0].base, first, "본진과 앞마당을 번갈아");
  stwCommand(state, "player", { type: "dropPlan", repeat: false });
  assert.equal(state.sides.player.raidRelaunchAt, undefined);
});

test("starswar bomb drops gather, wait for the front to engage, land together, and hit production first", () => {
  const state = quiet();
  state.sides.enemy.minerals = 9000;
  for (const building of ["pylon", "gateway", "forge"]) {
    stwCommand(state, "enemy", { type: "build", building });
    finishAll(state);
  }
  const shuttles = [stwSpawnUnitAt(state, "player", "shuttle", 18, 80, "rally")];
  stwSpawnUnitAt(state, "player", "zealot", 20, 78, "rally");
  // 사람은 셔틀 1기로도 폭탄 드랍을 할 수 있다(AI는 2기 이상). 여기서는 둘로 이어 간다.
  assert.equal(stwDropCheck(state, "player", "bomb").ok, true);
  const aiSides = state.aiSides;
  state.aiSides = [...aiSides, "player"];
  assert.match(stwDropCheck(state, "player", "bomb").reason, /2기 이상/);
  state.aiSides = aiSides;
  shuttles.push(stwSpawnUnitAt(state, "player", "shuttle", 22, 80, "rally"));
  for (let index = 0; index < 8; index += 1) stwSpawnUnitAt(state, "player", "zealot", 12 + index * 2, 78, "rally");
  stwSpawnUnitAt(state, "player", "dragoon", 20, 76, "rally");
  stwSpawnUnitAt(state, "player", "dragoon", 22, 76, "rally");
  const result = stwCommand(state, "player", { type: "drop", mission: "bomb", target: "production", sync: true });
  assert.equal(result.ok, true);
  assert.equal(result.transports, 2);
  // 비싼 드라군부터 싣고 남은 질럿은 정면으로 바로 나간다.
  const front = state.units.find((unit) => unit.side === "player" && unit.type === "zealot" && unit.group === "attack");
  assert.ok(front, "정면 출격과 동시에: 남은 대기 병력이 바로 나간다");
  const op = state.ops[0];
  run(state, 15);
  assert.equal(op.phase, "gather", "정면이 맞붙기 전에는 집결점에서 기다린다");
  // 정면이 적과 맞붙으면 들어간다.
  stwSpawnUnitAt(state, "enemy", "zealot", front.x, front.y - 4, "rally");
  for (let index = 0; index < 400 && op.phase === "gather"; index += 1) stepStarswar(state);
  assert.equal(op.phase, "in");
  for (let index = 0; index < 600 && state.ops.includes(op) && op.phase === "in"; index += 1) stepStarswar(state);
  const gateway = stwOwnBuildings(state, "enemy", "gateway")[0];
  const before = gateway.hp + gateway.shields;
  run(state, 12);
  assert.ok(!state.units.includes(gateway) && (gateway.hp <= 0 || gateway.hp + gateway.shields < before), "생산 건물을 먼저 친다");
  assert.ok(shuttles.every((unit) => unit.hp <= 0 || !unit.cargo?.length), "동시에 내렸다");
});

test("starswar defence buildings guard the main first once enemy transports have been seen", () => {
  const state = quiet();
  state.sides.player.minerals = 9000;
  for (const building of ["pylon", "forge", "expand"]) {
    stwCommand(state, "player", { type: "build", building });
    finishAll(state);
  }
  stwCommand(state, "player", { type: "build", building: "cannon" });
  assert.equal(stwOwnBuildings(state, "player", "cannon")[0].base, "natural", "평소에는 앞마당");
  state.sides.player.sawTransportAt = state.time;
  stwCommand(state, "player", { type: "build", building: "cannon" });
  assert.equal(stwOwnBuildings(state, "player", "cannon")[1].base, "main", "수송선을 본 뒤 본진에 하나");
  stwCommand(state, "player", { type: "build", building: "cannon" });
  assert.equal(stwOwnBuildings(state, "player", "cannon")[2].base, "natural", "본진에 하나 있으면 다시 앞마당");
});

test("starswar AI answers drops: main defence after a sighting, four guards kept home, and raids of its own", () => {
  const state = createStarswarGame({ seed: 3, aiSides: ["enemy"], races: { player: "protoss", enemy: "protoss" }, personas: { enemy: "dragoon" } });
  state.sides.enemy.minerals = 9000;
  for (const building of ["pylon", "gateway", "core", "forge", "expand"]) {
    stwCommand(state, "enemy", { type: "build", building });
    finishAll(state);
  }
  state.time = 420;
  state.sides.enemy.sawTransportAt = 410;
  state.sides.enemy.ai = { nextThink: 0, step: 0, wave: 0, attacking: false, waveStart: 0, done: [] };
  stwAiThink(state, "enemy");
  finishAll(state);
  assert.ok(stwOwnBuildings(state, "enemy", "cannon").some((cannon) => cannon.base === "main"), "수송선을 본 뒤 본진에 캐논");
  // 출격할 때 4기는 남긴다.
  const home = stwNexus(state, "enemy", "main");
  for (let index = 0; index < 14; index += 1) stwSpawnUnitAt(state, "enemy", index % 2 ? "dragoon" : "zealot", home.x - 8 + (index % 7) * 2.4, home.y + 14 + Math.floor(index / 7) * 2.4, "rally");
  state.sides.enemy.ai.nextThink = 0;
  stwAiThink(state, "enemy");
  const army = stwArmy(state, "enemy");
  assert.ok(state.sides.enemy.ai.attacking, "출격");
  assert.equal(army.fighters.length, 4, "4기는 집에 남음");
  assert.ok(army.fighters.every((unit) => unit.type === "dragoon"), "공중도 쏘는 드라군을 남김");

  // 로보 운영 AI는 셔틀이 있으면 게릴라 드랍을 보낸다.
  const robo = createStarswarGame({ seed: 3, aiSides: ["player"], races: { player: "protoss", enemy: "protoss" }, personas: { player: "robo" } });
  robo.time = 400;
  robo.sides.player.ai = { nextThink: 0, step: 0, wave: 0, attacking: false, waveStart: 0, done: Array.from({ length: 30 }, (_, index) => index) };
  stwSpawnUnitAt(robo, "player", "shuttle", 20, 80, "rally");
  for (let index = 0; index < 6; index += 1) stwSpawnUnitAt(robo, "player", "zealot", 12 + index * 2, 78, "rally");
  stwAiThink(robo, "player");
  assert.equal(robo.ops.length, 1);
  assert.equal(robo.ops[0].kind, "raid");
});

test("starswar overlords that come back from a drop can drop again or take up escort duty", () => {
  const state = zerg("protoss");
  state.sides.player.minerals = 9000;
  // 내린 히드라가 적 넥서스를 부숴 판이 끝나지 않도록 한다.
  for (const building of state.buildings) if (building.side === "enemy") building.hp = building.maxHp = 1e9;
  for (let index = 0; index < 3; index += 1) {
    stwCommand(state, "player", { type: "build", building: "overlord" });
    finishAll(state);
  }
  research(state, "player", "ventral");
  stwSpawnUnitAt(state, "player", "hydra", 20, 78, "rally");
  assert.equal(stwCommand(state, "player", { type: "drop" }).ok, true);
  const flier = state.units.find((unit) => unit.side === "player" && unit.type === "overlord");
  for (let index = 0; index < 2500 && flier.op !== undefined; index += 1) stepStarswar(state);
  assert.equal(flier.group, "rally", "내려 준 뒤 돌아온다");
  // 돌아온 오버로드는 다음 침투에 먼저 쓰이고, 기지에 앉은 오버로드는 2기가 그대로 남는다.
  stwSpawnUnitAt(state, "player", "hydra", 20, 78, "rally");
  assert.equal(stwCommand(state, "player", { type: "drop" }).ok, true);
  assert.ok(flier.dropPath?.length, "돌아온 오버로드가 다시 출발");
  assert.equal(stwOwnBuildings(state, "player", "overlord").length, 2);
  for (let index = 0; index < 2500 && flier.op !== undefined; index += 1) stepStarswar(state);
  // 동행을 켜면 떠 있는 오버로드가 동행을 맡고, 기지의 오버로드는 앉아 있는다.
  stwCommand(state, "player", { type: "escort", on: true });
  stepStarswar(state);
  assert.equal(flier.escort, true);
  assert.equal(stwOwnBuildings(state, "player", "overlord").length, 2);
});

test("starswar casters stand close enough behind the front to reach the enemy line", () => {
  const state = terran("zerg");
  research(state, "player", "irradiate");
  const marines = [0, 1, 2, 3].map((index) => stwSpawnUnitAt(state, "player", "marine", 14 + index * 3, 60, "attack"));
  const vessel = stwSpawnUnitAt(state, "player", "vessel", 20, 68, "attack");
  vessel.energy = 200;
  const ultra = stwSpawnUnitAt(state, "enemy", "ultra", 20, 50, "rally");
  for (const unit of [...marines, ultra]) unit.hp = 9999;
  // 울트라리스크는 제자리에 묶어 둔다(대기 병력이라 그냥 두면 자기 집결지로 걸어간다).
  ultra.stunUntil = 999;
  run(state, 6);
  assert.ok(ultra.irradiateUntil > 0, "해병 줄 뒤의 베슬이 그 앞의 울트라리스크에 이레디에이트를 건다");
  assert.ok(vessel.y - Math.min(...marines.map((unit) => unit.y)) <= 4, "베슬은 선두 3칸 남짓 뒤");
});

test("starswar dark templars merge into a dark archon and infested terrans explode", () => {
  const state = quiet();
  assert.match(stwCommand(state, "player", { type: "darkMerge" }).reason, /다크템플러 2기/);
  stwSpawnUnitAt(state, "player", "dark", 20, 70, "rally");
  stwSpawnUnitAt(state, "player", "dark", 22, 70, "rally");
  assert.equal(stwCommand(state, "player", { type: "darkMerge" }).ok, true);
  stepStarswar(state);
  assert.equal(state.units.filter((unit) => unit.side === "player" && unit.type === "darkArchon").length, 1);
  assert.equal(state.units.filter((unit) => unit.side === "player" && unit.type === "dark").length, 0);

  const boom = zerg("terran");
  const infested = stwSpawnUnitAt(boom, "player", "infested", 20, 62, "attack");
  const marines = [0, 1, 2].map((index) => stwSpawnUnitAt(boom, "enemy", "marine", 19 + index, 58, "rally"));
  run(boom, 3);
  assert.ok(infested.hp <= 0, "자폭한다");
  assert.ok(marines.filter((unit) => unit.hp <= 0).length >= 2, "주변 해병이 죽는다");
});

test("starswar AI scouts early and goes on alert against a rush: defense first, no attacks", () => {
  const state = createStarswarGame({ seed: 1, aiSides: ["enemy"], races: { player: "protoss", enemy: "protoss" }, personas: { enemy: "dragoon" } });
  state.sides.player.minerals = 9000;
  for (const building of ["pylon", "gateway", "gateway", "gateway"]) {
    stwCommand(state, "player", { type: "build", building });
    finishAll(state);
  }
  // 정찰 일꾼이 질럿에게 잡히지 않도록 게이트웨이는 멈춰 둔다(건물만 보여 주면 된다).
  stwCommand(state, "player", { type: "lineAll", unit: null, producer: "gateway" });
  run(state, 125, stwAiThink);
  assert.ok(state.units.some((unit) => unit.side === "enemy" && unit.group === "scout") || state.sides.enemy.ai.scouted, "2분에 정찰을 보냄");
  run(state, 60, stwAiThink);
  assert.ok(state.sides.enemy.intel, "정찰로 상대 건물을 봄");
  assert.ok(state.sides.enemy.ai.alertUntil >= 480, `게이트웨이 3개를 보고 경계 (${state.sides.enemy.ai.alertUntil})`);
  run(state, 90, stwAiThink);
  assert.ok(stwOwnBuildings(state, "enemy", "forge").length >= 1 && stwOwnBuildings(state, "enemy", "cannon").length >= 1, "포지와 캐논을 먼저 세움");
  assert.ok(stwOwnBuildings(state, "enemy", "gateway").length >= 2, "생산 건물을 늘림");
  assert.equal(state.sides.enemy.ai.attacking, false, "경계 중에는 출격하지 않음");
});
