---
name: luratha-debugging
description: Use this skill when debugging failures, fixing linting errors, investigating test failures, understanding component behavior, or tracing issues in the Luratha frontend project. Covers project architecture, key files, common error patterns, and step-by-step debugging workflows.
compatibility: Node.js 22, Next.js 16.2.2 App Router, TypeScript 5 strict, Tailwind CSS v4, React 19, Vitest 4, Playwright.
---

# Luratha Debugging Skill

## Project Architecture at a Glance

```
src/
├── app/
│   ├── layout.tsx        # Root layout — wraps ALL pages with <Header> + <Footer>
│   ├── page.tsx          # Home page (/)
│   └── globals.css       # Tailwind CSS v4 entry + design tokens (@theme block)
├── components/
│   ├── Header.tsx        # "use client" — sticky nav with mobile hamburger menu
│   ├── Footer.tsx        # "use client" — copyright + nav links
│   └── Logo.tsx          # "use client" — <img> logo wrapped in Next.js Link
└── lib/
    └── constants.ts      # appData = { name: "Luratha", logo: "/luratha.svg" }
```

**Key facts:**
- App Router (Next.js). Server Components by default; add `"use client"` only when using hooks, browser APIs, or event handlers.
- `Header.tsx`, `Footer.tsx`, and `Logo.tsx` are all `"use client"`.
- `appData` from `@/src/lib/constants` is the single source of truth for app name and logo path.
- Design tokens live in `globals.css` `@theme` block — always use `var(--color-*)` in components.
- Path alias: `@/*` resolves to the repo root (`./`), so `@/src/...` is the correct prefix.

---

## Debugging Workflow

### 1. Lint first

```bash
npm run lint
```

- 0 errors is the required baseline. Pre-existing warnings (3) are acceptable.
- If you see new errors, fix them before running tests.

### 2. Run unit tests

```bash
npm test
```

- All 16 tests should pass across 4 test files.
- Read the full error output — Vitest gives clear stack traces.

### 3. Run E2E tests

```bash
npm run test:e2e
```

- All 7 Playwright tests should pass.
- If a test fails, check if the dev server started correctly (port 3000).

### 4. Build check (optional but definitive)

```bash
npm run build
```

- TypeScript errors will surface here if not caught by lint.
- Build output goes to `.next/` (gitignored).

---

## Common Error Patterns

### `Cannot find module '@/src/...'`

**Cause:** Wrong path alias or file doesn't exist.

**Fix:** `tsconfig.json` maps `@/*` → `./` (repo root). So the correct import is:
```ts
import { appData } from "@/src/lib/constants";      // ✓
import { appData } from "../lib/constants";          // ✗ (avoid relative paths)
```

---

### `next/link` or `next/navigation` errors in Vitest

**Cause:** These Next.js modules don't work in jsdom without mocking.

**Fix:** Always add at the top of component test files:
```ts
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
```

---

### `Unable to find role="..."` in tests

**Cause:** The element doesn't exist or has a different accessible name.

**Fix:** Use `screen.debug()` to print the DOM:
```ts
render(<Header />);
screen.debug(); // prints full DOM to stdout
```

Or check the actual ARIA role of the element. Common roles:
- `heading` (h1–h6)
- `button`
- `link` (anchor tags)
- `img` (images with alt text)
- `navigation` (nav element)

---

### E2E test timeout / server not starting

**Cause:** `npm run dev` didn't start within 120 seconds (the configured timeout).

**Fix:** Kill any process on port 3000 and retry:
```bash
fuser -k 3000/tcp 2>/dev/null || true
npm run test:e2e
```

---

### TypeScript strict mode errors

**Cause:** Missing types, implicit `any`, etc.

**Common fixes:**
```ts
// Explicit type for rest props
({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown })

// Explicit return type
function MyComponent(): React.JSX.Element { ... }
```

---

### Tailwind CSS v4 classes not applying

**Cause:** Using Tailwind v3 config patterns or `tailwind.config.js`.

**Fix:** Tailwind v4 uses PostCSS plugin only. Design tokens are in `globals.css`:
```css
@theme {
  --color-primary: #E8B9C9;
}
```
Use them in components as `var(--color-primary)` or Tailwind utility `text-[var(--color-primary)]`.

---

## ESLint Warnings (Pre-existing — Do Not Fix Unless Related)

These 3 warnings exist in the baseline and are acceptable:

| File | Warning |
|---|---|
| `src/app/page.tsx:1` | `'Image' is defined but never used` |
| `src/components/Header.tsx:4` | `'appData' is defined but never used` (it's used via Logo) |
| `src/components/Logo.tsx:8` | `no-img-element` (using `<img>` instead of `<Image />`) |

**Do not introduce new ESLint errors.** New warnings are acceptable but should be avoided.

---

## Key Component Behaviors

### Header (`src/components/Header.tsx`)

- Sticky top bar with logo, desktop nav links, cart icon button, hamburger button.
- Mobile hamburger: `aria-label="Abrir menu"` when closed, `"Fechar menu"` when open.
- Mobile overlay: shown when `menuOpen === true`, hidden otherwise.
- Nav links: Coleção (`/colecao`), Sobre (`/sobre`), Contato (`/contato`).

### Footer (`src/components/Footer.tsx`)

- Logo centered at top, nav links, divider, copyright line.
- Nav links: Coleção, Sobre, Contato, Privacidade (`/politica-de-privacidade`).
- Copyright: `© {year} Luratha. Todos os direitos reservados.`

### Logo (`src/components/Logo.tsx`)

- Renders `<Link href="/"><img src={appData.logo} alt={appData.name} /></Link>`
- Tests should use `getByAltText("Luratha")` and check `src="/luratha.svg"`.

---

## Test File ↔ Source File Mapping

| Source | Test |
|---|---|
| `src/components/Header.tsx` | `src/components/__tests__/Header.test.tsx` |
| `src/components/Footer.tsx` | `src/components/__tests__/Footer.test.tsx` |
| `src/components/Logo.tsx` | *(no dedicated test — covered via Header/Footer tests)* |
| `src/lib/constants.ts` | `src/lib/__tests__/constants.test.ts` |
| `src/app/page.tsx` | `src/app/__tests__/page.test.tsx` |
| All pages | `e2e/home.spec.ts`, `e2e/navigation.spec.ts` |

---

## Useful Commands Reference

```bash
# Install dependencies
npm ci

# Lint (0 errors required)
npm run lint

# Unit tests (all 16 must pass)
npm test

# Unit tests with coverage
npm run test:coverage

# E2E tests headless (all 7 must pass)
npm run test:e2e

# E2E tests interactive
npm run test:e2e:ui

# Production build
npm run build

# Dev server
npm run dev
```
