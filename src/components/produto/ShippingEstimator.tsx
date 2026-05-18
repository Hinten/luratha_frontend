"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getStoredShippingEstimate,
  saveShippingEstimate,
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
  /** Preço unitário do produto — vai como `unitPrice` na cotação. */
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
 * `POST /api/checkout/shipping` em modo `free-shipping-only` e mostra:
 *   - valor do frete grátis para aquele CEP
 *   - valor do frete de referência (1kg)
 *
 * O estimate é salvo em localStorage para o carrinho reaproveitar.
 */
export default function ShippingEstimator({ productPrice }: ShippingEstimatorProps) {
  const [postalCode, setPostalCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FreeShippingResponse | null>(null);

  useEffect(() => {
    const stored = getStoredShippingEstimate();
    if (stored) {
      setPostalCode(stored.postalCode);
      setResult({
        destinationPostalCode: stored.postalCode,
        threshold: stored.freeShippingThreshold,
        referenceShippingCost: stored.referenceShippingCost,
        divisor: stored.divisor,
        enabled: stored.freeShippingEnabled,
      });
    }
  }, []);

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
        setResult(data);

        const toStore: StoredShippingEstimate = {
          postalCode: data.destinationPostalCode,
          freeShippingThreshold: data.threshold,
          referenceShippingCost: data.referenceShippingCost,
          divisor: data.divisor,
          freeShippingEnabled: data.enabled,
          fetchedAt: new Date().toISOString(),
        };
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
          onChange={(e) => setPostalCode(formatCep(e.target.value))}
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

      {result && !error && (
        <div aria-live="polite">
          {result.enabled && result.threshold !== null ? (
            <p className={styles.result}>
              Frete <strong>grátis</strong> em compras acima de{" "}
              <strong>{formatBRL(result.threshold)}</strong> para o CEP{" "}
              {result.destinationPostalCode}.
            </p>
          ) : (
            <p className={styles.result}>
              {result.enabled
                ? "Frete grátis indisponível para este CEP no momento."
                : "Frete grátis temporariamente desativado."}
            </p>
          )}

          

          {process.env.NODE_ENV === 'development' && result.referenceShippingCost !== null && (
            <p className={styles.muted}>
              [DEV] Referência: frete de 1kg para esse CEP custa{" "}
              {formatBRL(result.referenceShippingCost)}. Itens deste produto a partir de{" "}
              {formatBRL(productPrice)}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
