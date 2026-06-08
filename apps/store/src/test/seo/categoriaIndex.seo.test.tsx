import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import CategoriaIndexPage, { metadata } from "@/src/app/categoria/page";
import {
  SITE_URL,
  getJsonLdScripts,
  findSchemaByType,
  assertSchemaOrgBase,
  expectSeoMetadata,
} from "./seoAssertions";

const { getCachedCategoriesMock } = vi.hoisted(() => ({ getCachedCategoriesMock: vi.fn() }));

vi.mock("@/src/lib/queries/getCachedCategories", () => ({
  getCachedCategories: getCachedCategoriesMock,
}));

vi.mock("@/src/components/Breadcrumb", () => ({ default: () => <nav data-testid="breadcrumb" /> }));
vi.mock("@/src/components/categoria/CategoryBlock", () => ({
  default: () => <div data-testid="category-block" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  getCachedCategoriesMock.mockResolvedValue([]);
});

describe("categoria index page (SEO)", () => {
  it("exports complete, canonical metadata", () => {
    expectSeoMetadata(metadata, { canonicalPath: "/categoria" });
  });

  it("renders CollectionPage and BreadcrumbList schemas", async () => {
    const page = await CategoriaIndexPage();
    const scripts = getJsonLdScripts(render(page as React.ReactElement).container);

    const collection = findSchemaByType(scripts, "CollectionPage");
    assertSchemaOrgBase(collection);
    expect(collection.url).toBe(`${SITE_URL}/categoria`);
    expect((collection.isPartOf as { "@type": string })["@type"]).toBe("WebSite");

    const breadcrumb = findSchemaByType(scripts, "BreadcrumbList");
    assertSchemaOrgBase(breadcrumb);
    const items = breadcrumb.itemListElement as Array<{ position: number; item?: string }>;
    expect(items[0].position).toBe(1);
    expect(items[1].item).toBe(`${SITE_URL}/categoria`);
  });
});
