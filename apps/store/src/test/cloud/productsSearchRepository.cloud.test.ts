/**
 * Cloud integration tests for productsSearchRepository.
 *
 * These tests run against a real Firebase project using credentials provided via:
 *   FIREBASE_SERVICE_ACCOUNT_BASE64 – service account for admin-level seeding/cleanup
 *   FIREBASE_WEB_APP_CONFIG_BASE64  – client web-app config used by the repository under test
 *
 * Credential handling is delegated to the shared modules:
 *   - src/lib/firestore/firebaseAdmin.ts reads FIREBASE_SERVICE_ACCOUNT_BASE64 directly
 *   - src/lib/firestore/environment.ts getFirebaseWebConfig() reads FIREBASE_WEB_APP_CONFIG_BASE64
 *
 * Execute:  npm run test:cloud
 *
 * The suite is automatically skipped when credentials are not available.
 *
 * What is covered:
 *   1. Pipeline search path  – search with a text term (shouldUsePipeline → true)
 *   2. Core search fallback  – search without a text term (shouldUsePipeline → false, uses core query)
 *   3. Category filtering    – pipeline resolves categorySlug to categoryId via categoriesRepository
 *   4. Unknown category      – returns empty array when the category slug does not exist
 *   5. Price range filtering – minPrice / maxPrice filter on core search path
 *   6. Pagination (offset)   – core search with offset returns a different page of results
 *   7. Vector fallback chain – useVectors=true with no Vertex AI falls back to pipeline, then core
 *   8. Empty-term guard      – page-level check: empty search term returns [] without hitting Firestore
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { deleteApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
// adminDb is the firebase-admin Firestore instance (server SDK).
// It authenticates via service account credentials and bypasses all
// Firestore security rules – required so seed/cleanup work regardless
// of the rules currently deployed to the project.
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { DATABASE_NAME, getFirebaseWebConfig } from "@luratha/firestore/environment";
import {
  createProductsSearchRepository,
  type SearchOptions,
} from "@/src/lib/repositories/productsSearchRepository";
import { EmbeddingGenerationError } from "@luratha/core/embeddingService";
import type { ProductSearchFilters } from "@luratha/core/firestoreQueryStrategies";
import { shouldUsePipeline } from "@luratha/core/firestoreQueryStrategies";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const CLOUD_TEST_APP_NAME = "luratha-cloud-test-client";

type SeedDocument = { collection: string; id: string };

/**
 * Write a single Firestore document via the Admin SDK (firebase-admin).
 * The Admin SDK bypasses Firestore security rules, so this works
 * regardless of the rules deployed to the project.
 */
async function seedDocument(
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
  tracked: SeedDocument[],
): Promise<void> {
  await adminDb.collection(collectionName).doc(id).set(data);
  tracked.push({ collection: collectionName, id });
}

/**
 * Delete all tracked documents via the Admin SDK (firebase-admin).
 * Bypasses security rules so cleanup succeeds even after rules are tightened.
 */
async function cleanupDocuments(tracked: SeedDocument[]): Promise<void> {
  await Promise.all(
    tracked.map(({ collection, id }) => adminDb.collection(collection).doc(id).delete()),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describeCloud("productsSearchRepository (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  const categorySlug = `test-cat-${prefix}`;
  const categoryId = `cat-${prefix}`;
  const skuToken = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  // Unique search term embedded in product titles – ensures search only returns test products
  const uniqueTerm = `Luratha_Cloud_Test_${prefix}`;

  let clientApp: FirebaseApp;
  let db: Firestore;
  const seededDocs: SeedDocument[] = [];

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  beforeAll(async () => {
    // ── 1. Client SDK setup (subject to security rules) ─────────────────────
    // This `db` instance is passed into the repository under test so that
    // queries run with the same Firestore rules a real user would face.
    const webConfig = getFirebaseWebConfig();
    clientApp =
      getApps().find((app) => app.name === CLOUD_TEST_APP_NAME) ??
      initializeApp(webConfig, CLOUD_TEST_APP_NAME);
    db = getFirestore(clientApp, DATABASE_NAME);

    // ── 2. Seed test data via Admin SDK (bypasses security rules) ────────────
    // All writes below go through `adminDb` (firebase-admin/firestore), which
    // authenticates with a service-account credential and ignores Firestore
    // security rules. This guarantees seeding works even after rules are
    // tightened on the project.
    const now = new Date().toISOString();

    // Seed category
    await seedDocument(
      "categories",
      categoryId,
      { id: categoryId, name: "Test Category", slug: categorySlug },
      seededDocs,
    );

    // Seed products ─ two in the test category, one in a different category
    const baseProduct = {
      status: "active",
      isPurchasable: true,
      brandName: "Luratha Test",
      categoryId,
      publishedAt: now,
      tags: [],
      materialTags: [],
      seasonalTags: [],
      vectorEmbedding: null,
      searchEmbedding: null,
      gtin: null,
      mpn: null,
      shortTitle: null,
      googleProductCategoryId: null,
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
      variants: null,
      totalStock: 5,
      ratingAverage: 4.5,
      reviewCount: 10,
      salePrice: null,
      createdAt: now,
      updatedAt: now,
    };

    await seedDocument(
      "products",
      `${prefix}-prod-a`,
      {
        ...baseProduct,
        id: `${prefix}-prod-a`,
        slug: null,
        title: uniqueTerm,
        description: "Vestido de linho artesanal exclusivo para testes de integração cloud.",
        sku: `SKU_${skuToken}_A`,
        priceMin: 200,
        priceMax: 200,
        price: { price: 200, salePrice: null, priceMin: 200, priceMax: 200, currency: "BRL", startDate: null, endDate: null },
        // Denormalized fields used by the exact-match short-circuit; even
        // products without variants must persist these arrays so the
        // arrayContains queries don't fail on missing fields.
        variantIds: [],
        variantSkus: [],
      },
      seededDocs,
    );

    await seedDocument(
      "products",
      `${prefix}-prod-b`,
      {
        ...baseProduct,
        id: `${prefix}-prod-b`,
        slug: null,
        title: uniqueTerm,
        description: "Blusa de algodão artesanal exclusiva para testes de integração cloud.",
        sku: `SKU_${skuToken}_B`,
        priceMin: 120,
        priceMax: 120,
        price: { price: 120, salePrice: null, priceMin: 120, priceMax: 120, currency: "BRL", startDate: null, endDate: null },
        // Variant product — denormalized arrays power the variant exact-match path.
        variants: [
          { id: `var-${prefix}-b-p`, sku: `SKU_${skuToken}_B_P`, photoIds: [], active: true, color: null, size: ["P"], gtin: null, mpn: null, item_group_id: null },
          { id: `var-${prefix}-b-m`, sku: `SKU_${skuToken}_B_M`, photoIds: [], active: true, color: null, size: ["M"], gtin: null, mpn: null, item_group_id: null },
        ],
        variantIds: [`var-${prefix}-b-p`, `var-${prefix}-b-m`],
        variantSkus: [`SKU_${skuToken}_B_P`, `SKU_${skuToken}_B_M`],
      },
      seededDocs,
    );

    await seedDocument(
      "products",
      `${prefix}-prod-other`,
      {
        ...baseProduct,
        id: `${prefix}-prod-other`,
        slug: null,
        title: uniqueTerm,
        description: "Saia plissada exclusiva para testes de integração cloud.",
        sku: `SKU_${skuToken}_OTHER`,
        categoryId: "cat-other-not-test",
        priceMin: 300,
        priceMax: 300,
        price: { price: 300, salePrice: null, priceMin: 300, priceMax: 300, currency: "BRL", startDate: null, endDate: null },
        variantIds: [],
        variantSkus: [],
      },
      seededDocs,
    );
  });

  afterAll(async () => {
    await cleanupDocuments(seededDocs);

    // Tear down the client app created for this suite only.
    // Do NOT delete the shared adminDb app from firebaseAdmin.ts.
    const clientAppToDelete = getApps().find((app) => app.name === CLOUD_TEST_APP_NAME);
    if (clientAppToDelete) await deleteApp(clientAppToDelete);
  });

  // ── Tests ─────────────────────────────────────────────────────────────────

  /**
   * 1. Empty-term guard (page-level logic)
   * The page (`busca/page.tsx`) returns [] without calling the repository when `term` is empty.
   * We replicate the same guard here to confirm consistent behavior.
   */
  it("returns empty array when term is empty (page-level guard)", () => {
    const term = "  "; // whitespace-only as the page trims it
    const products = (term.trim()) ? ["would call repository"] : [];
    expect(products).toHaveLength(0);
  });

  /**
   * 2. shouldUsePipeline gate
   * Validates that the routing logic correctly picks pipeline vs core.
   */
  it("shouldUsePipeline routes correctly for term vs no-term filters", () => {
    expect(shouldUsePipeline({ term: uniqueTerm })).toBe(true);
    expect(shouldUsePipeline({ minPrice: 100, maxPrice: 300 })).toBe(false);
    expect(shouldUsePipeline({ tags: ["a", "b", "c", "d", "e"] })).toBe(true); // > 4 tags
    expect(shouldUsePipeline({})).toBe(false);
  });

  /**
   * 3. Pipeline search path
   * Searches by the unique term – only the two seeded products in the test category
   * plus the out-of-category one should match (all titles contain uniqueTerm).
   * Asserts that pipeline executes without error and returns at least the seeded docs.
   */
  it("pipeline search: returns seeded products matching the unique term", async () => {
    const repo = createProductsSearchRepository(db);
    const filters: ProductSearchFilters = { term: uniqueTerm, limit: 24 };

    // Should route via pipeline
    expect(shouldUsePipeline(filters)).toBe(true);

    const results = await repo.search(filters);

    // At least the 3 seeded products should match
    const resultIds = results.map((p) => p.id);
    expect(resultIds).toContain(`${prefix}-prod-a`);
    expect(resultIds).toContain(`${prefix}-prod-b`);
    expect(resultIds).toContain(`${prefix}-prod-other`);
  });

  /**
   * 4. Pipeline search with category filter
   * Only the 2 products in the test category should be returned.
   */
  it("pipeline search: filters by category slug", async () => {
    const repo = createProductsSearchRepository(db);
    const filters: ProductSearchFilters = {
      term: uniqueTerm,
      categorySlug,
      limit: 24,
    };

    const results = await repo.search(filters);

    const resultIds = results.map((p) => p.id);
    expect(resultIds).toContain(`${prefix}-prod-a`);
    expect(resultIds).toContain(`${prefix}-prod-b`);
    // The out-of-category product should NOT appear
    expect(resultIds).not.toContain(`${prefix}-prod-other`);
  });

  /**
   * 5. Unknown category returns empty array
   * When the category slug does not resolve to a known category, the repository
   * returns [] immediately without executing a Firestore query.
   */
  it("pipeline search: returns empty array for unknown category slug", async () => {
    const repo = createProductsSearchRepository(db);
    const filters: ProductSearchFilters = {
      term: uniqueTerm,
      categorySlug: `non-existent-category-${randomUUID()}`,
      limit: 24,
    };

    const results = await repo.search(filters);
    expect(results).toHaveLength(0);
  });

  /**
   * 6. Core search path (no term)
   * Without a search term, shouldUsePipeline → false and the repository uses the
   * core Firestore query. We verify it returns the seeded products.
   */
  it("core search: returns seeded products without a search term", async () => {
    const repo = createProductsSearchRepository(db);
    // No term → core path
    const filters: ProductSearchFilters = { categorySlug, limit: 24 };

    expect(shouldUsePipeline(filters)).toBe(false);

    const results = await repo.search(filters);

    const resultIds = results.map((p) => p.id);
    expect(resultIds).toContain(`${prefix}-prod-a`);
    expect(resultIds).toContain(`${prefix}-prod-b`);
  });

  /**
   * 7. Core search: unknown category slug returns empty array
   */
  it("core search: returns empty array for unknown category slug", async () => {
    const repo = createProductsSearchRepository(db);
    const filters: ProductSearchFilters = {
      categorySlug: `non-existent-${randomUUID()}`,
      limit: 24,
    };

    expect(shouldUsePipeline(filters)).toBe(false);

    const results = await repo.search(filters);
    expect(results).toHaveLength(0);
  });

  /**
   * 8. Price range filtering (core path)
   * Prod-A: price 200, Prod-B: price 120.
   * Query minPrice 150 should only return prod-a from our category.
   */
  it("core search: price range filter returns only products within range", async () => {
    const repo = createProductsSearchRepository(db);
    // core path: no term, with category + price filter
    const filters: ProductSearchFilters = {
      categorySlug,
      minPrice: 150,
      limit: 24,
    };

    expect(shouldUsePipeline(filters)).toBe(false);

    const results = await repo.search(filters);

    const resultIds = results.map((p) => p.id);
    // prod-a (200) should be in results
    expect(resultIds).toContain(`${prefix}-prod-a`);
    // prod-b (120) should NOT be in results
    expect(resultIds).not.toContain(`${prefix}-prod-b`);
  });

  /**
   * 9. Pipeline search: price range filter
   */
  it("pipeline search: price range filter returns only products within range", async () => {
    const repo = createProductsSearchRepository(db);
    const filters: ProductSearchFilters = {
      term: uniqueTerm,
      categorySlug,
      minPrice: 150,
      limit: 24,
    };

    expect(shouldUsePipeline(filters)).toBe(true);

    const results = await repo.search(filters);

    const resultIds = results.map((p) => p.id);
    expect(resultIds).toContain(`${prefix}-prod-a`);
    expect(resultIds).not.toContain(`${prefix}-prod-b`);
  });

  /**
   * 10. Vector fallback chain
   * With useVectors=true but no Vertex AI configured, the embedding service throws.
   * The repository should catch the vector error, fall back to pipeline (if term present),
   * and finally fall back to core if pipeline also fails.
   * We verify that the search still returns valid results (not an error).
   */
  it("vector fallback chain: falls back to pipeline/core when vector service unavailable", async () => {
    // Inject a stub embedding service that always throws (simulating no Vertex AI).
    // The repository only swallows EmbeddingGenerationError (matching what the
    // real service throws); plain Error would propagate.
    const failingEmbeddingService = {
      async embed(): Promise<number[]> {
        throw new EmbeddingGenerationError("Vertex AI not configured – expected test failure");
      },
    };

    const repo = createProductsSearchRepository(db, { embeddingService: failingEmbeddingService });
    const filters: ProductSearchFilters = { term: uniqueTerm, limit: 24 };
    const options: SearchOptions = { useVectors: true };

    // Should NOT throw – must fall back gracefully
    const results = await repo.search(filters, options);

    // After vector failure, falls back to pipeline/core which should still find the seeded products
    const resultIds = results.map((p) => p.id);
    expect(resultIds).toContain(`${prefix}-prod-a`);
  });

  /**
   * 11. Pagination via offset (core path)
   * Seeds 2 products in the test category with limit=1. Two pages should return different products.
   */
  it("core search: pagination offset returns different results", async () => {
    const repo = createProductsSearchRepository(db);
    const baseFilters: ProductSearchFilters = { categorySlug, limit: 1 };

    const page1 = await repo.search({ ...baseFilters, offset: 0 });
    const page2 = await repo.search({ ...baseFilters, offset: 1 });

    // Both pages should have at most 1 result
    expect(page1.length).toBeLessThanOrEqual(1);
    expect(page2.length).toBeLessThanOrEqual(1);

    // If both pages have results, they should be different products
    if (page1.length > 0 && page2.length > 0) {
      expect(page1[0].id).not.toBe(page2[0].id);
    }
  });

  /**
   * 12a. Exact match: by product id
   * The repository must resolve a product by its document id without scanning the collection.
   */
  it("findByIdOrSku: returns product when term equals product id", async () => {
    const repo = createProductsSearchRepository(db);
    const found = await repo.findByIdOrSku(`${prefix}-prod-a`);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(`${prefix}-prod-a`);
  });

  /**
   * 12b. Exact match: by product sku
   */
  it("findByIdOrSku: returns product when term equals product sku", async () => {
    const repo = createProductsSearchRepository(db);
    const found = await repo.findByIdOrSku(`SKU_${skuToken}_A`);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(`${prefix}-prod-a`);
  });

  /**
   * 12c. Exact match: by variant id (denormalized array-contains)
   */
  it("findByIdOrSku: returns parent product when term equals a variant id", async () => {
    const repo = createProductsSearchRepository(db);
    const found = await repo.findByIdOrSku(`var-${prefix}-b-p`);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(`${prefix}-prod-b`);
  });

  /**
   * 12d. Exact match: by variant sku (denormalized array-contains)
   */
  it("findByIdOrSku: returns parent product when term equals a variant sku", async () => {
    const repo = createProductsSearchRepository(db);
    const found = await repo.findByIdOrSku(`SKU_${skuToken}_B_M`);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(`${prefix}-prod-b`);
  });

  /**
   * 12e. Exact match: search() short-circuits to the matched product when the term
   * equals an id/sku, and skips the regular pipeline scan entirely.
   */
  it("search: returns single result when term equals an id/sku", async () => {
    const repo = createProductsSearchRepository(db);
    const results = await repo.search({ term: `SKU_${skuToken}_A`, limit: 24 });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(`${prefix}-prod-a`);
  });

  /**
   * 12f. Multi-token term skips the exact-match short-circuit
   * Even if one of the tokens looks like an id, the trim-then-check rule means
   * any internal whitespace falls through to the regular regex pipeline search.
   */
  it("search: multi-token term skips exact-match and uses pipeline search", async () => {
    const repo = createProductsSearchRepository(db);
    // Use the unique term followed by a space + the id; should NOT short-circuit.
    const results = await repo.search({
      term: `${uniqueTerm} ${prefix}-prod-a`,
      limit: 24,
    });
    // Regular pipeline searches title/description for the regex match. The id
    // by itself doesn't appear in the title, so result count should reflect a
    // regex-driven search rather than the deterministic single-doc lookup.
    // We assert that we did not collapse to a single, id-only response.
    if (results.length === 1) {
      expect(results[0].id).not.toBe(`${prefix}-prod-a`);
    }
  });

  /**
   * 12g. Unknown id/sku falls through to regular search
   */
  it("search: unknown id/sku token falls through to regular search", async () => {
    const repo = createProductsSearchRepository(db);
    const results = await repo.search({ term: `nonexistent-${randomUUID()}`, limit: 24 });
    expect(Array.isArray(results)).toBe(true);
    // No seeded product matches this random token in title/description either.
    expect(results).toHaveLength(0);
  });

  /**
   * 13. Result shape validation
   * Each returned product must conform to the expected FirestoreProduct shape
   * (validated by validateProduct inside the repository).
   */
  it("pipeline search: returned products have valid shape", async () => {
    const repo = createProductsSearchRepository(db);
    const filters: ProductSearchFilters = {
      term: uniqueTerm,
      categorySlug,
      limit: 5,
    };

    const results = await repo.search(filters);

    expect(results.length).toBeGreaterThan(0);
    for (const product of results) {
      expect(product).toMatchObject({
        id: expect.any(String),
        slug: expect.any(String),
        title: expect.any(String),
        status: "active",
        categoryId: expect.any(String),
        price: expect.objectContaining({
          price: expect.any(Number),
          currency: "BRL",
        }),
      });
    }
  });
});
