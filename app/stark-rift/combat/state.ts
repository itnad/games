import {
  array,
  enumeration,
  integer,
  literal,
  nullable,
  object,
  text,
  unique,
  type Infer,
} from "../core/validation";
import { checksum } from "../core/checksum";
import original from "../data/combat-original.json";
export const COMBAT_RULES_VERSION =
  "basic-1-" + checksum(JSON.stringify(original));
export const combatRecordSchema = object({
  entityId: integer(1),
  definitionId: text,
  resumeTarget: nullable(object({ x: integer(), y: integer() })),
  nextAttackTick: integer(),
  remainder: integer(0, 5),
  healthFraction: integer(0, 255),
  shieldFraction: integer(0, 255),
  workerFraction: nullable(
    object({ health: integer(0, 255), shield: integer(0, 255) }),
  ),
});
export const combatEffectSchema = object({
  id: integer(1),
  tick: integer(),
  kind: enumeration(["shot", "slash", "death"]),
  owner: integer(0, 1),
  x: integer(),
  y: integer(),
  toX: integer(),
  toY: integer(),
});
export const combatStateSchema = object({
  rulesVersion: literal(COMBAT_RULES_VERSION),
  scenario: enumeration(["economy", "combat-practice"]),
  records: array(combatRecordSchema, 0, 2048),
  effects: array(combatEffectSchema, 0, 128),
  friendlyIds: unique(array(integer(1), 0, 10)),
  targetIds: unique(array(integer(1), 0, 10)),
});
type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends (infer U)[]
    ? Mutable<U>[]
    : T[K] extends object
      ? Mutable<T[K]>
      : T[K];
};
export type CombatState = Mutable<Infer<typeof combatStateSchema>>;
export type CombatRecord = Mutable<Infer<typeof combatRecordSchema>>;
export type Scenario = CombatState["scenario"];
