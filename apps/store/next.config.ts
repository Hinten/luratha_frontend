import path from "node:path";
import type { NextConfig } from "next";
import { loadRootEnv } from "./loadRootEnv";

/**
 * Backfill NEXT_PUBLIC_FIREBASE_* into process.env BEFORE Next.js inlines them
 * into the client bundle (the login page uses the Firebase client SDK, which
 * validates `apiKey` eagerly). Next.js prioritizes a non-undefined process.env
 * value over the `env` config field — including the empty string — so we mutate
 * process.env directly here, treating empty values as "missing".
 *
 * The web config is read from FIREBASE_WEB_APP_CONFIG_BASE64 (base64 JSON, used
 * by CI and the cloud test suites) or FIREBASE_WEBAPP_CONFIG (plain JSON, the
 * variable Firebase App Hosting populates automatically at build time).
 */
function parseJsonConfig(raw: string): Record<string, unknown> | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError) {
      // Malformed JSON — treat as "no config".
      return undefined;
    }
    throw err;
  }
  return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
}

function readFirebaseWebConfig(): Record<string, unknown> | undefined {
  const base64 = process.env.FIREBASE_WEB_APP_CONFIG_BASE64;
  if (base64) {
    const parsed = parseJsonConfig(Buffer.from(base64, "base64").toString("utf8"));
    if (parsed) return parsed;
  }

  const inline = process.env.FIREBASE_WEBAPP_CONFIG;
  if (inline) {
    const parsed = parseJsonConfig(inline);
    if (parsed) return parsed;
  }

  return undefined;
}

function backfillFirebaseClientEnv(): void {
  const cfg = readFirebaseWebConfig();
  if (!cfg) return;

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
    "@luratha/repositories",
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
