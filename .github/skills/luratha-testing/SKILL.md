---
name: luratha-testing
description: Use this skill when writing new tests, running the test suite, fixing failing tests, or adding coverage for new components/pages/utilities in the Luratha frontend project. Covers Vitest unit/integration tests and Playwright E2E tests, including mocking patterns, file conventions, and mandatory checklists.
compatibility: Node.js 22, Next.js 16.2.2 App Router, Vitest 4, Playwright, React Testing Library, jsdom environment. Chromium must be installed via `npx playwright install --with-deps chromium`.
---

# Luratha Testing Skill

## Test Stack

| Tool | Role |
|---|---|
| Vitest | Unit and integration test runner |
| React Testing Library | Component rendering and DOM assertions |
| @testing-library/jest-dom | Custom matchers (`toBeInTheDocument`, etc.) |
| @testing-library/user-event | Real user interaction simulation |
| Playwright | End-to-End (E2E) browser tests |

---

## Running Tests — Mandatory Checklist

**Always run these three commands before finishing any task:**

```bash
npm run lint       # must exit 0 with no new errors
npm test           # must pass — all Vitest unit/integration tests
npm run test:e2e   # must pass — all Playwright E2E tests
```

Additional commands:

```bash
npm run test:coverage   # Vitest with coverage report
npm run test:e2e:ui     # Playwright with interactive UI
```

---

## File Locations & Naming Conventions

```
src/
├── app/__tests__/          # Page-level unit tests   (*.test.tsx)
├── components/__tests__/   # Component unit tests    (*.test.tsx)
└── lib/__tests__/          # Utility/constant tests  (*.test.ts)
e2e/                        # Playwright E2E specs    (*.spec.ts)
src/test/setup.ts           # Vitest global setup (jest-dom matchers)
vitest.config.mts           # Vitest config
playwright.config.ts        # Playwright config
```

**Convention:** unit/integration files are `*.test.ts(x)` inside `__tests__/`; E2E files are `*.spec.ts` in `e2e/`.

---

## When to Add Tests

| What you create | Tests required |
|---|---|
| New utility function / constant | Unit test in `src/lib/__tests__/` |
| New React component | Unit test in `src/components/__tests__/` |
| New page | Unit test in `src/app/__tests__/` + E2E test in `e2e/` |
| New navigation link or route | E2E navigation test in `e2e/navigation.spec.ts` |
| Form or interactive flow | Integration test (Vitest) + E2E test |

---

## Writing Unit Tests (Vitest)

### Boilerplate for a component test

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MyComponent from "@/src/components/MyComponent";

// Always mock next/link in component tests
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

// Mock next/navigation when the component uses useRouter/usePathname
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock constants when needed
vi.mock("@/src/lib/constants", () => ({
  appData: { name: "Luratha", logo: "/luratha.svg" },
}));

describe("MyComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly", () => {
    render(<MyComponent />);
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });
});
```

### Common assertions

```tsx
// Element exists
expect(screen.getByRole("button", { name: "Carrinho" })).toBeInTheDocument();
expect(screen.getByAltText("Luratha")).toBeInTheDocument();
expect(screen.getByText(/direitos reservados/)).toBeInTheDocument();

// Attribute checks
expect(logo).toHaveAttribute("src", "/luratha.svg");
expect(link).toHaveAttribute("href", "/colecao");

// Interaction
fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
expect(screen.getByRole("button", { name: "Fechar menu" })).toBeInTheDocument();
```

### Boilerplate for a utility/constant test

```ts
import { describe, it, expect } from "vitest";
import { appData } from "@/src/lib/constants";

describe("appData constants", () => {
  it("has the correct app name", () => {
    expect(appData.name).toBe("Luratha");
  });
});
```

---

## Writing E2E Tests (Playwright)

### Boilerplate

```ts
import { test, expect } from "@playwright/test";

test.describe("My Page", () => {
  test("loads and shows heading", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("header has navigation links", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Coleção" })).toBeVisible();
  });

  test("mobile hamburger opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.getByRole("button", { name: "Fechar menu" })).toBeVisible();

    await page.getByRole("button", { name: "Fechar menu" }).click();
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
  });
});
```

### Playwright config reference

- `baseURL`: `http://localhost:3000`
- `testDir`: `./e2e`
- webServer auto-starts with `npm run dev`
- Only Chromium is configured

---

## Existing Test Coverage

### Unit tests (src/)

| File | Tests |
|---|---|
| `src/components/__tests__/Header.test.tsx` | Logo renders, home link, nav links, cart button, hamburger toggle, mobile menu close |
| `src/components/__tests__/Footer.test.tsx` | Logo renders, home link, nav links (Coleção/Sobre/Contato/Privacidade), copyright year |
| `src/lib/__tests__/constants.test.ts` | `appData.name`, `appData.logo`, required fields |
| `src/app/__tests__/page.test.tsx` | Home page H1 heading |

### E2E tests (e2e/)

| File | Tests |
|---|---|
| `e2e/home.spec.ts` | Page title, header logo, footer copyright |
| `e2e/navigation.spec.ts` | Header nav links, cart button, hamburger open/close, footer nav links |

---

## Path Aliases

`tsconfig.json` defines `"@/*": ["./*"]` (from repo root):

- `@/src/components/Header` → `src/components/Header.tsx`
- `@/src/lib/constants` → `src/lib/constants.ts`

Always use `@/src/...` prefix in test imports.

---

## Key Notes

- Vitest runs in **jsdom** environment with `globals: true` — no need to import `describe`/`it`/`expect`, but explicit imports are preferred for clarity.
- The `src/test/setup.ts` file imports `@testing-library/jest-dom` — custom matchers are globally available.
- `next/link` and `next/navigation` must always be mocked in unit tests (they don't work in jsdom without mocking).
- Logo component uses `<img>` (not `next/image`) — assertions should use `getByAltText("Luratha")` and check `src` attribute.
- Firebase client SDK is not yet initialized in the frontend — no Firebase mocks needed for current tests.
