import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Firebase Functions is a separate project with its own ESLint setup —
    // skip its source and tooling files in the root lint pass.
    "functions/**",
  ]),
  {
    rules: {
      // Allow _-prefixed bindings as intentionally-unused (standard TS convention).
      // Covers destructuring tricks like `const { slug: _slug, ...rest } = obj`
      // and unused catch-clause variables like `catch (_e)`.
      "@typescript-eslint/no-unused-vars": ["warn", {
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
]);

export default eslintConfig;
