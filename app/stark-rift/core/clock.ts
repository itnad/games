import { TICK_MS, safeInteger } from "./fixed-point";

/** Wall-clock adapter only; elapsed time never enters simulation state. No backlog is discarded. */
export class FixedTickClock {
  private backlogMs = 0;
  advance(elapsedMs: number, step: () => boolean, maxSteps = 5): number {
    if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0 || !Number.isSafeInteger(maxSteps) || maxSteps < 1) throw new RangeError("Invalid clock input.");
    this.backlogMs = safeInteger(this.backlogMs + elapsedMs);
    let steps = 0;
    while (this.backlogMs >= TICK_MS && steps < maxSteps) {
      if (!step()) { this.backlogMs = 0; break; }
      this.backlogMs -= TICK_MS; steps++;
    }
    return steps;
  }
  reset(): void { this.backlogMs = 0; }
  get pendingMs(): number { return this.backlogMs; }
}
