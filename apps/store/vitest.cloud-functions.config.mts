import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
import { loadRootEnv } from "@luratha/devtools/loadRootEnv";

export default defineConfig(() => {
  loadRootEnv();

  return {
    plugins: [tsconfigPaths()],
    resolve: {
      alias: {
        "server-only": path.resolve(__dirname, "src/test/__mocks__/server-only.ts"),
      },
    },
    test: {
      environment: "node",
      globals: true,
      globalSetup: ["./src/test/cloudTests.globalSetup.ts"],
      include: ["src/test/cloud-functions/**/*.test.ts"],
      // Cloud Function trigger tests have to wait for the deployed function to
      // execute and write side effects — keep timeouts generous.
      testTimeout: 90_000,
      // Functions tests must not run in parallel: deployed triggers fire on shared
      // collections, so concurrent tests would race on the same documents.
      fileParallelism: false,
      retry: 1,
      env: {
        CLOUD_TEST_PROJECT_ID: process.env.CLOUD_TEST_PROJECT_ID ?? "luratha-96386",
        GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "",
        RUN_CLOUD_TESTS: "true",
      },
    },
  };
});
