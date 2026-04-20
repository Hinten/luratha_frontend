import { defineConfig, devices } from "@playwright/test";
import { FIREBASE_EMULATOR_ENV } from "./src/lib/firestore/environment";

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
  reporter: [
    ['html', { open: 'never' }],   // ← esta é a linha que você precisa
    // ou se quiser manter o relatório no terminal também:
    ['list'],
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

    env: {
      ...FIREBASE_EMULATOR_ENV,
    },
  },
  globalSetup: require.resolve("./src/test/playwrightEmulatorSetup.globalSetup.ts"),
  globalTeardown: require.resolve("./src/test/playwrightEmulatorSetup.globalTeardown.ts"),
});
