import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_FIREBASE_PROJECT_ID,
  getFirebaseProjectId,
  isEmulatorEnabled,
  isTruthyEnv,
} from "@/src/lib/firestore/environment";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("firebase environment", () => {
  it("detects emulator mode from USE_EMULATOR=TRUE", () => {
    process.env.USE_EMULATOR = "TRUE";
    delete process.env.NEXT_PUBLIC_USE_EMULATOR;

    expect(isEmulatorEnabled()).toBe(true);
  });

  it("supports lowercase and numeric true values", () => {
    expect(isTruthyEnv("true")).toBe(true);
    expect(isTruthyEnv("1")).toBe(true);
    expect(isTruthyEnv("on")).toBe(true);
    expect(isTruthyEnv("TRUE")).toBe(true);
    expect(isTruthyEnv("false")).toBe(false);
  });

  it("falls back to the shared default project id", () => {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    delete process.env.GCLOUD_PROJECT;

    expect(getFirebaseProjectId()).toBe(DEFAULT_FIREBASE_PROJECT_ID);
  });
});
