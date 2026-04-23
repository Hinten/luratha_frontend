import { FirebaseError } from "firebase/app";
import {
  type Firestore,
  type QueryConstraint,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as queryLimit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  where,
} from "firebase/firestore";
import { z } from "zod";
import { firestoreCollections, type Product, validateProduct } from "@/src/schemas/firestore";

type ProductListFilters = {
  status?: Product["status"];
  categoryId?: string;
  limit?: number;
};

type ProductUpdateInput = Partial<Omit<Product, "id" | "createdAt">>;

type ProductRepositoryErrorCode = "validation" | "not_found" | "conflict" | "unknown";

export class ProductRepositoryError extends Error {
  readonly code: ProductRepositoryErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: ProductRepositoryErrorCode, cause?: unknown) {
    super(message);
    this.name = "ProductRepositoryError";
    this.code = code;
    this.cause = cause;
  }
}

export interface ProductsRepository {
  create(input: unknown): Promise<Product>;
  getById(id: string): Promise<Product | null>;
  getBySlug(slug: string): Promise<Product | null>;
  update(id: string, patch: ProductUpdateInput): Promise<Product>;
  delete(id: string): Promise<void>;
  list(filters?: ProductListFilters): Promise<Product[]>;
  seedMockProducts(products: unknown[]): Promise<Product[]>;
}

const MAX_LIST_LIMIT = 100;

export function createProductsRepository(dbInstance: Firestore): ProductsRepository {
  const productsCollectionRef = collection(dbInstance, firestoreCollections.products);

  async function create(input: unknown): Promise<Product> {
    try {
      const parsed = validateProduct(input);
      const productRef = doc(productsCollectionRef, parsed.id);

      await runTransaction(dbInstance, async (transaction) => {
        const existing = await transaction.get(productRef);
        if (existing.exists()) {
          throw new ProductRepositoryError(
            `Product with id "${parsed.id}" already exists`,
            "conflict",
          );
        }
        transaction.set(productRef, parsed);
      });

      return parsed;
    } catch (error) {
      throw normalizeRepositoryError(error, "create product");
    }
  }

  async function getById(id: string): Promise<Product | null> {
    try {
      const productRef = doc(productsCollectionRef, id);
      const snapshot = await getDoc(productRef);

      if (!snapshot.exists()) {
        return null;
      }

      return validateProduct(snapshot.data());
    } catch (error) {
      throw normalizeRepositoryError(error, `read product "${id}"`);
    }
  }

  async function getBySlug(slug: string): Promise<Product | null> {
    try {

      const snapshot = await getDocs(
        query(productsCollectionRef, where("slug", "==", slug), queryLimit(1)),
      );

      if (snapshot.empty) {
        return null;
      }
      

      return validateProduct(snapshot.docs[0].data());
    } catch (error) {
      throw normalizeRepositoryError(error, `read product by slug "${slug}"`);
    }
  }

  async function update(id: string, patch: ProductUpdateInput): Promise<Product> {
    try {
      const productRef = doc(productsCollectionRef, id);
      const snapshot = await getDoc(productRef);

      if (!snapshot.exists()) {
        throw new ProductRepositoryError(`Product "${id}" was not found`, "not_found");
      }

      const current = validateProduct(snapshot.data());
      const merged = validateProduct({
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      });

      await setDoc(productRef, merged);
      return merged;
    } catch (error) {
      throw normalizeRepositoryError(error, `update product "${id}"`);
    }
  }

  async function remove(id: string): Promise<void> {
    try {
      const productRef = doc(productsCollectionRef, id);
      const snapshot = await getDoc(productRef);
      if (!snapshot.exists()) {
        throw new ProductRepositoryError(`Product "${id}" was not found`, "not_found");
      }

      await deleteDoc(productRef);
    } catch (error) {
      throw normalizeRepositoryError(error, `delete product "${id}"`);
    }
  }

  async function list(filters: ProductListFilters = {}): Promise<Product[]> {
    try {
      const constraints: QueryConstraint[] = [orderBy("updatedAt", "desc")];

      if (filters.status) {
        constraints.push(where("status", "==", filters.status));
      }
      if (filters.categoryId) {
        constraints.push(where("categoryId", "==", filters.categoryId));
      }

      const normalizedLimit = Math.max(1, Math.min(filters.limit ?? 24, MAX_LIST_LIMIT));
      constraints.push(queryLimit(normalizedLimit));

      const snapshot = await getDocs(query(productsCollectionRef, ...constraints));
      return snapshot.docs.map((entry) => validateProduct(entry.data()));
    } catch (error) {
      throw normalizeRepositoryError(error, "list products");
    }
  }

  async function seedMockProducts(products: unknown[]): Promise<Product[]> {
    return Promise.all(products.map((candidate) => create(candidate)));
  }

  return {
    create,
    getById,
    getBySlug,
    update,
    delete: remove,
    list,
    seedMockProducts,
  };
}

function normalizeRepositoryError(error: unknown, action: string): ProductRepositoryError {
  if (error instanceof ProductRepositoryError) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return new ProductRepositoryError(
      `Validation failed while trying to ${action}`,
      "validation",
      error,
    );
  }

  if (error instanceof FirebaseError && error.code === "already-exists") {
    return new ProductRepositoryError(`Failed to ${action}: document already exists`, "conflict", error);
  }

  if (error instanceof FirebaseError && error.code === "not-found") {
    return new ProductRepositoryError(`Failed to ${action}: document not found`, "not_found", error);
  }

  if (error instanceof Error) {
    return new ProductRepositoryError(`Failed to ${action}: ${error.message}`, "unknown", error);
  }

  return new ProductRepositoryError(`Failed to ${action} due to an unknown error`, "unknown", error);
}
