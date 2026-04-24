/**
 * Server-only utilities for writing product documents via the firebase-admin SDK.
 *
 * Firestore Pipeline's findNearest requires vector fields to be stored as VectorValue
 * objects, not plain number[]. This module centralises the wrapping logic so that all
 * admin-SDK write paths (API route, seed route, etc.) behave consistently.
 */

import { FieldValue } from "firebase-admin/firestore";
import type { Product } from "@/src/schemas/firestore";

/**
 * Converts a validated Product into a plain object suitable for admin-SDK writes.
 * Non-null vectorEmbedding and searchEmbedding fields are wrapped as Firestore
 * VectorValue so that Pipeline findNearest queries can locate the documents.
 */
export function toAdminFirestoreDoc(product: Product): Record<string, unknown> {
  const { vectorEmbedding, searchEmbedding, ...rest } = product;
  return {
    ...rest,
    vectorEmbedding: vectorEmbedding !== null ? FieldValue.vector(vectorEmbedding) : null,
    searchEmbedding: searchEmbedding !== null ? FieldValue.vector(searchEmbedding) : null,
  };
}
