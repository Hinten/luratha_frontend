/**
 * Firestore DataConverter for the Category model — client SDK (firebase/firestore).
 *
 * Category carries no Timestamp or vector fields, so there is no field coercion;
 * the converter exists to enforce the schema on write (unknown top-level fields
 * are rejected) and validate on read, mirroring `adminCategoryConverter`.
 */

import { type FirestoreDataConverter, type QueryDocumentSnapshot } from "firebase/firestore";
import { type Category, validateCategory, parseStrictWrite } from "@luratha/schemas";

export const clientCategoryConverter: FirestoreDataConverter<Category> = {
  toFirestore(category: Category) {
    return { ...parseStrictWrite(validateCategory, category) };
  },

  fromFirestore(snapshot: QueryDocumentSnapshot): Category {
    return validateCategory({ ...snapshot.data() });
  },
};
