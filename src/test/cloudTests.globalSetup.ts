import fs from "node:fs";

export default async function cloudGlobalSetup(): Promise<void> {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "";
  if (!credentialPath || !fs.existsSync(credentialPath)) {
    process.env.CLOUD_TEST_SKIP_REASON =
      "GOOGLE_APPLICATION_CREDENTIALS ausente ou inválido";
    return;
  }

  process.env.CLOUD_TEST_SKIP_REASON = "";
}
