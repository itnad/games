const FALLBACK_SEED = 0x6d2b79f5;

export function normalizeMudflatSeed(value) {
  const normalized = Number.isFinite(Number(value)) ? (Number(value) >>> 0) : FALLBACK_SEED;
  return normalized || FALLBACK_SEED;
}

export function createMudflatSeed(now = Date.now(), cryptoSource = globalThis.crypto) {
  try {
    const values = new Uint32Array(1);
    cryptoSource?.getRandomValues?.(values);
    if (values[0]) return normalizeMudflatSeed(values[0]);
  } catch { /* Date and high-resolution time remain a safe non-secret fallback. */ }
  const highResolution = typeof performance === "undefined" ? 0 : Math.floor(performance.now() * 1000);
  return normalizeMudflatSeed(Number(now) ^ highResolution ^ FALLBACK_SEED);
}

// Mulberry32 is small, deterministic and suitable for gameplay simulation.
// This is not a security primitive; the returned state must be saved with a run.
export function nextMudflatRandom(state) {
  const nextState = (normalizeMudflatSeed(state) + 0x6d2b79f5) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { state: nextState, value: ((value ^ (value >>> 14)) >>> 0) / 4294967296 };
}
