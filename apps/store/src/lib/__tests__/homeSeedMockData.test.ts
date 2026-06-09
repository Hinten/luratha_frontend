import { describe, it, expect } from "vitest";
import {
  buildHomeSeedCategories,
  buildHomeSeedProducts,
  buildHomeSeedStock,
} from "@luratha/repositories/homeSeedMockData";
import { validateProduct } from "@luratha/schemas";

describe("home seed mock data", () => {
  it("creates ten mock categories", () => {
    const categories = buildHomeSeedCategories();

    expect(categories).toHaveLength(10);
    expect(categories[0].slug).toBe("vestidos");
  });

  it("creates fifteen valid products linked to seeded categories", () => {
    const categories = buildHomeSeedCategories();
    const products = buildHomeSeedProducts(categories);

    expect(products).toHaveLength(15);
    expect(products.every((product) => typeof product.categoryId === "string")).toBe(true);
    expect(products.every((product) => product.slug)).toBe(true);
    expect(products.every((product) => (product.vectorEmbedding?.length ?? 0) >= 8)).toBe(true);
    expect(products.every((product) => (product.searchEmbedding?.length ?? 0) >= 8)).toBe(true);
  });

  it("includes products with size variants", () => {
    const products = buildHomeSeedProducts();
    const variantProducts = products.filter((p) => p.variants && p.variants.length > 0);
    expect(variantProducts.length).toBeGreaterThanOrEqual(3);
    const vestidoFesta = products.find((p) => p.id === "prod_home_11");
    expect(vestidoFesta?.variants).toHaveLength(4);
    expect(vestidoFesta?.variants?.[0].size).toEqual(["PP"]);
  });

  it("populates product-level color on simple products", () => {
    const products = buildHomeSeedProducts();
    const simpleProducts = products.filter((p) => !p.variants);
    expect(simpleProducts.length).toBeGreaterThan(0);
    expect(simpleProducts.every((p) => Array.isArray(p.color) && p.color.length > 0)).toBe(true);
  });

  it("populates color on every variant of variant products", () => {
    const products = buildHomeSeedProducts();
    const variantProducts = products.filter((p) => p.variants && p.variants.length > 0);
    expect(variantProducts.length).toBeGreaterThan(0);
    for (const product of variantProducts) {
      expect(product.variants?.every((v) => Array.isArray(v.color) && v.color.length > 0)).toBe(
        true,
      );
    }
  });

  it("supports color-differentiated variants on Saia Plissada Colorida", () => {
    const products = buildHomeSeedProducts();
    const saia = products.find((p) => p.id === "prod_home_15");
    const variantColors = saia?.variants?.flatMap((v) => v.color ?? []) ?? [];
    expect(new Set(variantColors).size).toBe(4);
  });

  it("includes at least one out-of-stock product", () => {
    const products = buildHomeSeedProducts();
    const outOfStock = products.filter((p) => p.totalStock === 0);
    expect(outOfStock.length).toBeGreaterThanOrEqual(1);
  });

  it("includes at least one low-stock product (1–3 units)", () => {
    const products = buildHomeSeedProducts();
    const lowStock = products.filter((p) => p.totalStock > 0 && p.totalStock <= 3);
    expect(lowStock.length).toBeGreaterThanOrEqual(1);
  });

  it("creates stock documents for all products", () => {
    const products = buildHomeSeedProducts();
    const stocks = buildHomeSeedStock(products);
    expect(stocks).toHaveLength(products.length);
  });

  it("creates variant stock for products that have variants", () => {
    const products = buildHomeSeedProducts();
    const stocks = buildHomeSeedStock(products);

    const vestidoFestaStock = stocks.find((s) => s.productId === "prod_home_11");
    expect(vestidoFestaStock?.hasVariants).toBe(true);
    expect(vestidoFestaStock?.variants).not.toBeNull();
    expect(vestidoFestaStock?.quantity).toBe(9);
    const variantSum = Object.values(vestidoFestaStock?.variants ?? {}).reduce((a, b) => a + b, 0);
    expect(variantSum).toBe(vestidoFestaStock?.quantity);
  });

  it("creates simple stock for products without variants", () => {
    const products = buildHomeSeedProducts();
    const stocks = buildHomeSeedStock(products);

    const simpleStock = stocks.find((s) => s.productId === "prod_home_01");
    expect(simpleStock?.hasVariants).toBe(false);
    expect(simpleStock?.variants).toBeNull();
  });

  it("populates denormalized variantIds and variantSkus on products with variants", () => {
    const products = buildHomeSeedProducts();
    const variantProducts = products.filter((p) => p.variants && p.variants.length > 0);
    expect(variantProducts.length).toBeGreaterThan(0);
    for (const product of variantProducts) {
      expect(product.variantIds).toEqual(product.variants?.map((v) => v.id));
      expect(product.variantSkus).toEqual(product.variants?.map((v) => v.sku));
    }
  });

  it("re-validates after re-namespacing id/sku/variants (the cloud-test flow)", () => {
    // Mirrors what `seedMockDataSearch.cloud.test.ts` does in beforeAll.
    // Catches schema regressions (skuSchema casing, slug superRefine, etc.)
    // without needing live Firestore.
    const prefix = "__test_1234567890_abcdef12"; // worst-case lowercase hex
    const skuPrefix = prefix.replace(/[^A-Za-z0-9_-]/g, "_").toUpperCase();
    const products = buildHomeSeedProducts();
    const variantProduct = products.find((p) => p.id === "prod_home_11");
    expect(variantProduct).toBeDefined();

    const namespaced = {
      ...variantProduct!,
      id: `${variantProduct!.id}__${prefix}`,
      slug: null, // force schema to regenerate from new title+sku
      sku: `${variantProduct!.sku}_${skuPrefix}`,
      categoryId: `${variantProduct!.categoryId}__${prefix}`,
      variants:
        variantProduct!.variants?.map((v) => ({
          ...v,
          id: `${v.id}__${prefix}`,
          sku: `${v.sku}_${skuPrefix}`,
        })) ?? null,
    };

    const revalidated = validateProduct(namespaced);
    expect(revalidated.id).toBe(`prod_home_11__${prefix}`);
    expect(revalidated.sku).toBe(`LURATHA_1011_${skuPrefix}`);
    // Schema should have regenerated slug + denormalized arrays for the new ids/skus.
    expect(revalidated.slug).toContain("vestido-festa-tecido-nobre");
    expect(revalidated.variantIds).toEqual(revalidated.variants?.map((v) => v.id));
    expect(revalidated.variantSkus).toEqual(revalidated.variants?.map((v) => v.sku));
  });

  it("creates zero-quantity stock for out-of-stock products", () => {
    const products = buildHomeSeedProducts();
    const stocks = buildHomeSeedStock(products);

    const outOfStockDoc = stocks.find((s) => s.productId === "prod_home_13");
    expect(outOfStockDoc?.quantity).toBe(0);
    expect(outOfStockDoc?.hasVariants).toBe(false);
  });
});
