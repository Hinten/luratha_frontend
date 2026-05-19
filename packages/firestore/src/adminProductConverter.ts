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

import { type FirestoreDataConverter, FieldValue, Timestamp } from "firebase-admin/firestore";
import { type Product, validateProduct } from "@luratha/schemas";

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

/**
 * Converts a Firestore Timestamp (or any object with .toDate()) to an ISO-8601 string.
 * Falls through if the value is already a string (e.g. in unit tests).
 */
function extractTimestamp(val: unknown): string | unknown {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (
    typeof val === "object" &&
    val !== null &&
    "toDate" in val &&
    typeof (val as { toDate: unknown }).toDate === "function"
  ) {
    return (val as { toDate(): Date }).toDate().toISOString();
  }
  return val;
}

export const adminProductConverter: FirestoreDataConverter<Product> = {
  toFirestore(product: Product) {
    const { vectorEmbedding, searchEmbedding, createdAt, updatedAt, ...rest } = product;
    return {
      ...rest,
      createdAt: Timestamp.fromDate(new Date(createdAt)),
      updatedAt: Timestamp.fromDate(new Date(updatedAt)),
      vectorEmbedding: vectorEmbedding !== null ? FieldValue.vector(vectorEmbedding) : null,
      searchEmbedding: searchEmbedding !== null ? FieldValue.vector(searchEmbedding) : null,
    };
  },

  fromFirestore(snapshot) {
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
