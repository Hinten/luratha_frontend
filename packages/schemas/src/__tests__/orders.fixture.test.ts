import { describe, expect, it } from "vitest";
import { buildPendingOrderFixture } from "@luratha/schemas/__fixtures__/orders";

describe("buildPendingOrderFixture", () => {
  it("retorna um pedido pending_payment/PIX válido por padrão", () => {
    const order = buildPendingOrderFixture();
    expect(order.status).toBe("pending_payment");
    expect(order.paymentStatus).toBe("pending");
    expect(order.paymentMethod).toBe("pix");
    // o helper valida internamente; aqui confirmamos que o default não quebra
    // os invariantes (itemCount, lineTotal, grandTotal).
    expect(order.itemCount).toBe(1);
    expect(order.grandTotal).toBe(220);
  });

  it("aplica overrides nos campos relevantes", () => {
    const order = buildPendingOrderFixture({
      id: "order-xyz",
      paymentMethod: "boleto",
    });
    expect(order.id).toBe("order-xyz");
    expect(order.paymentMethod).toBe("boleto");
  });

  it("deriva shippingAddressPath do userId sobrescrito", () => {
    const order = buildPendingOrderFixture({ userId: "comprador-9876" });
    expect(order.userId).toBe("comprador-9876");
    expect(order.shippingAddressPath).toBe(
      "userProfiles/comprador-9876/addresses/addr-fixture-001",
    );
  });

  it("falha cedo quando um override quebra os invariantes do schema", () => {
    // subtotal alterado sem ajustar grandTotal viola o superRefine de orderSchema.
    expect(() => buildPendingOrderFixture({ subtotal: 500 })).toThrow();
  });
});
