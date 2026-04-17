import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProdutoPage from "@/src/app/produto/[slug]/page";
import { buildProductSlug, type Product } from "@/src/schemas/firestore";

const { getBySlugMock, getCategoryByIdMock } = vi.hoisted(() => ({
  getBySlugMock: vi.fn(),
  getCategoryByIdMock: vi.fn(),
}));

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

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/src/lib/firebaseServer", () => ({
  dbServer: {},
}));

vi.mock("@/src/lib/repositories/productsRepository", () => ({
  ProductRepositoryError: class ProductRepositoryError extends Error {
    readonly code: "validation" | "not_found" | "conflict" | "unknown";

    constructor(message: string, code: "validation" | "not_found" | "conflict" | "unknown") {
      super(message);
      this.code = code;
    }
  },
  createProductsRepository: () => ({
    getBySlug: getBySlugMock,
  }),
}));

vi.mock("@/src/lib/repositories/categoriesRepository", () => ({
  createCategoriesRepository: () => ({
    getById: getCategoryByIdMock,
  }),
}));

// Mock client components to keep the test synchronous
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

vi.mock("@/src/components/produto/ProductCard", () => ({
  default: () => <div data-testid="related-product-card" />,
}));

const mockFirestoreProduct: Product = {
  id: "prod_test_vestido",
  title: "Vestido Bordado Floral",
  slug: buildProductSlug("Vestido Bordado Floral", "LURATHA_001"),
  description: "Um vestido artesanal bordado à mão com motivos florais delicados.",
  isPurchasable: true,
  brandName: "Luratha",
  sku: "LURATHA_001",
  categoryId: "cat_vestidos",
  tags: ["vestido", "bordado"],
  materialTags: ["linho"],
  seasonalTags: ["verao"],
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
  photoAssets: [],
  lifeStylePhotos: [],
  variants: [
    {
      sku: "LURATHA_002",
      size: ["P", "M"],
      stock: 12,
      photoIds: ["https://placehold.co/600x750/EDE4D9/3A2F2A?text=Vestido+Bordado+1"],
      active: true,
    },
  ],
  vectorEmbedding: [0.01, 0.22, 0.09, 0.41, 0.37, 0.12, 0.08, 0.74],
  createdAt: "2026-04-13T16:00:00.000Z",
  updatedAt: "2026-04-13T16:00:00.000Z",
};

describe("ProdutoPage", () => {
  it("renders the product heading for a known slug", async () => {
    getBySlugMock.mockResolvedValueOnce(mockFirestoreProduct);
    getCategoryByIdMock.mockResolvedValueOnce({
      id: "cat_vestidos",
      name: "Vestidos",
      slug: "vestidos",
    });

    const page = await ProdutoPage({
      params: Promise.resolve({ slug: mockFirestoreProduct.slug }),
    });
    render(page as React.ReactElement);
    expect(
      screen.getByRole("heading", { level: 1, name: "Vestido Bordado Floral" })
    ).toBeInTheDocument();
  });

  it("renders the price for a known slug", async () => {
    getBySlugMock.mockResolvedValueOnce({
      ...mockFirestoreProduct,
      title: "Conjunto Saia + Blusa Crochet",
      slug: buildProductSlug("Conjunto Saia + Blusa Crochet", "LURATHA_010"),
      sku: "LURATHA_010",
      price: {
        price: 389,
        priceMin: 389,
        priceMax: 389,
        currency: "BRL",
      },
      variants: undefined,
      size: ["P", "M"],
    });
    getCategoryByIdMock.mockResolvedValueOnce({
      id: "cat_vestidos",
      name: "Vestidos",
      slug: "vestidos",
    });

    const page = await ProdutoPage({
      params: Promise.resolve({ slug: "conjunto-saia-blusa-crochet-luratha-010" }),
    });
    render(page as React.ReactElement);
    expect(screen.getByText(/R\$\s*389/)).toBeInTheDocument();
  });

  it("calls notFound for an unknown slug", async () => {
    getBySlugMock.mockResolvedValueOnce(null);

    await expect(
      ProdutoPage({ params: Promise.resolve({ slug: "slug-que-nao-existe" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("throws a 500 error when repository fails to load product data", async () => {
    getBySlugMock.mockRejectedValueOnce(new Error("Falha no carregamento"));

    await expect(
      ProdutoPage({ params: Promise.resolve({ slug: "produto-indisponivel" }) }),
    ).rejects.toMatchObject({
      message: "Erro ao carregar dados do produto.",
      statusCode: 500,
    });
  });
});
