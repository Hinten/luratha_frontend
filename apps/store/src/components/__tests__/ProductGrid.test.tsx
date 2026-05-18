import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductGrid from "@/src/components/categoria/ProductGrid";
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

function createProduct(id: string, title: string): Product {
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
    price: { price: 289, salePrice: null, priceMin: 289, priceMax: 289, currency: "BRL" },
    photoAssets: [],
    lifeStylePhotos: [],
    totalStock: 10,
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  });
}

const mockProducts: Product[] = [
  createProduct("1", "Vestido Bordado Floral"),
  createProduct("2", "Vestido Midi Linho"),
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
      screen.getByText("Tente explorar outras categorias ou volte em breve."),
    ).toBeInTheDocument();
  });
});
