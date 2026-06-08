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

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Reuse the shared "no generic catches" selectors + the logging guard
      // (single source of truth in eslint.config.base.mjs). This webhook app
      // has no Firestore feature code, so the raw-ref guard is not applied.
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-restricted-syntax": ["error", ...catchSyntaxRestrictions, consoleLoggingRestriction],
    },
  },
  {
    // Type-aware correctness pass (unhandled / misused Promises).
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
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}", "e2e/**", "src/test/**"],
    rules: {
      "no-restricted-syntax": ["error", ...catchSyntaxRestrictions],
    },
  },
  // Prettier compatibility — must stay last.
  eslintConfigPrettier,
]);

export default eslintConfig;
