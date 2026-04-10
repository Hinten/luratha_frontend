"use client";

import Link from "next/link";
import styles from "./error.module.css";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className={styles.wrapper}>
      {/* Decorative accent */}
      <div className={styles.accent} />

      <h1 className={styles.heading}>Algo deu errado</h1>

      <p className={styles.description}>
        {error.message || "Encontramos um problema inesperado. Tente novamente em instantes."}
      </p>

      <div className={styles.actions}>
        <button
          onClick={reset}
          className={styles.btnPrimary}
        >
          Tentar novamente
        </button>

        <Link
          href="/"
          className={styles.btnSecondary}
        >
          Voltar para o início
        </Link>
      </div>

      {/* Decorative accent bottom */}
      <div className={styles.accentSecondary} />
    </div>
  );
}

