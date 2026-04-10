"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/src/contexts/AuthContext";
import styles from "./page.module.css";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={`container-luratha ${styles.inner}`}>
        <div className={styles.card}>
          <h1 className={styles.heading}>Criar conta</h1>
          <p className={styles.subheading}>
            Junte-se à Luratha e descubra peças feitas com amor 🌸
          </p>

          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="register-name" className={styles.label}>
                Nome completo
              </label>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                required
                placeholder="Seu nome"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-required="true"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="register-email" className={styles.label}>
                E-mail
              </label>
              <input
                id="register-email"
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
              <label htmlFor="register-password" className={styles.label}>
                Senha
              </label>
              <input
                id="register-password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Mínimo 6 caracteres"
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-required="true"
                aria-describedby="register-password-hint"
              />
              <span
                id="register-password-hint"
                className="caption"
                style={{ color: "color-mix(in srgb, var(--color-neutral-dark) 50%, transparent)" }}
              >
                Use pelo menos 6 caracteres.
              </span>
            </div>

            <div className={styles.field}>
              <label htmlFor="register-confirm-password" className={styles.label}>
                Confirmar senha
              </label>
              <input
                id="register-confirm-password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="Repita a senha"
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
              {loading ? "Cadastrando…" : "Criar conta"}
            </button>
          </form>

          <p className={styles.footer}>
            Já tem conta?{" "}
            <Link href="/login" className={styles.footerLink}>
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
