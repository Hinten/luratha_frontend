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
 * O `POST /api/orders` valida itens contra o catálogo e decrementa estoque —
 * a suite seeda produtos + docs de `stock` reais (re-seedados por teste para
 * asserções determinísticas) e cobre o ciclo decremento → release.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminCouponConverter } from "@luratha/firestore/adminCouponConverter";
import { firestoreCollections, type Coupon } from "@luratha/schemas";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";
import {
  VARIANT_M_SKU,
  buildSimpleProduct,
  buildVariableProduct,
  cleanupDocuments,
  readStockDoc,
  seedProduct,
  seedStockDoc,
  type SeedDocument,
} from "@/src/test/cloud/productFixtures";

// Mock auth: cada test configura mockAuthedUser({ uid, isAdmin? }) ou null para deslogado.
const auth = vi.hoisted(() => {
  return {
    state: { current: null as { uid: string; email: string | null; isAdmin: boolean } | null },
  };
});
function mockAuthedUser(opts: { uid: string; isAdmin?: boolean; email?: string | null } | null) {
  auth.state.current = opts
    ? {
        uid: opts.uid,
        email: opts.email ?? `${opts.uid}@test.luratha`,
        isAdmin: opts.isAdmin ?? false,
      }
    : null;
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
    SESSION_COOKIE_NAME: "__session",
    AuthError,
    requireUser: async () => {
      if (!auth.state.current) throw new AuthError(401, "Não autenticado.");
      return auth.state.current;
    },
    requireOwnerOrAdmin: async (target: string) => {
      if (!auth.state.current) throw new AuthError(401, "Não autenticado.");
      const u = auth.state.current;
      if (u.isAdmin || u.uid === target) return u;
      throw new AuthError(403, "Acesso negado.");
    },
    authErrorResponse: (err: unknown) => {
      if (err instanceof AuthError) {
        return NextResponse.json({ message: err.message }, { status: err.status });
      }
      return null;
    },
  };
});

// Imports dos handlers acontecem após o vi.mock (hoisted)
import { POST as ordersPOST } from "@/src/app/api/orders/route";
import { GET as ordersGET } from "@/src/app/api/orders/route";
import { GET as orderGET } from "@/src/app/api/orders/[id]/route";
import { PATCH as orderPATCH } from "@/src/app/api/orders/[id]/route";

const SIMPLE_DEFAULT_STOCK = 50;
const VARIANT_M_DEFAULT_STOCK = 30;
const VARIANT_G_DEFAULT_STOCK = 5;

describeCloud("/api/orders (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  const userId = `${prefix}-user`;
  const simple = buildSimpleProduct(prefix);
  const variable = buildVariableProduct(prefix);
  const seededDocs: SeedDocument[] = [
    { collection: firestoreCollections.products, id: simple.id },
    { collection: firestoreCollections.products, id: variable.id },
    { collection: firestoreCollections.stock, id: simple.id },
    { collection: firestoreCollections.stock, id: variable.id },
  ];

  // Coupon.code tem limite de 32 chars — nonce curto, prefix fica no id.
  const couponNonce = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const couponCode = `T${couponNonce}ORD`;
  const couponId = `${prefix}-order-coupon`;

  /** Pedido válido: 2× produto simples (120) + frete 20 = 260. */
  function buildOrderPayload(forUserId: string, overrides: Record<string, unknown> = {}) {
    return {
      userId: forUserId,
      orderNumber: `ORD-${Date.now().toString().slice(-10)}`,
      status: "pending_payment" as const,
      paymentMethod: "pix" as const,
      paymentStatus: "pending" as const,
      items: [
        {
          id: simple.id,
          productId: simple.id,
          itemSku: simple.sku,
          name: simple.title,
          photoId: simple.photoAssets[0].id,
          quantity: 2,
          unitPrice: simple.price.price,
          lineTotal: simple.price.price * 2,
          currency: "BRL" as const,
        },
      ],
      itemCount: 2,
      subtotal: simple.price.price * 2,
      discountTotal: 0,
      shippingTotal: 20,
      grandTotal: simple.price.price * 2 + 20,
      currency: "BRL" as const,
      shippingAddressPath: `userProfiles/${forUserId}/addresses/addr-cloud-001`,
      shippingMethod: {
        providerId: "melhor-envio" as const,
        carrier: "Correios",
        service: "PAC",
        serviceCode: "1",
        price: 20,
        basePrice: 20,
        freeShippingApplied: false,
        estimatedDays: 7,
      },
      ...overrides,
    };
  }

  function postOrder(payload: unknown) {
    return ordersPOST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    );
  }

  function patchOrder(id: string, body: unknown) {
    return orderPATCH(
      new Request(`http://localhost/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) },
    );
  }

  /** Re-seed determinístico: cada teste parte do mesmo catálogo/estoque. */
  async function reseedCatalog(): Promise<void> {
    await Promise.all([seedProduct(simple), seedProduct(variable)]);
    await Promise.all([
      seedStockDoc({ productId: simple.id, sku: simple.sku, quantity: SIMPLE_DEFAULT_STOCK }),
      seedStockDoc({
        productId: variable.id,
        sku: variable.sku,
        quantity: VARIANT_M_DEFAULT_STOCK + VARIANT_G_DEFAULT_STOCK,
        variants: { "var-m": VARIANT_M_DEFAULT_STOCK, "var-g": VARIANT_G_DEFAULT_STOCK },
      }),
    ]);
  }

  beforeAll(async () => {
    const now = Date.now();
    await adminDb
      .collection(firestoreCollections.coupons)
      .doc(couponId)
      .withConverter(adminCouponConverter)
      .set({
        id: couponId,
        code: couponCode,
        type: "percentage",
        amount: 10,
        minimumOrderAmount: 50,
        startsAt: new Date(now - 86_400_000).toISOString(),
        expiresAt: new Date(now + 86_400_000).toISOString(),
        usageCount: 0,
        active: true,
      } as Coupon);
    seededDocs.push({ collection: firestoreCollections.coupons, id: couponId });
    mockAuthedUser({ uid: userId });
  });

  beforeEach(async () => {
    await reseedCatalog();
    mockAuthedUser({ uid: userId });
  });

  afterAll(async () => {
    await cleanupDocuments(seededDocs);
    mockAuthedUser(null);
  });

  // ── POST /api/orders ─────────────────────────────────────────────────────

  it("POST /api/orders creates a new order and returns 201", async () => {
    const response = await postOrder(buildOrderPayload(userId));

    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string; userId: string; status: string };

    expect(created.id).toBeTruthy();
    expect(created.userId).toBe(userId);
    expect(created.status).toBe("pending_payment");
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    const persisted = await adminDb.collection(firestoreCollections.orders).doc(created.id).get();
    expect(persisted.exists).toBe(true);
  });

  it("POST /api/orders decrementa estoque + totalStock e marca stockMovement", async () => {
    const response = await postOrder(buildOrderPayload(userId));
    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string; stockMovement?: string };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    expect(created.stockMovement).toBe("decremented");

    const stock = await readStockDoc(simple.id);
    expect(stock?.quantity).toBe(SIMPLE_DEFAULT_STOCK - 2);

    const productSnap = await adminDb
      .collection(firestoreCollections.products)
      .doc(simple.id)
      .get();
    // totalStock denormalizado também acompanha (5 do fixture - 2).
    expect((productSnap.data() as { totalStock: number }).totalStock).toBe(simple.totalStock - 2);
  });

  it("POST /api/orders decrementa a variante certa em produto com variantes", async () => {
    const payload = buildOrderPayload(userId, {
      items: [
        {
          id: `${variable.id}__var-m`,
          productId: variable.id,
          variantId: "var-m",
          itemSku: VARIANT_M_SKU,
          name: variable.title,
          photoId: variable.photoAssets[0].id,
          quantity: 3,
          unitPrice: variable.price.price,
          lineTotal: variable.price.price * 3,
          currency: "BRL" as const,
        },
      ],
      itemCount: 3,
      subtotal: variable.price.price * 3,
      grandTotal: variable.price.price * 3 + 20,
    });
    const response = await postOrder(payload);
    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    const stock = await readStockDoc(variable.id);
    expect(stock?.variants).toEqual({
      "var-m": VARIANT_M_DEFAULT_STOCK - 3,
      "var-g": VARIANT_G_DEFAULT_STOCK,
    });
    expect(stock?.quantity).toBe(VARIANT_M_DEFAULT_STOCK + VARIANT_G_DEFAULT_STOCK - 3);
  });

  it("POST /api/orders returns 409 out_of_stock com os itens afetados", async () => {
    await seedStockDoc({ productId: simple.id, sku: simple.sku, quantity: 1 });
    const response = await postOrder(buildOrderPayload(userId));
    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      code: string;
      message: string;
      items: Array<{ productId: string; available: number; requested: number }>;
    };
    expect(body.code).toBe("out_of_stock");
    expect(body.message).toContain(simple.title);
    expect(body.items).toEqual([
      expect.objectContaining({ productId: simple.id, available: 1, requested: 2 }),
    ]);

    // Nada foi decrementado — a transação abortou inteira.
    expect((await readStockDoc(simple.id))?.quantity).toBe(1);
  });

  it("POST /api/orders: corrida pela última unidade — exatamente um 201 e um 409", async () => {
    await seedStockDoc({ productId: simple.id, sku: simple.sku, quantity: 2 });

    const [a, b] = await Promise.all([
      postOrder(buildOrderPayload(userId)),
      postOrder(buildOrderPayload(userId, { orderNumber: `ORD-B-${Date.now()}` })),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    for (const res of [a, b]) {
      if (res.status === 201) {
        const created = (await res.json()) as { id: string };
        seededDocs.push({ collection: firestoreCollections.orders, id: created.id });
      } else {
        expect(((await res.json()) as { code: string }).code).toBe("out_of_stock");
      }
    }
    expect((await readStockDoc(simple.id))?.quantity).toBe(0);
  });

  it("POST /api/orders returns 409 price_mismatch quando o unitPrice diverge do catálogo", async () => {
    const response = await postOrder(
      buildOrderPayload(userId, {
        items: [
          {
            id: simple.id,
            productId: simple.id,
            itemSku: simple.sku,
            name: simple.title,
            photoId: simple.photoAssets[0].id,
            quantity: 2,
            unitPrice: 0.01,
            lineTotal: 0.02,
            currency: "BRL" as const,
          },
        ],
        subtotal: 0.02,
        grandTotal: 20.02,
      }),
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string; items: unknown[] };
    expect(body.code).toBe("price_mismatch");
    expect(body.items).toEqual([
      expect.objectContaining({ productId: simple.id, expected: simple.price.price }),
    ]);
    // Estoque intacto.
    expect((await readStockDoc(simple.id))?.quantity).toBe(SIMPLE_DEFAULT_STOCK);
  });

  it("POST /api/orders returns 409 catalog_mismatch para produto inexistente ou SKU divergente", async () => {
    const ghost = await postOrder(
      buildOrderPayload(userId, {
        items: [
          {
            id: "ghost",
            productId: `${prefix}-ghost`,
            itemSku: "GHOST_SKU_01",
            name: "Fantasma",
            photoId: "img-x",
            quantity: 1,
            unitPrice: 100,
            lineTotal: 100,
            currency: "BRL" as const,
          },
        ],
        itemCount: 1,
        subtotal: 100,
        grandTotal: 120,
      }),
    );
    expect(ghost.status).toBe(409);
    expect(((await ghost.json()) as { code: string }).code).toBe("catalog_mismatch");

    const wrongSku = await postOrder(
      buildOrderPayload(userId, {
        items: [
          {
            id: simple.id,
            productId: simple.id,
            itemSku: "WRONGSKU_0001",
            name: simple.title,
            photoId: simple.photoAssets[0].id,
            quantity: 2,
            unitPrice: simple.price.price,
            lineTotal: simple.price.price * 2,
            currency: "BRL" as const,
          },
        ],
      }),
    );
    expect(wrongSku.status).toBe(409);
    const wrongSkuBody = (await wrongSku.json()) as { code: string; items: unknown[] };
    expect(wrongSkuBody.code).toBe("catalog_mismatch");
    expect(wrongSkuBody.items).toEqual([
      expect.objectContaining({ productId: simple.id, reason: "sku_mismatch" }),
    ]);
  });

  it("POST /api/orders returns 400 quando subtotal ≠ Σ lineTotal (schema)", async () => {
    const response = await postOrder(
      buildOrderPayload(userId, {
        subtotal: 100,
        grandTotal: 120,
      }),
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/orders returns 409 shipping_mismatch quando o frete não bate com o método", async () => {
    const response = await postOrder(
      buildOrderPayload(userId, {
        shippingTotal: 1,
        grandTotal: simple.price.price * 2 + 1,
      }),
    );
    expect(response.status).toBe(409);
    expect(((await response.json()) as { code: string }).code).toBe("shipping_mismatch");

    const noMethod = await postOrder(buildOrderPayload(userId, { shippingMethod: undefined }));
    expect(noMethod.status).toBe(409);
    expect(((await noMethod.json()) as { code: string }).code).toBe("shipping_mismatch");
  });

  it("POST /api/orders força campos server-controlled (status, paymentStatus, artefatos)", async () => {
    const response = await postOrder(
      buildOrderPayload(userId, {
        status: "paid",
        paymentStatus: "paid",
        paidAt: new Date().toISOString(),
        paymentIntentId: "FORGED",
        trackingCode: "FORGED-TRACK",
        stockMovement: "released",
      }),
    );
    expect(response.status).toBe(201);
    const created = (await response.json()) as {
      id: string;
      status: string;
      paymentStatus: string;
      paidAt?: string;
      paymentIntentId?: string;
      trackingCode?: string;
      stockMovement?: string;
    };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    expect(created.status).toBe("pending_payment");
    expect(created.paymentStatus).toBe("pending");
    expect(created.paidAt).toBeUndefined();
    expect(created.paymentIntentId).toBeUndefined();
    expect(created.trackingCode).toBeUndefined();
    expect(created.stockMovement).toBe("decremented");
  });

  // ── Cupom na criação do pedido ───────────────────────────────────────────

  it("POST /api/orders com cupom válido confere o desconto e incrementa usageCount", async () => {
    // cartTotal = subtotal (240) + frete (20) = 260 → 10% = 26.
    const before = (
      await adminDb
        .collection(firestoreCollections.coupons)
        .doc(couponId)
        .withConverter(adminCouponConverter)
        .get()
    ).data()!;

    const response = await postOrder(
      buildOrderPayload(userId, {
        couponCode,
        discountTotal: 26,
        grandTotal: simple.price.price * 2 - 26 + 20,
      }),
    );
    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    const after = (
      await adminDb
        .collection(firestoreCollections.coupons)
        .doc(couponId)
        .withConverter(adminCouponConverter)
        .get()
    ).data()!;
    expect(after.usageCount).toBe(before.usageCount + 1);
  });

  it("POST /api/orders returns 409 discount_mismatch quando o desconto não bate", async () => {
    const response = await postOrder(
      buildOrderPayload(userId, {
        couponCode,
        discountTotal: 100,
        grandTotal: simple.price.price * 2 - 100 + 20,
      }),
    );
    expect(response.status).toBe(409);
    expect(((await response.json()) as { code: string }).code).toBe("discount_mismatch");
  });

  it("POST /api/orders returns 409 discount_mismatch para desconto sem cupom", async () => {
    const response = await postOrder(
      buildOrderPayload(userId, {
        discountTotal: 10,
        grandTotal: simple.price.price * 2 - 10 + 20,
      }),
    );
    expect(response.status).toBe(409);
    expect(((await response.json()) as { code: string }).code).toBe("discount_mismatch");
  });

  it("POST /api/orders returns 409 coupon_invalid para cupom inexistente", async () => {
    const response = await postOrder(
      buildOrderPayload(userId, {
        couponCode: "NAOEXISTE01",
        discountTotal: 26,
        grandTotal: simple.price.price * 2 - 26 + 20,
      }),
    );
    expect(response.status).toBe(409);
    expect(((await response.json()) as { code: string }).code).toBe("coupon_invalid");
  });

  it("POST /api/orders returns 400 on invalid payload (missing required fields)", async () => {
    const response = await postOrder({ userId, status: "pending_payment" });
    expect(response.status).toBe(400);
  });

  it("POST /api/orders returns 401 when no session", async () => {
    mockAuthedUser(null);
    const response = await postOrder(buildOrderPayload(userId));
    expect(response.status).toBe(401);
    mockAuthedUser({ uid: userId });
  });

  it("POST /api/orders returns 403 when body.userId differs from session uid", async () => {
    const response = await postOrder(buildOrderPayload("someone-else-uid"));
    expect(response.status).toBe(403);
  });

  // ── GET /api/orders?userId= ──────────────────────────────────────────────

  it("GET /api/orders?userId= lists orders for the user, newest-first", async () => {
    const second = buildOrderPayload(userId, {
      orderNumber: `ORD-2-${Date.now().toString().slice(-8)}`,
    });
    const createRes = await postOrder(second);
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    const response = await ordersGET(new Request(`http://localhost/api/orders?userId=${userId}`));
    expect(response.status).toBe(200);
    const orders = (await response.json()) as Array<{ id: string; userId: string }>;

    expect(Array.isArray(orders)).toBe(true);
    expect(orders.length).toBeGreaterThanOrEqual(1);
    expect(orders.every((o) => o.userId === userId)).toBe(true);
  });

  it("GET /api/orders without userId defaults to session uid", async () => {
    const response = await ordersGET(new Request("http://localhost/api/orders"));
    expect(response.status).toBe(200);
    const orders = (await response.json()) as Array<{ userId: string }>;
    expect(orders.every((o) => o.userId === userId)).toBe(true);
  });

  it("GET /api/orders rejects userId of another user when not admin", async () => {
    const response = await ordersGET(
      new Request("http://localhost/api/orders?userId=someone-else"),
    );
    expect(response.status).toBe(403);
  });

  it("GET /api/orders allows admin to query other userId", async () => {
    mockAuthedUser({ uid: "admin-uid", isAdmin: true });
    const response = await ordersGET(new Request(`http://localhost/api/orders?userId=${userId}`));
    expect(response.status).toBe(200);
    mockAuthedUser({ uid: userId });
  });

  // ── GET /api/orders/:id ──────────────────────────────────────────────────

  it("GET /api/orders/:id returns the order when it exists", async () => {
    const createRes = await postOrder(buildOrderPayload(userId));
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

  it("GET /api/orders/:id returns 403 when order belongs to another user", async () => {
    // criar pedido para o user "alvo"
    const createRes = await postOrder(buildOrderPayload(userId));
    const created = (await createRes.json()) as { id: string };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    // trocar para outro user (não admin)
    mockAuthedUser({ uid: "outro-uid" });
    const response = await orderGET(new Request(`http://localhost/api/orders/${created.id}`), {
      params: Promise.resolve({ id: created.id }),
    });
    expect(response.status).toBe(403);
    mockAuthedUser({ uid: userId });
  });

  // ── PATCH /api/orders/:id ────────────────────────────────────────────────

  it("PATCH /api/orders/:id updates status and preserves immutable fields (admin)", async () => {
    const createRes = await postOrder(buildOrderPayload(userId));
    const created = (await createRes.json()) as {
      id: string;
      userId: string;
      createdAt: string;
    };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    // como non-admin, não pode mudar status para "paid" — só admin pode.
    mockAuthedUser({ uid: "admin-uid", isAdmin: true });
    const response = await patchOrder(created.id, {
      status: "paid",
      paymentStatus: "paid",
      userId: "hacker-uid",
    });

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
    mockAuthedUser({ uid: userId });
  });

  it("PATCH /api/orders/:id returns 403 when non-admin tries to set non-cancelled status", async () => {
    const createRes = await postOrder(buildOrderPayload(userId));
    const created = (await createRes.json()) as { id: string };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    const response = await patchOrder(created.id, { status: "shipped" });
    expect(response.status).toBe(403);
  });

  it("PATCH /api/orders/:id returns 403 when non-admin envia qualquer outro campo", async () => {
    const createRes = await postOrder(buildOrderPayload(userId));
    const created = (await createRes.json()) as { id: string };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    // Campo isolado (reescrita de snapshot) — barrado.
    const tracking = await patchOrder(created.id, { trackingCode: "FORGED-1" });
    expect(tracking.status).toBe(403);

    // Cancelamento + carona de outro campo — barrado também.
    const combo = await patchOrder(created.id, { status: "cancelled", grandTotal: 1 });
    expect(combo.status).toBe(403);
  });

  it("PATCH cancel do dono devolve o estoque exatamente uma vez", async () => {
    const createRes = await postOrder(buildOrderPayload(userId));
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    expect((await readStockDoc(simple.id))?.quantity).toBe(SIMPLE_DEFAULT_STOCK - 2);

    const cancel = await patchOrder(created.id, { status: "cancelled" });
    expect(cancel.status).toBe(200);
    const cancelled = (await cancel.json()) as { status: string; stockMovement?: string };
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.stockMovement).toBe("released");
    expect((await readStockDoc(simple.id))?.quantity).toBe(SIMPLE_DEFAULT_STOCK);

    // Segundo cancel: pedido já não está em pending_payment → 409, sem
    // devolver estoque de novo.
    const again = await patchOrder(created.id, { status: "cancelled" });
    expect(again.status).toBe(409);
    expect(((await again.json()) as { code: string }).code).toBe("not_cancellable");
    expect((await readStockDoc(simple.id))?.quantity).toBe(SIMPLE_DEFAULT_STOCK);
  });

  it("PATCH cancel do dono é bloqueado quando o pedido já avançou (shipped/paid)", async () => {
    const createRes = await postOrder(buildOrderPayload(userId));
    const created = (await createRes.json()) as { id: string };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    mockAuthedUser({ uid: "admin-uid", isAdmin: true });
    const shipRes = await patchOrder(created.id, { status: "shipped" });
    expect(shipRes.status).toBe(200);
    mockAuthedUser({ uid: userId });

    const cancel = await patchOrder(created.id, { status: "cancelled" });
    expect(cancel.status).toBe(409);
    expect(((await cancel.json()) as { code: string }).code).toBe("not_cancellable");
  });

  it("PATCH cancel do admin também devolve o estoque (pedido com stockMovement)", async () => {
    const createRes = await postOrder(buildOrderPayload(userId));
    const created = (await createRes.json()) as { id: string };
    seededDocs.push({ collection: firestoreCollections.orders, id: created.id });

    mockAuthedUser({ uid: "admin-uid", isAdmin: true });
    const cancel = await patchOrder(created.id, { status: "cancelled" });
    expect(cancel.status).toBe(200);
    expect(((await cancel.json()) as { stockMovement?: string }).stockMovement).toBe("released");
    expect((await readStockDoc(simple.id))?.quantity).toBe(SIMPLE_DEFAULT_STOCK);
    mockAuthedUser({ uid: userId });
  });

  it("PATCH /api/orders/:id returns 404 when missing", async () => {
    mockAuthedUser({ uid: "admin-uid", isAdmin: true });
    const response = await patchOrder("missing-id", { status: "paid" });
    expect(response.status).toBe(404);
    mockAuthedUser({ uid: userId });
  });
});
