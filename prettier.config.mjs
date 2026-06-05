/**
 * Shared Prettier config for the whole monorepo (apps, packages and the
 * separate `functions/` project). Formatting is intentionally split from
 * linting: Prettier owns whitespace/quotes/commas, ESLint owns correctness.
 *
 * The values below match the codebase's de-facto style (double quotes,
 * semicolons, 2-space indent, trailing commas) so the initial reformat is a
 * single low-noise commit. `printWidth: 100` is a deliberate middle ground
 * between Prettier's default 80 and the ~120 some existing lines reach.
 *
 * `prettier-plugin-tailwindcss` sorts Tailwind v4 utility classes in JSX/TSX
 * in the canonical order — it must stay last in `plugins`.
 *
 * @type {import("prettier").Config}
 */
const config = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  plugins: ["prettier-plugin-tailwindcss"],
};

export default config;
