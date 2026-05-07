"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { DATABASE_NAME, getFirebaseWebConfig } from "./environment";

const app: FirebaseApp =
  getApps().find((candidate) => candidate.name === "[DEFAULT]") ??
  initializeApp(getFirebaseWebConfig());

// `getAuth` validates the apiKey eagerly and throws `auth/invalid-api-key` if
// it's missing, which would break SSR/E2E renders that don't actually exercise
// auth. Defer initialization to first use.
let _auth: Auth | undefined;
export function getClientAuth(): Auth {
  if (!_auth) _auth = getAuth(app);
  return _auth;
}

export const db = getFirestore(app, DATABASE_NAME);
export const storage = getStorage(app);
