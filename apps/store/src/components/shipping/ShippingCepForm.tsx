"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  getShippingEstimateServerSnapshot,
  getShippingEstimateSnapshot,
  saveShippingEstimate,
  subscribeShippingEstimate,
  type StoredShippingEstimate,
} from "@/src/lib/shipping/clientStorage";
import type { ShippingQuote } from "@/src/lib/shipping/types";
import styles from "./ShippingCepForm.module.css";

function formatCep(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

interface FreeShippingResponse {
  destinationPostalCode: string;
  quotes: ShippingQuote[];
  threshold: number | null;
  referenceShippingCost: number | null;
  divisor: number;
  enabled: boolean;
}

interface ShippingCepFormProps {
  /** Título exibido acima do campo. */
  title: string;
}

/**
 * Campo de CEP + cálculo de frete grátis, reutilizado na PDP e no carrinho.
 *
 * Chama `POST /api/checkout/shipping` em modo `free-shipping-only` e persiste o
 * resultado via `saveShippingEstimate` — o evento sincroniza todas as telas que
 * leem o estimate (`useSyncExternalStore`). O componente não renderiza o
 * resultado; cada página o apresenta lendo o store.
 */
export default function ShippingCepForm({ title }: ShippingCepFormProps) {
  const stored = useSyncExternalStore(
    subscribeShippingEstimate,
    getShippingEstimateSnapshot,
    getShippingEstimateServerSnapshot,
  );

  // `null` enquanto o usuário não digitou — aí o input mostra o CEP salvo.
  const [typedCep, setTypedCep] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postalCode = typedCep ?? stored?.postalCode ?? "";

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setLoading(true);

      try {
        const response = await fetch("/api/checkout/shipping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "free-shipping-only", postalCode }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(data.message ?? `HTTP ${response.status}`);
        }
        const data = (await response.json()) as FreeShippingResponse;

        const toStore: StoredShippingEstimate = {
          postalCode: data.destinationPostalCode,
          freeShippingThreshold: data.threshold,
          referenceShippingCost: data.referenceShippingCost,
          divisor: data.divisor,
          freeShippingEnabled: data.enabled,
          quotes: data.quotes,
          fetchedAt: new Date().toISOString(),
        };
        // Persiste — o evento atualiza `stored` em todas as telas.
        saveShippingEstimate(toStore);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao calcular o frete.");
      } finally {
        setLoading(false);
      }
    },
    [postalCode],
  );

  const trimmedCep = postalCode.replace(/\D/g, "");
  const submitDisabled = loading || trimmedCep.length !== 8;

  return (
    <div className={styles.wrapper}>
      <p className={styles.title}>{title}</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="CEP (99999-999)"
          value={postalCode}
          onChange={(e) => setTypedCep(formatCep(e.target.value))}
          maxLength={9}
          aria-label="CEP de entrega"
          className={styles.input}
        />
        <button type="submit" disabled={submitDisabled} className={styles.submit}>
          {loading ? "Calculando..." : "Calcular"}
        </button>
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
