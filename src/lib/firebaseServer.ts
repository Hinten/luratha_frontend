// "use server";

// import { getApps, initializeApp } from "firebase/app";
// import { getFirestore } from "firebase/firestore";

// const FIREBASE_SERVER_APP_NAME = "luratha-server-app";
// const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

// const firebaseServerConfig = {
//   apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "emulator-key",
//   authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "localhost",
//   projectId: firebaseProjectId ?? "demo-luratha",
//   storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "localhost",
//   messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "0",
//   appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:0:web:server",
// };

// const firebaseServerApp =
//   getApps().find((candidate) => candidate.name === FIREBASE_SERVER_APP_NAME) ??
//   initializeApp(firebaseServerConfig, FIREBASE_SERVER_APP_NAME);

// export const dbServer = getFirestore(firebaseServerApp);

// enforces that this code can only be called on the server
// https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#keeping-server-only-code-out-of-the-client-environment
import "server-only";

import { cookies } from "next/headers";
import { initializeServerApp, initializeApp } from "firebase/app";

import { getAuth } from "firebase/auth";

// Returns an authenticated client SDK instance for use in Server Side Rendering
// and Static Site Generation
export async function getAuthenticatedAppForUser() {
  const authIdToken = (await cookies()).get("__session")?.value;

  // Firebase Server App is a new feature in the JS SDK that allows you to
  // instantiate the SDK with credentials retrieved from the client & has
  // other affordances for use in server environments.
  const firebaseServerApp = initializeServerApp(
    // https://github.com/firebase/firebase-js-sdk/issues/8863#issuecomment-2751401913
    initializeApp(),
    {
      authIdToken,
    }
  );

  const auth = getAuth(firebaseServerApp);
  await auth.authStateReady();

  return { firebaseServerApp, currentUser: auth.currentUser };
}
