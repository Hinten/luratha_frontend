import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type { Coupon } from "@luratha/schemas";

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

const firestoreStub = vi.hoisted(() => {
  const getMock = vi.fn();
  const builder = {
    where: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    withConverter: vi.fn(() => builder),
    get: getMock,
  };
  const collectionMock = vi.fn(() => builder);
  return { collectionMock, builder, getMock };
});

vi.mock("@luratha/firestore/firebaseAdmin", () => ({
  adminDb: {
    collection: firestoreStub.collectionMock,
  },
}));

vi.mock("@luratha/firestore/adminCouponConverter", () => ({
  adminCouponConverter: { __converter: true },
}));

import { POST } from "@/src/app/api/coupons/validate/route";

const USER_ID = "user-coupon-001";

function couponDoc(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: "cpn-001",
    code: "WELCOME10",
    type: "percentage",
    amount: 10,
    minimumOrderAmount: 0,
    startsAt: new Date(Date.now() - 86_400_000).toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    usageCount: 0,
    active: true,
    ...overrides,
  } as Coupon;
}

function snapshotOf(coupons: Coupon[]) {
  return {
    empty: coupons.length === 0,
    docs: coupons.map((c) => ({ data: () => c })),
  };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/coupons/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockAuthedUser(USER_ID);
  firestoreStub.getMock.mockReset();
});

afterEach(() => {
  mockAuthedUser(null);
});

describe("POST /api/coupons/validate", () => {
  it("returns 401 when there is no session", async () => {
    mockAuthedUser(null);
    const res = await POST(jsonRequest({ code: "WELCOME10", cartTotal: 100 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when body fails validation", async () => {
    const res = await POST(jsonRequest({ code: "X", cartTotal: -5 }));
    expect(res.status).toBe(400);
  });

  it("returns valid:false when coupon does not exist", async () => {
    firestoreStub.getMock.mockResolvedValueOnce(snapshotOf([]));
    const res = await POST(jsonRequest({ code: "NOPE", cartTotal: 100 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ valid: false, reason: "Cupom não encontrado." });
  });

  it("normalizes the code to uppercase before lookup", async () => {
    firestoreStub.getMock.mockResolvedValueOnce(snapshotOf([]));
    await POST(jsonRequest({ code: "welcome10", cartTotal: 100 }));
    expect(firestoreStub.builder.where).toHaveBeenCalledWith("code", "==", "WELCOME10");
  });

  it("returns valid:false when coupon is inactive", async () => {
    firestoreStub.getMock.mockResolvedValueOnce(
      snapshotOf([couponDoc({ active: false })]),
    );
    const res = await POST(jsonRequest({ code: "WELCOME10", cartTotal: 100 }));
    const body = await res.json();
    expect(body).toMatchObject({ valid: false, reason: "Cupom inativo." });
  });

  it("returns valid:false when coupon has not started yet", async () => {
    firestoreStub.getMock.mockResolvedValueOnce(
      snapshotOf([
        couponDoc({
          startsAt: new Date(Date.now() + 86_400_000).toISOString(),
          expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        }),
      ]),
    );
    const res = await POST(jsonRequest({ code: "WELCOME10", cartTotal: 100 }));
    const body = await res.json();
    expect(body).toMatchObject({ valid: false, reason: "Cupom ainda não disponível." });
  });

  it("returns valid:false when coupon is expired", async () => {
    firestoreStub.getMock.mockResolvedValueOnce(
      snapshotOf([
        couponDoc({
          startsAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
          expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
        }),
      ]),
    );
    const res = await POST(jsonRequest({ code: "WELCOME10", cartTotal: 100 }));
    const body = await res.json();
    expect(body).toMatchObject({ valid: false, reason: "Cupom expirado." });
  });

  it("returns valid:false when usage limit is reached", async () => {
    firestoreStub.getMock.mockResolvedValueOnce(
      snapshotOf([couponDoc({ usageLimit: 5, usageCount: 5 })]),
    );
    const res = await POST(jsonRequest({ code: "WELCOME10", cartTotal: 100 }));
    const body = await res.json();
    expect(body).toMatchObject({ valid: false, reason: "Cupom esgotado." });
  });

  it("returns valid:false when cart is below minimum order amount", async () => {
    firestoreStub.getMock.mockResolvedValueOnce(
      snapshotOf([couponDoc({ minimumOrderAmount: 200 })]),
    );
    const res = await POST(jsonRequest({ code: "WELCOME10", cartTotal: 100 }));
    const body = await res.json();
    expect(body).toMatchObject({
      valid: false,
      reason: "Pedido abaixo do mínimo de R$ 200.00.",
    });
  });

  it("returns valid:true with 10% discount for a percentage coupon", async () => {
    firestoreStub.getMock.mockResolvedValueOnce(
      snapshotOf([couponDoc({ type: "percentage", amount: 10 })]),
    );
    const res = await POST(jsonRequest({ code: "WELCOME10", cartTotal: 250 }));
    const body = await res.json();
    expect(body).toEqual({
      valid: true,
      code: "WELCOME10",
      type: "percentage",
      discount: 25,
    });
  });

  it("caps percentage discount at maxDiscountAmount when defined", async () => {
    firestoreStub.getMock.mockResolvedValueOnce(
      snapshotOf([
        couponDoc({ type: "percentage", amount: 50, maxDiscountAmount: 30 }),
      ]),
    );
    const res = await POST(jsonRequest({ code: "WELCOME10", cartTotal: 200 }));
    const body = await res.json();
    expect(body).toMatchObject({ valid: true, discount: 30 });
  });

  it("returns fixed discount and caps it at cartTotal", async () => {
    firestoreStub.getMock.mockResolvedValueOnce(
      snapshotOf([couponDoc({ type: "fixed", amount: 100 })]),
    );
    const res = await POST(jsonRequest({ code: "WELCOME10", cartTotal: 80 }));
    const body = await res.json();
    expect(body).toEqual({
      valid: true,
      code: "WELCOME10",
      type: "fixed",
      discount: 80,
    });
  });
});
