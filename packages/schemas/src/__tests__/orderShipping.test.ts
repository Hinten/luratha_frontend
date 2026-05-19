import { describe, expect, it } from "vitest";
import { validateOrder } from "@luratha/schemas";

function basePayload() {
  const now = new Date().toISOString();
  return {
    id: "order-1",
    userId: "user-shipping-test",
    orderNumber: "ORD-12345678",
    status: "shipped" as const,
    paymentMethod: "pix" as const,
    paymentStatus: "paid" as const,
    items: [
      {
        id: "item-1",
        productId: "p1",
        itemSku: "SKU-AB1234",
        name: "Vestido",
        photoId: "photo-1",
        quantity: 1,
        unitPrice: 200,
        lineTotal: 200,
        currency: "BRL" as const,
      },
    ],
    itemCount: 1,
    subtotal: 200,
    discountTotal: 0,
    shippingTotal: 20,
    grandTotal: 220,
    currency: "BRL" as const,
    shippingAddressPath: "userProfiles/uid-1/addresses/addr-1",
    createdAt: now,
    updatedAt: now,
  };
}

describe("order schema — shipping/tracking extension", () => {
  it("accepts optional shippingMethod snapshot", () => {
    const order = validateOrder({
      ...basePayload(),
      shippingMethod: {
        providerId: "melhor-envio",
        carrier: "Correios",
        service: "PAC",
        serviceCode: "1",
        price: 20,
        basePrice: 20,
        freeShippingApplied: false,
        estimatedDays: 7,
      },
    });
    expect(order.shippingMethod?.carrier).toBe("Correios");
  });

  it("accepts trackingCode + trackingUrl + shippedAt", () => {
    const order = validateOrder({
      ...basePayload(),
      trackingCode: "BR123456789",
      trackingUrl: "https://rastreamento.correios.com.br/app/index.php?objeto=BR123456789",
      shippedAt: new Date().toISOString(),
    });
    expect(order.trackingCode).toBe("BR123456789");
    expect(order.trackingUrl).toContain("BR123456789");
  });

  it("works without any shipping extension fields (back-compat)", () => {
    const order = validateOrder(basePayload());
    expect(order.shippingMethod).toBeUndefined();
    expect(order.trackingCode).toBeUndefined();
  });

  it("rejects invalid trackingUrl", () => {
    expect(() =>
      validateOrder({
        ...basePayload(),
        trackingUrl: "not-a-url",
      }),
    ).toThrow();
  });
});
