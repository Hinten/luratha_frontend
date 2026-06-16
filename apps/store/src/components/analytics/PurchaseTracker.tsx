"use client";

import { useEffect, useRef } from "react";
import type { OrderItem } from "@luratha/schemas";
import { trackPurchase } from "@/src/lib/analytics/ecommerce";
import { GA_PURCHASE_DEDUP_PREFIX } from "@/src/lib/analytics/gtag";

interface PurchaseTrackerProps {
  transactionId: string;
  value: number;
  shipping: number;
  items: OrderItem[];
  coupon?: string;
}

/**
 * Dispara `purchase` ao montar a página de sucesso. Renderiza `null`.
 *
 * Deduplicado por pedido via `localStorage` (`ga_purchase_<orderId>`): um
 * reload da página de sucesso não conta a compra duas vezes. A ref evita o
 * disparo duplo do StrictMode dentro da mesma montagem.
 */
export default function PurchaseTracker({
  transactionId,
  value,
  shipping,
  items,
  coupon,
}: PurchaseTrackerProps) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const dedupKey = `${GA_PURCHASE_DEDUP_PREFIX}${transactionId}`;
    try {
      if (window.localStorage.getItem(dedupKey) !== null) return;
      window.localStorage.setItem(dedupKey, "1");
    } catch (err) {
      if (!(err instanceof DOMException)) throw err;
      // Storage indisponível (modo privado/quota): segue sem dedupe persistente;
      // a ref ainda evita o disparo duplo nesta montagem.
    }

    trackPurchase({ transactionId, value, shipping, items, ...(coupon ? { coupon } : {}) });
  }, [transactionId, value, shipping, items, coupon]);

  return null;
}
