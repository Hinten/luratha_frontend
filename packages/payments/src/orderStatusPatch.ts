import type { Order } from "@luratha/schemas";
import type { PaymentStatus } from "./types";

/**
 * Calcula o patch de uma Order a partir de um `paymentStatus` normalizado.
 *
 * Módulo puro (só tipos) — sem `firebase-admin`/`server-only` — pra ser
 * testável por unidade. Define o efeito de cada estado de pagamento no
 * `Order.status` (fulfillment):
 *  - `paid` → `status: paid` (+ `paidAt`).
 *  - `refunded` / `charged_back` (estorno involuntário) → `status: refunded`.
 *  - `unknown` (fail-safe) → `status: unknown` — trava o despacho; nunca deixa
 *    um pedido sob status desconhecido aparecer como "pago".
 *  - demais (`partially_refunded`, `in_dispute`, `authorized`, `awaiting_pix`,
 *    `awaiting_boleto`, `pending`, `failed`) → só `paymentStatus`; o
 *    `Order.status` segue o que estava (o pedido pode já ter sido pago/enviado).
 */
export function buildStatusPatch(status: PaymentStatus, approvedAt?: string): Partial<Order> {
  const patch: Partial<Order> = { paymentStatus: status };
  switch (status) {
    case "paid":
      patch.status = "paid";
      patch.paidAt = approvedAt ?? new Date().toISOString();
      break;
    case "refunded":
    case "charged_back":
      // Chargeback = estorno involuntário; mesma saída operacional do reembolso.
      patch.status = "refunded";
      break;
    case "unknown":
      // Fail-safe: status do MP não reconhecido. Marca o pedido como `unknown`
      // (não aparece "pago", não despachável) — melhor que um "paid" otimista que
      // despacharia um pedido possivelmente não pago. O `logger.warn` em
      // `mapMpStatus` é o alerta pra revisão manual.
      patch.status = "unknown";
      break;
  }
  return patch;
}
