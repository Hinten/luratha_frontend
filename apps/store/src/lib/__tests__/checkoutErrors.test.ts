import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError } from "@/src/lib/errors";
import {
  reportCheckoutError,
  type CheckoutStep,
  type ReportCheckoutErrorArgs,
} from "@/src/lib/checkoutErrors";

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

function callWith(
  step: CheckoutStep,
  error: unknown,
  metadata?: Record<string, unknown>,
): string {
  const args: ReportCheckoutErrorArgs = { error, step };
  if (metadata) args.metadata = metadata;
  return reportCheckoutError(args);
}

function abortError(): DOMException {
  return new DOMException("Aborted", "AbortError");
}

describe("reportCheckoutError — logging", () => {
  it("loga com prefixo do step e payload estruturado para ApiResponseError", () => {
    const err = new ApiResponseError("boom", 502, [], "provider_unavailable");
    callWith("shipping", err);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[checkout:shipping]",
      expect.objectContaining({
        step: "shipping",
        errorName: "ApiResponseError",
        status: 502,
        code: "provider_unavailable",
        message: "boom",
      }),
    );
  });

  it("loga TypeError como erro de rede", () => {
    callWith("identification", new TypeError("Failed to fetch"));
    expect(consoleSpy).toHaveBeenCalledWith(
      "[checkout:identification]",
      expect.objectContaining({
        errorName: "TypeError",
        message: "Failed to fetch",
      }),
    );
  });

  it("loga AbortError preservando o nome", () => {
    callWith("submit_order", abortError());
    expect(consoleSpy).toHaveBeenCalledWith(
      "[checkout:submit_order]",
      expect.objectContaining({
        errorName: "AbortError",
      }),
    );
  });

  it("loga errorName='unknown' quando recebe string", () => {
    callWith("submit_order", "oops");
    expect(consoleSpy).toHaveBeenCalledWith(
      "[checkout:submit_order]",
      expect.objectContaining({
        errorName: "unknown",
        message: "oops",
      }),
    );
  });

  it("loga errorName='unknown' quando recebe null sem lançar", () => {
    expect(() => callWith("submit_order", null)).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[checkout:submit_order]",
      expect.objectContaining({
        errorName: "unknown",
      }),
    );
  });

  it("propaga o metadata para o payload do log", () => {
    callWith("payment_card", new Error("brick"), {
      brickPayload: { type: "invalid" },
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      "[checkout:payment_card]",
      expect.objectContaining({
        metadata: { brickPayload: { type: "invalid" } },
      }),
    );
  });

  it("inclui timestamp ISO no payload", () => {
    callWith("coupon", new Error("x"));
    const payload = consoleSpy.mock.calls[0][1] as { timestamp: string };
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("reportCheckoutError — cross-cutting messages", () => {
  it("401 vira mensagem de sessão expirada em qualquer step", () => {
    const msg = callWith(
      "identification",
      new ApiResponseError("not authed", 401),
    );
    expect(msg).toBe(
      "Sua sessão expirou. Atualize a página e entre de novo para continuar.",
    );
  });

  it("403 vira mensagem de permissão", () => {
    const msg = callWith("submit_order", new ApiResponseError("nope", 403));
    expect(msg).toBe("Você não tem permissão para realizar esta ação.");
  });

  it("502 vira mensagem de instabilidade", () => {
    const msg = callWith("identification", new ApiResponseError("down", 502));
    expect(msg).toBe(
      "Estamos com instabilidade no momento. Tente novamente em alguns minutos.",
    );
  });

  it("TypeError vira mensagem de conexão", () => {
    const msg = callWith("address_save", new TypeError("Failed to fetch"));
    expect(msg).toBe(
      "Sua conexão parece instável. Verifique a internet e tente novamente.",
    );
  });

  it("AbortError genérico vira mensagem de tempo limite", () => {
    const msg = callWith("shipping", abortError());
    expect(msg).toBe(
      "A operação demorou demais. Verifique sua conexão e tente novamente.",
    );
  });
});

describe("reportCheckoutError — identification step", () => {
  it("400 destaca CPF/CNPJ/e-mail", () => {
    expect(
      callWith("identification", new ApiResponseError("bad", 400)),
    ).toBe(
      "Confira os dados informados — CPF/CNPJ ou e-mail parecem inválidos.",
    );
  });

  it("404 sugere tentar novamente", () => {
    expect(
      callWith("identification", new ApiResponseError("nope", 404)),
    ).toBe(
      "Não conseguimos criar seu perfil agora. Tente novamente em instantes.",
    );
  });

  it("409 indica duplicação", () => {
    expect(
      callWith("identification", new ApiResponseError("dup", 409)),
    ).toBe(
      "Já existe um perfil com esses dados. Atualize a página e tente de novo.",
    );
  });

  it("500 cai no fallback de servidor", () => {
    expect(
      callWith("identification", new ApiResponseError("err", 500)),
    ).toBe(
      "Tivemos um problema momentâneo no servidor. Tente novamente em instantes.",
    );
  });

  it("fallback genérico para erro não reconhecido", () => {
    expect(callWith("identification", new Error("???"))).toBe(
      "Não foi possível salvar seus dados. Tente novamente.",
    );
  });
});

describe("reportCheckoutError — address_load step", () => {
  it("4xx pede para atualizar a página", () => {
    expect(callWith("address_load", new ApiResponseError("bad", 404))).toBe(
      "Não conseguimos carregar seus endereços. Atualize a página e tente de novo.",
    );
  });

  it("5xx pede para tentar mais tarde", () => {
    expect(callWith("address_load", new ApiResponseError("err", 503))).toBe(
      "Estamos com instabilidade no momento. Tente novamente em alguns minutos.",
    );
  });

  it("500 puro cai no fallback de retry curto", () => {
    expect(callWith("address_load", new ApiResponseError("err", 500))).toBe(
      "Não conseguimos carregar seus endereços agora. Tente novamente em instantes.",
    );
  });

  it("fallback genérico", () => {
    expect(callWith("address_load", new Error("oops"))).toBe(
      "Não foi possível carregar seus endereços.",
    );
  });
});

describe("reportCheckoutError — address_save step", () => {
  it("400 com field issues colapsa para mensagem curta", () => {
    expect(
      callWith("address_save", new ApiResponseError("bad", 400), {
        hasFieldIssues: true,
      }),
    ).toBe("Confira os campos destacados abaixo.");
  });

  it("400 sem field issues pede revisão dos dados", () => {
    expect(
      callWith("address_save", new ApiResponseError("bad", 400), {
        hasFieldIssues: false,
      }),
    ).toBe(
      "Não foi possível salvar este endereço. Verifique os dados e tente novamente.",
    );
  });

  it("409 indica duplicação", () => {
    expect(callWith("address_save", new ApiResponseError("dup", 409))).toBe(
      "Este endereço já está cadastrado na sua conta.",
    );
  });

  it("500 cai no fallback de servidor", () => {
    expect(callWith("address_save", new ApiResponseError("err", 500))).toBe(
      "Tivemos um problema momentâneo no servidor. Tente novamente em instantes.",
    );
  });

  it("fallback genérico", () => {
    expect(callWith("address_save", new Error("oops"))).toBe(
      "Não foi possível salvar o endereço. Tente novamente.",
    );
  });
});

describe("reportCheckoutError — shipping step", () => {
  it("code=invalid_input indica CEP", () => {
    expect(
      callWith(
        "shipping",
        new ApiResponseError("bad cep", 400, [], "invalid_input"),
      ),
    ).toBe("Confira o CEP informado e tente novamente.");
  });

  it("code=not_supported indica área não atendida", () => {
    expect(
      callWith(
        "shipping",
        new ApiResponseError("not covered", 400, [], "not_supported"),
      ),
    ).toBe("Não atendemos a esse CEP no momento.");
  });

  it("code=provider_unavailable indica transportadoras off", () => {
    expect(
      callWith(
        "shipping",
        new ApiResponseError("down", 502, [], "provider_unavailable"),
      ),
    ).toBe(
      "As transportadoras estão indisponíveis no momento. Tente novamente em alguns minutos.",
    );
  });

  it("code=config_missing cai no fallback de servidor curto", () => {
    expect(
      callWith(
        "shipping",
        new ApiResponseError("misconfig", 500, [], "config_missing"),
      ),
    ).toBe(
      "Não conseguimos calcular o frete agora. Tente novamente em instantes.",
    );
  });

  it("ApiResponseError sem code cai no fallback do step", () => {
    expect(callWith("shipping", new ApiResponseError("?", 400))).toBe(
      "Não foi possível calcular o frete. Tente novamente.",
    );
  });
});

describe("reportCheckoutError — payment_card step", () => {
  it("qualquer erro vira a copy unificada de cartão", () => {
    expect(callWith("payment_card", new Error("Invalid card number"))).toBe(
      "Não foi possível processar o cartão. Confira os dados ou tente outro método de pagamento.",
    );
  });

  it("registra o payload do Brick no metadata do log", () => {
    callWith(
      "payment_card",
      { type: "invalid_card_number", cause: ["x"] },
      { brickPayload: { type: "invalid_card_number" } },
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      "[checkout:payment_card]",
      expect.objectContaining({
        metadata: { brickPayload: { type: "invalid_card_number" } },
      }),
    );
  });
});

describe("reportCheckoutError — payment_pix / payment_boleto", () => {
  it("code=invalid_input pede revisão dos dados", () => {
    expect(
      callWith(
        "payment_pix",
        new ApiResponseError("bad", 400, [], "invalid_input"),
      ),
    ).toBe("Confira os dados de pagamento e tente novamente.");
  });

  it("code=provider_unavailable indica MP indisponível (boleto)", () => {
    expect(
      callWith(
        "payment_boleto",
        new ApiResponseError("down", 502, [], "provider_unavailable"),
      ),
    ).toBe(
      "O Mercado Pago está indisponível no momento. Tente novamente em alguns minutos.",
    );
  });

  it("fallback genérico para PIX", () => {
    expect(callWith("payment_pix", new Error("?"))).toBe(
      "Não foi possível concluir o pedido. Tente novamente.",
    );
  });
});

describe("reportCheckoutError — submit_order", () => {
  it("AbortError ganha copy conservadora (pode ter cobrado)", () => {
    const msg = callWith("submit_order", abortError());
    expect(msg).toContain("demorou demais");
    expect(msg).toContain("Meus pedidos");
  });

  it("code=invalid_input pede revisão dos dados", () => {
    expect(
      callWith(
        "submit_order",
        new ApiResponseError("bad", 400, [], "invalid_input"),
      ),
    ).toBe("Confira os dados de pagamento e tente novamente.");
  });

  it("code=provider_unavailable indica MP fora", () => {
    expect(
      callWith(
        "submit_order",
        new ApiResponseError("mp down", 502, [], "provider_unavailable"),
      ),
    ).toBe(
      "O Mercado Pago está indisponível no momento. Tente novamente em alguns minutos.",
    );
  });

  it("400 sem code pede voltar ao carrinho", () => {
    expect(callWith("submit_order", new ApiResponseError("?", 400))).toBe(
      "Faltam dados ou eles estão inválidos. Volte ao carrinho e refaça o pedido.",
    );
  });

  it("409 indica duplicação", () => {
    expect(callWith("submit_order", new ApiResponseError("dup", 409))).toBe(
      "Detectamos uma duplicação. Atualize a página antes de tentar de novo.",
    );
  });

  it("422 pede verificação", () => {
    expect(callWith("submit_order", new ApiResponseError("?", 422))).toBe(
      "Não conseguimos processar este pedido. Verifique os dados e tente novamente.",
    );
  });

  it("500 cai no fallback de retry curto", () => {
    expect(callWith("submit_order", new ApiResponseError("?", 500))).toBe(
      "Não conseguimos processar o pagamento agora. Tente novamente em instantes.",
    );
  });
});

describe("reportCheckoutError — coupon step", () => {
  it("4xx pede verificar o código", () => {
    expect(callWith("coupon", new ApiResponseError("?", 400))).toBe(
      "Não foi possível validar o cupom. Verifique o código e tente novamente.",
    );
  });

  it("5xx pede tentar mais tarde", () => {
    expect(callWith("coupon", new ApiResponseError("?", 500))).toBe(
      "Não foi possível validar o cupom agora. Tente novamente em instantes.",
    );
  });

  it("fallback genérico", () => {
    expect(callWith("coupon", new Error("?"))).toBe(
      "Não foi possível validar o cupom.",
    );
  });
});

describe("reportCheckoutError — boundary step", () => {
  it("fallback usa copy de recarregar", () => {
    expect(callWith("boundary", new Error("Render bug"))).toBe(
      "Algo deu errado. Recarregue a página e tente novamente.",
    );
  });
});
