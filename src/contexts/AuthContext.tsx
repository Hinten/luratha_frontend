"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { getClientAuth } from "@/src/lib/firestore/firebaseClient";

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

function mapFirebaseError(err: unknown): Error {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: string }).code;
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return new Error("E-mail ou senha incorretos.");
      case "auth/invalid-email":
        return new Error("E-mail inválido.");
      case "auth/email-already-in-use":
        return new Error("Este e-mail já está em uso.");
      case "auth/weak-password":
        return new Error("A senha deve ter pelo menos 6 caracteres.");
      case "auth/too-many-requests":
        return new Error("Muitas tentativas. Tente novamente em alguns minutos.");
      case "auth/network-request-failed":
        return new Error("Falha de rede. Verifique sua conexão.");
    }
  }
  return err instanceof Error ? err : new Error("Erro de autenticação.");
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
    throw new Error("Falha ao iniciar sessão.");
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(LEGACY_AUTH_KEY);
        localStorage.removeItem(LEGACY_USERS_KEY);
      } catch {
        /* ignore */
      }
    }

    let unsubscribe: (() => void) | undefined;
    try {
      const auth = getClientAuth();
      unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
        if (!fbUser) {
          setUser(null);
          setIsLoading(false);
          return;
        }
        try {
          setUser(await buildAuthUser(fbUser));
        } finally {
          setIsLoading(false);
        }
      });
    } catch (err) {
      console.warn("Firebase Auth indisponível — verifique a configuração.", err);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
    }
    return () => unsubscribe?.();
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("O nome é obrigatório.");
      if (!email.trim()) throw new Error("O e-mail é obrigatório.");
      if (!password) throw new Error("A senha é obrigatória.");
      if (password.length < 6)
        throw new Error("A senha deve ter pelo menos 6 caracteres.");

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
          } catch {
            return null;
          }
        })();
        if (auth?.currentUser) {
          try {
            await signOut(auth);
          } catch {
            /* ignore */
          }
        }
        throw mapFirebaseError(err);
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
      } catch {
        console.warn("Falha de rede ao criar perfil no signup; complete em /conta/dados.");
      }
    },
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    if (!email.trim()) throw new Error("O e-mail é obrigatório.");
    if (!password) throw new Error("A senha é obrigatória.");

    try {
      const auth = getClientAuth();
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken(true);
      await postSession(idToken);
    } catch (err) {
      throw mapFirebaseError(err);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } catch {
      /* ignore — vamos limpar no client de qualquer jeito */
    }
    try {
      const auth = getClientAuth();
      await signOut(auth);
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    if (!email.trim()) throw new Error("O e-mail é obrigatório.");
    try {
      const auth = getClientAuth();
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      throw mapFirebaseError(err);
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
