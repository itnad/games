export const UNITS_PER_TILE = 256;
export const TICKS_PER_SECOND = 20;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

export function safeInteger(value: number): number {
  if (!Number.isSafeInteger(value)) throw new RangeError("Unsafe integer arithmetic.");
  return value || 0;
}
export const add = (a: number, b: number) => safeInteger(safeInteger(a) + safeInteger(b));
export function multiplyDivide(a: number, b: number, divisor: number): number {
  safeInteger(a); safeInteger(b); safeInteger(divisor);
  if (divisor === 0) throw new RangeError("Division by zero.");
  return safeInteger(Number(BigInt(a) * BigInt(b) / BigInt(divisor)));
}
/** Carry signed sub-unit movement instead of losing it each tick. */
export function integrate(numerator: number, remainder: number, denominator = TICKS_PER_SECOND) {
  safeInteger(numerator); safeInteger(remainder); safeInteger(denominator);
  if (denominator <= 0 || Math.abs(remainder) >= denominator) throw new RangeError("Invalid movement remainder.");
  const total = add(numerator, remainder);
  return { delta: Math.trunc(total / denominator) || 0, remainder: (total % denominator) || 0 };
}
