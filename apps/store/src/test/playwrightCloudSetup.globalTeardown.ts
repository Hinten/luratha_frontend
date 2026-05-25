import { clearE2eFixtures } from "./seedE2eCloudFirestore";
import { serializeLogPayload } from "@luratha/core/logging/serializeLogPayload";

export default async function playwrightCloudGlobalTeardown(): Promise<void> {
  // Log the failure (so it surfaces in CI output even if Playwright suppresses
  // the rethrow) and then propagate — leftover fixtures from a broken
  // teardown otherwise compound across runs.
  try {
    await clearE2eFixtures();
  } catch (error) {
    console.warn(`[playwrightCloudGlobalTeardown] failed to clear fixtures ${serializeLogPayload({ error })}`);
    throw error;
  }
}
