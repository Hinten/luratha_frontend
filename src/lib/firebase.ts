/**
 * Firebase client-side initialisation.
 *
 * All config values come from environment variables — never hardcode keys here.
 * Copy .env.local.example to .env.local and fill in your Firebase project values.
 *
 * Note: the app currently uses a local AuthContext for authentication.
 * This file is prepared for future Firebase Auth migration.
 */

import { initializeApp, getApps } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "luratha-96386",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/* Connect to the Auth Emulator in local development when the flag is set */
if (
  process.env.NEXT_PUBLIC_USE_EMULATOR === "true" &&
  typeof window !== "undefined"
) {
  const authHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
  const firestoreHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const storageHost = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";

  const { hostname: authHostname, port: authPort } = parseHostAndPort(authHost);
  const { hostname: firestoreHostname, port: firestorePort } = parseHostAndPort(firestoreHost);
  const { hostname: storageHostname, port: storagePort } = parseHostAndPort(storageHost);

  connectAuthEmulatorSafely(auth, `http://${authHostname}:${authPort}`);
  connectFirestoreEmulatorSafely(db, firestoreHostname, firestorePort);
  connectStorageEmulatorSafely(storage, storageHostname, storagePort);
}

function parseHostAndPort(value: string): { hostname: string; port: number } {
  const [hostname, portString] = value.split(":");
  const port = Number(portString);

  if (!hostname || !Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid emulator host "${value}". Expected format "hostname:port".`);
  }

  return { hostname, port };
}

function connectAuthEmulatorSafely(authInstance: typeof auth, url: string): void {
  try {
    connectAuthEmulator(authInstance, url, { disableWarnings: true });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.toLowerCase().includes("already")) {
      throw error;
    }
  }
}

function connectFirestoreEmulatorSafely(
  firestoreInstance: typeof db,
  hostname: string,
  port: number,
): void {
  try {
    connectFirestoreEmulator(firestoreInstance, hostname, port);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.toLowerCase().includes("already")) {
      throw error;
    }
  }
}

function connectStorageEmulatorSafely(
  storageInstance: typeof storage,
  hostname: string,
  port: number,
): void {
  try {
    connectStorageEmulator(storageInstance, hostname, port);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.toLowerCase().includes("already")) {
      throw error;
    }
  }
}
