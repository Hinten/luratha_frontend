# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Luratha is a Next.js 16.2.2 App Router frontend (React 19 + TypeScript strict) for a Brazilian slow-fashion e-commerce. Stack: Firebase client SDK + Firebase App Hosting, Tailwind CSS v4, CSS Modules. Node.js 22 required.

## Commands

```bash
npm ci                        # install dependencies
npm run dev                   # start dev server (Turbopack)
npm run lint                  # ESLint — must exit 0 before finishing any task
npm test                      # Vitest unit/component suite (jsdom, no network)
npm run test:watch            # Vitest watch mode
npm run test:coverage         # Vitest with coverage report
npm run test:firestore        # Vitest cloud integration suite (luratha-96386) — mandatory for schema/Firebase changes
npm run test:functions:cloud  # Vitest Functions trigger suite — requires Functions deployed to luratha-96386
npm run test:e2e              # Playwright E2E against luratha-96386 (headless Chromium, auto-starts dev server)
npm run test:e2e:ui           # Playwright interactive UI mode
npm run build                 # production build — run when the change affects production behavior
```

Run a single Playwright spec: `npx playwright test e2e/home.spec.ts`

**Mandatory order for any code change:** `npx tsc` → `npm run lint` → `npm test` → `npm run test:e2e`

TypeScript check is mandatory: always run `npx tsc` to detect type errors. If errors are found, fix them.

For schema or Firebase request flow changes (schemas, Firestore queries, Auth/Storage calls, repositories, SSR pages, seed endpoints), also run: `npm run test:firestore`. The `test:firestore`, `test:functions:cloud`, `test:cloud`, and `test:e2e` suites all run against the dedicated test project `luratha-96386` and require Firebase credentials in env (`FIREBASE_SERVICE_ACCOUNT_BASE64` + `FIREBASE_WEB_APP_CONFIG_BASE64` or the `NEXT_PUBLIC_FIREBASE_*` vars). They auto-skip if credentials are missing. The Firebase Emulator is no longer used.

**CI matrix**: PRs to `master` run lint/typecheck, unit, integration-cloud and e2e-cloud. PRs to `production` additionally run the heavier `functions-cloud` (deploy + trigger tests) suite.

**CI failure logs**: when the `Test` workflow fails on a PR, its own `report-failure` job posts the tail of each failed job's log (last ~12KB) as a PR comment. If you (Claude) pushed and the CI broke, **read the most recent PR comment** for the actual error — `pull_request_read` (`get_check_runs`) only returns metadata, not log output.

## Architecture

### Directory Map

| Path | Purpose |
|---|---|
| `src/app/` | Routes, layouts, loading/error UI, metadata, sitemap/robots, page-level tests |
| `src/components/` | Shared UI + domain folders (`categoria/`, `produto/`), each with `.module.css` |
| `src/contexts/` | Client state providers (`AuthContext`, `CartContext`) |
| `src/lib/` | Constants, SEO constants, Firebase clients, query helpers |
| `src/lib/firestore/` | Firebase SDK wrappers — `firebaseClient.ts`, `firebaseSsrApp.ts`, `firebaseAdmin.ts`, DataConverters |
| `src/lib/repositories/` | Firestore access layer and seed helpers |
| `src/services/` | Lightweight service layer (minimal — avoid duplicating repository logic) |
| `src/schemas/firestore/` | Zod validation schemas; keep Firestore data contracts here |
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

| File | Use when |
|---|---|
| `firebaseClient.ts` | Browser/client components (`"use client"` paths) |
| `firebaseSsrApp.ts` | SSR/App Router rendering flows (server components, `generateMetadata`) |
| `firebaseAdmin.ts` | API route handlers, seed scripts, background environments |
| `firebaseSearchDb.ts` | Pipeline/vector search in server-only paths |

Never import client Firebase modules into server-only flows. The Admin SDK bypasses Firestore security rules — use only in trusted server paths.

### Schemas and DataConverters

All Firestore data contracts live in `src/schemas/firestore/`. When adding a new entity:
- Define the Zod schema in `src/schemas/firestore/{entity}.ts`
- Export from `src/schemas/firestore/index.ts` alongside `firestoreCollections`
- Create `adminXxxConverter.ts` and `clientXxxConverter.ts` for entities with `Timestamp` or vector fields
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
