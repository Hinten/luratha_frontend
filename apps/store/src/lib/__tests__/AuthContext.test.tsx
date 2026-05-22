import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { FirebaseError } from "firebase/app";

type FirebaseAuthListener = (user: FakeFirebaseUser | null) => void | Promise<void>;

interface FakeFirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  getIdToken: (force?: boolean) => Promise<string>;
  getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }>;
}

const fakeUsers = new Map<string, { uid: string; password: string; displayName: string | null }>();
let currentUser: FakeFirebaseUser | null = null;
let listeners: FirebaseAuthListener[] = [];
let uidCounter = 0;

function emit() {
  for (const l of listeners) {
    void l(currentUser);
  }
}

function buildFakeUser(uid: string, email: string, displayName: string | null): FakeFirebaseUser {
  return {
    uid,
    email,
    displayName,
    getIdToken: async () => `id-token-${uid}`,
    getIdTokenResult: async () => ({ claims: {} }),
  };
}

vi.mock("firebase/auth", () => {
  return {
    onIdTokenChanged: (_auth: unknown, listener: FirebaseAuthListener) => {
      listeners.push(listener);
      // dispatch async para imitar Firebase
      Promise.resolve().then(() => listener(currentUser));
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
    createUserWithEmailAndPassword: vi.fn(async (_auth: unknown, email: string, password: string) => {
      const normalized = email.toLowerCase();
      if (fakeUsers.has(normalized)) {
        throw new FirebaseError("auth/email-already-in-use", "email already");
      }
      uidCounter += 1;
      const uid = `uid-${uidCounter}`;
      fakeUsers.set(normalized, { uid, password, displayName: null });
      currentUser = buildFakeUser(uid, normalized, null);
      emit();
      return { user: currentUser };
    }),
    signInWithEmailAndPassword: vi.fn(async (_auth: unknown, email: string, password: string) => {
      const normalized = email.toLowerCase();
      const found = fakeUsers.get(normalized);
      if (!found || found.password !== password) {
        throw new FirebaseError("auth/invalid-credential", "invalid");
      }
      currentUser = buildFakeUser(found.uid, normalized, found.displayName);
      emit();
      return { user: currentUser };
    }),
    signOut: vi.fn(async () => {
      currentUser = null;
      emit();
    }),
    updateProfile: vi.fn(async (user: FakeFirebaseUser, { displayName }: { displayName: string }) => {
      user.displayName = displayName;
      const stored = user.email ? fakeUsers.get(user.email) : undefined;
      if (stored) stored.displayName = displayName;
      if (currentUser?.uid === user.uid) {
        currentUser = { ...user };
        emit();
      }
    }),
    sendPasswordResetEmail: vi.fn(async () => {
      // sucesso silencioso
    }),
  };
});

vi.mock("@luratha/firestore/firebaseClient", () => ({
  getClientAuth: () => ({}),
}));

import { AuthProvider, useAuth } from "@/src/contexts/AuthContext";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

beforeEach(() => {
  fakeUsers.clear();
  currentUser = null;
  listeners = [];
  uidCounter = 0;
  localStorage.clear();
  vi.clearAllMocks();
  // Mock global fetch para /api/auth/session e /api/users/:uid
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/auth/session") || url.includes("/api/users/")) {
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 404 });
    }),
  );
});

describe("AuthContext", () => {
  it("starts unauthenticated and not loading after first auth state callback", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("throws if useAuth is called outside AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });

  it("register cria conta no Firebase e sincroniza sessão e perfil", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.register("Ana Lima", "ana@luratha.com", "senha123");
    });

    expect(createUserWithEmailAndPassword).toHaveBeenCalled();

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user).toMatchObject({
      name: "Ana Lima",
      email: "ana@luratha.com",
      isAdmin: false,
    });
    expect(result.current.user?.uid).toBeTruthy();

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const calls = fetchMock.mock.calls.map((c) => c[0]);
    expect(calls).toContain("/api/auth/session");
    expect(calls.some((c) => typeof c === "string" && c.startsWith("/api/users/"))).toBe(true);
  });

  it("register mapeia auth/email-already-in-use para mensagem amigável", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.register("Ana", "ana@luratha.com", "senha123");
    });
    await act(async () => {
      await result.current.logout();
    });

    await expect(
      act(async () => {
        await result.current.register("Outra", "ana@luratha.com", "senha456");
      }),
    ).rejects.toThrow("Este e-mail já está em uso.");
  });

  it("register exige senha com pelo menos 6 caracteres", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.register("Ana", "ana@luratha.com", "123");
      }),
    ).rejects.toThrow("A senha deve ter pelo menos 6 caracteres.");
  });

  it("register exige nome", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.register("  ", "ana@luratha.com", "senha123");
      }),
    ).rejects.toThrow("O nome é obrigatório.");
  });

  it("login chama signInWithEmailAndPassword e cria sessão", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.register("Ana Lima", "ana@luratha.com", "senha123");
    });
    await act(async () => {
      await result.current.logout();
    });

    await act(async () => {
      await result.current.login("ana@luratha.com", "senha123");
    });

    expect(signInWithEmailAndPassword).toHaveBeenCalled();
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user?.email).toBe("ana@luratha.com");
  });

  it("login mapeia credencial inválida para mensagem amigável", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.login("naoexiste@luratha.com", "qualquer");
      }),
    ).rejects.toThrow("E-mail ou senha incorretos.");
  });

  it("logout chama signOut e DELETE /api/auth/session, e zera o user", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.register("Ana Lima", "ana@luratha.com", "senha123");
    });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    expect(signOut).toHaveBeenCalled();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(
      fetchMock.mock.calls.some(
        (c) => c[0] === "/api/auth/session" && (c[1] as RequestInit | undefined)?.method === "DELETE",
      ),
    ).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("sendPasswordReset chama sendPasswordResetEmail", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendPasswordReset("ana@luratha.com");
    });

    expect(sendPasswordResetEmail).toHaveBeenCalled();
  });

  it("limpa chaves legadas de localStorage no mount", () => {
    localStorage.setItem("luratha_auth", "stale");
    localStorage.setItem("luratha_users", "stale");
    renderHook(() => useAuth(), { wrapper });
    expect(localStorage.getItem("luratha_auth")).toBeNull();
    expect(localStorage.getItem("luratha_users")).toBeNull();
  });
});
