import { DISPATCHABLE_ORDER_STATUSES, type Order } from "@luratha/schemas";
import type { PaymentStatus } from "./types";

/** Lookup do `DISPATCHABLE_ORDER_STATUSES` (fonte em `@luratha/schemas`). */
const DISPATCHABLE_STATUSES = new Set<Order["status"]>(DISPATCHABLE_ORDER_STATUSES);

/**
 * Calcula o patch de uma Order a partir de um `paymentStatus` normalizado.
 *
 * Módulo puro (só tipos) — sem `firebase-admin`/`server-only` — pra ser
 * testável por unidade. Define o efeito de cada estado de pagamento no
 * `Order.status` (fulfillment):
 *  - `paid` → `status: paid` (+ `paidAt`).
 *  - `cancelled` (PIX/boleto expirado ou cancelado) → `status: cancelled` —
 *    encerra o pedido (só ocorre em pedido nunca pago, então não conflita com
 *    `shipped`/`delivered`).
 *  - `refunded` / `charged_back` (estorno involuntário) → `status: refunded`.
 *  - `unknown` (fail-safe) → `status: unknown` **apenas se o pedido ainda é
 *    despachável** (`currentStatus` em `DISPATCHABLE_STATUSES`) — trava o
 *    despacho de um pedido sob status incerto. Se já foi enviado/entregue,
 *    preserva o `Order.status` (o despacho já ocorreu; o `paymentStatus:
 *    "unknown"` + `logger.warn` continuam sinalizando a revisão).
 *  - demais (`partially_refunded`, `in_dispute`, `authorized`, `awaiting_pix`,
 *    `awaiting_boleto`, `pending`, `failed`, `rejected`) → só `paymentStatus`; o
 *    `Order.status` segue o que estava (o pedido pode já ter sido pago/enviado, e
 *    `failed`/`rejected` deixam o cliente tentar de novo sobre `pending_payment`).
 *
 * `currentStatus` (estado de fulfillment atual da Order) só importa pro caso
 * `unknown`; quando omitido, assume despachável (rebaixa) — o padrão seguro.
 */
export function buildStatusPatch(
  status: PaymentStatus,
  approvedAt?: string,
  currentStatus?: Order["status"],
): Partial<Order> {
  const patch: Partial<Order> = { paymentStatus: status };
  switch (status) {
    case "paid":
      patch.status = "paid";
      patch.paidAt = approvedAt ?? new Date().toISOString();
      break;
    case "cancelled":
      // Pagamento cancelado/expirado (nunca pago) — encerra o pedido.
      patch.status = "cancelled";
      break;
    case "refunded":
    case "charged_back":
      // Chargeback = estorno involuntário; mesma saída operacional do reembolso.
      patch.status = "refunded";
      break;
    case "unknown":
      // Fail-safe: status do MP não reconhecido. Rebaixa o fulfillment pra
      // `unknown` (não aparece "pago", não despachável) — melhor que um "paid"
      // otimista que despacharia um pedido possivelmente não pago. Mas só
      // enquanto o pedido AINDA é despachável: num pedido já enviado/entregue,
      // sobrescrever o status apagaria o histórico operacional sem travar nada
      // (o despacho já ocorreu). O `logger.warn` em `mapMpStatus` e o
      // `paymentStatus: "unknown"` (override em `getOrderDisplayStatus`) seguem
      // alertando a revisão manual em qualquer caso.
      if (currentStatus === undefined || DISPATCHABLE_STATUSES.has(currentStatus)) {
        patch.status = "unknown";
      }
      break;
  }
  return patch;
}
