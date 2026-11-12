import type { BattleCamera } from "../render/camera";
import { GestureMachine, type GestureCallbacks } from "./gesture-machine";
import { isPortraitViewport, subscribePortraitMode } from "./portrait-mode";
export type GestureActions = Pick<GestureCallbacks, "hitTest" | "tap" | "preview" | "group" | "swipe" | "groundTap">;
export function attachCameraGestures(canvas: HTMLCanvasElement, camera: BattleCamera, changed: () => void, actions?: GestureActions): () => void {
  const pointers = new Set<number>(); let pinchZoom = camera.zoom;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const size = () => ({ width: canvas.clientWidth, height: canvas.clientHeight });
  const machine = new GestureMachine({
    hitTest: point => actions?.hitTest(point) ?? null,
    groundTap:point=>actions?.groundTap?.(point),
    tap: hit => actions?.tap(hit), preview: hit => actions?.preview(hit),
    group: hit => actions?.group(hit), swipe: (hit, point, attack) => actions?.swipe(hit, point, attack),
    pan: (dx, dy) => { const {width, height} = size(); const scale = camera.scale(width, height); camera.setCenter(camera.centerX - dx / scale, camera.centerY - dy / scale, width, height); },
    pinch: (a, b, initial) => {
      const {width, height} = size(), x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      const before = camera.screenToWorld(x, y, width, height);
      camera.setZoom(pinchZoom - Math.log2(Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) / initial) * 2, width, height);
      const after = camera.screenToWorld(x, y, width, height);
      camera.setCenter(camera.centerX + before.x - after.x, camera.centerY + before.y - after.y, width, height);
    },
    pinchEnd: () => { const {width, height} = size(); camera.setZoom(Math.round(camera.zoom), width, height); },
  });
  const point = (event: PointerEvent) => { const r = canvas.getBoundingClientRect(); return {x: event.clientX - r.left, y: event.clientY - r.top}; };
  const down = (event: PointerEvent) => {
    if (!isPortraitViewport()) return;
    if (event.button !== 0 || pointers.size >= 2) return;
    if (pointers.size === 1) pinchZoom = camera.zoom;
    pointers.add(event.pointerId); canvas.setPointerCapture(event.pointerId);
    machine.down(event.pointerId, point(event), performance.now()); clearTimeout(timer);
    if (pointers.size === 1) timer = setTimeout(() => { machine.advance(performance.now()); changed(); }, 300);
  };
  const move = (event: PointerEvent) => { if (pointers.has(event.pointerId)) { machine.move(event.pointerId, point(event)); changed(); } };
  const up = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId); clearTimeout(timer); machine.up(event.pointerId, performance.now());
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); changed();
  };
  const cancel = () => {
    clearTimeout(timer); machine.cancel(); const ids = [...pointers]; pointers.clear();
    for (const id of ids) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    changed();
  };
  const lost = (event: PointerEvent) => { if (pointers.has(event.pointerId)) cancel(); };
  const detachOrientation = subscribePortraitMode(() => { if (!isPortraitViewport()) cancel(); });
  canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancel); canvas.addEventListener("lostpointercapture", lost);
  return () => {
    detachOrientation();
    canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", cancel); canvas.removeEventListener("lostpointercapture", lost);
    clearTimeout(timer); const ids = [...pointers]; pointers.clear(); machine.cancel();
    for (const id of ids) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  };
}
