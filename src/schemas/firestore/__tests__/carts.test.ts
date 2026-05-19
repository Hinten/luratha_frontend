import { describe, expect, it } from "vitest";
import { validateCartItem } from "@/src/schemas/firestore";

function baseItem() {
  const now = new Date().toISOString();
  return {
    id: "prod-1",
    userId: "user-cart-test",
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

describe("cartItemSchema — dimensions snapshot", () => {
  it("defaults dimensions to null when omitted", () => {
    const item = validateCartItem(baseItem());
    expect(item.dimensions).toBeNull();
  });

  it("accepts a dimensions snapshot copied from the product", () => {
    const item = validateCartItem({
      ...baseItem(),
      dimensions: {
        length: 20,
        width: 15,
        height: 5,
        unit: "cm",
        weightKg: 0.4,
        weightGrossKg: 0.5,
      },
    });
    expect(item.dimensions?.weightKg).toBe(0.4);
    expect(item.dimensions?.length).toBe(20);
  });

  it("rejects a dimensions snapshot with a non-positive measure", () => {
    expect(() =>
      validateCartItem({
        ...baseItem(),
        dimensions: { length: 0, width: 15, height: 5, unit: "cm" },
      }),
    ).toThrow();
  });
});
