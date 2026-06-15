import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { logger } from "@luratha/core/logging/logger";
import IdentificationStep from "@/src/components/checkout/IdentificationStep";
import type { PaymentPayer } from "@/src/components/checkout/PaymentStep";

vi.mock("@luratha/core/logging/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function mockFetchResponse(init: { ok: boolean; status?: number; body?: unknown }) {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 400),
    json: async () => init.body ?? {},
  } as unknown as Response;
}

describe("IdentificationStep", () => {
  const fetchSpy = vi.fn<(input: RequestInfo, init?: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza os campos pré-preenchidos com os defaults", () => {
    render(
      <IdentificationStep
        userId="user_1"
        defaults={{
          email: "marina@example.com",
          firstName: "Marina",
          lastName: "Souza",
          identificationType: "CPF",
          identificationNumber: "123.456.789-09",
        }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("E-mail")).toHaveValue("marina@example.com");
    expect(screen.getByLabelText("Nome")).toHaveValue("Marina");
    expect(screen.getByLabelText("Sobrenome")).toHaveValue("Souza");
    expect(screen.getByLabelText("Tipo de documento")).toHaveValue("CPF");
    expect(screen.getByLabelText("Número do documento")).toHaveValue("123.456.789-09");
  });

  it("NÃO clobba input em digitação quando defaults resolvem assincronamente", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <IdentificationStep userId="user_1" defaults={{}} onSubmit={vi.fn()} />,
    );

    // User começa a digitar antes do profile carregar.
    const cpfInput = screen.getByLabelText("Número do documento") as HTMLInputElement;
    await user.type(cpfInput, "98765");
    expect(cpfInput.value).toBe("987.65");

    // Profile resolve mid-typing: rerender com defaults carregados.
    rerender(
      <IdentificationStep
        userId="user_1"
        defaults={{
          email: "marina@example.com",
          firstName: "Marina",
          lastName: "Souza",
          identificationType: "CPF",
          identificationNumber: "12345678909",
        }}
        onSubmit={vi.fn()}
      />,
    );

    // Input do user é preservado — defaults não sobrescrevem porque o form
    // já está dirty.
    expect(cpfInput.value).toBe("987.65");
    expect(screen.getByLabelText("E-mail")).toHaveValue("");
  });

  it("re-popula o form quando defaults mudam após o mount", () => {
    const { rerender } = render(
      <IdentificationStep userId="user_1" defaults={{}} onSubmit={vi.fn()} />,
    );

    expect(screen.getByLabelText("E-mail")).toHaveValue("");
    expect(screen.getByLabelText("Nome")).toHaveValue("");

    // Simula o CheckoutFlow descobrindo o profile via fetch async e
    // repassando como defaults.
    rerender(
      <IdentificationStep
        userId="user_1"
        defaults={{
          email: "marina@example.com",
          firstName: "Marina",
          lastName: "Souza",
          identificationType: "CPF",
          identificationNumber: "12345678909",
        }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("E-mail")).toHaveValue("marina@example.com");
    expect(screen.getByLabelText("Nome")).toHaveValue("Marina");
    expect(screen.getByLabelText("Sobrenome")).toHaveValue("Souza");
    // Default veio em dígitos puros — o form re-aplica a máscara.
    expect(screen.getByLabelText("Número do documento")).toHaveValue("123.456.789-09");
  });

  it("aplica máscara CPF enquanto o usuário digita dígitos puros", async () => {
    const user = userEvent.setup();
    render(
      <IdentificationStep
        userId="user_1"
        defaults={{ email: "m@e.com", firstName: "M", lastName: "S" }}
        onSubmit={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Número do documento") as HTMLInputElement;
    await user.type(input, "12345678909");
    expect(input.value).toBe("123.456.789-09");
  });

  it("aplica máscara CNPJ ao trocar o tipo de documento", async () => {
    const user = userEvent.setup();
    render(
      <IdentificationStep
        userId="user_1"
        defaults={{ email: "m@e.com", firstName: "M", lastName: "S" }}
        onSubmit={vi.fn()}
      />,
    );

    // Troca pra CNPJ primeiro, depois digita.
    await user.selectOptions(screen.getByLabelText("Tipo de documento"), "CNPJ");

    const input = screen.getByLabelText("Número do documento") as HTMLInputElement;
    await user.type(input, "12345678000190");
    expect(input.value).toBe("12.345.678/0001-90");
  });

  it("aplica máscara CNPJ alfanumérico maiusculizando as letras", async () => {
    const user = userEvent.setup();
    render(
      <IdentificationStep
        userId="user_1"
        defaults={{ email: "m@e.com", firstName: "M", lastName: "S" }}
        onSubmit={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Tipo de documento"), "CNPJ");

    const input = screen.getByLabelText("Número do documento") as HTMLInputElement;
    await user.type(input, "12abc34501de35");
    expect(input.value).toBe("12.ABC.345/01DE-35");
  });

  it("preserva valor cru ao trocar de CNPJ pra CPF quando excede 11 dígitos", async () => {
    const user = userEvent.setup();
    render(
      <IdentificationStep
        userId="user_1"
        defaults={{
          email: "m@e.com",
          firstName: "M",
          lastName: "S",
          identificationType: "CNPJ",
          identificationNumber: "12345678000190",
        }}
        onSubmit={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Número do documento") as HTMLInputElement;
    expect(input.value).toBe("12.345.678/0001-90");

    await act(async () => {
      await user.selectOptions(screen.getByLabelText("Tipo de documento"), "CPF");
    });

    // CNPJ → CPF preserva os 14 dígitos (mascarados pelo formato CNPJ ainda)
    // em vez de truncar pra 11. Zod no submit bloqueia o avanço se o user
    // não corrigir, mas dados não são perdidos silenciosamente.
    expect(input.value).toBe("12.345.678/0001-90");
  });

  it("re-formata o número ao trocar de CPF pra CNPJ preservando dígitos", async () => {
    const user = userEvent.setup();
    render(
      <IdentificationStep
        userId="user_1"
        defaults={{
          email: "m@e.com",
          firstName: "M",
          lastName: "S",
          identificationType: "CPF",
          identificationNumber: "12345678909",
        }}
        onSubmit={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Número do documento") as HTMLInputElement;
    expect(input.value).toBe("123.456.789-09");

    await act(async () => {
      await user.selectOptions(screen.getByLabelText("Tipo de documento"), "CNPJ");
    });

    // CPF 11 dígitos com máscara CNPJ: "12.345.678/909" (não chega a hífen).
    expect(input.value).toBe("12.345.678/909");
  });

  it("bloqueia submit quando o CPF tem menos de 11 dígitos", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <IdentificationStep
        userId="user_1"
        defaults={{ email: "marina@example.com", firstName: "Marina", lastName: "Souza" }}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Número do documento"), "123");
    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByText(/CPF deve ter 11 dígitos/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("bloqueia submit quando o CPF tem dígitos verificadores inválidos", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <IdentificationStep
        userId="user_1"
        defaults={{ email: "marina@example.com", firstName: "Marina", lastName: "Souza" }}
        onSubmit={onSubmit}
      />,
    );

    // 11 dígitos, mas DVs errados (sequência repetida).
    await user.type(screen.getByLabelText("Número do documento"), "11111111111");
    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByText(/CPF inválido/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("bloqueia submit quando o CNPJ tem dígitos verificadores inválidos", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <IdentificationStep
        userId="user_1"
        defaults={{
          email: "marina@example.com",
          firstName: "Marina",
          lastName: "Souza",
          identificationType: "CNPJ",
        }}
        onSubmit={onSubmit}
      />,
    );

    // 14 dígitos, mas DV correto seria "-95".
    await user.type(screen.getByLabelText("Número do documento"), "12345678000190");
    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByText(/CNPJ inválido/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("bloqueia submit quando o email tem múltiplos @", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <IdentificationStep
        userId="user_1"
        defaults={{ firstName: "Marina", lastName: "Souza", identificationNumber: "12345678909" }}
        onSubmit={onSubmit}
      />,
    );

    // Email patológico da issue #160 — quebraria o withSandboxEmail do
    // adapter MercadoPago se chegasse lá.
    await user.type(screen.getByLabelText("E-mail"), "a@b@c.com");
    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByText(/E-mail inválido/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("bloqueia submit quando o email é inválido", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <IdentificationStep
        userId="user_1"
        defaults={{ firstName: "Marina", lastName: "Souza", identificationNumber: "12345678909" }}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("E-mail"), "not-an-email");
    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByText(/E-mail inválido/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submit OK: faz PATCH /api/users/{id} e chama onSubmit com payer normalizado", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(payer: PaymentPayer) => void>();
    fetchSpy.mockResolvedValue(mockFetchResponse({ ok: true }));

    render(
      <IdentificationStep
        userId="user_42"
        defaults={{
          email: "marina@example.com",
          firstName: "Marina",
          lastName: "Souza",
          identificationType: "CPF",
          identificationNumber: "123.456.789-09",
        }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/users/user_42");
    expect(init?.method).toBe("PATCH");
    const body = JSON.parse(String(init?.body)) as {
      lastName: string;
      taxIdentity: { type: string; cpf: string };
    };
    expect(body.lastName).toBe("Souza");
    expect(body.taxIdentity).toEqual({ type: "PF", cpf: "123.456.789-09" });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const payer = onSubmit.mock.calls[0][0];
    expect(payer.email).toBe("marina@example.com");
    expect(payer.identification.number).toBe("12345678909");
    expect(payer.identification.type).toBe("CPF");
  });

  it("submit OK com CNPJ alfanumérico: payer leva o número sem máscara em maiúsculas", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(payer: PaymentPayer) => void>();
    fetchSpy.mockResolvedValue(mockFetchResponse({ ok: true }));

    render(
      <IdentificationStep
        userId="user_42"
        defaults={{
          email: "loja@example.com",
          firstName: "Marina",
          lastName: "Souza",
          identificationType: "CNPJ",
          identificationNumber: "12.ABC.345/01DE-35",
        }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const payer = onSubmit.mock.calls[0][0];
    expect(payer.identification).toEqual({ type: "CNPJ", number: "12ABC34501DE35" });
    // CNPJ não persiste taxIdentity (form não coleta legalName/IE).
    const [, init] = fetchSpy.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({ lastName: "Souza" });
  });

  it("submit com PATCH 404: faz fallback pra PUT criando o perfil completo", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(payer: PaymentPayer) => void>();
    fetchSpy
      .mockResolvedValueOnce(
        mockFetchResponse({ ok: false, status: 404, body: { message: "Perfil não encontrado." } }),
      )
      .mockResolvedValueOnce(mockFetchResponse({ ok: true, status: 201 }));

    render(
      <IdentificationStep
        userId="user_42"
        defaults={{
          email: "marina@example.com",
          firstName: "Marina",
          lastName: "Souza",
          identificationType: "CPF",
          identificationNumber: "12345678909",
        }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    const [, patchInit] = fetchSpy.mock.calls[0];
    expect(patchInit?.method).toBe("PATCH");

    const [putUrl, putInit] = fetchSpy.mock.calls[1];
    expect(putUrl).toBe("/api/users/user_42");
    expect(putInit?.method).toBe("PUT");
    const putBody = JSON.parse(String(putInit?.body)) as {
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      taxIdentity: { type: string; cpf: string };
    };
    expect(putBody.email).toBe("marina@example.com");
    expect(putBody.firstName).toBe("Marina");
    expect(putBody.lastName).toBe("Souza");
    expect(putBody.role).toBe("customer");
    expect(putBody.taxIdentity).toEqual({ type: "PF", cpf: "123.456.789-09" });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it("submit com PATCH 404 + PUT 4xx: exibe mensagem amigável e loga 400 como WARN", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    vi.mocked(logger.warn).mockClear();
    fetchSpy
      .mockResolvedValueOnce(mockFetchResponse({ ok: false, status: 404 }))
      .mockResolvedValueOnce(
        mockFetchResponse({ ok: false, status: 400, body: { message: "CPF inválido no perfil." } }),
      );

    render(
      <IdentificationStep
        userId="user_42"
        defaults={{
          email: "marina@example.com",
          firstName: "Marina",
          lastName: "Souza",
          identificationType: "CPF",
          identificationNumber: "12345678909",
        }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByText(/CPF\/CNPJ ou e-mail parecem inválidos/i)).toBeInTheDocument();
    });
    // 4xx do cliente vira severity WARN (CartContext convention).
    expect(logger.warn).toHaveBeenCalledWith(
      "[checkout:identification]",
      expect.objectContaining({ status: 400, message: "CPF inválido no perfil." }),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submit com PATCH 4xx (não-404): exibe mensagem amigável e loga 400 como WARN", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    vi.mocked(logger.warn).mockClear();
    fetchSpy.mockResolvedValue(
      mockFetchResponse({
        ok: false,
        status: 400,
        body: { message: "CPF já cadastrado em outra conta." },
      }),
    );

    render(
      <IdentificationStep
        userId="user_42"
        defaults={{
          email: "marina@example.com",
          firstName: "Marina",
          lastName: "Souza",
          identificationType: "CPF",
          identificationNumber: "12345678909",
        }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByText(/CPF\/CNPJ ou e-mail parecem inválidos/i)).toBeInTheDocument();
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "[checkout:identification]",
      expect.objectContaining({
        status: 400,
        message: "CPF já cadastrado em outra conta.",
      }),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submit com falha de rede (TypeError): exibe mensagem amigável de conexão", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"));

    render(
      <IdentificationStep
        userId="user_42"
        defaults={{
          email: "marina@example.com",
          firstName: "Marina",
          lastName: "Souza",
          identificationType: "CPF",
          identificationNumber: "12345678909",
        }}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByText(/conexão/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
