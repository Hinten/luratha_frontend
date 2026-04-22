import { existsSync, readFileSync } from "node:fs";
import { applicationDefault, cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  applyEmulatorEnvironmentDefaults,
  getFirebaseProjectId,
  getFirebaseStorageBucket,
  isEmulatorEnabled,
} from "./environment";

const FIREBASE_ADMIN_APP_NAME = "luratha-admin-app";

applyEmulatorEnvironmentDefaults();

const projectId = getFirebaseProjectId();
const storageBucket = getFirebaseStorageBucket(projectId);
const runningWithEmulator = isEmulatorEnabled();
const serviceAccount = getServiceAccountFromEnvironment();

const adminApp =
  getApps().find((app) => app.name === FIREBASE_ADMIN_APP_NAME) ??
  initializeApp(
    {
      projectId,
      storageBucket,
      ...(runningWithEmulator
        ? {}
        : {
            credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
          }),
    },
    FIREBASE_ADMIN_APP_NAME,
  );

export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
export const adminBucket = adminStorage.bucket(storageBucket);

function getServiceAccountFromEnvironment(): ServiceAccount | undefined {
  const inlineCredential = parseServiceAccount(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    "FIREBASE_SERVICE_ACCOUNT_JSON",
  );
  if (inlineCredential) {
    return inlineCredential;
  }

  const serviceAccountSource = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? "FIREBASE_SERVICE_ACCOUNT_PATH"
    : "GOOGLE_APPLICATION_CREDENTIALS";
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!serviceAccountPath) {
    return undefined;
  }

  if (!existsSync(serviceAccountPath)) {
    throw new Error(
      `Firebase service account file not found at "${serviceAccountPath}" (from ${serviceAccountSource}).`,
    );
  }

  const fileContents = readFileSync(serviceAccountPath, "utf8");
  return parseServiceAccount(fileContents, `service account file ${serviceAccountPath}`);
}

function parseServiceAccount(rawValue: string | undefined, sourceLabel: string): ServiceAccount | undefined {
  if (!rawValue?.trim()) {
    return undefined;
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch (error) {
    const parseMessage = error instanceof Error ? error.message : "unknown parse error";
    throw new Error(
      `Invalid ${sourceLabel}. Expected JSON with client_email/private_key (and optional project_id). ${parseMessage}`,
    );
  }

  if (!parsedValue || typeof parsedValue !== "object") {
    throw new Error(`Invalid ${sourceLabel}. Expected a JSON object.`);
  }

  const credential = parsedValue as Record<string, unknown>;
  const clientEmail = getString(credential.client_email);
  const privateKey = getString(credential.private_key);
  if (!clientEmail || !privateKey) {
    throw new Error(`Invalid ${sourceLabel}. Missing required fields client_email/private_key.`);
  }

  return {
    projectId: getString(credential.project_id),
    clientEmail,
    privateKey,
  };
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
