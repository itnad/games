import assert from "node:assert/strict";
import test from "node:test";
import {
  FRONTLINE_EDGES,
  FRONTLINE_FORMATIONS,
  FRONTLINE_MAP_HEIGHT,
  FRONTLINE_MAP_WIDTH,
  FRONTLINE_UNITS,
  FRONTLINE_ZONES,
} from "../app/frontline/frontline-data.js";
import {
  createFrontlineGame,
  frontlineBuildCheck,
  frontlineCommand,
  frontlineDamage,
  frontlineFormationSlots,
  frontlineMiningRate,
  frontlinePath,
  frontlineSideZone,
  frontlineSpawnUnitAt,
  frontlineSquadSummary,
  frontlineSupply,
  frontlineTrainCheck,
  frontlineWorkerPoint,
  frontlineZone,
  stepFrontline,
} from "../app/frontline/frontline-engine.js";
import { frontlineAiThink } from "../app/frontline/frontline-ai.js";

const run = (state, seconds, ai = null) => {
  const steps = Math.round(seconds * 10);
  for (let index = 0; index < steps && state.status === "playing"; index += 1) stepFrontline(state, ai);
};

const quietGame = () => createFrontlineGame({ seed: 7, aiSides: [] });

test("frontline map is point-symmetric, connected, and mirrored for both commanders", () => {
  for (const zone of FRONTLINE_ZONES) {
    const mirror = frontlineZone(frontlineSideZone("enemy", zone.id));
    assert.equal(mirror.x, FRONTLINE_MAP_WIDTH - zone.x, `${zone.id} x 대칭`);
    assert.equal(mirror.y, FRONTLINE_MAP_HEIGHT - zone.y, `${zone.id} y 대칭`);
    assert.equal(mirror.mine, zone.mine);
  }
  const edgeKeys = new Set(FRONTLINE_EDGES.map(([a, b]) => [a, b].sort().join("-")));
  for (const [a, b] of FRONTLINE_EDGES) {
    assert.ok(edgeKeys.has([frontlineSideZone("enemy", a), frontlineSideZone("enemy", b)].sort().join("-")), `${a}-${b} 대칭 도로`);
  }
  for (const zone of FRONTLINE_ZONES) assert.ok(frontlinePath("home", zone.id).length > 0, `${zone.id} 연결`);
  assert.deepEqual(frontlinePath("home", "enemy").at(0), "home");
  assert.deepEqual(frontlinePath("home", "enemy").at(-1), "enemy");
});

test("frontline mining saturates at eight workers and pays exactly over time", () => {
  assert.equal(frontlineMiningRate(0), 0);
  assert.equal(frontlineMiningRate(8), 8);
  assert.equal(frontlineMiningRate(12), 10);
  assert.equal(frontlineMiningRate(30), 10);

  const state = quietGame();
  assert.equal(state.sides.player.ore, 150);
  run(state, 60);
  assert.ok(Math.abs(state.sides.player.ore - (150 + 6 * 60)) < 0.01, `60초 채굴량 ${state.sides.player.ore}`);
});

test("frontline validates construction, tech requirements, outposts, and supply", () => {
  const state = quietGame();
  state.sides.player.ore = 2000;
  assert.match(frontlineBuildCheck(state, "player", "home", "factory").reason, /병영이 먼저 필요합니다/);
  assert.match(frontlineBuildCheck(state, "player", "west", "outpost").reason, /맞닿은 지역/);
  assert.match(frontlineBuildCheck(state, "player", "enemy", "outpost").reason, /적 기지/);
  assert.equal(frontlineBuildCheck(state, "player", "south", "outpost").ok, true);
  assert.match(frontlineBuildCheck(state, "player", "center", "depot").reason, /완성된 아군 기지/);

  assert.equal(frontlineCommand(state, "player", { type: "build", zone: "home", building: "barracks" }).ok, true);
  const barracks = state.buildings.find((building) => building.type === "barracks");
  assert.match(frontlineTrainCheck(state, "player", barracks.id, "rifle").reason, /건설이 끝나야/);
  run(state, 30.1);
  assert.equal(barracks.progress, 1);
  assert.equal(frontlineBuildCheck(state, "player", "home", "factory").ok, true);

  const hq = state.buildings.find((building) => building.side === "player" && building.type === "hq");
  assert.deepEqual(frontlineSupply(state, "player"), { used: 6, cap: 10 });
  for (let index = 0; index < 4; index += 1) assert.equal(frontlineCommand(state, "player", { type: "train", buildingId: barracks.id, unit: "rifle" }).ok, true);
  assert.match(frontlineCommand(state, "player", { type: "train", buildingId: hq.id, unit: "worker" }).reason, /보급이 부족/);
  const before = state.sides.player.ore;
  assert.equal(frontlineCommand(state, "player", { type: "cancel", buildingId: barracks.id }).ok, true);
  assert.equal(state.sides.player.ore, before + FRONTLINE_UNITS.rifle.cost);
});

test("frontline formations put shields in front and change combat math", () => {
  const state = quietGame();
  const rifle = frontlineSpawnUnitAt(state, "player", "rifle", 50, 80);
  const guard = frontlineSpawnUnitAt(state, "player", "guard", 50, 80);
  const tank = frontlineSpawnUnitAt(state, "player", "tank", 50, 80);
  const slots = frontlineFormationSlots("player", "center", "line", [rifle, tank, guard]);
  assert.ok(slots.get(guard.id).y < slots.get(rifle.id).y, "방패병이 적 방향(위쪽) 앞줄");
  assert.ok(slots.get(rifle.id).y < slots.get(tank.id).y, "전차가 맨 뒤");

  const target = frontlineSpawnUnitAt(state, "enemy", "guard", 20, 20);
  state.sides.player.squads[1].formation = "wedge";
  assert.equal(frontlineDamage(state, rifle, target), Math.max(1, 6 - 2));
  state.sides.player.squads[1].formation = "line";
  assert.ok(Math.abs(frontlineDamage(state, rifle, target) - (6 * FRONTLINE_FORMATIONS.line.rangedDamage - 2)) < 1e-9);

  const highGround = frontlineSpawnUnitAt(state, "enemy", "guard", 50, 75);
  assert.ok(Math.abs(frontlineDamage(state, rifle, highGround) - (6 * 1.15 - 2) * 0.8) < 1e-9, "고지 피해 감소");

  state.sides.enemy.squads[1].formation = "spread";
  const spreadSplash = frontlineDamage(state, tank, target, { splash: true });
  state.sides.enemy.squads[1].formation = "line";
  const lineSplash = frontlineDamage(state, tank, target, { splash: true });
  assert.ok(Math.abs(spreadSplash - lineSplash * 0.4) < 1e-9, "산개는 광역 피해 60% 감소");
});

test("frontline squads fight on attack orders and hold fire while moving", () => {
  const state = quietGame();
  for (let index = 0; index < 5; index += 1) frontlineSpawnUnitAt(state, "player", "rifle", 46 + index * 2, 80);
  frontlineCommand(state, "player", { type: "order", squad: 1, order: "attack", zone: "center" });
  frontlineSpawnUnitAt(state, "enemy", "guard", 48, 70);
  frontlineSpawnUnitAt(state, "enemy", "guard", 52, 70);
  run(state, 30);
  assert.equal(state.units.filter((unit) => unit.side === "enemy").length, 0);
  assert.equal(state.sides.player.stats.kills, 2);
  assert.match(state.log.map((entry) => entry.text).join("\n"), /1부대가 중앙 고지로 진격합니다\./);

  const marching = quietGame();
  const runner = frontlineSpawnUnitAt(marching, "player", "rifle", 50, 120);
  frontlineCommand(marching, "player", { type: "order", squad: 2, order: "move", zone: "home" });
  runner.squad = 2;
  frontlineCommand(marching, "player", { type: "order", squad: 2, order: "move", zone: "enemy" });
  frontlineSpawnUnitAt(marching, "enemy", "rifle", 80, 86);
  for (let index = 0; index < 120; index += 1) stepFrontline(marching);
  assert.equal(runner.lastFiredAt, -99, "이동 명령 중에는 사격하지 않음");
  assert.equal(frontlineSquadSummary(marching, "player", 2).status === "주둔", false);
});

test("frontline raiders kill exposed workers and the HQ decides the battle", () => {
  const state = quietGame();
  const point = frontlineWorkerPoint(state, "home");
  frontlineSpawnUnitAt(state, "enemy", "rifle", point.x + 1, point.y - 1);
  frontlineSpawnUnitAt(state, "enemy", "rifle", point.x - 1, point.y - 1);
  state.sides.player.autoWorkers = false;
  run(state, 12);
  assert.ok(state.sides.player.stats.workersLost >= 2, `잃은 일꾼 ${state.sides.player.stats.workersLost}`);
  assert.ok(state.log.some((entry) => entry.text === "아군 본진의 일꾼들이 공격받고 있습니다!"));

  const finale = quietGame();
  finale.buildings.find((building) => building.side === "enemy" && building.type === "hq").hp = 0;
  stepFrontline(finale);
  assert.equal(finale.status, "over");
  assert.equal(finale.winner, "player");
});

test("frontline AI plays a deterministic, rule-abiding mirror match", () => {
  const summarize = (state) => JSON.stringify({
    time: state.time,
    ore: [Math.round(state.sides.player.ore), Math.round(state.sides.enemy.ore)],
    units: state.units.map((unit) => [unit.type, Math.round(unit.x * 10), Math.round(unit.y * 10), Math.round(unit.hp)]),
    buildings: state.buildings.map((building) => [building.side, building.type, building.zone]),
  });
  const a = createFrontlineGame({ seed: 99, aiSides: ["player", "enemy"] });
  const b = createFrontlineGame({ seed: 99, aiSides: ["player", "enemy"] });
  run(a, 420, frontlineAiThink);
  run(b, 420, frontlineAiThink);
  assert.equal(summarize(a), summarize(b));
  for (const side of ["player", "enemy"]) {
    const types = new Set(a.buildings.filter((building) => building.side === side).map((building) => building.type));
    assert.ok(types.has("barracks"), `${side} 병영`);
    assert.ok(a.sides[side].stats.unitsProduced > 15, `${side} 생산 ${a.sides[side].stats.unitsProduced}`);
    const supply = frontlineSupply(a, side);
    assert.ok(supply.used <= Math.max(supply.cap, 10) + 12, "보급 한도 준수");
    assert.ok(a.sides[side].ore >= 0, "광석 음수 없음");
  }
  assert.ok(a.units.every((unit) => Number.isFinite(unit.x) && Number.isFinite(unit.y) && Number.isFinite(unit.hp)));
  assert.ok(a.sides.player.stats.kills + a.sides.enemy.stats.kills > 0, "7분 안에 교전 발생");
});

test("frontline reinforcements leave a crowded base and reach their squad", () => {
  const state = quietGame();
  state.sides.player.ore = 99999;
  for (const building of ["depot", "barracks", "barracks", "depot", "barracks", "depot", "barracks", "turret"]) {
    assert.equal(frontlineCommand(state, "player", { type: "build", zone: "home", building }).ok, true, building);
  }
  run(state, 45);
  assert.equal(frontlineCommand(state, "player", { type: "build", zone: "home", building: "factory" }).ok, true);
  assert.equal(frontlineCommand(state, "player", { type: "build", zone: "south", building: "outpost" }).ok, true);
  run(state, 45);
  frontlineCommand(state, "player", { type: "order", squad: 1, order: "move", zone: "south" });
  for (const building of state.buildings.filter((item) => item.type === "barracks" || item.type === "factory")) {
    for (let index = 0; index < 3; index += 1) {
      frontlineCommand(state, "player", { type: "train", buildingId: building.id, unit: building.type === "factory" ? "tank" : index % 2 ? "guard" : "rifle" });
    }
  }
  run(state, 240);
  assert.ok(state.units.length >= 10, `생산된 병력 ${state.units.length}`);
  assert.deepEqual(state.units.filter((unit) => unit.mode === "travel").map((unit) => unit.type), []);
  const south = frontlineZone("south");
  assert.ok(state.units.every((unit) => Math.hypot(unit.x - south.x, unit.y - south.y) <= south.radius + 6), "모두 남부 광산에 주둔");
});
