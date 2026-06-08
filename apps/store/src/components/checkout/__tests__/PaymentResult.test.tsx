import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import PaymentResult, {
  PAYMENT_POLL_INTERVAL_MS,
  PAYMENT_POLL_TIMEOUT_MS,
  type PaymentResultData,
} from "@/src/components/checkout/PaymentResult";

const ORDER_ID = "order-xyz";

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

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PaymentResult", () => {
  it("renders PIX QR image, copyable code and 'Aguardando pagamento' badge", () => {
    render(<PaymentResult result={pixResult} orderId={ORDER_ID} />);
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
    render(<PaymentResult result={pixResult} orderId={ORDER_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));
    expect(writeText).toHaveBeenCalledWith("00020126580014BR.GOV.BCB.PIX...");
    expect(await screen.findByRole("button", { name: "Copiado!" })).toBeInTheDocument();
  });

  it("renders boleto link and digitable line", () => {
    render(<PaymentResult result={boletoResult} orderId={ORDER_ID} />);
    const link = screen.getByRole("link", { name: "Abrir boleto em PDF" });
    expect(link.getAttribute("href")).toBe("https://mp.example.com/boleto.pdf");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(
      screen.getByText("34191.79001 01043.510047 91020.150008 4 96510000010000"),
    ).toBeInTheDocument();
  });

  it("renders 'Pagamento aprovado' for an approved card payment", () => {
    render(<PaymentResult result={cardPaid} orderId={ORDER_ID} />);
    expect(screen.getByText("Pagamento aprovado")).toBeInTheDocument();
  });

  it("shows retry button for a failed card payment when onTryAgain is provided (statusDetail oculto)", () => {
    const onTryAgain = vi.fn();
    render(<PaymentResult result={cardFailed} orderId={ORDER_ID} onTryAgain={onTryAgain} />);
    expect(screen.getByText("Falha no pagamento")).toBeInTheDocument();
    // statusDetail é jargão técnico do MP e não deve aparecer pro cliente.
    expect(screen.queryByText("Cartão recusado pelo banco.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar outro método" }));
    expect(onTryAgain).toHaveBeenCalledTimes(1);
  });

  it("hides the retry button when onTryAgain is omitted", () => {
    render(<PaymentResult result={cardFailed} orderId={ORDER_ID} />);
    expect(screen.queryByRole("button", { name: "Tentar outro método" })).toBeNull();
  });

  // ── Polling do artefato pendente (QR do PIX / boleto) ──────────────────────

  describe("polling do artefato pendente", () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    it("PIX pendente mostra 'Gerando…' e renderiza o QR quando o polling o traz", async () => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            jsonResponse({ status: "pending", pix: { qrCode: "PIXCODE", qrCodeBase64: "B64" } }),
          ),
      );

      render(
        <PaymentResult
          result={{ paymentId: "mp-9", paymentMethod: "pix", status: "pending", pixPending: true }}
          orderId={ORDER_ID}
        />,
      );

      // Antes do primeiro poll: bloco "Gerando…", sem QR.
      expect(screen.getByText(/Gerando o QR Code do PIX/)).toBeInTheDocument();
      expect(screen.queryByRole("img", { name: "QR Code para pagamento PIX" })).toBeNull();

      // Primeiro poll (15s) traz o QR.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PAYMENT_POLL_INTERVAL_MS);
      });

      expect(fetch).toHaveBeenCalledWith(`/api/checkout/payment-intent?orderId=${ORDER_ID}`);
      expect(screen.getByRole("img", { name: "QR Code para pagamento PIX" })).toBeInTheDocument();
      expect(screen.queryByText(/Gerando o QR Code do PIX/)).toBeNull();
    });

    it("boleto pendente mostra 'Gerando…' e renderiza o link quando o polling o traz", async () => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            jsonResponse({ status: "pending", boleto: { url: "https://mp.example.com/b.pdf" } }),
          ),
      );

      render(
        <PaymentResult
          result={{
            paymentId: "mp-10",
            paymentMethod: "boleto",
            status: "pending",
            boletoPending: true,
          }}
          orderId={ORDER_ID}
        />,
      );

      expect(screen.getByText(/Gerando o boleto/)).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PAYMENT_POLL_INTERVAL_MS);
      });

      const link = screen.getByRole("link", { name: "Abrir boleto em PDF" });
      expect(link.getAttribute("href")).toBe("https://mp.example.com/b.pdf");
      expect(screen.queryByText(/Gerando o boleto/)).toBeNull();
    });

    it("em análise antifraude mostra 'Pagamento em análise' (não 'Gerando')", () => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(jsonResponse({ status: "pending", underReview: true })),
      );

      render(
        <PaymentResult
          result={{
            paymentId: "mp-12",
            paymentMethod: "pix",
            status: "pending",
            pixPending: true,
            underReview: true,
          }}
          orderId={ORDER_ID}
        />,
      );

      expect(screen.getByText("Pagamento em análise")).toBeInTheDocument();
      expect(screen.queryByText(/Gerando o QR Code do PIX/)).toBeNull();
    });

    it("timeout em análise mostra 'segue em análise' (sem pedir pra atualizar)", async () => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "fetch",
        // Permanece em análise, sem artefato → estoura o teto.
        vi.fn().mockResolvedValue(jsonResponse({ status: "pending", underReview: true })),
      );

      render(
        <PaymentResult
          result={{
            paymentId: "mp-13",
            paymentMethod: "pix",
            status: "pending",
            pixPending: true,
            underReview: true,
          }}
          orderId={ORDER_ID}
        />,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PAYMENT_POLL_TIMEOUT_MS);
      });

      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/Seu pagamento segue em análise/);
      expect(alert).not.toHaveTextContent(/Atualize a página/);
    });

    it("mostra aviso de timeout quando o artefato não vem em 2min", async () => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "fetch",
        // Sempre pendente, sem artefato → estoura o teto.
        vi.fn().mockResolvedValue(jsonResponse({ status: "pending" })),
      );

      render(
        <PaymentResult
          result={{ paymentId: "mp-11", paymentMethod: "pix", status: "pending", pixPending: true }}
          orderId={ORDER_ID}
        />,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PAYMENT_POLL_TIMEOUT_MS);
      });

      expect(screen.getByRole("alert")).toHaveTextContent(
        /Não conseguimos gerar o QR Code do PIX a tempo/,
      );
      expect(screen.queryByRole("img", { name: "QR Code para pagamento PIX" })).toBeNull();
    });

    it("status terminal 'unknown' no polling para cedo e mostra 'em análise' (não espera 2min)", async () => {
      vi.useFakeTimers();
      // O artefato nunca vem; o pagamento caiu no fail-safe `unknown`.
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "unknown" }));
      vi.stubGlobal("fetch", fetchMock);

      render(
        <PaymentResult
          result={{
            paymentId: "mp-14",
            paymentMethod: "pix",
            status: "awaiting_pix",
            pixPending: true,
          }}
          orderId={ORDER_ID}
        />,
      );

      // Primeiro poll (15s) descobre o status terminal.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PAYMENT_POLL_INTERVAL_MS);
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("alert")).toHaveTextContent(/Estamos confirmando seu pagamento/);
      expect(screen.queryByText(/Gerando o QR Code do PIX/)).toBeNull();

      // Avança até o teto: não polla de novo — parou no status terminal.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(PAYMENT_POLL_TIMEOUT_MS);
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("status terminal 'failed' no polling mostra recusa (sem 2min 'Gerando…')", async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "failed" }));
      vi.stubGlobal("fetch", fetchMock);

      render(
        <PaymentResult
          result={{
            paymentId: "mp-15",
            paymentMethod: "boleto",
            status: "awaiting_boleto",
            boletoPending: true,
          }}
          orderId={ORDER_ID}
        />,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PAYMENT_POLL_INTERVAL_MS);
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("alert")).toHaveTextContent(/Não foi possível concluir o pagamento/);
      expect(screen.queryByText(/Gerando o boleto/)).toBeNull();
    });
  });
});
