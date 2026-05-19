import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CartShippingOptions, {
  cartShippingQuoteKey,
} from "@/src/components/shipping/CartShippingOptions";
import type { ShippingQuote } from "@/src/lib/shipping/types";

const QUOTES: ShippingQuote[] = [
  {
    providerId: "melhor-envio",
    serviceCode: "1",
    carrier: "Correios",
    service: "PAC",
    price: 20,
    estimatedDays: 8,
  },
  {
    providerId: "melhor-envio",
    serviceCode: "2",
    carrier: "Correios",
    service: "SEDEX",
    price: 35,
    estimatedDays: 3,
  },
];

function renderOptions(overrides: Partial<React.ComponentProps<typeof CartShippingOptions>> = {}) {
  const onSelect = vi.fn();
  render(
    <CartShippingOptions
      quotes={QUOTES}
      freeShippingThreshold={100}
      subtotal={50}
      loading={false}
      error={false}
      hasPostalCode
      selectedKey=""
      onSelect={onSelect}
      {...overrides}
    />,
  );
  return { onSelect };
}

describe("CartShippingOptions", () => {
  it("asks for the CEP when none was informed", () => {
    renderOptions({ hasPostalCode: false });
    expect(screen.getByText(/Informe seu CEP/i)).toBeInTheDocument();
  });

  it("shows a loading message while quotes are being fetched", () => {
    renderOptions({ loading: true });
    expect(screen.getByText("Calculando frete…")).toBeInTheDocument();
  });

  it("surfaces an alert when quoting fails", () => {
    renderOptions({ error: true });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("lists every quote at full price when below the free-shipping threshold", () => {
    renderOptions({ subtotal: 50 });
    expect(screen.queryByText("Frete grátis")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByText("Correios · PAC")).toBeInTheDocument();
    expect(screen.getByText("Correios · SEDEX")).toBeInTheDocument();
  });

  it("promotes the cheapest quote to a free row when eligible", () => {
    renderOptions({ subtotal: 150 });
    expect(screen.getByText("Frete grátis")).toBeInTheDocument();
    expect(screen.getByText("Grátis")).toBeInTheDocument();
    // O mais barato (PAC) vira a linha grátis; só os demais ficam pagos.
    expect(screen.queryByText("Correios · PAC")).not.toBeInTheDocument();
    expect(screen.getByText("Correios · SEDEX")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("reports the picked option key through onSelect", () => {
    const { onSelect } = renderOptions({ subtotal: 50 });
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[1]);
    expect(onSelect).toHaveBeenCalledWith(cartShippingQuoteKey(QUOTES[1]));
  });
});
