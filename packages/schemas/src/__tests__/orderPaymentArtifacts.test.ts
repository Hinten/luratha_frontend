import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateOrder } from "@luratha/schemas";

function basePayload() {
  const now = new Date().toISOString();
  return {
    id: "order-1",
    userId: "user-payment-test",
    orderNumber: "ORD-12345678",
    status: "pending_payment" as const,
    paymentMethod: "pix" as const,
    paymentStatus: "pending" as const,
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

describe("order schema — payment artifacts (PIX/boleto)", () => {
  it("accepts a paymentPix block with qrCode, qrCodeBase64 and expiresAt", () => {
    const order = validateOrder({
      ...basePayload(),
      paymentPix: {
        qrCode: "00020126580014BR.GOV.BCB.PIX...",
        qrCodeBase64: "BASE64DATA",
        expiresAt: "2026-05-29T12:00:00.000Z",
      },
    });
    expect(order.paymentPix?.qrCode).toContain("BR.GOV.BCB.PIX");
    expect(order.paymentPix?.qrCodeBase64).toBe("BASE64DATA");
    expect(order.paymentPix?.expiresAt).toBe("2026-05-29T12:00:00.000Z");
  });

  it("accepts a paymentPix block without expiresAt (provider may omit it)", () => {
    const order = validateOrder({
      ...basePayload(),
      paymentPix: { qrCode: "qr", qrCodeBase64: "qr64" },
    });
    expect(order.paymentPix?.expiresAt).toBeUndefined();
  });

  it("accepts a paymentBoleto block with url + optional fields", () => {
    const order = validateOrder({
      ...basePayload(),
      paymentMethod: "boleto" as const,
      paymentBoleto: {
        url: "https://mp.example.com/boleto.pdf",
        digitableLine: "34191.79001 01043.510047 91020.150008 4 96510000010000",
        barcode: "34199651000001000017900010435100479102015000",
        expiresAt: "2026-06-02T00:00:00.000Z",
      },
    });
    expect(order.paymentBoleto?.url).toContain("boleto.pdf");
    expect(order.paymentBoleto?.digitableLine).toContain("34191");
  });

  it("works without any payment artifacts (back-compat)", () => {
    const order = validateOrder(basePayload());
    expect(order.paymentPix).toBeUndefined();
    expect(order.paymentBoleto).toBeUndefined();
  });

  it("rejects a paymentPix with an invalid expiresAt", () => {
    try {
      validateOrder({
        ...basePayload(),
        paymentPix: { qrCode: "qr", qrCodeBase64: "qr64", expiresAt: "not-a-date" },
      });
      expect.unreachable("expected validateOrder to throw a ZodError");
    } catch (err) {
      if (err instanceof z.ZodError) {
        expect(err.issues.some((i) => i.path.includes("expiresAt"))).toBe(true);
        return;
      }
      throw err;
    }
  });

  it("rejects a paymentBoleto with an invalid url", () => {
    try {
      validateOrder({
        ...basePayload(),
        paymentMethod: "boleto" as const,
        paymentBoleto: { url: "not-a-url" },
      });
      expect.unreachable("expected validateOrder to throw a ZodError");
    } catch (err) {
      if (err instanceof z.ZodError) {
        expect(err.issues.some((i) => i.path.includes("url"))).toBe(true);
        return;
      }
      throw err;
    }
  });
});
