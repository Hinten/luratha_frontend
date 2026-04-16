import { type Firestore, collection, deleteDoc, doc, getDocs } from "firebase/firestore";
import { setDoc } from "firebase/firestore";
import { buildHomeSeedCategories } from "@/src/lib/repositories/homeSeedMockData";
import { buildE2eTestProducts } from "@/src/lib/repositories/seedE2eProducts";
import { firestoreCollections } from "@/src/schemas/firestore";

/**
 * Seeds the Firestore emulator with test data for E2E tests.
 * Creates categories and E2E-specific products so pages load successfully.
 */
export async function seedE2eFirestore(db: Firestore): Promise<void> {
  // Clear existing data
  console.log("[seedE2eFirestore] Clearing existing collections...");
  await clearEmulatorData(db);

  // Get collections references
  const categoriesCollection = collection(db, firestoreCollections.categories);
  const productsCollection = collection(db, firestoreCollections.products);

  // Seed categories
  const categories = buildHomeSeedCategories();
  console.log(`[seedE2eFirestore] Seeding ${categories.length} categories...`);
  for (const category of categories) {
    await setDoc(doc(categoriesCollection, category.id), category, { merge: true });
  }

  // Seed E2E products (specifically for E2E tests)
  const products = buildE2eTestProducts();
  console.log(`[seedE2eFirestore] Seeding ${products.length} E2E products...`);
  console.log("[seedE2eFirestore] E2E slugs:", products.map((product) => product.slug).join(", "));
  for (const product of products) {
    await setDoc(doc(productsCollection, product.id), product, { merge: true });
  }

  console.log("[seedE2eFirestore] E2E seed data complete.");
}

/**
 * Clears all data from the Firestore emulator.
 * Used before seeding to ensure a clean state.
 */
async function clearEmulatorData(db: Firestore): Promise<void> {
  try {
    // Delete all documents in collections used in E2E tests
    const collectionsToDelete = [
      firestoreCollections.categories,
      firestoreCollections.products,
    ];

    for (const collectionName of collectionsToDelete) {
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      
      for (const docSnapshot of snapshot.docs) {
        await deleteDoc(docSnapshot.ref);
      }
    }
  } catch (error) {
    // Some collections might not exist yet, which is fine
    console.warn("[seedE2eFirestore] Warning during data cleanup:", error);
  }
}
