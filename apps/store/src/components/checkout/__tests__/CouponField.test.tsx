import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { logger } from "@luratha/core/logging/logger";
import CouponField from "@/src/components/checkout/CouponField";

vi.mock("@luratha/core/logging/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const ORIGINAL_FETCH = global.fetch;

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
      statusText: ok ? "OK" : "Server error",
    }),
  );
}

describe("CouponField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
  });

  it("disables the submit while the field is empty", () => {
    render(
      <CouponField cartTotal={100} onApplied={vi.fn()} onCleared={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
  });

  it("calls /api/coupons/validate on submit with code and cartTotal", async () => {
    const fetchMock = mockFetch({
      valid: true,
      code: "WELCOME10",
      type: "percentage",
      discount: 10,
    });
    global.fetch = fetchMock;
    const onApplied = vi.fn();
    render(
      <CouponField cartTotal={100} onApplied={onApplied} onCleared={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("Tem um cupom?"), {
      target: { value: "welcome10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/coupons/validate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "welcome10", cartTotal: 100 }),
      }),
    );
    expect(onApplied).toHaveBeenCalledWith({
      code: "WELCOME10",
      discount: 10,
      type: "percentage",
    });
  });

  it("shows the reason returned by the API when valid:false", async () => {
    global.fetch = mockFetch({ valid: false, reason: "Cupom expirado." });
    render(
      <CouponField cartTotal={100} onApplied={vi.fn()} onCleared={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("Tem um cupom?"), {
      target: { value: "OLD" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Cupom expirado.");
  });

  it("surfaces server errors as a friendly alert (5xx)", async () => {
    vi.mocked(logger.error).mockClear();
    global.fetch = mockFetch({ message: "Falha no servidor." }, false, 500);
    render(
      <CouponField cartTotal={100} onApplied={vi.fn()} onCleared={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText("Tem um cupom?"), {
      target: { value: "ANY" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível validar o cupom agora. Tente novamente em instantes.",
    );
    // O erro técnico original deve ter sido logado para rastreio.
    expect(logger.error).toHaveBeenCalledWith(
      "[checkout:coupon]",
      expect.objectContaining({ status: 500, message: "Falha no servidor." }),
    );
  });

  it("renders the applied state with a remove button when a coupon is provided", () => {
    const onCleared = vi.fn();
    render(
      <CouponField
        cartTotal={100}
        applied={{ code: "WELCOME10", discount: 10, type: "percentage" }}
        onApplied={vi.fn()}
        onCleared={onCleared}
      />,
    );
    expect(screen.getByText("Cupom aplicado")).toBeInTheDocument();
    expect(screen.getByText("WELCOME10")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Remover cupom/ }));
    expect(onCleared).toHaveBeenCalledTimes(1);
  });
});
