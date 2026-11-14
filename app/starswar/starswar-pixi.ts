// 스타드래프트 PixiJS 렌더러. 엔진 상태를 읽기만 하며, 플레이어 시야 밖의 적은 감춘다.
import type { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { STW_BUILDINGS, STW_ECONOMY, STW_LANE_LENGTH, STW_LANE_WIDTH, STW_MAPS, STW_STORM, STW_UNITS, stwMapData } from "./starswar-data.js";
import { stwArmy, stwDetected, stwDone, stwIsCloaked, stwMap, stwNexus, stwPoint, stwRace, stwRallyY, stwVisible, stwWorkerSplit } from "./starswar-engine.js";
import { STW_TEAM, createStwTextures, stwTerrainTexture, type StwTextureSet } from "./starswar-sprites";
import type { StwBuilding, StwEffect, StwMapData, StwSide, StwState, StwUi, StwUnit, StwUnitType, StwView } from "./starswar-types";

type MapData = StwMapData;

type PixiModule = typeof import("pixi.js");

let stwPixiModulePromise: Promise<PixiModule> | null = null;

function loadStwPixiModule() {
  if (!stwPixiModulePromise) {
    stwPixiModulePromise = import("pixi.js").then(async (PIXI) => {
      // CSP가 eval을 막는 환경에서도 동작하도록 eval 없는 구현을 켠다.
      // @ts-expect-error 이 하위 경로는 타입 선언 없이 배포된다.
      await import("pixi.js/unsafe-eval");
      return PIXI;
    }).catch((error) => {
      stwPixiModulePromise = null;
      throw error;
    });
  }
  return stwPixiModulePromise;
}

/** 메뉴가 보이는 동안 대형 Pixi 청크를 미리 받아 첫 전투의 빈 지도를 줄인다. */
export function preloadStwPixiRenderer() {
  return loadStwPixiModule();
}

const UNIT_SIZE: Record<StwUnitType, number> = {
  zealot: 3.4, dragoon: 3.9, templar: 3.1, probe: 1.9, dark: 3.3, archon: 4.8, darkArchon: 4.8, observer: 2.4, shuttle: 3.8, reaver: 4.6, scout: 3.8, corsair: 3.1, carrier: 6.4, arbiter: 4.8,
  scv: 1.9, marine: 2.6, firebat: 2.9, medic: 2.5, ghost: 2.6, vulture: 3.6, tank: 4.4, goliath: 3.6, wraith: 3.5, dropship: 4, vessel: 4.4, valkyrie: 4, battlecruiser: 6.8,
  drone: 1.9, zergling: 2.1, hydra: 3, lurker: 3.6, ultra: 5, overlord: 3.6, mutalisk: 3.4, scourge: 2, guardian: 4.6, devourer: 4.2, queen: 3.8, defiler: 3.2, infested: 2.4, broodling: 1.6,
};
/** 다리 대신 바퀴·궤도·부양으로 움직여 걸음 흔들림이 없는 유닛. */
type Flags = { refinery?: boolean; worker?: boolean; flying?: boolean };
const flags = (def: object) => def as Flags;
const NO_BOB = new Set<StwUnitType>(["dragoon", "vulture", "tank", "overlord", "scout", "corsair", "wraith", "mutalisk", "scourge", "darkArchon", "shuttle", "carrier", "arbiter",
  "dropship", "vessel", "valkyrie", "battlecruiser", "guardian", "devourer", "queen"]);
/** 떠 있는 유닛: 그림자를 멀리 떨어뜨리고 몸이 천천히 떠오르내린다. */
const isFlyingType = (type: StwUnitType) => Boolean((STW_UNITS[type] as { flying?: boolean }).flying);
/** 포탑 텍스처(여백 40)와 차체 텍스처(여백 34)의 크기 비. */
const TURRET_RATIO = 40 / 34;
/** 지금 은폐 상태인지(엔진 판정: 연구·아비터 은폐장·땅속 럴커, 인스네어에 걸리면 드러남). */
const isCloaked = (unit: StwUnit, state: StwState) => stwIsCloaked(state, unit);
/** 상태 이상 색: 스테이시스(하늘), 정지(보라), 인스네어(연두), 플레이그(탁한 초록), 이레디에이트(밝은 초록). */
function statusTint(state: StwState, unit: StwUnit) {
  if ((unit.stasisUntil ?? 0) > state.time) return 0x9fe8ff;
  if ((unit.stunUntil ?? 0) > state.time) return 0xb495ff;
  if ((unit.irradiateUntil ?? 0) > state.time) return 0x9dff8a;
  if ((unit.plagueUntil ?? 0) > state.time) return 0xb8c46a;
  if ((unit.ensnareUntil ?? 0) > state.time) return 0xe2e88a;
  return 0xffffff;
}
const FONT = "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif";
const FOG_CELL = 2;

type UnitView = { root: Container; body: Sprite; glow: Sprite; ring: Sprite; hp: number; shields: number; flash: number; flashColor: number; jitter: number; lunge: number; lungeAngle: number; turret: Sprite | null; aim: number; sieged: boolean; x: number; y: number; heading: number; bob: number };
type BuildingView = { root: Container; body: Sprite; glow: Sprite | null; ghost: boolean; lair: boolean; pulse: number };
type Particle = { sprite: Sprite; x: number; y: number; vx: number; vy: number; life: number; max: number; s0: number; s1: number; a0: number; rise: number };
type Decal = { sprite: Sprite; life: number; max: number; a0: number };
type WorkerView = { root: Container; body: Sprite; cargo: Sprite };
type Badge = { root: Container; bg: Graphics; text: Text; key: string };

const WORKER_SIZE = 1.6;
/** 지역 이름을 보여 주는 경기 시간(초). */
const AREA_LABEL_SECONDS = 20;
const MINE_CYCLE = 3.4;
const GAS_CYCLE = 3;

export async function createStwPixiRenderer(host: HTMLElement, width: number, height: number) {
  const PIXI = await loadStwPixiModule();
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
  app.canvas.classList.add("stw-pixi-canvas");
  host.appendChild(app.canvas);
  return new StwPixiRenderer(PIXI, app);
}

export class StwPixiRenderer {
  private readonly PIXI: PixiModule;
  private readonly app: Application;
  private readonly tex: StwTextureSet;
  private readonly world: Container;
  private readonly decals: Container;
  private readonly underlay: Graphics;
  private readonly buildingLayer: Container;
  private readonly unitLayer: Container;
  private readonly fxLayer: Container;
  private readonly stormLayer: Graphics;
  /** 땅에 남는 구역(다크 스웜). 유닛 위를 덮는 구름이라 유닛 층 바로 위에, 어두운 색이 보이도록 더하기 섞기 없이 그린다. */
  private readonly zoneLayer: Graphics;
  private readonly beamLayer: Graphics;
  private readonly tentacleLayer: Graphics;
  private readonly interceptorLayer: Graphics;
  /** 비어 있는 가스 간헐천에서 피어오르는 김. */
  private readonly steamLayer: Graphics;
  private readonly fog: Graphics;
  private readonly overlay: Container;
  private readonly bars: Graphics;
  private readonly rallyFlag: Sprite;
  private readonly flagScale: number;
  private readonly rallyLabel: { root: Container; bg: Graphics; text: Text; key: string };
  private lastRally: StwUi["rally"] | null = null;
  private flagPulse = 0;
  /** 화면 흔들림 세기(0~1). 큰 폭발과 건물 붕괴 때 올라가고 금방 가라앉는다. */
  private shake = 0;
  private readonly labels: { root: Container; text: Text; y: number }[] = [];
  private readonly unitViews = new Map<number, UnitView>();
  private readonly buildingViews = new Map<number, BuildingView>();
  private readonly projectilePool: Sprite[] = [];
  private readonly particles: Particle[] = [];
  private readonly particlePool: Sprite[] = [];
  private readonly decalList: Decal[] = [];
  private readonly workerLayer: Container;
  private readonly workerPool: WorkerView[] = [];
  private readonly repairLayer: Container;
  private readonly repairPool: WorkerView[] = [];
  private readonly badges = new Map<string, Badge>();
  private processed = new WeakSet<object>();
  private impacted = new WeakSet<object>();
  private lastClock = 0;
  private lastState: StwState | null = null;
  private ground!: Sprite;
  private resources!: Container;
  private readonly terrains = new Map<string, Texture>();
  private map = STW_MAPS.plain as MapData;
  private mapId = "";
  private fogAt = -1;
  private visibleCache = new Set<number>();

  constructor(PIXI: PixiModule, app: Application) {
    this.PIXI = PIXI;
    this.app = app;
    this.tex = createStwTextures(PIXI, app.renderer);
    this.world = new PIXI.Container();
    const ground = new PIXI.Sprite(this.tex.terrain);
    ground.width = STW_LANE_WIDTH;
    ground.height = STW_LANE_LENGTH;
    this.ground = ground;
    this.terrains.set("plain", this.tex.terrain);
    const resources = new PIXI.Container();
    this.resources = resources;
    this.steamLayer = new PIXI.Graphics();
    this.steamLayer.blendMode = "add";
    this.decals = new PIXI.Container();
    this.underlay = new PIXI.Graphics();
    this.buildingLayer = new PIXI.Container();
    this.unitLayer = new PIXI.Container();
    this.zoneLayer = new PIXI.Graphics();
    this.stormLayer = new PIXI.Graphics();
    this.stormLayer.blendMode = "add";
    this.beamLayer = new PIXI.Graphics();
    this.beamLayer.blendMode = "add";
    this.tentacleLayer = new PIXI.Graphics();
    this.interceptorLayer = new PIXI.Graphics();
    this.fxLayer = new PIXI.Container();
    this.fog = new PIXI.Graphics();
    // 칸 단위로 그린 안개 경계를 흐려 부드러운 시야 가장자리로 만든다.
    this.fog.filters = [new PIXI.BlurFilter({ strength: 10, quality: 3 })];
    this.rallyFlag = this.sprite(this.tex.flag.player, 2.6);
    this.rallyFlag.anchor.set(0.5, 0.9);
    this.flagScale = this.rallyFlag.scale.x;
    this.workerLayer = new PIXI.Container();
    this.repairLayer = new PIXI.Container();
    this.world.addChild(ground, resources, this.steamLayer, this.decals, this.underlay, this.buildingLayer, this.workerLayer, this.tentacleLayer, this.rallyFlag, this.unitLayer, this.repairLayer, this.interceptorLayer, this.zoneLayer, this.beamLayer, this.stormLayer, this.fxLayer, this.fog);
    this.overlay = new PIXI.Container();
    this.bars = new PIXI.Graphics();
    this.overlay.addChild(this.bars);
    {
      // 집결지 라벨: "집결 · 대기 N".
      const root = new PIXI.Container();
      const bg = new PIXI.Graphics();
      const text = new PIXI.Text({ text: "", style: { fontFamily: FONT, fontSize: 11, fontWeight: "800", fill: 0xc9ecff } });
      text.anchor.set(0, 0.5);
      root.addChild(bg, text);
      this.overlay.addChild(root);
      this.rallyLabel = { root, bg, text, key: "" };
    }
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
    this.applyMap("plain");
  }

  /** 맵에 달린 그림을 바꾼다: 바닥 그림, 광물·간헐천 자리, 앞마당 이름표 높이. */
  private applyMap(id: string) {
    this.map = stwMapData(id) as MapData;
    this.mapId = this.map.id;
    let texture = this.terrains.get(this.mapId);
    if (!texture) {
      texture = stwTerrainTexture(this.PIXI, this.mapId);
      this.terrains.set(this.mapId, texture);
    }
    this.ground.texture = texture;
    this.ground.width = STW_LANE_WIDTH;
    this.ground.height = STW_LANE_LENGTH;
    for (const child of this.resources.removeChildren()) child.destroy();
    const layout = this.map.layout;
    for (const side of ["player", "enemy"] as StwSide[]) {
      for (const point of [layout.mainMinerals, layout.naturalMinerals]) {
        const minerals = this.sprite(point === layout.naturalMinerals && this.map.naturalRate > 1 ? this.tex.goldMinerals : this.tex.minerals, 13);
        const p = stwPoint(side, point);
        minerals.position.set(p.x, p.y);
        this.resources.addChild(minerals);
      }
      for (const point of layout.geysers) {
        const geyser = this.sprite(this.tex.geyser, 4.4);
        const p = stwPoint(side, point);
        geyser.position.set(p.x, p.y);
        this.resources.addChild(geyser);
      }
    }
    // 이름표는 [적 본진, 적 앞마당, 중앙, 앞마당, 아군 본진] 순서다.
    if (this.labels.length >= 4) {
      this.labels[1].y = STW_LANE_LENGTH - layout.naturalNexus.y;
      this.labels[3].y = layout.naturalNexus.y;
    }
  }

  resize(width: number, height: number) {
    this.app.renderer.resize(Math.max(1, width), Math.max(1, height));
  }

  destroy() {
    this.app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
  }

  /**
   * 생산 현황 칩에 쓸 아이콘: 지도에 그리는 아군 유닛·건물 텍스처를 PNG 데이터 URL로 뽑는다.
   * 키는 "u:zealot", "b:gateway" 꼴.
   */
  exportIcons(): Record<string, string> {
    // 동기 추출(canvas)로 한 번에 뽑는다. 프레임 렌더와 섞이지 않게.
    const icons: Record<string, string> = {};
    const extract = this.app.renderer.extract;
    const toUrl = (texture: Texture) => (extract.canvas({ target: texture }) as HTMLCanvasElement).toDataURL("image/png");
    for (const [type, texture] of Object.entries(this.tex.units.player)) icons[`u:${type}`] = toUrl(texture);
    for (const [type, texture] of Object.entries(this.tex.buildings.player)) icons[`b:${type}`] = toUrl(texture);
    return icons;
  }

  render(state: StwState, view: StwView, ui: StwUi) {
    if (state !== this.lastState) this.reset(state);
    const realDt = Math.min(0.1, Math.max(0, ui.clock - this.lastClock));
    this.lastClock = ui.clock;
    const dt = realDt * ui.timeScale;
    // 화면 흔들림: 큰 충격 때 전장을 몇 픽셀 흔든다.
    this.shake = Math.max(0, this.shake - realDt * 4);
    const shakePx = this.shake * this.shake * 7;
    this.world.position.set(view.ox + (Math.random() - 0.5) * shakePx, view.oy + (Math.random() - 0.5) * shakePx);
    this.world.scale.set(view.scale);
    if (state.time - this.fogAt >= 0.25 || state.time < this.fogAt) this.refreshVision(state);
    if (ui.rally !== this.lastRally) {
      this.lastRally = ui.rally;
      this.flagPulse = 1;
    }
    this.flagPulse = Math.max(0, this.flagPulse - realDt * 2.5);
    const rallyY = stwRallyY("player", ui.rally, state);
    this.drawUnderlay(state, rallyY, ui.clock, ui.selected ?? []);
    this.drawSteam(state, ui.clock);
    this.syncBuildings(state, realDt);
    this.syncWorkers(state, ui.clock);
    this.syncUnits(state, realDt);
    this.syncRepairs(state, ui.clock);
    this.drawBeams(state, ui.clock);
    this.spawnEffects(state);
    this.drawProjectiles(state);
    this.drawTentacles(state, ui.clock);
    this.drawInterceptors(state);
    this.drawStorms(state, ui.clock);
    this.stepParticles(dt);
    this.stepDecals(dt);
    // 깃발은 대형 한가운데. 집결지를 옮기면 잠깐 튀어 오른다.
    this.rallyFlag.position.set(STW_LANE_WIDTH / 2, rallyY - this.flagPulse * 1.5);
    this.rallyFlag.scale.set(this.flagScale * (1 + this.flagPulse * 0.5));
    this.drawOverlay(state, view, rallyY);
    this.app.render();
  }

  /* ───────── 준비 ───────── */

  private reset(state: StwState) {
    this.lastState = state;
    if (stwMap(state).id !== this.mapId) this.applyMap(stwMap(state).id);
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

  private refreshVision(state: StwState) {
    this.fogAt = state.time;
    const g = this.fog;
    g.clear();
    for (let y = 0; y < STW_LANE_LENGTH; y += FOG_CELL) {
      let runStart = -1;
      for (let x = 0; x <= STW_LANE_WIDTH; x += FOG_CELL) {
        const hidden = x < STW_LANE_WIDTH && !stwVisible(state, "player", x + FOG_CELL / 2, y + FOG_CELL / 2, 0.5);
        if (hidden && runStart < 0) runStart = x;
        if (!hidden && runStart >= 0) {
          g.rect(runStart, y, x - runStart, FOG_CELL);
          runStart = -1;
        }
      }
    }
    g.fill({ color: 0x0b0805, alpha: 0.5 });
    this.visibleCache = new Set(state.units.filter((unit) => unit.side === "player" || stwVisible(state, "player", unit.x, unit.y)).map((unit) => unit.id));
  }

  /* ───────── 건물 ───────── */

  /** 가스 건물이 서지 않은 간헐천마다 초록 김 세 덩이가 피어오르다 흩어진다. */
  private drawSteam(state: StwState, clock: number) {
    const g = this.steamLayer;
    g.clear();
    for (const side of ["player", "enemy"] as StwSide[]) {
      this.map.layout.geysers.forEach((point, index) => {
        if (state.buildings.some((building) => building.side === side && building.slot === `geyser-${index}`)) return;
        const p = stwPoint(side, point);
        for (let puff = 0; puff < 3; puff += 1) {
          const t = ((clock * 0.32 + puff / 3 + index * 0.21) % 1 + 1) % 1;
          const sway = Math.sin(clock * 1.3 + puff * 2.1 + index) * 0.35 * t;
          g.circle(p.x + sway, p.y - 0.3 - t * 2.4, 0.45 + t * 0.95).fill({ color: 0x8dffa2, alpha: 0.3 * (1 - t) * Math.min(1, t * 4) });
        }
      });
    }
  }

  private drawUnderlay(state: StwState, rallyY: number, clock: number, selected: string[]) {
    const g = this.underlay;
    g.clear();
    // 따로 둔 부대의 자리(금색 타원)와, 고른 종류의 유닛 발밑 고리.
    for (const [type, spot] of Object.entries(state.sides.player.squads ?? {})) {
      if (!spot) continue;
      const y = stwRallyY("player", spot.y, state);
      g.ellipse(STW_LANE_WIDTH / 2, y, 11, 3.2).fill({ color: 0xffd27a, alpha: selected.includes(type) ? 0.12 : 0.05 }).stroke({ width: 0.16, color: 0xffd27a, alpha: 0.45 });
    }
    if (selected.length) {
      const pulse = 0.55 + Math.sin(clock * 5) * 0.2;
      for (const unit of state.units) {
        if (unit.side !== "player" || unit.hp <= 0 || !selected.includes(unit.type) || (unit.group !== "rally" && unit.group !== "attack")) continue;
        g.circle(unit.x, unit.y, unit.radius + 0.45).stroke({ width: 0.22, color: 0xffd27a, alpha: pulse });
      }
    }
    // 집결 구역: 새 유닛과 대기 병력이 서는 자리.
    const team = STW_TEAM.player;
    g.ellipse(STW_LANE_WIDTH / 2, rallyY, 15, 4.5).fill({ color: team.glow, alpha: 0.07 }).stroke({ width: 0.18, color: team.glow, alpha: 0.35 });
    // 본진에서 집결지로 가는 유닛이 있으면 점선이 흐른다.
    const army = stwArmy(state, "player");
    const transit = army.rally.some((unit) => Math.abs(unit.y - rallyY) > 6 && unit.y > rallyY + 6);
    if (transit) {
      const from = this.map.layout.mainNexus.y - 6;
      const to = rallyY + 5;
      const phase = (clock * 3) % 2;
      for (let y = from - phase; y > to; y -= 2) g.circle(STW_LANE_WIDTH / 2, y, 0.28).fill({ color: team.glow, alpha: 0.4 });
    }
    for (const building of state.buildings) {
      // 저그 기지 주변의 크립.
      if ((building.type === "hatchery" || building.type === "hatch") && (building.side === "player" || this.buildingViews.has(building.id))) {
        const r = building.radius * 2.1 * Math.min(1, 0.4 + building.progress);
        g.ellipse(building.x, building.y, r, r * 0.85).fill({ color: 0x4a2a44, alpha: 0.32 });
        g.ellipse(building.x, building.y, r * 0.7, r * 0.6).fill({ color: 0x5a3352, alpha: 0.22 });
      }
      if (building.side !== "player" || building.type !== "pylon" || !stwDone(building)) continue;
      g.circle(building.x, building.y, 6.5).fill({ color: STW_TEAM.player.glow, alpha: 0.05 }).stroke({ width: 0.15, color: STW_TEAM.player.glow, alpha: 0.25 });
    }
  }

  private syncBuildings(state: StwState, realDt: number) {
    const seen = state.sides.player.seen;
    const alive = new Set<number>();
    const visibleEnemy = new Set<number>();
    for (const building of state.buildings) {
      const own = building.side === "player";
      const remembered = !own && seen[building.id];
      const visibleNow = own || stwVisible(state, "player", building.x, building.y, building.radius);
      if (!own && !visibleNow && !remembered) continue;
      alive.add(building.id);
      if (!own && visibleNow) visibleEnemy.add(building.id);
      let view = this.buildingViews.get(building.id);
      if (!view) view = this.createBuildingView(building);
      const done = stwDone(building);
      view.ghost = !own && !visibleNow;
      view.body.alpha = view.ghost ? 0.5 : done ? 1 : 0.35 + building.progress * 0.5;
      view.body.tint = view.ghost ? 0x9a8f80 : 0xffffff;
      if (view.glow) view.glow.alpha = done && !view.ghost ? 0.22 + Math.sin(state.time * 3 + building.id) * 0.08 : 0;
      // 레어 변태가 끝나면 본진 해처리 그림을 레어로 바꾼다.
      const lair = building.type === "hatchery" && building.base === "main" && state.sides[building.side].research.lair === "done";
      if (lair !== view.lair) {
        view.lair = lair;
        view.body.texture = lair ? this.tex.zergParts[building.side].lair : this.tex.buildings[building.side][building.type];
      }
      // 오버로드는 공중에 떠서 천천히 흔들린다.
      if (building.type === "overlord") view.body.position.set(Math.sin(state.time * 0.7 + building.id) * 0.4, Math.cos(state.time * 0.9 + building.id) * 0.3 - 0.6);
      // 저그 건물은 숨 쉬듯 살짝 부푼다. 성큰 콜로니는 촉수를 내지를 때 크게 움찔한다.
      view.pulse = Math.max(0, view.pulse - realDt * 3);
      if ((STW_BUILDINGS[building.type] as { race?: string }).race === "zerg" && done && building.type !== "overlord") {
        const jolt = Math.sin(Math.min(1, view.pulse) * Math.PI) * 0.16;
        const breathe = 1 + Math.sin(state.time * 1.6 + building.id) * 0.012 + jolt;
        const base = STW_BUILDINGS[building.type].size / Math.max(view.body.texture.width, view.body.texture.height);
        view.body.scale.set(base * breathe, base / breathe);
        view.body.tint = view.ghost ? 0x9a8f80 : view.pulse > 0.6 ? 0xffc8d8 : 0xffffff;
      }
    }
    for (const [id, view] of this.buildingViews) {
      if (alive.has(id)) continue;
      view.root.destroy({ children: true });
      this.buildingViews.delete(id);
    }
  }

  private createBuildingView(building: StwBuilding): BuildingView {
    const PIXI = this.PIXI;
    const def = STW_BUILDINGS[building.type];
    const root = new PIXI.Container();
    root.position.set(building.x, building.y);
    const flying = building.type === "overlord";
    const shadow = this.sprite(this.tex.shadow, def.size * (flying ? 1.1 : 1.45));
    shadow.position.set(flying ? 1.4 : 0.5, flying ? 2 : 0.8);
    const body = this.sprite(this.tex.buildings[building.side][building.type], def.size);
    let glow: Sprite | null = null;
    root.addChild(shadow);
    // 건물에도 진영 색 바닥 고리를 깐다.
    const ring = this.sprite(this.tex.ring, def.size * 1.18);
    ring.tint = STW_TEAM[building.side].glow;
    ring.alpha = flying ? 0.3 : 0.42;
    ring.position.copyFrom(shadow.position);
    ring.scale.y *= 0.85;
    root.addChild(ring);
    if (["nexus", "pylon", "cannon", "gateway"].includes(building.type)) {
      glow = this.sprite(this.tex.soft, def.size * 1.3);
      glow.tint = STW_TEAM[building.side].glow;
      glow.blendMode = "add";
      root.addChild(glow);
    }
    root.addChild(body);
    this.buildingLayer.addChild(root);
    const view = { root, body, glow, ghost: false, lair: false, pulse: 0 };
    this.buildingViews.set(building.id, view);
    return view;
  }

  /* ───────── 일꾼(겉모습 전용) ───────── */

  /**
   * 엔진의 채취 인원 수만큼 프로브가 넥서스와 광물·어시밀레이터 사이를 오가는 모습을 그린다.
   * 엔진 규칙에는 영향을 주지 않는다. 적 기지는 지금 보일 때만 그린다.
   */
  private syncWorkers(state: StwState, clock: number) {
    let used = 0;
    const take = (side: StwSide) => {
      let view = this.workerPool[used];
      if (!view) {
        const PIXI = this.PIXI;
        const root = new PIXI.Container();
        const body = this.sprite(this.tex.units.player.probe, WORKER_SIZE);
        const cargo = this.sprite(this.tex.spark, 0.6);
        cargo.blendMode = "add";
        root.addChild(body, cargo);
        this.workerLayer.addChild(root);
        view = { root, body, cargo };
        this.workerPool.push(view);
      }
      view.body.texture = this.tex.units[side][stwRace(state, side).worker as StwUnitType];
      view.root.visible = true;
      view.root.alpha = 1;
      view.cargo.visible = false;
      used += 1;
      return view;
    };
    const place = (view: WorkerView, x: number, y: number, heading: number) => {
      view.root.position.set(x, y);
      view.body.rotation = heading;
      view.cargo.position.set(Math.cos(heading) * 0.7, Math.sin(heading) * 0.7);
    };
    for (const side of ["player", "enemy"] as StwSide[]) {
      const split = stwWorkerSplit(state, side) as { gas: number; main: number; natural: number; idle: number };
      const offset = side === "player" ? 0 : 0.5;
      const assimilators = state.buildings.filter((building) => building.side === side && flags(STW_BUILDINGS[building.type]).refinery && stwDone(building));
      for (const base of ["main", "natural"] as const) {
        const nexus = stwNexus(state, side, base) as { x: number; y: number; radius: number } | null;
        if (!nexus || !stwDone(nexus as never)) continue;
        if (side !== "player" && !stwVisible(state, "player", nexus.x, nexus.y, 4)) continue;
        const minerals = stwPoint(side, base === "main" ? this.map.layout.mainMinerals : this.map.layout.naturalMinerals);
        const dir = Math.sign(minerals.y - nexus.y) || 1;
        const threatened = state.units.some((unit) => unit.side !== side && !flags(STW_UNITS[unit.type]).worker && !flags(STW_UNITS[unit.type]).flying && Math.hypot(unit.x - nexus.x, unit.y - nexus.y) < 12);
        const count = base === "main" ? split.main + split.idle : split.natural;
        for (let index = 0; index < count; index += 1) {
          const view = take(side);
          const patch = (index % 8) - 3.5;
          // 넥서스 가장자리(좁게)에서 광물 위(넓게)로 부채꼴로 오간다.
          const dock = { x: nexus.x + patch * 0.6, y: nexus.y + dir * (nexus.radius - 0.4) };
          if (threatened || (base === "main" && index >= split.main)) {
            // 위협받거나 일이 없는 프로브는 넥서스 곁에 모여 있는다.
            const a = index * 2.4 + clock * 0.6;
            place(view, nexus.x + Math.cos(a) * (nexus.radius + 0.8), nexus.y - dir * 0.5 + Math.sin(a) * 1.2, a + Math.PI / 2);
            continue;
          }
          const field = { x: minerals.x + patch * 1.6, y: minerals.y - dir * 0.3 };
          const phase = ((clock / MINE_CYCLE + index * 0.618 + offset) % 1 + 1) % 1;
          let x: number;
          let y: number;
          let heading: number;
          if (phase < 0.35) {
            const t = phase / 0.35;
            x = dock.x + (field.x - dock.x) * t;
            y = dock.y + (field.y - dock.y) * t;
            heading = Math.atan2(field.y - dock.y, field.x - dock.x);
          } else if (phase < 0.55) {
            x = field.x + Math.sin(clock * 20 + index) * 0.08;
            y = field.y;
            heading = Math.atan2(dir, 0);
          } else if (phase < 0.9) {
            const t = (phase - 0.55) / 0.35;
            x = field.x + (dock.x - field.x) * t;
            y = field.y + (dock.y - field.y) * t;
            heading = Math.atan2(dock.y - field.y, dock.x - field.x);
            view.cargo.visible = true;
            view.cargo.tint = 0x6fc4ff;
          } else {
            x = dock.x;
            y = dock.y;
            heading = Math.atan2(-dir, 0);
          }
          place(view, x, y, heading);
        }
      }
      // 가스: 어시밀레이터마다 최대 3기가 그 기지(본진·앞마당)의 넥서스와 오간다. 안에 들어가 있는 동안은 보이지 않는다.
      let gasLeft = split.gas;
      assimilators.forEach((assimilator, slot) => {
        const mainNexus = stwNexus(state, side, assimilator.base === "natural" ? "natural" : "main") as { x: number; y: number; radius: number } | null;
        if (!mainNexus || !stwDone(mainNexus as never)) return;
        const crew = Math.min(STW_ECONOMY.probesPerGas, gasLeft);
        gasLeft -= crew;
        if (side !== "player" && !stwVisible(state, "player", mainNexus.x, mainNexus.y, 4)) return;
        for (let index = 0; index < crew; index += 1) {
          const view = take(side);
          const dx = assimilator.x - mainNexus.x;
          const dy = assimilator.y - mainNexus.y;
          const length = Math.hypot(dx, dy) || 1;
          const from = { x: mainNexus.x + (dx / length) * (mainNexus.radius + 0.3), y: mainNexus.y + (dy / length) * (mainNexus.radius + 0.3) };
          const to = { x: assimilator.x - (dx / length) * assimilator.radius * 0.8, y: assimilator.y - (dy / length) * assimilator.radius * 0.8 };
          const phase = ((clock / GAS_CYCLE + index / 3 + slot * 0.17 + offset) % 1 + 1) % 1;
          if (phase < 0.4) {
            const t = phase / 0.4;
            place(view, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, Math.atan2(dy, dx));
          } else if (phase < 0.6) {
            view.root.visible = false;
          } else {
            const t = (phase - 0.6) / 0.4;
            place(view, to.x + (from.x - to.x) * t, to.y + (from.y - to.y) * t, Math.atan2(-dy, -dx));
            view.cargo.visible = true;
            view.cargo.tint = 0x7fe08f;
          }
        }
      });
    }
    for (let index = used; index < this.workerPool.length; index += 1) this.workerPool[index].root.visible = false;
  }

  /**
   * SCV 수리(겉모습 전용): 엔진이 고치는 중이라고 표시한 테란 기계 유닛 둘레에 SCV가 붙어 용접 불꽃을 튀긴다.
   * 채취하는 SCV 수는 그대로다. 크기에 따라 1~3기가 붙는다.
   */
  private syncRepairs(state: StwState, clock: number) {
    let used = 0;
    for (const unit of state.units) {
      if (!unit.repairing) continue;
      const target = this.unitViews.get(unit.id);
      if (!target || !target.root.visible) continue;
      const size = UNIT_SIZE[unit.type] ?? 3;
      const crew = size >= 6 ? 3 : size >= 4 ? 2 : 1;
      for (let index = 0; index < crew; index += 1) {
        let view = this.repairPool[used];
        if (!view) {
          const PIXI = this.PIXI;
          const root = new PIXI.Container();
          const body = this.sprite(this.tex.units.player.scv, WORKER_SIZE);
          const cargo = this.sprite(this.tex.spark, 0.9);
          cargo.blendMode = "add";
          cargo.tint = 0xffd27a;
          root.addChild(body, cargo);
          this.repairLayer.addChild(root);
          view = { root, body, cargo };
          this.repairPool.push(view);
        }
        used += 1;
        view.body.texture = this.tex.units[unit.side].scv;
        // 유닛 둘레에 고르게 서서 조금씩 자리를 옮기며 몸통 쪽을 바라본다.
        const angle = unit.id * 1.7 + (index * Math.PI * 2) / crew + Math.sin(clock * 1.3 + index * 2) * 0.3;
        const reach = size * 0.42 + 0.6;
        view.root.visible = true;
        view.root.position.set(target.x + Math.cos(angle) * reach, target.y + Math.sin(angle) * reach);
        view.body.rotation = angle + Math.PI;
        // 용접 불꽃: 맞닿은 자리에서 빠르게 깜빡인다.
        const flicker = (Math.sin(clock * 37 + unit.id * 3 + index * 7) + 1) / 2;
        view.cargo.visible = flicker > 0.3;
        view.cargo.alpha = 0.4 + flicker * 0.6;
        view.cargo.position.set(-Math.cos(angle) * 0.95, -Math.sin(angle) * 0.95);
      }
    }
    for (let index = used; index < this.repairPool.length; index += 1) this.repairPool[index].root.visible = false;
  }

  /** 넥서스와 어시밀레이터 옆의 채취 인원 표시(아군만). */
  private drawWorkerBadges(state: StwState, view: StwView) {
    const sx = (x: number) => view.ox + x * view.scale;
    const sy = (y: number) => view.oy + y * view.scale;
    const live = new Set<string>();
    const split = stwWorkerSplit(state, "player") as { gas: number; main: number; natural: number; idle: number };
    const show = (key: string, text: string, color: number, x: number, y: number) => {
      live.add(key);
      let badge = this.badges.get(key);
      if (!badge) {
        const PIXI = this.PIXI;
        const root = new PIXI.Container();
        const bg = new PIXI.Graphics();
        const label = new PIXI.Text({ text: "", style: { fontFamily: FONT, fontSize: 12, fontWeight: "800", fill: 0xffffff } });
        label.anchor.set(0.5);
        root.addChild(bg, label);
        this.overlay.addChild(root);
        badge = { root, bg, text: label, key: "" };
        this.badges.set(key, badge);
      }
      const signature = `${text}|${color}`;
      if (badge.key !== signature) {
        badge.key = signature;
        badge.text.text = text;
        badge.text.style.fill = color;
        const width = badge.text.width + 12;
        badge.bg.clear().roundRect(-width / 2, -9.5, width, 19, 9.5).fill({ color: 0x120d07, alpha: 0.82 }).stroke({ width: 1, color, alpha: 0.6 });
      }
      badge.root.visible = true;
      badge.root.position.set(sx(x), sy(y));
    };
    const tone = (count: number, full: number) => (count > full ? 0xffc46b : count === full ? 0x8fe8a0 : 0xf5ecd8);
    for (const base of ["main", "natural"] as const) {
      const nexus = stwNexus(state, "player", base) as { x: number; y: number; radius: number } | null;
      if (!nexus || !stwDone(nexus as never)) continue;
      const count = base === "main" ? split.main : split.natural;
      // 넥서스 그림 아래쪽 위에 얹어 주변 건물·지역 이름과 겹치지 않게 한다.
      // 지도를 덜 가리게 숫자만(넘치게 뽑아도 보이도록 숨기지는 않는다).
      show(`base:${base}`, `${count}/${STW_ECONOMY.fullSaturation}`, tone(count, STW_ECONOMY.fullSaturation), nexus.x, nexus.y + nexus.radius * 0.55);
    }
    let gasLeft = split.gas;
    for (const assimilator of state.buildings.filter((building) => building.side === "player" && flags(STW_BUILDINGS[building.type]).refinery && stwDone(building))) {
      const crew = Math.min(STW_ECONOMY.probesPerGas, gasLeft);
      gasLeft -= crew;
      show(`gas:${assimilator.id}`, `${crew}/${STW_ECONOMY.probesPerGas}`, tone(crew, STW_ECONOMY.probesPerGas), assimilator.x, assimilator.y);
    }
    // 따로 둔 부대 이름표: "커세어 4" (부대 자리 옆).
    for (const [type, spot] of Object.entries(state.sides.player.squads ?? {})) {
      if (!spot) continue;
      const count = state.units.filter((unit) => unit.side === "player" && unit.hp > 0 && unit.squad === type).length;
      if (!count) continue;
      const def = STW_UNITS[type as StwUnitType];
      show(`squad:${type}`, `${def?.name ?? type} ${count}`, 0xffd27a, STW_LANE_WIDTH / 2 + 12.5, stwRallyY("player", spot.y, state));
    }
    for (const [key, badge] of this.badges) {
      if (live.has(key)) continue;
      badge.root.visible = false;
    }
  }

  /* ───────── 유닛 ───────── */

  private syncUnits(state: StwState, realDt: number) {
    const alive = new Set<number>();
    const follow = 1 - Math.exp(-realDt * 16);
    let byId: Map<number, { x: number; y: number }> | null = null;
    for (const unit of state.units) {
      if (!this.visibleCache.has(unit.id) && unit.side !== "player") continue;
      // 은폐한 적은 아군 탐지기 범위 안에 있을 때만 보인다.
      if (unit.group === "cargo") continue;
      if (unit.side !== "player" && isCloaked(unit, state) && !stwDetected(state, unit, "player")) continue;
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
      // 피격 반응: 체력이 깎이면 붉게, 보호막이 깎이면 푸르게 번쩍이며 살짝 흔들린다. 깎인 비율이 클수록 더 흔들린다.
      const lostHp = view.hp - unit.hp;
      const lostShields = view.shields - unit.shields;
      if (lostHp > 0.5 || lostShields > 0.5) {
        const ratio = Math.min(1, (lostHp + lostShields) / Math.max(1, unit.maxHp + unit.maxShields));
        view.flash = 0.16;
        view.flashColor = lostHp > 0.5 ? 0xff5a4a : 0x7fd0ff;
        view.jitter = Math.max(view.jitter, 0.12 + ratio * 1.2);
      }
      view.hp = unit.hp;
      view.shields = unit.shields;
      view.flash = Math.max(0, view.flash - realDt);
      view.jitter = Math.max(0, view.jitter - realDt * 1.6);
      view.lunge = Math.max(0, view.lunge - realDt * 4.5);
      view.body.tint = view.flash > 0 ? view.flashColor : statusTint(state, unit);
      // 근접 공격 동작: 목표 쪽으로 짧게 찌르고 돌아온다.
      const lungeReach = Math.sin(Math.min(1, view.lunge) * Math.PI) * UNIT_SIZE[unit.type] * 0.3;
      const shakeX = (Math.random() - 0.5) * view.jitter * 0.5;
      const shakeY = (Math.random() - 0.5) * view.jitter * 0.5;
      view.body.position.set(Math.cos(view.lungeAngle) * lungeReach + shakeX, Math.sin(view.lungeAngle) * lungeReach + shakeY);
      if (distance > 0.04 && !NO_BOB.has(unit.type)) view.bob += realDt * 13;
      const base = UNIT_SIZE[unit.type] / Math.max(view.body.texture.width, view.body.texture.height);
      const bob = unit.type === "dragoon" ? 1 + Math.sin(state.time * 6 + unit.id) * 0.02 : NO_BOB.has(unit.type) ? 1 : 1 + Math.sin(view.bob) * 0.045;
      view.body.scale.set(base * bob, base);
      if (view.turret) {
        // 시즈 탱크: 차체와 포탑을 따로 그리고, 포탑은 목표를 향해 돈다.
        const sieged = Boolean(unit.sieged);
        if (sieged !== view.sieged) {
          view.sieged = sieged;
          const parts = this.tex.tankParts[unit.side];
          view.body.texture = sieged ? parts.hullSieged : parts.hull;
          view.turret.texture = sieged ? parts.turretSieged : parts.turret;
          view.turret.scale.set((UNIT_SIZE.tank * TURRET_RATIO) / Math.max(view.turret.texture.width, view.turret.texture.height));
        }
        let aim = view.heading;
        if (unit.targetId !== null) {
          byId ??= new Map([...state.units, ...state.buildings].map((item) => [item.id, item]));
          const target = byId.get(unit.targetId);
          if (target) aim = Math.atan2(target.y - unit.y, target.x - unit.x);
        }
        view.aim = turnToward(view.aim, aim, realDt * 5);
        view.turret.rotation = view.aim;
      }
      if (unit.type === "templar") view.glow.alpha = 0.25 + (unit.energy / 200) * 0.45;
      if (unit.type === "archon" || unit.type === "darkArchon") {
        view.glow.alpha = 0.55 + Math.sin(state.time * 5 + unit.id) * 0.15;
        view.body.rotation = (unit.type === "archon" ? 1 : -1) * state.time * 0.8 + unit.id;
      }
      // 디펜시브 매트릭스: 푸른 막이 감싼다. 끝나면 진영 색으로 돌아간다.
      const matrixOn = Boolean(unit.matrix && unit.matrix.hp > 0 && unit.matrix.until > state.time);
      if (matrixOn) {
        view.glow.tint = 0x6fd0ff;
        view.glow.alpha = 0.6 + Math.sin(state.time * 8 + unit.id) * 0.15;
      } else if (view.glow.tint === 0x6fd0ff) {
        view.glow.tint = STW_TEAM[unit.side].glow;
        view.glow.alpha = 0.16;
      }
      if (unit.type === "overlord") view.body.position.set(view.body.position.x + Math.sin(state.time * 0.7 + unit.id) * 0.3, view.body.position.y + Math.cos(state.time * 0.9 + unit.id) * 0.25 - 0.5);
      else if (isFlyingType(unit.type) && unit.type !== "observer") view.body.position.set(view.body.position.x, view.body.position.y + Math.sin(state.time * 2.2 + unit.id) * 0.18 - 0.9);
      if (unit.type === "lurker") {
        // 럴커: 땅속에 숨으면 가시 무덤 모양으로 바뀌고 반투명해진다.
        const burrowed = Boolean(unit.burrowed);
        if (burrowed !== view.sieged) {
          view.sieged = burrowed;
          view.body.texture = burrowed ? this.tex.zergParts[unit.side].lurkerBurrowed : this.tex.units[unit.side].lurker;
          const scale = UNIT_SIZE.lurker / Math.max(view.body.texture.width, view.body.texture.height);
          view.body.scale.set(scale);
        }
        if (burrowed) view.body.scale.set(UNIT_SIZE.lurker / Math.max(view.body.texture.width, view.body.texture.height));
        view.root.alpha = burrowed ? (unit.side === "player" ? 0.6 : 0.5 + Math.sin(state.time * 9 + unit.id) * 0.15) : 1;
      } else if (isCloaked(unit, state)) view.root.alpha = unit.side === "player" ? 0.5 : 0.45 + Math.sin(state.time * 9 + unit.id) * 0.15;
      else if (unit.type === "wraith") view.root.alpha = 1;
    }
    for (const [id, view] of this.unitViews) {
      if (alive.has(id)) continue;
      view.root.destroy({ children: true });
      this.unitViews.delete(id);
    }
  }

  private createUnitView(unit: StwUnit): UnitView {
    const PIXI = this.PIXI;
    const root = new PIXI.Container();
    const shadow = this.sprite(this.tex.shadow, UNIT_SIZE[unit.type] * 1.05);
    // 옵저버는 떠 있으므로 그림자를 멀리 떨어뜨린다.
    const flying = isFlyingType(unit.type);
    shadow.position.set(flying ? 1.2 : 0.25, flying ? 1.8 : 0.4);
    const glow = this.sprite(this.tex.soft, UNIT_SIZE[unit.type] * 1.4);
    glow.tint = STW_TEAM[unit.side].glow;
    glow.blendMode = "add";
    glow.alpha = unit.type === "templar" ? 0.4 : unit.type === "archon" || unit.type === "darkArchon" ? 0.6 : 0.16;
    if (unit.type === "darkArchon") glow.tint = 0x9a5cff;
    // 진영 고리: 같은 종족끼리 싸울 때 아군(파랑)과 적(빨강)을 발밑 색으로 가른다.
    const ring = this.sprite(this.tex.ring, UNIT_SIZE[unit.type] * 1.12);
    ring.tint = STW_TEAM[unit.side].glow;
    ring.alpha = flying ? 0.6 : 0.75;
    // 떠 있는 유닛은 고리를 그림자 대신 몸 바로 아래에 둔다(그림자와 함께 멀리 떨어지면 어느 편인지 알아보기 어렵다).
    if (flying) ring.position.set(0, 0.2);
    else ring.position.copyFrom(shadow.position);
    ring.scale.y *= 0.8;
    const body = this.sprite(this.tex.units[unit.side][unit.type], UNIT_SIZE[unit.type]);
    body.rotation = unit.heading;
    root.addChild(shadow, ring, glow, body);
    let turret: Sprite | null = null;
    if (unit.type === "tank") {
      turret = this.sprite(this.tex.tankParts[unit.side].turret, UNIT_SIZE.tank * TURRET_RATIO);
      turret.rotation = unit.heading;
      root.addChild(turret);
    }
    root.position.set(unit.x, unit.y);
    this.unitLayer.addChild(root);
    const view = { root, body, glow, ring, hp: unit.hp, shields: unit.shields, flash: 0, flashColor: 0xffffff, jitter: 0, lunge: 0, lungeAngle: 0, turret, aim: unit.heading, sieged: false, x: unit.x, y: unit.y, heading: unit.heading, bob: Math.random() * 6 };
    this.unitViews.set(unit.id, view);
    return view;
  }

  /** 메딕 치유 광선과 컴샛 스캔 범위. */
  private drawBeams(state: StwState, clock: number) {
    const g = this.beamLayer;
    g.clear();
    for (const unit of state.units) {
      if (unit.type !== "medic" || !unit.healTargetId) continue;
      const from = this.unitViews.get(unit.id);
      const to = this.unitViews.get(unit.healTargetId);
      if (!from || !to) continue;
      const pulse = 0.55 + Math.sin(clock * 18 + unit.id) * 0.25;
      g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: 0.35, color: 0xfff3b0, alpha: 0.35 * pulse });
      g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: 0.12, color: 0xffffff, alpha: 0.8 * pulse });
      g.circle(to.x, to.y, 0.9).fill({ color: 0xfff3b0, alpha: 0.25 * pulse });
    }
    // 야마토 포: 쏘는 배틀크루저 앞에 충전 빛이 모였다가, 포탄 꼬리를 따라 굵은 빛줄기가 목표로 뻗는다.
    for (const effect of state.effects) {
      if (effect.kind !== "yamato") continue;
      if (effect.side !== "player" && !this.visiblePoint(state, effect.x1, effect.y1) && !this.visiblePoint(state, effect.x2, effect.y2)) continue;
      const t = 1 - effect.ttl / effect.max;
      const head = Math.min(1, t / 0.7);
      const x = effect.x1 + (effect.x2 - effect.x1) * head;
      const y = effect.y1 + (effect.y2 - effect.y1) * head;
      const fade = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);
      const charge = Math.max(0, 1 - t / 0.35);
      g.circle(effect.x1, effect.y1, 1.2 + charge * 2.2).fill({ color: 0xff8a3c, alpha: 0.35 * charge });
      g.circle(effect.x1, effect.y1, 0.6 + charge * 1.1).fill({ color: 0xfff4d0, alpha: 0.6 * charge });
      g.moveTo(effect.x1, effect.y1).lineTo(x, y).stroke({ width: 1.6, color: 0xff8a3c, alpha: 0.35 * fade });
      g.moveTo(effect.x1, effect.y1).lineTo(x, y).stroke({ width: 0.55, color: 0xfff4d0, alpha: 0.85 * fade });
    }
    for (const scan of state.scans ?? []) {
      if (scan.side !== "player" && !this.visiblePoint(state, scan.x, scan.y)) continue;
      const fade = Math.min(1, scan.ttl / 1.5);
      const sweep = (clock * 2.4) % (Math.PI * 2);
      g.circle(scan.x, scan.y, scan.radius).fill({ color: 0x7fd6ff, alpha: 0.05 * fade }).stroke({ width: 0.15, color: 0x9fe4ff, alpha: 0.55 * fade });
      g.moveTo(scan.x, scan.y).lineTo(scan.x + Math.cos(sweep) * scan.radius, scan.y + Math.sin(sweep) * scan.radius).stroke({ width: 0.2, color: 0x9fe4ff, alpha: 0.5 * fade });
    }
  }

  /* ───────── 효과 ───────── */

  private visiblePoint(state: StwState, x: number, y: number) {
    return stwVisible(state, "player", x, y, 1);
  }

  private spawnEffects(state: StwState) {
    for (const effect of state.effects) {
      if (this.processed.has(effect)) continue;
      this.processed.add(effect);
      if (effect.side !== "player" && !this.visiblePoint(state, effect.x1, effect.y1) && !this.visiblePoint(state, effect.x2, effect.y2)) continue;
      this.spawnEffect(effect);
    }
  }

  private spawnEffect(effect: StwEffect) {
    const team = STW_TEAM[effect.side];
    // 근접 공격자는 목표 쪽으로 찌른다.
    if ((effect.kind === "slash" || effect.kind === "bite" || effect.kind === "flame") && effect.attackerId !== undefined) {
      const attacker = this.unitViews.get(effect.attackerId);
      if (attacker) {
        attacker.lunge = 1;
        attacker.lungeAngle = Math.atan2(effect.y2 - effect.y1, effect.x2 - effect.x1);
      }
    }
    if (effect.kind === "slash") {
      // 타격 지점은 대상 몸 가장자리. 충격 고리가 퍼지고 불꽃이 튄다.
      const angle = Math.atan2(effect.y1 - effect.y2, effect.x1 - effect.x2);
      const hx = effect.x2 + Math.cos(angle) * 0.6;
      const hy = effect.y2 + Math.sin(angle) * 0.6;
      this.impactRing(hx, hy, 2.8, team.light);
      for (let i = 0; i < 6; i += 1) this.spark(hx, hy, i % 2 ? 0xffffff : team.glow, 5.5, 0.4);
      this.flash(hx, hy, 1.8, 0.1, 0xffffff);
    } else if (effect.kind === "shock") {
      this.flash(effect.x2, effect.y2, (effect.radius ?? 1.6) * 2.4, 0.14, team.light);
      for (let i = 0; i < 6; i += 1) this.spark(effect.x2, effect.y2, team.glow, 5, 0.4);
    } else if (effect.kind === "scarab") {
      const angle = Math.atan2(effect.y2 - effect.y1, effect.x2 - effect.x1);
      this.flash(effect.x1 + Math.cos(angle) * 2, effect.y1 + Math.sin(angle) * 2, 1.8, 0.1, 0xffd28a);
    } else if (effect.kind === "plasma" || effect.kind === "photon") {
      const angle = Math.atan2(effect.y2 - effect.y1, effect.x2 - effect.x1);
      this.flash(effect.x1 + Math.cos(angle) * 1.4, effect.y1 + Math.sin(angle) * 1.4, 1.6, 0.08, team.light);
    } else if (effect.kind === "bullet" || effect.kind === "tankshot" || effect.kind === "grenade") {
      // 총구 섬광. 탄은 drawProjectiles가 그린다.
      const angle = Math.atan2(effect.y2 - effect.y1, effect.x2 - effect.x1);
      const reach = effect.kind === "tankshot" ? 2.4 : effect.kind === "grenade" ? 1.6 : 1.1;
      this.flash(effect.x1 + Math.cos(angle) * reach, effect.y1 + Math.sin(angle) * reach, effect.kind === "tankshot" ? 2.2 : 1.1, 0.07, 0xffe7a0);
    } else if (effect.kind === "shell") {
      const angle = Math.atan2(effect.y2 - effect.y1, effect.x2 - effect.x1);
      this.flash(effect.x1 + Math.cos(angle) * 3, effect.y1 + Math.sin(angle) * 3, 3, 0.12, 0xffe7a0);
      this.smoke(effect.x1 + Math.cos(angle) * 3, effect.y1 + Math.sin(angle) * 3, 1.4, 0.8);
    } else if (effect.kind === "flame") {
      // 화염 방사: 대상 쪽으로 뻗는 불꽃 입자들.
      const angle = Math.atan2(effect.y2 - effect.y1, effect.x2 - effect.x1);
      const length = Math.max(1.2, Math.hypot(effect.x2 - effect.x1, effect.y2 - effect.y1));
      for (let i = 0; i < 7; i += 1) {
        const sprite = this.particle(this.tex.spark);
        sprite.tint = i % 3 === 0 ? 0xfff0a0 : i % 3 === 1 ? 0xff9a3c : 0xff5a24;
        const a = angle + (Math.random() - 0.5) * 0.55;
        const v = (length / 0.28) * (0.7 + Math.random() * 0.5);
        const x = effect.x1 + Math.cos(angle) * 0.8;
        const y = effect.y1 + Math.sin(angle) * 0.8;
        this.particles.push({ sprite, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.28, max: 0.28, s0: 0.5 / 32, s1: 1.8 / 32, a0: 0.9, rise: 0 });
      }
    } else if (effect.kind === "bite") {
      // 저글링·울트라리스크의 물어뜯기.
      const big = (effect.radius ?? 0) > 0;
      this.impactRing(effect.x2, effect.y2, big ? 3 : 1.8, 0xffc8b0);
      if (big) this.shake = Math.max(this.shake, 0.25);
      for (let i = 0; i < (big ? 6 : 3); i += 1) this.spark(effect.x2, effect.y2, i % 2 ? 0xb8433a : 0xe6d6b2, big ? 5 : 3, 0.35);
      this.flash(effect.x2, effect.y2, big ? 2.2 : 1.1, 0.08, 0xffb0a0);
    } else if (effect.kind === "spines") {
      // 럴커 가시: 줄을 따라 차례로 솟는 가시와 흙먼지.
      const steps = 7;
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const x = effect.x1 + (effect.x2 - effect.x1) * t;
        const y = effect.y1 + (effect.y2 - effect.y1) * t;
        const sprite = this.particle(this.tex.spark);
        sprite.tint = 0xf0e2bf;
        this.particles.push({ sprite, x, y, vx: 0, vy: 0, life: 0.18 + t * 0.25, max: 0.18 + t * 0.25, s0: 1.4 / 32, s1: 0.6 / 32, a0: 1, rise: 0 });
        if (i % 2 === 0) this.smoke(x, y, 0.9, 0.6);
      }
    } else if (effect.kind === "spell") {
      // 마법: 시전자에서 대상까지 가는 빛줄기와 대상 자리의 고리.
      const color = SPELL_COLOR[effect.spell ?? ""] ?? team.light;
      const radius = effect.radius ?? 1.4;
      this.flash(effect.x1, effect.y1, 1.6, 0.18, color);
      this.impactRing(effect.x2, effect.y2, radius * 2.4, color);
      this.flash(effect.x2, effect.y2, radius * 2, 0.3, color);
      for (let i = 0; i < 8; i += 1) this.spark(effect.x2, effect.y2, color, 4 + radius, 0.5);
      if (effect.spell === "emp" || effect.spell === "stasis") this.shake = Math.max(this.shake, 0.25);
    } else if (effect.kind === "decoy") {
      // 캐리어 둘레의 인터셉터가 공격을 대신 맞음: 캐리어 둘레에서 작은 불꽃 여럿.
      for (let i = 0; i < 4; i += 1) this.flash(effect.x2 + (Math.random() - 0.5) * 3, effect.y2 + (Math.random() - 0.5) * 3, 0.7, 0.1, 0xffe7a0);
    } else if (effect.kind === "burst") {
      // 스커지 자폭: 대상 위에서 작은 폭발.
      this.flash(effect.x2, effect.y2, 2.4, 0.16, 0xd8ffb0);
      this.impactRing(effect.x2, effect.y2, 2.6, 0xb6ff8a);
      for (let i = 0; i < 6; i += 1) this.spark(effect.x2, effect.y2, i % 2 ? 0x8a5468 : 0xd8ffb0, 5, 0.4);
      this.smoke(effect.x2, effect.y2, 1.2, 0.7);
    } else if (effect.kind === "tentacle") {
      // 성큰 촉수: 성큰이 움찔하며 흙을 튀기고, 촉수는 drawTentacles가 땅을 타고 뻗어 가게 그린다.
      const sunken = effect.attackerId === undefined ? undefined : this.buildingViews.get(effect.attackerId);
      if (sunken) sunken.pulse = 1;
      for (let i = 0; i < 3; i += 1) this.smoke(effect.x1, effect.y1, 1.2, 0.6);
      for (let i = 0; i < 3; i += 1) this.spark(effect.x1, effect.y1, 0x6e4a3a, 3, 0.3);
    } else if (effect.kind === "stim") {
      this.flash(effect.x1, effect.y1, 2.2, 0.2, 0xff4a4a);
      for (let i = 0; i < 3; i += 1) this.spark(effect.x1, effect.y1, 0xff7070, 2.5, 0.4);
    } else if (effect.kind === "scan") {
      this.flash(effect.x1, effect.y1, (effect.radius ?? 10) * 1.2, 0.5, 0x7fd6ff);
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
      this.shake = Math.max(this.shake, 0.7);
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

  /** 충격 고리: 타격 지점에서 빠르게 퍼지며 사라지는 테두리. */
  private impactRing(x: number, y: number, size: number, tint: number) {
    const sprite = this.particle(this.tex.ring);
    sprite.tint = tint;
    this.particles.push({ sprite, x, y, vx: 0, vy: 0, life: 0.22, max: 0.22, s0: (size * 0.35) / 64, s1: size / 64, a0: 0.9, rise: 0 });
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

  /**
   * 성큰 콜로니 촉수. 땅을 타고 꿈틀대며 대상까지 뻗어 나가(앞 30%) 찍은 뒤(흙·살점이 튀고 충격 고리) 되감긴다.
   * 멀리서 때려도 성큰과 맞는 유닛이 선으로 이어져 보인다.
   */
  /**
   * 캐리어 인터셉터: 공격마다 인터셉터(4기, 수용량 연구 뒤 8기)가 캐리어에서 부채꼴로 흩어져 목표까지 날아가
   * 불꽃을 튀기고 캐리어로 돌아온다. 0~45% 출격, 45~60% 목표 둘레를 돌며 공격, 60~100% 귀환.
   */
  private drawInterceptors(state: StwState) {
    const g = this.interceptorLayer;
    g.clear();
    for (const effect of state.effects) {
      if (effect.kind !== "interceptor") continue;
      if (effect.side !== "player" && !this.visiblePoint(state, effect.x1, effect.y1) && !this.visiblePoint(state, effect.x2, effect.y2)) continue;
      const carrier = effect.attackerId === undefined ? undefined : state.units.find((unit) => unit.id === effect.attackerId);
      const home = carrier ? { x: carrier.x, y: carrier.y } : { x: effect.x1, y: effect.y1 };
      const target = effect.targetId === undefined ? undefined : state.units.find((unit) => unit.id === effect.targetId) ?? state.buildings.find((building) => building.id === effect.targetId);
      const goal = target ? { x: target.x, y: target.y } : { x: effect.x2, y: effect.y2 };
      const t = 1 - effect.ttl / effect.max;
      const count = effect.count ?? 4;
      const dx = goal.x - home.x;
      const dy = goal.y - home.y;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      const team = STW_TEAM[effect.side];
      const where = (i: number, u: number) => {
        // 인터셉터마다 조금씩 늦게 떠나고, 부채꼴로 휘어 날아간다.
        const lane = count > 1 ? i / (count - 1) - 0.5 : 0;
        const p = Math.max(0, Math.min(1, (u - i * 0.015) / (1 - (count - 1) * 0.015)));
        const orbit = { x: goal.x + Math.cos(i * 2.4 + p * 12) * 1.4, y: goal.y + Math.sin(i * 2.4 + p * 12) * 1.4 };
        if (p < 0.45) {
          const s = p / 0.45;
          const ease = 1 - (1 - s) ** 2;
          const bend = Math.sin(s * Math.PI) * lane * Math.min(6, length * 0.45);
          return { x: home.x + (orbit.x - home.x) * ease + nx * bend, y: home.y + (orbit.y - home.y) * ease + ny * bend };
        }
        if (p < 0.6) return orbit;
        const s = (p - 0.6) / 0.4;
        const ease = s * s;
        const bend = Math.sin(s * Math.PI) * -lane * Math.min(5, length * 0.35);
        return { x: orbit.x + (home.x - orbit.x) * ease + nx * bend, y: orbit.y + (home.y - orbit.y) * ease + ny * bend };
      };
      for (let i = 0; i < count; i += 1) {
        const a = where(i, t);
        const b = where(i, Math.min(1, t + 0.02));
        const heading = Math.atan2(b.y - a.y, b.x - a.x);
        const size = 0.42;
        const cos = Math.cos(heading);
        const sin = Math.sin(heading);
        // 작은 화살촉 모양 인터셉터와 짧은 꼬리.
        g.moveTo(a.x - cos * size * 1.6, a.y - sin * size * 1.6).lineTo(a.x, a.y).stroke({ width: 0.18, color: team.light, alpha: 0.45, cap: "round" });
        g.poly([a.x + cos * size, a.y + sin * size, a.x - cos * size * 0.7 - sin * size * 0.6, a.y - sin * size * 0.7 + cos * size * 0.6, a.x - cos * size * 0.7 + sin * size * 0.6, a.y - sin * size * 0.7 - cos * size * 0.6]).fill({ color: 0xf2d98a }).stroke({ width: 0.12, color: 0x3a2a12 });
      }
      // 목표에 닿는 순간 작은 불꽃들.
      if (t >= 0.45 && !this.impacted.has(effect)) {
        this.impacted.add(effect);
        for (let i = 0; i < count; i += 1) this.flash(goal.x + (Math.random() - 0.5) * 2.4, goal.y + (Math.random() - 0.5) * 2.4, 0.8, 0.12, 0xffe7a0);
      }
    }
  }

  private drawTentacles(state: StwState, clock: number) {
    const g = this.tentacleLayer;
    g.clear();
    for (const effect of state.effects) {
      if (effect.kind !== "tentacle") continue;
      if (effect.side !== "player" && !this.visiblePoint(state, effect.x1, effect.y1) && !this.visiblePoint(state, effect.x2, effect.y2)) continue;
      const t = 1 - effect.ttl / effect.max;
      const reach = t < 0.3 ? 1 - (1 - t / 0.3) ** 2 : 1;
      const from = t > 0.6 ? (t - 0.6) / 0.4 : 0;
      if (reach <= from) continue;
      const dx = effect.x2 - effect.x1;
      const dy = effect.y2 - effect.y1;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      const steps = Math.max(6, Math.min(24, Math.round(length * 1.2)));
      const points: Array<[number, number]> = [];
      for (let i = 0; i <= steps; i += 1) {
        const s = from + ((reach - from) * i) / steps;
        const wave = Math.sin(s * Math.PI * 3 - clock * 14) * 0.7 * Math.sin(s * Math.PI) * (t < 0.3 ? 1 : 0.5);
        points.push([effect.x1 + dx * s + nx * wave, effect.y1 + dy * s + ny * wave]);
      }
      for (let i = 1; i < points.length; i += 1) {
        const s = i / points.length;
        g.moveTo(points[i - 1][0], points[i - 1][1]).lineTo(points[i][0], points[i][1]).stroke({ width: 1.1 - s * 0.6, color: 0x6e3d52, cap: "round", alpha: 0.95 });
        g.moveTo(points[i - 1][0], points[i - 1][1]).lineTo(points[i][0], points[i][1]).stroke({ width: 0.5 - s * 0.3, color: 0xc78aa0, cap: "round", alpha: 0.9 });
      }
      // 끝은 뼈 가시.
      const tip = points[points.length - 1];
      const prev = points[Math.max(0, points.length - 3)];
      const angle = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]);
      g.moveTo(tip[0], tip[1]).lineTo(tip[0] + Math.cos(angle) * 0.9, tip[1] + Math.sin(angle) * 0.9).stroke({ width: 0.45, color: 0xe6d6b2, cap: "round" });
      if (t >= 0.3 && !this.impacted.has(effect)) {
        this.impacted.add(effect);
        this.impactRing(effect.x2, effect.y2, 2.2, 0xe6d6b2);
        this.flash(effect.x2, effect.y2, 2, 0.14, 0xe6d6b2);
        for (let i = 0; i < 6; i += 1) this.spark(effect.x2, effect.y2, i % 2 ? 0x8a5468 : 0xe6d6b2, 4, 0.4);
        this.smoke(effect.x2, effect.y2, 1.4, 0.8);
        this.decal(this.tex.scorch, effect.x2, effect.y2, 1.6, 6, 0.3, Math.random() * Math.PI);
      }
    }
  }

  private drawProjectiles(state: StwState) {
    let used = 0;
    for (const effect of state.effects) {
      if (!PROJECTILES.has(effect.kind)) continue;
      const t = 1 - effect.ttl / effect.max;
      const x = effect.x1 + (effect.x2 - effect.x1) * t;
      // 시즈 포탄은 포물선을 그리며 날아간다.
      const arc = effect.kind === "shell" ? Math.sin(t * Math.PI) * Math.min(6, Math.hypot(effect.x2 - effect.x1, effect.y2 - effect.y1) * 0.35) : 0;
      const y = effect.y1 + (effect.y2 - effect.y1) * t - arc;
      if (effect.side !== "player" && !this.visiblePoint(state, x, y)) continue;
      let sprite = this.projectilePool[used];
      if (!sprite) {
        sprite = this.sprite(this.tex.spark, 1.4);
        sprite.blendMode = "add";
        this.fxLayer.addChild(sprite);
        this.projectilePool.push(sprite);
      }
      sprite.visible = true;
      sprite.tint = PROJECTILE_TINT[effect.kind] ?? STW_TEAM[effect.side].glow;
      sprite.scale.set((PROJECTILE_SIZE[effect.kind] ?? 1.3) / 32);
      sprite.position.set(x, y);
      used += 1;
      if (t > (effect.kind === "shell" ? 0.88 : 0.7) && !this.impacted.has(effect)) {
        this.impacted.add(effect);
        if (effect.kind === "yamato") {
          // 야마토 포 명중: 큰 섬광 두 겹, 충격파 고리 둘, 불꽃·연기, 큰 그을음, 강한 화면 흔들림.
          this.shake = Math.max(this.shake, 0.8);
          this.flash(effect.x2, effect.y2, 11, 0.32, 0xfff4d0);
          this.flash(effect.x2, effect.y2, 6, 0.5, 0xff8a3c);
          this.impactRing(effect.x2, effect.y2, 9, 0xffd28a);
          this.impactRing(effect.x2, effect.y2, 5, 0xff6a2a);
          for (let i = 0; i < 18; i += 1) this.spark(effect.x2, effect.y2, i % 3 ? 0xffb050 : 0xfff0a0, 9, 0.8);
          for (let i = 0; i < 6; i += 1) this.smoke(effect.x2, effect.y2, 2.6, 1.6);
          this.decal(this.tex.scorch, effect.x2, effect.y2, 6, 30, 0.6, 0);
        } else if (effect.kind === "scarab" || effect.kind === "shell") {
          // 스캐럽·시즈 포탄 폭발: 큰 섬광, 불꽃, 연기, 그을음, 화면 흔들림.
          const radius = effect.radius ?? 2.4;
          this.shake = Math.max(this.shake, 0.45);
          this.impactRing(effect.x2, effect.y2, radius * 2.6, 0xffd28a);
          this.flash(effect.x2, effect.y2, radius * 3, 0.2, 0xfff0c0);
          for (let i = 0; i < 10; i += 1) this.spark(effect.x2, effect.y2, i % 2 ? 0xffb050 : 0xff7a3c, 7, 0.6);
          for (let i = 0; i < 4; i += 1) this.smoke(effect.x2, effect.y2, radius * 1.1, 1.3);
          this.decal(this.tex.scorch, effect.x2, effect.y2, radius * 2, 25, 0.55, 0);
        } else if (effect.kind === "grenade" || effect.kind === "tankshot") {
          this.flash(effect.x2, effect.y2, effect.kind === "tankshot" ? 2.6 : 2, 0.12, 0xffd28a);
          for (let i = 0; i < 4; i += 1) this.spark(effect.x2, effect.y2, 0xffb050, 4, 0.35);
        } else if (effect.kind === "bullet" || effect.kind === "spine" || effect.kind === "laser" || effect.kind === "neutron" || effect.kind === "glaive" || effect.kind === "flak" || effect.kind === "sporeShot") {
          this.flash(effect.x2, effect.y2, 0.9, 0.06, 0xffe7a0);
          this.spark(effect.x2, effect.y2, 0xffe7a0, 3, 0.25);
        } else {
          this.flash(effect.x2, effect.y2, 1.8, 0.1, STW_TEAM[effect.side].light);
          this.impactRing(effect.x2, effect.y2, 1.6, STW_TEAM[effect.side].light);
        }
      }
    }
    for (let index = used; index < this.projectilePool.length; index += 1) this.projectilePool[index].visible = false;
  }

  private drawStorms(state: StwState, clock: number) {
    const g = this.stormLayer;
    g.clear();
    const z = this.zoneLayer;
    z.clear();
    // 다크 스웜: 유닛을 덮는 어두운 포자 구름. 안의 지상 유닛은 원거리 공격을 받지 않는다.
    for (const zone of state.zones ?? []) {
      if (zone.side !== "player" && !this.visiblePoint(state, zone.x, zone.y)) continue;
      const fade = Math.min(1, zone.ttl / 1, (zone.max - zone.ttl + 0.2) / 0.5);
      z.circle(zone.x, zone.y, zone.radius).fill({ color: 0x2a1a10, alpha: 0.45 * fade });
      for (let i = 0; i < 9; i += 1) {
        const a = (Math.PI * 2 * i) / 9 + clock * 0.4 + zone.id;
        const r = zone.radius * (0.45 + 0.4 * pseudo(zone.id + i));
        z.circle(zone.x + Math.cos(a) * r, zone.y + Math.sin(a) * r, zone.radius * 0.35).fill({ color: 0x4a3420, alpha: 0.35 * fade });
      }
      z.circle(zone.x, zone.y, zone.radius).stroke({ width: 0.15, color: 0x8a6a40, alpha: 0.6 * fade });
    }
    for (const storm of state.storms) {
      if (storm.side !== "player" && !this.visiblePoint(state, storm.x, storm.y)) continue;
      const r = STW_STORM.radius;
      const fade = Math.min(1, storm.ttl / 0.4, (STW_STORM.duration - storm.ttl + 0.15) / 0.3);
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

  private drawOverlay(state: StwState, view: StwView, rallyY: number) {
    this.drawWorkerBadges(state, view);
    const sx = (x: number) => view.ox + x * view.scale;
    const sy = (y: number) => view.oy + y * view.scale;
    {
      const waiting = stwArmy(state, "player").rally.length;
      const label = this.rallyLabel;
      // 집결지 이름은 깃발과 위치로 보이므로 대기 수만 붙인다(지도를 덜 가리게).
      const text = `대기 ${waiting}`;
      if (label.key !== text) {
        label.key = text;
        label.text.text = text;
        label.bg.clear().roundRect(-6, -9, label.text.width + 12, 18, 9).fill({ color: 0x0f2a3a, alpha: 0.8 }).stroke({ width: 1, color: STW_TEAM.player.glow, alpha: 0.7 });
      }
      label.root.position.set(sx(STW_LANE_WIDTH / 2) + 10, sy(rallyY) - 16);
      label.root.visible = sy(rallyY) > -10 && sy(rallyY) < view.height + 10;
    }
    const g = this.bars;
    g.clear();
    // 체력 막대도 진영별 색: 아군은 초록(위험하면 노랑), 적은 주황(위험하면 빨강).
    const bar = (side: StwSide, x: number, y: number, width: number, hp: number, maxHp: number, shields: number, maxShields: number) => {
      const total = maxHp + maxShields;
      g.rect(x - width / 2 - 1, y - 1, width + 2, 5).fill({ color: 0x000000, alpha: 0.65 });
      g.rect(x - width / 2 - 1, y - 1, width + 2, 5).stroke({ width: 1, color: STW_TEAM[side].glow, alpha: 0.9 });
      const hpW = (width * Math.max(0, hp)) / total;
      const shW = (width * Math.max(0, shields)) / total;
      const healthy = hp / maxHp > 0.4;
      g.rect(x - width / 2, y, hpW, 3).fill(side === "player" ? (healthy ? 0x7ce08f : 0xffd166) : healthy ? 0xff9a6e : 0xff3b2e);
      g.rect(x - width / 2 + (width * maxHp) / total, y, shW, 3).fill(0x63c6ff);
    };
    for (const building of state.buildings) {
      const view2 = this.buildingViews.get(building.id);
      if (!view2 || view2.ghost) continue;
      const half = (STW_BUILDINGS[building.type].size / 2) * view.scale;
      const x = sx(building.x);
      const y = sy(building.y);
      if (!stwDone(building)) {
        const r = half * 0.8;
        g.moveTo(x + r, y).arc(x, y, r, 0, Math.PI * 2).stroke({ width: 4, color: 0x000000, alpha: 0.5 });
        g.moveTo(x, y - r).arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * building.progress).stroke({ width: 3, color: 0xffe08a });
        continue;
      }
      if (building.hp < building.maxHp || building.shields < building.maxShields * 0.98) bar(building.side, x, y - half - 7, Math.max(20, half * 2), building.hp, building.maxHp, building.shields, building.maxShields);
      if (building.side === "player") {
        const progress = building.current ? 1 - building.current.remaining / building.current.total : building.queue.length ? 1 - building.queue[0].remaining / STW_UNITS[building.queue[0].unit].time : building.research ? null : null;
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
      bar(unit.side, x, y, Math.max(14, UNIT_SIZE[unit.type] * view.scale * 0.8), unit.hp, unit.maxHp, unit.shields, unit.maxShields);
    }
    // 지역 이름(적 본진·앞마당 등)은 경기 첫 20초만 보이고 2초에 걸쳐 사라진다(익힌 뒤에는 지도를 가리기만 한다).
    const areaAlpha = Math.max(0, Math.min(1, (AREA_LABEL_SECONDS + 2 - state.time) / 2));
    for (const label of this.labels) {
      label.root.position.set(Math.max(6, sx(0) + 6), sy(label.y));
      label.root.alpha = areaAlpha;
      label.root.visible = areaAlpha > 0 && sy(label.y) > -10 && sy(label.y) < view.height + 10;
    }
  }
}

const PROJECTILES = new Set<StwEffect["kind"]>(["plasma", "photon", "scarab", "bullet", "grenade", "tankshot", "shell", "spine", "laser", "neutron", "glaive", "flak", "sporeShot", "yamato"]);
const PROJECTILE_TINT: Partial<Record<StwEffect["kind"], number>> = { scarab: 0xffb347, bullet: 0xffe7a0, grenade: 0xff9a3c, tankshot: 0xffd28a, shell: 0xffc46b, spine: 0xd8f09a, laser: 0xff6a6a, neutron: 0x9fd8ff, glaive: 0xb6ff8a, flak: 0xffe7a0, sporeShot: 0xc8a0e0, yamato: 0xff8a3c };
const PROJECTILE_SIZE: Partial<Record<StwEffect["kind"], number>> = { scarab: 2.2, photon: 1.6, bullet: 0.7, grenade: 1.2, tankshot: 1.5, shell: 1.9, spine: 0.9, yamato: 3.2 };
/** 마법 빛깔. */
const SPELL_COLOR: Record<string, number> = {
  feedback: 0x6fb8ff, maelstrom: 0xb07dff, stasis: 0x9fe8ff, lockdown: 0x7fd0ff, matrix: 0x6fd0ff, emp: 0x9fd8ff, irradiate: 0x8aff7a,
  yamato: 0xff8a3c, ensnare: 0xe2e88a, broodling: 0xc9a0b8, darkSwarm: 0x8a6a40, plague: 0xb8c46a,
};

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
