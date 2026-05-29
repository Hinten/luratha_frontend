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
  createPaymentIntent: vi.fn(),
}));

vi.mock("@luratha/payments", async () => {
  const actual = await vi.importActual<typeof import("@luratha/payments")>("@luratha/payments");
  return {
    ...actual,
    loadOrder: service.loadOrder,
    createPaymentIntent: service.createPaymentIntent,
  };
});

import { POST } from "@/src/app/api/checkout/payment-intent/route";

const USER_ID = "user-payment-001";

function fakeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-001",
    userId: USER_ID,
    paymentMethod: "pix",
    paymentStatus: "pending",
    grandTotal: 220,
    orderNumber: "ORD-12345678",
    ...overrides,
  } as Order;
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/checkout/payment-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validPixBody = {
  paymentMethod: "pix",
  orderId: "order-001",
  payer: { email: "comprador@teste.com", identification: { type: "CPF", number: "12345678909" } },
};

beforeEach(() => {
  mockAuthedUser(USER_ID);
  service.loadOrder.mockReset();
  service.createPaymentIntent.mockReset();
});

afterEach(() => {
  mockAuthedUser(null);
});

describe("POST /api/checkout/payment-intent", () => {
  it("returns 401 when there is no session", async () => {
    mockAuthedUser(null);
    const res = await POST(jsonRequest(validPixBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/checkout/payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 on an invalid payload", async () => {
    const res = await POST(jsonRequest({ paymentMethod: "pix", orderId: "order-001" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the order does not exist", async () => {
    service.loadOrder.mockResolvedValueOnce(null);
    const res = await POST(jsonRequest(validPixBody));
    expect(res.status).toBe(404);
  });

  it("returns 403 when the order belongs to another user", async () => {
    service.loadOrder.mockResolvedValueOnce(fakeOrder({ userId: "someone-else" }));
    const res = await POST(jsonRequest(validPixBody));
    expect(res.status).toBe(403);
  });

  it("returns 400 when paymentMethod differs from the order", async () => {
    service.loadOrder.mockResolvedValueOnce(fakeOrder({ paymentMethod: "credit_card" }));
    const res = await POST(jsonRequest(validPixBody));
    expect(res.status).toBe(400);
  });

  it("returns 409 when the order already has a payment in progress", async () => {
    service.loadOrder.mockResolvedValueOnce(fakeOrder({ paymentStatus: "paid" }));
    const res = await POST(jsonRequest(validPixBody));
    expect(res.status).toBe(409);
  });

  it("returns 201 with the PaymentIntentResult on success", async () => {
    service.loadOrder.mockResolvedValueOnce(fakeOrder());
    service.createPaymentIntent.mockResolvedValueOnce({
      result: {
        paymentId: "mp-999",
        paymentMethod: "pix",
        status: "pending",
        pix: { qrCode: "qr", qrCodeBase64: "qr64" },
      },
      order: fakeOrder({ paymentIntentId: "mp-999" }),
    });

    const res = await POST(jsonRequest(validPixBody));
    expect(res.status).toBe(201);
    const data = (await res.json()) as { paymentId: string; pix: { qrCode: string } };
    expect(data.paymentId).toBe("mp-999");
    expect(data.pix.qrCode).toBe("qr");
  });

  it("returns 502 when the provider is unavailable", async () => {
    service.loadOrder.mockResolvedValueOnce(fakeOrder());
    service.createPaymentIntent.mockRejectedValueOnce(
      new PaymentProviderError("MercadoPago fora do ar.", "provider_unavailable"),
    );

    const res = await POST(jsonRequest(validPixBody));
    expect(res.status).toBe(502);
  });

  it("returns 500 when provider credentials are missing", async () => {
    service.loadOrder.mockResolvedValueOnce(fakeOrder());
    service.createPaymentIntent.mockRejectedValueOnce(
      new PaymentProviderError("token ausente", "config_missing"),
    );

    const res = await POST(jsonRequest(validPixBody));
    expect(res.status).toBe(500);
  });
});
