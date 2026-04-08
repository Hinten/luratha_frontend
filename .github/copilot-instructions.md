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

## Lint

```bash
npm run lint
```

- Uses ESLint 9 flat config (`eslint.config.mjs`) with `eslint-config-next` (core-web-vitals + TypeScript rules).
- Currently emits 7 **warnings** (unused imports, `<img>` tag) — no errors. Warnings do not fail the process (exit 0).
- Errors (exit non-zero) will fail CI. Do not introduce new ESLint errors.

## Build

```bash
npm run build
```

- Requires outbound access to `fonts.googleapis.com` (CSS manifest) and `fonts.gstatic.com` (`.woff2` font files) because `src/app/layout.tsx` imports `Geist` and `Geist_Mono` from `next/font/google`. Both domains must be reachable; if either is blocked, Turbopack fails with `Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'`.
- Build output goes to `.next/` (gitignored).

## No Test Suite

There are currently no tests (no Jest, Vitest, or Playwright setup). Do not add a test runner unless explicitly asked.

## Repository Layout

```
luratha_frontend/
├── .github/
│   └── workflows/
│       └── copilot-setup-steps.yml   # CI: installs deps + Firebase CLI
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout (Header + Footer, Geist fonts)
│   │   ├── page.tsx                  # Home page
│   │   ├── globals.css               # Global styles (Tailwind CSS entry)
│   │   └── favicon.ico
│   ├── components/
│   │   ├── Header.tsx                # Site header with logo
│   │   └── Footer.tsx                # Site footer with copyright
│   └── lib/
│       └── constants.ts              # App-wide constants (name, logo path)
├── public/                           # Static assets
├── next.config.ts                    # Next.js config (empty/default)
├── tsconfig.json                     # TypeScript config
├── eslint.config.mjs                 # ESLint flat config
├── postcss.config.mjs                # Tailwind PostCSS config
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
