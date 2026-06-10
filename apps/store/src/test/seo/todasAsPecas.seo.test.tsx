import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import TodasAsPecasPage, { metadata } from "@/src/app/todas-as-pecas/page";
import {
  SITE_URL,
  getJsonLdScripts,
  findSchemaByType,
  assertSchemaOrgBase,
  expectSeoMetadata,
} from "./seoAssertions";

const { listMock, getByProductIdsMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  getByProductIdsMock: vi.fn(),
}));

vi.mock("@luratha/firestore/firebaseSsrApp", () => ({
  getAuthenticatedAppForUser: vi.fn(async () => ({
    firestore: {},
    currentUser: null,
    firebaseServerApp: {},
  })),
}));

vi.mock("@luratha/repositories/productsRepository", () => ({
  createProductsRepository: () => ({ list: listMock }),
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
  listMock.mockResolvedValue([]);
  getByProductIdsMock.mockResolvedValue(new Map());
});

describe("todas-as-pecas page (SEO)", () => {
  it("exports complete, canonical metadata", () => {
    expectSeoMetadata(metadata, { canonicalPath: "/todas-as-pecas" });
  });

  it("renders CollectionPage and BreadcrumbList schemas", async () => {
    const page = await TodasAsPecasPage({ searchParams: Promise.resolve({}) });
    const scripts = getJsonLdScripts(render(page as React.ReactElement).container);

    const collection = findSchemaByType(scripts, "CollectionPage");
    assertSchemaOrgBase(collection);
    expect(collection.url).toBe(`${SITE_URL}/todas-as-pecas`);
    expect((collection.isPartOf as { "@type": string })["@type"]).toBe("WebSite");

    const breadcrumb = findSchemaByType(scripts, "BreadcrumbList");
    assertSchemaOrgBase(breadcrumb);
    const items = breadcrumb.itemListElement as Array<{ item?: string }>;
    expect(items[1].item).toBe(`${SITE_URL}/todas-as-pecas`);
  });
});
