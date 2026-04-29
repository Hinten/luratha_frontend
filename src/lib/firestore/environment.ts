export const DEFAULT_FIREBASE_PROJECT_ID = "luratha-96386";

export function getFirebaseProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    process.env.GCLOUD_PROJECT ??
    DEFAULT_FIREBASE_PROJECT_ID
  );
}

// Firestore Enterprise database name. We don't use the legacy "(default)" alias.
export const DATABASE_NAME = "default";

export function getFirebaseStorageBucket(projectId = getFirebaseProjectId()): string {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    `${projectId}.appspot.com`
  );
}

export function getFirebaseWebConfig() {
  if (process.env.FIREBASE_WEB_APP_CONFIG_BASE64) {
    const decodedValue = Buffer.from(process.env.FIREBASE_WEB_APP_CONFIG_BASE64, "base64").toString("utf8");
    try {
      const parsedConfig = JSON.parse(decodedValue);
      return {
        apiKey: parsedConfig.apiKey ?? "",
        authDomain: parsedConfig.authDomain ?? "",
        projectId: parsedConfig.projectId ?? getFirebaseProjectId(),
        storageBucket: parsedConfig.storageBucket ?? "",
        messagingSenderId: parsedConfig.messagingSenderId ?? "",
        appId: parsedConfig.appId ?? "",
      };
    } catch (error) {
      console.warn(
        "Failed to parse FIREBASE_WEB_APP_CONFIG_BASE64. Ensure it's a valid base64-encoded JSON string.",
        error,
      );
    }
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? getFirebaseProjectId();

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
}
