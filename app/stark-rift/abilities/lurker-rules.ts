import { isInStasis } from "./spells-state";
import type { EngineRules } from "../core/simulation";
import type { SimulationState } from "../core/state";
import { idleMovement } from "../core/orders";
import { economyDefinition } from "../data/economy-catalog";
import { recomputeSupply } from "../economy/helpers";
import { isEmbarked } from "./special-state";
import { isBurrowed } from "./burrow";
import { emptyLurker, hasLurkerAspect, HYDRALISK, LURKER, LURKER_EGG, unitMorphOf } from "./lurker-state";
/** Preserve HP percentage, including fixed HP fractions, across the egg and the final form. */
function changeForm(s: SimulationState, id: number, definition: string) {
  const e = s.entities, i = e.id.indexOf(id), old = economyDefinition(e.definitionId[i])!, d = economyDefinition(definition)!, r = s.combat?.records.find((r) => r.entityId === id),
    hp = Math.max(1, Math.floor((e.health[i] * 256 - (r?.healthFraction ?? 0)) * d.health / old.health));
  e.definitionId[i] = d.id; e.health[i] = Math.ceil(hp / 256); e.speed[i] = d.speed; e.radius[i] = d.radius;
  if (r) { r.definitionId = d.id; r.healthFraction = e.health[i] * 256 - hp; r.resumeTarget = null; r.lastSeenTarget = null; }
  const m = s.movement[i], style = { formation: m.formation, stance: m.stance };
  Object.assign(m, idleMovement(id), style, { order: "hold" }); s.navigation.jobs = s.navigation.jobs.filter((j) => j.entityId !== id); s.map.obstacleVersion++;
}
export function createLurkerRules(base: EngineRules): EngineRules {
  const commands = { ...base.commands };
  for (const kind of Object.keys(commands) as (keyof typeof commands)[]) {
    const h = commands[kind]!; commands[kind] = { ...h, validate: (s, c, id) => unitMorphOf(s, id) && !["assignGroup", "setFormation", "setStance"].includes(c.kind) ? "invalid_state" : h.validate(s, c, id) };
  }
  commands.morphUnit = {
    policy: "partial",
    validate: (s, c, id) => {
      if (c.kind !== "morphUnit" || c.payload.unitId !== LURKER || !s.economy.enabled || !s.combat) return "invalid_target";
      const i = s.entities.id.indexOf(id), d = economyDefinition(LURKER)!, p = s.players[c.playerId];
      if (s.entities.definitionId[i] !== HYDRALISK) return "invalid_target";
      if (isBurrowed(s, id) || isEmbarked(s, id) || unitMorphOf(s, id)) return "invalid_state";
      if (!hasLurkerAspect(s, c.playerId)) return "missing_prerequisite";
      const candidates = [...c.entityIds].filter((eid) => { const j = s.entities.id.indexOf(eid); return j >= 0 && s.entities.owner[j] === c.playerId && s.entities.health[j] > 0 && s.entities.definitionId[j] === HYDRALISK && !isBurrowed(s, eid) && !isEmbarked(s, eid) && !unitMorphOf(s, eid); }).sort((a, b) => a - b),
        count = Math.min(Math.floor(p.minerals / d.minerals), Math.floor(p.gas / d.gas), Math.floor((Math.min(200, p.supplyCapHalf) - p.supplyUsedHalf) / (d.supply - economyDefinition(HYDRALISK)!.supply)));
      return candidates.indexOf(id) >= 0 && candidates.indexOf(id) < count ? null : "insufficient_resource";
    },
    apply: (s, c, ids) => {
      s.lurker ??= emptyLurker(); const d = economyDefinition(LURKER)!, p = s.players[c.playerId];
      for (const id of ids) { const i = s.entities.id.indexOf(id); p.minerals -= d.minerals; p.gas -= d.gas;
        s.lurker.morphs.push({ entityId: id, remainingTicks: d.ticks, totalTicks: d.ticks, minerals: d.minerals, gas: d.gas, supplyHalf: 4, x: s.entities.x[i], y: s.entities.y[i] }); changeForm(s, id, LURKER_EGG); }
      s.lurker.morphs.sort((a, b) => a.entityId - b.entityId); recomputeSupply(s);
    },
  };
  commands.cancelUnitMorph = { policy: "partial", validate: (s, c, id) => unitMorphOf(s, id) ? null : "invalid_state", apply: (s, c, ids) => {
    for (const id of ids) { const j = unitMorphOf(s, id)!; s.players[c.playerId].minerals += j.minerals; s.players[c.playerId].gas += j.gas; changeForm(s, id, HYDRALISK); }
    s.lurker!.morphs = s.lurker!.morphs.filter((j) => !ids.includes(j.entityId)); recomputeSupply(s);
  } };
  const focus = commands.focusAttack!;
  commands.focusAttack = { ...focus, apply: (s, c, ids) => { focus.apply(s, c, ids); for (const id of ids) if (s.entities.definitionId[s.entities.id.indexOf(id)] === LURKER && isBurrowed(s, id)) { const m = s.movement[s.entities.id.indexOf(id)]; m.path = []; m.pathIndex = 0; m.status = "arrived"; s.navigation.jobs = s.navigation.jobs.filter((j) => j.entityId !== id); } } };
  return { ...base, commands, systems: { ...base.systems, construction: (s) => {
    let completed = false;
    for (const j of s.lurker?.morphs ?? []) if (!isInStasis(s,j.entityId) && --j.remainingTicks === 0) { changeForm(s, j.entityId, LURKER); completed = true; }
    if (s.lurker) s.lurker.morphs = s.lurker.morphs.filter((j) => j.remainingTicks > 0);
    if (completed) recomputeSupply(s); base.systems?.construction?.(s);
  } } };
}
