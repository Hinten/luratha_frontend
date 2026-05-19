import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";

// --- Module mocks ----------------------------------------------------------
// CartProvider depends on Firebase (db + onSnapshot) and AuthContext. In guest
// mode it never actually subscribes, but the imports still need to resolve.

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
  Timestamp: {
    fromDate: (d: Date) => ({ toDate: () => d }),
  },
}));

vi.mock("@luratha/firestore/clientCartConverter", () => ({
  clientCartConverter: {},
  clientCartItemConverter: {},
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

const itemSize = (input: CartItemInput) =>
  input.variantId ? `${input.productId}__${input.variantId}` : input.productId;

describe("CartContext (guest mode)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with an empty cart", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);
  });

  it("throws if useCart is called outside CartProvider", () => {
    expect(() => renderHook(() => useCart())).toThrow(
      "useCart must be used within a CartProvider",
    );
  });

  it("addItem adds a new item with quantity 1", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      id: itemSize(baseItem),
      productId: "prod-1",
      variantId: "var-m",
      quantity: 1,
      unitPrice: 389,
    });
    expect(result.current.totalItems).toBe(1);
    expect(result.current.totalPrice).toBe(389);
  });

  it("addItem increments quantity for the same productId + variantId", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem);
      await result.current.addItem(baseItem);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.totalItems).toBe(2);
    expect(result.current.totalPrice).toBe(778);
  });

  it("addItem adds separate rows for the same product in different variants", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem);
      await result.current.addItem({
        ...baseItem,
        variantId: "var-g",
        variantSku: "SKU-002",
        variantLabel: "G",
      });
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.totalItems).toBe(2);
  });

  it("addItem can carry an initial quantity greater than 1", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem({ ...baseItem, quantity: 3 });
    });

    expect(result.current.items[0].quantity).toBe(3);
    expect(result.current.totalItems).toBe(3);
  });

  it("removeItem removes the matching row by composite id", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem);
      await result.current.addItem({
        ...baseItem,
        variantId: "var-g",
        variantSku: "SKU-002",
      });
    });

    await act(async () => {
      await result.current.removeItem(itemSize(baseItem));
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].variantId).toBe("var-g");
  });

  it("updateQuantity sets a new quantity", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem);
    });
    await act(async () => {
      await result.current.updateQuantity(itemSize(baseItem), 5);
    });

    expect(result.current.items[0].quantity).toBe(5);
    expect(result.current.totalItems).toBe(5);
  });

  it("updateQuantity with quantity ≤ 0 removes the item", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem);
    });
    await act(async () => {
      await result.current.updateQuantity(itemSize(baseItem), 0);
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("updateQuantity with a negative quantity removes the item", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem);
    });
    await act(async () => {
      await result.current.updateQuantity(itemSize(baseItem), -3);
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("updateQuantity ignores non-integer quantities", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem);
    });
    await act(async () => {
      await result.current.updateQuantity(itemSize(baseItem), 1.5);
    });

    // No change: still at quantity 1
    expect(result.current.items[0].quantity).toBe(1);
  });

  it("clearCart empties all items", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem);
      await result.current.addItem({
        ...baseItem,
        variantId: "var-g",
        variantSku: "SKU-002",
      });
    });

    await act(async () => {
      await result.current.clearCart();
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);
  });

  it("totalPrice computes price × quantity correctly for multiple items", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem); // 389
      await result.current.addItem({
        ...baseItem,
        productId: "prod-2",
        variantId: undefined,
        variantSku: "SKU-OTHER",
        unitPrice: 100,
      }); // 100
    });

    await act(async () => {
      await result.current.updateQuantity(itemSize(baseItem), 3); // 389 * 3 = 1167
    });

    expect(result.current.totalPrice).toBe(1167 + 100);
  });

  it("rejects items with non-positive unit price (Zod validation)", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      // Repository requires moneySchema (gt 0); these should be silently rejected
      // by the validateCartItem call inside the guest builder.
      await expect(
        result.current.addItem({ ...baseItem, unitPrice: 0 }),
      ).rejects.toBeDefined();
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("rejects items with negative unit price", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await expect(
        result.current.addItem({ ...baseItem, unitPrice: -10 }),
      ).rejects.toBeDefined();
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("rejects items with malformed SKU", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await expect(
        result.current.addItem({ ...baseItem, variantSku: "lower-case" }),
      ).rejects.toBeDefined();
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("persists cart to localStorage after adding an item (new v2 key)", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    await act(async () => {
      await result.current.addItem(baseItem);
    });

    const stored = JSON.parse(localStorage.getItem("luratha_cart_v2") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].productId).toBe("prod-1");
    expect(stored[0].variantId).toBe("var-m");
  });

  it("does not load legacy v1 cart data on hydration", () => {
    localStorage.setItem(
      "luratha_cart",
      JSON.stringify([
        { productId: "prod-old", name: "Antigo", price: 100, size: "M", quantity: 1 },
      ]),
    );

    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toHaveLength(0);
  });

  it("discards entries from localStorage that don't match the v2 schema", () => {
    localStorage.setItem(
      "luratha_cart_v2",
      JSON.stringify([
        { productId: "broken", quantity: 1 }, // missing required fields
      ]),
    );

    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toHaveLength(0);
  });
});
