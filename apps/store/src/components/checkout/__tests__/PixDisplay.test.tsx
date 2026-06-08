import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PixDisplay from "@/src/components/checkout/PixDisplay";

const QR_CODE = "00020126580014BR.GOV.BCB.PIX...";

describe("PixDisplay", () => {
  it("renders the QR image with the base64 src and copyable code", () => {
    render(<PixDisplay qrCode={QR_CODE} qrCodeBase64="BASE64DATA" />);
    const qr = screen.getByRole("img", { name: "QR Code para pagamento PIX" });
    expect(qr.getAttribute("src")).toBe("data:image/png;base64,BASE64DATA");
    expect(screen.getByText(QR_CODE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar código" })).toBeInTheDocument();
  });

  it("copies the PIX code via clipboard and updates the button label", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<PixDisplay qrCode={QR_CODE} qrCodeBase64="BASE64DATA" />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));
    expect(writeText).toHaveBeenCalledWith(QR_CODE);
    expect(await screen.findByRole("button", { name: "Copiado!" })).toBeInTheDocument();
  });

  it("shows a manual-copy hint when the clipboard write is denied", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<PixDisplay qrCode={QR_CODE} qrCodeBase64="BASE64DATA" />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Não foi possível copiar automaticamente/,
    );
  });

  it("shows a 'Válido até' line when expiresAt is provided", () => {
    render(
      <PixDisplay
        qrCode={QR_CODE}
        qrCodeBase64="BASE64DATA"
        expiresAt="2026-05-29T14:00:00.000Z"
      />,
    );
    expect(screen.getByText(/Válido até/)).toBeInTheDocument();
  });

  it("omits the 'Válido até' line when expiresAt is absent", () => {
    render(<PixDisplay qrCode={QR_CODE} qrCodeBase64="BASE64DATA" />);
    expect(screen.queryByText(/Válido até/)).toBeNull();
  });
});
