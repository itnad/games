import { isInStasis } from "./spells-state";
import type { EngineRules } from "../core/simulation";
import { idleMovement } from "../core/orders";
import { economyDefinition } from "../data/economy-catalog";
import { isEmbarked } from "./special-state";
import { hasSiegeResearch, isSieged, isTank, SIEGE_ABILITY, SIEGE_MODE, SIEGE_TRANSITION_TICKS, TANK_MODE, siegeTransitionOf } from "./siege-state";

export function createSiegeRules(base: EngineRules): EngineRules {
  const commands = { ...base.commands }, fallback = commands.toggleStateAbility;
  for (const kind of Object.keys(commands) as (keyof typeof commands)[]) {
    const handler = commands[kind]!;
    commands[kind] = { ...handler, validate: (s, c, id) =>
      siegeTransitionOf(s, id) && !["assignGroup", "setFormation", "setStance"].includes(c.kind) ? "invalid_state" : handler.validate(s, c, id) };
  }
  commands.toggleStateAbility = {
    policy: "partial",
    validate: (s, c, id) => {
      if (siegeTransitionOf(s, id)) return "invalid_state";
      if (c.kind !== "toggleStateAbility" || c.payload.abilityId !== SIEGE_ABILITY) return fallback ? fallback.validate(s, c, id) : "invalid_command";
      const i = s.entities.id.indexOf(id), d = s.entities.definitionId[i];
      if (!s.economy.enabled || !s.combat || !isTank(d)) return "invalid_target";
      if (isEmbarked(s, id)) return "invalid_state";
      if (isSieged(d) === c.payload.enabled) return "invalid_state";
      return hasSiegeResearch(s, c.playerId) ? null : "missing_prerequisite";
    },
    apply: (s, c, ids) => {
      if (c.kind !== "toggleStateAbility" || c.payload.abilityId !== SIEGE_ABILITY) { fallback?.apply(s, c, ids); return; }
      s.siege ??= [];
      for (const id of ids) {
        const i = s.entities.id.indexOf(id), m = s.movement[i], style = { formation: m.formation, stance: m.stance };
        Object.assign(m, idleMovement(id), style, { order: "hold" });
        s.entities.speed[i] = 0;
        s.navigation.jobs = s.navigation.jobs.filter((j) => j.entityId !== id);
        const r = s.combat?.records.find((r) => r.entityId === id);
        if (r) { r.resumeTarget = null; r.lastSeenTarget = null; }
        s.siege.push({ entityId: id, targetDefinitionId: c.payload.enabled ? SIEGE_MODE : TANK_MODE, remainingTicks: SIEGE_TRANSITION_TICKS, totalTicks: SIEGE_TRANSITION_TICKS, x: s.entities.x[i], y: s.entities.y[i] });
      }
      s.siege.sort((a, b) => a.entityId - b.entityId); s.map.obstacleVersion++;
    },
  };
  const focus = commands.focusAttack!;
  commands.focusAttack = { ...focus, apply: (s, c, ids) => {
    focus.apply(s, c, ids);
    for (const id of ids) if (isSieged(s.entities.definitionId[s.entities.id.indexOf(id)])) {
      const m = s.movement[s.entities.id.indexOf(id)]; m.path = []; m.pathIndex = 0; m.status = "arrived";
      s.navigation.jobs = s.navigation.jobs.filter((j) => j.entityId !== id);
    }
  } };
  return { ...base, commands, systems: { ...base.systems, construction: (s) => {
    for (const job of s.siege ?? []) {
      if (isInStasis(s,job.entityId)) continue;
      if (--job.remainingTicks > 0) continue;
      const i = s.entities.id.indexOf(job.entityId), d = economyDefinition(job.targetDefinitionId)!;
      if (i < 0 || s.entities.health[i] === 0) continue;
      s.entities.definitionId[i] = d.id; s.entities.speed[i] = d.speed; s.entities.radius[i] = d.radius;
      s.map.obstacleVersion++;
    }
    if (s.siege) s.siege = s.siege.filter((j) => j.remainingTicks > 0);
    base.systems?.construction?.(s);
  } } };
}
