export const DEFAULT_FIREBASE_PROJECT_ID = "luratha-96386";

// `||` (rather than `??`) is intentional throughout this file: when env vars
// come from GitHub Actions secrets that are not yet configured, the runner
// resolves them to empty strings (not undefined), and we want those to fall
// back to the next option just like a missing var.

export function getFirebaseProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    DEFAULT_FIREBASE_PROJECT_ID
  );
}

// Firestore Enterprise database name. We don't use the legacy "(default)" alias.
export const DATABASE_NAME = "default";

export function getFirebaseStorageBucket(projectId = getFirebaseProjectId()): string {
  if (process.env.FIREBASE_STORAGE_BUCKET) {
    return process.env.FIREBASE_STORAGE_BUCKET;
  }
  if (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    return process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  }
  const webConfigBucket = readWebConfigFromEnv()?.storageBucket;
  if (typeof webConfigBucket === "string" && webConfigBucket.length > 0) {
    return webConfigBucket;
  }
  return `${projectId}.appspot.com`;
}

type RawFirebaseWebConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

/**
 * Resolves the Firebase web (client SDK) config from the environment.
 *
 * Two encodings are supported:
 * - `FIREBASE_WEB_APP_CONFIG_BASE64` — base64-encoded JSON, used by CI and the
 *   cloud test suites.
 * - `FIREBASE_WEBAPP_CONFIG` — plain JSON, the variable Firebase App Hosting
 *   populates automatically at build and runtime.
 */
function readWebConfigFromEnv(): RawFirebaseWebConfig | undefined {
  const base64 = process.env.FIREBASE_WEB_APP_CONFIG_BASE64;
  if (base64) {
    const parsed = parseWebConfigJson(
      Buffer.from(base64, "base64").toString("utf8"),
      "FIREBASE_WEB_APP_CONFIG_BASE64",
    );
    if (parsed) return parsed;
  }

  const inline = process.env.FIREBASE_WEBAPP_CONFIG;
  if (inline) {
    const parsed = parseWebConfigJson(inline, "FIREBASE_WEBAPP_CONFIG");
    if (parsed) return parsed;
  }

  return undefined;
}

function parseWebConfigJson(raw: string, source: string): RawFirebaseWebConfig | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) {
      // Malformed JSON — fall back to the next config source.
      console.warn(`Failed to parse ${source}. Expected a valid JSON object.`, error);
      return undefined;
    }
    throw error;
  }
  return parsed && typeof parsed === "object" ? (parsed as RawFirebaseWebConfig) : undefined;
}

export function getFirebaseWebConfig() {
  const fromEnv = readWebConfigFromEnv();
  if (fromEnv) {
    return {
      apiKey: fromEnv.apiKey || "",
      authDomain: fromEnv.authDomain || "",
      projectId: fromEnv.projectId || getFirebaseProjectId(),
      storageBucket: fromEnv.storageBucket || "",
      messagingSenderId: fromEnv.messagingSenderId || "",
      appId: fromEnv.appId || "",
    };
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || getFirebaseProjectId();

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  };
}
