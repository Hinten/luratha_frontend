import { type Firestore, collection, getDocs, limit as queryLimit, orderBy, query, where } from "firebase/firestore";
import {
  and,
  execute,
  field,
  or,
  type BooleanExpression,
  type PipelineSnapshot,
} from "firebase/firestore/pipelines";
import { buildProductSlug, type Product as FirestoreProduct, validateProduct } from "@/src/schemas/firestore";
import {
  buildCoreProductQueryPlan,
  buildEnterprisePipelineSearchPlan,
  buildEnterpriseVectorSearchPlan,
  shouldUsePipeline,
  type ProductSearchFilters,
  type ProductSort,
} from "@/src/lib/firestoreQueryStrategies";
import {
  ProductRepositoryError,
} from "@/src/lib/repositories/productsRepository";
import { createCategoriesRepository } from "@/src/lib/repositories/categoriesRepository";
import { createEmbeddingService, type EmbeddingService } from "@/src/lib/embeddingService";

export interface SearchOptions {
  useVectors?: boolean;
}

export interface ProductsSearchRepository {
  search(filters: ProductSearchFilters, options?: SearchOptions): Promise<FirestoreProduct[]>;
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
    const constraints = [];

    for (const clause of plan.where) {
      if (clause.field === "categorySlug" && typeof clause.value === "string") {
        const category = await categoriesRepository.getBySlug(clause.value);
        if (!category) {
          return [];
        }
        constraints.push(where("categoryId", "==", category.id));
        continue;
      }
      constraints.push(where(clause.field, clause.op, clause.value));
    }

    for (const sortBy of plan.orderBy) {
      constraints.push(orderBy(sortBy.field, sortBy.direction));
    }

    constraints.push(queryLimit(Math.min(plan.limit + plan.offset, 100)));

    const snapshot = await getDocs(query(collection(dbInstance, plan.collection), ...constraints));
    const docs = snapshot.docs.slice(plan.offset, plan.offset + plan.limit);
    return docs.map((entry) => normalizeSearchProduct(entry.data(), entry.id));
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
      const regex = escapeRegex(term.toLowerCase());
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

  async function search(
    filters: ProductSearchFilters,
    searchOptions: SearchOptions = {},
  ): Promise<FirestoreProduct[]> {
    let vectorError: unknown;
    let pipelineError: unknown;
    const useVectors = searchOptions.useVectors ?? false;

    if (useVectors && filters.term) {
      try {
        const embedding = await embeddingService.embed(filters.term);
        const vectorResults = await executeVectorSearch(embedding, filters);
        console.info("[productsSearchRepository] path=vector");
        return vectorResults;
      } catch (error) {
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

  return { search };
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
    createdAt?: string;
    updatedAt?: string;
  };

  try {
    return validateProduct({
      ...record,
      id: record.id ?? fallbackId,
    });
  } catch (validationError) {
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
    createdAt?: string;
    updatedAt?: string;
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
      createdAt: record.createdAt ?? now,
      updatedAt: record.updatedAt ?? now,
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
