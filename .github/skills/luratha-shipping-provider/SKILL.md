---
name: luratha-shipping-provider
description: Activate this skill whenever the user wants to add, replace, configure, or debug a shipping/frete provider in the Luratha frontend (e.g. Correios, Frete Rápido, Kangu, Jadlog, a carrier's own API, or another aggregator). Covers the pluggable `ShippingProvider` architecture introduced in PR #102 — the provider interface, the registry, error codes, automatic fallback, where config/secrets live, and the test patterns. Use it so swapping or adding a freight provider is a localized, low-risk change.
compatibility: Next.js 16 App Router, firebase-admin v13, Zod v4, Vitest 4, TypeScript strict, Node.js 22
---

# Shipping Provider Guide — Luratha Frontend

## Overview

Freight calculation in Luratha is **pluggable**. A "provider" is any module that
knows how to turn a cart + a destination CEP into a list of price/ETA quotes.
Adding a new carrier (Correios, Jadlog, Kangu, Frete Rápido, a marketplace
aggregator, …) means writing **one new module and registering it** — no changes
to route handlers, UI, the free-shipping math, the cache, or the `Order` schema.

Which provider is active is a **data decision**, not a code decision: it is the
field `siteSettings.shipping.providerId` in the Firestore document
`settings/global`. Changing it switches the whole calculation strategy with no
deploy.

All shipping code lives under `src/lib/shipping/`:

| File / dir                              | Purpose                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `types.ts`                              | `ShippingProvider` interface, I/O types, `ShippingProviderError`            |
| `provider.ts`                           | The `REGISTRY` — maps `providerId` → provider; fallback accessor; test hook |
| `service.ts`                            | `server-only` orchestration: caching, fallback, free-shipping threshold     |
| `melhorEnvio/`                          | Reference adapter for an external HTTP API                                  |
| `fallback/fixedRateProvider.ts`         | UF-table provider; doubles as the automatic fallback                        |
| `freeShipping.ts`                       | `threshold = referenceCost / divisor` math                                  |
| `itemNormalizer.ts`                     | Resolves per-item weight/dimensions with `siteSettings` fallbacks           |
| `cache.ts`                              | In-memory quote cache keyed by CEP + cart signature                         |
| `src/schemas/firestore/siteSettings.ts` | Zod schema for `settings/global`, incl. `SHIPPING_PROVIDER_IDS`             |

The provider interface itself:

```ts
export interface ShippingProvider {
  readonly id: ShippingProviderId;
  calculate(input: CalculateShippingInput, settings: ShippingSettings): Promise<ShippingQuote[]>;
  track?(trackingCode: string, settings: ShippingSettings): Promise<TrackingInfo>;
}
```

`calculate` is required. `track` is optional — omit it for providers without
active tracking (the UI falls back to the manual `trackingCode` on the order).

## Adding a new provider — step by step

Reference example to follow: a carrier with an external HTTP API → copy the
shape of `melhorEnvio/`. A provider computed locally from a table → copy
`fallback/fixedRateProvider.ts`.

### Step 1 — Register the id in the schema enum

`SHIPPING_PROVIDER_IDS` is the single source of truth for valid provider ids.
Edit `src/schemas/firestore/siteSettings.ts`:

```ts
export const SHIPPING_PROVIDER_IDS = ["melhor-envio", "fixed-rate", "correios"] as const;
```

This widens the `ShippingProviderId` union. TypeScript will now flag the
`REGISTRY` in `provider.ts` as incomplete (it is typed
`Record<ShippingProviderId, ShippingProvider>`) — that compile error is your
checklist that Step 4 is still pending. Use a stable kebab-case id; it gets
stored in Firestore and in every `Order.shippingMethod` snapshot, so treat it
as a permanent identifier.

### Step 2 — Implement the `ShippingProvider`

Create `src/lib/shipping/<provider>/index.ts` exporting a `ShippingProvider`
object. Contract details:

- **Input** (`CalculateShippingInput`): `destinationPostalCode`,
  `originPostalCode` (both `99999-999`), and `items[]` with per-unit
  `weightKg` / `lengthCm` / `widthCm` / `heightCm` / `unitPrice` **already
  resolved** — `itemNormalizer` applied the `siteSettings` fallbacks upstream,
  so never re-default weights inside the provider.
- **Output** (`ShippingQuote[]`): one entry per service. Set `providerId` to
  your id, `serviceCode` to the carrier's internal service id, `price` in BRL
  (round to cents), `estimatedDays` as business days. Return `[]` (not an
  error) when the destination is simply unservable but the provider is healthy.
  Sort cheapest-first — callers treat `quotes[0]` as the reference.
- **Filtering**: respect `settings.enabledServices` — if non-empty, drop any
  service whose `code` is not in the enabled list (see the `enabledServices`
  Map in `melhorEnvio/index.ts`).
- `track?` — implement only if the carrier exposes tracking; otherwise omit it.

### Step 3 — Isolate the HTTP client (external APIs only)

Put auth, base URL, timeout, and error mapping in a sibling
`<provider>/client.ts`, mirroring `melhorEnvio/client.ts`. Keep the adapter
(`index.ts`) focused on request/response _mapping_. Always use an
`AbortController` timeout — a hung carrier API must surface as
`provider_unavailable`, not a stuck request.

### Step 4 — Register in the registry

Edit `src/lib/shipping/provider.ts` and add the entry to `REGISTRY`:

```ts
const REGISTRY: Record<ShippingProviderId, ShippingProvider> = {
  "melhor-envio": melhorEnvioProvider,
  "fixed-rate": fixedRateProvider,
  correios: correiosProvider,
};
```

This clears the Step 1 compile error. Nothing else imports your module —
`service.ts` resolves providers only through `getShippingProvider(id)`.

### Step 5 — Map every failure to a `ShippingProviderError`

`service.ts` decides retries/fallback purely from the error `code`. Never let a
raw error escape `calculate()`. Codes:

| `code`                 | Use when                                       | Effect in `service.ts`                          |
| ---------------------- | ---------------------------------------------- | ----------------------------------------------- |
| `config_missing`       | Required env/setting absent (e.g. token unset) | Triggers fallback (if enabled)                  |
| `provider_unavailable` | Network failure, timeout, HTTP 5xx, bad JSON   | Triggers fallback (if enabled)                  |
| `invalid_input`        | Bad CEP, empty items, HTTP 4xx                 | Propagates → route returns **400**, no fallback |
| `not_supported`        | Capability absent (e.g. `track()` stubbed)     | Propagates                                      |
| `unknown`              | Anything genuinely unexpected                  | Propagates                                      |

Construct as `new ShippingProviderError(message, providerId, code, cause?)`.
Only `config_missing` and `provider_unavailable` are considered _recoverable_ —
they are the only codes that hand off to the fallback provider.

### Step 6 — Decide where config lives

- **Secrets** (API tokens, keys) → environment variables only, **never
  Firestore**. Resolve them inside the client and throw `config_missing` if
  unset. Document the vars in `.env.example` and `docs/`.
- **Non-secret operational config** (origin CEP, enabled services, fallback
  weight, free-shipping divisor) → the `settings/global` Firestore document via
  `shippingSettingsSchema`. If your provider needs a new structured config
  block, add an optional sub-schema to `siteSettings.ts` (default it so
  existing docs stay valid) and read it from `settings` inside `calculate()`.

### Step 7 — Switch the active provider

Set `shipping.providerId` in the `settings/global` Firestore document. The
in-memory settings cache (`siteSettingsRepository`, ~60s TTL) means a change
takes up to a minute, or is immediate with a `forceFresh` read. No deploy, no
code change.

### Step 8 — Tests

- **Unit** (`src/lib/shipping/__tests__/<provider>.test.ts`, Vitest jsdom): test
  `calculate()` mapping, service filtering, and the error-code mapping. For
  external HTTP, mock `fetch`. Follow `melhorEnvio.test.ts`.
- **Service-level**: `provider.ts` exports `__setShippingProviderForTests(id,
mock)` — inject a mock provider to test orchestration/fallback without
  hitting the network. See `service.test.ts`.
- **Cloud integration** (`src/test/cloud/*.cloud.test.ts`, opt-in): exercises
  the real route + Firestore; auto-skips without credentials. Add a real-API
  smoke test only behind `describeCloud` so CI without secrets stays green.

Mandatory before finishing: `npx tsc` → `npm run lint` → `npm test`. For schema
changes also run `npm run test:firestore`.

## Automatic fallback

When the primary provider throws a recoverable error (`config_missing` /
`provider_unavailable`), `service.ts` retries with the fallback provider
(`fixed-rate`) **only if** `siteSettings.shipping.fixedRate.enabledAsFallback`
is `true`. It defaults to `false` — a safe posture: a primary failure then
returns HTTP 502 instead of silently quoting a fixed-rate price that could be
sold at a loss. The response carries `usedFallback: true` whenever the fallback
answered. The fallback is always `fixed-rate`; to make a different provider the
fallback, change `getFallbackProvider()` in `provider.ts`.

## Common pitfalls

- **Forgetting Step 1 or Step 4.** They are paired — the typed `REGISTRY` makes
  a missing registration a compile error, but a missing enum entry is not
  caught until a Firestore doc references the unknown id at runtime.
- **Re-defaulting item weight/dimensions** inside the provider. `itemNormalizer`
  already applied `siteSettings` fallbacks; the values in `input.items` are
  final.
- **Throwing a raw `Error`** from `calculate()`. It will propagate as an
  uncatchable 500 and never reach the fallback path. Always wrap in
  `ShippingProviderError` with the right `code`.
- **Misclassifying a 4xx as `provider_unavailable`.** A bad CEP is the user's
  input (`invalid_input` → 400); a 5xx/timeout is the carrier's fault
  (`provider_unavailable` → fallback/502).
- **Putting a token in Firestore.** Secrets are env-only.
- **Returning unsorted quotes.** Free-shipping math and "frete a partir de" use
  `quotes[0]` as the cheapest reference — sort ascending by `price`.
- **`runtime`**: the route handler at `src/app/api/checkout/shipping/route.ts`
  already declares `export const runtime = "nodejs"`; keep providers free of
  Edge-incompatible APIs so that stays valid.
