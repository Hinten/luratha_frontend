import { FirebaseError } from "firebase/app";
import {
  type Firestore,
  VectorValue,
  Timestamp,
  collection,
  getDocs,
  limit as queryLimit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { z } from "zod";
import {
  and,
  arrayContains,
  equal,
  execute,
  field,
  or,
  type BooleanExpression,
  type PipelineSnapshot,
} from "firebase/firestore/pipelines";
import { buildProductSlug, type Product as FirestoreProduct, validateProduct } from "@luratha/schemas";
import {
  buildCoreProductQueryPlan,
  buildEnterprisePipelineSearchPlan,
  buildEnterpriseVectorSearchPlan,
  shouldUsePipeline,
  type ProductSearchFilters,
  type ProductSort,
} from "@luratha/core/firestoreQueryStrategies";
import {
  ProductRepositoryError,
} from "@/src/lib/repositories/productsRepository";
import { createCategoriesRepository } from "@/src/lib/repositories/categoriesRepository";
import {
  EmbeddingGenerationError,
  createEmbeddingService,
  type EmbeddingService,
} from "@luratha/core/embeddingService";

export interface SearchOptions {
  useVectors?: boolean;
}

export interface ProductsSearchRepository {
  search(filters: ProductSearchFilters, options?: SearchOptions): Promise<FirestoreProduct[]>;
  findByIdOrSku(term: string): Promise<FirestoreProduct | null>;
}

/**
 * The exact-match short-circuit only fires for single-token queries — once the
 * trimmed input contains internal whitespace, it is treated as a regular text
 * query and goes through the pipeline/core search instead.
 */
export function isExactMatchCandidate(term: string): boolean {
  const trimmed = term.trim();
  if (trimmed.length === 0) return false;
  return !/\s/.test(trimmed);
}

type CreateProductsSearchRepositoryOptions = {
  embeddingService?: EmbeddingService;
};

const DEFAULT_PRODUCT_SKU = "LURATHA_0000";
const DEFAULT_PRODUCT_TITLE = "Produto";
const UNKNOWN_CATEGORY_ID = "categoria-desconhecida";

export function createProductsSearchRepository(
  dbInstance: Firestore,
  options: CreateProductsSearchRepositoryOptions = {},
): ProductsSearchRepository {
  const categoriesRepository = createCategoriesRepository(dbInstance);
  const embeddingService = options.embeddingService ?? createEmbeddingService();

  async function executeCore(filters: ProductSearchFilters): Promise<FirestoreProduct[]> {
    const plan = buildCoreProductQueryPlan(filters);
    const baseConstraints = [];

    for (const clause of plan.where) {
      if (clause.field === "categorySlug" && typeof clause.value === "string") {
        const category = await categoriesRepository.getBySlug(clause.value);
        if (!category) {
          return [];
        }
        baseConstraints.push(where("categoryId", "==", category.id));
        continue;
      }
      baseConstraints.push(where(clause.field, clause.op, clause.value));
    }

    const orderedConstraints = [
      ...baseConstraints,
      ...plan.orderBy.map((sortBy) => orderBy(sortBy.field, sortBy.direction)),
      queryLimit(Math.min(plan.limit + plan.offset, 100)),
    ];

    try {
      const snapshot = await getDocs(
        query(collection(dbInstance, plan.collection), ...orderedConstraints),
      );
      const docs = snapshot.docs.slice(plan.offset, plan.offset + plan.limit);
      return docs.map((entry) => normalizeSearchProduct(entry.data(), entry.id));
    } catch (error) {
      // Firestore throws FAILED_PRECONDITION when an orderBy combined with the
      // existing equality filters needs a composite index that hasn't been
      // deployed. Fall back to an unordered query + in-memory sort/slice so the
      // page still renders products. The fast path returns once the index is
      // deployed.
      if (!isMissingIndexError(error)) {
        throw error;
      }

      const snapshot = await getDocs(
        query(collection(dbInstance, plan.collection), ...baseConstraints),
      );
      const products = snapshot.docs.map((entry) =>
        normalizeSearchProduct(entry.data(), entry.id),
      );
      const sorted = sortProductsInMemory(products, plan.orderBy);
      return sorted.slice(plan.offset, plan.offset + plan.limit);
    }
  }

  async function executePipelineSearch(filters: ProductSearchFilters): Promise<FirestoreProduct[]> {
    const plan = buildEnterprisePipelineSearchPlan(filters);
    let pipeline = dbInstance.pipeline().collection(plan.collection);
    let categoryId: string | null = null;

    if (filters.categorySlug) {
      const category = await categoriesRepository.getBySlug(filters.categorySlug);
      if (!category) {
        return [];
      }
      categoryId = category.id;
    }

    const pipelineFilters = [field("status").equal("active")];
    if (categoryId) {
      pipelineFilters.push(field("categoryId").equal(categoryId));
    }
    if (filters.minPrice !== undefined) {
      pipelineFilters.push(field("price.price").greaterThanOrEqual(filters.minPrice));
    }
    if (filters.maxPrice !== undefined) {
      pipelineFilters.push(field("price.price").lessThanOrEqual(filters.maxPrice));
    }
    if (filters.tags?.length) {
      pipelineFilters.push(field("tags").arrayContainsAny(filters.tags.slice(0, 10)));
    }

    pipeline = pipeline.where(combineWithAnd(pipelineFilters));

    const term = (filters.term ?? "").trim();
    if (term) {
      // Firestore pipeline regexMatch is anchored — the full lowercased field
      // value must match the pattern. Surround the user's escaped term with
      // `.*` so we get substring matching (the behavior real users expect).
      const regex = `.*${escapeRegex(term.toLowerCase())}.*`;
      pipeline = pipeline.where(
        or(
          field("title").toLower().regexMatch(regex),
          field("description").toLower().regexMatch(regex),
        ),
      );
    }

    pipeline = pipeline.sort(mapSortToPipelineOrdering(filters.sort));

    const limit = Math.min(Math.max(filters.limit ?? 24, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);

    pipeline = pipeline.offset(offset).limit(limit);

    const snapshot = await execute(pipeline);
    return mapPipelineSnapshotToProducts(snapshot);
  }

  async function executeVectorSearch(
    embedding: number[],
    filters: ProductSearchFilters,
  ): Promise<FirestoreProduct[]> {
    const vectorPlan = buildEnterpriseVectorSearchPlan({
      embedding,
      categorySlug: filters.categorySlug,
      topK: Math.min(Math.max(filters.limit ?? 20, 1), 100),
      minScore: 0,
    });

    let pipeline = dbInstance.pipeline().collection(vectorPlan.collection);
    let categoryId: string | null = null;

    if (filters.categorySlug) {
      const category = await categoriesRepository.getBySlug(filters.categorySlug);
      if (!category) {
        return [];
      }
      categoryId = category.id;
    }

    const pipelineFilters = [field("status").equal("active")];
    if (categoryId) {
      pipelineFilters.push(field("categoryId").equal(categoryId));
    }

    pipeline = pipeline
      .where(combineWithAnd(pipelineFilters))
      .findNearest({
        field: "searchEmbedding",
        vectorValue: embedding,
        distanceMeasure: "cosine",
        limit: vectorPlan.stages[1]?.details?.topK as number,
        distanceField: "score",
      });

    const snapshot = await execute(pipeline);
    return mapPipelineSnapshotToProducts(snapshot);
  }

  async function findByIdOrSku(term: string): Promise<FirestoreProduct | null> {
    const trimmed = term.trim();
    if (!isExactMatchCandidate(trimmed)) {
      return null;
    }

    const pipeline = dbInstance
      .pipeline()
      .collection("products")
      .where(
        or(
          equal(field("id"), trimmed),
          equal(field("sku"), trimmed),
          arrayContains(field("variantIds"), trimmed),
          arrayContains(field("variantSkus"), trimmed),
        ),
      )
      .limit(1);

    const snapshot = await execute(pipeline);
    const [first] = mapPipelineSnapshotToProducts(snapshot);
    return first ?? null;
  }

  async function search(
    filters: ProductSearchFilters,
    searchOptions: SearchOptions = {},
  ): Promise<FirestoreProduct[]> {
    let vectorError: unknown;
    let pipelineError: unknown;
    const useVectors = searchOptions.useVectors ?? false;

    // Single-token query → try ID/SKU/variant exact match before the full search.
    // Multi-token queries skip this short-circuit (handled by isExactMatchCandidate).
    const rawTerm = filters.term ?? "";
    if (isExactMatchCandidate(rawTerm)) {
      try {
        const exactMatch = await findByIdOrSku(rawTerm);
        if (exactMatch) {
          console.info("[productsSearchRepository] path=exact-match");
          return [exactMatch];
        }
      } catch (error) {
        // Fall back to the regular search on Firestore failures (missing index,
        // permission denied, network). Anything else propagates so we see it.
        if (!(error instanceof FirebaseError)) {
          throw error;
        }
        console.warn("[productsSearchRepository] exact-match lookup failed; falling back", error);
      }
    }

    if (useVectors && filters.term) {
      try {
        const embedding = await embeddingService.embed(filters.term);
        const vectorResults = await executeVectorSearch(embedding, filters);
        console.info("[productsSearchRepository] path=vector");
        return vectorResults;
      } catch (error) {
        // Vector search relies on `findNearest` + the searchEmbedding field.
        // Fall back to text search for Firestore errors (no embeddings, no
        // index) or embedding-service errors. Unknown errors propagate.
        if (!(error instanceof FirebaseError || error instanceof EmbeddingGenerationError)) {
          throw error;
        }
        vectorError = error;
        console.warn("[productsSearchRepository] vector fallback triggered", error);
      }
    }

    if (shouldUsePipeline(filters)) {
      try {
        const pipelineResults = await executePipelineSearch(filters);
        console.info("[productsSearchRepository] path=pipeline");
        return pipelineResults;
      } catch (error) {
        // Pipeline queries require the Enterprise tier. Fall back to a Core
        // query when the pipeline is unavailable, but only for Firestore
        // errors — unknown errors propagate.
        if (!(error instanceof FirebaseError)) {
          throw error;
        }
        pipelineError = error;
        console.warn("[productsSearchRepository] pipeline fallback triggered", error);
      }
    }

    try {
      const coreResults = await executeCore(filters);
      console.info("[productsSearchRepository] path=core");
      return coreResults;
    } catch (error) {
      throw normalizeSearchError(error, vectorError, pipelineError);
    }
  }

  return { search, findByIdOrSku };
}

function mapSortToPipelineOrdering(sort?: ProductSort) {
  switch (sort) {
    case "price_asc":
      return field("price.price").ascending();
    case "price_desc":
      return field("price.price").descending();
    case "rating_desc":
      return field("ratingAverage").descending();
    case "newest":
    default:
      return field("updatedAt").descending();
  }
}

function mapPipelineSnapshotToProducts(snapshot: PipelineSnapshot): FirestoreProduct[] {
  return snapshot.results.map((entry) => {
    return normalizeSearchProduct(entry.data(), entry.id ?? "");
  });
}

/**
 * Converts a Firestore Timestamp to an ISO-8601 string.
 * Falls through if the value is already a string (e.g. when stored without converter).
 * Returns undefined for null/undefined inputs so callers can apply a fallback with ??.
 */
function extractTimestamp(val: unknown): string | undefined {
  if (val === null || val === undefined) return undefined;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === "string") return val;
  return undefined;
}

function normalizeSearchProduct(
  input: unknown,
  fallbackId: string,
): FirestoreProduct {
  const record = (input ?? {}) as Partial<FirestoreProduct> & {
    id?: string;
    slug?: string | null;
    title?: string;
    categoryId?: string;
    price?: FirestoreProduct["price"];
    ratingAverage?: number | null;
    reviewCount?: number | null;
    sku?: string;
    brandName?: string;
    description?: string;
    status?: FirestoreProduct["status"];
    createdAt?: unknown;
    updatedAt?: unknown;
    vectorEmbedding?: unknown;
    searchEmbedding?: unknown;
  };

  try {
    return validateProduct({
      ...record,
      id: record.id ?? fallbackId,
      createdAt: extractTimestamp(record.createdAt),
      updatedAt: extractTimestamp(record.updatedAt),
      vectorEmbedding: record.vectorEmbedding instanceof VectorValue
        ? record.vectorEmbedding.toArray()
        : record.vectorEmbedding,
      searchEmbedding: record.searchEmbedding instanceof VectorValue
        ? record.searchEmbedding.toArray()
        : record.searchEmbedding,
    });
  } catch (err) {
    if (!(err instanceof z.ZodError)) {
      throw err;
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn("[productsSearchRepository] invalid search record, applying fallback mapping");
    }

    return createFallbackSearchProduct(record, fallbackId);
  }
}

function createFallbackSearchProduct(
  record: Partial<FirestoreProduct> & {
    id?: string;
    slug?: string | null;
    title?: string;
    categoryId?: string;
    price?: FirestoreProduct["price"];
    ratingAverage?: number | null;
    reviewCount?: number | null;
    sku?: string;
    brandName?: string;
    description?: string;
    status?: FirestoreProduct["status"];
    createdAt?: unknown;
    updatedAt?: unknown;
  },
  fallbackId: string,
): FirestoreProduct {
  const normalizedSku = record.sku?.trim();
  const normalizedTitle = record.title?.trim();
  const fallbackSku = normalizedSku && normalizedSku.length > 0 ? normalizedSku : DEFAULT_PRODUCT_SKU;
  const fallbackTitle =
    normalizedTitle && normalizedTitle.length > 0 ? normalizedTitle : DEFAULT_PRODUCT_TITLE;
  const now = new Date().toISOString();

  try {
    return validateProduct({
      id: record.id ?? fallbackId,
      slug: record.slug ?? buildProductSlug(fallbackTitle, fallbackSku),
      title: fallbackTitle,
      shortTitle: null,
      description: record.description ?? "",
      vectorEmbedding: null,
      searchEmbedding: null,
      sku: fallbackSku,
      gtin: null,
      mpn: null,
      status: record.status ?? "active",
      isPurchasable: true,
      brandName: record.brandName ?? "Luratha",
      categoryId: record.categoryId ?? UNKNOWN_CATEGORY_ID,
      googleProductCategoryId: null,
      tags: [],
      materialTags: [],
      seasonalTags: [],
      price: record.price ?? {
        price: 0,
        salePrice: null,
        priceMin: null,
        priceMax: null,
        currency: "BRL",
        startDate: null,
        endDate: null,
      },
      salePrice: null,
      condition: "new",
      adult: false,
      isBundle: false,
      multipack: 1,
      age_group: null,
      gender: null,
      color: null,
      size: null,
      sizeType: null,
      sizeSystem: null,
      material: [],
      pattern: [],
      dimensions: null,
      productDetail: null,
      productHighlight: null,
      photoAssets: [],
      lifeStylePhotos: [],
      videoUrls: [],
      ratingAverage: record.ratingAverage ?? null,
      reviewCount: record.reviewCount ?? null,
      totalStock: 0,
      variants: null,
      createdAt: extractTimestamp(record.createdAt) ?? now,
      updatedAt: extractTimestamp(record.updatedAt) ?? now,
    });
  } catch (error) {
    throw new ProductRepositoryError("Failed to normalize search fallback product", "validation", [
      error,
    ]);
  }
}

function normalizeSearchError(
  error: unknown,
  vectorError?: unknown,
  pipelineError?: unknown,
): ProductRepositoryError {
  if (error instanceof ProductRepositoryError) {
    return error;
  }

  const causes = [vectorError, pipelineError, error].filter(Boolean);
  return new ProductRepositoryError("Failed to search products", "unknown", causes);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isMissingIndexError(error: unknown): boolean {
  if (error instanceof FirebaseError && error.code === "failed-precondition") {
    return true;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("failed-precondition") ||
      message.includes("requires an index")
    );
  }
  return false;
}

function readNestedField(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === "object" && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, value);
}

function compareForSort(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function sortProductsInMemory(
  products: FirestoreProduct[],
  orderClauses: ReadonlyArray<{ field: string; direction: "asc" | "desc" }>,
): FirestoreProduct[] {
  if (orderClauses.length === 0) return products;
  return [...products].sort((left, right) => {
    for (const clause of orderClauses) {
      const cmp = compareForSort(
        readNestedField(left, clause.field),
        readNestedField(right, clause.field),
      );
      if (cmp !== 0) return clause.direction === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

function combineWithAnd(conditions: BooleanExpression[]): BooleanExpression {
  if (conditions.length === 0) {
    throw new Error("At least one pipeline condition is required.");
  }
  if (conditions.length === 1) {
    return conditions[0];
  }
  const [first, second, ...rest] = conditions;
  return and(first, second, ...rest);
}
