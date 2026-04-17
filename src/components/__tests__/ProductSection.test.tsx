import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductSection from "@/src/components/produto/ProductSection";
import { buildProductSlug, type Product, validateProduct } from "@/src/schemas/firestore";
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function createProduct(id: string, title: string, price: number): Product {
  return validateProduct({
    id,
    title,
    slug: buildProductSlug(title, `LURATHA_${id}`),
    description: "Descrição",
    sku: `LURATHA_${id}`,
    status: "active",
    isPurchasable: true,
    brandName: "Luratha",
    categoryId: "cat_vestidos",
    tags: [],
    materialTags: [],
    seasonalTags: [],
    price: { price, salePrice: null, priceMin: price, priceMax: price, currency: "BRL" },
    photoAssets: [],
    lifeStylePhotos: [],
    totalStock: 10,
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  });
}

const mockProducts: Product[] = [
  createProduct("1", "Vestido A", 199.9),
  createProduct("2", "Blusa B", 99.9),
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
      />,
    );
    const link = screen.getByRole("link", { name: "Ver todos os lançamentos" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/colecao");
  });

  it("renders default viewAllLabel when only viewAllHref is provided", () => {
    render(
      <ProductSection title="Destaques" products={mockProducts} viewAllHref="/colecao" />,
    );
    expect(screen.getByRole("link", { name: "Ver todos" })).toBeInTheDocument();
  });
});
