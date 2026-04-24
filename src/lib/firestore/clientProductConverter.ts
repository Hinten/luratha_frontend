/**
 * Firestore DataConverter for the Product model — client SDK (firebase/firestore).
 *
 * Usage:
 *   const productRef = doc(
 *     collection(db, firestoreCollections.products).withConverter(clientProductConverter),
 *     id,
 *   );
 *
 *   await setDoc(productRef, validatedProduct);  // toFirestore wraps embeddings as VectorValue
 *   const data = (await getDoc(productRef)).data(); // fromFirestore returns a plain Product
 */

import {
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  VectorValue,
  vector,
} from "firebase/firestore";
import { type Product, validateProduct } from "@/src/schemas/firestore";

/**
 * Converts a Firestore vector field to a plain number[].
 * The client SDK exports VectorValue, so we use instanceof for a precise check.
 */
function extractVector(val: unknown): number[] | null {
  if (val === null || val === undefined) return null;
  if (val instanceof VectorValue) return val.toArray();
  if (Array.isArray(val)) return val as number[];
  return null;
}

export const clientProductConverter: FirestoreDataConverter<Product> = {
  toFirestore(product: Product) {
    const { vectorEmbedding, searchEmbedding, ...rest } = product;
    return {
      ...rest,
      vectorEmbedding: vectorEmbedding !== null ? vector(vectorEmbedding) : null,
      searchEmbedding: searchEmbedding !== null ? vector(searchEmbedding) : null,
    };
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): Product {
    const data = snapshot.data();
    return validateProduct({
      ...data,
      vectorEmbedding: extractVector(data.vectorEmbedding),
      searchEmbedding: extractVector(data.searchEmbedding),
    });
  },
};
