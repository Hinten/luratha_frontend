import type { Order } from "@luratha/schemas";
import type { PaymentStatus } from "./types";

/**
 * Estados de fulfillment em que o pedido ainda **não foi despachado** — só nesses
 * o fail-safe `unknown` rebaixa o `Order.status` (ver `buildStatusPatch`). Em
 * `shipped`/`delivered`/`cancelled`/`refunded` o despacho já ocorreu (ou o pedido
 * já é terminal), então sobrescrever destruiria o histórico sem prevenir nada.
 */
const DISPATCHABLE_STATUSES = new Set<Order["status"]>([
  "pending_payment",
  "paid",
  "processing",
  "unknown",
]);

/**
 * Calcula o patch de uma Order a partir de um `paymentStatus` normalizado.
 *
 * Módulo puro (só tipos) — sem `firebase-admin`/`server-only` — pra ser
 * testável por unidade. Define o efeito de cada estado de pagamento no
 * `Order.status` (fulfillment):
 *  - `paid` → `status: paid` (+ `paidAt`).
 *  - `refunded` / `charged_back` (estorno involuntário) → `status: refunded`.
 *  - `unknown` (fail-safe) → `status: unknown` **apenas se o pedido ainda é
 *    despachável** (`currentStatus` em `DISPATCHABLE_STATUSES`) — trava o
 *    despacho de um pedido sob status incerto. Se já foi enviado/entregue,
 *    preserva o `Order.status` (o despacho já ocorreu; o `paymentStatus:
 *    "unknown"` + `logger.warn` continuam sinalizando a revisão).
 *  - demais (`partially_refunded`, `in_dispute`, `authorized`, `awaiting_pix`,
 *    `awaiting_boleto`, `pending`, `failed`) → só `paymentStatus`; o
 *    `Order.status` segue o que estava (o pedido pode já ter sido pago/enviado).
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
