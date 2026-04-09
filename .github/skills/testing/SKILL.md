---
name: testing
description: Guide for creating new tests, running the test suite, and fixing bugs in the Luratha frontend. Activate whenever the user asks to write tests, fix failing tests, add test coverage, debug a component, or validate a new feature. Contains all test patterns, mock strategies, templates, and commands for Vitest (unit/integration) and Playwright (E2E).
compatibility: Next.js 16+ with Vitest 4, React Testing Library, @testing-library/jest-dom, @testing-library/user-event, and Playwright.
---

# Testing Guide – Luratha Frontend

## Test Stack

| Tool | Role |
|---|---|
| [Vitest](https://vitest.dev/) | Unit & integration test runner |
| [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) | Component rendering & DOM assertions |
| [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) | DOM matchers (`toBeInTheDocument`, `toHaveAttribute`, etc.) |
| [@testing-library/user-event](https://testing-library.com/docs/user-event/intro/) | Realistic user interactions (click, type, keyboard) |
| [Playwright](https://playwright.dev/) | End-to-End browser tests (Chromium) |

---

## Directory Layout

```
luratha_frontend/
├── src/
│   ├── app/__tests__/          ← page-level unit tests   (*.test.tsx)
│   ├── components/__tests__/   ← component unit tests    (*.test.tsx)
│   ├── lib/__tests__/          ← utility / constant tests (*.test.ts)
│   └── test/
│       └── setup.ts            ← global Vitest setup (jest-dom matchers)
├── e2e/                        ← Playwright E2E tests    (*.spec.ts)
├── vitest.config.mts           ← Vitest configuration
└── playwright.config.ts        ← Playwright configuration
```

**Convention:** Always place unit tests inside a `__tests__/` folder next to the source file. E2E tests always go in `e2e/`.

---

## Running Tests

### Mandatory checklist before finishing any task

```bash
npm run lint       # must exit 0 — no new ESLint errors
npm test           # must pass — all Vitest unit/integration tests
npm run test:e2e   # must pass — all Playwright E2E tests
```

### All commands

```bash
npm test                  # Run all Vitest tests once
npm run test:watch        # Watch mode (re-runs on file change)
npm run test:coverage     # Coverage report in coverage/index.html
npm run test:e2e          # Run Playwright E2E tests (headless Chromium)
npm run test:e2e:ui       # Playwright interactive UI
npx playwright test e2e/home.spec.ts   # Run a single E2E file
npx playwright test --headed           # E2E with visible browser
```

---

## Deciding What to Test

| What you create | Required tests |
|---|---|
| New constant or utility | Unit test in `src/lib/__tests__/` |
| New React component | Unit test in `src/components/__tests__/` |
| New page | Unit test in `src/app/__tests__/` + E2E test in `e2e/` |
| New navigation link / route | E2E navigation test in `e2e/navigation.spec.ts` |
| Interactive flow / form | Integration test (Vitest) + E2E test |
| Authentication flow | E2E test |

---

## Unit / Integration Tests (Vitest)

### Template: React Component

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
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock next/navigation when component uses useRouter / usePathname
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock app constants to keep tests deterministic
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

  it("renders image with correct src and alt", () => {
    render(<MyComponent />);
    const img = screen.getByAltText("Description");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/image.png");
  });

  it("renders a link pointing to the right href", () => {
    render(<MyComponent />);
    expect(screen.getByRole("link", { name: "Label" })).toHaveAttribute(
      "href",
      "/target"
    );
  });
});
```

### Template: User Interactions

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyComponent from "@/src/components/MyComponent";

describe("MyComponent interactions", () => {
  it("toggles state on button click (fireEvent)", () => {
    render(<MyComponent />);
    const btn = screen.getByRole("button", { name: "Toggle" });
    fireEvent.click(btn);
    expect(screen.getByText("Active")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("responds to realistic user click (userEvent)", async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });

  it("types into an input field", async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    const input = screen.getByPlaceholderText("Search...");
    await user.type(input, "hello");
    expect(input).toHaveValue("hello");
  });
});
```

### Template: Utility / Constant

```ts
import { describe, it, expect } from "vitest";
import { myUtil } from "@/src/lib/myUtil";

describe("myUtil", () => {
  it("returns the expected value for a known input", () => {
    expect(myUtil("input")).toBe("expected");
  });

  it("exports all required fields", () => {
    expect(myUtil).toHaveProperty("name");
  });
});
```

### Template: Page Component

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MyPage from "@/src/app/my-page/page";

describe("MyPage", () => {
  it("renders the main heading", () => {
    render(<MyPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Page Title" })
    ).toBeInTheDocument();
  });
});
```

---

## End-to-End Tests (Playwright)

The `baseURL` in `playwright.config.ts` is `http://localhost:3000`. The dev server starts automatically before the tests run.

### Template: Page Load

```ts
import { test, expect } from "@playwright/test";

test.describe("My Page", () => {
  test("loads and shows heading", async ({ page }) => {
    await page.goto("/my-route");
    await expect(page).toHaveTitle(/Luratha/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Page Title" })
    ).toBeVisible();
  });

  test("renders the header with logo", async ({ page }) => {
    await page.goto("/my-route");
    const header = page.locator("header");
    await expect(header).toBeVisible();
    await expect(header.locator("img")).toHaveAttribute("alt", "Luratha");
  });

  test("renders the footer with copyright", async ({ page }) => {
    await page.goto("/my-route");
    const footer = page.locator("footer");
    await expect(footer).toContainText("Luratha");
    await expect(footer).toContainText("Todos os direitos reservados");
  });
});
```

### Template: Navigation Flow

```ts
import { test, expect } from "@playwright/test";

test.describe("Navigation to MyPage", () => {
  test("nav link navigates to the right page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "My Page" }).click();
    await expect(page).toHaveURL("/my-route");
    await expect(
      page.getByRole("heading", { level: 1, name: "Page Title" })
    ).toBeVisible();
  });
});
```

### Template: Mobile Viewport

```ts
import { test, expect } from "@playwright/test";

test.describe("Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("mobile menu opens and closes", async ({ page }) => {
    await page.goto("/");
    const hamburger = page.getByRole("button", { name: "Abrir menu" });
    await expect(hamburger).toBeVisible();
    await hamburger.click();
    await expect(page.getByRole("button", { name: "Fechar menu" })).toBeVisible();
    await page.getByRole("button", { name: "Fechar menu" }).click();
    await expect(hamburger).toBeVisible();
  });
});
```

### Template: Form Submission

```ts
import { test, expect } from "@playwright/test";

test.describe("Form", () => {
  test("submits with valid data", async ({ page }) => {
    await page.goto("/contato");
    await page.getByLabel("Nome").fill("Maria");
    await page.getByLabel("Email").fill("maria@example.com");
    await page.getByLabel("Mensagem").fill("Olá, tudo bem?");
    await page.getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByText("Mensagem enviada")).toBeVisible();
  });
});
```

---

## Mocking Reference

### next/link

Always mock in unit tests. The mock renders a plain `<a>` tag.

```ts
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
```

### next/navigation

Mock when a component calls `useRouter`, `usePathname`, or `useSearchParams`.

```ts
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
```

### next/image

Mock when a component uses `<Image>` from `next/image`.

```ts
vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt: string;
    [key: string]: unknown;
  }) => <img src={src} alt={alt} {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />,
}));
```

### Firebase modules

Mock Firebase when testing components that use Firestore, Auth, or Storage.

```ts
vi.mock("@/src/lib/firebase", () => ({
  db: {},
  auth: { currentUser: null },
  storage: {},
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  addDoc: vi.fn().mockResolvedValue({ id: "mock-id" }),
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => null }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
}));

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((auth, cb) => { cb(null); return vi.fn(); }),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
}));
```

### App constants

```ts
vi.mock("@/src/lib/constants", () => ({
  appData: { name: "Luratha", logo: "/luratha.svg" },
}));
```

---

## Common jest-dom Matchers

```ts
expect(el).toBeInTheDocument();
expect(el).not.toBeInTheDocument();
expect(el).toBeVisible();
expect(el).toBeDisabled();
expect(el).toHaveAttribute("href", "/path");
expect(el).toHaveClass("my-class");
expect(el).toHaveValue("input value");
expect(el).toHaveTextContent("some text");
expect(el).toContainElement(child);
expect(el).toHaveFocus();
```

---

## Debugging Failing Tests

### Vitest unit tests

```bash
# Run a single test file
npx vitest run src/components/__tests__/Header.test.tsx

# Run tests matching a name pattern
npx vitest run --reporter=verbose -t "renders the logo"

# Enable verbose output
npx vitest run --reporter=verbose

# Print rendered HTML to console (inside a test)
import { prettyDOM } from "@testing-library/react";
console.log(prettyDOM(container));

# Or using screen.debug()
screen.debug();           # prints full DOM
screen.debug(element);    # prints specific element
```

### Playwright E2E tests

```bash
# Run with visible browser (see what the test does)
npx playwright test --headed

# Run with Playwright Inspector (step-through debugger)
npx playwright test --debug

# Show HTML report after failures
npx playwright show-report

# Run a single test file
npx playwright test e2e/home.spec.ts

# Run tests matching a name pattern
npx playwright test -g "mobile menu"

# Trace viewer (captures full test trace)
npx playwright test --trace on
npx playwright show-trace test-results/.../trace.zip
```

---

## Common Bugs and Fixes

### "Unable to find an element" in unit tests

**Cause:** The component renders async content, or the element has a different role/name than expected.

**Fix:**
```ts
// Use findBy* (async) instead of getBy* when content loads asynchronously
const el = await screen.findByRole("heading", { name: "Title" });
expect(el).toBeInTheDocument();

// Use screen.debug() to inspect what is actually rendered
screen.debug();
```

### Navigation mock not working

**Cause:** Component uses `useRouter` but `next/navigation` isn't mocked.

**Fix:** Add the mock at the top of the test file (see Mocking Reference above).

### Test sees stale mock values across tests

**Fix:** Add `beforeEach(() => vi.clearAllMocks())` at the top of `describe`.

### Playwright: "locator.click: Target closed"

**Cause:** The dev server isn't ready, or the element is covered by another element.

**Fix:** Add `await expect(element).toBeVisible()` before clicking, or increase `timeout` in `playwright.config.ts`.

### Playwright: Tests pass locally but fail in CI

**Cause:** Browsers not installed in CI, or fonts fail to load.

**Fix:** Ensure CI runs `npx playwright install --with-deps chromium` before tests. Add `NEXT_PUBLIC_*` env vars if needed.

---

## Coverage

```bash
npm run test:coverage
# HTML report: coverage/index.html
# Summary in terminal
```

Coverage is tracked by Vitest's built-in V8 provider. Target: focus on components with complex logic (conditional rendering, event handlers, state transitions).

---

## Path Aliases in Tests

Import source files using the `@/src/...` alias:

```ts
import Header from "@/src/components/Header";
import { appData } from "@/src/lib/constants";
import Home from "@/src/app/page";
```

Do **not** use relative imports like `../../components/Header` — always use the `@/src/` prefix.

---

## CI Integration

Add to `.github/workflows/` to run tests on every push:

```yaml
- name: Install dependencies
  run: npm ci

- name: Lint
  run: npm run lint

- name: Unit tests
  run: npm test

- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium

- name: E2E tests
  run: npm run test:e2e
```

Test files are excluded from Firebase App Hosting (Cloud Run) builds via `.gcloudignore` — never remove those exclusions.
