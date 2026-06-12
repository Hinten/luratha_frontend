/**
 * Cloud integration tests for the MercadoPago webhook handler.
 *
 * Exercises the real Firestore path (project luratha-96386): the webhook
 * advancing `Order.paymentStatus` to `paid`, and the idempotency guard that
 * skips repeat notifications.
 *
 * The MercadoPago adapter is mocked at `@luratha/payments/mercadoPago` — the
 * real orderService still runs against Firestore through the package barrel.
 *
 * Execute: pnpm --filter @luratha/mercadopago test:firestore
 * The suite is automatically skipped when credentials are not available.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import { adminStockConverter } from "@luratha/firestore/adminStockConverter";
import { firestoreCollections, validateStock, type Order, type Stock } from "@luratha/schemas";
import { buildPendingOrderFixture } from "@luratha/schemas/__fixtures__/orders";
import { createCloudTestPrefix, describeCloud } from "@/src/test/cloud/sharedSetup";

// ── MercadoPago adapter mock (no real provider calls) ──────────────────────
const mp = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  verifyWebhookSignature: vi.fn(() => true),
  mapMpStatus: vi.fn(),
}));
// importActual preserva o restante das exports do módulo (`isMercadoPagoSandbox`,
// `withSandboxPayer`, `describeMercadoPagoError`) que o barrel `@luratha/payments`
// re-exporta — sem isso elas viram `undefined` em qualquer code path futuro
// que as toque, escondendo a causa real do erro.
vi.mock("@luratha/payments/mercadoPago", async () => {
  const actual = await vi.importActual<typeof import("@luratha/payments/mercadoPago")>(
    "@luratha/payments/mercadoPago",
  );
  return { ...actual, ...mp };
});

import { POST as webhookPOST } from "@/src/app/api/webhooks/mercadopago/route";

type SeedDocument = { collection: string; id: string };

async function cleanupDocuments(tracked: SeedDocument[]): Promise<void> {
  await Promise.all(
    tracked.map(({ collection, id }) => adminDb.collection(collection).doc(id).delete()),
  );
}

describeCloud("/api/webhooks/mercadopago (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  const userId = `${prefix}-user`;
  const seededDocs: SeedDocument[] = [];

  beforeEach(() => {
    // Reset por teste — `mockResolvedValueOnce` + `retry: 1` do vitest cloud
    // config interagiriam mal sem isso (queue esvazia entre attempts e o
    // segundo retry recebe `undefined`).
    mp.getOrder.mockReset();
    mp.verifyWebhookSignature.mockReset().mockReturnValue(true);
  });

  afterAll(async () => {
    await cleanupDocuments(seededDocs);
  });

  async function seedOrder(overrides: Partial<Order> = {}): Promise<string> {
    const order = buildPendingOrderFixture({ id: randomUUID(), userId, ...overrides });
    const ref = adminDb
      .collection(firestoreCollections.orders)
      .doc(order.id)
      .withConverter(adminOrderConverter);
    await ref.set(order);
    seededDocs.push({ collection: firestoreCollections.orders, id: order.id });
    return order.id;
  }

  /**
   * Pedido com estoque reservado (`stockMovement: "decremented"`) + doc de
   * `stock` correspondente — para os testes de devolução. Não seeda o doc de
   * produto: o release tolera produto ausente (warning, pula o `totalStock`)
   * e o caminho completo com produto é coberto em `ordersApi.cloud.test.ts`.
   */
  async function seedDecrementedOrderWithStock(stockQuantity: number): Promise<{
    orderId: string;
    productId: string;
  }> {
    const productId = `${prefix}-prod-${randomUUID().slice(0, 8)}`;
    const stock = validateStock({
      productId,
      sku: "SKU-PAY-AB",
      quantity: stockQuantity,
      hasVariants: false,
      variants: null,
      updatedAt: new Date().toISOString(),
    });
    await adminDb
      .collection(firestoreCollections.stock)
      .doc(productId)
      .withConverter(adminStockConverter)
      .set(stock);
    seededDocs.push({ collection: firestoreCollections.stock, id: productId });

    const orderId = await seedOrder({
      stockMovement: "decremented",
      items: [
        {
          id: "item-1",
          productId,
          itemSku: "SKU-PAY-AB",
          name: "Vestido Linho",
          photoId: "img-pay-001",
          quantity: 1,
          unitPrice: 200,
          lineTotal: 200,
          currency: "BRL",
        },
      ],
    });
    return { orderId, productId };
  }

  async function readStock(productId: string): Promise<Stock | null> {
    const snap = await adminDb
      .collection(firestoreCollections.stock)
      .doc(productId)
      .withConverter(adminStockConverter)
      .get();
    return snap.exists ? snap.data()! : null;
  }

  function webhookRequest(mpOrderId: string, requestId: string): Request {
    return new Request("http://localhost/api/webhooks/mercadopago", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-signature": "ts=1,v1=mocked",
        "x-request-id": requestId,
      },
      body: JSON.stringify({ type: "order", data: { id: mpOrderId } }),
    });
  }

  it("webhook advances the order to paid", async () => {
    const orderId = await seedOrder();

    mp.getOrder.mockResolvedValueOnce({
      paymentId: "mp-cloud-002",
      status: "paid",
      orderId,
      approvedAt: "2026-05-19T12:00:00.000Z",
    });

    const res = await webhookPOST(
      new Request("http://localhost/api/webhooks/mercadopago", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature": "ts=1,v1=mocked",
          "x-request-id": "req-cloud-1",
        },
        body: JSON.stringify({ type: "order", data: { id: "ORD-cloud-002" } }),
      }),
    );

    expect(res.status).toBe(200);
    const outcome = (await res.json()) as { changed: boolean; status: string };
    expect(outcome.changed).toBe(true);
    expect(outcome.status).toBe("paid");

    const persisted = await adminDb
      .collection(firestoreCollections.orders)
      .doc(orderId)
      .withConverter(adminOrderConverter)
      .get();
    const order = persisted.data();
    expect(order?.paymentStatus).toBe("paid");
    expect(order?.status).toBe("paid");
    expect(order?.paidAt).toBe("2026-05-19T12:00:00.000Z");
  });

  it("webhook clears persisted PIX artifacts when the payment becomes paid", async () => {
    // O pedido foi semeado com o QR do PIX (reexibido em /conta/pedidos enquanto
    // pending). Ao compensar, o webhook deve apagar `paymentPix` — QR vencido
    // não deve persistir (privacidade + tamanho do doc).
    const orderId = await seedOrder({
      paymentPix: {
        qrCode: "00020126-PIX-cloud",
        qrCodeBase64: "QR-CLOUD-BASE64",
        expiresAt: "2026-05-29T12:00:00.000Z",
      },
    });

    mp.getOrder.mockResolvedValueOnce({
      paymentId: "mp-cloud-clear-001",
      status: "paid",
      orderId,
      approvedAt: "2026-05-19T12:00:00.000Z",
    });

    const res = await webhookPOST(
      new Request("http://localhost/api/webhooks/mercadopago", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature": "ts=1,v1=mocked",
          "x-request-id": "req-cloud-clear-1",
        },
        body: JSON.stringify({ type: "order", data: { id: "ORD-cloud-clear-1" } }),
      }),
    );

    expect(res.status).toBe(200);

    const persisted = await adminDb
      .collection(firestoreCollections.orders)
      .doc(orderId)
      .withConverter(adminOrderConverter)
      .get();
    const order = persisted.data();
    expect(order?.paymentStatus).toBe("paid");
    expect(order?.paymentPix).toBeUndefined();
  });

  it("webhook persists paymentIntentId even when status did not change", async () => {
    // Caso real: primeira notificação chega com `action_required` (mapeia pra
    // status "pending", igual ao seed). O status não muda, mas o
    // `paymentIntentId` do MP ainda precisa ser gravado pra correlacionar
    // eventos futuros. Antes do fix, a função retornava cedo sem escrever.
    const orderId = await seedOrder();

    mp.getOrder.mockResolvedValueOnce({
      paymentId: "mp-cloud-pending-001",
      status: "pending",
      orderId,
    });

    const res = await webhookPOST(
      new Request("http://localhost/api/webhooks/mercadopago", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature": "ts=1,v1=mocked",
          "x-request-id": "req-cloud-pending-1",
        },
        body: JSON.stringify({ type: "order", data: { id: "ORD-cloud-pending-1" } }),
      }),
    );

    expect(res.status).toBe(200);
    const outcome = (await res.json()) as { changed: boolean };
    expect(outcome.changed).toBe(true);

    const persisted = await adminDb
      .collection(firestoreCollections.orders)
      .doc(orderId)
      .withConverter(adminOrderConverter)
      .get();
    const order = persisted.data();
    expect(order?.paymentIntentId).toBe("mp-cloud-pending-001");
    expect(order?.paymentStatus).toBe("pending");
  });

  it("webhook de contestação → paymentStatus in_dispute, Order.status preservado", async () => {
    // Contestação (MP `charged_back/in_process`) só muda o pagamento — o pedido
    // pode já ter sido enviado, então `Order.status` não é tocado. Valida também
    // que o Firestore aceita o novo valor de enum.
    const orderId = await seedOrder();

    mp.getOrder.mockResolvedValueOnce({
      paymentId: "mp-cloud-dispute-001",
      status: "in_dispute",
      orderId,
    });

    const res = await webhookPOST(
      new Request("http://localhost/api/webhooks/mercadopago", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature": "ts=1,v1=mocked",
          "x-request-id": "req-cloud-dispute-1",
        },
        body: JSON.stringify({ type: "order", data: { id: "ORD-cloud-dispute-1" } }),
      }),
    );

    expect(res.status).toBe(200);

    const persisted = await adminDb
      .collection(firestoreCollections.orders)
      .doc(orderId)
      .withConverter(adminOrderConverter)
      .get();
    const order = persisted.data();
    expect(order?.paymentStatus).toBe("in_dispute");
    // Seed é `pending_payment` — a disputa não mexe no fulfillment.
    expect(order?.status).toBe("pending_payment");
  });

  it("webhook de pagamento cancelado devolve o estoque reservado (decremented → released)", async () => {
    const { orderId, productId } = await seedDecrementedOrderWithStock(3);

    mp.getOrder.mockResolvedValueOnce({
      paymentId: "mp-cloud-release-001",
      status: "cancelled",
      orderId,
    });

    const res = await webhookPOST(webhookRequest("ORD-cloud-release-1", "req-cloud-release-1"));
    expect(res.status).toBe(200);

    const persisted = await adminDb
      .collection(firestoreCollections.orders)
      .doc(orderId)
      .withConverter(adminOrderConverter)
      .get();
    const order = persisted.data();
    expect(order?.paymentStatus).toBe("cancelled");
    expect(order?.status).toBe("cancelled");
    expect(order?.stockMovement).toBe("released");

    // Item qty 1 devolvido: 3 → 4.
    expect((await readStock(productId))?.quantity).toBe(4);
  });

  it("webhook de falha repetida não devolve o estoque duas vezes", async () => {
    const { orderId, productId } = await seedDecrementedOrderWithStock(0);

    // 1º evento: cartão rejeitado — order continua pending_payment (o cliente
    // pode tentar outro método), mas o estoque volta.
    mp.getOrder.mockResolvedValueOnce({
      paymentId: "mp-cloud-rejected-001",
      status: "rejected",
      orderId,
    });
    const first = await webhookPOST(webhookRequest("ORD-cloud-reject-1", "req-cloud-reject-1"));
    expect(first.status).toBe(200);

    let order = (
      await adminDb
        .collection(firestoreCollections.orders)
        .doc(orderId)
        .withConverter(adminOrderConverter)
        .get()
    ).data();
    expect(order?.paymentStatus).toBe("rejected");
    expect(order?.status).toBe("pending_payment");
    expect(order?.stockMovement).toBe("released");
    expect((await readStock(productId))?.quantity).toBe(1);

    // 2º evento com OUTRO status de falha: o guard `stockMovement` impede a
    // segunda devolução.
    mp.getOrder.mockResolvedValueOnce({
      paymentId: "mp-cloud-rejected-001",
      status: "cancelled",
      orderId,
    });
    const second = await webhookPOST(webhookRequest("ORD-cloud-reject-1", "req-cloud-reject-2"));
    expect(second.status).toBe(200);

    order = (
      await adminDb
        .collection(firestoreCollections.orders)
        .doc(orderId)
        .withConverter(adminOrderConverter)
        .get()
    ).data();
    expect(order?.paymentStatus).toBe("cancelled");
    expect((await readStock(productId))?.quantity).toBe(1);
  });

  it("webhook de estorno (refunded) NÃO devolve estoque — devolução exige inspeção manual", async () => {
    const { orderId, productId } = await seedDecrementedOrderWithStock(2);

    mp.getOrder.mockResolvedValueOnce({
      paymentId: "mp-cloud-refund-001",
      status: "refunded",
      orderId,
    });

    const res = await webhookPOST(webhookRequest("ORD-cloud-refund-1", "req-cloud-refund-1"));
    expect(res.status).toBe(200);

    const order = (
      await adminDb
        .collection(firestoreCollections.orders)
        .doc(orderId)
        .withConverter(adminOrderConverter)
        .get()
    ).data();
    expect(order?.paymentStatus).toBe("refunded");
    expect(order?.stockMovement).toBe("decremented");
    expect((await readStock(productId))?.quantity).toBe(2);
  });

  it("webhook de cancelamento em pedido legado (sem stockMovement) é no-op de estoque", async () => {
    const orderId = await seedOrder();

    mp.getOrder.mockResolvedValueOnce({
      paymentId: "mp-cloud-legacy-001",
      status: "cancelled",
      orderId,
    });

    const res = await webhookPOST(webhookRequest("ORD-cloud-legacy-1", "req-cloud-legacy-1"));
    expect(res.status).toBe(200);

    const order = (
      await adminDb
        .collection(firestoreCollections.orders)
        .doc(orderId)
        .withConverter(adminOrderConverter)
        .get()
    ).data();
    expect(order?.paymentStatus).toBe("cancelled");
    expect(order?.stockMovement).toBeUndefined();
  });

  it("webhook is idempotent on a repeated notification", async () => {
    const orderId = await seedOrder();

    mp.getOrder.mockResolvedValue({
      paymentId: "ORD-cloud-003",
      status: "paid",
      orderId,
      approvedAt: "2026-05-19T12:00:00.000Z",
    });

    const makeRequest = () =>
      new Request("http://localhost/api/webhooks/mercadopago", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature": "ts=1,v1=mocked",
          "x-request-id": "req-cloud-2",
        },
        body: JSON.stringify({ type: "order", data: { id: "ORD-cloud-003" } }),
      });

    const first = await webhookPOST(makeRequest());
    expect((await first.json()).changed).toBe(true);

    const second = await webhookPOST(makeRequest());
    expect(second.status).toBe(200);
    expect((await second.json()).changed).toBe(false);
  });
});
