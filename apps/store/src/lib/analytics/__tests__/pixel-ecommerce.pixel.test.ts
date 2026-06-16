import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildProductSlug,
  validateProduct,
  validateCartItem,
  orderItemSchema,
  type Product,
  type CartItem,
  type OrderItem,
} from "@luratha/schemas";
import {
  productToContent,
  cartLineToContent,
  orderItemToContent,
  trackPixelViewContent,
  trackPixelViewCategory,
  trackPixelAddToCart,
  trackPixelInitiateCheckout,
  trackPixelAddPaymentInfo,
  trackPixelPurchase,
} from "@/src/lib/analytics/pixel-ecommerce";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return validateProduct({
    id: "prod_1",
    title: "Vestido Bordado Floral",
    slug: buildProductSlug("Vestido Bordado Floral", "LURATHA_9001"),
    description: "Descrição",
    sku: "LURATHA_9001",
    status: "active",
    isPurchasable: true,
    brandName: "Luratha",
    categoryId: "cat_vestidos",
    tags: [],
    materialTags: [],
    seasonalTags: [],
    price: { price: 289, salePrice: null, priceMin: 289, priceMax: 289, currency: "BRL" },
    photoAssets: [],
    lifeStylePhotos: [],
    totalStock: 10,
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
    ...overrides,
  });
}

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return validateCartItem({
    id: "prod_1__var_m",
    userId: "guestcart",
    productId: "prod_1",
    variantId: "var_m",
    variantSku: "LURATHA_9001_M",
    productSlug: "vestido-bordado-floral-luratha-9001",
    name: "Vestido Bordado Floral",
    photoId: "photo_1",
    imageUrl: "https://example.com/img.jpg",
    variantLabel: "M",
    unitPrice: 200,
    quantity: 2,
    currency: "BRL",
    addedAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
    ...overrides,
  });
}

function makeOrderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return orderItemSchema.parse({
    id: "prod_1__var_m",
    productId: "prod_1",
    variantId: "var_m",
    itemSku: "LURATHA_9001_M",
    name: "Vestido Bordado Floral",
    photoId: "photo_1",
    quantity: 2,
    unitPrice: 200,
    lineTotal: 400,
    currency: "BRL",
    ...overrides,
  });
}

let fbq: ReturnType<typeof vi.fn>;

function lastTrack() {
  const calls = fbq.mock.calls.filter((c) => c[0] === "track");
  return calls[calls.length - 1] as [string, string, Record<string, unknown>, ...unknown[]];
}

beforeEach(() => {
  fbq = vi.fn();
  vi.stubGlobal("fbq", fbq);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pixel mappers", () => {
  it("productToContent uses the SKU as id (catalog match) and prefers the sale price", () => {
    const content = productToContent(
      makeProduct({
        price: {
          price: 200,
          salePrice: 150,
          priceMin: 150,
          priceMax: 200,
          currency: "BRL",
          startDate: null,
          endDate: null,
        },
      }),
    );
    expect(content).toEqual({ id: "LURATHA_9001", quantity: 1, item_price: 150 });
  });

  it("cartLineToContent uses variantSku and the line quantity", () => {
    const content = cartLineToContent({
      variantSku: "SKU_M",
      name: "Peça",
      unitPrice: 120,
      quantity: 3,
    });
    expect(content).toEqual({ id: "SKU_M", quantity: 3, item_price: 120 });
  });

  it("orderItemToContent uses itemSku", () => {
    const content = orderItemToContent(makeOrderItem());
    expect(content).toEqual({ id: "LURATHA_9001_M", quantity: 2, item_price: 200 });
  });
});

describe("pixel funnel events", () => {
  it("trackPixelViewContent emits ViewContent with content_type product, SKU and value", () => {
    trackPixelViewContent(makeProduct());
    const [, name, params] = lastTrack();
    expect(name).toBe("ViewContent");
    expect(params).toMatchObject({
      content_type: "product",
      content_ids: ["LURATHA_9001"],
      content_name: "Vestido Bordado Floral",
      currency: "BRL",
      value: 289,
    });
    expect(params.contents).toEqual([{ id: "LURATHA_9001", quantity: 1, item_price: 289 }]);
  });

  it("trackPixelViewCategory emits ViewCategory with all ids, summed value and category name", () => {
    const a = makeProduct({
      id: "p1",
      title: "Peça A",
      sku: "LURATHA_1",
      slug: buildProductSlug("Peça A", "LURATHA_1"),
    });
    const b = makeProduct({
      id: "p2",
      title: "Peça B",
      sku: "LURATHA_2",
      slug: buildProductSlug("Peça B", "LURATHA_2"),
    });
    trackPixelViewCategory([a, b], "Vestidos");
    const [, name, params] = lastTrack();
    expect(name).toBe("ViewCategory");
    expect(params).toMatchObject({
      content_type: "product",
      content_category: "Vestidos",
      content_name: "Vestidos",
      value: 578,
    });
    expect(params.content_ids).toEqual(["LURATHA_1", "LURATHA_2"]);
  });

  it("trackPixelAddToCart computes value = price × quantity", () => {
    trackPixelAddToCart({ variantSku: "SKU_A", name: "Peça", unitPrice: 120, quantity: 3 });
    const [, name, params] = lastTrack();
    expect(name).toBe("AddToCart");
    expect(params).toMatchObject({ currency: "BRL", value: 360, content_ids: ["SKU_A"] });
  });

  it("trackPixelInitiateCheckout emits InitiateCheckout with num_items and value", () => {
    trackPixelInitiateCheckout([makeCartItem()], 400);
    const [, name, params] = lastTrack();
    expect(name).toBe("InitiateCheckout");
    expect(params).toMatchObject({ currency: "BRL", value: 400, num_items: 2 });
  });

  it("trackPixelAddPaymentInfo emits AddPaymentInfo with num_items and value", () => {
    trackPixelAddPaymentInfo([makeCartItem()], 420);
    const [, name, params] = lastTrack();
    expect(name).toBe("AddPaymentInfo");
    expect(params).toMatchObject({ currency: "BRL", value: 420, num_items: 2 });
  });

  it("trackPixelPurchase emits Purchase with eventID = transactionId for CAPI dedupe", () => {
    trackPixelPurchase({ transactionId: "order_9", value: 500, items: [makeOrderItem()] });
    const call = lastTrack();
    expect(call[1]).toBe("Purchase");
    expect(call[2]).toMatchObject({
      content_type: "product",
      currency: "BRL",
      value: 500,
      num_items: 2,
      content_ids: ["LURATHA_9001_M"],
    });
    expect(call[3]).toEqual({ eventID: "order_9" });
  });
});
