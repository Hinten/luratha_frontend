import { connectAuthEmulator, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { connectStorageEmulator, type FirebaseStorage } from "firebase/storage";
import {
  applyEmulatorEnvironmentDefaults,
  getAuthEmulatorHost,
  getFirestoreEmulatorHost,
  getStorageEmulatorHost,
  parseHostAndPort,
  isEmulatorEnabled,
} from "./environment";

type ClientEmulatorConnections = {
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
};

export function initializeClientEmulatorConnections(connections: ClientEmulatorConnections): void {
  if (!isEmulatorEnabled() || typeof window === "undefined") {
    return;
  }

  applyEmulatorEnvironmentDefaults();

  const authHost = getAuthEmulatorHost();
  const firestoreHost = getFirestoreEmulatorHost();
  const storageHost = getStorageEmulatorHost();

  const { host: authHostname, port: authPort } = parseHostAndPort(authHost, "FIREBASE_AUTH_EMULATOR_HOST");
  const { host: firestoreHostname, port: firestorePort } = parseHostAndPort(
    firestoreHost,
    "FIRESTORE_EMULATOR_HOST",
  );
  const { host: storageHostname, port: storagePort } = parseHostAndPort(
    storageHost,
    "FIREBASE_STORAGE_EMULATOR_HOST",
  );

  connectAuthEmulatorSafely(connections.auth, `http://${authHostname}:${authPort}`);
  connectFirestoreEmulatorSafely(connections.db, firestoreHostname, firestorePort);
  connectStorageEmulatorSafely(connections.storage, storageHostname, storagePort);
}

export function initializeServerFirestoreEmulator(db: Firestore): void {
  if (!isEmulatorEnabled()) {
    return;
  }

  applyEmulatorEnvironmentDefaults();

  const { host, port } = parseHostAndPort(getFirestoreEmulatorHost(), "FIRESTORE_EMULATOR_HOST");
  connectFirestoreEmulatorSafely(db, host, port);
}

function connectAuthEmulatorSafely(authInstance: Auth, url: string): void {
  try {
    connectAuthEmulator(authInstance, url, { disableWarnings: true });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.toLowerCase().includes("already")) {
      throw error;
    }
  }
}

function connectFirestoreEmulatorSafely(
  firestoreInstance: Firestore,
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
  storageInstance: FirebaseStorage,
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
