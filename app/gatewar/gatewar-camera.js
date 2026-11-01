// 관문 전쟁 카메라: 확대 배율(1 = 전장 전체)과 화면 중심의 전장 좌표로 화면 배치를 계산한다.
import { GW_LANE_LENGTH, GW_LANE_WIDTH } from "./gatewar-data.js";

export const GW_MAX_ZOOM = 4;

export function gwFitScale(width, height) {
  return Math.min(width / GW_LANE_WIDTH, height / GW_LANE_LENGTH);
}

/** 화면 폭을 채우는 확대 배율. */
export function gwFillZoom(width, height) {
  return Math.max(1, width / GW_LANE_WIDTH / gwFitScale(width, height));
}

/**
 * @param {number} width
 * @param {number} height
 * @param {{ zoom: number, cx: number, cy: number }} camera
 */
export function gwViewport(width, height, camera) {
  const zoom = Math.min(GW_MAX_ZOOM, Math.max(1, camera.zoom || 1));
  const scale = gwFitScale(width, height) * zoom;
  const visibleW = width / scale;
  const visibleH = height / scale;
  const clamp = (value, visible, size) => (visible >= size ? size / 2 : Math.min(size - visible / 2, Math.max(visible / 2, value)));
  const cx = clamp(camera.cx, visibleW, GW_LANE_WIDTH);
  const cy = clamp(camera.cy, visibleH, GW_LANE_LENGTH);
  return { width, height, scale, zoom, cx, cy, ox: width / 2 - cx * scale, oy: height / 2 - cy * scale };
}

export function gwScreenToMap(view, sx, sy) {
  return { x: (sx - view.ox) / view.scale, y: (sy - view.oy) / view.scale };
}
