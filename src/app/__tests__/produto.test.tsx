import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ProdutoPage from "@/src/app/produto/[slug]/page";
import { buildProductSlug, type Product, validateProduct } from "@/src/schemas/firestore";

const { getBySlugMock, getCategoryByIdMock, getStockByProductIdMock } = vi.hoisted(() => ({
  getBySlugMock: vi.fn(),
  getCategoryByIdMock: vi.fn(),
  getStockByProductIdMock: vi.fn(),
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

vi.mock("@/src/lib/firestore/firebaseSsrApp", () => ({
  getAuthenticatedAppForUser: vi.fn(async () => ({
    firestore: {},
    currentUser: null,
    firebaseServerApp: {},
  })),
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

vi.mock("@/src/lib/repositories/stockRepository", () => ({
  createStockRepository: () => ({
    getByProductId: getStockByProductIdMock,
  }),
}));

// Mock client components to keep the test synchronous
vi.mock("@/src/components/produto/ProductGallery", () => ({
  default: ({ productName }: { productName: string }) => (
    <div data-testid="product-gallery">{productName}</div>
  ),
}));

vi.mock("@/src/components/produto/SizeSelector", () => ({
  default: () => <div data-testid="size-selector" />,
}));

vi.mock("@/src/components/produto/ProductCard", () => ({
  default: () => <div data-testid="related-product-card" />,
}));

const mockFirestoreProduct: Product = validateProduct({
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
    startDate: null,
    endDate: null,
  },
  ratingAverage: 4.8,
  reviewCount: 24,
  totalStock: 12,
  status: "active",
  photoAssets: [],
  lifeStylePhotos: [],
  variants: [
    {
      id: "var_001",
      sku: "LURATHA_002",
      gtin: null,
      mpn: null,
      item_group_id: "LURATHA_002",
      size: ["P"],
      color: ["Azul"],
      photoIds: [],
      active: true,
    },
  ],
  vectorEmbedding: [0.01, 0.22, 0.09, 0.41, 0.37, 0.12, 0.08, 0.74],
  searchEmbedding: [0.01, 0.22, 0.09, 0.41, 0.37, 0.12, 0.08, 0.74],
  createdAt: "2026-04-13T16:00:00.000Z",
  updatedAt: "2026-04-13T16:00:00.000Z",
});

describe("ProdutoPage", () => {
  beforeEach(() => {
    getStockByProductIdMock.mockReset();
    getStockByProductIdMock.mockResolvedValue(null);
  });

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
        salePrice: null,
        priceMin: 389,
        priceMax: 389,
        currency: "BRL",
        startDate: null,
        endDate: null,
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
