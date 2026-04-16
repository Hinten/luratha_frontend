import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config with Firebase Emulator support.
 * This configuration runs tests in e2e/with-emulator/ against a local dev server
 * with Firestore, Auth, and Storage emulators running.
 *
 * Usage:
 *   npx playwright test --config playwright.e2e.emulator.config.ts
 *
 * Or via package.json script:
 *   npm run test:e2e:emulator
 */

export default defineConfig({
  testDir: "./e2e/with-emulator",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
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
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: "test-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "luratha-96386.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "luratha-96386",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "luratha-96386.appspot.com",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "test-sender-id",
      NEXT_PUBLIC_FIREBASE_APP_ID: "test-app-id",
      NEXT_PUBLIC_USE_EMULATOR: "true",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
      FIREBASE_PROJECT_ID: "luratha-96386",
    },
  },
  globalSetup: require.resolve("./src/test/playwrightEmulator.globalSetup.ts"),
});
