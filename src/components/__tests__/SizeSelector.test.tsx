import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SizeSelector from "@/src/components/produto/SizeSelector";

vi.mock("@/src/contexts/CartContext", () => ({
  useCart: () => ({
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
    items: [],
    totalItems: 0,
    totalPrice: 0,
  }),
}));

const sizes = ["PP", "P", "M", "G", "GG"];

describe("SizeSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all size buttons", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" />);
    sizes.forEach((size) => {
      expect(screen.getByRole("button", { name: size })).toBeInTheDocument();
    });
  });

  it("no size is selected by default (aria-pressed=false)", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" />);
    sizes.forEach((size) => {
      expect(screen.getByRole("button", { name: size })).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    });
  });

  it("marks a size as selected when clicked", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" />);
    fireEvent.click(screen.getByRole("button", { name: "M" }));
    expect(screen.getByRole("button", { name: "M" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("shows an error message when 'Adicionar ao Carrinho' is clicked without a size", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" />);
    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar .* ao carrinho/i })
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Selecione um tamanho")).toBeInTheDocument();
  });

  it("clears the error message when a size is selected after the error", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" />);
    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar .* ao carrinho/i })
    );
    expect(screen.getByText("Selecione um tamanho")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "P" }));
    expect(screen.queryByText("Selecione um tamanho")).not.toBeInTheDocument();
  });

  it("does NOT show an error message when a size is selected before clicking add-to-cart", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" />);
    fireEvent.click(screen.getByRole("button", { name: "G" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar .* ao carrinho/i })
    );
    expect(screen.queryByText("Selecione um tamanho")).not.toBeInTheDocument();
  });

  it("renders the favorite button with correct aria-label when not favorited", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" />);
    expect(
      screen.getByRole("button", { name: "Adicionar aos favoritos" })
    ).toBeInTheDocument();
  });

  it("toggles the favorite button state when clicked", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" />);
    const favBtn = screen.getByRole("button", {
      name: "Adicionar aos favoritos",
    });
    fireEvent.click(favBtn);
    expect(
      screen.getByRole("button", { name: "Remover dos favoritos" })
    ).toBeInTheDocument();
  });

  it("renders size options group with aria-label", () => {
    render(<SizeSelector sizes={sizes} productName="Vestido Bordado" />);
    expect(
      screen.getByRole("group", { name: "Selecione o tamanho" })
    ).toBeInTheDocument();
  });
});
