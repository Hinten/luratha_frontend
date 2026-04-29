import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config — runs against the dedicated test Firebase project
 * (`luratha-96386`). The dev server inherits Firebase credentials from the
 * caller's environment (CI workflow or local `.env`).
 *
 * Required env vars when running:
 *   FIREBASE_SERVICE_ACCOUNT_BASE64 (or GOOGLE_APPLICATION_CREDENTIALS)
 *   FIREBASE_WEB_APP_CONFIG_BASE64 (or NEXT_PUBLIC_FIREBASE_* set)
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=luratha-96386
 */

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { open: "never" }],
    ["list"],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  globalSetup: require.resolve("./src/test/playwrightCloudSetup.globalSetup.ts"),
  globalTeardown: require.resolve("./src/test/playwrightCloudSetup.globalTeardown.ts"),
});
