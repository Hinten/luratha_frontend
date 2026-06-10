import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import ProductDetailPage from "@/src/components/produto/ProductDetailPage";
import { makeSeoProduct } from "./productFixture";
import { SITE_URL, getJsonLdScripts, findSchemaByType, assertSchemaOrgBase } from "./seoAssertions";

// Render the detail component directly; mock its visual children so only the
// Product JSON-LD it emits is under test.
vi.mock("@/src/components/Breadcrumb", () => ({ default: () => <nav data-testid="breadcrumb" /> }));
vi.mock("@/src/components/produto/ProductVariantView", () => ({
  default: () => <div data-testid="variant-view" />,
}));
vi.mock("@/src/components/produto/ProductDescription", () => ({
  default: () => <div data-testid="product-description" />,
}));

function getProductSchema(product = makeSeoProduct()) {
  // No `stock` prop — availability is driven by the product's own totalStock.
  const { container } = render(<ProductDetailPage product={product} category={null} />);
  const schema = findSchemaByType(getJsonLdScripts(container), "Product");
  assertSchemaOrgBase(schema);
  return schema;
}

describe("product Product schema (SEO / AEO)", () => {
  it("emits a complete Product offer for an in-stock, on-sale item", () => {
    const product = makeSeoProduct();
    const schema = getProductSchema(product);

    expect(schema.name).toBe(product.title);
    expect(schema.description).toBe(product.description);
    expect(Array.isArray(schema.image)).toBe(true);
    expect((schema.image as unknown[]).length).toBeGreaterThan(0);
    expect(schema.sku).toBe(product.sku);
    expect((schema.brand as { name: string }).name).toBe("Luratha");

    const offers = schema.offers as Record<string, unknown>;
    expect(offers.priceCurrency).toBe("BRL");
    expect(offers.price).toBe(289); // salePrice wins over list price
    expect(offers.availability).toBe("https://schema.org/InStock");
    expect(offers.url).toBe(`${SITE_URL}/produto/${product.slug}`);
  });

  it("includes aggregateRating only when there are reviews", () => {
    const schema = getProductSchema(makeSeoProduct({ ratingAverage: 4.8, reviewCount: 24 }));
    const rating = schema.aggregateRating as { ratingValue: string; reviewCount: number };
    expect(rating.ratingValue).toBe("4.8");
    expect(rating.reviewCount).toBe(24);
  });

  it("marks out-of-stock items and drops rating/sale price accordingly", () => {
    const product = makeSeoProduct({
      price: { salePrice: null, priceMin: 389, priceMax: 389 },
      totalStock: 0,
      reviewCount: 0,
    });
    const schema = getProductSchema(product);
    const offers = schema.offers as Record<string, unknown>;

    expect(offers.price).toBe(389);
    expect(offers.availability).toBe("https://schema.org/OutOfStock");
    expect(schema.aggregateRating).toBeUndefined();
  });
});
