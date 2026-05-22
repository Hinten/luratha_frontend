import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentProviderError } from "@/src/lib/payment/types";

const mp = vi.hoisted(() => ({ verifyWebhookSignature: vi.fn() }));
vi.mock("@/src/lib/payment/mercadoPago", () => ({
  verifyWebhookSignature: mp.verifyWebhookSignature,
}));

const service = vi.hoisted(() => ({ applyPaymentWebhook: vi.fn() }));
vi.mock("@/src/lib/payment/service", () => ({
  applyPaymentWebhook: service.applyPaymentWebhook,
}));

import { POST } from "@/src/app/api/webhooks/mercadopago/route";

function webhookRequest(body: unknown): Request {
  return new Request("http://localhost/api/webhooks/mercadopago", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-signature": "ts=1,v1=abc",
      "x-request-id": "req-1",
    },
    body: JSON.stringify(body),
  });
}

const paymentEvent = { type: "payment", action: "payment.updated", data: { id: "987654321" } };

beforeEach(() => {
  mp.verifyWebhookSignature.mockReset();
  service.applyPaymentWebhook.mockReset();
});

describe("POST /api/webhooks/mercadopago", () => {
  it("returns 401 when the signature is invalid", async () => {
    mp.verifyWebhookSignature.mockReturnValue(false);
    const res = await POST(webhookRequest(paymentEvent));
    expect(res.status).toBe(401);
    expect(service.applyPaymentWebhook).not.toHaveBeenCalled();
  });

  it("returns 200 without acting on non-payment notifications", async () => {
    mp.verifyWebhookSignature.mockReturnValue(true);
    const res = await POST(webhookRequest({ type: "plan", data: { id: "1" } }));
    expect(res.status).toBe(200);
    expect(service.applyPaymentWebhook).not.toHaveBeenCalled();
  });

  it("applies the payment and returns 200 on a valid payment event", async () => {
    mp.verifyWebhookSignature.mockReturnValue(true);
    service.applyPaymentWebhook.mockResolvedValueOnce({
      changed: true,
      orderId: "order-1",
      status: "paid",
    });

    const res = await POST(webhookRequest(paymentEvent));
    expect(res.status).toBe(200);
    expect(service.applyPaymentWebhook).toHaveBeenCalledWith("987654321");
    const data = (await res.json()) as { received: boolean; status: string };
    expect(data.received).toBe(true);
    expect(data.status).toBe("paid");
  });

  it("returns 200 (ignored) when the payment has no matching order", async () => {
    mp.verifyWebhookSignature.mockReturnValue(true);
    service.applyPaymentWebhook.mockRejectedValueOnce(
      new PaymentProviderError("pedido inexistente", "invalid_input"),
    );

    const res = await POST(webhookRequest(paymentEvent));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ignored?: string };
    expect(data.ignored).toBeTruthy();
  });

  it("returns 500 so MercadoPago retries when the provider is unavailable", async () => {
    mp.verifyWebhookSignature.mockReturnValue(true);
    service.applyPaymentWebhook.mockRejectedValueOnce(
      new PaymentProviderError("MercadoPago fora do ar", "provider_unavailable"),
    );

    const res = await POST(webhookRequest(paymentEvent));
    expect(res.status).toBe(500);
  });

  it("returns 500 when the webhook secret is not configured", async () => {
    mp.verifyWebhookSignature.mockImplementation(() => {
      throw new PaymentProviderError("MERCADOPAGO_WEBHOOK_SECRET não configurado.", "config_missing");
    });

    const res = await POST(webhookRequest(paymentEvent));
    expect(res.status).toBe(500);
  });
});
