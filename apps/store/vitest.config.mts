import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // "server-only" is a Next.js guard that throws at build time in non-server
      // contexts. In Vitest's jsdom environment we replace it with an empty no-op
      // so tests that import server-only modules can still run.
      "server-only": path.resolve(__dirname, "src/test/__mocks__/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // `src/test/seo/**` is the dedicated SEO/AEO/GEO suite (vitest.seo.config.mts,
    // `pnpm test:seo`) — exclude it here so it stays isolated from `pnpm test`.
    exclude: [
      "node_modules",
      ".next",
      "e2e",
      "src/test/cloud/**",
      "src/test/cloud-functions/**",
      "src/test/seo/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", ".next", "src/test", "**/*.config.*", "src/app/layout.tsx"],
    },
  },
});
