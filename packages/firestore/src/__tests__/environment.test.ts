import { afterEach, describe, expect, it, vi } from "vitest";
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
    delete process.env.FIREBASE_WEB_APP_CONFIG_BASE64;
    delete process.env.FIREBASE_WEBAPP_CONFIG;

    expect(getFirebaseStorageBucket("luratha-test")).toBe("luratha-test.appspot.com");
  });

  it("reads the storage bucket from FIREBASE_WEBAPP_CONFIG", () => {
    delete process.env.FIREBASE_STORAGE_BUCKET;
    delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    delete process.env.FIREBASE_WEB_APP_CONFIG_BASE64;
    process.env.FIREBASE_WEBAPP_CONFIG = JSON.stringify({
      storageBucket: "luratha-host.appspot.com",
    });

    expect(getFirebaseStorageBucket("luratha-test")).toBe("luratha-host.appspot.com");
  });

  it("reads the web config from NEXT_PUBLIC_* env vars when no JSON config is provided", () => {
    delete process.env.FIREBASE_WEB_APP_CONFIG_BASE64;
    delete process.env.FIREBASE_WEBAPP_CONFIG;
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "luratha-test";
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "fake-api-key";
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "luratha-test.firebaseapp.com";

    const config = getFirebaseWebConfig();
    expect(config.projectId).toBe("luratha-test");
    expect(config.apiKey).toBe("fake-api-key");
    expect(config.authDomain).toBe("luratha-test.firebaseapp.com");
  });

  it("reads the web config from FIREBASE_WEBAPP_CONFIG (App Hosting plain JSON)", () => {
    delete process.env.FIREBASE_WEB_APP_CONFIG_BASE64;
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    delete process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    process.env.FIREBASE_WEBAPP_CONFIG = JSON.stringify({
      apiKey: "apphosting-api-key",
      authDomain: "luratha-host.firebaseapp.com",
      projectId: "luratha-host",
      storageBucket: "luratha-host.appspot.com",
      messagingSenderId: "123456",
      appId: "1:123456:web:abc",
    });

    const config = getFirebaseWebConfig();
    expect(config.apiKey).toBe("apphosting-api-key");
    expect(config.authDomain).toBe("luratha-host.firebaseapp.com");
    expect(config.projectId).toBe("luratha-host");
    expect(config.storageBucket).toBe("luratha-host.appspot.com");
    expect(config.appId).toBe("1:123456:web:abc");
  });

  it("prefers FIREBASE_WEB_APP_CONFIG_BASE64 over FIREBASE_WEBAPP_CONFIG", () => {
    process.env.FIREBASE_WEB_APP_CONFIG_BASE64 = Buffer.from(
      JSON.stringify({ apiKey: "from-base64", projectId: "luratha-base64" }),
    ).toString("base64");
    process.env.FIREBASE_WEBAPP_CONFIG = JSON.stringify({
      apiKey: "from-webapp-config",
      projectId: "luratha-webapp",
    });

    const config = getFirebaseWebConfig();
    expect(config.apiKey).toBe("from-base64");
    expect(config.projectId).toBe("luratha-base64");
  });

  it("falls back to NEXT_PUBLIC_* when FIREBASE_WEBAPP_CONFIG is malformed", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    delete process.env.FIREBASE_WEB_APP_CONFIG_BASE64;
    process.env.FIREBASE_WEBAPP_CONFIG = "{not valid json";
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "fallback-api-key";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "luratha-fallback";

    const config = getFirebaseWebConfig();
    expect(config.apiKey).toBe("fallback-api-key");
    expect(config.projectId).toBe("luratha-fallback");
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
