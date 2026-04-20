import { expect, it } from "vitest";
import { buildEnterpriseVectorSearchPlan } from "@/src/lib/firestoreQueryStrategies";
import { createCloudTestPrefix, describeCloud } from "@/src/test/cloud/sharedSetup";

describeCloud("Cloud vector search", () => {
  it("builds a vector pipeline plan with score projection", () => {
    const suffix = createCloudTestPrefix().length;
    const embedding = Array.from({ length: 8 }, (_, index) => (index + suffix % 3) / 10);

    const plan = buildEnterpriseVectorSearchPlan({
      embedding,
      topK: 5,
      minScore: 0.2,
    });

    expect(plan.source).toBe("pipeline-vector");
    expect(plan.stages.some((stage) => stage.name === "vector_search")).toBe(true);
  });
});
