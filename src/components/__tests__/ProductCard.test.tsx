import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductCard from "@/src/components/ProductCard";
import type { Product } from "@/src/lib/types";

vi.mock("./ProductCard.module.css", () => ({
  default: {
    card: "card",
    discountBadge: "discountBadge",
    favoriteBtn: "favoriteBtn",
    imageWrapper: "imageWrapper",
    image: "image",
    info: "info",
    name: "name",
    rating: "rating",
    ratingCount: "ratingCount",
    priceBlock: "priceBlock",
    originalPrice: "originalPrice",
    currentPrice: "currentPrice",
    installments: "installments",
  },
}));

const baseProduct: Product = {
  id: "1",
  name: "Vestido Bordado Floral",
  price: 289,
  imageUrl: "/placeholder-product.jpg",
  categorySlug: "vestidos",
};

const saleProduct: Product = {
  id: "2",
  name: "Conjunto Crochet",
  price: 389,
  originalPrice: 499,
  imageUrl: "/placeholder-sale.jpg",
  rating: 4.9,
  reviewCount: 36,
  installments: { count: 4, value: 97.25 },
  categorySlug: "conjuntos",
};

describe("ProductCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the product name", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText("Vestido Bordado Floral")).toBeInTheDocument();
  });

  it("renders the product image with correct src and alt", () => {
    render(<ProductCard product={baseProduct} />);
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/placeholder-product.jpg");
    expect(img).toHaveAttribute("alt", "Vestido Bordado Floral");
  });

  it("renders the current price formatted as BRL", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText(/R\$\s*289/)).toBeInTheDocument();
  });

  it("does NOT show a discount badge when there is no originalPrice", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
  });

  it("shows a discount badge when originalPrice is provided", () => {
    render(<ProductCard product={saleProduct} />);
    expect(screen.getByText(/-\d+%/)).toBeInTheDocument();
  });

  it("shows the original price (struck-through) when provided", () => {
    render(<ProductCard product={saleProduct} />);
    expect(screen.getByText(/R\$\s*499/)).toBeInTheDocument();
  });

  it("shows the rating when provided", () => {
    render(<ProductCard product={saleProduct} />);
    expect(screen.getByText(/★ 4\.9/)).toBeInTheDocument();
  });

  it("does NOT show rating when not provided", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.queryByText(/★/)).not.toBeInTheDocument();
  });

  it("renders the favorite button", () => {
    render(<ProductCard product={baseProduct} />);
    expect(
      screen.getByRole("button", { name: "Adicionar aos favoritos" })
    ).toBeInTheDocument();
  });

  it("shows installments when provided", () => {
    render(<ProductCard product={saleProduct} />);
    expect(screen.getByText(/4x/)).toBeInTheDocument();
  });
});
