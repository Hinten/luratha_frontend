import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  describeMercadoPagoError,
  mapMpStatus,
  verifyWebhookSignature,
} from "@/src/lib/payment/mercadoPago";

describe("mapMpStatus", () => {
  it("maps processed to paid (Orders API)", () => {
    expect(mapMpStatus("processed")).toBe("paid");
  });

  it("maps action_required to pending (PIX/boleto aguardando)", () => {
    expect(mapMpStatus("action_required")).toBe("pending");
  });

  it("maps cancelled, failed and rejected to failed", () => {
    expect(mapMpStatus("cancelled")).toBe("failed");
    expect(mapMpStatus("failed")).toBe("failed");
    expect(mapMpStatus("rejected")).toBe("failed");
  });

  it("maps refunded to refunded", () => {
    expect(mapMpStatus("refunded")).toBe("refunded");
  });

  it("maps pending, in_process, created and unknown values to pending", () => {
    expect(mapMpStatus("pending")).toBe("pending");
    expect(mapMpStatus("in_process")).toBe("pending");
    expect(mapMpStatus("created")).toBe("pending");
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

  it("concatenates errors[] list from Orders API 4xx body", () => {
    // Orders API retorna lista de erros (≠ Payments antigo que retornava um único).
    const err = {
      errors: [
        { code: "required_properties", message: "Field 'transactions' is required" },
        { code: "invalid_email_for_sandbox", message: "Email must end with @testuser.com" },
      ],
      status: 400,
    };
    expect(describeMercadoPagoError(err)).toEqual({
      name: "MercadoPagoApiError",
      message:
        "required_properties: Field 'transactions' is required; invalid_email_for_sandbox: Email must end with @testuser.com",
      status: 400,
    });
  });

  it("handles errors[] without a code (only message)", () => {
    const err = { errors: [{ message: "Boom" }], status: 500 };
    expect(describeMercadoPagoError(err)).toEqual({
      name: "MercadoPagoApiError",
      message: "Boom",
      status: 500,
    });
  });

  it("falls back to message field when errors[] is absent", () => {
    expect(describeMercadoPagoError({ message: "Invalid CPF", status: 400 })).toEqual({
      name: "MercadoPagoApiError",
      message: "Invalid CPF",
      status: 400,
    });
  });

  it("falls back to JSON.stringify (truncated) when no errors/message available", () => {
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

  it("accepts a valid signature for an Order ID (ORD...)", () => {
    const dataId = "ord01j6tc8byrr0t4zky0qr39wgye";
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
        dataId: "ORD01J6TC8BYRR0T4ZKY0QR39WGYE",
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

  it("lowercases an alphanumeric dataId (Order IDs arrive uppercase)", () => {
    const requestId = "req-1";
    const ts = "1700000001";
    const v1 = sign("ord01jc1kvz0wjy8y4wa7mzad5s2t", requestId, ts);

    expect(
      verifyWebhookSignature({
        signatureHeader: `ts=${ts},v1=${v1}`,
        requestId,
        dataId: "ORD01JC1KVZ0WJY8Y4WA7MZAD5S2T",
      }),
    ).toBe(true);
  });
});
