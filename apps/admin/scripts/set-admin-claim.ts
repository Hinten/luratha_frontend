/**
 * Concede (ou revoga) a custom claim `admin` de uma conta do Firebase Auth.
 *
 *   pnpm --filter @luratha/admin grant-admin <email>
 *   pnpm --filter @luratha/admin grant-admin <email> --revoke
 *
 * Requer credenciais do Firebase no `.env` da raiz do monorepo
 * (FIREBASE_SERVICE_ACCOUNT_BASE64 / FIREBASE_SERVICE_ACCOUNT_PATH /
 * GOOGLE_APPLICATION_CREDENTIALS). É a forma de provisionar o primeiro
 * administrador — o login do admin lê a claim no `verifyIdToken`.
 *
 * O usuário precisa sair e entrar de novo para a claim passar a valer.
 */
import { FirebaseAuthError } from "firebase-admin/auth";
import { loadRootEnv } from "../loadRootEnv";

async function main(): Promise<void> {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");

  if (!email || email.startsWith("--")) {
    console.error(
      "Uso: pnpm --filter @luratha/admin grant-admin <email> [--revoke]",
    );
    process.exit(1);
  }

  // Carrega o .env da raiz ANTES de importar firebaseAdmin, que inicializa o
  // Admin SDK lendo as credenciais do ambiente no momento do import.
  loadRootEnv();
  const { adminAuth } = await import("@luratha/firestore/firebaseAdmin");

  let user;
  try {
    user = await adminAuth.getUserByEmail(email);
  } catch (err) {
    if (err instanceof FirebaseAuthError && err.code === "auth/user-not-found") {
      console.error(`Nenhum usuário encontrado com o e-mail ${email}.`);
      process.exit(1);
    }
    throw err;
  }

  const claims: Record<string, unknown> = { ...(user.customClaims ?? {}) };
  if (revoke) {
    delete claims.admin;
  } else {
    claims.admin = true;
  }
  await adminAuth.setCustomUserClaims(user.uid, claims);

  console.log(
    `${revoke ? "Revogado" : "Concedido"} acesso admin para ${email} (uid ${user.uid}).`,
  );
  console.log("O usuário precisa sair e entrar de novo para a claim valer.");
}

main();
