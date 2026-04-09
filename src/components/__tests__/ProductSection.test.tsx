import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductSection from "@/src/components/ProductSection";
import type { Product } from "@/src/lib/types";

const mockProducts: Product[] = [
  {
    id: "1",
    name: "Vestido A",
    slug: "vestido-a",
    price: 199.9,
    imageUrl: "https://placehold.co/400x500",
  },
  {
    id: "2",
    name: "Blusa B",
    slug: "blusa-b",
    price: 99.9,
    imageUrl: "https://placehold.co/400x500",
  },
];

describe("ProductSection", () => {
  it("renders the section title", () => {
    render(<ProductSection title="Lançamentos" products={mockProducts} />);
    expect(screen.getByRole("heading", { name: "Lançamentos" })).toBeInTheDocument();
  });

  it("renders all products", () => {
    render(<ProductSection title="Lançamentos" products={mockProducts} />);
    expect(screen.getByText("Vestido A")).toBeInTheDocument();
    expect(screen.getByText("Blusa B")).toBeInTheDocument();
  });

  it("does not render view-all link when viewAllHref is not provided", () => {
    render(<ProductSection title="Lançamentos" products={mockProducts} />);
    expect(screen.queryByRole("link", { name: /Ver todos/i })).not.toBeInTheDocument();
  });

  it("renders view-all link when viewAllHref is provided", () => {
    render(
      <ProductSection
        title="Lançamentos"
        products={mockProducts}
        viewAllHref="/colecao"
        viewAllLabel="Ver todos os lançamentos"
      />
    );
    const link = screen.getByRole("link", { name: "Ver todos os lançamentos" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/colecao");
  });

  it("renders default viewAllLabel when only viewAllHref is provided", () => {
    render(
      <ProductSection title="Destaques" products={mockProducts} viewAllHref="/colecao" />
    );
    expect(screen.getByRole("link", { name: "Ver todos" })).toBeInTheDocument();
  });
});
