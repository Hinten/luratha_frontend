import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";

// Search params controláveis por teste.
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => searchParams,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@luratha/firestore/firebaseClient", () => ({
  getClientAuth: () => ({}),
}));

const { verifyPasswordResetCode, confirmPasswordReset } = vi.hoisted(() => ({
  verifyPasswordResetCode: vi.fn(async (..._args: unknown[]) => "ana@luratha.com"),
  confirmPasswordReset: vi.fn(async (..._args: unknown[]) => {}),
}));

vi.mock("firebase/auth", () => ({
  // AuthProvider precisa de um listener que finalize o loading.
  onIdTokenChanged: (_auth: unknown, listener: (u: null) => void) => {
    void Promise.resolve().then(() => listener(null));
    return () => {};
  },
  signOut: vi.fn(async () => {}),
  verifyPasswordResetCode,
  confirmPasswordReset,
}));

import { AuthProvider } from "@/src/contexts/AuthContext";
import RecuperarSenhaPage from "@/src/app/recuperar-senha/page";

function renderPage() {
  return render(
    <AuthProvider>
      <RecuperarSenhaPage />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
});

describe("RecuperarSenhaPage", () => {
  it("com oobCode válido mostra o form e redefine a senha", async () => {
    searchParams = new URLSearchParams({ mode: "resetPassword", oobCode: "oob-123" });
    renderPage();

    const passwordInput = await screen.findByLabelText("Nova senha");
    const confirmInput = screen.getByLabelText("Confirmar nova senha");

    fireEvent.change(passwordInput, { target: { value: "novaSenha123" } });
    fireEvent.change(confirmInput, { target: { value: "novaSenha123" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Redefinir senha" }));
    });

    expect(confirmPasswordReset).toHaveBeenCalled();
    expect(await screen.findByText(/Senha redefinida com sucesso/)).toBeInTheDocument();
  });

  it("senhas divergentes não chamam confirmPasswordReset", async () => {
    searchParams = new URLSearchParams({ mode: "resetPassword", oobCode: "oob-123" });
    renderPage();

    const passwordInput = await screen.findByLabelText("Nova senha");
    const confirmInput = screen.getByLabelText("Confirmar nova senha");

    fireEvent.change(passwordInput, { target: { value: "novaSenha123" } });
    fireEvent.change(confirmInput, { target: { value: "outraSenha456" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Redefinir senha" }));
    });

    expect(screen.getByText("As senhas não conferem.")).toBeInTheDocument();
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("sem oobCode mostra estado inválido com link para solicitar novo", async () => {
    renderPage();

    expect(await screen.findByText(/Link inválido ou expirado/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Solicitar novo link" });
    expect(link).toHaveAttribute("href", "/esqueci-senha");
    expect(verifyPasswordResetCode).not.toHaveBeenCalled();
  });
});
