import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  describeMercadoPagoError,
  isMercadoPagoSandbox,
  mapMpStatus,
  verifyWebhookSignature,
  withSandboxEmail,
  type CreatePaymentInput,
} from "@luratha/payments";

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

describe("isMercadoPagoSandbox", () => {
  const ORIGINAL_ENV = process.env.MERCADOPAGO_ENV;

  beforeEach(() => {
    delete process.env.MERCADOPAGO_ENV;
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.MERCADOPAGO_ENV;
    } else {
      process.env.MERCADOPAGO_ENV = ORIGINAL_ENV;
    }
  });

  describe("MERCADOPAGO_ENV override", () => {
    it("força sandbox quando MERCADOPAGO_ENV=sandbox, mesmo com token sem prefixo TEST-", () => {
      process.env.MERCADOPAGO_ENV = "sandbox";
      expect(isMercadoPagoSandbox("APP_USR-1234567890")).toBe(true);
      expect(isMercadoPagoSandbox("anycredential")).toBe(true);
    });

    it("força produção quando MERCADOPAGO_ENV=production, mesmo com token TEST-", () => {
      process.env.MERCADOPAGO_ENV = "production";
      expect(isMercadoPagoSandbox("TEST-1234567890")).toBe(false);
    });

    it("normaliza case (SANDBOX/Production) via toLowerCase", () => {
      process.env.MERCADOPAGO_ENV = "SANDBOX";
      expect(isMercadoPagoSandbox("APP_USR-x")).toBe(true);
      process.env.MERCADOPAGO_ENV = "Production";
      expect(isMercadoPagoSandbox("TEST-x")).toBe(false);
    });

    it("trata espaços em volta (trim)", () => {
      process.env.MERCADOPAGO_ENV = "  sandbox  ";
      expect(isMercadoPagoSandbox("APP_USR-x")).toBe(true);
    });

    it("joga PaymentProviderError quando o valor é desconhecido", () => {
      process.env.MERCADOPAGO_ENV = "staging";
      expect(() => isMercadoPagoSandbox("TEST-x")).toThrow(/MERCADOPAGO_ENV não configurado/);
    });

    it("joga PaymentProviderError quando MERCADOPAGO_ENV é string vazia", () => {
      process.env.MERCADOPAGO_ENV = "";
      expect(() => isMercadoPagoSandbox("TEST-x")).toThrow(/MERCADOPAGO_ENV não configurado/);
    });
  });

  describe("MERCADOPAGO_ENV ausente — falha explícita (config mandatória)", () => {
    // O painel atual do MP nem sempre gera credenciais TEST com prefixo
    // `TEST-`, então não dá pra inferir o ambiente do token. A função
    // exige `MERCADOPAGO_ENV` setado pra evitar comportamento ambíguo.
    it("joga PaymentProviderError quando MERCADOPAGO_ENV não está setado, mesmo com token TEST-", () => {
      expect(() => isMercadoPagoSandbox("TEST-1234567890")).toThrow(/MERCADOPAGO_ENV não configurado/);
    });

    it("joga PaymentProviderError quando MERCADOPAGO_ENV não está setado, mesmo com token APP_USR-", () => {
      expect(() => isMercadoPagoSandbox("APP_USR-1234567890")).toThrow(/MERCADOPAGO_ENV não configurado/);
    });
  });
});

describe("withSandboxEmail", () => {
  const ORIGINAL_PAYER_EMAIL = process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL;

  beforeEach(() => {
    delete process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL;
  });

  afterEach(() => {
    if (ORIGINAL_PAYER_EMAIL === undefined) {
      delete process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL;
    } else {
      process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL = ORIGINAL_PAYER_EMAIL;
    }
  });

  function pixInput(email: string): CreatePaymentInput {
    return {
      paymentMethod: "pix",
      orderId: "ord_test_123",
      amount: 99.9,
      description: "Pedido teste",
      payer: {
        email,
        firstName: "Lucas",
        lastName: "Francelino",
        identification: { type: "CPF", number: "12345678909" },
      },
    };
  }

  describe("MERCADOPAGO_SANDBOX_PAYER_EMAIL setada — força o test user explícito", () => {
    it("sobrescreve o email original pelo email do test user comprador", () => {
      process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL = "test_user_123@testuser.com";
      const result = withSandboxEmail(pixInput("francelino25lucas@gmail.com"));
      expect(result.payer.email).toBe("test_user_123@testuser.com");
    });

    it("sobrescreve mesmo se o email original já estava em @testuser.com (mas diferente)", () => {
      process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL = "test_user_123@testuser.com";
      const result = withSandboxEmail(pixInput("francelino25lucas@testuser.com"));
      expect(result.payer.email).toBe("test_user_123@testuser.com");
    });

    it("é idempotente quando o email já bate com a env", () => {
      process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL = "test_user_123@testuser.com";
      const input = pixInput("test_user_123@testuser.com");
      const result = withSandboxEmail(input);
      expect(result).toBe(input);
    });

    it("trata espaços em volta (trim) e ignora string vazia", () => {
      process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL = "  test_user_99@testuser.com  ";
      expect(withSandboxEmail(pixInput("real@gmail.com")).payer.email).toBe(
        "test_user_99@testuser.com",
      );
      process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL = "   ";
      // Vazio após trim → fallback no rewrite de domínio.
      expect(withSandboxEmail(pixInput("real@gmail.com")).payer.email).toBe(
        "real@testuser.com",
      );
    });
  });

  describe("fallback — rewrite de domínio quando env não está setada", () => {
    it("reescreve o domínio mantendo o local-part quando não termina em @testuser.com", () => {
      const result = withSandboxEmail(pixInput("francelino25lucas@gmail.com"));
      expect(result.payer.email).toBe("francelino25lucas@testuser.com");
    });

    it("é idempotente quando o email já termina em @testuser.com", () => {
      const input = pixInput("francelino25lucas@testuser.com");
      const result = withSandboxEmail(input);
      expect(result.payer.email).toBe("francelino25lucas@testuser.com");
      expect(result).toBe(input);
    });

    it("preserva os demais campos do payer e do input", () => {
      const input = pixInput("user@example.com");
      const result = withSandboxEmail(input);
      expect(result.payer.firstName).toBe("Lucas");
      expect(result.payer.lastName).toBe("Francelino");
      expect(result.payer.identification).toEqual({ type: "CPF", number: "12345678909" });
      expect(result.orderId).toBe("ord_test_123");
      expect(result.amount).toBe(99.9);
    });

    it("usa 'test' como fallback de local-part quando o email começa com @", () => {
      const result = withSandboxEmail(pixInput("@gmail.com"));
      expect(result.payer.email).toBe("test@testuser.com");
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

  // A doc do MP é contraditória sobre o segmento request-id quando x-request-id
  // está ausente (WARNING manda remover; exemplos de SDK mantêm vazio). O
  // verificador aceita AMBAS as variantes — uma destas reflete o que o MP assina.
  it("accepts the SDK-style empty segment when x-request-id is absent (id;request-id:;ts;)", () => {
    const dataId = "123456";
    const ts = "1780065655";
    const v1 = createHmac("sha256", SECRET)
      .update(`id:${dataId};request-id:;ts:${ts};`)
      .digest("hex");

    expect(
      verifyWebhookSignature({ signatureHeader: `ts=${ts},v1=${v1}`, requestId: null, dataId }),
    ).toBe(true);
  });

  it("accepts the WARNING-style omitted segment when x-request-id is absent (id;ts;)", () => {
    const dataId = "123456";
    const ts = "1780065655";
    const v1 = createHmac("sha256", SECRET).update(`id:${dataId};ts:${ts};`).digest("hex");

    expect(
      verifyWebhookSignature({ signatureHeader: `ts=${ts},v1=${v1}`, requestId: null, dataId }),
    ).toBe(true);
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
