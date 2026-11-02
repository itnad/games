import { describe, expect, it } from "vitest";
import { createRiftBasin, mapDistances, validateBattleMap } from "../../app/stark-rift/data/maps";
import { BattleCamera } from "../../app/stark-rift/render/camera";
import { createRenderSnapshot, validateRenderSnapshot } from "../../app/stark-rift/worker/render-snapshot";
import { startSimulation } from "../../app/stark-rift/core/simulation";
import { createEntity } from "../../app/stark-rift/core/world";

describe("Rift Basin", () => {
  it("is symmetric, fully connected and matches each base's resource counts", () => {
    const map = createRiftBasin();
    expect(() => validateBattleMap(map)).not.toThrow();
    for (const region of map.regions.filter(r => r.kind !== "ramp")) {
      const nodes = map.resourceNodes.filter(n => n.baseId === region.id);
      expect(nodes.filter(n => n.kind === "mineral")).toHaveLength({ main: 8, natural: 7, outer: 6, center: 8, ramp: 0 }[region.kind]);
      expect(nodes.filter(n => n.kind === "gas")).toHaveLength(region.kind === "center" ? 2 : 1);
    }
    const a = mapDistances(map, map.spawnPoints[0]), b = mapDistances(map, map.spawnPoints[1]);
    expect([...a]).toEqual([...b].reverse());
    expect(a[81 * 96 + 81]).toBeGreaterThan(0);
    expect(map.height[14 * 96 + 14]).toBe(1);
  });
  it("has one main ramp, central bridge and both outer routes across the rift", () => {
    const map = createRiftBasin();
    expect([20, 21, 22, 23].every(x => map.walkable[25 * 96 + x] === 1)).toBe(true);
    expect(map.walkable[25 * 96 + 19]).toBe(0);
    expect(map.walkable[47 * 96 + 30]).toBe(0);
    for (const x of [12, 47, 83]) expect(map.walkable[47 * 96 + x]).toBe(1);
  });
  it("rejects asymmetric terrain/resources and isolated regions", () => {
    const map = createRiftBasin(); map.walkable[10 * 96 + 10] = 0;
    expect(() => validateBattleMap(map)).toThrow();
    const resources = createRiftBasin(); resources.resourceNodes[0].amount++;
    expect(() => validateBattleMap(resources)).toThrow();
    const blocked = createRiftBasin();
    for (const x of [20, 21, 22, 23]) { const i = 25 * 96 + x; blocked.walkable[i] = blocked.walkable[9215 - i] = 0; }
    expect(() => validateBattleMap(blocked)).toThrow(/isolated/);
  });
});
describe("camera transformations", () => {
  it.each([0, 1, 2, 0.5, 1.5])("round-trips coordinates at zoom %s", zoom => {
    const camera = new BattleCamera(96, 96); camera.setZoom(zoom, 390, 422);
    const screen = camera.worldToScreen(12400, 12500, 390, 422);
    const world = camera.screenToWorld(screen.x, screen.y, 390, 422);
    expect(world.x).toBeCloseTo(12400); expect(world.y).toBeCloseTo(12500);
    camera.setCenter(-10000, 999999, 390, 422);
    const bounds = camera.bounds(390, 422);
    expect(bounds.left).toBeGreaterThanOrEqual(-0.000001);
    expect(bounds.bottom).toBeLessThanOrEqual(96 * 256 + 0.000001);
  });
  it("preserves center on resize and clamps zoom", () => {
    const camera = new BattleCamera(96, 96); camera.setCenter(12000, 11000, 390, 422);
    camera.setCenter(camera.centerX, camera.centerY, 422, 390);
    expect(camera.centerX).toBe(12000); expect(camera.centerY).toBe(11000);
    camera.setZoom(20, 390, 422); expect(camera.zoom).toBe(2);
    expect(() => camera.setZoom(NaN, 390, 422)).toThrow();
  });
});
describe("player-visible render boundary", () => {
  it("omits hidden enemies, retains friendly units and copies the fog mask", () => {
    const map = createRiftBasin();
    const state = startSimulation(1, map.id, "fixture", [0, 1].map(id => ({ id, faction: "terran", minerals: 50, gas: 0, supplyUsedHalf: 0, supplyCapHalf: 20 })));
    createEntity(state, { owner: 0, definitionId: "own", x: 14 * 256, y: 14 * 256, health: 10 });
    createEntity(state, { owner: 1, definitionId: "hidden", x: 81 * 256, y: 81 * 256, health: 10 });
    const visibility = new Uint8Array(96 * 96);
    expect(createRenderSnapshot(state, map, 0, visibility).entities.map(e => e.definitionId)).toEqual(["own"]);
    visibility[81 * 96 + 81] = 1;
    expect(createRenderSnapshot(state, map, 0, visibility).entities).toHaveLength(1);
    visibility[81 * 96 + 81] = 2;
    const snapshot = createRenderSnapshot(state, map, 0, visibility);
    expect(snapshot.entities).toHaveLength(2);
    expect(validateRenderSnapshot(snapshot).ok).toBe(true);
    expect(validateRenderSnapshot({ ...snapshot, visibility: new Uint8Array(1) }).ok).toBe(false);
    const concealed = new Uint8Array(96 * 96);
    expect(validateRenderSnapshot({ ...snapshot, visibility: concealed }).ok).toBe(false);
    expect(validateRenderSnapshot({ ...snapshot, entities: [...snapshot.entities, snapshot.entities[0]] }).ok).toBe(false);
    visibility.fill(0); expect(snapshot.visibility[81 * 96 + 81]).toBe(2);
    expect(() => createRenderSnapshot(state, map, 99, visibility)).toThrow();
  });
});
