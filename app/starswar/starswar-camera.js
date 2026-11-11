// 스타드래프트 카메라: 확대 배율(1 = 전장 전체)과 화면 중심의 전장 좌표로 화면 배치를 계산한다.
import { STW_LANE_LENGTH, STW_LANE_WIDTH } from "./starswar-data.js";

export const STW_MAX_ZOOM = 4;

export function stwFitScale(width, height) {
  return Math.min(width / STW_LANE_WIDTH, height / STW_LANE_LENGTH);
}

/** 화면 폭을 채우는 확대 배율. */
export function stwFillZoom(width, height) {
  return Math.max(1, width / STW_LANE_WIDTH / stwFitScale(width, height));
}

/**
 * @param {number} width
 * @param {number} height
 * @param {{ zoom: number, cx: number, cy: number }} camera
 */
export function stwViewport(width, height, camera) {
  const zoom = Math.min(STW_MAX_ZOOM, Math.max(1, camera.zoom || 1));
  const scale = stwFitScale(width, height) * zoom;
  const visibleW = width / scale;
  const visibleH = height / scale;
  const clamp = (value, visible, size) => (visible >= size ? size / 2 : Math.min(size - visible / 2, Math.max(visible / 2, value)));
  const cx = clamp(camera.cx, visibleW, STW_LANE_WIDTH);
  const cy = clamp(camera.cy, visibleH, STW_LANE_LENGTH);
  return { width, height, scale, zoom, cx, cy, ox: width / 2 - cx * scale, oy: height / 2 - cy * scale };
}

export function stwScreenToMap(view, sx, sy) {
  return { x: (sx - view.ox) / view.scale, y: (sy - view.oy) / view.scale };
}
