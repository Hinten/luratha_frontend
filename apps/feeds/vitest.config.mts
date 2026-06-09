import path from "node:path";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // "server-only" is a Next.js guard with no standalone runtime; replace it
      // with a no-op so server modules can be imported in the Vitest runner.
      "server-only": path.resolve(__dirname, "src/test/__mocks__/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["node_modules", ".next", "src/test/cloud/**"],
  },
});
