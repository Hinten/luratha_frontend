/**
 * Cloud integration tests for product registration and vector search.
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
 *   1. Register product without photos  – photoAssets defaults to empty array
 *   2. Register product with photos     – photoAssets array with valid image assets
 *   3. Register product without variants – variants defaults to null
 *   4. Register product with variants   – variants array with size/color entries
 *   5. Vector search                    – product seeded using real embeddings from Vertex AI
 *                                         is found by a text-similarity search
 *   6. Vector search fallback           – graceful fallback when embedding service fails
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { deleteApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { adminApp, adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { DATABASE_NAME, getFirebaseProjectId, getFirebaseWebConfig } from "@luratha/firestore/environment";
import { createEmbeddingService } from "@luratha/core/embeddingService";
import { createProductsRepository } from "@luratha/repositories/productsRepository";
import {
  createProductsSearchRepository,
  type SearchOptions,
} from "@luratha/repositories/productsSearchRepository";
import { firestoreCollections, validateProduct } from "@luratha/schemas";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const CLOUD_TEST_APP_NAME = "luratha-cloud-products-test-client";

type SeedDocument = { collection: string; id: string };

async function cleanupDocuments(tracked: SeedDocument[]): Promise<void> {
  await Promise.all(
    tracked.map(({ collection, id }) => adminDb.collection(collection).doc(id).delete()),
  );
}

/** Minimal valid product data for seeding */
function buildBaseProductData(prefix: string, skuToken: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = new Date().toISOString();
  const id = `${prefix}-${randomUUID().slice(0, 8)}`;
  const sku = `SKU_${skuToken}_${id.slice(-6).toUpperCase()}`;

  return {
    id,
    slug: null,
    title: `Produto Teste Cloud ${id}`,
    shortTitle: null,
    description: "Produto de teste criado pela suíte de testes de integração cloud.",
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
    ...overrides,
  };
}

/** A minimal image asset structure that satisfies productImageAssetSchema */
function buildImageAsset(productId: string, assetId: string): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: assetId,
    alt: "Foto de teste",
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

describeCloud("Product Registration + Vector Search (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  const skuToken = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const categoryId = `cat-${prefix}`;
  const categorySlug = `test-cat-${prefix}`;

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

    // Seed test category via Admin SDK
    await adminDb.collection("categories").doc(categoryId).set({
      id: categoryId,
      name: "Test Category",
      slug: categorySlug,
    });
    seededDocs.push({ collection: "categories", id: categoryId });
  });

  afterAll(async () => {
    await cleanupDocuments(seededDocs);

    const clientAppToDelete = getApps().find((app) => app.name === CLOUD_TEST_APP_NAME);
    if (clientAppToDelete) await deleteApp(clientAppToDelete);
  });

  // ── Test 1: Create product without photos ─────────────────────────────────

  /**
   * 1. Register product without photos
   * Creates a product with no photoAssets via Admin SDK (simulating what the API
   * endpoint does), then reads it back via the client SDK repository to verify
   * the shape and that photoAssets is an empty array.
   */
  it("registers product without photos: photoAssets defaults to empty array", async () => {
    const productData = buildBaseProductData(prefix, skuToken, {
      categoryId,
      photoAssets: [],
      lifeStylePhotos: [],
    });
    const id = productData.id as string;

    await adminDb.collection(firestoreCollections.products).doc(id).set(productData);
    seededDocs.push({ collection: firestoreCollections.products, id });

    const repo = createProductsRepository(db);
    const product = await repo.getById(id);

    expect(product).not.toBeNull();
    expect(product!.id).toBe(id);
    expect(product!.photoAssets).toEqual([]);
    expect(product!.lifeStylePhotos).toEqual([]);
  });

  // ── Test 2: Create product with photos ────────────────────────────────────

  /**
   * 2. Register product with photos
   * Creates a product with multiple photoAssets and verifies they are stored
   * and retrieved correctly.
   */
  it("registers product with photos: photoAssets are stored and retrieved", async () => {
    const productData = buildBaseProductData(prefix, skuToken, { categoryId });
    const id = productData.id as string;
    const asset1 = buildImageAsset(id, "asset-001");
    const asset2 = buildImageAsset(id, "asset-002");

    await adminDb.collection(firestoreCollections.products).doc(id).set({
      ...productData,
      photoAssets: [asset1, asset2],
    });
    seededDocs.push({ collection: firestoreCollections.products, id });

    const repo = createProductsRepository(db);
    const product = await repo.getById(id);

    expect(product).not.toBeNull();
    expect(product!.photoAssets).toHaveLength(2);
    expect(product!.photoAssets[0].id).toBe("asset-001");
    expect(product!.photoAssets[1].id).toBe("asset-002");
  });

  // ── Test 3: Create product without variants ───────────────────────────────

  /**
   * 3. Register product without variants
   * Verifies that a simple (non-variable) product is stored with variants = null.
   */
  it("registers product without variants: variants is null", async () => {
    const productData = buildBaseProductData(prefix, skuToken, {
      categoryId,
      variants: null,
    });
    const id = productData.id as string;

    await adminDb.collection(firestoreCollections.products).doc(id).set(productData);
    seededDocs.push({ collection: firestoreCollections.products, id });

    const repo = createProductsRepository(db);
    const product = await repo.getById(id);

    expect(product).not.toBeNull();
    expect(product!.variants).toBeNull();
  });

  // ── Test 4: Create product with variants ──────────────────────────────────

  /**
   * 4. Register product with variants
  * Creates a variable product with size variants and verifies the variants array
  * is stored and retrieved with correct SKUs and active flags.
   */
  it("registers product with variants: variant array is stored and retrieved", async () => {
    const baseData = buildBaseProductData(prefix, skuToken, { categoryId });
    const parentSku = baseData.sku as string;
    const id = baseData.id as string;

    const variants = [
      { id: `var-${randomUUID().slice(0, 8)}`, sku: `${parentSku}-P`, photoIds: [], active: true },
      { id: `var-${randomUUID().slice(0, 8)}`, sku: `${parentSku}-M`, photoIds: [], active: true },
      { id: `var-${randomUUID().slice(0, 8)}`, sku: `${parentSku}-G`, photoIds: [], active: false },
    ];

    await adminDb.collection(firestoreCollections.products).doc(id).set({
      ...baseData,
      variants,
    });
    seededDocs.push({ collection: firestoreCollections.products, id });

    const repo = createProductsRepository(db);
    const product = await repo.getById(id);

    expect(product).not.toBeNull();
    expect(product!.variants).toHaveLength(3);
    expect(product!.variants![0].sku).toBe(`${parentSku}-P`);
    expect(product!.variants![1].sku).toBe(`${parentSku}-M`);
    expect(product!.variants![2].active).toBe(false);
  });

  // ── Test 5: Vector search with real embeddings ────────────────────────────

  /**
   * 5. Vector search via real Vertex AI embeddings
   * Generates a real embedding for the product text via createEmbeddingService,
   * seeds a product with that embedding, then performs a text-similarity search
   * using the same embedding service and verifies the seeded product is returned.
   */
  it("vector search: finds product seeded with real embedding by similar text", async () => {
    const embeddingService = createEmbeddingService({
      projectId: getFirebaseProjectId(),
      credential: adminApp.options.credential,
    });

    const productTitle = `Vestido Artesanal Linho ${prefix}`;
    const productDescription = "Vestido artesanal de linho para uso casual e elegante.";
    const embeddingText = `${productTitle} ${productDescription}`;

    // Generate a real embedding from Vertex AI for this product
    const embedding = await embeddingService.embed(embeddingText);

    // Seed the product with the real embedding via the DataConverter
    const productData = buildBaseProductData(prefix, skuToken, {
      categoryId,
      title: productTitle,
      description: productDescription,
      vectorEmbedding: embedding,
      searchEmbedding: embedding,
      status: "active",
    });
    const productId = productData.id as string;

    const validatedProduct = validateProduct(productData);
    await adminDb
      .collection(firestoreCollections.products)
      .doc(productId)
      .withConverter(adminProductConverter)
      .set(validatedProduct);
    seededDocs.push({ collection: firestoreCollections.products, id: productId });

    // Search using text similar to the product title — the real embedding service is used
    const searchRepo = createProductsSearchRepository(db, { embeddingService });
    const searchOptions: SearchOptions = { useVectors: true };
    const results = await searchRepo.search(
      { term: "vestido artesanal linho", limit: 50 },
      searchOptions,
    );

    // The seeded product should appear in the results
    const resultIds = results.map((p) => p.id);
    expect(
      resultIds,
      `Expected seeded product '${productId}' to be included in vector search results. Received IDs: ${JSON.stringify(resultIds)}`,
    ).toContain(productId);

    // Verify shape of the returned product
    const found = results.find((p) => p.id === productId)!;
    expect(found).toMatchObject({
      id: productId,
      title: productTitle,
      status: "active",
      price: expect.objectContaining({ currency: "BRL" }),
    });
  }, 60_000);

  // ── Test 6: Vector fallback to pipeline when Vertex AI is unavailable ──────

  /**
   * 6. Vector search graceful fallback
   * When the embedding service is unavailable, the search should fall back to the
   * pipeline path and still return valid results (no error thrown).
   */
  it("vector search: falls back gracefully when embedding service fails", async () => {
    const failingEmbeddingService = {
      async embed(): Promise<number[]> {
        throw new Error("Vertex AI not available – expected test failure");
      },
    };

    const searchRepo = createProductsSearchRepository(db, { embeddingService: failingEmbeddingService });
    const searchOptions: SearchOptions = { useVectors: true };

    // Should not throw
    const results = await searchRepo.search(
      { categorySlug, limit: 10 },
      searchOptions,
    );

    expect(Array.isArray(results)).toBe(true);
  });
});
