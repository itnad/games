export type ScreenPoint = { x: number; y: number };
export type HitTarget = { entityId: number; kind: "combat" | "worker" | "building" };
export type GestureCallbacks = {
  hitTest: (point: ScreenPoint) => HitTarget | null;
  groundTap?: (point: ScreenPoint) => void;
  tap: (hit: HitTarget) => void;
  preview: (hit: HitTarget | null) => void;
  group: (hit: HitTarget) => void;
  swipe: (hit: HitTarget, point: ScreenPoint, attackMove: boolean) => void;
  pan: (dx: number, dy: number) => void;
  pinch: (a: ScreenPoint, b: ScreenPoint, initialDistance: number) => void;
  pinchEnd: () => void;
};
/** Shared arbiter: a gesture can select, command, pan or zoom, never two at once. */
export class GestureMachine {
  private pointers = new Map<number, ScreenPoint>();
  private mode: "idle" | "terrain" | "tap" | "group" | "swipe" | "pan" | "pinch" | "suppressed" = "idle";
  private origin: ScreenPoint = { x: 0, y: 0 }; private started = 0; private distance = 0;
  private hit: HitTarget | null = null;
  constructor(private callbacks: GestureCallbacks) {}
  down(id: number, point: ScreenPoint, now: number): void {
    if (this.pointers.size >= 2) return;
    this.pointers.set(id, point);
    if (this.pointers.size === 2) {
      this.callbacks.preview(null); const [a, b] = [...this.pointers.values()];
      this.distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)); this.mode = "pinch"; return;
    }
    this.origin = point; this.started = now; this.hit = this.callbacks.hitTest(point);
    this.mode = this.hit ? "tap" : "terrain";
  }
  advance(now: number): void {
    if (this.mode === "tap" && now - this.started >= 300 && this.hit) {
      this.mode = "group"; this.callbacks.preview(this.hit);
    }
  }
  move(id: number, point: ScreenPoint): void {
    const previous = this.pointers.get(id); if (!previous) return;
    this.pointers.set(id, point);
    if (this.mode === "pinch") { const [a, b] = [...this.pointers.values()]; this.callbacks.pinch(a, b, this.distance); return; }
    const distance = Math.hypot(point.x - this.origin.x, point.y - this.origin.y);
    if(this.mode==="terrain"&&distance>=8)this.mode="pan";
    if ((this.mode === "tap" || this.mode === "group") && distance >= 8) { this.callbacks.preview(null); this.mode = "swipe"; }
    if (this.mode === "pan") this.callbacks.pan(point.x - previous.x, point.y - previous.y);
  }
  up(id: number, now: number): void {
    const point = this.pointers.get(id); if (!point) return;
    this.advance(now); this.pointers.delete(id);
    if(this.mode==="terrain")this.callbacks.groundTap?.(point);
    if (this.mode === "pinch") { this.callbacks.pinchEnd(); this.mode = this.pointers.size ? "suppressed" : "idle"; return; }
    if (this.hit) {
      if (this.mode === "tap") this.callbacks.tap(this.hit);
      if (this.mode === "group") this.callbacks.group(this.hit);
      if (this.mode === "swipe") this.callbacks.swipe(this.hit, point, this.hit.kind === "combat");
    }
    this.callbacks.preview(null); if (!this.pointers.size) this.mode = "idle";
  }
  cancel(): void { this.pointers.clear(); this.callbacks.preview(null); if (this.mode === "pinch") this.callbacks.pinchEnd(); this.mode = "idle"; this.hit = null; }
}
