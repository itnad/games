// 런 화면 캔버스 그리기. 상태 계산은 하지 않고, 프레임 설명을 받아 그린다.
import { HORIZONTAL_FOV_DEG } from "./aim-projection.js";
import { DODGE_GESTURE_LABELS } from "./dodge-detector.js";

export type FrameGhost = {
  id: string;
  type: string;
  sprite: string;
  name: string;
  grade: string;
  color: string;
  x: number;
  y: number;
  onScreen: boolean;
  dYaw: number;
  radarDYaw: number;
  scale: number;
  visibility: number;
  status: "alive" | "purifiable";
  hp: number;
  maxHp: number;
  purifyRemaining: number | null;
  weakPoint: { x: number; y: number } | null;
  staggered: boolean;
  hidden: boolean;
};

export type FrameProjectile = {
  id: string;
  gesture: string | null;
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
  hint: { gesture: string | null; kind: string; until: number } | null;
  showHintText: boolean;
  judgment: FrameFlash;
  action: FrameFlash;
  hitFlashAt: number | null;
  paused: boolean;
  lanternConeDeg: number;
  torch: boolean;
  curseShake: boolean;
  curseBlur: boolean;
  shieldActive: boolean;
  boss: { name: string; hp: number; maxHp: number } | null;
};

const DEG = Math.PI / 180;

export const GESTURE_HINTS: Record<string, string> = {
  duck: "↓ 숙여!",
  left: "← 왼쪽으로!",
  right: "오른쪽으로! →",
  back: "↙ 젖혀!",
  curse: "쏴서 막아!",
};

const GESTURE_COLORS: Record<string, string> = {
  duck: "#ffb347",
  left: "#7fd7ff",
  right: "#7fffb0",
  back: "#f3ead8",
  curse: "#ff8fb8",
};

export function lanternRadiusPx(width: number, coneDeg: number) {
  const focal = (width / 2) / Math.tan((HORIZONTAL_FOV_DEG / 2) * DEG);
  return focal * Math.tan((coneDeg / 2) * DEG);
}

function drawOutlinedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha = 1, maxWidth = Infinity) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth) {
    size = Math.max(12, Math.floor(size * (maxWidth / measured)));
    ctx.font = `900 ${size}px system-ui, sans-serif`;
  }
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

function eyes(ctx: CanvasRenderingContext2D, x: number, y: number, spacing: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x - spacing, y, r, r * 1.6, 0, 0, Math.PI * 2);
  ctx.ellipse(x + spacing, y, r, r * 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number, dim: boolean) {
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
  eyes(ctx, x, y + r * 0.05, r * 0.28, r * 0.11, "#2a1408");
  ctx.strokeStyle = "#2a1408";
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.beginPath();
  ctx.arc(x, y + r * 0.35, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

function drawEgg(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number, dim: boolean) {
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
  ctx.fillStyle = "rgba(255,140,140,.35)";
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.45, y + bob + ry * 0.15, rx * 0.2, rx * 0.12, 0, 0, Math.PI * 2);
  ctx.ellipse(x + rx * 0.45, y + bob + ry * 0.15, rx * 0.2, rx * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number, dim: boolean, visibility: number) {
  // 그슨대: 어두울수록(등롱 가장자리일수록) 커진다.
  const grow = 1 + (1 - visibility) * 0.6;
  const w = size * 0.42 * grow;
  const h = size * 0.95 * grow;
  const sway = Math.sin(now / 400) * w * 0.1;
  const gradient = ctx.createLinearGradient(x, y - h, x, y + h * 0.6);
  gradient.addColorStop(0, dim ? "#8e7aa8" : "#3a2f55");
  gradient.addColorStop(1, dim ? "rgba(140,120,170,0)" : "rgba(20,14,36,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x + sway, y - h);
  ctx.bezierCurveTo(x + w * 1.4, y - h * 0.3, x + w * 1.2, y + h * 0.5, x, y + h * 0.6);
  ctx.bezierCurveTo(x - w * 1.2, y + h * 0.5, x - w * 1.4, y - h * 0.3, x + sway, y - h);
  ctx.fill();
  eyes(ctx, x + sway * 0.5, y - h * 0.45, w * 0.3, w * 0.12, dim ? "#dcd3ee" : "#c9b8ff");
}

function drawShimmer(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number, dim: boolean) {
  // 어둑시니: 곁눈으로만 보이는 아른거림.
  const r = size * 0.45;
  ctx.strokeStyle = dim ? "#cbbfd8" : "#9df0e6";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -now / 40;
  ctx.beginPath();
  for (let i = 0; i <= 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2;
    const wobble = 1 + Math.sin(angle * 3 + now / 150) * 0.12;
    const px = x + Math.cos(angle) * r * 0.8 * wobble;
    const py = y + Math.sin(angle) * r * 1.1 * wobble;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = dim ? "rgba(203,191,216,.25)" : "rgba(111,211,199,.22)";
  ctx.fill();
  eyes(ctx, x, y - r * 0.1, r * 0.3, r * 0.08, dim ? "#ffffff" : "#e8fffb");
}

function drawBride(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number, dim: boolean) {
  // 손말명: 긴 머리에 흰 옷. 저주를 거는 처녀귀신.
  const h = size;
  const sway = Math.sin(now / 500) * size * 0.03;
  ctx.fillStyle = dim ? "#9a8ab8" : "#f7eef2";
  ctx.beginPath();
  ctx.moveTo(x - h * 0.16, y - h * 0.2);
  ctx.lineTo(x + h * 0.16, y - h * 0.2);
  ctx.lineTo(x + h * 0.34 + sway, y + h * 0.5);
  ctx.lineTo(x - h * 0.34 + sway, y + h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dim ? "#c9bedb" : "#fbe7e0";
  ctx.beginPath();
  ctx.arc(x, y - h * 0.3, h * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dim ? "#4a3f63" : "#161018";
  ctx.beginPath();
  ctx.moveTo(x - h * 0.17, y - h * 0.36);
  ctx.bezierCurveTo(x - h * 0.05, y - h * 0.52, x + h * 0.05, y - h * 0.52, x + h * 0.17, y - h * 0.36);
  ctx.lineTo(x + h * 0.2 + sway, y + h * 0.3);
  ctx.lineTo(x + h * 0.09, y + h * 0.1);
  ctx.lineTo(x - h * 0.09, y + h * 0.1);
  ctx.lineTo(x - h * 0.2 + sway, y + h * 0.3);
  ctx.closePath();
  ctx.fill();
  eyes(ctx, x, y - h * 0.3, h * 0.05, h * 0.018, "#3a1230");
  ctx.fillStyle = dim ? "#b08aa8" : "#ff8fb8";
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.22, h * 0.03, h * 0.015, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawScholar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number, dim: boolean) {
  // 몽달귀신: 갓을 쓴 푸른 도포.
  const h = size;
  const bob = Math.sin(now / 320) * size * 0.03;
  ctx.fillStyle = dim ? "#9a8ab8" : "#c9d7ff";
  ctx.beginPath();
  ctx.moveTo(x - h * 0.14, y - h * 0.18 + bob);
  ctx.lineTo(x + h * 0.14, y - h * 0.18 + bob);
  ctx.lineTo(x + h * 0.4, y + h * 0.5 + bob);
  ctx.lineTo(x - h * 0.4, y + h * 0.5 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = dim ? "#c9bedb" : "#eef2ff";
  ctx.beginPath();
  ctx.arc(x, y - h * 0.3 + bob, h * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dim ? "#4a3f63" : "#1a1620";
  ctx.beginPath();
  ctx.moveTo(x - h * 0.3, y - h * 0.4 + bob);
  ctx.lineTo(x + h * 0.3, y - h * 0.4 + bob);
  ctx.lineTo(x + h * 0.2, y - h * 0.44 + bob);
  ctx.lineTo(x + h * 0.11, y - h * 0.66 + bob);
  ctx.lineTo(x - h * 0.11, y - h * 0.66 + bob);
  ctx.lineTo(x - h * 0.2, y - h * 0.44 + bob);
  ctx.closePath();
  ctx.fill();
  eyes(ctx, x, y - h * 0.3 + bob, h * 0.05, h * 0.018, "#1a2a5a");
}

function drawDrowned(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number, dim: boolean) {
  // 물귀신: 물방울 몸과 물결.
  const r = size * 0.45;
  const gradient = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
  gradient.addColorStop(0, dim ? "#c9bedb" : "#bfe4ff");
  gradient.addColorStop(1, dim ? "#6e5f8e" : "#2f78c7");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.3);
  ctx.bezierCurveTo(x + r * 1.2, y - r * 0.1, x + r * 0.9, y + r, x, y + r);
  ctx.bezierCurveTo(x - r * 0.9, y + r, x - r * 1.2, y - r * 0.1, x, y - r * 1.3);
  ctx.fill();
  eyes(ctx, x, y - r * 0.1, r * 0.3, r * 0.1, "#0b2a55");
  ctx.strokeStyle = dim ? "rgba(201,190,219,.5)" : "rgba(160,220,255,.6)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i += 1) {
    const phase = ((now / 700) + i * 0.5) % 1;
    ctx.globalAlpha = (1 - phase) * 0.8;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 1.1, r * (0.5 + phase * 1.2), r * (0.15 + phase * 0.35), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawTiger(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number, dim: boolean) {
  // 장산범: 흰 털에 줄무늬. 보스답게 크다.
  const r = size * 0.5;
  const breathe = 1 + Math.sin(now / 420) * 0.03;
  ctx.strokeStyle = dim ? "rgba(201,190,219,.6)" : "rgba(255,255,255,.7)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i += 1) {
    const angle = (i / 14) * Math.PI * 2 + now / 2000;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * r * 0.9, y + Math.sin(angle) * r * 0.9);
    ctx.lineTo(x + Math.cos(angle) * r * 1.35 * breathe, y + Math.sin(angle) * r * 1.35 * breathe);
    ctx.stroke();
  }
  ctx.fillStyle = dim ? "#c9bedb" : "#fff6e2";
  ctx.beginPath();
  ctx.arc(x, y, r * breathe, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.9, y - r * 0.5); ctx.lineTo(x - r * 0.6, y - r * 1.2); ctx.lineTo(x - r * 0.25, y - r * 0.85);
  ctx.moveTo(x + r * 0.9, y - r * 0.5); ctx.lineTo(x + r * 0.6, y - r * 1.2); ctx.lineTo(x + r * 0.25, y - r * 0.85);
  ctx.fill();
  ctx.strokeStyle = dim ? "#6e5f8e" : "#3b2a12";
  ctx.lineWidth = Math.max(2, r * 0.09);
  for (const [sx, dir] of [[-1, 1], [1, -1]] as const) {
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + sx * r * (0.35 + i * 0.2), y - r * 0.65);
      ctx.quadraticCurveTo(x + sx * r * (0.6 + i * 0.2), y - r * 0.2, x + sx * r * (0.3 + i * 0.22) + dir * 0, y + r * 0.25);
      ctx.stroke();
    }
  }
  eyes(ctx, x, y - r * 0.05, r * 0.32, r * 0.11, dim ? "#4a3f63" : "#ffd36c");
  ctx.fillStyle = dim ? "#4a3f63" : "#3b2a12";
  ctx.beginPath();
  ctx.moveTo(x - r * 0.12, y + r * 0.3); ctx.lineTo(x + r * 0.12, y + r * 0.3); ctx.lineTo(x, y + r * 0.45);
  ctx.closePath();
  ctx.fill();
}

function drawGhost(ctx: CanvasRenderingContext2D, ghost: FrameGhost, now: number) {
  if (!ghost.onScreen || ghost.visibility <= 0.02) return;
  const size = (ghost.grade === "지박령" ? 110 : ghost.grade === "원귀" ? 78 : 64) * ghost.scale;
  const dim = ghost.status === "purifiable";
  ctx.save();
  ctx.globalAlpha = ghost.visibility;
  if (dim) {
    ctx.strokeStyle = "#b88cff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ghost.x, ghost.y, size * 0.75, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (ghost.purifyRemaining ?? 0));
    ctx.stroke();
  }
  if (ghost.staggered) {
    ctx.strokeStyle = "rgba(255,255,255,.7)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const angle = now / 150 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(ghost.x + Math.cos(angle) * size * 0.55, ghost.y - size * 0.6 + Math.sin(angle) * size * 0.12, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  switch (ghost.sprite) {
    case "egg": drawEgg(ctx, ghost.x, ghost.y, size, now, dim); break;
    case "shadow": drawShadow(ctx, ghost.x, ghost.y, size, now, dim, ghost.visibility); break;
    case "shimmer": drawShimmer(ctx, ghost.x, ghost.y, size, now, dim); break;
    case "bride": drawBride(ctx, ghost.x, ghost.y, size, now, dim); break;
    case "scholar": drawScholar(ctx, ghost.x, ghost.y, size, now, dim); break;
    case "drowned": drawDrowned(ctx, ghost.x, ghost.y, size, now, dim); break;
    case "tiger": drawTiger(ctx, ghost.x, ghost.y, size, now, dim); break;
    default: drawFlame(ctx, ghost.x, ghost.y, size, now, dim);
  }
  ctx.restore();
  if (ghost.status === "alive") {
    if (ghost.grade !== "지박령") {
      const pipWidth = 10;
      const total = ghost.maxHp;
      const startX = ghost.x - ((pipWidth + 3) * total - 3) / 2;
      ctx.save();
      ctx.globalAlpha = ghost.visibility;
      for (let i = 0; i < total; i += 1) {
        ctx.fillStyle = i < Math.ceil(ghost.hp) ? ghost.color : "rgba(255,255,255,.25)";
        ctx.fillRect(startX + i * (pipWidth + 3), ghost.y + size * 0.72, pipWidth, 4);
      }
      ctx.restore();
    }
    if (ghost.weakPoint) {
      ctx.save();
      ctx.globalAlpha = ghost.visibility * (0.6 + 0.4 * Math.sin(now / 120));
      ctx.strokeStyle = "#ffd36c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ghost.weakPoint.x, ghost.weakPoint.y, 9, 0, Math.PI * 2);
      ctx.moveTo(ghost.weakPoint.x - 14, ghost.weakPoint.y); ctx.lineTo(ghost.weakPoint.x - 5, ghost.weakPoint.y);
      ctx.moveTo(ghost.weakPoint.x + 5, ghost.weakPoint.y); ctx.lineTo(ghost.weakPoint.x + 14, ghost.weakPoint.y);
      ctx.stroke();
      ctx.restore();
    }
  } else {
    drawOutlinedText(ctx, "정화 · 첫 박에 길게", ghost.x, ghost.y + size * 0.95, 13, "#dcc8ff", Math.max(0.5, ghost.visibility));
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, projectile: FrameProjectile, now: number) {
  if (!projectile.onScreen) return;
  const radius = 9 + 34 * projectile.progress;
  const key = projectile.kind === "curse" ? "curse" : projectile.gesture ?? "back";
  const color = GESTURE_COLORS[key] ?? "#fff";
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
  if (projectile.kind === "rush" || projectile.kind === "curse") {
    ctx.globalAlpha = 0.6 + Math.sin(now / 60) * 0.2;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(projectile.kind === "curse" ? [4, 4] : []);
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
  const lantern = lanternRadiusPx(width, frame.lanternConeDeg + (frame.torch ? 40 : 0));

  ctx.save();
  if (frame.curseShake) ctx.translate(Math.sin(frame.now / 23) * 7, Math.cos(frame.now / 31) * 5);

  for (const ghost of frame.ghosts) drawGhost(ctx, ghost, frame.now);

  // 등롱 밖은 어둡다. 카메라 밝기는 바꾸지 않고 비네트만 얹는다. 저주에 걸리면 더 좁고 어둡다.
  const outer = Math.max(width, height) * 0.75;
  const inner = frame.curseBlur ? lantern * 0.35 : lantern * 0.55;
  const vignette = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  vignette.addColorStop(0, "rgba(5,4,10,0)");
  vignette.addColorStop(Math.min(0.99, lantern / outer), frame.torch ? "rgba(5,4,10,.12)" : frame.curseBlur ? "rgba(20,4,30,.6)" : "rgba(5,4,10,.35)");
  vignette.addColorStop(1, frame.torch ? "rgba(5,4,10,.55)" : "rgba(5,4,10,.92)");
  ctx.fillStyle = vignette;
  ctx.fillRect(-20, -20, width + 40, height + 40);

  for (const projectile of frame.projectiles) drawProjectile(ctx, projectile, frame.now);

  // 등롱 테두리: 박마다 맥동한다. 등롱은 시야이자 메트로놈이다.
  const pulse = Math.pow(1 - frame.beatPhase, 2);
  ctx.strokeStyle = frame.torch ? `rgba(255,240,180,${0.3 + 0.5 * pulse})` : `rgba(255,211,108,${0.18 + 0.55 * pulse})`;
  ctx.lineWidth = 2 + 5 * pulse;
  ctx.beginPath();
  ctx.arc(cx, cy, lantern, 0, Math.PI * 2);
  ctx.stroke();
  const beatInBar = ((Math.floor(frame.beat) % 4) + 4) % 4;
  for (let i = 0; i < 4; i += 1) {
    const angle = -Math.PI / 2 + (i / 4) * Math.PI * 2;
    ctx.fillStyle = i === beatInBar ? "#ffd36c" : "rgba(255,255,255,.35)";
    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * (lantern + 14), cy + Math.sin(angle) * (lantern + 14), i === beatInBar ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (frame.shieldActive) {
    ctx.strokeStyle = "rgba(160,220,255,.9)";
    ctx.lineWidth = 6;
    ctx.setLineDash([14, 8]);
    ctx.lineDashOffset = -frame.now / 10;
    ctx.beginPath();
    ctx.arc(cx, cy, lantern * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
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
    if (ghost.onScreen || Math.abs(ghost.radarDYaw) < 20) continue;
    const right = ghost.radarDYaw > 0;
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
    drawOutlinedText(ctx, `${Math.round(Math.abs(ghost.radarDYaw))}°`, right ? x - 26 : x + 26, cy, 12, "#ffe7c9", 0.9);
  }

  // 레이더: 위가 정면. 등롱 범위를 쐐기로 그린다.
  const radarR = 26;
  const radarX = cx;
  const radarY = frame.boss ? 104 : 86;
  ctx.save();
  ctx.fillStyle = "rgba(11,10,16,.7)";
  ctx.beginPath();
  ctx.arc(radarX, radarY, radarR + 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,211,108,.18)";
  ctx.beginPath();
  ctx.moveTo(radarX, radarY);
  ctx.arc(radarX, radarY, radarR, -Math.PI / 2 - (frame.lanternConeDeg / 2) * DEG, -Math.PI / 2 + (frame.lanternConeDeg / 2) * DEG);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(radarX, radarY, radarR, 0, Math.PI * 2);
  ctx.stroke();
  for (const ghost of frame.ghosts) {
    const angle = -Math.PI / 2 + ghost.radarDYaw * DEG;
    ctx.fillStyle = ghost.status === "purifiable" ? "#b88cff" : ghost.color;
    ctx.beginPath();
    ctx.arc(radarX + Math.cos(angle) * radarR * 0.78, radarY + Math.sin(angle) * radarR * 0.78, ghost.grade === "지박령" ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const projectile of frame.projectiles) {
    const angle = -Math.PI / 2 + projectile.dYaw * DEG;
    const reach = radarR * (0.78 - 0.6 * projectile.progress);
    ctx.fillStyle = GESTURE_COLORS[projectile.kind === "curse" ? "curse" : projectile.gesture ?? "back"] ?? "#fff";
    ctx.beginPath();
    ctx.arc(radarX + Math.cos(angle) * reach, radarY + Math.sin(angle) * reach, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 회피 안내. 초반 방에서만 글자로, 이후에는 색과 소리로만.
  if (frame.hint && frame.beat < frame.hint.until + 0.2) {
    const key = frame.hint.kind === "curse" ? "curse" : frame.hint.gesture ?? "back";
    const remaining = frame.hint.until - frame.beat;
    const urgency = Math.max(0, Math.min(1, 1 - remaining / 2));
    const color = GESTURE_COLORS[key] ?? "#fff";
    if (frame.showHintText) {
      const size = 22 + 14 * urgency;
      const label = GESTURE_HINTS[key] ?? DODGE_GESTURE_LABELS[key as keyof typeof DODGE_GESTURE_LABELS] ?? "";
      drawOutlinedText(ctx, label, cx, cy + lantern + 48, size, color, 1, width - 32);
    } else {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.5 * urgency;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy + lantern + 44, 7 + 8 * urgency, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 판정·행동 글자
  for (const [flash, offsetY] of [[frame.judgment, -lantern - 40], [frame.action, lantern + 96]] as const) {
    if (!flash) continue;
    const age = frame.now - flash.at;
    if (age > 520) continue;
    const alpha = age < 80 ? 1 : 1 - (age - 80) / 440;
    drawOutlinedText(ctx, flash.text, cx, cy + offsetY - age * 0.05, 30, flash.color, Math.max(0, alpha), width - 32);
  }

  // 보스 체력
  if (frame.boss) {
    const barWidth = Math.min(300, width - 90);
    const x = cx - barWidth / 2;
    const y = 62;
    ctx.save();
    ctx.fillStyle = "rgba(11,10,16,.7)";
    ctx.fillRect(x - 2, y - 2, barWidth + 4, 12);
    ctx.fillStyle = "#ffd36c";
    ctx.fillRect(x, y, barWidth * Math.max(0, frame.boss.hp / frame.boss.maxHp), 8);
    ctx.restore();
    drawOutlinedText(ctx, frame.boss.name, cx, y - 12, 13, "#ffd36c");
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
