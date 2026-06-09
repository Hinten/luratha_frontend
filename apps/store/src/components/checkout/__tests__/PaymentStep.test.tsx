import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { logger } from "@luratha/core/logging/logger";
import PaymentStep, {
  type PaymentPayer,
  type PaymentSubmitPayload,
} from "@/src/components/checkout/PaymentStep";

vi.mock("@luratha/core/logging/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// `@mercadopago/sdk-react` carrega o Brick num iframe em mercadopago.com —
// em jsdom isso explode. Mocamos `CardPayment` por um botão de teste que
// dispara `onSubmit` com payload fake; mocamos `initMercadoPago` por no-op.
// Capturamos também o `initialization` recebido pra inspecionar o prefill
// do payer e o `onError` pra exercitar o caminho de erro do Brick.
const brickInit = vi.fn();
const brickCallbacks: {
  onError: ((err: unknown) => void) | undefined;
} = { onError: undefined };
vi.mock("@mercadopago/sdk-react", () => ({
  initMercadoPago: vi.fn(),
  CardPayment: (props: {
    initialization: unknown;
    onSubmit: (formData: unknown) => Promise<void> | void;
    onError?: (err: unknown) => void;
  }) => {
    brickInit.mockImplementation(() => props.initialization);
    brickInit();
    brickCallbacks.onError = props.onError;
    return (
      <button
        type="button"
        data-testid="card-brick-stub"
        onClick={() =>
          props.onSubmit({
            token: "stub-card-token",
            payment_method_id: "master",
            installments: 1,
          })
        }
      >
        Pagar (stub)
      </button>
    );
  },
}));

const PAYER: PaymentPayer = {
  email: "marina@example.com",
  firstName: "Marina",
  lastName: "Souza",
  identification: { type: "CPF", number: "12345678909" },
};

describe("PaymentStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tab PIX (default)", () => {
    it("inicia com PIX selecionado e renderiza heading correto", () => {
      render(<PaymentStep cartTotal={250} payer={PAYER} onSubmit={vi.fn()} onBack={vi.fn()} />);
      expect(screen.getByRole("heading", { name: /Como você quer pagar/i })).toBeInTheDocument();
      const pixTab = screen.getByRole("tab", { name: "PIX" });
      expect(pixTab).toHaveAttribute("aria-selected", "true");
    });

    it("submete PIX usando o payer recebido por prop — sem coletar dados de novo", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn<(payload: PaymentSubmitPayload) => Promise<void>>(async () => {});

      render(<PaymentStep cartTotal={250} payer={PAYER} onSubmit={onSubmit} onBack={vi.fn()} />);

      await user.click(screen.getByRole("button", { name: "Gerar PIX" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const payload = onSubmit.mock.calls[0][0];
      expect(payload.paymentMethod).toBe("pix");
      expect(payload.payer).toEqual(PAYER);
    });
  });

  describe("tab Boleto", () => {
    it("submete boleto com payerAddress derivado do shippingAddress", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn<(payload: PaymentSubmitPayload) => Promise<void>>(async () => {});

      render(
        <PaymentStep
          cartTotal={250}
          payer={PAYER}
          shippingAddress={{
            postalCode: "01310-100",
            line1: "Av. Paulista",
            number: "1000",
            neighborhood: "Bela Vista",
            city: "São Paulo",
            state: "sp",
          }}
          onSubmit={onSubmit}
          onBack={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("tab", { name: "Boleto" }));
      await user.click(screen.getByRole("button", { name: "Gerar boleto" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const payload = onSubmit.mock.calls[0][0];
      expect(payload.paymentMethod).toBe("boleto");
      if (payload.paymentMethod !== "boleto") return;
      expect(payload.payer).toEqual(PAYER);
      expect(payload.payerAddress.federalUnit).toBe("SP");
      expect(payload.payerAddress.streetName).toBe("Av. Paulista");
    });
  });

  describe("tab Cartão (Brick)", () => {
    it("propaga token + cardadados pro onSubmit, payer vem da prop", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn<(payload: PaymentSubmitPayload) => Promise<void>>(async () => {});

      render(<PaymentStep cartTotal={250} payer={PAYER} onSubmit={onSubmit} onBack={vi.fn()} />);

      await user.click(screen.getByRole("tab", { name: "Cartão" }));

      // O Brick (stub) substitui o form local — não há mais botão "Gerar PIX".
      expect(screen.getByTestId("card-brick-stub")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Gerar PIX" })).not.toBeInTheDocument();

      await user.click(screen.getByTestId("card-brick-stub"));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const payload = onSubmit.mock.calls[0][0];
      expect(payload.paymentMethod).toBe("credit_card");
      if (payload.paymentMethod !== "credit_card") return;
      expect(payload.cardToken).toBe("stub-card-token");
      expect(payload.paymentMethodId).toBe("master");
      expect(payload.installments).toBe(1);
      expect(payload.payer).toEqual(PAYER);
    });

    it("inicializa o Brick com initialization.payer prefilled (email, nome, CPF)", async () => {
      const user = userEvent.setup();
      render(<PaymentStep cartTotal={250} payer={PAYER} onSubmit={vi.fn()} onBack={vi.fn()} />);

      await user.click(screen.getByRole("tab", { name: "Cartão" }));

      const init = brickInit.mock.results[0]?.value as {
        amount: number;
        payer: {
          email: string;
          firstName?: string;
          lastName?: string;
          identification: { type: string; number: string };
        };
      };
      expect(init.amount).toBe(250);
      expect(init.payer.email).toBe("marina@example.com");
      expect(init.payer.firstName).toBe("Marina");
      expect(init.payer.lastName).toBe("Souza");
      expect(init.payer.identification).toEqual({ type: "CPF", number: "12345678909" });
    });
  });

  describe("tab Cartão (Brick) — onError", () => {
    async function selectCardTab() {
      const user = userEvent.setup();
      render(<PaymentStep cartTotal={250} payer={PAYER} onSubmit={vi.fn()} onBack={vi.fn()} />);
      await user.click(screen.getByRole("tab", { name: "Cartão" }));
      return user;
    }

    it("brickCause=fields_setup_failed mostra copy de 'recarregue a página'", async () => {
      await selectCardTab();
      vi.mocked(logger.warn).mockClear();

      brickCallbacks.onError?.({
        type: "non_critical",
        message: "fields setup failed",
        cause: "fields_setup_failed",
      });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não conseguimos carregar o formulário de cartão. Recarregue a página ou escolha PIX/Boleto.",
      );
      // Brick errors são objetos plain (não Error) → caem em "unknown" para o
      // mapper de severidade → severity=ERROR (não warn).
      expect(logger.error).toHaveBeenCalledWith(
        "[checkout:payment_card]",
        expect.objectContaining({
          metadata: expect.objectContaining({
            brickCause: "fields_setup_failed",
          }),
        }),
      );
    });

    it("brickCause=card_token_creation_failed mostra copy de 'revisar dados do cartão'", async () => {
      await selectCardTab();

      brickCallbacks.onError?.({
        type: "non_critical",
        message: "tokenize failed",
        cause: "card_token_creation_failed",
      });

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não conseguimos validar os dados do cartão. Confira número, validade e CVV e tente novamente.",
      );
    });

    it("não crasha quando o erro tem getter throwing — banner ainda aparece", async () => {
      await selectCardTab();

      // Brick poderia entregar um erro com `cause` definido via accessor que
      // lança (por exemplo, referenciando DOM removido). Sem try/catch no
      // onError, o throw escaparia e o usuário não veria notificação alguma.
      const malicious: Record<string, unknown> = {
        type: "critical",
        message: "boom",
      };
      Object.defineProperty(malicious, "cause", {
        enumerable: true,
        configurable: true,
        get() {
          throw new Error("getter throws");
        },
      });

      expect(() => brickCallbacks.onError?.(malicious)).not.toThrow();
      // Como `cause` falhou de ler, vai pra copy genérica.
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Não foi possível processar o cartão. Confira os dados ou tente outro método de pagamento.",
      );
      // Log estruturado ainda foi emitido — brickPayload caiu no fallback.
      expect(logger.error).toHaveBeenCalledWith(
        "[checkout:payment_card]",
        expect.objectContaining({
          metadata: expect.objectContaining({
            brickPayload: expect.objectContaining({ unflattenable: true }),
          }),
        }),
      );
    });
  });
});
