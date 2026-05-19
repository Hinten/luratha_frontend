"use client";

import { useEffect, useRef, useState } from "react";
import { ApiResponseError } from "@/src/lib/errors";
import styles from "./DevSeedButton.module.css";

type DevSeedButtonProps = {
  enabled: boolean;
};

type SeedStatus = "idle" | "loading" | "success" | "error";
type SeedOperation = "seed" | "delete" | null;

export default function DevSeedButton({ enabled }: DevSeedButtonProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const iconButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<SeedStatus>("idle");
  const [operation, setOperation] = useState<SeedOperation>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!enabled || !menuOpen) {
      return;
    }

    actionButtonRef.current?.focus();

    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        requestAnimationFrame(() => {
          iconButtonRef.current?.focus();
        });
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        requestAnimationFrame(() => {
          iconButtonRef.current?.focus();
        });
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [enabled, menuOpen]);

  if (!enabled) {
    return null;
  }

  const isLoading = status === "loading";

  async function handleSeedMockData() {
    setStatus("loading");
    setOperation("seed");
    setMessage("Cadastrando categorias e produtos mock...");

    try {
      const response = await fetch("/api/dev/seed-mock-data", { method: "POST" });
      const payload = parseSeedResponse(await response.json());

      if (!response.ok) {
        throw new ApiResponseError(
          payload.message ?? "Falha ao cadastrar dados mock.",
          response.status,
        );
      }

      setStatus("success");
      setMessage(
        `Seed concluído: ${payload.categoriesCreated ?? 0} categorias e ${payload.productsCreated ?? 0} produtos criados.`,
      );
    } catch (error) {
      if (error instanceof ApiResponseError) {
        setStatus("error");
        setMessage(error.message);
      } else {
        throw error;
      }
    } finally {
      setOperation(null);
    }
  }

  async function handleDeleteMockData() {
    setStatus("loading");
    setOperation("delete");
    setMessage("Deletando categorias, produtos e imagens mock...");

    try {
      const response = await fetch("/api/dev/seed-mock-data", { method: "DELETE" });
      const payload = parseDeleteResponse(await response.json());

      if (!response.ok) {
        throw new ApiResponseError(
          payload.message ?? "Falha ao deletar dados mock.",
          response.status,
        );
      }

      setStatus("success");
      setMessage(
        `Deletado: ${payload.categoriesDeleted ?? 0} categorias, ${payload.productsDeleted ?? 0} produtos, ${payload.storageFilesDeleted ?? 0} arquivos.`,
      );
    } catch (error) {
      if (error instanceof ApiResponseError) {
        setStatus("error");
        setMessage(error.message);
      } else {
        throw error;
      }
    } finally {
      setOperation(null);
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        ref={iconButtonRef}
        type="button"
        className={styles.iconButton}
        aria-label="Ações de desenvolvimento"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={styles.icon}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 9h15m-15 6h15m-15 6h15" />
        </svg>
      </button>
      {menuOpen && (
        <div className={styles.dropdown} role="menu" aria-label="Menu de desenvolvimento">
          <button
            ref={actionButtonRef}
            type="button"
            role="menuitem"
            className={styles.actionButton}
            onClick={handleSeedMockData}
            disabled={isLoading}
          >
            {isLoading && operation === "seed" ? "Cadastrando..." : "Cadastrar dados mock"}
          </button>
          <div className={styles.divider} />
          <button
            type="button"
            role="menuitem"
            className={styles.deleteButton}
            onClick={handleDeleteMockData}
            disabled={isLoading}
          >
            {isLoading && operation === "delete" ? "Deletando..." : "Deletar dados mock"}
          </button>
          {message && (
            <p className={status === "error" ? styles.errorMessage : styles.successMessage} role="status">
              {message}
            </p>
          )}
        </div>
      )}
    </div>
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

function parseDeleteResponse(input: unknown): {
  message?: string;
  categoriesDeleted?: number;
  productsDeleted?: number;
  stockDeleted?: number;
  storageFilesDeleted?: number;
} {
  if (!input || typeof input !== "object") {
    return {};
  }

  const payload = input as Record<string, unknown>;
  return {
    message: typeof payload.message === "string" ? payload.message : undefined,
    categoriesDeleted: typeof payload.categoriesDeleted === "number" ? payload.categoriesDeleted : undefined,
    productsDeleted: typeof payload.productsDeleted === "number" ? payload.productsDeleted : undefined,
    stockDeleted: typeof payload.stockDeleted === "number" ? payload.stockDeleted : undefined,
    storageFilesDeleted: typeof payload.storageFilesDeleted === "number" ? payload.storageFilesDeleted : undefined,
  };
}
