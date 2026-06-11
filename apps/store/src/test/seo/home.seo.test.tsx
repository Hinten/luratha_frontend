import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import Home, { metadata } from "@/src/app/page";
import {
  SITE_URL,
  getJsonLdScripts,
  findSchemaByType,
  assertSchemaOrgBase,
  expectSeoMetadata,
} from "./seoAssertions";

const { getHomePageDataMock, productSectionSpy } = vi.hoisted(() => ({
  getHomePageDataMock: vi.fn(),
  productSectionSpy: vi.fn(),
}));

vi.mock("@/src/lib/homePageData", () => ({
  getHomePageData: getHomePageDataMock,
}));

// Keep JsonLd real so the WebPage schema is inspectable; mock the client/visual
// children so the server component renders synchronously in jsdom.
vi.mock("@/src/components/home/HeroBanner", () => ({
  default: () => <div data-testid="hero" />,
}));
vi.mock("@/src/components/home/HomeCategoriesSection", () => ({
  default: () => <div data-testid="home-categories" />,
}));
vi.mock("@/src/components/produto/ProductSection", () => ({
  default: (props: { title?: string; viewAllHref?: string }) => {
    productSectionSpy(props);
    return <div data-testid="product-section" />;
  },
}));
vi.mock("@/src/components/produto/ProductCard", () => ({
  default: () => <div data-testid="product-card" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  getHomePageDataMock.mockResolvedValue({
    categories: [],
    newArrivals: [],
    featured: [],
    sale: [],
    stockMap: new Map(),
  });
});

describe("home page (SEO)", () => {
  it("exports complete, canonical metadata", () => {
    expectSeoMetadata(metadata, { canonicalPath: "", titleIncludes: "Luratha" });
  });

  it("renders a WebPage schema tied to the WebSite and Organization", async () => {
    const page = await Home();
    const { container } = render(page as React.ReactElement);

    const webPage = findSchemaByType(getJsonLdScripts(container), "WebPage");
    assertSchemaOrgBase(webPage);
    expect(webPage.url).toBe(SITE_URL);
    expect((webPage.isPartOf as { "@type": string })["@type"]).toBe("WebSite");
    expect((webPage.publisher as { "@type": string })["@type"]).toBe("Organization");
  });

  it("links the product sections to /todas-as-pecas (not the dead /colecao route)", async () => {
    const page = await Home();
    render(page as React.ReactElement);

    expect(productSectionSpy).toHaveBeenCalledTimes(2);
    for (const call of productSectionSpy.mock.calls) {
      expect((call[0] as { viewAllHref?: string }).viewAllHref).toBe("/todas-as-pecas");
    }
  });
});
