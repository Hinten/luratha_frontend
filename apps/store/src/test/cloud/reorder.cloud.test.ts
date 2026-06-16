/**
 * Cloud integration tests for the "Pedir novamente" flow:
 *   POST /api/orders/:id/reorder  →  POST /api/cart/items
 *
 * Reproduce o caminho exato que o `ReorderButton` exercita: resolve os itens de
 * um pedido contra o catálogo atual e re-adiciona os disponíveis ao carrinho.
 * O caso central ("reorder→cart") garante que um item devolvido por `reorder`
 * é aceito por `/api/cart/items` — se essa cadeia quebrar, o botão cai no estado
 * de erro genérico, que foi a falha relatada.
 *
 * Run: `npm run test:firestore`. Auto-skips sem credenciais de cloud.
 */

import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminOrderConverter } from "@luratha/firestore/adminOrderConverter";
import {
  firestoreCollections,
  validateOrder,
  validateProduct,
  type Order,
  type Product,
} from "@luratha/schemas";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";

// ── Auth mock (mesma forma usada nos demais cloud tests) ───────────────────
const auth = vi.hoisted(() => ({
  state: {
    current: null as { uid: string; email: string | null; isAdmin: boolean } | null,
  },
}));
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

// Imports dos handlers acontecem após o vi.mock (hoisted).
import { POST as reorderPOST } from "@/src/app/api/orders/[id]/reorder/route";
import { POST as cartItemsPOST } from "@/src/app/api/cart/items/route";

// ── Fixtures ───────────────────────────────────────────────────────────────

type SeedDocument = { collection: string; id: string };

function buildPhotoAsset(productId: string) {
  const now = new Date().toISOString();
  const assetId = `${productId}-photo`;
  const resolution = (label: string, width: number, height: number) => ({
    width,
    height,
    storagePath: `products/${productId}/${assetId}/${label}.webp`,
    downloadUrl: `https://storage.googleapis.com/luratha-test/${productId}/${label}.webp`,
    format: "webp" as const,
  });
  return {
    id: assetId,
    alt: "foto fixture reorder",
    resolutions: {
      card: resolution("card", 400, 500),
      mobile: resolution("mobile", 480, 600),
      tablet: resolution("tablet", 768, 960),
      desktop: resolution("desktop", 1200, 1500),
    },
    createdAt: now,
    updatedAt: now,
  };
}

function buildProduct(opts: {
  id: string;
  sku: string;
  title: string;
  status?: "active" | "archived";
  isPurchasable?: boolean;
  totalStock?: number;
}): Product {
  const now = new Date().toISOString();
  return validateProduct({
    id: opts.id,
    title: opts.title,
    description: "Produto fixture do reorder cloud test.",
    sku: opts.sku,
    status: opts.status ?? "active",
    isPurchasable: opts.isPurchasable ?? true,
    brandName: "Luratha Test",
    categoryId: "cat-reorder",
    tags: [],
    materialTags: [],
    seasonalTags: [],
    price: { price: 150, currency: "BRL" },
    totalStock: opts.totalStock ?? 5,
    photoAssets: [buildPhotoAsset(opts.id)],
    createdAt: now,
    updatedAt: now,
  });
}

/** Snapshot de compra (OrderItem) de um produto fixture. */
function orderItemFor(product: Product, id: string): Order["items"][number] {
  return {
    id,
    productId: product.id,
    itemSku: product.sku,
    name: product.title,
    photoId: product.photoAssets[0]?.id ?? "photo-x",
    quantity: 1,
    unitPrice: product.price.price,
    lineTotal: product.price.price,
    currency: "BRL",
  };
}

function buildOrder(id: string, userId: string, items: Order["items"]): Order {
  const now = new Date().toISOString();
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return validateOrder({
    id,
    userId,
    orderNumber: "REORDER-CLOUD-1",
    status: "pending_payment",
    paymentMethod: "pix",
    paymentStatus: "awaiting_pix",
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    discountTotal: 0,
    shippingTotal: 20,
    grandTotal: subtotal + 20,
    currency: "BRL",
    shippingAddressPath: `userProfiles/${userId}/addresses/addr-reorder`,
    createdAt: now,
    updatedAt: now,
  });
}

async function clearCartFromFirestore(userId: string): Promise<void> {
  const itemsSnap = await adminDb
    .collection(firestoreCollections.carts)
    .doc(userId)
    .collection(firestoreCollections.cartItems)
    .get();
  const batch = adminDb.batch();
  for (const doc of itemsSnap.docs) batch.delete(doc.ref);
  batch.delete(adminDb.collection(firestoreCollections.carts).doc(userId));
  await batch.commit();
}

async function cleanupDocuments(tracked: SeedDocument[]): Promise<void> {
  await Promise.all(
    tracked.map(({ collection, id }) => adminDb.collection(collection).doc(id).delete()),
  );
}

function reorderRequest(orderId: string) {
  return reorderPOST(
    new Request(`http://localhost/api/orders/${orderId}/reorder`, { method: "POST" }),
    { params: Promise.resolve({ id: orderId }) },
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describeCloud("/api/orders/:id/reorder → /api/cart/items (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  const userId = `${prefix}-reorder-user`;
  const skuTag = prefix.slice(-4).toUpperCase();

  const available = buildProduct({
    id: `${prefix}-prod-ok`,
    sku: `REORDEROK_${skuTag}`,
    title: "Vestido Disponível Reorder",
  });
  const archived = buildProduct({
    id: `${prefix}-prod-archived`,
    sku: `REORDERARCH_${skuTag}`,
    title: "Vestido Arquivado Reorder",
    status: "archived",
    isPurchasable: false,
  });

  const mixedOrder = buildOrder(`${prefix}-order-mixed`, userId, [
    orderItemFor(available, "item-ok"),
    orderItemFor(archived, "item-archived"),
  ]);
  const emptyOrder = buildOrder(`${prefix}-order-empty`, userId, [
    orderItemFor(archived, "item-archived"),
  ]);

  const seededDocs: SeedDocument[] = [
    { collection: firestoreCollections.products, id: available.id },
    { collection: firestoreCollections.products, id: archived.id },
    { collection: firestoreCollections.orders, id: mixedOrder.id },
    { collection: firestoreCollections.orders, id: emptyOrder.id },
  ];

  beforeAll(async () => {
    await adminDb.collection(firestoreCollections.products).doc(available.id).set(available);
    await adminDb.collection(firestoreCollections.products).doc(archived.id).set(archived);
    await adminDb
      .collection(firestoreCollections.orders)
      .doc(mixedOrder.id)
      .withConverter(adminOrderConverter)
      .set(mixedOrder);
    await adminDb
      .collection(firestoreCollections.orders)
      .doc(emptyOrder.id)
      .withConverter(adminOrderConverter)
      .set(emptyOrder);
    mockAuthedUser({ uid: userId });
  });

  afterAll(async () => {
    await clearCartFromFirestore(userId);
    await cleanupDocuments(seededDocs);
    mockAuthedUser(null);
  });

  afterEach(async () => {
    await clearCartFromFirestore(userId);
    mockAuthedUser({ uid: userId });
  });

  it("resolve os itens compráveis e sinaliza os indisponíveis", async () => {
    const response = await reorderRequest(mixedOrder.id);
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.items).toHaveLength(1);
    expect(body.items[0].productId).toBe(available.id);
    expect(body.items[0].variantSku).toBe(available.sku);
    expect(body.unavailable).toHaveLength(1);
    expect(body.unavailable[0].reason).toBe("indisponível");
  });

  it("o item devolvido pelo reorder é aceito por POST /api/cart/items", async () => {
    // Caso central: reproduz a cadeia reorder→cart do ReorderButton. Se o item
    // resolvido não passar na revalidação do carrinho, é aqui que aparece.
    const reorderResponse = await reorderRequest(mixedOrder.id);
    expect(reorderResponse.status).toBe(200);
    const { items } = await reorderResponse.json();
    expect(items).toHaveLength(1);

    const cartResponse = await cartItemsPOST(
      new Request("http://localhost/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: "BRL", quantity: 1, ...items[0] }),
      }),
    );

    expect(cartResponse.status).toBe(200);
    const snapshot = await cartResponse.json();
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0].productId).toBe(available.id);
  });

  it("devolve lista vazia (200) quando nenhum item está disponível", async () => {
    const response = await reorderRequest(emptyOrder.id);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(0);
    expect(body.unavailable).toHaveLength(1);
  });

  it("retorna 403 quando quem pede não é o dono do pedido", async () => {
    mockAuthedUser({ uid: `${prefix}-stranger` });
    const response = await reorderRequest(mixedOrder.id);
    expect(response.status).toBe(403);
  });

  it("retorna 404 quando o pedido não existe", async () => {
    const response = await reorderRequest(`${prefix}-order-missing`);
    expect(response.status).toBe(404);
  });
});
