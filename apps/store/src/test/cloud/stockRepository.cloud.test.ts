/**
 * Cloud integration tests for the stock repository.
 *
 * These tests run against a real Firebase project using credentials provided via:
 *   FIREBASE_SERVICE_ACCOUNT_BASE64 – service account for admin-level seeding/cleanup
 *   FIREBASE_WEB_APP_CONFIG_BASE64  – client web-app config used by the repository under test
 *
 * Execute:  npm run test:cloud
 *
 * The suite is automatically skipped when credentials are not available.
 *
 * What is covered:
 *   1. Set and read stock for a simple product (no variants)
 *   2. Set and read stock for a product with variants
 *   3. Batch read stock for multiple products (getByProductIds)
 *   4. Returns null for non-existent product stock
 *   5. Overwrite stock (set is idempotent)
 *   6. Delete a stock document
 *   7. Throws not_found when deleting non-existent stock
 *   8. Rejects invalid stock payload (hasVariants=true but variants=null)
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { deleteApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { DATABASE_NAME, getFirebaseWebConfig } from "@/src/lib/firestore/environment";
import { createStockRepository, StockRepositoryError } from "@/src/lib/repositories/stockRepository";
import { firestoreCollections, validateStock } from "@luratha/schemas";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const CLOUD_TEST_APP_NAME = "luratha-cloud-stock-test-client";

type SeedDocument = { collection: string; id: string };

async function cleanupDocuments(tracked: SeedDocument[]): Promise<void> {
  await Promise.all(
    tracked.map(({ collection, id }) => adminDb.collection(collection).doc(id).delete()),
  );
}

function buildBaseStockData(
  productId: string,
  sku: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    productId,
    sku,
    quantity: 10,
    hasVariants: false,
    variants: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describeCloud("Stock Repository (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  const skuBase = `SKU_STCK_${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  let clientApp: FirebaseApp;
  let db: Firestore;
  const seededDocs: SeedDocument[] = [];

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const webConfig = getFirebaseWebConfig();
    clientApp =
      getApps().find((app) => app.name === CLOUD_TEST_APP_NAME) ??
      initializeApp(webConfig, CLOUD_TEST_APP_NAME);
    db = getFirestore(clientApp, DATABASE_NAME);
  });

  afterAll(async () => {
    await cleanupDocuments(seededDocs);

    const clientAppToDelete = getApps().find((app) => app.name === CLOUD_TEST_APP_NAME);
    if (clientAppToDelete) await deleteApp(clientAppToDelete);
  });

  // ── Tests ──────────────────────────────────────────────────────────────────

  it("sets and reads stock for a simple product", async () => {
    const productId = `${prefix}-simple`;
    const sku = `${skuBase}_SIMPLE`;
    const repository = createStockRepository(db);

    const stockData = buildBaseStockData(productId, sku, { quantity: 8 });
    const stock = validateStock(stockData);
    const created = await repository.set(stock);
    seededDocs.push({ collection: firestoreCollections.stock, id: productId });

    expect(created.productId).toBe(productId);
    expect(created.quantity).toBe(8);
    expect(created.hasVariants).toBe(false);
    expect(created.variants).toBeNull();

    const loaded = await repository.getByProductId(productId);
    expect(loaded?.quantity).toBe(8);
  });

  it("sets and reads stock for a product with variants", async () => {
    const productId = `${prefix}-variants`;
    const sku = `${skuBase}_VAR`;
    const variantId1 = `var_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const variantId2 = `var_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
    const repository = createStockRepository(db);

    const stockData = buildBaseStockData(productId, sku, {
      quantity: 9,
      hasVariants: true,
      variants: {
        [variantId1]: 4,
        [variantId2]: 5,
      },
    });
    const stock = validateStock(stockData);
    const created = await repository.set(stock);
    seededDocs.push({ collection: firestoreCollections.stock, id: productId });

    expect(created.hasVariants).toBe(true);
    expect(created.variants).not.toBeNull();
    expect(created.variants?.[variantId1]).toBe(4);
    expect(created.variants?.[variantId2]).toBe(5);
    expect(created.quantity).toBe(9);
  });

  it("batch reads stock for multiple products", async () => {
    const productId1 = `${prefix}-batch1`;
    const productId2 = `${prefix}-batch2`;
    const sku1 = `${skuBase}_B1`;
    const sku2 = `${skuBase}_B2`;
    const repository = createStockRepository(db);

    await repository.set(validateStock(buildBaseStockData(productId1, sku1, { quantity: 5 })));
    await repository.set(validateStock(buildBaseStockData(productId2, sku2, { quantity: 3 })));
    seededDocs.push(
      { collection: firestoreCollections.stock, id: productId1 },
      { collection: firestoreCollections.stock, id: productId2 },
    );

    const stockMap = await repository.getByProductIds([productId1, productId2]);
    expect(stockMap.size).toBe(2);
    expect(stockMap.get(productId1)?.quantity).toBe(5);
    expect(stockMap.get(productId2)?.quantity).toBe(3);
  });

  it("returns null for a non-existent product", async () => {
    const repository = createStockRepository(db);
    const result = await repository.getByProductId(`${prefix}-nonexistent`);
    expect(result).toBeNull();
  });

  it("overwrites stock with set (idempotent upsert)", async () => {
    const productId = `${prefix}-overwrite`;
    const sku = `${skuBase}_OW`;
    const repository = createStockRepository(db);

    await repository.set(validateStock(buildBaseStockData(productId, sku, { quantity: 10 })));
    seededDocs.push({ collection: firestoreCollections.stock, id: productId });

    await repository.set(validateStock(buildBaseStockData(productId, sku, { quantity: 2 })));

    const loaded = await repository.getByProductId(productId);
    expect(loaded?.quantity).toBe(2);
  });

  it("deletes a stock document", async () => {
    const productId = `${prefix}-delete`;
    const sku = `${skuBase}_DEL`;
    const repository = createStockRepository(db);

    await repository.set(validateStock(buildBaseStockData(productId, sku)));
    await repository.delete(productId);

    const loaded = await repository.getByProductId(productId);
    expect(loaded).toBeNull();
  });

  it("throws not_found when deleting non-existent stock", async () => {
    const repository = createStockRepository(db);
    await expect(repository.delete(`${prefix}-no-such-product`)).rejects.toMatchObject({
      code: "not_found",
      name: "StockRepositoryError",
    } satisfies Partial<StockRepositoryError>);
  });

  it("rejects invalid stock payload (hasVariants=true with variants=null)", async () => {
    const productId = `${prefix}-invalid`;
    const sku = `${skuBase}_INV`;
    const repository = createStockRepository(db);

    await expect(
      repository.seedMockStock([
        {
          productId,
          sku,
          quantity: 5,
          hasVariants: true,
          variants: null,
          updatedAt: new Date().toISOString(),
        },
      ]),
    ).rejects.toMatchObject({
      code: "validation",
      name: "StockRepositoryError",
    } satisfies Partial<StockRepositoryError>);
  });
});
