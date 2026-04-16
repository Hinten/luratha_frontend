import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const FIREBASE_ADMIN_APP_NAME = "luratha-admin-app";
const projectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
  process.env.FIREBASE_PROJECT_ID ??
  process.env.GCLOUD_PROJECT ??
  "demo-luratha";

const adminApp =
  getApps().find((app) => app.name === FIREBASE_ADMIN_APP_NAME) ??
  initializeApp(
    {
      projectId,
      credential: applicationDefault(),
    },
    FIREBASE_ADMIN_APP_NAME,
  );

export const adminDb = getFirestore(adminApp);
