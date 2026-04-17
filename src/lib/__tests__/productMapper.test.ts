import { describe, expect, it } from "vitest";
import type { Product as FirestoreProduct } from "@/src/schemas/firestore";
import { mapFirestoreProductToCard } from "@/src/lib/repositories/productMapper";

describe("productMapper", () => {
  it("maps firestore product to card shape", () => {
    const firestoreProduct = {
      id: "prod_1",
      slug: "vestido-linho-prod-1",
      title: "Vestido de Linho",
      description: "desc",
      isPurchasable: true,
      brandName: "Luratha",
      sku: "LURATHA_0001",
      categoryId: "cat_vestidos",
      tags: [],
      materialTags: [],
      seasonalTags: [],
      price: {
        price: 320,
        salePrice: 289,
        priceMin: null,
        priceMax: null,
        currency: "BRL" as const,
        startDate: null,
        endDate: null,
      },
      salePrice: null,
      condition: "new" as const,
      adult: false,
      isBundle: false,
      multipack: 1,
      age_group: null,
      gender: null,
      color: null,
      size: null,
      sizeType: null,
      sizeSystem: null,
      material: [],
      pattern: [],
      dimensions: null,
      productDetail: null,
      productHighlight: null,
      photoIds: ["https://example.com/photo.jpg"],
      lifeStylePhotoIds: null,
      videoUrls: [],
      ratingAverage: 4.9,
      reviewCount: 12,
      totalStock: 3,
      variants: null,
      vectorEmbedding: null,
      searchEmbedding: null,
      status: "active" as const,
      gtin: null,
      mpn: null,
      shortTitle: null,
      googleProductCategoryId: null,
      createdAt: "2026-04-17T00:00:00.000Z",
      updatedAt: "2026-04-17T00:00:00.000Z",
    } satisfies FirestoreProduct;

    const card = mapFirestoreProductToCard(firestoreProduct, { categorySlug: "vestidos" });

    expect(card).toMatchObject({
      id: "prod_1",
      name: "Vestido de Linho",
      slug: "vestido-linho-prod-1",
      categorySlug: "vestidos",
      price: 289,
      originalPrice: 320,
      imageUrl: "https://example.com/photo.jpg",
      rating: 4.9,
      reviewCount: 12,
    });
  });
});
