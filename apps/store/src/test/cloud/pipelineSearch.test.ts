import { expect, it } from "vitest";
import {
  buildEnterprisePipelineSearchPlan,
  shouldUsePipeline,
} from "@/src/lib/firestoreQueryStrategies";
import { createCloudTestPrefix, describeCloud } from "@/src/test/cloud/sharedSetup";

describeCloud("Cloud pipeline search – plan validation", () => {
  it("builds an enterprise textual pipeline plan with correct stages", () => {
    const plan = buildEnterprisePipelineSearchPlan({
      term: `vestido ${createCloudTestPrefix()}`,
      tags: ["linho", "festa"],
      limit: 10,
    });

    expect(plan.source).toBe("pipeline");
    expect(plan.collection).toBe("products");
    expect(plan.stages.some((stage) => stage.name === "where_expression")).toBe(true);
    expect(plan.stages.some((stage) => stage.name === "where")).toBe(true);
    expect(plan.stages.some((stage) => stage.name === "paginate")).toBe(true);
  });

  it("shouldUsePipeline returns true when term is present", () => {
    expect(shouldUsePipeline({ term: "vestido" })).toBe(true);
  });

  it("shouldUsePipeline returns true when more than 4 tags are present", () => {
    expect(shouldUsePipeline({ tags: ["a", "b", "c", "d", "e"] })).toBe(true);
  });

  it("shouldUsePipeline returns false for price-only filters (uses core path)", () => {
    expect(shouldUsePipeline({ minPrice: 100, maxPrice: 400 })).toBe(false);
    expect(shouldUsePipeline({ categorySlug: "vestidos" })).toBe(false);
    expect(shouldUsePipeline({})).toBe(false);
  });

  it("pipeline plan includes category filter when categorySlug is provided", () => {
    const plan = buildEnterprisePipelineSearchPlan({
      term: "vestido",
      categorySlug: "vestidos",
      limit: 12,
    });

    const whereStage = plan.stages.find((stage) => stage.name === "where");
    expect(whereStage?.details).toMatchObject({ categorySlug: "vestidos" });
  });

  it("pipeline plan applies price range when provided", () => {
    const plan = buildEnterprisePipelineSearchPlan({
      term: "blusa",
      minPrice: 100,
      maxPrice: 300,
      limit: 10,
    });

    const whereStage = plan.stages.find((stage) => stage.name === "where");
    expect(whereStage?.details).toMatchObject({ minPrice: 100, maxPrice: 300 });
  });

  it("pipeline plan respects pagination limits", () => {
    const plan = buildEnterprisePipelineSearchPlan({ term: "linho", limit: 5, offset: 10 });
    const paginateStage = plan.stages.find((stage) => stage.name === "paginate");
    expect(paginateStage?.details).toMatchObject({ limit: 5, offset: 10 });
  });
});
