import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PriceBlock from "@/src/components/PriceBlock";

describe("PriceBlock", () => {
  it("renders the current price formatted in BRL", () => {
    render(<PriceBlock price={289} />);
    expect(screen.getByText(/R\$\s*289/)).toBeInTheDocument();
  });

  it("does NOT render a discount badge when there is no originalPrice", () => {
    render(<PriceBlock price={289} />);
    expect(screen.queryByText(/OFF/)).not.toBeInTheDocument();
  });

  it("renders a discount badge when originalPrice is provided", () => {
    render(<PriceBlock price={289} originalPrice={389} />);
    expect(screen.getByText(/OFF/)).toBeInTheDocument();
  });

  it("calculates the discount percentage correctly", () => {
    render(<PriceBlock price={289} originalPrice={389} />);
    // (389 - 289) / 389 * 100 = ~25.7% → rounds to 26%
    expect(screen.getByText(/26%\s*OFF/)).toBeInTheDocument();
  });

  it("renders the original price struck-through when provided", () => {
    render(<PriceBlock price={289} originalPrice={389} />);
    expect(screen.getByText(/R\$\s*389/)).toBeInTheDocument();
  });

  it("renders installment text when provided", () => {
    render(
      <PriceBlock price={289} installments={{ count: 3, value: 96.33 }} />
    );
    expect(screen.getByText(/3x/)).toBeInTheDocument();
    expect(screen.getByText(/sem juros/)).toBeInTheDocument();
  });

  it("does NOT render installments when not provided", () => {
    render(<PriceBlock price={289} />);
    expect(screen.queryByText(/sem juros/)).not.toBeInTheDocument();
  });
});
