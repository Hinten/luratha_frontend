import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentProviderError } from "@/src/lib/payment/types";

const mp = vi.hoisted(() => ({ verifyWebhookSignature: vi.fn() }));
vi.mock("@/src/lib/payment/mercadoPago", () => ({
  verifyWebhookSignature: mp.verifyWebhookSignature,
}));

const service = vi.hoisted(() => ({ applyOrderWebhook: vi.fn() }));
vi.mock("@/src/lib/payment/service", () => ({
  applyOrderWebhook: service.applyOrderWebhook,
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

const orderEvent = {
  type: "order",
  action: "order.action_required",
  data: { id: "ORD01JQ4S4KY8HWQ6NA5PXB65B3D3" },
};

beforeEach(() => {
  mp.verifyWebhookSignature.mockReset();
  service.applyOrderWebhook.mockReset();
});

describe("POST /api/webhooks/mercadopago", () => {
  it("returns 401 when the signature is invalid", async () => {
    mp.verifyWebhookSignature.mockReturnValue(false);
    const res = await POST(webhookRequest(orderEvent));
    expect(res.status).toBe(401);
    expect(service.applyOrderWebhook).not.toHaveBeenCalled();
  });

  it("returns 200 without acting on non-order notifications", async () => {
    mp.verifyWebhookSignature.mockReturnValue(true);
    const res = await POST(webhookRequest({ type: "payment", data: { id: "1" } }));
    expect(res.status).toBe(200);
    expect(service.applyOrderWebhook).not.toHaveBeenCalled();
  });

  it("applies the order and returns 200 on a valid order event", async () => {
    mp.verifyWebhookSignature.mockReturnValue(true);
    service.applyOrderWebhook.mockResolvedValueOnce({
      changed: true,
      orderId: "order-1",
      status: "paid",
    });

    const res = await POST(webhookRequest(orderEvent));
    expect(res.status).toBe(200);
    expect(service.applyOrderWebhook).toHaveBeenCalledWith("ORD01JQ4S4KY8HWQ6NA5PXB65B3D3");
    const data = (await res.json()) as { received: boolean; status: string };
    expect(data.received).toBe(true);
    expect(data.status).toBe("paid");
  });

  it("returns 200 (ignored) when the order has no matching pedido", async () => {
    mp.verifyWebhookSignature.mockReturnValue(true);
    service.applyOrderWebhook.mockRejectedValueOnce(
      new PaymentProviderError("pedido inexistente", "invalid_input"),
    );

    const res = await POST(webhookRequest(orderEvent));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { ignored?: string };
    expect(data.ignored).toBeTruthy();
  });

  it("returns 500 so MercadoPago retries when the provider is unavailable", async () => {
    mp.verifyWebhookSignature.mockReturnValue(true);
    service.applyOrderWebhook.mockRejectedValueOnce(
      new PaymentProviderError("MercadoPago fora do ar", "provider_unavailable"),
    );

    const res = await POST(webhookRequest(orderEvent));
    expect(res.status).toBe(500);
  });

  it("returns 500 when the webhook secret is not configured", async () => {
    mp.verifyWebhookSignature.mockImplementation(() => {
      throw new PaymentProviderError("MERCADOPAGO_WEBHOOK_SECRET não configurado.", "config_missing");
    });

    const res = await POST(webhookRequest(orderEvent));
    expect(res.status).toBe(500);
  });
});
