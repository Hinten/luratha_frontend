import { describe, expect, it } from "vitest";
import {
  buildCoreProductQueryPlan,
  buildEnterprisePipelineSearchPlan,
  buildEnterpriseVectorSearchPlan,
  shouldUsePipeline,
} from "@/src/lib/firestoreQueryStrategies";

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
      ]),
    );
    expect(plan.orderBy[0]).toEqual({ field: "priceMin", direction: "asc" });
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
});
