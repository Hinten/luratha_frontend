"use client";

import { useEffect, useState } from "react";
import type { CartItem } from "@luratha/schemas";
import { ApiResponseError } from "@/src/lib/errors";
import styles from "./ShippingStep.module.css";

export interface ShippingQuote {
  providerId: string;
  serviceCode: string;
  carrier: string;
  service: string;
  price: number;
  estimatedDays: number;
}

export interface ShippingStepProps {
  postalCode: string;
  items: CartItem[];
  selectedQuote: ShippingQuote | null;
  onSelect: (quote: ShippingQuote) => void;
  onContinue: () => void;
  onBack: () => void;
}

interface QuoteResponse {
  quotes: ShippingQuote[];
  freeShippingThreshold: number | null;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "ready"; quotes: ShippingQuote[]; freeShippingThreshold: number | null }
  | { kind: "error"; message: string };

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function quoteKey(q: ShippingQuote): string {
  return `${q.providerId}::${q.serviceCode}`;
}

export default function ShippingStep({
  postalCode,
  items,
  selectedQuote,
  onSelect,
  onContinue,
  onBack,
}: ShippingStepProps) {
  const [state, setState] = useState<ViewState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState({ kind: "loading" });
      try {
        const res = await fetch("/api/checkout/shipping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "quote",
            postalCode,
            items: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              weightKg: i.dimensions?.weightKg ?? undefined,
              dimensionsCm: i.dimensions
                ? {
                    length: i.dimensions.length,
                    width: i.dimensions.width,
                    height: i.dimensions.height,
                  }
                : undefined,
            })),
          }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new ApiResponseError(
            body.message ?? "Não foi possível calcular o frete.",
            res.status,
          );
        }
        const data = (await res.json()) as QuoteResponse;
        if (cancelled) return;
        setState({
          kind: "ready",
          quotes: data.quotes,
          freeShippingThreshold: data.freeShippingThreshold,
        });
        if (!selectedQuote && data.quotes.length > 0) {
          onSelect(data.quotes[0]);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiResponseError) {
          setState({ kind: "error", message: err.message });
        } else {
          throw err;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postalCode]);

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Como você quer receber?</h2>
      <p className={styles.muted}>Entrega para o CEP {postalCode}.</p>

      {state.kind === "loading" && (
        <p className={styles.muted}>Consultando transportadoras…</p>
      )}

      {state.kind === "error" && (
        <p role="alert" className={styles.error}>
          {state.message}
        </p>
      )}

      {state.kind === "ready" && state.quotes.length === 0 && (
        <p role="alert" className={styles.error}>
          Nenhuma transportadora disponível para esse CEP.
        </p>
      )}

      {state.kind === "ready" && state.quotes.length > 0 && (
        <div
          className={styles.list}
          role="radiogroup"
          aria-label="Opções de frete"
        >
          {state.quotes.map((q) => {
            const checked = selectedQuote
              ? quoteKey(selectedQuote) === quoteKey(q)
              : false;
            return (
              <label
                key={quoteKey(q)}
                className={styles.option}
                data-checked={checked || undefined}
              >
                <input
                  type="radio"
                  name="shipping"
                  className={styles.radio}
                  checked={checked}
                  onChange={() => onSelect(q)}
                />
                <div className={styles.optionBody}>
                  <p className={styles.optionTitle}>
                    {q.carrier} · {q.service}
                  </p>
                  <p className={styles.optionMeta}>
                    Em até {q.estimatedDays} dia{q.estimatedDays === 1 ? "" : "s"} úteis
                  </p>
                </div>
                <p className={styles.optionPrice}>{brl.format(q.price)}</p>
              </label>
            );
          })}
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          Voltar
        </button>
        <button
          type="button"
          className={styles.continueBtn}
          onClick={onContinue}
          disabled={!selectedQuote || state.kind !== "ready"}
        >
          Continuar
        </button>
      </div>
    </section>
  );
}
