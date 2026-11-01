// 스타즈워 텍스처 공장. 그림 파일 없이 PixiJS Graphics와 Canvas 2D로 그려 텍스처로 굽는다.
// 외부 그림이 생기면 같은 키의 텍스처를 StwTextureSet에 넣어 바꿔 끼우면 된다.
import type { Container, Graphics, Renderer, Texture } from "pixi.js";
import { STW_LANE_LENGTH, STW_LANE_WIDTH, STW_LAYOUT } from "./starswar-data.js";
import type { StwBuildingType, StwSide, StwUnitType } from "./starswar-types";

type PixiModule = typeof import("pixi.js");

/** 텍스처 논리 픽셀 16 = 전장 1칸. */
export const STW_PX = 16;

export const STW_TEAM = {
  player: { glow: 0x4fc3ff, deep: 0x1f5f9e, light: 0xc9ecff },
  enemy: { glow: 0xff6a4d, deep: 0x8a2a1a, light: 0xffd2c4 },
} as const;

const GOLD = 0xd8b25a;
const GOLD_DARK = 0x8f6a26;
const GOLD_LIGHT = 0xf3dc98;
const INK = 0x2a2016;

export type StwTextureSet = {
  units: Record<StwSide, Record<StwUnitType, Texture>>;
  buildings: Record<StwSide, Record<StwBuildingType, Texture>>;
  minerals: Texture;
  geyser: Texture;
  terrain: Texture;
  soft: Texture;
  spark: Texture;
  shadow: Texture;
  ring: Texture;
  scorch: Texture;
  rubble: Texture;
  flag: Record<StwSide, Texture>;
};

function pad(g: Graphics, half: number) {
  g.rect(-half, -half, half * 2, half * 2).fill({ color: 0x000000, alpha: 0.001 });
}

function zealot(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 28);
  for (const y of [-10, 10]) {
    g.poly([6, y - 2, 25, y - 0.5, 25, y + 0.5, 6, y + 2]).fill({ color: team.glow, alpha: 0.95 });
    g.poly([6, y - 4, 22, y, 6, y + 4]).fill({ color: team.light, alpha: 0.35 });
    g.circle(5, y, 3.2).fill(GOLD).stroke({ width: 1, color: GOLD_DARK });
  }
  g.ellipse(-2, 0, 9, 14).fill(GOLD).stroke({ width: 1.8, color: GOLD_DARK });
  g.ellipse(-4, -9, 5, 5).fill(GOLD_LIGHT).stroke({ width: 1, color: GOLD_DARK });
  g.ellipse(-4, 9, 5, 5).fill(GOLD_LIGHT).stroke({ width: 1, color: GOLD_DARK });
  g.rect(-9, -2, 10, 4).fill(team.deep);
  g.circle(1, 0, 5.6).fill(0x3c2f22).stroke({ width: 1.2, color: INK });
  g.rect(3, -2.8, 2.4, 5.6).fill(team.glow);
  return g;
}

function dragoon(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 30);
  for (const [x, y] of [[16, 15], [16, -15], [-14, 17], [-14, -17]]) {
    g.moveTo(0, 0).lineTo(x * 0.55, y * 0.75).lineTo(x, y).stroke({ width: 3.4, color: GOLD_DARK, cap: "round", join: "round" });
    g.moveTo(0, 0).lineTo(x * 0.55, y * 0.75).lineTo(x, y).stroke({ width: 1.6, color: GOLD_LIGHT, cap: "round", join: "round" });
    g.circle(x, y, 2.4).fill(GOLD_DARK);
  }
  g.circle(0, 0, 12.5).fill(GOLD).stroke({ width: 2, color: GOLD_DARK });
  g.circle(-2, -2, 8.5).fill({ color: GOLD_LIGHT, alpha: 0.55 });
  g.roundRect(8, -4, 9, 8, 3).fill(0x4a3a22).stroke({ width: 1, color: INK });
  g.circle(2, 0, 6).fill(team.deep).stroke({ width: 1.4, color: INK });
  g.circle(2, 0, 4).fill(team.glow);
  g.circle(1, -1.5, 1.5).fill({ color: 0xffffff, alpha: 0.8 });
  return g;
}

function templar(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 24);
  g.circle(-2, 0, 11).fill(0x56406a).stroke({ width: 1.6, color: 0x2a1d36 });
  g.poly([-12, -6, -18, 0, -12, 6]).fill(0x43305a);
  g.ellipse(-2, -9, 5, 3.4).fill(GOLD).stroke({ width: 1, color: GOLD_DARK });
  g.ellipse(-2, 9, 5, 3.4).fill(GOLD).stroke({ width: 1, color: GOLD_DARK });
  g.circle(0, 0, 5.2).fill(0x2a2032).stroke({ width: 1, color: INK });
  for (const y of [-6, 6]) {
    g.circle(9, y, 4).fill({ color: team.glow, alpha: 0.35 });
    g.circle(9, y, 2.2).fill(team.light);
  }
  return g;
}

function probe(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 14);
  g.poly([10, 0, 0, 7, -8, 0, 0, -7]).fill(GOLD).stroke({ width: 1.4, color: GOLD_DARK });
  g.poly([10, 0, 2, 3, 2, -3]).fill(GOLD_LIGHT);
  g.circle(1, 0, 2.6).fill(team.glow);
  for (const y of [-5, 5]) g.moveTo(-4, y).lineTo(-9, y * 1.7).stroke({ width: 1.4, color: GOLD_DARK });
  return g;
}

function crystal(g: Graphics, x: number, y: number, w: number, h: number, color: number, light: number) {
  g.poly([x, y - h, x + w, y, x, y + h * 0.55, x - w, y]).fill(color).stroke({ width: 1.2, color: 0x10233a, alpha: 0.6 });
  g.poly([x, y - h, x + w * 0.35, y - h * 0.1, x - w * 0.2, y]).fill({ color: light, alpha: 0.8 });
}

function nexus(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  const oct = (r: number) => Array.from({ length: 8 }, (_, i) => [Math.cos((Math.PI / 4) * i + Math.PI / 8) * r, Math.sin((Math.PI / 4) * i + Math.PI / 8) * r]).flat();
  g.poly(oct(64)).fill(GOLD_DARK).stroke({ width: 3, color: INK });
  g.poly(oct(58)).fill(GOLD);
  g.poly(oct(44)).fill(0x9c7a35).stroke({ width: 2, color: GOLD_DARK });
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI / 4) * i + Math.PI / 8;
    g.poly([Math.cos(a) * 46, Math.sin(a) * 46, Math.cos(a + 0.18) * 60, Math.sin(a + 0.18) * 60, Math.cos(a - 0.18) * 60, Math.sin(a - 0.18) * 60]).fill(GOLD_LIGHT);
  }
  g.circle(0, 0, 30).fill({ color: team.glow, alpha: 0.18 });
  g.poly([0, -26, 22, 0, 0, 26, -22, 0]).fill(team.deep).stroke({ width: 2, color: INK });
  g.poly([0, -20, 16, 0, 0, 20, -16, 0]).fill(team.glow);
  g.poly([0, -20, 6, -4, -8, 0]).fill({ color: 0xffffff, alpha: 0.7 });
  return g;
}

function pylon(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.roundRect(-22, -22, 44, 44, 8).fill(GOLD_DARK).stroke({ width: 2, color: INK });
  g.roundRect(-18, -18, 36, 36, 6).fill(GOLD);
  for (const [x, y] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) g.circle(x, y, 3).fill(GOLD_LIGHT);
  g.circle(0, 0, 18).fill({ color: team.glow, alpha: 0.2 });
  crystal(g, 0, 4, 12, 24, team.glow, 0xffffff);
  return g;
}

function gateway(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.roundRect(-38, -32, 76, 64, 10).fill(GOLD_DARK).stroke({ width: 2.5, color: INK });
  g.roundRect(-34, -28, 68, 56, 8).fill(GOLD);
  g.roundRect(-30, -24, 14, 48, 5).fill(GOLD_LIGHT).stroke({ width: 1.5, color: GOLD_DARK });
  g.roundRect(16, -24, 14, 48, 5).fill(GOLD_LIGHT).stroke({ width: 1.5, color: GOLD_DARK });
  g.roundRect(-14, -20, 28, 40, 6).fill(0x2a2030);
  g.rect(-12, -2, 24, 4).fill(team.glow);
  g.rect(-12, -16, 24, 2).fill({ color: team.glow, alpha: 0.6 });
  g.rect(-12, 14, 24, 2).fill({ color: team.glow, alpha: 0.6 });
  return g;
}

function assimilator(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.circle(0, 0, 33).fill(0x2f3a2a).stroke({ width: 2, color: INK });
  g.circle(0, 0, 27).fill(GOLD_DARK);
  g.circle(0, 0, 22).fill(GOLD).stroke({ width: 1.5, color: GOLD_DARK });
  for (let i = 0; i < 4; i += 1) {
    const a = (Math.PI / 2) * i + Math.PI / 4;
    g.circle(Math.cos(a) * 15, Math.sin(a) * 15, 4.5).fill(0x5bd16b).stroke({ width: 1, color: 0x1f4d24 });
  }
  g.circle(0, 0, 7).fill(team.glow);
  return g;
}

function core(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.roundRect(-36, -36, 72, 72, 12).fill(GOLD_DARK).stroke({ width: 2.5, color: INK });
  g.roundRect(-31, -31, 62, 62, 10).fill(GOLD);
  g.circle(0, 0, 22).fill(0x3a2c1c).stroke({ width: 2, color: GOLD_DARK });
  g.circle(0, 0, 15).fill({ color: team.glow, alpha: 0.35 });
  g.circle(0, 0, 9).fill(team.glow);
  for (const [x, y] of [[-24, -24], [24, -24], [-24, 24], [24, 24]]) g.poly([x, y - 6, x + 6, y, x, y + 6, x - 6, y]).fill(GOLD_LIGHT);
  return g;
}

function forge(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.roundRect(-36, -30, 72, 60, 10).fill(GOLD_DARK).stroke({ width: 2.5, color: INK });
  g.roundRect(-32, -26, 64, 52, 8).fill(GOLD);
  g.circle(-8, 0, 15).fill(0x3a1d10).stroke({ width: 2, color: GOLD_DARK });
  g.circle(-8, 0, 9).fill(0xff9a3c);
  g.circle(-8, 0, 4).fill(0xffe2a0);
  g.roundRect(12, -18, 14, 36, 4).fill(GOLD_LIGHT).stroke({ width: 1.2, color: GOLD_DARK });
  g.rect(14, -2, 10, 4).fill(team.glow);
  return g;
}

function cannon(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  const oct = (r: number) => Array.from({ length: 8 }, (_, i) => [Math.cos((Math.PI / 4) * i + Math.PI / 8) * r, Math.sin((Math.PI / 4) * i + Math.PI / 8) * r]).flat();
  g.poly(oct(26)).fill(GOLD_DARK).stroke({ width: 2, color: INK });
  g.poly(oct(21)).fill(GOLD);
  for (let i = 0; i < 4; i += 1) {
    const a = (Math.PI / 2) * i;
    g.poly([Math.cos(a) * 12, Math.sin(a) * 12, Math.cos(a + 0.4) * 22, Math.sin(a + 0.4) * 22, Math.cos(a - 0.4) * 22, Math.sin(a - 0.4) * 22]).fill(GOLD_LIGHT);
  }
  g.circle(0, 0, 11).fill(team.deep).stroke({ width: 1.5, color: INK });
  g.circle(0, 0, 7.5).fill(team.glow);
  g.circle(-2.5, -2.5, 2.5).fill({ color: 0xffffff, alpha: 0.8 });
  return g;
}

function citadel(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.circle(0, 0, 34).fill(GOLD_DARK).stroke({ width: 2.5, color: INK });
  g.circle(0, 0, 29).fill(GOLD);
  g.circle(0, 0, 20).fill(GOLD_LIGHT).stroke({ width: 1.5, color: GOLD_DARK });
  g.circle(0, 0, 20).stroke({ width: 3, color: team.glow, alpha: 0.75 });
  g.poly([0, -14, 8, 0, 0, 14, -8, 0]).fill(team.deep).stroke({ width: 1, color: INK });
  g.poly([0, -10, 5, 0, 0, 10, -5, 0]).fill(team.glow);
  return g;
}

function archives(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.roundRect(-36, -36, 72, 72, 14).fill(GOLD_DARK).stroke({ width: 2.5, color: INK });
  g.roundRect(-31, -31, 62, 62, 12).fill(GOLD);
  for (const [x, y] of [[-22, -22], [22, -22], [-22, 22], [22, 22]]) g.circle(x, y, 6).fill(GOLD_LIGHT).stroke({ width: 1, color: GOLD_DARK });
  g.circle(0, 0, 19).fill(0x3a2450).stroke({ width: 2, color: GOLD_DARK });
  g.circle(0, 0, 13).fill({ color: 0xb98cff, alpha: 0.75 });
  g.circle(0, 0, 6).fill(team.glow);
  return g;
}

function mineralField(PIXI: PixiModule) {
  const g = new PIXI.Graphics();
  const rocks: [number, number, number][] = [[-38, 4, 1], [-24, -2, 1.2], [-10, 4, 0.95], [4, -3, 1.25], [18, 3, 1], [32, -1, 1.1], [44, 5, 0.85]];
  for (const [x, y, s] of rocks) {
    crystal(g, x, y, 7 * s, 15 * s, 0x3f8fe8, 0xd5ecff);
    crystal(g, x + 5 * s, y + 4 * s, 4.5 * s, 9 * s, 0x2f72c4, 0xbfe0ff);
  }
  return g;
}

function geyser(PIXI: PixiModule) {
  const g = new PIXI.Graphics();
  g.ellipse(0, 0, 30, 24).fill(0x3b3a33).stroke({ width: 2, color: 0x1e1d19 });
  g.ellipse(0, 0, 18, 13).fill(0x23261d);
  g.ellipse(0, 0, 10, 7).fill({ color: 0x6fe07a, alpha: 0.75 });
  return g;
}

function flag(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.moveTo(-6, 18).lineTo(-6, -18).stroke({ width: 2.5, color: 0xf1e6c8 });
  g.poly([-6, -18, 16, -11, -6, -4]).fill(team.glow).stroke({ width: 1.2, color: team.deep });
  g.ellipse(-6, 18, 8, 3).fill({ color: 0x000000, alpha: 0.35 });
  return g;
}

function rubble(PIXI: PixiModule) {
  const g = new PIXI.Graphics();
  let seed = 7;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 24; i += 1) {
    const a = rng() * Math.PI * 2;
    const r = rng() * 36;
    const s = 3 + rng() * 8;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    g.poly([x, y - s, x + s, y, x, y + s * 0.8, x - s * 0.9, y]).fill(rng() > 0.55 ? GOLD_DARK : 0x4a3f33);
  }
  return g;
}

function canvasTexture(PIXI: PixiModule, width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) paint(ctx);
  return PIXI.Texture.from(canvas);
}

function radial(PIXI: PixiModule, size: number, stops: [number, string][]) {
  return canvasTexture(PIXI, size, size, (ctx) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [at, color] of stops) gradient.addColorStop(at, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

/** 아이어의 사암 평원: 양옆 절벽, 가운데 돌길, 기지마다 황금 바닥 타일, 풀숲과 바위. */
function terrain(PIXI: PixiModule) {
  const unit = 16;
  const width = STW_LANE_WIDTH * unit;
  const height = STW_LANE_LENGTH * unit;
  return canvasTexture(PIXI, width, height, (ctx) => {
    let seed = 20261101;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const base = ctx.createLinearGradient(0, 0, width, 0);
    base.addColorStop(0, "#6e5a3c");
    base.addColorStop(0.5, "#8b7550");
    base.addColorStop(1, "#6e5a3c");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);
    const tones = ["#9a8358", "#7c6744", "#8f7a4f", "#6d5a3b", "#a38c60", "#7a7a46"];
    for (let i = 0; i < 2600; i += 1) {
      ctx.globalAlpha = 0.08 + rng() * 0.12;
      ctx.fillStyle = tones[Math.floor(rng() * tones.length)];
      const r = (0.4 + rng() * 2.2) * unit;
      ctx.beginPath();
      ctx.ellipse(rng() * width, rng() * height, r, r * (0.5 + rng() * 0.6), rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 가운데 돌길
    const road = ctx.createLinearGradient(width * 0.3, 0, width * 0.7, 0);
    road.addColorStop(0, "rgba(160, 140, 104, 0)");
    road.addColorStop(0.2, "rgba(160, 140, 104, 0.55)");
    road.addColorStop(0.8, "rgba(160, 140, 104, 0.55)");
    road.addColorStop(1, "rgba(160, 140, 104, 0)");
    ctx.fillStyle = road;
    ctx.fillRect(width * 0.3, 0, width * 0.4, height);
    for (let y = 0; y < height; y += unit * 2.2) {
      for (let x = width * 0.36; x < width * 0.64; x += unit * 2.6) {
        if (rng() < 0.35) continue;
        ctx.fillStyle = `rgba(${200 + rng() * 30}, ${180 + rng() * 25}, ${140 + rng() * 20}, 0.22)`;
        ctx.fillRect(x + rng() * 4, y + rng() * 4, unit * (1.6 + rng() * 0.8), unit * (1.2 + rng() * 0.6));
      }
    }
    // 기지 바닥 타일
    const plaza = (cx: number, cy: number, r: number) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx * unit, cy * unit, r * unit, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "rgba(196, 160, 92, 0.55)";
      ctx.fillRect((cx - r) * unit, (cy - r) * unit, r * 2 * unit, r * 2 * unit);
      ctx.strokeStyle = "rgba(90, 64, 26, 0.35)";
      ctx.lineWidth = 2;
      for (let x = cx - r; x <= cx + r; x += 3) {
        ctx.beginPath(); ctx.moveTo(x * unit, (cy - r) * unit); ctx.lineTo(x * unit, (cy + r) * unit); ctx.stroke();
      }
      for (let y = cy - r; y <= cy + r; y += 3) {
        ctx.beginPath(); ctx.moveTo((cx - r) * unit, y * unit); ctx.lineTo((cx + r) * unit, y * unit); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = "rgba(240, 214, 140, 0.45)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx * unit, cy * unit, r * unit, 0, Math.PI * 2);
      ctx.stroke();
    };
    for (const point of [STW_LAYOUT.mainNexus, STW_LAYOUT.naturalNexus]) {
      plaza(point.x, point.y, point === STW_LAYOUT.mainNexus ? 17 : 10);
      plaza(STW_LANE_WIDTH - point.x, STW_LANE_LENGTH - point.y, point === STW_LAYOUT.mainNexus ? 17 : 10);
    }
    // 중앙 제단
    ctx.strokeStyle = "rgba(240, 214, 140, 0.4)";
    ctx.lineWidth = 3;
    for (const r of [5, 8]) {
      ctx.beginPath();
      ctx.arc(20 * unit, 50 * unit, r * unit, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 풀숲과 바위(가장자리 위주)
    for (let i = 0; i < 260; i += 1) {
      const edge = rng() < 0.5 ? rng() * 7 : STW_LANE_WIDTH - rng() * 7;
      const x = (rng() < 0.75 ? edge : rng() * STW_LANE_WIDTH) * unit;
      const y = rng() * height;
      const r = (0.5 + rng() * 1.3) * unit;
      if (rng() < 0.55) {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.arc(x + 4, y + 5, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = ["#5d6b34", "#6c7a3a", "#4f5c2c"][Math.floor(rng() * 3)];
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(220, 230, 150, 0.15)";
        ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.5, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(x + 3, y + 4, r * 0.8, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rng() > 0.5 ? "#8a7e6c" : "#776c5c";
        ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r * 0.62, rng() * Math.PI, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 양옆 절벽
    for (const side of [0, 1]) {
      const gradient = ctx.createLinearGradient(side ? width : 0, 0, side ? width - unit * 3 : unit * 3, 0);
      gradient.addColorStop(0, "rgba(20, 14, 8, 0.85)");
      gradient.addColorStop(1, "rgba(20, 14, 8, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(side ? width - unit * 3 : 0, 0, unit * 3, height);
    }
  });
}

export function createStwTextures(PIXI: PixiModule, renderer: Renderer): StwTextureSet {
  const bake = (target: Graphics | Container) => {
    const texture = renderer.generateTexture({ target, resolution: 2, antialias: true });
    target.destroy({ children: true });
    return texture;
  };
  const sides: StwSide[] = ["player", "enemy"];
  const units = {} as StwTextureSet["units"];
  const buildings = {} as StwTextureSet["buildings"];
  const flags = {} as StwTextureSet["flag"];
  for (const side of sides) {
    units[side] = {
      zealot: bake(zealot(PIXI, side)),
      dragoon: bake(dragoon(PIXI, side)),
      templar: bake(templar(PIXI, side)),
      probe: bake(probe(PIXI, side)),
    };
    buildings[side] = {
      nexus: bake(nexus(PIXI, side)),
      pylon: bake(pylon(PIXI, side)),
      gateway: bake(gateway(PIXI, side)),
      assimilator: bake(assimilator(PIXI, side)),
      core: bake(core(PIXI, side)),
      forge: bake(forge(PIXI, side)),
      cannon: bake(cannon(PIXI, side)),
      citadel: bake(citadel(PIXI, side)),
      archives: bake(archives(PIXI, side)),
    };
    flags[side] = bake(flag(PIXI, side));
  }
  return {
    units,
    buildings,
    flag: flags,
    minerals: bake(mineralField(PIXI)),
    geyser: bake(geyser(PIXI)),
    rubble: bake(rubble(PIXI)),
    terrain: terrain(PIXI),
    soft: radial(PIXI, 64, [[0, "rgba(255,255,255,1)"], [0.45, "rgba(255,255,255,0.55)"], [1, "rgba(255,255,255,0)"]]),
    spark: radial(PIXI, 32, [[0, "rgba(255,255,255,1)"], [0.3, "rgba(255,255,255,0.85)"], [1, "rgba(255,255,255,0)"]]),
    shadow: radial(PIXI, 64, [[0, "rgba(0,0,0,0.5)"], [0.6, "rgba(0,0,0,0.28)"], [1, "rgba(0,0,0,0)"]]),
    scorch: radial(PIXI, 64, [[0, "rgba(20,12,6,0.8)"], [0.55, "rgba(30,20,10,0.45)"], [1, "rgba(30,20,10,0)"]]),
    ring: canvasTexture(PIXI, 64, 64, (ctx) => {
      ctx.strokeStyle = "white";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.stroke();
    }),
  };
}
