import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import {
  firestoreSyntaxRestrictions,
  firestoreImportRule,
} from "./eslint.firestore-guards.mjs";

/**
 * Shared ESLint flat config for the non-Next workspace packages
 * (`packages/*`). It wires the TypeScript parser and enforces the
 * project-wide "no generic catches" policy from CLAUDE.md, plus the
 * Firestore raw-ref guards. Type-level checking is covered by
 * `tsc --noEmit`; the storefront keeps its own `eslint-config-next` setup.
 */

/**
 * The "no generic catches" selectors. Exported so sanctioned data-layer
 * packages (which disable the Firestore syntax guard) can re-apply just the
 * catch rules without re-stating them.
 */
export const catchSyntaxRestrictions = [
  {
    selector: "CatchClause[param=null]",
    message:
      "Bare `catch { }` is forbidden. Bind the error and narrow it via `instanceof <SpecificError>`; rethrow anything that does not match.",
  },
  {
    selector:
      "CatchClause:not(:has(BinaryExpression[operator='instanceof'])):not(:has(ThrowStatement))",
    message:
      "Generic catch is forbidden. The catch body must contain either an `instanceof <SpecificError>` check OR a `throw` (rethrow).",
  },
];

export default defineConfig([
  globalIgnores(["dist/**", "node_modules/**", ".turbo/**"]),
  {
    files: ["**/*.{ts,tsx,mts}"],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-restricted-syntax": [
        "error",
        ...catchSyntaxRestrictions,
        ...firestoreSyntaxRestrictions,
      ],
      "no-restricted-imports": firestoreImportRule,
    },
  },
]);
