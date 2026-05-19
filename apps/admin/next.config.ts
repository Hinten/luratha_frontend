import path from "node:path";
import type { NextConfig } from "next";
import { loadRootEnv } from "./loadRootEnv";

/**
 * Backfill NEXT_PUBLIC_FIREBASE_* into process.env from
 * FIREBASE_WEB_APP_CONFIG_BASE64 BEFORE Next.js inlines them into the client
 * bundle (the login page uses the Firebase client SDK).
 */
function backfillFirebaseClientEnv(): void {
  const base64 = process.env.FIREBASE_WEB_APP_CONFIG_BASE64;
  if (!base64) return;

  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch (err) {
    if (err instanceof SyntaxError) {
      return;
    }
    throw err;
  }

  const map: Array<[string, string]> = [
    ["NEXT_PUBLIC_FIREBASE_API_KEY", "apiKey"],
    ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "authDomain"],
    ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", "projectId"],
    ["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "storageBucket"],
    ["NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", "messagingSenderId"],
    ["NEXT_PUBLIC_FIREBASE_APP_ID", "appId"],
  ];

  for (const [envName, cfgKey] of map) {
    if (process.env[envName]) continue;
    const value = cfg[cfgKey];
    if (typeof value === "string" && value.length > 0) {
      process.env[envName] = value;
    }
  }
}

loadRootEnv();
backfillFirebaseClientEnv();

const nextConfig: NextConfig = {
  // Monorepo: trace files from the workspace root so the standalone output
  // resolves dependencies hoisted by pnpm into the root node_modules.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  typedRoutes: true,
  transpilePackages: ["@luratha/schemas", "@luratha/firestore", "@luratha/auth"],
  serverExternalPackages: ["firebase", "firebase-admin"],
};

export default nextConfig;
