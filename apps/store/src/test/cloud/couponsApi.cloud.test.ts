/**
 * Cloud integration test for POST /api/coupons/validate.
 *
 * Seeds real Coupon documents in luratha-96386 (firestore) and exercises the
 * handler end-to-end. Auth is mocked to bypass session-cookie verification.
 *
 * Execute: pnpm test:firestore
 * The suite is automatically skipped when RUN_CLOUD_TESTS is not set.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminCouponConverter } from "@luratha/firestore/adminCouponConverter";
import { firestoreCollections, type Coupon } from "@luratha/schemas";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";

// ── Auth mock ──────────────────────────────────────────────────────────────
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

import { POST as validatePOST } from "@/src/app/api/coupons/validate/route";

type SeedDocument = { collection: string; id: string };

async function cleanupDocuments(tracked: SeedDocument[]): Promise<void> {
  await Promise.all(
    tracked.map(({ collection, id }) => adminDb.collection(collection).doc(id).delete()),
  );
}

async function seedCoupon(coupon: Coupon, tracked: SeedDocument[]) {
  const ref = adminDb
    .collection(firestoreCollections.coupons)
    .doc(coupon.id)
    .withConverter(adminCouponConverter);
  await ref.set(coupon);
  tracked.push({ collection: firestoreCollections.coupons, id: coupon.id });
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/coupons/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describeCloud("/api/coupons/validate (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  const userId = `${prefix}-user`;
  const seededDocs: SeedDocument[] = [];

  // Coupon.code tem limite de 32 chars no schema. O prefix de teste é mais
  // longo que isso (timestamp + uuid), então usamos um nonce curto para os
  // códigos — o prefix continua nos `id`s para isolar entre runs.
  const codeNonce = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  const validCode = `T${codeNonce}VLD`;
  const expiredCode = `T${codeNonce}EXP`;
  const inactiveCode = `T${codeNonce}OFF`;

  beforeAll(async () => {
    mockAuthedUser(userId);

    const now = Date.now();
    await seedCoupon(
      {
        id: `${prefix}-valid`,
        code: validCode,
        type: "percentage",
        amount: 10,
        minimumOrderAmount: 50,
        startsAt: new Date(now - 86_400_000).toISOString(),
        expiresAt: new Date(now + 86_400_000).toISOString(),
        usageCount: 0,
        active: true,
      } as Coupon,
      seededDocs,
    );

    await seedCoupon(
      {
        id: `${prefix}-expired`,
        code: expiredCode,
        type: "fixed",
        amount: 20,
        minimumOrderAmount: 0,
        startsAt: new Date(now - 2 * 86_400_000).toISOString(),
        expiresAt: new Date(now - 86_400_000).toISOString(),
        usageCount: 0,
        active: true,
      } as Coupon,
      seededDocs,
    );

    await seedCoupon(
      {
        id: `${prefix}-inactive`,
        code: inactiveCode,
        type: "fixed",
        amount: 15,
        minimumOrderAmount: 0,
        startsAt: new Date(now - 86_400_000).toISOString(),
        expiresAt: new Date(now + 86_400_000).toISOString(),
        usageCount: 0,
        active: false,
      } as Coupon,
      seededDocs,
    );
  });

  afterAll(async () => {
    await cleanupDocuments(seededDocs);
    mockAuthedUser(null);
  });

  it("returns valid:true with computed discount for a healthy percentage coupon", async () => {
    const res = await validatePOST(jsonRequest({ code: validCode.toLowerCase(), cartTotal: 200 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      valid: true,
      code: validCode,
      type: "percentage",
      discount: 20,
    });
  });

  it("returns valid:false 'abaixo do mínimo' when cartTotal < minimumOrderAmount", async () => {
    const res = await validatePOST(jsonRequest({ code: validCode, cartTotal: 30 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.reason).toMatch(/abaixo do mínimo/);
  });

  it("returns valid:false 'expirado' for a past-window coupon", async () => {
    const res = await validatePOST(jsonRequest({ code: expiredCode, cartTotal: 200 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ valid: false, reason: "Cupom expirado." });
  });

  it("returns valid:false 'inativo' for an inactive coupon", async () => {
    const res = await validatePOST(jsonRequest({ code: inactiveCode, cartTotal: 200 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ valid: false, reason: "Cupom inativo." });
  });

  it("returns valid:false 'não encontrado' for an unknown code", async () => {
    const res = await validatePOST(jsonRequest({ code: `T${codeNonce}NOPE`, cartTotal: 200 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ valid: false, reason: "Cupom não encontrado." });
  });
});
