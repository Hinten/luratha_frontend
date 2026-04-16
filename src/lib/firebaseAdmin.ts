import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const FIREBASE_ADMIN_APP_NAME = "luratha-admin-app";
const projectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
  process.env.FIREBASE_PROJECT_ID ??
  process.env.GCLOUD_PROJECT ??
  "demo-luratha";
const storageBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
  process.env.FIREBASE_STORAGE_BUCKET ??
  `${projectId}.appspot.com`;
const runningWithStorageEmulator = Boolean(
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST,
);

const adminApp =
  getApps().find((app) => app.name === FIREBASE_ADMIN_APP_NAME) ??
  initializeApp(
    {
      projectId,
      storageBucket,
      ...(runningWithStorageEmulator ? {} : { credential: applicationDefault() }),
    },
    FIREBASE_ADMIN_APP_NAME,
  );

export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
export const adminBucket = adminStorage.bucket(storageBucket);
