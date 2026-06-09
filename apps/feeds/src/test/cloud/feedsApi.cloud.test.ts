/**
 * Cloud integration test for the product feed (project luratha-96386).
 *
 * Seeds products through the real admin path (adminProductConverter), then
 * invokes the feed route and asserts the produced XML: active+purchasable
 * products appear, draft / non-purchasable products are excluded, variants are
 * expanded with `g:item_group_id`, and sale price survives the Firestore
 * round-trip.
 *
 * Execute: pnpm --filter @luratha/feeds test:firestore
 * The suite is automatically skipped when credentials are not available.
 */

import { afterAll, expect, it, beforeAll } from "vitest";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { firestoreCollections, validateProduct, type Product } from "@luratha/schemas";
import { createCloudTestPrefix, describeCloud } from "@/src/test/cloud/sharedSetup";
import { GET as productsFeedGET } from "@/src/app/api/feeds/products.xml/route";

function photoAsset(id: string, now: string) {
  const resolution = {
    width: 800,
    height: 1200,
    storagePath: `products/${id}.webp`,
    downloadUrl: `https://cdn.example.com/${id}.webp`,
    format: "webp" as const,
  };
  return {
    id,
    alt: null,
    resolutions: { mobile: resolution, tablet: resolution, desktop: resolution },
    createdAt: now,
    updatedAt: now,
  };
}

describeCloud("/api/feeds/products.xml (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  const now = new Date().toISOString();
  // SKU-safe token (skuSchema requires /^[A-Z0-9_-]{6,64}$/).
  const token = prefix
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 20);

  const idActive = `${prefix}-active`;
  const idVariant = `${prefix}-variant`;
  const idDraft = `${prefix}-draft`;
  const idUnpurchasable = `${prefix}-nopurchase`;
  const variantSku = `${token}VAR1`;

  const seededIds = [idActive, idVariant, idDraft, idUnpurchasable];

  const products: Product[] = [
    validateProduct({
      id: idActive,
      title: "Feed Active Product",
      description: "Produto ativo para o teste de feed.",
      sku: `${token}ACT1`,
      isPurchasable: true,
      categoryId: "cat-test-feed",
      status: "active",
      totalStock: 5,
      price: {
        price: 200,
        salePrice: 150,
        currency: "BRL",
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-12-31T23:59:59.000Z",
      },
      photoAssets: [photoAsset(`${prefix}-ph-a`, now)],
      createdAt: now,
      updatedAt: now,
    }),
    validateProduct({
      id: idVariant,
      title: "Feed Variant Product",
      description: "Produto com variantes para o teste de feed.",
      sku: `${token}VPR1`,
      isPurchasable: true,
      categoryId: "cat-test-feed",
      status: "active",
      totalStock: 9,
      color: ["Azul"],
      price: { price: 320, currency: "BRL" },
      photoAssets: [photoAsset(`${prefix}-ph-v`, now)],
      variants: [
        {
          id: `${idVariant}-v1`,
          sku: variantSku,
          size: ["P", "M"],
          color: ["Azul"],
          photoIds: [],
          active: true,
        },
      ],
      createdAt: now,
      updatedAt: now,
    }),
    validateProduct({
      id: idDraft,
      title: "Feed Draft Product",
      description: "Produto em rascunho — não deve aparecer no feed.",
      sku: `${token}DRF1`,
      isPurchasable: true,
      categoryId: "cat-test-feed",
      status: "draft",
      totalStock: 3,
      price: { price: 100, currency: "BRL" },
      createdAt: now,
      updatedAt: now,
    }),
    validateProduct({
      id: idUnpurchasable,
      title: "Feed Unpurchasable Product",
      description: "Produto não comprável — não deve aparecer no feed.",
      sku: `${token}NOP1`,
      isPurchasable: false,
      categoryId: "cat-test-feed",
      status: "active",
      totalStock: 4,
      price: { price: 110, currency: "BRL" },
      createdAt: now,
      updatedAt: now,
    }),
  ];

  beforeAll(async () => {
    await Promise.all(
      products.map((product) =>
        adminDb
          .collection(firestoreCollections.products)
          .doc(product.id)
          .withConverter(adminProductConverter)
          .set(product),
      ),
    );
  });

  afterAll(async () => {
    await Promise.all(
      seededIds.map((id) => adminDb.collection(firestoreCollections.products).doc(id).delete()),
    );
  });

  it("serves an XML feed including active products and excluding draft/non-purchasable ones", async () => {
    const response = await productsFeedGET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/xml");

    const xml = await response.text();

    // Active simple product: single item keyed by product id, with sale price.
    expect(xml).toContain(`<g:id>${idActive}</g:id>`);
    expect(xml).toContain("<g:sale_price>150.00 BRL</g:sale_price>");
    expect(xml).toContain(
      "<g:sale_price_effective_date>2026-01-01T00:00:00.000Z/2026-12-31T23:59:59.000Z</g:sale_price_effective_date>",
    );

    // Variant product: expanded per size, grouped by the parent product id.
    expect(xml).toContain(`<g:id>${variantSku}-P</g:id>`);
    expect(xml).toContain(`<g:id>${variantSku}-M</g:id>`);
    expect(xml).toContain(`<g:item_group_id>${idVariant}</g:item_group_id>`);

    // Draft and non-purchasable products must not be in the feed.
    expect(xml).not.toContain(idDraft);
    expect(xml).not.toContain(idUnpurchasable);
  });
});
