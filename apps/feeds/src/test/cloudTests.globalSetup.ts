import { getFirebaseWebConfig } from "@luratha/firestore/environment";

export default async function cloudGlobalSetup(): Promise<void> {
  // Validate that a service account credential source is available.
  // firebaseAdmin.ts reads FIREBASE_SERVICE_ACCOUNT_BASE64 / FIREBASE_SERVICE_ACCOUNT_JSON /
  // FIREBASE_SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS directly on import.
  const hasServiceAccount =
    !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
    !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!hasServiceAccount) {
    process.env.CLOUD_TEST_SKIP_REASON =
      "FIREBASE_SERVICE_ACCOUNT_BASE64 ou GOOGLE_APPLICATION_CREDENTIALS ausentes";
    return;
  }

  const webConfig = getFirebaseWebConfig();
  if (!webConfig.projectId) {
    process.env.CLOUD_TEST_SKIP_REASON =
      "FIREBASE_WEB_APP_CONFIG_BASE64 ou NEXT_PUBLIC_FIREBASE_PROJECT_ID ausentes";
    return;
  }

  process.env.CLOUD_TEST_SKIP_REASON = "";
}
