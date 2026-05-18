import { randomUUID } from "node:crypto";
import { describe } from "vitest";

const cloudEnabled = process.env.RUN_CLOUD_TESTS === "true";
const hasSkipReason =
  process.env.CLOUD_TEST_SKIP_REASON && process.env.CLOUD_TEST_SKIP_REASON.length > 0;

export const describeCloud = cloudEnabled && !hasSkipReason ? describe : describe.skip;

export function createCloudTestPrefix(): string {
  return `__test_${Date.now()}_${randomUUID().slice(0, 8)}`;
}
