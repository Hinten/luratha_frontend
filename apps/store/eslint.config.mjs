import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";
import {
  catchSyntaxRestrictions,
  consoleLoggingRestriction,
  typeAwareRules,
} from "../../eslint.config.base.mjs";
import {
  firestoreSyntaxRestrictions,
  firestoreImportRule,
} from "../../eslint.firestore-guards.mjs";

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
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Forbid catches that swallow errors silently (see CLAUDE.md), forbid
      // constructing raw, unvalidated Firestore refs (feature code must go
      // through a repository + schema-bound DataConverter), and forbid
      // `console.error/warn` with a payload (use the structured logger).
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-restricted-syntax": [
        "error",
        ...catchSyntaxRestrictions,
        ...firestoreSyntaxRestrictions,
        consoleLoggingRestriction,
      ],
      "no-restricted-imports": firestoreImportRule,
    },
  },
  {
    // Type-aware correctness pass (unhandled / misused Promises). Every file
    // under the app lives in the app tsconfig, so `projectService` resolves
    // type info for each one.
    files: ["**/*.{ts,tsx,mts}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: typeAwareRules,
  },
  {
    // Sanctioned server-side data-access layer. Route handlers, SSR server
    // components (page/layout) and server-only cached query helpers build admin
    // refs directly, always paired with `.withConverter(...)` — and `toFirestore`
    // now hard-enforces the schema on every write. So the raw-ref guard is
    // relaxed here (the catch + logging rules stay). Feature code on the client
    // must still go through a repository. Any write in these paths MUST use
    // `.withConverter`.
    files: ["src/app/api/**", "src/app/**/page.tsx", "src/app/**/layout.tsx", "src/lib/queries/**"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": ["error", ...catchSyntaxRestrictions, consoleLoggingRestriction],
    },
  },
  {
    // Tests, cloud suites, E2E helpers and dev CLI scripts seed/inspect
    // Firestore directly and log freely; the raw-ref + console guards target
    // production code, so relax them (keep the catch rules).
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}", "e2e/**", "src/test/**", "scripts/**"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": ["error", ...catchSyntaxRestrictions],
    },
  },
  // Prettier compatibility — must stay last.
  eslintConfigPrettier,
]);

export default eslintConfig;
