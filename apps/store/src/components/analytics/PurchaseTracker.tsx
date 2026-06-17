"use client";

import { useEffect, useRef } from "react";
import type { OrderItem } from "@luratha/schemas";
import { trackPurchase } from "@/src/lib/analytics/ecommerce";
import { trackPixelPurchase } from "@/src/lib/analytics/pixel-ecommerce";
import { GA_PURCHASE_DEDUP_PREFIX } from "@/src/lib/analytics/gtag";

interface PurchaseTrackerProps {
  transactionId: string;
  value: number;
  shipping: number;
  items: OrderItem[];
  coupon?: string;
  /**
   * Pagamento confirmado (`paymentStatus === "paid"`). O `Purchase` do Meta no
   * navegador só dispara quando `true`. Pagamentos assíncronos (PIX/boleto)
   * ainda não pagos são contados pela Conversions API quando o webhook confirma
   * o pagamento (server-authoritative, deduplicado por `event_id`) — evita
   * conversão falsa quando o cliente abandona o PIX.
   */
  paid: boolean;
}

/**
 * Dispara o evento de compra ao montar a página de sucesso. Renderiza `null`.
 *
 * - **GA4 `purchase`**: dispara sempre (a loja não tem medição server-side de
 *   GA4; mantém a cobertura de pedidos assíncronos como antes).
 * - **Meta `Purchase`**: só dispara quando `paid` — PIX/boleto pendentes vêm da
 *   Conversions API no webhook do pagamento confirmado.
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
  paid,
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
    // Meta `Purchase` (eventID = order.id) só com pagamento confirmado. PIX/boleto
    // pendentes são enviados pela Conversions API quando o webhook confirma o
    // pagamento — mesmo event_id, então o Meta deduplica e não conta duas vezes.
    if (paid) {
      trackPixelPurchase({ transactionId, value, items });
    }
  }, [transactionId, value, shipping, items, coupon, paid]);

  return null;
}
