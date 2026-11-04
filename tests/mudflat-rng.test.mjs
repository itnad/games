import assert from "node:assert/strict";
import test from "node:test";
import { createMudflatSeed, nextMudflatRandom, normalizeMudflatSeed } from "../app/mudflat-rng.js";

test("mudflat RNG repeats the same sequence for the same seed", () => {
  const sequence = (seed) => {
    let state = seed;
    return Array.from({ length: 8 }, () => {
      const next = nextMudflatRandom(state);
      state = next.state;
      return next.value;
    });
  };
  assert.deepEqual(sequence(20261102), sequence(20261102));
  assert.notDeepEqual(sequence(20261102), sequence(20261103));
});

test("mudflat RNG always returns normalized non-zero state and [0, 1) values", () => {
  for (const seed of [0, -1, Number.NaN, 0xffffffff]) {
    const next = nextMudflatRandom(seed);
    assert.equal(next.state, normalizeMudflatSeed(next.state));
    assert.ok(next.state > 0);
    assert.ok(next.value >= 0 && next.value < 1);
  }
  assert.equal(createMudflatSeed(1234, { getRandomValues(values) { values[0] = 77; } }), 77);
});
