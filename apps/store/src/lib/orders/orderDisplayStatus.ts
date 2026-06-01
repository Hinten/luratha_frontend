import type { Order } from "@luratha/schemas";

/**
 * Status exibível de um pedido — compõe a label a partir de `Order.status`
 * (fulfillment) **e** `Order.paymentStatus` (pagamento), num lugar só.
 *
 * Motivação (issue #121): a UI antiga derivava tudo do `Order.status`, então um
 * pedido em contestação (`paymentStatus = in_dispute`, `status = paid`) aparecia
 * como "Pago". Aqui os estados de **pagamento** que importam pro cliente/operação
 * (contestação, estorno, aguardando PIX/boleto, reembolso parcial, recusa e o
 * fail-safe `unknown`) têm prioridade sobre o status de fulfillment.
 */

export type OrderDisplayVariant = "warning" | "info" | "success" | "error" | "muted";

export interface OrderDisplayStatus {
  label: string;
  variant: OrderDisplayVariant;
  /** Chave estável (status ou paymentStatus que decidiu a label) — útil em testes/keys. */
  key: string;
}

type LabelVariant = { label: string; variant: OrderDisplayVariant };

/** Label por `Order.status` (fulfillment) — usado quando o pagamento não tem override. */
const FULFILLMENT: Record<Order["status"], LabelVariant> = {
  pending_payment: { label: "Aguardando pagamento", variant: "warning" },
  paid: { label: "Pago", variant: "info" },
  processing: { label: "Em preparação", variant: "info" },
  shipped: { label: "Enviado", variant: "info" },
  delivered: { label: "Entregue", variant: "success" },
  cancelled: { label: "Cancelado", variant: "muted" },
  refunded: { label: "Reembolsado", variant: "muted" },
  unknown: { label: "Em análise pela equipe técnica", variant: "warning" },
};

/**
 * Estados de pagamento que **sobrepõem** o status de fulfillment. Ausentes aqui
 * (`paid`, `pending`, `refunded`): a label vem do `Order.status`.
 */
const PAYMENT_OVERRIDE: Partial<Record<Order["paymentStatus"], LabelVariant>> = {
  // Fail-safe: status do MP não reconhecido. Nunca "Pago" — trava o despacho.
  unknown: { label: "Em análise pela equipe técnica", variant: "warning" },
  awaiting_pix: { label: "Aguardando pagamento do PIX", variant: "warning" },
  awaiting_boleto: { label: "Aguardando pagamento do boleto", variant: "warning" },
  authorized: { label: "Pagamento autorizado", variant: "info" },
  partially_refunded: { label: "Reembolsado parcialmente", variant: "info" },
  in_dispute: { label: "Em contestação", variant: "warning" },
  charged_back: { label: "Estornado", variant: "muted" },
  failed: { label: "Pagamento recusado", variant: "error" },
};

export function getOrderDisplayStatus(
  order: Pick<Order, "status" | "paymentStatus">,
): OrderDisplayStatus {
  const override = PAYMENT_OVERRIDE[order.paymentStatus];
  if (override) return { ...override, key: order.paymentStatus };
  return { ...FULFILLMENT[order.status], key: order.status };
}
