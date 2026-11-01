import {
  array, enumeration, integer, literal, object, parse, text,
  type Infer, type ValidationIssue, type ValidationResult,
} from "../core/validation";
import { factionSchema } from "../core/state";
import { STARK_RIFT_SCHEMA_VERSION } from "../core/versions";
export type { ValidationIssue, ValidationResult } from "../core/validation";

const requirementSchema = object({
  kind: enumeration(["units", "buildings", "technologies"]), id: text,
});
const cost = { mineralCost: integer(), gasCost: integer(), buildTicks: integer(1) };
const common = { id: text, faction: factionSchema, ...cost, prerequisites: array(requirementSchema) };
const durability = { maxHealth: integer(1), maxShield: integer(), armor: integer() };
const weaponSchema = object({
  id: text, damage: integer(), hits: integer(1), cooldownTicks: integer(1),
  range: integer(), target: enumeration(["ground", "air", "both"]),
  damageType: enumeration(["normal", "concussive", "explosive"]),
});
export const unitDefinitionSchema = object({
  ...common, ...durability, supplyHalf: integer(0, 200), moveSpeed: integer(),
  sightRange: integer(), detectionRange: integer(), collisionRadius: integer(), cargoSize: integer(),
  size: enumeration(["small", "medium", "large"]), weapons: array(weaponSchema),
  abilities: array(text), producedBy: array(text, 1),
});
export const buildingDefinitionSchema = object({
  ...common, ...durability, widthTiles: integer(1), heightTiles: integer(1),
  abilities: array(text), producedBy: array(text, 1),
});
export const abilityDefinitionSchema = object({
  id: text, energyCost: integer(), range: integer(),
  target: enumeration(["point", "entity", "self"]), autocast: enumeration(["supported", "unsupported"]),
});
export const technologyDefinitionSchema = object({ ...common, researchedAt: array(text, 1) });
export const mapDefinitionSchema = object({
  id: text, widthTiles: integer(1, 128), heightTiles: integer(1, 128),
  spawnPoints: array(object({ x: integer(), y: integer() }), 2, 4),
});
export const dataBundleSchema = object({
  schemaVersion: literal(STARK_RIFT_SCHEMA_VERSION),
  dataVersion: text,
  source: object({
    game: literal("Brood War"), version: literal("1.16.1"), reference: text,
    tickRate: literal(20),
    timeScale: object({ numerator: literal(1), denominator: literal(2) }),
  }),
  units: array(unitDefinitionSchema), buildings: array(buildingDefinitionSchema),
  abilities: array(abilityDefinitionSchema), technologies: array(technologyDefinitionSchema),
  maps: array(mapDefinitionSchema),
});
export type StarkRiftDataBundle = Infer<typeof dataBundleSchema>;
export type UnitDefinition = Infer<typeof unitDefinitionSchema>;
export type BuildingDefinition = Infer<typeof buildingDefinitionSchema>;
export type DataDefinition = { id: string };

export function validateDataBundle(input: unknown): ValidationResult<StarkRiftDataBundle> {
  const parsed = parse(dataBundleSchema, input);
  if (!parsed.ok) return parsed;
  const data = parsed.value;
  const issues: ValidationIssue[] = [];
  const collections = ["units", "buildings", "abilities", "technologies", "maps"] as const;
  const ids = new Map<string, Set<string>>();
  for (const name of collections) {
    const seen = new Set<string>();
    data[name].forEach((definition, index) => {
      if (seen.has(definition.id)) issues.push({ path: `${name}[${index}].id`, code: "duplicate_id", message: `Duplicate id: ${definition.id}` });
      seen.add(definition.id);
    });
    ids.set(name, seen);
  }
  function reference(collection: string, id: string, path: string) {
    if (!ids.get(collection)?.has(id)) issues.push({ path, code: "invalid_value", message: `Unknown ${collection} reference: ${id}` });
  }
  const graph = new Map<string, string[]>();
  for (const name of ["units", "buildings", "technologies"] as const) {
    data[name].forEach((definition, index) => {
      const root = `${name}[${index}]`;
      const node = `${name}:${definition.id}`;
      graph.set(node, definition.prerequisites.map(req => `${req.kind}:${req.id}`));
      definition.prerequisites.forEach((req, ri) => reference(req.kind, req.id, `${root}.prerequisites[${ri}]`));
      if ("abilities" in definition) definition.abilities.forEach((id, ai) => reference("abilities", id, `${root}.abilities[${ai}]`));
      if ("producedBy" in definition) definition.producedBy.forEach((id, pi) => {
        if (!ids.get("buildings")?.has(id) && !ids.get("units")?.has(id))
          issues.push({ path: `${root}.producedBy[${pi}]`, code: "invalid_value", message: `Unknown producer: ${id}` });
        else if (ids.get("buildings")?.has(id) && ids.get("units")?.has(id))
          issues.push({ path: `${root}.producedBy[${pi}]`, code: "invalid_value", message: `Ambiguous producer: ${id}` });
      });
      if ("researchedAt" in definition) definition.researchedAt.forEach((id, ri) => reference("buildings", id, `${root}.researchedAt[${ri}]`));
    });
  }
  // Iterative DFS avoids exhausting the stack on a large invalid prerequisite chain.
  const colors = new Map<string, number>();
  for (const start of graph.keys()) {
    if (colors.get(start) === 2) continue;
    const stack: [string, boolean][] = [[start, false]];
    while (stack.length) {
      const [node, exit] = stack.pop()!;
      if (exit) { colors.set(node, 2); continue; }
      if (colors.get(node) === 1) {
        issues.push({ path: "prerequisites", code: "invalid_value", message: `Cyclic prerequisite: ${node}` });
        break;
      }
      if (colors.get(node) === 2) continue;
      colors.set(node, 1);
      stack.push([node, true]);
      for (const next of graph.get(node) ?? []) if (graph.has(next)) stack.push([next, false]);
    }
  }
  data.maps.forEach((map, index) => {
    const seen = new Set<string>();
    map.spawnPoints.forEach((point, pi) => {
      const key = `${point.x},${point.y}`;
      if (point.x >= map.widthTiles || point.y >= map.heightTiles || seen.has(key))
        issues.push({ path: `maps[${index}].spawnPoints[${pi}]`, code: "invalid_value", message: "Spawn must be unique and inside map bounds." });
      seen.add(key);
    });
  });
  return issues.length ? { ok: false, issues } : parsed;
}


