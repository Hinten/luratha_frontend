"use client";

import { Suspense, useState, type FormEvent } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/src/contexts/AuthContext";
import { trackLogin } from "@/src/lib/analytics/ecommerce";
import styles from "./page.module.css";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      trackLogin();
      // `redirect` é um path arbitrário validado em runtime — typed routes não
      // conseguem inferi-lo estaticamente, daí o cast para `Route`.
      const target = (
        redirectParam && redirectParam.startsWith("/") ? redirectParam : "/"
      ) as Route;
      router.push(target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={`container-luratha ${styles.inner}`}>
        <div className={styles.card}>
          <h1 className={styles.heading}>Entrar</h1>
          <p className={styles.subheading}>Bem-vinda de volta à Luratha ✨</p>

          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="login-email" className={styles.label}>
                E-mail
              </label>
              <input
                id="login-email"
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

            <div className={styles.field}>
              <label htmlFor="login-password" className={styles.label}>
                Senha
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-required="true"
              />
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className={styles.footer}>
            <Link href="/esqueci-senha" className={styles.footerLink}>
              Esqueci minha senha
            </Link>
          </p>
          <p className={styles.footer}>
            Não tem conta?{" "}
            <Link href="/register" className={styles.footerLink}>
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
