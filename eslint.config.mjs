import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The current game loops are not compiled with React Compiler. Keep its
    // migration advice visible without making the existing imperative loops
    // block all lint validation.
    rules: {
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "node_modules/**",
    "work/**",
    ".sites-checkout/**",
    ".sites-runtime/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
