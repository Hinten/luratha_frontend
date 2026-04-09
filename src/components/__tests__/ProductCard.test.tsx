import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductCard from "@/src/components/ProductCard";
import { Product } from "@/src/lib/types";

const baseProduct: Product = {
  id: "1",
  name: "Vestido Bordado Floral",
  price: 289,
  imageUrl: "/placeholder-product.jpg",
  categorySlug: "vestidos",
};

const saleProduct: Product = {
  id: "2",
  name: "Blusa Tricô Naturale",
  price: 180,
  originalPrice: 240,
  imageUrl: "/placeholder-product.jpg",
  categorySlug: "blusas",
  isArtisanal: true,
};

describe("ProductCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the product name", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText("Vestido Bordado Floral")).toBeInTheDocument();
  });

  it("renders the formatted price", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText("R$ 289,00")).toBeInTheDocument();
  });

  it("renders the product image with correct alt text", () => {
    render(<ProductCard product={baseProduct} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("alt", "Vestido Bordado Floral");
    expect(img).toHaveAttribute("src", "/placeholder-product.jpg");
  });

  it("does not render the Artesanal badge when isArtisanal is false", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.queryByText("Artesanal")).not.toBeInTheDocument();
  });

  it("renders the Artesanal badge when isArtisanal is true", () => {
    render(<ProductCard product={saleProduct} />);
    expect(screen.getByText("Artesanal")).toBeInTheDocument();
  });

  it("renders the original price when product is on sale", () => {
    render(<ProductCard product={saleProduct} />);
    expect(screen.getByText("R$ 180,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 240,00")).toBeInTheDocument();
  });

  it("renders the discount badge with correct percentage", () => {
    render(<ProductCard product={saleProduct} />);
    expect(screen.getByText("-25%")).toBeInTheDocument();
  });

  it("does not render the discount badge when no originalPrice", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
  });
});
