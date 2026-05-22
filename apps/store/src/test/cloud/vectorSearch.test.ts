import { expect, it } from "vitest";
import { buildEnterpriseVectorSearchPlan } from "@luratha/core/firestoreQueryStrategies";
import { createCloudTestPrefix, describeCloud } from "@/src/test/cloud/sharedSetup";

describeCloud("Cloud vector search – plan validation", () => {
  it("builds a vector pipeline plan with score projection", () => {
    const suffix = createCloudTestPrefix().length;
    const embedding = Array.from({ length: 8 }, (_, index) => (index + (suffix % 3)) / 10);

    const plan = buildEnterpriseVectorSearchPlan({
      embedding,
      topK: 5,
      minScore: 0.2,
    });

    expect(plan.source).toBe("pipeline-vector");
    expect(plan.collection).toBe("products");
    expect(plan.stages.some((stage) => stage.name === "vector_search")).toBe(true);
  });

  it("vector plan includes score field in select stage", () => {
    const embedding = Array.from({ length: 8 }, (_, i) => i / 10);
    const plan = buildEnterpriseVectorSearchPlan({ embedding, topK: 10 });

    const selectStage = plan.stages.find((stage) => stage.name === "select");
    expect(selectStage?.details?.fields).toContain("score");
  });

  it("vector plan includes category filter when categorySlug is provided", () => {
    const embedding = Array.from({ length: 8 }, (_, i) => i / 10);
    const plan = buildEnterpriseVectorSearchPlan({
      embedding,
      topK: 5,
      categorySlug: "vestidos",
    });

    const whereStage = plan.stages.find((stage) => stage.name === "where");
    expect(whereStage?.details).toMatchObject({ categorySlug: "vestidos" });
  });

  it("vector plan uses searchEmbedding field with cosine metric", () => {
    const embedding = Array.from({ length: 8 }, (_, i) => i / 10);
    const plan = buildEnterpriseVectorSearchPlan({ embedding, topK: 5 });

    const vectorStage = plan.stages.find((stage) => stage.name === "vector_search");
    expect(vectorStage?.details?.field).toBe("searchEmbedding");
    expect(vectorStage?.details?.metric).toBe("cosine");
  });
});
