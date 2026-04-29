import "server-only";
import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { DATABASE_NAME, getFirebaseWebConfig } from "./environment";

/**
 * Server-only client Firestore instance used for pipeline searches inside
 * Next.js API routes. This is a plain (unauthenticated) Firebase app —
 * it does not bridge user auth cookies. Use `adminDb` for writes and
 * admin reads; use this instance only when you need the client SDK
 * pipeline API (which is not available in `firebase-admin/firestore`).
 */

const SEARCH_APP_NAME = "luratha-search-server-app";

const _app =
  getApps().find((a) => a.name === SEARCH_APP_NAME) ??
  initializeApp(getFirebaseWebConfig(), SEARCH_APP_NAME);

export const searchDb = getFirestore(_app, DATABASE_NAME);
