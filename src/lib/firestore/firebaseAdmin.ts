import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
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

const adminApp =
  getApps().find((app) => app.name === FIREBASE_ADMIN_APP_NAME) ??
  initializeApp(
    {
      projectId,
      storageBucket,
      ...(runningWithEmulator ? {} : { credential: applicationDefault() }),
    },
    FIREBASE_ADMIN_APP_NAME,
  );

export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
export const adminBucket = adminStorage.bucket(storageBucket);
