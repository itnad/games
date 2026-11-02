import { UNITS_PER_TILE } from "../core/fixed-point";
export const ZOOM_VIEWS = [{ width: 14, height: 16 }, { width: 18, height: 20 }, { width: 24, height: 27 }] as const;
export class BattleCamera {
  centerX: number; centerY: number; zoom = 1;
  constructor(readonly mapWidth: number, readonly mapHeight: number) {
    this.centerX = mapWidth * UNITS_PER_TILE / 2; this.centerY = mapHeight * UNITS_PER_TILE / 2;
  }
  scale(width: number, height: number): number {
    const low = Math.floor(this.zoom), high = Math.ceil(this.zoom), t = this.zoom - low;
    const columns = ZOOM_VIEWS[low].width * (1 - t) + ZOOM_VIEWS[high].width * t;
    const rows = ZOOM_VIEWS[low].height * (1 - t) + ZOOM_VIEWS[high].height * t;
    return Math.max(width / columns, height / rows) / UNITS_PER_TILE;
  }
  setCenter(x: number, y: number, width: number, height: number): void {
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) throw new RangeError("Invalid camera viewport.");
    const scale = this.scale(width, height), halfW = width / scale / 2, halfH = height / scale / 2;
    const maxX = this.mapWidth * UNITS_PER_TILE, maxY = this.mapHeight * UNITS_PER_TILE;
    this.centerX = maxX <= halfW * 2 ? maxX / 2 : Math.min(maxX - halfW, Math.max(halfW, x));
    this.centerY = maxY <= halfH * 2 ? maxY / 2 : Math.min(maxY - halfH, Math.max(halfH, y));
  }
  screenToWorld(x: number, y: number, width: number, height: number) {
    const scale = this.scale(width, height);
    return { x: this.centerX + (x - width / 2) / scale, y: this.centerY + (y - height / 2) / scale };
  }
  worldToScreen(x: number, y: number, width: number, height: number) {
    const scale = this.scale(width, height);
    return { x: (x - this.centerX) * scale + width / 2, y: (y - this.centerY) * scale + height / 2 };
  }
  setZoom(value: number, width: number, height: number): void {
    if (!Number.isFinite(value)) throw new RangeError("Invalid zoom.");
    this.zoom = Math.max(0, Math.min(2, value)); this.setCenter(this.centerX, this.centerY, width, height);
  }
  bounds(width: number, height: number) {
    const a = this.screenToWorld(0, 0, width, height), b = this.screenToWorld(width, height, width, height);
    return { left: a.x, top: a.y, right: b.x, bottom: b.y };
  }
}
