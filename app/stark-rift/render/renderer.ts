import {
  COMMAND_FEEDBACK_MS,
  type CommandFeedback,
} from "../input/command-feedback";
import { updateEconomicMarker, drawResource } from "./economy-art";
import {
  Application,
  Container,
  Graphics,
  Sprite,
  Texture,
  Ticker,
  type WebGLRenderer,
} from "pixi.js";
import type { BattleMap } from "../data/maps";
import {
  validateRenderSnapshot,
  type RenderSnapshot,
} from "../worker/render-snapshot";
import { BattleCamera } from "./camera";
import { isPortraitViewport } from "../input/portrait-mode";
import { updateMinimapMarker, updateUnitMarker } from "./marker-visual";

const TERRAIN_COLORS = [0x1d3035, 0x2f4443, 0x111c27, 0x536762, 0x090f1d];
export class BattleRenderer {
  private combatEffects = new Graphics();
  private commandMarker = new Graphics();
  private commandFeedback: CommandFeedback | null = null;
  private feedbackAt = 0;
  readonly camera: BattleCamera;
  minimapAction?: (point: { x: number; y: number }) => boolean;
  private app = new Application();
  private minimap = new Application();
  private creep = new Graphics();
  private resources = new Container();
  private resourceSprites = new Map<string, Graphics>();
  private creepKey = "";
  private placement = new Graphics();
  private world = new Container();
  private units = new Container();
  private minimapUnits = new Container();
  private viewportOutline = new Graphics();
  private terrainTexture?: Texture;
  private minimapTerrainTexture?: Texture;
  private fogTexture?: Texture;
  private fogCanvas = document.createElement("canvas");
  private fogMask: Uint8Array;
  private sprites = new Map<number, Graphics>();
  private pool: Graphics[] = [];
  private miniSprites = new Map<number, Graphics>();
  private miniPool: Graphics[] = [];
  private viewportKey = "";
  private snapshot: RenderSnapshot | null = null;
  private disposed = false;
  private initialized = false;
  private initializing = false;
  private cleaned = false;
  private pendingTerrain?: Graphics;
  private previousPositions = new Map<number, { x: number; y: number }>();
  private receivedAt = 0;
  private ticker = new Ticker();
  private selectedIds = new Set<number>();
  private previewIds = new Set<number>();
  setSelection(selected: number[], preview: number[] = []): void {
    this.selectedIds = new Set(selected);
    this.previewIds = new Set(preview);
    this.draw();
  }
  private resizeObserver?: ResizeObserver;
  private cleanups: (() => void)[] = [];
  constructor(
    private map: BattleMap,
    private battlefield: HTMLElement,
    private minimapHost: HTMLElement,
    private contextLost: () => void,
    private cameraMoved?: () => void,
  ) {
    this.camera = new BattleCamera(map.widthTiles, map.heightTiles);
    this.fogMask = new Uint8Array(map.widthTiles * map.heightTiles).fill(255);
  }
  async init(): Promise<void> {
    if (this.disposed) return;
    if (this.initializing || this.initialized)
      throw new Error("Renderer already initialized.");
    this.initializing = true;
    const options = {
      preference: "webgl" as const,
      preferWebGLVersion: 2 as const,
      autoStart: false,
      antialias: false,
      resolution: Math.min(devicePixelRatio || 1, 3),
      autoDensity: true,
      background: 0x070b12,
    };
    try {
      await this.app.init({
        ...options,
        width: this.battlefield.clientWidth || 1,
        height: this.battlefield.clientHeight || 1,
      });
      if (this.disposed) return;
      await this.minimap.init({
        ...options,
        width: this.minimapHost.clientWidth || 1,
        height: this.minimapHost.clientHeight || 1,
      });
      this.initialized = true;
      if (this.disposed) return;
      if (
        [this.app, this.minimap].some(
          (app) => (app.renderer as WebGLRenderer).context.webGLVersion !== 2,
        )
      )
        throw new Error("WebGL2 is required.");
      this.battlefield.append(this.app.canvas);
      this.minimapHost.append(this.minimap.canvas);
      this.app.stage.addChild(this.world);
      const terrain = new Graphics();
      this.pendingTerrain = terrain;
      for (let i = 0; i < this.map.terrain.length; i++)
        terrain
          .rect(
            i % this.map.widthTiles,
            Math.floor(i / this.map.widthTiles),
            1,
            1,
          )
          .fill(TERRAIN_COLORS[this.map.terrain[i]]);
      for (let i = 0; i < this.map.terrain.length; i++)
        if (this.map.walkable[i]) {
          const x = i % this.map.widthTiles,
            y = Math.floor(i / this.map.widthTiles),
            v = (x * 17 + y * 37) % 11;
          if (v < 7)
            terrain
              .poly([x + 0.1, y + 0.75, x + 0.3, y + 0.6, x + 0.65, y + 0.68])
              .stroke({
                width: 0.035,
                color: this.map.terrain[i] === 1 ? 0x526361 : 0x40515a,
              });
          if (v === 4 || v === 8)
            terrain.circle(x + 0.65, y + 0.34, 0.065).fill(0x1e3436);
          if (v === 6)
            terrain.rect(x + 0.2, y + 0.15, 0.55, 0.035).fill(0x253c3e);
          if (this.map.terrain[i] === 3)
            terrain.rect(x + 0.08, y + 0.2, 0.84, 0.12).fill(0x78828a);
        }
      // Terrain texture generation is static; resource silhouettes remain individually removable.
      for (const node of this.map.resourceNodes) {
        const sprite = new Graphics();
        drawResource(sprite, node.kind);
        sprite.position.set(node.x + 0.5, node.y + 0.5);
        this.resources.addChild(sprite);
        this.resourceSprites.set(node.id, sprite);
      }
      this.terrainTexture = this.app.renderer.generateTexture({
        target: terrain,
        resolution: 8,
      });
      // RenderTextures live on their creating GPU context; minimap has a separate renderer.
      this.minimapTerrainTexture = this.minimap.renderer.generateTexture({
        target: terrain,
        resolution: 8,
      });
      terrain.destroy();
      this.pendingTerrain = undefined;
      this.world.addChild(
        new Sprite(this.terrainTexture),
        this.creep,
        this.resources,
        this.units,
        this.combatEffects,
        this.placement,
      );
      const miniTerrain = new Sprite(this.minimapTerrainTexture);
      miniTerrain.label = "terrain";
      this.minimap.stage.addChild(miniTerrain, this.minimapUnits);
      this.fogCanvas.width = this.map.widthTiles;
      this.fogCanvas.height = this.map.heightTiles;
      this.fogTexture = Texture.from(this.fogCanvas);
      this.fogTexture.source.scaleMode = "nearest";
      this.world.addChild(new Sprite(this.fogTexture), this.commandMarker);
      this.minimap.stage.addChild(
        new Sprite(this.fogTexture),
        this.viewportOutline,
      );
      this.updateFog(new Uint8Array(this.fogMask.length));
      const lost = (event: Event) => {
        event.preventDefault();
        this.ticker.stop();
        this.contextLost();
      };
      for (const canvas of [this.app.canvas, this.minimap.canvas]) {
        canvas.addEventListener("webglcontextlost", lost);
        this.cleanups.push(() =>
          canvas.removeEventListener("webglcontextlost", lost),
        );
      }
      const recenter = (event: PointerEvent) => {
        if (!isPortraitViewport()) return;
        if (
          event.type === "pointermove" &&
          !this.minimap.canvas.hasPointerCapture(event.pointerId)
        )
          return;
        const r = this.minimap.canvas.getBoundingClientRect();
        if (
          event.type === "pointerdown" &&
          this.minimapAction?.({
            x: Math.max(
              0,
              Math.min(
                this.map.widthTiles * 256 - 1,
                ((event.clientX - r.left) / r.width) *
                  this.map.widthTiles *
                  256,
              ),
            ),
            y: Math.max(
              0,
              Math.min(
                this.map.heightTiles * 256 - 1,
                ((event.clientY - r.top) / r.height) *
                  this.map.heightTiles *
                  256,
              ),
            ),
          })
        )
          return;
        if (event.type === "pointerdown")
          this.minimap.canvas.setPointerCapture(event.pointerId);
        this.camera.setCenter(
          ((event.clientX - r.left) / r.width) * this.map.widthTiles * 256,
          ((event.clientY - r.top) / r.height) * this.map.heightTiles * 256,
          this.app.screen.width,
          this.app.screen.height,
        );
        this.draw();
        this.cameraMoved?.();
      };
      this.minimap.canvas.addEventListener("pointerdown", recenter);
      this.minimap.canvas.addEventListener("pointermove", recenter);
      this.cleanups.push(() => {
        this.minimap.canvas.removeEventListener("pointerdown", recenter);
        this.minimap.canvas.removeEventListener("pointermove", recenter);
      });
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.battlefield);
      this.resizeObserver.observe(this.minimapHost);
      this.resize();
      this.ticker.maxFPS = 60;
      this.ticker.add(this.draw);
      this.ticker.start();
    } catch (error) {
      this.disposed = true;
      throw error;
    } finally {
      this.initializing = false;
      if (this.disposed) this.releaseResources();
    }
  }
  get canvas(): HTMLCanvasElement {
    return this.app.canvas;
  }
  private updateFog(mask: Uint8Array) {
    const ctx = this.fogCanvas.getContext("2d")!;
    const image = ctx.getImageData(
      0,
      0,
      this.map.widthTiles,
      this.map.heightTiles,
    );
    let dirty = false;
    for (let i = 0; i < mask.length; i++)
      if (mask[i] !== this.fogMask[i]) {
        image.data[i * 4 + 3] = mask[i] === 2 ? 0 : mask[i] === 1 ? 175 : 255;
        dirty = true;
      }
    if (dirty) {
      this.fogMask.set(mask);
      ctx.putImageData(image, 0, 0);
      this.fogTexture!.source.update();
    }
  }
  setSnapshot(snapshot: RenderSnapshot): void {
    if (
      this.disposed ||
      !this.initialized ||
      snapshot.tick < (this.snapshot?.tick ?? -1)
    )
      return;
    if (
      !validateRenderSnapshot(snapshot).ok ||
      snapshot.widthTiles !== this.map.widthTiles ||
      snapshot.heightTiles !== this.map.heightTiles
    )
      throw new RangeError("Invalid render snapshot.");
    this.previousPositions.clear();
    for (const entity of this.snapshot?.entities ?? [])
      this.previousPositions.set(entity.id, { x: entity.x, y: entity.y });
    if (snapshot.economy) {
      for (const r of snapshot.economy.resources) {
        const sprite = this.resourceSprites.get(r.nodeId);
        if (sprite)
          sprite.visible =
            r.amount > 0 ||
            this.map.resourceNodes.find((n) => n.id === r.nodeId)?.kind ===
              "gas";
      }
      const key = snapshot.economy.creepCells.join(",");
      if (key !== this.creepKey) {
        this.creepKey = key;
        this.creep.clear();
        for (const cell of snapshot.economy.creepCells)
          this.creep
            .rect(
              cell % this.map.widthTiles,
              Math.floor(cell / this.map.widthTiles),
              1,
              1,
            )
            .fill({ color: 0x673b60, alpha: 0.5 });
      }
    }
    this.combatEffects.clear();
    for (const e of snapshot.combat?.effects ?? []) {
      const color = e.owner === snapshot.viewerPlayerId ? 0xffda8b : 0xff7c80,
        age = (snapshot.tick - e.tick) / 9;
      if (e.kind === "death")
        this.combatEffects
          .circle(e.x / 256, e.y / 256, 0.3 + age * 0.5)
          .stroke({ color: 0xff9d65, width: 0.08, alpha: 1 - age });
      else {
        if (e.kind === "shot")
          this.combatEffects
            .moveTo(e.x / 256, e.y / 256)
            .lineTo(e.toX / 256, e.toY / 256)
            .stroke({ color, width: 0.045, alpha: 1 - age });
        this.combatEffects
          .circle(e.toX / 256, e.toY / 256, 0.12 + age * 0.2)
          .stroke({ color, width: 0.07, alpha: 1 - age });
      }
    }
    this.snapshot = snapshot;
    this.receivedAt = performance.now();
    this.updateFog(snapshot.visibility);
    const current = new Set(snapshot.entities.map((e) => e.id));
    for (const [id, sprite] of this.sprites)
      if (!current.has(id)) {
        this.units.removeChild(sprite);
        this.sprites.delete(id);
        this.pool.push(sprite);
        const mini = this.miniSprites.get(id)!;
        this.minimapUnits.removeChild(mini);
        this.miniSprites.delete(id);
        this.miniPool.push(mini);
      }
    for (const entity of snapshot.entities)
      if (!this.sprites.has(entity.id)) {
        const sprite = this.pool.pop() ?? new Graphics();
        this.sprites.set(entity.id, sprite);
        this.units.addChild(sprite);
        const mini = this.miniPool.pop() ?? new Graphics();
        this.miniSprites.set(entity.id, mini);
        this.minimapUnits.addChild(mini);
      }
    this.draw();
  }
  setPlacement(
    value: {
      tileX: number;
      tileY: number;
      width: number;
      height: number;
      status: "valid" | "blocked" | "warning";
    } | null,
  ): void {
    this.placement.clear();
    if (value) {
      const color =
        value.status === "valid"
          ? 0x73dfb7
          : value.status === "warning"
            ? 0xf0c26a
            : 0xf07679;
      this.placement
        .rect(value.tileX, value.tileY, value.width, value.height)
        .fill({ color, alpha: 0.2 })
        .stroke({ color, width: 0.08 });
    }
    this.draw();
  }
  setCommandFeedback(value: CommandFeedback | null): void {
    if (value?.id === this.commandFeedback?.id) return;
    this.commandFeedback = value;
    this.feedbackAt = performance.now();
    this.commandMarker.clear();
    this.commandMarker.visible = !!value;
    if (value) {
      const color = {
        move: 0x8cebd8,
        attack: 0xff8585,
        patrol: 0xe3c68b,
        rally: 0x8cbbff,
        gather: 0x9de290,
        build: 0xf0bf72,
      }[value.kind];
      this.commandMarker
        .circle(0, 0, 12)
        .stroke({ color, width: 2 })
        .circle(0, 0, 2)
        .fill(color);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        this.commandMarker
          .moveTo(dx * 16, dy * 16)
          .lineTo(dx * 8, dy * 8)
          .stroke({ color, width: 2 });
      this.commandMarker.position.set(value.x / 256, value.y / 256);
    }
    this.draw();
  }
  private resize(): void {
    if (this.disposed || !isPortraitViewport()) return;
    this.app.renderer.resize(
      Math.max(1, this.battlefield.clientWidth),
      Math.max(1, this.battlefield.clientHeight),
    );
    this.minimap.renderer.resize(
      Math.max(1, this.minimapHost.clientWidth),
      Math.max(1, this.minimapHost.clientHeight),
    );
    this.camera.setCenter(
      this.camera.centerX,
      this.camera.centerY,
      this.app.screen.width,
      this.app.screen.height,
    );
    this.draw();
  }
  draw = (): void => {
    if (this.disposed || !this.initialized || !isPortraitViewport()) return;
    const w = this.app.screen.width,
      h = this.app.screen.height,
      scale = this.camera.scale(w, h),
      bounds = this.camera.bounds(w, h);
    this.world.scale.set(scale * 256);
    this.world.position.set(
      w / 2 - this.camera.centerX * scale,
      h / 2 - this.camera.centerY * scale,
    );
    const age = (performance.now() - this.feedbackAt) / COMMAND_FEEDBACK_MS;
    this.commandMarker.visible = !!this.commandFeedback && age < 1;
    if (this.commandMarker.visible) {
      this.commandMarker.alpha = 1 - age;
      this.commandMarker.scale.set((1.25 - 0.4 * age) / (scale * 256));
    }
    const alpha = Math.min(
      1,
      Math.max(0, (performance.now() - this.receivedAt) / 50),
    );
    for (const entity of this.snapshot?.entities ?? []) {
      const previous = this.previousPositions.get(entity.id) ?? entity;
      const x = previous.x + (entity.x - previous.x) * alpha,
        y = previous.y + (entity.y - previous.y) * alpha;
      const sprite = this.sprites.get(entity.id)!;
      sprite.position.set(x / 256, y / 256);
      sprite.visible =
        x >= bounds.left - 768 &&
        x <= bounds.right + 768 &&
        y >= bounds.top - 768 &&
        y <= bounds.bottom + 768;
      const color =
        entity.owner === this.snapshot!.viewerPlayerId ? 0x64dce0 : 0xf57278;
      if (sprite.visible) {
        const ring = this.previewIds.has(entity.id)
            ? 0xffd479
            : this.selectedIds.has(entity.id)
              ? 0x80ffaa
              : null,
          b = this.snapshot!.economy?.structures.find(
            (b) => b.entityId === entity.id,
          );
        if (
          !updateEconomicMarker(
            sprite,
            entity,
            color,
            ring,
            b && !b.completed ? 1 - b.remainingTicks / b.totalTicks : null,
            b?.started ?? true,
          )
        )
          updateUnitMarker(
            sprite,
            color,
            this.camera.zoom >= 1.5,
            ring,
            entity.radius,
          );
      }
      const mini = this.miniSprites.get(entity.id)!;
      updateMinimapMarker(mini, color);
      mini.position.set(entity.x / 256, entity.y / 256);
    }
    const viewportKey = `${bounds.left}:${bounds.top}:${bounds.right}:${bounds.bottom}`;
    if (viewportKey !== this.viewportKey) {
      this.viewportKey = viewportKey;
      this.viewportOutline
        .clear()
        .rect(
          bounds.left / 256,
          bounds.top / 256,
          (bounds.right - bounds.left) / 256,
          (bounds.bottom - bounds.top) / 256,
        )
        .stroke({ width: 0.4, color: 0xffffff });
    }
    this.minimap.stage.scale.set(
      this.minimap.screen.width / this.map.widthTiles,
      this.minimap.screen.height / this.map.heightTiles,
    );
    this.app.render();
    this.minimap.render();
  };
  private destroyApplications(): void {
    if (this.app.renderer)
      this.app.destroy(
        { removeView: true },
        { children: true, texture: false },
      );
    if (this.minimap.renderer)
      this.minimap.destroy(
        { removeView: true },
        { children: true, texture: false },
      );
  }
  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (!this.initializing) this.releaseResources();
  }
  private releaseResources(): void {
    if (this.cleaned) return;
    this.cleaned = true;
    this.ticker.destroy();
    this.resizeObserver?.disconnect();
    this.cleanups.forEach((fn) => fn());
    this.pendingTerrain?.destroy();
    this.pendingTerrain = undefined;
    this.destroyApplications();
    for (const display of [
      this.world,
      this.minimapUnits,
      this.viewportOutline,
      this.commandMarker,
      this.combatEffects,
    ])
      if (!display.destroyed) display.destroy({ children: true });
    this.pool.forEach((sprite) => sprite.destroy());
    this.miniPool.forEach((sprite) => sprite.destroy());
    this.terrainTexture?.destroy(true);
    this.minimapTerrainTexture?.destroy(true);
    this.fogTexture?.destroy(true);
  }
}
