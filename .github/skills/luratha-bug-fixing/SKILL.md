---
name: luratha-bug-fixing
description: Activate this skill whenever you need to investigate a bug, diagnose a failing test, or fix broken functionality in the Luratha frontend. Provides a systematic debugging workflow for Next.js 16 App Router, React 19 components, TypeScript errors, ESLint failures, and Vitest/Playwright test failures specific to this project.
compatibility: Node.js 22, Next.js 16 App Router, React 19, TypeScript 5 strict, Vitest 4, Playwright, Tailwind CSS v4.
---

# Bug Fixing Guide – Luratha Frontend

## First: Reproduce & Understand

Before changing any code, confirm the bug:

```bash
npm run lint      # ESLint: are there errors (exit non-zero)?
npm test          # Vitest: which unit tests are failing?
npm run test:e2e  # Playwright: which E2E tests are failing?
```

Read the full error message. Note:
- **File path** and **line number**
- **Expected** vs **received** values (in test failures)
- **Stack trace** (top frame is usually most relevant)

---

## Diagnostic Workflow

### 1. TypeScript / Compilation Errors

```bash
npx tsc --noEmit   # check type errors across the whole project
```

Common causes:
- Missing `"use client"` directive — components using hooks must start with `"use client"`
- Wrong import path — always use `@/src/...` aliases (e.g., `@/src/components/Header`)
- Strict null checks — TypeScript is in strict mode; handle `undefined`/`null` explicitly
- Mismatched prop types — verify component props interfaces match usage

### 2. ESLint Errors

```bash
npm run lint
```

Pre-existing warnings (do not fix unless related to your change):
- Unused `Image` import in `src/app/page.tsx`
- `<img>` element in `src/components/Logo.tsx`
- Unused `appData` in `src/components/Header.tsx`

New errors introduced by your changes will cause `lint` to exit non-zero. Fix them.

Common fixes:
```ts
// Unused variable → remove it or prefix with _
const _unused = something;   // or just delete the declaration

// Missing dependency in useEffect → add to deps array or use useCallback
useEffect(() => { ... }, [dep1, dep2]);
```

### 3. Failing Unit Tests (Vitest)

Run a single test file to isolate the failure:
```bash
npx vitest run src/components/__tests__/Header.test.tsx
```

**"Cannot find module"** errors:
- Check the import path — use `@/src/...` not relative paths
- Ensure the component file exists at the path you're importing

**"Not wrapped in act(...)"** warnings:
- Wrap state-changing interactions in `act()` or use `await userEvent.setup()`

**"Element not found"** (`getByRole`, `getByText`):
- Verify the element is actually rendered (check your component output)
- Check ARIA roles — use `screen.debug()` to print the rendered HTML:
  ```ts
  screen.debug(); // prints the full rendered DOM
  ```

**Mock not applied correctly:**
- Make sure `vi.mock(...)` is called at the top level (not inside `describe` or `it`)
- For `@/src/lib/constants`, the mock must return the exact shape the component expects:
  ```ts
  vi.mock("@/src/lib/constants", () => ({
    appData: { name: "Luratha", logo: "/luratha.svg" },
  }));
  ```

**Snapshot / text mismatch:**
- If you changed a component's output, update the test assertions to match the new output

### 4. Failing E2E Tests (Playwright)

Run a single spec file:
```bash
npx playwright test e2e/navigation.spec.ts
```

Run in headed mode to watch the browser:
```bash
npx playwright test --headed
```

View the last HTML report:
```bash
npx playwright show-report
```

**"Timeout waiting for element"**:
- The element may not exist or may be conditionally hidden
- Check the selector: `page.getByRole("button", { name: "..." })` requires an exact accessible name
- Use `await page.waitForSelector("...")` if the element appears after an async action

**"Expected URL to match"**:
- Verify the route exists in `src/app/` and the link href is correct
- The `baseURL` is `http://localhost:3000` (set in `playwright.config.ts`)

**Dev server not starting**:
- Playwright auto-starts the dev server via `npm run dev` (configured in `playwright.config.ts`)
- If port 3000 is already in use, kill the existing process: `kill $(lsof -ti:3000)`

### 5. Next.js Build/Runtime Errors

```bash
npm run build
```

**"Server component cannot use hooks"**:
- Add `"use client"` as the first line of the component file
- `Header.tsx` and `Footer.tsx` are already `"use client"`

**"Dynamic server usage"**:
- Components using `cookies()`, `headers()`, or `searchParams` must be in Server Components
- Move the data-fetching to a Server Component and pass data as props

**"Module not found: @/src/..."**:
- Verify `tsconfig.json` has `"paths": { "@/*": ["./*"] }` (repo root)
- The alias maps to the repo root, so `@/src/components/Header` → `src/components/Header.tsx`

---

## Key File Locations

| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Root layout: Header, Footer, Google Fonts |
| `src/app/page.tsx` | Home page |
| `src/app/globals.css` | Tailwind CSS v4 theme tokens |
| `src/components/Header.tsx` | Site header with logo, nav, cart |
| `src/components/Footer.tsx` | Site footer with nav links, copyright |
| `src/components/Logo.tsx` | Logo image component |
| `src/lib/constants.ts` | `appData`: app name and logo path |
| `src/test/setup.ts` | Vitest global setup (jest-dom matchers) |
| `vitest.config.mts` | Vitest configuration (jsdom, paths) |
| `playwright.config.ts` | Playwright configuration (baseURL, dev server) |
| `eslint.config.mjs` | ESLint flat config (Next.js + TypeScript) |

---

## Architecture Facts (Quick Reference)

- **Framework:** Next.js 16.2.2, App Router. Pages live in `src/app/`.
- **Components:** React 19. Client components need `"use client"`. Server components by default.
- **Styling:** Tailwind CSS v4. Use `var(--color-*)` tokens from `globals.css @theme`. No `tailwind.config.js`.
- **Path aliases:** `@/src/...` maps to `src/` relative to repo root.
- **App constants:** `appData.name` = "Luratha", `appData.logo` = "/luratha.svg" (from `src/lib/constants.ts`)
- **Navigation links:** Coleção (`/colecao`), Sobre (`/sobre`), Contato (`/contato`) — header + footer
- **Footer extra link:** Privacidade (`/privacidade`)

---

## Testing After a Fix

After fixing a bug:

1. **Write a regression test** — a unit or E2E test that would have caught the bug
2. **Run the full suite:**
   ```bash
   npm run lint && npm test && npm run test:e2e
   ```
3. **All must pass** before marking the fix complete

---

## Common Bug Patterns

| Symptom | Likely Cause | Fix |
|---|---|---|
| Hook called outside component | Missing `"use client"` | Add `"use client"` directive |
| Hydration mismatch | Server/client render differs | Ensure same output on server and client |
| Broken import | Wrong path alias | Use `@/src/...` |
| Test can't find element | Role/name mismatch | Use `screen.debug()` to inspect rendered HTML |
| E2E timeout | Element not visible | Check visibility, use `await expect(el).toBeVisible()` |
| Lint error on CI | New unused var / no-img | Remove unused import or use `<Image />` from `next/image` |
| Build fails with font error | `fonts.googleapis.com` unreachable | Ensure network allows Google Fonts at build time |
