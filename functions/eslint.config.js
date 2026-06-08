/* eslint-disable @typescript-eslint/no-require-imports */
const tseslint = require("typescript-eslint");
const eslintConfigPrettier = require("eslint-config-prettier");

/**
 * Flat ESLint config for the Cloud Functions project. Functions is a separate
 * npm project (outside the pnpm workspace), so it can't import the shared
 * `eslint.config.base.mjs` — but it now mirrors the same toolchain instead of
 * the old `eslint-config-google` + legacy `.eslintrc.js` setup: ESLint 9 +
 * `typescript-eslint` recommended, a type-aware pass for unhandled Promises,
 * and formatting delegated to Prettier (the old `quotes`/`indent` rules were
 * dropped). The workspace "no generic catches" policy is intentionally NOT
 * applied here — the triggers have their own log-and-continue error semantics.
 */
module.exports = tseslint.config(
  { ignores: ["lib/**", "generated/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{js,ts}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/await-thenable": "error",
    },
  },
  // Prettier compatibility — must stay last.
  eslintConfigPrettier,
);
