import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";

// --- Module mocks ----------------------------------------------------------
// Mirror the guest-mode mock setup from CartContext.test.tsx so the provider's
// Firebase/Auth imports resolve without touching the network.
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

// Spy on the analytics helpers — we only assert that the cart fires them with
// the right payload; the helpers themselves are covered by ecommerce tests.
const trackAddToCart = vi.fn();
const trackRemoveFromCart = vi.fn();
vi.mock("@/src/lib/analytics/ecommerce", () => ({
  trackAddToCart: (...args: unknown[]) => trackAddToCart(...args),
  trackRemoveFromCart: (...args: unknown[]) => trackRemoveFromCart(...args),
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

const compositeId = `${baseItem.productId}__${baseItem.variantId}`;

describe("CartContext analytics (guest mode)", () => {
  beforeEach(() => {
    localStorage.clear();
    trackAddToCart.mockClear();
    trackRemoveFromCart.mockClear();
  });

  it("fires add_to_cart with the added line", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem);
    });

    expect(trackAddToCart).toHaveBeenCalledTimes(1);
    expect(trackAddToCart).toHaveBeenCalledWith(
      expect.objectContaining({
        variantSku: "SKU-001",
        name: "Vestido Bordado Floral",
        unitPrice: 389,
      }),
    );
  });

  it("does not fire add_to_cart when the payload fails validation", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await expect(result.current.addItem({ ...baseItem, unitPrice: 0 })).rejects.toBeDefined();
    });

    expect(trackAddToCart).not.toHaveBeenCalled();
  });

  it("fires remove_from_cart with the resolved item", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem);
    });
    await act(async () => {
      await result.current.removeItem(compositeId);
    });

    expect(trackRemoveFromCart).toHaveBeenCalledTimes(1);
    expect(trackRemoveFromCart).toHaveBeenCalledWith(
      expect.objectContaining({
        id: compositeId,
        variantSku: "SKU-001",
        quantity: 1,
        unitPrice: 389,
      }),
    );
  });

  it("does not fire remove_from_cart for an unknown item id", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.removeItem("does-not-exist");
    });

    expect(trackRemoveFromCart).not.toHaveBeenCalled();
  });
});
