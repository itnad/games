import type { BattleMap } from "../data/maps";
import type { EngineRules } from "../core/simulation";
import { idleMovement } from "../core/orders";
import { releaseWork, workerOf } from "../economy/helpers";
import { NavigationGrid } from "../pathfinding/navigation";
import { SpatialHash } from "../pathfinding/spatial-hash";
import { BURROW_ABILITY, supportsBurrow, isBurrowed, canBurrow } from "./burrow";

/** State abilities wrap the complete rule stack, so neither work nor movement bypasses the lock. */
export function createBurrowRules(map: BattleMap, base: EngineRules): EngineRules {
  const commands = { ...base.commands };
  for (const kind of ["move", "attackMove", "focusAttack", "patrol", "gather", "autoGather", "returnCargo", "placeBuilding", "resumeConstruction"] as const) {
    const handler = commands[kind];
    if (!handler) continue;
    commands[kind] = {
      ...handler,
      validate: (s, c, id) => isBurrowed(s, id) && !(c.kind === "focusAttack" && s.entities.definitionId[s.entities.id.indexOf(id)] === "zerg-lurker") ? "invalid_state" : handler.validate(s, c, id),
    };
  }
  commands.toggleStateAbility = {
    policy: "partial",
    validate: (s, c, id) => {
      if (c.kind !== "toggleStateAbility" || c.payload.abilityId !== BURROW_ABILITY)
        return "invalid_command";
      const i = s.entities.id.indexOf(id);
      if (!s.vision || !s.economy.enabled || !supportsBurrow(s.entities.definitionId[i]))
        return "invalid_target";
      if (!canBurrow(s, id)) return "missing_prerequisite";
      if (isBurrowed(s, id) === c.payload.enabled) return "invalid_state";
      if (c.payload.enabled) {
        const w = workerOf(s, id);
        return w?.buildingId !== null && w?.buildingId !== undefined ? "invalid_state" : null;
      }
      // Ground units may cross a burrowed unit. Surfacing requires a clear body at its own position.
      const grid = new NavigationGrid(map, s), hash = new SpatialHash(s), chosen: number[] = [];
      for (const candidate of [...c.entityIds].sort((a, b) => a - b)) {
        const j = s.entities.id.indexOf(candidate), e = s.entities;
        if (j < 0 || e.health[j] === 0 || e.owner[j] !== c.playerId || !isBurrowed(s, candidate)) continue;
        const p = { x: e.x[j], y: e.y[j] };
        if (grid.clear(p, e.radius[j], "ground", candidate) && !hash.overlaps(j, p.x, p.y) &&
          chosen.every((k) => (e.x[k] - p.x) ** 2 + (e.y[k] - p.y) ** 2 >= (e.radius[k] + e.radius[j]) ** 2)) chosen.push(j);
      }
      return chosen.includes(i) ? null : "blocked";
    },
    apply: (s, c, ids) => {
      if (c.kind !== "toggleStateAbility") return;
      for (const id of ids) {
        const i = s.entities.id.indexOf(id), m = s.movement[i],
          style = { formation: m.formation, stance: m.stance }, w = workerOf(s, id);
        if (w) releaseWork(s, w, false); // preserve cargo; manual auto-gather resumes after surfacing
        Object.assign(m, idleMovement(id), style);
        s.navigation.jobs = s.navigation.jobs.filter((j) => j.entityId !== id);
        const r = s.combat?.records.find((r) => r.entityId === id);
        if (r) { r.resumeTarget = null; r.lastSeenTarget = null; }
        s.vision!.concealed = s.vision!.concealed.filter((c) => c.entityId !== id);
        if (c.payload.enabled) s.vision!.concealed.push({ entityId: id, kind: "burrow" });
      }
      s.vision!.concealed.sort((a, b) => a.entityId - b.entityId);
      s.map.obstacleVersion++;
    },
  };
  return { ...base, commands };
}
