import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductDetailPage from "@/src/components/ProductDetailPage";
import type { ProductDetail } from "@/src/lib/types";

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
vi.mock("@/src/components/ProductGallery", () => ({
  default: ({ productName }: { productName: string }) => (
    <div data-testid="product-gallery">{productName}</div>
  ),
}));

vi.mock("@/src/components/SizeSelector", () => ({
  default: ({ sizes }: { sizes: string[] }) => (
    <div data-testid="size-selector">{sizes.join(", ")}</div>
  ),
}));

const mockProduct: ProductDetail = {
  id: "v1",
  name: "Vestido Bordado Floral",
  slug: "vestido-bordado-floral",
  categorySlug: "vestidos",
  price: 289,
  originalPrice: 389,
  imageUrl: "https://placehold.co/600x750/EDE4D9/3A2F2A?text=Vestido+1",
  rating: 4.8,
  reviewCount: 24,
  installments: { count: 3, value: 96.33 },
  description: "Um vestido artesanal bordado à mão com motivos florais.",
  images: [
    "https://placehold.co/600x750/EDE4D9/3A2F2A?text=Imagem+1",
    "https://placehold.co/600x750/D9D2C7/3A2F2A?text=Imagem+2",
  ],
  sizes: ["PP", "P", "M", "G", "GG"],
  reviews: [
    {
      id: "r1",
      author: "Ana Claudia",
      rating: 5,
      comment: "Amei o vestido!",
      date: "2026-03-15",
    },
  ],
};

describe("ProductDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the product name as an h1", () => {
    render(<ProductDetailPage product={mockProduct} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Vestido Bordado Floral" })
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

  it("renders the description in a collapsible details element", () => {
    render(<ProductDetailPage product={mockProduct} />);
    expect(
      screen.getByText(/bordado à mão com motivos florais/)
    ).toBeInTheDocument();
  });

  it("renders the breadcrumb with Home, category, and product name", () => {
    render(<ProductDetailPage product={mockProduct} />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.querySelector("a[href='/']")).toBeInTheDocument();
    expect(nav.querySelector("a[href='/categoria/vestidos']")).toBeInTheDocument();
    expect(screen.getByText("Vestido Bordado Floral", { selector: "[aria-current='page']" })).toBeInTheDocument();
  });

  it("renders the reviews section when reviews are present", () => {
    render(<ProductDetailPage product={mockProduct} />);
    expect(
      screen.getByRole("region", { name: "Avaliações do produto" })
    ).toBeInTheDocument();
  });

  it("renders the schema.org JSON-LD script", () => {
    const { container } = render(<ProductDetailPage product={mockProduct} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeInTheDocument();
    const data = JSON.parse(script!.textContent!);
    expect(data["@type"]).toBe("Product");
    expect(data.name).toBe("Vestido Bordado Floral");
  });

  it("renders the related products section when there are products in the same category", () => {
    render(<ProductDetailPage product={mockProduct} />);
    expect(
      screen.getByRole("region", { name: "Peças relacionadas" })
    ).toBeInTheDocument();
  });
});
