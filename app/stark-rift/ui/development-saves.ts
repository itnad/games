import { combatFitsMap } from "../combat/rules";
import type { Scenario } from "../combat/state";
import {
  validatePersistenceEnvelope,
  migrateStage4Envelope,
  type PersistenceEnvelope,
} from "../core/state";
import { getRuntimeMap } from "../data/maps";
import type { Faction } from "../data/economy-catalog";
import { economyFitsMap } from "../economy/validation";
import { navigationFitsMap } from "../pathfinding/navigation";

export const DEVELOPMENT_SAVE_PREFIX = "paperoid.stark-rift.development.v1.";
export type SaveStorage = Pick<Storage, "getItem" | "setItem">;
export type DevelopmentSave =
  | { status: "ready"; snapshot: PersistenceEnvelope }
  | { status: "empty" | "invalid" | "unavailable" };

/** Experimental saves are isolated per race and from any future campaign save. */
export class DevelopmentSaveStore {
  constructor(private storage: SaveStorage) {}
  private valid(
    input: unknown,
    faction: Faction,
  ): input is PersistenceEnvelope {
    const parsed = validatePersistenceEnvelope(input);
    if (!parsed.ok) return false;
    const saved = parsed.value,
      s = saved.simulation,
      { map, dataVersion } = getRuntimeMap("rift-basin");
    const inside = (p: { x: number; y: number }) =>
      p.x >= 0 &&
      p.y >= 0 &&
      p.x < map.widthTiles * 256 &&
      p.y < map.heightTiles * 256;
    return (
      saved.dataVersion === dataVersion &&
      s.map.definitionId === map.id &&
      s.economy.enabled &&
      s.players[0]?.faction === faction &&
      (s.phase === "running" || s.phase === "paused") &&
      economyFitsMap(s, map) &&
      combatFitsMap(s, map) &&
      navigationFitsMap(s, map) &&
      s.entities.x.every((x, i) => inside({ x, y: s.entities.y[i] })) &&
      s.movement.every(
        (m) => (m.target === null || inside(m.target)) && m.path.every(inside),
      )
    );
  }
  read(faction: Faction, scenario: Scenario = "economy"): DevelopmentSave {
    let serialized: string | null;
    try {
      serialized = this.storage.getItem(
        DEVELOPMENT_SAVE_PREFIX +
          (scenario === "combat-practice" ? "combat." : "") +
          faction,
      );
    } catch {
      return { status: "unavailable" };
    }
    if (serialized === null) return { status: "empty" };
    if (serialized.length > 16 * 1024 * 1024) return { status: "invalid" };
    try {
      const saved: unknown = migrateStage4Envelope(JSON.parse(serialized));
      return this.valid(saved, faction) &&
        (saved.simulation.combat?.scenario ?? "economy") === scenario
        ? { status: "ready", snapshot: saved }
        : { status: "invalid" };
    } catch {
      return { status: "invalid" };
    }
  }
  write(snapshot: PersistenceEnvelope): boolean {
    const faction = snapshot.simulation.players[0]?.faction;
    if (!faction || !this.valid(snapshot, faction)) return false;
    try {
      const key =
        DEVELOPMENT_SAVE_PREFIX +
        (snapshot.simulation.combat?.scenario === "combat-practice"
          ? "combat."
          : "") +
        faction;
      const old = this.storage.getItem(key);
      if (old && !this.storage.getItem(key + ".stage4-backup")) {
        let legacy = true;
        try {
          legacy = JSON.parse(old).formatVersion === 6;
        } catch {}
        if (legacy) this.storage.setItem(key + ".stage4-backup", old);
      }
      this.storage.setItem(key, JSON.stringify(snapshot));
      return true;
    } catch {
      return false;
    }
  }
}
