import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode || "test", process.cwd(), "");

  Object.entries(env).forEach(([key, value]) => {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  });

  return {
    plugins: [tsconfigPaths()],
    test: {
      environment: "node",
      globals: true,
      globalSetup: ["./src/test/cloudTests.globalSetup.ts"],
      include: ["src/test/cloud/**/*.test.ts"],
      testTimeout: 30_000,
      retry: 1,
      env: {
        CLOUD_TEST_PROJECT_ID: process.env.CLOUD_TEST_PROJECT_ID ?? "luratha-test",
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "",
        RUN_CLOUD_TESTS: "true",
      },
    },
  };
});
