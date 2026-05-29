import path from "node:path";
import type { NextConfig } from "next";
import { loadRootEnv } from "@luratha/devtools/loadRootEnv";

loadRootEnv();

const nextConfig: NextConfig = {
  // Monorepo: trace files from the workspace root so the standalone output
  // resolves dependencies hoisted by pnpm into the root node_modules.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  typedRoutes: true,
  transpilePackages: [
    "@luratha/core",
    "@luratha/firestore",
    "@luratha/payments",
    "@luratha/schemas",
  ],
  serverExternalPackages: ["firebase", "firebase-admin"],
};

export default nextConfig;
