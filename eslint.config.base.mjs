import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import { firestoreSyntaxRestrictions, firestoreImportRule } from "./eslint.firestore-guards.mjs";

/**
 * Shared ESLint flat config for the non-Next workspace packages
 * (`packages/*`). It wires the TypeScript parser and enforces the
 * project-wide "no generic catches" policy from CLAUDE.md, the structured
 * logging convention, and the Firestore raw-ref guards. A small set of
 * type-aware correctness rules (unhandled Promises) runs over `src/**`.
 * Whitespace/quotes/commas are owned by Prettier — `eslintConfigPrettier`
 * (last) turns off any stylistic rule that would fight the formatter.
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

/**
 * Forbid `console.error` / `console.warn` called with a payload argument —
 * the `console.error("msg", obj)` shape banned by the logging conventions in
 * CLAUDE.md. Cloud Logging splits the `util.inspect` output of that payload
 * across separate entries (making the record uncopyable), so structured data
 * must go through the logger. The selector fires only at >1 argument, so plain
 * diagnostic strings (`console.warn("[scope] …")`) and `console.log` stay
 * allowed. Exported so apps can re-apply it (their override blocks re-state
 * `no-restricted-syntax`).
 */
export const consoleLoggingRestriction = {
  selector:
    "CallExpression[callee.object.name='console'][callee.property.name=/^(error|warn)$/][arguments.length>1]",
  message:
    'Do not pass a payload to `console.error`/`console.warn` — use the structured logger from `@luratha/core/logging/logger` (e.g. `logger.error("[scope] …", { err })`). Cloud Logging splits util.inspect output across entries and maps stderr to ERROR regardless of intent.',
};

/**
 * Type-aware correctness rules. Intentionally scoped to genuine async bugs
 * (unhandled / misused Promises) rather than the full `recommendedTypeChecked`
 * preset — the `no-unsafe-*` family floods on the untyped Firebase SDK surface
 * with little signal. Requires `parserOptions.projectService`.
 */
export const typeAwareRules = {
  "@typescript-eslint/no-floating-promises": "error",
  // `checksVoidReturn.attributes: false` skips async JSX event handlers
  // (`onClick={async …}`) — React discards the returned Promise, and forcing a
  // `void` wrapper there is noise. The valuable checks stay on: Promises used
  // in conditions, spreads, and passed where a `void`-returning callback is
  // expected (`forEach`/`setTimeout(async …)`), which are real fire-and-forget
  // bugs.
  "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
  "@typescript-eslint/await-thenable": "error",
};

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
        consoleLoggingRestriction,
      ],
      "no-restricted-imports": firestoreImportRule,
    },
  },
  {
    // Type-aware pass over package sources (the files in each package's
    // tsconfig `include`). `projectService` auto-discovers the nearest
    // tsconfig per file, so this works through the re-export in each package.
    files: ["src/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: typeAwareRules,
  },
  // Prettier compatibility — must stay last.
  eslintConfigPrettier,
]);
