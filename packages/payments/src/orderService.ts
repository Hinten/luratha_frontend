import "server-only";

import type { Transaction } from "firebase-admin/firestore";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { adminStockConverter } from "@luratha/firestore/adminStockConverter";
import {
  AWAITING_PAYMENT_STATUSES,
  PAYMENT_FAILURE_STATUSES,
  firestoreCollections,
  type Order,
  type Product,
  type Stock,
  validateOrder,
} from "@luratha/schemas";
import { logger } from "@luratha/core/logging/logger";
import { createOrder, getOrder } from "./mercadoPago";
import { planStockRelease } from "./orderStock";
import { buildStatusPatch } from "./orderStatusPatch";
import { sendGa4Purchase } from "./ga4MeasurementProtocol";
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
  // eslint-disable-next-line no-restricted-syntax -- sanctioned payments data layer: this orchestration intentionally builds its own converter-bound ref (adminOrderConverter) so reads+writes share one runTransaction (idempotency / anti-loss). Routing through ordersRepository would break that atomicity. Writes are schema-validated by the converter's toFirestore.
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
 * Devolve o estoque reservado por um pedido, dentro de uma transação aberta
 * pelo chamador. Faz `tx.getAll` de stocks/produtos e por isso deve ser
 * chamada **antes de qualquer escrita** da transação (Firestore exige todas
 * as leituras antes da primeira escrita); as escritas de stock/`totalStock`
 * acontecem aqui dentro, e o chamador persiste o Order retornado (já com
 * `stockMovement: "released"`).
 *
 * O chamador é responsável pelo predicado de disparo E pelo guard de
 * idempotência (`order.stockMovement === "decremented"`):
 *  - `maybeReleaseStockInTx` (abaixo) dispara quando o pagamento entra em
 *    `failed`/`cancelled`/`rejected`;
 *  - `PATCH /api/orders/[id]` dispara quando o pedido transiciona para
 *    `status: "cancelled"` (cancelamento manual do dono/admin).
 */
export async function releaseOrderStockInTx(tx: Transaction, order: Order): Promise<Order> {
  const productIds = Array.from(new Set(order.items.map((item) => item.productId)));
  const productRefs = productIds.map((pid) =>
    // eslint-disable-next-line no-restricted-syntax -- sanctioned payments data layer: stock release shares the order's runTransaction (reads+writes atomic with the status patch); refs are converter-bound.
    adminDb.collection(firestoreCollections.products).doc(pid).withConverter(adminProductConverter),
  );
  const stockRefs = productIds.map((pid) =>
    // eslint-disable-next-line no-restricted-syntax -- sanctioned payments data layer: see above.
    adminDb.collection(firestoreCollections.stock).doc(pid).withConverter(adminStockConverter),
  );
  const [productSnaps, stockSnaps] = await Promise.all([
    tx.getAll(...productRefs),
    tx.getAll(...stockRefs),
  ]);

  const products = new Map<string, Product>();
  for (const snap of productSnaps) {
    if (!snap.exists) continue;
    // getAll perde o tipo do converter (DocumentData) — cast como nos demais consumidores.
    const product = snap.data() as Product;
    products.set(product.id, product);
  }
  const stocks = new Map<string, Stock>();
  for (const snap of stockSnaps) {
    if (!snap.exists) continue;
    const stock = snap.data() as Stock;
    stocks.set(stock.productId, stock);
  }

  const plan = planStockRelease(order.items, products, stocks, new Date().toISOString());
  if (plan.warnings.length > 0) {
    logger.warn("[payments] devolução de estoque degradada", {
      orderId: order.id,
      warnings: plan.warnings,
    });
  }

  for (const nextStock of plan.nextStocks) {
    // eslint-disable-next-line no-restricted-syntax -- sanctioned payments data layer: see above.
    const ref = adminDb
      .collection(firestoreCollections.stock)
      .doc(nextStock.productId)
      .withConverter(adminStockConverter);
    tx.set(ref, nextStock);
  }
  for (const [productId, totalStock] of plan.nextTotalStockByProduct) {
    // eslint-disable-next-line no-restricted-syntax -- sanctioned payments data layer: see above.
    const ref = adminDb
      .collection(firestoreCollections.products)
      .doc(productId)
      .withConverter(adminProductConverter);
    // Update parcial do espelho denormalizado (update() não passa pelo converter).
    tx.update(ref, { totalStock });
  }

  return validateOrder({ ...order, stockMovement: "released" });
}

/**
 * Devolve o estoque quando o patch leva o pagamento a um estado de falha
 * (`failed`/`cancelled`/`rejected` — recusa síncrona de cartão, expiração de
 * PIX/boleto ou cancelamento via webhook). Estornos (`refunded`/
 * `charged_back`) NÃO liberam — mercadoria devolvida exige inspeção manual
 * antes de voltar à vitrine (`POST /api/stock`). Idempotente via
 * `current.stockMovement` (pedidos legados sem o campo são no-op).
 */
async function maybeReleaseStockInTx(
  tx: Transaction,
  current: Order,
  merged: Order,
): Promise<Order> {
  const entersFailure = (PAYMENT_FAILURE_STATUSES as readonly string[]).includes(
    merged.paymentStatus,
  );
  if (!entersFailure || current.stockMovement !== "decremented") {
    return merged;
  }
  return releaseOrderStockInTx(tx, merged);
}

/**
 * Aplica um patch em uma Order dentro de uma transação Firestore — garante
 * que reads/writes concorrentes (dois webhooks ou webhook + payment-intent
 * disparados simultaneamente) não se sobrescrevam. Quando o patch leva o
 * pagamento a um estado de falha, a mesma transação devolve o estoque
 * reservado (ver `maybeReleaseStockInTx`).
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
    const current = snapshot.data() as Order;
    const merged = await maybeReleaseStockInTx(tx, current, mergeOrderPatch(current, patch, opts));
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

  const outcome = await adminDb.runTransaction(async (tx) => {
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
      return { changed: false, order, becamePaid: false };
    }

    const patch: Partial<Order> = {
      paymentIntentId: summary.paymentId,
      ...(statusChanged ? buildStatusPatch(summary.status, summary.approvedAt, order.status) : {}),
    };
    // Enquanto o pagamento aguarda o pagador (`pending`/`awaiting_pix`/
    // `awaiting_boleto`), preservamos o QR/boleto para reexibição em
    // `/conta/pedidos`. Quando resolve (pago/recusado/cancelado/estornado), o
    // artefato venceu — apagamos (privacidade + tamanho do doc).
    const clearPaymentArtifacts = !(AWAITING_PAYMENT_STATUSES as readonly string[]).includes(
      summary.status,
    );
    const merged = await maybeReleaseStockInTx(
      tx,
      order,
      mergeOrderPatch(order, patch, { clearPaymentArtifacts }),
    );
    tx.set(ref, merged);

    // Transição p/ pago acontecendo AGORA (pagamento assíncrono confirmado): o
    // pedido não estava `paid` e passou a estar. É o gatilho do `purchase`
    // server-side (PIX/boleto/cartão pós-análise). O cartão aprovado na hora já
    // chega `paid` (medido client-side) → este webhook vê `order.status ===
    // "paid"` e não reentra aqui.
    const becamePaid = merged.status === "paid" && order.status !== "paid";
    return { changed: true, order: merged, becamePaid };
  });

  // GA4 `purchase` server-side FORA da transação (I/O de rede). Idempotente: o
  // guard `becamePaid` só dispara na transição, e a flag `ga4PurchaseSent`
  // barra reenvios. `sendGa4Purchase` nunca lança — falha no GA não pode
  // impedir o ACK do webhook (senão o MP reentrega indefinidamente).
  if (outcome.becamePaid && !outcome.order.ga4PurchaseSent) {
    const sent = await sendGa4Purchase(outcome.order);
    if (sent) {
      await persistOrderPatch(outcome.order.id, { ga4PurchaseSent: true });
    }
  }

  return { changed: outcome.changed, orderId: outcome.order.id, status: summary.status };
}
