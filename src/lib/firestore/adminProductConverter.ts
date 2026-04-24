/**
 * Firestore DataConverter for the Product model — admin SDK (firebase-admin/firestore).
 *
 * Usage:
 *   const productRef = adminDb
 *     .collection(firestoreCollections.products)
 *     .doc(id)
 *     .withConverter(adminProductConverter);
 *
 *   await productRef.set(validatedProduct);   // toFirestore wraps embeddings as VectorValue
 *   const data = (await productRef.get()).data(); // fromFirestore returns a plain Product
 */

import { type FirestoreDataConverter, FieldValue } from "firebase-admin/firestore";
import { type Product, validateProduct } from "@/src/schemas/firestore";

/**
 * Converts a Firestore vector field to a plain number[].
 * The admin SDK does not export VectorValue, so we duck-type via .toArray().
 */
function extractVector(val: unknown): number[] | null {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) return val as number[];
  if (
    typeof val === "object" &&
    "toArray" in val &&
    typeof (val as { toArray: unknown }).toArray === "function"
  ) {
    const result = (val as { toArray(): unknown }).toArray();
    return Array.isArray(result) ? (result as number[]) : null;
  }
  return null;
}

export const adminProductConverter: FirestoreDataConverter<Product> = {
  toFirestore(product: Product) {
    const { vectorEmbedding, searchEmbedding, ...rest } = product;
    return {
      ...rest,
      vectorEmbedding: vectorEmbedding !== null ? FieldValue.vector(vectorEmbedding) : null,
      searchEmbedding: searchEmbedding !== null ? FieldValue.vector(searchEmbedding) : null,
    };
  },

  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validateProduct({
      ...data,
      vectorEmbedding: extractVector(data.vectorEmbedding),
      searchEmbedding: extractVector(data.searchEmbedding),
    });
  },
};
