import { describe, expect, it } from "vitest";
import { validateProduct } from "@/src/schemas/firestore";
import { getProductGalleryImages, getProductPrimaryImage } from "@/src/lib/productImages";

const now = "2026-04-16T00:00:00.000Z";

const productWithAssets = validateProduct({
  id: "prod_assets_1",
  title: "Vestido Teste",
  description: "Descrição",
  sku: "LURATHA_ASSET_001",
  status: "active",
  isPurchasable: true,
  brandName: "Luratha",
  category: [],
  tags: [],
  materialTags: [],
  seasonalTags: [],
  price: { price: 100, priceMin: 100, priceMax: 100, currency: "BRL" },
  totalStock: 1,
  photoAssets: [
    {
      id: "asset_1",
      alt: "Alt principal",
      resolutions: {
        mobile: {
          width: 480,
          height: 600,
          storagePath: "products/prod_assets_1/asset_1/mobile.webp",
          downloadUrl: "https://example.com/mobile.webp",
          temporaryUrl: null,
          format: "webp",
        },
        tablet: {
          width: 768,
          height: 960,
          storagePath: "products/prod_assets_1/asset_1/tablet.webp",
          downloadUrl: "https://example.com/tablet.webp",
          temporaryUrl: null,
          format: "webp",
        },
        desktop: {
          width: 1200,
          height: 1500,
          storagePath: "products/prod_assets_1/asset_1/desktop.webp",
          downloadUrl: "https://example.com/desktop.webp",
          temporaryUrl: "https://example.com/temp-desktop.webp",
          format: "webp",
        },
      },
      createdAt: now,
      updatedAt: now,
    },
  ],
  photoIds: [],
  createdAt: now,
  updatedAt: now,
});

describe("productImages", () => {
  it("returns temporary URL as primary image when available", () => {
    expect(getProductPrimaryImage(productWithAssets, "fallback")).toBe("https://example.com/temp-desktop.webp");
  });

  it("builds responsive gallery data from product assets", () => {
    const gallery = getProductGalleryImages(productWithAssets, "fallback");
    expect(gallery).toHaveLength(1);
    expect(gallery[0].links).toHaveLength(3);
    expect(gallery[0].srcSet).toContain("480w");
  });
});
