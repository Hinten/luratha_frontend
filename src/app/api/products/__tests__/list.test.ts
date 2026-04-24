import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "@/src/app/api/products/list";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockQueryGet, mockQueryRef, mockCollection } = vi.hoisted(() => {
  const mockQueryGet = vi.fn();
  const mockQueryRef = {
    withConverter: vi.fn(),
    orderBy: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    get: mockQueryGet,
  };
  // All chain methods return the same ref so `.orderBy(...).where(...).limit(...)` works
  mockQueryRef.withConverter.mockReturnValue(mockQueryRef);
  mockQueryRef.orderBy.mockReturnValue(mockQueryRef);
  mockQueryRef.where.mockReturnValue(mockQueryRef);
  mockQueryRef.limit.mockReturnValue(mockQueryRef);

  const mockCollection = vi.fn().mockReturnValue(mockQueryRef);
  return { mockQueryGet, mockQueryRef, mockCollection };
});

vi.mock("@/src/lib/firestore/firebaseAdmin", () => ({
  adminDb: { collection: mockCollection },
  adminApp: { options: { credential: undefined } },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRODUCT_ID = "test-product-id";
const now = "2026-04-23T00:00:00.000Z";

function buildStoredProduct(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: PRODUCT_ID,
    title: "Vestido de Linho Artesanal",
    description: "Vestido leve feito com linho natural de alta qualidade, perfeito para o verão.",
    slug: "vestido-de-linho-artesanal-vla-001-br",
    sku: "VLA-001-BR",
    status: "active",
    categoryId: "vestidos",
    price: {
      price: 250,
      currency: "BRL",
      salePrice: null,
      priceMin: null,
      priceMax: null,
      startDate: null,
      endDate: null,
    },
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

function makeListRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/products");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url.toString(), { method: "GET" });
}

describe("GET /api/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRef.withConverter.mockReturnValue(mockQueryRef);
    mockQueryRef.orderBy.mockReturnValue(mockQueryRef);
    mockQueryRef.where.mockReturnValue(mockQueryRef);
    mockQueryRef.limit.mockReturnValue(mockQueryRef);
    mockQueryGet.mockResolvedValue({ docs: [] });
  });

  it("returns 200 with an empty array when no products exist", async () => {
    const res = await GET(makeListRequest());
    expect(res.status).toBe(200);
    const products = await res.json();
    expect(products).toEqual([]);
  });

  it("returns 200 with an array of products", async () => {
    const stored = buildStoredProduct();
    mockQueryGet.mockResolvedValue({ docs: [{ data: () => stored }] });
    const res = await GET(makeListRequest());
    expect(res.status).toBe(200);
    const products = await res.json();
    expect(products).toHaveLength(1);
    expect(products[0].id).toBe(PRODUCT_ID);
  });

  it("applies status filter when status query param is provided", async () => {
    mockQueryGet.mockResolvedValue({ docs: [] });
    await GET(makeListRequest({ status: "archived" }));
    expect(mockQueryRef.where).toHaveBeenCalledWith("status", "==", "archived");
  });

  it("applies categoryId filter when categoryId query param is provided", async () => {
    mockQueryGet.mockResolvedValue({ docs: [] });
    await GET(makeListRequest({ categoryId: "vestidos" }));
    expect(mockQueryRef.where).toHaveBeenCalledWith("categoryId", "==", "vestidos");
  });

  it("applies both filters when both query params are provided", async () => {
    mockQueryGet.mockResolvedValue({ docs: [] });
    await GET(makeListRequest({ status: "active", categoryId: "vestidos" }));
    expect(mockQueryRef.where).toHaveBeenCalledWith("status", "==", "active");
    expect(mockQueryRef.where).toHaveBeenCalledWith("categoryId", "==", "vestidos");
  });

  it("applies default limit of 24 when no limit is specified", async () => {
    await GET(makeListRequest());
    expect(mockQueryRef.limit).toHaveBeenCalledWith(24);
  });

  it("applies custom limit from query param", async () => {
    await GET(makeListRequest({ limit: "10" }));
    expect(mockQueryRef.limit).toHaveBeenCalledWith(10);
  });

  it("caps limit at 100", async () => {
    await GET(makeListRequest({ limit: "9999" }));
    expect(mockQueryRef.limit).toHaveBeenCalledWith(100);
  });

  it("does not call where for status when no status param is provided", async () => {
    await GET(makeListRequest({ categoryId: "vestidos" }));
    expect(mockQueryRef.where).not.toHaveBeenCalledWith("status", expect.anything(), expect.anything());
  });
});
