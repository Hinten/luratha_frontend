"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CheckoutError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[checkout] route error", error);
  }, [error]);

  return (
    <main
      style={{
        maxWidth: 540,
        margin: "0 auto",
        padding: "4rem 1.25rem",
        textAlign: "center",
        fontFamily: "var(--font-body)",
        color: "var(--color-neutral-dark)",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "1.5rem",
          marginBottom: "0.75rem",
        }}
      >
        Algo deu errado no checkout
      </h1>
      <p style={{ marginBottom: "1.5rem" }}>
        Tente novamente. Se o problema continuar, volte ao carrinho e refaça o
        pedido.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          backgroundColor: "var(--color-primary)",
          border: "none",
          borderRadius: 9999,
          padding: "0.75rem 1.5rem",
          fontFamily: "inherit",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Tentar novamente
      </button>
    </main>
  );
}
