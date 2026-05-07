import type { NextConfig } from "next";

/**
 * Backfill NEXT_PUBLIC_FIREBASE_* into process.env from FIREBASE_WEB_APP_CONFIG_BASE64
 * BEFORE Next.js inlines them into the client bundle. Next.js prioritizes a
 * non-undefined process.env value over the `env` config field — including the
 * empty string. So we mutate process.env directly here, treating empty values
 * as "missing" and overwriting them from the base64 payload.
 */
function backfillFirebaseClientEnv(): void {
  const base64 = process.env.FIREBASE_WEB_APP_CONFIG_BASE64;
  if (!base64) {
    console.log("[next.config] FIREBASE_WEB_APP_CONFIG_BASE64 not set");
    return;
  }
  console.log(
    "[next.config] Backfilling. Before:",
    JSON.stringify({
      apiKey: (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "(undef)").length,
    }),
  );

  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch (err) {
    console.warn("[next.config] base64 decode failed:", err);
    return;
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
  console.log(
    "[next.config] Backfill done. After:",
    JSON.stringify({
      apiKey: (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "(undef)").length,
      authDomain: (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "(undef)").length,
    }),
  );
}

backfillFirebaseClientEnv();

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["firebase", "firebase-admin"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
};

export default nextConfig;
