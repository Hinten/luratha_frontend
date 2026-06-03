/**
 * Firestore DataConverter for the Category model — admin SDK (firebase-admin/firestore).
 *
 * Usage:
 *   const categoryRef = adminDb
 *     .collection(firestoreCollections.categories)
 *     .doc(id)
 *     .withConverter(adminCategoryConverter);
 *
 *   await categoryRef.set(validatedCategory);   // writes plain Category fields
 *   const data = (await categoryRef.get()).data(); // returns a plain Category
 */

import { type FirestoreDataConverter } from "firebase-admin/firestore";
import { type Category, validateCategory, parseStrictWrite } from "@luratha/schemas";

export const adminCategoryConverter: FirestoreDataConverter<Category> = {
  toFirestore(category: Category) {
    return { ...parseStrictWrite(validateCategory, category) };
  },

  fromFirestore(snapshot) {
    const data = snapshot.data();
    return validateCategory({ ...data });
  },
};
