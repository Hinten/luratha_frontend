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
  /** Preço exibido ao usuário. Zero quando frete grátis aplicado. */
  price: number;
  /** Preço cheio antes do desconto de frete grátis. Igual a `price` quando não há grátis. */
  basePrice: number;
  /** `true` quando a opção é "Frete grátis" (price=0 absorvido pela loja). */
  freeShippingApplied: boolean;
  estimatedDays: number;
}

export interface ShippingStepProps {
  postalCode: string;
  items: CartItem[];
  /** Subtotal do carrinho — necessário pra decidir elegibilidade do frete grátis. */
  subtotal: number;
  selectedQuote: ShippingQuote | null;
  onSelect: (quote: ShippingQuote) => void;
  onContinue: () => void;
  onBack: () => void;
}

interface ApiQuote {
  providerId: string;
  serviceCode: string;
  carrier: string;
  service: string;
  price: number;
  estimatedDays: number;
}

interface QuoteResponse {
  quotes: ApiQuote[];
  freeShippingThreshold: number | null;
}

type ViewState =
  | { kind: "loading" }
  | { kind: "ready"; quotes: ApiQuote[]; freeShippingThreshold: number | null }
  | { kind: "error"; message: string };

interface OptionRow {
  /** Chave única (`provider::service`) — pra radio group + identificação no select. */
  key: string;
  quote: ShippingQuote;
  label: string;
  detail: string;
  priceLabel: string;
}

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function quoteKey(q: { providerId: string; serviceCode: string }): string {
  return `${q.providerId}::${q.serviceCode}`;
}

function deliveryLabel(days: number): string {
  if (days <= 0) return "";
  return `em até ${days} ${days === 1 ? "dia útil" : "dias úteis"}`;
}

export default function ShippingStep({
  postalCode,
  items,
  subtotal,
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

  // Monta as linhas exibíveis. Quando elegível ao frete grátis, a opção mais
  // barata vira "Frete grátis" no topo (price=0, freeShippingApplied=true) e
  // as demais transportadoras aparecem listadas pelo preço cheio. Espelha o
  // comportamento de `CartShippingOptions` no carrinho.
  const rows: OptionRow[] = [];
  let defaultRowKey: string | null = null;
  if (state.kind === "ready" && state.quotes.length > 0) {
    const cheapest = state.quotes.reduce((a, b) => (b.price < a.price ? b : a));
    const cheapestKey = quoteKey(cheapest);
    const eligible =
      state.freeShippingThreshold !== null &&
      subtotal >= state.freeShippingThreshold;

    if (eligible) {
      const freeQuote: ShippingQuote = {
        providerId: cheapest.providerId,
        serviceCode: cheapest.serviceCode,
        carrier: cheapest.carrier,
        service: cheapest.service,
        price: 0,
        basePrice: cheapest.price,
        freeShippingApplied: true,
        estimatedDays: cheapest.estimatedDays,
      };
      const freeKey = `free::${cheapestKey}`;
      rows.push({
        key: freeKey,
        quote: freeQuote,
        label: "Frete grátis",
        detail: [
          `${cheapest.carrier} · ${cheapest.service}`,
          deliveryLabel(cheapest.estimatedDays),
        ]
          .filter(Boolean)
          .join(" · "),
        priceLabel: "Grátis",
      });
      defaultRowKey = freeKey;
    }
    for (const q of state.quotes) {
      const key = quoteKey(q);
      if (eligible && key === cheapestKey) continue; // já listado como "Frete grátis"
      const quote: ShippingQuote = {
        providerId: q.providerId,
        serviceCode: q.serviceCode,
        carrier: q.carrier,
        service: q.service,
        price: q.price,
        basePrice: q.price,
        freeShippingApplied: false,
        estimatedDays: q.estimatedDays,
      };
      rows.push({
        key,
        quote,
        label: `${q.carrier} · ${q.service}`,
        detail: deliveryLabel(q.estimatedDays),
        priceLabel: brl.format(q.price),
      });
      if (defaultRowKey === null) defaultRowKey = key;
    }
  }

  // Auto-seleciona a primeira opção (frete grátis quando elegível, senão a
  // primeira da lista) quando ainda não há seleção válida.
  useEffect(() => {
    if (state.kind !== "ready" || rows.length === 0) return;
    const currentKey =
      selectedQuote && rows.find((r) => r.quote.price === selectedQuote.price && quoteKey(r.quote) === quoteKey(selectedQuote))
        ? null
        : defaultRowKey;
    if (currentKey) {
      const row = rows.find((r) => r.key === currentKey);
      if (row) onSelect(row.quote);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind, defaultRowKey]);

  // Chave selecionada: combinação providerId+serviceCode + freeShippingApplied.
  const selectedKey = selectedQuote
    ? selectedQuote.freeShippingApplied
      ? `free::${quoteKey(selectedQuote)}`
      : quoteKey(selectedQuote)
    : null;

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

      {state.kind === "ready" && rows.length === 0 && (
        <p role="alert" className={styles.error}>
          Nenhuma transportadora disponível para esse CEP.
        </p>
      )}

      {state.kind === "ready" && rows.length > 0 && (
        <div
          className={styles.list}
          role="radiogroup"
          aria-label="Opções de frete"
        >
          {rows.map((row) => {
            const checked = selectedKey === row.key;
            return (
              <label
                key={row.key}
                className={styles.option}
                data-checked={checked || undefined}
              >
                <input
                  type="radio"
                  name="shipping"
                  className={styles.radio}
                  checked={checked}
                  onChange={() => onSelect(row.quote)}
                />
                <div className={styles.optionBody}>
                  <p className={styles.optionTitle}>{row.label}</p>
                  <p className={styles.optionMeta}>{row.detail}</p>
                </div>
                <p className={styles.optionPrice}>{row.priceLabel}</p>
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
