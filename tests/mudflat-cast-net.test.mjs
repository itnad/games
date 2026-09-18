import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { mudflatCastNetStats, mudflatCampObstacleAllowed, mudflatStopHarvestInCamp } from "../app/mudflat-survivor-engine.js";
import {
  CAST_NET_FLIGHT, CAST_NET_CLOSE, CAST_NET_RELEASE_GRACE, CAST_NET_PLAYER_CLEARANCE,
  createCastNet, castNetPhase, castNetContains, castNetOnScreen, findCastNetTarget,
  advanceCastNets, castNetMovementMultiplier,
} from "../app/mudflat-cast-net.js";
import { drawCastNetThrow } from "../app/mudflat-cast-net-renderer.js";

const player = { x: 0, y: 0 };
const creature = (id, x, y, extra = {}) => ({ id, x, y, hp: 500, size: 12, ...extra });
const visible = (item) => !item.hidden;
const choose = (creatures, extra = {}) => findCastNetTarget({ creatures, player, width: 800, height: 600,
  stats: mudflatCastNetStats(1), nets: [], canCatch: visible, ...extra });
const newNet = (id = 1, level = 1, target = { x: 140, y: 0 }) => createCastNet(id, player, target, mudflatCastNetStats(level));
const damage = (item, amount) => { item.hp -= amount; };

test("cast net upgrades grow the persistent footprint without increasing the one-shot damage", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((lv) => mudflatCastNetStats(lv).radius), [45, 49, 53, 57, 61, 65]);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((lv) => mudflatCastNetStats(lv).holdSeconds), [1.8, 2, 2.2, 2.4, 2.6, 2.8]);
  for (let level = 1; level <= 6; level++) assert.equal(mudflatCastNetStats(level).damage, 200);
  assert.equal(createCastNet(1, player, { x: 140, y: 0 }, mudflatCastNetStats(6), 1.21).damage, 242);
  assert.equal(choose([creature(1, 140, 0)], { stats: mudflatCastNetStats(0) }), null);
});

test("cast net targets the denser cluster, never the empty average between separate groups", () => {
  const creatures = [creature(1, -140, -10), creature(2, -140, 10),
    creature(3, 140, -12), creature(4, 140, 0), creature(5, 140, 12)];
  const target = choose(creatures);
  assert.ok(target.x > 100);
  assert.equal(creatures.filter((item) => castNetContains({ ...target, radius: 45 }, item)).length, 3);
  assert.ok(Math.abs(target.y) < 5, "the target is near the centre of the chosen group");
  assert.equal(choose([]), null);
  assert.equal(choose([creature(1, 140, 0, { hp: 0 }), creature(2, -140, 0, { hidden: true })]), null);
});

test("cast nets leave room for the entire player and net at every level and viewport", () => {
  for (const [width, height] of [[320, 420], [420, 320], [800, 600]]) {
    for (let level = 1; level <= 6; level++) {
      const stats = mudflatCastNetStats(level);
      const creatures = [creature(1, 0, 130), creature(2, 130, 0), creature(3, 0, -130)];
      const target = choose(creatures, { width, height, stats });
      assert.ok(target, `${width}x${height}, level ${level} has a valid exterior target`);
      assert.ok(Math.hypot(target.x, target.y) >= stats.radius + CAST_NET_PLAYER_CLEARANCE - .001);
      assert.ok(castNetOnScreen(target, player, width, height, stats.radius));
      assert.ok(Math.hypot(target.x, target.y) <= stats.range + .001);
      assert.equal(choose([creature(9, 15, 0)], { width, height, stats }), null, "do not throw over the player to hit a close target");
    }
  }
  const movedPlayer = { x: 1700, y: -850 };
  const target = choose([creature(1, 1700, -710)], { player: movedPlayer, width: 320, height: 420 });
  assert.ok(target && Math.hypot(target.x - movedPlayer.x, target.y - movedPlayer.y) >= 87);
});

test("a flying net reserves its destination and the next net covers another group", () => {
  const creatures = [creature(1, 140, 0), creature(2, 142, 12), creature(3, 138, -12),
    creature(4, -140, -6), creature(5, -140, 6)];
  const firstTarget = choose(creatures);
  const first = newNet(1, 1, firstTarget);
  const secondTarget = choose(creatures, { nets: [first] });
  assert.ok(firstTarget.x > 0 && secondTarget.x < 0);
  assert.ok(Math.hypot(firstTarget.x - secondTarget.x, firstTarget.y - secondTarget.y) >= first.radius * 1.44);
  assert.equal(choose(creatures.slice(0, 3), { nets: [first] }), null, "wait when all targets are already covered");
  assert.equal(choose(creatures, { nets: [first, newNet(2, 1, secondTarget)] }), null, "two simultaneous nets maximum");
  first.age = first.duration - .1;
  assert.ok(choose(creatures.slice(0, 3), { nets: [first] }), "a finished area's fading net no longer reserves targets");
});

test("cast net targeting respects camp footprint, sight and maximum throwing range", () => {
  const camp = { x: 140, y: 0 }, radii = { radiusX: 60, radiusY: 50 };
  const canPlace = (point, radius) => mudflatCampObstacleAllowed(point, camp, radii, true, radius + 8);
  const target = choose([creature(1, 140, 0), creature(2, -140, 0)], { canPlace });
  assert.ok(target.x < 0 && canPlace(target, 45));
  assert.equal(choose([creature(1, 140, 0)], { canPlace }), null);
  assert.equal(choose([creature(1, 1000, 0)]), null);
  assert.equal(choose([creature(1, 160, 0)], { width: 320, height: 420 }), null);
  assert.equal(choose([creature(1, 140, 0, { netReleaseUntil: 1 })], { now: .5 }), null);
});

test("nets land without damage, trap late arrivals, then cinch once and release survivors", () => {
  const net = newNet();
  const first = creature(1, 140, 0), late = creature(2, 250, 0);
  let nets = [net];
  nets = advanceCastNets(nets, [first, late], .49, .49, visible, damage);
  assert.equal(castNetPhase(net), "flight");
  assert.equal(net.caughtIds.size, 0);
  assert.equal(first.hp, 500);
  nets = advanceCastNets(nets, [first, late], .02, .51, visible, damage);
  assert.equal(castNetPhase(net), "open");
  assert.equal(castNetMovementMultiplier(first, nets), 0);
  assert.equal(castNetMovementMultiplier(late, nets), 1);
  late.x = 155;
  nets = advanceCastNets(nets, [first, late], .2, .71, visible, damage);
  assert.equal(net.caughtIds.size, 2);
  assert.equal(first.hp, 500);
  nets = advanceCastNets(nets, [first, late], 1.6, 2.31, visible, damage);
  assert.equal(castNetPhase(net), "closing");
  const tooLate = creature(3, 140, 0);
  nets = advanceCastNets(nets, [first, late, tooLate], .3, 2.61, visible, damage);
  assert.equal(first.hp, 300); assert.equal(late.hp, 300); assert.equal(tooLate.hp, 500);
  assert.equal(net.hit, true);
  assert.equal(castNetMovementMultiplier(first, nets), 1);
  assert.equal(first.netReleaseUntil, 2.61 + CAST_NET_RELEASE_GRACE);
  nets = advanceCastNets(nets, [first, late], .3, 2.91, visible, damage);
  assert.equal(nets.length, 0);
  assert.equal(first.hp, 300, "no extra hit during fade or removal");
});

test("bosses are held, and overlapping nets cannot double-bind or double-hit", () => {
  const first = newNet(), second = newNet(2);
  const boss = creature(1, 140, 0, { boss: true });
  let nets = advanceCastNets([first, second], [boss], .51, .51, visible, damage);
  assert.equal(castNetMovementMultiplier(boss, nets), 0);
  assert.equal(first.caughtIds.size + second.caughtIds.size, 1);
  nets = advanceCastNets(nets, [boss], 2.1, 2.61, visible, damage);
  assert.equal(boss.hp, 300, "overlap cannot deliver two cinch hits");
  assert.equal(castNetMovementMultiplier(boss, nets), 1);
});

test("cast nets only acquire visible targets, then resolve bound targets in world space", () => {
  for (const reason of ["hidden", "offscreen", "collected"]) {
    const net = newNet();
    const target = creature(1, 140, 0);
    const canCatch = (item) => visible(item) && castNetOnScreen(item, player, 800, 600);
    if (reason === "hidden") target.hidden = true;
    if (reason === "offscreen") target.x = 900;
    if (reason === "collected") target.hp = 0;
    let hits = 0;
    let nets = advanceCastNets([net], [target], .51, .51, canCatch, () => hits++);
    assert.equal(net.caughtIds.size, 0, `${reason} is not newly acquired`);
    nets = advanceCastNets(nets, [target], 2.1, 2.61, canCatch, () => hits++);
    assert.equal(hits, 0, reason);
    assert.equal(castNetMovementMultiplier(target, nets), 1);
  }
  for (const reason of ["hidden", "offscreen"]) {
    const net = newNet();
    const target = creature(1, 140, 0);
    const canCatch = (item) => visible(item) && castNetOnScreen(item, player, 800, 600);
    let nets = advanceCastNets([net], [target], .51, .51, canCatch, damage);
    assert.equal(castNetMovementMultiplier(target, nets), 0);
    if (reason === "hidden") target.hidden = true;
    if (reason === "offscreen") target.x = 900;
    nets = advanceCastNets(nets, [target], 2.1, 2.61, canCatch, damage);
    assert.equal(target.hp, 300, `bound ${reason} target is damaged at cinch`);
    assert.equal(castNetMovementMultiplier(target, nets), 1);
  }
});

test("camp entry clears pending cinches and all binding without restoring cancelled nets", () => {
  const target = creature(1, 140, 0);
  const nets = advanceCastNets([newNet()], [target], .51, .51, visible, damage);
  const runtime = { player: { x: 0, y: 0 }, baseCamp: { x: 0, y: 0 }, baseCampGuideShown: true,
    castNets: nets, projectiles: [], harpoons: [], netSlams: [], clamReveals: [], clamHoles: [], bursts: [], floatTexts: [] };
  assert.equal(castNetMovementMultiplier(target, runtime.castNets), 0);
  assert.equal(mudflatStopHarvestInCamp(runtime, { radiusX: 100, radiusY: 100 }), true);
  assert.equal(castNetMovementMultiplier(target, runtime.castNets), 1);
  assert.deepEqual(advanceCastNets(runtime.castNets, [target], 10, 20, visible, damage), []);
  assert.equal(target.hp, 500);
});

test("net throw snapshots its position and all six levels hit once under small frame steps", () => {
  for (let level = 1; level <= 6; level++) {
    const movingPlayer = { x: 0, y: 0 }, destination = { x: 140, y: 0 };
    const net = createCastNet(1, movingPlayer, destination, mudflatCastNetStats(level));
    movingPlayer.x = 100; destination.x = -100;
    assert.equal(net.originX, 0); assert.equal(net.x, 140);
    const target = creature(1, 140, 0);
    let nets = [net], hits = 0, now = 0;
    while (now < net.duration + .1) {
      now += 1 / 60;
      nets = advanceCastNets(nets, [target], 1 / 60, now, visible, () => hits++);
      if (now < CAST_NET_FLIGHT + net.holdSeconds + CAST_NET_CLOSE) assert.equal(hits, 0);
    }
    assert.equal(hits, 1); assert.equal(nets.length, 0);
  }
});

test("net art has distinct phases, finite geometry and balanced canvas state without glow", () => {
  const stack = [], calls = [];
  const context = new Proxy({ globalAlpha: 1 }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === "save") return () => stack.push({ ...target });
      if (key === "restore") return () => { assert.ok(stack.length); Object.assign(target, stack.pop()); };
      return (...args) => { calls.push(key); for (const value of args) if (typeof value === "number") assert.ok(Number.isFinite(value)); };
    },
  });
  for (const level of [1, 6]) {
    const net = newNet(1, level);
    net.caughtPoints = [{ x: 140, y: 0, id: 1 }];
    for (const age of [0, .25, .5, 1, CAST_NET_FLIGHT + net.holdSeconds + .15, net.duration - .1, net.duration]) {
      net.age = age;
      drawCastNetThrow(context, { x: 160, y: 210 }, { x: 300, y: 210 }, net);
      assert.equal(stack.length, 0); assert.equal(context.globalAlpha, 1);
    }
  }
  assert.ok(calls.includes("clip") && calls.includes("quadraticCurveTo"));
  assert.ok(!calls.includes("createRadialGradient"));
});

test("game wiring keeps nets paused with the game and uses normal collection and visible targets", async () => {
  const source = await readFile(new URL("../app/mudflat-survivor-game.tsx", import.meta.url), "utf8");
  assert.match(source, /if \(runtime.paused \|\| runtime.ended\) return/);
  assert.match(source, /isCreatureRevealed\(creature\) && castNetOnScreen\(creature, runtime.player, width, height\)/);
  assert.match(source, /advanceCastNets\(runtime.castNets, runtime.creatures, dt, runtime.elapsed, canNetCatch, damageCreature\)/);
  assert.match(source, /campObstacleAllowed\(net, net.radius \+ 8\)/);
  assert.match(source, /runtime.castNetClock = CAST_NET_RETRY/);
  assert.match(source, /\* castNetMovementMultiplier\(creature, runtime.castNets\)/);
  assert.match(source, /runtime.pickups.push\(createExperiencePickup/);
  const cast = source.slice(source.indexOf('const castNetLevel ='), source.indexOf('const saltLevel ='));
  assert.doesNotMatch(cast, /Math.random|damageCreature\(/);
});
