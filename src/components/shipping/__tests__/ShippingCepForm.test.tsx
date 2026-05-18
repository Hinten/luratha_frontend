import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ShippingCepForm from "@/src/components/shipping/ShippingCepForm";

const ORIGINAL_FETCH = global.fetch;

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const sampleResponse = {
  destinationPostalCode: "01310-100",
  quotes: [],
  threshold: 100,
  referenceShippingCost: 14,
  divisor: 0.14,
  enabled: true,
};

describe("ShippingCepForm", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    vi.clearAllMocks();
  });

  it("renders the title and the CEP field", () => {
    render(<ShippingCepForm title="Calcular frete" />);
    expect(screen.getByText("Calcular frete")).toBeInTheDocument();
    expect(screen.getByLabelText("CEP de entrega")).toBeInTheDocument();
  });

  it("keeps the submit button disabled until the CEP has 8 digits", () => {
    render(<ShippingCepForm title="Calcular frete" />);
    const button = screen.getByRole("button", { name: "Calcular" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("CEP de entrega"), {
      target: { value: "01310" },
    });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("CEP de entrega"), {
      target: { value: "01310100" },
    });
    expect(button).toBeEnabled();
  });

  it("masks the typed CEP as 99999-999", () => {
    render(<ShippingCepForm title="Calcular frete" />);
    const input = screen.getByLabelText("CEP de entrega") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "01310100" } });
    expect(input.value).toBe("01310-100");
  });

  it("submits the CEP to /api/checkout/shipping in free-shipping-only mode", async () => {
    const fetchMock = mockFetchOk(sampleResponse);
    global.fetch = fetchMock;

    render(<ShippingCepForm title="Calcular frete" />);
    fireEvent.change(screen.getByLabelText("CEP de entrega"), {
      target: { value: "01310100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/checkout/shipping");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      mode: "free-shipping-only",
      postalCode: "01310-100",
    });
  });

  it("surfaces the server error message when the request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "CEP inválido." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<ShippingCepForm title="Calcular frete" />);
    fireEvent.change(screen.getByLabelText("CEP de entrega"), {
      target: { value: "99999999" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("CEP inválido.");
  });
});
