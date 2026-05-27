import path from "node:path";
import type { NextConfig } from "next";
import { loadRootEnv } from "./loadRootEnv";

loadRootEnv();

const nextConfig: NextConfig = {
  // Monorepo: trace files from the workspace root so the standalone output
  // resolves dependencies hoisted by pnpm into the root node_modules.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  typedRoutes: true,
  transpilePackages: ["@luratha/schemas", "@luratha/firestore", "@luratha/payments"],
  serverExternalPackages: ["firebase", "firebase-admin"],
};

export default nextConfig;
