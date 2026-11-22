import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MUDFLAT_CREATURE_LIMIT,
  MUDFLAT_FAR_CREATURE_DISTANCE,
  MUDFLAT_FAR_CREATURE_RETURN_SECONDS,
  MUDFLAT_SWARM_CREATURE_LIMIT,
  mudflatCreatureCanReturn,
  mudflatFarCreatureStep,
} from "../app/mudflat-survivor-engine.js";

const game = readFileSync(new URL("../app/mudflat-survivor-game.tsx", import.meta.url), "utf8");
const shrimp = (overrides = {}) => ({ id: 1, type: "shrimp", hp: 5, maxHp: 5, movement: "wander", ...overrides });

test("생물 상한은 240마리이고 게임 루프는 엔진 상수로만 센다", () => {
  assert.equal(MUDFLAT_CREATURE_LIMIT, 240);
  assert.equal(MUDFLAT_SWARM_CREATURE_LIMIT, 225);
  assert.match(game, /runtime\.spawnClock <= 0 && runtime\.creatures\.length < MUDFLAT_CREATURE_LIMIT\)/);
  assert.match(game, /runtime\.swarmClock <= 0 && runtime\.creatures\.length < MUDFLAT_SWARM_CREATURE_LIMIT\)/);
  assert.doesNotMatch(game, /creatures\.length < 1[0-9]{2}\b/);
});

test("먼 생물은 1,000px 넘게 떨어진 채 5초가 지나면 돌아온다", () => {
  assert.equal(MUDFLAT_FAR_CREATURE_DISTANCE, 1000);
  assert.equal(MUDFLAT_FAR_CREATURE_RETURN_SECONDS, 5);
  const creature = shrimp();
  // 가까이 있으면 아무 일도 없다.
  assert.deepEqual(mudflatFarCreatureStep(creature, 999, .1), { returnSeconds: undefined, returnNow: false });
  // 멀어지면 5초를 세기 시작하고, 다 세면 돌아온다.
  let waited = 0;
  let step = mudflatFarCreatureStep(creature, 1000, .1);
  assert.ok(Math.abs(step.returnSeconds - 4.9) < 1e-9);
  while (!step.returnNow) {
    creature.returnSeconds = step.returnSeconds;
    waited += .1;
    step = mudflatFarCreatureStep(creature, 1400, .1);
    assert.ok(waited < 6, "5초 안팎에 돌아와야 한다");
  }
  assert.ok(waited > 4.7 && waited < 5.1, `기다린 시간 ${waited}`);
  assert.equal(step.returnSeconds, undefined);
});

test("기다리는 사이 다시 가까워지거나 되돌릴 수 없게 되면 그만둔다", () => {
  // 플레이어가 되돌아와 가까워졌다.
  assert.deepEqual(mudflatFarCreatureStep(shrimp({ returnSeconds: 1.2 }), 640, .1), { returnSeconds: undefined, returnNow: false });
  // 그물에 걸렸거나 튜토리얼 중이다.
  assert.deepEqual(mudflatFarCreatureStep(shrimp({ returnSeconds: .05 }), 1500, .1, { blocked: true }), { returnSeconds: undefined, returnNow: false });
  // 대왕 박하지, 이벤트 생물, 숨은 패류, 채집할 수 없는 생물, 펄에서 나오는 중인 게, 죽은 생물은 되돌리지 않는다.
  for (const fixed of [{ boss: true }, { eventKind: "crab-line", eventLife: 4 }, { eventKind: "puffer-rush" }, { eventLife: 2 }, { requiresHeadlamp: true }, { uncollectible: true }, { emergeSeconds: 1 }, { hp: 0 }]) {
    assert.equal(mudflatCreatureCanReturn(shrimp(fixed)), false, JSON.stringify(fixed));
    assert.deepEqual(mudflatFarCreatureStep(shrimp({ ...fixed, returnSeconds: .05 }), 3000, .1), { returnSeconds: undefined, returnNow: false });
  }
  assert.equal(mudflatCreatureCanReturn(shrimp()), true);
  assert.equal(mudflatCreatureCanReturn(shrimp({ type: "small-crab", movement: "chase", hp: 1 })), true);
});

test("돌아오는 생물은 새 생물이 나오는 자리(화면 가장자리 바깥)로 들어오고 귀환 단계에는 베이스캠프 안을 피한다", () => {
  const body = game.match(/const creatureReturnPoint = [\s\S]*?\n    };/)?.[0] ?? "";
  // 새 생물과 같은 거리(화면 대각선 × 0.58 + 70~150px)와 저장 난수를 쓴다.
  assert.match(body, /Math\.hypot\(width, height\) \* \.58 \+ 70 \+ runtimeRandom\(runtime\) \* 80/);
  assert.match(body, /runtime\.baseCampGuideShown && attempt < 8 && isInsideBaseCamp\(point, runtime\.baseCamp, runtime\.stage, size \+ 12\)/);
  assert.doesNotMatch(body, /Math\.random/);
  // 게임 루프: 튜토리얼과 그물에 걸린 생물은 건너뛰고, 돌아올 때 체력·종류는 그대로 둔 채 자리만 옮긴다.
  assert.match(game, /mudflatFarCreatureStep\(creature, distance, dt, \{ blocked: tutorialActiveAtFrame \|\| castNetMovementMultiplier\(creature, runtime\.castNets\) === 0 \}\)/);
  assert.match(game, /if \(farStep\.returnNow\) \{\s*const entry = creatureReturnPoint\(width, height, creature\.size\);\s*creature\.x = entry\.x; creature\.y = entry\.y;\s*\}/);
});
