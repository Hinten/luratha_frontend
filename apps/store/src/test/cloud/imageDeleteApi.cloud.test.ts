/**
 * Cloud integration tests for photo deletion.
 *
 * These tests run against a real Firebase project using credentials provided via:
 *   FIREBASE_SERVICE_ACCOUNT_BASE64 – service account for admin-level seeding/cleanup
 *
 * Execute:  npm run test:cloud
 *
 * The suite is automatically skipped when credentials are not available.
 *
 * What is covered:
 *   1. Delete image from a single product's photoAssets
 *   2. Delete image from a product's lifeStylePhotos
 *   3. Delete image shared across multiple products
 *   4. Return 404 when imageId is not found in any product
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { deleteProductImage } from "@/src/lib/repositories/productImageDelete";
import { firestoreCollections, validateProduct } from "@/src/schemas/firestore";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type SeedDocument = { collection: string; id: string };

async function cleanupDocuments(tracked: SeedDocument[]): Promise<void> {
  await Promise.all(
    tracked.map(({ collection, id }) => adminDb.collection(collection).doc(id).delete()),
  );
}

function buildBaseProductData(prefix: string, skuSuffix: string): Record<string, unknown> {
  const now = new Date().toISOString();
  const id = `${prefix}-${randomUUID().slice(0, 8)}`;
  const sku = `SKU_DEL_${skuSuffix}_${id.slice(-6).toUpperCase()}`;

  return {
    id,
    slug: null,
    title: `Produto Teste Delete ${id}`,
    shortTitle: null,
    description: "Produto de teste para exclusão de imagens.",
    vectorEmbedding: null,
    searchEmbedding: null,
    sku,
    gtin: null,
    mpn: null,
    status: "active",
    isPurchasable: true,
    brandName: "Luratha Test",
    categoryId: `cat-${prefix}`,
    googleProductCategoryId: null,
    tags: [],
    materialTags: [],
    seasonalTags: [],
    price: { price: 100, salePrice: null, priceMin: null, priceMax: null, currency: "BRL", startDate: null, endDate: null },
    salePrice: null,
    condition: "new",
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
    photoAssets: [],
    lifeStylePhotos: [],
    videoUrls: [],
    ratingAverage: null,
    reviewCount: null,
    totalStock: 5,
    variants: null,
    createdAt: now,
    updatedAt: now,
  };
}

function buildImageAsset(productId: string, assetId: string): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: assetId,
    alt: "Foto de teste para delete",
    resolutions: {
      mobile: {
        width: 480,
        height: 600,
        storagePath: `products/${productId}/${assetId}/mobile.webp`,
        downloadUrl: `https://example.com/${productId}/${assetId}/mobile.webp`,
        format: "webp",
      },
      tablet: {
        width: 768,
        height: 960,
        storagePath: `products/${productId}/${assetId}/tablet.webp`,
        downloadUrl: `https://example.com/${productId}/${assetId}/tablet.webp`,
        format: "webp",
      },
      desktop: {
        width: 1200,
        height: 1500,
        storagePath: `products/${productId}/${assetId}/desktop.webp`,
        downloadUrl: `https://example.com/${productId}/${assetId}/desktop.webp`,
        format: "webp",
      },
    },
    createdAt: now,
    updatedAt: now,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describeCloud("Image Delete — Cloud Firebase", () => {
  const prefix = createCloudTestPrefix();
  const skuSuffix = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const seededDocs: SeedDocument[] = [];

  beforeAll(async () => {
    // Nothing to set up globally — each test seeds its own data.
  });

  afterAll(async () => {
    await cleanupDocuments(seededDocs);
  });

  // ── Test 1: Delete from photoAssets ──────────────────────────────────────

  it("removes imageId from product photoAssets and persists the change", async () => {
    const productData = buildBaseProductData(prefix, skuSuffix);
    const productId = productData.id as string;
    const assetId = `asset-del-${randomUUID().slice(0, 8)}`;
    const asset = buildImageAsset(productId, assetId);

    await adminDb.collection(firestoreCollections.products).doc(productId).set({
      ...productData,
      photoAssets: [asset],
    });
    seededDocs.push({ collection: firestoreCollections.products, id: productId });

    const result = await deleteProductImage(assetId);

    expect(result.imageId).toBe(assetId);
    expect(result.updatedProducts).toContain(productId);

    const updatedSnap = await adminDb.collection(firestoreCollections.products).doc(productId).get();
    const updatedProduct = validateProduct(updatedSnap.data());
    expect(updatedProduct.photoAssets.some((a) => a.id === assetId)).toBe(false);
  });

  // ── Test 2: Delete from lifeStylePhotos ──────────────────────────────────

  it("removes imageId from product lifeStylePhotos and persists the change", async () => {
    const productData = buildBaseProductData(prefix, `${skuSuffix}B`);
    const productId = productData.id as string;
    const assetId = `asset-life-${randomUUID().slice(0, 8)}`;
    const asset = buildImageAsset(productId, assetId);

    await adminDb.collection(firestoreCollections.products).doc(productId).set({
      ...productData,
      lifeStylePhotos: [asset],
    });
    seededDocs.push({ collection: firestoreCollections.products, id: productId });

    const result = await deleteProductImage(assetId);

    expect(result.imageId).toBe(assetId);
    expect(result.updatedProducts).toContain(productId);

    const updatedSnap = await adminDb.collection(firestoreCollections.products).doc(productId).get();
    const updatedProduct = validateProduct(updatedSnap.data());
    expect(updatedProduct.lifeStylePhotos.some((a) => a.id === assetId)).toBe(false);
  });

  // ── Test 3: Delete shared image across multiple products ──────────────────

  it("removes imageId from all products that reference it", async () => {
    const assetId = `asset-shared-${randomUUID().slice(0, 8)}`;

    const productData1 = buildBaseProductData(prefix, `${skuSuffix}C1`);
    const productData2 = buildBaseProductData(prefix, `${skuSuffix}C2`);
    const productId1 = productData1.id as string;
    const productId2 = productData2.id as string;

    const asset1 = buildImageAsset(productId1, assetId);
    const asset2 = buildImageAsset(productId2, assetId);

    await Promise.all([
      adminDb.collection(firestoreCollections.products).doc(productId1).set({
        ...productData1,
        photoAssets: [asset1],
      }),
      adminDb.collection(firestoreCollections.products).doc(productId2).set({
        ...productData2,
        lifeStylePhotos: [asset2],
      }),
    ]);
    seededDocs.push(
      { collection: firestoreCollections.products, id: productId1 },
      { collection: firestoreCollections.products, id: productId2 },
    );

    const result = await deleteProductImage(assetId);

    expect(result.updatedProducts).toContain(productId1);
    expect(result.updatedProducts).toContain(productId2);

    const [snap1, snap2] = await Promise.all([
      adminDb.collection(firestoreCollections.products).doc(productId1).get(),
      adminDb.collection(firestoreCollections.products).doc(productId2).get(),
    ]);
    const prod1 = validateProduct(snap1.data());
    const prod2 = validateProduct(snap2.data());

    expect(prod1.photoAssets.some((a) => a.id === assetId)).toBe(false);
    expect(prod2.lifeStylePhotos.some((a) => a.id === assetId)).toBe(false);
  });

  // ── Test 4: Not found ─────────────────────────────────────────────────────

  it("throws ProductImageDeleteError with code not_found when imageId is not in any product", async () => {
    const nonExistentId = `nonexistent-${randomUUID()}`;

    await expect(deleteProductImage(nonExistentId)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
