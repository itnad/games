import assert from "node:assert/strict";
import test from "node:test";

import {
  createMudflatSupervisorMemory,
  decideMudflatSupervisorMove,
  maintainMudflatSupervisorCampaign,
  mudflatSupervisorAttackBand,
  mudflatSupervisorCanDig,
} from "../app/mudflat-supervisor.js";
import {
  MUDFLAT_SUPERVISOR_LOG_LIMIT,
  appendMudflatSupervisorLog,
  createMudflatSupervisorLog,
  serializeMudflatSupervisorLog,
} from "../app/mudflat-supervisor-log.js";

function scene(overrides = {}) {
  return {
    stage: 1,
    elapsed: 12,
    player: { x: 0, y: 0 },
    creatures: [],
    pickups: [],
    rocks: [],
    fallingRocks: [],
    clamHoles: [],
    safeZone: null,
    baseCamp: { x: 700, y: 0 },
    baseCampGuideShown: false,
    secondsToTide: 999,
    emptySeafoodRisk: 0,
    retreatDirection: { x: -1, y: 0 },
    terrainRisk: () => 0,
    ...overrides,
  };
}

test("감독 AI는 복귀 알림이 뜨면 다른 목표보다 캠프를 우선한다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    baseCampGuideShown: true,
    baseCamp: { x: 420, y: 0 },
    pickups: [{ x: -90, y: 0, xp: 30, phase: "idle" }],
    creatures: [{ id: 1, x: -140, y: 0, hp: 20, xp: 99, score: 999, size: 14, name: "게" }],
  }));

  assert.equal(decision.targetKind, "camp");
  assert.equal(decision.intent, "베이스캠프로 귀환 중");
  assert.ok(decision.x > .7);
});

test("감독 AI는 돌발 물살 직전 언덕배기를 우선한다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    stage: 4,
    secondsToTide: 3.4,
    safeZone: { x: 260, y: 20 },
    creatures: [{ id: 1, x: -140, y: 0, hp: 20, xp: 99, score: 999, size: 14, name: "게" }],
  }));

  assert.equal(decision.targetKind, "safe-zone");
  assert.equal(decision.intent, "돌발 물살 대피 중");
  assert.ok(decision.x > .7);
});

test("감독 AI는 떨어지는 바위의 충돌 지점에서 벗어난다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    creatures: [{ id: 7, x: 280, y: 0, hp: 20, xp: 8, score: 20, size: 12, name: "게" }],
    fallingRocks: [{ x: 60, y: 0, radius: 40, life: .04, maxLife: 1 }],
  }));

  assert.equal(decision.intent, "위험을 피해 이동 중");
  assert.ok(decision.x < -.5, `expected escape away from impact, got ${JSON.stringify(decision)}`);
});

test("감독 AI는 호미질 거리 안에서는 멈춰 채집한다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    clamHoles: [{ x: 18, y: 0, kind: "clam" }],
  }));

  assert.equal(decision.x, 0);
  assert.equal(decision.y, 0);
  assert.equal(decision.intent, "조개구멍 호미질 중");
  assert.equal(decision.targetKind, "clam");
});

test("감독 AI는 호미질 중 위험이 접근하면 즉시 채집을 중단한다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    clamHoles: [{ x: 18, y: 0, kind: "clam" }],
    creatures: [{ id: 9, x: 4, y: 0, hp: 20, xp: 0, score: 0, size: 18, name: "게", uncollectible: true }],
  }));

  assert.equal(decision.intent, "위험을 피해 이동 중");
  assert.ok(decision.x < -.7, `expected an escape away from the hazard, got ${JSON.stringify(decision)}`);
});

test("감독 AI는 채집 대상인 일반 게가 안전거리 안으로 들어와도 게를 관통하지 않고 후퇴한다", () => {
  for (const range of [60, 42, 30, 10, 4]) {
    const decision = decideMudflatSupervisorMove(scene({
      clamHoles: [{ x: 18, y: 0, kind: "clam" }],
      creatures: [{ id: 11, x: range, y: 0, hp: 20, xp: 2, score: 15, size: 13, name: "칠게" }],
    }));

    assert.equal(decision.targetKind, "creature");
    assert.ok(decision.x < 0, `expected retreat from crab at ${range}px, got ${JSON.stringify(decision)}`);
  }
});

test("감독 AI는 일반 게와 집게의 적정 채집 거리에 도착하면 더 접근하지 않는다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    creatures: [{ id: 12, x: 76, y: 0, hp: 20, xp: 2, score: 15, size: 13, name: "칠게" }],
  }));

  assert.equal(decision.targetKind, "creature");
  assert.deepEqual({ x: decision.x, y: decision.y }, { x: 0, y: 0 });
});

test("감독 AI는 조개구멍에 안전하게 정지한 동안에만 호미질한다", () => {
  assert.equal(mudflatSupervisorCanDig({ targetKind: "clam", x: 0, y: 0 }), true);
  assert.equal(mudflatSupervisorCanDig({ targetKind: "clam", x: -.8, y: .2 }), false);
  assert.equal(mudflatSupervisorCanDig({ targetKind: "creature", x: 0, y: 0 }), false);
});

test("감독 AI는 안전한 작업 차례에 생물보다 조개구멍을 찾아가 호미질한다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    elapsed: 1,
    creatures: [{ id: 21, x: 260, y: 0, hp: 20, xp: 5, score: 30, size: 13, name: "칠게" }],
    clamHoles: [{ id: 30, x: 70, y: 10, kind: "clam", progress: 0 }],
  }));

  assert.equal(decision.targetKind, "clam");
  assert.equal(decision.intent, "구멍으로 이동 중");
  assert.ok(decision.x > .2);
});

test("감독 AI는 안전하면 작업 차례와 관계없이 가까운 구멍을 최우선으로 선택한다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    elapsed: 9,
    rockerLevel: 1,
    pickupRadius: 50,
    pickups: [{ id: 31, x: 45, y: 0, xp: 20, phase: "idle" }],
    creatures: [{ id: 32, x: 210, y: 0, hp: 20, xp: 30, score: 100, size: 13, name: "칠게" }],
    rocks: [{ id: 33, x: 70, y: 100, radius: 22 }],
    clamHoles: [{ id: 34, x: 90, y: 0, kind: "clam", progress: 0 }],
  }));

  assert.equal(decision.targetKind, "clam");
  assert.equal(decision.targetId, 34);
});

test("감독 AI는 너무 먼 구멍을 쫓지 않는다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    elapsed: 1,
    clamHoles: [{ id: 35, x: 900, y: 0, kind: "clam", progress: 0 }],
  }));

  assert.equal(decision.targetKind, "explore");
});

test("일반 게 무리 옆의 구멍까지 우회해 접촉 없이 호미질을 끝낸다", () => {
  const hole = { id: 9, x: 405, y: 0, kind: "clam", progress: 0 };
  const creatures = [-76, -38, 0, 38, 76].map((y, i) => ({
    id: 310 + i, x: 200, y, size: 12, hp: 20, name: "칠게",
  }));
  const world = simulateSupervisor({
    seconds: 11, player: { x: 0, y: 0 },
    build: () => ({ creatures, clamHoles: [hole] }),
    onFrame: ({ player, decision }, dt) => {
      assert.ok(creatures.every((crab) => Math.hypot(crab.x - player.x, crab.y - player.y) > crab.size + 17));
      hole.progress = mudflatSupervisorCanDig(decision) && Math.hypot(player.x - hole.x, player.y) <= 48 ? hole.progress + dt : 0;
      return hole.progress >= 2;
    },
  });
  assert.ok(hole.progress >= 2, JSON.stringify(world.decision));
  assert.deepEqual(world.released, []);
});

test("작업을 끝내기 전에 게가 닿으면 피하고 바로 같은 구멍을 다시 파지 않는다", () => {
  const memory = createMudflatSupervisorMemory();
  const hole = { id: 417, x: 10, y: 0, kind: "gaebul", progress: .4 };
  const crab = { id: 12, x: 150, y: 0, hp: 20, size: 13, movement: "chase", speed: 80 };
  const decide = (elapsed, creatures) => decideMudflatSupervisorMove(scene({ elapsed, memory, creatures, clamHoles: [hole] }));
  assert.equal(decide(1, [crab]).targetKind, "creature");
  hole.progress = 0;
  assert.notEqual(decide(1.17, []).targetKind, "clam");
  assert.equal(decide(2.5, []).targetId, 417);
  hole.progress = 3;
  assert.equal(decide(3, [crab]).targetKind, "clam");
});

test("경험치 목표가 끼어들어도 같은 게의 무타격 시간이 누적된다", () => {
  const memory = createMudflatSupervisorMemory();
  const crab = { id: 333, x: 86, y: 0, size: 13, hp: 20 };
  const drop = { id: 370, x: -60, y: 0, xp: 7, phase: "idle" };
  let released = false;
  for (let tick = 0; tick < 100; tick++) {
    const decision = decideMudflatSupervisorMove(scene({ elapsed: tick * .16, memory, creatures: [crab], pickups: tick % 8 === 7 ? [drop] : [] }));
    if (decision.released.some((item) => item.id === 333 && item.reason === "hp-stall")) { released = true; break; }
  }
  assert.ok(released);
});

test("끌려오는 경험치와 반경 안의 경험치를 건너뛰고 가까운 묶음의 흡수 거리까지 이동한다", () => {
  const pickups = [
    { id: 1, x: 20, y: 0, phase: "idle", xp: 4 },
    { id: 2, x: 55, y: 0, phase: "pull", xp: 20 },
    { id: 3, x: 75, y: 0, phase: "idle", xp: 3 },
    { id: 4, x: -88, y: 0, phase: "idle", xp: 3 },
    { id: 5, x: -97, y: 0, phase: "idle", xp: 3 },
  ];
  const decision = decideMudflatSupervisorMove(scene({ pickups, pickupRadius: 50 }));
  assert.equal(decision.targetId, 4);
  assert.equal(decision.desiredDistance, 44);
  assert.equal(decideMudflatSupervisorMove(scene({ pickups: pickups.slice(0, 2) })).targetKind, "explore");
});

test("감독 AI는 호미질과 돌뒤집기가 겹쳐도 진행 중인 호미 목표를 유지한다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    elapsed: 2,
    rockerLevel: 1,
    rockReach: 84,
    activeRockId: 36,
    rocks: [{ id: 36, x: 60, y: 20, radius: 22 }],
    clamHoles: [{ id: 37, x: 18, y: 0, kind: "clam", progress: .8 }],
  }));

  assert.equal(decision.targetKind, "clam");
  assert.equal(decision.targetId, 37);
  assert.deepEqual({ x: decision.x, y: decision.y }, { x: 0, y: 0 });
});

test("감독 AI는 돌뒤집개를 배운 뒤 안전한 작업 차례에 바위를 찾아간다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    elapsed: 8,
    rockerLevel: 1,
    rockReach: 84,
    rocks: [{ id: 41, x: 110, y: 0, radius: 22 }],
  }));

  assert.equal(decision.targetKind, "rock");
  assert.equal(decision.intent, "돌뒤집개로 바위 확인 중");
  assert.ok(decision.x > .2);
});

test("감독 AI는 시작한 바위 뒤집기를 안전한 동안 끝까지 유지한다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    elapsed: 16,
    rockerLevel: 1,
    rockReach: 84,
    activeRockId: 42,
    rocks: [{ id: 42, x: 72, y: 0, radius: 22 }],
  }));

  assert.equal(decision.x, 0);
  assert.equal(decision.y, 0);
  assert.equal(decision.intent, "돌뒤집개로 바위 확인 중");
  assert.equal(decision.targetKind, "rock");
  assert.equal(decision.targetId, 42);
});

test("감독 AI는 멀리 떨어진 작은 경험치를 쫓느라 호미질을 포기하지 않는다", () => {
  const far = (xp) => decideMudflatSupervisorMove(scene({
    elapsed: 1,
    pickupRadius: 50,
    pickups: [{ id: 61, x: 440, y: 0, xp, phase: "idle" }],
    clamHoles: [{ id: 62, x: 85, y: 0, kind: "clam", progress: 0 }],
  }));

  assert.equal(far(8).targetKind, "clam");
  assert.equal(far(8).targetId, 62);
  // 그 둘레에 경험치가 많이 떨어져 있으면(경험치 × 10px 안) 돌아가서 줍는다.
  assert.equal(far(50).targetKind, "pickup");
});

test("감독 AI는 선택한 호미질 목표를 가까운 경험치가 생겨도 작업 시간 동안 유지한다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    elapsed: 8,
    pickupRadius: 50,
    lockedTargetKind: "clam",
    lockedTargetId: 72,
    pickups: [{ id: 71, x: 35, y: 0, xp: 20, phase: "idle" }],
    clamHoles: [{ id: 72, x: 80, y: 0, kind: "clam", progress: 0 }],
  }));

  assert.equal(decision.targetKind, "clam");
  assert.equal(decision.targetId, 72);
});

test("감독 AI는 고정한 구멍까지 접근해 실제 호미질 완료 시간 동안 정지한다", () => {
  let player = { x: 0, y: 0 };
  const hole = { id: 81, x: 190, y: 20, kind: "clam", progress: 0 };
  let lockedTargetKind = null;
  let lockedTargetId = null;
  let lockUntil = 0;
  let completedAt = null;

  for (let frame = 0; frame < 100; frame += 1) {
    const elapsed = frame * .16;
    const decision = decideMudflatSupervisorMove(scene({
      elapsed,
      player,
      lockedTargetKind: elapsed < lockUntil ? lockedTargetKind : null,
      lockedTargetId: elapsed < lockUntil ? lockedTargetId : null,
      pickups: frame > 12 ? [{ id: 82, x: player.x + 40, y: player.y, xp: 10, phase: "idle" }] : [],
      clamHoles: [hole],
    }));
    if (decision.targetId !== lockedTargetId) {
      lockedTargetKind = decision.targetKind;
      lockedTargetId = decision.targetId;
      lockUntil = elapsed + (decision.targetKind === "clam" ? 14 : 2.5);
    }
    player = { x: player.x + decision.x * 155 * .16, y: player.y + decision.y * 155 * .16 };
    if (mudflatSupervisorCanDig(decision) && Math.hypot(player.x - hole.x, player.y - hole.y) <= 48) hole.progress += .16;
    else hole.progress = 0;
    if (hole.progress >= 2) { completedAt = elapsed; break; }
  }

  assert.ok(completedAt !== null && completedAt < 10, `expected completed hoe work, got ${completedAt}`);
});

test("감독 AI는 추격하는 일반 게와 장시간 집게 거리를 유지한다", () => {
  let player = { x: 0, y: 0 };
  let crab = { id: 13, x: 100, y: 0, hp: 20, xp: 2, score: 15, size: 13, name: "칠게" };
  let minimumDistance = Infinity;

  for (let frame = 0; frame < 240; frame += 1) {
    const decision = decideMudflatSupervisorMove(scene({
      elapsed: frame * .16,
      player,
      creatures: [crab],
      clamHoles: [{ x: 18, y: 0, kind: "clam" }],
    }));
    player = { x: player.x + decision.x * 155 * .16, y: player.y + decision.y * 155 * .16 };
    const dx = player.x - crab.x;
    const dy = player.y - crab.y;
    const range = Math.hypot(dx, dy) || 1;
    crab = { ...crab, x: crab.x + dx / range * 38 * .16, y: crab.y + dy / range * 38 * .16 };
    minimumDistance = Math.min(minimumDistance, Math.hypot(player.x - crab.x, player.y - crab.y));
  }

  assert.ok(minimumDistance > crab.size + 17, `expected no contact, minimum distance was ${minimumDistance}`);
});

test("감독 AI는 여러 게가 접근해도 가장 가까운 충돌 경로를 피해 이동한다", () => {
  let player = { x: 0, y: 0 };
  let crabs = [
    { id: 51, x: 115, y: 0 },
    { id: 52, x: -135, y: 20 },
    { id: 53, x: 10, y: 145 },
    { id: 54, x: -30, y: -155 },
  ].map((item) => ({ ...item, hp: 20, xp: 2, score: 15, size: 13, name: "칠게" }));
  let minimumDistance = Infinity;

  for (let frame = 0; frame < 240; frame += 1) {
    const decision = decideMudflatSupervisorMove(scene({
      elapsed: frame * .16,
      player,
      creatures: crabs,
    }));
    player = { x: player.x + decision.x * 155 * .16, y: player.y + decision.y * 155 * .16 };
    crabs = crabs.map((crab) => {
      const dx = player.x - crab.x;
      const dy = player.y - crab.y;
      const range = Math.hypot(dx, dy) || 1;
      return { ...crab, x: crab.x + dx / range * 38 * .16, y: crab.y + dy / range * 38 * .16 };
    });
    minimumDistance = Math.min(minimumDistance, ...crabs.map((crab) => Math.hypot(player.x - crab.x, player.y - crab.y)));
  }

  assert.ok(minimumDistance > crabs[0].size + 17, `expected no multi-crab contact, minimum distance was ${minimumDistance}`);
});

/**
 * 실제 원정의 프레임 흐름을 흉내 낸다: 0.16초마다 판단하고, 급한 이동·정지는 바로, 그 밖에는 38%씩 섞어 입력에 반영하며,
 * 매 프레임(1/60초) 초당 155px로 움직인다. 목표 고정(구멍 14초, 바위 10초, 생물 4초, 경험치 2.5초)도 게임과 같다.
 * onFrame(world, dt)가 true를 돌려주면 멈춘다.
 */
function simulateSupervisor({ seconds, player, build, onFrame, speed = 155 }) {
  const memory = createMudflatSupervisorMemory();
  const world = { player: { ...player }, elapsed: 0, decision: { x: 0, y: 0, targetKind: "explore", targetId: null }, input: { x: 0, y: 0 }, flips: 0, released: [], moving: true };
  let clock = 0;
  let lockKind = null;
  let lockId = null;
  let lockUntil = 0;
  let raw = { x: 0, y: 0 };
  const dt = 1 / 60;
  for (let frame = 0; frame < seconds * 60; frame += 1) {
    world.elapsed = frame * dt;
    clock -= dt;
    if (clock <= 0) {
      const locked = world.elapsed < lockUntil;
      const decision = decideMudflatSupervisorMove(scene({
        ...build(world),
        elapsed: world.elapsed,
        player: world.player,
        memory,
        lockedTargetKind: locked ? lockKind : null,
        lockedTargetId: locked ? lockId : null,
      }));
      const same = decision.targetKind === world.decision.targetKind && decision.targetId === world.decision.targetId;
      const before = Math.hypot(raw.x, raw.y);
      const after = Math.hypot(decision.x, decision.y);
      if (same && before > .35 && after > .35 && (raw.x * decision.x + raw.y * decision.y) / (before * after) < -.25) world.flips += 1;
      raw = { x: decision.x, y: decision.y };
      if (after <= .05 || decision.urgent || decision.danger > 1000) world.input = { x: decision.x, y: decision.y };
      else {
        world.input = { x: world.input.x * .62 + decision.x * .38, y: world.input.y * .62 + decision.y * .38 };
        const length = Math.hypot(world.input.x, world.input.y);
        if (length > 1) world.input = { x: world.input.x / length, y: world.input.y / length };
      }
      if (!same) {
        lockKind = decision.targetKind;
        lockId = decision.targetId;
        lockUntil = world.elapsed + ({ clam: 14, rock: 10, creature: 4, pickup: 2.5 }[decision.targetKind] ?? 0);
      }
      world.released.push(...(decision.released ?? []));
      world.decision = decision;
      clock = .16;
    }
    const pace = typeof speed === "function" ? speed(world) : speed;
    if (world.moving) world.player = { x: world.player.x + world.input.x * pace * dt, y: world.player.y + world.input.y * pace * dt };
    if (onFrame(world, dt)) break;
  }
  return world;
}

test("감독 AI는 추격해 오는 게와 속도를 맞춰 물러나며 집게가 닿는 거리에서 실제로 때려 잡는다", () => {
  // 집게 끝은 몸에서 84px 떨어진 원을 초당 1.55rad로 돌고, 끝이 게 크기 + 10 안에 들면 5.5 피해를 준다(실제 원정 규칙).
  const crab = { id: 91, x: 190, y: 30, hp: 20, xp: 2, score: 15, size: 13, name: "칠게", saltHit: 0 };
  let hits = 0;
  let minimumDistance = Infinity;
  let inBand = 0;
  let fullSpeed = 0;
  const world = simulateSupervisor({
    seconds: 60,
    player: { x: 0, y: 0 },
    build: () => ({ creatures: crab.hp > 0 ? [crab] : [], tongReach: 84, tongRotationSpeed: 1.55 }),
    onFrame: (state, dt) => {
      const dx = state.player.x - crab.x;
      const dy = state.player.y - crab.y;
      const range = Math.hypot(dx, dy) || 1;
      crab.x += dx / range * 38 * dt;
      crab.y += dy / range * 38 * dt;
      minimumDistance = Math.min(minimumDistance, Math.hypot(state.player.x - crab.x, state.player.y - crab.y));
      const band = mudflatSupervisorAttackBand(crab, 84);
      if (range >= band.inner && range <= band.outer) inBand += dt;
      if (Math.hypot(state.input.x, state.input.y) > .9) fullSpeed += dt;
      const angle = state.elapsed * 1.55;
      const tip = { x: state.player.x + Math.cos(angle) * 84, y: state.player.y + Math.sin(angle) * 84 };
      crab.saltHit = Math.max(0, crab.saltHit - dt);
      if (crab.saltHit <= 0 && Math.hypot(crab.x - tip.x, crab.y - tip.y) < crab.size + 10) {
        crab.hp -= 5.5;
        crab.saltHit = .22;
        hits += 1;
      }
      return crab.hp <= 0;
    },
  });

  assert.ok(crab.hp <= 0, `게를 잡지 못했다: 체력 ${crab.hp}, 타격 ${hits}회, ${world.elapsed.toFixed(1)}초`);
  assert.ok(hits >= 4, `타격 ${hits}회`);
  assert.ok(minimumDistance > crab.size + 17, `접촉 피해 거리 안으로 들어갔다: ${minimumDistance}`);
  // 예전에는 구간에 서 있다가 게가 다가오면 최대 속도로 달아나 구간을 벗어났다. 이제는 게 속도(38px/s)만큼만 물러나 구간에 머문다.
  assert.ok(inBand > world.elapsed * .6, `집게 구간에 머문 시간 ${inBand.toFixed(1)}초 / ${world.elapsed.toFixed(1)}초`);
  assert.ok(fullSpeed < 1, `최대 속도로 달아난 시간 ${fullSpeed.toFixed(2)}초`);
  assert.ok(Math.hypot(world.player.x, world.player.y) < 420, `끌려간 거리 ${Math.hypot(world.player.x, world.player.y).toFixed(0)}`);
  assert.deepEqual(world.released, [], "잡는 동안 목표를 포기하지 않는다");
});

test("감독 AI는 게가 집게 거리보다 가까이 오면 최대 속도로 물러나고, 집게가 닿는 구간에서는 선다", () => {
  const band = mudflatSupervisorAttackBand({ size: 13 }, 84);
  assert.ok(band.inner > 13 + 17 && band.inner >= 84 - 23 && band.outer <= 84 + 23, JSON.stringify(band));
  for (const range of [band.inner + 1, 84, band.outer - 1]) {
    const hold = decideMudflatSupervisorMove(scene({ creatures: [{ id: 14, x: range, y: 0, hp: 20, xp: 2, score: 15, size: 13, name: "칠게" }] }));
    assert.deepEqual({ x: hold.x, y: hold.y }, { x: 0, y: 0 }, `${range}px에서 서야 한다`);
  }
  const retreat = decideMudflatSupervisorMove(scene({ creatures: [{ id: 14, x: band.inner - 8, y: 0, hp: 20, xp: 2, score: 15, size: 13, name: "칠게" }] }));
  assert.ok(retreat.x < -.95 && retreat.urgent, `최대 속도로 물러나야 한다 ${JSON.stringify(retreat)}`);
  // 큰 게는 접촉 반경이 커서 구간 안쪽 끝도 그만큼 바깥이다.
  const big = mudflatSupervisorAttackBand({ size: 40 }, 84);
  assert.ok(big.inner >= 40 + 17 + 16 && big.outer > big.inner, JSON.stringify(big));
});

test("감독 AI는 다가오지 않는 복어에게는 132px 거리를 지킨다(대왕 박하지는 따로 상대한다)", () => {
  for (const creature of [{ type: "pufferfish", name: "복어" }]) {
    const base = { id: 15, y: 0, hp: 80, xp: 9, score: 90, size: 20, ...creature };
    const hold = decideMudflatSupervisorMove(scene({ creatures: [{ ...base, x: 132 }] }));
    assert.equal(hold.desiredDistance, 132);
    assert.deepEqual({ x: hold.x, y: hold.y }, { x: 0, y: 0 });
    const close = decideMudflatSupervisorMove(scene({ creatures: [{ ...base, x: 90 }] }));
    assert.ok(close.x < 0, `가까우면 물러난다 ${JSON.stringify(close)}`);
    const far = decideMudflatSupervisorMove(scene({ creatures: [{ ...base, x: 240 }] }));
    assert.ok(far.x > 0, `멀면 다가간다 ${JSON.stringify(far)}`);
  }
});

test("감독 AI는 체력이 줄지 않는 게와 너무 멀리 끌고 가는 게를 포기하고 잠시 고르지 않는다", () => {
  // 맞지 않는 게: 집게가 두 바퀴 반 도는 동안(10초 남짓) 체력이 그대로면 포기한다.
  const tough = { id: 16, x: 84, y: 0, hp: 20, xp: 2, score: 15, size: 13, name: "칠게" };
  const stalled = simulateSupervisor({
    seconds: 14, player: { x: 0, y: 0 },
    build: () => ({ creatures: [tough], tongReach: 84, tongRotationSpeed: 1.55 }),
    onFrame: (state) => state.released.length > 0,
  });
  assert.deepEqual(stalled.released, [{ kind: "creature", id: 16, reason: "hp-stall" }]);
  assert.ok(stalled.elapsed > 9 && stalled.elapsed < 12, `포기한 때 ${stalled.elapsed}`);
  assert.notEqual(stalled.decision.targetId, 16, "포기한 게를 바로 다시 고르지 않는다");

  // 달아나는 게: 처음 자리에서 520px 넘게 끌려가면 포기한다.
  const runner = { id: 17, x: 120, y: 0, hp: 20, xp: 2, score: 15, size: 13, name: "칠게" };
  const dragged = simulateSupervisor({
    seconds: 30, player: { x: 0, y: 0 },
    build: () => ({ creatures: [runner], tongReach: 84, tongRotationSpeed: 1.55 }),
    onFrame: (state, dt) => {
      runner.x += 150 * dt;
      runner.hp -= dt * .2;
      return state.released.length > 0;
    },
  });
  assert.deepEqual(dragged.released, [{ kind: "creature", id: 17, reason: "chase-too-far" }]);
  assert.ok(Math.hypot(dragged.player.x, dragged.player.y) < 560, `끌려간 거리 ${Math.hypot(dragged.player.x, dragged.player.y)}`);
});

// 돌진 복어(실제 원정 4단계 수치): 크기 17.6, 체력 201, 초당 128px로 끝까지 쫓아온다. 플레이어는 초당 169px.
function chasePuffer(overrides = {}) {
  return { id: 60, x: 420, y: 40, hp: 201, xp: 7, score: 68, size: 17.6, name: "복어", type: "pufferfish", eventKind: "puffer-rush", movement: "chase", speed: 128, saltHit: 0, ...overrides };
}

function runChase({ creatures, seconds, playerSpeed = 169, extra = () => ({}), onStep = () => false }) {
  const stats = { hits: 0, contacts: 0, minimumGap: Infinity, intents: new Set(), targetChanges: 0, lastTarget: null };
  const world = simulateSupervisor({
    seconds, player: { x: 0, y: 0 }, speed: playerSpeed,
    build: (state) => ({ creatures: creatures.filter((item) => item.hp > 0), tongReach: 84, tongRotationSpeed: 1.55, playerSpeed: typeof playerSpeed === "function" ? playerSpeed(state) : playerSpeed, ...extra(state) }),
    onFrame: (state, dt) => {
      stats.intents.add(state.decision.intent);
      if (state.decision.targetId !== stats.lastTarget) { stats.targetChanges += 1; stats.lastTarget = state.decision.targetId; }
      const angle = state.elapsed * 1.55;
      const tip = { x: state.player.x + Math.cos(angle) * 84, y: state.player.y + Math.sin(angle) * 84 };
      for (const creature of creatures) {
        if (creature.hp <= 0) continue;
        const dx = state.player.x - creature.x;
        const dy = state.player.y - creature.y;
        const range = Math.hypot(dx, dy) || 1;
        creature.x += dx / range * creature.speed * dt;
        creature.y += dy / range * creature.speed * dt;
        const gap = Math.hypot(state.player.x - creature.x, state.player.y - creature.y);
        stats.minimumGap = Math.min(stats.minimumGap, gap);
        if (gap < creature.size + 17) stats.contacts += 1;
        creature.saltHit = Math.max(0, creature.saltHit - dt);
        if (creature.saltHit <= 0 && Math.hypot(creature.x - tip.x, creature.y - tip.y) < creature.size + 10) {
          creature.hp -= 5.5;
          creature.saltHit = .22;
          stats.hits += 1;
        }
      }
      return onStep(state, stats) || creatures.every((item) => item.hp <= 0);
    },
  });
  return { world, stats };
}

test("감독 AI는 쫓아오는 복어를 위험 벽 밖에서 기다리지 않고, 물러나며 집게로 잡는다", () => {
  const puffer = chasePuffer();
  const { world, stats } = runChase({ creatures: [puffer], seconds: 120 });
  // 예전: 132px에 섰다가 복어가 오면 달아나기를 되풀이해 집게(닿는 거리 111px)가 닿지 않았다. 240초에 5타, 처치 불가.
  assert.ok(puffer.hp <= 0, `복어를 잡지 못했다: 체력 ${puffer.hp.toFixed(0)}, 타격 ${stats.hits}회`);
  assert.ok(world.elapsed < 95, `처치까지 ${world.elapsed.toFixed(1)}초`);
  assert.equal(stats.contacts, 0, "접촉 피해를 입지 않는다");
  assert.ok(stats.minimumGap > puffer.size + 17 + 30, `가장 가까웠던 거리 ${stats.minimumGap.toFixed(1)}`);
  assert.deepEqual(world.released, []);
  // 서다 가다를 되풀이하지 않는다: 의도가 바뀌지 않아 감독 로그에 판단이 쌓이지 않는다.
  assert.ok(stats.intents.size <= 3, `의도 ${[...stats.intents].join(" / ")}`);
  assert.equal(world.flips, 0);
});

test("감독 AI는 복어가 곧 닿을 거리면 호미질보다 먼저 상대하고, 멀리 있으면 호미질을 계속한다", () => {
  const hole = { id: 61, x: 60, y: 0, kind: "clam", progress: 0 };
  const memory = createMudflatSupervisorMemory();
  // 멀리(700px)서 오는 복어: 닿기까지 5초가 넘으므로 가까운 구멍으로 간다.
  const far = decideMudflatSupervisorMove(scene({ creatures: [chasePuffer({ x: 700, y: 0 })], clamHoles: [hole], memory, tongReach: 84 }));
  assert.equal(far.targetKind, "clam");
  // 300px: 2.8초 안에 닿는다. 진행 중인 호미질이 있어도 복어를 먼저 상대한다.
  const digging = { ...hole, x: 10, progress: .6 };
  const near = decideMudflatSupervisorMove(scene({ creatures: [chasePuffer({ x: 300, y: 0 })], clamHoles: [digging], memory: createMudflatSupervisorMemory(), tongReach: 84 }));
  assert.equal(near.targetKind, "creature");
  assert.equal(near.targetId, 60);
  assert.match(near.intent, /복어 물러나며 채집 중/);
  // 지킬 거리는 집게가 닿는 구간 안이고 접촉 반경(크기 + 17)보다 훨씬 바깥이다.
  assert.ok(near.desiredDistance < 84 + 17.6 + 10 && near.desiredDistance > 17.6 + 17 + 40, `지킬 거리 ${near.desiredDistance}`);
  // 집게가 없는 모드에서는 예전처럼 위험 생물로만 다룬다.
  const noTongs = decideMudflatSupervisorMove(scene({ creatures: [chasePuffer({ x: 300, y: 0 })], clamHoles: [], memory: createMudflatSupervisorMemory(), tongReach: 0 }));
  assert.equal(noTongs.desiredDistance, 132);
});

test("감독 AI는 다가오지 않는 복어에게는 예전처럼 132px 거리를 지킨다", () => {
  // 타원으로 돌며 물러나는 보통 복어: 접근 속도가 없으므로 물러나며 잡는 대상이 아니다.
  const idle = { id: 62, x: 132, y: 0, hp: 80, xp: 9, score: 90, size: 20, name: "복어", type: "pufferfish", movement: "oval", speed: 108 };
  const memory = createMudflatSupervisorMemory();
  decideMudflatSupervisorMove(scene({ creatures: [idle], memory, elapsed: 12 }));
  const hold = decideMudflatSupervisorMove(scene({ creatures: [idle], memory, elapsed: 12.16 }));
  assert.equal(hold.desiredDistance, 132);
  assert.deepEqual({ x: hold.x, y: hold.y }, { x: 0, y: 0 });
});

test("감독 AI는 복어보다 느려지거나 접촉 직전이면 거리 맞추기를 그만두고 최대 속도로 벌린다", () => {
  // 물골처럼 느린 지형: 내 속도(115)가 복어(128)보다 느리다.
  const slow = decideMudflatSupervisorMove(scene({ creatures: [chasePuffer({ x: 96, y: 0 })], memory: createMudflatSupervisorMemory(), tongReach: 84, playerSpeed: 115 }));
  assert.ok(Math.hypot(slow.x, slow.y) > .99 && slow.x < -.5 && slow.urgent, JSON.stringify(slow));
  assert.match(slow.intent, /거리를 벌리는 중 · 복어/);
  // 접촉 반경(34.6px)까지 14px도 남지 않았다.
  const touching = decideMudflatSupervisorMove(scene({ creatures: [chasePuffer({ x: 44, y: 0 })], memory: createMudflatSupervisorMemory(), tongReach: 84, playerSpeed: 169 }));
  assert.ok(Math.hypot(touching.x, touching.y) > .99 && touching.x < -.5 && touching.urgent, JSON.stringify(touching));
  // 정상 속도에 지킬 거리면 복어 속도(128/169)만큼만 물러난다.
  const matched = decideMudflatSupervisorMove(scene({ creatures: [chasePuffer({ x: 95.6, y: 0 })], memory: createMudflatSupervisorMemory(), tongReach: 84, playerSpeed: 169 }));
  assert.ok(Math.abs(Math.hypot(matched.x, matched.y) - 128 / 169) < .05 && matched.x < 0, JSON.stringify(matched));
});

test("감독 AI는 복어 두 마리가 양쪽에서 와도 접촉 없이 한쪽으로 빠져 둘을 뒤에 두고 잡는다", () => {
  const left = chasePuffer({ id: 63, x: -380, y: 10 });
  const right = chasePuffer({ id: 64, x: 380, y: -10 });
  const { world, stats } = runChase({ creatures: [left, right], seconds: 180 });
  assert.equal(stats.contacts, 0, `접촉 ${stats.contacts}프레임, 가장 가까웠던 거리 ${stats.minimumGap.toFixed(1)}`);
  assert.ok(left.hp <= 0 && right.hp <= 0, `남은 체력 ${left.hp.toFixed(0)} / ${right.hp.toFixed(0)} (${world.elapsed.toFixed(1)}초)`);
});

test("감독 AI는 복어가 바로 옆에서 쫓아와도 달아나지 않고 베이스캠프로 돌아간다", () => {
  // 복어가 108px 옆(예전 위험 벽 122px 안)에 있다. 예전에는 벽을 피하느라 캠프 반대쪽으로 달아나 귀환에 실패했다.
  const puffer = chasePuffer({ x: 90, y: 60 });
  const camp = { x: 620, y: 0 };
  let contacts = 0;
  const world = simulateSupervisor({
    seconds: 9, player: { x: 0, y: 0 }, speed: 169,
    build: () => ({ creatures: [puffer], baseCampGuideShown: true, baseCamp: camp, tongReach: 84, playerSpeed: 169 }),
    onFrame: (state, dt) => {
      const dx = state.player.x - puffer.x;
      const dy = state.player.y - puffer.y;
      const range = Math.hypot(dx, dy) || 1;
      puffer.x += dx / range * puffer.speed * dt;
      puffer.y += dy / range * puffer.speed * dt;
      if (Math.hypot(state.player.x - puffer.x, state.player.y - puffer.y) < puffer.size + 17) contacts += 1;
      return Math.hypot(state.player.x - camp.x, state.player.y - camp.y) <= 28;
    },
  });
  assert.ok(Math.hypot(world.player.x - camp.x, world.player.y - camp.y) <= 28, `캠프까지 남은 거리 ${Math.hypot(world.player.x - camp.x, world.player.y - camp.y).toFixed(0)}`);
  assert.ok(world.elapsed < 5.5, `귀환 시간 ${world.elapsed.toFixed(1)}초`);
  assert.equal(contacts, 0);
});

test("감독 AI는 추격자가 없어도 가까운 큰 경험치를 호미질보다 먼저 줍고, 진행 중인 호미질은 끝낸다", () => {
  const hole = { id: 73, x: 300, y: 0, kind: "clam", progress: 0 };
  const reward = { id: 74, x: -120, y: 0, xp: 7, phase: "idle" };
  // 예전에는 안전하면 구멍이 먼저여서, 방금 잡은 복어의 경험치를 두고 먼 구멍으로 갔다.
  const fetch = decideMudflatSupervisorMove(scene({ pickups: [reward], clamHoles: [hole] }));
  assert.equal(fetch.targetKind, "pickup");
  assert.equal(fetch.intent, "잡은 경험치 회수 중");
  // 안전하게 닿는 가까운 작은 경험치도 구멍으로 걸어가기 전에 줍는다(전속력으로 다녀온다).
  const small = decideMudflatSupervisorMove(scene({ pickups: [{ ...reward, xp: 3 }], clamHoles: [hole] }));
  assert.equal(small.intent, "가까운 경험치 회수 중");
  assert.ok(small.x < -.95 && small.urgent, JSON.stringify(small));
  // 멀리 있는 경험치는 그 둘레(180px)에 많이 떨어져 있을 때만 돌아가 줍는다(둘레 경험치 × 10px까지).
  assert.equal(decideMudflatSupervisorMove(scene({ pickups: [{ ...reward, x: -260 }], clamHoles: [hole] })).targetKind, "clam");
  const heap = [0, 1, 2, 3].map((index) => ({ id: 80 + index, x: -260 - index * 30, y: index * 20, xp: 4, phase: "idle" }));
  assert.equal(decideMudflatSupervisorMove(scene({ pickups: heap.slice(0, 2), clamHoles: [hole] })).targetKind, "clam");
  heap.push(...[0, 1, 2, 3].map((index) => ({ id: 84 + index, x: -300 - index * 30, y: -40 - index * 10, xp: 4, phase: "idle" })));
  assert.equal(decideMudflatSupervisorMove(scene({ pickups: heap, clamHoles: [hole] })).targetKind, "pickup");
  // 호미질이 진행 중이면 끝낸 뒤에 줍는다.
  const digging = decideMudflatSupervisorMove(scene({ pickups: [reward], clamHoles: [{ ...hole, x: 20, progress: .8 }] }));
  assert.equal(digging.targetKind, "clam");
});

// 남북으로 끝없이 뻗은 폭 64px 물골(3단계 물골과 같은 폭). 안에서는 이동 속도가 0.68배가 된다.
const channelAt = (center) => (point) => Math.abs(point.x - center) < 32 ? .65 : 0;

test("감독 AI는 베이스캠프가 물골 건너편에 있어도 물골을 건너 돌아간다", () => {
  // 예전에는 물골 한 걸음의 벌점이 귀환 진전 점수보다 커서, 물골을 따라 위아래로 가다 캠프에서 멀어져 귀환에 실패했다.
  const terrainRisk = channelAt(300);
  const camp = { x: 650, y: 0 };
  const world = simulateSupervisor({
    seconds: 10, player: { x: 0, y: 0 },
    speed: (state) => 149 * (terrainRisk(state.player) > 0 ? .68 : 1),
    build: () => ({ baseCampGuideShown: true, baseCamp: camp, terrainRisk, stage: 3 }),
    onFrame: (state) => Math.hypot(state.player.x - camp.x, state.player.y - camp.y) <= 28,
  });
  assert.ok(Math.hypot(world.player.x - camp.x, world.player.y - camp.y) <= 28, `캠프까지 남은 거리 ${Math.hypot(world.player.x - camp.x, world.player.y - camp.y).toFixed(0)}`);
  assert.ok(world.elapsed < 6, `귀환 시간 ${world.elapsed.toFixed(1)}초`);
});

test("감독 AI는 복어에게서 물러나는 길에 물골이 있으면 들어가지 않고 물골을 따라 비켜 간다", () => {
  // 복어는 서쪽에서 오고, 물러날 동쪽 150px에 물골이 있다. 들어가면 속도(101)가 복어(125)보다 느려져 따라잡힌다.
  const terrainRisk = channelAt(150);
  const puffer = chasePuffer({ x: -330, y: 0, speed: 125 });
  let slowed = 0;
  const pace = (state) => 149 * (terrainRisk(state.player) > 0 ? .68 : 1);
  const { world, stats } = runChase({
    creatures: [puffer], seconds: 60, playerSpeed: pace,
    extra: (state) => ({ terrainRisk, stage: 3, playerSpeed: pace(state) }),
    onStep: (state) => { if (terrainRisk(state.player) > 0) slowed += 1 / 60; return false; },
  });
  assert.equal(stats.contacts, 0, `접촉 ${stats.contacts}프레임, 가장 가까웠던 거리 ${stats.minimumGap.toFixed(1)}`);
  assert.ok(slowed < 1, `물골 안에 있던 시간 ${slowed.toFixed(2)}초`);
  assert.ok(stats.hits >= 15, `타격 ${stats.hits}회 (${world.elapsed.toFixed(0)}초)`);
});

test("감독 AI는 다음 복어가 닿기 전에 주울 수 있으면 방금 잡은 경험치를 먼저 줍는다", () => {
  // 복어는 330px 밖(2.3초 거리), 경험치는 반대쪽 60px.
  const reward = { id: 70, x: -60, y: 0, xp: 7, phase: "idle" };
  const grab = decideMudflatSupervisorMove(scene({ creatures: [chasePuffer({ x: 330, y: 0 })], pickups: [reward], memory: createMudflatSupervisorMemory(), tongReach: 84, playerSpeed: 169 }));
  assert.equal(grab.targetKind, "pickup");
  assert.equal(grab.intent, "잡은 경험치 회수 중");
  assert.ok(grab.x < -.95 && grab.urgent, JSON.stringify(grab));
  // 경험치가 복어 쪽에 있어 주우러 가면 닿을 거리면 복어를 먼저 상대한다.
  // (반경에 닿는 자리 76px까지 0.45초, 그동안 복어가 58px 다가와 접촉 반경까지 22px만 남는다. 35px은 남아야 한다.)
  const risky = decideMudflatSupervisorMove(scene({ creatures: [chasePuffer({ x: 190, y: 0 })], pickups: [{ ...reward, x: 120 }], memory: createMudflatSupervisorMemory(), tongReach: 84, playerSpeed: 169 }));
  assert.equal(risky.targetKind, "creature");
  // 같은 경험치라도 복어가 260px 밖이면 다녀올 수 있다(섰을 때 접촉 반경까지 92px).
  const reachable = decideMudflatSupervisorMove(scene({ creatures: [chasePuffer({ x: 260, y: 0 })], pickups: [{ ...reward, x: 120 }], memory: createMudflatSupervisorMemory(), tongReach: 84, playerSpeed: 169 }));
  assert.equal(reachable.targetKind, "pickup");
  // 막 떨어져 솟아오르는 경험치도 미리 주우러 간다.
  const rising = decideMudflatSupervisorMove(scene({ creatures: [chasePuffer({ x: 330, y: 0 })], pickups: [{ ...reward, phase: "spawn" }], memory: createMudflatSupervisorMemory(), tongReach: 84, playerSpeed: 169 }));
  assert.equal(rising.targetKind, "pickup");
  // 작은 경험치(5 미만)는 주우러 가지 않는다: 게 무리 속에 남아 있어 들어가면 물러날 길이 막힌다.
  const small = decideMudflatSupervisorMove(scene({ creatures: [chasePuffer({ x: 330, y: 0 })], pickups: [{ ...reward, xp: 3 }], memory: createMudflatSupervisorMemory(), tongReach: 84, playerSpeed: 169 }));
  assert.equal(small.targetKind, "creature");
  const pulled = decideMudflatSupervisorMove(scene({ creatures: [chasePuffer({ x: 330, y: 0 })], pickups: [{ ...reward, phase: "pull" }], memory: createMudflatSupervisorMemory(), tongReach: 84, playerSpeed: 169 }));
  assert.equal(pulled.targetKind, "creature");
});

test("감독 AI는 바위 벽을 돌아 조개구멍에 닿아 호미질을 끝낸다(방향을 뒤집거나 서지 않는다)", () => {
  // 플레이어와 구멍 사이를 바위 다섯이 가로막는다. 곧장 가면 바위에 부딪히므로 위나 아래로 돌아가야 한다.
  const rocks = [-80, -40, 0, 40, 80].map((y, index) => ({ id: 200 + index, x: 150, y, radius: 24 }));
  const hole = { id: 210, x: 300, y: 0, kind: "clam", progress: 0 };
  let touchedRock = false;
  let stalledSeconds = 0;
  let finishedAt = null;
  const world = simulateSupervisor({
    seconds: 30, player: { x: 0, y: 0 },
    build: () => ({ rocks, clamHoles: [hole], elapsed: 0 }),
    onFrame: (state, dt) => {
      if (rocks.some((rock) => Math.hypot(rock.x - state.player.x, rock.y - state.player.y) < rock.radius + 16)) touchedRock = true;
      const range = Math.hypot(state.player.x - hole.x, state.player.y - hole.y);
      const still = Math.hypot(state.input.x, state.input.y) <= .05;
      if (still && range > 48) stalledSeconds += dt;
      if (mudflatSupervisorCanDig({ targetKind: state.decision.targetKind, x: state.input.x, y: state.input.y }) && range <= 48) hole.progress += dt;
      else hole.progress = 0;
      if (hole.progress >= 2) { finishedAt = state.elapsed; return true; }
      return false;
    },
  });

  assert.ok(finishedAt !== null, `호미질을 끝내지 못했다: 위치 ${JSON.stringify(world.player)}, 목표 ${world.decision.targetKind}`);
  assert.ok(finishedAt < 12, `걸린 시간 ${finishedAt}`);
  assert.equal(touchedRock, false, "바위에 닿지 않는다");
  assert.ok(world.flips <= 1, `같은 목표에서 방향 급반전 ${world.flips}회`);
  assert.ok(stalledSeconds < .5, `가는 길에 멈춰 있던 시간 ${stalledSeconds.toFixed(2)}초`);
  assert.deepEqual(world.released, []);
});

test("감독 AI는 바위에 둘러싸여 닿을 수 없는 구멍을 잠시 블랙리스트에 올리고 다른 구멍으로 간다", () => {
  // 구멍 A는 반지름 88px의 바위 고리 안에 있어 들어갈 틈이 없다. 구멍 B는 열려 있다.
  const ring = Array.from({ length: 12 }, (_, index) => ({ id: 300 + index, x: 260 + Math.cos(index / 12 * Math.PI * 2) * 88, y: Math.sin(index / 12 * Math.PI * 2) * 88, radius: 24 }));
  const closed = { id: 320, x: 260, y: 0, kind: "clam", progress: 0 };
  const open = { id: 321, x: -40, y: 330, kind: "clam", progress: 0 };
  const memory = createMudflatSupervisorMemory();
  const decision = decideMudflatSupervisorMove(scene({ elapsed: 1, memory, rocks: ring, clamHoles: [closed, open] }));

  assert.deepEqual(decision.released, [{ kind: "clam", id: 320, reason: "unreachable" }]);
  assert.equal(decision.targetKind, "clam");
  assert.equal(decision.targetId, 321);
  // 블랙리스트는 20초 뒤에 풀린다(그때 다시 도달 가능성을 따진다).
  const later = decideMudflatSupervisorMove(scene({ elapsed: 5, memory, rocks: ring, clamHoles: [closed] }));
  assert.notEqual(later.targetId, 320, "풀리기 전에는 고르지 않는다");
  assert.deepEqual(later.released, []);
  const retry = decideMudflatSupervisorMove(scene({ elapsed: 22, memory, rocks: ring, clamHoles: [closed] }));
  assert.deepEqual(retry.released, [{ kind: "clam", id: 320, reason: "unreachable" }], "풀린 뒤 다시 따져 보고 또 올린다");
});

test("감독 AI는 이동 명령을 내도 목표에 가까워지지 않으면 그 목표를 풀고 블랙리스트에 올린다", () => {
  const hole = { id: 330, x: 220, y: 0, kind: "clam", progress: 0 };
  const other = { id: 331, x: -260, y: 60, kind: "clam", progress: 0 };
  const world = simulateSupervisor({
    seconds: 10, player: { x: 0, y: 0 },
    build: () => ({ clamHoles: [hole, other], elapsed: 0 }),
    // 플레이어가 어디에 걸려 움직이지 못하는 상황을 만든다.
    onFrame: (state) => { state.moving = state.released.length > 0; return state.released.length > 0 && state.elapsed > 6; },
  });

  assert.deepEqual(world.released, [{ kind: "clam", id: 330, reason: "no-progress" }]);
  assert.equal(world.decision.targetId, 331, "다른 구멍으로 목표를 바꾼다");
});

test("감독 AI는 호미질과 바위 뒤집기가 함께 진행되는 동안 제자리에 서서 둘 다 막지 않는다", () => {
  const state = scene({
    elapsed: 16,
    rockerLevel: 1,
    rockReach: 84,
    activeRockId: 42,
    rocks: [{ id: 42, x: 86, y: 0, radius: 22 }],
    clamHoles: [{ id: 43, x: 0, y: 40, kind: "clam", progress: .8 }],
  });
  const decision = decideMudflatSupervisorMove(state);

  assert.deepEqual({ x: decision.x, y: decision.y }, { x: 0, y: 0 }, "구멍에서 40px 떨어져 있어도 진행 중이면 움직이지 않는다");
  assert.equal(decision.targetKind, "clam");
  assert.equal(mudflatSupervisorCanDig(decision), true);
  // 바위만 뒤집는 동안에도 서 있으면 호미질을 막지 않는다.
  const flipping = decideMudflatSupervisorMove(scene({ elapsed: 16, rockerLevel: 1, rockReach: 84, activeRockId: 42, rocks: [{ id: 42, x: 72, y: 0, radius: 22 }] }));
  assert.equal(flipping.targetKind, "rock");
  assert.equal(mudflatSupervisorCanDig(flipping), true);
  assert.equal(mudflatSupervisorCanDig({ targetKind: "rock", x: .6, y: 0 }), false);
});

test("해산물이 오래 보이지 않으면 조개구멍을 포기하고 들어온 방향으로 되돌아간다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    emptySeafoodRisk: 8,
    retreatDirection: { x: -1, y: 0 },
    clamHoles: [{ x: 12, y: 0, kind: "clam" }],
  }));

  assert.equal(decision.targetKind, "seafood-search");
  assert.equal(decision.intent, "해산물이 보이는 곳으로 되돌아가는 중");
  assert.ok(decision.x < -.7, `expected retreat, got ${JSON.stringify(decision)}`);
});

// ── 실제 원정 로그(1단계, 빌드 44adfbb)에서 찾은 문제의 회귀 테스트 ──────────────────────────────
const chaseCrab = (overrides = {}) => ({ id: 200, x: 150, y: 0, hp: 14, xp: 4, score: 38, size: 17, speed: 45, name: "농게", type: "fiddler-crab", movement: "chase", ...overrides });

test("감독 AI는 게 무리 한가운데 떨어진 경험치를 고르지 않고, 무리가 자리를 뜨면 줍는다", () => {
  const reward = { id: 300, x: 150, y: 0, xp: 6, phase: "idle" };
  // 민꽃게 보상 둘레와 그 뒤에서 게 여섯 마리가 쫓아온다. 예전에는 이 보상을 골라 4.5초 동안 둘레만 돌다가 포기했다.
  const crowd = [[150, 30], [170, -35], [205, 10], [230, -50], [240, 55], [280, 0]].map(([x, y], index) => chaseCrab({ id: 201 + index, x, y }));
  const blocked = decideMudflatSupervisorMove(scene({ pickups: [reward], creatures: crowd, pickupRadius: 74 }));
  assert.notEqual(blocked.targetKind, "pickup", JSON.stringify(blocked));
  // 같은 보상이라도 게들이 아직 멀면(줍는 자리에 닿기 전에 오지 못하면) 줍는다.
  const far = crowd.map((crab) => ({ ...crab, x: crab.x + 260 }));
  const open = decideMudflatSupervisorMove(scene({ pickups: [reward], creatures: far, pickupRadius: 74 }));
  assert.equal(open.intent, "잡은 경험치 회수 중");
  // 복어가 쫓아오는 동안에는 작은 경험치를 주우러 들어가지 않는다(큰 경험치만 안전할 때 줍는다).
  const chased = decideMudflatSupervisorMove(scene({ pickups: [{ ...reward, x: -120, xp: 3 }], creatures: [chasePuffer({ x: 700, y: 0 })], tongReach: 84 }));
  assert.notEqual(chased.targetKind, "pickup");
});

test("감독 AI는 끝낼 시간이 되는 호미질을 게가 다가와도 멈추지 않고, 안 되면 멈춘다", () => {
  const hole = { id: 310, x: 20, y: 0, kind: "clam", progress: 1.5 };
  // 농게가 85px에서 쫓아온다: 접촉 반경(34px)까지 51px, 초속 45px이면 1.1초 걸린다. 호미질은 0.5초 남았다.
  // 예전에는 게가 72px + 크기 안에 들어오면 남은 시간과 상관없이 멈췄다(실제 원정에서 75% 판 구멍을 두 번 버렸다).
  const finish = decideMudflatSupervisorMove(scene({ clamHoles: [hole], creatures: [chaseCrab({ x: -85 })] }));
  assert.equal(finish.targetKind, "clam");
  assert.deepEqual({ x: finish.x, y: finish.y }, { x: 0, y: 0 });
  assert.ok(mudflatSupervisorCanDig(finish));
  // 60px이면 0.6초 안에 닿는다: 멈추고 게부터 상대한다.
  const stop = decideMudflatSupervisorMove(scene({ clamHoles: [hole], creatures: [chaseCrab({ x: -60 })] }));
  assert.notEqual(stop.targetKind, "clam", JSON.stringify(stop));
  // 막 시작한 호미질(2초 남음)은 85px의 게가 먼저 닿으므로 계속하지 않는다.
  const early = decideMudflatSupervisorMove(scene({ clamHoles: [{ ...hole, progress: .1 }], creatures: [chaseCrab({ x: -85 })] }));
  assert.notEqual(early.targetKind, "clam");
});

test("감독 AI는 가는 시간과 호미질 시간 안에 게가 닿지 못하는 구멍만 고른다", () => {
  const hole = { id: 311, x: 100, y: 0, kind: "clam", progress: 0 };
  // 게가 반대쪽 150px에서 쫓아온다: 구멍 앞까지 0.5초 + 호미질 2초 동안 약 130px 오고, 구멍 앞에서는 226px 떨어져 있다.
  const reachable = decideMudflatSupervisorMove(scene({ clamHoles: [hole], creatures: [chaseCrab({ x: -150 })] }));
  assert.equal(reachable.targetKind, "clam");
  assert.ok(reachable.x > .5);
  // 60px에서 쫓아오면 호미질을 끝내기 전에 닿는다: 구멍으로 가지 않는다.
  const hopeless = decideMudflatSupervisorMove(scene({ clamHoles: [hole], creatures: [chaseCrab({ x: -60 })] }));
  assert.notEqual(hopeless.targetKind, "clam");
  // 쫓아오지 않는 생물이 구멍 곁에 있어도, 이미 고른 구멍은 고정 여유(20px) 바깥이면 바꾸지 않는다.
  const wanderer = { id: 312, x: 100, y: 62, hp: 5, xp: 3, score: 22, size: 11, speed: 34, name: "작은 새우", movement: "wander" };
  assert.notEqual(decideMudflatSupervisorMove(scene({ clamHoles: [hole], creatures: [wanderer] })).targetId, 311, "새로 고를 때는 46px 여유가 필요하다");
  assert.equal(decideMudflatSupervisorMove(scene({ clamHoles: [hole], creatures: [wanderer], lockedTargetKind: "clam", lockedTargetId: 311 })).targetId, 311);
});

test("감독 AI는 쫓아오는 게 가운데 맨 앞의 게부터 상대하고, 때리던 게는 고정 시간이 지나도 마저 잡는다", () => {
  const front = chaseCrab({ id: 320, x: 118, y: 0, hp: 3, xp: 1, score: 6, size: 11, speed: 25, name: "작은게" });
  const valuable = chaseCrab({ id: 321, x: 160, y: 20, hp: 30, xp: 10, score: 110, size: 24, speed: 40, name: "보라돌이" });
  // 예전에는 값이 높은 먼 게를 골랐고, 앞의 게를 피하느라 집게가 닿지 않는 거리로 밀려났다.
  const pick = decideMudflatSupervisorMove(scene({ creatures: [valuable, front], tongReach: 84 }));
  assert.equal(pick.targetId, 320);
  // 구간 조금 바깥에서 오는 게는 다가가지 않고 기다린다(다가가면 뒤따르는 무리 속으로 들어간다).
  assert.deepEqual({ x: pick.x, y: pick.y }, { x: 0, y: 0 });

  // 농게를 한 대 때린 뒤 고정 시간이 풀려도(잠긴 목표 없음), 닿는 구멍이 있어도 그 게를 마저 잡는다.
  const memory = createMudflatSupervisorMemory();
  const crab = chaseCrab({ id: 322, x: 84, y: 0, hp: 14 });
  const hole = { id: 323, x: -300, y: 0, kind: "clam", progress: 0 };
  const build = (elapsed, hp) => scene({ elapsed, memory, creatures: [{ ...crab, hp }], clamHoles: [hole], tongReach: 84, lockedTargetKind: "creature", lockedTargetId: 322 });
  decideMudflatSupervisorMove(build(12, 14));
  decideMudflatSupervisorMove(build(12.16, 8.5));
  const after = decideMudflatSupervisorMove({ ...build(12.32, 8.5), lockedTargetKind: null, lockedTargetId: null });
  assert.equal(after.targetId, 322, JSON.stringify(after));
});

test("감독 AI는 목표 쪽에 게가 몰려 있어도 달아나지 않고, 물러날 쪽에서 게가 오면 빠져나간다", () => {
  const target = chaseCrab({ id: 330, x: 84, y: 0 });
  // 목표 뒤(같은 쪽)에 게 다섯 마리: 예전에는 무리 벌점 합이 1,000을 넘어 "거리를 벌리는 중"으로 달아났다.
  const behind = [[150, 0], [150, 45], [150, -45], [165, 85], [165, -85]].map(([x, y], index) => chaseCrab({ id: 331 + index, x, y }));
  const hold = decideMudflatSupervisorMove(scene({ creatures: [target, ...behind], tongReach: 84, memory: createMudflatSupervisorMemory() }));
  assert.equal(hold.targetId, 330);
  assert.doesNotMatch(hold.intent, /거리를 벌리는 중/);
  assert.ok(Math.hypot(hold.x, hold.y) < .6, `속도를 맞춰 물러난다 ${JSON.stringify(hold)}`);
  // 물러날 쪽(뒤)에 게 두 마리가 가까이 있으면 둘러싸이기 전에 최대 속도로 빠진다.
  const flank = [chaseCrab({ id: 340, x: -80, y: 30 }), chaseCrab({ id: 341, x: -80, y: -30 })];
  const escape = decideMudflatSupervisorMove(scene({ creatures: [target, ...flank], tongReach: 84, memory: createMudflatSupervisorMemory() }));
  assert.ok(Math.hypot(escape.x, escape.y) > .99 && escape.urgent, JSON.stringify(escape));
});

test("감독 AI는 느린 일반 게를 상대하면서 물골·깊은 펄에 들어가 서지 않는다", () => {
  // 게들은 서쪽에서 오고, 물러날 동쪽 120px에 물골이 있다. 게보다는 빨라서 물골 안에서도 잡을 수 있지만,
  // 거기 서 있다가 돌진 복어를 만나면 따라잡힌다(실제 원정 3단계에서 그렇게 복어에 닿았다).
  const terrainRisk = channelAt(120);
  const crabs = [0, 1, 2, 3].map((index) => chaseCrab({ id: 360 + index, x: -150 - index * 60, y: (index % 2) * 40 - 20, hp: 60, saltHit: 0 }));
  let slowed = 0;
  const { stats } = runChase({
    creatures: crabs, seconds: 30, playerSpeed: 155,
    extra: () => ({ terrainRisk, stage: 3 }),
    onStep: (state) => { if (terrainRisk(state.player) > 0) slowed += 1 / 60; return false; },
  });
  assert.equal(stats.contacts, 0);
  assert.ok(slowed < 1.5, `물골 안에 있던 시간 ${slowed.toFixed(2)}초`);
  assert.ok(stats.hits >= 10, `타격 ${stats.hits}회`);
});

// 대왕 박하지(1단계 체력 483, 속도 28, 크기 43)를 게임 규칙대로 상대한다: 집게 끝은 몸에서 84px 떨어진 원을 돌고,
// 끝이 보스 중심에서 53px 안에 있을 때 0.22초마다 한 번 맞는다.
const bossAt = (x, y, overrides = {}) => ({ id: 90, x, y, hp: 483, maxHp: 483, xp: 80, score: 1800, size: 43, speed: 28, name: "대왕 박하지", type: "king-crab", boss: true, movement: "chase", ...overrides });
function bossDuel({ level = 1, seconds = 30, startedAt = 200, hp = 483 }) {
  const rotation = 1.55 * 1.5 ** (level - 1);
  const power = 5.5 * 1.5 ** (level - 1);
  const memory = createMudflatSupervisorMemory();
  const boss = bossAt(420, 60, { hp, maxHp: hp });
  const player = { x: 0, y: 0, hp: 100, maxHp: 100 };
  const result = { caughtAfter: null, contacts: 0, released: [], hp: boss.hp, lastTarget: null };
  let input = { x: 0, y: 0 };
  let clock = 0;
  let saltHit = 0;
  const dt = 1 / 60;
  for (let elapsed = startedAt; elapsed < startedAt + seconds; elapsed += dt) {
    clock -= dt;
    if (clock <= 0) {
      const decision = decideMudflatSupervisorMove(scene({
        elapsed, player, memory, creatures: boss.hp > 0 ? [boss] : [], tongReach: 84, tongRotationSpeed: rotation, playerSpeed: 155,
        tongAngle: elapsed * rotation,
      }));
      input = { x: decision.x, y: decision.y };
      result.released.push(...(decision.released ?? []));
      result.lastTarget = decision.targetId;
      clock = .16;
    }
    player.x += input.x * 155 * dt;
    player.y += input.y * 155 * dt;
    const range = Math.hypot(player.x - boss.x, player.y - boss.y);
    boss.x += (player.x - boss.x) / range * boss.speed * dt;
    boss.y += (player.y - boss.y) / range * boss.speed * dt;
    saltHit -= dt;
    if (saltHit <= 0 && Math.hypot(boss.x - player.x - Math.cos(elapsed * rotation) * 84, boss.y - player.y - Math.sin(elapsed * rotation) * 84) < boss.size + 10) {
      boss.hp -= power;
      saltHit = .22;
    }
    if (range < boss.size + 17) result.contacts += 1;
    result.hp = boss.hp;
    if (boss.hp <= 0) { result.caughtAfter = elapsed - startedAt; break; }
  }
  return result;
}

test("감독 AI는 대왕 박하지가 나타나면 하던 일을 두고 다가가, 집게 끝이 보스 가운데를 지나는 거리에서 상대한다", () => {
  const hole = { id: 350, x: -60, y: 0, kind: "clam", progress: 0 };
  const reward = { id: 351, x: -120, y: 0, xp: 7, phase: "idle" };
  const approach = decideMudflatSupervisorMove(scene({ elapsed: 200.2, creatures: [bossAt(500, 0)], clamHoles: [hole], pickups: [reward], tongReach: 84 }));
  assert.equal(approach.targetId, 90);
  assert.match(approach.intent, /대왕 박하지에게 다가가는 중/);
  assert.ok(approach.x > .9 && approach.urgent, JSON.stringify(approach));
  assert.equal(approach.desiredDistance, 84);
  // 돌진 복어가 곧 닿을 거리면 복어부터 상대한다.
  const puffer = decideMudflatSupervisorMove(scene({ elapsed: 200.2, creatures: [bossAt(500, 0), chasePuffer({ x: -150, y: 0 })], tongReach: 84 }));
  assert.equal(puffer.targetId, 60);
  // 집게가 없거나(아이 모드) 내 체력이 30% 아래면 덤비지 않는다.
  assert.doesNotMatch(decideMudflatSupervisorMove(scene({ elapsed: 200.2, creatures: [bossAt(500, 0)], tongReach: 0 })).intent, /다가가는 중|둘레를 돌며/);
  assert.doesNotMatch(decideMudflatSupervisorMove(scene({ elapsed: 200.2, player: { x: 0, y: 0, hp: 25, maxHp: 100 }, creatures: [bossAt(500, 0)], tongReach: 84 })).intent, /다가가는 중|둘레를 돌며/);
});

test("감독 AI는 집게 회전에 맞춰 대왕 박하지 둘레를 돌아 귀환 알림 전에 잡고, 가망이 없으면 그만둔다", () => {
  for (const level of [1, 2, 3]) {
    const duel = bossDuel({ level });
    assert.ok(duel.caughtAfter !== null && duel.caughtAfter < 27, `집게 ${level}레벨: ${JSON.stringify(duel)}`);
    assert.equal(duel.contacts, 0, `집게 ${level}레벨 접촉`);
  }
  // 서서 맞히면 집게가 한 바퀴(4초)에 0.8초만 닿아 초당 5쯤 깎는다: 30초에 160. 둘레를 돌면 초당 20을 넘는다.
  assert.ok(483 / bossDuel({ level: 1 }).caughtAfter > 20);
  // 체력이 훨씬 많은 보스(끝없는 물때 등): 9초 상대해 본 속도로 돌아갈 때까지 못 잡으면 그만두고 다시 고르지 않는다.
  const hopeless = bossDuel({ level: 1, hp: 2400 });
  assert.equal(hopeless.caughtAfter, null);
  assert.deepEqual(hopeless.released, [{ kind: "creature", id: 90, reason: "boss-out-of-time" }]);
  assert.notEqual(hopeless.lastTarget, 90);
  assert.ok(hopeless.hp > 2000, `그만둔 뒤에는 때리지 않는다 ${hopeless.hp}`);
});

test("감독 AI는 귀환 알림이 뜨면 거의 다 잡은 대왕 박하지도 두고 돌아간다", () => {
  // 알림 뒤에 마저 잡게 했을 때는, 보스 곁에 몰린 게 수십 마리를 돌아 나오느라 240초를 넘겨 밀물에 쓰러졌다.
  const memory = createMudflatSupervisorMemory();
  memory.boss = { id: 90, hp: 20, engaged: 20, at: 229.84, startHp: 483 };
  const decision = decideMudflatSupervisorMove(scene({
    elapsed: 230.1, baseCampGuideShown: true, baseCamp: { x: -600, y: 0 }, tongReach: 84, playerSpeed: 155,
    creatures: [bossAt(84, 0, { hp: 20 })], memory,
  }));
  assert.equal(decision.targetKind, "camp");
  assert.ok(decision.x < -.9, JSON.stringify(decision));
});

test("감독 AI는 귀환 시간이 빠듯하면 게 무리를 돌아가지 않고 접촉 반경만 피해 곧장 캠프로 간다", () => {
  // 캠프는 서쪽 320px, 그 사이에 게 두 마리가 90px 간격으로 서 있다(사이 통로는 접촉 반경 바깥).
  const wall = [chaseCrab({ id: 370, x: -70, y: 45, speed: 0, movement: "wander" }), chaseCrab({ id: 371, x: -70, y: -45, speed: 0, movement: "wander" })];
  const back = (elapsed) => decideMudflatSupervisorMove(scene({ elapsed, baseCampGuideShown: true, baseCamp: { x: -320, y: 0 }, creatures: wall, playerSpeed: 155 }));
  // 여유가 넉넉하면(231초: 9초 남고 2초 거리) 무리 벌점 때문에 사이로 지나가지 않는다.
  const calm = back(231);
  assert.equal(calm.targetKind, "camp");
  assert.ok(calm.x > -.95, `넉넉할 때는 돌아간다 ${JSON.stringify(calm)}`);
  // 빠듯하면(236초: 4초 남고 2초 거리, 여유 3초 미만) 사이로 곧장 간다.
  const rushed = back(236);
  assert.ok(rushed.x < -.95 && Math.abs(rushed.y) < .2, `빠듯할 때는 곧장 간다 ${JSON.stringify(rushed)}`);
  // 그래도 접촉 반경 안으로는 들어가지 않는다: 게가 길 한가운데 있으면 비켜 간다.
  const blocked = decideMudflatSupervisorMove(scene({ elapsed: 236, baseCampGuideShown: true, baseCamp: { x: -320, y: 0 }, creatures: [chaseCrab({ id: 372, x: -45, y: 0, speed: 0, movement: "wander" })], playerSpeed: 155 }));
  assert.ok(Math.abs(blocked.y) > .25, JSON.stringify(blocked));
});

test("자동 정비는 원본을 바꾸지 않고 체력 회복과 장비 구매를 수행한다", () => {
  const campaign = {
    stage: 5,
    mode: "normal",
    coins: 8000,
    hp: 15,
    maxHp: 100,
    baseMaxHp: 100,
    equipment: {},
    levels: { snack: 0 },
  };
  const original = structuredClone(campaign);
  const maintained = maintainMudflatSupervisorCampaign(campaign);

  assert.deepEqual(campaign, original);
  assert.ok(maintained.coins < campaign.coins);
  assert.equal(maintained.hp, maintained.maxHp);
  assert.ok(Object.keys(maintained.equipment).length >= 2);
  assert.equal(maintained.equipment.mosquitoRepellent, 1);
});

test("자동 정비는 회복 값을 남기고 집게 훈련을 장비보다 먼저 3레벨까지 산다", () => {
  const campaign = { stage: 4, mode: "normal", coins: 5500, hp: 100, maxHp: 100, baseMaxHp: 100, equipment: {}, levels: { tongs: 1, digging: 1 } };
  const original = structuredClone(campaign);
  const maintained = maintainMudflatSupervisorCampaign(campaign);
  assert.deepEqual(campaign, original);
  // Lv.2 2,000코인 + Lv.3 3,000코인.
  assert.equal(maintained.levels.tongs, 3);
  assert.equal(maintained.levels.digging, 1);
  assert.ok(maintained.coins <= 500);

  // 코인이 모자라면(Lv.2 값 + 회복 값) 훈련하지 않고 예전처럼 장비만 산다.
  const poor = maintainMudflatSupervisorCampaign({ ...campaign, coins: 2050 });
  assert.equal(poor.levels.tongs, 1);
  // 아이 모드에는 집게 훈련이 없다.
  const kids = maintainMudflatSupervisorCampaign({ ...campaign, mode: "kids" });
  assert.equal(kids.levels.tongs, 1);
});

test("감독모드 로그는 초기 상태와 순번을 보존하며 최대 길이를 제한한다", () => {
  const log = createMudflatSupervisorLog({
    buildId: "test-build",
    startedAt: 0,
    seed: 123,
    campaign: { stage: 1, level: 1, hp: 100, maxHp: 100, coins: 0, levels: { tongs: 1 }, equipment: {} },
  });

  for (let index = 0; index < MUDFLAT_SUPERVISOR_LOG_LIMIT + 5; index += 1) {
    appendMudflatSupervisorLog(log, { event: "snapshot", detail: String(index) });
  }
  const exported = JSON.parse(serializeMudflatSupervisorLog(log, 1000));

  assert.equal(exported.buildId, "test-build");
  assert.equal(exported.initialCampaign.levels.tongs, 1);
  assert.equal(exported.entries.length, MUDFLAT_SUPERVISOR_LOG_LIMIT);
  assert.equal(exported.entries[0].sequence, 6);
  assert.equal(exported.entries.at(-1).sequence, MUDFLAT_SUPERVISOR_LOG_LIMIT + 5);
  assert.equal(exported.exportedAt, new Date(1000).toISOString());
});
