import { STARK_RIFT_SCHEMA_VERSION } from "../core/versions";

export type DataDefinition = {
  id: string;
  [key: string]: unknown;
};

export type StarkRiftDataBundle = {
  schemaVersion: number;
  dataVersion: string;
  units: DataDefinition[];
  buildings: DataDefinition[];
  abilities: DataDefinition[];
  technologies: DataDefinition[];
  maps: DataDefinition[];
};

export type ValidationIssue = {
  path: string;
  code: "invalid_type" | "invalid_value" | "duplicate_id" | "missing_field";
  message: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

const DEFINITION_COLLECTIONS = [
  "units",
  "buildings",
  "abilities",
  "technologies",
  "maps",
] as const;

export function validateDataBundle(input: unknown): ValidationResult<StarkRiftDataBundle> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [issue("$", "invalid_type", "Data bundle must be an object.")],
    };
  }

  if (input.schemaVersion !== STARK_RIFT_SCHEMA_VERSION) {
    issues.push(
      issue(
        "schemaVersion",
        "invalid_value",
        `schemaVersion must be ${STARK_RIFT_SCHEMA_VERSION}.`,
      ),
    );
  }
  if (typeof input.dataVersion !== "string" || input.dataVersion.length === 0) {
    issues.push(issue("dataVersion", "missing_field", "dataVersion must be a non-empty string."));
  }

  for (const collectionName of DEFINITION_COLLECTIONS) {
    const collection = input[collectionName];
    if (!Array.isArray(collection)) {
      issues.push(issue(collectionName, "invalid_type", `${collectionName} must be an array.`));
      continue;
    }

    const ids = new Set<string>();
    collection.forEach((definition, index) => {
      const path = `${collectionName}[${index}]`;
      if (!isRecord(definition)) {
        issues.push(issue(path, "invalid_type", "Definition must be an object."));
        return;
      }
      if (typeof definition.id !== "string" || definition.id.length === 0) {
        issues.push(issue(`${path}.id`, "missing_field", "Definition id must be a non-empty string."));
        return;
      }
      if (ids.has(definition.id)) {
        issues.push(issue(`${path}.id`, "duplicate_id", `Duplicate id: ${definition.id}`));
        return;
      }
      ids.add(definition.id);
    });
  }

  return issues.length === 0
    ? { ok: true, value: input as StarkRiftDataBundle }
    : { ok: false, issues };
}

function issue(path: string, code: ValidationIssue["code"], message: string): ValidationIssue {
  return { path, code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


