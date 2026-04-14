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
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Vitest with coverage |
| `npm run test:e2e` | Playwright E2E (headless) |
| `npm run test:e2e:ui` | Playwright UI mode |
| `npm run setup:routes` | Run `docs/create-catalog-routes.mjs` scaffolding |

## Architecture Map (where to change code)

- `src/app/`: routes, layouts, loading/error UI, metadata, sitemap/robots, page-level tests.
- `src/components/`: shared UI plus domain folders (`categoria/`, `produto/`), each with `.module.css`.
- `src/contexts/`: client state providers (`AuthContext`, `CartContext`).
- `src/lib/`: constants, SEO constants, Firebase init, query helpers, mock data, utilities.
- `src/services/`: app service layer (e.g., Firestore/product services).
- `src/schemas/`: validation and domain schemas.
- `src/test/`: Vitest setup.
- `e2e/`: Playwright specs.
- `public/llms.txt`: GEO/LLM discoverability file.

## Core Engineering Conventions

- Use `@/src/...` imports (alias from `tsconfig.json`).
- Prefer Server Components; add `"use client"` only when required (hooks/events/browser APIs).
- Keep changes small and composable; reuse existing components/utilities before creating new ones.
- Styling: use CSS Modules for component styles; use design tokens from `src/app/globals.css` (`var(--color-*)`, `var(--font-*)`).
- Accessibility is required: semantic landmarks, one `<h1>` per page, keyboard-accessible interactions, visible focus states, descriptive labels and `alt`.
- Performance: avoid unnecessary client components and redundant data work in render paths.

## Testing Expectations

- Vitest config: `vitest.config.mts` (`jsdom`, globals, setup in `src/test/setup.ts`).
- Playwright config: `playwright.config.ts` (auto `npm run dev`, Chromium project).
- Test naming: `src/**/__tests__/*.test.ts(x)` and `e2e/*.spec.ts`.
- Do not remove/skip existing tests to make CI pass.
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
- `src/lib/firebase.ts` reads `NEXT_PUBLIC_FIREBASE_*`; never hardcode keys or secrets.
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
- Do not reintroduce `tailwind.config.js` (this repo uses Tailwind v4 PostCSS setup).
- Do not duplicate long skill content; reference the relevant skill:
  - Testing: `.github/skills/luratha-testing/SKILL.md`
  - SEO/AEO/GEO: `.github/skills/luratha-seo/SKILL.md`
  - Visual system: `.github/skills/visual-identity/SKILL.md`
