import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import ViewItemTracker, {
  __resetViewItemTrackerForTests,
} from "@/src/components/analytics/ViewItemTracker";
import ViewItemListTracker, {
  __resetViewItemListTrackerForTests,
} from "@/src/components/analytics/ViewItemListTracker";
import PurchaseTracker from "@/src/components/analytics/PurchaseTracker";
import {
  buildProductSlug,
  validateProduct,
  orderItemSchema,
  type Product,
  type OrderItem,
} from "@luratha/schemas";

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

function makeOrderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return orderItemSchema.parse({
    id: "prod_1__var_m",
    productId: "prod_1",
    itemSku: "LURATHA_9001_M",
    name: "Vestido Bordado Floral",
    photoId: "photo_1",
    quantity: 1,
    unitPrice: 250,
    lineTotal: 250,
    currency: "BRL",
    ...overrides,
  });
}

let fbq: ReturnType<typeof vi.fn>;

function trackNames() {
  return fbq.mock.calls.filter((c) => c[0] === "track").map((c) => c[1]);
}

beforeEach(() => {
  localStorage.clear();
  // O dedup em escopo de módulo (mérge do #215) persiste entre testes; reseta.
  __resetViewItemTrackerForTests();
  __resetViewItemListTrackerForTests();
  fbq = vi.fn();
  vi.stubGlobal("fbq", fbq);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ViewItemTracker (Meta)", () => {
  it("fires ViewContent on mount", () => {
    render(<ViewItemTracker product={makeProduct()} />);
    expect(trackNames()).toContain("ViewContent");
    const call = fbq.mock.calls.find((c) => c[1] === "ViewContent");
    expect(call?.[2]).toMatchObject({ content_type: "product", value: 289 });
  });
});

describe("ViewItemListTracker (Meta)", () => {
  it("fires ViewCategory on mount with the category name", () => {
    render(<ViewItemListTracker products={[makeProduct()]} listName="Vestidos" />);
    const call = fbq.mock.calls.find((c) => c[1] === "ViewCategory");
    expect(call?.[2]).toMatchObject({ content_category: "Vestidos" });
  });

  it("does not fire when the product list is empty", () => {
    render(<ViewItemListTracker products={[]} />);
    expect(trackNames()).not.toContain("ViewCategory");
  });
});

describe("PurchaseTracker (Meta)", () => {
  it("fires Purchase once with eventID = transactionId when the order is paid", () => {
    render(
      <PurchaseTracker
        transactionId="order_77"
        value={500}
        shipping={20}
        items={[makeOrderItem()]}
        paid
      />,
    );
    const purchases = fbq.mock.calls.filter((c) => c[1] === "Purchase");
    expect(purchases).toHaveLength(1);
    expect(purchases[0][2]).toMatchObject({ value: 500, content_type: "product" });
    expect(purchases[0][3]).toEqual({ eventID: "order_77" });
  });

  it("does NOT fire the Meta Purchase when the order is not paid (PIX/boleto pendente)", () => {
    render(
      <PurchaseTracker
        transactionId="order_pending"
        value={500}
        shipping={20}
        items={[makeOrderItem()]}
        paid={false}
      />,
    );
    expect(fbq.mock.calls.filter((c) => c[1] === "Purchase")).toHaveLength(0);
  });

  it("dedupes across remounts via localStorage (no double count)", () => {
    const props = {
      transactionId: "order_88",
      value: 500,
      shipping: 20,
      items: [makeOrderItem()],
      paid: true,
    };
    const first = render(<PurchaseTracker {...props} />);
    first.unmount();
    render(<PurchaseTracker {...props} />);
    expect(fbq.mock.calls.filter((c) => c[1] === "Purchase")).toHaveLength(1);
  });
});
