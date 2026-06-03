import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PaymentMethodBadge from "@/src/components/conta/PaymentMethodBadge";

describe("PaymentMethodBadge", () => {
  it("renders the PIX label", () => {
    render(<PaymentMethodBadge method="pix" />);
    expect(screen.getByText("PIX")).toBeInTheDocument();
  });

  it("renders the credit card label", () => {
    render(<PaymentMethodBadge method="credit_card" />);
    expect(screen.getByText("Cartão de crédito")).toBeInTheDocument();
  });

  it("renders the boleto label", () => {
    render(<PaymentMethodBadge method="boleto" />);
    expect(screen.getByText("Boleto bancário")).toBeInTheDocument();
  });
});
