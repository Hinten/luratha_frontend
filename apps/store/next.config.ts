import path from "node:path";
import type { NextConfig } from "next";
import { loadRootEnv } from "./loadRootEnv";

/**
 * Backfill NEXT_PUBLIC_FIREBASE_* into process.env from FIREBASE_WEB_APP_CONFIG_BASE64
 * BEFORE Next.js inlines them into the client bundle. Next.js prioritizes a
 * non-undefined process.env value over the `env` config field — including the
 * empty string. So we mutate process.env directly here, treating empty values
 * as "missing" and overwriting them from the base64 payload.
 */
function backfillFirebaseClientEnv(): void {
  const base64 = process.env.FIREBASE_WEB_APP_CONFIG_BASE64;
  if (!base64) return;

  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Malformed base64 JSON — leave env vars untouched.
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

// Load the single repo-root `.env` before reading any Firebase env var.
loadRootEnv();
backfillFirebaseClientEnv();

const nextConfig: NextConfig = {
  // Monorepo: trace files from the workspace root so the standalone output
  // resolves dependencies hoisted by pnpm into the root node_modules.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  typedRoutes: true,
  transpilePackages: [
    "@luratha/schemas",
    "@luratha/firestore",
    "@luratha/core",
    "@luratha/auth",
  ],
  serverExternalPackages: ["firebase", "firebase-admin"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
};

export default nextConfig;
