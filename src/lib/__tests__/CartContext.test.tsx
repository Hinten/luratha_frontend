import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { CartProvider, useCart } from "@/src/contexts/CartContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

const sampleItem = {
  productId: "prod-1",
  name: "Vestido Bordado Floral",
  slug: "vestido-bordado-floral",
  imageUrl: "/images/vestido.jpg",
  price: 389,
  size: "M",
};

describe("CartContext", () => {
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

  it("addItem adds a new item with quantity 1", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(sampleItem);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ ...sampleItem, quantity: 1 });
    expect(result.current.totalItems).toBe(1);
    expect(result.current.totalPrice).toBe(389);
  });

  it("addItem increments quantity for the same productId + size", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(sampleItem);
      result.current.addItem(sampleItem);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
    expect(result.current.totalItems).toBe(2);
    expect(result.current.totalPrice).toBe(778);
  });

  it("addItem adds separate rows for the same product in different sizes", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(sampleItem);
      result.current.addItem({ ...sampleItem, size: "G" });
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.totalItems).toBe(2);
  });

  it("removeItem removes the matching row", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(sampleItem);
      result.current.addItem({ ...sampleItem, size: "G" });
    });

    act(() => {
      result.current.removeItem(sampleItem.productId, "M");
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].size).toBe("G");
  });

  it("updateQuantity sets a new quantity", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(sampleItem);
    });

    act(() => {
      result.current.updateQuantity(sampleItem.productId, "M", 5);
    });

    expect(result.current.items[0].quantity).toBe(5);
    expect(result.current.totalItems).toBe(5);
  });

  it("updateQuantity with quantity ≤ 0 removes the item", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(sampleItem);
    });

    act(() => {
      result.current.updateQuantity(sampleItem.productId, "M", 0);
    });

    expect(result.current.items).toHaveLength(0);
  });

  it("clearCart empties all items", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(sampleItem);
      result.current.addItem({ ...sampleItem, size: "G" });
    });

    act(() => {
      result.current.clearCart();
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);
  });

  it("totalPrice computes price × quantity correctly for multiple items", () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(sampleItem); // 389
      result.current.addItem({ ...sampleItem, productId: "prod-2", size: "P", price: 100 }); // 100
    });

    act(() => {
      result.current.updateQuantity(sampleItem.productId, "M", 3); // 389 * 3 = 1167
    });

    expect(result.current.totalPrice).toBe(1167 + 100);
  });

  it("persists cart to localStorage after adding an item", async () => {
    const { result } = renderHook(() => useCart(), { wrapper });

    act(() => {
      result.current.addItem(sampleItem);
    });

    // Allow React effects to settle
    await act(async () => {});

    const stored = JSON.parse(localStorage.getItem("luratha_cart") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].productId).toBe("prod-1");
  });
});
