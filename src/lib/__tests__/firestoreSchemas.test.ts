import { describe, expect, it } from "vitest";
import {
  buildSearchTokens,
  normalizeSearchText,
  validateCart,
  validateOrder,
  validatePhotoAsset,
  validateProduct,
  type CartSchema,
  type OrderSchema,
  type PhotoAssetSchema,
  type ProductSchema,
} from "@/src/lib/firestoreSchemas";

const photo: PhotoAssetSchema = {
  id: "photo-1",
  storagePath: "products/p-1/look-1.jpg",
  bucket: "luratha-96386.appspot.com",
  contentType: "image/jpeg",
  width: 1200,
  height: 1600,
  sizeBytes: 327000,
  alt: "Vestido linho frente",
  hash: "sha256-photo-1",
  tags: ["vestido", "linho"],
  createdAt: "2026-04-01T12:00:00.000Z",
  updatedAt: "2026-04-01T12:00:00.000Z",
};

const product: ProductSchema = {
  id: "product-1",
  slug: "vestido-linho-natural",
  name: "Vestido Linho Natural",
  description: "Vestido artesanal de linho.",
  categorySlug: "vestidos",
  status: "active",
  currency: "BRL",
  photoIds: ["photo-1", "photo-2"],
  primaryPhotoId: "photo-1",
  variants: [
    {
      id: "variant-1",
      sku: "LUR-VEST-LINHO-P",
      size: "P",
      priceCents: 28900,
      compareAtPriceCents: 32900,
      stockQty: 5,
      active: true,
    },
  ],
  minPriceCents: 28900,
  maxPriceCents: 28900,
  totalStock: 5,
  ratingAvg: 4.8,
  ratingCount: 12,
  searchText: "vestido linho natural artesanal",
  searchTokens: ["vestido", "linho", "natural", "artesanal"],
  searchVector: [0.12, -0.44, 0.98],
  vectorModel: "text-embedding-3-small",
  createdAt: "2026-04-01T12:00:00.000Z",
  updatedAt: "2026-04-01T12:00:00.000Z",
};

const cart: CartSchema = {
  id: "cart-user-1",
  customerId: "user-1",
  currency: "BRL",
  items: [
    {
      productId: "product-1",
      variantId: "variant-1",
      sku: "LUR-VEST-LINHO-P",
      quantity: 2,
      unitPriceCents: 28900,
      lineTotalCents: 57800,
      photoIdSnapshot: "photo-1",
      productNameSnapshot: "Vestido Linho Natural",
    },
  ],
  subtotalCents: 57800,
  discountCents: 1000,
  shippingCents: 1500,
  totalCents: 58300,
  createdAt: "2026-04-01T12:00:00.000Z",
  updatedAt: "2026-04-01T12:00:00.000Z",
};

const order: OrderSchema = {
  id: "order-1",
  orderNumber: "LUR-2026-0001",
  customerId: "user-1",
  status: "pending",
  currency: "BRL",
  items: cart.items,
  shippingAddress: {
    recipient: "Maria Silva",
    street: "Rua das Flores",
    number: "120",
    neighborhood: "Centro",
    city: "São Paulo",
    state: "SP",
    zipCode: "01000-000",
    country: "BR",
  },
  subtotalCents: 57800,
  discountCents: 1000,
  shippingCents: 1500,
  totalCents: 58300,
  createdAt: "2026-04-01T12:00:00.000Z",
  updatedAt: "2026-04-01T12:00:00.000Z",
};

describe("firestoreSchemas", () => {
  it("normalizes search text and builds unique tokens", () => {
    const text = normalizeSearchText("  VESTIDO  Línhô, natural! ");
    expect(text).toBe("vestido linho natural");

    const tokens = buildSearchTokens("Vestido Linho", "linho artesanal");
    expect(tokens).toEqual(["vestido", "linho", "artesanal"]);
  });

  it("accepts a valid photo asset and enables photo sharing across products", () => {
    const result = validatePhotoAsset(photo);
    expect(result.ok).toBe(true);

    const productA = { ...product, id: "product-a", photoIds: ["photo-1"] };
    const productB = { ...product, id: "product-b", photoIds: ["photo-1", "photo-2"] };

    expect(validateProduct(productA).ok).toBe(true);
    expect(validateProduct(productB).ok).toBe(true);
  });

  it("rejects product when price, primary photo, or vector metadata is invalid", () => {
    const result = validateProduct({
      ...product,
      minPriceCents: 0,
      primaryPhotoId: "photo-x",
      searchVector: [0.1, Number.NaN],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toContain("minPriceCents must be an integer > 0");
      expect(result.errors.join(" ")).toContain("primaryPhotoId must exist in photoIds");
      expect(result.errors.join(" ")).toContain("searchVector must be an array of finite numbers when provided");
    }
  });

  it("rejects cart with quantity <= 0", () => {
    const result = validateCart({
      ...cart,
      items: [{ ...cart.items[0], quantity: 0, lineTotalCents: 0 }],
      subtotalCents: 0,
      totalCents: 500,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toContain("quantity must be an integer > 0");
    }
  });

  it("rejects order when totals do not close", () => {
    const result = validateOrder({
      ...order,
      totalCents: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toContain(
        "totalCents must be subtotalCents - discountCents + shippingCents"
      );
    }
  });

  it("accepts valid product, cart, and order", () => {
    expect(validateProduct(product).ok).toBe(true);
    expect(validateCart(cart).ok).toBe(true);
    expect(validateOrder(order).ok).toBe(true);
  });
});
