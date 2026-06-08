import { describe, it, expect } from "vitest";
import { metadata } from "@/src/app/checkout/layout";

describe("checkout layout (SEO)", () => {
  it("marks the transactional flow as noindex, nofollow", () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("keeps a descriptive, branded title", () => {
    const title = typeof metadata.title === "string" ? metadata.title : "";
    expect(title).toContain("Checkout");
    expect(title).toContain("Luratha");
  });
});
