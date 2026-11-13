// 조준 투영: 플레이어를 원점으로 한 구면 좌표(방위·고도)를 폰 방향과 비교해 화면 위치로 바꾼다.
// 방위는 시계 방향으로 커지는 도 단위, 고도는 위가 양수다. 런 시작 때 폰이 향한 방위를 0으로 맞춘다.

export const HORIZONTAL_FOV_DEG = 62;
export const LANTERN_CONE_DEG = 40;
export const AIM_RADIUS_DEG = 7;
export const AIM_ASSIST_RADIUS_DEG = 11;

const DEG = Math.PI / 180;

export function wrapDegrees(value) {
  const degrees = (((Number(value) || 0) + 180) % 360 + 360) % 360 - 180;
  return degrees === -180 ? 180 : degrees;
}

/**
 * W3C DeviceOrientation(alpha, beta, gamma)을 뒷면 카메라가 바라보는 방향으로 바꾼다.
 * 회전 순서 Z(alpha)·X(beta)·Y(gamma)로 기기 -Z축(뒷면 카메라)을 지구 좌표(동, 북, 위)로 돌린 뒤
 * 방위(yaw, 북 기준 시계 방향)와 고도(pitch)를 구한다. 폰을 세워 정면을 보면 pitch가 0이다.
 */
export function orientationToAim({ alpha, beta, gamma }) {
  const a = (Number(alpha) || 0) * DEG;
  const b = (Number(beta) || 0) * DEG;
  const g = (Number(gamma) || 0) * DEG;
  const east = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
  const north = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
  const up = -Math.cos(b) * Math.cos(g);
  const yaw = wrapDegrees(Math.atan2(east, north) / DEG);
  const pitch = Math.asin(Math.max(-1, Math.min(1, up))) / DEG;
  return { yaw, pitch };
}

/** 대상과 조준 방향 사이의 각도 차이(도). */
export function angularDistanceDeg(aim, target) {
  const dYaw = wrapDegrees(target.azimuth - aim.yaw) * DEG;
  const pitchA = (aim.pitch || 0) * DEG;
  const pitchT = (target.elevation || 0) * DEG;
  const cosine = Math.sin(pitchA) * Math.sin(pitchT) + Math.cos(pitchA) * Math.cos(pitchT) * Math.cos(dYaw);
  return Math.acos(Math.max(-1, Math.min(1, cosine))) / DEG;
}

export function isInsideLantern(aim, target, coneDeg = LANTERN_CONE_DEG) {
  return angularDistanceDeg(aim, target) <= coneDeg / 2;
}

/** 등롱 안에서의 선명도: 중심 1, 가장자리로 갈수록 0에 가까워진다. 밖은 0. */
export function lanternVisibility(aim, target, coneDeg = LANTERN_CONE_DEG) {
  const distance = angularDistanceDeg(aim, target);
  const half = coneDeg / 2;
  if (distance >= half) return 0;
  const edge = half * 0.65;
  if (distance <= edge) return 1;
  return 1 - (distance - edge) / (half - edge);
}

/**
 * 화면 좌표로 투영한다. 수평 화각으로 초점거리를 정하고 세로 방향에도 같은 값을 쓴다.
 * 화각을 크게 벗어나면 onScreen=false다.
 */
export function projectToScreen(aim, target, width, height, fovDeg = HORIZONTAL_FOV_DEG) {
  const dYaw = wrapDegrees(target.azimuth - aim.yaw);
  const dPitch = (target.elevation || 0) - (aim.pitch || 0);
  const focal = (width / 2) / Math.tan((fovDeg / 2) * DEG);
  const clampedYaw = Math.max(-80, Math.min(80, dYaw));
  const clampedPitch = Math.max(-80, Math.min(80, dPitch));
  const x = width / 2 + Math.tan(clampedYaw * DEG) * focal;
  const y = height / 2 - Math.tan(clampedPitch * DEG) * focal;
  const margin = 24;
  const onScreen = Math.abs(dYaw) < 80 && Math.abs(dPitch) < 80
    && x >= -margin && x <= width + margin && y >= -margin && y <= height + margin;
  const distance = Math.max(1, Number(target.distance) || 1);
  return { x, y, onScreen, dYaw, dPitch, scale: Math.min(2.2, 6 / distance) };
}

/** 화면 밖 대상의 가장자리 화살표 방향. 정면 20도 안은 화살표가 없다. */
export function edgeHint(dYaw) {
  if (Math.abs(dYaw) < 20) return null;
  return dYaw > 0 ? "right" : "left";
}
