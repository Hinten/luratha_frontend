import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductCard from "@/src/components/produto/ProductCard";
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

function createProduct(overrides: Partial<Product> = {}): Product {
  return validateProduct({
    id: "prod_1",
    title: "Vestido Bordado Floral",
    slug: buildProductSlug("Vestido Bordado Floral", "LURATHA_9001"),
    description: "Descrição",
    sku: "LURATHA_9001",
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
    ...overrides,
  });
}

const baseProduct = createProduct();
const saleProduct = createProduct({
  id: "prod_2",
  title: "Conjunto Crochet",
  sku: "LURATHA_9002",
  slug: buildProductSlug("Conjunto Crochet", "LURATHA_9002"),
  price: { price: 499, salePrice: 389, priceMin: 389, priceMax: 499, currency: "BRL" },
  ratingAverage: 4.9,
  reviewCount: 36,
});

describe("ProductCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the product title", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText("Vestido Bordado Floral")).toBeInTheDocument();
  });

  it("renders a fallback product image when no assets are available", () => {
    render(<ProductCard product={baseProduct} />);
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("alt", "Vestido Bordado Floral");
  });

  it("renders the current price formatted as BRL", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText(/R\$\s*289/)).toBeInTheDocument();
  });

  it("does NOT show a discount badge when there is no salePrice", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
  });

  it("shows a discount badge when salePrice is provided", () => {
    render(<ProductCard product={saleProduct} />);
    expect(screen.getByText(/-\d+%/)).toBeInTheDocument();
  });

  it("shows the original price (struck-through) when salePrice is provided", () => {
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
      screen.getByRole("button", { name: "Adicionar aos favoritos" }),
    ).toBeInTheDocument();
  });

  it("renders a link to /produto/[slug] when slug is provided", () => {
    render(<ProductCard product={saleProduct} />);
    const link = screen.getByRole("link", { name: saleProduct.title });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", `/produto/${saleProduct.slug}`);
  });

  it("renders a product link using generated slug", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByRole("link", { name: baseProduct.title })).toHaveAttribute(
      "href",
      `/produto/${baseProduct.slug}`,
    );
  });

  it("shows 'Esgotado' badge when totalStock is 0", () => {
    const outOfStockProduct = createProduct({ totalStock: 0 });
    render(<ProductCard product={outOfStockProduct} />);
    expect(screen.getByText("Esgotado")).toBeInTheDocument();
  });

  it("does NOT show 'Esgotado' badge when product is in stock", () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.queryByText("Esgotado")).not.toBeInTheDocument();
  });

  it("does NOT show discount badge when product is out of stock", () => {
    const outOfStockSaleProduct = createProduct({
      totalStock: 0,
      price: { price: 499, salePrice: 389, priceMin: 389, priceMax: 499, currency: "BRL" },
    });
    render(<ProductCard product={outOfStockSaleProduct} />);
    expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
    expect(screen.getByText("Esgotado")).toBeInTheDocument();
  });
});
