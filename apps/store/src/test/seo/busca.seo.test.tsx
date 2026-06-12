import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import BuscaPage, { generateMetadata } from "@/src/app/busca/page";
import {
  SITE_URL,
  getJsonLdScripts,
  findSchemaByType,
  assertSchemaOrgBase,
  readCanonical,
} from "./seoAssertions";

const { searchMock, getByProductIdsMock } = vi.hoisted(() => ({
  searchMock: vi.fn(),
  getByProductIdsMock: vi.fn(),
}));

vi.mock("@luratha/firestore/firebaseSsrApp", () => ({
  getAuthenticatedAppForUser: vi.fn(async () => ({
    firestore: {},
    currentUser: null,
    firebaseServerApp: {},
  })),
}));

vi.mock("@luratha/repositories/productsSearchRepository", () => ({
  createProductsSearchRepository: () => ({ search: searchMock }),
}));

vi.mock("@luratha/repositories/stockRepository", () => ({
  createStockRepository: () => ({ getByProductIds: getByProductIdsMock }),
}));

vi.mock("@/src/components/Breadcrumb", () => ({ default: () => <nav data-testid="breadcrumb" /> }));
vi.mock("@/src/components/categoria/SortDropdown", () => ({
  default: () => <div data-testid="sort-dropdown" />,
}));
vi.mock("@/src/components/categoria/ProductGrid", () => ({
  default: () => <div data-testid="product-grid" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  getByProductIdsMock.mockResolvedValue(new Map());
});

describe("busca page (SEO)", () => {
  it("is noindex but followable, with a query-aware canonical", async () => {
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ q: "vestido de festa" }),
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(readCanonical(metadata)).toBe(`${SITE_URL}/busca?q=vestido%20de%20festa`);
  });

  it("uses a clean canonical and generic title when no term is present", async () => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({}) });

    expect(metadata.title).toBe("Buscar | Luratha");
    expect(readCanonical(metadata)).toBe(`${SITE_URL}/busca`);
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it("renders SearchResultsPage + BreadcrumbList schemas for a query", async () => {
    searchMock.mockResolvedValueOnce([]);

    const page = await BuscaPage({ searchParams: Promise.resolve({ q: "vestido" }) });
    const scripts = getJsonLdScripts(render(page as React.ReactElement).container);

    const results = findSchemaByType(scripts, "SearchResultsPage");
    assertSchemaOrgBase(results);
    expect(results.url).toBe(`${SITE_URL}/busca?q=vestido`);

    const breadcrumb = findSchemaByType(scripts, "BreadcrumbList");
    assertSchemaOrgBase(breadcrumb);
    const items = breadcrumb.itemListElement as Array<{ position: number; name: string }>;
    expect(items).toHaveLength(3);
    expect(items[2].name).toBe("vestido");
  });
});
