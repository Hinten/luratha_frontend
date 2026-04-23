import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { FIREBASE_EMULATOR_ENV } from "./src/lib/firestore/environment";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    globalSetup: ["./src/test/firestoreEmulator.globalSetup.ts"],
    env: {
      ...FIREBASE_EMULATOR_ENV,
    },
    include: [
      "src/test/emulator/**/*.test.ts",
      "src/test/emulator/**/*.test.tsx",
      "src/test/emulator/**/*.spec.ts",
      "src/test/emulator/**/*.spec.tsx",
    ],
    exclude: ["node_modules", ".next", "e2e"],
  },
});
