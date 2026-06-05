import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  assertNoDroppedKeys,
  parseStrictWrite,
  mergeForWrite,
  validateCartItem,
  validateProduct,
} from "@luratha/schemas";

describe("assertNoDroppedKeys", () => {
  it("throws a ZodError (unrecognized_keys) when a caller key was dropped", () => {
    const input = { id: "x", bogus: 1, alsoBogus: 2 };
    const parsed = { id: "x" };
    const run = () => assertNoDroppedKeys(input, parsed);
    expect(run).toThrow(z.ZodError);

    let issue: z.core.$ZodIssue | undefined;
    try {
      run();
    } catch (err) {
      if (err instanceof z.ZodError) {
        issue = err.issues[0];
      } else {
        throw err;
      }
    }
    expect(issue?.code).toBe("unrecognized_keys");
    expect((issue as { keys: string[] }).keys).toEqual(["bogus", "alsoBogus"]);
  });

  it("does not throw when every caller key survived the parse", () => {
    expect(() => assertNoDroppedKeys({ a: 1, b: 2 }, { a: 1, b: 2 })).not.toThrow();
  });

  it("never flags keys the parse ADDED (transforms / defaults)", () => {
    // input lacks `slug`; output adds it — must not be reported as dropped.
    expect(() => assertNoDroppedKeys({ a: 1 }, { a: 1, slug: "added" })).not.toThrow();
  });

  it("ignores non-object inputs (arrays, null, primitives)", () => {
    expect(() => assertNoDroppedKeys(null, { a: 1 })).not.toThrow();
    expect(() => assertNoDroppedKeys([1, 2], { 0: 1 })).not.toThrow();
    expect(() => assertNoDroppedKeys("str", {})).not.toThrow();
  });

  it("uses own-property checks (Object.hasOwn), not the `in` operator", () => {
    const input: Record<string, unknown> = { legacyKey: 1 };
    // `legacyKey` exists only on the OUTPUT's prototype, not as an own key.
    // `"legacyKey" in parsed` would be true (masking the drop), but
    // Object.hasOwn(parsed, "legacyKey") is false — so a supplied own key that
    // the parse dropped must still be flagged.
    const parsed = Object.create({ legacyKey: "inherited" }) as Record<string, unknown>;
    expect("legacyKey" in parsed).toBe(true);
    expect(Object.hasOwn(parsed, "legacyKey")).toBe(false);
    expect(() => assertNoDroppedKeys(input, parsed)).toThrow(z.ZodError);
  });
});

describe("parseStrictWrite", () => {
  function baseItem() {
    const now = new Date().toISOString();
    return {
      id: "prod-1",
      userId: "user-strict",
      productId: "prod-1",
      variantSku: "SKU-ABC123",
      productSlug: "vestido-linho",
      name: "Vestido Linho",
      photoId: "photo-1",
      imageUrl: "https://example.com/img.webp",
      unitPrice: 200,
      quantity: 1,
      currency: "BRL" as const,
      addedAt: now,
      updatedAt: now,
    };
  }

  it("returns the parsed value for a clean payload", () => {
    const item = parseStrictWrite(validateCartItem, baseItem());
    expect(item.dimensions).toBeNull(); // default applied
    expect(item.id).toBe("prod-1");
  });

  it("rejects an unknown top-level field that strip would have dropped", () => {
    expect(() =>
      parseStrictWrite(validateCartItem, { ...baseItem(), notARealField: true }),
    ).toThrow(z.ZodError);
  });

  it("accepts a re-parse of a product carrying transform-added denormalized keys", () => {
    const now = new Date().toISOString();
    const product = validateProduct({
      id: "prod_strict",
      title: "Vestido Strict",
      description: "Peça de teste para enforcement de schema.",
      sku: "SKU-STRICT-1",
      status: "active",
      categoryId: "cat_test",
      price: { price: 200, currency: "BRL" },
      createdAt: now,
      updatedAt: now,
    });
    // `product` now carries transform-added keys (slug, variantIds, variantSkus,
    // vectorEmbedding). Re-running strict write must NOT flag them as unknown.
    expect(() => parseStrictWrite(validateProduct, product)).not.toThrow();
    const reparsed = parseStrictWrite(validateProduct, product);
    expect(reparsed.slug).toBe(product.slug);
    expect(reparsed.variantIds).toEqual([]);
  });
});

describe("mergeForWrite", () => {
  it("applies merge order existing < patch < serverFields", () => {
    const merged = mergeForWrite({ a: 1, b: 2, c: 3 }, { b: 20 }, { c: 30 });
    expect(merged).toEqual({ a: 1, b: 20, c: 30 });
  });

  it("treats an undefined patch value as absent (existing unchanged), keeps null", () => {
    const merged = mergeForWrite(
      { keep: "v", clear: "old", untouched: "old" },
      { clear: null, untouched: undefined },
    );
    // `untouched: undefined` must NOT delete the existing field; `clear: null`
    // stores null. The result never carries an `undefined` value.
    expect(merged).toEqual({ keep: "v", clear: null, untouched: "old" });
    expect(Object.values(merged).includes(undefined)).toBe(false);
  });

  it("does not inject schema defaults (pure shallow merge)", () => {
    const merged = mergeForWrite({ a: 1 }, {});
    expect(merged).toEqual({ a: 1 });
  });
});
