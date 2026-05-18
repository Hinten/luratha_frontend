import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/src/app/api/stock/post";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const {
  mockStockSet,
  mockStockDoc,
  mockProductGet,
  mockProductDoc,
  mockCollection,
} = vi.hoisted(() => {
  // Stock collection
  const mockStockSet = vi.fn().mockResolvedValue(undefined);
  const mockStockDocRef = {
    set: mockStockSet,
  };
  const mockStockDoc = vi.fn().mockReturnValue(mockStockDocRef);

  // Products collection — single doc lookup (by id)
  const mockProductGet = vi.fn();
  const mockProductDocRef = {
    get: mockProductGet,
    withConverter: vi.fn(),
  };
  mockProductDocRef.withConverter.mockReturnValue(mockProductDocRef);
  const mockProductDoc = vi.fn().mockReturnValue(mockProductDocRef);

  // collection() dispatcher
  const mockCollection = vi.fn();

  return {
    mockStockSet,
    mockStockDoc,
    mockProductGet,
    mockProductDoc,
    mockCollection,
  };
});

// Build fake query chain returned by .where(...).limit(1).get()
function buildFakeQueryChain(productData: Record<string, unknown> | null) {
  const docs = productData
    ? [{ data: () => productData }]
    : [];
  const get = vi.fn().mockResolvedValue({ empty: !productData, docs });
  const limit = vi.fn().mockReturnValue({ get });
  const where = vi.fn().mockReturnValue({ limit });
  return { where, limit, get };
}

vi.mock("@/src/lib/firestore/firebaseAdmin", () => ({
  adminDb: {
    collection: mockCollection,
  },
  adminApp: { options: { credential: undefined } },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRODUCT_ID = "prod_test_123";
const PRODUCT_SKU = "LURATHA_001";
const now = "2026-04-27T00:00:00.000Z";

function buildStoredProduct(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: PRODUCT_ID,
    title: "Vestido Teste",
    description: "Vestido para testes.",
    slug: "vestido-teste-luratha-001-br",
    sku: PRODUCT_SKU,
    status: "active",
    categoryId: "cat_vestidos",
    price: { price: 299, currency: "BRL", salePrice: null, priceMin: null, priceMax: null, startDate: null, endDate: null },
    salePrice: null,
    shortTitle: null,
    gtin: null,
    mpn: null,
    isPurchasable: true,
    brandName: "Luratha",
    googleProductCategoryId: null,
    tags: [],
    materialTags: [],
    seasonalTags: [],
    condition: "new",
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
    photoAssets: [],
    lifeStylePhotos: [],
    videoUrls: [],
    ratingAverage: null,
    reviewCount: null,
    totalStock: 0,
    variants: null,
    vectorEmbedding: null,
    searchEmbedding: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/stock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Wire up mockCollection so that:
 *  - collection("products").doc(id).withConverter() → product doc ref
 *  - collection("products").withConverter().where().limit().get() → query chain
 *  - collection("stock").doc(id) → stock doc ref
 */
function setupCollectionMocks(
  productById: Record<string, unknown> | null = buildStoredProduct(),
  productBySku: Record<string, unknown> | null = buildStoredProduct(),
) {
  const fakeQueryChain = buildFakeQueryChain(productBySku);

  const productCollectionRef = {
    doc: mockProductDoc,
    withConverter: vi.fn().mockReturnValue({
      where: fakeQueryChain.where,
    }),
  };

  const stockCollectionRef = {
    doc: mockStockDoc,
  };

  mockCollection.mockImplementation((name: string) => {
    if (name === "products") return productCollectionRef;
    if (name === "stock") return stockCollectionRef;
    throw new Error(`Unexpected collection: ${name}`);
  });

  if (productById) {
    mockProductGet.mockResolvedValue({
      exists: true,
      data: () => productById,
    });
  } else {
    mockProductGet.mockResolvedValue({ exists: false });
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/stock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupCollectionMocks();
  });

  // ── Request validation ─────────────────────────────────────────────────────

  it("returns 400 when body is not valid JSON", async () => {
    const req = new Request("http://localhost/api/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.message).toContain("inválido");
  });

  it("returns 400 when neither productId nor sku is provided", async () => {
    const res = await POST(makeRequest({ quantity: 5 }));
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.errors).toBeDefined();
  });

  it("returns 400 when neither quantity nor variants is provided", async () => {
    const res = await POST(makeRequest({ productId: PRODUCT_ID }));
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.errors).toBeDefined();
  });

  it("returns 400 when both quantity and variants are provided", async () => {
    const res = await POST(
      makeRequest({
        productId: PRODUCT_ID,
        quantity: 5,
        variants: { var_001_p: 3, var_001_m: 2 },
      }),
    );
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.errors).toBeDefined();
  });

  it("returns 400 when variants map is empty", async () => {
    const res = await POST(
      makeRequest({ productId: PRODUCT_ID, variants: {} }),
    );
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.errors).toBeDefined();
  });

  it("returns 400 when quantity is negative", async () => {
    const res = await POST(makeRequest({ productId: PRODUCT_ID, quantity: -1 }));
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.errors).toBeDefined();
  });

  // ── Product lookup by productId ────────────────────────────────────────────

  it("returns 404 when product is not found by productId", async () => {
    setupCollectionMocks(null, null);
    const res = await POST(makeRequest({ productId: "nonexistent", quantity: 5 }));
    expect(res.status).toBe(404);
    const payload = await res.json();
    expect(payload.message).toContain("não encontrado");
  });

  it("returns 200 and sets stock for a simple product by productId", async () => {
    const res = await POST(makeRequest({ productId: PRODUCT_ID, quantity: 8 }));
    expect(res.status).toBe(200);
    const stock = await res.json();
    expect(stock.productId).toBe(PRODUCT_ID);
    expect(stock.quantity).toBe(8);
    expect(stock.hasVariants).toBe(false);
    expect(stock.variants).toBeNull();
    expect(mockStockSet).toHaveBeenCalledTimes(1);
    const [savedStock] = mockStockSet.mock.calls[0];
    expect(savedStock.quantity).toBe(8);
  });

  it("returns 200 and sets stock for a variable product by productId", async () => {
    const variants = { var_001_p: 3, var_001_m: 5 };
    const res = await POST(makeRequest({ productId: PRODUCT_ID, variants }));
    expect(res.status).toBe(200);
    const stock = await res.json();
    expect(stock.productId).toBe(PRODUCT_ID);
    expect(stock.hasVariants).toBe(true);
    expect(stock.quantity).toBe(8); // 3 + 5
    expect(stock.variants).toEqual(variants);
  });

  it("computes quantity as the sum of variant quantities", async () => {
    const variants = { var_p: 4, var_m: 7, var_gg: 1 };
    const res = await POST(makeRequest({ productId: PRODUCT_ID, variants }));
    expect(res.status).toBe(200);
    const stock = await res.json();
    expect(stock.quantity).toBe(12); // 4 + 7 + 1
  });

  // ── Product lookup by sku ──────────────────────────────────────────────────

  it("returns 404 when product is not found by sku", async () => {
    setupCollectionMocks(buildStoredProduct(), null);
    const res = await POST(makeRequest({ sku: "NONEXISTENT_SKU", quantity: 5 }));
    expect(res.status).toBe(404);
    const payload = await res.json();
    expect(payload.message).toContain("não encontrado");
  });

  it("returns 200 and sets stock when identified by sku", async () => {
    const res = await POST(makeRequest({ sku: PRODUCT_SKU, quantity: 10 }));
    expect(res.status).toBe(200);
    const stock = await res.json();
    expect(stock.productId).toBe(PRODUCT_ID);
    expect(stock.sku).toBe(PRODUCT_SKU);
    expect(stock.quantity).toBe(10);
  });

  it("sets stock with variants when identified by sku", async () => {
    const variants = { var_001_p: 3, var_001_m: 4 };
    const res = await POST(makeRequest({ sku: PRODUCT_SKU, variants }));
    expect(res.status).toBe(200);
    const stock = await res.json();
    expect(stock.productId).toBe(PRODUCT_ID);
    expect(stock.hasVariants).toBe(true);
    expect(stock.quantity).toBe(7); // 3 + 4
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  it("accepts quantity = 0 (out of stock)", async () => {
    const res = await POST(makeRequest({ productId: PRODUCT_ID, quantity: 0 }));
    expect(res.status).toBe(200);
    const stock = await res.json();
    expect(stock.quantity).toBe(0);
  });

  it("accepts all variant quantities = 0 (all variants out of stock)", async () => {
    const variants = { var_001_p: 0, var_001_m: 0 };
    const res = await POST(makeRequest({ productId: PRODUCT_ID, variants }));
    expect(res.status).toBe(200);
    const stock = await res.json();
    expect(stock.quantity).toBe(0);
    expect(stock.hasVariants).toBe(true);
  });

  it("uses productId over sku when both are provided", async () => {
    const res = await POST(
      makeRequest({ productId: PRODUCT_ID, sku: "SOME_OTHER_SKU", quantity: 5 }),
    );
    // Should resolve by productId, not sku
    expect(res.status).toBe(200);
    expect(mockProductDoc).toHaveBeenCalledWith(PRODUCT_ID);
  });

  it("writes the stock document to the correct Firestore path", async () => {
    await POST(makeRequest({ productId: PRODUCT_ID, quantity: 3 }));
    expect(mockStockDoc).toHaveBeenCalledWith(PRODUCT_ID);
    expect(mockStockSet).toHaveBeenCalledTimes(1);
  });
});
