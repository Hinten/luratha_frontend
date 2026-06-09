/**
 * End-to-end cloud test for the home seed → /busca search flow.
 *
 * This test reproduces the user-facing bug "the /busca route doesn't find
 * products seeded by /api/dev/seed-mock-data" by going through the same
 * data path:
 *
 *   1. Build the home seed products with `buildHomeSeedProducts()`.
 *   2. Persist a sample subset to Firestore using `adminProductConverter`
 *      (the exact converter the seed endpoint uses).
 *   3. Run text searches via `productsSearchRepository.search()` — the
 *      repository the /busca page renders results from.
 *   4. Run id / sku / variant id / variant sku exact-match searches via
 *      `findByIdOrSku()`.
 *
 * If the seed → search round-trip stops working again, this is the test
 * that should fail loudly.
 */

import { afterAll, beforeAll, expect, it } from "vitest";
import { deleteApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { DATABASE_NAME, getFirebaseWebConfig } from "@luratha/firestore/environment";
import { createProductsSearchRepository } from "@luratha/repositories/productsSearchRepository";
import {
  buildHomeSeedCategories,
  buildHomeSeedProducts,
} from "@luratha/repositories/homeSeedMockData";
import { firestoreCollections, validateProduct } from "@luratha/schemas";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";

const CLOUD_TEST_APP_NAME = "luratha-cloud-seed-search-client";

type SeedDocument = { collection: string; id: string };

async function cleanupDocuments(tracked: SeedDocument[]): Promise<void> {
  await Promise.all(
    tracked.map(({ collection, id }) => adminDb.collection(collection).doc(id).delete()),
  );
}

describeCloud("Home seed → /busca search round-trip", () => {
  const prefix = createCloudTestPrefix();
  // The seed prefix mixes lowercase hex into the SKU; skuSchema only allows
  // [A-Z0-9_-] so we derive an uppercase-only version for the SKU suffix.
  const skuPrefix = prefix.replace(/[^A-Za-z0-9_-]/g, "_").toUpperCase();
  let clientApp: FirebaseApp;
  let db: Firestore;
  const seededDocs: SeedDocument[] = [];

  // We pick three real home-seed products that cover the variants we care about:
  //   - Vestido Midi (no variants) → exercise product id / sku exact match
  //   - Vestido Festa (variants)  → exercise variant id / sku exact match
  //   - Blusa Cropped (no variants) → exercise text search
  const seededProductIds = ["prod_home_01", "prod_home_03", "prod_home_11"] as const;
  // Append the prefix to guarantee uniqueness across concurrent CI runs.
  const namespacedId = (rawId: string) => `${rawId}__${prefix}`;
  const namespacedSku = (rawSku: string) => `${rawSku}_${skuPrefix}`;

  beforeAll(async () => {
    const webConfig = getFirebaseWebConfig();
    clientApp =
      getApps().find((app) => app.name === CLOUD_TEST_APP_NAME) ??
      initializeApp(webConfig, CLOUD_TEST_APP_NAME);
    db = getFirestore(clientApp, DATABASE_NAME);

    // Seed the categories the home seed products reference.
    const categories = buildHomeSeedCategories();
    for (const category of categories) {
      const id = namespacedId(category.id);
      await adminDb
        .collection(firestoreCollections.categories)
        .doc(id)
        .set({
          ...category,
          id,
        });
      seededDocs.push({ collection: firestoreCollections.categories, id });
    }

    // Build the products from the same builder the seed-mock-data endpoint uses.
    const allProducts = buildHomeSeedProducts(categories);

    // Re-namespace the ids/skus to keep the suite isolated. Variant ids/skus
    // are also re-namespaced so we can assert on them in the variant tests.
    // `slug: null` forces the schema's preprocess to regenerate the slug from
    // the new title+sku — leaving the old slug in place would trip the
    // superRefine check that demands slug match the title/sku pair.
    const productsToSeed = allProducts
      .filter((product) =>
        seededProductIds.includes(product.id as (typeof seededProductIds)[number]),
      )
      .map((product) => ({
        ...product,
        id: namespacedId(product.id),
        slug: null,
        sku: namespacedSku(product.sku),
        categoryId: namespacedId(product.categoryId),
        variants:
          product.variants?.map((variant) => ({
            ...variant,
            id: namespacedId(variant.id),
            sku: namespacedSku(variant.sku),
          })) ?? null,
      }));

    for (const product of productsToSeed) {
      const ref = adminDb
        .collection(firestoreCollections.products)
        .doc(product.id)
        .withConverter(adminProductConverter);
      // Re-validate so the schema's transform recomputes slug, variantIds and
      // variantSkus for the namespaced product.
      const revalidated = validateProduct(product);
      await ref.set(revalidated);
      seededDocs.push({ collection: firestoreCollections.products, id: product.id });
    }
  });

  afterAll(async () => {
    await cleanupDocuments(seededDocs);
    const clientAppToDelete = getApps().find((app) => app.name === CLOUD_TEST_APP_NAME);
    if (clientAppToDelete) await deleteApp(clientAppToDelete);
  });

  it("text search by 'vestido' returns the seeded products", async () => {
    const repo = createProductsSearchRepository(db);
    const results = await repo.search({ term: "vestido", limit: 24 });

    const ids = new Set(results.map((p) => p.id));
    expect(ids).toContain(namespacedId("prod_home_01"));
    expect(ids).toContain(namespacedId("prod_home_11"));
  });

  it("text search by 'cropped' returns the seeded blusa cropped product", async () => {
    const repo = createProductsSearchRepository(db);
    const results = await repo.search({ term: "cropped", limit: 24 });
    const ids = new Set(results.map((p) => p.id));
    expect(ids).toContain(namespacedId("prod_home_03"));
  });

  it("findByIdOrSku resolves a product by its (namespaced) id", async () => {
    const repo = createProductsSearchRepository(db);
    const found = await repo.findByIdOrSku(namespacedId("prod_home_01"));
    expect(found).not.toBeNull();
    expect(found?.id).toBe(namespacedId("prod_home_01"));
  });

  it("findByIdOrSku resolves a product by its (namespaced) sku", async () => {
    const repo = createProductsSearchRepository(db);
    const found = await repo.findByIdOrSku(namespacedSku("LURATHA_1001"));
    expect(found).not.toBeNull();
    expect(found?.id).toBe(namespacedId("prod_home_01"));
  });

  it("findByIdOrSku resolves the parent product by a variant id", async () => {
    const repo = createProductsSearchRepository(db);
    const found = await repo.findByIdOrSku(namespacedId("var_prod11_pp"));
    expect(found).not.toBeNull();
    expect(found?.id).toBe(namespacedId("prod_home_11"));
  });

  it("findByIdOrSku resolves the parent product by a variant sku", async () => {
    const repo = createProductsSearchRepository(db);
    const found = await repo.findByIdOrSku(namespacedSku("LURATHA_1011_M"));
    expect(found).not.toBeNull();
    expect(found?.id).toBe(namespacedId("prod_home_11"));
  });

  it("search short-circuits when the term equals an id/sku/variant", async () => {
    const repo = createProductsSearchRepository(db);
    const results = await repo.search({
      term: namespacedId("var_prod11_pp"),
      limit: 24,
    });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(namespacedId("prod_home_11"));
  });
});
