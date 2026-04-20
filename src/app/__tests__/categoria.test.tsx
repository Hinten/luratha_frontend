import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoriaPage, { generateMetadata } from "@/src/app/categoria/[slug]/page";

const { getBySlugMock, searchMock, productGridSpy } = vi.hoisted(() => ({
  getBySlugMock: vi.fn(),
  searchMock: vi.fn(),
  productGridSpy: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/src/lib/firebaseServer", () => ({
  dbServer: {},
}));

vi.mock("@/src/lib/repositories/categoriesRepository", () => ({
  createCategoriesRepository: () => ({
    getBySlug: getBySlugMock,
  }),
}));

vi.mock("@/src/lib/repositories/productsSearchRepository", () => ({
  createProductsSearchRepository: () => ({
    search: searchMock,
  }),
}));

vi.mock("@/src/components/Breadcrumb", () => ({
  default: () => <nav data-testid="breadcrumb" />,
}));

vi.mock("@/src/components/JsonLd", () => ({
  default: () => null,
}));

vi.mock("@/src/components/categoria/SortDropdown", () => ({
  default: () => <div data-testid="sort-dropdown" />,
}));

vi.mock("@/src/components/categoria/ProductGrid", () => ({
  default: ({ products }: { products: unknown[] }) => {
    productGridSpy(products);
    return <div data-testid="product-grid" />;
  },
}));

describe("CategoriaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads category and products using slug from database", async () => {
    getBySlugMock.mockResolvedValueOnce({
      id: "cat_vestidos",
      name: "Vestidos",
      slug: "vestidos",
    });
    searchMock.mockResolvedValueOnce([
      {
        id: "prod_1",
        name: "Vestido A",
        slug: "vestido-a",
        categorySlug: "vestidos",
        price: 300,
        imageUrl: "https://example.com/a.jpg",
      },
      {
        id: "prod_2",
        name: "Vestido B",
        slug: "vestido-b",
        categorySlug: "vestidos",
        price: 240,
        originalPrice: 280,
        imageUrl: "https://example.com/b.jpg",
      },
    ]);

    const page = await CategoriaPage({
      params: Promise.resolve({ slug: "vestidos" }),
      searchParams: Promise.resolve({ sort: "recentes" }),
    });
    render(page as React.ReactElement);

    expect(screen.getByRole("heading", { level: 1, name: "Vestidos" })).toBeInTheDocument();
    expect(screen.getByText("2 produtos encontrados")).toBeInTheDocument();
    expect(getBySlugMock).toHaveBeenCalledWith("vestidos");
    expect(searchMock).toHaveBeenCalledWith({
      categorySlug: "vestidos",
      sort: "newest",
      limit: 24,
      offset: 0,
      term: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      tags: undefined,
    });
    expect(productGridSpy).toHaveBeenCalledTimes(1);
  });

  it("calls notFound when category slug is missing in database", async () => {
    getBySlugMock.mockResolvedValueOnce(null);

    await expect(
      CategoriaPage({
        params: Promise.resolve({ slug: "inexistente" }),
        searchParams: Promise.resolve({ sort: "recentes" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("generates metadata using category loaded from database", async () => {
    getBySlugMock.mockResolvedValueOnce({
      id: "cat_vestidos",
      name: "Vestidos",
      slug: "vestidos",
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "vestidos" }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe("Vestidos Artesanais");
    expect(metadata.alternates?.canonical).toBe("https://www.luratha.com.br/categoria/vestidos");
  });
});

function createFirestoreProduct(
  input: Partial<FirestoreProduct> & {
    id: string;
    title: string;
    slug: string;
    price: { price: number; salePrice: number | null };
  },
): FirestoreProduct {
  return {
    id: input.id,
    title: input.title,
    slug: input.slug,
    description: "Descrição",
    isPurchasable: true,
    brandName: "Luratha",
    sku: "LURATHA_9999",
    categoryId: "cat_vestidos",
    tags: [],
    materialTags: [],
    seasonalTags: [],
    price: {
      price: input.price.price,
      salePrice: input.price.salePrice,
      priceMin: null,
      priceMax: null,
      currency: "BRL",
      startDate: null,
      endDate: null,
    },
    condition: "new",
    adult: false,
    isBundle: false,
    multipack: 1,
    material: [],
    pattern: [],
    photoAssets: [],
    lifeStylePhotos: [],
    videoUrls: [],
    totalStock: 10,
    status: "active",
    vectorEmbedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    createdAt: "2026-04-16T00:00:00.000Z",
    updatedAt: "2026-04-16T00:00:00.000Z",
    ...input,
  } as FirestoreProduct;
}
