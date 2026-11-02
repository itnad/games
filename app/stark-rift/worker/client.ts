import { STARK_RIFT_PROTOCOL_VERSION } from "../core/versions";
import { validateWorkerToMainMessage, validateMainToWorkerMessage, type MainToWorkerMessage, type WorkerToMainMessage } from "./messages";

export type WorkerPort = Pick<Worker, "postMessage" | "terminate" | "addEventListener" | "removeEventListener">;
export class SimulationClient {
  private id = 0; private closed = false; private lastTick = -1; private ready = false;
  private awaitingSince: number | null = null; private initializing = false;
  private listener: (event: MessageEvent) => void;
  private failure: EventListener;
  constructor(private port: WorkerPort, private receive: (message: WorkerToMainMessage) => void) {
    this.listener = event => {
      if (this.closed) return;
      const parsed = validateWorkerToMainMessage(event.data);
      if (!parsed.ok) { this.fail("INVALID_WORKER_RESPONSE"); return; }
      const message = parsed.value; this.awaitingSince = null;
      if (message.kind === "ready") { this.ready = true; this.initializing = false; }
      if (message.kind === "disposed") { this.closed = true; this.detach(); this.receive(message); return; }
      if (message.kind === "snapshotLoaded") this.lastTick = -1;
      if (message.kind === "renderSnapshot") {
        try { if (message.payload.tick > this.lastTick) { this.lastTick = message.payload.tick; this.receive(message); } }
        finally { this.send("releaseRenderBuffer", { bufferId: message.payload.bufferId }); }
      } else this.receive(message);
    };
    this.failure = () => this.fail("WORKER_FAILED");
    port.addEventListener("message", this.listener); port.addEventListener("error", this.failure); port.addEventListener("messageerror", this.failure);
  }
  private detach(): void {
    this.port.removeEventListener("message", this.listener); this.port.removeEventListener("error", this.failure); this.port.removeEventListener("messageerror", this.failure);
    this.port.terminate();
  }
  private fail(code: string): void {
    if (this.closed) return;
    this.closed = true; this.detach();
    this.receive({ protocolVersion: STARK_RIFT_PROTOCOL_VERSION, messageId: 0, kind: "fatalError", payload: { code, recoverable: true, diagnosticId: null } });
  }
  send<K extends MainToWorkerMessage["kind"]>(kind: K, payload: Extract<MainToWorkerMessage, { kind: K }>["payload"]): void {
    if (this.closed) return;
    const message = { protocolVersion: STARK_RIFT_PROTOCOL_VERSION, messageId: ++this.id, kind, payload };
    const parsed = validateMainToWorkerMessage(message);
    if (!parsed.ok) throw new TypeError(JSON.stringify(parsed.issues));
    if (kind === "init") { this.initializing = true; this.awaitingSince = performance.now(); }
    try { this.port.postMessage(parsed.value); } catch { this.fail("WORKER_SEND_FAILED"); }
  }
  /** Called by the visible session's heartbeat timer. A response, even while paused, proves liveness. */
  checkHealth(now = performance.now()): void {
    if (this.closed) return;
    if (this.awaitingSince !== null) {
      if (now - this.awaitingSince >= 2500) this.fail("WORKER_TIMEOUT");
      return;
    }
    if (this.ready) { this.awaitingSince = now; this.send("debugMetrics", { windowTicks: 20 }); }
    else if (this.initializing) this.awaitingSince = now;
  }
  suspendHealthCheck(): void { this.awaitingSince = null; }
  dispose(): void {
    if (this.closed) return;
    try { this.send("dispose", {}); }
    finally { if (!this.closed) { this.closed = true; this.detach(); } }
  }
}
export function openSimulationClient(receive: (message: WorkerToMainMessage) => void): SimulationClient {
  if (typeof Worker === "undefined") throw new Error("이 브라우저에서는 경기 실행을 지원하지 않습니다.");
  return new SimulationClient(new Worker(new URL("./simulation.worker.ts", import.meta.url), { type: "module" }), receive);
}
