import { defineConfig, devices } from "@playwright/test";
import { loadRootEnv } from "@luratha/devtools/loadRootEnv";

/**
 * Playwright E2E config — runs against the dedicated test Firebase project
 * (`luratha-96386`). The dev server inherits Firebase credentials from the
 * caller's environment (CI workflow or local `.env`).
 *
 * Required env vars when running cloud tests:
 *   FIREBASE_SERVICE_ACCOUNT_BASE64 (or FIREBASE_SERVICE_ACCOUNT_PATH)
 *   FIREBASE_WEB_APP_CONFIG_BASE64 (or NEXT_PUBLIC_FIREBASE_* set)
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=luratha-96386
 *
 * When credentials are absent, cloud-dependent tests auto-skip and the
 * remaining UI tests (auth, cart, institutional, navigation) still run.
 */

// Load the single repo-root `.env` so credential vars are available before
// globalSetup runs and before the dev server is spawned.
loadRootEnv();

// Backfill NEXT_PUBLIC_FIREBASE_* from FIREBASE_WEB_APP_CONFIG_BASE64 BEFORE
// the dev server is spawned, so Next.js sees populated values when it inlines
// `process.env.NEXT_PUBLIC_*` into the client bundle.
if (process.env.FIREBASE_WEB_APP_CONFIG_BASE64) {
  try {
    const cfg = JSON.parse(
      Buffer.from(process.env.FIREBASE_WEB_APP_CONFIG_BASE64, "base64").toString("utf8"),
    ) as Record<string, unknown>;
    const map: Array<[string, string]> = [
      ["NEXT_PUBLIC_FIREBASE_API_KEY", "apiKey"],
      ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "authDomain"],
      ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", "projectId"],
      ["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "storageBucket"],
      ["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "messagingSenderId"],
      ["NEXT_PUBLIC_FIREBASE_APP_ID", "appId"],
    ];
    for (const [envName, cfgKey] of map) {
      if (process.env[envName]) continue; // truthy = real value already set
      const value = cfg[cfgKey];
      if (typeof value === "string" && value.length > 0) {
        process.env[envName] = value;
      }
    }
  } catch (err) {
    if (!(err instanceof SyntaxError)) {
      throw err;
    }
    // Malformed base64 JSON — leave env vars untouched.
  }
}

const hasCredentials = !!(
  process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS
);

if (!hasCredentials) {
  console.warn(
    "\n[E2E] No Firebase credentials found — cloud fixture seeding will be skipped." +
      "\n      Tests that require Firestore data (home, catalog, product) will auto-skip." +
      "\n      Set FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT_PATH to run them.\n",
  );
  process.env.E2E_CLOUD_SKIP = "1";
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
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
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  globalSetup: hasCredentials
    ? require.resolve("./src/test/playwrightCloudSetup.globalSetup.ts")
    : undefined,
  globalTeardown: hasCredentials
    ? require.resolve("./src/test/playwrightCloudSetup.globalTeardown.ts")
    : undefined,
});
