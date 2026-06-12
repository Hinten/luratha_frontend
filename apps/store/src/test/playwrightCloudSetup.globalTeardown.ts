import { clearE2eFixtures, shouldKeepE2eFixtures } from "./seedE2eCloudFirestore";
import { logger } from "@luratha/core/logging/logger";

export default async function playwrightCloudGlobalTeardown(): Promise<void> {
  // The parallel CI lanes export E2E_KEEP_FIXTURES=1 so a lane that finishes
  // first doesn't delete the shared, deterministic fixtures out from under a
  // still-running lane. Fixtures use stable IDs and are re-seeded (idempotent
  // upsert) by every run, so they don't accumulate; `clear-e2e-fixtures` wipes
  // them on demand. Local runs leave the flag unset and clean up here.
  if (shouldKeepE2eFixtures()) {
    logger.info("[playwrightCloudGlobalTeardown] E2E_KEEP_FIXTURES=1 — skipping fixture clear");
    return;
  }
  // Log the failure (so it surfaces in CI output even if Playwright suppresses
  // the rethrow) and then propagate — leftover fixtures from a broken
  // teardown otherwise compound across runs.
  try {
    await clearE2eFixtures();
  } catch (error) {
    logger.warn("[playwrightCloudGlobalTeardown] failed to clear fixtures", { error });
    throw error;
  }
}
