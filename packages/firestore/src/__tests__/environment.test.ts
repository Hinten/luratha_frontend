import { afterEach, describe, expect, it } from "vitest";
import {
  DATABASE_NAME,
  DEFAULT_FIREBASE_PROJECT_ID,
  getFirebaseProjectId,
  getFirebaseStorageBucket,
  getFirebaseWebConfig,
} from "@luratha/firestore/environment";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("firebase environment", () => {
  it("falls back to the shared default project id", () => {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    delete process.env.GCLOUD_PROJECT;

    expect(getFirebaseProjectId()).toBe(DEFAULT_FIREBASE_PROJECT_ID);
  });

  it("uses the Firestore Enterprise default database name", () => {
    expect(DATABASE_NAME).toBe("default");
  });

  it("derives the storage bucket from the project id", () => {
    delete process.env.FIREBASE_STORAGE_BUCKET;
    delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    expect(getFirebaseStorageBucket("luratha-test")).toBe("luratha-test.appspot.com");
  });

  it("reads the web config from NEXT_PUBLIC_* env vars when no base64 is provided", () => {
    delete process.env.FIREBASE_WEB_APP_CONFIG_BASE64;
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "luratha-test";
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "fake-api-key";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "luratha-test.firebaseapp.com";

    const config = getFirebaseWebConfig();
    expect(config.projectId).toBe("luratha-test");
    expect(config.apiKey).toBe("fake-api-key");
    expect(config.authDomain).toBe("luratha-test.firebaseapp.com");
  });
});
