import "server-only";

import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import {
  AWAITING_PAYMENT_STATUSES,
  firestoreCollections,
  type Order,
  validateOrder,
} from "@luratha/schemas";
import { createOrder, getOrder } from "./mercadoPago";
import { buildStatusPatch } from "./orderStatusPatch";
import {
  type PaymentIntentResult,
  type PaymentPayer,
  type PaymentPayerAddress,
  type PaymentStatus,
  PaymentProviderError,
} from "./types";

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
  // eslint-disable-next-line no-restricted-syntax -- sanctioned payments data layer: the ref is converter-bound (adminOrderConverter), so writes stay schema-validated. Full migration of this subsystem is tracked separately.
  return adminDb
    .collection(firestoreCollections.orders)
    .doc(orderId)
    .withConverter(adminOrderConverter);
}

/**
 * Opções de merge. `clearPaymentArtifacts` remove `paymentPix`/`paymentBoleto`
 * do documento — necessário porque o Admin SDK aqui não usa
 * `ignoreUndefinedProperties` (escrever `undefined` lança) e `tx.set` faz
 * overwrite total: a única forma de apagar um campo é a chave estar AUSENTE
 * no objeto persistido. Por isso deletamos as chaves antes do `validateOrder`.
 */
type MergeOptions = { clearPaymentArtifacts?: boolean };

function mergeOrderPatch(current: Order, patch: Partial<Order>, opts?: MergeOptions): Order {
  // Merge order: existente < patch < campos imutáveis controlados pelo servidor.
  const draft: Order = {
    ...current,
    ...patch,
    id: current.id,
    userId: current.userId,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
  if (opts?.clearPaymentArtifacts) {
    delete draft.paymentPix;
    delete draft.paymentBoleto;
  }
  return validateOrder(draft);
}

/**
 * Aplica um patch em uma Order dentro de uma transação Firestore — garante
 * que reads/writes concorrentes (dois webhooks ou webhook + payment-intent
 * disparados simultaneamente) não se sobrescrevam.
 */
async function persistOrderPatch(
  orderId: string,
  patch: Partial<Order>,
  opts?: MergeOptions,
): Promise<Order> {
  return adminDb.runTransaction(async (tx) => {
    const ref = orderRef(orderId);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {
      throw new PaymentProviderError(`Pedido "${orderId}" não encontrado.`, "invalid_input");
    }
    const merged = mergeOrderPatch(snapshot.data() as Order, patch, opts);
    tx.set(ref, merged);
    return merged;
  });
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
  };

  const result = await createOrder(
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

  // Persistimos os artefatos de PIX/boleto na Order para que o cliente possa
  // reabri-los em `/conta/pedidos/{id}` caso saia da tela de sucesso. Spreads
  // condicionais garantem chaves AUSENTES (nunca `undefined`) — o Admin SDK
  // aqui não usa `ignoreUndefinedProperties` e escrever `undefined` lança.
  const updatedOrder = await persistOrderPatch(order.id, {
    paymentIntentId: result.paymentId,
    ...(result.pix
      ? {
          paymentPix: {
            qrCode: result.pix.qrCode,
            qrCodeBase64: result.pix.qrCodeBase64,
            ...(result.pix.expiresAt ? { expiresAt: result.pix.expiresAt } : {}),
          },
        }
      : {}),
    ...(result.boleto
      ? {
          paymentBoleto: {
            url: result.boleto.url,
            ...(result.boleto.digitableLine ? { digitableLine: result.boleto.digitableLine } : {}),
            ...(result.boleto.barcode ? { barcode: result.boleto.barcode } : {}),
            ...(result.boleto.expiresAt ? { expiresAt: result.boleto.expiresAt } : {}),
          },
        }
      : {}),
    ...buildStatusPatch(result.status, undefined, order.status),
  });

  return { result, order: updatedOrder };
}

/**
 * Aplica a um pedido a confirmação assíncrona vinda de um webhook da API de
 * Orders.
 *
 * Idempotente em duas dimensões: se o status já está no alvo E o
 * `paymentIntentId` já bate com o `summary.paymentId`, não reescreve;
 * caso contrário, persiste o que mudou dentro de uma única transação
 * (read+write no mesmo `tx`), prevenindo perda de updates quando dois
 * webhooks chegam ao mesmo tempo.
 */
export async function applyOrderWebhook(
  mpOrderId: string,
): Promise<{ changed: boolean; orderId: string; status: PaymentStatus }> {
  const summary = await getOrder(mpOrderId);

  return adminDb.runTransaction(async (tx) => {
    const ref = orderRef(summary.orderId);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {
      throw new PaymentProviderError(
        `Pedido "${summary.orderId}" referenciado pela order ${mpOrderId} não existe.`,
        "invalid_input",
      );
    }
    const order = snapshot.data() as Order;

    const statusChanged = order.paymentStatus !== summary.status;
    const intentIdChanged = order.paymentIntentId !== summary.paymentId;
    if (!statusChanged && !intentIdChanged) {
      return { changed: false, orderId: order.id, status: summary.status };
    }

    const patch: Partial<Order> = {
      paymentIntentId: summary.paymentId,
      ...(statusChanged ? buildStatusPatch(summary.status, summary.approvedAt, order.status) : {}),
    };
    // Enquanto o pagamento aguarda o pagador (`pending`/`awaiting_pix`/
    // `awaiting_boleto`), preservamos o QR/boleto para reexibição em
    // `/conta/pedidos`. Quando resolve (pago/recusado/cancelado/estornado), o
    // artefato venceu — apagamos (privacidade + tamanho do doc).
    const clearPaymentArtifacts = !(
      AWAITING_PAYMENT_STATUSES as readonly string[]
    ).includes(summary.status);
    tx.set(ref, mergeOrderPatch(order, patch, { clearPaymentArtifacts }));

    return { changed: true, orderId: order.id, status: summary.status };
  });
}
