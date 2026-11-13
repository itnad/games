import type { EngineRules } from "../core/simulation";
import type { SimulationState } from "../core/state";
import { CLOAK_ABILITY, CLOAK_ENERGY_COST, ENERGY, activeCloak, energyOf, hasCloakResearch, supportsCloak } from "./cloak-state";
/** Consume original whole frames, retaining the 24:20 remainder across saves and cargo. */
export function advanceEnergy(s: SimulationState) {
  for (const r of s.energy ?? []) {
    const i = s.entities.id.indexOf(r.entityId);
    if (i < 0 || s.entities.health[i] === 0) continue;
    const frames = Math.floor((r.frameRemainder + 6) / 5);
    r.frameRemainder = (r.frameRemainder + 6) % 5;
    for (let f = 0; f < frames; f++) {
      if (activeCloak(s, r.entityId)) {
        const drain = s.entities.definitionId[i] === "terran-ghost" ? ENERGY.ghostDrainPerFrame : ENERGY.wraithDrainPerFrame;
        r.amount = Math.max(0, r.amount - drain);
        if (r.amount === 0) s.vision!.concealed = s.vision!.concealed.filter((c) => c.entityId !== r.entityId);
      } else r.amount = Math.min(ENERGY.maximum * ENERGY.scale, r.amount + ENERGY.regenerationPerFrame);
    }
  }
}
/** Install inside transport rules, so embarked units still obey their command restrictions. */
export function createCloakRules(base: EngineRules): EngineRules {
  const fallback = base.commands?.toggleStateAbility;
  return { ...base, commands: { ...base.commands, toggleStateAbility: {
    policy: "partial",
    validate: (s, c, id) => {
      if (c.kind !== "toggleStateAbility" || c.payload.abilityId !== CLOAK_ABILITY) return fallback?.validate(s, c, id) ?? "invalid_command";
      const i = s.entities.id.indexOf(id);
      if (!s.vision || !s.economy.enabled || !supportsCloak(s.entities.definitionId[i])) return "invalid_target";
      if (activeCloak(s, id) === c.payload.enabled) return "invalid_state";
      if (!c.payload.enabled) return null;
      if (!hasCloakResearch(s, id)) return "missing_prerequisite";
      return (energyOf(s, id)?.amount ?? 0) < CLOAK_ENERGY_COST * ENERGY.scale ? "insufficient_resource" : null;
    },
    apply: (s, c, ids) => {
      if (c.kind !== "toggleStateAbility" || c.payload.abilityId !== CLOAK_ABILITY) { fallback?.apply(s, c, ids); return; }
      for (const id of ids) {
        s.vision!.concealed = s.vision!.concealed.filter((v) => v.entityId !== id);
        if (c.payload.enabled) { energyOf(s, id)!.amount -= CLOAK_ENERGY_COST * ENERGY.scale; s.vision!.concealed.push({ entityId: id, kind: "cloak" }); }
      }
      s.vision!.concealed.sort((a, b) => a.entityId - b.entityId);
    },
  } }, systems: { ...base.systems, vision: (s) => { advanceEnergy(s); base.systems?.vision?.(s); } } };
}
