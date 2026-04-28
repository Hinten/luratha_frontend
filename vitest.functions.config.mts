import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
import { FIREBASE_EMULATOR_ENV } from "./src/lib/firestore/environment";

export default defineConfig({
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
    globalSetup: ["./src/test/firestoreEmulator.functions.globalSetup.ts"],
    env: {
      ...FIREBASE_EMULATOR_ENV,
    },
    include: [
      "src/test/emulator/**/*.functions.test.ts",
      "src/test/emulator/**/*.functions.test.tsx",
    ],
    exclude: ["node_modules", ".next", "e2e"],
    // Functions trigger tests can be slow — allow up to 60s per test to account
    // for the function worker warmup on first invocation.
    testTimeout: 60_000,
  },
});
