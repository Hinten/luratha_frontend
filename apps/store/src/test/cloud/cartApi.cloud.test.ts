/**
 * Cloud integration tests for the /api/cart endpoints.
 *
 * Seeds two real products (one simple, one variable) under a unique test
 * prefix, then exercises every cart handler with both happy-path and error
 * cases (nonexistent product, archived product, mismatched SKU/price,
 * zero/negative numbers, malformed SKU, quantity caps, merge with mixed
 * items, unauthenticated access).
 *
 * Run: `npm run test:firestore`. Auto-skips without cloud credentials.
 */

import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import {
  buildProductSlug,
  firestoreCollections,
} from "@luratha/schemas";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";

// ── Auth mock (single source of truth for the suite) ───────────────────────
const auth = vi.hoisted(() => ({
  state: {
    current: null as { uid: string; email: string | null; isAdmin: boolean } | null,
  },
}));
function mockAuthedUser(
  opts: { uid: string; isAdmin?: boolean; email?: string | null } | null,
) {
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
    constructor(public readonly status: 401 | 403, message: string) {
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

// Imports of route handlers happen *after* vi.mock (hoisted).
import { GET as cartGET, DELETE as cartDELETE } from "@/src/app/api/cart/route";
import { POST as itemsPOST } from "@/src/app/api/cart/items/route";
import {
  PUT as itemPUT,
  DELETE as itemDELETE,
} from "@/src/app/api/cart/items/[itemId]/route";
import { POST as mergePOST } from "@/src/app/api/cart/merge/route";

// ── Test fixtures ──────────────────────────────────────────────────────────

type SeedDocument = { collection: string; id: string };

const SIMPLE_SKU_TOKEN = "SIMPLE_AAAA";
const VARIANT_M_SKU = "SKUVARM_BBBB";
const VARIANT_G_SKU = "SKUVARG_CCCC";

function buildPhotoAsset(productId: string, assetId: string) {
  const now = new Date().toISOString();
  const url = (label: string) =>
    `https://example.com/${productId}/${assetId}/${label}.webp`;
  return {
    id: assetId,
    alt: "foto teste",
    resolutions: {
      mobile: {
        width: 480,
        height: 600,
        storagePath: `products/${productId}/${assetId}/mobile.webp`,
        downloadUrl: url("mobile"),
        format: "webp",
      },
      tablet: {
        width: 768,
        height: 960,
        storagePath: `products/${productId}/${assetId}/tablet.webp`,
        downloadUrl: url("tablet"),
        format: "webp",
      },
      desktop: {
        width: 1200,
        height: 1500,
        storagePath: `products/${productId}/${assetId}/desktop.webp`,
        downloadUrl: url("desktop"),
        format: "webp",
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

function buildSimpleProduct(prefix: string) {
  const id = `${prefix}-prod-simple`;
  const now = new Date().toISOString();
  const photo = buildPhotoAsset(id, `${prefix}-photo-simple`);
  return {
    id,
    slug: null,
    title: "Camisa Linho Teste",
    shortTitle: null,
    description: "Produto simples — sem variantes — usado no cart cloud test.",
    vectorEmbedding: null,
    searchEmbedding: null,
    sku: SIMPLE_SKU_TOKEN,
    gtin: null,
    mpn: null,
    status: "active" as const,
    isPurchasable: true,
    brandName: "Luratha Test",
    categoryId: `cat-${prefix}`,
    googleProductCategoryId: null,
    tags: [],
    materialTags: [],
    seasonalTags: [],
    price: {
      price: 120,
      salePrice: null,
      priceMin: null,
      priceMax: null,
      currency: "BRL" as const,
      startDate: null,
      endDate: null,
    },
    salePrice: null,
    condition: "new" as const,
    adult: false,
    isBundle: false,
    multipack: 1,
    age_group: null,
    gender: null,
    color: null,
    size: null,
    sizeType: null,
    sizeSystem: null,
    material: [],
    pattern: [],
    dimensions: {
      length: 30,
      width: 22,
      height: 4,
      unit: "cm" as const,
      weightKg: 0.35,
      weightGrossKg: 0.4,
    },
    productDetail: null,
    productHighlight: null,
    photoAssets: [photo],
    lifeStylePhotos: [],
    videoUrls: [],
    ratingAverage: null,
    reviewCount: null,
    totalStock: 5,
    variants: null,
    createdAt: now,
    updatedAt: now,
    photoId: photo.id,
  };
}

function buildVariableProduct(prefix: string) {
  const id = `${prefix}-prod-variable`;
  const now = new Date().toISOString();
  const photo = buildPhotoAsset(id, `${prefix}-photo-variable`);
  return {
    id,
    slug: null,
    title: "Vestido Bordado Teste",
    shortTitle: null,
    description: "Produto com variantes M/G para testar variantId no cart.",
    vectorEmbedding: null,
    searchEmbedding: null,
    sku: `PARENT_AAAA_${prefix.slice(-4).toUpperCase()}`,
    gtin: null,
    mpn: null,
    status: "active" as const,
    isPurchasable: true,
    brandName: "Luratha Test",
    categoryId: `cat-${prefix}`,
    googleProductCategoryId: null,
    tags: [],
    materialTags: [],
    seasonalTags: [],
    price: {
      price: 280,
      salePrice: null,
      priceMin: null,
      priceMax: null,
      currency: "BRL" as const,
      startDate: null,
      endDate: null,
    },
    salePrice: null,
    condition: "new" as const,
    adult: false,
    isBundle: false,
    multipack: 1,
    age_group: null,
    gender: null,
    color: null,
    size: null,
    sizeType: null,
    sizeSystem: null,
    material: [],
    pattern: [],
    dimensions: null,
    productDetail: null,
    productHighlight: null,
    photoAssets: [photo],
    lifeStylePhotos: [],
    videoUrls: [],
    ratingAverage: null,
    reviewCount: null,
    totalStock: 10,
    variants: [
      {
        id: "var-m",
        sku: VARIANT_M_SKU,
        gtin: null,
        mpn: null,
        item_group_id: null,
        color: null,
        size: ["M"],
        photoIds: [photo.id],
        active: true,
      },
      {
        id: "var-g",
        sku: VARIANT_G_SKU,
        gtin: null,
        mpn: null,
        item_group_id: null,
        color: null,
        size: ["G"],
        photoIds: [photo.id],
        active: false, // inactive variant — used to test "variante indisponível"
      },
    ],
    createdAt: now,
    updatedAt: now,
    photoId: photo.id,
  };
}

async function seedProduct(product: Record<string, unknown>): Promise<void> {
  await adminDb
    .collection(firestoreCollections.products)
    .doc(product.id as string)
    .set(product);
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
    tracked.map(({ collection, id }) =>
      adminDb.collection(collection).doc(id).delete(),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describeCloud("/api/cart (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  const userId = `${prefix}-cart-user`;
  const simple = buildSimpleProduct(prefix);
  const variable = buildVariableProduct(prefix);
  // Slug is computed deterministically by buildProductSlug(title, sku) inside
  // the schema transform, so read-side validation always exposes that value.
  const simpleSlug = buildProductSlug(simple.title, simple.sku);
  const variableSlug = buildProductSlug(variable.title, variable.sku);
  const seededDocs: SeedDocument[] = [
    { collection: firestoreCollections.products, id: simple.id },
    { collection: firestoreCollections.products, id: variable.id },
  ];

  beforeAll(async () => {
    await seedProduct(simple);
    await seedProduct(variable);
    mockAuthedUser({ uid: userId });
  });

  afterAll(async () => {
    await clearCartFromFirestore(userId);
    await cleanupDocuments(seededDocs);
    mockAuthedUser(null);
  });

  afterEach(async () => {
    // Each test starts with a clean cart so assertions are independent.
    await clearCartFromFirestore(userId);
    mockAuthedUser({ uid: userId });
  });

  // ── GET /api/cart ────────────────────────────────────────────────────────

  it("GET /api/cart returns an empty snapshot when no cart exists yet", async () => {
    const response = await cartGET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toEqual([]);
    expect(body.cart.itemCount).toBe(0);
    expect(body.cart.subtotal).toBe(0);
  });

  it("GET /api/cart returns 401 without a session", async () => {
    mockAuthedUser(null);
    const response = await cartGET();
    expect(response.status).toBe(401);
  });

  // ── POST /api/cart/items: happy path & idempotency ──────────────────────

  function buildItemPayload(overrides: Record<string, unknown> = {}) {
    return {
      productId: simple.id,
      variantSku: simple.sku,
      productSlug: simpleSlug,
      name: simple.title,
      photoId: simple.photoAssets[0].id,
      imageUrl: simple.photoAssets[0].resolutions.mobile.downloadUrl,
      unitPrice: simple.price.price,
      currency: "BRL",
      quantity: 1,
      ...overrides,
    };
  }

  function buildVariantItemPayload(
    variantId: string,
    variantSku: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      productId: variable.id,
      variantId,
      variantSku,
      productSlug: variableSlug,
      name: variable.title,
      photoId: variable.photoAssets[0].id,
      imageUrl: variable.photoAssets[0].resolutions.mobile.downloadUrl,
      variantLabel: variantId === "var-m" ? "M" : "G",
      unitPrice: variable.price.price,
      currency: "BRL",
      quantity: 1,
      ...overrides,
    };
  }

  function jsonRequest(url: string, body: unknown, method = "POST"): Request {
    return new Request(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("POST /api/cart/items adds a simple product and returns the snapshot", async () => {
    const response = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload({ quantity: 2 })),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].productId).toBe(simple.id);
    expect(body.items[0].quantity).toBe(2);
    expect(body.cart.itemCount).toBe(2);
    expect(body.cart.subtotal).toBe(simple.price.price * 2);
    expect(body.cart.grandTotal).toBe(simple.price.price * 2);
  });

  it("POST /api/cart/items snapshots the product dimensions onto the cart item", async () => {
    const response = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload()),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    // dimensions é derivado server-side do produto, não do payload do cliente.
    expect(body.items[0].dimensions).toMatchObject({
      length: 30,
      width: 22,
      height: 4,
      weightKg: 0.35,
    });
  });

  it("POST /api/cart/items stores dimensions as null when the product has none", async () => {
    const response = await itemsPOST(
      jsonRequest(
        "http://localhost/api/cart/items",
        buildVariantItemPayload("var-m", VARIANT_M_SKU),
      ),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items[0].dimensions).toBeNull();
  });

  it("POST /api/cart/items re-adding the same variant increments quantity", async () => {
    await itemsPOST(jsonRequest("http://localhost/api/cart/items", buildItemPayload()));
    const second = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload()),
    );
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quantity).toBe(2);
  });

  it("POST /api/cart/items keeps distinct rows for different variants", async () => {
    await itemsPOST(
      jsonRequest(
        "http://localhost/api/cart/items",
        buildVariantItemPayload("var-m", VARIANT_M_SKU),
      ),
    );
    // var-g is inactive in fixtures, but adding two of var-m again should be a single row
    const second = await itemsPOST(
      jsonRequest(
        "http://localhost/api/cart/items",
        buildVariantItemPayload("var-m", VARIANT_M_SKU, { quantity: 2 }),
      ),
    );
    expect(second.status).toBe(200);
    const body = await second.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quantity).toBe(3);
    expect(body.items[0].id).toBe(`${variable.id}__var-m`);
  });

  // ── POST /api/cart/items: catalog validation ────────────────────────────

  it("POST /api/cart/items returns 404 when the product does not exist", async () => {
    const response = await itemsPOST(
      jsonRequest(
        "http://localhost/api/cart/items",
        buildItemPayload({ productId: "does-not-exist-xyz" }),
      ),
    );
    expect(response.status).toBe(404);
  });

  it("POST /api/cart/items returns 409 when the product is archived", async () => {
    await adminDb
      .collection(firestoreCollections.products)
      .doc(simple.id)
      .update({ status: "archived" });

    try {
      const response = await itemsPOST(
        jsonRequest("http://localhost/api/cart/items", buildItemPayload()),
      );
      expect(response.status).toBe(409);
    } finally {
      await adminDb
        .collection(firestoreCollections.products)
        .doc(simple.id)
        .update({ status: "active" });
    }
  });

  it("POST /api/cart/items returns 409 when isPurchasable is false", async () => {
    await adminDb
      .collection(firestoreCollections.products)
      .doc(simple.id)
      .update({ isPurchasable: false });
    try {
      const response = await itemsPOST(
        jsonRequest("http://localhost/api/cart/items", buildItemPayload()),
      );
      expect(response.status).toBe(409);
    } finally {
      await adminDb
        .collection(firestoreCollections.products)
        .doc(simple.id)
        .update({ isPurchasable: true });
    }
  });

  it("POST /api/cart/items returns 400 when variantId is required but missing", async () => {
    const response = await itemsPOST(
      jsonRequest(
        "http://localhost/api/cart/items",
        buildItemPayload({
          productId: variable.id,
          productSlug: variableSlug,
          name: variable.title,
          variantSku: VARIANT_M_SKU,
          photoId: variable.photoAssets[0].id,
          unitPrice: variable.price.price,
        }),
      ),
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/cart/items returns 404 when the variantId does not exist", async () => {
    const response = await itemsPOST(
      jsonRequest(
        "http://localhost/api/cart/items",
        buildVariantItemPayload("does-not-exist", VARIANT_M_SKU),
      ),
    );
    expect(response.status).toBe(404);
  });

  it("POST /api/cart/items returns 409 when the variant is inactive", async () => {
    const response = await itemsPOST(
      jsonRequest(
        "http://localhost/api/cart/items",
        buildVariantItemPayload("var-g", VARIANT_G_SKU),
      ),
    );
    expect(response.status).toBe(409);
  });

  it("POST /api/cart/items returns 409 when SKU does not match catalog", async () => {
    const response = await itemsPOST(
      jsonRequest(
        "http://localhost/api/cart/items",
        buildItemPayload({ variantSku: "WRONG_SKU_XX" }),
      ),
    );
    expect(response.status).toBe(409);
  });

  it("POST /api/cart/items returns 409 when unitPrice differs from catalog", async () => {
    const response = await itemsPOST(
      jsonRequest(
        "http://localhost/api/cart/items",
        buildItemPayload({ unitPrice: 1 }),
      ),
    );
    expect(response.status).toBe(409);
  });

  it("POST /api/cart/items returns 409 when productSlug differs from catalog", async () => {
    const response = await itemsPOST(
      jsonRequest(
        "http://localhost/api/cart/items",
        buildItemPayload({ productSlug: "wrong-slug" }),
      ),
    );
    expect(response.status).toBe(409);
  });

  // ── POST /api/cart/items: Zod validation (zero/negative/malformed) ──────

  it("POST /api/cart/items returns 400 when unitPrice is zero", async () => {
    const response = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload({ unitPrice: 0 })),
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/cart/items returns 400 when unitPrice is negative", async () => {
    const response = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload({ unitPrice: -50 })),
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/cart/items returns 400 when quantity is zero", async () => {
    const response = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload({ quantity: 0 })),
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/cart/items returns 400 when quantity is negative", async () => {
    const response = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload({ quantity: -1 })),
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/cart/items returns 400 when quantity is non-integer", async () => {
    const response = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload({ quantity: 1.5 })),
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/cart/items returns 400 when SKU is lowercase / malformed", async () => {
    const response = await itemsPOST(
      jsonRequest(
        "http://localhost/api/cart/items",
        buildItemPayload({ variantSku: "lowercase-sku" }),
      ),
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/cart/items returns 400 when imageUrl is not a valid URL", async () => {
    const response = await itemsPOST(
      jsonRequest(
        "http://localhost/api/cart/items",
        buildItemPayload({ imageUrl: "not-a-url" }),
      ),
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/cart/items returns 400 on invalid JSON body", async () => {
    const response = await itemsPOST(
      new Request("http://localhost/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("POST /api/cart/items returns 401 without a session", async () => {
    mockAuthedUser(null);
    const response = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload()),
    );
    expect(response.status).toBe(401);
  });

  it("POST /api/cart/items returns 409 when quantity would exceed the per-item cap", async () => {
    // 99 is the per-item cap; adding 50 twice should hit 99 on the second call.
    await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload({ quantity: 50 })),
    );
    const second = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload({ quantity: 50 })),
    );
    expect(second.status).toBe(409);
  });

  // ── PUT /api/cart/items/:itemId ─────────────────────────────────────────

  it("PUT /api/cart/items/:itemId sets a new quantity", async () => {
    const created = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload()),
    );
    const createdBody = await created.json();
    const itemId = createdBody.items[0].id;

    const response = await itemPUT(
      jsonRequest(
        `http://localhost/api/cart/items/${itemId}`,
        { quantity: 5 },
        "PUT",
      ),
      { params: Promise.resolve({ itemId }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items[0].quantity).toBe(5);
    expect(body.cart.itemCount).toBe(5);
  });

  it("PUT /api/cart/items/:itemId removes the item when quantity is 0", async () => {
    const created = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload()),
    );
    const createdBody = await created.json();
    const itemId = createdBody.items[0].id;

    const response = await itemPUT(
      jsonRequest(
        `http://localhost/api/cart/items/${itemId}`,
        { quantity: 0 },
        "PUT",
      ),
      { params: Promise.resolve({ itemId }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(0);
    expect(body.cart.itemCount).toBe(0);
  });

  it("PUT /api/cart/items/:itemId removes the item when quantity is negative", async () => {
    const created = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload()),
    );
    const createdBody = await created.json();
    const itemId = createdBody.items[0].id;

    const response = await itemPUT(
      jsonRequest(
        `http://localhost/api/cart/items/${itemId}`,
        { quantity: -5 },
        "PUT",
      ),
      { params: Promise.resolve({ itemId }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(0);
  });

  it("PUT /api/cart/items/:itemId returns 400 when quantity is non-integer", async () => {
    const created = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload()),
    );
    const createdBody = await created.json();
    const itemId = createdBody.items[0].id;

    const response = await itemPUT(
      jsonRequest(
        `http://localhost/api/cart/items/${itemId}`,
        { quantity: 1.5 },
        "PUT",
      ),
      { params: Promise.resolve({ itemId }) },
    );
    expect(response.status).toBe(400);
  });

  it("PUT /api/cart/items/:itemId returns 409 when quantity exceeds cap", async () => {
    const created = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload()),
    );
    const createdBody = await created.json();
    const itemId = createdBody.items[0].id;

    const response = await itemPUT(
      jsonRequest(
        `http://localhost/api/cart/items/${itemId}`,
        { quantity: 200 },
        "PUT",
      ),
      { params: Promise.resolve({ itemId }) },
    );
    expect(response.status).toBe(409);
  });

  it("PUT /api/cart/items/:itemId returns 404 when item does not exist", async () => {
    const response = await itemPUT(
      jsonRequest(
        "http://localhost/api/cart/items/missing",
        { quantity: 2 },
        "PUT",
      ),
      { params: Promise.resolve({ itemId: "missing" }) },
    );
    expect(response.status).toBe(404);
  });

  it("PUT /api/cart/items/:itemId returns 401 without a session", async () => {
    mockAuthedUser(null);
    const response = await itemPUT(
      jsonRequest("http://localhost/api/cart/items/x", { quantity: 1 }, "PUT"),
      { params: Promise.resolve({ itemId: "x" }) },
    );
    expect(response.status).toBe(401);
  });

  // ── DELETE /api/cart/items/:itemId ──────────────────────────────────────

  it("DELETE /api/cart/items/:itemId removes the row and returns the snapshot", async () => {
    const created = await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload({ quantity: 2 })),
    );
    const createdBody = await created.json();
    const itemId = createdBody.items[0].id;

    const response = await itemDELETE(
      new Request(`http://localhost/api/cart/items/${itemId}`, { method: "DELETE" }),
      { params: Promise.resolve({ itemId }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(0);
  });

  it("DELETE /api/cart/items/:itemId returns 404 when item does not exist", async () => {
    const response = await itemDELETE(
      new Request("http://localhost/api/cart/items/missing", { method: "DELETE" }),
      { params: Promise.resolve({ itemId: "missing" }) },
    );
    expect(response.status).toBe(404);
  });

  // ── DELETE /api/cart ────────────────────────────────────────────────────

  it("DELETE /api/cart wipes the cart and returns 204", async () => {
    await itemsPOST(jsonRequest("http://localhost/api/cart/items", buildItemPayload()));
    const response = await cartDELETE();
    expect(response.status).toBe(204);

    const after = await cartGET();
    const body = await after.json();
    expect(body.items).toHaveLength(0);
    expect(body.cart.itemCount).toBe(0);
  });

  it("DELETE /api/cart is idempotent (no cart yet)", async () => {
    const response = await cartDELETE();
    expect(response.status).toBe(204);
  });

  // ── POST /api/cart/merge ────────────────────────────────────────────────

  it("POST /api/cart/merge merges valid items and drops invalid ones", async () => {
    const merged = await mergePOST(
      jsonRequest("http://localhost/api/cart/merge", {
        items: [
          // valid simple
          buildItemPayload({ quantity: 1 }),
          // valid variant
          buildVariantItemPayload("var-m", VARIANT_M_SKU, { quantity: 1 }),
          // dropped: product does not exist
          buildItemPayload({ productId: "ghost-product", quantity: 5 }),
          // dropped: variant inactive
          buildVariantItemPayload("var-g", VARIANT_G_SKU, { quantity: 1 }),
          // dropped: SKU mismatch
          buildVariantItemPayload("var-m", "WRONGSKU_____ZZZZ", { quantity: 1 }),
        ],
      }),
    );
    expect(merged.status).toBe(200);
    const body = await merged.json();
    expect(body.items).toHaveLength(2);
    expect(body.dropped).toHaveLength(3);
    expect(body.dropped.map((d: { reason: string }) => d.reason).sort()).toEqual(
      ["product_not_found", "sku_mismatch", "variant_unavailable"].sort(),
    );
  });

  it("POST /api/cart/merge with empty items array returns current snapshot", async () => {
    await itemsPOST(jsonRequest("http://localhost/api/cart/items", buildItemPayload()));
    const response = await mergePOST(
      jsonRequest("http://localhost/api/cart/merge", { items: [] }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
  });

  it("POST /api/cart/merge refreshes prices from the catalog (ignores stale local price)", async () => {
    const merged = await mergePOST(
      jsonRequest("http://localhost/api/cart/merge", {
        items: [buildItemPayload({ unitPrice: 1, quantity: 1 })],
      }),
    );
    expect(merged.status).toBe(200);
    const body = await merged.json();
    // We sent unitPrice=1, but the catalog has 120; merge refreshes to catalog.
    expect(body.items[0].unitPrice).toBe(simple.price.price);
  });

  it("POST /api/cart/merge sums quantities with an existing server cart", async () => {
    await itemsPOST(
      jsonRequest("http://localhost/api/cart/items", buildItemPayload({ quantity: 2 })),
    );
    const merged = await mergePOST(
      jsonRequest("http://localhost/api/cart/merge", {
        items: [buildItemPayload({ quantity: 3 })],
      }),
    );
    expect(merged.status).toBe(200);
    const body = await merged.json();
    expect(body.items[0].quantity).toBe(5);
  });

  it("POST /api/cart/merge returns 401 without a session", async () => {
    mockAuthedUser(null);
    const response = await mergePOST(
      jsonRequest("http://localhost/api/cart/merge", { items: [] }),
    );
    expect(response.status).toBe(401);
  });

  it("POST /api/cart/merge returns 400 on invalid payload (items not an array)", async () => {
    const response = await mergePOST(
      jsonRequest("http://localhost/api/cart/merge", { items: "nope" }),
    );
    expect(response.status).toBe(400);
  });
});
