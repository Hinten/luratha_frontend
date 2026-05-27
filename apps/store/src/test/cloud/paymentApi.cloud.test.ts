/**
 * Cloud integration tests for the checkout payment endpoints.
 *
 * Exercises the real Firestore path (project luratha-96386): the payment-intent
 * handler persisting `paymentIntentId` on the Order, and the MercadoPago webhook
 * advancing `paymentStatus` to `paid`.
 *
 * The MercadoPago SDK adapter is mocked — no real calls to MercadoPago are made.
 *
 * Execute: npm run test:firestore
 * The suite is automatically skipped when credentials are not available.
 */

import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import { firestoreCollections } from "@luratha/schemas";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";

// ── Auth mock ──────────────────────────────────────────────────────────────
const auth = vi.hoisted(() => ({
  state: { current: null as { uid: string; email: string | null; isAdmin: boolean } | null },
}));
function mockAuthedUser(uid: string | null) {
  auth.state.current = uid ? { uid, email: `${uid}@test.luratha`, isAdmin: false } : null;
}
vi.mock("@luratha/auth/requireUser", () => {
  class AuthError extends Error {
    constructor(
      public readonly status: 401 | 403,
      message: string,
    ) {
      super(message);
      this.name = "AuthError";
    }
  }
  return {
    AuthError,
    requireUser: async () => {
      if (!auth.state.current) throw new AuthError(401, "Não autenticado.");
      return auth.state.current;
    },
    authErrorResponse: (err: unknown) =>
      err instanceof AuthError
        ? NextResponse.json({ message: err.message }, { status: err.status })
        : null,
  };
});

// ── MercadoPago adapter mock (no real provider calls) ──────────────────────
const mp = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  verifyWebhookSignature: vi.fn(() => true),
  mapMpStatus: vi.fn(),
}));
vi.mock("@/src/lib/payment/mercadoPago", () => mp);

import { POST as ordersPOST } from "@/src/app/api/orders/route";
import { POST as paymentIntentPOST } from "@/src/app/api/checkout/payment-intent/route";
import { POST as webhookPOST } from "@/src/app/api/webhooks/mercadopago/route";

type SeedDocument = { collection: string; id: string };

async function cleanupDocuments(tracked: SeedDocument[]): Promise<void> {
  await Promise.all(
    tracked.map(({ collection, id }) => adminDb.collection(collection).doc(id).delete()),
  );
}

function buildOrderPayload(userId: string) {
  return {
    userId,
    orderNumber: `ORD-${Date.now().toString().slice(-10)}`,
    status: "pending_payment" as const,
    paymentMethod: "pix" as const,
    paymentStatus: "pending" as const,
    items: [
      {
        id: "item-1",
        productId: "prod-pay-001",
        itemSku: "SKU-PAY-AB",
        name: "Vestido Linho",
        photoId: "img-pay-001",
        quantity: 1,
        unitPrice: 200,
        lineTotal: 200,
        currency: "BRL" as const,
      },
    ],
    itemCount: 1,
    subtotal: 200,
    discountTotal: 0,
    shippingTotal: 20,
    grandTotal: 220,
    currency: "BRL" as const,
    shippingAddressPath: `userProfiles/${userId}/addresses/addr-pay-001`,
  };
}

describeCloud("/api/checkout payment endpoints (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  const userId = `${prefix}-user`;
  const seededDocs: SeedDocument[] = [];

  beforeAll(() => {
    mockAuthedUser(userId);
  });

  afterAll(async () => {
    await cleanupDocuments(seededDocs);
    mockAuthedUser(null);
  });

  async function seedOrder(): Promise<string> {
    const res = await ordersPOST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOrderPayload(userId)),
      }),
    );
    expect(res.status).toBe(201);
    const order = (await res.json()) as { id: string };
    seededDocs.push({ collection: firestoreCollections.orders, id: order.id });
    return order.id;
  }

  it("payment-intent persists paymentIntentId on the order", async () => {
    const orderId = await seedOrder();

    mp.createOrder.mockResolvedValueOnce({
      paymentId: "mp-cloud-001",
      paymentMethod: "pix",
      status: "pending",
      pix: { qrCode: "qr-code-data", qrCodeBase64: "qr-code-base64" },
    });

    const res = await paymentIntentPOST(
      new Request("http://localhost/api/checkout/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: "pix",
          orderId,
          payer: {
            email: "comprador@teste.com",
            identification: { type: "CPF", number: "12345678909" },
          },
        }),
      }),
    );

    expect(res.status).toBe(201);
    const result = (await res.json()) as { paymentId: string };
    expect(result.paymentId).toBe("mp-cloud-001");

    const persisted = await adminDb
      .collection(firestoreCollections.orders)
      .doc(orderId)
      .withConverter(adminOrderConverter)
      .get();
    expect(persisted.data()?.paymentIntentId).toBe("mp-cloud-001");
  });

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
