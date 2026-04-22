import "server-only";
import { initializeServerApp, type FirebaseServerApp } from "firebase/app";
import { getAuth, type User } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { cookies, headers } from "next/headers";
import { initializeServerFirestoreEmulator } from "./emulator";
import { applyEmulatorEnvironmentDefaults, getFirebaseWebConfig } from "./environment";

applyEmulatorEnvironmentDefaults();

const firebaseServerConfig = getFirebaseWebConfig();

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
  const bearerPrefix = "Bearer ";
  if (authHeader?.startsWith(bearerPrefix)) {
    const token = authHeader.slice(bearerPrefix.length).trim();
    if (token) {
      return token;
    }
  }

  return sessionCookie;
}
