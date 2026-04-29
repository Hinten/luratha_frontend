import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import BuscaPage, { generateMetadata } from "@/src/app/busca/page";

const { searchMock, productGridSpy } = vi.hoisted(() => ({
  searchMock: vi.fn(),
  productGridSpy: vi.fn(),
}));

vi.mock("@/src/lib/firestore/firebaseSsrApp", () => ({
  getAuthenticatedAppForUser: vi.fn(async () => ({
    firestore: {},
    currentUser: null,
    firebaseServerApp: {},
  })),
}));

vi.mock("@/src/lib/repositories/productsSearchRepository", () => ({
  createProductsSearchRepository: () => ({
    search: searchMock,
    findByIdOrSku: vi.fn(),
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

describe("BuscaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows search guide when q is empty", async () => {
    const page = await BuscaPage({
      searchParams: Promise.resolve({}),
    });
    render(page as React.ReactElement);

    expect(screen.getByRole("heading", { level: 1, name: "Buscar peças Luratha" })).toBeInTheDocument();
    expect(searchMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId("product-grid")).not.toBeInTheDocument();
  });

  it("renders results when q is informed", async () => {
    searchMock.mockResolvedValueOnce([
      {
        id: "prod_1",
        name: "Vestido de Linho",
        slug: "vestido-linho",
        categorySlug: "vestidos",
        price: 320,
        imageUrl: "https://example.com/a.jpg",
      },
    ]);

    const page = await BuscaPage({
      searchParams: Promise.resolve({ q: "vestido", sort: "menor-preco" }),
    });
    render(page as React.ReactElement);

    expect(screen.getByRole("heading", { level: 1, name: "Resultados para: vestido" })).toBeInTheDocument();
    expect(searchMock).toHaveBeenCalledWith({
      term: "vestido",
      sort: "price_asc",
      minPrice: undefined,
      maxPrice: undefined,
      tags: undefined,
      limit: 24,
      offset: 0,
    });
    expect(productGridSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText("1 produto encontrado")).toBeInTheDocument();
  });

  it("reuses cached search result for same query parameters", async () => {
    searchMock.mockResolvedValue([
      {
        id: "prod_1",
        name: "Vestido de Linho",
        slug: "vestido-linho",
        categorySlug: "vestidos",
        price: 320,
        imageUrl: "https://example.com/a.jpg",
      },
    ]);

    await BuscaPage({
      searchParams: Promise.resolve({ q: "vestido-cache-test", sort: "menor-preco" }),
    });
    await BuscaPage({
      searchParams: Promise.resolve({ q: "vestido-cache-test", sort: "menor-preco" }),
    });

    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache empty search results so re-searching after a seed retries Firestore", async () => {
    // First call returns []; second call (same query) must hit the repository again
    // — otherwise users would never see products that were seeded after the empty miss.
    searchMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "prod_seeded",
          name: "Vestido seeded after empty miss",
          slug: "vestido-seeded",
          categorySlug: "vestidos",
          price: 200,
          imageUrl: "https://example.com/x.jpg",
        },
      ]);

    await BuscaPage({ searchParams: Promise.resolve({ q: "termo-empty-then-seed" }) });
    await BuscaPage({ searchParams: Promise.resolve({ q: "termo-empty-then-seed" }) });

    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it("generates noindex metadata for search page", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ q: "vestido de festa" }),
    });

    expect(metadata.title).toBe('Busca: "vestido de festa" | Luratha');
    expect(metadata.alternates?.canonical).toBe(
      "https://www.luratha.com.br/busca?q=vestido%20de%20festa",
    );
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });
});
