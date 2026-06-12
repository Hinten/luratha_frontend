import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminStockConverter } from "@luratha/firestore/adminStockConverter";
import { buildHomeSeedCategories } from "@luratha/repositories/homeSeedMockData";
import { buildE2eTestProducts, buildE2eTestStock } from "@luratha/repositories/seedE2eProducts";
import { firestoreCollections } from "@luratha/schemas";

/**
 * Seeds the cloud test Firestore project (`luratha-96386`) with deterministic
 * E2E fixtures via Admin SDK. The fixtures use stable slugs/IDs that the
 * Playwright specs rely on. CI serializes the e2e job (concurrency group)
 * so that concurrent PRs don't race on the shared collections.
 *
 * Stock docs are seeded alongside products: `POST /api/orders` valida e
 * decrementa estoque, então os specs de checkout consomem as quantidades —
 * o re-seed por run devolve tudo para 99.
 */
export async function seedE2eCloudFirestore(): Promise<void> {
  await clearE2eFixtures();

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

  const stocks = buildE2eTestStock();
  await Promise.all(
    stocks.map((stock) =>
      adminDb
        .collection(firestoreCollections.stock)
        .doc(stock.productId)
        .withConverter(adminStockConverter)
        .set(stock),
    ),
  );
}

export async function clearE2eFixtures(): Promise<void> {
  const productIds = buildE2eTestProducts().map((product) => product.id);
  const categoryIds = buildHomeSeedCategories().map((category) => category.id);

  await Promise.all([
    ...productIds.map((id) => adminDb.collection(firestoreCollections.products).doc(id).delete()),
    ...productIds.map((id) => adminDb.collection(firestoreCollections.stock).doc(id).delete()),
    ...categoryIds.map((id) =>
      adminDb.collection(firestoreCollections.categories).doc(id).delete(),
    ),
  ]);
}
