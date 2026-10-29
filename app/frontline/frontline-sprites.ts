// 전선 지휘관 스프라이트 공장. 그림 파일 없이 PixiJS Graphics로 그린 뒤 텍스처로 굽는다.
// 외부 그림(예: Kenney 에셋)이 생기면 같은 키의 텍스처를 FrontlineTextureSet에 넣어 바꿔 끼우면 된다.
import type { Graphics, Renderer, Texture } from "pixi.js";
import { FRONTLINE_EDGES, FRONTLINE_MAP_HEIGHT, FRONTLINE_MAP_WIDTH, FRONTLINE_ZONES } from "./frontline-data.js";
import { frontlineMinePosition } from "./frontline-engine.js";
import type { FrontlineSide } from "./frontline-types";

type PixiModule = typeof import("pixi.js");

/** 텍스처 1픽셀 = 지도 1/16칸. 스프라이트는 scale 1/PX로 지도 좌표에 놓는다. */
export const SPRITE_PX = 16;

export const TEAM = {
  player: { main: 0x4aa8ff, dark: 0x163f68, light: 0xc4e3ff, trim: 0x8fd0ff },
  enemy: { main: 0xff5d4f, dark: 0x6a1d17, light: 0xffcfc7, trim: 0xffa08f },
} as const;

const STEEL = 0x7d8792;
const STEEL_DARK = 0x4a525c;
const CONCRETE = 0x5b636c;
const CONCRETE_DARK = 0x3c434b;
const TREAD = 0x25282c;
const SKIN = 0xe2b48c;

export type UnitTextureKey = "rifle" | "guard" | "tank" | "tankTurret" | "worker";
export type BuildingTextureKey = "hq" | "outpost" | "depot" | "barracks" | "factory" | "turret" | "turretGun";

export type FrontlineTextureSet = {
  units: Record<FrontlineSide, Record<UnitTextureKey, Texture>>;
  buildings: Record<FrontlineSide, Record<BuildingTextureKey, Texture>>;
  wreck: Texture;
  rubble: Texture;
  scorch: Texture;
  crystal: Texture;
  soft: Texture;
  spark: Texture;
  ring: Texture;
  shadow: Texture;
  tracer: Texture;
  shell: Texture;
  scaffold: Texture;
  terrain: Texture;
};

function bounds(g: Graphics, half: number) {
  // 회전 중심을 텍스처 가운데에 두기 위한 투명 사각형.
  g.rect(-half, -half, half * 2, half * 2).fill({ color: 0x000000, alpha: 0.001 });
}

function soldier(PIXI: PixiModule, side: FrontlineSide) {
  const team = TEAM[side];
  const g = new PIXI.Graphics();
  bounds(g, 26);
  g.roundRect(-14, -8, 9, 16, 3).fill(0x3d4636).stroke({ width: 1.5, color: 0x1f241c });
  g.ellipse(-1, 0, 9, 13).fill(team.main).stroke({ width: 2, color: team.dark });
  g.rect(-3, -12, 4, 24).fill({ color: team.dark, alpha: 0.35 });
  g.roundRect(2, 1.5, 22, 4, 1.5).fill(0x24272b);
  g.rect(19, 2, 6, 2.5).fill(0x111315);
  g.circle(7, 4.5, 2.8).fill(SKIN);
  g.circle(14, 4, 2.6).fill(SKIN);
  g.circle(1, 0, 7.2).fill(team.dark).stroke({ width: 1.5, color: 0x101418 });
  g.circle(-0.5, -2, 2.6).fill({ color: 0xffffff, alpha: 0.28 });
  return g;
}

function guard(PIXI: PixiModule, side: FrontlineSide) {
  const team = TEAM[side];
  const g = new PIXI.Graphics();
  bounds(g, 30);
  g.ellipse(-2, 0, 11, 16).fill(team.main).stroke({ width: 2, color: team.dark });
  g.circle(6, -11, 3).fill(SKIN);
  g.roundRect(-4, 9, 18, 4, 1.5).fill(0x3a3027);
  g.roundRect(9, -18, 8, 36, 3).fill(STEEL).stroke({ width: 2, color: STEEL_DARK });
  g.rect(11.5, -15, 3, 30).fill(team.main);
  g.circle(13, 0, 3.4).fill(team.light).stroke({ width: 1, color: team.dark });
  g.circle(-1, 0, 8).fill(STEEL).stroke({ width: 1.5, color: STEEL_DARK });
  g.rect(-8, -1.2, 14, 2.4).fill(team.main);
  g.circle(-3, -2.5, 2.6).fill({ color: 0xffffff, alpha: 0.3 });
  return g;
}

function tankHull(PIXI: PixiModule, side: FrontlineSide) {
  const team = TEAM[side];
  const g = new PIXI.Graphics();
  bounds(g, 40);
  for (const y of [-29, 17]) {
    g.roundRect(-37, y, 74, 12, 4).fill(TREAD);
    for (let x = -34; x < 36; x += 6) g.rect(x, y + 1.5, 2.2, 9).fill(0x3e4248);
  }
  g.roundRect(-34, -20, 68, 40, 7).fill(team.dark).stroke({ width: 2, color: 0x0f1216 });
  g.roundRect(-27, -15, 52, 30, 6).fill(team.main);
  g.rect(-27, -15, 52, 6).fill({ color: 0xffffff, alpha: 0.12 });
  for (let i = 0; i < 4; i += 1) g.rect(-31 + i * 3.4, -10, 1.6, 20).fill({ color: 0x000000, alpha: 0.35 });
  g.roundRect(26, -14, 6, 28, 2).fill(team.dark);
  return g;
}

function tankTurret(PIXI: PixiModule, side: FrontlineSide) {
  const team = TEAM[side];
  const g = new PIXI.Graphics();
  bounds(g, 48);
  g.roundRect(8, -3.8, 34, 7.6, 2).fill(0x3a3f45).stroke({ width: 1.2, color: 0x16191c });
  g.roundRect(40, -5.5, 7, 11, 2).fill(0x23272b);
  g.circle(0, 0, 14).fill(team.main).stroke({ width: 2.2, color: team.dark });
  g.circle(-4, 3, 4.2).fill(team.dark);
  g.circle(-2, -4, 3).fill({ color: 0xffffff, alpha: 0.25 });
  return g;
}

function worker(PIXI: PixiModule, side: FrontlineSide) {
  const team = TEAM[side];
  const g = new PIXI.Graphics();
  bounds(g, 12);
  g.ellipse(0, 0, 5.5, 7).fill(0xe0a33a).stroke({ width: 1.2, color: 0x6a4a12 });
  g.rect(-1.5, -7, 3, 14).fill(team.main);
  g.circle(1, 0, 3.8).fill(0xf6d04d).stroke({ width: 1, color: 0x7a5c10 });
  return g;
}

function hq(PIXI: PixiModule, side: FrontlineSide) {
  const team = TEAM[side];
  const g = new PIXI.Graphics();
  const h = 56;
  g.roundRect(-h, -h, h * 2, h * 2, 16).fill(CONCRETE_DARK).stroke({ width: 4, color: team.main });
  g.roundRect(-h + 8, -h + 8, h * 2 - 16, h * 2 - 16, 12).fill(CONCRETE);
  for (const [x, y] of [[-40, -40], [40, -40], [-40, 40], [40, 40]]) {
    g.roundRect(x - 9, y - 9, 18, 18, 4).fill(0x464e57).stroke({ width: 2, color: 0x2a3036 });
    g.circle(x, y, 4).fill(team.main);
  }
  g.rect(-h + 8, -6, h * 2 - 16, 12).fill({ color: team.main, alpha: 0.85 });
  g.rect(-6, -h + 8, 12, h * 2 - 16).fill({ color: team.main, alpha: 0.85 });
  g.circle(0, 0, 25).fill(0x2c3238).stroke({ width: 3, color: 0xe8edf2 });
  g.rect(-9, -12, 4.5, 24).fill(0xe8edf2);
  g.rect(4.5, -12, 4.5, 24).fill(0xe8edf2);
  g.rect(-9, -2.2, 18, 4.4).fill(0xe8edf2);
  g.moveTo(34, -34).lineTo(50, -50).stroke({ width: 2.5, color: 0xcfd6dd });
  g.circle(50, -50, 3.5).fill(team.light);
  return g;
}

function outpost(PIXI: PixiModule, side: FrontlineSide) {
  const team = TEAM[side];
  const g = new PIXI.Graphics();
  const hex = (r: number) => Array.from({ length: 6 }, (_, i) => [Math.cos((Math.PI / 3) * i + Math.PI / 6) * r, Math.sin((Math.PI / 3) * i + Math.PI / 6) * r]).flat();
  g.poly(hex(44)).fill(CONCRETE_DARK).stroke({ width: 3.5, color: team.main });
  g.poly(hex(34)).fill(CONCRETE);
  g.poly(hex(18)).fill(0x464e57).stroke({ width: 2, color: 0x2a3036 });
  g.moveTo(0, 0).lineTo(0, -38).stroke({ width: 2.5, color: 0xd7dde3 });
  g.poly([0, -38, 22, -32, 0, -26]).fill(team.main).stroke({ width: 1.2, color: team.dark });
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    g.circle(Math.cos(a) * 34, Math.sin(a) * 34, 3).fill(team.light);
  }
  return g;
}

function depot(PIXI: PixiModule, side: FrontlineSide) {
  const team = TEAM[side];
  const g = new PIXI.Graphics();
  for (const [x, y] of [[-28, -28], [1, -28], [-28, 1], [1, 1]]) {
    g.roundRect(x, y, 27, 27, 3).fill(0x8a6a43).stroke({ width: 2, color: 0x4b3720 });
    g.moveTo(x + 3, y + 3).lineTo(x + 24, y + 24).stroke({ width: 2, color: 0x5d4528 });
    g.moveTo(x + 24, y + 3).lineTo(x + 3, y + 24).stroke({ width: 2, color: 0x5d4528 });
    g.rect(x + 2, y + 11, 23, 5).fill(team.main);
  }
  return g;
}

function barracks(PIXI: PixiModule, side: FrontlineSide) {
  const team = TEAM[side];
  const g = new PIXI.Graphics();
  g.roundRect(-39, -29, 78, 58, 6).fill(0x4b5560).stroke({ width: 3, color: team.main });
  g.rect(-39, -29, 78, 29).fill(0x5a6570);
  g.moveTo(-36, 0).lineTo(36, 0).stroke({ width: 2.5, color: 0x343b43 });
  for (let x = -30; x <= 30; x += 10) g.moveTo(x, -27).lineTo(x, 27).stroke({ width: 1, color: 0x000000, alpha: 0.25 });
  g.rect(-8, 24, 16, 8).fill(0x2b3036);
  g.rect(-34, -25, 10, 18).fill(team.main).stroke({ width: 1, color: team.dark });
  g.rect(24, -25, 10, 18).fill(team.main).stroke({ width: 1, color: team.dark });
  for (let x = -36; x < 36; x += 9) g.roundRect(x, 33, 8, 5, 2.5).fill(0xb9a77c).stroke({ width: 1, color: 0x6e6343 });
  return g;
}

function factory(PIXI: PixiModule, side: FrontlineSide) {
  const team = TEAM[side];
  const g = new PIXI.Graphics();
  g.roundRect(-42, -36, 84, 72, 6).fill(0x50565e).stroke({ width: 3, color: team.main });
  for (let i = 0; i < 5; i += 1) {
    g.rect(-38 + i * 16, -32, 16, 46).fill(i % 2 ? 0x5e656e : 0x474d55);
    g.rect(-38 + i * 16, -32, 16, 5).fill({ color: 0xffffff, alpha: 0.1 });
  }
  g.circle(28, -22, 8).fill(0x2b2f34).stroke({ width: 2, color: 0x16191c });
  g.circle(28, -22, 4).fill(0x101214);
  g.rect(-30, 16, 60, 18).fill(0x2b2f34);
  for (let x = -30; x < 30; x += 8) g.poly([x, 16, x + 4, 16, x + 8, 34, x + 4, 34]).fill(0xf0c33c);
  g.rect(-12, -10, 24, 14).fill(team.main);
  return g;
}

function turretBase(PIXI: PixiModule, side: FrontlineSide) {
  const team = TEAM[side];
  const g = new PIXI.Graphics();
  const oct = (r: number) => Array.from({ length: 8 }, (_, i) => [Math.cos((Math.PI / 4) * i + Math.PI / 8) * r, Math.sin((Math.PI / 4) * i + Math.PI / 8) * r]).flat();
  g.poly(oct(26)).fill(CONCRETE_DARK).stroke({ width: 3, color: team.main });
  g.poly(oct(19)).fill(CONCRETE);
  return g;
}

function turretGun(PIXI: PixiModule, side: FrontlineSide) {
  const team = TEAM[side];
  const g = new PIXI.Graphics();
  bounds(g, 34);
  g.roundRect(4, -7, 26, 4.5, 1.5).fill(0x30353a);
  g.roundRect(4, 2.5, 26, 4.5, 1.5).fill(0x30353a);
  g.circle(0, 0, 12).fill(team.main).stroke({ width: 2, color: team.dark });
  g.circle(-3, -3, 3).fill({ color: 0xffffff, alpha: 0.3 });
  return g;
}

function wreck(PIXI: PixiModule) {
  const g = new PIXI.Graphics();
  g.roundRect(-34, -24, 68, 48, 7).fill({ color: 0x1b1c1e, alpha: 0.9 });
  g.circle(-4, 2, 13).fill({ color: 0x2b2c2f, alpha: 0.9 });
  g.moveTo(-4, 2).lineTo(30, -12).stroke({ width: 6, color: 0x2b2c2f });
  return g;
}

function rubble(PIXI: PixiModule) {
  const g = new PIXI.Graphics();
  const rng = seeded(41);
  for (let i = 0; i < 26; i += 1) {
    const a = rng() * Math.PI * 2;
    const r = rng() * 40;
    const s = 4 + rng() * 9;
    g.poly([0, -s, s, 0, 0, s * 0.8, -s * 0.9, 0].map((v, k) => v + (k % 2 ? Math.sin(a) * r : Math.cos(a) * r))).fill(rng() > 0.5 ? 0x3d3f42 : 0x55585c);
  }
  return g;
}

function crystal(PIXI: PixiModule) {
  const g = new PIXI.Graphics();
  const shards: [number, number, number][] = [[-20, 6, 1], [0, -6, 1.35], [19, 6, 0.95], [-8, 16, 0.75], [10, 18, 0.8]];
  for (const [x, y, s] of shards) {
    g.poly([x, y - 18 * s, x + 8 * s, y, x, y + 9 * s, x - 8 * s, y]).fill(0x38d6c4).stroke({ width: 1.5, color: 0x0f6f68 });
    g.poly([x, y - 18 * s, x + 3 * s, y - 2 * s, x - 3 * s, y]).fill({ color: 0xd8fff9, alpha: 0.75 });
  }
  return g;
}

function scaffold(PIXI: PixiModule) {
  const g = new PIXI.Graphics();
  g.rect(-32, -32, 64, 64).stroke({ width: 3, color: 0xf0c33c });
  for (let x = -64; x < 64; x += 12) g.moveTo(x, -32).lineTo(x + 32, 32).stroke({ width: 2, color: 0xf0c33c, alpha: 0.55 });
  const mask = new PIXI.Graphics().rect(-32, -32, 64, 64).fill(0xffffff);
  g.mask = mask;
  const wrap = new PIXI.Container();
  wrap.addChild(mask, g);
  return wrap;
}

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
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

/** 지형 한 장: 풀밭, 흙길, 고지 등고선, 광산 주변 흙, 바위와 나무. 결정적 시드로 매번 같은 지도. */
function terrain(PIXI: PixiModule) {
  const unit = 12;
  const width = FRONTLINE_MAP_WIDTH * unit;
  const height = FRONTLINE_MAP_HEIGHT * unit;
  return canvasTexture(PIXI, width, height, (ctx) => {
    const rng = seeded(20261029);
    const base = ctx.createLinearGradient(0, 0, 0, height);
    base.addColorStop(0, "#4a4632");
    base.addColorStop(0.45, "#3f4a31");
    base.addColorStop(1, "#37462f");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);
    const tones = ["#56603b", "#3a4429", "#4f4a33", "#2f3a26", "#5d5a3c", "#45522f"];
    for (let i = 0; i < 2600; i += 1) {
      const x = rng() * width;
      const y = rng() * height;
      const r = ((6 + rng() * 34) * unit) / 8;
      ctx.globalAlpha = 0.08 + rng() * 0.12;
      ctx.fillStyle = tones[Math.floor(rng() * tones.length)];
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.6 + rng() * 0.6), rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const zone of FRONTLINE_ZONES) {
      const gradient = ctx.createRadialGradient(zone.x * unit, zone.y * unit, 0, zone.x * unit, zone.y * unit, zone.radius * unit * 1.25);
      gradient.addColorStop(0, "rgba(122, 104, 72, 0.75)");
      gradient.addColorStop(0.7, "rgba(110, 96, 66, 0.45)");
      gradient.addColorStop(1, "rgba(110, 96, 66, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(zone.x * unit, zone.y * unit, zone.radius * unit * 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineCap = "round";
    for (const [a, b] of FRONTLINE_EDGES) {
      const za = FRONTLINE_ZONES.find((zone) => zone.id === a)!;
      const zb = FRONTLINE_ZONES.find((zone) => zone.id === b)!;
      const line = (w: number, color: string, offset = 0) => {
        const dx = zb.x - za.x;
        const dy = zb.y - za.y;
        const length = Math.hypot(dx, dy) || 1;
        const nx = (-dy / length) * offset * unit;
        const ny = (dx / length) * offset * unit;
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(za.x * unit + nx, za.y * unit + ny);
        ctx.lineTo(zb.x * unit + nx, zb.y * unit + ny);
        ctx.stroke();
      };
      line(5.4 * unit, "rgba(60, 50, 34, 0.55)");
      line(4.2 * unit, "#7a6a4c");
      line(3.2 * unit, "#86765a");
      line(1.2, "rgba(50, 40, 28, 0.55)", -1);
      line(1.2, "rgba(50, 40, 28, 0.55)", 1);
    }
    const center = FRONTLINE_ZONES.find((zone) => zone.highGround)!;
    for (let ring = 4; ring >= 1; ring -= 1) {
      const r = center.radius * unit * (0.35 + ring * 0.2);
      ctx.fillStyle = `rgba(150, 132, 92, ${0.12 + (4 - ring) * 0.06})`;
      ctx.beginPath();
      ctx.arc(center.x * unit, center.y * unit, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(40, 32, 20, 0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const clear = (x: number, y: number, pad: number) => {
      for (const zone of FRONTLINE_ZONES) if (Math.hypot(x - zone.x, y - zone.y) < zone.radius + pad) return false;
      for (const [a, b] of FRONTLINE_EDGES) {
        const za = FRONTLINE_ZONES.find((zone) => zone.id === a)!;
        const zb = FRONTLINE_ZONES.find((zone) => zone.id === b)!;
        const dx = zb.x - za.x;
        const dy = zb.y - za.y;
        const t = Math.max(0, Math.min(1, ((x - za.x) * dx + (y - za.y) * dy) / (dx * dx + dy * dy)));
        if (Math.hypot(x - (za.x + dx * t), y - (za.y + dy * t)) < 3.5 + pad) return false;
      }
      return true;
    };
    for (let i = 0; i < 140; i += 1) {
      const x = rng() * FRONTLINE_MAP_WIDTH;
      const y = rng() * FRONTLINE_MAP_HEIGHT;
      if (!clear(x, y, 1)) continue;
      const r = (0.4 + rng() * 0.9) * unit;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(x * unit + unit * 0.4, y * unit + unit * 0.5, r, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rng() > 0.5 ? "#7b7d78" : "#6a6c66";
      ctx.beginPath();
      ctx.ellipse(x * unit, y * unit, r, r * 0.78, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.ellipse(x * unit - r * 0.25, y * unit - r * 0.25, r * 0.4, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 230; i += 1) {
      const x = rng() * FRONTLINE_MAP_WIDTH;
      const y = rng() * FRONTLINE_MAP_HEIGHT;
      if (!clear(x, y, 2.5)) continue;
      const r = (1.1 + rng() * 1.6) * unit;
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.beginPath();
      ctx.arc(x * unit + unit * 0.6, y * unit + unit * 0.75, r, 0, Math.PI * 2);
      ctx.fill();
      const leaf = ["#34492a", "#3a522d", "#2f4325", "#405632"][Math.floor(rng() * 4)];
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.arc(x * unit, y * unit, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(160, 200, 110, 0.12)";
      ctx.beginPath();
      ctx.arc(x * unit - r * 0.3, y * unit - r * 0.3, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const zone of FRONTLINE_ZONES) {
      if (!zone.mine) continue;
      const mine = frontlineMinePosition(zone.id);
      const gradient = ctx.createRadialGradient(mine.x * unit, mine.y * unit, 0, mine.x * unit, mine.y * unit, 6 * unit);
      gradient.addColorStop(0, "rgba(40, 70, 70, 0.55)");
      gradient.addColorStop(1, "rgba(40, 70, 70, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(mine.x * unit, mine.y * unit, 6 * unit, 0, Math.PI * 2);
      ctx.fill();
    }
    const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.45, width / 2, height / 2, Math.max(width, height) * 0.75);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  });
}

export function createFrontlineTextures(PIXI: PixiModule, renderer: Renderer): FrontlineTextureSet {
  const bake = (target: Graphics | InstanceType<PixiModule["Container"]>) => {
    // 확대해도 선명하도록 지도 1칸당 32픽셀로 굽는다(논리 크기는 SPRITE_PX 기준 그대로).
    const texture = renderer.generateTexture({ target, resolution: 2, antialias: true });
    target.destroy({ children: true });
    return texture;
  };
  const perSide = <K extends string>(make: Record<K, (side: FrontlineSide) => Graphics>) => {
    const out = {} as Record<FrontlineSide, Record<K, Texture>>;
    for (const side of ["player", "enemy"] as FrontlineSide[]) {
      out[side] = {} as Record<K, Texture>;
      for (const key of Object.keys(make) as K[]) out[side][key] = bake(make[key](side));
    }
    return out;
  };
  return {
    units: perSide<UnitTextureKey>({
      rifle: (side) => soldier(PIXI, side),
      guard: (side) => guard(PIXI, side),
      tank: (side) => tankHull(PIXI, side),
      tankTurret: (side) => tankTurret(PIXI, side),
      worker: (side) => worker(PIXI, side),
    }),
    buildings: perSide<BuildingTextureKey>({
      hq: (side) => hq(PIXI, side),
      outpost: (side) => outpost(PIXI, side),
      depot: (side) => depot(PIXI, side),
      barracks: (side) => barracks(PIXI, side),
      factory: (side) => factory(PIXI, side),
      turret: (side) => turretBase(PIXI, side),
      turretGun: (side) => turretGun(PIXI, side),
    }),
    wreck: bake(wreck(PIXI)),
    rubble: bake(rubble(PIXI)),
    crystal: bake(crystal(PIXI)),
    scaffold: bake(scaffold(PIXI)),
    scorch: radial(PIXI, 64, [[0, "rgba(10,8,6,0.85)"], [0.55, "rgba(20,16,10,0.5)"], [1, "rgba(20,16,10,0)"]]),
    soft: radial(PIXI, 64, [[0, "rgba(255,255,255,1)"], [0.45, "rgba(255,255,255,0.55)"], [1, "rgba(255,255,255,0)"]]),
    spark: radial(PIXI, 32, [[0, "rgba(255,255,255,1)"], [0.3, "rgba(255,240,180,0.9)"], [1, "rgba(255,200,80,0)"]]),
    shadow: radial(PIXI, 64, [[0, "rgba(0,0,0,0.55)"], [0.6, "rgba(0,0,0,0.3)"], [1, "rgba(0,0,0,0)"]]),
    ring: canvasTexture(PIXI, 64, 64, (ctx) => {
      ctx.strokeStyle = "white";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(32, 32, 27, 0, Math.PI * 2);
      ctx.stroke();
    }),
    tracer: canvasTexture(PIXI, 64, 4, (ctx) => {
      const gradient = ctx.createLinearGradient(0, 0, 64, 0);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(1, "rgba(255,255,255,1)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 4);
    }),
    shell: radial(PIXI, 24, [[0, "rgba(255,255,230,1)"], [0.4, "rgba(255,220,120,0.95)"], [1, "rgba(255,160,40,0)"]]),
    terrain: terrain(PIXI),
  };
}
