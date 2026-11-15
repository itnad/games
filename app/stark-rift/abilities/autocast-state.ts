import type { SimulationState } from "../core/state";
import { array, integer, object, type Infer } from "../core/validation";

export const AUTO_STASIS = "stasis-field";
export const MANUAL_GRACE_TICKS = 20;
export const autocastStateSchema = object({
  records: array(object({ entityId: integer(1), manualUntilTick: integer() }), 0, 2048),
});
export type AutocastState = { records: { -readonly [K in keyof Infer<typeof autocastStateSchema>["records"][number]]: Infer<typeof autocastStateSchema>["records"][number][K] }[] };
export const autocastOf = (s: SimulationState, id: number) => s.autocast?.records.find(r => r.entityId === id);
export function setStasisAutocast(s: SimulationState, id: number, enabled: boolean) {
  s.autocast ??= { records: [] };
  s.autocast.records = s.autocast.records.filter(r => r.entityId !== id);
  if (enabled) s.autocast.records.push({ entityId: id, manualUntilTick: 0 });
  s.autocast.records.sort((a,b) => a.entityId-b.entityId);
}
export function validAutocast(s: SimulationState) {
  const records = s.autocast?.records ?? [];
  return (!records.length || s.economy.enabled && !!s.combat) &&
    records.every((r,n) => {
      const i = s.entities.id.indexOf(r.entityId);
      return i >= 0 && s.entities.health[i] > 0 && s.entities.definitionId[i] === "protoss-arbiter" &&
        (n === 0 || records[n-1].entityId < r.entityId) && r.manualUntilTick <= s.tick + MANUAL_GRACE_TICKS;
    });
}
