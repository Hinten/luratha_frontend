"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/src/contexts/AuthContext";
import styles from "./page.module.css";

export default function EsqueciSenhaPage() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSubmitted(true);
    } catch (err) {
      // Mensagem genérica para não vazar existência do e-mail.
      setSubmitted(true);
      if (err instanceof Error && err.message === "O e-mail é obrigatório.") {
        setSubmitted(false);
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={`container-luratha ${styles.inner}`}>
        <div className={styles.card}>
          <h1 className={styles.heading}>Esqueci minha senha</h1>
          <p className={styles.subheading}>
            Vamos enviar um link de redefinição para o seu e-mail.
          </p>

          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}

          {submitted ? (
            <p role="status" className={styles.successBox}>
              Se houver uma conta com esse e-mail, enviaremos um link de redefinição
              em instantes. Verifique sua caixa de entrada.
            </p>
          ) : (
            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <div className={styles.field}>
                <label htmlFor="reset-email" className={styles.label}>
                  E-mail
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="seu@email.com"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-required="true"
                />
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? "Enviando…" : "Enviar link de redefinição"}
              </button>
            </form>
          )}

          <p className={styles.footer}>
            <Link href="/login" className={styles.footerLink}>
              Voltar para entrar
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
