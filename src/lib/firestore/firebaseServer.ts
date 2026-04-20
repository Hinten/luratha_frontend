import "server-only";
import { getApps, initializeApp, initializeServerApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { cookies } from "next/headers";
import { initializeServerFirestoreEmulator } from "./emulator";
import { applyEmulatorEnvironmentDefaults, getFirebaseWebConfig } from "./environment";

const FIREBASE_SERVER_APP_NAME = "luratha-server-app";

applyEmulatorEnvironmentDefaults();

const firebaseServerConfig = {
  ...getFirebaseWebConfig(),
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "emulator-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "localhost",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "localhost",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "0",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:0:web:server",
};

const firebaseServerApp =
  getApps().find((app) => app.name === FIREBASE_SERVER_APP_NAME) ??
  initializeApp(firebaseServerConfig, FIREBASE_SERVER_APP_NAME);

export const dbServer = getFirestore(firebaseServerApp);

initializeServerFirestoreEmulator(dbServer);

export async function getAuthenticatedAppForUser() {
  const authIdToken = (await cookies()).get("__session")?.value;

  const authenticatedServerApp = initializeServerApp(firebaseServerConfig, {
    authIdToken,
  });

  const auth = getAuth(authenticatedServerApp);
  await auth.authStateReady();

  return { firebaseServerApp: authenticatedServerApp, currentUser: auth.currentUser };
}
