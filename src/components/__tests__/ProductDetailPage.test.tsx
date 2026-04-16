import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductDetailPage from "@/src/components/produto/ProductDetailPage";
import { buildProductSlug, type Product } from "@/src/schemas/firestore";

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

vi.mock("@/src/components/produto/SizeSelector", () => ({
  default: ({ sizes }: { sizes: string[] }) => (
    <div data-testid="size-selector">{sizes.join(", ")}</div>
  ),
}));

const mockProduct: Product = {
  id: "prod_test_vestido",
  title: "Vestido Bordado Floral",
  slug: buildProductSlug("Vestido Bordado Floral", "LURATHA_001"),
  description: "Um vestido artesanal bordado à mão com motivos florais.",
  isPurchasable: true,
  brandName: "Luratha",
  sku: "LURATHA_001",
  category: [{ id: "cat_vestidos", name: "Vestidos", slug: "vestidos" }],
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
  },
  ratingAverage: 4.8,
  reviewCount: 24,
  totalStock: 12,
  status: "active",
  size: ["PP", "P", "M", "G", "GG"],
  photoIds: [
    "https://placehold.co/600x750/EDE4D9/3A2F2A?text=Imagem+1",
    "https://placehold.co/600x750/D9D2C7/3A2F2A?text=Imagem+2",
  ],
  variants: [
    {
      sku: "LURATHA_001_M",
      size: ["M"],
      stock: 12,
      photoIds: ["https://placehold.co/600x750/EDE4D9/3A2F2A?text=Imagem+1"],
      active: true,
    },
  ],
  vectorEmbedding: [0.01, 0.22, 0.09, 0.41, 0.37, 0.12, 0.08, 0.74],
  createdAt: "2026-03-15T00:00:00.000Z",
  updatedAt: "2026-03-15T00:00:00.000Z",
};

describe("ProductDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the product name as an h1", () => {
    render(<ProductDetailPage product={mockProduct} />);
    expect(
      screen.getByRole("heading", { level: 1, name: mockProduct.title })
    ).toBeInTheDocument();
  });

  it("renders the product gallery component", () => {
    render(<ProductDetailPage product={mockProduct} />);
    expect(screen.getByTestId("product-gallery")).toBeInTheDocument();
  });

  it("renders the size selector component", () => {
    render(<ProductDetailPage product={mockProduct} />);
    expect(screen.getByTestId("size-selector")).toBeInTheDocument();
  });

  it("renders the current price", () => {
    render(<ProductDetailPage product={mockProduct} />);
    expect(screen.getByText(/R\$\s*289/)).toBeInTheDocument();
  });

  it("renders the star rating and review count", () => {
    render(<ProductDetailPage product={mockProduct} />);
    expect(screen.getByText("4.8")).toBeInTheDocument();
    expect(screen.getByText(/24 avaliações/)).toBeInTheDocument();
  });

  it("renders highlights bullet list", () => {
    render(<ProductDetailPage product={mockProduct} />);
    expect(
      screen.getByRole("list", { name: "Destaques do produto" })
    ).toBeInTheDocument();
    expect(screen.getByText("Bordado à mão — cada peça é única")).toBeInTheDocument();
  });

  it("renders the description in its own section", () => {
    render(<ProductDetailPage product={mockProduct} />);
    expect(
      screen.getByRole("region", { name: "Descrição do produto" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/bordado à mão com motivos florais/)
    ).toBeInTheDocument();
  });

  it("renders the breadcrumb with Home, category, and product name", () => {
    render(<ProductDetailPage product={mockProduct} />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.querySelector("a[href='/']")).toBeInTheDocument();
    expect(nav.querySelector("a[href='/categoria/vestidos']")).toBeInTheDocument();
    expect(screen.getByText(mockProduct.title, { selector: "[aria-current='page']" })).toBeInTheDocument();
  });

  it("renders the schema.org JSON-LD script", () => {
    const { container } = render(<ProductDetailPage product={mockProduct} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data["@type"]).toBe("Product");
    expect(data.name).toBe(mockProduct.title);
  });
});
