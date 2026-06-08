import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

// Dedicated SEO / AEO / GEO suite. Isolated from the main `pnpm test` run so it
// can be filtered and verified on its own — script `test:seo`, CI `seo.yml`.
// Only files matching the `*.seo.test.{ts,tsx}` extension under `src/test/seo/`
// run here; the main config excludes the same path so they never double-run.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // "server-only" is a Next.js guard that throws outside the Next bundler.
      // Replace it with a no-op so SEO pages/layouts can be imported in jsdom.
      "server-only": path.resolve(__dirname, "src/test/__mocks__/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/test/seo/**/*.seo.test.{ts,tsx}"],
  },
});
