import assert from "node:assert/strict";
import test from "node:test";
import {
  BEATS_PER_BAR,
  COUNT_IN_BEATS,
  JUDGMENT_WINDOWS_MS,
  beatAtTime,
  calibrationOffsetMs,
  correctInputBeat,
  judgeOffset,
  nearestBarStartOffset,
  nearestBeatOffset,
  secondsPerBeat,
  timeOfBeat,
} from "../app/baksal/beat-clock.js";
import {
  LANTERN_CONE_DEG,
  angularDistanceDeg,
  edgeHint,
  isInsideLantern,
  lanternVisibility,
  orientationToAim,
  projectToScreen,
  wrapDegrees,
} from "../app/baksal/aim-projection.js";
import { classifyImpulse, createDodgeDetector, createWalkDetector } from "../app/baksal/dodge-detector.js";
import { GHOST_TYPES, STAGE_ZERO_BARS, createStageZeroChart } from "../app/baksal/baksal-chart.js";
import {
  PLAYER_MAX_HP,
  advanceRun,
  createRun,
  cuesBetween,
  dodgeRun,
  projectilePosition,
  purifyRun,
  shootRun,
  summarizeRun,
} from "../app/baksal/baksal-engine.js";

const clock = { bpm: 80, startTime: 10 };

test("beat clock converts time and beats both ways with a four-beat count-in", () => {
  assert.equal(secondsPerBeat(80), 0.75);
  assert.equal(beatAtTime(10, clock), -COUNT_IN_BEATS);
  assert.equal(beatAtTime(13, clock), 0);
  assert.equal(timeOfBeat(0, clock), 13);
  assert.ok(Math.abs(timeOfBeat(beatAtTime(17.3, clock), clock) - 17.3) < 1e-9);
});

test("beat clock judges offsets against the standard and lenient windows", () => {
  const near = nearestBeatOffset(4.1, 80);
  assert.equal(near.beat, 4);
  assert.ok(Math.abs(near.offsetMs - 75) < 1e-9);
  assert.equal(judgeOffset(75), "ttak");
  assert.equal(judgeOffset(-120), "joa");
  assert.equal(judgeOffset(200), "miss");
  assert.equal(judgeOffset(200, JUDGMENT_WINDOWS_MS.lenient), "joa");
  const barStart = nearestBarStartOffset(7.9, 80);
  assert.equal(barStart.beat, 8);
  assert.ok(barStart.offsetMs < 0);
  assert.equal(nearestBarStartOffset(2, 80).beat, 4);
});

test("beat clock applies the calibration offset and trims extreme taps", () => {
  assert.equal(calibrationOffsetMs([]), 0);
  assert.equal(calibrationOffsetMs([40, 60, 55, 900, -300, 50, 45]), 50);
  assert.equal(calibrationOffsetMs([400, 400, 400]), 250);
  const corrected = correctInputBeat(4.1, 80, 75);
  assert.ok(Math.abs(corrected - 4) < 1e-9);
});

test("orientation converts to a forward aim for an upright phone", () => {
  const north = orientationToAim({ alpha: 0, beta: 90, gamma: 0 });
  assert.ok(Math.abs(north.yaw) < 1e-6);
  assert.ok(Math.abs(north.pitch) < 1e-6);
  const west = orientationToAim({ alpha: 90, beta: 90, gamma: 0 });
  assert.ok(Math.abs(wrapDegrees(west.yaw + 90)) < 1e-6);
  const up = orientationToAim({ alpha: 0, beta: 120, gamma: 0 });
  assert.ok(Math.abs(up.pitch - 30) < 1e-6);
  const flat = orientationToAim({ alpha: 0, beta: 0, gamma: 0 });
  assert.ok(Math.abs(flat.pitch + 90) < 1e-6);
});

test("projection places targets relative to the aim and reports lantern membership", () => {
  const aim = { yaw: 0, pitch: 0 };
  const centered = projectToScreen(aim, { azimuth: 0, elevation: 0, distance: 6 }, 400, 800);
  assert.equal(centered.x, 200);
  assert.equal(centered.y, 400);
  assert.ok(centered.onScreen);
  const right = projectToScreen(aim, { azimuth: 25, elevation: 0, distance: 6 }, 400, 800);
  assert.ok(right.x > 200 && right.x < 400);
  const behind = projectToScreen(aim, { azimuth: 170, elevation: 0, distance: 6 }, 400, 800);
  assert.equal(behind.onScreen, false);
  assert.equal(edgeHint(behind.dYaw), "right");
  assert.equal(edgeHint(-150), "left");
  assert.equal(edgeHint(5), null);
  assert.ok(Math.abs(angularDistanceDeg(aim, { azimuth: 30, elevation: 0 }) - 30) < 1e-9);
  assert.ok(isInsideLantern(aim, { azimuth: LANTERN_CONE_DEG / 2 - 1, elevation: 0 }));
  assert.equal(isInsideLantern(aim, { azimuth: LANTERN_CONE_DEG / 2 + 1, elevation: 0 }), false);
  assert.equal(lanternVisibility(aim, { azimuth: 0, elevation: 0 }), 1);
  assert.equal(lanternVisibility(aim, { azimuth: 60, elevation: 0 }), 0);
  const edge = lanternVisibility(aim, { azimuth: 18, elevation: 0 });
  assert.ok(edge > 0 && edge < 1);
});

test("dodge detector classifies impulses and respects the refractory period", () => {
  assert.equal(classifyImpulse({ x: 0, y: -6, z: 0 }), "duck");
  assert.equal(classifyImpulse({ x: -6, y: 1, z: 0 }), "left");
  assert.equal(classifyImpulse({ x: 6, y: 1, z: 0 }), "right");
  assert.equal(classifyImpulse({ x: 0, y: 0, z: 6 }), "back");
  assert.equal(classifyImpulse({ x: 0, y: 6, z: 0 }), null, "moving up is not a dodge");
  assert.equal(classifyImpulse({ x: 0, y: 0, z: -6 }), null, "moving toward the ghost is not a dodge");
  assert.equal(classifyImpulse({ x: 1, y: -1, z: 1 }), null);

  const detector = createDodgeDetector({ threshold: 4 });
  assert.deepEqual(detector.push({ t: 1000, x: 0, y: -5, z: 0 }), { gesture: "duck", t: 1000 });
  assert.equal(detector.push({ t: 1100, x: 0, y: -7, z: 0 }), null, "same impulse inside refractory");
  assert.deepEqual(detector.push({ t: 1500, x: 6, y: 0, z: 0 }), { gesture: "right", t: 1500 });
  detector.setThreshold(100);
  assert.equal(detector.threshold, 9, "threshold clamps to the allowed range");

  const gravityDetector = createDodgeDetector({ threshold: 4 });
  assert.equal(gravityDetector.pushWithGravity({ t: 0, x: 0, y: 9.8, z: 0 }), null);
  for (let t = 20; t < 400; t += 20) assert.equal(gravityDetector.pushWithGravity({ t, x: 0, y: 9.8, z: 0 }), null);
  assert.equal(gravityDetector.pushWithGravity({ t: 420, x: 0, y: 2, z: 0 })?.gesture, "duck");
});

test("walk detector needs several regular vertical steps", () => {
  const walker = createWalkDetector();
  let walking = false;
  for (let step = 0; step < 6; step += 1) {
    walking = walker.push({ t: step * 500, x: 0, y: 4, z: 0 }) || walking;
    walker.push({ t: step * 500 + 200, x: 0, y: 0, z: 0 });
  }
  assert.equal(walking, true);
  const still = createWalkDetector();
  assert.equal(still.push({ t: 0, x: 0, y: 4, z: 0 }), false);
  assert.equal(still.push({ t: 100, x: 0, y: 0, z: 0 }), false);
});

test("stage zero chart is deterministic per seed and keeps attacks on the beat grid", () => {
  const chart = createStageZeroChart(20261112);
  const again = createStageZeroChart(20261112);
  assert.deepEqual(chart, again);
  assert.notDeepEqual(chart.ghosts.map((ghost) => ghost.azimuth), createStageZeroChart(1).ghosts.map((ghost) => ghost.azimuth));
  assert.equal(chart.bars, STAGE_ZERO_BARS);
  assert.equal(chart.lengthBeats, STAGE_ZERO_BARS * BEATS_PER_BAR);
  for (const ghost of chart.ghosts) {
    const spec = GHOST_TYPES[ghost.type];
    assert.equal(ghost.maxHp, spec.hp);
    for (const attack of ghost.attacks) {
      assert.equal(attack.fireBeat % BEATS_PER_BAR, spec.attack.fireBeat);
      assert.equal(attack.arriveBeat - attack.fireBeat, spec.attack.arriveBeat - spec.attack.fireBeat);
      assert.ok(attack.arriveBeat - attack.fireBeat >= 2, "at least two beats of warning");
    }
  }
  const eggs = chart.ghosts.filter((ghost) => ghost.type === "egg-ghost");
  assert.ok(eggs.every((ghost) => Math.abs(wrapDegrees(ghost.azimuth)) > 90), "egg ghosts start behind the player");
});

function runWithFirstGhost() {
  const chart = createStageZeroChart(7);
  const state = createRun(chart);
  const ghost = state.ghosts[0];
  const aim = { yaw: ghost.azimuth, pitch: ghost.elevation };
  return { chart, state, ghost, aim };
}

test("engine spawns ghosts, fires cues and damages the player when nobody dodges", () => {
  const { state, ghost } = runWithFirstGhost();
  const spawnEvents = advanceRun(state, 0);
  assert.ok(spawnEvents.some((event) => event.type === "spawn" && event.ghostId === ghost.id));
  assert.ok(spawnEvents.some((event) => event.type === "cue" && event.gesture === "duck"));
  assert.equal(state.projectiles.length, 1);
  const position = projectilePosition(state, state.projectiles[0], 1);
  assert.ok(position.distance < ghost.distance && position.distance > 0.9);
  const hitEvents = advanceRun(state, 2.5);
  assert.ok(hitEvents.some((event) => event.type === "player-hit"));
  assert.equal(state.hp, PLAYER_MAX_HP - 1);
  assert.equal(state.dodges.fail, 1);
});

test("engine resolves a matching dodge inside the arrival window and rejects the wrong gesture", () => {
  const { state } = runWithFirstGhost();
  advanceRun(state, 0);
  assert.equal(dodgeRun(state, 0.5, "duck").matched, false, "too early");
  const wrong = dodgeRun(state, 2.05, "left");
  assert.equal(wrong.matched, false);
  assert.equal(wrong.expected, "duck");
  const result = dodgeRun(state, 2.05, "duck");
  assert.equal(result.matched, true);
  assert.equal(result.judgment, "ttak");
  advanceRun(state, 3);
  assert.equal(state.hp, PLAYER_MAX_HP);
  assert.equal(state.dodges.ok, 1);
});

test("engine shoots with beat judgment, destroys projectiles and kills ghosts into a purify window", () => {
  const { state, ghost, aim } = runWithFirstGhost();
  advanceRun(state, 0);
  const empty = shootRun(state, 1, { yaw: aim.yaw + 90, pitch: 0 });
  assert.equal(empty.hit, null);
  assert.equal(state.counts.ttak + state.counts.joa + state.counts.miss, 0, "shooting air is not judged");

  const projectile = state.projectiles[0];
  const projectileAim = projectilePosition(state, projectile, 1);
  const destroy = shootRun(state, 1, { yaw: projectileAim.azimuth, pitch: projectileAim.elevation });
  assert.equal(destroy.hit, "projectile");
  assert.equal(destroy.destroyed, true);
  assert.equal(state.destroyed, 1);

  const offBeat = shootRun(state, 2.4, aim);
  assert.equal(offBeat.judgment, "miss");
  assert.equal(offBeat.hit, "ghost");
  assert.equal(ghost.hp, ghost.maxHp - 0.5);
  const first = shootRun(state, 3, aim);
  assert.equal(first.judgment, "ttak");
  assert.equal(ghost.hp, ghost.maxHp - 2.5);
  const second = shootRun(state, 4, aim);
  assert.equal(second.killed, true);
  assert.equal(ghost.status, "purifiable");
  assert.ok(state.score > 0);
  assert.equal(state.maxCombo, 2);
});

test("engine purifies only on the first beat of a bar and expires the window", () => {
  const { state, ghost, aim } = runWithFirstGhost();
  advanceRun(state, 0);
  advanceRun(state, 3);
  shootRun(state, 3, aim);
  shootRun(state, 4, aim);
  assert.equal(ghost.status, "purifiable");
  assert.equal(purifyRun(state, 4.5, aim).reason, "beat");
  assert.equal(purifyRun(state, 4.02, { yaw: aim.yaw + 60, pitch: 0 }).reason, "no-target");
  const purified = purifyRun(state, 4.02, aim);
  assert.equal(purified.ok, true);
  assert.equal(ghost.status, "purified");
  assert.equal(state.purified, 1);

  const other = runWithFirstGhost();
  advanceRun(other.state, 0);
  advanceRun(other.state, 3);
  shootRun(other.state, 3, other.aim);
  shootRun(other.state, 4, other.aim);
  const events = advanceRun(other.state, 4 + 8.1);
  assert.ok(events.some((event) => event.type === "purify-expired"));
  assert.equal(other.state.missedPurify, 1);
});

test("engine schedules cues for living ghosts and finishes the run", () => {
  const { state, chart } = runWithFirstGhost();
  advanceRun(state, -1);
  const cues = cuesBetween(state, -1, 4);
  assert.ok(cues.some((cue) => cue.type === "spawn" && cue.beat === 0));
  assert.ok(cues.some((cue) => cue.type === "fire" && cue.beat === 0 && cue.gesture === "duck"));
  assert.ok(cues.some((cue) => cue.type === "arrive" && cue.beat === 2));
  const rushCue = cuesBetween(state, 16, 20).find((cue) => cue.type === "fire" && cue.kind === "rush");
  assert.equal(rushCue.gesture, "back");

  let beat = 0;
  let finished = false;
  while (beat < chart.lengthBeats + 8 && !finished) {
    const events = advanceRun(state, beat);
    for (const projectile of state.projectiles) if (projectile.status === "flying") dodgeRun(state, projectile.arriveBeat, projectile.gesture);
    finished = events.some((event) => event.type === "finished");
    beat += 0.25;
  }
  assert.equal(state.finished, true);
  const summary = summarizeRun(state);
  assert.equal(summary.failed, false);
  assert.ok(summary.dodges.ok > 0);
  assert.equal(summary.dodges.fail, 0);
});
