import { seedE2eCloudFirestore } from "./seedE2eCloudFirestore";

export default async function playwrightCloudGlobalSetup(): Promise<void> {
  const hasServiceAccount =
    !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
    !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!hasServiceAccount) {
    throw new Error(
      "Playwright cloud E2E requires Firebase admin credentials. Set FIREBASE_SERVICE_ACCOUNT_BASE64 (or GOOGLE_APPLICATION_CREDENTIALS) before running.",
    );
  }

  await seedE2eCloudFirestore();
}
