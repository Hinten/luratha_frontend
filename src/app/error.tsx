"use client";

import Link from "next/link";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div
      className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-24 text-center"
      style={{ backgroundColor: "var(--color-neutral-light)" }}
    >
      {/* Decorative accent */}
      <div
        className="w-16 h-1 rounded-full mb-8"
        style={{ backgroundColor: "var(--color-primary)" }}
      />

      <h1
        className="text-4xl md:text-5xl font-bold mb-4 leading-tight"
        style={{
          fontFamily: "var(--font-heading)",
          color: "var(--color-neutral-dark)",
        }}
      >
        Algo deu errado
      </h1>

      <p
        className="text-base md:text-lg mb-10 max-w-md leading-relaxed"
        style={{
          fontFamily: "var(--font-body)",
          color: "var(--color-neutral-dark)",
          opacity: 0.75,
        }}
      >
        {error.message || "Encontramos um problema inesperado. Tente novamente em instantes."}
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button
          onClick={reset}
          className="px-8 py-4 rounded-3xl font-medium transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
          style={{
            color: "var(--color-neutral-dark)",
            fontFamily: "var(--font-body)",
          }}
        >
          Tentar novamente
        </button>

        <Link
          href="/"
          className="px-8 py-4 rounded-3xl font-medium transition-all duration-300 border hover:-translate-y-0.5"
          style={{
            borderColor: "var(--color-secondary)",
            color: "var(--color-neutral-dark)",
            fontFamily: "var(--font-body)",
          }}
        >
          Voltar para o início
        </Link>
      </div>

      {/* Decorative accent bottom */}
      <div
        className="w-16 h-1 rounded-full mt-8"
        style={{ backgroundColor: "var(--color-secondary)" }}
      />
    </div>
  );
}
