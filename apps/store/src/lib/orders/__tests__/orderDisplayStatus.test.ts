import { describe, expect, it } from "vitest";
import { getOrderDisplayStatus } from "@/src/lib/orders/orderDisplayStatus";

describe("getOrderDisplayStatus", () => {
  it("estados de pagamento sobrepõem o status de fulfillment", () => {
    expect(getOrderDisplayStatus({ status: "paid", paymentStatus: "in_dispute" })).toMatchObject({
      label: "Em contestação",
      variant: "warning",
    });
    expect(
      getOrderDisplayStatus({ status: "refunded", paymentStatus: "charged_back" }),
    ).toMatchObject({ label: "Estornado" });
    expect(
      getOrderDisplayStatus({ status: "pending_payment", paymentStatus: "awaiting_pix" }),
    ).toMatchObject({ label: "Aguardando pagamento do PIX" });
    expect(
      getOrderDisplayStatus({ status: "pending_payment", paymentStatus: "awaiting_boleto" }),
    ).toMatchObject({ label: "Aguardando pagamento do boleto" });
    expect(
      getOrderDisplayStatus({ status: "paid", paymentStatus: "partially_refunded" }),
    ).toMatchObject({ label: "Reembolsado parcialmente" });
    expect(
      getOrderDisplayStatus({ status: "pending_payment", paymentStatus: "failed" }),
    ).toMatchObject({ label: "Pagamento recusado", variant: "error" });
  });

  it("unknown (fail-safe) → 'Em análise pela equipe técnica', nunca 'Pago'", () => {
    expect(getOrderDisplayStatus({ status: "unknown", paymentStatus: "unknown" })).toMatchObject({
      label: "Em análise pela equipe técnica",
      variant: "warning",
    });
    // Mesmo que o fulfillment fosse 'paid', o paymentStatus unknown sobrepõe.
    expect(getOrderDisplayStatus({ status: "paid", paymentStatus: "unknown" }).label).toBe(
      "Em análise pela equipe técnica",
    );
  });

  it("paid/pending/refunded → label vem do Order.status (fulfillment)", () => {
    expect(getOrderDisplayStatus({ status: "paid", paymentStatus: "paid" })).toMatchObject({
      label: "Pago",
    });
    expect(getOrderDisplayStatus({ status: "shipped", paymentStatus: "paid" })).toMatchObject({
      label: "Enviado",
    });
    expect(getOrderDisplayStatus({ status: "delivered", paymentStatus: "paid" })).toMatchObject({
      label: "Entregue",
      variant: "success",
    });
    expect(
      getOrderDisplayStatus({ status: "pending_payment", paymentStatus: "pending" }),
    ).toMatchObject({ label: "Aguardando pagamento" });
  });
});
