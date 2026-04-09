import { describe, it, expect } from "vitest";
import { mockProducts } from "@/src/lib/mockData";
import { CATEGORIES } from "@/src/lib/constants";

describe("mockProducts", () => {
  it("exports an array of products", () => {
    expect(Array.isArray(mockProducts)).toBe(true);
    expect(mockProducts.length).toBeGreaterThan(0);
  });

  it("every product has required fields", () => {
    mockProducts.forEach((p) => {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("price");
      expect(p).toHaveProperty("imageUrl");
      expect(p).toHaveProperty("categorySlug");
    });
  });

  it("every product has a valid categorySlug that matches CATEGORIES", () => {
    const validSlugs = CATEGORIES.map((c) => c.slug);
    mockProducts.forEach((p) => {
      expect(validSlugs).toContain(p.categorySlug);
    });
  });

  it("every product id is unique", () => {
    const ids = mockProducts.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("all prices are positive numbers", () => {
    mockProducts.forEach((p) => {
      expect(p.price).toBeGreaterThan(0);
    });
  });

  it("sale products have originalPrice greater than price", () => {
    const saleProducts = mockProducts.filter((p) => p.originalPrice !== undefined);
    expect(saleProducts.length).toBeGreaterThan(0);
    saleProducts.forEach((p) => {
      expect(p.originalPrice!).toBeGreaterThan(p.price);
    });
  });

  it("has products in all categories", () => {
    CATEGORIES.forEach(({ slug }) => {
      const inCategory = mockProducts.filter((p) => p.categorySlug === slug);
      expect(inCategory.length).toBeGreaterThan(0);
    });
  });
});
