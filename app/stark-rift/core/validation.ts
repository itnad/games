/** Small runtime schemas: the checked shape also supplies the TypeScript type. */
export type ValidationIssue = {
  path: string;
  code: "invalid_type" | "invalid_value" | "duplicate_id" | "missing_field";
  message: string;
};
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };
export type Schema<T> = { check: (input: unknown, path: string, issues: ValidationIssue[]) => boolean; _type?: T };
type FastCheck=(input:unknown)=>boolean;
const fastChecks=new WeakMap<Schema<unknown>,FastCheck>();
function primitive<T>(accept:FastCheck,message:string):Schema<T>{
  const schema:Schema<T>={check:(input,path,issues)=>accept(input)||reject(issues,path,message)};
  fastChecks.set(schema,accept);return schema;
}
export type Infer<S> = S extends Schema<infer T> ? T : never;
type ObjectType<S extends Record<string, Schema<unknown>>> =
  { [K in keyof S as undefined extends Infer<S[K]> ? never : K]: Infer<S[K]> } &
  { [K in keyof S as undefined extends Infer<S[K]> ? K : never]?: Infer<S[K]> };

export function parse<T>(schema: Schema<T>, input: unknown): ValidationResult<T> {
  const issues: ValidationIssue[] = [];
  return schema.check(input, "$", issues)
    ? { ok: true, value: input as T }
    : { ok: false, issues };
}
export function reject(issues: ValidationIssue[], path: string, message: string): false {
  issues.push({ path: path.replace(/^\$\./, ""), code: "invalid_value", message });
  return false;
}
export function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null &&
    (Object.getPrototypeOf(input) === Object.prototype || Object.getPrototypeOf(input) === null);
}
export function refine<T>(schema: Schema<T>, test: (value: T) => boolean, message: string): Schema<T> {
  return { check: (input, path, issues) => schema.check(input, path, issues) &&
    (test(input as T) || reject(issues, path, message)) };
}
export const integer = (min = 0, max = Number.MAX_SAFE_INTEGER): Schema<number> => primitive(input=>typeof input==="number"&&Number.isSafeInteger(input)&&input>=min&&input<=max,`Expected a safe integer in [${min}, ${max}].`);
export const text:Schema<string>=primitive(input=>typeof input==="string"&&input.trim().length>0&&input.length<=256,"Expected a non-blank string of at most 256 characters.");
export const boolean:Schema<boolean>=primitive(input=>typeof input==="boolean","Expected a boolean.");
export function literal<const T extends string | number | null>(value: T): Schema<T> {
  return primitive(input=>input===value,`Expected ${String(value)}.`);
}
export function enumeration<const T extends readonly string[]>(values: T): Schema<T[number]> {
  return primitive(input=>typeof input==="string"&&values.includes(input),`Expected one of: ${values.join(", ")}.`);
}
export function array<T>(item: Schema<T>, min = 0, max = 100_000): Schema<T[]> {
  const accept=fastChecks.get(item);
  return { check: (input, path, issues) => {
    if (!Array.isArray(input) || input.length < min || input.length > max) return reject(issues, path, `Expected an array of length ${min}..${max}.`);
    let valid = true;
    // Visit holes as undefined; Array.every would silently accept sparse input.
    for (let i = 0; i < input.length; i += 1){
      const value=input[i];
      if(accept?.(value))continue;
      if(!item.check(value,`${path}[${i}]`,issues))valid=false;
    }
    return valid;
  } };
}
export function unique<T>(schema: Schema<T[]>): Schema<T[]> {
  return refine(schema, values => new Set(values).size === values.length, "Duplicate values are not allowed.");
}
export function object<const S extends Record<string, Schema<unknown>>>(shape: S): Schema<ObjectType<S>> {
  const fields=Object.entries(shape).map(([key,schema])=>({key,schema,accept:fastChecks.get(schema)}));
  return { check: (input, path, issues) => {
    if (!isRecord(input)) return reject(issues, path, "Expected a plain object.");
    let valid = true;
    for (const key of Object.keys(input)) if (!Object.hasOwn(shape, key)) {
      reject(issues, `${path}.${key}`, "Unexpected field."); valid = false;
    }
    for (const {key,schema,accept} of fields) {
      const value=Object.hasOwn(input,key)?input[key]:undefined;
      if(accept?.(value))continue;
      if (!schema.check(value, `${path}.${key}`, issues)) valid = false;
    }
    return valid;
  } };
}
export function union<const S extends readonly Schema<unknown>[]>(...schemas: S): Schema<Infer<S[number]>> {
  return { check: (input, path, issues) => {
    for (const schema of schemas) if (schema.check(input, path, [])) return true;
    return reject(issues, path, "Value does not match any supported shape.");
  } };
}
export const optional = <T>(schema: Schema<T>): Schema<T | undefined> => ({
  check: (input, path, issues) => input === undefined || schema.check(input, path, issues),
});
export const nullable = <T>(schema: Schema<T>): Schema<T | null> => union(schema, literal(null));
export function dictionary<T>(schema: Schema<T>): Schema<Record<string, T>> {
  const accept=fastChecks.get(schema);
  return { check: (input, path, issues) => {
    if (!isRecord(input)) return reject(issues, path, "Expected a plain dictionary.");
    let valid = true;
    for (const key of Object.keys(input)){
      const value=input[key];if(accept?.(value))continue;
      if(!schema.check(value,`${path}.${key}`,issues))valid=false;
    }
    return valid;
  } };
}
export function taggedUnion<const S extends Record<string, Schema<unknown>>>(key: string, variants: S): Schema<Infer<S[keyof S]>> {
  return { check: (input, path, issues) => {
    if (!isRecord(input)) return reject(issues, path, "Expected a plain object.");
    const tag = input[key];
    if (typeof tag !== "string" || !Object.hasOwn(variants, tag)) return reject(issues, `${path}.${key}`, "Unknown message or command kind.");
    return variants[tag].check(input, path, issues);
  } };
}
