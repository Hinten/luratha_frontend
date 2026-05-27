import { seedE2eCloudFirestore } from "./seedE2eCloudFirestore";
import { setupE2eAuthFixture } from "./e2eAuthFixture";

export default async function playwrightCloudGlobalSetup(): Promise<void> {
  const hasServiceAccount =
    !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
    !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    !!process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!hasServiceAccount) {
    console.warn(
      "[E2E] globalSetup: no Firebase credentials — skipping cloud fixture seed.",
    );
    process.env.E2E_CLOUD_SKIP = "1";
    return;
  }

  await seedE2eCloudFirestore();

  const uid = await setupE2eAuthFixture();
  process.env.E2E_FIXTURE_UID = uid;
}
