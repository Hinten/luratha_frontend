import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentStep, {
  type PaymentSubmitPayload,
} from "@/src/components/checkout/PaymentStep";

// `mountCardForm` carregaria o SDK MP no browser (network + iframes) — em
// jsdom isso explode. Stubamos retornando um handle inerte; o ramo Cartão
// é coberto por outras camadas. Os testes deste arquivo focam no CPF e no
// fluxo PIX (que NÃO precisa do cardForm).
const cardFormHandleStub = {
  submit: vi.fn(),
  unmount: vi.fn(),
};

vi.mock("@/src/lib/mercadopago/cardForm", async () => {
  const actual = await vi.importActual<
    typeof import("@/src/lib/mercadopago/cardForm")
  >("@/src/lib/mercadopago/cardForm");
  return {
    ...actual,
    mountCardForm: vi.fn(async () => cardFormHandleStub),
  };
});

describe("PaymentStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CPF / identificationNumber", () => {
    it("renderiza o input sem máscara — placeholder de zeros e helper text", () => {
      render(
        <PaymentStep
          cartTotal={250}
          onSubmit={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const cpfInput = screen.getByLabelText("Número do documento") as HTMLInputElement;
      // Placeholder mostra só dígitos, sem `.` ou `-`.
      expect(cpfInput.placeholder).toBe("00000000000");
      expect(cpfInput.inputMode).toBe("numeric");
      expect(cpfInput.getAttribute("pattern")).toBe("\\d*");
      expect(cpfInput.maxLength).toBe(14);
      // Helper text orienta usuário a digitar só números.
      expect(screen.getByText(/apenas números/i)).toBeInTheDocument();
    });

    it("não aplica máscara ao digitar — o `.value` segue raw", async () => {
      const user = userEvent.setup();
      render(
        <PaymentStep
          cartTotal={250}
          onSubmit={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const cpfInput = screen.getByLabelText("Número do documento") as HTMLInputElement;
      await user.type(cpfInput, "12345678909");
      // Sem máscara: 11 dígitos puros (nada de `123.456.789-09`).
      expect(cpfInput.value).toBe("12345678909");
    });

    it("submit PIX envia identification.number como dígitos puros", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn<(payload: PaymentSubmitPayload) => Promise<void>>(
        async () => {},
      );

      render(
        <PaymentStep
          cartTotal={250}
          defaultFirstName="Marina"
          defaultLastName="Souza"
          defaultEmail="marina@example.com"
          onSubmit={onSubmit}
          onBack={vi.fn()}
        />,
      );

      const cpfInput = screen.getByLabelText("Número do documento") as HTMLInputElement;
      await user.type(cpfInput, "12345678909");

      // PIX é o método default (tab selecionada inicialmente).
      const submitBtn = screen.getByRole("button", { name: "Confirmar pagamento" });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const payload = onSubmit.mock.calls[0][0];
      expect(payload.paymentMethod).toBe("pix");
      expect(payload.payer.identification.number).toBe("12345678909");
      expect(payload.payer.identification.type).toBe("CPF");
      expect(payload.payer.email).toBe("marina@example.com");
    });

    it("rejeita CPF com menos de 11 dígitos via schema Zod", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(
        <PaymentStep
          cartTotal={250}
          defaultEmail="marina@example.com"
          defaultFirstName="Marina"
          defaultLastName="Souza"
          onSubmit={onSubmit}
          onBack={vi.fn()}
        />,
      );

      const cpfInput = screen.getByLabelText("Número do documento") as HTMLInputElement;
      await user.type(cpfInput, "123");

      await user.click(screen.getByRole("button", { name: "Confirmar pagamento" }));

      await waitFor(() => {
        expect(screen.getByText(/CPF deve ter 11 dígitos/i)).toBeInTheDocument();
      });
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("ramo PIX", () => {
    it("inicia com PIX selecionado e renderiza heading correto", () => {
      render(
        <PaymentStep cartTotal={250} onSubmit={vi.fn()} onBack={vi.fn()} />,
      );
      expect(
        screen.getByRole("heading", { name: /Como você quer pagar/i }),
      ).toBeInTheDocument();
      const pixTab = screen.getByRole("tab", { name: "PIX" });
      expect(pixTab).toHaveAttribute("aria-selected", "true");
    });
  });
});
