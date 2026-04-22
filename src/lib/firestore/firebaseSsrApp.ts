import "server-only";
import { initializeServerApp, type FirebaseServerApp } from "firebase/app";
import { getAuth, type User } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { cookies, headers } from "next/headers";
import { initializeServerFirestoreEmulator } from "./emulator";
import { applyEmulatorEnvironmentDefaults, getFirebaseWebConfig } from "./environment";

applyEmulatorEnvironmentDefaults();

const firebaseServerConfig = getFirebaseWebConfig();
const BEARER_PREFIX = "Bearer ";

type AuthenticatedAppForUser = {
  firebaseServerApp: FirebaseServerApp;
  currentUser: User | null;
  firestore: Firestore;
};

export async function getAuthenticatedAppForUser(): Promise<AuthenticatedAppForUser> {
  const requestCookies = await cookies();
  const requestHeaders = await headers();
  const authIdToken = getAuthIdTokenFromRequest({
    authHeader: requestHeaders.get("authorization") ?? requestHeaders.get("Authorization"),
    sessionCookie: requestCookies.get("__session")?.value,
  });

  const authenticatedServerApp = initializeServerApp(firebaseServerConfig, {
    authIdToken,
  });
  const firestore = getFirestore(authenticatedServerApp);
  initializeServerFirestoreEmulator(firestore);

  if (!firebaseServerConfig.apiKey) {
    if (authIdToken) {
      throw new Error(
        "NEXT_PUBLIC_FIREBASE_API_KEY is required to initialize authenticated FirebaseServerApp sessions. Set it in your .env file or deployment environment variables.",
      );
    }

    // SSR routes can still read Firestore with FirebaseServerApp without initializing Auth.
    // This avoids auth/invalid-api-key when only project-scoped server reads are needed.
    return {
      firebaseServerApp: authenticatedServerApp,
      currentUser: null,
      firestore,
    };
  }

  const auth = getAuth(authenticatedServerApp);
  await auth.authStateReady();

  return {
    firebaseServerApp: authenticatedServerApp,
    currentUser: auth.currentUser,
    firestore,
  };
}

function getAuthIdTokenFromRequest({
  authHeader,
  sessionCookie,
}: {
  authHeader: string | null;
  sessionCookie: string | undefined;
}): string | undefined {
  if (authHeader?.startsWith(BEARER_PREFIX)) {
    const token = authHeader.slice(BEARER_PREFIX.length).trim();
    if (token) {
      return token;
    }
  }

  return sessionCookie;
}
