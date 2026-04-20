import { describe, it, expect } from "vitest";
import { buildHomeSeedCategories, buildHomeSeedProducts } from "@/src/lib/repositories/homeSeedMockData";

describe("home seed mock data", () => {
  it("creates ten mock categories", () => {
    const categories = buildHomeSeedCategories();

    expect(categories).toHaveLength(10);
    expect(categories[0].slug).toBe("vestidos");
  });

  it("creates ten valid products linked to seeded categories", () => {
    const categories = buildHomeSeedCategories();
    const products = buildHomeSeedProducts(categories);

    expect(products).toHaveLength(10);
    expect(products.every((product) => typeof product.categoryId === "string")).toBe(true);
    expect(products.every((product) => product.slug)).toBe(true);
    expect(products.every((product) => (product.vectorEmbedding?.length ?? 0) >= 8)).toBe(true);
    expect(products.every((product) => (product.searchEmbedding?.length ?? 0) >= 8)).toBe(true);
  });
});
