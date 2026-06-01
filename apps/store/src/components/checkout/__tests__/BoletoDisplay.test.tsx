import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("omits the digitable line block when not provided", () => {
    render(<BoletoDisplay url="https://mp.example.com/boleto.pdf" />);
    expect(screen.getByRole("link", { name: "Abrir boleto em PDF" })).toBeInTheDocument();
    expect(screen.queryByText(DIGITABLE_LINE)).toBeNull();
  });
});
