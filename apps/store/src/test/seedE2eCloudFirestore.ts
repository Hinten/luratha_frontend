import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { buildHomeSeedCategories } from "@luratha/repositories/homeSeedMockData";
import { buildE2eTestProducts } from "@luratha/repositories/seedE2eProducts";
import { firestoreCollections } from "@luratha/schemas";

/**
 * Seeds the cloud test Firestore project (`luratha-96386`) with deterministic
 * E2E fixtures via Admin SDK. The fixtures use stable slugs/IDs that the
 * Playwright specs rely on.
 *
 * The seed is **idempotent and non-destructive**: it merge-upserts the same
 * deterministic documents every run and never deletes. Because every run
 * writes the same deterministic IDs (merge upsert — a field removed from a
 * fixture definition would linger until a manual reset, but the docs the specs
 * read always converge), concurrent E2E jobs (e2e-cloud, seo-e2e, and cross-PR
 * runs) can seed simultaneously without racing — there is no delete window
 * where another run would read missing fixtures, and the shared IDs mean the
 * storefront never renders duplicated catalog data. This is what lets each E2E
 * job run in its own concurrency group instead of being serialized through one
 * shared group (which caused queued jobs to be cancelled — see the workflow
 * comments).
 *
 * The fixtures intentionally persist between runs. They do NOT accumulate:
 * deterministic IDs mean each run overwrites the same docs in place.
 */
export async function seedE2eCloudFirestore(): Promise<void> {
  const categories = buildHomeSeedCategories();
  await Promise.all(
    categories.map((category) =>
      adminDb
        .collection(firestoreCollections.categories)
        .doc(category.id)
        .set(category, { merge: true }),
    ),
  );

  const products = buildE2eTestProducts();
  await Promise.all(
    products.map((product) =>
      adminDb
        .collection(firestoreCollections.products)
        .doc(product.id)
        .set(product, { merge: true }),
    ),
  );
}

/**
 * Deletes the E2E fixtures by their deterministic IDs. Provided for manual /
 * local resets only (e.g. after shrinking the fixture set so a removed product
 * no longer lingers). It is intentionally NOT wired into the Playwright global
 * setup/teardown: running it while another E2E job is reading the shared
 * project would pull fixtures out from under that run. Never call it from a
 * path that can execute concurrently with a live E2E run.
 */
export async function clearE2eFixtures(): Promise<void> {
  const productIds = buildE2eTestProducts().map((product) => product.id);
  const categoryIds = buildHomeSeedCategories().map((category) => category.id);

  await Promise.all([
    ...productIds.map((id) => adminDb.collection(firestoreCollections.products).doc(id).delete()),
    ...categoryIds.map((id) =>
      adminDb.collection(firestoreCollections.categories).doc(id).delete(),
    ),
  ]);
}
