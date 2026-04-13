import { describe, expect, it } from "vitest";
import {
  cartItemSchema,
  couponSchema,
  orderSchema,
  photoSchema,
  productSchema,
  vectorSearchRequestSchema,
} from "@/src/schemas/firestore";

const now = "2026-04-13T16:00:00.000Z";

const validPhoto = {
  id: "photo_cream_linen_front",
  storagePath: "products/photo_cream_linen_front/main.webp",
  downloadUrl: "https://storage.googleapis.com/luratha-96386/o/photo.webp",
  checksumSha256: "ff53d5f4027fbd03da88f47f7158f453560f89c3818f2cf5ad1a4555f9f9f7a0",
  width: 1800,
  height: 2400,
  alt: "Vestido de linho cru visto de frente",
  tags: ["vestido", "linho"],
  createdAt: now,
  updatedAt: now,
};

const validProduct = {
  id: "prod_vestido_linho_cru",
  slug: "vestido-linho-cru",
  name: "Vestido Linho Cru",
  description: "Vestido artesanal de linho cru com modelagem midi.",
  categorySlug: "vestidos",
  tags: ["linho", "midi"],
  materialTags: ["linho"],
  seasonalTags: ["verao"],
  priceMin: 329,
  priceMax: 359,
  currency: "BRL" as const,
  ratingAverage: 4.8,
  reviewCount: 28,
  totalStock: 14,
  status: "active" as const,
  photoIds: ["photo_cream_linen_front", "photo_cream_linen_back"],
  primaryPhotoId: "photo_cream_linen_front",
  variants: [
    {
      sku: "LURATHA-001",
      size: "P",
      price: 329,
      compareAtPrice: 399,
      stock: 6,
      photoIds: ["photo_cream_linen_front"],
      active: true,
    },
    {
      sku: "LURATHA-002",
      size: "M",
      price: 359,
      stock: 8,
      photoIds: ["photo_cream_linen_front", "photo_cream_linen_back"],
      active: true,
    },
  ],
  searchText: "vestido linho cru midi artesanal",
  searchableTokens: ["vestido", "linho", "midi", "artesanal"],
  searchEmbedding: [0.01, 0.22, 0.09, 0.41, 0.37, 0.12, 0.08, 0.74],
  publishedAt: now,
  createdAt: now,
  updatedAt: now,
};

const validOrder = {
  id: "ord_20260413_000001",
  userId: "uid_customer_1001",
  orderNumber: "LUR-2026-0001",
  status: "paid" as const,
  paymentMethod: "pix" as const,
  paymentStatus: "paid" as const,
  items: [
    {
      id: "item_1",
      productId: "prod_vestido_linho_cru",
      variantSku: "LURATHA-001",
      name: "Vestido Linho Cru",
      photoId: "photo_cream_linen_front",
      quantity: 2,
      unitPrice: 329,
      lineTotal: 658,
      currency: "BRL" as const,
    },
  ],
  itemCount: 2,
  subtotal: 658,
  discountTotal: 30,
  shippingTotal: 20,
  grandTotal: 648,
  currency: "BRL" as const,
  couponCode: "LINHO10",
  shippingAddress: {
    recipientName: "Ana Souza",
    line1: "Rua das Flores, 123",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    postalCode: "01000-000",
    country: "BR" as const,
  },
  createdAt: now,
  updatedAt: now,
};

describe("firestore schemas", () => {
  it("accepts a shared photo document", () => {
    expect(photoSchema.parse(validPhoto)).toMatchObject(validPhoto);
  });

  it("accepts a valid product with reusable photo references", () => {
    expect(productSchema.parse(validProduct)).toMatchObject(validProduct);
  });

  it("rejects product with non-positive prices", () => {
    const invalid = { ...validProduct, priceMin: 0 };
    expect(() => productSchema.parse(invalid)).toThrow("Too small");
  });

  it("rejects product when variant references unknown photoId", () => {
    const invalid = {
      ...validProduct,
      variants: [
        {
          ...validProduct.variants[0],
          sku: "LURATHA-003",
          photoIds: ["photo_missing"],
        },
      ],
    };

    expect(() => productSchema.parse(invalid)).toThrow(
      "all variant photoIds must exist in product photoIds",
    );
  });

  it("accepts a valid order", () => {
    expect(orderSchema.parse(validOrder)).toMatchObject(validOrder);
  });

  it("rejects order item with quantity lower than one", () => {
    const invalid = {
      ...validOrder,
      items: [{ ...validOrder.items[0], quantity: 0 }],
      itemCount: 0,
      subtotal: 0,
      grandTotal: 20,
    };

    expect(() => orderSchema.parse(invalid)).toThrow("Too small");
  });

  it("rejects inconsistent order totals", () => {
    const invalid = { ...validOrder, grandTotal: 1 };
    expect(() => orderSchema.parse(invalid)).toThrow(
      "grandTotal must match subtotal - discountTotal + shippingTotal",
    );
  });

  it("rejects cart item with quantity lower than one", () => {
    const invalid = {
      id: "cart_item_1",
      userId: "uid_customer_1001",
      productId: "prod_vestido_linho_cru",
      variantSku: "LURATHA-001",
      productSlug: "vestido-linho-cru",
      name: "Vestido Linho Cru",
      photoId: "photo_cream_linen_front",
      unitPrice: 329,
      quantity: 0,
      currency: "BRL",
      addedAt: now,
      updatedAt: now,
    };
    expect(() => cartItemSchema.parse(invalid)).toThrow("Too small");
  });

  it("rejects coupon percentage above one hundred", () => {
    const invalid = {
      id: "coupon_linho",
      code: "LINHO10",
      type: "percentage" as const,
      amount: 150,
      startsAt: now,
      expiresAt: "2026-05-13T16:00:00.000Z",
      usageCount: 0,
      active: true,
    };
    expect(() => couponSchema.parse(invalid)).toThrow(
      "percentage coupon amount must be lower than or equal to 100",
    );
  });

  it("accepts vector search request for enterprise queries", () => {
    const request = {
      embedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      topK: 20,
      minScore: 0.4,
      categorySlug: "vestidos",
    };
    expect(vectorSearchRequestSchema.parse(request)).toMatchObject(request);
  });
});
