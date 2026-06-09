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
import {
  e2eCommonImportRule,
  e2eCommonSyntaxRestrictions,
  e2eAuthImportRule,
  e2eAuthSyntaxRestrictions,
} from "./eslint.e2e-guards.mjs";

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
    // Tests, cloud suites and E2E helpers seed/inspect Firestore directly and
    // log freely; the raw-ref + console guards target production code, so relax
    // them (keep the catch rules).
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}", "e2e/**", "src/test/**"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": ["error", ...catchSyntaxRestrictions],
    },
  },
  {
    // E2E lane guard — COMMON specs (neither *.auth nor *.mp): forbid the login
    // helpers AND MercadoPago plumbing, so a "public" spec can't silently run a
    // live login or touch payments. Placed AFTER the e2e block above so it wins
    // for these files (last matching flat-config block wins). *.mp.spec.ts is
    // intentionally left to the e2e block (unrestricted). The catch rules are
    // re-spread because this block replaces `no-restricted-syntax` wholesale.
    files: ["e2e/**/*.spec.ts"],
    ignores: ["e2e/**/*.auth.spec.ts", "e2e/**/*.mp.spec.ts"],
    rules: {
      "no-restricted-imports": e2eCommonImportRule,
      "no-restricted-syntax": ["error", ...catchSyntaxRestrictions, ...e2eCommonSyntaxRestrictions],
    },
  },
  {
    // E2E lane guard — *.auth.spec.ts: login is allowed here, but MercadoPago is
    // not (checkout/payment specs must be *.mp.spec.ts).
    files: ["e2e/**/*.auth.spec.ts"],
    rules: {
      "no-restricted-imports": e2eAuthImportRule,
      "no-restricted-syntax": ["error", ...catchSyntaxRestrictions, ...e2eAuthSyntaxRestrictions],
    },
  },
  // Prettier compatibility — must stay last.
  eslintConfigPrettier,
]);

export default eslintConfig;
