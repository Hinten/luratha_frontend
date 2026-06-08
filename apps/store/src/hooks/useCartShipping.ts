"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  getShippingEstimateServerSnapshot,
  getShippingEstimateSnapshot,
  subscribeShippingEstimate,
} from "@/src/lib/shipping/clientStorage";
import type { CartItem } from "@luratha/schemas";
import type { ShippingQuote } from "@/src/lib/shipping/types";

/**
 * Calcula as opções de frete reais do carrinho.
 *
 * Lê o CEP do estimate salvo (mesmo store da PDP) e cota `POST
 * /api/checkout/shipping` em modo `quote` com os pesos/dimensões reais dos
 * itens. A cotação é re-disparada quando o CEP ou o conteúdo do carrinho mudam,
 * com um debounce curto para não chamar o provider a cada clique no stepper.
 */

interface QuoteResponse {
  quotes: ShippingQuote[];
  freeShippingThreshold: number | null;
}

export interface CartShippingState {
  quotes: ShippingQuote[];
  freeShippingThreshold: number | null;
  loading: boolean;
  /** true quando há CEP + itens mas nenhuma opção pôde ser obtida. */
  error: boolean;
  /** CEP em uso (do estimate salvo), ou `null` quando o cliente não informou. */
  postalCode: string | null;
}

const FETCH_DEBOUNCE_MS = 400;

interface FetchResult {
  /** Assinatura (CEP + itens) para a qual este resultado foi obtido. */
  signature: string;
  quotes: ShippingQuote[];
  freeShippingThreshold: number | null;
  error: boolean;
}

function buildItemsPayload(items: CartItem[]) {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    weightKg: item.dimensions?.weightKg ?? null,
    dimensionsCm:
      item.dimensions && item.dimensions.unit === "cm"
        ? {
            length: item.dimensions.length,
            width: item.dimensions.width,
            height: item.dimensions.height,
          }
        : null,
  }));
}

export function useCartShipping(items: CartItem[]): CartShippingState {
  const estimate = useSyncExternalStore(
    subscribeShippingEstimate,
    getShippingEstimateSnapshot,
    getShippingEstimateServerSnapshot,
  );
  const postalCode = estimate?.postalCode ?? null;

  const payload = useMemo(() => buildItemsPayload(items), [items]);
  const signature = useMemo(() => JSON.stringify({ postalCode, payload }), [postalCode, payload]);

  const [result, setResult] = useState<FetchResult | null>(null);

  useEffect(() => {
    if (postalCode === null || payload.length === 0) return;

    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/checkout/shipping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "quote", postalCode, items: payload }),
          });
          if (!active) return;
          if (!response.ok) {
            setResult({ signature, quotes: [], freeShippingThreshold: null, error: true });
            return;
          }
          const data = (await response.json()) as QuoteResponse;
          if (!active) return;
          setResult({
            signature,
            quotes: data.quotes,
            freeShippingThreshold: data.freeShippingThreshold,
            error: data.quotes.length === 0,
          });
        } catch (err) {
          // TypeError = falha de rede do `fetch`; nesse caso só não há opções.
          // Qualquer outro erro (ex.: resposta não-JSON) é bug real — propaga.
          if (!(err instanceof TypeError)) throw err;
          if (active) {
            setResult({ signature, quotes: [], freeShippingThreshold: null, error: true });
          }
        }
      })();
    }, FETCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [postalCode, payload, signature]);

  const hasInput = postalCode !== null && payload.length > 0;
  const fresh = result !== null && result.signature === signature;

  return {
    quotes: fresh ? result.quotes : [],
    freeShippingThreshold: fresh ? result.freeShippingThreshold : null,
    loading: hasInput && !fresh,
    error: fresh ? result.error : false,
    postalCode,
  };
}
