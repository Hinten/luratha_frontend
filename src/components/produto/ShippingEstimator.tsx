"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import {
  getShippingEstimateServerSnapshot,
  getShippingEstimateSnapshot,
  saveShippingEstimate,
  subscribeShippingEstimate,
  type StoredShippingEstimate,
} from "@/src/lib/shipping/clientStorage";
import styles from "./ShippingEstimator.module.css";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatCep(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

interface ShippingEstimatorProps {
  /** Preço unitário do produto — exibido no aviso de referência. */
  productPrice: number;
}

interface FreeShippingResponse {
  destinationPostalCode: string;
  threshold: number | null;
  referenceShippingCost: number | null;
  divisor: number;
  enabled: boolean;
}

/**
 * Widget de "Consulte o frete" exibido na PDP. Pede o CEP, chama
 * `POST /api/checkout/shipping` em modo `free-shipping-only` e mostra o valor
 * do frete grátis para aquele CEP.
 *
 * O estimate é persistido em localStorage e lido via `useSyncExternalStore`,
 * então o carrinho compartilha o mesmo valor sem refetch — e sem `useEffect`.
 */
export default function ShippingEstimator({ productPrice }: ShippingEstimatorProps) {
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
          fetchedAt: new Date().toISOString(),
        };
        // Persiste — o evento disparado atualiza `stored` via useSyncExternalStore.
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
    <section className={styles.wrapper} aria-label="Consulta de frete">
      <p className={styles.title}>Consulte o frete e prazo</p>

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

      {stored && !error && (
        <div aria-live="polite">
          {stored.freeShippingEnabled && stored.freeShippingThreshold !== null ? (
            <p className={styles.result}>
              Frete <strong>grátis</strong> em compras acima de{" "}
              <strong>{formatBRL(stored.freeShippingThreshold)}</strong> para o CEP{" "}
              {stored.postalCode}.
            </p>
          ) : (
            <p className={styles.result}>
              {stored.freeShippingEnabled
                ? "Frete grátis indisponível para este CEP no momento."
                : "Frete grátis temporariamente desativado."}
            </p>
          )}

          {process.env.NODE_ENV === "development" && stored.referenceShippingCost !== null && (
            <p className={styles.muted}>
              [DEV] Referência: frete de 1kg para esse CEP custa{" "}
              {formatBRL(stored.referenceShippingCost)}. Itens deste produto a partir de{" "}
              {formatBRL(productPrice)}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
