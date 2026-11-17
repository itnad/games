import assert from "node:assert/strict";
import test from "node:test";

import {
  decideMudflatSupervisorMove,
  maintainMudflatSupervisorCampaign,
  mudflatSupervisorCanDig,
} from "../app/mudflat-supervisor.js";

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

  assert.deepEqual(decision, {
    x: 0,
    y: 0,
    intent: "조개구멍 채집 중",
    targetKind: "clam",
  });
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
