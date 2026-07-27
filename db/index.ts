import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type D1Binding = Parameters<typeof drizzle>[0];
let d1Binding: D1Binding | null = null;

export function setD1Binding(binding: D1Binding) {
  d1Binding = binding;
}

export function getDb() {
  if (!d1Binding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(d1Binding, { schema });
}
