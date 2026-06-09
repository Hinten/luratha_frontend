import { describe, expect, it } from "vitest";
import { assessFeedQuality } from "@/src/lib/feed/feedQuality";
import type { FeedProduct } from "@/src/lib/feed/googleMerchantFeed";

function makeProduct(overrides: Partial<FeedProduct> = {}): FeedProduct {
  return {
    id: "prod-1",
    slug: "vestido-azul-sku123",
    title: "Vestido Azul",
    description: "Vestido de algodão",
    sku: "SKU123",
    gtin: null,
    brandName: "Luratha",
    googleProductCategoryId: null,
    condition: "new",
    price: 129.9,
    salePrice: null,
    saleStartDate: null,
    saleEndDate: null,
    currency: "BRL",
    totalStock: 5,
    adult: false,
    isBundle: false,
    multipack: 1,
    ageGroup: null,
    gender: null,
    colors: [],
    sizes: [],
    sizeType: null,
    sizeSystem: null,
    material: [],
    pattern: [],
    weightKg: null,
    productHighlights: [],
    productDetails: [],
    seasonalTags: [],
    photos: [{ id: "ph1", url: "https://cdn.example.com/ph1.webp" }],
    variants: null,
    ...overrides,
  };
}

describe("assessFeedQuality", () => {
  it("returns zero coverage for an empty catalog without crashing", () => {
    const report = assessFeedQuality([]);
    expect(report.totalItems).toBe(0);
    expect(report.required.id.fillRate).toBe(0);
    expect(report.missingRequired).toEqual([]);
  });

  it("reports full required coverage for a complete product", () => {
    const report = assessFeedQuality([makeProduct()]);
    expect(report.totalItems).toBe(1);
    expect(report.required.image_link.fillRate).toBe(1);
    expect(report.required.description.fillRate).toBe(1);
    expect(report.missingRequired).toEqual([]);
  });

  it("flags products missing required attributes", () => {
    const report = assessFeedQuality([makeProduct({ photos: [], description: "" })]);
    expect(report.required.image_link.fillRate).toBe(0);
    expect(report.required.description.present).toBe(0);
    expect(report.missingRequired).toHaveLength(1);
    expect(report.missingRequired[0].id).toBe("prod-1");
    expect(report.missingRequired[0].fields).toEqual(
      expect.arrayContaining(["description", "image_link"]),
    );
  });

  it("computes recommended fill-rate across the catalog", () => {
    const report = assessFeedQuality([
      makeProduct({ id: "a", gtin: "7891234567890" }),
      makeProduct({ id: "b", gtin: null }),
    ]);
    expect(report.totalItems).toBe(2);
    expect(report.recommended.gtin.present).toBe(1);
    expect(report.recommended.gtin.fillRate).toBe(0.5);
  });

  it("counts variant-level color/size as covering the recommended attribute", () => {
    const report = assessFeedQuality([
      makeProduct({
        colors: [],
        sizes: [],
        variants: [
          { sku: "VAR-A", gtin: null, colors: ["Azul"], sizes: ["P"], photoIds: [], active: true },
        ],
      }),
    ]);
    expect(report.recommended.color.fillRate).toBe(1);
    expect(report.recommended.size.fillRate).toBe(1);
  });
});
