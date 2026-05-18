import { FirebaseError } from "firebase/app";
import {
  type Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as queryLimit,
  query,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { firestoreCollections, type FirestoreCategory, validateCategory } from "@/src/schemas/firestore";

type CategoryRepositoryErrorCode = "validation" | "unknown";

export class CategoryRepositoryError extends Error {
  readonly code: CategoryRepositoryErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: CategoryRepositoryErrorCode, cause?: unknown) {
    super(message);
    this.name = "CategoryRepositoryError";
    this.code = code;
    this.cause = cause;
  }
}

export interface CategoriesRepository {
  getById(id: string): Promise<FirestoreCategory | null>;
  getBySlug(slug: string): Promise<FirestoreCategory | null>;
}

export function createCategoriesRepository(dbInstance: Firestore): CategoriesRepository {
  const categoriesCollectionRef = collection(dbInstance, firestoreCollections.categories);

  async function getById(id: string): Promise<FirestoreCategory | null> {
    try {
      const categoryRef = doc(categoriesCollectionRef, id);
      const snapshot = await getDoc(categoryRef);

      if (!snapshot.exists()) {
        return null;
      }

      return validateCategory(snapshot.data());
    } catch (error) {
      throw normalizeRepositoryError(error, `read category "${id}"`);
    }
  }

  async function getBySlug(slug: string): Promise<FirestoreCategory | null> {
    try {
      const snapshot = await getDocs(
        query(categoriesCollectionRef, where("slug", "==", slug), queryLimit(1)),
      );

      if (snapshot.empty) {
        return null;
      }

      return validateCategory(snapshot.docs[0].data());
    } catch (error) {
      throw normalizeRepositoryError(error, `read category by slug "${slug}"`);
    }
  }

  return {
    getById,
    getBySlug,
  };
}

function normalizeRepositoryError(error: unknown, action: string): CategoryRepositoryError {
  if (error instanceof CategoryRepositoryError) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return new CategoryRepositoryError(
      `Validation failed while trying to ${action}`,
      "validation",
      error,
    );
  }

  if (error instanceof FirebaseError) {
    return new CategoryRepositoryError(`Failed to ${action}: ${error.message}`, "unknown", error);
  }

  if (error instanceof Error) {
    return new CategoryRepositoryError(`Failed to ${action}: ${error.message}`, "unknown", error);
  }

  return new CategoryRepositoryError(`Failed to ${action} due to an unknown error`, "unknown", error);
}
