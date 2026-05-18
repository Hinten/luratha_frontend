import { describe, expect, it } from "vitest";
import {
  buildCoreProductQueryPlan,
  buildEnterprisePipelineSearchPlan,
  buildEnterpriseVectorSearchPlan,
  shouldUsePipeline,
} from "@/src/lib/firestoreQueryStrategies";
import {
  buildHomeSeedCategories,
  buildHomeSeedProducts,
} from "@/src/lib/repositories/homeSeedMockData";

describe("firestore query strategies", () => {
  it("builds core query plan with default active filter", () => {
    const plan = buildCoreProductQueryPlan({
      categorySlug: "vestidos",
      minPrice: 100,
      maxPrice: 500,
      sort: "price_asc",
    });

    expect(plan.source).toBe("core");
    expect(plan.where).toEqual(
      expect.arrayContaining([
        { field: "status", op: "==", value: "active" },
        { field: "categorySlug", op: "==", value: "vestidos" },
        { field: "price.price", op: ">=", value: 100 },
        { field: "price.price", op: "<=", value: 500 },
      ]),
    );
    expect(plan.orderBy[0]).toEqual({ field: "price.price", direction: "asc" });
  });

  it("uses updatedAt for newest sort to match the product schema", () => {
    const plan = buildCoreProductQueryPlan({ categorySlug: "vestidos", sort: "newest" });
    expect(plan.orderBy).toEqual([{ field: "updatedAt", direction: "desc" }]);
  });

  it("caps tag filter to Firestore array-contains-any limit", () => {
    const plan = buildCoreProductQueryPlan({
      tags: Array.from({ length: 15 }, (_, index) => `tag-${index}`),
    });

    const tagFilter = plan.where.find((entry) => entry.field === "tags");
    expect(tagFilter).toBeDefined();
    expect((tagFilter?.value as string[]).length).toBe(10);
  });

  it("builds enterprise pipeline search plan with projection", () => {
    const plan = buildEnterprisePipelineSearchPlan({
      term: "vestido de linho",
      categorySlug: "vestidos",
      limit: 12,
    });

    expect(plan.source).toBe("pipeline");
    expect(plan.stages.map((stage) => stage.name)).toEqual(
      expect.arrayContaining(["where", "where_expression", "select", "paginate"]),
    );
  });

  it("builds enterprise vector search plan", () => {
    const plan = buildEnterpriseVectorSearchPlan({
      embedding: [0.1, 0.5, 0.8, 0.2, 0.4, 0.9, 0.7, 0.6],
      topK: 10,
      minScore: 0.3,
    });

    expect(plan.source).toBe("pipeline-vector");
    expect(plan.stages[1]).toMatchObject({
      name: "vector_search",
      details: { field: "searchEmbedding", topK: 10, minScore: 0.3 },
    });
  });

  it("recommends pipeline for full text and large tag searches", () => {
    expect(shouldUsePipeline({ term: "vestido artesanal" })).toBe(true);
    expect(shouldUsePipeline({ tags: Array.from({ length: 5 }, () => "linho") })).toBe(
      true,
    );
    expect(shouldUsePipeline({ categorySlug: "vestidos", tags: ["linho"] })).toBe(false);
  });

  it("validates vector dimensions with enterprise request limit", () => {
    expect(() =>
      buildEnterpriseVectorSearchPlan({
        embedding: Array.from({ length: 2049 }, () => 0.2),
      }),
    ).toThrow();
  });

  // Regression: in Firestore, `orderBy` on a missing field excludes documents.
  // If the core query plan referenced a field the schema/seed do not write
  // (e.g. `publishedAt`), the categoria/[slug] page would render zero products.
  describe("core query plan field paths exist on seed products", () => {
    const categories = buildHomeSeedCategories();
    const products = buildHomeSeedProducts(categories);

    function readPath(value: unknown, path: string): unknown {
      return path.split(".").reduce<unknown>((acc, segment) => {
        if (acc && typeof acc === "object" && segment in (acc as Record<string, unknown>)) {
          return (acc as Record<string, unknown>)[segment];
        }
        return undefined;
      }, value);
    }

    it.each(["newest", "price_asc", "price_desc", "rating_desc"] as const)(
      "every seed product has the orderBy field for sort=%s",
      (sort) => {
        const plan = buildCoreProductQueryPlan({ sort });
        for (const orderClause of plan.orderBy) {
          for (const product of products) {
            expect(
              readPath(product, orderClause.field),
              `product ${product.id} is missing orderBy field "${orderClause.field}"`,
            ).toBeDefined();
          }
        }
      },
    );

    it("every seed product has the price.price field used by min/max filters", () => {
      const plan = buildCoreProductQueryPlan({ minPrice: 100, maxPrice: 500 });
      const priceFilters = plan.where.filter((clause) =>
        clause.field === "price.price" || clause.field === "priceMin",
      );
      expect(priceFilters.length).toBeGreaterThan(0);
      for (const filter of priceFilters) {
        for (const product of products) {
          expect(
            readPath(product, filter.field),
            `product ${product.id} is missing filter field "${filter.field}"`,
          ).toBeTypeOf("number");
        }
      }
    });
  });
});
