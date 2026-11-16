import assert from "node:assert/strict";
import test from "node:test";

import {
  decideMudflatSupervisorMove,
  maintainMudflatSupervisorCampaign,
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
