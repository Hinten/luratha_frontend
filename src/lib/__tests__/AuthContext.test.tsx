import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { AuthProvider, useAuth } from "@/src/contexts/AuthContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts unauthenticated with no user", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("throws if useAuth is called outside AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });

  it("register creates a user and sets isAuthenticated", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.register("Ana Lima", "ana@luratha.com", "senha123");
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toMatchObject({
      name: "Ana Lima",
      email: "ana@luratha.com",
    });
  });

  it("register stores user session in localStorage", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.register("Ana Lima", "ana@luratha.com", "senha123");
    });

    const session = JSON.parse(localStorage.getItem("luratha_auth") ?? "null");
    expect(session).not.toBeNull();
    expect(session.email).toBe("ana@luratha.com");
  });

  it("register throws when email is already in use", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.register("Ana Lima", "ana@luratha.com", "senha123");
    });

    await expect(
      act(async () => {
        await result.current.register("Ana Outra", "ana@luratha.com", "outrasenha");
      }),
    ).rejects.toThrow("Este e-mail já está em uso.");
  });

  it("register throws when password is too short", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.register("Ana", "ana@luratha.com", "123");
      }),
    ).rejects.toThrow("A senha deve ter pelo menos 6 caracteres.");
  });

  it("register throws when name is missing", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.register("  ", "ana@luratha.com", "senha123");
      }),
    ).rejects.toThrow("O nome é obrigatório.");
  });

  it("login succeeds with correct credentials", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Register first
    await act(async () => {
      await result.current.register("Ana Lima", "ana@luratha.com", "senha123");
    });

    // Logout
    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);

    // Login
    await act(async () => {
      await result.current.login("ana@luratha.com", "senha123");
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.name).toBe("Ana Lima");
  });

  it("login throws with wrong password", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.register("Ana Lima", "ana@luratha.com", "senha123");
    });

    act(() => {
      result.current.logout();
    });

    await expect(
      act(async () => {
        await result.current.login("ana@luratha.com", "wrongpassword");
      }),
    ).rejects.toThrow("E-mail ou senha incorretos.");
  });

  it("login throws with non-existent email", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.login("naoexiste@luratha.com", "senha123");
      }),
    ).rejects.toThrow("E-mail ou senha incorretos.");
  });

  it("logout clears user and removes session from localStorage", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.register("Ana Lima", "ana@luratha.com", "senha123");
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem("luratha_auth")).toBeNull();
  });

  it("login is case-insensitive for email", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.register("Ana Lima", "ana@luratha.com", "senha123");
    });

    act(() => {
      result.current.logout();
    });

    await act(async () => {
      await result.current.login("ANA@LURATHA.COM", "senha123");
    });

    expect(result.current.isAuthenticated).toBe(true);
  });
});
