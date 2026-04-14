# Testing Guide – Luratha Frontend

This document describes the test suite for the Luratha frontend, how to run the tests, and how to write new ones.

---

## Test Stack

| Tool | Role |
|---|---|
| [Vitest](https://vitest.dev/) | Unit and integration test runner |
| [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) | Component rendering and assertions |
| [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) | Custom DOM matchers (`toBeInTheDocument`, etc.) |
| [@testing-library/user-event](https://github.com/testing-library/user-event) | Simulating real user interactions |
| [Playwright](https://playwright.dev/) | End-to-End (E2E) browser tests |

---

## Directory Structure

```
luratha_frontend/
├── src/
│   ├── app/
│   │   └── __tests__/
│   │       └── page.test.tsx           # Unit test for the Home page
│   ├── components/
│   │   └── __tests__/
│   │       ├── Header.test.tsx         # Unit tests for the Header component
│   │       └── Footer.test.tsx         # Unit tests for the Footer component
│   ├── lib/
│   │   └── __tests__/
│   │       └── constants.test.ts       # Unit tests for app constants
│   └── test/
│       └── setup.ts                    # Global test setup (jest-dom matchers)
├── e2e/
│   ├── home.spec.ts                    # E2E tests for the Home page
│   └── navigation.spec.ts              # E2E tests for site navigation
├── vitest.config.mts                   # Vitest configuration
└── playwright.config.ts                # Playwright configuration
```

---

## Running Tests

### Unit & Integration Tests (Vitest)

```bash
# Run all unit/integration tests once
npm test

# Run in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory. Open `coverage/index.html` in a browser to view the HTML report.

### Firestore Integration Tests (Firebase Emulator)

For Firestore CRUD integration tests, use:

```bash
npm run test:firestore
```

This script runs the dedicated Vitest file and will execute tests if the emulator is already running; otherwise the suite is skipped.

For deterministic emulator startup/shutdown, use:

```bash
npm run test:firestore:emulator
```

This script uses `firebase emulators:exec --only firestore`.

Inside the test suite:

1. It checks whether the emulator is already running.
2. If not running, it tries to start it.
3. If startup exceeds timeout, tests are skipped (`describe.skip`).
4. Data is cleaned before each test.

Detailed guide: `docs/firestore-crud-emulator.md`.

### End-to-End Tests (Playwright)

E2E tests require the development server to be running. The `playwright.config.ts` is configured to automatically start it via `npm run dev`.

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run with interactive UI
npm run test:e2e:ui
```

To run a specific E2E test file:

```bash
npx playwright test e2e/home.spec.ts
```

To run E2E tests in headed mode (visible browser):

```bash
npx playwright test --headed
```

HTML reports are saved to `playwright-report/`. Run `npx playwright show-report` to open them.

> **Note:** On CI, Playwright browsers must be installed first:
> ```bash
> npx playwright install --with-deps chromium
> ```

---

## Writing New Tests

### Unit / Integration Tests

Place test files next to the source they test, inside a `__tests__/` subdirectory:

```
src/components/__tests__/MyComponent.test.tsx
src/lib/__tests__/myUtil.test.ts
```

**File naming convention:** `*.test.ts` or `*.test.tsx`

**Basic component test template:**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MyComponent from "@/src/components/MyComponent";

// Mock Next.js Link to avoid router context in unit tests
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(<MyComponent />);
    expect(screen.getByText("Expected text")).toBeInTheDocument();
  });
});
```

**Testing user interactions:**

```tsx
import { fireEvent } from "@testing-library/react";
// or for more realistic interactions:
import userEvent from "@testing-library/user-event";

it("responds to click", async () => {
  const user = userEvent.setup();
  render(<MyComponent />);
  await user.click(screen.getByRole("button", { name: "Submit" }));
  expect(screen.getByText("Success")).toBeInTheDocument();
});
```

### E2E Tests (Playwright)

Place E2E tests in the `e2e/` directory:

```
e2e/my-feature.spec.ts
```

**File naming convention:** `*.spec.ts`

**Basic E2E test template:**

```ts
import { test, expect } from "@playwright/test";

test.describe("My Feature", () => {
  test("does something", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  });
});
```

The `baseURL` is set to `http://localhost:3000` in `playwright.config.ts`, so you can use relative paths: `page.goto("/colecao")`.

---

## When to Write Tests

| Scenario | Test type |
|---|---|
| New utility function or constant | Unit test |
| New React component | Unit test (render, props, states) |
| Component with complex state logic | Integration test (interactions, events) |
| New page or route | E2E test |
| Navigation flows | E2E test |
| Form submission | Integration + E2E test |
| Authentication flow | E2E test |

---

## Mocking Next.js Modules

Because Vitest runs outside the Next.js runtime, some modules need to be mocked:

```ts
// Mock next/link (no router context needed in unit tests)
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock next/navigation (if a component uses useRouter, usePathname, etc.)
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
```

---

## Firebase App Hosting & Production Deployment

Test files and configuration are **excluded from Firebase App Hosting (Cloud Run) deployments** via `.gcloudignore`. The following paths are excluded:

- `e2e/`
- `src/**/__tests__/`
- `src/test/`
- `vitest.config.mts`
- `playwright.config.ts`
- `coverage/`, `playwright-report/`, `test-results/`

This ensures the production Cloud Run image stays lean and test code never reaches production.

---

## CI Integration

The existing workflow (`.github/workflows/copilot-setup-steps.yml`) can be extended to run tests on every push or pull request. Add the following steps after `npm ci`:

```yaml
- name: Run unit tests
  run: npm test

- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npm run test:e2e
```
