import { describe, expect, it } from "vitest";
import { buildStatusPatch } from "../orderStatusPatch";

describe("buildStatusPatch", () => {
  it("paid → status paid + paidAt (usa approvedAt quando dado)", () => {
    expect(buildStatusPatch("paid", "2026-06-01T12:00:00.000Z")).toEqual({
      paymentStatus: "paid",
      status: "paid",
      paidAt: "2026-06-01T12:00:00.000Z",
    });
  });

  it("paid sem approvedAt → paidAt = agora (ISO string)", () => {
    const patch = buildStatusPatch("paid");
    expect(patch.status).toBe("paid");
    expect(typeof patch.paidAt).toBe("string");
  });

  it("refunded e charged_back → Order.status 'refunded'", () => {
    expect(buildStatusPatch("refunded")).toEqual({ paymentStatus: "refunded", status: "refunded" });
    expect(buildStatusPatch("charged_back")).toEqual({
      paymentStatus: "charged_back",
      status: "refunded",
    });
  });

  it("unknown → fail-safe: status E paymentStatus 'unknown' (não vira 'pago', não despachável)", () => {
    expect(buildStatusPatch("unknown")).toEqual({ paymentStatus: "unknown", status: "unknown" });
  });

  it("unknown rebaixa o fulfillment enquanto o pedido é despachável", () => {
    // Cenário do user: pedido `paid` (ainda não enviado) recebe um status novo
    // que na verdade é cancelamento → tem que travar o despacho.
    for (const current of ["pending_payment", "paid", "processing", "unknown"] as const) {
      expect(buildStatusPatch("unknown", undefined, current)).toEqual({
        paymentStatus: "unknown",
        status: "unknown",
      });
    }
  });

  it("unknown NÃO sobrescreve Order.status de pedido já enviado/entregue/terminal", () => {
    // Pós-despacho, rebaixar pra `unknown` só apagaria o histórico sem prevenir
    // nada. Só o paymentStatus muda; o `getOrderDisplayStatus` ainda mostra
    // "Em análise" via override de pagamento.
    for (const current of ["shipped", "delivered", "cancelled", "refunded"] as const) {
      expect(buildStatusPatch("unknown", undefined, current)).toEqual({
        paymentStatus: "unknown",
      });
    }
  });

  it("estados que não mudam o fulfillment → só paymentStatus (Order.status preservado pelo merge)", () => {
    const noStatusChange = [
      "pending",
      "awaiting_pix",
      "awaiting_boleto",
      "authorized",
      "partially_refunded",
      "in_dispute",
      "failed",
    ] as const;
    for (const status of noStatusChange) {
      expect(buildStatusPatch(status)).toEqual({ paymentStatus: status });
    }
  });
});
