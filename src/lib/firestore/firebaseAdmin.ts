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
  const inlineCredential = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (inlineCredential) {
    return inlineCredential;
  }

  const credentialsPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    return undefined;
  }

  if (!existsSync(credentialsPath)) {
    throw new Error(
      `Firebase service account file not found at "${credentialsPath}" (from FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS).`,
    );
  }

  const fileContents = readFileSync(credentialsPath, "utf8");
  const fileCredential = parseServiceAccount(fileContents);
  if (!fileCredential) {
    throw new Error(`Invalid Firebase service account JSON in file: ${credentialsPath}`);
  }

  return fileCredential;
}

function parseServiceAccount(rawValue: string | undefined): ServiceAccount | undefined {
  if (!rawValue?.trim()) {
    return undefined;
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON value. It must be valid JSON.");
  }

  if (!parsedValue || typeof parsedValue !== "object") {
    return undefined;
  }

  const credential = parsedValue as Record<string, unknown>;
  const clientEmail = getString(credential.client_email);
  const privateKey = getString(credential.private_key);
  if (!clientEmail || !privateKey) {
    return undefined;
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
