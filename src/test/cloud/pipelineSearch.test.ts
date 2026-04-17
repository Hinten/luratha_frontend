import { expect, it } from "vitest";
import {
  buildEnterprisePipelineSearchPlan,
  shouldUsePipeline,
} from "@/src/lib/firestoreQueryStrategies";
import { createCloudTestPrefix, describeCloud } from "@/src/test/cloud/sharedSetup";

describeCloud("Cloud pipeline search", () => {
  it("builds an enterprise textual pipeline plan for seeded cloud data", () => {
    const plan = buildEnterprisePipelineSearchPlan({
      term: `vestido ${createCloudTestPrefix()}`,
      tags: ["linho", "festa"],
      limit: 10,
    });

    expect(plan.source).toBe("pipeline");
    expect(plan.stages.some((stage) => stage.name === "where_expression")).toBe(true);
    expect(shouldUsePipeline({ term: "vestido" })).toBe(true);
  });
});
