---
name: luratha-testing
description: Activate this skill whenever the user asks to write tests, run tests, debug failing tests, add test coverage, fix test errors, or understand the Luratha test suite. Contains the complete testing setup for Luratha frontend — Vitest (unit/integration) + Playwright (E2E) — including patterns, mocks, conventions, and commands.
compatibility: Node.js 22, Vitest 4, Playwright, React Testing Library, Next.js 16 App Router, TypeScript strict mode.
---

# Testing Guide — Luratha Frontend

## Test Stack

| Tool                            | Role                                                           |
| ------------------------------- | -------------------------------------------------------------- |
| **Vitest 4**                    | Unit and integration test runner                               |
| **React Testing Library**       | Component rendering and DOM assertions                         |
| **@testing-library/jest-dom**   | Custom matchers (`toBeInTheDocument`, `toHaveAttribute`, etc.) |
| **@testing-library/user-event** | Realistic user interaction simulation                          |
| **Playwright**                  | End-to-End (E2E) browser tests (Chromium)                      |

---

## Commands

```bash
# Always install dependencies first
npm ci

# Lint (must exit 0 with no errors)
npm run lint

# Unit/integration tests — run once
npm test

# Firebase emulator integration suite (Firestore/Auth/Storage)
npm run test:firestore

# Unit/integration tests — watch mode (dev)
npm run test:watch

# Unit/integration tests — with coverage report
npm run test:coverage

# E2E tests (headless Chromium — auto-starts dev server)
npm run test:e2e

# E2E tests — interactive UI mode
npm run test:e2e:ui

# E2E tests — specific file
npx playwright test e2e/home.spec.ts

# E2E tests — visible browser
npx playwright test --headed
```

> **CI note:** On a fresh environment, Playwright browsers must be installed first:
>
> ```bash
> npx playwright install --with-deps chromium
> ```

---

## Directory Structure

```
luratha_frontend/
├── src/
│   ├── app/
│   │   └── __tests__/
│   │       └── page.test.tsx           # Unit test: Home page
│   ├── components/
│   │   └── __tests__/
│   │       ├── Header.test.tsx         # Unit tests: Header component
│   │       └── Footer.test.tsx         # Unit tests: Footer component
│   ├── lib/
│   │   └── __tests__/
│   │       └── constants.test.ts       # Unit tests: app constants
│   └── test/
│       └── setup.ts                    # Global test setup (jest-dom matchers)
├── e2e/
│   ├── home.spec.ts                    # E2E: Home page
│   └── navigation.spec.ts             # E2E: header + footer navigation
├── vitest.config.mts                   # Vitest config (jsdom, globals, coverage)
└── playwright.config.ts               # Playwright config (base URL, webServer)
```

### File naming conventions

| Location            | Pattern                     | Purpose            |
| ------------------- | --------------------------- | ------------------ |
| `src/**/__tests__/` | `*.test.ts` or `*.test.tsx` | Unit / integration |
| `e2e/`              | `*.spec.ts`                 | E2E browser tests  |

---

## What to Test — Decision Table

| What you create                         | Tests required                                                         |
| --------------------------------------- | ---------------------------------------------------------------------- |
| New utility function / constant         | Unit test in `src/lib/__tests__/`                                      |
| New React component                     | Unit test in `src/components/__tests__/` (render, props, interactions) |
| New page                                | Unit test in `src/app/__tests__/` + E2E test in `e2e/`                 |
| New route / navigation link             | E2E navigation test                                                    |
| Form or interactive flow                | Integration test (Vitest) + E2E test (Playwright)                      |
| Authentication flow                     | E2E test                                                               |
| Firebase utility/hook                   | Unit test with Firebase emulator mocks                                 |
| Schema or Firebase request flow changes | `npm run test:firestore` is mandatory and must pass                    |

---

## Unit / Integration Test Templates

### Component test (Vitest + React Testing Library)

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MyComponent from "@/src/components/MyComponent";

// Always mock next/link in component tests (no router context in Vitest)
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock next/navigation when a component uses useRouter / usePathname
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock app constants when needed
vi.mock("@/src/lib/constants", () => ({
  appData: { name: "Luratha", logo: "/luratha.svg" },
}));

describe("MyComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly", () => {
    render(<MyComponent />);
    expect(screen.getByText("Expected text")).toBeInTheDocument();
  });

  it("responds to user interaction", async () => {
    render(<MyComponent />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText("Success")).toBeInTheDocument();
  });
});
```

### Utility / constant test

```ts
import { describe, it, expect } from "vitest";
import { appData } from "@/src/lib/constants";

describe("appData", () => {
  it("has the correct app name", () => {
    expect(appData.name).toBe("Luratha");
  });
});
```

---

## E2E Test Templates

### Page test (Playwright)

```ts
import { test, expect } from "@playwright/test";

test.describe("My Page", () => {
  test("loads and shows the heading", async ({ page }) => {
    await page.goto("/my-page");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("renders header and footer", async ({ page }) => {
    await page.goto("/my-page");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
  });
});
```

### Navigation test (Playwright)

```ts
import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("navigates to the catalog page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Coleção" }).click();
    await expect(page).toHaveURL(/\/colecao/);
  });
});
```

### Mobile / responsive test (Playwright)

```ts
test("mobile hamburger menu", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const hamburger = page.getByRole("button", { name: "Abrir menu" });
  await expect(hamburger).toBeVisible();
  await hamburger.click();
  await expect(page.getByRole("button", { name: "Fechar menu" })).toBeVisible();
});
```

---

## Mocking Patterns

### next/link (always mock in unit tests)

```ts
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
```

### next/navigation (mock when component uses hooks)

```ts
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
```

### Firebase (mock for unit tests — do NOT use real Firebase in Vitest)

```ts
vi.mock("@/src/lib/firebase", () => ({
  db: {},
  auth: { currentUser: null },
  storage: {},
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
}));
```

---

## Coverage

Run `npm run test:coverage` to generate a coverage report in `coverage/`. Open `coverage/index.html` in a browser to view it.

Coverage is collected for all `src/` files except:

- `node_modules`, `.next`, `src/test`, `**/*.config.*`, `src/app/layout.tsx`

---

## Vitest Configuration

Key settings in `vitest.config.mts`:

- `environment: "jsdom"` — simulates the browser DOM
- `globals: true` — `describe`, `it`, `expect` available without imports
- `setupFiles: ["./src/test/setup.ts"]` — loads jest-dom matchers
- `include: ["src/**/*.{test,spec}.{ts,tsx}"]`

Path alias `@/` → repo root (via `vite-tsconfig-paths`). Use `@/src/components/...` for imports.

## Playwright Configuration

Key settings in `playwright.config.ts`:

- `baseURL: "http://localhost:3000"` — use relative paths in `page.goto()`
- `webServer` — auto-starts `npm run dev` before tests
- `retries: 2` on CI, `0` locally
- `workers: 1` on CI (set `CI=true` env var)
- Only Chromium is configured

---

## Baseline: Current Test Suite (all passing)

### Vitest (16 tests across 4 files)

| File                | Tests                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `Header.test.tsx`   | Logo renders, logo link, desktop nav links, cart button, hamburger toggle, mobile menu close |
| `Footer.test.tsx`   | Logo renders, logo link, nav links, copyright name, copyright year                           |
| `constants.test.ts` | appData has name, logo, and correct types                                                    |
| `page.test.tsx`     | Home page renders a heading                                                                  |

### Playwright (7 tests across 2 files)

| File                 | Tests                                                           |
| -------------------- | --------------------------------------------------------------- |
| `home.spec.ts`       | Page loads with title, header with logo, footer with copyright  |
| `navigation.spec.ts` | Header nav links, cart button, hamburger menu, footer nav links |

---

## Pre-flight Checklist Before Finishing Any Task

```bash
npm run lint       # must exit 0 with no new errors
npm test           # all Vitest tests must pass
npm run test:e2e   # all Playwright tests must pass
```

When the task changes schema definitions or Firebase request flows (Firestore/Auth/Storage), also run:

```bash
npm run test:firestore  # emulator integration suites must pass
```

> **Agent rule:** Never remove or skip existing tests. Always add tests for new code. Always run the required commands above before considering a task complete, including `npm run test:firestore` whenever schema or Firebase request flows are changed.
