import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { MUDFLAT_ACTIVE_RUN_KEY, encodeMudflatRun, decodeMudflatRun, writeMudflatRun, readMudflatRun, clearMudflatRun } from "../app/mudflat-run-save.js";
import { mudflatEquipmentStats, mudflatCastNetStats } from "../app/mudflat-survivor-engine.js";
import { createLumiMotion } from "../app/mudflat-lumi-animation.js";
import { createCastNet } from "../app/mudflat-cast-net.js";
import { createExperiencePickup, advanceExperiencePickup } from "../app/mudflat-experience.js";

const game = readFileSync(new URL("../app/mudflat-survivor-game.tsx", import.meta.url), "utf8");
// Exercise the real runtime initializer without mounting React/canvas in Node.
const initializer = game.match(/function makeRuntime\(campaign: Campaign\): Runtime \{[\s\S]*?\n\}/)[0];
const makeRuntime = new Function("mudflatEquipmentStats", "createLumiMotion", "GENERAL_CHARACTER", "BASE_CAMP",
  ts.transpileModule(initializer, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + "\nreturn makeRuntime;")
  (mudflatEquipmentStats, createLumiMotion, { levels: { tongs: 1, digging: 1 } }, { x: 0, y: 250 });

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
    bleedSeconds: 6, bleedTickClock: .3, lastTideCycle: 3, bossSpawned: true, spawnClock: .7 });
  runtime.creatures.push({ id: 12, x: 41, y: 132, type: "crab", name: "게", icon: "●", color: "#f91",
    hp: 3, maxHp: 8, speed: 20, size: 11, xp: 2, score: 3, saltHit: .2, hitFlash: .1,
    phase: 1, age: 2, movement: "chase", movementAngle: 1, movementClock: .6, netReleaseUntil: 125 });
  runtime.rocks.push({ id: 13, x: 2, y: 3, radius: 15, tone: .4 });
  runtime.clamHoles.push({ id: 14, x: 24, y: 44, radius: 8, progress: .7 });
  runtime.clamHoles.push({ id: 18, x: 72, y: 80, radius: 12, progress: 1.4, kind: "gaebul", angle: .8 });
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

test("net/harpoon hit histories become Sets and restored IDs cannot collide", () => {
  const { campaign, runtime } = fixture();
  const restored = decodeMudflatRun(encodeMudflatRun(campaign, runtime, [], 1), makeRuntime);
  assert.ok(restored.runtime.harpoons[0].hitIds instanceof Set);
  assert.ok(restored.runtime.castNets[0].caughtIds instanceof Set);
  assert.ok(restored.runtime.castNets[0].caughtIds.has(12));
  assert.equal(restored.nextSequence, 20);
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
