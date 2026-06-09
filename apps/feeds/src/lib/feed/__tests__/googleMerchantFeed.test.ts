import { describe, expect, it } from "vitest";
import {
  buildGoogleMerchantFeed,
  escapeXml,
  type FeedProduct,
} from "@/src/lib/feed/googleMerchantFeed";

const CHANNEL = { siteUrl: "https://www.luratha.com.br" };

function makeProduct(overrides: Partial<FeedProduct> = {}): FeedProduct {
  return {
    id: "prod-1",
    slug: "vestido-azul-sku123",
    title: "Vestido Azul",
    description: "Vestido de algodão",
    sku: "SKU123",
    gtin: null,
    brandName: "Luratha",
    googleProductCategoryId: null,
    condition: "new",
    price: 129.9,
    salePrice: null,
    saleStartDate: null,
    saleEndDate: null,
    currency: "BRL",
    totalStock: 5,
    adult: false,
    isBundle: false,
    multipack: 1,
    ageGroup: null,
    gender: null,
    colors: [],
    sizes: [],
    sizeType: null,
    sizeSystem: null,
    material: [],
    pattern: [],
    weightKg: null,
    productHighlights: [],
    productDetails: [],
    seasonalTags: [],
    photos: [{ id: "ph1", url: "https://cdn.example.com/ph1.webp" }],
    variants: null,
    ...overrides,
  };
}

function countItems(xml: string): number {
  return xml.match(/<item>/g)?.length ?? 0;
}

describe("escapeXml", () => {
  it("escapes the five predefined entities", () => {
    expect(escapeXml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &apos;");
  });

  it("escapes ampersands before other entities (no double-escaping)", () => {
    expect(escapeXml("a & b < c")).toBe("a &amp; b &lt; c");
  });
});

describe("buildGoogleMerchantFeed", () => {
  it("emits a valid RSS shell with no items for an empty catalog", () => {
    const xml = buildGoogleMerchantFeed([], CHANNEL);
    expect(xml).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">');
    expect(xml).toContain("<channel>");
    expect(xml).toContain("</channel>");
    expect(countItems(xml)).toBe(0);
  });

  it("maps a simple product to a single item keyed by product id", () => {
    const xml = buildGoogleMerchantFeed([makeProduct()], CHANNEL);
    expect(countItems(xml)).toBe(1);
    expect(xml).toContain("<g:id>prod-1</g:id>");
    expect(xml).not.toContain("<g:item_group_id>");
    expect(xml).toContain("<g:title>Vestido Azul</g:title>");
    expect(xml).toContain(
      "<g:link>https://www.luratha.com.br/produto/vestido-azul-sku123</g:link>",
    );
    expect(xml).toContain("<g:image_link>https://cdn.example.com/ph1.webp</g:image_link>");
    expect(xml).toContain("<g:availability>in stock</g:availability>");
    expect(xml).toContain("<g:price>129.90 BRL</g:price>");
    expect(xml).toContain("<g:brand>Luratha</g:brand>");
    expect(xml).toContain("<g:mpn>SKU123</g:mpn>");
    expect(xml).toContain("<g:condition>new</g:condition>");
  });

  it("reports out of stock when totalStock is zero", () => {
    const xml = buildGoogleMerchantFeed([makeProduct({ totalStock: 0 })], CHANNEL);
    expect(xml).toContain("<g:availability>out of stock</g:availability>");
  });

  it("expands one item per active variant and per size, grouped by parent id", () => {
    const xml = buildGoogleMerchantFeed(
      [
        makeProduct({
          variants: [
            {
              sku: "VAR-A",
              gtin: null,
              colors: ["Azul"],
              sizes: ["P", "M"],
              photoIds: [],
              active: true,
            },
            { sku: "VAR-B", gtin: null, colors: [], sizes: ["G"], photoIds: [], active: false },
          ],
        }),
      ],
      CHANNEL,
    );

    // VAR-A → 2 items (P, M); VAR-B is inactive and excluded.
    expect(countItems(xml)).toBe(2);
    expect(xml).toContain("<g:id>VAR-A-P</g:id>");
    expect(xml).toContain("<g:id>VAR-A-M</g:id>");
    expect(xml).not.toContain("VAR-B");
    expect(xml).toContain("<g:item_group_id>prod-1</g:item_group_id>");
    expect(xml).toContain("<g:color>Azul</g:color>");
    expect(xml).toContain("<g:size>P</g:size>");
    expect(xml).toContain("<g:size>M</g:size>");
  });

  it("prefers the variant's own photos when photoIds reference catalog images", () => {
    const xml = buildGoogleMerchantFeed(
      [
        makeProduct({
          photos: [
            { id: "ph1", url: "https://cdn.example.com/ph1.webp" },
            { id: "ph2", url: "https://cdn.example.com/ph2.webp" },
          ],
          variants: [
            {
              sku: "VAR-A",
              gtin: null,
              colors: [],
              sizes: [],
              photoIds: ["ph2"],
              active: true,
            },
          ],
        }),
      ],
      CHANNEL,
    );
    expect(xml).toContain("<g:image_link>https://cdn.example.com/ph2.webp</g:image_link>");
  });

  it("emits sale price with an effective-date window when both dates exist", () => {
    const xml = buildGoogleMerchantFeed(
      [
        makeProduct({
          salePrice: 99.9,
          saleStartDate: "2026-01-01T00:00:00.000Z",
          saleEndDate: "2026-01-31T23:59:59.000Z",
        }),
      ],
      CHANNEL,
    );
    expect(xml).toContain("<g:sale_price>99.90 BRL</g:sale_price>");
    expect(xml).toContain(
      "<g:sale_price_effective_date>2026-01-01T00:00:00.000Z/2026-01-31T23:59:59.000Z</g:sale_price_effective_date>",
    );
  });

  it("omits the effective-date window when only the sale price is set", () => {
    const xml = buildGoogleMerchantFeed([makeProduct({ salePrice: 99.9 })], CHANNEL);
    expect(xml).toContain("<g:sale_price>99.90 BRL</g:sale_price>");
    expect(xml).not.toContain("<g:sale_price_effective_date>");
  });

  it("emits g:gtin only when present, always emitting g:mpn as identifier", () => {
    const withGtin = buildGoogleMerchantFeed([makeProduct({ gtin: "7891234567890" })], CHANNEL);
    expect(withGtin).toContain("<g:gtin>7891234567890</g:gtin>");

    const withoutGtin = buildGoogleMerchantFeed([makeProduct({ gtin: null })], CHANNEL);
    expect(withoutGtin).not.toContain("<g:gtin>");
    expect(withoutGtin).toContain("<g:mpn>SKU123</g:mpn>");
  });

  it("escapes special characters in text fields", () => {
    const xml = buildGoogleMerchantFeed([makeProduct({ title: `Saia "P&B" <nova>` })], CHANNEL);
    expect(xml).toContain("<g:title>Saia &quot;P&amp;B&quot; &lt;nova&gt;</g:title>");
  });

  it("emits the first photo as image_link and the rest as additional_image_link", () => {
    const xml = buildGoogleMerchantFeed(
      [
        makeProduct({
          photos: [
            { id: "ph1", url: "https://cdn.example.com/a.webp" },
            { id: "ph2", url: "https://cdn.example.com/b.webp" },
            { id: "ph3", url: "https://cdn.example.com/c.webp" },
          ],
        }),
      ],
      CHANNEL,
    );
    expect(xml).toContain("<g:image_link>https://cdn.example.com/a.webp</g:image_link>");
    expect(xml.match(/<g:additional_image_link>/g)?.length).toBe(2);
  });

  it("joins multi-value attributes and emits shipping weight + custom labels", () => {
    const xml = buildGoogleMerchantFeed(
      [
        makeProduct({
          material: ["Algodão", "Linho"],
          weightKg: 0.3,
          seasonalTags: ["verao"],
        }),
      ],
      CHANNEL,
    );
    expect(xml).toContain("<g:material>Algodão/Linho</g:material>");
    expect(xml).toContain("<g:shipping_weight>0.3 kg</g:shipping_weight>");
    expect(xml).toContain("<g:custom_label_0>verao</g:custom_label_0>");
  });
});
