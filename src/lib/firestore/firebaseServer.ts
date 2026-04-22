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

// const firebaseServerApp =
//   getApps().find((app) => app.name === FIREBASE_SERVER_APP_NAME) ??
//   initializeApp(firebaseServerConfig, FIREBASE_SERVER_APP_NAME);

// export const dbServer = getFirestore(firebaseServerApp);

// initializeServerFirestoreEmulator(dbServer);

// ATENÇÃO, NÃO INICIALIZAR A FIREBASE POR AQUI, DEVE-SE UTILIZAR ESSA FUNÇÃO PARA OBTER AS CREDENCIAS DO CLIENT.
export async function getAuthenticatedAppForUser() {
  const authIdToken = (await cookies()).get("__session")?.value;

  const authenticatedServerApp = initializeServerApp(firebaseServerConfig, {
    authIdToken,
  });

  const auth = getAuth(authenticatedServerApp);
  await auth.authStateReady();

  return { firebaseServerApp: authenticatedServerApp, currentUser: auth.currentUser, firestore: getFirestore(authenticatedServerApp) };
}
