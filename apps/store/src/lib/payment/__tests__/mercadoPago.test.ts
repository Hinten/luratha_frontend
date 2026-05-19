import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mapMpStatus, verifyWebhookSignature } from "@/src/lib/payment/mercadoPago";

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

  it("maps refunded and charged_back to refunded", () => {
    expect(mapMpStatus("refunded")).toBe("refunded");
    expect(mapMpStatus("charged_back")).toBe("refunded");
  });

  it("maps pending, in_process and unknown values to pending", () => {
    expect(mapMpStatus("pending")).toBe("pending");
    expect(mapMpStatus("in_process")).toBe("pending");
    expect(mapMpStatus(undefined)).toBe("pending");
    expect(mapMpStatus("something-new")).toBe("pending");
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
