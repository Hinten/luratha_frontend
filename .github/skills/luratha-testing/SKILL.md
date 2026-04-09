---
name: luratha-testing
description: Activate this skill whenever you need to write, run, or understand tests for the Luratha frontend project. Covers unit tests (Vitest + React Testing Library), E2E tests (Playwright), test file conventions, mocking Next.js modules, and the complete test commands. Use it when creating a new component, page, utility, or fixing a bug that requires a regression test.
compatibility: Node.js 22, Vitest 4, Playwright, React Testing Library, Next.js 16 App Router (Turbopack).
---

# Luratha Testing Guide

## Test Stack

| Tool | Role |
|---|---|
| Vitest 4 | Unit & integration test runner |
| React Testing Library | Component rendering and DOM assertions |
| @testing-library/jest-dom | Custom DOM matchers (`toBeInTheDocument`, etc.) |
| @testing-library/user-event | Realistic user interactions |
| Playwright | End-to-End browser tests (Chromium) |

---

## Running Tests

```bash
# Before finishing any task, always run all three:
npm run lint       # must exit 0 — no new ESLint errors
npm test           # Vitest unit/integration tests
npm run test:e2e   # Playwright E2E tests
```

Additional Vitest commands:
```bash
npm run test:watch     # watch mode (re-runs on file changes)
npm run test:coverage  # generates coverage/index.html
```

Additional Playwright commands:
```bash
npx playwright test e2e/my-feature.spec.ts  # single file
npx playwright test --headed                 # visible browser
npx playwright show-report                   # open HTML report
```

---

## Directory Structure

```
luratha_frontend/
├── src/
│   ├── app/__tests__/                  # Page-level unit tests
│   │   └── page.test.tsx
│   ├── components/__tests__/           # Component unit/integration tests
│   │   ├── Header.test.tsx
│   │   └── Footer.test.tsx
│   ├── lib/__tests__/                  # Utility/constant unit tests
│   │   └── constants.test.ts
│   └── test/
│       └── setup.ts                    # Global Vitest setup (jest-dom matchers)
└── e2e/
    ├── home.spec.ts                    # E2E: Home page
    └── navigation.spec.ts              # E2E: Header/Footer navigation
```

**File naming convention:**
- Unit/integration tests: `*.test.ts` or `*.test.tsx` inside `__tests__/`
- E2E tests: `*.spec.ts` in `e2e/`

---

## When to Write Tests

| What you create | Tests required |
|---|---|
| New utility function / constant | Unit test in `src/lib/__tests__/` |
| New React component | Unit test in `src/components/__tests__/` (render, props, interactions) |
| New page | Unit test in `src/app/__tests__/` + E2E test in `e2e/` |
| New navigation link or route | E2E navigation test |
| Form or interactive flow | Integration test (Vitest) + E2E test |
| Bug fix | Regression unit test or E2E test reproducing the bug |

---

## Unit Test Templates

### Component Test (`.test.tsx`)

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MyComponent from "@/src/components/MyComponent";

// Always mock next/link in component unit tests
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

// Mock next/navigation only when the component uses useRouter/usePathname
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock lib constants when the component imports them
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

  it("responds to click", () => {
    render(<MyComponent />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText("Success")).toBeInTheDocument();
  });
});
```

### Utility / Constant Test (`.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { myUtil } from "@/src/lib/myUtil";

describe("myUtil", () => {
  it("returns the expected value", () => {
    expect(myUtil("input")).toBe("expected");
  });
});
```

### Page Test (`.test.tsx`)

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Page from "@/src/app/my-page/page";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("My Page", () => {
  it("renders the main heading", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
```

---

## E2E Test Templates

E2E tests live in `e2e/` and automatically start the dev server via `playwright.config.ts`. The `baseURL` is `http://localhost:3000`.

### Basic E2E Test (`.spec.ts`)

```ts
import { test, expect } from "@playwright/test";

test.describe("My Feature", () => {
  test("page loads and shows heading", async ({ page }) => {
    await page.goto("/my-route");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("navigates to another page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Coleção" }).click();
    await expect(page).toHaveURL(/colecao/);
  });

  test("mobile responsive behavior", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    // Test mobile-specific UI
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
  });
});
```

---

## Mocking Next.js Modules

Because Vitest runs outside the Next.js runtime, some modules must be mocked:

```ts
// next/link — always mock in component unit tests
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// next/navigation — mock when component calls useRouter, usePathname, or useSearchParams
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// next/image — mock if component uses the Image component
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));
```

---

## Path Aliases

Always use `@/src/...` for imports in tests:

```ts
import Header from "@/src/components/Header";
import { appData } from "@/src/lib/constants";
import Page from "@/src/app/page";
```

---

## Vitest Configuration Reference

See `vitest.config.mts`. Key settings:
- `environment: "jsdom"` — simulates a browser DOM
- `setupFiles: ["src/test/setup.ts"]` — loads jest-dom matchers globally
- `globals: true` — `describe`, `it`, `expect` are available without imports (but import them anyway for clarity)

---

## Common Assertions

```ts
// DOM presence
expect(element).toBeInTheDocument();
expect(element).not.toBeInTheDocument();

// Visibility
expect(element).toBeVisible();

// Attributes
expect(img).toHaveAttribute("src", "/luratha.svg");
expect(link).toHaveAttribute("href", "/");

// Text content
expect(element).toHaveTextContent("Luratha");

// Roles (prefer role-based queries for accessibility)
screen.getByRole("button", { name: "Carrinho" });
screen.getByRole("link", { name: "Coleção" });
screen.getByRole("heading", { level: 1 });
screen.getByAltText("Luratha");
```

---

## Important Rules

1. **Every new component must have a unit test.** Every new page must have a unit test AND an E2E test.
2. **Never delete or skip existing tests.** If a test fails because you changed an interface, update both the component and the test.
3. **Test files are excluded from production builds** via `.gcloudignore`. Never remove those exclusions.
4. **Lint must pass** before finishing: `npm run lint` exits 0 with no new errors.
5. **Always run `npm test` and `npm run test:e2e`** to confirm all tests pass after any change.
