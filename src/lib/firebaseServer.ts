import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const FIREBASE_SERVER_APP_NAME = "luratha-server-app";
const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const firebaseServerConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "emulator-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "localhost",
  projectId: firebaseProjectId ?? "demo-luratha",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "localhost",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "0",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:0:web:server",
};

const firebaseServerApp =
  getApps().find((candidate) => candidate.name === FIREBASE_SERVER_APP_NAME) ??
  initializeApp(firebaseServerConfig, FIREBASE_SERVER_APP_NAME);

export const dbServer = getFirestore(firebaseServerApp);
