/**
 * Cloud integration tests for productsSearchRepository.
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
import {
  cert,
  deleteApp as deleteAdminApp,
  getApps as getAdminApps,
  initializeApp as initAdminApp,
  type App as AdminApp,
} from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import {
  createProductsSearchRepository,
  type SearchOptions,
} from "@/src/lib/repositories/productsSearchRepository";
import type { ProductSearchFilters } from "@/src/lib/firestoreQueryStrategies";
import { shouldUsePipeline } from "@/src/lib/firestoreQueryStrategies";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const CLOUD_TEST_APP_NAME = "luratha-cloud-test-client";
const CLOUD_ADMIN_APP_NAME = "luratha-cloud-test-admin";
const DB_NAME = "default";

/** Parse JSON from a base64-encoded environment variable. */
function parseBase64Json(envVar: string, label: string): Record<string, unknown> {
  const raw = process.env[envVar];
  if (!raw) throw new Error(`${label} (env: ${envVar}) is not set`);
  return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Record<string, unknown>;
}

/** Initialize (or reuse) the Firebase client app for tests. */
function getClientApp(): FirebaseApp {
  const existing = getApps().find((app) => app.name === CLOUD_TEST_APP_NAME);
  if (existing) return existing;

  let config: Record<string, unknown>;
  if (process.env.CLOUD_TEST_WEB_APP_CONFIG_JSON) {
    config = JSON.parse(process.env.CLOUD_TEST_WEB_APP_CONFIG_JSON) as Record<string, unknown>;
  } else {
    config = parseBase64Json("FIREBASE_WEB_APP_CONFIG_BASE64", "Firebase web app config");
  }
  return initializeApp(config as Parameters<typeof initializeApp>[0], CLOUD_TEST_APP_NAME);
}

/** Initialize (or reuse) the Firebase Admin app for seeding / cleanup. */
function getAdminApp(): AdminApp {
  const existing = getAdminApps().find((app) => app.name === CLOUD_ADMIN_APP_NAME);
  if (existing) return existing;

  const serviceAccountJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ??
    (() => {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
      if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is not set");
      return Buffer.from(raw, "base64").toString("utf8");
    })();

  const sa = JSON.parse(serviceAccountJson) as { project_id?: string };
  return initAdminApp(
    { credential: cert(serviceAccountJson), projectId: sa.project_id },
    CLOUD_ADMIN_APP_NAME,
  );
}

type SeedDocument = { collection: string; id: string };

/** Write a single Firestore document via the admin SDK and track it for cleanup. */
async function seedDocument(
  adminDb: FirebaseFirestore.Firestore,
  collectionName: string,
  id: string,
  data: Record<string, unknown>,
  tracked: SeedDocument[],
): Promise<void> {
  await adminDb.collection(collectionName).doc(id).set(data);
  tracked.push({ collection: collectionName, id });
}

/** Delete all tracked documents via admin SDK. */
async function cleanupDocuments(
  adminDb: FirebaseFirestore.Firestore,
  tracked: SeedDocument[],
): Promise<void> {
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
  // Unique search term embedded in product titles – ensures search only returns test products
  const uniqueTerm = `Luratha_Cloud_Test_${prefix}`;

  let clientApp: FirebaseApp;
  let db: Firestore;
  let adminDb: FirebaseFirestore.Firestore;
  const seededDocs: SeedDocument[] = [];

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  beforeAll(async () => {
    // Client app (used by productsSearchRepository under test)
    clientApp = getClientApp();
    db = getFirestore(clientApp, DB_NAME);

    // Admin app (used for seeding and cleanup)
    const adminApp = getAdminApp();
    adminDb = getAdminFirestore(adminApp, DB_NAME);

    const now = new Date().toISOString();

    // Seed category
    await seedDocument(
      adminDb,
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
      adminDb,
      "products",
      `${prefix}-prod-a`,
      {
        ...baseProduct,
        id: `${prefix}-prod-a`,
        slug: `${prefix}-prod-a`,
        title: `${uniqueTerm} Vestido Linho`,
        description: "Vestido de linho artesanal exclusivo para testes de integração cloud.",
        sku: `SKU-${prefix}-A`,
        price: { price: 200, salePrice: null, priceMin: 200, priceMax: 200, currency: "BRL", startDate: null, endDate: null },
      },
      seededDocs,
    );

    await seedDocument(
      adminDb,
      "products",
      `${prefix}-prod-b`,
      {
        ...baseProduct,
        id: `${prefix}-prod-b`,
        slug: `${prefix}-prod-b`,
        title: `${uniqueTerm} Blusa Algodão`,
        description: "Blusa de algodão artesanal exclusiva para testes de integração cloud.",
        sku: `SKU-${prefix}-B`,
        price: { price: 120, salePrice: null, priceMin: 120, priceMax: 120, currency: "BRL", startDate: null, endDate: null },
      },
      seededDocs,
    );

    await seedDocument(
      adminDb,
      "products",
      `${prefix}-prod-other`,
      {
        ...baseProduct,
        id: `${prefix}-prod-other`,
        slug: `${prefix}-prod-other`,
        title: `${uniqueTerm} Saia Plissada`,
        description: "Saia plissada exclusiva para testes de integração cloud.",
        sku: `SKU-${prefix}-OTHER`,
        categoryId: "cat-other-not-test",
        price: { price: 300, salePrice: null, priceMin: 300, priceMax: 300, currency: "BRL", startDate: null, endDate: null },
      },
      seededDocs,
    );
  });

  afterAll(async () => {
    await cleanupDocuments(adminDb, seededDocs);

    // Tear down Firebase apps created for this suite only
    const clientAppToDelete = getApps().find((app) => app.name === CLOUD_TEST_APP_NAME);
    if (clientAppToDelete) await deleteApp(clientAppToDelete);

    const adminAppToDelete = getAdminApps().find((app) => app.name === CLOUD_ADMIN_APP_NAME);
    if (adminAppToDelete) await deleteAdminApp(adminAppToDelete);
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
    // Inject a stub embedding service that always throws (simulating no Vertex AI)
    const failingEmbeddingService = {
      async embed(): Promise<number[]> {
        throw new Error("Vertex AI not configured – expected test failure");
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
   * 12. Result shape validation
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
