import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { buildHomeSeedCategories } from "@/src/lib/repositories/homeSeedMockData";
import { buildE2eTestProducts } from "@/src/lib/repositories/seedE2eProducts";
import { firestoreCollections } from "@/src/schemas/firestore";

/**
 * Seeds the cloud test Firestore project (`luratha-96386`) with deterministic
 * E2E fixtures via Admin SDK. The fixtures use stable slugs/IDs that the
 * Playwright specs rely on. CI serializes the e2e job (concurrency group)
 * so that concurrent PRs don't race on the shared collections.
 */
export async function seedE2eCloudFirestore(): Promise<void> {
  await clearE2eFixtures();

  const categories = buildHomeSeedCategories();
  await Promise.all(
    categories.map((category) =>
      adminDb.collection(firestoreCollections.categories).doc(category.id).set(category, { merge: true }),
    ),
  );

  const products = buildE2eTestProducts();
  await Promise.all(
    products.map((product) =>
      adminDb.collection(firestoreCollections.products).doc(product.id).set(product, { merge: true }),
    ),
  );
}

export async function clearE2eFixtures(): Promise<void> {
  const productIds = buildE2eTestProducts().map((product) => product.id);
  const categoryIds = buildHomeSeedCategories().map((category) => category.id);

  await Promise.all([
    ...productIds.map((id) => adminDb.collection(firestoreCollections.products).doc(id).delete()),
    ...categoryIds.map((id) => adminDb.collection(firestoreCollections.categories).doc(id).delete()),
  ]);
}
