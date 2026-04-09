---
name: testing
description: Activate this skill whenever the user asks to write new tests, run tests, debug failing tests, or fix bugs in the Luratha frontend. This skill contains the complete testing strategy, patterns, templates, and troubleshooting guide for the Luratha Next.js project.
compatibility: Vitest 4, Playwright 1.59+, React Testing Library 16, Next.js 16.2+ with jsdom environment.
---

# Testing Guide – Luratha Frontend

## Overview

The Luratha frontend uses a two-layer test strategy:

| Layer | Tool | Command | Config |
|---|---|---|---|
| Unit / Integration | Vitest 4 + React Testing Library | `npm test` | `vitest.config.mts` |
| End-to-End (E2E) | Playwright 1.59 | `npm run test:e2e` | `playwright.config.ts` |

**Mandatory checklist before finishing any task:**

```bash
npm run lint       # must exit 0 (0 errors; 3 pre-existing warnings are OK)
npm test           # must pass — all Vitest unit/integration tests
npm run test:e2e   # must pass — all Playwright E2E tests
```

---

## File Layout

```
luratha_frontend/
├── src/
│   ├── app/__tests__/page.test.tsx           # Home page unit test
│   ├── components/__tests__/Header.test.tsx  # Header unit + interaction tests
│   ├── components/__tests__/Footer.test.tsx  # Footer unit tests
│   ├── lib/__tests__/constants.test.ts       # App constants unit tests
│   └── test/setup.ts                         # Global setup: imports @testing-library/jest-dom
├── e2e/
│   ├── home.spec.ts                          # E2E: home page renders & loads
│   └── navigation.spec.ts                   # E2E: header/footer nav, mobile menu
├── vitest.config.mts
└── playwright.config.ts
```

**Naming convention:**
- Unit/integration: `*.test.ts` or `*.test.tsx` inside `src/**/__tests__/`
- E2E: `*.spec.ts` inside `e2e/`

---

## Running Tests

```bash
# Run all unit/integration tests
npm test

# Run in watch mode (auto-reruns on file change)
npm run test:watch

# Run with coverage report (output: coverage/index.html)
npm run test:coverage

# Run all E2E tests headless
npm run test:e2e

# Run E2E with interactive UI
npm run test:e2e:ui

# Run a single E2E file
npx playwright test e2e/home.spec.ts

# Run E2E in headed mode (see the browser)
npx playwright test --headed
```

Playwright auto-starts `npm run dev` on port 3000 when running E2E tests.

---

## When to Write Which Test

| What you create | Required tests |
|---|---|
| New constant / utility | Unit test in `src/lib/__tests__/` |
| New React component | Unit test in `src/components/__tests__/` |
| Component with state / events | Interaction tests using `fireEvent` or `userEvent` |
| New page / route | Unit test (`src/app/__tests__/`) + E2E test (`e2e/`) |
| Navigation link | E2E navigation test |
| Form or interactive flow | Integration test (Vitest) + E2E test |
| Authentication flow | E2E test |

---

## Unit Test Templates

### Constants / utilities

```ts
import { describe, it, expect } from "vitest";
import { appData } from "@/src/lib/constants";

describe("appData constants", () => {
  it("has the correct app name", () => {
    expect(appData.name).toBe("Luratha");
  });
});
```

### React component (render only)

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MyComponent from "@/src/components/MyComponent";

// Always mock next/link in unit tests — no router context available
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <a href={href} {...props}>{children}</a>,
}));

// Mock app constants when the component imports them
vi.mock("@/src/lib/constants", () => ({
  appData: { name: "Luratha", logo: "/luratha.svg" },
}));

describe("MyComponent", () => {
  it("renders the heading", () => {
    render(<MyComponent />);
    expect(screen.getByRole("heading", { name: "My Title" })).toBeInTheDocument();
  });
});
```

### React component with interactions

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MyComponent from "@/src/components/MyComponent";

// For realistic events use userEvent (async):
// import userEvent from "@testing-library/user-event";

describe("MyComponent interactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens a panel when button is clicked", () => {
    render(<MyComponent />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
```

### Mocking `next/navigation`

Only required when the component calls `useRouter`, `usePathname`, or `useSearchParams`:

```ts
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
```

---

## E2E Test Template

```ts
import { test, expect } from "@playwright/test";

test.describe("My Feature", () => {
  test("page loads with correct heading", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  });

  test("mobile hamburger opens menu", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.getByRole("button", { name: "Fechar menu" })).toBeVisible();
  });
});
```

The `baseURL` is `http://localhost:3000` — use relative paths: `page.goto("/colecao")`.

---

## Debugging Failing Tests

### Vitest failures

1. **Component not found (`Unable to find role`)**: check `aria-label` and roles in the actual component. Use `screen.debug()` to print the DOM:
   ```ts
   render(<MyComponent />);
   screen.debug(); // prints full DOM to console
   ```

2. **Missing mock for `next/link` or `next/navigation`**: all components using `Link` or router hooks need mocks (see templates above).

3. **Module alias not resolving (`@/src/...`)**: the alias is set in `tsconfig.json` (`"@/*": ["./*"]`). Always import as `@/src/components/...`, `@/src/lib/...`.

4. **`Not implemented: navigation to another Document`**: this is a harmless jsdom warning from `<a>` clicks; ignore it.

5. **Test file not picked up**: ensure it is under `src/` in a `__tests__/` folder and named `*.test.ts(x)`.

### Playwright / E2E failures

1. **Dev server not starting**: check port 3000 is free. The config auto-starts `npm run dev` and waits 120 seconds.

2. **Element not visible / timing out**: add explicit waits:
   ```ts
   await expect(page.locator("header")).toBeVisible({ timeout: 5000 });
   ```

3. **Screenshots on failure**: Playwright saves traces in `test-results/` on first retry. Run `npx playwright show-report` to inspect.

4. **Chromium not installed**: run `npx playwright install --with-deps chromium` first (required on fresh CI environments).

5. **Flaky mobile tests**: always set viewport before `page.goto()`:
   ```ts
   await page.setViewportSize({ width: 375, height: 812 });
   await page.goto("/");
   ```

---

## Key Project Conventions

- **Path alias:** always use `@/src/...` for imports inside `src/`.
- **"use client" components:** `Header.tsx` and `Footer.tsx` are client components; test them the same way as any React component.
- **App constants:** `appData` in `src/lib/constants.ts` exports `name` and `logo`. Mock it in component unit tests.
- **No global test state:** each test file is independent. Use `beforeEach(() => vi.clearAllMocks())` when using shared mocks.
- **Coverage output:** `coverage/` directory (gitignored). Run `npm run test:coverage` and open `coverage/index.html`.
- **Playwright reports:** `playwright-report/` (gitignored). Run `npx playwright show-report` to view.

---

## CI Notes

Test files are excluded from Firebase App Hosting (Cloud Run) deployments via `.gcloudignore` — the following paths are excluded: `e2e/`, `src/**/__tests__/`, `src/test/`, `vitest.config.mts`, `playwright.config.ts`, `coverage/`, `playwright-report/`, `test-results/`.

To add tests to CI (`.github/workflows/copilot-setup-steps.yml`), add after `npm ci`:

```yaml
- name: Run unit tests
  run: npm test

- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npm run test:e2e
```

---

> **Agent instruction:** Always follow the templates and mocking patterns documented here. Never skip `vi.mock("next/link", ...)` in component unit tests. Run `npm test` and `npm run test:e2e` before marking any task as complete.
