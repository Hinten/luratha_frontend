import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export default async function cloudGlobalSetup(): Promise<() => void> {
  let tempCredentialFile: string | null = null;

  // 1. Resolve service account credential from FIREBASE_SERVICE_ACCOUNT_BASE64
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
      const parsed = JSON.parse(decoded) as Record<string, unknown>;
      if (!parsed.client_email || !parsed.private_key) {
        throw new Error("Missing client_email or private_key in service account JSON");
      }
      // Write to temp file so GOOGLE_APPLICATION_CREDENTIALS works (used by firebase-admin ADC)
      tempCredentialFile = path.join(os.tmpdir(), `luratha-cloud-test-sa-${Date.now()}.json`);
      fs.writeFileSync(tempCredentialFile, decoded, "utf8");
      process.env.GOOGLE_APPLICATION_CREDENTIALS = tempCredentialFile;
      // Also expose as inline JSON for direct cert() usage
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = decoded;
      if (typeof parsed.project_id === "string" && parsed.project_id) {
        process.env.CLOUD_TEST_PROJECT_ID = parsed.project_id;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.env.CLOUD_TEST_SKIP_REASON = `FIREBASE_SERVICE_ACCOUNT_BASE64 inválido: ${message}`;
      return () => {};
    }
  } else {
    // Fall back to GOOGLE_APPLICATION_CREDENTIALS file path
    const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "";
    if (!credentialPath || !fs.existsSync(credentialPath)) {
      process.env.CLOUD_TEST_SKIP_REASON =
        "FIREBASE_SERVICE_ACCOUNT_BASE64 e GOOGLE_APPLICATION_CREDENTIALS ausentes ou inválidos";
      return () => {};
    }
  }

  // 2. Resolve web app config from FIREBASE_WEB_APP_CONFIG_BASE64 (required for client SDK in tests)
  if (process.env.FIREBASE_WEB_APP_CONFIG_BASE64) {
    try {
      const decoded = Buffer.from(process.env.FIREBASE_WEB_APP_CONFIG_BASE64, "base64").toString("utf8");
      const parsed = JSON.parse(decoded) as Record<string, unknown>;
      if (!parsed.projectId) {
        throw new Error("Missing projectId in web app config JSON");
      }
      process.env.CLOUD_TEST_WEB_APP_CONFIG_JSON = decoded;
      // Expose individual vars for modules that read NEXT_PUBLIC_* directly
      if (!process.env.CLOUD_TEST_PROJECT_ID && typeof parsed.projectId === "string") {
        process.env.CLOUD_TEST_PROJECT_ID = parsed.projectId;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.env.CLOUD_TEST_SKIP_REASON = `FIREBASE_WEB_APP_CONFIG_BASE64 inválido: ${message}`;
      return () => {
        if (tempCredentialFile) {
          try { fs.unlinkSync(tempCredentialFile); } catch {}
        }
      };
    }
  }

  process.env.CLOUD_TEST_SKIP_REASON = "";

  return () => {
    if (tempCredentialFile) {
      try { fs.unlinkSync(tempCredentialFile); } catch {}
    }
  };
}
