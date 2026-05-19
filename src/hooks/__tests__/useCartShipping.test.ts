import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCartShipping } from "@/src/hooks/useCartShipping";
import {
  clearShippingEstimate,
  saveShippingEstimate,
} from "@/src/lib/shipping/clientStorage";
import type { CartItem } from "@/src/schemas/firestore";
import type { ShippingQuote } from "@/src/lib/shipping/types";

const ORIGINAL_FETCH = global.fetch;

// O hook só lê productId/quantity/unitPrice/dimensions — um parcial basta.
const ITEMS = [
  { productId: "p1", quantity: 2, unitPrice: 50, dimensions: null },
] as unknown as CartItem[];

const QUOTES: ShippingQuote[] = [
  {
    providerId: "melhor-envio",
    serviceCode: "1",
    carrier: "Correios",
    service: "PAC",
    price: 18,
    estimatedDays: 7,
  },
];

function storeCep(postalCode: string) {
  saveShippingEstimate({
    postalCode,
    freeShippingThreshold: null,
    referenceShippingCost: null,
    divisor: 0.14,
    freeShippingEnabled: true,
    quotes: [],
    fetchedAt: new Date().toISOString(),
  });
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useCartShipping", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = ORIGINAL_FETCH;
    vi.clearAllMocks();
  });

  it("does not fetch when no CEP has been informed", () => {
    clearShippingEstimate();
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const { result } = renderHook(() => useCartShipping(ITEMS));

    expect(result.current.loading).toBe(false);
    expect(result.current.quotes).toEqual([]);
    expect(result.current.postalCode).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("quotes shipping for the stored CEP and exposes the result", async () => {
    storeCep("01310-100");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ quotes: QUOTES, freeShippingThreshold: 130 }));
    global.fetch = fetchMock;

    const { result } = renderHook(() => useCartShipping(ITEMS));

    // Antes do debounce: carregando, sem chamada de rede ainda.
    expect(result.current.loading).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/checkout/shipping");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.mode).toBe("quote");
    expect(body.postalCode).toBe("01310-100");
    expect(body.items).toHaveLength(1);

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(false);
    expect(result.current.quotes).toEqual(QUOTES);
    expect(result.current.freeShippingThreshold).toBe(130);
  });

  it("flags an error when the quote endpoint returns no options", async () => {
    storeCep("01310-100");
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ quotes: [], freeShippingThreshold: null }));

    const { result } = renderHook(() => useCartShipping(ITEMS));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(true);
    expect(result.current.quotes).toEqual([]);
  });
});
