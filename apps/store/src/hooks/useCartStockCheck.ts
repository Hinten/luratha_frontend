"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CartItem } from "@luratha/schemas";
import { logger } from "@luratha/core/logging/logger";
import { ApiResponseError, throwIfNotOk } from "@/src/lib/errors";
import type { CartAdjustment } from "@/src/app/api/cart/validate/route";

interface UseCartStockCheckArgs {
  items: CartItem[];
  /** Só roda depois que o carrinho terminou de hidratar. */
  isReady: boolean;
  /** Permite adiar a checagem (ex.: enquanto a etapa do checkout não abriu). */
  enabled?: boolean;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
}

function toValidatePayload(item: CartItem) {
  return {
    productId: item.productId,
    variantId: item.variantId,
    variantSku: item.variantSku,
    productSlug: item.productSlug,
    name: item.name,
    photoId: item.photoId,
    imageUrl: item.imageUrl,
    variantLabel: item.variantLabel,
    unitPrice: item.unitPrice,
    currency: item.currency,
    quantity: item.quantity,
  };
}

/**
 * Revalida o estoque do carrinho em **bulk** (uma chamada a `/api/cart/validate`)
 * ao chegar no carrinho/checkout e aplica os ajustes automaticamente: capa a
 * quantidade ao disponível e remove itens esgotados, devolvendo a lista pro
 * banner ("Auto-ajusta + avisa"). É best-effort — a barreira autoritativa, com
 * decremento, continua no `POST /api/orders`.
 *
 * Roda **uma vez** por montagem (guard via ref): aplicar os ajustes muda
 * `items`, mas o guard impede re-disparo. Não cancela o fetch em cleanup — assim
 * sobrevive ao double-invoke do React Strict Mode (dev/E2E) e aplica uma só vez.
 */
export function useCartStockCheck({
  items,
  isReady,
  enabled = true,
  updateQuantity,
  removeItem,
}: UseCartStockCheckArgs): { adjustments: CartAdjustment[]; dismiss: () => void } {
  const [adjustments, setAdjustments] = useState<CartAdjustment[]>([]);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isReady || items.length === 0 || startedRef.current) return;
    startedRef.current = true;

    const payload = items.map(toValidatePayload);
    void (async () => {
      try {
        const response = await fetch("/api/cart/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payload }),
        });
        await throwIfNotOk(response, "Falha ao validar o carrinho.");
        const data = (await response.json()) as { adjustments: CartAdjustment[] };
        if (data.adjustments.length === 0) return;

        for (const adj of data.adjustments) {
          if (adj.action === "drop") {
            void removeItem(adj.itemId);
          } else {
            void updateQuantity(adj.itemId, adj.availableQty);
          }
        }
        setAdjustments(data.adjustments);
      } catch (err) {
        if (err instanceof ApiResponseError) {
          // Best-effort: o pedido revalida de forma autoritativa. Não vaza erro
          // pro usuário nem bloqueia o funil.
          logger.warn("[cart] validação de estoque falhou (silencioso)", {
            status: err.status,
            message: err.message,
          });
          return;
        }
        if (err instanceof TypeError) {
          // Sem rede — segue o jogo; o pedido barra depois se preciso.
          logger.warn("[cart] validação de estoque sem rede (silencioso)", {
            message: err.message,
          });
          return;
        }
        throw err;
      }
    })();
  }, [enabled, isReady, items, updateQuantity, removeItem]);

  const dismiss = useCallback(() => setAdjustments([]), []);
  return { adjustments, dismiss };
}
