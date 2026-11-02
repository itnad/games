import type { BattleCamera } from "../render/camera";
export function attachCameraGestures(canvas: HTMLCanvasElement, camera: BattleCamera, changed: () => void): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0, pinchZoom = 1;
  const point = (event: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; };
  const dimensions = () => ({ width: canvas.clientWidth, height: canvas.clientHeight });
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, point(event));
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchDistance = Math.hypot(a.x - b.x, a.y - b.y); pinchZoom = camera.zoom; }
  };
  const move = (event: PointerEvent) => {
    const old = pointers.get(event.pointerId); if (!old) return;
    const next = point(event); pointers.set(event.pointerId, next);
    const { width, height } = dimensions();
    if (pointers.size === 1) {
      const scale = camera.scale(width, height);
      camera.setCenter(camera.centerX - (next.x - old.x) / scale, camera.centerY - (next.y - old.y) / scale, width, height);
    } else if (pointers.size === 2 && pinchDistance > 0) {
      const [a, b] = [...pointers.values()], x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      const before = camera.screenToWorld(x, y, width, height);
      camera.setZoom(pinchZoom - Math.log2(Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) / pinchDistance) * 2, width, height);
      const after = camera.screenToWorld(x, y, width, height);
      camera.setCenter(camera.centerX + before.x - after.x, camera.centerY + before.y - after.y, width, height);
    }
    changed();
  };
  const up = (event: PointerEvent) => {
    const wasPinching = pointers.size > 1;
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (wasPinching) { const { width, height } = dimensions(); camera.setZoom(Math.round(camera.zoom), width, height); pinchDistance = 0; changed(); }
  };
  canvas.addEventListener("pointerdown", down); canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up); canvas.addEventListener("lostpointercapture", up);
  return () => { canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up); canvas.removeEventListener("lostpointercapture", up); pointers.clear(); };
}
