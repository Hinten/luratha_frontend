import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductDetailPage from "@/src/components/produto/ProductDetailPage";
import { buildProductSlug, type Product, type Stock, validateProduct } from "@luratha/schemas";

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

// ProductGallery and SizeSelector are "use client" — mock them to prevent
// React state issues in the jsdom test environment
vi.mock("@/src/components/produto/ProductGallery", () => ({
  default: ({ productName }: { productName: string }) => (
    <div data-testid="product-gallery">{productName}</div>
  ),
}));

// SizeSelector now handles stock display; render stock info so page-level
// stock tests can still verify that the correct data flows through.
vi.mock("@/src/components/produto/SizeSelector", () => ({
  default: ({ product, stock }: { product: Product; stock?: Stock | null }) => {
    const qty = stock?.quantity ?? product.totalStock;
    return (
      <div data-testid="size-selector">
        {qty === 0 ? (
          <button type="button" disabled aria-label="produto esgotado">
            PRODUTO ESGOTADO
          </button>
        ) : qty === 1 ? (
          <p>Última peça!</p>
        ) : qty === 2 ? (
          <p>Últimas 2 peças!</p>
        ) : qty <= 5 ? (
          <p>Últimas {qty} peças!</p>
        ) : (
          <p>Em estoque</p>
        )}
      </div>
    );
  },
}));

const mockProduct: Product = validateProduct({
  id: "prod_test_vestido",
  title: "Vestido Bordado Floral",
  slug: buildProductSlug("Vestido Bordado Floral", "LURATHA_001"),
  description: "Um vestido artesanal bordado à mão com motivos florais.",
  isPurchasable: true,
  brandName: "Luratha",
  sku: "LURATHA_001",
  categoryId: "cat_vestidos",
  tags: ["vestido", "bordado"],
  materialTags: ["linho"],
  seasonalTags: ["verao"],
  productHighlight: ["Bordado à mão — cada peça é única", "Tecido linho 100% natural"],
  price: {
    price: 389,
    salePrice: 289,
    priceMin: 289,
    priceMax: 389,
    currency: "BRL",
    startDate: null,
    endDate: null,
  },
  ratingAverage: 4.8,
  reviewCount: 24,
  totalStock: 12,
  status: "active",
  photoAssets: [],
  lifeStylePhotos: [],
  size: ["PP", "P", "M", "G", "GG"],
  variants: [
    {
      id: "var_luratha_001_m",
      sku: "LURATHA_001_M",
      size: ["M"],
      gtin: null,
      mpn: null,
      item_group_id: null,
      color: null,
      photoIds: [],
      active: true,
    },
  ],
  vectorEmbedding: [0.01, 0.22, 0.09, 0.41, 0.37, 0.12, 0.08, 0.74],
  createdAt: "2026-03-15T00:00:00.000Z",
  updatedAt: "2026-03-15T00:00:00.000Z",
});

describe("ProductDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the product name as an h1", () => {
    render(<ProductDetailPage product={mockProduct} category={mockCategory} />);
    expect(screen.getByRole("heading", { level: 1, name: mockProduct.title })).toBeInTheDocument();
  });

  it("renders the product gallery component", () => {
    render(<ProductDetailPage product={mockProduct} category={mockCategory} />);
    expect(screen.getByTestId("product-gallery")).toBeInTheDocument();
  });

  it("renders the size selector component", () => {
    render(<ProductDetailPage product={mockProduct} category={mockCategory} />);
    expect(screen.getByTestId("size-selector")).toBeInTheDocument();
  });

  it("renders the current price", () => {
    render(<ProductDetailPage product={mockProduct} category={mockCategory} />);
    expect(screen.getByText(/R\$\s*289/)).toBeInTheDocument();
  });

  it("renders the star rating and review count", () => {
    render(<ProductDetailPage product={mockProduct} category={mockCategory} />);
    expect(screen.getByText("4.8")).toBeInTheDocument();
    expect(screen.getByText(/24 avaliações/)).toBeInTheDocument();
  });

  it("renders highlights bullet list", () => {
    render(<ProductDetailPage product={mockProduct} category={mockCategory} />);
    expect(screen.getByRole("list", { name: "Destaques do produto" })).toBeInTheDocument();
    expect(screen.getByText("Bordado à mão — cada peça é única")).toBeInTheDocument();
  });

  it("renders the description in its own section", () => {
    render(<ProductDetailPage product={mockProduct} category={mockCategory} />);
    expect(screen.getByRole("region", { name: "Descrição do produto" })).toBeInTheDocument();
    expect(screen.getByText(/bordado à mão com motivos florais/)).toBeInTheDocument();
  });

  it("renders the breadcrumb with Home, category, and product name", () => {
    render(<ProductDetailPage product={mockProduct} category={mockCategory} />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.querySelector("a[href='/']")).toBeInTheDocument();
    expect(nav.querySelector("a[href='/categoria/vestidos']")).toBeInTheDocument();
    expect(
      screen.getByText(mockProduct.title, { selector: "[aria-current='page']" }),
    ).toBeInTheDocument();
  });

  it("renders the schema.org JSON-LD script", () => {
    const { container } = render(
      <ProductDetailPage product={mockProduct} category={mockCategory} />,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data["@type"]).toBe("Product");
    expect(data.name).toBe(mockProduct.title);
  });

  it("shows 'Em estoque' when stock prop is provided with ample quantity (qty=8)", () => {
    const now = "2026-04-26T18:00:00.000Z";
    const stock: Stock = {
      productId: mockProduct.id,
      sku: mockProduct.sku,
      quantity: 8,
      hasVariants: false,
      variants: null,
      updatedAt: now,
    };
    render(<ProductDetailPage product={mockProduct} category={mockCategory} stock={stock} />);
    expect(screen.getByText("Em estoque")).toBeInTheDocument();
  });

  it("shows 'PRODUTO ESGOTADO' button when stock quantity is 0", () => {
    const now = "2026-04-26T18:00:00.000Z";
    const stock: Stock = {
      productId: mockProduct.id,
      sku: mockProduct.sku,
      quantity: 0,
      hasVariants: false,
      variants: null,
      updatedAt: now,
    };
    render(<ProductDetailPage product={mockProduct} category={mockCategory} stock={stock} />);
    expect(screen.getByRole("button", { name: /produto esgotado/i })).toBeDisabled();
  });

  it("shows urgency message when stock is low (qty=2)", () => {
    const now = "2026-04-26T18:00:00.000Z";
    const stock: Stock = {
      productId: mockProduct.id,
      sku: mockProduct.sku,
      quantity: 2,
      hasVariants: false,
      variants: null,
      updatedAt: now,
    };
    render(<ProductDetailPage product={mockProduct} category={mockCategory} stock={stock} />);
    expect(screen.getByText("Últimas 2 peças!")).toBeInTheDocument();
  });

  it("falls back to product.totalStock when stock prop is not provided", () => {
    const productWithStock = { ...mockProduct, totalStock: 5 };
    render(<ProductDetailPage product={productWithStock} category={mockCategory} />);
    expect(screen.getByText("Últimas 5 peças!")).toBeInTheDocument();
  });
});

const mockCategory = {
  id: "cat_vestidos",
  name: "Vestidos",
  slug: "vestidos",
};
