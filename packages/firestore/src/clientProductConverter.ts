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
  Timestamp,
} from "firebase/firestore";
import { type Product, validateProduct } from "@luratha/schemas";

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

/**
 * Converts a Firestore Timestamp to an ISO-8601 string.
 * Falls through if the value is already a string (e.g. in unit tests).
 */
function extractTimestamp(val: unknown): string | unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return val;
}

export const clientProductConverter: FirestoreDataConverter<Product> = {
  toFirestore(product: Product) {
    const { vectorEmbedding, searchEmbedding, createdAt, updatedAt, ...rest } = product;
    return {
      ...rest,
      createdAt: Timestamp.fromDate(new Date(createdAt)),
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
      vectorEmbedding: vectorEmbedding !== null ? vector(vectorEmbedding) : null,
      searchEmbedding: searchEmbedding !== null ? vector(searchEmbedding) : null,
    };
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): Product {
    const data = snapshot.data();
    return validateProduct({
      ...data,
      createdAt: extractTimestamp(data.createdAt),
      updatedAt: extractTimestamp(data.updatedAt),
      vectorEmbedding: extractVector(data.vectorEmbedding),
      searchEmbedding: extractVector(data.searchEmbedding),
    });
  },
};
