import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import { firestoreCollections, type Order, validateOrder } from "@luratha/schemas";
import { createPayment, getPayment } from "@/src/lib/payment/mercadoPago";
import { resolveWebhookUrl } from "@/src/lib/payment/mercadoPago/client";
import {
  type PaymentIntentResult,
  type PaymentPayer,
  type PaymentPayerAddress,
  type PaymentStatus,
  PaymentProviderError,
} from "@/src/lib/payment/types";

/**
 * Orquestração de pagamento: carrega/atualiza a Order via Admin SDK e delega
 * a criação/consulta de pagamento ao adapter do MercadoPago.
 */

/** Campos específicos de cada método — o restante vem da Order carregada. */
export type PaymentIntentMethodInput =
  | { paymentMethod: "pix"; payer: PaymentPayer }
  | {
      paymentMethod: "credit_card";
      payer: PaymentPayer;
      cardToken: string;
      installments: number;
      paymentMethodId: string;
    }
  | { paymentMethod: "boleto"; payer: PaymentPayer; payerAddress: PaymentPayerAddress };

function orderRef(orderId: string) {
  return adminDb
    .collection(firestoreCollections.orders)
    .doc(orderId)
    .withConverter(adminOrderConverter);
}

/** Calcula o patch de uma Order a partir de um status de pagamento. */
function buildStatusPatch(status: PaymentStatus, approvedAt?: string): Partial<Order> {
  const patch: Partial<Order> = { paymentStatus: status };
  if (status === "paid") {
    patch.status = "paid";
    patch.paidAt = approvedAt ?? new Date().toISOString();
  } else if (status === "refunded") {
    patch.status = "refunded";
  }
  // "pending" / "authorized" / "failed" mantêm Order.status em "pending_payment"
  // — o cliente ainda pode tentar pagar de novo.
  return patch;
}

async function persistOrderPatch(orderId: string, patch: Partial<Order>): Promise<Order> {
  const ref = orderRef(orderId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new PaymentProviderError(`Pedido "${orderId}" não encontrado.`, "invalid_input");
  }
  const current = snapshot.data() as Order;
  // Merge order: existente < patch < campos imutáveis controlados pelo servidor.
  const merged = validateOrder({
    ...current,
    ...patch,
    id: current.id,
    userId: current.userId,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  });
  await ref.set(merged);
  return merged;
}

/** Carrega uma Order pelo id (Admin SDK). Retorna `null` quando não existe. */
export async function loadOrder(orderId: string): Promise<Order | null> {
  const snapshot = await orderRef(orderId).get();
  return snapshot.exists ? (snapshot.data() as Order) : null;
}

/**
 * Cria o pagamento no MercadoPago para uma Order já existente, persiste o
 * `paymentIntentId` e aplica o status retornado (cartão pode aprovar na hora).
 *
 * O chamador (route handler) é responsável pela autorização — verificar que a
 * Order pertence ao usuário e que ainda está aguardando pagamento.
 */
export async function createPaymentIntent(
  order: Order,
  methodInput: PaymentIntentMethodInput,
): Promise<{ result: PaymentIntentResult; order: Order }> {
  const base = {
    orderId: order.id,
    amount: order.grandTotal,
    description: `Pedido ${order.orderNumber} — Luratha`,
    notificationUrl: resolveWebhookUrl(),
  };

  const result = await createPayment(
    methodInput.paymentMethod === "credit_card"
      ? {
          ...base,
          paymentMethod: "credit_card",
          payer: methodInput.payer,
          cardToken: methodInput.cardToken,
          installments: methodInput.installments,
          paymentMethodId: methodInput.paymentMethodId,
        }
      : methodInput.paymentMethod === "boleto"
        ? {
            ...base,
            paymentMethod: "boleto",
            payer: methodInput.payer,
            payerAddress: methodInput.payerAddress,
          }
        : { ...base, paymentMethod: "pix", payer: methodInput.payer },
  );

  const updatedOrder = await persistOrderPatch(order.id, {
    paymentIntentId: result.paymentId,
    ...buildStatusPatch(result.status),
  });

  return { result, order: updatedOrder };
}

/**
 * Aplica a um pedido a confirmação assíncrona vinda de um webhook do
 * MercadoPago. Idempotente: se o pedido já está no status-alvo, não reescreve.
 */
export async function applyPaymentWebhook(
  paymentId: string,
): Promise<{ changed: boolean; orderId: string; status: PaymentStatus }> {
  const summary = await getPayment(paymentId);
  const order = await loadOrder(summary.orderId);
  if (!order) {
    throw new PaymentProviderError(
      `Pedido "${summary.orderId}" referenciado pelo pagamento ${paymentId} não existe.`,
      "invalid_input",
    );
  }

  if (order.paymentStatus === summary.status) {
    return { changed: false, orderId: order.id, status: summary.status };
  }

  await persistOrderPatch(order.id, {
    paymentIntentId: summary.paymentId,
    ...buildStatusPatch(summary.status, summary.approvedAt),
  });

  return { changed: true, orderId: order.id, status: summary.status };
}
