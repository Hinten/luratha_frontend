# Copilot Instructions for luratha_frontend

Trust this file first. Search the codebase only when this guide does not answer the question.

## Project Snapshot

Luratha is a Next.js 16.2.2 App Router frontend (React 19 + TypeScript strict) for a Brazilian slow-fashion e-commerce. It uses Firebase client SDK + Firebase App Hosting and Tailwind CSS v4 with CSS Modules.

## Runtime & Prerequisites

- Node.js **22**
- npm **10** (`npm ci`, never `npm install` in CI)
- Next.js **16.2.2** (Turbopack default)
- TypeScript **strict mode**
- Firebase CLI (`npm install -g firebase-tools@latest`)
- Playwright Chromium (`npx playwright install --with-deps chromium`)

`next/font/google` is used in `src/app/layout.tsx`; build environments must allow access to Google Fonts endpoints.

## Command Order (mandatory)

Run commands in this order for any code change:

```bash
npm ci
npm run lint
npm test
npm run test:e2e
```

If the change updates schemas or Firebase request flows (for example `src/schemas/**`, Firestore queries, Auth/Storage calls, repository code, SSR pages that fetch Firestore data, or dev seed endpoints), also run in this order:

```bash
npm run test:firestore
npm run test:e2e:emulator
```

Treat emulator skips as a failed validation for Firebase-related changes. If test output indicates emulator unavailable/skipped, fix emulator startup/environment first and re-run.

If the change affects production behavior, also run:

```bash
npm run build
```

## Scripts (`package.json`)

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Run built app |
| `npm run lint` | ESLint (Next core-web-vitals + TS) |
| `npm test` | Vitest once |
| `npm run test:firestore` | Vitest emulator integration suite (`vitest.emulator.config.mts`) |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Vitest with coverage |
| `npm run test:e2e` | Playwright E2E (headless) |
| `npm run test:e2e:emulator` | Playwright E2E suite that requires Firebase Emulator (`playwright.e2e.emulator.config.ts`) |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run test:cloud` | Vitest cloud integration suite (`vitest.cloud.config.mts`) — **run only on explicit request** |
| `npm run setup:routes` | Run `docs/create-catalog-routes.mjs` scaffolding |

## Architecture Map (where to change code)

- `src/app/`: routes, layouts, loading/error UI, metadata, sitemap/robots, page-level tests.
- `src/components/`: shared UI plus domain folders (`categoria/`, `produto/`), each with `.module.css`.
- `src/contexts/`: client state providers (`AuthContext`, `CartContext`).
- `src/lib/`: constants, SEO constants, Firebase (`src/lib/firestore/firebaseClient.ts`, `src/lib/firestore/firebaseSsrApp.ts`, `src/lib/firestore/firebaseAdmin.ts`), query helpers, repositories, mock data.
- `src/lib/repositories/`: Firestore access layer and seed helpers used by server routes/pages.
- `src/services/`: lightweight service layer (currently minimal; avoid adding duplicate repository logic here).
- `src/schemas/`: validation and domain schemas.
- `src/test/`: emulator orchestration, seed helpers, and Vitest setup.
- `src/test/cloud/`: cloud Firestore integration tests (pipeline search, vector search, repository). Run only on explicit request — see note in Testing Expectations.
- `e2e/`: Playwright specs.
- `e2e/with-emulator/`: Playwright specs that must run with Firebase Emulator.
- `public/llms.txt`: GEO/LLM discoverability file.

## Core Engineering Conventions

- Use `@/src/...` imports (alias from `tsconfig.json`).
- Prefer Server Components; add `"use client"` only when required (hooks/events/browser APIs).
- For SSR/App Router data fetching and `generateMetadata`, use server-safe Firebase/repository code (`firebaseSsrApp.ts` + repository APIs), never client Firebase SDK instances.
- Keep Firestore data contracts aligned with `src/schemas/firestore`; avoid introducing new reads based on legacy `src/lib/types.ts` in new server flows.
- Keep changes small and composable; reuse existing components/utilities before creating new ones.
- Styling: use CSS Modules for component styles; use design tokens from `src/app/globals.css` (`var(--color-*)`, `var(--font-*)`).
- Accessibility is required: semantic landmarks, one `<h1>` per page, keyboard-accessible interactions, visible focus states, descriptive labels and `alt`.
- Performance: avoid unnecessary client components and redundant data work in render paths.

## Testing Expectations

- Vitest config: `vitest.config.mts` (`jsdom`, globals, setup in `src/test/setup.ts`).
- Firebase emulator Vitest config: `vitest.emulator.config.mts` (`node`, global setup in `src/test/firestoreEmulator.globalSetup.ts`).
- Playwright default config: `playwright.config.ts` (auto `npm run dev`, Chromium project, ignores `e2e/with-emulator`).
- Playwright emulator config: `playwright.e2e.emulator.config.ts` (sets emulator env + global emulator setup/teardown).
- Test naming: `src/**/__tests__/*.test.ts(x)` and `e2e/*.spec.ts`.
- For schema or Firebase request changes, `npm run test:firestore` and `npm run test:e2e:emulator` are mandatory and must pass before finishing.
- Do not remove/skip existing tests to make CI pass.
- **Cloud tests** (`src/test/cloud/`): validate textual-pipeline search plans, vector search plans, and real Firestore Cloud integration (`productsSearchRepository`). Run with `npm run test:cloud`. **Do NOT run these automatically** — they hit live Firebase and incur cost. Execute only when the user explicitly asks. Require `FIREBASE_SERVICE_ACCOUNT_BASE64` and `FIREBASE_WEB_APP_CONFIG_BASE64` env vars; tests auto-skip when credentials are absent.
- For full patterns and mocks, use `.github/skills/luratha-testing/SKILL.md`.

## SEO / AEO / GEO Expectations

When adding or updating pages/routes:

- Provide page metadata (`metadata` or `generateMetadata`) with unique title, description, canonical, OG.
- Inject JSON-LD using `JsonLd` with the correct schema type.
- Keep semantic HTML structure and descriptive alt text.
- Update `src/app/sitemap.ts`, `src/app/robots.ts`, and `public/llms.txt` when route discoverability changes.

Use `.github/skills/luratha-seo/SKILL.md` for implementation details.

## Firebase & Security

- Firebase project config is in `firebase.json` (project `luratha-96386`, region `us-east5`, emulators for Auth/Firestore/Storage).
- Client SDK init lives in `src/lib/firestore/firebaseClient.ts`; SSR server-side reads use `src/lib/firestore/firebaseSsrApp.ts`; admin/API seeding uses `src/lib/firestore/firebaseAdmin.ts`.
- Use `firebaseSsrApp.ts` only for SSR/App Router rendering flows (FirebaseServerApp + optional auth token bridging).
- Use `firebaseClient.ts` only in browser/client components (`"use client"` paths).
- Use `firebaseAdmin.ts` only in trusted server API/background environments where service account/ADC credentials are expected.
- Never import client Firebase modules into server-only flows (pages/layout metadata, server actions, route handlers that read Firestore).
- Keep emulator env wiring coherent when running local test stacks: `USE_EMULATOR=TRUE`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST`, `NEXT_PUBLIC_*_EMULATOR_HOST`.
- Keep `.env*` files out of commits (excluded in `.gcloudignore`).
- Preserve `.gcloudignore` exclusions so tests/config/artifacts stay out of Cloud Run build context.

## CI / Workflow Reality

Current workflow: `.github/workflows/copilot-setup-steps.yml`

- Triggers only on workflow dispatch and changes to that workflow file.
- Installs Node 22 deps (`npm ci`), Firebase CLI, and Playwright Chromium.
- Validates toolchain versions (`next`, `firebase`).
- It does **not** run lint, unit tests, E2E, or build for normal PR changes. Agents must validate locally.

## Common Pitfalls to Avoid

- Import domain components from the correct folder (for example, catalog grid/sort components are under `src/components/categoria/`).
- For dynamic product routes, separate "not found" vs "load failure": call `notFound()` for missing resources and throw/propagate real errors for 500 so segment `error.tsx` handles failures.
- Do not let PDP/server product reads silently fall back to local mock data; mock fallback is acceptable only for explicitly non-critical surfaces.
- `npm run test:e2e` alone is not enough for Firebase-dependent behavior because it excludes `e2e/with-emulator`; run emulator E2E suite when touching Firestore-dependent UX.
- Do not reintroduce `tailwind.config.js` (this repo uses Tailwind v4 PostCSS setup).
- Do not duplicate long skill content; reference the relevant skill:
  - Testing: `.github/skills/luratha-testing/SKILL.md`
  - SEO/AEO/GEO: `.github/skills/luratha-seo/SKILL.md`
  - Visual system: `.github/skills/visual-identity/SKILL.md`
  - CRUD API (Firestore, embeddings, DataConverters): `.github/skills/luratha-crud-api/SKILL.md`
