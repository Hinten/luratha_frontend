import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import type { ProductSearchFilters, ProductSort } from "@/src/lib/firestoreQueryStrategies";
import {
  firestoreCollections,
  type FirestoreCategory,
  type Product as FirestoreProduct,
  validateCategory,
  validateProduct,
} from "@/src/schemas/firestore";

const MAX_QUERY_LIMIT = 100;

export async function listCategories(limit = 20): Promise<FirestoreCategory[]> {
  const snapshot = await adminDb
    .collection(firestoreCollections.categories)
    .orderBy("name", "asc")
    .limit(clampLimit(limit))
    .get();

  return snapshot.docs.map((document) => validateCategory(document.data()));
}

export async function getCategoryById(categoryId: string): Promise<FirestoreCategory | null> {
  const snapshot = await adminDb.collection(firestoreCollections.categories).doc(categoryId).get();

  if (!snapshot.exists) {
    return null;
  }

  return validateCategory(snapshot.data());
}

export async function getCategoryBySlug(slug: string): Promise<FirestoreCategory | null> {
  const snapshot = await adminDb
    .collection(firestoreCollections.categories)
    .where("slug", "==", slug)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return validateCategory(snapshot.docs[0].data());
}

export async function listActiveProducts(limit = 30): Promise<FirestoreProduct[]> {
  const snapshot = await adminDb
    .collection(firestoreCollections.products)
    .where("status", "==", "active")
    .orderBy("updatedAt", "desc")
    .limit(clampLimit(limit))
    .get();

  return snapshot.docs.map((document) => normalizeProduct(document.data(), document.id));
}

export async function getProductBySlug(slug: string): Promise<FirestoreProduct | null> {
  const snapshot = await adminDb
    .collection(firestoreCollections.products)
    .where("slug", "==", slug)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const document = snapshot.docs[0];
  return normalizeProduct(document.data(), document.id);
}

export async function searchProducts(filters: ProductSearchFilters): Promise<FirestoreProduct[]> {
  const limit = clampLimit(filters.limit ?? 24);
  const offset = Math.max(filters.offset ?? 0, 0);
  const categoryId = filters.categorySlug ? await resolveCategoryId(filters.categorySlug) : null;

  if (filters.categorySlug && !categoryId) {
    return [];
  }

  let query = adminDb.collection(firestoreCollections.products).where("status", "==", "active");

  if (categoryId) {
    query = query.where("categoryId", "==", categoryId);
  }
  if (filters.minPrice !== undefined) {
    query = query.where("price.price", ">=", filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    query = query.where("price.price", "<=", filters.maxPrice);
  }
  if (filters.tags?.length) {
    query = query.where("tags", "array-contains-any", filters.tags.slice(0, 10));
  }

  const { field, direction } = mapSort(filters.sort);
  const snapshot = await query
    .orderBy(field, direction)
    .limit(clampLimit(limit + offset))
    .get();

  const products = snapshot.docs
    .map((document) => normalizeProduct(document.data(), document.id))
    .slice(offset);

  const term = filters.term?.trim().toLowerCase();
  const filtered = term
    ? products.filter((product) => {
        const title = product.title.toLowerCase();
        const description = product.description.toLowerCase();
        return title.includes(term) || description.includes(term);
      })
    : products;

  return filtered.slice(0, limit);
}

function clampLimit(limit: number): number {
  return Math.max(1, Math.min(limit, MAX_QUERY_LIMIT));
}

function mapSort(sort?: ProductSort): { field: string; direction: "asc" | "desc" } {
  switch (sort) {
    case "price_asc":
      return { field: "price.price", direction: "asc" };
    case "price_desc":
      return { field: "price.price", direction: "desc" };
    case "rating_desc":
      return { field: "ratingAverage", direction: "desc" };
    case "newest":
    default:
      return { field: "updatedAt", direction: "desc" };
  }
}

async function resolveCategoryId(slug: string): Promise<string | null> {
  const category = await getCategoryBySlug(slug);
  return category?.id ?? null;
}

function normalizeProduct(input: unknown, fallbackId: string): FirestoreProduct {
  if (isRecord(input) && !("id" in input)) {
    return validateProduct({
      ...input,
      id: fallbackId,
    });
  }

  return validateProduct(input);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
