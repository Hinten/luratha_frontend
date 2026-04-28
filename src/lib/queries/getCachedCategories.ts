import "server-only";
import { cache } from "react";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminCategoryConverter } from "@/src/lib/firestore/adminCategoryConverter";
import { firestoreCollections, type Category } from "@/src/schemas/firestore";

/**
 * Fetches all categories from Firestore ordered by name, deduplicated per
 * React render via `cache()`.  Safe to call from multiple server files
 * (sitemap, layout, page components) without incurring extra round-trips.
 */
export const getCachedCategories = cache(async (): Promise<Category[]> => {
  try {
    const snapshot = await adminDb
      .collection(firestoreCollections.categories)
      .withConverter(adminCategoryConverter)
      .orderBy("name", "asc")
      .limit(100)
      .get();

    return snapshot.docs.map((d) => d.data());
  } catch {
    return [];
  }
});
