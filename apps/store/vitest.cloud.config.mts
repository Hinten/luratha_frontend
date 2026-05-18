import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode || "test", process.cwd(), "");

  Object.entries(env).forEach(([key, value]) => {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  });

  return {
    plugins: [tsconfigPaths()],
    resolve: {
      alias: {
        // "server-only" is a Next.js guard that throws unconditionally outside
        // the Next.js bundler. Replace it with an empty no-op so server modules
        // (e.g. firebaseSearchDb.ts) can be imported in the Node.js test runner.
        "server-only": path.resolve(__dirname, "src/test/__mocks__/server-only.ts"),
      },
    },
    test: {
      environment: "node",
      globals: true,
      globalSetup: ["./src/test/cloudTests.globalSetup.ts"],
      include: ["src/test/cloud/**/*.test.ts"],
      testTimeout: 30_000,
      retry: 1,
      env: {
        CLOUD_TEST_PROJECT_ID: process.env.CLOUD_TEST_PROJECT_ID ?? "luratha-96386",
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "",
        RUN_CLOUD_TESTS: "true",
      },
    },
  };
});
