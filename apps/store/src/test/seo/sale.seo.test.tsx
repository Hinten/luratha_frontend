import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import SalePage, { metadata } from "@/src/app/sale/page";
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

describe("sale page (SEO)", () => {
  it("exports complete, canonical metadata", () => {
    expectSeoMetadata(metadata, { canonicalPath: "/sale" });
  });

  it("renders OfferCatalog (with seller Organization) and BreadcrumbList schemas", async () => {
    const page = await SalePage({ searchParams: Promise.resolve({}) });
    const scripts = getJsonLdScripts(render(page as React.ReactElement).container);

    const offerCatalog = findSchemaByType(scripts, "OfferCatalog");
    assertSchemaOrgBase(offerCatalog);
    expect(offerCatalog.url).toBe(`${SITE_URL}/sale`);
    expect((offerCatalog.seller as { "@type": string })["@type"]).toBe("Organization");

    assertSchemaOrgBase(findSchemaByType(scripts, "BreadcrumbList"));
  });
});
