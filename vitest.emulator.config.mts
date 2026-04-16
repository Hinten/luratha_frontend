import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    globalSetup: ["./src/test/firestoreEmulator.globalSetup.ts"],
    env: {
      FIREBASE_PROJECT_ID: "luratha-96386",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
      NEXT_PUBLIC_FIREBASE_API_KEY: "test-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "luratha-96386.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "luratha-96386",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "luratha-96386.appspot.com",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "test-sender-id",
      NEXT_PUBLIC_FIREBASE_APP_ID: "test-app-id",
      NEXT_PUBLIC_USE_EMULATOR: "true",
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
