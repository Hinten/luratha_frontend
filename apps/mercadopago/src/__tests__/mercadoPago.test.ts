import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@luratha/core/logging/logger";
import {
  describeMercadoPagoError,
  isMercadoPagoSandbox,
  mapMpStatus,
  verifyWebhookSignature,
  withSandboxPayer,
  type CreatePaymentInput,
} from "@luratha/payments";

describe("mapMpStatus", () => {
  it("processed/accredited → paid; partially_refunded → partially_refunded", () => {
    expect(mapMpStatus("processed", "accredited")).toBe("paid");
    expect(mapMpStatus("processed")).toBe("paid");
    expect(mapMpStatus("processed", "partially_refunded")).toBe("partially_refunded");
  });

  it("action_required → awaiting por método; waiting_capture → authorized", () => {
    expect(mapMpStatus("action_required", "waiting_transfer", "bank_transfer")).toBe("awaiting_pix");
    expect(mapMpStatus("action_required", "waiting_payment", "ticket")).toBe("awaiting_boleto");
    expect(mapMpStatus("action_required", "waiting_capture", "credit_card")).toBe("authorized");
    // Sem método reconhecido → fallback pending.
    expect(mapMpStatus("action_required")).toBe("pending");
  });

  it("charged_back/in_process → in_dispute; settled/reimbursed → charged_back", () => {
    expect(mapMpStatus("charged_back", "in_process")).toBe("in_dispute");
    expect(mapMpStatus("charged_back", "settled")).toBe("charged_back");
    expect(mapMpStatus("charged_back", "reimbursed")).toBe("charged_back");
  });

  it("cancelled/failed/rejected → failed; refunded → refunded", () => {
    expect(mapMpStatus("cancelled")).toBe("failed");
    expect(mapMpStatus("failed")).toBe("failed");
    expect(mapMpStatus("rejected")).toBe("failed");
    expect(mapMpStatus("refunded")).toBe("refunded");
  });

  it("processing/in_process/created/pending → pending", () => {
    expect(mapMpStatus("processing", "in_process")).toBe("pending");
    expect(mapMpStatus("in_process")).toBe("pending");
    expect(mapMpStatus("created")).toBe("pending");
    expect(mapMpStatus("pending")).toBe("pending");
  });

  it("status desconhecido → 'unknown' + logger.warn (fail-safe, não chuta nem silencia)", () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    expect(mapMpStatus("status-novo-do-ml", "detail-x", "credit_card")).toBe("unknown");
    expect(mapMpStatus(undefined)).toBe("unknown");
    expect(warnSpy).toHaveBeenCalledWith(
      "[mercadoPago] status desconhecido — revisar mapeamento",
      expect.objectContaining({ status: "status-novo-do-ml" }),
    );
    warnSpy.mockRestore();
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

describe("withSandboxPayer", () => {
  const ORIGINAL_PAYER_EMAIL = process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL;
  const ORIGINAL_PAYER_FIRST_NAME = process.env.MERCADOPAGO_SANDBOX_PAYER_FIRST_NAME;

  function restoreEnv(name: string, original: string | undefined) {
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }

  beforeEach(() => {
    delete process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL;
    delete process.env.MERCADOPAGO_SANDBOX_PAYER_FIRST_NAME;
  });

  afterEach(() => {
    restoreEnv("MERCADOPAGO_SANDBOX_PAYER_EMAIL", ORIGINAL_PAYER_EMAIL);
    restoreEnv("MERCADOPAGO_SANDBOX_PAYER_FIRST_NAME", ORIGINAL_PAYER_FIRST_NAME);
  });

  // `firstName` default "APRO" mantém os testes de email focados só no email
  // (o first_name resolvido também é "APRO" por padrão, então não muda).
  function pixInput(email: string, firstName = "APRO"): CreatePaymentInput {
    return {
      paymentMethod: "pix",
      orderId: "ord_test_123",
      amount: 99.9,
      description: "Pedido teste",
      payer: {
        email,
        firstName,
        lastName: "Francelino",
        identification: { type: "CPF", number: "12345678909" },
      },
    };
  }

  describe("email — força o test user comprador", () => {
    it("MERCADOPAGO_SANDBOX_PAYER_EMAIL setada → sobrescreve o email original", () => {
      process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL = "test_user_123@testuser.com";
      expect(withSandboxPayer(pixInput("francelino25lucas@gmail.com")).payer.email).toBe(
        "test_user_123@testuser.com",
      );
    });

    it("trata espaços (trim) e ignora string vazia (fallback no rewrite de domínio)", () => {
      process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL = "  test_user_99@testuser.com  ";
      expect(withSandboxPayer(pixInput("real@gmail.com")).payer.email).toBe(
        "test_user_99@testuser.com",
      );
      process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL = "   ";
      expect(withSandboxPayer(pixInput("real@gmail.com")).payer.email).toBe(
        "real@testuser.com",
      );
    });

    it("fallback: reescreve o domínio mantendo o local-part quando não é @testuser.com", () => {
      expect(withSandboxPayer(pixInput("francelino25lucas@gmail.com")).payer.email).toBe(
        "francelino25lucas@testuser.com",
      );
    });

    it("usa 'test' como fallback de local-part quando o email começa com @", () => {
      expect(withSandboxPayer(pixInput("@gmail.com")).payer.email).toBe("test@testuser.com");
    });
  });

  describe("first_name — gatilho do status simulado no sandbox", () => {
    it("default 'APRO' quando a env não está setada (independe do nome real)", () => {
      expect(withSandboxPayer(pixInput("real@gmail.com", "Lucas")).payer.firstName).toBe("APRO");
    });

    it("usa MERCADOPAGO_SANDBOX_PAYER_FIRST_NAME quando setada (ex.: forçar in_process)", () => {
      process.env.MERCADOPAGO_SANDBOX_PAYER_FIRST_NAME = "CONT";
      expect(withSandboxPayer(pixInput("real@gmail.com", "Lucas")).payer.firstName).toBe("CONT");
    });

    it("trim e ignora vazio (fallback p/ 'APRO')", () => {
      process.env.MERCADOPAGO_SANDBOX_PAYER_FIRST_NAME = "  OTHE  ";
      expect(withSandboxPayer(pixInput("real@gmail.com", "Lucas")).payer.firstName).toBe("OTHE");
      process.env.MERCADOPAGO_SANDBOX_PAYER_FIRST_NAME = "   ";
      expect(withSandboxPayer(pixInput("real@gmail.com", "Lucas")).payer.firstName).toBe("APRO");
    });
  });

  describe("idempotência e preservação", () => {
    it("é idempotente quando email e first_name já batem com o alvo", () => {
      process.env.MERCADOPAGO_SANDBOX_PAYER_EMAIL = "test_user_123@testuser.com";
      const input = pixInput("test_user_123@testuser.com", "APRO");
      expect(withSandboxPayer(input)).toBe(input);
    });

    it("preserva os demais campos do payer e do input", () => {
      const result = withSandboxPayer(pixInput("user@example.com", "Lucas"));
      expect(result.payer.lastName).toBe("Francelino");
      expect(result.payer.identification).toEqual({ type: "CPF", number: "12345678909" });
      expect(result.orderId).toBe("ord_test_123");
      expect(result.amount).toBe(99.9);
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
