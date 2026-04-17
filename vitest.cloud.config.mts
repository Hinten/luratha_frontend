import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    globalSetup: ["./src/test/cloudTests.globalSetup.ts"],
    include: ["src/test/cloud/**/*.test.ts"],
    testTimeout: 30_000,
    retries: 1,
    env: {
      CLOUD_TEST_PROJECT_ID: process.env.CLOUD_TEST_PROJECT_ID ?? "luratha-test",
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "",
      RUN_CLOUD_TESTS: "true",
    },
  },
});
