/**
 * ESLint guards that keep the Playwright E2E split honest.
 *
 * Specs are routed into projects (`public` / `auth` / `mp`) purely by filename
 * convention (`*.auth.spec.ts` / `*.mp.spec.ts`; everything else is public).
 * These guards stop a spec from silently drifting out of its lane — e.g. a
 * "public" spec that logs a real user in, or an auth spec that pulls in
 * MercadoPago plumbing. Without them the convention rots: a stray
 * `import "./_authHelpers"` would run live login in the public lane (which has
 * no TEST_USER secrets) and the separation buys nothing.
 *
 * Two stock rules, no custom plugin (mirrors `eslint.firestore-guards.mjs`):
 *   - `no-restricted-imports` blocks the auth/MP helper modules and the
 *     `@luratha/payments` package — this is the real barrier, since a spec must
 *     import a helper to log in or touch payments.
 *   - `no-restricted-syntax` blocks the tell-tale inline `process.env` reads
 *     (`E2E_LIVE_AUTH` = login; `MERCADOPAGO_*` / `MELHOR_ENVIO_*` /
 *     `NEXT_PUBLIC_MERCADOPAGO_*` = payment/shipping) as a secondary tripwire.
 *
 * Resolution is by filename (last matching flat-config block wins):
 *   - common `*.spec.ts` (neither marker) → forbid BOTH auth and MP
 *   - `*.auth.spec.ts`                    → allow auth, still forbid MP
 *   - `*.mp.spec.ts`                      → unrestricted (falls to the e2e block)
 *
 * The syntax arrays are exported on their own so the consuming config can spread
 * them alongside `catchSyntaxRestrictions` (the "no generic catches" policy must
 * stay enforced in these files too).
 */

/** `no-restricted-imports` path: the login helper. */
const authHelperImport = {
  name: "./_authHelpers",
  message:
    "Login helpers belong only in *.auth.spec.ts (or *.mp.spec.ts). Rename the spec to opt into the auth/mp Playwright project, or drop the login.",
};

/** `no-restricted-imports` path: order/shipping cleanup (MercadoPago). */
const mpStateHelperImport = {
  name: "./_userStateHelpers",
  message:
    "Order/shipping cleanup (MercadoPago) belongs only in *.mp.spec.ts. Rename the spec to opt into the mp Playwright project.",
};

/** `no-restricted-imports` pattern: the payments package. */
const paymentsPackagePattern = {
  group: ["@luratha/payments", "@luratha/payments/**"],
  message: "Payment code belongs only in *.mp.spec.ts (mp Playwright project).",
};

/**
 * `process.env.E2E_LIVE_AUTH` read → this is a live-login test.
 *
 * Two selectors (esquery union) so bracket notation can't sneak past the
 * tripwire: dot access (`property.name`, an Identifier) AND computed access
 * (`process.env["E2E_LIVE_AUTH"]`, a string `Literal` → `property.value`).
 */
const liveAuthEnvSelector = {
  selector:
    "MemberExpression[object.object.name='process'][object.property.name='env'][property.name='E2E_LIVE_AUTH']," +
    "MemberExpression[object.object.name='process'][object.property.name='env'][computed=true][property.value='E2E_LIVE_AUTH']",
  message:
    "`process.env.E2E_LIVE_AUTH` marks a live-login test — move it to *.auth.spec.ts (auth Playwright project).",
};

/**
 * `process.env.MERCADOPAGO_* / MELHOR_ENVIO_* / NEXT_PUBLIC_MERCADOPAGO_*`.
 * Dot + computed (bracket) access, same reason as `liveAuthEnvSelector`.
 */
const mpEnvSelector = {
  selector:
    "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^(MERCADOPAGO_|MELHOR_ENVIO_|NEXT_PUBLIC_MERCADOPAGO_)/]," +
    "MemberExpression[object.object.name='process'][object.property.name='env'][computed=true][property.value=/^(MERCADOPAGO_|MELHOR_ENVIO_|NEXT_PUBLIC_MERCADOPAGO_)/]",
  message:
    "MercadoPago / Melhor Envio env vars belong only in *.mp.spec.ts (mp Playwright project).",
};

/** Import rule for COMMON specs (neither `.auth` nor `.mp`): forbid auth AND MP. */
export const e2eCommonImportRule = [
  "error",
  {
    paths: [authHelperImport, mpStateHelperImport],
    patterns: [paymentsPackagePattern],
  },
];

/** Extra syntax selectors for COMMON specs: forbid both auth and MP env reads. */
export const e2eCommonSyntaxRestrictions = [liveAuthEnvSelector, mpEnvSelector];

/** Import rule for `*.auth.spec.ts`: allow auth, still forbid MP. */
export const e2eAuthImportRule = [
  "error",
  {
    paths: [mpStateHelperImport],
    patterns: [paymentsPackagePattern],
  },
];

/** Extra syntax selectors for `*.auth.spec.ts`: forbid MP env reads only. */
export const e2eAuthSyntaxRestrictions = [mpEnvSelector];
