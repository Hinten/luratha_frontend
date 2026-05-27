import { adminAuth } from "@luratha/firestore/firebaseAdmin";
import { FirebaseAuthError } from "firebase-admin/auth";

export const E2E_FIXTURE_EMAIL = "e2e-checkout-fixture@luratha.test";
export const E2E_FIXTURE_PASSWORD = "fixture-checkout-senha-2026";
const FIXTURE_NAME = "E2E Checkout Fixture";

/**
 * Garante um usuário fixture estável no projeto Firebase Auth de teste e
 * normaliza a senha — sem isso, runs sucessivos com senhas diferentes nos
 * patches deste arquivo deixariam o user num estado em que o login UI falha.
 *
 * Retorna o `uid`, exposto pros specs via `process.env.E2E_FIXTURE_UID`. Em
 * cada spec, o helper de login (ver `e2e/_authHelpers.ts`) faz o sign-in
 * real via `/login` — isso popula o estado do Firebase Auth client SDK
 * (IndexedDB) que o `AuthContext` lê via `onIdTokenChanged`. Apenas o cookie
 * `__session` não basta porque o `CheckoutPage` é client component e checa
 * `useAuth().user`.
 */
export async function setupE2eAuthFixture(): Promise<string> {
  try {
    const existing = await adminAuth.getUserByEmail(E2E_FIXTURE_EMAIL);
    await adminAuth.updateUser(existing.uid, {
      password: E2E_FIXTURE_PASSWORD,
      emailVerified: true,
      displayName: FIXTURE_NAME,
    });
    return existing.uid;
  } catch (err) {
    if (err instanceof FirebaseAuthError && err.code === "auth/user-not-found") {
      const created = await adminAuth.createUser({
        email: E2E_FIXTURE_EMAIL,
        emailVerified: true,
        displayName: FIXTURE_NAME,
        password: E2E_FIXTURE_PASSWORD,
      });
      return created.uid;
    }
    throw err;
  }
}
