import "server-only";
import { getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const FIREBASE_SERVER_APP_NAME = "luratha-server-app";

const firebaseServerConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "emulator-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "localhost",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "luratha-96386",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "localhost",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "0",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:0:web:server",
};

const firebaseServerApp =
  getApps().find((candidate) => candidate.name === FIREBASE_SERVER_APP_NAME) ??
  initializeApp(firebaseServerConfig, FIREBASE_SERVER_APP_NAME);

export const dbServer = getFirestore(firebaseServerApp);

const emulatorHost =
  process.env.FIRESTORE_EMULATOR_HOST ?? process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST;
const runningWithEmulator =
  process.env.NEXT_PUBLIC_USE_EMULATOR === "true" || Boolean(emulatorHost);

if (runningWithEmulator && emulatorHost) {
  const [hostname, portString] = emulatorHost.split(":");
  const port = Number(portString);

  if (!hostname || !Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid FIRESTORE_EMULATOR_HOST value "${emulatorHost}".`);
  }

  connectFirestoreEmulatorSafely(hostname, port);
}

function connectFirestoreEmulatorSafely(hostname: string, port: number): void {
  try {
    connectFirestoreEmulator(dbServer, hostname, port);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.toLowerCase().includes("already")) {
      throw error;
    }
  }
}
