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
let emulatorConnected = false;

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/* Connect to the Auth Emulator in local development when the flag is set */
if (
  process.env.NEXT_PUBLIC_USE_EMULATOR === "true" &&
  typeof window !== "undefined" &&
  !emulatorConnected
) {
  const authHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
  const firestoreHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  const storageHost = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";

  const [authHostname, authPort] = authHost.split(":");
  connectAuthEmulator(auth, `http://${authHostname}:${Number(authPort)}`, {
    disableWarnings: true,
  });

  const [firestoreHostname, firestorePort] = firestoreHost.split(":");
  connectFirestoreEmulator(db, firestoreHostname, Number(firestorePort));

  const [storageHostname, storagePort] = storageHost.split(":");
  connectStorageEmulator(storage, storageHostname, Number(storagePort));
  emulatorConnected = true;
}
