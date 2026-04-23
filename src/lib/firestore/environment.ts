export const DEFAULT_FIREBASE_PROJECT_ID = "luratha-96386";
export const DEFAULT_FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
export const DEFAULT_FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
export const DEFAULT_FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";


export const FIREBASE_EMULATOR_ENV = {
  USE_EMULATOR: "TRUE",
  FIREBASE_PROJECT_ID: DEFAULT_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: DEFAULT_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_API_KEY: "test-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${DEFAULT_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${DEFAULT_FIREBASE_PROJECT_ID}.appspot.com`,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "test-sender-id",
  NEXT_PUBLIC_FIREBASE_APP_ID: "test-app-id",
  FIRESTORE_EMULATOR_HOST: DEFAULT_FIRESTORE_EMULATOR_HOST,
  FIREBASE_AUTH_EMULATOR_HOST: DEFAULT_FIREBASE_AUTH_EMULATOR_HOST,
  FIREBASE_STORAGE_EMULATOR_HOST: DEFAULT_FIREBASE_STORAGE_EMULATOR_HOST,
  NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST: DEFAULT_FIRESTORE_EMULATOR_HOST,
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: DEFAULT_FIREBASE_AUTH_EMULATOR_HOST,
  NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST: DEFAULT_FIREBASE_STORAGE_EMULATOR_HOST,
} as const;

export function isTruthyEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

export function isEmulatorEnabled(): boolean {
  return isTruthyEnv(process.env.USE_EMULATOR);
}

//levei alguns dias para entender que no firebase enterprise, o nome do banco de dados é "default" e não "(default)".
//Se o emulador estiver ativado, precisamos usar o nome correto para evitar erros de conexão.
export const DATABASE_NAME = isEmulatorEnabled() ? "(default)" : "default";

export function getFirebaseProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    process.env.GCLOUD_PROJECT ??
    DEFAULT_FIREBASE_PROJECT_ID
  );
}

export function getFirebaseStorageBucket(projectId = getFirebaseProjectId()): string {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    `${projectId}.appspot.com`
  );
}

export function getFirebaseWebConfig() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? getFirebaseProjectId();

  const firestoreConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };

  console.log("Using Firebase config:", firestoreConfig);

  return firestoreConfig;
}

export function parseHostAndPort(value: string, label: string): { host: string; port: number } {
  const [host, portString] = value.split(":");
  const port = Number(portString);

  if (!host || !Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid ${label} value "${value}". Expected format "hostname:port".`);
  }

  return { host, port };
}

export function getFirestoreEmulatorHost(): string {
  return process.env.FIRESTORE_EMULATOR_HOST ?? process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? DEFAULT_FIRESTORE_EMULATOR_HOST;
}

export function getAuthEmulatorHost(): string {
  return process.env.FIREBASE_AUTH_EMULATOR_HOST ?? process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? DEFAULT_FIREBASE_AUTH_EMULATOR_HOST;
}

export function getStorageEmulatorHost(): string {
  return process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ?? DEFAULT_FIREBASE_STORAGE_EMULATOR_HOST;
}

export function applyEmulatorEnvironmentDefaults(): void {
  if (!isEmulatorEnabled()) {
    return;
  }

  process.env.USE_EMULATOR = process.env.USE_EMULATOR ?? FIREBASE_EMULATOR_ENV.USE_EMULATOR;
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? FIREBASE_EMULATOR_ENV.FIREBASE_PROJECT_ID;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? FIREBASE_EMULATOR_ENV.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  process.env.FIRESTORE_EMULATOR_HOST =
    process.env.FIRESTORE_EMULATOR_HOST ?? process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? FIREBASE_EMULATOR_ENV.FIRESTORE_EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST ?? process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? FIREBASE_EMULATOR_ENV.FIREBASE_AUTH_EMULATOR_HOST;
  process.env.FIREBASE_STORAGE_EMULATOR_HOST =
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ?? FIREBASE_EMULATOR_ENV.FIREBASE_STORAGE_EMULATOR_HOST;

  process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST =
    process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? process.env.FIRESTORE_EMULATOR_HOST;
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? process.env.FIREBASE_AUTH_EMULATOR_HOST;
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ?? process.env.FIREBASE_STORAGE_EMULATOR_HOST;
}
