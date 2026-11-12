// 런 화면 캔버스 그리기. 상태 계산은 하지 않고, 프레임 설명을 받아 그린다.
import { HORIZONTAL_FOV_DEG, LANTERN_CONE_DEG } from "./aim-projection.js";
import { DODGE_GESTURE_LABELS } from "./dodge-detector.js";

export type FrameGhost = {
  id: string;
  type: string;
  name: string;
  color: string;
  x: number;
  y: number;
  onScreen: boolean;
  dYaw: number;
  scale: number;
  visibility: number;
  status: "alive" | "purifiable";
  hp: number;
  maxHp: number;
  purifyRemaining: number | null;
};

export type FrameProjectile = {
  id: string;
  gesture: string;
  kind: string;
  x: number;
  y: number;
  onScreen: boolean;
  progress: number;
  dYaw: number;
};

export type FrameFlash = { text: string; color: string; at: number } | null;

export type Frame = {
  now: number;
  beat: number;
  beatPhase: number;
  countIn: number | null;
  ghosts: FrameGhost[];
  projectiles: FrameProjectile[];
  hint: { gesture: string; until: number } | null;
  judgment: FrameFlash;
  action: FrameFlash;
  hitFlashAt: number | null;
  paused: boolean;
};

const DEG = Math.PI / 180;

export const GESTURE_HINTS: Record<string, string> = {
  duck: "↓ 숙여!",
  left: "← 왼쪽으로!",
  right: "오른쪽으로! →",
  back: "↙ 젖혀!",
};

const GESTURE_COLORS: Record<string, string> = {
  duck: "#ffb347",
  left: "#7fd7ff",
  right: "#7fffb0",
  back: "#f3ead8",
};

export function lanternRadiusPx(width: number) {
  const focal = (width / 2) / Math.tan((HORIZONTAL_FOV_DEG / 2) * DEG);
  return focal * Math.tan((LANTERN_CONE_DEG / 2) * DEG);
}

function drawOutlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(3, size / 7);
  ctx.strokeStyle = "rgba(0,0,0,.85)";
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number, alpha: number, dim: boolean) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const flicker = 1 + Math.sin(now / 90) * 0.06;
  const r = size * 0.5 * flicker;
  const gradient = ctx.createRadialGradient(x, y + r * 0.2, r * 0.1, x, y, r);
  gradient.addColorStop(0, dim ? "#cbbfd8" : "#fff2a8");
  gradient.addColorStop(0.55, dim ? "#8e7aa8" : "#ff9a3c");
  gradient.addColorStop(1, dim ? "rgba(90,70,120,0)" : "rgba(255,90,40,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.45);
  ctx.bezierCurveTo(x + r * 1.1, y - r * 0.4, x + r * 1.05, y + r * 0.9, x, y + r);
  ctx.bezierCurveTo(x - r * 1.05, y + r * 0.9, x - r * 1.1, y - r * 0.4, x, y - r * 1.45);
  ctx.fill();
  // 눈: 매력적인 악귀는 얼굴이 있다.
  ctx.fillStyle = "#2a1408";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.28, y + r * 0.05, r * 0.11, r * 0.2, 0, 0, Math.PI * 2);
  ctx.ellipse(x + r * 0.28, y + r * 0.05, r * 0.11, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2a1408";
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.beginPath();
  ctx.arc(x, y + r * 0.35, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

function drawEgg(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number, alpha: number, dim: boolean) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const bob = Math.sin(now / 260) * size * 0.04;
  const rx = size * 0.38;
  const ry = size * 0.5;
  const gradient = ctx.createRadialGradient(x - rx * 0.4, y + bob - ry * 0.4, rx * 0.2, x, y + bob, ry);
  gradient.addColorStop(0, dim ? "#d7cfe6" : "#ffffff");
  gradient.addColorStop(1, dim ? "#7d6f99" : "#d9cdb8");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x, y + bob - ry);
  ctx.bezierCurveTo(x + rx * 1.15, y + bob - ry * 0.55, x + rx * 1.15, y + bob + ry * 0.7, x, y + bob + ry);
  ctx.bezierCurveTo(x - rx * 1.15, y + bob + ry * 0.7, x - rx * 1.15, y + bob - ry * 0.55, x, y + bob - ry);
  ctx.fill();
  // 달걀귀신은 눈코입이 없다. 볼 홍조만 남긴다.
  ctx.fillStyle = "rgba(255,140,140,.35)";
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.45, y + bob + ry * 0.15, rx * 0.2, rx * 0.12, 0, 0, Math.PI * 2);
  ctx.ellipse(x + rx * 0.45, y + bob + ry * 0.15, rx * 0.2, rx * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGhost(ctx: CanvasRenderingContext2D, ghost: FrameGhost, now: number) {
  if (!ghost.onScreen || ghost.visibility <= 0.02) return;
  const size = 64 * ghost.scale;
  const dim = ghost.status === "purifiable";
  if (dim) {
    ctx.save();
    ctx.globalAlpha = Math.max(0.35, ghost.visibility);
    ctx.strokeStyle = "#b88cff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ghost.x, ghost.y, size * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (ghost.purifyRemaining ?? 0));
    ctx.stroke();
    ctx.restore();
  }
  if (ghost.type === "egg-ghost") drawEgg(ctx, ghost.x, ghost.y, size, now, ghost.visibility, dim);
  else drawFlame(ctx, ghost.x, ghost.y, size, now, ghost.visibility, dim);
  if (ghost.status === "alive") {
    const pipWidth = 10;
    const total = ghost.maxHp;
    const startX = ghost.x - ((pipWidth + 3) * total - 3) / 2;
    for (let i = 0; i < total; i += 1) {
      ctx.save();
      ctx.globalAlpha = ghost.visibility;
      ctx.fillStyle = i < Math.ceil(ghost.hp) ? ghost.color : "rgba(255,255,255,.25)";
      ctx.fillRect(startX + i * (pipWidth + 3), ghost.y + size * 0.72, pipWidth, 4);
      ctx.restore();
    }
  } else {
    drawOutlinedText(ctx, "정화 · 첫 박에 길게", ghost.x, ghost.y + size * 0.95, 13, "#dcc8ff", Math.max(0.5, ghost.visibility));
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, projectile: FrameProjectile, now: number) {
  if (!projectile.onScreen) return;
  const radius = 9 + 34 * projectile.progress;
  const color = GESTURE_COLORS[projectile.gesture] ?? "#fff";
  ctx.save();
  ctx.globalAlpha = 0.85;
  const gradient = ctx.createRadialGradient(projectile.x, projectile.y, radius * 0.15, projectile.x, projectile.y, radius);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, radius, 0, Math.PI * 2);
  ctx.fill();
  if (projectile.kind === "rush") {
    ctx.globalAlpha = 0.6 + Math.sin(now / 60) * 0.2;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, radius * 1.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFrame(ctx: CanvasRenderingContext2D, width: number, height: number, frame: Frame) {
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  const lantern = lanternRadiusPx(width);

  for (const ghost of frame.ghosts) drawGhost(ctx, ghost, frame.now);

  // 등롱 밖은 어둡다. 카메라 밝기는 바꾸지 않고 비네트만 얹는다.
  const vignette = ctx.createRadialGradient(cx, cy, lantern * 0.55, cx, cy, Math.max(width, height) * 0.75);
  vignette.addColorStop(0, "rgba(5,4,10,0)");
  vignette.addColorStop(Math.min(0.99, lantern / (Math.max(width, height) * 0.75)), "rgba(5,4,10,.35)");
  vignette.addColorStop(1, "rgba(5,4,10,.92)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  for (const projectile of frame.projectiles) drawProjectile(ctx, projectile, frame.now);

  // 등롱 테두리: 박마다 맥동한다. 등롱은 시야이자 메트로놈이다.
  const pulse = Math.pow(1 - frame.beatPhase, 2);
  ctx.save();
  ctx.strokeStyle = `rgba(255,211,108,${0.18 + 0.55 * pulse})`;
  ctx.lineWidth = 2 + 5 * pulse;
  ctx.beginPath();
  ctx.arc(cx, cy, lantern, 0, Math.PI * 2);
  ctx.stroke();
  // 마디 안의 박 위치 4개
  const beatInBar = ((Math.floor(frame.beat) % 4) + 4) % 4;
  for (let i = 0; i < 4; i += 1) {
    const angle = -Math.PI / 2 + (i / 4) * Math.PI * 2;
    ctx.fillStyle = i === beatInBar ? "#ffd36c" : "rgba(255,255,255,.35)";
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * (lantern + 14), cy + Math.sin(angle) * (lantern + 14), i === beatInBar ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // 조준점
  ctx.strokeStyle = "rgba(255,255,255,.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy); ctx.lineTo(cx - 8, cy);
  ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 22, cy);
  ctx.moveTo(cx, cy - 22); ctx.lineTo(cx, cy - 8);
  ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + 22);
  ctx.stroke();
  ctx.restore();

  // 화면 밖 악귀 화살표
  for (const ghost of frame.ghosts) {
    if (ghost.onScreen || Math.abs(ghost.dYaw) < 20) continue;
    const right = ghost.dYaw > 0;
    const x = right ? width - 22 : 22;
    const blink = 0.55 + 0.45 * Math.sin(frame.now / 120);
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.fillStyle = ghost.status === "purifiable" ? "#b88cff" : ghost.color;
    ctx.beginPath();
    if (right) { ctx.moveTo(x + 10, cy); ctx.lineTo(x - 8, cy - 16); ctx.lineTo(x - 8, cy + 16); }
    else { ctx.moveTo(x - 10, cy); ctx.lineTo(x + 8, cy - 16); ctx.lineTo(x + 8, cy + 16); }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawOutlinedText(ctx, `${Math.round(Math.abs(ghost.dYaw))}°`, right ? x - 26 : x + 26, cy, 12, "#ffe7c9", 0.9);
  }

  // 레이더: 위가 정면. 등롱 범위를 쐐기로 그린다.
  const radarR = 26;
  const radarX = cx;
  const radarY = 86;
  ctx.save();
  ctx.fillStyle = "rgba(11,10,16,.7)";
  ctx.beginPath();
  ctx.arc(radarX, radarY, radarR + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,211,108,.18)";
  ctx.beginPath();
  ctx.moveTo(radarX, radarY);
  ctx.arc(radarX, radarY, radarR, -Math.PI / 2 - (LANTERN_CONE_DEG / 2) * DEG, -Math.PI / 2 + (LANTERN_CONE_DEG / 2) * DEG);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(radarX, radarY, radarR, 0, Math.PI * 2);
  ctx.stroke();
  for (const ghost of frame.ghosts) {
    const angle = -Math.PI / 2 + ghost.dYaw * DEG;
    ctx.fillStyle = ghost.status === "purifiable" ? "#b88cff" : ghost.color;
    ctx.beginPath();
    ctx.arc(radarX + Math.cos(angle) * radarR * 0.78, radarY + Math.sin(angle) * radarR * 0.78, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const projectile of frame.projectiles) {
    const angle = -Math.PI / 2 + projectile.dYaw * DEG;
    const reach = radarR * (0.78 - 0.6 * projectile.progress);
    ctx.fillStyle = GESTURE_COLORS[projectile.gesture] ?? "#fff";
    ctx.beginPath();
    ctx.arc(radarX + Math.cos(angle) * reach, radarY + Math.sin(angle) * reach, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 회피 안내 (1~2방에서만 글자로 보인다. 0단계는 방 1개라 항상 보인다.)
  if (frame.hint && frame.beat < frame.hint.until + 0.2) {
    const remaining = frame.hint.until - frame.beat;
    const urgency = Math.max(0, Math.min(1, 1 - remaining / 2));
    const size = 22 + 14 * urgency;
    const label = GESTURE_HINTS[frame.hint.gesture] ?? DODGE_GESTURE_LABELS[frame.hint.gesture as keyof typeof DODGE_GESTURE_LABELS] ?? "";
    drawOutlinedText(ctx, label, cx, cy + lantern + 48, size, GESTURE_COLORS[frame.hint.gesture] ?? "#fff");
  }

  // 판정·행동 글자
  for (const [flash, offsetY] of [[frame.judgment, -lantern - 40], [frame.action, lantern + 96]] as const) {
    if (!flash) continue;
    const age = frame.now - flash.at;
    if (age > 520) continue;
    const alpha = age < 80 ? 1 : 1 - (age - 80) / 440;
    drawOutlinedText(ctx, flash.text, cx, cy + offsetY - age * 0.05, 30, flash.color, Math.max(0, alpha));
  }

  // 카운트인
  if (frame.countIn !== null) {
    drawOutlinedText(ctx, String(frame.countIn), cx, cy - lantern * 0.5, 72, "#ffd36c", 0.95);
    drawOutlinedText(ctx, "박자에 맞춰 준비", cx, cy - lantern * 0.5 + 54, 15, "#ffe7c9", 0.9);
  }

  // 피격 섬광
  if (frame.hitFlashAt !== null) {
    const age = frame.now - frame.hitFlashAt;
    if (age < 500) {
      const alpha = 0.55 * (1 - age / 500);
      const flash = ctx.createRadialGradient(cx, cy, lantern * 0.4, cx, cy, Math.max(width, height) * 0.7);
      flash.addColorStop(0, "rgba(255,60,60,0)");
      flash.addColorStop(1, `rgba(255,40,40,${alpha})`);
      ctx.fillStyle = flash;
      ctx.fillRect(0, 0, width, height);
    }
  }
}
