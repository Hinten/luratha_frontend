"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { getClientAuth } from "@luratha/firestore/firebaseClient";
import { AuthClientError } from "@/src/lib/errors";
import { serializeLogPayload } from "@luratha/core/logging/serializeLogPayload";

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const LEGACY_AUTH_KEY = "luratha_auth";
const LEGACY_USERS_KEY = "luratha_users";

/**
 * Maps a Firebase Auth error to a human-readable `AuthClientError`. Returns
 * `null` when the error is not a `FirebaseError` with a known code — callers
 * should rethrow the original in that case so unknown failures (network bugs,
 * SDK regressions) surface in the console and ErrorBoundary instead of being
 * flattened into "Erro de autenticação".
 */
function mapFirebaseError(err: unknown): AuthClientError | null {
  if (!(err instanceof FirebaseError)) {
    return null;
  }
  switch (err.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return new AuthClientError("E-mail ou senha incorretos.");
    case "auth/invalid-email":
      return new AuthClientError("E-mail inválido.");
    case "auth/email-already-in-use":
      return new AuthClientError("Este e-mail já está em uso.");
    case "auth/weak-password":
      return new AuthClientError("A senha deve ter pelo menos 6 caracteres.");
    case "auth/too-many-requests":
      return new AuthClientError("Muitas tentativas. Tente novamente em alguns minutos.");
    case "auth/network-request-failed":
      return new AuthClientError("Falha de rede. Verifique sua conexão.");
    default:
      return null;
  }
}

async function buildAuthUser(fbUser: FirebaseUser): Promise<AuthUser> {
  const tokenResult = await fbUser.getIdTokenResult();
  const isAdmin = tokenResult.claims.admin === true;
  return {
    uid: fbUser.uid,
    name: fbUser.displayName ?? (fbUser.email ?? "").split("@")[0] ?? "",
    email: fbUser.email ?? "",
    isAdmin,
  };
}

async function postSession(idToken: string): Promise<void> {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    throw new AuthClientError("Falha ao iniciar sessão.");
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  // Tracks the uid we last propagated so we only invalidate the RSC cache on
  // identity transitions (null → user, user → null, A → B) — not on every
  // hourly token refresh from Firebase.
  const previousUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(LEGACY_AUTH_KEY);
        localStorage.removeItem(LEGACY_USERS_KEY);
      } catch (err) {
        if (!(err instanceof DOMException)) {
          throw err;
        }
        // localStorage disabled (private mode, no cookies) — legacy cleanup
        // is best-effort, so skip silently.
      }
    }

    let unsubscribe: (() => void) | undefined;
    try {
      const auth = getClientAuth();
      unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
        if (!fbUser) {
          setUser(null);
          setIsLoading(false);
          if (previousUidRef.current !== null) {
            previousUidRef.current = null;
            // Invalidate the RSC cache so Server Components below the header
            // re-render without the (now stale) session cookie.
            router.refresh();
          }
          return;
        }
        try {
          // Establish the server session cookie BEFORE exposing `user` to
          // consumers. Otherwise CartContext (and any other consumer keyed on
          // `useAuth().user`) would fire cookie-authenticated requests like
          // POST /api/cart/merge before the __session cookie reaches the
          // browser, getting 401s from `requireUser()`.
          const idToken = await fbUser.getIdToken();
          await postSession(idToken);
          const authedUser = await buildAuthUser(fbUser);
          setUser(authedUser);
          if (previousUidRef.current !== authedUser.uid) {
            previousUidRef.current = authedUser.uid;
            router.refresh();
          }
        } catch (err) {
          if (
            !(err instanceof AuthClientError) &&
            !(err instanceof TypeError) &&
            !(err instanceof FirebaseError)
          ) {
            throw err;
          }
          // postSession (AuthClientError) or fetch network (TypeError) failed —
          // sign out of the Firebase client to avoid a divergent state where
          // the client is authenticated but the server has no session cookie.
          try {
            await signOut(auth);
          } catch (signOutErr) {
            if (!(signOutErr instanceof FirebaseError)) {
              throw signOutErr;
            }
            // Already signed out — non-fatal.
          }
          setUser(null);
          console.warn("Falha ao estabelecer sessão server-side; usuário deslogado.", err);
        } finally {
          setIsLoading(false);
        }
      });
    } catch (err) {
      if (!(err instanceof FirebaseError)) {
        throw err;
      }
      console.warn(`Firebase Auth indisponível — verifique a configuração. ${serializeLogPayload({ err })}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
    }
    return () => unsubscribe?.();
  }, [router]);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new AuthClientError("O nome é obrigatório.");
      if (!email.trim()) throw new AuthClientError("O e-mail é obrigatório.");
      if (!password) throw new AuthClientError("A senha é obrigatória.");
      if (password.length < 6)
        throw new AuthClientError("A senha deve ter pelo menos 6 caracteres.");

      let credential;
      try {
        const auth = getClientAuth();
        credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(credential.user, { displayName: trimmedName });
        const idToken = await credential.user.getIdToken(true);
        await postSession(idToken);
      } catch (err) {
        const auth = (() => {
          try {
            return getClientAuth();
          } catch (innerErr) {
            if (!(innerErr instanceof FirebaseError)) {
              throw innerErr;
            }
            return null;
          }
        })();
        if (auth?.currentUser) {
          try {
            await signOut(auth);
          } catch (signOutErr) {
            if (!(signOutErr instanceof FirebaseError)) {
              throw signOutErr;
            }
            // Best-effort rollback of partial Firebase sign-up state.
          }
        }
        const mapped = mapFirebaseError(err);
        throw mapped ?? err;
      }

      try {
        const res = await fetch(`/api/users/${credential.user.uid}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: credential.user.uid,
            email: email.trim().toLowerCase(),
            firstName: trimmedName.split(" ")[0],
            lastName: trimmedName.split(" ").slice(1).join(" ") || trimmedName.split(" ")[0],
            role: "customer",
          }),
        });
        if (!res.ok) {
          // Não é fatal: o usuário pode completar o perfil em /conta/dados depois.
          console.warn("Falha ao criar perfil no signup; complete em /conta/dados.");
        }
      } catch (err) {
        if (!(err instanceof TypeError)) {
          throw err;
        }
        // fetch() throws TypeError on network failure — non-fatal here.
        console.warn("Falha de rede ao criar perfil no signup; complete em /conta/dados.");
      }
    },
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    if (!email.trim()) throw new AuthClientError("O e-mail é obrigatório.");
    if (!password) throw new AuthClientError("A senha é obrigatória.");

    try {
      const auth = getClientAuth();
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken(true);
      await postSession(idToken);
    } catch (err) {
      const mapped = mapFirebaseError(err);
      throw mapped ?? err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch (err) {
      if (!(err instanceof TypeError)) {
        throw err;
      }
      // fetch() throws TypeError on network failure — proceed to clear local
      // Firebase state anyway so the user lands in a signed-out UI.
    }
    try {
      const auth = getClientAuth();
      await signOut(auth);
    } catch (err) {
      if (!(err instanceof FirebaseError)) {
        throw err;
      }
      // Already signed out, or Firebase Auth unavailable — non-fatal here.
    }
    setUser(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!email.trim()) throw new AuthClientError("O e-mail é obrigatório.");
    try {
      const auth = getClientAuth();
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      const mapped = mapFirebaseError(err);
      throw mapped ?? err;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        login,
        register,
        logout,
        sendPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
