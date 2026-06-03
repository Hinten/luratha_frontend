import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { catchSyntaxRestrictions } from "../../eslint.config.base.mjs";
import {
  firestoreSyntaxRestrictions,
  firestoreImportRule,
} from "../../eslint.firestore-guards.mjs";

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
      // Forbid silent catches (see CLAUDE.md) AND raw, unvalidated Firestore
      // refs — feature code must go through a repository + DataConverter.
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-restricted-syntax": [
        "error",
        ...catchSyntaxRestrictions,
        ...firestoreSyntaxRestrictions,
      ],
      "no-restricted-imports": firestoreImportRule,
    },
  },
  {
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}", "e2e/**", "src/test/**"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": ["error", ...catchSyntaxRestrictions],
    },
  },
]);

export default eslintConfig;
