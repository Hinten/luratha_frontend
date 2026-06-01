/**
 * Cloud integration tests for the checkout payment-intent endpoint.
 *
 * Exercises the real Firestore path (project luratha-96386): the payment-intent
 * handler persisting `paymentIntentId` on the Order.
 *
 * The MercadoPago SDK adapter is mocked — no real calls to MercadoPago are made.
 *
 * The webhook scenarios that used to live here moved to
 * `apps/mercadopago/src/test/cloud/webhook.cloud.test.ts` when the webhook was
 * split into its own app.
 *
 * Execute: npm run test:firestore
 * The suite is automatically skipped when credentials are not available.
 */

import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import { firestoreCollections } from "@luratha/schemas";
import { buildPendingOrderFixture } from "@luratha/schemas/__fixtures__/orders";
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
// The orderService uses createOrder/getOrder internally — by mocking the
// adapter subpath we let the real createPaymentIntent run against Firestore.
// importActual preserves the rest of the module's exports (isMercadoPagoSandbox,
// withSandboxPayer, describeMercadoPagoError) so any future caller that lands
// in the import graph doesn't get `undefined` silently.
const mp = vi.hoisted(() => ({
  createOrder: vi.fn(),
  getOrder: vi.fn(),
  verifyWebhookSignature: vi.fn(() => true),
  mapMpStatus: vi.fn(),
}));
vi.mock("@luratha/payments/mercadoPago", async () => {
  const actual =
    await vi.importActual<typeof import("@luratha/payments/mercadoPago")>(
      "@luratha/payments/mercadoPago",
    );
  return { ...actual, ...mp };
});

import { POST as ordersPOST } from "@/src/app/api/orders/route";
import { POST as paymentIntentPOST } from "@/src/app/api/checkout/payment-intent/route";

type SeedDocument = { collection: string; id: string };

async function cleanupDocuments(tracked: SeedDocument[]): Promise<void> {
  await Promise.all(
    tracked.map(({ collection, id }) => adminDb.collection(collection).doc(id).delete()),
  );
}

describeCloud("/api/checkout/payment-intent (Cloud Firebase)", () => {
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
        body: JSON.stringify(buildPendingOrderFixture({ userId })),
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
});
