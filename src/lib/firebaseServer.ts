import "server-only";
import { getApps, initializeServerApp, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { cookies } from "next/headers";
import { getAuth } from "firebase/auth";


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
  getApps()[0] ??
  initializeApp(firebaseServerConfig);
  


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


export async function getAuthenticatedAppForUser() {
  const authIdToken = (await cookies()).get("__session")?.value;

  // Firebase Server App is a new feature in the JS SDK that allows you to
  // instantiate the SDK with credentials retrieved from the client & has
  // other affordances for use in server environments.
  const firebaseServerApp = initializeServerApp(
    // https://github.com/firebase/firebase-js-sdk/issues/8863#issuecomment-2751401913
    initializeApp(firebaseServerConfig),
    {
      authIdToken,
    }
  );

  const auth = getAuth(firebaseServerApp);
  await auth.authStateReady();

  return { firebaseServerApp, currentUser: auth.currentUser };
}