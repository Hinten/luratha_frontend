import "server-only";
import { initializeServerApp, type FirebaseServerApp } from "firebase/app";
import { getAuth, type User } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { headers } from "next/headers";
import { DATABASE_NAME, getFirebaseWebConfig } from "./environment";

const firebaseServerConfig = getFirebaseWebConfig();
const BEARER_PREFIX = "Bearer ";

type AuthenticatedAppForUser = {
  firebaseServerApp: FirebaseServerApp;
  currentUser: User | null;
  firestore: Firestore;
};

/**
 * Initializes a FirebaseServerApp for SSR Firestore reads.
 *
 * Auth: only honors a Bearer `Authorization` header (a real Firebase ID token).
 * The `__session` cookie used by our app is a *session cookie* — a different
 * format from ID tokens — so passing it to `initializeServerApp({ authIdToken })`
 * would fail with `auth/invalid-user-token`. For per-user server logic, use
 * `requireUser()` from `@luratha/auth/requireUser` to read the session cookie
 * and then use the admin SDK (`adminDb`) to fetch data on behalf of that user.
 */
export async function getAuthenticatedAppForUser(): Promise<AuthenticatedAppForUser> {
  const requestHeaders = await headers();
  const authIdToken = getBearerToken(
    requestHeaders.get("authorization") ?? requestHeaders.get("Authorization"),
  );

  const authenticatedServerApp = initializeServerApp(firebaseServerConfig, {
    authIdToken,
  });
  const firestore = getFirestore(authenticatedServerApp, DATABASE_NAME);

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

  if (!authIdToken) {
    // No Bearer header — skip Auth init entirely; the page just needs Firestore.
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

function getBearerToken(authHeader: string | null): string | undefined {
  if (!authHeader?.startsWith(BEARER_PREFIX)) return undefined;
  const token = authHeader.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : undefined;
}
