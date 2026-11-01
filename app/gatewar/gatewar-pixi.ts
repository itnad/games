// 관문 전쟁 PixiJS 렌더러. 엔진 상태를 읽기만 하며, 플레이어 시야 밖의 적은 감춘다.
import type { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { GW_BUILDINGS, GW_LANE_LENGTH, GW_LANE_WIDTH, GW_LAYOUT, GW_STORM } from "./gatewar-data.js";
import { gwDone, gwPoint, gwRallyY, gwVisible } from "./gatewar-engine.js";
import { GW_TEAM, createGwTextures, type GwTextureSet } from "./gatewar-sprites";
import type { GwBuilding, GwEffect, GwSide, GwState, GwUi, GwUnit, GwUnitType, GwView } from "./gatewar-types";

type PixiModule = typeof import("pixi.js");

const UNIT_SIZE: Record<GwUnitType, number> = { zealot: 3.4, dragoon: 3.9, templar: 3.1, probe: 1.9 };
const FONT = "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const FOG_CELL = 2;

type UnitView = { root: Container; body: Sprite; glow: Sprite; x: number; y: number; heading: number; bob: number };
type BuildingView = { root: Container; body: Sprite; glow: Sprite | null; ghost: boolean };
type Particle = { sprite: Sprite; x: number; y: number; vx: number; vy: number; life: number; max: number; s0: number; s1: number; a0: number; rise: number };
type Decal = { sprite: Sprite; life: number; max: number; a0: number };

export async function createGwPixiRenderer(host: HTMLElement, width: number, height: number) {
  const PIXI = await import("pixi.js");
  // CSP가 eval을 막는 환경에서도 동작하도록 eval 없는 구현을 켠다.
  // @ts-expect-error 이 하위 경로는 타입 선언 없이 배포된다.
  await import("pixi.js/unsafe-eval");
  const app = new PIXI.Application();
  await app.init({
    width: Math.max(1, width),
    height: Math.max(1, height),
    antialias: true,
    background: 0x1a130b,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: "webgl",
    autoStart: false,
    sharedTicker: false,
  });
  app.ticker?.stop();
  app.canvas.classList.add("gw-pixi-canvas");
  host.appendChild(app.canvas);
  return new GwPixiRenderer(PIXI, app);
}

export class GwPixiRenderer {
  private readonly PIXI: PixiModule;
  private readonly app: Application;
  private readonly tex: GwTextureSet;
  private readonly world: Container;
  private readonly decals: Container;
  private readonly underlay: Graphics;
  private readonly buildingLayer: Container;
  private readonly unitLayer: Container;
  private readonly fxLayer: Container;
  private readonly stormLayer: Graphics;
  private readonly fog: Graphics;
  private readonly overlay: Container;
  private readonly bars: Graphics;
  private readonly rallyFlag: Sprite;
  private readonly labels: { root: Container; text: Text; y: number }[] = [];
  private readonly unitViews = new Map<number, UnitView>();
  private readonly buildingViews = new Map<number, BuildingView>();
  private readonly projectilePool: Sprite[] = [];
  private readonly particles: Particle[] = [];
  private readonly particlePool: Sprite[] = [];
  private readonly decalList: Decal[] = [];
  private processed = new WeakSet<object>();
  private impacted = new WeakSet<object>();
  private lastClock = 0;
  private lastState: GwState | null = null;
  private fogAt = -1;
  private visibleCache = new Set<number>();

  constructor(PIXI: PixiModule, app: Application) {
    this.PIXI = PIXI;
    this.app = app;
    this.tex = createGwTextures(PIXI, app.renderer);
    this.world = new PIXI.Container();
    const ground = new PIXI.Sprite(this.tex.terrain);
    ground.width = GW_LANE_WIDTH;
    ground.height = GW_LANE_LENGTH;
    const resources = new PIXI.Container();
    for (const side of ["player", "enemy"] as GwSide[]) {
      for (const point of [GW_LAYOUT.mainMinerals, GW_LAYOUT.naturalMinerals]) {
        const minerals = this.sprite(this.tex.minerals, 13);
        const p = gwPoint(side, point);
        minerals.position.set(p.x, p.y);
        resources.addChild(minerals);
      }
      for (const point of GW_LAYOUT.geysers) {
        const geyser = this.sprite(this.tex.geyser, 4);
        const p = gwPoint(side, point);
        geyser.position.set(p.x, p.y);
        resources.addChild(geyser);
      }
    }
    this.decals = new PIXI.Container();
    this.underlay = new PIXI.Graphics();
    this.buildingLayer = new PIXI.Container();
    this.unitLayer = new PIXI.Container();
    this.stormLayer = new PIXI.Graphics();
    this.stormLayer.blendMode = "add";
    this.fxLayer = new PIXI.Container();
    this.fog = new PIXI.Graphics();
    // 칸 단위로 그린 안개 경계를 흐려 부드러운 시야 가장자리로 만든다.
    this.fog.filters = [new PIXI.BlurFilter({ strength: 10, quality: 3 })];
    this.rallyFlag = this.sprite(this.tex.flag.player, 2.6);
    this.world.addChild(ground, resources, this.decals, this.underlay, this.buildingLayer, this.rallyFlag, this.unitLayer, this.stormLayer, this.fxLayer, this.fog);
    this.overlay = new PIXI.Container();
    this.bars = new PIXI.Graphics();
    this.overlay.addChild(this.bars);
    for (const [name, y] of [["적 본진", 6], ["적 앞마당", 27], ["중앙", 50], ["앞마당", 73], ["아군 본진", 94]] as [string, number][]) {
      const root = new PIXI.Container();
      const text = new PIXI.Text({ text: name, style: { fontFamily: FONT, fontSize: 12, fontWeight: "800", fill: 0xf3e6c4 } });
      text.anchor.set(0, 0.5);
      const bg = new PIXI.Graphics().roundRect(-6, -10, text.width + 12, 20, 10).fill({ color: 0x1a130b, alpha: 0.72 });
      root.addChild(bg, text);
      this.overlay.addChild(root);
      this.labels.push({ root, text, y });
    }
    app.stage.addChild(this.world, this.overlay);
  }

  resize(width: number, height: number) {
    this.app.renderer.resize(Math.max(1, width), Math.max(1, height));
  }

  destroy() {
    this.app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
  }

  render(state: GwState, view: GwView, ui: GwUi) {
    if (state !== this.lastState) this.reset(state);
    const realDt = Math.min(0.1, Math.max(0, ui.clock - this.lastClock));
    this.lastClock = ui.clock;
    const dt = realDt * ui.timeScale;
    this.world.position.set(view.ox, view.oy);
    this.world.scale.set(view.scale);
    if (state.time - this.fogAt >= 0.25 || state.time < this.fogAt) this.refreshVision(state);
    this.drawUnderlay(state);
    this.syncBuildings(state);
    this.syncUnits(state, realDt);
    this.spawnEffects(state);
    this.drawProjectiles(state);
    this.drawStorms(state, ui.clock);
    this.stepParticles(dt);
    this.stepDecals(dt);
    const rally = gwRallyY("player", ui.rally);
    this.rallyFlag.position.set(GW_LANE_WIDTH / 2 + 7, rally);
    this.drawOverlay(state, view);
    this.app.render();
  }

  /* ───────── 준비 ───────── */

  private reset(state: GwState) {
    this.lastState = state;
    this.processed = new WeakSet<object>();
    this.impacted = new WeakSet<object>();
    for (const view of this.unitViews.values()) view.root.destroy({ children: true });
    for (const view of this.buildingViews.values()) view.root.destroy({ children: true });
    this.unitViews.clear();
    this.buildingViews.clear();
    for (const particle of this.particles) this.release(particle.sprite);
    this.particles.length = 0;
    for (const decal of this.decalList) decal.sprite.destroy();
    this.decalList.length = 0;
    for (const effect of state.effects) this.processed.add(effect);
    this.fogAt = -1;
  }

  private sprite(texture: Texture, size: number) {
    const sprite = new this.PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.scale.set(size / Math.max(texture.width, texture.height));
    return sprite;
  }

  /* ───────── 시야 ───────── */

  private refreshVision(state: GwState) {
    this.fogAt = state.time;
    const g = this.fog;
    g.clear();
    for (let y = 0; y < GW_LANE_LENGTH; y += FOG_CELL) {
      let runStart = -1;
      for (let x = 0; x <= GW_LANE_WIDTH; x += FOG_CELL) {
        const hidden = x < GW_LANE_WIDTH && !gwVisible(state, "player", x + FOG_CELL / 2, y + FOG_CELL / 2, 0.5);
        if (hidden && runStart < 0) runStart = x;
        if (!hidden && runStart >= 0) {
          g.rect(runStart, y, x - runStart, FOG_CELL);
          runStart = -1;
        }
      }
    }
    g.fill({ color: 0x0b0805, alpha: 0.5 });
    this.visibleCache = new Set(state.units.filter((unit) => unit.side === "player" || gwVisible(state, "player", unit.x, unit.y)).map((unit) => unit.id));
  }

  /* ───────── 건물 ───────── */

  private drawUnderlay(state: GwState) {
    const g = this.underlay;
    g.clear();
    for (const building of state.buildings) {
      if (building.side !== "player" || building.type !== "pylon" || !gwDone(building)) continue;
      g.circle(building.x, building.y, 6.5).fill({ color: GW_TEAM.player.glow, alpha: 0.05 }).stroke({ width: 0.15, color: GW_TEAM.player.glow, alpha: 0.25 });
    }
  }

  private syncBuildings(state: GwState) {
    const seen = state.sides.player.seen;
    const alive = new Set<number>();
    const visibleEnemy = new Set<number>();
    for (const building of state.buildings) {
      const own = building.side === "player";
      const remembered = !own && seen[building.id];
      const visibleNow = own || gwVisible(state, "player", building.x, building.y, building.radius);
      if (!own && !visibleNow && !remembered) continue;
      alive.add(building.id);
      if (!own && visibleNow) visibleEnemy.add(building.id);
      let view = this.buildingViews.get(building.id);
      if (!view) view = this.createBuildingView(building);
      const done = gwDone(building);
      view.ghost = !own && !visibleNow;
      view.body.alpha = view.ghost ? 0.5 : done ? 1 : 0.35 + building.progress * 0.5;
      view.body.tint = view.ghost ? 0x9a8f80 : 0xffffff;
      if (view.glow) view.glow.alpha = done && !view.ghost ? 0.22 + Math.sin(state.time * 3 + building.id) * 0.08 : 0;
    }
    for (const [id, view] of this.buildingViews) {
      if (alive.has(id)) continue;
      view.root.destroy({ children: true });
      this.buildingViews.delete(id);
    }
  }

  private createBuildingView(building: GwBuilding): BuildingView {
    const PIXI = this.PIXI;
    const def = GW_BUILDINGS[building.type];
    const root = new PIXI.Container();
    root.position.set(building.x, building.y);
    const shadow = this.sprite(this.tex.shadow, def.size * 1.45);
    shadow.position.set(0.5, 0.8);
    const body = this.sprite(this.tex.buildings[building.side][building.type], def.size);
    let glow: Sprite | null = null;
    root.addChild(shadow);
    if (["nexus", "pylon", "cannon", "gateway"].includes(building.type)) {
      glow = this.sprite(this.tex.soft, def.size * 1.3);
      glow.tint = GW_TEAM[building.side].glow;
      glow.blendMode = "add";
      root.addChild(glow);
    }
    root.addChild(body);
    this.buildingLayer.addChild(root);
    const view = { root, body, glow, ghost: false };
    this.buildingViews.set(building.id, view);
    return view;
  }

  /* ───────── 유닛 ───────── */

  private syncUnits(state: GwState, realDt: number) {
    const alive = new Set<number>();
    const follow = 1 - Math.exp(-realDt * 16);
    for (const unit of state.units) {
      if (!this.visibleCache.has(unit.id) && unit.side !== "player") continue;
      alive.add(unit.id);
      let view = this.unitViews.get(unit.id);
      if (!view) view = this.createUnitView(unit);
      const dx = unit.x - view.x;
      const dy = unit.y - view.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 6) {
        view.x = unit.x;
        view.y = unit.y;
      } else {
        view.x += dx * follow;
        view.y += dy * follow;
      }
      view.root.position.set(view.x, view.y);
      view.heading = turnToward(view.heading, unit.heading, realDt * 10);
      view.body.rotation = view.heading;
      if (distance > 0.04 && unit.type !== "dragoon") view.bob += realDt * 13;
      const base = UNIT_SIZE[unit.type] / Math.max(view.body.texture.width, view.body.texture.height);
      const bob = unit.type === "dragoon" ? 1 + Math.sin(state.time * 6 + unit.id) * 0.02 : 1 + Math.sin(view.bob) * 0.045;
      view.body.scale.set(base * bob, base);
      if (unit.type === "templar") view.glow.alpha = 0.25 + (unit.energy / 200) * 0.45;
    }
    for (const [id, view] of this.unitViews) {
      if (alive.has(id)) continue;
      view.root.destroy({ children: true });
      this.unitViews.delete(id);
    }
  }

  private createUnitView(unit: GwUnit): UnitView {
    const PIXI = this.PIXI;
    const root = new PIXI.Container();
    const shadow = this.sprite(this.tex.shadow, UNIT_SIZE[unit.type] * 1.05);
    shadow.position.set(0.25, 0.4);
    const glow = this.sprite(this.tex.soft, UNIT_SIZE[unit.type] * 1.4);
    glow.tint = GW_TEAM[unit.side].glow;
    glow.blendMode = "add";
    glow.alpha = unit.type === "templar" ? 0.4 : 0.16;
    const body = this.sprite(this.tex.units[unit.side][unit.type], UNIT_SIZE[unit.type]);
    body.rotation = unit.heading;
    root.addChild(shadow, glow, body);
    root.position.set(unit.x, unit.y);
    this.unitLayer.addChild(root);
    const view = { root, body, glow, x: unit.x, y: unit.y, heading: unit.heading, bob: Math.random() * 6 };
    this.unitViews.set(unit.id, view);
    return view;
  }

  /* ───────── 효과 ───────── */

  private visiblePoint(state: GwState, x: number, y: number) {
    return gwVisible(state, "player", x, y, 1);
  }

  private spawnEffects(state: GwState) {
    for (const effect of state.effects) {
      if (this.processed.has(effect)) continue;
      this.processed.add(effect);
      if (effect.side !== "player" && !this.visiblePoint(state, effect.x1, effect.y1) && !this.visiblePoint(state, effect.x2, effect.y2)) continue;
      this.spawnEffect(effect);
    }
  }

  private spawnEffect(effect: GwEffect) {
    const team = GW_TEAM[effect.side];
    if (effect.kind === "slash") {
      for (let i = 0; i < 4; i += 1) this.spark(effect.x2, effect.y2, team.glow, 4, 0.5);
      this.flash(effect.x2, effect.y2, 1.6, 0.1, team.light);
    } else if (effect.kind === "plasma" || effect.kind === "photon") {
      const angle = Math.atan2(effect.y2 - effect.y1, effect.x2 - effect.x1);
      this.flash(effect.x1 + Math.cos(angle) * 1.4, effect.y1 + Math.sin(angle) * 1.4, 1.6, 0.08, team.light);
    } else if (effect.kind === "warp") {
      this.flash(effect.x1, effect.y1, 5, 0.4, team.glow);
      for (let i = 0; i < 8; i += 1) this.spark(effect.x1, effect.y1, team.light, 3, 0.6);
    } else if (effect.kind === "death") {
      const big = (effect.radius ?? 2) > 3;
      this.flash(effect.x1, effect.y1, big ? 5 : 3, 0.18, big ? 0xffd28a : team.glow);
      for (let i = 0; i < (big ? 10 : 6); i += 1) this.spark(effect.x1, effect.y1, big ? 0xffb050 : team.light, big ? 6 : 3.5, 0.6);
      for (let i = 0; i < (big ? 5 : 2); i += 1) this.smoke(effect.x1, effect.y1, big ? 2.4 : 1.4, 1.2);
      this.decal(this.tex.scorch, effect.x1, effect.y1, big ? 4 : 2, big ? 25 : 10, 0.5, 0);
    } else if (effect.kind === "collapse") {
      const radius = effect.radius ?? 4;
      this.flash(effect.x1, effect.y1, radius * 3, 0.22, 0xfff0c0);
      for (let i = 0; i < 16; i += 1) this.spark(effect.x1 + (Math.random() - 0.5) * radius, effect.y1 + (Math.random() - 0.5) * radius, i % 2 ? 0xffb050 : team.glow, 7, 0.8);
      for (let i = 0; i < 8; i += 1) this.smoke(effect.x1 + (Math.random() - 0.5) * radius, effect.y1 + (Math.random() - 0.5) * radius, radius * 1.2, 2.2);
      this.decal(this.tex.rubble, effect.x1, effect.y1, radius * 1.8, 60, 0.95, Math.random() * Math.PI * 2);
      this.decal(this.tex.scorch, effect.x1, effect.y1, radius * 2.6, 60, 0.55, 0);
    }
  }

  private particle(texture: Texture) {
    const sprite = this.particlePool.pop() ?? new this.PIXI.Sprite(texture);
    sprite.texture = texture;
    sprite.anchor.set(0.5);
    sprite.tint = 0xffffff;
    sprite.blendMode = "add";
    sprite.visible = true;
    sprite.alpha = 1;
    this.fxLayer.addChild(sprite);
    return sprite;
  }

  private release(sprite: Sprite) {
    sprite.visible = false;
    sprite.removeFromParent();
    this.particlePool.push(sprite);
  }

  private flash(x: number, y: number, size: number, life: number, tint: number) {
    const sprite = this.particle(this.tex.spark);
    sprite.tint = tint;
    this.particles.push({ sprite, x, y, vx: 0, vy: 0, life, max: life, s0: size / 32, s1: (size * 1.4) / 32, a0: 1, rise: 0 });
  }

  private spark(x: number, y: number, tint: number, speed: number, life: number) {
    const sprite = this.particle(this.tex.spark);
    sprite.tint = tint;
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    this.particles.push({ sprite, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + Math.random() * 0.6), max: life, s0: 0.5 / 32, s1: 0.12 / 32, a0: 1, rise: 0 });
  }

  private smoke(x: number, y: number, size: number, life: number) {
    const sprite = this.particle(this.tex.soft);
    sprite.blendMode = "normal";
    sprite.tint = Math.random() > 0.5 ? 0x5a5048 : 0x3d3630;
    const a = Math.random() * Math.PI * 2;
    this.particles.push({ sprite, x, y, vx: Math.cos(a) * 0.8, vy: Math.sin(a) * 0.5, life: life * (0.7 + Math.random() * 0.5), max: life, s0: size / 64, s1: (size * 2.4) / 64, a0: 0.55, rise: 1.2 });
  }

  private decal(texture: Texture, x: number, y: number, size: number, life: number, alpha: number, rotation: number) {
    const sprite = this.sprite(texture, size);
    sprite.position.set(x, y);
    sprite.rotation = rotation;
    sprite.alpha = alpha;
    this.decals.addChild(sprite);
    this.decalList.push({ sprite, life, max: life, a0: alpha });
    if (this.decalList.length > 50) this.decalList.shift()?.sprite.destroy();
  }

  private drawProjectiles(state: GwState) {
    let used = 0;
    for (const effect of state.effects) {
      if (effect.kind !== "plasma" && effect.kind !== "photon") continue;
      const t = 1 - effect.ttl / effect.max;
      const x = effect.x1 + (effect.x2 - effect.x1) * t;
      const y = effect.y1 + (effect.y2 - effect.y1) * t;
      if (effect.side !== "player" && !this.visiblePoint(state, x, y)) continue;
      let sprite = this.projectilePool[used];
      if (!sprite) {
        sprite = this.sprite(this.tex.spark, 1.4);
        sprite.blendMode = "add";
        this.fxLayer.addChild(sprite);
        this.projectilePool.push(sprite);
      }
      sprite.visible = true;
      sprite.tint = GW_TEAM[effect.side].glow;
      sprite.scale.set((effect.kind === "photon" ? 1.6 : 1.3) / 32);
      sprite.position.set(x, y);
      used += 1;
      if (t > 0.7 && !this.impacted.has(effect)) {
        this.impacted.add(effect);
        this.flash(effect.x2, effect.y2, 1.8, 0.1, GW_TEAM[effect.side].light);
      }
    }
    for (let index = used; index < this.projectilePool.length; index += 1) this.projectilePool[index].visible = false;
  }

  private drawStorms(state: GwState, clock: number) {
    const g = this.stormLayer;
    g.clear();
    for (const storm of state.storms) {
      if (storm.side !== "player" && !this.visiblePoint(state, storm.x, storm.y)) continue;
      const r = GW_STORM.radius;
      const fade = Math.min(1, storm.ttl / 0.4, (GW_STORM.duration - storm.ttl + 0.15) / 0.3);
      g.circle(storm.x, storm.y, r).fill({ color: 0x7a5cff, alpha: 0.22 * fade });
      g.circle(storm.x, storm.y, r).stroke({ width: 0.18, color: 0xc9b8ff, alpha: 0.7 * fade });
      for (let i = 0; i < 7; i += 1) {
        const seed = Math.floor(clock * 14) * 31 + i * 7 + storm.id;
        let a = pseudo(seed) * Math.PI * 2;
        let x = storm.x + Math.cos(a) * r * pseudo(seed + 1) * 0.4;
        let y = storm.y + Math.sin(a) * r * pseudo(seed + 2) * 0.4;
        g.moveTo(x, y);
        for (let k = 0; k < 4; k += 1) {
          a += (pseudo(seed + 3 + k) - 0.5) * 1.6;
          x += Math.cos(a) * r * 0.28;
          y += Math.sin(a) * r * 0.28;
          if (Math.hypot(x - storm.x, y - storm.y) > r) break;
          g.lineTo(x, y);
        }
        g.stroke({ width: 0.14, color: i % 2 ? 0xe6dcff : 0x9f86ff, alpha: 0.95 * fade });
      }
    }
  }

  private stepParticles(dt: number) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const p = this.particles[index];
      p.life -= dt;
      if (p.life <= 0) {
        this.release(p.sprite);
        this.particles.splice(index, 1);
        continue;
      }
      const t = 1 - p.life / p.max;
      p.x += p.vx * dt;
      p.y += p.vy * dt - p.rise * dt;
      p.vx *= 1 - Math.min(1, dt * 3);
      p.vy *= 1 - Math.min(1, dt * 3);
      p.sprite.position.set(p.x, p.y);
      p.sprite.scale.set(p.s0 + (p.s1 - p.s0) * t);
      p.sprite.alpha = p.a0 * (1 - t);
    }
  }

  private stepDecals(dt: number) {
    for (let index = this.decalList.length - 1; index >= 0; index -= 1) {
      const decal = this.decalList[index];
      decal.life -= dt;
      if (decal.life <= 0) {
        decal.sprite.destroy();
        this.decalList.splice(index, 1);
        continue;
      }
      decal.sprite.alpha = decal.a0 * Math.min(1, decal.life / Math.min(6, decal.max));
    }
  }

  /* ───────── 화면 고정 표시 ───────── */

  private drawOverlay(state: GwState, view: GwView) {
    const sx = (x: number) => view.ox + x * view.scale;
    const sy = (y: number) => view.oy + y * view.scale;
    const g = this.bars;
    g.clear();
    const bar = (x: number, y: number, width: number, hp: number, maxHp: number, shields: number, maxShields: number) => {
      const total = maxHp + maxShields;
      g.rect(x - width / 2 - 1, y - 1, width + 2, 5).fill({ color: 0x000000, alpha: 0.65 });
      const hpW = (width * Math.max(0, hp)) / total;
      const shW = (width * Math.max(0, shields)) / total;
      g.rect(x - width / 2, y, hpW, 3).fill(hp / maxHp > 0.4 ? 0x7ce08f : 0xff7a5c);
      g.rect(x - width / 2 + (width * maxHp) / total, y, shW, 3).fill(0x63c6ff);
    };
    for (const building of state.buildings) {
      const view2 = this.buildingViews.get(building.id);
      if (!view2 || view2.ghost) continue;
      const half = (GW_BUILDINGS[building.type].size / 2) * view.scale;
      const x = sx(building.x);
      const y = sy(building.y);
      if (!gwDone(building)) {
        const r = half * 0.8;
        g.moveTo(x + r, y).arc(x, y, r, 0, Math.PI * 2).stroke({ width: 4, color: 0x000000, alpha: 0.5 });
        g.moveTo(x, y - r).arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * building.progress).stroke({ width: 3, color: 0xffe08a });
        continue;
      }
      if (building.hp < building.maxHp || building.shields < building.maxShields * 0.98) bar(x, y - half - 7, Math.max(20, half * 2), building.hp, building.maxHp, building.shields, building.maxShields);
      if (building.side === "player") {
        const progress = building.current ? 1 - building.current.remaining / building.current.total : building.queue.length ? 1 - building.queue[0].remaining / 12 : building.research ? null : null;
        if (progress !== null && progress !== undefined) {
          g.rect(x - half * 0.8, y + half + 2, half * 1.6, 3).fill({ color: 0x000000, alpha: 0.6 });
          g.rect(x - half * 0.8, y + half + 2, half * 1.6 * progress, 3).fill(0xffe08a);
        }
      }
    }
    for (const unit of state.units) {
      const uv = this.unitViews.get(unit.id);
      if (!uv) continue;
      if (unit.hp >= unit.maxHp && unit.shields >= unit.maxShields) continue;
      const x = sx(uv.x);
      const y = sy(uv.y) - (UNIT_SIZE[unit.type] / 2) * view.scale - 5;
      bar(x, y, Math.max(14, UNIT_SIZE[unit.type] * view.scale * 0.8), unit.hp, unit.maxHp, unit.shields, unit.maxShields);
    }
    for (const label of this.labels) {
      label.root.position.set(Math.max(6, sx(0) + 6), sy(label.y));
      label.root.visible = sy(label.y) > -10 && sy(label.y) < view.height + 10;
    }
  }
}

function pseudo(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function turnToward(current: number, target: number, amount: number) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) < 0.001) return target;
  return current + Math.max(-amount, Math.min(amount, delta));
}
