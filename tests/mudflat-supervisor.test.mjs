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
  assert.equal(decision.intent, "조개구멍 호미질 중");
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

test("감독 AI는 멀리 떨어진 경험치를 쫓느라 호미질을 포기하지 않는다", () => {
  const decision = decideMudflatSupervisorMove(scene({
    elapsed: 1,
    pickupRadius: 50,
    pickups: [{ id: 61, x: 440, y: 0, xp: 50, phase: "idle" }],
    clamHoles: [{ id: 62, x: 85, y: 0, kind: "clam", progress: 0 }],
  }));

  assert.equal(decision.targetKind, "clam");
  assert.equal(decision.targetId, 62);
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
function simulateSupervisor({ seconds, player, build, onFrame }) {
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
    if (world.moving) world.player = { x: world.player.x + world.input.x * 155 * dt, y: world.player.y + world.input.y * 155 * dt };
    if (onFrame(world, dt)) break;
  }
  return world;
}

test("감독 AI는 추격해 오는 게를 집게가 닿는 거리에 세워 두고 실제로 때려 잡는다", () => {
  // 집게 끝은 몸에서 84px 떨어진 원을 초당 1.55rad로 돌고, 끝이 게 크기 + 10 안에 들면 5.5 피해를 준다(실제 원정 규칙).
  const crab = { id: 91, x: 190, y: 30, hp: 20, xp: 2, score: 15, size: 13, name: "칠게", saltHit: 0 };
  let hits = 0;
  let minimumDistance = Infinity;
  let heldStill = 0;
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
      if (range >= band.inner && range <= band.outer && Math.hypot(state.input.x, state.input.y) <= .05) heldStill += dt;
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
  assert.ok(heldStill > 1, `공격 거리에서 서 있던 시간 ${heldStill.toFixed(2)}초`);
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

test("감독 AI는 복어와 보스에게는 예전처럼 132px 거리를 지킨다", () => {
  for (const creature of [{ type: "pufferfish", name: "복어" }, { boss: true, name: "대왕게" }]) {
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
