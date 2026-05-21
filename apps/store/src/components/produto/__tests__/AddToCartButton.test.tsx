import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddToCartButton from "@/src/components/produto/AddToCartButton";
import type { CartItemInput } from "@/src/contexts/CartContext";

// CartContext.useCart é mockado pra controlarmos o tempo do addItem.
const addItemMock = vi.fn<(input: CartItemInput) => Promise<void>>();

vi.mock("@/src/contexts/CartContext", () => ({
  useCart: () => ({
    addItem: addItemMock,
    isSyncing: false,
    items: [],
    cart: {},
    totalItems: 0,
    totalPrice: 0,
    isReady: true,
    error: null,
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
  }),
}));

const baseItem: CartItemInput = {
  productId: "prod-1",
  variantId: "var-m",
  variantSku: "SKU-001",
  productSlug: "vestido-floral-sku-001",
  name: "Vestido Floral",
  photoId: "photo-1",
  imageUrl: "https://example.com/img.jpg",
  variantLabel: "M",
  unitPrice: 189,
  currency: "BRL",
  quantity: 1,
};

describe("AddToCartButton", () => {
  it("mostra spinner + 'ADICIONANDO…' + aria-busy enquanto addItem está em flight", async () => {
    const user = userEvent.setup();

    // Promise que controlamos pra segurar o estado busy.
    const deferred: { resolve?: () => void } = {};
    addItemMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          deferred.resolve = () => resolve();
        }),
    );

    render(<AddToCartButton item={baseItem} />);

    const btn = screen.getByRole("button", { name: /adicionar vestido floral/i });
    expect(btn).not.toBeDisabled();
    expect(btn.getAttribute("aria-busy")).toBeNull();
    expect(btn).toHaveTextContent("ADICIONAR AO CARRINHO");

    await user.click(btn);

    // Durante o flight: texto trocou, aria-busy=true, botão disabled.
    await waitFor(() => {
      expect(btn).toHaveAttribute("aria-busy", "true");
    });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/ADICIONANDO/);
    // Spinner SVG presente
    expect(btn.querySelector("svg")).not.toBeNull();

    // Resolve a promessa do addItem.
    deferred.resolve?.();

    // Após resolver: estado "added" mostra checkmark.
    await waitFor(() => {
      expect(btn).toHaveTextContent("✓ ADICIONADO!");
    });
    expect(btn.getAttribute("aria-busy")).toBeNull();
  });
});
