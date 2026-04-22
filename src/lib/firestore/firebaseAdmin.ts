import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
const explicitServiceAccount = resolveServiceAccount();

const adminApp =
  getApps().find((app) => app.name === FIREBASE_ADMIN_APP_NAME) ??
  initializeApp(
    {
      projectId,
      storageBucket,
      ...(runningWithEmulator
        ? {}
        : {
            credential: explicitServiceAccount
              ? cert(explicitServiceAccount)
              : applicationDefault(),
          }),
    },
    FIREBASE_ADMIN_APP_NAME,
  );

export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
export const adminBucket = adminStorage.bucket(storageBucket);

function resolveServiceAccount(): ServiceAccount | null {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (rawJson) {
    return parseServiceAccountJson(rawJson);
  }

  const credentialsPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!credentialsPath) {
    return null;
  }

  const filePath = resolve(credentialsPath);
  const fileContent = readFileSync(filePath, "utf8");
  return parseServiceAccountJson(fileContent);
}

function parseServiceAccountJson(content: string): ServiceAccount {
  const parsed = JSON.parse(content) as ServiceAccount;
  return {
    ...parsed,
    privateKey: parsed.privateKey?.replace(/\\n/g, "\n"),
  };
}
