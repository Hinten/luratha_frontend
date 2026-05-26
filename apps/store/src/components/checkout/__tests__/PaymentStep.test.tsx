import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentStep, {
  type PaymentSubmitPayload,
} from "@/src/components/checkout/PaymentStep";

// `@mercadopago/sdk-react` carrega o Brick num iframe em mercadopago.com —
// em jsdom isso explode. Mocamos `CardPayment` por um botão de teste que
// dispara `onSubmit` com payload fake; mocamos `initMercadoPago` por no-op.
const brickSubmit = vi.fn();
vi.mock("@mercadopago/sdk-react", () => ({
  initMercadoPago: vi.fn(),
  CardPayment: (props: {
    onSubmit: (formData: unknown) => Promise<void> | void;
  }) => {
    brickSubmit.mockImplementation(props.onSubmit);
    return (
      <button
        type="button"
        data-testid="card-brick-stub"
        onClick={() =>
          props.onSubmit({
            token: "stub-card-token",
            payment_method_id: "master",
            installments: 1,
            payer: {
              email: "card-payer@testuser.com",
              identification: { type: "CPF", number: "12345678909" },
            },
          })
        }
      >
        Pagar (stub)
      </button>
    );
  },
}));

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
      expect(cpfInput.placeholder).toBe("00000000000");
      expect(cpfInput.inputMode).toBe("numeric");
      expect(cpfInput.getAttribute("pattern")).toBe("\\d*");
      expect(cpfInput.maxLength).toBe(14);
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

  describe("tab PIX (default)", () => {
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

  describe("tab Cartão (Brick)", () => {
    it("renderiza o Brick e propaga token + payer pro onSubmit", async () => {
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

      await user.click(screen.getByRole("tab", { name: "Cartão" }));

      // O Brick (stub) substitui o form local — sem botão "Confirmar pagamento".
      expect(screen.getByTestId("card-brick-stub")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Confirmar pagamento" }),
      ).not.toBeInTheDocument();

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
      expect(payload.payer.email).toBe("card-payer@testuser.com");
      expect(payload.payer.identification.number).toBe("12345678909");
    });
  });
});
