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
  productToItem,
  cartLineToItem,
  orderItemToItem,
  sumItemsValue,
  trackViewItem,
  trackViewItemList,
  trackSelectItem,
  trackAddToCart,
  trackRemoveFromCart,
  trackViewCart,
  trackBeginCheckout,
  trackAddShippingInfo,
  trackAddPaymentInfo,
  trackPurchase,
  trackLogin,
  trackSignUp,
  trackSearch,
  sanitizeSearchTerm,
} from "@/src/lib/analytics/ecommerce";

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

let gtag: ReturnType<typeof vi.fn>;

function lastEvent() {
  const calls = gtag.mock.calls.filter((c) => c[0] === "event");
  return calls[calls.length - 1] as [string, string, Record<string, unknown>];
}

beforeEach(() => {
  gtag = vi.fn();
  vi.stubGlobal("gtag", gtag);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ecommerce mappers", () => {
  it("productToItem uses sku as item_id and the sale price when present", () => {
    const product = makeProduct({
      price: {
        price: 499,
        salePrice: 389,
        priceMin: 389,
        priceMax: 499,
        currency: "BRL",
        startDate: null,
        endDate: null,
      },
    });
    expect(productToItem(product)).toEqual({
      item_id: "LURATHA_9001",
      item_name: "Vestido Bordado Floral",
      item_brand: "Luratha",
      price: 389,
      quantity: 1,
    });
  });

  it("productToItem includes index when provided", () => {
    expect(productToItem(makeProduct(), 2)).toMatchObject({ index: 2 });
  });

  it("cartLineToItem maps sku, variant label, price and quantity", () => {
    expect(cartLineToItem(makeCartItem())).toEqual({
      item_id: "LURATHA_9001_M",
      item_name: "Vestido Bordado Floral",
      item_variant: "M",
      price: 200,
      quantity: 2,
    });
  });

  it("orderItemToItem maps the order line", () => {
    expect(orderItemToItem(makeOrderItem())).toEqual({
      item_id: "LURATHA_9001_M",
      item_name: "Vestido Bordado Floral",
      price: 200,
      quantity: 2,
    });
  });

  it("sumItemsValue sums price × quantity", () => {
    const items = [makeCartItem(), makeCartItem({ unitPrice: 50, quantity: 1 })].map(
      cartLineToItem,
    );
    expect(sumItemsValue(items)).toBe(450);
  });
});

describe("ecommerce events", () => {
  it("trackViewItem emits view_item with currency, value and item", () => {
    trackViewItem(makeProduct());
    const [, name, params] = lastEvent();
    expect(name).toBe("view_item");
    expect(params).toMatchObject({ currency: "BRL", value: 289 });
    expect(params.items).toEqual([
      {
        item_id: "LURATHA_9001",
        item_name: "Vestido Bordado Floral",
        item_brand: "Luratha",
        price: 289,
        quantity: 1,
      },
    ]);
  });

  it("trackViewItemList emits indexed items and the list name", () => {
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
    trackViewItemList([a, b], "Vestidos");
    const [, name, params] = lastEvent();
    expect(name).toBe("view_item_list");
    expect(params.item_list_name).toBe("Vestidos");
    expect(params.items).toHaveLength(2);
    expect((params.items as { index: number }[]).map((i) => i.index)).toEqual([0, 1]);
  });

  it("trackSelectItem emits select_item with the list name and indexed item", () => {
    trackSelectItem(makeProduct(), "Vestidos", 3);
    const [, name, params] = lastEvent();
    expect(name).toBe("select_item");
    expect(params.item_list_name).toBe("Vestidos");
    expect(params.items).toEqual([
      {
        item_id: "LURATHA_9001",
        item_name: "Vestido Bordado Floral",
        item_brand: "Luratha",
        price: 289,
        quantity: 1,
        index: 3,
      },
    ]);
  });

  it("trackSelectItem omits item_list_name when not given (no currency/value per spec)", () => {
    trackSelectItem(makeProduct());
    const [, name, params] = lastEvent();
    expect(name).toBe("select_item");
    expect(params).not.toHaveProperty("item_list_name");
    expect(params).not.toHaveProperty("currency");
    expect(params).not.toHaveProperty("value");
  });

  it("trackAddToCart computes value = price × quantity", () => {
    trackAddToCart({ variantSku: "SKU_A", name: "Peça", unitPrice: 120, quantity: 3 });
    const [, name, params] = lastEvent();
    expect(name).toBe("add_to_cart");
    expect(params).toMatchObject({ currency: "BRL", value: 360 });
    expect(params.items).toEqual([
      { item_id: "SKU_A", item_name: "Peça", price: 120, quantity: 3 },
    ]);
  });

  it("trackAddToCart defaults quantity to 1 when omitted", () => {
    trackAddToCart({ variantSku: "SKU_A", name: "Peça", unitPrice: 120 });
    const [, , params] = lastEvent();
    expect(params).toMatchObject({ value: 120 });
    expect((params.items as { quantity: number }[])[0].quantity).toBe(1);
  });

  it("trackRemoveFromCart emits remove_from_cart with the line value", () => {
    trackRemoveFromCart(makeCartItem());
    const [, name, params] = lastEvent();
    expect(name).toBe("remove_from_cart");
    expect(params).toMatchObject({ currency: "BRL", value: 400 });
  });

  it("trackViewCart sums the cart value when not given", () => {
    trackViewCart([makeCartItem(), makeCartItem({ unitPrice: 100, quantity: 1 })]);
    const [, name, params] = lastEvent();
    expect(name).toBe("view_cart");
    expect(params).toMatchObject({ currency: "BRL", value: 500 });
    expect(params.items).toHaveLength(2);
  });

  it("trackViewCart honors an explicit value", () => {
    trackViewCart([makeCartItem()], 12.5);
    const [, , params] = lastEvent();
    expect(params).toMatchObject({ value: 12.5 });
  });

  it("trackBeginCheckout emits the cart items and value", () => {
    trackBeginCheckout([makeCartItem()], 400, "PROMO10");
    const [, name, params] = lastEvent();
    expect(name).toBe("begin_checkout");
    expect(params).toMatchObject({ currency: "BRL", value: 400, coupon: "PROMO10" });
  });

  it("trackAddShippingInfo includes the shipping_tier", () => {
    trackAddShippingInfo([makeCartItem()], 420, "SEDEX");
    const [, name, params] = lastEvent();
    expect(name).toBe("add_shipping_info");
    expect(params).toMatchObject({ value: 420, shipping_tier: "SEDEX" });
  });

  it("trackAddPaymentInfo includes the payment_type", () => {
    trackAddPaymentInfo([makeCartItem()], 420, "pix");
    const [, name, params] = lastEvent();
    expect(name).toBe("add_payment_info");
    expect(params).toMatchObject({ value: 420, payment_type: "pix" });
  });

  it("trackPurchase emits transaction_id, shipping and mapped order items", () => {
    trackPurchase({
      transactionId: "order_123",
      value: 430,
      shipping: 30,
      items: [makeOrderItem()],
      coupon: "PROMO10",
    });
    const [, name, params] = lastEvent();
    expect(name).toBe("purchase");
    expect(params).toMatchObject({
      transaction_id: "order_123",
      currency: "BRL",
      value: 430,
      shipping: 30,
      coupon: "PROMO10",
    });
    expect(params.items).toEqual([
      { item_id: "LURATHA_9001_M", item_name: "Vestido Bordado Floral", price: 200, quantity: 2 },
    ]);
  });
});

describe("engagement events", () => {
  it("trackLogin emits login with the default method", () => {
    trackLogin();
    const [, name, params] = lastEvent();
    expect(name).toBe("login");
    expect(params).toEqual({ method: "password" });
  });

  it("trackLogin honors a custom method", () => {
    trackLogin("google");
    const [, , params] = lastEvent();
    expect(params).toEqual({ method: "google" });
  });

  it("trackSignUp emits sign_up with the default method", () => {
    trackSignUp();
    const [, name, params] = lastEvent();
    expect(name).toBe("sign_up");
    expect(params).toEqual({ method: "password" });
  });

  it("trackSearch emits search with the search_term", () => {
    trackSearch("vestido de linho");
    const [, name, params] = lastEvent();
    expect(name).toBe("search");
    expect(params).toEqual({ search_term: "vestido de linho" });
  });

  it("trackSearch redacts e-mail addresses from the term", () => {
    trackSearch("joao@gmail.com vestido");
    const [, , params] = lastEvent();
    expect(params).toEqual({ search_term: "[email] vestido" });
  });

  it("trackSearch redacts BR phone numbers from the term", () => {
    trackSearch("(11) 98765-4321 blusa");
    const [, , params] = lastEvent();
    expect(params).toEqual({ search_term: "[phone] blusa" });
  });

  it("trackSearch redacts CPF and CNPJ", () => {
    trackSearch("123.456.789-00 e 12.345.678/0001-90");
    const [, , params] = lastEvent();
    expect(params).toEqual({ search_term: "[cpf] e [cnpj]" });
  });

  it("trackSearch trims whitespace and is a no-op for blank input", () => {
    trackSearch("   ");
    expect(gtag).not.toHaveBeenCalled();
  });

  it("trackSearch still emits when the term reduces to a redaction tag only", () => {
    // PII puro vira `[email]` — preserva o sinal de "houve uma busca" sem
    // vazar dado; só whitespace puro é silenciado.
    trackSearch("foo@bar.com");
    const [, , params] = lastEvent();
    expect(params).toEqual({ search_term: "[email]" });
  });
});

describe("sanitizeSearchTerm", () => {
  it("trims surrounding whitespace", () => {
    expect(sanitizeSearchTerm("   vestido   ")).toBe("vestido");
  });

  it("truncates strings longer than 100 chars before redaction", () => {
    const long = "a".repeat(250);
    expect(sanitizeSearchTerm(long)).toHaveLength(100);
  });

  it("redacts multiple PII patterns in one pass", () => {
    expect(sanitizeSearchTerm("Lucas (11) 98765-4321 lucas@x.com 123.456.789-00")).toBe(
      "Lucas [phone] [email] [cpf]",
    );
  });

  it("redacts phone with +55 country code", () => {
    expect(sanitizeSearchTerm("+55 11 98765-4321")).toBe("[phone]");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(sanitizeSearchTerm("   ")).toBe("");
  });
});
