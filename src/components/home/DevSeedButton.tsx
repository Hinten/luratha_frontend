"use client";

import { useState } from "react";
import styles from "./DevSeedButton.module.css";

type DevSeedButtonProps = {
  enabled: boolean;
};

type SeedStatus = "idle" | "loading" | "success" | "error";

export default function DevSeedButton({ enabled }: DevSeedButtonProps) {
  const [status, setStatus] = useState<SeedStatus>("idle");
  const [message, setMessage] = useState("");

  if (!enabled) {
    return null;
  }

  async function handleSeedMockData() {
    setStatus("loading");
    setMessage("Cadastrando categorias e produtos mock...");

    try {
      const response = await fetch("/api/dev/seed-mock-data", { method: "POST" });
      const payload = parseSeedResponse(await response.json());

      if (!response.ok) {
        throw new Error(payload.message ?? "Falha ao cadastrar dados mock.");
      }

      setStatus("success");
      setMessage(
        `Seed concluído: ${payload.categoriesCreated ?? 0} categorias e ${payload.productsCreated ?? 0} produtos criados.`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Falha ao cadastrar dados mock.");
    }
  }

  return (
    <section className={`container-luratha section-padding ${styles.wrapper}`}>
      <div className={styles.content}>
        <h2 className={styles.title}>Modo desenvolvimento</h2>
        <p className={styles.description}>
          Clique no botão para cadastrar categorias e produtos mock no Firestore.
        </p>
        <button
          type="button"
          className={styles.button}
          onClick={handleSeedMockData}
          disabled={status === "loading"}
        >
          {status === "loading" ? "Cadastrando..." : "Cadastrar dados mock"}
        </button>
        {message && (
          <p className={status === "error" ? styles.errorMessage : styles.successMessage}>{message}</p>
        )}
      </div>
    </section>
  );
}

function parseSeedResponse(input: unknown): {
  message?: string;
  categoriesCreated?: number;
  productsCreated?: number;
} {
  if (!input || typeof input !== "object") {
    return {};
  }

  const payload = input as Record<string, unknown>;
  return {
    message: typeof payload.message === "string" ? payload.message : undefined,
    categoriesCreated:
      typeof payload.categoriesCreated === "number" ? payload.categoriesCreated : undefined,
    productsCreated: typeof payload.productsCreated === "number" ? payload.productsCreated : undefined,
  };
}
