import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import CategoryPage, { generateMetadata } from "@/src/app/categoria/[slug]/page";
import {
  SITE_URL,
  getJsonLdScripts,
  findSchemaByType,
  assertSchemaOrgBase,
  readCanonical,
  readTitleText,
} from "./seoAssertions";

const { getBySlugMock, searchMock } = vi.hoisted(() => ({
  getBySlugMock: vi.fn(),
  searchMock: vi.fn(),
}));

vi.mock("@luratha/firestore/firebaseSsrApp", () => ({
  getAuthenticatedAppForUser: vi.fn(async () => ({
    firestore: {},
    currentUser: null,
    firebaseServerApp: {},
  })),
}));

vi.mock("@luratha/repositories/categoriesRepository", () => ({
  createCategoriesRepository: () => ({ getBySlug: getBySlugMock }),
}));

vi.mock("@luratha/repositories/productsSearchRepository", () => ({
  createProductsSearchRepository: () => ({ search: searchMock }),
}));

vi.mock("@/src/components/Breadcrumb", () => ({ default: () => <nav data-testid="breadcrumb" /> }));
vi.mock("@/src/components/categoria/SortDropdown", () => ({
  default: () => <div data-testid="sort-dropdown" />,
}));
vi.mock("@/src/components/categoria/ProductGrid", () => ({
  default: () => <div data-testid="product-grid" />,
}));

const VESTIDOS = { id: "cat_vestidos", name: "Vestidos", slug: "vestidos" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("categoria/[slug] page (SEO)", () => {
  it("builds a canonical /categoria/{slug} title and URL in metadata", async () => {
    getBySlugMock.mockResolvedValueOnce(VESTIDOS);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "vestidos" }),
      searchParams: Promise.resolve({}),
    });

    expect(readTitleText(metadata)).toBe("Vestidos Artesanais");
    expect(readCanonical(metadata)).toBe(`${SITE_URL}/categoria/vestidos`);
    expect(metadata.openGraph?.url).toBe(`${SITE_URL}/categoria/vestidos`);
  });

  it("renders CollectionPage + BreadcrumbList schemas pointing at /categoria/{slug}", async () => {
    getBySlugMock.mockResolvedValueOnce(VESTIDOS);
    searchMock.mockResolvedValueOnce([]);

    const page = await CategoryPage({
      params: Promise.resolve({ slug: "vestidos" }),
      searchParams: Promise.resolve({}),
    });
    const scripts = getJsonLdScripts(render(page as React.ReactElement).container);

    const collection = findSchemaByType(scripts, "CollectionPage");
    assertSchemaOrgBase(collection);
    expect(collection.name).toBe("Vestidos | Luratha");
    expect(collection.url).toBe(`${SITE_URL}/categoria/vestidos`);

    const breadcrumb = findSchemaByType(scripts, "BreadcrumbList");
    assertSchemaOrgBase(breadcrumb);
    const items = breadcrumb.itemListElement as Array<{ position: number; item?: string }>;
    expect(items[1].item).toBe(`${SITE_URL}/categoria/vestidos`);
  });
});
