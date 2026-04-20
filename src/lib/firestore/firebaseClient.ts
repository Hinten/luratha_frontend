"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeClientEmulatorConnections } from "./emulator";
import { getFirebaseWebConfig } from "./environment";

const app =
  getApps().find((candidate) => candidate.name === "[DEFAULT]") ??
  initializeApp(getFirebaseWebConfig());

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

initializeClientEmulatorConnections({ auth, db, storage });
