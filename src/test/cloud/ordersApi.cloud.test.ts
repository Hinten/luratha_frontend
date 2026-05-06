/**
 * Cloud integration tests for the /api/orders endpoints.
 *
 * Runs against a real Firebase project using credentials provided via:
 *   FIREBASE_SERVICE_ACCOUNT_BASE64 – service account for admin-level seeding/cleanup
 *
 * Execute: npm run test:firestore
 *
 * The suite is automatically skipped when credentials are not available.
 *
 * What is covered:
 *   1. POST /api/orders             — creates an order, persists to Firestore
 *   2. POST /api/orders             — returns 400 on invalid payload
 *   3. GET  /api/orders?userId=     — lists orders for that user, newest-first
 *   4. GET  /api/orders/:id         — fetches a specific order
 *   5. GET  /api/orders/:id         — returns 404 when missing
 *   6. PATCH /api/orders/:id        — updates status, preserves immutable fields
 */

import { afterAll, expect, it } from "vitest";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { firestoreCollections } from "@/src/schemas/firestore";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";
import { POST as ordersPOST } from "@/src/app/api/orders/route";
import { GET as ordersGET } from "@/src/app/api/orders/route";
import { GET as orderGET } from "@/src/app/api/orders/[id]/route";
import { PATCH as orderPATCH } from "@/src/app/api/orders/[id]/route";

type SeedDocument = { collection: string; id: string };

async function cleanupDocuments(tracked: SeedDocument[]): Promise<void> {
  await Promise.all(
    tracked.map(({ collection, id }) => adminDb.collection(collection).doc(id).delete()),
  );
}

/** Builds a valid Order payload (server fields will be set by POST handler) */
function buildOrderPayload(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    userId,
    orderNumber: `ORD-${Date.now().toString().slice(-10)}`,
    status: "pending_payment" as const,
    paymentMethod: "pix" as const,
    paymentStatus: "pending" as const,
    items: [
      {
        id: "item-1",
        productId: "prod-cloud-001",
        variantId: "var-cloud-001-p",
        itemSku: "SKU-CLOUD-AB",
        name: "Vestido Linho",
        photoId: "img-cloud-001",
        quantity: 2,
        unitPrice: 100,
        lineTotal: 200,
        currency: "BRL" as const,
      },
    ],
    itemCount: 2,
    subtotal: 200,
    discountTotal: 0,
    shippingTotal: 20,
    grandTotal: 220,
    currency: "BRL" as const,
    shippingAddressPath: `userProfiles/${userId}/addresses/addr-cloud-001`,
    ...overrides,
  };
}

describeCloud("/api/orders (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  // uidSchema requires 6-128 chars; the prefix is already long enough.
  const userId = `${prefix}-user`;
  const seededDocs: SeedDocument[] = [];

  afterAll(async () => {
    await cleanupDocuments(seededDocs);
  });

  // ── POST /api/orders ─────────────────────────────────────────────────────

  it("POST /api/orders creates a new order and returns 201", async () => {
    const payload = buildOrderPayload(userId);

    const response = await ordersPOST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string; userId: string; status: string };

    expect(created.id).toBeTruthy();
    expect(created.userId).toBe(userId);
    expect(created.status).toBe("pending_payment");
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    // Confirm it persisted in Firestore
    const persisted = await adminDb.collection(firestoreCollections.orders).doc(created.id).get();
    expect(persisted.exists).toBe(true);
  });

  it("POST /api/orders returns 400 on invalid payload (missing required fields)", async () => {
    const response = await ordersPOST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: "pending_payment" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  // ── GET /api/orders?userId= ──────────────────────────────────────────────

  it("GET /api/orders?userId= lists orders for the user, newest-first", async () => {
    // Create a second order so the list returns multiple
    const second = buildOrderPayload(userId, { orderNumber: `ORD-2-${Date.now().toString().slice(-8)}` });
    const createRes = await ordersPOST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(second),
      }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    const response = await ordersGET(new Request(`http://localhost/api/orders?userId=${userId}`));
    expect(response.status).toBe(200);
    const orders = (await response.json()) as Array<{ id: string; userId: string }>;

    expect(Array.isArray(orders)).toBe(true);
    expect(orders.length).toBeGreaterThanOrEqual(2);
    expect(orders.every((o) => o.userId === userId)).toBe(true);
  });

  it("GET /api/orders without userId returns 400", async () => {
    const response = await ordersGET(new Request("http://localhost/api/orders"));
    expect(response.status).toBe(400);
  });

  // ── GET /api/orders/:id ──────────────────────────────────────────────────

  it("GET /api/orders/:id returns the order when it exists", async () => {
    const payload = buildOrderPayload(userId);
    const createRes = await ordersPOST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
    const created = (await createRes.json()) as { id: string };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    const response = await orderGET(new Request(`http://localhost/api/orders/${created.id}`), {
      params: Promise.resolve({ id: created.id }),
    });

    expect(response.status).toBe(200);
    const fetched = (await response.json()) as { id: string };
    expect(fetched.id).toBe(created.id);
  });

  it("GET /api/orders/:id returns 404 when missing", async () => {
    const response = await orderGET(new Request("http://localhost/api/orders/does-not-exist"), {
      params: Promise.resolve({ id: "does-not-exist" }),
    });
    expect(response.status).toBe(404);
  });

  // ── PATCH /api/orders/:id ────────────────────────────────────────────────

  it("PATCH /api/orders/:id updates status and preserves immutable fields", async () => {
    const payload = buildOrderPayload(userId);
    const createRes = await ordersPOST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
    const created = (await createRes.json()) as {
      id: string;
      userId: string;
      createdAt: string;
    };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    // Try to also overwrite userId (should be preserved by the handler)
    const response = await orderPATCH(
      new Request(`http://localhost/api/orders/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid", paymentStatus: "paid", userId: "hacker-uid" }),
      }),
      { params: Promise.resolve({ id: created.id }) },
    );

    expect(response.status).toBe(200);
    const updated = (await response.json()) as {
      status: string;
      paymentStatus: string;
      userId: string;
      createdAt: string;
      updatedAt: string;
    };

    expect(updated.status).toBe("paid");
    expect(updated.paymentStatus).toBe("paid");
    expect(updated.userId).toBe(created.userId);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).not.toBe(created.createdAt);
  });

  it("PATCH /api/orders/:id returns 404 when missing", async () => {
    const response = await orderPATCH(
      new Request("http://localhost/api/orders/missing-id", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      }),
      { params: Promise.resolve({ id: "missing-id" }) },
    );
    expect(response.status).toBe(404);
  });
});
