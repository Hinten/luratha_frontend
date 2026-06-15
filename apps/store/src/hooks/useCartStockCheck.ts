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
 * Dispara **uma vez** por montagem: `startedRef` impede re-disparo quando
 * aplicar os ajustes muda `items` (e re-roda o efeito). O fetch NÃO é abortado
 * no cleanup; em vez disso, `mountedRef` (re-armado no topo de cada run) é
 * checado antes de aplicar/`setState`, então: (a) nada é aplicado após o
 * unmount real, e (b) o double-invoke do Strict Mode (cleanup + remount em dev/
 * E2E) não mata a única tentativa em voo — o 2º run re-arma `mountedRef`.
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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled || !isReady || items.length === 0 || startedRef.current) {
      return () => {
        mountedRef.current = false;
      };
    }
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
        // Não aplica/atualiza estado se o componente já desmontou.
        if (!mountedRef.current || data.adjustments.length === 0) return;

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

    return () => {
      mountedRef.current = false;
    };
  }, [enabled, isReady, items, updateQuantity, removeItem]);

  const dismiss = useCallback(() => setAdjustments([]), []);
  return { adjustments, dismiss };
}
