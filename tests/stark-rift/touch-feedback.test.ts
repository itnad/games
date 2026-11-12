import { describe, it, expect } from "vitest";
import { createScenario } from "../../tools/stark-rift-lab/scenarios";
import { createRenderSnapshot } from "../../app/stark-rift/worker/render-snapshot";
import { commandFeedback } from "../../app/stark-rift/input/command-feedback";
import { contextHit } from "../../app/stark-rift/input/context-hit";
describe("touch targets and command feedback", () => {
  it("shows the exact input point for move, attack, rally and construction without changing the snapshot", () => {
    const f = createScenario("economy-terran"),
      snap = createRenderSnapshot(
        f.state,
        f.map,
        0,
        new Uint8Array(96 * 96).fill(2),
      ),
      before = structuredClone(snap),
      target = { kind: "point" as const, x: 4567, y: 3456 };
    for (const kind of ["move", "attackMove", "setRallyPoint"] as const)
      expect(
        commandFeedback({ kind, entityIds: [2], target }, snap, f.map, 7),
      ).toMatchObject({
        id: 7,
        x: 4567,
        y: 3456,
        kind:
          kind === "move" ? "move" : kind === "attackMove" ? "attack" : "rally",
      });
    expect(
      commandFeedback(
        {
          kind: "placeBuilding",
          entityIds: [2],
          target,
          payload: { buildingId: "terran-supply-depot" },
        },
        snap,
        f.map,
        8,
      )?.kind,
    ).toBe("build");
    expect(
      commandFeedback({ kind: "stop", entityIds: [2] }, snap, f.map, 9),
    ).toBeNull();
    expect(snap).toEqual(before);
  });
  it("uses only visible target entities and maps gather taps to the resource center", () => {
    const f = createScenario("economy-terran"),
      snap = createRenderSnapshot(
        f.state,
        f.map,
        0,
        new Uint8Array(96 * 96).fill(2),
      ),
      n = f.map.resourceNodes[0];
    expect(
      commandFeedback(
        {
          kind: "focusAttack",
          entityIds: [2],
          target: { kind: "entity", entityId: 99999 },
        },
        snap,
        f.map,
        1,
      ),
    ).toBeNull();
    expect(
      commandFeedback(
        { kind: "gather", entityIds: [2], payload: { resourceId: n.id } },
        snap,
        f.map,
        2,
      ),
    ).toMatchObject({ x: n.x * 256 + 128, y: n.y * 256 + 128, kind: "gather" });
  });
  it("selects a worker in the resource touch area, while a mineral-center tap still gathers", () => {
    const f = createScenario("economy-terran"),
      snap = createRenderSnapshot(
        f.state,
        f.map,
        0,
        new Uint8Array(96 * 96).fill(2),
      ),
      n = f.map.resourceNodes[0],
      worker = snap.entities.find((e) => e.id === 2)!;
    worker.x = n.x * 256 + 128;
    worker.y = n.y * 256 + 128 + 192;
    expect(
      contextHit(snap, f.map, { x: worker.x, y: worker.y }, [3], 150, 32),
    ).toEqual({ entityId: 2, kind: "worker" });
    expect(
      contextHit(
        snap,
        f.map,
        { x: n.x * 256 + 128, y: n.y * 256 + 128 },
        [3],
        150,
        32,
      ),
    ).toEqual({ entityId: -1, kind: "worker" });
  });
  it("still gathers from a refinery when a worker taps the gas node", () => {
    const f = createScenario("economy-terran"),
      snap = createRenderSnapshot(
        f.state,
        f.map,
        0,
        new Uint8Array(96 * 96).fill(2),
      ),
      n = f.map.resourceNodes.find((n) => n.kind === "gas")!,
      index = f.map.resourceNodes.indexOf(n);
    snap.entities.push({
      id: 999,
      owner: 0,
      definitionId: "terran-refinery",
      x: n.x * 256 + 128,
      y: n.y * 256 + 128,
      health: 750,
      kind: "building",
      layer: "ground",
      radius: 512,
    });
    expect(
      contextHit(
        snap,
        f.map,
        { x: n.x * 256 + 128, y: n.y * 256 + 128 },
        [2],
        150,
        32,
      ),
    ).toEqual({ entityId: -index - 1, kind: "worker" });
  });
});
