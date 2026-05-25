import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  describeMercadoPagoError,
  mapMpStatus,
  verifyWebhookSignature,
} from "@/src/lib/payment/mercadoPago";

describe("mapMpStatus", () => {
  it("maps approved to paid", () => {
    expect(mapMpStatus("approved")).toBe("paid");
  });

  it("maps authorized to authorized", () => {
    expect(mapMpStatus("authorized")).toBe("authorized");
  });

  it("maps rejected and cancelled to failed", () => {
    expect(mapMpStatus("rejected")).toBe("failed");
    expect(mapMpStatus("cancelled")).toBe("failed");
  });

  it("maps refunded to refunded (voluntary)", () => {
    expect(mapMpStatus("refunded")).toBe("refunded");
  });

  it("maps charged_back to charged_back (involuntary, post-dispute)", () => {
    expect(mapMpStatus("charged_back")).toBe("charged_back");
  });

  it("maps in_mediation to in_dispute (paid then contested)", () => {
    expect(mapMpStatus("in_mediation")).toBe("in_dispute");
  });

  it("maps pending, in_process and unknown values to pending", () => {
    expect(mapMpStatus("pending")).toBe("pending");
    expect(mapMpStatus("in_process")).toBe("pending");
    expect(mapMpStatus(undefined)).toBe("pending");
    expect(mapMpStatus("something-new")).toBe("pending");
  });
});

describe("describeMercadoPagoError", () => {
  it("extracts name/message/status from a native Error with attached status", () => {
    const err = new Error("Boom");
    (err as unknown as Record<string, unknown>).status = 500;

    expect(describeMercadoPagoError(err)).toEqual({
      name: "Error",
      message: "Boom",
      status: 500,
    });
  });

  it("handles a plain object with message + error + status (real MP shape)", () => {
    // Shape do log que motivou o helper: 500 communication_error.
    const err = {
      message: "fill and validate error list: communication_error\n: 400",
      error: "internal_server_error",
      status: 500,
      cause: [],
    };

    expect(describeMercadoPagoError(err)).toEqual({
      name: "MercadoPagoApiError",
      message:
        "fill and validate error list: communication_error\n: 400 (internal_server_error)",
      status: 500,
    });
  });

  it("uses only message when error field is absent or duplicates message", () => {
    expect(describeMercadoPagoError({ message: "Invalid CPF", status: 400 })).toEqual({
      name: "MercadoPagoApiError",
      message: "Invalid CPF",
      status: 400,
    });
    expect(
      describeMercadoPagoError({ message: "Same", error: "Same", status: 400 }),
    ).toEqual({
      name: "MercadoPagoApiError",
      message: "Same",
      status: 400,
    });
  });

  it("falls back to JSON.stringify (truncated) when no message/error available", () => {
    const err = { foo: "bar", baz: 1 };
    expect(describeMercadoPagoError(err)).toEqual({
      name: "MercadoPagoApiError",
      message: JSON.stringify(err),
      status: undefined,
    });
  });

  it("handles primitives (string, undefined, null)", () => {
    expect(describeMercadoPagoError("oops")).toEqual({
      name: "Unknown",
      message: "oops",
      status: undefined,
    });
    expect(describeMercadoPagoError(undefined)).toEqual({
      name: "Unknown",
      message: "undefined",
      status: undefined,
    });
    expect(describeMercadoPagoError(null)).toEqual({
      name: "Unknown",
      message: "null",
      status: undefined,
    });
  });
});

describe("verifyWebhookSignature", () => {
  const SECRET = "test-webhook-secret";
  const ORIGINAL = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = ORIGINAL;
  });

  function sign(dataId: string, requestId: string, ts: string): string {
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    return createHmac("sha256", SECRET).update(manifest).digest("hex");
  }

  it("accepts a valid signature", () => {
    const dataId = "123456";
    const requestId = "req-abc";
    const ts = "1700000000";
    const v1 = sign(dataId, requestId, ts);

    expect(
      verifyWebhookSignature({ signatureHeader: `ts=${ts},v1=${v1}`, requestId, dataId }),
    ).toBe(true);
  });

  it("rejects a tampered signature", () => {
    expect(
      verifyWebhookSignature({
        signatureHeader:
          "ts=1700000000,v1=0000000000000000000000000000000000000000000000000000000000000000",
        requestId: "req-abc",
        dataId: "123456",
      }),
    ).toBe(false);
  });

  it("rejects when the signature header is missing", () => {
    expect(
      verifyWebhookSignature({ signatureHeader: null, requestId: "req", dataId: "1" }),
    ).toBe(false);
  });

  it("rejects when dataId is missing", () => {
    expect(
      verifyWebhookSignature({ signatureHeader: "ts=1,v1=ab", requestId: "req", dataId: null }),
    ).toBe(false);
  });

  it("lowercases an alphanumeric dataId in the manifest", () => {
    const requestId = "req-1";
    const ts = "1700000001";
    const v1 = sign("abc123", requestId, ts);

    expect(
      verifyWebhookSignature({
        signatureHeader: `ts=${ts},v1=${v1}`,
        requestId,
        dataId: "ABC123",
      }),
    ).toBe(true);
  });
});
