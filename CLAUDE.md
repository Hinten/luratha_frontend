# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Luratha is a Next.js 16.2 App Router frontend (React 19 + TypeScript strict) for a Brazilian slow-fashion e-commerce. Stack: Firebase client SDK + Firebase App Hosting, Tailwind CSS v4, CSS Modules. Node.js 22 required.

The repository is a **pnpm + Turborepo monorepo**. The storefront lives in `apps/store/`; future apps (e.g. `apps/admin/`) and shared `packages/*` join the same workspace. `functions/` keeps its own npm toolchain and is not part of the pnpm workspace.

## Commands

Run from the repo root — Turborepo fans out to the affected workspaces. Node.js 22 + pnpm 10 required.

```bash
pnpm install                  # install all workspace dependencies
pnpm dev                      # start dev server (Turbopack)
pnpm lint                     # ESLint — must exit 0 before finishing any task
pnpm typecheck                # tsc --noEmit across workspaces
pnpm test                     # Vitest unit/component suite (jsdom, no network)
pnpm test:coverage            # Vitest with coverage report
pnpm test:firestore           # Vitest cloud integration suite (luratha-96386) — mandatory for schema/Firebase changes
pnpm test:functions:cloud     # Vitest Functions trigger suite — requires Functions deployed to luratha-96386
pnpm test:e2e                 # Playwright E2E against luratha-96386 (headless Chromium, auto-starts dev server)
pnpm build                    # production build — run when the change affects production behavior
```

Scope a command to one app: `pnpm --filter @luratha/store <script>`.
Run a single Playwright spec: `pnpm --filter @luratha/store exec playwright test e2e/home.spec.ts`

**Mandatory order for any code change:** `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm test:e2e`

TypeScript check is mandatory: always run `pnpm typecheck` to detect type errors. If errors are found, fix them.

For schema or Firebase request flow changes (schemas, Firestore queries, Auth/Storage calls, repositories, SSR pages, seed endpoints), also run: `pnpm test:firestore`. The `test:firestore`, `test:functions:cloud`, `test:cloud`, and `test:e2e` suites all run against the dedicated test project `luratha-96386` and require Firebase credentials in env (`FIREBASE_SERVICE_ACCOUNT_BASE64` + `FIREBASE_WEB_APP_CONFIG_BASE64` or the `NEXT_PUBLIC_FIREBASE_*` vars). They auto-skip if credentials are missing. The Firebase Emulator is no longer used.

**CI matrix**: PRs to `master` run lint/typecheck, unit, `build` (Next.js — both apps), integration-cloud and e2e-cloud. PRs to `production` additionally run the heavier `functions-cloud` (deploy + trigger tests) suite. The `build` job skips when Firebase secrets are absent (the storefront prerenders Firestore-backed pages).

**CI failure logs**: when the `Test` workflow fails on a PR, its own `report-failure` job posts the tail of each failed job's log (last ~12KB) as a PR comment. If you (Claude) pushed and the CI broke, **read the most recent PR comment** for the actual error — `pull_request_read` (`get_check_runs`) only returns metadata, not log output.

## Architecture

### Monorepo layout

| Path | Purpose |
|---|---|
| `apps/store/` | Storefront Next.js app (`@luratha/store`) — all paths in the Directory Map are relative to here |
| `apps/admin/` | Admin Next.js app (`@luratha/admin`) — internal panel, served on its own App Hosting backend; dev port 3001 |
| `packages/*` | Shared workspace packages, imported by name (`@luratha/<pkg>`) |
| `functions/` | Cloud Functions — separate npm project, outside the pnpm workspace |
| `tsconfig.base.json`, `eslint.config.base.mjs` | Shared config the `packages/*` extend (the storefront keeps `eslint-config-next`) |
| `pnpm-workspace.yaml`, `turbo.json` | Workspace + task-orchestration config at the repo root |

### Shared packages

| Package | Source of truth for | Depends on |
|---|---|---|
| `@luratha/schemas` | Zod schemas / Firestore data contracts | — |
| `@luratha/firestore` | Firebase SDK wrappers + DataConverters | `schemas` |
| `@luratha/core` | `embeddingService`, `firestoreQueryStrategies` | `schemas` |
| `@luratha/auth` | `requireUser` / session-cookie helpers | `firestore` |
| `@luratha/repositories` | Firestore access layer + seed helpers | `schemas`, `firestore`, `core` |

Import shared code by package name (`@luratha/schemas`, `@luratha/firestore/firebaseAdmin`, …) — never reach across workspaces with relative or `@/` paths. Add a new shared package to the consuming app's `dependencies` (`workspace:*`) and to `transpilePackages` in its `next.config.ts`.

### Admin app (`apps/admin/`)

Internal panel, deployed to a separate App Hosting backend. Auth model:
- `middleware.ts` (Edge) does a shallow check — redirects to `/login` when the `__session` cookie is absent. It must not import `@luratha/auth` (firebase-admin can't run on Edge).
- The `(dashboard)/layout.tsx` server component is the real gate: `requireUser()` verifies the cookie and the layout enforces `user.isAdmin`.
- `POST /api/auth/session` issues the `__session` cookie only for users with the `admin` claim — it sets the cookie **host-only** (no `domain`), keeping the admin session isolated from the storefront. Never add `domain`.

Grant the `admin` custom claim with `pnpm --filter @luratha/admin grant-admin <email>` (needs Firebase credentials in the repo-root `.env`; `--revoke` removes it). The user must re-login afterwards.

### Directory Map

Paths below are under `apps/store/`.

| Path | Purpose |
|---|---|
| `src/app/` | Routes, layouts, loading/error UI, metadata, sitemap/robots, page-level tests |
| `src/components/` | Shared UI + domain folders (`categoria/`, `produto/`), each with `.module.css` |
| `src/contexts/` | Client state providers (`AuthContext`, `CartContext`) |
| `src/lib/` | App-local helpers — constants, SEO constants, shipping, query helpers |
| `src/services/` | Lightweight service layer (minimal — avoid duplicating repository logic) |
| `src/test/` | Cloud test setup, Playwright cloud setup, seed helpers, Vitest setup |
| `src/test/cloud/` | Vitest cloud integration suite (`*.cloud.test.ts`) |
| `src/test/cloud-functions/` | Vitest Functions trigger suite (`*.functions.test.ts`) |
| `e2e/` | Playwright specs (run against `luratha-96386`) |

### CRUD API layout

Each HTTP method lives in its own file and is re-exported through a thin `route.ts`:

```
src/app/api/{entities}/
├── list.ts              # GET list handler
├── route.ts             # exports GET + POST
src/app/api/{entities}/[id]/
├── get.ts / put.ts / patch.ts / delete.ts
└── route.ts             # re-exports all four
```

All API route handlers must include `export const runtime = "nodejs"` — firebase-admin doesn't work in the Edge runtime.

### Firebase SDK split

The `@luratha/firestore` package owns these modules — import them as `@luratha/firestore/<file>`:

| Module | Use when |
|---|---|
| `firebaseClient.ts` | Browser/client components (`"use client"` paths) |
| `firebaseSsrApp.ts` | SSR/App Router rendering flows (server components, `generateMetadata`) |
| `firebaseAdmin.ts` | API route handlers, seed scripts, background environments |
| `firebaseSearchDb.ts` | Pipeline/vector search in server-only paths |

Never import client Firebase modules into server-only flows. The Admin SDK bypasses Firestore security rules — use only in trusted server paths.

### Schemas and DataConverters

All Firestore data contracts live in the `@luratha/schemas` package (`packages/schemas/src/`); DataConverters live in `@luratha/firestore` (`packages/firestore/src/`). When adding a new entity:
- Define the Zod schema in `packages/schemas/src/{entity}.ts`
- Export from `packages/schemas/src/index.ts` alongside `firestoreCollections`
- Create `adminXxxConverter.ts` and `clientXxxConverter.ts` in `packages/firestore/src/` for entities with `Timestamp` or vector fields
- Always use `.withConverter()` on Firestore refs — omitting it causes vector fields to be stored as plain arrays, silently breaking `findNearest`

Zod v4 note: use `error.issues`, not `error.errors` (`.errors` was removed).

### PATCH semantics (critical)

Merge order must be `{ ...existingData, ...payload, ...serverFields }`. Absent keys are unchanged; `null` values set the field to null. Never use `Object.assign` or deep-merge libraries — they lose the null/absent distinction.

### Schema-computed fields

Strip fields auto-generated by a Zod `transform` (e.g. `slug` from `title` + `sku`) before re-calling `validate{Entity}` in PUT/PATCH — the stored value will diverge after updates and cause validation errors.

## Core Engineering Conventions

- Use `@/src/...` imports (alias from `tsconfig.json`)
- Prefer Server Components; add `"use client"` only when hooks, events, or browser APIs are required
- For SSR data fetching and `generateMetadata`, use `firebaseSsrApp.ts` + repository APIs — never client SDK instances
- Styling: CSS Modules (`.module.css`) for component styles; design tokens from `src/app/globals.css` (`var(--color-*)`, `var(--font-*)`) — never hard-code hex values
- No `tailwind.config.js` — this repo uses Tailwind v4 PostCSS setup
- Accessibility: semantic landmarks, one `<h1>` per page, keyboard-accessible interactions, visible focus states, descriptive `alt`

### No generic catches

Every `try/catch` must do one of two things:

1. Narrow the error with `instanceof <SpecificError>` **and** rethrow whatever does not match, or
2. Just rethrow unconditionally.

A bare `catch { … }` (no binding) is forbidden. A catch that observes the error and falls through silently — `console.log(err)`, `setError("fallback")`, `return null` — is forbidden. Silent fallbacks hide real bugs during debugging.

**`instanceof Error` does NOT count as narrowing.** `Error` is the base class of every JS exception, so it accepts everything; pick a real subclass that matches what the `try` body can actually throw:

- `JSON.parse`, `BigInt(...)` → `SyntaxError`
- Zod `parse` / `validate*` → `ZodError` (`z.ZodError`)
- Client Firebase calls (`firebase/auth`, `firebase/firestore`) → `FirebaseError` from `firebase/app`
- Admin Firebase calls (`firebase-admin/auth`) → `FirebaseAuthError` from `firebase-admin/auth`
- `localStorage`, structured clone, etc. → `DOMException`
- HTTP responses you throw yourself → introduce a project-owned class such as `ApiResponseError` or `AuthClientError` in `src/lib/errors.ts` (don't `instanceof Error` and inspect the message string)

If a site genuinely needs to swallow an error (rare — usually cleanup in `finally`, idempotent retry, "file already gone" race), do it explicitly:

```ts
try { … }
catch (err) {
  if (err instanceof <SpecificError>) {
    // swallow on purpose — <one-line reason>
    return fallback;
  }
  throw err;
}
```

The ESLint rules (`no-empty`, `no-restricted-syntax`) enforce **(a)** that the catch is bound and **(b)** that the body contains either an `instanceof` check or a `throw`. The rule can't check that you picked a *specific* class on the RHS of `instanceof` — that part is convention. Do not weaken either rule to `warn` to silence violations; refactor the site instead.

## Testing Conventions

- Unit/component tests: `src/**/__tests__/*.test.ts(x)` (Vitest, jsdom; no Firebase)
- Cloud integration tests: `src/test/cloud/*.cloud.test.ts` and `src/test/cloud/*.test.ts` (Vitest, node) — run against `luratha-96386`
- Cloud Functions trigger tests: `src/test/cloud-functions/*.functions.test.ts` (Vitest, node) — require Functions deployed to `luratha-96386`
- E2E: `e2e/*.spec.ts` (Playwright) — runs against `luratha-96386`
- Always mock `next/link` and `next/navigation` in Vitest component tests (no router context)
- Files with `import "server-only"` break Vitest unless aliased; the alias is already in `vitest.config.mts` — add new `server-only` modules to it if needed
- Cloud-backed suites auto-skip when credentials are missing (`describeCloud` from `src/test/cloud/sharedSetup.ts`)
- Use `createCloudTestPrefix()` for any seed data so concurrent runs do not collide
- Never remove or skip existing tests

## SEO Requirements

Every new route must have:
- `metadata` or `generateMetadata` with unique title, description, canonical, and OG
- `JsonLd` component with the correct schema type
- Update `src/app/sitemap.ts`, `src/app/robots.ts`, and `public/llms.txt` when route discoverability changes

## Skill References

For deeper implementation detail, consult these skills:
- Testing patterns and mock templates: `.github/skills/luratha-testing/SKILL.md`
- Visual identity (colors, typography, components): `.github/skills/visual-identity/SKILL.md`
- SEO/AEO/GEO: `.github/skills/luratha-seo/SKILL.md`
- CRUD API (DataConverters, pipeline search, embeddings, test patterns): `.github/skills/luratha-crud-api/SKILL.md`
- Firestore query strategies: `.github/skills/firestore-queries-pipelines/SKILL.md`
- Adding/swapping a shipping provider (pluggable freight architecture): `.github/skills/luratha-shipping-provider/SKILL.md`
- MercadoPago payments (payment-intent API, webhook, PIX/card/boleto): `.github/skills/mercadopago-payments/SKILL.md`
