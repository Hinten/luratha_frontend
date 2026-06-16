/**
 * Cloud integration tests for POST /api/cart/validate.
 *
 * Seeds real products + stock, then exercises the bulk availability check:
 * in-stock → sem ajuste; pedido acima do estoque → cap; esgotado/inexistente
 * → drop com reason. Read-only (não escreve carrinho), sem autenticação.
 *
 * Run: `npm run test:firestore`. Auto-skips without cloud credentials.
 */

import { afterAll, beforeAll, expect, it } from "vitest";
import { buildProductSlug, firestoreCollections } from "@luratha/schemas";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";
import { POST as validatePOST } from "@/src/app/api/cart/validate/route";
import {
  VARIANT_M_SKU,
  buildSimpleProduct,
  buildVariableProduct,
  cleanupDocuments,
  seedProduct,
  seedStockDoc,
  type SeedDocument,
} from "@/src/test/cloud/productFixtures";

interface Adjustment {
  itemId: string;
  productId: string;
  variantId?: string;
  name: string;
  action: "cap" | "drop";
  reason: string;
  availableQty: number;
}

describeCloud("/api/cart/validate (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  const simple = buildSimpleProduct(prefix);
  const variable = buildVariableProduct(prefix);
  const simpleSlug = buildProductSlug(simple.title, simple.sku);
  const variableSlug = buildProductSlug(variable.title, variable.sku);
  const seededDocs: SeedDocument[] = [
    { collection: firestoreCollections.products, id: simple.id },
    { collection: firestoreCollections.products, id: variable.id },
    { collection: firestoreCollections.stock, id: simple.id },
    { collection: firestoreCollections.stock, id: variable.id },
  ];

  beforeAll(async () => {
    await seedProduct(simple);
    await seedProduct(variable);
  });

  afterAll(async () => {
    await cleanupDocuments(seededDocs);
  });

  function simpleItem(overrides: Record<string, unknown> = {}) {
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

  function variantItem(overrides: Record<string, unknown> = {}) {
    return {
      productId: variable.id,
      variantId: "var-m",
      variantSku: VARIANT_M_SKU,
      productSlug: variableSlug,
      name: variable.title,
      photoId: variable.photoAssets[0].id,
      imageUrl: variable.photoAssets[0].resolutions.mobile.downloadUrl,
      variantLabel: "M",
      unitPrice: variable.price.price,
      currency: "BRL",
      quantity: 1,
      ...overrides,
    };
  }

  function jsonRequest(items: unknown[]): Request {
    return new Request("http://localhost/api/cart/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  }

  it("não gera ajustes quando há estoque suficiente", async () => {
    await seedStockDoc({ productId: simple.id, sku: simple.sku, quantity: 10 });
    const response = await validatePOST(jsonRequest([simpleItem({ quantity: 2 })]));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.adjustments).toEqual([]);
  });

  it("retorna ajuste de cap quando o pedido excede o estoque", async () => {
    await seedStockDoc({ productId: simple.id, sku: simple.sku, quantity: 2 });
    const response = await validatePOST(jsonRequest([simpleItem({ quantity: 5 })]));
    const body = await response.json();
    const adjustments = body.adjustments as Adjustment[];
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]).toMatchObject({
      productId: simple.id,
      action: "cap",
      reason: "stock_capped",
      availableQty: 2,
      name: simple.title,
    });
  });

  it("retorna ajuste de drop (out_of_stock) para item esgotado", async () => {
    await seedStockDoc({ productId: simple.id, sku: simple.sku, quantity: 0 });
    const response = await validatePOST(jsonRequest([simpleItem({ quantity: 1 })]));
    const body = await response.json();
    const adjustments = body.adjustments as Adjustment[];
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]).toMatchObject({
      productId: simple.id,
      action: "drop",
      reason: "out_of_stock",
      availableQty: 0,
    });
  });

  it("dropa produto inexistente com product_not_found", async () => {
    const response = await validatePOST(
      jsonRequest([simpleItem({ productId: "ghost-product-xyz", quantity: 1 })]),
    );
    const body = await response.json();
    const adjustments = body.adjustments as Adjustment[];
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0].action).toBe("drop");
    expect(adjustments[0].reason).toBe("product_not_found");
  });

  it("combina cap + drop + variante esgotada numa só leva", async () => {
    await seedStockDoc({ productId: simple.id, sku: simple.sku, quantity: 1 });
    await seedStockDoc({
      productId: variable.id,
      sku: variable.sku,
      quantity: 0,
      variants: { "var-m": 0, "var-g": 0 },
    });
    const response = await validatePOST(
      jsonRequest([simpleItem({ quantity: 4 }), variantItem({ quantity: 2 })]),
    );
    const body = await response.json();
    const adjustments = body.adjustments as Adjustment[];
    const byProduct = new Map(adjustments.map((a) => [a.productId, a]));
    expect(byProduct.get(simple.id)).toMatchObject({ action: "cap", availableQty: 1 });
    expect(byProduct.get(variable.id)).toMatchObject({ action: "drop", reason: "out_of_stock" });
  });

  it("itens vazios retornam adjustments vazio", async () => {
    const response = await validatePOST(jsonRequest([]));
    expect(response.status).toBe(200);
    expect((await response.json()).adjustments).toEqual([]);
  });
});
