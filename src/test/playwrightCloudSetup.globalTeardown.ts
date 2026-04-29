import { clearE2eFixtures } from "./seedE2eCloudFirestore";

export default async function playwrightCloudGlobalTeardown(): Promise<void> {
  try {
    await clearE2eFixtures();
  } catch (error) {
    console.warn("[playwrightCloudGlobalTeardown] failed to clear fixtures:", error);
  }
}
