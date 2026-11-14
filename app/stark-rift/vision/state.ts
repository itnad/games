import {
  array,
  integer,
  literal,
  nullable,
  object,
  enumeration,
  refine,
  text,
  unique,
  type Infer,
} from "../core/validation";
export const LEGACY_VISION_RULES_VERSION = "fog-1-los-edge-detector11-memory600";
export const CARGO_VISION_RULES_VERSION = "fog-2-permanent-cloak-cargo-observer11";
export const VISION_RULES_VERSION = "fog-3-arbiter-passive-field-hitboxes";
export const MEMORY_TICKS = 600;
export const contactSchema = object({
  entityId: integer(1),
  owner: integer(0, 1),
  definitionId: text,
  kind: enumeration(["combat", "worker", "building"]),
  layer: enumeration(["ground", "air"]),
  x: integer(),
  y: integer(),
  radius: integer(1, 512),
  seenTick: integer(),
  progress: nullable(integer(0, 1000)),
});
export const visionStateSchema = object({
  rulesVersion: literal(VISION_RULES_VERSION),
  width: integer(1, 128),
  height: integer(1, 128),
  concealed: array(
    object({ entityId: integer(1), kind: enumeration(["cloak", "burrow"]) }),
    0,
    2048,
  ),
  players: array(
    object({
      playerId: integer(0, 1),
      explored: refine(
        array(integer(0, 16383), 0, 16384),
        (a) => a.every((v, i) => i === 0 || v > a[i - 1]),
        "Explored cells must increase",
      ),
      contacts: array(contactSchema, 0, 2048),
      resources: array(object({ nodeId: text, amount: integer() }), 0, 512),
    }),
    2,
    2,
  ),
});
type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends (infer U)[]
    ? Mutable<U>[]
    : T[K] extends object
      ? Mutable<T[K]>
      : T[K];
};
export type VisionState = Mutable<Infer<typeof visionStateSchema>>;
export type Contact = VisionState["players"][number]["contacts"][number];
