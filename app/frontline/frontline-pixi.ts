// 전선 지휘관 PixiJS 렌더러. 엔진 상태를 읽어 스프라이트, 파티클, 자국(데칼)으로 그린다.
// 상태를 바꾸지 않으며, WebGL을 쓸 수 없으면 화면 쪽에서 기존 2D 렌더러로 돌아간다.
import type { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { FRONTLINE_BUILDINGS, FRONTLINE_MAP_HEIGHT, FRONTLINE_MAP_WIDTH, FRONTLINE_ZONES } from "./frontline-data.js";
import { frontlineBaseAt, frontlineBuildingDone, frontlineMinePosition, frontlineWorkerPoint, frontlineZone } from "./frontline-engine.js";
import { SPRITE_PX, TEAM, createFrontlineTextures, type FrontlineTextureSet } from "./frontline-sprites";
import type { FrontlineBuilding, FrontlineEffect, FrontlineSide, FrontlineState, FrontlineUiState, FrontlineUnit, FrontlineView } from "./frontline-types";

type PixiModule = typeof import("pixi.js");

// 휴대폰 화면에서도 병종이 구분되도록 충돌 반경보다 크게 그린다.
const UNIT_SCALE = { rifle: 1.75, guard: 1.75, tank: 1.3 } as const;
const FONT = "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif";

type UnitView = { root: Container; body: Sprite; turret: Sprite | null; ring: Sprite; x: number; y: number; heading: number; aim: number; bob: number };
type BuildingView = { root: Container; body: Sprite; gun: Sprite | null; scaffold: Sprite; aim: number; smokeAt: number };
type Particle = { sprite: Sprite; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; s0: number; s1: number; a0: number; rise: number; gravity: number };
type Decal = { sprite: Sprite; life: number; max: number; a0: number };
type Label = { root: Container; bg: Graphics; text: Text; owner: string | null };

export async function createFrontlinePixiRenderer(host: HTMLElement, width: number, height: number) {
  const PIXI = await import("pixi.js");
  // CSP가 eval을 막는 환경(예: 아티팩트 페이지)에서도 셰이더 동기화가 동작하도록 eval 없는 구현을 켠다.
  // @ts-expect-error 이 하위 경로는 타입 선언 없이 배포된다.
  await import("pixi.js/unsafe-eval");
  const app = new PIXI.Application();
  await app.init({
    width: Math.max(1, width),
    height: Math.max(1, height),
    antialias: true,
    background: 0x0d1512,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: "webgl",
    autoStart: false,
    sharedTicker: false,
  });
  app.ticker?.stop();
  app.canvas.classList.add("fl-pixi-canvas");
  host.appendChild(app.canvas);
  return new FrontlinePixiRenderer(PIXI, app);
}

export class FrontlinePixiRenderer {
  private readonly PIXI: PixiModule;
  private readonly app: Application;
  private readonly tex: FrontlineTextureSet;
  private readonly world: Container;
  private readonly decals: Container;
  private readonly zoneFx: Graphics;
  private readonly mines: Container;
  private readonly workers: Container;
  private readonly buildingLayer: Container;
  private readonly unitLayer: Container;
  private readonly fxLayer: Container;
  private readonly smokeLayer: Container;
  private readonly overlay: Container;
  private readonly bars: Graphics;
  private readonly guide: Graphics;
  private readonly labels = new Map<string, Label>();
  private readonly badges = new Map<number, Label>();
  private readonly unitViews = new Map<number, UnitView>();
  private readonly buildingViews = new Map<number, BuildingView>();
  private readonly mineViews = new Map<string, { crystal: Sprite; glow: Sprite }>();
  private readonly workerPool: Sprite[] = [];
  private readonly shellPool: { shell: Sprite; shadow: Sprite }[] = [];
  private readonly particles: Particle[] = [];
  private readonly particlePool: Sprite[] = [];
  private readonly decalList: Decal[] = [];
  private processed = new WeakSet<object>();
  private lastClock = 0;
  private lastState: FrontlineState | null = null;

  constructor(PIXI: PixiModule, app: Application) {
    this.PIXI = PIXI;
    this.app = app;
    this.tex = createFrontlineTextures(PIXI, app.renderer);
    this.world = new PIXI.Container();
    const ground = new PIXI.Sprite(this.tex.terrain);
    ground.width = FRONTLINE_MAP_WIDTH;
    ground.height = FRONTLINE_MAP_HEIGHT;
    this.decals = new PIXI.Container();
    this.zoneFx = new PIXI.Graphics();
    this.mines = new PIXI.Container();
    this.workers = new PIXI.Container();
    this.buildingLayer = new PIXI.Container();
    this.unitLayer = new PIXI.Container();
    this.fxLayer = new PIXI.Container();
    this.smokeLayer = new PIXI.Container();
    this.world.addChild(ground, this.decals, this.zoneFx, this.mines, this.workers, this.buildingLayer, this.unitLayer, this.fxLayer, this.smokeLayer);
    this.overlay = new PIXI.Container();
    this.guide = new PIXI.Graphics();
    this.bars = new PIXI.Graphics();
    this.overlay.addChild(this.guide, this.bars);
    app.stage.addChild(this.world, this.overlay);

    for (const zone of FRONTLINE_ZONES) {
      if (zone.mine) {
        const position = frontlineMinePosition(zone.id);
        const glow = new PIXI.Sprite(this.tex.soft);
        glow.anchor.set(0.5);
        glow.tint = 0x46f0dc;
        glow.blendMode = "add";
        glow.position.set(position.x, position.y);
        const crystal = new PIXI.Sprite(this.tex.crystal);
        crystal.anchor.set(0.5);
        crystal.position.set(position.x, position.y);
        this.mines.addChild(glow, crystal);
        this.mineViews.set(zone.id, { crystal, glow });
      }
      this.labels.set(zone.id, this.makeLabel(zone.name, 0xe8e2cf));
    }
    for (const squad of [1, 2, 3]) this.badges.set(squad, this.makeLabel(String(squad), 0xe5f2ff));
  }

  resize(width: number, height: number) {
    this.app.renderer.resize(Math.max(1, width), Math.max(1, height));
  }

  destroy() {
    this.app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
  }

  render(state: FrontlineState, view: FrontlineView, ui: FrontlineUiState) {
    if (state !== this.lastState) this.resetFor(state);
    const realDt = Math.min(0.1, Math.max(0, ui.clock - this.lastClock));
    this.lastClock = ui.clock;
    const dt = realDt * ui.timeScale;
    this.world.position.set(view.ox, view.oy);
    this.world.scale.set(view.scale);

    this.drawZones(state, ui);
    this.syncMines(state, ui);
    this.syncWorkers(state, ui);
    this.syncBuildings(state, dt, ui);
    this.syncUnits(state, realDt, ui);
    this.spawnEffects(state);
    this.drawShells(state);
    this.stepParticles(dt);
    this.stepDecals(dt);
    this.drawOverlay(state, view, ui);
    this.app.render();
  }

  /* ───────── 준비 ───────── */

  private resetFor(state: FrontlineState) {
    this.lastState = state;
    this.processed = new WeakSet<object>();
    for (const view of this.unitViews.values()) view.root.destroy({ children: true });
    for (const view of this.buildingViews.values()) view.root.destroy({ children: true });
    this.unitViews.clear();
    this.buildingViews.clear();
    for (const particle of this.particles) this.releaseParticle(particle.sprite);
    this.particles.length = 0;
    for (const decal of this.decalList) decal.sprite.destroy();
    this.decalList.length = 0;
    // 새 전투 시작 전에 이미 남아 있던 효과는 다시 터뜨리지 않는다.
    for (const effect of state.effects) this.processed.add(effect);
  }

  private makeLabel(text: string, color: number): Label {
    const PIXI = this.PIXI;
    const root = new PIXI.Container();
    const bg = new PIXI.Graphics();
    const label = new PIXI.Text({ text, style: { fontFamily: FONT, fontSize: 12, fontWeight: "800", fill: color } });
    label.anchor.set(0.5);
    root.addChild(bg, label);
    this.overlay.addChild(root);
    return { root, bg, text: label, owner: "unset" };
  }

  private sprite(texture: Texture, scale = 1 / SPRITE_PX) {
    const sprite = new this.PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.scale.set(scale);
    return sprite;
  }

  /* ───────── 지역과 광산 ───────── */

  private drawZones(state: FrontlineState, ui: FrontlineUiState) {
    const g = this.zoneFx;
    g.clear();
    for (const zone of FRONTLINE_ZONES) {
      const owner = frontlineBaseAt(state, zone.id)?.side as FrontlineSide | undefined;
      if (owner) {
        g.circle(zone.x, zone.y, zone.radius).fill({ color: TEAM[owner].main, alpha: 0.07 });
        g.circle(zone.x, zone.y, zone.radius).stroke({ width: 0.35, color: TEAM[owner].main, alpha: 0.7 });
      } else {
        g.circle(zone.x, zone.y, zone.radius).stroke({ width: 0.22, color: 0xf4ecd0, alpha: 0.25 });
      }
      if (ui.selectedZone === zone.id) {
        const pulse = 0.5 + Math.sin(ui.clock * 5) * 0.5;
        g.circle(zone.x, zone.y, zone.radius + 0.9 + pulse * 0.6).stroke({ width: 0.45, color: 0xffe47a, alpha: 0.55 + pulse * 0.4 });
      }
    }
  }

  private syncMines(state: FrontlineState, ui: FrontlineUiState) {
    for (const zone of FRONTLINE_ZONES) {
      const view = this.mineViews.get(zone.id);
      if (!view) continue;
      const remaining = Math.max(0, state.zones[zone.id].ore / zone.mine);
      const size = (0.85 + remaining * 0.8) / SPRITE_PX;
      view.crystal.scale.set(size * 1.2);
      view.crystal.alpha = remaining > 0 ? 1 : 0.25;
      const shimmer = 0.5 + Math.sin(ui.clock * 2.4 + zone.x) * 0.5;
      view.glow.scale.set((7 + shimmer) / 64);
      view.glow.alpha = remaining > 0 ? 0.18 + shimmer * 0.12 : 0;
    }
  }

  private syncWorkers(state: FrontlineState, ui: FrontlineUiState) {
    let used = 0;
    const take = (side: FrontlineSide) => {
      let sprite = this.workerPool[used];
      if (!sprite) {
        sprite = this.sprite(this.tex.units.player.worker, 1.5 / SPRITE_PX);
        this.workerPool.push(sprite);
        this.workers.addChild(sprite);
      }
      sprite.texture = this.tex.units[side].worker;
      sprite.visible = true;
      used += 1;
      return sprite;
    };
    for (const side of ["player", "enemy"] as FrontlineSide[]) {
      const record = state.sides[side];
      for (const [zoneId, count] of Object.entries(record.workers)) {
        if (!count) continue;
        const base = frontlineBaseAt(state, zoneId);
        if (!base) continue;
        const mine = frontlineMinePosition(zoneId);
        const shown = Math.min(count, 12);
        for (let index = 0; index < shown; index += 1) {
          const phase = (ui.clock * 0.3 + index / shown) % 1;
          const outbound = phase < 0.5;
          const t = outbound ? phase * 2 : 2 - phase * 2;
          const lane = ((index % 5) - 2) * 0.55;
          const dx = mine.x - base.x;
          const dy = mine.y - base.y;
          const length = Math.hypot(dx, dy) || 1;
          const sprite = take(side);
          sprite.position.set(base.x + dx * (0.3 + t * 0.55) - (dy / length) * lane, base.y + dy * (0.3 + t * 0.55) + (dx / length) * lane);
          sprite.rotation = Math.atan2(dy, dx) + (outbound ? 0 : Math.PI);
        }
      }
      for (const trip of record.transit) {
        const from = frontlineWorkerPoint(state, trip.from);
        const to = frontlineZone(trip.to);
        const t = Math.min(1, Math.max(0, (state.time - trip.start) / Math.max(0.1, trip.eta - trip.start)));
        const sprite = take(side);
        sprite.position.set(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
        sprite.rotation = Math.atan2(to.y - from.y, to.x - from.x);
      }
    }
    for (let index = used; index < this.workerPool.length; index += 1) this.workerPool[index].visible = false;
  }

  /* ───────── 건물 ───────── */

  private syncBuildings(state: FrontlineState, dt: number, ui: FrontlineUiState) {
    const alive = new Set<number>();
    const byId = new Map<number | string, { x: number; y: number }>();
    for (const unit of state.units) byId.set(unit.id, unit);
    for (const building of state.buildings) {
      alive.add(building.id);
      let view = this.buildingViews.get(building.id);
      if (!view) view = this.createBuildingView(building);
      const done = frontlineBuildingDone(building);
      view.body.alpha = done ? 1 : 0.4 + building.progress * 0.45;
      view.scaffold.visible = !done;
      if (view.gun) {
        view.gun.visible = done;
        const target = building.targetId !== null ? byId.get(building.targetId) : null;
        const desired = target ? Math.atan2(target.y - building.y, target.x - building.x) : view.aim;
        view.aim = turnToward(view.aim, desired, dt * 6 + (target ? 0 : 0));
        view.gun.rotation = view.aim;
      }
      if (building.type === "factory" && done && building.queue.length && ui.clock >= view.smokeAt && dt > 0) {
        view.smokeAt = ui.clock + 0.35;
        this.smoke(building.x + 1.75, building.y - 1.4, 0.9, 1.6, 0x6b6f74);
      }
    }
    for (const [id, view] of this.buildingViews) {
      if (alive.has(id)) continue;
      view.root.destroy({ children: true });
      this.buildingViews.delete(id);
    }
  }

  private createBuildingView(building: FrontlineBuilding): BuildingView {
    const PIXI = this.PIXI;
    const def = FRONTLINE_BUILDINGS[building.type];
    const root = new PIXI.Container();
    root.position.set(building.x, building.y);
    const shadow = this.sprite(this.tex.shadow, (def.size * 1.5) / 64);
    shadow.position.set(0.55, 0.75);
    const body = this.sprite(this.tex.buildings[building.side][building.type]);
    const scaffold = this.sprite(this.tex.scaffold, def.size / 64);
    let gun: Sprite | null = null;
    root.addChild(shadow, body);
    if (building.type === "turret") {
      gun = this.sprite(this.tex.buildings[building.side].turretGun);
      root.addChild(gun);
    }
    root.addChild(scaffold);
    this.buildingLayer.addChild(root);
    const view = { root, body, gun, scaffold, aim: building.side === "player" ? -Math.PI / 2 : Math.PI / 2, smokeAt: 0 };
    this.buildingViews.set(building.id, view);
    return view;
  }

  /* ───────── 유닛 ───────── */

  private syncUnits(state: FrontlineState, realDt: number, ui: FrontlineUiState) {
    const alive = new Set<number>();
    const targets = new Map<number | string, { x: number; y: number }>();
    for (const unit of state.units) targets.set(unit.id, unit);
    for (const building of state.buildings) targets.set(building.id, building);
    const follow = 1 - Math.exp(-realDt * 16);
    for (const unit of state.units) {
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
      const moving = distance > 0.05;
      view.root.position.set(view.x, view.y);
      view.heading = turnToward(view.heading, unit.heading, realDt * 10);
      view.body.rotation = view.heading;
      if (moving && unit.type !== "tank") view.bob += realDt * 14;
      const base = UNIT_SCALE[unit.type] / SPRITE_PX;
      const bob = unit.type === "tank" ? 1 : 1 + Math.sin(view.bob) * 0.05;
      view.body.scale.set(base * bob, base);
      if (view.turret) {
        const target = unit.targetId !== null ? targets.get(unit.targetId) : null;
        const desired = target ? Math.atan2(target.y - unit.y, target.x - unit.x) : view.heading;
        view.aim = turnToward(view.aim, desired, realDt * 5);
        view.turret.rotation = view.aim;
      }
      view.ring.visible = unit.side === "player" && unit.squad === ui.selectedSquad;
      if (view.ring.visible) view.ring.alpha = 0.6 + Math.sin(ui.clock * 6) * 0.25;
    }
    for (const [id, view] of this.unitViews) {
      if (alive.has(id)) continue;
      view.root.destroy({ children: true });
      this.unitViews.delete(id);
    }
  }

  private createUnitView(unit: FrontlineUnit): UnitView {
    const PIXI = this.PIXI;
    const root = new PIXI.Container();
    const shadow = this.sprite(this.tex.shadow, (unit.radius * 3.4) / 64);
    shadow.position.set(0.25, 0.35);
    const ring = this.sprite(this.tex.ring, (unit.radius * 2.8 + 1.2) / 64);
    ring.tint = 0xffe47a;
    const body = this.sprite(this.tex.units[unit.side][unit.type], UNIT_SCALE[unit.type] / SPRITE_PX);
    body.rotation = unit.heading;
    root.addChild(shadow, ring, body);
    let turret: Sprite | null = null;
    if (unit.type === "tank") {
      turret = this.sprite(this.tex.units[unit.side].tankTurret, UNIT_SCALE.tank / SPRITE_PX);
      turret.rotation = unit.heading;
      root.addChild(turret);
    }
    root.position.set(unit.x, unit.y);
    this.unitLayer.addChild(root);
    const view = { root, body, turret, ring, x: unit.x, y: unit.y, heading: unit.heading, aim: unit.heading, bob: Math.random() * 6 };
    this.unitViews.set(unit.id, view);
    return view;
  }

  /* ───────── 효과 ───────── */

  private spawnEffects(state: FrontlineState) {
    for (const effect of state.effects) {
      if (this.processed.has(effect)) continue;
      this.processed.add(effect);
      this.spawnEffect(effect);
    }
  }

  private spawnEffect(effect: FrontlineEffect) {
    const team = TEAM[effect.side];
    const angle = Math.atan2(effect.y2 - effect.y1, effect.x2 - effect.x1);
    if (effect.kind === "shot") {
      const length = Math.hypot(effect.x2 - effect.x1, effect.y2 - effect.y1);
      const tracer = this.particle(this.tex.tracer, this.fxLayer);
      tracer.anchor.set(1, 0.5);
      tracer.rotation = angle;
      tracer.tint = effect.side === "player" ? 0xd8f0ff : 0xffd27a;
      tracer.blendMode = "add";
      this.particles.push({ sprite: tracer, x: effect.x2, y: effect.y2, z: 0, vx: 0, vy: 0, vz: 0, life: 0.13, max: 0.13, s0: 0, s1: 0, a0: 0.95, rise: 0, gravity: 0 });
      tracer.scale.set(length / 64, 0.18 / 4);
      this.flash(effect.x1 + Math.cos(angle) * 1.2, effect.y1 + Math.sin(angle) * 1.2, 0.9, 0.06, 0xfff2b0);
      this.flash(effect.x2, effect.y2, 0.5, 0.08, 0xffd9a0);
    } else if (effect.kind === "slash") {
      for (let i = 0; i < 3; i += 1) this.spark(effect.x2, effect.y2, 0xfff0c0, 3);
    } else if (effect.kind === "shell") {
      this.flash(effect.x1 + Math.cos(angle) * 2.6, effect.y1 + Math.sin(angle) * 2.6, 2.2, 0.09, 0xffe2a0);
      this.smoke(effect.x1 + Math.cos(angle) * 2.8, effect.y1 + Math.sin(angle) * 2.8, 1.2, 0.9, 0x9a9890);
    } else if (effect.kind === "boom") {
      this.explosion(effect.x1, effect.y1, effect.radius ?? 2.4, team.main);
      this.decal(this.tex.scorch, effect.x1, effect.y1, (effect.radius ?? 2.4) * 2.2, 40, 0.65, Math.random() * Math.PI);
    } else if (effect.kind === "death") {
      const radius = effect.radius ?? 2;
      if (radius > 3.2) {
        this.explosion(effect.x1, effect.y1, 2.8, team.main);
        this.decal(this.tex.wreck, effect.x1, effect.y1, 4.4, 30, 0.85, Math.random() * Math.PI * 2);
      } else {
        for (let i = 0; i < 4; i += 1) this.smoke(effect.x1, effect.y1, 0.9, 0.7, 0xb3a07c);
        this.decal(this.tex.scorch, effect.x1, effect.y1, 1.6, 14, 0.4, 0);
      }
    } else if (effect.kind === "collapse") {
      const radius = effect.radius ?? 4;
      this.explosion(effect.x1, effect.y1, radius * 1.4, team.main);
      for (let i = 0; i < 3; i += 1) this.explosion(effect.x1 + (Math.random() - 0.5) * radius, effect.y1 + (Math.random() - 0.5) * radius, radius * 0.7, team.main);
      this.decal(this.tex.rubble, effect.x1, effect.y1, radius * 1.6, 60, 0.95, Math.random() * Math.PI * 2);
      this.decal(this.tex.scorch, effect.x1, effect.y1, radius * 2.6, 60, 0.6, 0);
    }
  }

  private particle(texture: Texture, layer: Container) {
    const sprite = this.particlePool.pop() ?? new this.PIXI.Sprite(texture);
    sprite.texture = texture;
    sprite.anchor.set(0.5);
    sprite.rotation = 0;
    sprite.tint = 0xffffff;
    sprite.blendMode = "normal";
    sprite.visible = true;
    sprite.alpha = 1;
    layer.addChild(sprite);
    return sprite;
  }

  private releaseParticle(sprite: Sprite) {
    sprite.visible = false;
    sprite.removeFromParent();
    this.particlePool.push(sprite);
  }

  private flash(x: number, y: number, size: number, life: number, tint: number) {
    const sprite = this.particle(this.tex.spark, this.fxLayer);
    sprite.tint = tint;
    sprite.blendMode = "add";
    this.particles.push({ sprite, x, y, z: 0, vx: 0, vy: 0, vz: 0, life, max: life, s0: size / 32, s1: (size * 1.4) / 32, a0: 1, rise: 0, gravity: 0 });
  }

  private spark(x: number, y: number, tint: number, speed: number) {
    const sprite = this.particle(this.tex.spark, this.fxLayer);
    sprite.tint = tint;
    sprite.blendMode = "add";
    const a = Math.random() * Math.PI * 2;
    this.particles.push({ sprite, x, y, z: 0, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, vz: 0, life: 0.18, max: 0.18, s0: 0.45 / 32, s1: 0.1 / 32, a0: 1, rise: 0, gravity: 0 });
  }

  private smoke(x: number, y: number, size: number, life: number, tint: number) {
    const sprite = this.particle(this.tex.soft, this.smokeLayer);
    sprite.tint = tint;
    const a = Math.random() * Math.PI * 2;
    this.particles.push({ sprite, x, y, z: 0, vx: Math.cos(a) * 0.6 + 0.35, vy: Math.sin(a) * 0.4, vz: 0, life: life * (0.8 + Math.random() * 0.4), max: life, s0: size / 64, s1: (size * 2.6) / 64, a0: 0.5, rise: 1.4, gravity: 0 });
  }

  private explosion(x: number, y: number, radius: number, tint: number) {
    this.flash(x, y, radius * 2.2, 0.16, 0xfff6d0);
    for (let i = 0; i < 8; i += 1) {
      const sprite = this.particle(this.tex.soft, this.fxLayer);
      sprite.tint = i % 3 === 0 ? 0xffd25a : i % 3 === 1 ? 0xff8a2a : 0xff5a1f;
      sprite.blendMode = "add";
      const a = Math.random() * Math.PI * 2;
      const speed = radius * (1 + Math.random() * 1.6);
      this.particles.push({ sprite, x, y, z: 0, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, vz: 0, life: 0.35 + Math.random() * 0.25, max: 0.6, s0: (radius * 0.9) / 64, s1: (radius * 2.2) / 64, a0: 0.9, rise: 0, gravity: 0 });
    }
    for (let i = 0; i < 6; i += 1) this.smoke(x + (Math.random() - 0.5) * radius, y + (Math.random() - 0.5) * radius, radius * 1.2, 1.4 + Math.random(), i % 2 ? 0x55575a : 0x3e4043);
    for (let i = 0; i < 7; i += 1) {
      const sprite = this.particle(this.tex.soft, this.fxLayer);
      sprite.tint = i % 2 ? 0x2a2420 : tint;
      const a = Math.random() * Math.PI * 2;
      const speed = radius * (1.5 + Math.random() * 2);
      this.particles.push({ sprite, x, y, z: 0, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, vz: 6 + Math.random() * 6, life: 0.7, max: 0.7, s0: 0.5 / 64, s1: 0.4 / 64, a0: 1, rise: 0, gravity: 26 });
    }
  }

  private decal(texture: Texture, x: number, y: number, size: number, life: number, alpha: number, rotation: number) {
    const sprite = new this.PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.rotation = rotation;
    sprite.scale.set(size / Math.max(texture.width, texture.height));
    sprite.alpha = alpha;
    this.decals.addChild(sprite);
    this.decalList.push({ sprite, life, max: life, a0: alpha });
    if (this.decalList.length > 60) {
      const old = this.decalList.shift();
      old?.sprite.destroy();
    }
  }

  private drawShells(state: FrontlineState) {
    let used = 0;
    for (const effect of state.effects) {
      if (effect.kind !== "shell") continue;
      let entry = this.shellPool[used];
      if (!entry) {
        const shadow = this.sprite(this.tex.shadow, 0.9 / 64);
        const shell = this.sprite(this.tex.shell, 1.1 / 24);
        shell.blendMode = "add";
        this.fxLayer.addChild(shadow, shell);
        entry = { shell, shadow };
        this.shellPool.push(entry);
      }
      const t = 1 - effect.ttl / effect.max;
      const x = effect.x1 + (effect.x2 - effect.x1) * t;
      const y = effect.y1 + (effect.y2 - effect.y1) * t;
      entry.shadow.position.set(x, y);
      entry.shell.position.set(x, y - Math.sin(t * Math.PI) * 4);
      entry.shell.visible = true;
      entry.shadow.visible = true;
      used += 1;
    }
    for (let index = used; index < this.shellPool.length; index += 1) {
      this.shellPool[index].shell.visible = false;
      this.shellPool[index].shadow.visible = false;
    }
  }

  private stepParticles(dt: number) {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const p = this.particles[index];
      p.life -= dt;
      if (p.life <= 0) {
        this.releaseParticle(p.sprite);
        this.particles.splice(index, 1);
        continue;
      }
      const t = 1 - p.life / p.max;
      p.x += p.vx * dt;
      p.y += p.vy * dt - p.rise * dt;
      p.vx *= 1 - Math.min(1, dt * 3);
      p.vy *= 1 - Math.min(1, dt * 3);
      if (p.gravity) {
        p.vz -= p.gravity * dt;
        p.z = Math.max(0, p.z + p.vz * dt);
      }
      p.sprite.position.set(p.x, p.y - p.z * 0.3);
      if (p.s0 || p.s1) p.sprite.scale.set(p.s0 + (p.s1 - p.s0) * t);
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

  private drawOverlay(state: FrontlineState, view: FrontlineView, ui: FrontlineUiState) {
    const sx = (x: number) => view.ox + x * view.scale;
    const sy = (y: number) => view.oy + y * view.scale;
    const bars = this.bars;
    const guide = this.guide;
    bars.clear();
    guide.clear();
    const bar = (x: number, y: number, width: number, ratio: number, color: number) => {
      bars.rect(x - width / 2 - 1, y - 1, width + 2, 5).fill({ color: 0x000000, alpha: 0.65 });
      bars.rect(x - width / 2, y, width * Math.max(0, Math.min(1, ratio)), 3).fill(color);
    };
    for (const building of state.buildings) {
      const def = FRONTLINE_BUILDINGS[building.type];
      const half = (def.size / 2) * view.scale;
      const x = sx(building.x);
      const y = sy(building.y);
      if (!frontlineBuildingDone(building)) {
        const r = half * 0.8;
        bars.moveTo(x + r, y).arc(x, y, r, 0, Math.PI * 2).stroke({ width: 4, color: 0x000000, alpha: 0.5 });
        bars.moveTo(x, y - r).arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * building.progress).stroke({ width: 3, color: 0xffe48a });
        continue;
      }
      if (building.hp < building.maxHp * 0.98) bar(x, y - half - 7, Math.max(18, half * 2), building.hp / building.maxHp, building.hp / building.maxHp > 0.4 ? 0x71e08a : 0xff7a5c);
      if (building.queue.length) {
        const item = building.queue[0];
        const total = item.unit === "worker" ? 12 : item.unit === "rifle" ? 16 : item.unit === "guard" ? 20 : 30;
        bar(x, y + half + 3, Math.max(18, half * 1.6), 1 - item.remaining / total, 0xffe48a);
      }
    }
    for (const unit of state.units) {
      if (unit.hp >= unit.maxHp) continue;
      const v = this.unitViews.get(unit.id);
      const x = sx(v?.x ?? unit.x);
      const y = sy(v?.y ?? unit.y) - unit.radius * view.scale - 6;
      bar(x, y, Math.max(12, unit.radius * 2.4 * view.scale), unit.hp / unit.maxHp, unit.hp / unit.maxHp > 0.4 ? 0x71e08a : 0xff7a5c);
    }

    const record = state.sides.player;
    for (const [squadId, badge] of this.badges) {
      const units = state.units.filter((unit) => unit.side === "player" && unit.squad === squadId);
      badge.root.visible = units.length > 0;
      if (!units.length) continue;
      const cx = units.reduce((sum, unit) => sum + (this.unitViews.get(unit.id)?.x ?? unit.x), 0) / units.length;
      const cy = units.reduce((sum, unit) => sum + (this.unitViews.get(unit.id)?.y ?? unit.y), 0) / units.length;
      const selected = squadId === ui.selectedSquad;
      const squad = record.squads[squadId as 1 | 2 | 3];
      if (selected && units.some((unit) => unit.mode === "travel")) {
        const target = frontlineZone(squad.zone);
        dashed(guide, sx(cx), sy(cy), sx(target.x), sy(target.y), squad.order === "attack" ? 0xff9a7a : 0x9fd5ff, ui.clock);
        guide.circle(sx(target.x), sy(target.y), 7).stroke({ width: 2, color: squad.order === "attack" ? 0xff9a7a : 0x9fd5ff });
      }
      const key = selected ? "selected" : "idle";
      if (badge.owner !== key) {
        badge.owner = key;
        badge.bg.clear().roundRect(-11, -9, 22, 18, 6).fill({ color: selected ? 0xffe48a : 0x0f1a24, alpha: selected ? 1 : 0.88 }).stroke({ width: 1.5, color: selected ? 0x7a5a00 : 0x4aa8ff });
        badge.text.style.fill = selected ? 0x2b2100 : 0xe5f2ff;
      }
      badge.root.position.set(sx(cx), sy(cy) - 14 - view.scale * 2);
    }

    for (const zone of FRONTLINE_ZONES) {
      const label = this.labels.get(zone.id);
      if (!label) continue;
      const owner = (frontlineBaseAt(state, zone.id)?.side as FrontlineSide | undefined) ?? null;
      if (label.owner !== owner) {
        label.owner = owner;
        label.text.style.fill = owner ? TEAM[owner].light : 0xe8e2cf;
        const width = label.text.width + 14;
        label.bg.clear().roundRect(-width / 2, -9.5, width, 19, 9.5).fill({ color: 0x0b1110, alpha: 0.82 }).stroke({ width: 1, color: owner ? TEAM[owner].main : 0xffffff, alpha: owner ? 0.7 : 0.15 });
      }
      const offset = zone.id === "home" ? -zone.radius - 2.5 : zone.id === "enemy" ? zone.radius + 2.5 : (zone.y < FRONTLINE_MAP_HEIGHT / 2 ? -1 : 1) * (zone.radius + 2.5);
      label.root.position.set(sx(zone.x), sy(zone.y + offset));
    }

    if (view.maxTop) {
      const visible = view.height / view.scale;
      const track = view.height - 16;
      const thumb = Math.max(28, (visible / FRONTLINE_MAP_HEIGHT) * track);
      const y = 8 + (view.top / view.maxTop) * (track - thumb);
      guide.roundRect(view.width - 7, 8, 4, track, 2).fill({ color: 0xffffff, alpha: 0.08 });
      guide.roundRect(view.width - 7, y, 4, thumb, 2).fill({ color: 0xf2c55c, alpha: 0.7 });
    }
  }
}

function turnToward(current: number, target: number, amount: number) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const step = Math.max(-amount, Math.min(amount, delta));
  return current + (Math.abs(delta) < 0.001 ? delta : step);
}

function dashed(g: Graphics, x1: number, y1: number, x2: number, y2: number, color: number, clock: number) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < 1) return;
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  const dash = 6;
  const offset = (clock * 20) % (dash * 2);
  for (let d = -offset; d < length; d += dash * 2) {
    const a = Math.max(0, d);
    const b = Math.min(length, d + dash);
    if (b <= a) continue;
    g.moveTo(x1 + ux * a, y1 + uy * a).lineTo(x1 + ux * b, y1 + uy * b);
  }
  g.stroke({ width: 1.6, color, alpha: 0.9 });
}
