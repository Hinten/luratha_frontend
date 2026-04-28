import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import AddToCartButton from "@/src/components/produto/AddToCartButton";

const mockAddItem = vi.fn();

vi.mock("@/src/contexts/CartContext", () => ({
  useCart: () => ({
    addItem: mockAddItem,
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
    items: [],
    totalItems: 0,
    totalPrice: 0,
  }),
}));

const defaultProps = {
  productId: "prod-1",
  name: "Vestido Bordado",
  slug: "vestido-bordado",
  imageUrl: "/img/vestido.jpg",
  price: 389,
  size: "M",
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
    render(<AddToCartButton {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Adicionar Vestido Bordado ao carrinho" })
    ).toBeInTheDocument();
  });

  it("shows 'ADICIONAR AO CARRINHO' initially", () => {
    render(<AddToCartButton {...defaultProps} />);
    expect(screen.getByRole("button")).toHaveTextContent("ADICIONAR AO CARRINHO");
  });

  it("calls addItem with the correct arguments on click", () => {
    render(<AddToCartButton {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }));
    expect(mockAddItem).toHaveBeenCalledWith({
      productId: "prod-1",
      name: "Vestido Bordado",
      slug: "vestido-bordado",
      imageUrl: "/img/vestido.jpg",
      price: 389,
      size: "M",
    });
  });

  it("calls addItem quantity times when quantity > 1", () => {
    render(<AddToCartButton {...defaultProps} quantity={3} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }));
    expect(mockAddItem).toHaveBeenCalledTimes(3);
  });

  it("shows '✓ ADICIONADO!' feedback after click", () => {
    render(<AddToCartButton {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }));
    expect(screen.getByRole("button")).toHaveTextContent("✓ ADICIONADO!");
  });

  it("reverts text back after 2500ms", () => {
    render(<AddToCartButton {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }));
    expect(screen.getByRole("button")).toHaveTextContent("✓ ADICIONADO!");
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByRole("button")).toHaveTextContent("ADICIONAR AO CARRINHO");
  });

  it("does not call addItem when disabled", () => {
    render(<AddToCartButton {...defaultProps} disabled />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }));
    expect(mockAddItem).not.toHaveBeenCalled();
  });

  it("does not call addItem when onBeforeAdd returns false", () => {
    render(<AddToCartButton {...defaultProps} onBeforeAdd={() => false} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }));
    expect(mockAddItem).not.toHaveBeenCalled();
  });

  it("calls addItem when onBeforeAdd returns true", () => {
    render(<AddToCartButton {...defaultProps} onBeforeAdd={() => true} />);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar .* ao carrinho/i }));
    expect(mockAddItem).toHaveBeenCalledTimes(1);
  });
});
