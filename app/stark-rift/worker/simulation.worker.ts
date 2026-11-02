import { SimulationRuntime } from "./runtime";
const scope = globalThis as unknown as {
  postMessage: (message: unknown, transfer: Transferable[]) => void;
  onmessage: ((event: MessageEvent) => void) | null;
  close: () => void;
};
const runtime = new SimulationRuntime({ emit: (message, transfer = []) => {
  scope.postMessage(message, transfer);
  if (message.kind === "disposed") { clearInterval(timer); scope.close(); }
} });
let last = performance.now();
const timer = setInterval(() => {
  const now = performance.now(); const elapsed = Math.max(0, Math.floor(now - last)); last += elapsed;
  runtime.advance(elapsed);
}, 50);
scope.onmessage = event => {
  const now = performance.now(); const elapsed = Math.max(0, Math.floor(now - last)); last += elapsed;
  runtime.advance(elapsed); runtime.receive(event.data);
};
