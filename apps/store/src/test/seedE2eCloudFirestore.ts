import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { buildHomeSeedCategories } from "@luratha/repositories/homeSeedMockData";
import { buildE2eTestProducts } from "@luratha/repositories/seedE2eProducts";
import { firestoreCollections } from "@luratha/schemas";

/**
 * Seeds the cloud test Firestore project (`luratha-96386`) with deterministic
 * E2E fixtures via Admin SDK. The fixtures use stable slugs/IDs that the
 * Playwright specs rely on, and the seed is an idempotent upsert
 * (`set { merge: true }`): re-running it across the parallel CI lanes writes
 * the same docs and never collides.
 *
 * The only operation that DOES collide is the destructive clear — a lane that
 * finishes first would delete the shared fixtures out from under a still-running
 * lane. So when `E2E_KEEP_FIXTURES=1` (exported by every parallel CI E2E lane)
 * both the leading clear here and the Playwright globalTeardown are skipped.
 * Fixtures then persist between runs; because the IDs are stable they're simply
 * re-seeded, never accumulated. Wipe them on demand with
 * `pnpm --filter @luratha/store clear-e2e-fixtures` (e.g. after changing the
 * fixture set, when old IDs would be orphaned). Local runs leave the flag unset
 * and keep cleaning up after themselves.
 */
export function shouldKeepE2eFixtures(): boolean {
  return process.env.E2E_KEEP_FIXTURES === "1";
}

export async function seedE2eCloudFirestore(): Promise<void> {
  // Skip the destructive pre-clear on the parallel CI lanes — the upsert below
  // already refreshes the stable-ID fixtures, and deleting first would race a
  // concurrent lane mid-test.
  if (!shouldKeepE2eFixtures()) {
    await clearE2eFixtures();
  }

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
