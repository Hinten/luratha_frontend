import { describe, it, expect } from "vitest";
import { validateStock } from "@luratha/schemas/stock";

const now = "2026-04-26T18:00:00.000Z";

const validSimpleStock = {
  productId: "prod_123",
  sku: "LURATHA_001",
  quantity: 10,
  hasVariants: false,
  variants: null,
  updatedAt: now,
};

const validVariantStock = {
  productId: "prod_456",
  sku: "LURATHA_002",
  quantity: 15,
  hasVariants: true,
  variants: {
    var_002_p: 5,
    var_002_m: 7,
    var_002_gg: 3,
  },
  updatedAt: now,
};

describe("stockSchema", () => {
  describe("simple product (no variants)", () => {
    it("parses a valid simple stock document", () => {
      const result = validateStock(validSimpleStock);
      expect(result.productId).toBe("prod_123");
      expect(result.quantity).toBe(10);
      expect(result.hasVariants).toBe(false);
      expect(result.variants).toBeNull();
    });

    it("rejects when variants is provided but hasVariants is false", () => {
      expect(() =>
        validateStock({
          ...validSimpleStock,
          variants: { var_001_p: 5 },
        }),
      ).toThrow();
    });

    it("rejects negative quantity", () => {
      expect(() => validateStock({ ...validSimpleStock, quantity: -1 })).toThrow();
    });

    it("accepts zero quantity (out of stock)", () => {
      const result = validateStock({ ...validSimpleStock, quantity: 0 });
      expect(result.quantity).toBe(0);
    });
  });

  describe("variable product (with variants)", () => {
    it("parses a valid variant stock document", () => {
      const result = validateStock(validVariantStock);
      expect(result.productId).toBe("prod_456");
      expect(result.quantity).toBe(15);
      expect(result.hasVariants).toBe(true);
      expect(result.variants).toEqual({
        var_002_p: 5,
        var_002_m: 7,
        var_002_gg: 3,
      });
    });

    it("rejects when hasVariants is true but variants is null", () => {
      expect(() =>
        validateStock({
          ...validVariantStock,
          variants: null,
        }),
      ).toThrow();
    });

    it("rejects when quantity does not equal the sum of variant quantities", () => {
      expect(() =>
        validateStock({
          ...validVariantStock,
          quantity: 20, // actual sum is 15
        }),
      ).toThrow();
    });

    it("accepts all variants with zero quantity (fully out of stock)", () => {
      const result = validateStock({
        productId: "prod_789",
        sku: "LURATHA_003",
        quantity: 0,
        hasVariants: true,
        variants: {
          var_003_p: 0,
          var_003_m: 0,
        },
        updatedAt: now,
      });
      expect(result.quantity).toBe(0);
    });

    it("rejects negative variant quantities", () => {
      expect(() =>
        validateStock({
          ...validVariantStock,
          variants: { var_002_p: -1, var_002_m: 7, var_002_gg: 9 },
          quantity: 15,
        }),
      ).toThrow();
    });
  });

  describe("field validation", () => {
    it("rejects missing productId", () => {
      const rest = { ...validSimpleStock };
      delete (rest as Partial<typeof validSimpleStock>).productId;
      expect(() => validateStock(rest)).toThrow();
    });

    it("rejects invalid SKU format", () => {
      expect(() => validateStock({ ...validSimpleStock, sku: "invalid sku!" })).toThrow();
    });

    it("rejects invalid updatedAt timestamp", () => {
      expect(() => validateStock({ ...validSimpleStock, updatedAt: "not-a-date" })).toThrow();
    });
  });
});
