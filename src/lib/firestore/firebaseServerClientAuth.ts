import "server-only";
import { initializeServerApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { cookies } from "next/headers";
import { applyEmulatorEnvironmentDefaults, getFirebaseWebConfig } from "./environment";

applyEmulatorEnvironmentDefaults();

const firebaseServerConfig = {
  ...getFirebaseWebConfig(),
};

/**
 * Use este módulo apenas quando o servidor precisar executar chamadas em nome do usuário autenticado.
 * Ele lê o token `__session` do cliente e inicializa um Firebase Server App autenticado.
 */
export async function getAuthenticatedAppForUser() {
  const authIdToken = (await cookies()).get("__session")?.value;

  const authenticatedServerApp = initializeServerApp(firebaseServerConfig, {
    authIdToken,
  });

  const auth = getAuth(authenticatedServerApp);
  await auth.authStateReady();

  return {
    firebaseServerApp: authenticatedServerApp,
    currentUser: auth.currentUser,
    firestore: getFirestore(authenticatedServerApp),
  };
}
