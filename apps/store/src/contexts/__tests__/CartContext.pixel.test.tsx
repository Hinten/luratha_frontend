import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";

// Mesmos mocks de modo-convidado do CartContext.ga4.test.tsx, para resolver os
// imports de Firebase/Auth sem rede.
vi.mock("@/src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    sendPasswordReset: vi.fn(),
  }),
}));

vi.mock("@luratha/firestore/firebaseClient", () => ({
  db: {},
  storage: {},
  getClientAuth: () => ({}),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(() => () => undefined),
  Timestamp: { fromDate: (d: Date) => ({ toDate: () => d }) },
}));

vi.mock("@luratha/firestore/clientCartConverter", () => ({
  clientCartConverter: {},
  clientCartItemConverter: {},
}));

// Espiona só o helper do Pixel — afirmamos que o cart o dispara com a linha
// certa; o helper em si é coberto por pixel-ecommerce.pixel.test.
const trackPixelAddToCart = vi.fn();
vi.mock("@/src/lib/analytics/pixel-ecommerce", () => ({
  trackPixelAddToCart: (...args: unknown[]) => trackPixelAddToCart(...args),
}));

import { CartProvider, useCart, type CartItemInput } from "@/src/contexts/CartContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

const baseItem: CartItemInput = {
  productId: "prod-1",
  variantId: "var-m",
  variantSku: "SKU-001",
  productSlug: "vestido-bordado-sku-001",
  name: "Vestido Bordado Floral",
  photoId: "photo-1",
  imageUrl: "https://example.com/img/vestido.jpg",
  variantLabel: "M",
  unitPrice: 389,
  currency: "BRL",
  quantity: 1,
};

describe("CartContext Meta Pixel (guest mode)", () => {
  beforeEach(() => {
    localStorage.clear();
    trackPixelAddToCart.mockClear();
  });

  it("fires AddToCart (Pixel) with the added line", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    await act(async () => {
      await result.current.addItem(baseItem);
    });

    expect(trackPixelAddToCart).toHaveBeenCalledTimes(1);
    expect(trackPixelAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({ variantSku: "SKU-001", name: "Vestido Bordado Floral" }),
    );
  });

  it("does not fire when the added line fails validation", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    await act(async () => {
      await expect(result.current.addItem({ ...baseItem, unitPrice: 0 })).rejects.toBeDefined();
    });

    expect(trackPixelAddToCart).not.toHaveBeenCalled();
  });
});
