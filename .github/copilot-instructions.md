# Copilot Instructions for luratha_frontend

Trust these instructions. Only search the codebase if you need information not covered here.

## What This Repository Is

Luratha is a Next.js 16.2.2 web application frontend (React 19, TypeScript) integrated with Firebase (Firestore, Firebase Auth, Cloud Storage). It is deployed via Firebase App Hosting (Cloud Run). The UI uses Tailwind CSS v4. The codebase is small (~7 source files).

## Runtime & Toolchain

- **Node.js**: 22 (required; see `copilot-setup-steps.yml`)
- **npm**: 10 (use `npm ci`, never `npm install` in CI)
- **Next.js**: 16.2.2 with Turbopack
- **TypeScript**: 5, strict mode
- **Tailwind CSS**: 4 (PostCSS plugin: `@tailwindcss/postcss`)
- **Firebase SDK**: 12 (client-side)
- **Firebase CLI**: latest (installed globally via `npm install -g firebase-tools@latest`)

## Installing Dependencies

```bash
npm ci
```

Always run `npm ci` before building, linting, or running the app. Dependencies are in `node_modules/`; never commit them.

## Scripts (from `package.json`)

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server on http://localhost:3000 |
| `npm run build` | Production build (Turbopack) |
| `npm run start` | Start production server (requires prior build) |
| `npm run lint` | ESLint with Next.js rules |
| `npm test` | Run unit/integration tests once (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:coverage` | Run unit tests with coverage report |
| `npm run test:e2e` | Run E2E tests headless (Playwright) |
| `npm run test:e2e:ui` | Run E2E tests with interactive UI |

## Lint

```bash
npm run lint
```

- Uses ESLint 9 flat config (`eslint.config.mjs`) with `eslint-config-next` (core-web-vitals + TypeScript rules).
- Currently emits 3 **warnings** (unused `Image` import in `page.tsx`, `<img>` in Header/Footer) — no errors. Warnings do not fail the process (exit 0).
- Errors (exit non-zero) will fail CI. Do not introduce new ESLint errors.

## Build

```bash
npm run build
```

- Build output goes to `.next/` (gitignored).

## Test Suite

The project uses **Vitest** for unit/integration tests and **Playwright** for E2E tests. Full documentation is in `docs/testing.md`.

### Running tests — mandatory checklist

**Always run these commands before finishing any task:**

```bash
npm run lint       # must exit 0 with no new errors
npm test           # must pass — all Vitest unit/integration tests
npm run test:e2e   # must pass — all Playwright E2E tests
```

E2E tests (`npm run test:e2e`) can and **must** be run in the Copilot agent environment — Chromium is installed by `copilot-setup-steps.yml` via `playwright install --with-deps chromium`. Run them whenever changes affect routing, navigation, or full-page rendering.

### Test file locations

```
src/
├── app/__tests__/          # Page-level unit tests
├── components/__tests__/   # Component unit/integration tests
└── lib/__tests__/          # Utility/constant unit tests
e2e/                        # Playwright E2E tests
```

**Convention:** unit/integration files are `*.test.ts(x)` inside `__tests__/`; E2E files are `*.spec.ts` in `e2e/`.

### Writing tests for new code

When creating any new element, always add the corresponding tests:

| What you create | Tests required |
|---|---|
| New utility function / constant | Unit test in `src/lib/__tests__/` |
| New React component | Unit test in `src/components/__tests__/` (render, props, interactions) |
| New page | Unit test (`src/app/__tests__/`) + E2E test (`e2e/`) |
| New navigation link or route | E2E navigation test |
| Form or interactive flow | Integration test (Vitest) + E2E test |

### Mocking Next.js in Vitest

```ts
// next/link — always mock in component unit tests
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// next/navigation — mock when a component calls useRouter/usePathname
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
```

### Firebase App Hosting & test exclusion

Test files, config files, and output artifacts are excluded from Cloud Run deployments via `.gcloudignore`. Never remove those exclusions.

## Repository Layout

```
luratha_frontend/
├── .github/
│   └── workflows/
│       └── copilot-setup-steps.yml   # CI: installs deps + Firebase CLI
├── docs/
│   └── testing.md                    # Test suite documentation
├── e2e/
│   ├── home.spec.ts                  # E2E: home page tests
│   └── navigation.spec.ts            # E2E: header/footer navigation tests
├── src/
│   ├── app/
│   │   ├── __tests__/
│   │   │   └── page.test.tsx         # Unit test: Home page
│   │   ├── layout.tsx                # Root layout (Header + Footer, Google fonts)
│   │   ├── page.tsx                  # Home page
│   │   ├── globals.css               # Global styles (Tailwind CSS entry)
│   │   └── favicon.ico
│   ├── components/
│   │   ├── __tests__/
│   │   │   ├── Header.test.tsx       # Unit tests: Header component
│   │   │   └── Footer.test.tsx       # Unit tests: Footer component
│   │   ├── Header.tsx                # Site header with logo
│   │   └── Footer.tsx                # Site footer with copyright
│   ├── lib/
│   │   ├── __tests__/
│   │   │   └── constants.test.ts     # Unit tests: app constants
│   │   └── constants.ts              # App-wide constants (name, logo path)
│   └── test/
│       └── setup.ts                  # Vitest global setup (jest-dom matchers)
├── public/                           # Static assets
├── next.config.ts                    # Next.js config
├── tsconfig.json                     # TypeScript config
├── vitest.config.mts                 # Vitest configuration
├── playwright.config.ts              # Playwright configuration
├── eslint.config.mjs                 # ESLint flat config
├── postcss.config.mjs                # Tailwind PostCSS config
├── .gcloudignore                     # Excludes test files from Cloud Run builds
├── firebase.json                     # Firebase project config (Firestore, Storage, emulators)
├── firestore.rules                   # Firestore security rules
├── storage.rules                     # Cloud Storage security rules
├── firestore.indexes.json            # Firestore index definitions
├── apphosting.yaml                   # Firebase App Hosting (Cloud Run) config
├── .firebaserc                       # Firebase project alias (luratha-96386)
├── package.json
└── package-lock.json
```

## Path Aliases

`tsconfig.json` defines `"@/*": ["./*"]` (relative to repo root). Therefore:
- `@/src/components/Header` → `src/components/Header.tsx`
- `@/src/lib/constants` → `src/lib/constants.ts`

Always use the `@/src/...` prefix for imports within `src/`.

## Key Architectural Facts

- **App Router** (Next.js App Directory under `src/app/`). Use Server Components by default; add `"use client"` only when needed (hooks, browser APIs, event handlers).
- `Header.tsx` and `Footer.tsx` are already marked `"use client"`.
- Global app constants (app name, logo path) live in `src/lib/constants.ts` as `appData`.
- Firebase is configured for project `luratha-96386` (region: `us-east5`). The emulator suite runs Auth (9099), Firestore (8080), Storage (9199) with emulator UI enabled.
- No Firebase config initialization file exists yet in `src/lib/` — if adding Firebase client SDK usage, create `src/lib/firebase.ts`.
- Tailwind CSS v4 uses the PostCSS plugin approach; do **not** use `tailwind.config.js` (v3 pattern).

## CI Workflow

File: `.github/workflows/copilot-setup-steps.yml`

Steps (runs on push/PR to that file, or manually):
1. Checkout code
2. Setup Node.js 22 (with npm cache)
3. `npm ci`
4. `npm install -g firebase-tools@latest`
5. Validate: `npx next --version` and `firebase --version`

The workflow does **not** run build or lint. There is no separate CI workflow that blocks merging.

## Next.js Version Note

This project uses **Next.js 16.2.2** — a newer version that may differ from training data. Before writing Next.js-specific code, consult `node_modules/next/dist/docs/` for current APIs. Key changes from older versions:
- Turbopack is the default bundler for both dev and build.
- App Router is the standard pattern (`src/app/`).
- Font optimization via `next/font/google` is used in `layout.tsx`.
