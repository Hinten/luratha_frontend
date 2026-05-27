import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { adminAuth } from "@luratha/firestore/firebaseAdmin";
import { FirebaseAuthError } from "firebase-admin/auth";

const FIXTURE_EMAIL = "e2e-checkout-fixture@luratha.test";
const FIXTURE_NAME = "E2E Checkout Fixture";
const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

export const E2E_FIXTURE_STORAGE_STATE_PATH = path.resolve(
  process.cwd(),
  "playwright/.auth/storageState.json",
);

/**
 * Garante um usuário fixture estável no projeto Firebase Auth de teste e
 * grava em `storageState.json` o cookie `__session` correspondente — o mesmo
 * cookie que o `POST /api/auth/session` produz em produção.
 *
 * Tudo é idempotente: reusa o user entre runs do CI (sem acumular lixo) e o
 * cookie é regerado a cada setup (válido por 14 dias, mas só usado dentro do
 * job atual).
 *
 * Retorna o `uid` do fixture user, exposto pros specs via env
 * `E2E_FIXTURE_UID`.
 */
export async function setupE2eAuthFixture(): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[E2E auth fixture] NEXT_PUBLIC_FIREBASE_API_KEY ausente — necessário " +
        "para trocar customToken por idToken via Identity Toolkit.",
    );
  }

  const uid = await ensureFixtureUser();
  const customToken = await adminAuth.createCustomToken(uid);
  const idToken = await exchangeCustomTokenForIdToken(customToken, apiKey);
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  });

  await writeStorageState(sessionCookie);
  return uid;
}

async function ensureFixtureUser(): Promise<string> {
  try {
    const existing = await adminAuth.getUserByEmail(FIXTURE_EMAIL);
    return existing.uid;
  } catch (err) {
    if (err instanceof FirebaseAuthError && err.code === "auth/user-not-found") {
      const created = await adminAuth.createUser({
        email: FIXTURE_EMAIL,
        emailVerified: true,
        displayName: FIXTURE_NAME,
        password: "fixture-password-not-used",
      });
      return created.uid;
    }
    throw err;
  }
}

async function exchangeCustomTokenForIdToken(
  customToken: string,
  apiKey: string,
): Promise<string> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `[E2E auth fixture] signInWithCustomToken falhou: ${res.status} ${detail}`,
    );
  }
  const data = (await res.json()) as { idToken?: string };
  if (!data.idToken) {
    throw new Error("[E2E auth fixture] resposta sem idToken.");
  }
  return data.idToken;
}

async function writeStorageState(sessionCookie: string): Promise<void> {
  const expiresUnix = Math.floor((Date.now() + SESSION_DURATION_MS) / 1000);
  const storageState = {
    cookies: [
      {
        name: "__session",
        value: sessionCookie,
        domain: "localhost",
        path: "/",
        expires: expiresUnix,
        httpOnly: true,
        secure: true,
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };
  await mkdir(path.dirname(E2E_FIXTURE_STORAGE_STATE_PATH), { recursive: true });
  await writeFile(
    E2E_FIXTURE_STORAGE_STATE_PATH,
    JSON.stringify(storageState, null, 2),
    "utf8",
  );
}
