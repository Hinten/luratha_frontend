import type { NextConfig } from "next";

/**
 * Derive `NEXT_PUBLIC_FIREBASE_*` from `FIREBASE_WEB_APP_CONFIG_BASE64` at build
 * time so the client bundle has the apiKey/authDomain/etc. without each value
 * needing to be a separate secret. Existing `NEXT_PUBLIC_FIREBASE_*` variables
 * take precedence — this only fills in what's missing.
 */
function deriveFirebaseClientEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const base64 = process.env.FIREBASE_WEB_APP_CONFIG_BASE64;
  if (!base64) return env;

  let cfg: Record<string, unknown>;
  try {
    cfg = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    return env;
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
      env[envName] = value;
    }
  }
  return env;
}

const nextConfig: NextConfig = {
  typedRoutes: true,
  serverExternalPackages: ["firebase", "firebase-admin"],
  env: deriveFirebaseClientEnv(),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
};

export default nextConfig;
