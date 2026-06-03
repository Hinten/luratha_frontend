import baseConfig, { catchSyntaxRestrictions } from "../../eslint.config.base.mjs";

/**
 * The repositories package IS the sanctioned Firestore ref-builder layer: every
 * collection/doc handle is created here and bound to a schema DataConverter via
 * `.withConverter()`. So the Firestore raw-ref guards (`no-restricted-imports`
 * for `collection`/`doc`, `no-restricted-syntax` for `<db>.collection(...)`) are
 * turned off for this package's sources, while the "no generic catches" rules
 * stay in force.
 */
export default [
  ...baseConfig,
  {
    files: ["src/**/*.{ts,tsx,mts}"],
    rules: {
      "no-restricted-imports": "off",
      "no-restricted-syntax": ["error", ...catchSyntaxRestrictions],
    },
  },
];
