const tsParser = require("@typescript-eslint/parser");

module.exports = [
  {
    ignores: ["lib/**", "generated/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.{js,ts}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ["tsconfig.json", "tsconfig.dev.json"],
        sourceType: "module",
        ecmaVersion: "latest",
      },
    },
    rules: {
      quotes: ["error", "double"],
      indent: ["error", 2],
    },
  },
];
