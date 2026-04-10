"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

export interface AuthUser {
  name: string;
  email: string;
}

interface StoredUser {
  name: string;
  email: string;
  password: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const AUTH_KEY = "luratha_auth";
const USERS_KEY = "luratha_users";

function getStoredUsers(): StoredUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function saveStoredUsers(users: StoredUser[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  /* Restore session from localStorage on mount (SSR-safe) */
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(AUTH_KEY);
        if (raw) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setUser(JSON.parse(raw) as AuthUser);
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      if (!name.trim()) throw new Error("O nome é obrigatório.");
      if (!email.trim()) throw new Error("O e-mail é obrigatório.");
      if (!password) throw new Error("A senha é obrigatória.");
      if (password.length < 6)
        throw new Error("A senha deve ter pelo menos 6 caracteres.");

      const users = getStoredUsers();
      const exists = users.some(
        (u) => u.email.toLowerCase() === email.toLowerCase(),
      );
      if (exists) throw new Error("Este e-mail já está em uso.");

      const newUser: StoredUser = {
        name: name.trim(),
        email: email.toLowerCase(),
        password,
      };
      users.push(newUser);
      saveStoredUsers(users);

      const session: AuthUser = { name: newUser.name, email: newUser.email };
      setUser(session);
      if (typeof window !== "undefined") {
        localStorage.setItem(AUTH_KEY, JSON.stringify(session));
      }
    },
    [],
  );

  const login = useCallback(async (email: string, password: string) => {
    if (!email.trim()) throw new Error("O e-mail é obrigatório.");
    if (!password) throw new Error("A senha é obrigatória.");

    const users = getStoredUsers();
    const found = users.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password === password,
    );
    if (!found) throw new Error("E-mail ou senha incorretos.");

    const session: AuthUser = { name: found.name, email: found.email };
    setUser(session);
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_KEY);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: user !== null, login, register, logout }}
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
