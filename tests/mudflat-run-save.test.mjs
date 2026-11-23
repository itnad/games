import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { MUDFLAT_ACTIVE_RUN_KEY, encodeMudflatRun, decodeMudflatRun, writeMudflatRun, readMudflatRun, clearMudflatRun } from "../app/mudflat-run-save.js";
import { mudflatEquipmentStats, mudflatCastNetStats, mudflatJellyfishInterval, mudflatMosquitoRunEnabled, mudflatOpeningWaveCount, mudflatNormalizeActiveSkills, mudflatActiveLevels } from "../app/mudflat-survivor-engine.js";
import { createLumiMotion } from "../app/mudflat-lumi-animation.js";
import { createCastNet } from "../app/mudflat-cast-net.js";
import { createExperiencePickup, advanceExperiencePickup } from "../app/mudflat-experience.js";
import { createMudflatSeed, normalizeMudflatSeed } from "../app/mudflat-rng.js";

const game = readFileSync(new URL("../app/mudflat-survivor-game.tsx", import.meta.url), "utf8");
// Exercise the real runtime initializer without mounting React/canvas in Node.
const initializer = game.match(/function makeRuntime\(campaign: Campaign, seed = createMudflatSeed\(\)\): Runtime \{[\s\S]*?\n\}/)[0];
const makeRuntime = new Function("mudflatEquipmentStats", "createLumiMotion", "GENERAL_CHARACTER", "BASE_CAMP", "mudflatHiddenRockStage",
  "createMudflatSeed", "normalizeMudflatSeed", "nextMudflatRandom", "mudflatMosquitoRunEnabled", "mudflatOpeningWaveCount", "mudflatJellyfishInterval",
  "mudflatNormalizeActiveSkills", "mudflatActiveLevels",
  ts.transpileModule(initializer, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + "\nreturn makeRuntime;")
  (mudflatEquipmentStats, createLumiMotion, { levels: { tongs: 1, digging: 1 } }, { x: 0, y: 250 }, (stage) => stage === 3 || stage === 4,
    createMudflatSeed, normalizeMudflatSeed, (seed) => {
      const state = normalizeMudflatSeed(seed + 0x9e3779b9);
      return { state, value: state / 0x100000000 };
    }, mudflatMosquitoRunEnabled, mudflatOpeningWaveCount, mudflatJellyfishInterval, mudflatNormalizeActiveSkills, mudflatActiveLevels);

function fixture(mode = "normal") {
  const campaign = { version: 1, mode, characterId: "lumi", stage: 4, coins: 1380,
    hp: 91, maxHp: 100, baseMaxHp: 100, level: 9, xp: 12, nextXp: 45,
    levels: { tongs: 1, digging: 1, electric: 5, "cast-net": 1, basket: 5 },
    equipment: { headlamp: 2, cooler: 1, vest: 0, gloves: 1, waders: 0 },
    inventory: {}, lastHaul: { crab: 3 }, lastSaleValue: 27, totalScore: 543, lastBossCaught: false };
  const runtime = makeRuntime(campaign);
  runtime.elapsed = 123.456;
  Object.assign(runtime.player, { x: -182, y: 710, hp: 62, walking: true });
  Object.assign(runtime, { caught: 23, basket: { crab: 20, whelk: 3 }, catchScore: 172,
    bleedSeconds: 6, bleedTickClock: .3, lastTideCycle: 3, bossSpawned: true, spawnClock: .7,
    deepMudGauge: .63, deepMudLock: .2, deepMudStepClock: .1 });
  runtime.creatures.push({ id: 12, x: 41, y: 132, type: "crab", name: "게", icon: "●", color: "#f91",
    hp: 3, maxHp: 8, speed: 20, size: 11, xp: 2, score: 3, saltHit: .2, hitFlash: .1,
    phase: 1, age: 2, movement: "chase", movementAngle: 1, movementClock: .6, netReleaseUntil: 125 });
  runtime.rocks.push({ id: 13, x: 2, y: 3, radius: 15, tone: .4 });
  runtime.clamHoles.push({ id: 14, x: 24, y: 44, radius: 8, progress: .7 });
  runtime.clamHoles.push({ id: 18, x: 72, y: 80, radius: 12, progress: 1.4, kind: "gaebul", angle: .8 });
  runtime.mudPrints.push({ id: 19, x: 35, y: 55, life: .8, maxLife: 1.4, angle: .3, side: -1 });
  runtime.pickups.push(createExperiencePickup(15, -181, 711, 7));
  const net = createCastNet(16, runtime.player, { x: 130, y: 150 }, mudflatCastNetStats(1));
  net.caughtIds.add(12); net.caughtPoints.push({ id: 12, x: 41, y: 132 }); runtime.castNets.push(net);
  runtime.harpoons.push({ id: 17, x: 3, y: 9, vx: 12, vy: 32, damage: 4, distance: 20, maxDistance: 300, angle: .3, hitIds: new Set([12, 19]) });
  return { campaign, runtime };
}

function memoryStorage() {
  const items = new Map();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: (key) => items.delete(key) };
}

test("live save round trip preserves actual world, time, stats, drops, equipment and character", () => {
  for (const mode of ["normal", "kids"]) {
    const { campaign, runtime } = fixture(mode);
    const serialized = encodeMudflatRun(campaign, runtime, ["basket", "boots"], 30, 1000);
    const restored = decodeMudflatRun(serialized, makeRuntime);
    assert.ok(restored);
    assert.deepEqual(restored.runtime, { ...runtime, paused: true, player: { ...runtime.player, walking: false } });
    assert.equal(restored.campaign.hp, 62);
    assert.equal(restored.campaign.coins, 1380);
    assert.equal(restored.campaign.characterId, "lumi");
    assert.deepEqual(restored.choiceIds, ["basket", "boots"]);
    assert.equal(restored.nextSequence, 30);
    assert.equal(restored.runtime.elapsed, 123.456); // No offline time added.
    assert.equal(runtime.paused, false);
    assert.equal(runtime.player.walking, true);
    restored.runtime.levels.basket = 1;
    assert.equal(runtime.levels.basket, 5); // Snapshot is detached.
  }
});

test("live save carries the skill inventory and active list, and backfills older saves", () => {
  const { campaign, runtime } = fixture("normal");
  // 보관 기술은 인벤토리에만 남고 runtime.levels에는 기본 기술과 활성 기술만 있다.
  runtime.skillInventory = { ...runtime.skillInventory, harpoon: 2, net: 1, rocker: 1, boots: 1, snack: 1 };
  runtime.activeSkills = ["basket", "electric", "cast-net", "harpoon", "net", "rocker"];
  runtime.levels = mudflatActiveLevels(runtime.skillInventory, runtime.activeSkills, "normal");
  const restored = decodeMudflatRun(encodeMudflatRun(campaign, runtime), makeRuntime);
  assert.ok(restored);
  assert.deepEqual(restored.runtime.skillInventory, runtime.skillInventory);
  assert.deepEqual(restored.runtime.activeSkills, runtime.activeSkills);
  assert.deepEqual(restored.runtime.levels, runtime.levels);
  assert.equal(restored.runtime.levels.boots, undefined);
  assert.equal(restored.campaign.levels.boots, 1); // The campaign keeps the whole inventory.
  assert.deepEqual(restored.campaign.activeSkills, runtime.activeSkills);
  assert.deepEqual(restored.stageEntryCampaign.activeSkills, campaign.activeSkills);
  restored.runtime.activeSkills.push("snack");
  assert.equal(runtime.activeSkills.length, 6); // Snapshot is detached.
  // Saves from before the inventory had only levels: treat them as the inventory and derive the active list.
  const legacy = JSON.parse(encodeMudflatRun(campaign, fixture("normal").runtime));
  delete legacy.runtime.skillInventory; delete legacy.runtime.activeSkills; delete legacy.campaign.activeSkills;
  const legacyRestored = decodeMudflatRun(JSON.stringify(legacy), makeRuntime);
  assert.ok(legacyRestored);
  assert.deepEqual(legacyRestored.runtime.skillInventory, legacyRestored.runtime.levels);
  assert.deepEqual(legacyRestored.runtime.activeSkills, ["basket", "electric", "cast-net"]);
  // A corrupted active list is rejected.
  const broken = JSON.parse(encodeMudflatRun(campaign, runtime));
  broken.runtime.activeSkills = [3];
  assert.equal(decodeMudflatRun(JSON.stringify(broken), makeRuntime), null);
});

test("live save carries the gem count and guard basket state, and backfills older saves", () => {
  const { campaign, runtime } = fixture("normal");
  Object.assign(runtime, { gemsCollected: 87, guardBasketPullClock: 4.2, guardBasketCharges: 0, guardBasketRechargeClock: 31.5, guardBasketFlashLife: .2, guardBasketInvulnerable: .3 });
  const restored = decodeMudflatRun(encodeMudflatRun(campaign, runtime), makeRuntime);
  assert.ok(restored);
  assert.equal(restored.runtime.gemsCollected, 87);
  assert.equal(restored.campaign.gemsCollected, 87);
  assert.equal(restored.runtime.guardBasketCharges, 0);
  assert.equal(restored.runtime.guardBasketRechargeClock, 31.5);
  const legacy = JSON.parse(encodeMudflatRun({ ...campaign, gemsCollected: 12 }, fixture("normal").runtime));
  delete legacy.campaign.gemsCollected;
  for (const key of ["gemsCollected", "guardBasketPullClock", "guardBasketCharges", "guardBasketRechargeClock", "guardBasketFlashLife", "guardBasketInvulnerable"]) delete legacy.runtime[key];
  const legacyRestored = decodeMudflatRun(JSON.stringify(legacy), makeRuntime);
  assert.ok(legacyRestored);
  assert.equal(legacyRestored.runtime.gemsCollected, 0);
  assert.equal(legacyRestored.runtime.guardBasketCharges, 1);
  assert.equal(legacyRestored.runtime.guardBasketPullClock, 0);
  const broken = JSON.parse(encodeMudflatRun(campaign, runtime));
  broken.campaign.gemsCollected = -1;
  assert.equal(decodeMudflatRun(JSON.stringify(broken), makeRuntime), null);
});

test("live save carries hoe bots and the dig count, backfills older saves, and rejects broken bots", () => {
  const { campaign, runtime } = fixture("normal");
  runtime.digsCompleted = 12;
  runtime.hoeBots.push({ id: 21, x: -150, y: 700, targetHoleId: 14, digClock: .8, phase: "dig", facing: -1 });
  runtime.hoeBots.push({ id: 22, x: -200, y: 740, targetHoleId: 0, digClock: 0, phase: "follow", facing: 1 });
  const restored = decodeMudflatRun(encodeMudflatRun(campaign, runtime), makeRuntime);
  assert.ok(restored);
  assert.deepEqual(restored.runtime.hoeBots, runtime.hoeBots);
  assert.equal(restored.runtime.digsCompleted, 12);
  assert.equal(restored.campaign.digsCompleted, 12);
  assert.ok(restored.nextSequence > 22); // 로봇 ID도 충돌 방지 범위에 든다.
  const legacy = JSON.parse(encodeMudflatRun(campaign, fixture("normal").runtime));
  delete legacy.runtime.hoeBots; delete legacy.runtime.digsCompleted; delete legacy.campaign.digsCompleted;
  const legacyRestored = decodeMudflatRun(JSON.stringify(legacy), makeRuntime);
  assert.ok(legacyRestored);
  assert.deepEqual(legacyRestored.runtime.hoeBots, []);
  assert.equal(legacyRestored.runtime.digsCompleted, 0);
  const broken = JSON.parse(encodeMudflatRun(campaign, runtime));
  broken.runtime.hoeBots[0].phase = "fly";
  assert.equal(decodeMudflatRun(JSON.stringify(broken), makeRuntime), null);
});

test("live save keeps lifted rocks and rock-lift timers, backfills older saves, and rejects a broken lift", () => {
  const { campaign, runtime } = fixture("normal");
  runtime.rocks.push({ id: 31, x: 60, y: 90, radius: 17, tone: .3, lift: .42 });
  runtime.rockLiftClock = 5.5; runtime.rockLiftEffect = .6;
  const restored = decodeMudflatRun(encodeMudflatRun(campaign, runtime), makeRuntime);
  assert.ok(restored);
  assert.equal(restored.runtime.rocks.find((rock) => rock.id === 31).lift, .42);
  assert.equal(restored.runtime.rocks.find((rock) => rock.id === 13).lift, undefined);
  assert.equal(restored.runtime.rockLiftClock, 5.5);
  assert.equal(restored.runtime.rockLiftEffect, .6);
  const legacy = JSON.parse(encodeMudflatRun(campaign, fixture("normal").runtime));
  delete legacy.runtime.rockLiftClock; delete legacy.runtime.rockLiftEffect;
  const legacyRestored = decodeMudflatRun(JSON.stringify(legacy), makeRuntime);
  assert.ok(legacyRestored);
  assert.equal(legacyRestored.runtime.rockLiftClock, 3);
  assert.equal(legacyRestored.runtime.rockLiftEffect, 0);
  const broken = JSON.parse(encodeMudflatRun(campaign, runtime));
  broken.runtime.rocks[0].lift = -1;
  assert.equal(decodeMudflatRun(JSON.stringify(broken), makeRuntime), null);
});

test("live save keeps knockback state and smash timers, backfills older saves, and rejects a bad chain flag", () => {
  const { campaign, runtime } = fixture("normal");
  Object.assign(runtime.creatures[0], { knockbackX: 80, knockbackY: -20, knockbackLife: .2, knockbackDamage: 40, knockbackRockBonus: 25, knockbackCast: 3, knockbackChain: true });
  Object.assign(runtime, { smashClock: 2.5, smashEffect: .3, smashAngle: 1.2, smashCastId: 3 });
  const restored = decodeMudflatRun(encodeMudflatRun(campaign, runtime), makeRuntime);
  assert.ok(restored);
  const creature = restored.runtime.creatures.find((item) => item.id === 12);
  assert.equal(creature.knockbackX, 80);
  assert.equal(creature.knockbackChain, true);
  assert.equal(restored.runtime.smashCastId, 3);
  assert.equal(restored.runtime.smashAngle, 1.2);
  const legacy = JSON.parse(encodeMudflatRun(campaign, fixture("normal").runtime));
  for (const key of ["smashClock", "smashEffect", "smashAngle", "smashCastId"]) delete legacy.runtime[key];
  const legacyRestored = decodeMudflatRun(JSON.stringify(legacy), makeRuntime);
  assert.ok(legacyRestored);
  assert.equal(legacyRestored.runtime.smashClock, 0);
  assert.equal(legacyRestored.runtime.smashCastId, 0);
  const broken = JSON.parse(encodeMudflatRun(campaign, runtime));
  broken.runtime.creatures[0].knockbackChain = "yes";
  assert.equal(decodeMudflatRun(JSON.stringify(broken), makeRuntime), null);
});

test("live save keeps fireballs, flame rays and fire timers, and backfills older saves", () => {
  const { campaign, runtime } = fixture("normal");
  runtime.fireballs.push({ id: 41, x: 10, y: 20, vx: 170, vy: -170, age: .3, life: 1.08, damage: 60, splash: 40, wobblePhase: 1.1, baseAngle: -.78 });
  runtime.flameRays.push({ id: 42, x: 0, y: 0, angle: 1.2, age: .1, length: 170, width: 34 });
  Object.assign(runtime, { fireballClock: .6, fireballQueue: 2, fireballSpacingClock: .05, flameBurstClock: 3.2, hitByCrab: true, hitByShrimp: false });
  const restored = decodeMudflatRun(encodeMudflatRun(campaign, runtime), makeRuntime);
  assert.ok(restored);
  assert.deepEqual(restored.runtime.fireballs, runtime.fireballs);
  assert.deepEqual(restored.runtime.flameRays, runtime.flameRays);
  assert.equal(restored.runtime.fireballQueue, 2);
  assert.equal(restored.runtime.flameBurstClock, 3.2);
  assert.equal(restored.runtime.hitByCrab, true);
  assert.equal(restored.campaign.hitByCrab, true);
  assert.equal(restored.campaign.hitByShrimp, false);
  assert.ok(restored.nextSequence > 42);
  const legacy = JSON.parse(encodeMudflatRun(campaign, fixture("normal").runtime));
  for (const key of ["fireballs", "flameRays", "fireballClock", "fireballQueue", "fireballSpacingClock", "flameBurstClock", "hitByCrab", "hitByShrimp"]) delete legacy.runtime[key];
  delete legacy.campaign.hitByCrab; delete legacy.campaign.hitByShrimp;
  const legacyRestored = decodeMudflatRun(JSON.stringify(legacy), makeRuntime);
  assert.ok(legacyRestored);
  assert.deepEqual(legacyRestored.runtime.fireballs, []);
  assert.deepEqual(legacyRestored.runtime.flameRays, []);
  assert.equal(legacyRestored.runtime.fireballQueue, 0);
  assert.equal(legacyRestored.runtime.hitByCrab, false);
  assert.equal(legacyRestored.runtime.hitByShrimp, false);
  const broken = JSON.parse(encodeMudflatRun(campaign, runtime));
  broken.runtime.fireballs[0].damage = "hot";
  assert.equal(decodeMudflatRun(JSON.stringify(broken), makeRuntime), null);
});

test("live save keeps frost patches, waves, slow state and ice timers, and backfills older saves", () => {
  const { campaign, runtime } = fixture("normal");
  runtime.frostPatches.push({ id: 51, x: 30, y: 40, radius: 56, age: .4, life: 5 });
  runtime.frostWaves.push({ id: 52, x: 0, y: 0, age: .1, radius: 200 });
  runtime.creatures[0].slowUntil = 14.5; runtime.creatures[0].slowFactor = 1;
  Object.assign(runtime, { frostTrailClock: .3, frostTickClock: .2, frostWaveClock: 4.4, hitByRock: true, hitByTide: true });
  const restored = decodeMudflatRun(encodeMudflatRun(campaign, runtime), makeRuntime);
  assert.ok(restored);
  assert.deepEqual(restored.runtime.frostPatches, runtime.frostPatches);
  assert.deepEqual(restored.runtime.frostWaves, runtime.frostWaves);
  assert.deepEqual([restored.runtime.creatures[0].slowUntil, restored.runtime.creatures[0].slowFactor], [14.5, 1]);
  assert.deepEqual([restored.runtime.frostTrailClock, restored.runtime.frostTickClock, restored.runtime.frostWaveClock], [.3, .2, 4.4]);
  assert.deepEqual([restored.runtime.hitByRock, restored.runtime.hitByTide, restored.campaign.hitByRock, restored.campaign.hitByTide], [true, true, true, true]);
  assert.ok(restored.nextSequence > 52);
  const legacy = JSON.parse(encodeMudflatRun(campaign, fixture("normal").runtime));
  for (const key of ["frostPatches", "frostWaves", "frostTrailClock", "frostTickClock", "frostWaveClock", "hitByRock", "hitByTide"]) delete legacy.runtime[key];
  delete legacy.campaign.hitByRock; delete legacy.campaign.hitByTide;
  const legacyRestored = decodeMudflatRun(JSON.stringify(legacy), makeRuntime);
  assert.ok(legacyRestored);
  assert.deepEqual(legacyRestored.runtime.frostPatches, []);
  assert.deepEqual(legacyRestored.runtime.frostWaves, []);
  assert.deepEqual([legacyRestored.runtime.frostTrailClock, legacyRestored.runtime.frostWaveClock], [0, 0]);
  assert.deepEqual([legacyRestored.runtime.hitByRock, legacyRestored.runtime.hitByTide], [false, false]);
  const broken = JSON.parse(encodeMudflatRun(campaign, runtime));
  broken.runtime.creatures[0].slowFactor = "cold";
  assert.equal(decodeMudflatRun(JSON.stringify(broken), makeRuntime), null);
  const brokenPatch = JSON.parse(encodeMudflatRun(campaign, runtime));
  brokenPatch.runtime.frostPatches[0].life = "long";
  assert.equal(decodeMudflatRun(JSON.stringify(brokenPatch), makeRuntime), null);
});

test("live save keeps a detached stage-entry checkpoint for rescue retries", () => {
  const { campaign, runtime } = fixture();
  const stageEntryCampaign = {
    ...campaign, coins: 2400, hp: 91, level: 7, xp: 3,
    levels: { ...campaign.levels, electric: 3 }, equipment: { ...campaign.equipment, headlamp: 1 },
    inventory: { clam: 2 }, lastHaul: { crab: 1 },
  };
  const restored = decodeMudflatRun(encodeMudflatRun(campaign, runtime, [], 30, 1000, stageEntryCampaign), makeRuntime);
  assert.ok(restored);
  assert.deepEqual(restored.stageEntryCampaign, stageEntryCampaign);
  assert.notEqual(restored.stageEntryCampaign, stageEntryCampaign);
  assert.notEqual(restored.stageEntryCampaign.levels, stageEntryCampaign.levels);
  assert.equal(restored.campaign.level, runtime.level, "the live run still keeps current growth separately");
  restored.stageEntryCampaign.levels.electric = 99;
  assert.equal(stageEntryCampaign.levels.electric, 3);

  const legacy = JSON.parse(encodeMudflatRun(campaign, runtime, [], 30, 1000));
  delete legacy.stageEntryCampaign;
  const legacyRestored = decodeMudflatRun(JSON.stringify(legacy), makeRuntime);
  assert.ok(legacyRestored);
  assert.deepEqual(legacyRestored.stageEntryCampaign, legacyRestored.campaign, "older saves fall back safely to their saved campaign state");
});

test("net/harpoon hit histories become Sets and restored IDs cannot collide", () => {
  const { campaign, runtime } = fixture();
  const restored = decodeMudflatRun(encodeMudflatRun(campaign, runtime, [], 1), makeRuntime);
  assert.ok(restored.runtime.harpoons[0].hitIds instanceof Set);
  assert.ok(restored.runtime.castNets[0].caughtIds instanceof Set);
  assert.ok(restored.runtime.castNets[0].caughtIds.has(12));
  assert.equal(restored.nextSequence, 20);
});

test("older live saves backfill deep-mud fields added after autosave", () => {
  const { campaign, runtime } = fixture();
  const save = JSON.parse(encodeMudflatRun(campaign, runtime, [], 30, 1000));
  delete save.runtime.mudPrints;
  delete save.runtime.deepMudGauge;
  delete save.runtime.deepMudLock;
  delete save.runtime.deepMudStepClock;
  const restored = decodeMudflatRun(JSON.stringify(save), makeRuntime);
  assert.ok(restored);
  assert.deepEqual(restored.runtime.mudPrints, []);
  assert.equal(restored.runtime.deepMudGauge, 0);
  assert.equal(restored.runtime.deepMudLock, 0);
  assert.equal(restored.runtime.deepMudStepClock, 0);
});

test("older live saves backfill deterministic RNG state", () => {
  const { campaign, runtime } = fixture();
  const save = JSON.parse(encodeMudflatRun(campaign, runtime, [], 30, 1000));
  delete save.runtime.seed;
  delete save.runtime.rngState;
  const restored = decodeMudflatRun(JSON.stringify(save), makeRuntime);
  assert.ok(restored);
  assert.equal(restored.runtime.seed, normalizeMudflatSeed(1000));
  assert.equal(restored.runtime.rngState, restored.runtime.seed);
});

test("older live saves backfill the one-time mosquito run decision", () => {
  const { campaign, runtime } = fixture();
  const save = JSON.parse(encodeMudflatRun(campaign, runtime, [], 30, 1000));
  delete save.runtime.mosquitoRunEnabled;
  const restored = decodeMudflatRun(JSON.stringify(save), makeRuntime);
  assert.ok(restored);
  assert.equal(typeof restored.runtime.mosquitoRunEnabled, "boolean");
});

test("older live saves do not replay the stage-opening seafood migration", () => {
  const { campaign, runtime } = fixture();
  const save = JSON.parse(encodeMudflatRun(campaign, runtime, [], 30, 1000));
  delete save.runtime.openingWaveRemaining;
  const restored = decodeMudflatRun(JSON.stringify(save), makeRuntime);
  assert.ok(restored);
  assert.equal(restored.runtime.openingWaveRemaining, 0);
});

test("older live saves backfill silent event timers without firing them immediately", () => {
  const { campaign, runtime } = fixture();
  const save = JSON.parse(encodeMudflatRun(campaign, runtime, [], 30, 1000));
  for (const key of ["pufferEventClock", "crabRushClock", "mudZombieClock", "jellyfishClock", "jellyPoisonSeconds", "jellyPoisonTickClock", "mudZombieTriggered"]) delete save.runtime[key];
  const restored = decodeMudflatRun(JSON.stringify(save), makeRuntime);
  assert.ok(restored);
  assert.equal(restored.runtime.pufferEventClock, 18);
  assert.equal(restored.runtime.crabRushClock, 26);
  assert.equal(restored.runtime.mudZombieTriggered, false);
  assert.equal(restored.runtime.jellyPoisonSeconds, 0);
});

test("a pickup in flight is restored mid-flight and grants XP only once", () => {
  const { campaign, runtime } = fixture();
  const pickup = runtime.pickups[0];
  for (let i = 0; i < 7; i++) advanceExperiencePickup(pickup, runtime.player, 300, .034);
  assert.equal(pickup.phase, "pull");
  const restored = decodeMudflatRun(encodeMudflatRun(campaign, runtime), makeRuntime);
  let earned = 0;
  for (let i = 0; i < 40; i++) earned += advanceExperiencePickup(restored.runtime.pickups[0], runtime.player, 300, .034);
  assert.equal(earned, 7);
  assert.equal(restored.runtime.xp, runtime.xp);
});

test("dead and settled runs cannot be saved or restored", () => {
  const { campaign, runtime } = fixture();
  const good = encodeMudflatRun(campaign, runtime);
  runtime.player.hp = 0;
  assert.equal(encodeMudflatRun(campaign, runtime), null);
  const damaged = JSON.parse(good); damaged.runtime.player.hp = 0;
  assert.equal(decodeMudflatRun(JSON.stringify(damaged), makeRuntime), null);
  runtime.player.hp = 62; runtime.ended = true;
  assert.equal(encodeMudflatRun(campaign, runtime), null);
  const ended = JSON.parse(good); ended.runtime.ended = true;
  assert.equal(decodeMudflatRun(JSON.stringify(ended), makeRuntime), null);
});

test("corrupt, incomplete and incompatible saves fail closed", () => {
  const { campaign, runtime } = fixture();
  const good = encodeMudflatRun(campaign, runtime);
  for (const value of [null, "not json", "null", "{}", "[]"]) assert.equal(decodeMudflatRun(value, makeRuntime), null);
  for (const corrupt of [
    (s) => s.version = 99,
    (s) => delete s.runtime.bleedTickClock,
    (s) => s.runtime.player.hp = null,
    (s) => s.runtime.stage++,
    (s) => s.runtime.harpoons[0].hitIds = {},
    (s) => s.runtime.pickups[0].trail = null,
    (s) => s.runtime.pickups[0].pullDuration = null,
    (s) => s.runtime.castNets[0].caughtPoints = null,
    (s) => s.runtime.creatures[0].movement = "invalid",
    (s) => s.choiceIds = ["basket", "basket"],
  ]) {
    const save = JSON.parse(good); corrupt(save);
    assert.equal(decodeMudflatRun(JSON.stringify(save), makeRuntime), null);
  }
});

test("storage survives reload, reports write errors, and supports explicit invalidation", () => {
  const storage = memoryStorage(); const { campaign, runtime } = fixture();
  assert.equal(readMudflatRun(makeRuntime, () => storage), null);
  assert.ok(writeMudflatRun(campaign, runtime, ["basket"], 30, () => storage));
  const prior = storage.getItem(MUDFLAT_ACTIVE_RUN_KEY);
  assert.equal(readMudflatRun(makeRuntime, () => storage).runtime.player.hp, 62);
  const blocked = () => { throw new Error("SecurityError"); };
  assert.equal(readMudflatRun(makeRuntime, blocked), null);
  assert.equal(writeMudflatRun(campaign, runtime, [], 30, blocked), false);
  assert.equal(writeMudflatRun(campaign, runtime, [], 30, () => ({ setItem() { throw new Error("QuotaExceededError"); } })), false);
  assert.equal(storage.getItem(MUDFLAT_ACTIVE_RUN_KEY), prior);
  assert.ok(clearMudflatRun(() => storage));
  assert.equal(readMudflatRun(makeRuntime, () => storage), null);
});

test("game connects confirmed exits, autosave, safe paused resume and end-of-run cleanup", () => {
  assert.match(game, /ms-game-head"><button onClick=\{openExitDialog\}/);
  assert.match(game, /if \(!persistActiveRun\(\)\) return;[\s\S]*?if \(destination === "home"\) onExit\(\);\s*else reset\(\)/);
  assert.match(game, /setScreen\(saved.choiceIds.length \? "upgrade" : "paused"\)/);
  assert.match(game, /setInterval\(persistActiveRun, MUDFLAT_AUTOSAVE_MS\)/);
  assert.match(game, /addEventListener\("pagehide", persistActiveRun\)/);
  assert.match(game, /const endRun[\s\S]*?discardActiveRun\(\)/);
  assert.match(game, /storeCampaign\(next\); discardActiveRun\(\)/);
  assert.match(game, /setChoices\(mudflatUpgradeChoices[^\n]*persistActiveRun\(\)/);
  assert.match(game, /runtimeRef.current.paused = origin !== "running"/);
  const dialog = readFileSync(new URL("../app/mudflat-exit-dialog.tsx", import.meta.url), "utf8");
  for (const label of ["해루질럿 메인", "홈 화면", "취소"]) assert.ok(dialog.includes(label));
  assert.match(dialog, /role="dialog" aria-modal="true"/);
  assert.match(dialog, /cancelRef.current\?\.focus\(\)/);
  assert.match(dialog, /event.key === "Escape"/);
  assert.match(dialog, /event.key !== "Tab"/);
});

test("a far creature's return countdown survives a live save round trip", () => {
  const { campaign, runtime } = fixture();
  runtime.creatures.push({ ...runtime.creatures[0], id: 31, type: "shrimp", x: 2400, y: -900, movement: "wander", returnSeconds: 3.25 });
  const restored = decodeMudflatRun(encodeMudflatRun(campaign, runtime, [], 40, 1000), makeRuntime);
  assert.ok(restored, "저장이 되살아나야 한다");
  assert.equal(restored.runtime.creatures.find((creature) => creature.id === 31).returnSeconds, 3.25);
  // 이 기능이 생기기 전의 저장(returnSeconds 없음)도 그대로 읽는다: 이어한 뒤 멀리 있으면 그때부터 5초를 센다.
  assert.equal(restored.runtime.creatures.find((creature) => creature.id === 12).returnSeconds, undefined);
});
