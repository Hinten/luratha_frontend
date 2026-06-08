import { pipelineSearchRequestSchema, vectorSearchRequestSchema } from "@luratha/schemas";
import { normalizeLimit, normalizeOffset } from "@luratha/core/firestoreQueryStrategies.utils";

export type ProductSort = "newest" | "price_asc" | "price_desc" | "rating_desc";

export interface ProductSearchFilters {
  term?: string;
  categorySlug?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
  sort?: ProductSort;
}

interface CoreQueryPlan {
  source: "core";
  collection: "products";
  where: Array<{
    field: string;
    op: "==" | ">=" | "<=" | "array-contains-any" | "array-contains";
    value: string | number | string[];
  }>;
  orderBy: Array<{ field: string; direction: "asc" | "desc" }>;
  limit: number;
  offset: number;
}

interface PipelineQueryPlan {
  source: "pipeline";
  collection: "products";
  stages: Array<{ name: string; details: Record<string, unknown> }>;
}

interface VectorPipelinePlan {
  source: "pipeline-vector";
  collection: "products";
  stages: Array<{ name: string; details: Record<string, unknown> }>;
}

export function buildCoreProductQueryPlan(filters: ProductSearchFilters): CoreQueryPlan {
  const limit = normalizeLimit(filters.limit);
  const offset = normalizeOffset(filters.offset);
  const sort = filters.sort ?? "newest";

  const orderByMap: Record<ProductSort, CoreQueryPlan["orderBy"]> = {
    newest: [{ field: "updatedAt", direction: "desc" }],
    price_asc: [{ field: "price.price", direction: "asc" }],
    price_desc: [{ field: "price.price", direction: "desc" }],
    rating_desc: [{ field: "ratingAverage", direction: "desc" }],
  };

  const where: CoreQueryPlan["where"] = [{ field: "status", op: "==", value: "active" }];

  if (filters.categorySlug) {
    where.push({ field: "categorySlug", op: "==", value: filters.categorySlug });
  }
  if (filters.minPrice !== undefined) {
    where.push({ field: "price.price", op: ">=", value: filters.minPrice });
  }
  if (filters.maxPrice !== undefined) {
    where.push({ field: "price.price", op: "<=", value: filters.maxPrice });
  }
  if (filters.tags?.length) {
    where.push({
      field: "tags",
      op: "array-contains-any",
      value: filters.tags.slice(0, 10),
    });
  }

  return {
    source: "core",
    collection: "products",
    where,
    orderBy: orderByMap[sort],
    limit,
    offset,
  };
}

export function buildEnterprisePipelineSearchPlan(
  filters: ProductSearchFilters,
): PipelineQueryPlan {
  const parsed = pipelineSearchRequestSchema.parse({
    term: filters.term ?? "moda feminina",
    categorySlug: filters.categorySlug,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    tags: filters.tags,
    limit: filters.limit ?? 24,
    offset: normalizeOffset(filters.offset),
  });

  return {
    source: "pipeline",
    collection: "products",
    stages: [
      {
        name: "where",
        details: {
          status: "active",
          categorySlug: parsed.categorySlug ?? null,
          minPrice: parsed.minPrice ?? null,
          maxPrice: parsed.maxPrice ?? null,
          tags: parsed.tags ?? [],
        },
      },
      {
        name: "add_fields",
        details: {
          term: parsed.term,
          normalizedName: "toLower(name)",
          normalizedDescription: "toLower(description)",
        },
      },
      {
        name: "where_expression",
        details: {
          expression:
            "regex_match(normalizedName, term) OR regex_match(normalizedDescription, term)",
        },
      },
      {
        name: "sort",
        details: {
          field: "ratingAverage",
          direction: "desc",
        },
      },
      {
        name: "select",
        details: {
          fields: [
            "id",
            "slug",
            "name",
            "priceMin",
            "priceMax",
            "currency",
            "primaryPhotoId",
            "ratingAverage",
            "reviewCount",
          ],
        },
      },
      {
        name: "paginate",
        details: {
          offset: parsed.offset,
          limit: parsed.limit,
        },
      },
    ],
  };
}

export function buildEnterpriseVectorSearchPlan(input: {
  embedding: number[];
  topK?: number;
  minScore?: number;
  categorySlug?: string;
}): VectorPipelinePlan {
  const parsed = vectorSearchRequestSchema.parse(input);

  return {
    source: "pipeline-vector",
    collection: "products",
    stages: [
      {
        name: "where",
        details: {
          status: "active",
          categorySlug: parsed.categorySlug ?? null,
        },
      },
      {
        name: "vector_search",
        details: {
          field: "searchEmbedding",
          metric: "cosine",
          topK: parsed.topK,
          minScore: parsed.minScore,
        },
      },
      {
        name: "select",
        details: {
          fields: [
            "id",
            "slug",
            "name",
            "priceMin",
            "priceMax",
            "currency",
            "primaryPhotoId",
            "ratingAverage",
            "reviewCount",
            "score",
          ],
        },
      },
    ],
  };
}

export function shouldUsePipeline(filters: ProductSearchFilters): boolean {
  const hasSearchTerm = (filters.term ?? "").trim().length > 0;
  const hasTooManyTags = (filters.tags?.length ?? 0) > 4;
  return hasSearchTerm || hasTooManyTags;
}
