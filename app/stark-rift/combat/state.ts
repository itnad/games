import { PROJECTILE_RULES, MAX_COMBAT_PROJECTILES } from "./mechanics";
import {
  array,
  enumeration,
  integer,
  literal,
  nullable,
  object,
  optional,
  text,
  unique,
  type Infer,
} from "../core/validation";
import { checksum } from "../core/checksum";
import original from "../data/combat-original.json";
export const COMBAT_RULES_VERSION =
  "ranged-1-" +
  checksum({ original: JSON.stringify(original), flight: PROJECTILE_RULES });
export const PREVIOUS_COMBAT_RULES_VERSION =
  "basic-1-" +
  checksum(
    JSON.stringify({ ...original, weapons: original.weapons.slice(0, 6) }),
  );
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
  kind: enumeration(["shot", "slash", "death", "launch", "impact"]),
  weaponId: optional(enumeration(original.weapons.map((w) => w.name))),
  owner: integer(0, 1),
  x: integer(),
  y: integer(),
  toX: integer(),
  toY: integer(),
});
export const combatProjectileSchema = object({
  id: integer(1),
  sourceId: integer(1),
  owner: integer(0, 1),
  targetId: integer(1),
  targetLayer: enumeration(["ground", "air"]),
  weaponId: enumeration(["Fragmentation_Grenade", "Phase_Disruptor"]),
  x: integer(),
  y: integer(),
  spawnTick: integer(),
  expiresTick: integer(),
  remainder: integer(0, 19),
  damage: integer(1, 1000000),
  hits: integer(1, 2),
});
export const renderProjectileSchema = object({
  id: integer(1),
  owner: integer(0, 1),
  weaponId: enumeration(["Fragmentation_Grenade", "Phase_Disruptor"]),
  x: integer(),
  y: integer(),
});
export const combatStateSchema = object({
  rulesVersion: literal(COMBAT_RULES_VERSION),
  scenario: enumeration(["economy", "combat-practice", "ranged-practice"]),
  records: array(combatRecordSchema, 0, 2048),
  projectiles: array(combatProjectileSchema, 0, MAX_COMBAT_PROJECTILES),
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

export type CombatProjectile = CombatState["projectiles"][number];
