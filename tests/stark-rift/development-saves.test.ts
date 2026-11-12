import { describe, expect, it } from "vitest";
import {
  DevelopmentSaveStore,
  DEVELOPMENT_SAVE_PREFIX,
} from "../../app/stark-rift/ui/development-saves";
import { createPersistenceEnvelope } from "../../app/stark-rift/core/state";
import { startSimulation } from "../../app/stark-rift/core/simulation";
import { getRuntimeMap } from "../../app/stark-rift/data/maps";
import { initializeEconomy } from "../../app/stark-rift/economy/helpers";
import { checksum } from "../../app/stark-rift/core/checksum";
import type { Faction } from "../../app/stark-rift/data/economy-catalog";
function saved(faction: Faction) {
  const { map, dataVersion } = getRuntimeMap("rift-basin");
  const s = startSimulation(
    42,
    map.id,
    dataVersion,
    [0, 1].map((id) => ({
      id,
      faction,
      minerals: 50,
      gas: 0,
      supplyUsedHalf: 0,
      supplyCapHalf: 0,
    })),
  );
  initializeEconomy(s, map);
  return createPersistenceEnvelope(
    s,
    {
      camera: { centerX: 3584, centerY: 3584, zoomLevel: 1 },
      selection: { entityIds: [1], controlGroupIds: [] },
      openPanel: null,
    },
    [],
    "2026-11-11T00:00:00.000Z",
  );
}
function storage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
describe("hosted development saves", () => {
  it("restores all three races independently after reconstructing the store", () => {
    const s = storage(),
      writer = new DevelopmentSaveStore(s);
    for (const faction of ["terran", "zerg", "protoss"] as const)
      expect(writer.write(saved(faction))).toBe(true);
    const restored = new DevelopmentSaveStore(s);
    for (const faction of ["terran", "zerg", "protoss"] as const) {
      const result = restored.read(faction);
      expect(result.status).toBe("ready");
      if (result.status === "ready")
        expect(checksum(result.snapshot.simulation)).toBe(
          checksum(saved(faction).simulation),
        );
    }
    expect([...s.data.keys()]).toEqual(
      ["terran", "zerg", "protoss"].map((f) => DEVELOPMENT_SAVE_PREFIX + f),
    );
  });
  it("rejects corrupted, incompatible and wrong-race records without replacing them", () => {
    const s = storage(),
      store = new DevelopmentSaveStore(s),
      key = DEVELOPMENT_SAVE_PREFIX + "terran";
    for (const value of [
      "{",
      JSON.stringify({}),
      JSON.stringify({ ...saved("terran"), formatVersion: 0 }),
      JSON.stringify(saved("zerg")),
    ]) {
      s.data.set(key, value);
      expect(store.read("terran").status).toBe("invalid");
      expect(s.data.get(key)).toBe(value);
    }
  });
  it("rejects checksummed state whose economic or movement positions leave the map", () => {
    const s = storage(),
      store = new DevelopmentSaveStore(s),
      outside = saved("terran");
    outside.simulation.entities.x[0] = 999999;
    outside.checksum = checksum(outside.simulation);
    s.data.set(DEVELOPMENT_SAVE_PREFIX + "terran", JSON.stringify(outside));
    expect(store.read("terran").status).toBe("invalid");
    expect(store.write(outside)).toBe(false);
  });
  it("handles unavailable storage and quota failures without deleting a valid record", () => {
    const readFail = new DevelopmentSaveStore({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    });
    expect(readFail.read("terran").status).toBe("unavailable");
    const s = storage(),
      store = new DevelopmentSaveStore(s);
    store.write(saved("terran"));
    const previous = s.getItem(DEVELOPMENT_SAVE_PREFIX + "terran");
    const full = new DevelopmentSaveStore({
      getItem: s.getItem,
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(full.write(saved("terran"))).toBe(false);
    expect(full.read("terran").status).toBe("ready");
    expect(s.getItem(DEVELOPMENT_SAVE_PREFIX + "terran")).toBe(previous);
  });
});
