import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type { Order } from "@luratha/schemas";
import { PaymentProviderError } from "@luratha/payments";

const auth = vi.hoisted(() => ({
  state: { current: null as { uid: string; email: string | null; isAdmin: boolean } | null },
}));

function mockAuthedUser(uid: string | null) {
  auth.state.current = uid ? { uid, email: `${uid}@test.luratha`, isAdmin: false } : null;
}

vi.mock("@luratha/auth/requireUser", () => {
  class AuthError extends Error {
    constructor(
      public readonly status: 401 | 403,
      message: string,
    ) {
      super(message);
      this.name = "AuthError";
    }
  }
  return {
    AuthError,
    requireUser: async () => {
      if (!auth.state.current) throw new AuthError(401, "Não autenticado.");
      return auth.state.current;
    },
    authErrorResponse: (err: unknown) =>
      err instanceof AuthError
        ? NextResponse.json({ message: err.message }, { status: err.status })
        : null,
  };
});

const service = vi.hoisted(() => ({
  loadOrder: vi.fn(),
  getOrderArtifacts: vi.fn(),
}));

vi.mock("@luratha/payments", async () => {
  const actual = await vi.importActual<typeof import("@luratha/payments")>("@luratha/payments");
  return {
    ...actual,
    loadOrder: service.loadOrder,
    getOrderArtifacts: service.getOrderArtifacts,
  };
});

import { GET } from "@/src/app/api/checkout/payment-intent/route";

const USER_ID = "user-poll-001";

function fakeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-001",
    userId: USER_ID,
    paymentMethod: "pix",
    paymentStatus: "pending",
    paymentIntentId: "ORD-mp-1",
    grandTotal: 220,
    orderNumber: "ORD-12345678",
    ...overrides,
  } as Order;
}

function getRequest(orderId?: string): Request {
  const url = orderId
    ? `http://localhost/api/checkout/payment-intent?orderId=${encodeURIComponent(orderId)}`
    : "http://localhost/api/checkout/payment-intent";
  return new Request(url, { method: "GET" });
}

beforeEach(() => {
  mockAuthedUser(USER_ID);
  service.loadOrder.mockReset();
  service.getOrderArtifacts.mockReset();
});

afterEach(() => {
  mockAuthedUser(null);
});

describe("GET /api/checkout/payment-intent", () => {
  it("returns 401 when there is no session", async () => {
    mockAuthedUser(null);
    const res = await GET(getRequest("order-001"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when orderId is missing", async () => {
    const res = await GET(getRequest());
    expect(res.status).toBe(400);
  });

  it("returns 404 when the order does not exist", async () => {
    service.loadOrder.mockResolvedValueOnce(null);
    const res = await GET(getRequest("order-001"));
    expect(res.status).toBe(404);
  });

  it("returns 403 when the order belongs to another user", async () => {
    service.loadOrder.mockResolvedValueOnce(fakeOrder({ userId: "someone-else" }));
    const res = await GET(getRequest("order-001"));
    expect(res.status).toBe(403);
  });

  it("returns { status: 'paid' } without hitting the provider when already paid", async () => {
    service.loadOrder.mockResolvedValueOnce(fakeOrder({ paymentStatus: "paid" }));
    const res = await GET(getRequest("order-001"));
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("paid");
    expect(service.getOrderArtifacts).not.toHaveBeenCalled();
  });

  it("returns 409 when the order has no paymentIntentId yet", async () => {
    service.loadOrder.mockResolvedValueOnce(fakeOrder({ paymentIntentId: undefined }));
    const res = await GET(getRequest("order-001"));
    expect(res.status).toBe(409);
  });

  it("returns 200 with the pix artifact when ready", async () => {
    service.loadOrder.mockResolvedValueOnce(fakeOrder());
    service.getOrderArtifacts.mockResolvedValueOnce({
      status: "pending",
      pix: { qrCode: "qr", qrCodeBase64: "qr64" },
    });
    const res = await GET(getRequest("order-001"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { pix?: { qrCode: string } };
    expect(data.pix?.qrCode).toBe("qr");
    expect(service.getOrderArtifacts).toHaveBeenCalledWith("ORD-mp-1");
  });

  it("returns 200 with only the status while the artifact is still pending", async () => {
    service.loadOrder.mockResolvedValueOnce(fakeOrder());
    service.getOrderArtifacts.mockResolvedValueOnce({ status: "pending" });
    const res = await GET(getRequest("order-001"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { status: string; pix?: unknown };
    expect(data.status).toBe("pending");
    expect(data.pix).toBeUndefined();
  });

  it("returns 502 when the provider rejects the payment", async () => {
    service.loadOrder.mockResolvedValueOnce(fakeOrder());
    service.getOrderArtifacts.mockRejectedValueOnce(
      new PaymentProviderError("MercadoPago recusou o pagamento.", "provider_unavailable"),
    );
    const res = await GET(getRequest("order-001"));
    expect(res.status).toBe(502);
  });
});
