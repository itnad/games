/** xxHash32, seed 0; byte-oriented and independent of host endianness. */
export function xxhash32(bytes: Uint8Array): string {
  const P1 = 0x9e3779b1, P2 = 0x85ebca77, P3 = 0xc2b2ae3d, P4 = 0x27d4eb2f, P5 = 0x165667b1;
  const rot = (n: number, b: number) => (n << b) | (n >>> (32 - b));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const round = (acc: number, n: number) => Math.imul(rot((acc + Math.imul(n, P2)) | 0, 13), P1);
  let offset = 0, hash: number;
  if (bytes.length >= 16) {
    let a = (P1 + P2) | 0, b = P2 | 0, c = 0, d = -P1;
    while (offset <= bytes.length - 16) {
      a = round(a, view.getUint32(offset, true)); b = round(b, view.getUint32(offset + 4, true));
      c = round(c, view.getUint32(offset + 8, true)); d = round(d, view.getUint32(offset + 12, true)); offset += 16;
    }
    hash = (rot(a, 1) + rot(b, 7) + rot(c, 12) + rot(d, 18)) | 0;
  } else hash = P5;
  hash = (hash + bytes.length) | 0;
  while (offset <= bytes.length - 4) {
    hash = Math.imul(rot((hash + Math.imul(view.getUint32(offset, true), P3)) | 0, 17), P4); offset += 4;
  }
  while (offset < bytes.length) { hash = Math.imul(rot((hash + Math.imul(bytes[offset++], P5)) | 0, 11), P1); }
  hash ^= hash >>> 15; hash = Math.imul(hash, P2); hash ^= hash >>> 13; hash = Math.imul(hash, P3); hash ^= hash >>> 16;
  return (hash >>> 0).toString(16).padStart(8, "0");
}
/** Canonical integer JSON. Callers validate the state schema before hashing. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${Array.from(value, canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  throw new TypeError("State must contain only canonical JSON values.");
}
export const checksum = (value: unknown) => xxhash32(new TextEncoder().encode(canonicalJson(value)));
