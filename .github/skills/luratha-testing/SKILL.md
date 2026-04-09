---
name: luratha-testing
description: Activate this skill whenever you need to write new tests, run the test suite, debug failing tests, or fix bugs in the Luratha frontend. Contains the complete testing conventions, patterns, mocks, and debugging workflows for Vitest unit tests and Playwright E2E tests.
compatibility: Node.js 22, Vitest 4, React Testing Library, Playwright, Next.js 16+ App Router
---

# Testing Guide – Luratha Frontend

## Test Stack

| Tool | Role |
|---|---|
| [Vitest](https://vitest.dev/) | Unit and integration test runner |
| [React Testing Library](https://testing-library.com/) | Component rendering and assertions |
| [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) | DOM matchers (`toBeInTheDocument`, `toHaveAttribute`, etc.) |
| [@testing-library/user-event](https://github.com/testing-library/user-event) | Simulating real user interactions |
| [Playwright](https://playwright.dev/) | End-to-End (E2E) browser tests (Chromium) |

---

## Running Tests

```bash
# Install dependencies first (always required)
npm ci

# Unit/integration tests (Vitest)
npm test                    # run once
npm run test:watch          # watch mode
npm run test:coverage       # with coverage report

# E2E tests (Playwright, Chromium only)
npm run test:e2e            # headless
npm run test:e2e:ui         # interactive UI

# Lint (must exit 0 with no errors before merging)
npm run lint
```

**Mandatory before finishing any task:**
```bash
npm run lint     # exit 0, no new errors
npm test         # all unit tests pass
npm run test:e2e # all E2E tests pass
```

---

## Directory Layout

```
src/
├── app/__tests__/          # Page-level unit tests (*.test.tsx)
├── components/__tests__/   # Component unit/integration tests (*.test.tsx)
└── lib/__tests__/          # Utility/constant unit tests (*.test.ts)
e2e/                        # Playwright E2E tests (*.spec.ts)
src/test/
└── setup.ts                # Vitest global setup — imports @testing-library/jest-dom
```

**Naming convention:**
- Unit/integration: `src/**/__tests__/*.test.ts(x)`
- E2E: `e2e/*.spec.ts`

---

## When to Write Which Test

| What you create | Required tests |
|---|---|
| New utility function / constant | Unit test in `src/lib/__tests__/` |
| New React component | Unit test in `src/components/__tests__/` |
| New page | Unit test in `src/app/__tests__/` **and** E2E test in `e2e/` |
| New navigation link or route | E2E navigation test in `e2e/navigation.spec.ts` |
| Form / interactive flow | Integration test (Vitest) + E2E test |

---

## Writing Unit/Integration Tests (Vitest + RTL)

### Minimal component test template

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MyComponent from "@/src/components/MyComponent";

// Always mock next/link in component tests
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/navigation when the component calls useRouter/usePathname
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock appData when you need controlled values
vi.mock("@/src/lib/constants", () => ({
  appData: { name: "Luratha", logo: "/luratha.svg" },
}));

describe("MyComponent", () => {
  it("renders expected content", () => {
    render(<MyComponent />);
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
  });
});
```

### Testing interactive components (useState, event handlers)

```tsx
import { fireEvent } from "@testing-library/react";

it("toggles state on button click", () => {
  render(<Header />);
  const btn = screen.getByRole("button", { name: "Abrir menu" });

  fireEvent.click(btn);
  expect(screen.getByRole("button", { name: "Fechar menu" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Fechar menu" }));
  expect(screen.getByRole("button", { name: "Abrir menu" })).toBeInTheDocument();
});
```

### Testing constants/utilities

```ts
import { describe, it, expect } from "vitest";
import { appData } from "@/src/lib/constants";

describe("appData", () => {
  it("has the correct app name", () => {
    expect(appData.name).toBe("Luratha");
  });
});
```

### Common RTL queries (in preference order)

```ts
screen.getByRole("button", { name: "Carrinho" })     // accessible role
screen.getByRole("link", { name: "Sobre" })
screen.getByRole("heading", { level: 1, name: "Home" })
screen.getByAltText("Luratha")                        // img alt text
screen.getByText(/copyright/i)                        // text content (regex)
screen.getAllByRole("link")                            // multiple matches
screen.queryByRole("dialog")                          // null when absent
```

### Common jest-dom matchers

```ts
expect(el).toBeInTheDocument();
expect(el).toBeVisible();
expect(el).toHaveAttribute("href", "/colecao");
expect(el).toHaveAttribute("src", "/luratha.svg");
expect(el).toHaveTextContent("Luratha");
expect(el).not.toBeInTheDocument();
```

---

## Writing E2E Tests (Playwright)

### Minimal E2E test template

```ts
import { test, expect } from "@playwright/test";

test.describe("My Feature", () => {
  test("loads and shows expected content", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
```

### Common Playwright patterns

```ts
// Navigate and check title
await page.goto("/sobre");
await expect(page).toHaveTitle(/Luratha/);

// Scoped locators (prefer over global selectors)
const header = page.locator("header");
await expect(header.getByRole("link", { name: "Coleção" })).toBeVisible();

const footer = page.locator("footer");
await expect(footer).toContainText("Todos os direitos reservados");

// Mobile viewport
await page.setViewportSize({ width: 375, height: 812 });

// Click and assert state change
await page.getByRole("button", { name: "Abrir menu" }).click();
await expect(page.getByRole("button", { name: "Fechar menu" })).toBeVisible();

// Wait for navigation
await page.getByRole("link", { name: "Coleção" }).click();
await expect(page).toHaveURL(/\/colecao/);
```

### Running a single E2E file or test

```bash
npx playwright test e2e/home.spec.ts
npx playwright test --grep "renders the footer"
npx playwright test --headed   # visible browser for debugging
```

---

## Debugging Failing Tests

### Vitest — common failure patterns

| Error | Cause | Fix |
|---|---|---|
| `Cannot find module 'next/link'` | Missing mock | Add `vi.mock("next/link", ...)` at top of file |
| `Cannot find module '@/src/...'` | Path alias missing | Ensure `vite-tsconfig-paths` plugin is in `vitest.config.mts` |
| `getByRole` throws | Element not rendered / wrong role/name | Use `screen.debug()` to inspect the DOM |
| `Not implemented: navigation` | jsdom warning, not an error | Expected in jsdom; ignore or suppress |
| Mock not applied | `vi.mock` called after import | Always place `vi.mock(...)` at the top, before imports |

### Playwright — common failure patterns

| Error | Cause | Fix |
|---|---|---|
| `Timeout waiting for element` | Element not rendered / wrong selector | Use `await page.pause()` (interactive) or `--headed` to debug |
| `ERR_CONNECTION_REFUSED` | Dev server not started | `playwright.config.ts` starts it via `webServer`; check the command |
| `Test failed on CI but not locally` | `retries: 2` in CI — check if flaky | Add `await page.waitForLoadState("networkidle")` before assertions |
| Wrong text assertion | Text includes hidden characters or has different casing | Use regex: `expect(el).toContainText(/todos os direitos/i)` |

### Debugging Playwright interactively

```bash
# Pause test execution and open the Playwright inspector
npx playwright test --headed --debug

# Record new test interactions
npx playwright codegen http://localhost:3000
```

---

## Path Aliases

`tsconfig.json` defines `"@/*": ["./*"]` relative to the repo root:

```ts
// Correct import in tests
import Header from "@/src/components/Header";
import { appData } from "@/src/lib/constants";
import Home from "@/src/app/page";
```

---

## Coverage

```bash
npm run test:coverage
# HTML report: coverage/index.html
# JSON report: coverage/coverage-final.json
```

Coverage is collected via `v8` provider. Excluded from coverage: `node_modules`, `.next`, `src/test`, config files, `src/app/layout.tsx`.

---

## Test Isolation Rules

- **Unit tests:** never hit the network, never start a server. All Next.js router modules must be mocked.
- **E2E tests:** always start with `await page.goto("/...")`. Never share state between tests in a `describe` block.
- **No `beforeAll` with side effects** — prefer `beforeEach` to reset mocks: `vi.clearAllMocks()`.

---

## Existing Test Files (Reference)

| File | What it tests |
|---|---|
| `src/components/__tests__/Header.test.tsx` | Logo, nav links, cart button, hamburger toggle, mobile menu close-on-link |
| `src/components/__tests__/Footer.test.tsx` | Logo, nav links, copyright text and year |
| `src/lib/__tests__/constants.test.ts` | `appData.name`, `appData.logo` |
| `src/app/__tests__/page.test.tsx` | Home page `<h1>` heading |
| `e2e/home.spec.ts` | Home loads, title, header logo, footer copyright |
| `e2e/navigation.spec.ts` | Header nav links, cart button, hamburger on mobile, footer links |

---

> **Agent instruction:** Always activate this skill when asked to add tests, run tests, or fix a failing test. Follow all patterns documented above. Never introduce new test dependencies unless strictly necessary. Run `npm run lint && npm test && npm run test:e2e` before marking a task complete.
