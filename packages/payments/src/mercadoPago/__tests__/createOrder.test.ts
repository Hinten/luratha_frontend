import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@luratha/core/logging/logger";

import { createOrder, getOrderArtifacts } from "../index";
import { PaymentProviderError, type CreatePaymentInput } from "../../types";

/**
 * Cobre o tratamento do artefato de pagamento (QR do PIX / boleto) no
 * `createOrder` e o polling via `getOrderArtifacts`. Mockamos `fetch` para
 * simular respostas 2xx do MercadoPago com e sem o artefato.
 */

const PIX_INPUT: CreatePaymentInput = {
  orderId: "order-1",
  amount: 120,
  description: "Pedido 1 — Luratha",
  payer: { email: "comprador@teste.com", identification: { type: "CPF", number: "12345678909" } },
  paymentMethod: "pix",
};

const BOLETO_INPUT: CreatePaymentInput = {
  orderId: "order-2",
  amount: 120,
  description: "Pedido 2 — Luratha",
  payer: { email: "comprador@teste.com", identification: { type: "CPF", number: "12345678909" } },
  paymentMethod: "boleto",
  payerAddress: {
    zipCode: "01310-100",
    streetName: "Av. Paulista",
    streetNumber: "1578",
    neighborhood: "Bela Vista",
    city: "São Paulo",
    federalUnit: "SP",
  },
};

function mockFetch(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok,
    status,
    statusText: "OK",
    text: async () => JSON.stringify(body),
  }));
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

function pixPaymentMethod(extra: Record<string, unknown> = {}) {
  return { transactions: { payments: [{ payment_method: extra }] } };
}

beforeEach(() => {
  process.env.MERCADOPAGO_ACCESS_TOKEN = "TEST-token";
  process.env.MERCADOPAGO_ENV = "production"; // evita reescrita de email do sandbox
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createOrder — artefato de pagamento", () => {
  it("PIX com QR → result.pix preenchido, pixPending falsy", async () => {
    mockFetch({
      id: "ORD1",
      status: "action_required",
      ...pixPaymentMethod({ qr_code: "QR", qr_code_base64: "B64" }),
    });

    const result = await createOrder(PIX_INPUT);

    expect(result.pix).toEqual({ qrCode: "QR", qrCodeBase64: "B64", ticketUrl: undefined });
    expect(result.pixPending).toBeFalsy();
  });

  it("PIX sem QR e status pendente → pixPending true, NÃO lança, loga o body cru", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    mockFetch({ id: "ORD1", status: "action_required", ...pixPaymentMethod() });

    const result = await createOrder(PIX_INPUT);

    expect(result.pixPending).toBe(true);
    expect(result.pix).toBeUndefined();
    // body cru capturado no log pra diagnóstico.
    expect(warnSpy).toHaveBeenCalledWith(
      "[mercadoPago] order sem artefato de pagamento",
      expect.objectContaining({ rawResponse: expect.objectContaining({ id: "ORD1" }) }),
    );
  });

  it("PIX em análise antifraude (in_process) sem QR → pixPending + underReview, não lança", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    mockFetch({
      id: "ORD1",
      status: "processing",
      status_detail: "in_process",
      ...pixPaymentMethod(),
    });

    const result = await createOrder(PIX_INPUT);

    expect(result.pixPending).toBe(true);
    expect(result.underReview).toBe(true);
    expect(result.pix).toBeUndefined();
  });

  it("PIX sem QR mas com status de recusa → lança PaymentProviderError (não fica pendente)", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    mockFetch({
      id: "ORD1",
      status: "failed",
      status_detail: "cc_rejected_other_reason",
      ...pixPaymentMethod(),
    });

    await expect(createOrder(PIX_INPUT)).rejects.toBeInstanceOf(PaymentProviderError);
  });

  it("PIX sem QR com status cancelled/rejected também lança (falha não é só 'failed')", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    for (const status of ["cancelled", "rejected"]) {
      mockFetch({ id: "ORD1", status, ...pixPaymentMethod() });
      await expect(createOrder(PIX_INPUT)).rejects.toBeInstanceOf(PaymentProviderError);
    }
  });

  it("boleto com ticket_url → result.boleto preenchido", async () => {
    mockFetch({
      id: "ORD2",
      status: "action_required",
      ...pixPaymentMethod({ ticket_url: "https://mp/boleto.pdf", digitable_line: "123" }),
    });

    const result = await createOrder(BOLETO_INPUT);

    expect(result.boleto).toEqual({
      url: "https://mp/boleto.pdf",
      barcode: undefined,
      digitableLine: "123",
    });
    expect(result.boletoPending).toBeFalsy();
  });

  it("boleto sem ticket_url e pendente → boletoPending true, não lança", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    mockFetch({ id: "ORD2", status: "action_required", ...pixPaymentMethod() });

    const result = await createOrder(BOLETO_INPUT);

    expect(result.boletoPending).toBe(true);
    expect(result.boleto).toBeUndefined();
  });
});

describe("getOrderArtifacts — releitura para polling", () => {
  it("devolve o pix quando o QR já está disponível", async () => {
    mockFetch({
      id: "ORD1",
      status: "action_required",
      ...pixPaymentMethod({ qr_code: "QR", qr_code_base64: "B64" }),
    });

    const artifacts = await getOrderArtifacts("ORD1");

    expect(artifacts.status).toBe("pending");
    expect(artifacts.pix).toEqual({ qrCode: "QR", qrCodeBase64: "B64", ticketUrl: undefined });
  });

  it("devolve só o status quando o artefato ainda não veio", async () => {
    mockFetch({ id: "ORD1", status: "action_required", ...pixPaymentMethod() });

    const artifacts = await getOrderArtifacts("ORD1");

    expect(artifacts.status).toBe("pending");
    expect(artifacts.pix).toBeUndefined();
    expect(artifacts.boleto).toBeUndefined();
    expect(artifacts.underReview).toBeUndefined();
  });

  it("propaga underReview quando a order está em análise (in_process)", async () => {
    mockFetch({ id: "ORD1", status: "processing", status_detail: "in_process", ...pixPaymentMethod() });

    const artifacts = await getOrderArtifacts("ORD1");

    expect(artifacts.status).toBe("pending");
    expect(artifacts.underReview).toBe(true);
    expect(artifacts.pix).toBeUndefined();
  });

  it("lança quando o pagamento já falhou e não há artefato", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    mockFetch({ id: "ORD1", status: "failed", status_detail: "rejected", ...pixPaymentMethod() });

    await expect(getOrderArtifacts("ORD1")).rejects.toBeInstanceOf(PaymentProviderError);
  });
});
