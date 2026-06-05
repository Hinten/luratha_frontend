import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import BoletoDisplay from "@/src/components/checkout/BoletoDisplay";

const DIGITABLE_LINE = "34191.79001 01043.510047 91020.150008 4 96510000010000";

describe("BoletoDisplay", () => {
  it("renders the boleto link opening in a new tab and the digitable line", () => {
    render(
      <BoletoDisplay url="https://mp.example.com/boleto.pdf" digitableLine={DIGITABLE_LINE} />,
    );
    const link = screen.getByRole("link", { name: "Abrir boleto em PDF" });
    expect(link.getAttribute("href")).toBe("https://mp.example.com/boleto.pdf");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.getByText(DIGITABLE_LINE)).toBeInTheDocument();
  });

  it("copies the digitable line via clipboard and updates the button label", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <BoletoDisplay url="https://mp.example.com/boleto.pdf" digitableLine={DIGITABLE_LINE} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copiar linha digitável" }));
    expect(writeText).toHaveBeenCalledWith(DIGITABLE_LINE);
    expect(await screen.findByRole("button", { name: "Copiado!" })).toBeInTheDocument();
  });

  it("shows a manual-copy hint when the clipboard write is denied", async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <BoletoDisplay url="https://mp.example.com/boleto.pdf" digitableLine={DIGITABLE_LINE} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copiar linha digitável" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Não foi possível copiar automaticamente/,
    );
  });

  it("omits the digitable line block (and copy button) when not provided", () => {
    render(<BoletoDisplay url="https://mp.example.com/boleto.pdf" />);
    expect(screen.getByRole("link", { name: "Abrir boleto em PDF" })).toBeInTheDocument();
    expect(screen.queryByText(DIGITABLE_LINE)).toBeNull();
    expect(screen.queryByRole("button", { name: "Copiar linha digitável" })).toBeNull();
  });
});
