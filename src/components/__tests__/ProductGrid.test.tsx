import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductGrid from "@/src/components/ProductGrid";
import { Product } from "@/src/lib/types";

const mockProducts: Product[] = [
  {
    id: "1",
    name: "Vestido Bordado Floral",
    price: 289,
    imageUrl: "/placeholder-product.jpg",
    categorySlug: "vestidos",
  },
  {
    id: "2",
    name: "Vestido Midi Linho",
    price: 320,
    imageUrl: "/placeholder-product.jpg",
    categorySlug: "vestidos",
  },
];

describe("ProductGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a grid with product cards", () => {
    render(<ProductGrid products={mockProducts} />);
    expect(screen.getByTestId("product-grid")).toBeInTheDocument();
    expect(screen.getByText("Vestido Bordado Floral")).toBeInTheDocument();
    expect(screen.getByText("Vestido Midi Linho")).toBeInTheDocument();
  });

  it("renders the correct number of products", () => {
    render(<ProductGrid products={mockProducts} />);
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);
  });

  it("renders the empty state when no products are provided", () => {
    render(<ProductGrid products={[]} />);
    expect(screen.getByText("Nenhuma peça encontrada")).toBeInTheDocument();
    expect(screen.queryByTestId("product-grid")).not.toBeInTheDocument();
  });

  it("renders empty state message with hint text", () => {
    render(<ProductGrid products={[]} />);
    expect(
      screen.getByText("Tente explorar outras categorias ou volte em breve.")
    ).toBeInTheDocument();
  });
});
