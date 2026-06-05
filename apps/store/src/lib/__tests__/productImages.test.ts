import { describe, expect, it } from "vitest";
import { validateProduct } from "@luratha/schemas";
import {
  getProductCardImage,
  getProductGalleryImages,
  getProductPrimaryImage,
} from "@/src/lib/productImages";

const now = "2026-04-16T00:00:00.000Z";

const productWithAssets = validateProduct({
  id: "prod_assets_1",
  title: "Vestido Teste",
  description: "Descrição",
  sku: "LURATHA_ASSET_001",
  status: "active",
  isPurchasable: true,
  brandName: "Luratha",
  categoryId: "cat_vestidos",
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
        card: {
          width: 400,
          height: 500,
          storagePath: "products/prod_assets_1/asset_1/card.webp",
          downloadUrl: "https://example.com/card.webp",
          format: "webp",
        },
        zoom: {
          width: 2000,
          height: 2500,
          storagePath: "products/prod_assets_1/asset_1/zoom.webp",
          downloadUrl: "https://example.com/zoom.webp",
          format: "webp",
        },
        mobile: {
          width: 480,
          height: 600,
          storagePath: "products/prod_assets_1/asset_1/mobile.webp",
          downloadUrl: "https://example.com/mobile.webp",
          format: "webp",
        },
        tablet: {
          width: 768,
          height: 960,
          storagePath: "products/prod_assets_1/asset_1/tablet.webp",
          downloadUrl: "https://example.com/tablet.webp",
          format: "webp",
        },
        desktop: {
          width: 1200,
          height: 1500,
          storagePath: "products/prod_assets_1/asset_1/desktop.webp",
          downloadUrl: "https://example.com/desktop.webp",
          format: "webp",
        },
      },
      createdAt: now,
      updatedAt: now,
    },
  ],
  lifeStylePhotos: [],
  createdAt: now,
  updatedAt: now,
});

describe("productImages", () => {
  it("returns the desktop downloadUrl as primary image", () => {
    expect(getProductPrimaryImage(productWithAssets, "fallback")).toBe(
      "https://example.com/desktop.webp",
    );
  });

  it("returns the card downloadUrl for product cards when available", () => {
    expect(getProductCardImage(productWithAssets, "fallback")).toBe(
      "https://example.com/card.webp",
    );
  });

  it("builds responsive gallery data from product assets", () => {
    const gallery = getProductGalleryImages(productWithAssets, "fallback");
    expect(gallery).toHaveLength(1);
    expect(gallery[0].zoomUrl).toBe("https://example.com/zoom.webp");
    expect(gallery[0].srcSet).toContain("480w");
  });
});
