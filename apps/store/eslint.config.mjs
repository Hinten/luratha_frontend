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
      // Forbid catches that swallow errors silently. Every catch must either:
      //   (a) narrow the error via `instanceof <SpecificError>` AND rethrow the
      //       rest, or
      //   (b) rethrow unconditionally.
      // `instanceof Error` does NOT count as narrowing — it's the base class of
      // every JS exception and is enforced by convention (see CLAUDE.md), not
      // by the linter.
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CatchClause[param=null]",
          message:
            "Bare `catch { }` is forbidden. Bind the error and narrow it via `instanceof <SpecificError>`; rethrow anything that does not match.",
        },
        {
          selector:
            "CatchClause:not(:has(BinaryExpression[operator='instanceof'])):not(:has(ThrowStatement))",
          message:
            "Generic catch is forbidden. The catch body must contain either an `instanceof <SpecificError>` check OR a `throw` (rethrow). Silent fallbacks hide bugs during debugging.",
        },
      ],
    },
  },
]);

export default eslintConfig;
