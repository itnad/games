import type { RngStreamId, RngStreamState } from "./state";
import { STARK_RIFT_RNG_ALGORITHM } from "./versions";

export const RNG_STREAM_IDS = ["combat", "ai", "map", "rules"] as const;
const rotate = (value: number, bits: number) => ((value << bits) | (value >>> (32 - bits))) >>> 0;
export function createRngStreams(seed: number): RngStreamState[] {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError("Invalid seed.");
  let cursor = seed >>> 0;
  const word = () => {
    cursor = (cursor + 0x9e3779b9) >>> 0;
    let n = cursor;
    n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
    n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
    return (n ^ (n >>> 15)) >>> 0;
  };
  return RNG_STREAM_IDS.map(id => {
    const words = Array.from({ length: 4 }, word);
    if (!words.some(n => n !== 0)) words[0] = 1;
    return { id, algorithm: STARK_RIFT_RNG_ALGORITHM, words };
  });
}
export function nextUint32(streams: RngStreamState[], id: RngStreamId): number {
  const stream = streams.find(s => s.id === id);
  if (!stream || stream.algorithm !== STARK_RIFT_RNG_ALGORITHM || stream.words.length !== 4 ||
      !stream.words.every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff) || !stream.words.some(n => n !== 0)) {
    throw new RangeError("Invalid RNG stream.");
  }
  const s = stream.words;
  const result = Math.imul(rotate(Math.imul(s[1], 5), 7), 9) >>> 0;
  const t = s[1] << 9;
  s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t;
  s[3] = rotate(s[3], 11);
  for (let i = 0; i < 4; i++) s[i] >>>= 0;
  return result;
}
