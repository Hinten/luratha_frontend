import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PaymentResult, {
  type PaymentResultData,
} from "@/src/components/checkout/PaymentResult";

const pixResult: PaymentResultData = {
  paymentId: "mp-001",
  paymentMethod: "pix",
  status: "pending",
  pix: {
    qrCode: "00020126580014BR.GOV.BCB.PIX...",
    qrCodeBase64: "BASE64DATA",
    expiresAt: "2026-05-21T14:00:00.000Z",
  },
};

const boletoResult: PaymentResultData = {
  paymentId: "mp-002",
  paymentMethod: "boleto",
  status: "pending",
  boleto: {
    url: "https://mp.example.com/boleto.pdf",
    digitableLine: "34191.79001 01043.510047 91020.150008 4 96510000010000",
  },
};

const cardPaid: PaymentResultData = {
  paymentId: "mp-003",
  paymentMethod: "credit_card",
  status: "paid",
};

const cardFailed: PaymentResultData = {
  paymentId: "mp-004",
  paymentMethod: "credit_card",
  status: "failed",
  statusDetail: "Cartão recusado pelo banco.",
};

describe("PaymentResult", () => {
  it("renders PIX QR image, copyable code and 'Aguardando pagamento' badge", () => {
    render(<PaymentResult result={pixResult} />);
    expect(screen.getByText("Aguardando pagamento")).toBeInTheDocument();
    const qr = screen.getByRole("img", { name: "QR Code para pagamento PIX" });
    expect(qr.getAttribute("src")).toBe("data:image/png;base64,BASE64DATA");
    expect(screen.getByText("00020126580014BR.GOV.BCB.PIX...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar código" })).toBeInTheDocument();
  });

  it("copies the PIX code via clipboard and updates the button label", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<PaymentResult result={pixResult} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));
    expect(writeText).toHaveBeenCalledWith("00020126580014BR.GOV.BCB.PIX...");
    expect(await screen.findByRole("button", { name: "Copiado!" })).toBeInTheDocument();
  });

  it("renders boleto link and digitable line", () => {
    render(<PaymentResult result={boletoResult} />);
    const link = screen.getByRole("link", { name: "Abrir boleto em PDF" });
    expect(link.getAttribute("href")).toBe("https://mp.example.com/boleto.pdf");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(
      screen.getByText("34191.79001 01043.510047 91020.150008 4 96510000010000"),
    ).toBeInTheDocument();
  });

  it("renders 'Pagamento aprovado' for an approved card payment", () => {
    render(<PaymentResult result={cardPaid} />);
    expect(screen.getByText("Pagamento aprovado")).toBeInTheDocument();
  });

  it("shows retry button for a failed card payment when onTryAgain is provided (statusDetail oculto)", () => {
    const onTryAgain = vi.fn();
    render(<PaymentResult result={cardFailed} onTryAgain={onTryAgain} />);
    expect(screen.getByText("Pagamento recusado")).toBeInTheDocument();
    // statusDetail é jargão técnico do MP e não deve aparecer pro cliente.
    expect(screen.queryByText("Cartão recusado pelo banco.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar outro método" }));
    expect(onTryAgain).toHaveBeenCalledTimes(1);
  });

  it("hides the retry button when onTryAgain is omitted", () => {
    render(<PaymentResult result={cardFailed} />);
    expect(
      screen.queryByRole("button", { name: "Tentar outro método" }),
    ).toBeNull();
  });
});
