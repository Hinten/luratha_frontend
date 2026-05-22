import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import AddToCartButton from "@/src/components/produto/AddToCartButton";
import type { CartItemInput } from "@/src/contexts/CartContext";

const mockAddItem = vi.fn().mockResolvedValue(undefined);

vi.mock("@/src/contexts/CartContext", () => ({
  useCart: () => ({
    addItem: mockAddItem,
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
    items: [],
    cart: { itemCount: 0, subtotal: 0 },
    totalItems: 0,
    totalPrice: 0,
    isReady: true,
    isSyncing: false,
    error: null,
  }),
}));

const sampleItem: CartItemInput = {
  productId: "prod-1",
  variantId: "var-1",
  variantSku: "SKU-001",
  productSlug: "vestido-bordado-sku-001",
  name: "Vestido Bordado",
  photoId: "photo-1",
  imageUrl: "https://example.com/img/vestido.jpg",
  variantLabel: "Azul / M",
  unitPrice: 389,
  currency: "BRL",
  quantity: 1,
};

describe("AddToCartButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders with the correct aria-label", () => {
    render(<AddToCartButton item={sampleItem} />);
    expect(
      screen.getByRole("button", { name: "Adicionar Vestido Bordado ao carrinho" }),
    ).toBeInTheDocument();
  });

  it("shows 'ADICIONAR AO CARRINHO' initially", () => {
    render(<AddToCartButton item={sampleItem} />);
    expect(screen.getByRole("button")).toHaveTextContent("ADICIONAR AO CARRINHO");
  });

  it("calls addItem with the full item payload on click", async () => {
    render(<AddToCartButton item={sampleItem} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }),
      );
    });
    expect(mockAddItem).toHaveBeenCalledWith(sampleItem);
  });

  it("shows '✓ ADICIONADO!' feedback after click", async () => {
    render(<AddToCartButton item={sampleItem} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }),
      );
    });
    expect(screen.getByRole("button")).toHaveTextContent("✓ ADICIONADO!");
  });

  it("reverts text back after 2500ms", async () => {
    render(<AddToCartButton item={sampleItem} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }),
      );
    });
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByRole("button")).toHaveTextContent("ADICIONAR AO CARRINHO");
  });

  it("does not call addItem when disabled", () => {
    render(<AddToCartButton item={sampleItem} disabled />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }));
    expect(mockAddItem).not.toHaveBeenCalled();
  });

  it("does not call addItem when onBeforeAdd returns false", () => {
    render(<AddToCartButton item={sampleItem} onBeforeAdd={() => false} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }));
    expect(mockAddItem).not.toHaveBeenCalled();
  });

  it("calls addItem when onBeforeAdd returns true", async () => {
    render(<AddToCartButton item={sampleItem} onBeforeAdd={() => true} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }),
      );
    });
    expect(mockAddItem).toHaveBeenCalledTimes(1);
  });
});
