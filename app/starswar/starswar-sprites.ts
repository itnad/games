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
  tankParts: Record<StwSide, { hull: Texture; hullSieged: Texture; turret: Texture; turretSieged: Texture }>;
  /** 저그 변형: 레어로 변태한 해처리, 땅속에 숨은 럴커. */
  zergParts: Record<StwSide, { lair: Texture; lurkerBurrowed: Texture }>;
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

function dark(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 26);
  g.poly([4, 6, 24, 1, 25, 3, 6, 9]).fill({ color: team.glow, alpha: 0.95 });
  g.poly([4, 6, 20, 2, 6, 10]).fill({ color: 0xffffff, alpha: 0.35 });
  g.circle(-2, 0, 11).fill(0x241c30).stroke({ width: 1.8, color: 0x0e0a14 });
  g.poly([-12, -7, -19, 0, -12, 7]).fill(0x1a1424);
  g.ellipse(-2, -8, 4.5, 3).fill(0x3c3150);
  g.ellipse(-2, 8, 4.5, 3).fill(0x3c3150);
  g.circle(1, 0, 5.4).fill(0x120d18).stroke({ width: 1, color: 0x3c3150 });
  g.rect(3.5, -1.6, 2.4, 3.2).fill(team.glow);
  return g;
}

function archon(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 30);
  g.circle(0, 0, 24).fill({ color: team.glow, alpha: 0.28 });
  g.circle(0, 0, 18).fill({ color: team.glow, alpha: 0.45 });
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI / 3) * i;
    g.moveTo(Math.cos(a) * 6, Math.sin(a) * 6).quadraticCurveTo(Math.cos(a + 0.6) * 18, Math.sin(a + 0.6) * 18, Math.cos(a + 1.1) * 23, Math.sin(a + 1.1) * 23).stroke({ width: 2, color: team.light, alpha: 0.85 });
  }
  g.circle(0, 0, 11).fill(team.light);
  g.circle(0, 0, 6).fill(0xffffff);
  return g;
}

function observer(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 16);
  g.poly([-12, -8, -4, -4, -4, 4, -12, 8]).fill(0x7d7564);
  g.ellipse(0, 0, 10, 6.5).fill(0xb7aa8a).stroke({ width: 1.4, color: 0x5d553f });
  g.ellipse(2, 0, 6, 4).fill(0xd8ccaa);
  g.circle(6, 0, 2.8).fill(team.glow);
  g.circle(6, 0, 1.2).fill(0xffffff);
  return g;
}

function reaver(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 32);
  for (const [x, r] of [[-18, 9], [-8, 12], [4, 13]] as [number, number][]) {
    for (const y of [-r + 1, r - 1]) g.circle(x, y, 2.6).fill(GOLD_DARK);
    g.ellipse(x, 0, r * 0.9, r).fill(GOLD).stroke({ width: 1.8, color: GOLD_DARK });
    g.ellipse(x - 1, -r * 0.35, r * 0.5, r * 0.3).fill({ color: GOLD_LIGHT, alpha: 0.7 });
  }
  g.rect(-22, -2, 30, 4).fill(team.glow);
  g.ellipse(17, 0, 6, 7).fill(0x3a2c1c).stroke({ width: 1.4, color: INK });
  g.circle(18, 0, 3).fill(team.glow);
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

function robo(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.roundRect(-38, -36, 76, 72, 12).fill(GOLD_DARK).stroke({ width: 2.5, color: INK });
  g.roundRect(-33, -31, 66, 62, 10).fill(GOLD);
  g.circle(0, 2, 22).fill(0xa9b2ba).stroke({ width: 2, color: 0x4d5560 });
  g.circle(0, 2, 22).stroke({ width: 3, color: team.glow, alpha: 0.8 });
  g.circle(-6, -4, 7).fill({ color: 0xffffff, alpha: 0.35 });
  g.roundRect(-6, -34, 12, 14, 3).fill(0x4d5560);
  g.circle(0, 2, 6).fill(team.glow);
  return g;
}

function bay(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.roundRect(-35, -30, 70, 60, 10).fill(GOLD_DARK).stroke({ width: 2.5, color: INK });
  g.roundRect(-31, -26, 62, 52, 8).fill(GOLD);
  for (const x of [-14, 14]) {
    g.circle(x, 0, 12).fill(0x9aa3ab).stroke({ width: 2, color: 0x4d5560 });
    g.circle(x, 0, 5).fill(team.glow);
  }
  g.rect(-4, -22, 8, 44).fill(GOLD_LIGHT);
  return g;
}

/* ───────── 테란: 강철 장갑과 진영 색 판 ───────── */
const STEEL = 0x8e979f;
const STEEL_DARK = 0x4b525a;
const STEEL_LIGHT = 0xc6ccd1;

function marine(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 20);
  g.roundRect(2, 1.5, 15, 3.2, 1).fill(0x2a2d31);
  g.ellipse(-1, 0, 7.5, 9.5).fill(team.deep).stroke({ width: 1.6, color: 0x11161c });
  g.ellipse(-3, -6, 3.6, 3).fill(team.glow);
  g.ellipse(-3, 6, 3.6, 3).fill(team.glow);
  g.circle(1, 0, 4.6).fill(STEEL).stroke({ width: 1.2, color: STEEL_DARK });
  g.rect(3, -2, 2.4, 4).fill(0xffd27a);
  return g;
}

function firebat(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 22);
  for (const y of [-5, 5]) g.roundRect(4, y - 1.6, 12, 3.2, 1).fill(0x3a3d42);
  g.circle(-8, -4, 3.4).fill(0xd4562c).stroke({ width: 1, color: 0x5e1d0c });
  g.circle(-8, 4, 3.4).fill(0xd4562c).stroke({ width: 1, color: 0x5e1d0c });
  g.ellipse(-1, 0, 8.5, 10.5).fill(0xa1452a).stroke({ width: 1.6, color: 0x3a1408 });
  g.rect(-5, -1.5, 9, 3).fill(team.glow);
  g.circle(1, 0, 4.8).fill(STEEL).stroke({ width: 1.2, color: STEEL_DARK });
  g.rect(3, -2, 2.4, 4).fill(0xffb347);
  return g;
}

function medic(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 18);
  g.ellipse(-1, 0, 7, 9).fill(0xe9ecef).stroke({ width: 1.6, color: 0x7d858c });
  g.rect(-4, -1.2, 6, 2.4).fill(0xd9363e);
  g.rect(-2.2, -3, 2.4, 6).fill(0xd9363e);
  g.rect(-8, -6, 3, 12).fill(team.glow);
  g.circle(2, 0, 4.2).fill(0xf6f7f8).stroke({ width: 1.2, color: 0x7d858c });
  g.rect(4, -1.6, 2, 3.2).fill(0x7fd6ff);
  return g;
}

function scv(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 14);
  for (const y of [-6, 6]) g.moveTo(2, y * 0.6).lineTo(10, y).stroke({ width: 2, color: STEEL_DARK });
  g.roundRect(-8, -6, 14, 12, 3).fill(0xd8b04a).stroke({ width: 1.2, color: 0x6a5414 });
  g.rect(-8, -1.5, 14, 3).fill(team.glow);
  g.circle(1, 0, 3.2).fill(0x7fd6ff).stroke({ width: 1, color: STEEL_DARK });
  return g;
}

function vulture(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 26);
  g.poly([22, 0, 4, -8, -16, -6, -20, 0, -16, 6, 4, 8]).fill(STEEL).stroke({ width: 1.6, color: STEEL_DARK });
  g.poly([20, 0, 6, -3.5, 6, 3.5]).fill(STEEL_LIGHT);
  g.rect(-12, -2, 18, 4).fill(team.glow);
  g.circle(-19, 0, 3.5).fill({ color: 0x7fd6ff, alpha: 0.9 });
  g.circle(-2, 0, 3.2).fill(0x2a2d31);
  return g;
}

function tankHull(PIXI: PixiModule, side: StwSide, sieged: boolean) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 34);
  if (sieged) {
    for (const [x, y] of [[20, 20], [20, -20], [-20, 20], [-20, -20]]) {
      g.moveTo(0, 0).lineTo(x, y).stroke({ width: 4, color: STEEL_DARK, cap: "round" });
      g.roundRect(x - 3.5, y - 3.5, 7, 7, 2).fill(STEEL).stroke({ width: 1, color: STEEL_DARK });
    }
  }
  for (const y of [-17, 11]) {
    g.roundRect(-24, y, 48, 6, 2.5).fill(0x2a2d31);
    for (let x = -22; x < 22; x += 5) g.rect(x, y + 1, 1.8, 4).fill(0x464a50);
  }
  g.roundRect(-22, -12, 44, 24, 5).fill(0x6b7a5a).stroke({ width: 1.8, color: 0x2b3322 });
  g.roundRect(-17, -8, 34, 16, 4).fill(0x7e8d6a);
  g.rect(-17, -2, 34, 4).fill(team.glow);
  return g;
}

function tankTurret(PIXI: PixiModule, side: StwSide, sieged: boolean) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 40);
  const barrel = sieged ? 34 : 24;
  g.roundRect(6, -2.6, barrel, 5.2, 1.5).fill(0x3a3f45).stroke({ width: 1, color: 0x16191c });
  if (sieged) g.roundRect(6, -4.5, 14, 9, 2).fill(0x50565e);
  g.circle(0, 0, 10).fill(0x7e8d6a).stroke({ width: 2, color: 0x2b3322 });
  g.circle(-3, 2, 3.4).fill(team.deep);
  g.circle(2, -3, 2).fill(team.glow);
  return g;
}

function cc(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.roundRect(-62, -58, 124, 116, 10).fill(STEEL_DARK).stroke({ width: 3, color: 0x1f2328 });
  g.roundRect(-56, -52, 112, 104, 8).fill(STEEL);
  for (const [x, y] of [[-40, -36], [40, -36], [-40, 36], [40, 36]]) g.roundRect(x - 10, y - 10, 20, 20, 3).fill(STEEL_DARK);
  g.rect(-56, -6, 112, 12).fill(team.deep);
  g.rect(-56, -2, 112, 4).fill(team.glow);
  g.circle(0, 0, 26).fill(0x5d656e).stroke({ width: 3, color: 0x2a2f35 });
  g.circle(0, 0, 18).fill(STEEL_LIGHT);
  g.circle(0, 0, 7).fill(team.glow);
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI / 4) * i;
    g.circle(Math.cos(a) * 22, Math.sin(a) * 22, 2).fill(0xffd27a);
  }
  return g;
}

function terranBlock(PIXI: PixiModule, side: StwSide, w: number, h: number, accent: (g: Graphics) => void) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.roundRect(-w / 2, -h / 2, w, h, 6).fill(STEEL_DARK).stroke({ width: 2.5, color: 0x1f2328 });
  g.roundRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 5).fill(STEEL);
  g.rect(-w / 2 + 4, h / 2 - 12, w - 8, 5).fill(team.glow);
  accent(g);
  return g;
}

function depot(PIXI: PixiModule, side: StwSide) {
  return terranBlock(PIXI, side, 56, 56, (g) => {
    for (const y of [-14, -4, 6]) g.rect(-18, y, 36, 4).fill(STEEL_DARK);
  });
}

function refinery(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.circle(0, 0, 32).fill(0x2f3a2a).stroke({ width: 2, color: 0x1e1d19 });
  g.circle(0, 0, 25).fill(STEEL_DARK);
  g.circle(0, 0, 20).fill(STEEL).stroke({ width: 1.5, color: STEEL_DARK });
  g.rect(-24, -3, 48, 6).fill(0x5d656e);
  g.circle(0, 0, 8).fill(0x5bd16b);
  g.circle(14, -14, 4).fill(team.glow);
  return g;
}

function barracksT(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  return terranBlock(PIXI, side, 80, 66, (g) => {
    g.roundRect(-12, 18, 24, 12, 2).fill(0x2a2d31);
    for (const x of [-30, 22]) g.rect(x, -24, 8, 16).fill(team.deep);
    g.rect(-24, -24, 48, 10).fill(STEEL_LIGHT);
  });
}

function ebay(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  return terranBlock(PIXI, side, 72, 64, (g) => {
    g.circle(0, -6, 16).fill(STEEL_LIGHT).stroke({ width: 2, color: STEEL_DARK });
    g.circle(0, -6, 6).fill(team.glow);
  });
}

function bunker(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.roundRect(-28, -28, 56, 56, 14).fill(0x5d656e).stroke({ width: 2.5, color: 0x1f2328 });
  g.roundRect(-21, -21, 42, 42, 10).fill(STEEL);
  for (const [x, y, w, h] of [[16, -10, 6, 20], [-22, -10, 6, 20], [-10, -22, 20, 6], [-10, 16, 20, 6]]) g.rect(x, y, w, h).fill(0x1a1d21);
  g.circle(0, 0, 6).fill(team.glow);
  return g;
}

function turretT(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.circle(0, 0, 24).fill(STEEL_DARK).stroke({ width: 2, color: 0x1f2328 });
  g.circle(0, 0, 18).fill(STEEL);
  for (const y of [-7, 0, 7]) g.roundRect(-4, y - 2.5, 20, 5, 2).fill(0x3a3f45);
  g.circle(0, 0, 6).fill(team.glow);
  return g;
}

function academy(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  return terranBlock(PIXI, side, 74, 70, (g) => {
    g.rect(-24, -24, 48, 30).fill(STEEL_LIGHT);
    g.moveTo(18, -20).lineTo(30, -32).stroke({ width: 3, color: STEEL_DARK });
    g.circle(30, -32, 4).fill(team.glow);
  });
}

function comsat(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  g.roundRect(-26, -26, 52, 52, 8).fill(STEEL_DARK).stroke({ width: 2, color: 0x1f2328 });
  g.circle(0, 0, 18).fill(STEEL_LIGHT).stroke({ width: 2, color: STEEL_DARK });
  g.circle(0, 0, 11).stroke({ width: 2, color: STEEL_DARK });
  g.moveTo(0, 0).lineTo(12, -12).stroke({ width: 2.5, color: STEEL_DARK });
  g.circle(12, -12, 3.5).fill(team.glow);
  return g;
}

function factoryT(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  return terranBlock(PIXI, side, 84, 74, (g) => {
    for (let i = 0; i < 4; i += 1) g.rect(-34 + i * 17, -28, 15, 34).fill(i % 2 ? STEEL_LIGHT : 0x7a838c);
    g.rect(-26, 12, 52, 10).fill(0x2a2d31);
    for (let x = -26; x < 26; x += 8) g.poly([x, 12, x + 4, 12, x + 8, 22, x + 4, 22]).fill(0xf0c33c);
    g.circle(28, -22, 5).fill(team.glow);
  });
}

function shop(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  return terranBlock(PIXI, side, 58, 54, (g) => {
    g.circle(0, -4, 12).fill(0x5d656e);
    for (let i = 0; i < 8; i += 1) {
      const a = (Math.PI / 4) * i;
      g.rect(Math.cos(a) * 12 - 2.5, -4 + Math.sin(a) * 12 - 2.5, 5, 5).fill(0x5d656e);
    }
    g.circle(0, -4, 5).fill(team.glow);
  });
}

/* ───────── 저그 ───────── */

const FLESH = 0x8a5468;
const FLESH_DARK = 0x4a2436;
const SHELL = 0x6e5236;
const SHELL_DARK = 0x3a2918;
const BONE = 0xe6d6b2;
const CREEP = 0x5a3550;

/** 등껍질 판 여러 장을 겹쳐 그린다. */
function plates(g: Graphics, x: number, count: number, step: number, w: number, h: number, color: number, edge: number) {
  for (let i = 0; i < count; i += 1) g.ellipse(x - i * step, 0, w - i * 0.6, h - i * 0.8).fill(color).stroke({ width: 1.2, color: edge });
}

function drone(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 20);
  for (const y of [-5, 5]) g.moveTo(6, y).lineTo(13, y * 1.4).stroke({ width: 2, color: BONE, cap: "round" });
  g.ellipse(-1, 0, 10, 7.5).fill(SHELL).stroke({ width: 1.6, color: SHELL_DARK });
  g.ellipse(-3, 0, 6, 4.5).fill(team.deep);
  g.circle(6, 0, 3.6).fill(FLESH).stroke({ width: 1, color: FLESH_DARK });
  g.circle(7, -1.5, 1.2).fill(team.glow);
  g.circle(7, 1.5, 1.2).fill(team.glow);
  return g;
}

function zergling(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 18);
  // 등에 솟은 낫 모양 날개 두 쌍.
  for (const dir of [-1, 1]) {
    g.moveTo(-2, dir * 3).quadraticCurveTo(-10, dir * 13, -15, dir * 9).quadraticCurveTo(-8, dir * 7, -2, dir * 3).fill(FLESH).stroke({ width: 1, color: FLESH_DARK });
  }
  g.ellipse(-2, 0, 8, 5).fill(SHELL).stroke({ width: 1.4, color: SHELL_DARK });
  g.ellipse(-4, 0, 4, 2.6).fill(team.deep);
  g.ellipse(6, 0, 5, 3.6).fill(FLESH).stroke({ width: 1, color: FLESH_DARK });
  for (const y of [-2.4, 2.4]) g.moveTo(9, y).lineTo(13, y * 1.6).stroke({ width: 1.4, color: BONE, cap: "round" });
  g.circle(7, -1.6, 1).fill(team.glow);
  g.circle(7, 1.6, 1).fill(team.glow);
  return g;
}

function hydra(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 24);
  // 꼬리에서 머리로 이어지는 몸통, 머리 뒤 넓은 볏.
  g.ellipse(-12, 0, 9, 5).fill(FLESH_DARK);
  plates(g, -2, 3, 5, 9, 7.5, SHELL, SHELL_DARK);
  g.moveTo(4, -15).quadraticCurveTo(-4, 0, 4, 15).quadraticCurveTo(12, 8, 12, 0).quadraticCurveTo(12, -8, 4, -15).fill(FLESH).stroke({ width: 1.4, color: FLESH_DARK });
  for (const y of [-10, -5, 5, 10]) g.moveTo(5, y).lineTo(9, y * 0.7).stroke({ width: 1, color: team.deep });
  g.ellipse(13, 0, 6, 4).fill(SHELL).stroke({ width: 1.2, color: SHELL_DARK });
  g.circle(16, -1.8, 1.3).fill(team.glow);
  g.circle(16, 1.8, 1.3).fill(team.glow);
  for (const y of [-4, 4]) g.moveTo(17, y).lineTo(21, y * 1.3).stroke({ width: 1.4, color: BONE, cap: "round" });
  return g;
}

function lurker(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 26);
  // 등에서 뒤로 뻗은 가시 다발.
  for (let i = -3; i <= 3; i += 1) {
    const a = Math.PI + i * 0.32;
    g.moveTo(-2, i * 2).lineTo(-2 + Math.cos(a) * 22, Math.sin(a) * 22).stroke({ width: 2.4, color: BONE, cap: "round" });
  }
  plates(g, 2, 3, 5, 11, 9, SHELL, SHELL_DARK);
  g.ellipse(-4, 0, 6, 4).fill(team.deep);
  g.ellipse(11, 0, 6, 5).fill(FLESH).stroke({ width: 1.2, color: FLESH_DARK });
  g.circle(14, -2, 1.3).fill(team.glow);
  g.circle(14, 2, 1.3).fill(team.glow);
  return g;
}

function lurkerBurrowed(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 26);
  g.ellipse(0, 0, 16, 13).fill({ color: 0x4a3a28, alpha: 0.9 });
  for (let i = 0; i < 10; i += 1) {
    const a = (Math.PI * 2 * i) / 10;
    g.moveTo(Math.cos(a) * 4, Math.sin(a) * 4).lineTo(Math.cos(a) * 14, Math.sin(a) * 12).stroke({ width: 2, color: BONE, cap: "round" });
  }
  g.circle(0, 0, 5).fill(SHELL).stroke({ width: 1, color: SHELL_DARK });
  g.circle(0, 0, 2).fill(team.glow);
  return g;
}

function ultra(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 34);
  for (const y of [-12, -4, 4, 12]) g.ellipse(-4 + Math.abs(y) * 0.2, y * 1.5, 4, 3).fill(FLESH_DARK);
  plates(g, 0, 4, 6, 16, 13, SHELL, SHELL_DARK);
  g.ellipse(-6, 0, 9, 6).fill(team.deep);
  g.ellipse(14, 0, 8, 7).fill(FLESH).stroke({ width: 1.4, color: FLESH_DARK });
  // 앞으로 휘어진 거대한 낫 송곳니.
  for (const dir of [-1, 1]) {
    g.moveTo(10, dir * 6).quadraticCurveTo(26, dir * 18, 32, dir * 4).quadraticCurveTo(24, dir * 10, 14, dir * 3).fill(BONE).stroke({ width: 1, color: 0x9c8a66 });
  }
  g.circle(18, -2.4, 1.6).fill(team.glow);
  g.circle(18, 2.4, 1.6).fill(team.glow);
  return g;
}

/** 저그 건물 바탕: 크립 위에 솟은 살덩이. */
function zergMound(PIXI: PixiModule, r: number) {
  const g = new PIXI.Graphics();
  g.ellipse(0, 2, r * 1.1, r).fill({ color: CREEP, alpha: 0.85 });
  for (let i = 0; i < 7; i += 1) {
    const a = (Math.PI * 2 * i) / 7 + 0.3;
    g.ellipse(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.75 + 2, r * 0.32, r * 0.22).fill({ color: FLESH_DARK, alpha: 0.9 });
  }
  return g;
}

function hatchery(PIXI: PixiModule, side: StwSide, lair = false) {
  const team = STW_TEAM[side];
  const g = zergMound(PIXI, 60);
  g.ellipse(0, 0, 46, 40).fill(SHELL).stroke({ width: 3, color: SHELL_DARK });
  for (let i = 0; i < (lair ? 12 : 8); i += 1) {
    const a = (Math.PI * 2 * i) / (lair ? 12 : 8);
    const r = lair ? 50 : 44;
    g.moveTo(Math.cos(a) * 30, Math.sin(a) * 26).lineTo(Math.cos(a) * r, Math.sin(a) * (r - 6)).stroke({ width: lair ? 5 : 6, color: BONE, cap: "round" });
  }
  g.ellipse(0, 0, 30, 26).fill(lair ? 0x6a3c66 : FLESH).stroke({ width: 2, color: FLESH_DARK });
  g.ellipse(0, 0, 16, 13).fill(team.deep);
  g.ellipse(0, 0, 8, 6).fill(team.glow);
  for (const [x, y] of [[-18, -8], [16, 10], [6, -18]]) g.circle(x, y, 3).fill(0xc9a0b8);
  return g;
}

function overlord(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = new PIXI.Graphics();
  pad(g, 30);
  for (let i = 0; i < 6; i += 1) {
    const x = -14 + i * 5;
    g.moveTo(x, 12).quadraticCurveTo(x + 3, 22, x - 2, 28).stroke({ width: 2, color: FLESH, cap: "round" });
  }
  g.ellipse(0, 0, 24, 18).fill(SHELL).stroke({ width: 2.4, color: SHELL_DARK });
  for (const x of [-12, 0, 12]) g.ellipse(x, -4, 7, 10).fill({ color: SHELL_DARK, alpha: 0.4 });
  g.ellipse(0, 4, 16, 9).fill(FLESH).stroke({ width: 1.4, color: FLESH_DARK });
  g.circle(-6, 4, 2.6).fill(team.glow);
  g.circle(6, 4, 2.6).fill(team.glow);
  return g;
}

function extractor(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = zergMound(PIXI, 32);
  g.ellipse(0, 0, 26, 22).fill(SHELL).stroke({ width: 2.4, color: SHELL_DARK });
  g.ellipse(0, -2, 15, 12).fill(FLESH).stroke({ width: 1.6, color: FLESH_DARK });
  g.ellipse(0, -2, 7, 5).fill(0x7fe08f);
  g.circle(14, 10, 3).fill(team.glow);
  return g;
}

function pool(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = zergMound(PIXI, 38);
  g.ellipse(0, 0, 34, 28).fill(SHELL).stroke({ width: 2.4, color: SHELL_DARK });
  g.ellipse(0, 0, 24, 18).fill(0x6fbf4a).stroke({ width: 2, color: FLESH_DARK });
  for (const [x, y, r] of [[-8, -4, 5], [7, 5, 4], [10, -6, 3]]) g.circle(x, y, r).fill({ color: 0xc8f08a, alpha: 0.8 });
  g.circle(-20, 14, 3).fill(team.glow);
  return g;
}

function evo(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = zergMound(PIXI, 36);
  g.ellipse(0, 0, 30, 26).fill(SHELL).stroke({ width: 2.4, color: SHELL_DARK });
  for (let i = 0; i < 5; i += 1) g.ellipse(0, -10 + i * 5, 22 - Math.abs(i - 2) * 4, 3).fill({ color: SHELL_DARK, alpha: 0.6 });
  g.circle(0, 0, 9).fill(FLESH).stroke({ width: 1.4, color: FLESH_DARK });
  g.circle(0, 0, 4).fill(team.glow);
  return g;
}

function sunken(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = zergMound(PIXI, 26);
  g.circle(0, 0, 20).fill(SHELL).stroke({ width: 2.4, color: SHELL_DARK });
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI * 2 * i) / 6;
    g.moveTo(Math.cos(a) * 8, Math.sin(a) * 8).lineTo(Math.cos(a) * 20, Math.sin(a) * 20).stroke({ width: 3, color: BONE, cap: "round" });
  }
  g.circle(0, 0, 9).fill(FLESH).stroke({ width: 1.4, color: FLESH_DARK });
  g.circle(0, 0, 4).fill(team.glow);
  return g;
}

function spore(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = zergMound(PIXI, 24);
  g.circle(0, 0, 18).fill(SHELL).stroke({ width: 2.4, color: SHELL_DARK });
  g.circle(0, -2, 12).fill(0xa86c8a).stroke({ width: 1.6, color: FLESH_DARK });
  for (const [x, y] of [[-5, -5], [5, -4], [0, 3]]) g.circle(x, y, 3).fill(0xe8c0d8);
  g.circle(0, -2, 3).fill(team.glow);
  return g;
}

function den(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = zergMound(PIXI, 34);
  g.ellipse(0, 0, 30, 24).fill(SHELL).stroke({ width: 2.4, color: SHELL_DARK });
  for (let i = -2; i <= 2; i += 1) g.moveTo(i * 9, -4).lineTo(i * 11, -26).stroke({ width: 3.4, color: BONE, cap: "round" });
  g.ellipse(0, 6, 16, 10).fill(FLESH).stroke({ width: 1.4, color: FLESH_DARK });
  g.ellipse(0, 6, 6, 4).fill(team.glow);
  return g;
}

function cavern(PIXI: PixiModule, side: StwSide) {
  const team = STW_TEAM[side];
  const g = zergMound(PIXI, 38);
  g.ellipse(0, 0, 34, 28).fill(SHELL).stroke({ width: 2.4, color: SHELL_DARK });
  for (const dir of [-1, 1]) g.moveTo(dir * 8, -6).quadraticCurveTo(dir * 30, -18, dir * 22, 8).stroke({ width: 6, color: BONE, cap: "round" });
  g.ellipse(0, 4, 14, 11).fill(0x2a1a22).stroke({ width: 2, color: FLESH_DARK });
  g.circle(-4, 4, 2).fill(team.glow);
  g.circle(4, 4, 2).fill(team.glow);
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
  const tankParts = {} as StwTextureSet["tankParts"];
  const zergParts = {} as StwTextureSet["zergParts"];
  for (const side of sides) {
    units[side] = {
      zealot: bake(zealot(PIXI, side)),
      dragoon: bake(dragoon(PIXI, side)),
      templar: bake(templar(PIXI, side)),
      probe: bake(probe(PIXI, side)),
      dark: bake(dark(PIXI, side)),
      archon: bake(archon(PIXI, side)),
      observer: bake(observer(PIXI, side)),
      reaver: bake(reaver(PIXI, side)),
      scv: bake(scv(PIXI, side)),
      marine: bake(marine(PIXI, side)),
      firebat: bake(firebat(PIXI, side)),
      medic: bake(medic(PIXI, side)),
      vulture: bake(vulture(PIXI, side)),
      tank: bake(tankHull(PIXI, side, false)),
      drone: bake(drone(PIXI, side)),
      zergling: bake(zergling(PIXI, side)),
      hydra: bake(hydra(PIXI, side)),
      lurker: bake(lurker(PIXI, side)),
      ultra: bake(ultra(PIXI, side)),
    };
    zergParts[side] = { lair: bake(hatchery(PIXI, side, true)), lurkerBurrowed: bake(lurkerBurrowed(PIXI, side)) };
    tankParts[side] = {
      hull: units[side].tank,
      hullSieged: bake(tankHull(PIXI, side, true)),
      turret: bake(tankTurret(PIXI, side, false)),
      turretSieged: bake(tankTurret(PIXI, side, true)),
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
      robo: bake(robo(PIXI, side)),
      bay: bake(bay(PIXI, side)),
      cc: bake(cc(PIXI, side)),
      depot: bake(depot(PIXI, side)),
      refinery: bake(refinery(PIXI, side)),
      barracks: bake(barracksT(PIXI, side)),
      ebay: bake(ebay(PIXI, side)),
      bunker: bake(bunker(PIXI, side)),
      turret: bake(turretT(PIXI, side)),
      academy: bake(academy(PIXI, side)),
      comsat: bake(comsat(PIXI, side)),
      factory: bake(factoryT(PIXI, side)),
      shop: bake(shop(PIXI, side)),
      hatchery: bake(hatchery(PIXI, side)),
      hatch: bake(hatchery(PIXI, side)),
      overlord: bake(overlord(PIXI, side)),
      extractor: bake(extractor(PIXI, side)),
      pool: bake(pool(PIXI, side)),
      evo: bake(evo(PIXI, side)),
      sunken: bake(sunken(PIXI, side)),
      spore: bake(spore(PIXI, side)),
      den: bake(den(PIXI, side)),
      cavern: bake(cavern(PIXI, side)),
    };
    flags[side] = bake(flag(PIXI, side));
  }
  return {
    units,
    tankParts,
    zergParts,
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
