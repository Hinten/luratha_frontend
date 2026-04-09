import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductCard from "@/src/components/ProductCard";
import type { Product } from "@/src/lib/types";

const baseProduct: Product = {
  id: "1",
  name: "Vestido Teste",
  slug: "vestido-teste",
  price: 199.9,
  imageUrl: "https://placehold.co/400x500/EDE4D9/3A2F2A?text=Teste",
};

const productWithDiscount: Product = {
  ...baseProduct,
  originalPrice: 299.9,
  rating: 4.5,
  reviewCount: 20,
  installments: { count: 3, value: 66.63 },
};

describe("ProductCard", () => {
  it("renders product name", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText("Vestido Teste")).toBeInTheDocument();
  });

  it("renders product image with alt text", () => {
    render(<ProductCard product={baseProduct} />);
    const img = screen.getByAltText("Vestido Teste");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", baseProduct.imageUrl);
  });

  it("renders formatted price in BRL", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText(/R\$\s*199,90/)).toBeInTheDocument();
  });

  it("renders favorite button with aria-label", () => {
    render(<ProductCard product={baseProduct} />);
    expect(
      screen.getByRole("button", { name: "Favoritar Vestido Teste" })
    ).toBeInTheDocument();
  });

  it("does not show discount badge when no originalPrice", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
  });

  it("shows discount badge when originalPrice > price", () => {
    render(<ProductCard product={productWithDiscount} />);
    expect(screen.getByText(/-33%/)).toBeInTheDocument();
  });

  it("shows original price crossed out when discounted", () => {
    render(<ProductCard product={productWithDiscount} />);
    expect(screen.getByText(/R\$\s*299,90/)).toBeInTheDocument();
  });

  it("renders rating when provided", () => {
    render(<ProductCard product={productWithDiscount} />);
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(20)")).toBeInTheDocument();
  });

  it("does not render rating when not provided", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
  });

  it("renders installment text when provided", () => {
    render(<ProductCard product={productWithDiscount} />);
    expect(screen.getByText(/3x.*sem juros/i)).toBeInTheDocument();
  });
});
