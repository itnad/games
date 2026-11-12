import assert from "node:assert/strict";
import test from "node:test";
import {
  BEATS_PER_BAR,
  COUNT_IN_BEATS,
  JUDGMENT_WINDOWS_MS,
  beatAtTime,
  calibrationOffsetMs,
  clockBeatAtTime,
  clockBpmAtBeat,
  clockTimeOfBeat,
  correctInputBeat,
  createTempoMap,
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
import { classifyImpulse, classifyShake, createDodgeDetector, createWalkDetector } from "../app/baksal/dodge-detector.js";
import { GHOST_TYPES, GHOST_TYPE_IDS, masteryLevel } from "../app/baksal/baksal-ghosts.js";
import { CHOICE_BEATS, chartBpmAtBeat, createRunChart, createStageZeroChart, ghostAzimuthAt, roomAtBeat } from "../app/baksal/baksal-chart.js";
import { BASE_TALISMAN_IDS, TALISMANS, TALISMAN_IDS, defaultModifiers, offerTalismans, unlockedTalismanIds } from "../app/baksal/baksal-talismans.js";
import { normalizeCodex, readCodex, recordRun, writeCodex } from "../app/baksal/baksal-codex.js";
import {
  PLAYER_MAX_HP,
  advanceRun,
  chooseTalisman,
  createRun,
  cuesBetween,
  dodgeRun,
  ghostVisibility,
  projectilePosition,
  purifyRun,
  radarAzimuth,
  shieldRun,
  shootRun,
  summarizeRun,
  activateTalisman,
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
  assert.equal(nearestBarStartOffset(7.9, 80).beat, 8);
  assert.equal(nearestBarStartOffset(2, 80).beat, 4);
});

test("beat clock applies the calibration offset and trims extreme taps", () => {
  assert.equal(calibrationOffsetMs([]), 0);
  assert.equal(calibrationOffsetMs([40, 60, 55, 900, -300, 50, 45]), 50);
  assert.equal(calibrationOffsetMs([400, 400, 400]), 250);
  assert.ok(Math.abs(correctInputBeat(4.1, 80, 75) - 4) < 1e-9);
});

test("tempo map changes BPM at room boundaries without breaking beat continuity", () => {
  const map = createTempoMap(10, [{ beat: 0, bpm: 80 }, { beat: 8, bpm: 120 }]);
  assert.equal(map.segments[0].beat, -COUNT_IN_BEATS);
  assert.equal(clockBpmAtBeat(map, 3), 80);
  assert.equal(clockBpmAtBeat(map, 8), 120);
  assert.equal(clockTimeOfBeat(0, map), 13);
  assert.equal(clockTimeOfBeat(8, map), 19);
  assert.equal(clockTimeOfBeat(12, map), 21);
  for (const beat of [-4, -1, 0, 7.5, 8, 9.25, 30]) {
    assert.ok(Math.abs(clockBeatAtTime(clockTimeOfBeat(beat, map), map) - beat) < 1e-9, `round trip ${beat}`);
  }
  assert.equal(clockBeatAtTime(13, clock), 0, "plain clocks still work");
});

test("orientation converts to a forward aim for an upright phone", () => {
  const north = orientationToAim({ alpha: 0, beta: 90, gamma: 0 });
  assert.ok(Math.abs(north.yaw) < 1e-6 && Math.abs(north.pitch) < 1e-6);
  const west = orientationToAim({ alpha: 90, beta: 90, gamma: 0 });
  assert.ok(Math.abs(wrapDegrees(west.yaw + 90)) < 1e-6);
  assert.ok(Math.abs(orientationToAim({ alpha: 0, beta: 120, gamma: 0 }).pitch - 30) < 1e-6);
  assert.ok(Math.abs(orientationToAim({ alpha: 0, beta: 0, gamma: 0 }).pitch + 90) < 1e-6);
});

test("projection places targets relative to the aim and reports lantern membership", () => {
  const aim = { yaw: 0, pitch: 0 };
  const centered = projectToScreen(aim, { azimuth: 0, elevation: 0, distance: 6 }, 400, 800);
  assert.equal(centered.x, 200);
  assert.equal(centered.y, 400);
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
});

test("dodge detector classifies impulses, shakes, and respects the refractory period", () => {
  assert.equal(classifyImpulse({ x: 0, y: -6, z: 0 }), "duck");
  assert.equal(classifyImpulse({ x: -6, y: 1, z: 0 }), "left");
  assert.equal(classifyImpulse({ x: 6, y: 1, z: 0 }), "right");
  assert.equal(classifyImpulse({ x: 0, y: 0, z: 6 }), "back");
  assert.equal(classifyImpulse({ x: 0, y: 6, z: 0 }), null);
  assert.equal(classifyImpulse({ x: 1, y: -1, z: 1 }), null);
  assert.equal(classifyShake({ x: 12, y: -12, z: 5 }), "shake");
  assert.equal(classifyShake({ x: 0, y: -6, z: 0 }), null);

  const detector = createDodgeDetector({ threshold: 4 });
  assert.deepEqual(detector.push({ t: 1000, x: 0, y: -5, z: 0 }), { gesture: "duck", t: 1000 });
  assert.equal(detector.push({ t: 1100, x: 0, y: -7, z: 0 }), null);
  assert.deepEqual(detector.push({ t: 1500, x: 6, y: 0, z: 0 }), { gesture: "right", t: 1500 });
  assert.deepEqual(detector.push({ t: 2000, x: 15, y: -15, z: 0 }), { gesture: "shake", t: 2000 });
  detector.setThreshold(100);
  assert.equal(detector.threshold, 9);

  const gravityDetector = createDodgeDetector({ threshold: 4 });
  for (let t = 0; t < 400; t += 20) assert.equal(gravityDetector.pushWithGravity({ t, x: 0, y: 9.8, z: 0 }), null);
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
  assert.equal(createWalkDetector().push({ t: 0, x: 0, y: 4, z: 0 }), false);
});

test("ghost codex has eight types with grids of attacks that warn at least two beats ahead", () => {
  assert.equal(GHOST_TYPE_IDS.length, 8);
  for (const spec of Object.values(GHOST_TYPES)) {
    assert.ok(spec.bars.length >= 1);
    for (const bar of spec.bars) for (const attack of bar) {
      assert.ok(attack.arrive >= 2, `${spec.name} warns two beats ahead`);
      assert.ok(attack.beat + attack.arrive <= 8, `${spec.name} resolves within two bars`);
      if (attack.kind === "curse") assert.equal(attack.gesture, null);
    }
  }
  assert.equal(GHOST_TYPES.jangsanbeom.mimic, true);
  assert.equal(GHOST_TYPES.eodukshini.hidden, true);
  assert.equal(masteryLevel(0), 0);
  assert.equal(masteryLevel(3), 2);
  assert.equal(masteryLevel(10), 3);
});

test("run chart builds four rooms and a boss with choice gaps and rising tempo", () => {
  const chart = createRunChart(20261112);
  assert.deepEqual(chart, createRunChart(20261112));
  assert.equal(chart.rooms.length, 5);
  assert.equal(chart.rooms[4].boss, true);
  for (let index = 1; index < chart.rooms.length; index += 1) {
    assert.equal(chart.rooms[index].startBeat, chart.rooms[index - 1].endBeat + CHOICE_BEATS);
  }
  assert.ok(chart.rooms[2].bpm > chart.rooms[0].bpm);
  assert.ok(chartBpmAtBeat(chart, chart.lengthBeats - 1) > chartBpmAtBeat(chart, 0));
  assert.equal(roomAtBeat(chart, 0).index, 0);
  assert.equal(roomAtBeat(chart, chart.rooms[1].startBeat).index, 1);
  for (const ghost of chart.ghosts) {
    const room = roomAtBeat(chart, ghost.spawnBeat);
    assert.ok(ghost.leaveBeat <= room.endBeat, `${ghost.id} leaves before its room ends`);
    for (const attack of ghost.attacks) assert.ok(attack.arriveBeat - attack.fireBeat >= 2);
  }
  const pack = chart.ghosts.filter((ghost) => ghost.type === "geuseundae");
  assert.equal(pack.length, 3);
  assert.notEqual(pack[0].attacks[0].fireBeat, pack[1].attacks[0].fireBeat, "pack members attack on different beats");
  assert.ok(Math.abs(wrapDegrees(ghostAzimuthAt(pack[0], pack[0].spawnBeat + 4) - pack[0].azimuth) - 30) < 1e-9);
  const scaled = createRunChart(1, { bpm: 90 });
  assert.equal(scaled.rooms[0].bpm, 90);
  const stageZero = createStageZeroChart(5);
  assert.equal(stageZero.rooms.length, 1);
  assert.ok(stageZero.ghosts.every((ghost) => ghost.leaveBeat <= stageZero.lengthBeats));
});

test("talismans apply modifiers and unlock by purification count", () => {
  assert.equal(TALISMAN_IDS.length, 14);
  let modifiers = defaultModifiers();
  modifiers = TALISMANS["salt-wide"].apply(modifiers);
  modifiers = TALISMANS["beat-purify"].apply(modifiers);
  assert.equal(modifiers.aimAssistDeg, 15);
  assert.deepEqual(modifiers.purifyBeats, [0, 2]);
  assert.deepEqual(unlockedTalismanIds(0), BASE_TALISMAN_IDS);
  assert.ok(unlockedTalismanIds(8).includes("beat-purify"));
  assert.ok(unlockedTalismanIds(40).includes("salt-throw"));
  const offer = offerTalismans(99, { unlocked: BASE_TALISMAN_IDS, owned: ["salt-wide"], activeId: "lantern-torch" });
  assert.equal(offer.offered.length, 3);
  assert.ok(!offer.offered.includes("salt-wide") && !offer.offered.includes("lantern-torch"));
  assert.deepEqual(offer.offered, offerTalismans(99, { unlocked: BASE_TALISMAN_IDS, owned: ["salt-wide"], activeId: "lantern-torch" }).offered);
});

test("codex records seen and purified ghosts, mastery ups, run history and unlocks", () => {
  const store = new Map();
  const storage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  assert.equal(readCodex(() => storage).totalPurified, 0);
  const first = recordRun(normalizeCodex(null), { score: 500, purified: 3, roomsCleared: 2, ghostStats: { "dokkaebi-fire": { seen: 2, purified: 3 } } }, { at: 1 });
  assert.deepEqual(first.newEntries, ["dokkaebi-fire"]);
  assert.deepEqual(first.masteryUps, [{ type: "dokkaebi-fire", level: 2 }]);
  assert.equal(first.isBest, true);
  writeCodex(first.codex, () => storage);
  const reloaded = readCodex(() => storage);
  assert.equal(reloaded.ghosts["dokkaebi-fire"].purified, 3);
  assert.equal(reloaded.runs.length, 1);
  const second = recordRun(reloaded, { score: 100, purified: 6, ghostStats: { "egg-ghost": { seen: 1, purified: 6 } } }, { at: 2 });
  assert.deepEqual(second.newTalismans, ["body-shield", "beat-purify"]);
  assert.equal(second.isBest, false);
  assert.equal(second.codex.runs[0].at, 2);
});

function runWithFirstGhost(seed = 7) {
  const chart = createRunChart(seed);
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
  const position = projectilePosition(state, state.projectiles[0], 1);
  assert.ok(position.distance < ghost.distance && position.distance > 0.9);
  const hitEvents = advanceRun(state, 2.5);
  assert.ok(hitEvents.some((event) => event.type === "player-hit"));
  assert.equal(state.hp, PLAYER_MAX_HP - 1);
  assert.equal(state.roomStats[0].hits, 1);
});

test("engine resolves a matching dodge inside the arrival window and rejects the wrong gesture", () => {
  const { state } = runWithFirstGhost();
  advanceRun(state, 0);
  assert.equal(dodgeRun(state, 0.5, "duck").matched, false);
  const wrong = dodgeRun(state, 2.05, "left");
  assert.equal(wrong.matched, false);
  assert.equal(wrong.expected, "duck");
  const result = dodgeRun(state, 2.05, "duck");
  assert.equal(result.matched, true);
  assert.equal(result.judgment, "ttak");
  advanceRun(state, 3);
  assert.equal(state.hp, PLAYER_MAX_HP);
});

test("engine shoots with beat judgment, destroys projectiles, hits weak points and kills into a purify window", () => {
  const { state, ghost, aim } = runWithFirstGhost();
  advanceRun(state, 0);
  assert.equal(shootRun(state, 1, { yaw: aim.yaw + 90, pitch: 0 }).hit, null);
  const projectile = state.projectiles[0];
  const projectileAim = projectilePosition(state, projectile, 1);
  const destroy = shootRun(state, 1, { yaw: projectileAim.azimuth, pitch: projectileAim.elevation });
  assert.equal(destroy.destroyed, true);
  advanceRun(state, 3);
  const weak = shootRun(state, 3, { yaw: aim.yaw, pitch: aim.pitch + ghost.weakPoint.elevation });
  assert.equal(weak.weak, true, "weak point hit");
  assert.equal(ghost.hp, 0, "weak ttak does 4 damage against 3 hp");
  assert.equal(ghost.status, "purifiable");
  assert.equal(state.weakHits, 1);
  assert.ok(ghost.staggerUntil > 3);
  const cues = cuesBetween(state, 4, 8);
  assert.ok(!cues.some((cue) => cue.type === "fire" && cue.ghostId === ghost.id), "staggered or dead ghosts do not cue");
});

test("engine purifies only on allowed beats and expires the window", () => {
  const { state, ghost, aim } = runWithFirstGhost();
  advanceRun(state, 0);
  advanceRun(state, 3);
  shootRun(state, 3, aim);
  shootRun(state, 4, aim);
  assert.equal(ghost.status, "purifiable");
  assert.equal(purifyRun(state, 4.5, aim).reason, "beat");
  assert.equal(purifyRun(state, 8.02, { yaw: aim.yaw + 60, pitch: 0 }).reason, "no-target");
  const purified = purifyRun(state, 8.02, aim);
  assert.equal(purified.ok, true);
  assert.equal(state.ghostStats["dokkaebi-fire"].purified, 1);

  const other = runWithFirstGhost();
  advanceRun(other.state, 0);
  advanceRun(other.state, 3);
  shootRun(other.state, 3, other.aim);
  shootRun(other.state, 4, other.aim);
  const events = advanceRun(other.state, 4 + 8.1);
  assert.ok(events.some((event) => event.type === "purify-expired"));
});

test("engine opens a talisman choice between rooms and auto-picks at the deadline", () => {
  const { state, chart } = runWithFirstGhost();
  const room = chart.rooms[0];
  advanceRun(state, room.endBeat - 0.5);
  assert.equal(state.phase, "room");
  const events = advanceRun(state, room.endBeat);
  assert.ok(events.some((event) => event.type === "room-clear"));
  assert.equal(state.phase, "choice");
  assert.equal(state.choice.offered.length, 3);
  assert.equal(chooseTalisman(state, "not-a-talisman").ok, false);
  const chosen = state.choice.offered.find((id) => !TALISMANS[id].active) ?? state.choice.offered[0];
  const picked = chooseTalisman(state, chosen);
  assert.equal(picked.ok, true);
  assert.equal(state.phase, "room");
  assert.equal(state.roomIndex, 1);

  const auto = runWithFirstGhost();
  advanceRun(auto.state, room.endBeat);
  const first = auto.state.choice.offered[0];
  const autoEvents = advanceRun(auto.state, room.endBeat + CHOICE_BEATS);
  assert.ok(autoEvents.some((event) => event.type === "talisman-auto" && event.id === first));
  assert.equal(auto.state.phase, "room");
});

test("talisman effects change hp, dodge windows, purify beats and active abilities", () => {
  const { state } = runWithFirstGhost();
  state.phase = "choice";
  state.choice = { offered: ["body-hp", "beat-purify", "lantern-torch"], deadlineBeat: 100, forRoom: 1 };
  state.hp = 3;
  chooseTalisman(state, "body-hp");
  assert.equal(state.maxHp, PLAYER_MAX_HP + 1);
  assert.equal(state.hp, 4);
  state.phase = "choice";
  state.choice = { offered: ["lantern-torch", "cleanse"], deadlineBeat: 100, forRoom: 1 };
  chooseTalisman(state, "lantern-torch");
  assert.equal(state.active.id, "lantern-torch");
  assert.equal(state.active.usesLeft, 3);
  const used = activateTalisman(state, 10, { yaw: 0, pitch: 0 });
  assert.equal(used.ok, true);
  assert.equal(state.active.usesLeft, 2);
  assert.equal(activateTalisman(state, 11, { yaw: 0, pitch: 0 }).reason, "active");
  const hidden = state.ghosts.find((ghost) => ghost.hidden);
  const centered = { yaw: hidden.azimuth, pitch: hidden.elevation };
  assert.equal(ghostVisibility(state, hidden, centered, 50), 0, "hidden ghosts vanish when looked at directly");
  assert.ok(ghostVisibility(state, hidden, { yaw: hidden.azimuth + 15, pitch: hidden.elevation }, 50) > 0, "but show at the lantern edge");
  assert.ok(ghostVisibility(state, hidden, centered, 12) > 0.8, "torch reveals them");
});

test("curse waves cannot be dodged, apply a curse on arrival, and cleanse resists them", () => {
  const chart = createRunChart(3);
  const state = createRun(chart);
  const bride = state.ghosts.find((ghost) => ghost.type === "sonmalmyeong");
  advanceRun(state, bride.spawnBeat);
  const wave = state.projectiles.find((projectile) => projectile.kind === "curse");
  assert.ok(wave);
  assert.equal(dodgeRun(state, wave.arriveBeat, "duck").reason, "no-projectile");
  const events = advanceRun(state, wave.arriveBeat + 0.5);
  assert.ok(events.some((event) => event.type === "cursed"));
  assert.equal(state.hp, PLAYER_MAX_HP, "curses do not cost hp");
  assert.equal(state.cursedCount, 1);

  const resisted = createRun(chart);
  resisted.active = { id: "cleanse", usesLeft: 3, effect: "cleanse", beats: 8 };
  advanceRun(resisted, bride.spawnBeat);
  activateTalisman(resisted, bride.spawnBeat + 1, { yaw: 0, pitch: 0 });
  const resistedEvents = advanceRun(resisted, wave.arriveBeat + 0.5);
  assert.ok(resistedEvents.some((event) => event.type === "curse-resisted"));
  assert.equal(resisted.cursedCount, 0);
});

test("emergency shield blocks arrivals for one beat and the boss mimics its direction", () => {
  const { state } = runWithFirstGhost();
  advanceRun(state, 0);
  assert.equal(shieldRun(state, 1.9).ok, true);
  assert.equal(shieldRun(state, 1.95).reason, "active");
  const events = advanceRun(state, 2.5);
  assert.ok(events.some((event) => event.type === "blocked"));
  assert.equal(state.hp, PLAYER_MAX_HP);
  assert.equal(shieldRun(state, 5).reason, "none-left");

  const boss = state.ghosts.find((ghost) => ghost.type === "jangsanbeom");
  const bossState = createRun(state.chart);
  const bossCue = cuesBetween(bossState, boss.spawnBeat, boss.spawnBeat + 1).find((cue) => cue.type === "spawn" && cue.ghostId === boss.id);
  assert.ok(Math.abs(wrapDegrees(bossCue.azimuth - boss.azimuth - 180)) < 1e-6, "the sound comes from the opposite side");
  advanceRun(bossState, boss.spawnBeat);
  const away = { yaw: boss.azimuth + 180, pitch: 0 };
  assert.ok(Math.abs(wrapDegrees(radarAzimuth(bossState, boss, away, boss.spawnBeat) - boss.azimuth - 180)) < 1e-6);
  const facing = { yaw: boss.azimuth, pitch: boss.elevation };
  assert.ok(Math.abs(wrapDegrees(radarAzimuth(bossState, boss, facing, boss.spawnBeat) - boss.azimuth)) < 1e-6, "seen bosses show their true place");
});

test("a full run that dodges everything finishes after the boss with per-room stats", () => {
  const chart = createRunChart(11);
  const state = createRun(chart);
  let beat = -1;
  let finished = false;
  while (beat < chart.lengthBeats + 8 && !finished) {
    const events = advanceRun(state, beat);
    for (const projectile of state.projectiles) {
      if (projectile.status !== "flying") continue;
      if (projectile.gesture) dodgeRun(state, projectile.arriveBeat, projectile.gesture);
      else {
        const position = projectilePosition(state, projectile, beat);
        shootRun(state, Math.round(beat), { yaw: position.azimuth, pitch: position.elevation });
      }
    }
    finished = events.some((event) => event.type === "finished");
    beat += 0.25;
  }
  assert.equal(state.finished, true);
  const summary = summarizeRun(state);
  assert.equal(summary.failed, false);
  assert.equal(summary.roomsCleared, 5);
  assert.equal(summary.roomStats.length, 5);
  assert.ok(summary.dodges.ok > 20);
  assert.equal(summary.dodges.fail, 0);
  assert.equal(state.talismans.length + (state.active ? 1 : 0), 4, "one talisman per room gap");
});
