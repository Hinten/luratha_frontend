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

  // Credentials are present — provision the composite index the feed pipeline
  // depends on (it runs with `indexMode: "recommended"`, which requires it).
  // Dynamic import so the Admin SDK is only initialised when the suite runs.
  const { ensureFeedIndex } = await import("./cloud/ensureFeedIndex");
  await ensureFeedIndex();
}
