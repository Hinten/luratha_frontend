"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/src/contexts/AuthContext";
import { AuthClientError } from "@/src/lib/errors";
import styles from "./page.module.css";

export default function RecuperarSenhaPage() {
  return (
    <Suspense fallback={null}>
      <RecuperarSenhaForm />
    </Suspense>
  );
}

type Status = "verifying" | "ready" | "invalid" | "success";

function RecuperarSenhaForm() {
  const { verifyPasswordResetCode, confirmPasswordReset } = useAuth();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const mode = searchParams.get("mode");
  // Estado inicial derivado no render: sem um link de reset válido já caímos
  // direto em "invalid" (evita setState síncrono dentro do effect).
  const hasValidLink = Boolean(oobCode) && mode === "resetPassword";

  const [status, setStatus] = useState<Status>(hasValidLink ? "verifying" : "invalid");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!oobCode || mode !== "resetPassword") return;
    let active = true;
    void (async () => {
      try {
        const verifiedEmail = await verifyPasswordResetCode(oobCode);
        if (!active) return;
        setEmail(verifiedEmail);
        setStatus("ready");
      } catch (err) {
        if (err instanceof AuthClientError) {
          if (active) setStatus("invalid");
          return;
        }
        throw err;
      }
    })();
    return () => {
      active = false;
    };
  }, [oobCode, mode, verifyPasswordResetCode]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(oobCode ?? "", password);
      setStatus("success");
    } catch (err) {
      if (err instanceof AuthClientError) {
        setError(err.message);
      } else {
        throw err;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={`container-luratha ${styles.inner}`}>
        <div className={styles.card}>
          <h1 className={styles.heading}>Redefinir senha</h1>

          {status === "verifying" && (
            <p role="status" className={styles.subheading}>
              Validando seu link…
            </p>
          )}

          {status === "invalid" && (
            <>
              <p role="alert" className={styles.error}>
                Link inválido ou expirado. Solicite um novo para redefinir sua senha.
              </p>
              <p className={styles.footer}>
                <Link href="/esqueci-senha" className={styles.footerLink}>
                  Solicitar novo link
                </Link>
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <p role="status" className={styles.successBox}>
                Senha redefinida com sucesso! Você já pode entrar com a nova senha.
              </p>
              <p className={styles.footer}>
                <Link href="/login" className={styles.footerLink}>
                  Ir para o login
                </Link>
              </p>
            </>
          )}

          {status === "ready" && (
            <>
              <p className={styles.subheading}>
                Definindo uma nova senha para <strong>{email}</strong>.
              </p>

              {error && (
                <p role="alert" className={styles.error}>
                  {error}
                </p>
              )}

              <form className={styles.form} onSubmit={handleSubmit} noValidate>
                <div className={styles.field}>
                  <label htmlFor="reset-password" className={styles.label}>
                    Nova senha
                  </label>
                  <input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Mínimo 6 caracteres"
                    className={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-required="true"
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="reset-confirm-password" className={styles.label}>
                    Confirmar nova senha
                  </label>
                  <input
                    id="reset-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Repita a nova senha"
                    className={styles.input}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-required="true"
                  />
                </div>

                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={loading}
                  aria-busy={loading}
                >
                  {loading ? "Redefinindo…" : "Redefinir senha"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
