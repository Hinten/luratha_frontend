import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "@/src/app/api/products/[id]/get";
import { PUT } from "@/src/app/api/products/[id]/put";
import { PATCH } from "@/src/app/api/products/[id]/patch";
import { DELETE } from "@/src/app/api/products/[id]/delete";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockSet, mockGet, mockDelete, mockDoc, mockCollection, mockEmbed } = vi.hoisted(() => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn();
  const mockDocRef = {
    get: mockGet,
    set: mockSet,
    delete: mockDelete,
    withConverter: vi.fn(),
  };
  mockDocRef.withConverter.mockReturnValue(mockDocRef);
  const mockDoc = vi.fn().mockReturnValue(mockDocRef);
  const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
  const mockEmbed = vi.fn();
  return { mockSet, mockGet, mockDelete, mockDoc, mockCollection, mockEmbed };
});

vi.mock("@luratha/firestore/firebaseAdmin", () => ({
  adminDb: { collection: mockCollection },
  adminApp: { options: { credential: undefined } },
}));

vi.mock("@luratha/core/embeddingService", () => ({
  createEmbeddingService: vi.fn(() => ({ embed: mockEmbed })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRODUCT_ID = "test-product-id";

const now = "2026-04-23T00:00:00.000Z";

/** A minimal valid stored product (as returned by .data() after converter).
 *  Fields match what productSchema.parse() would produce for a minimal input. */
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

/** Minimum valid product body for a full PUT */
function buildPutBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: "Vestido de Linho Artesanal",
    description: "Vestido leve feito com linho natural de alta qualidade, perfeito para o verão.",
    sku: "VLA-001-BR",
    status: "active",
    categoryId: "vestidos",
    price: { price: 250, currency: "BRL" },
    ...overrides,
  };
}

function makeRequest(method: "PUT" | "PATCH" | "DELETE", body?: unknown): Request {
  return new Request(`http://localhost/api/products/${PRODUCT_ID}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeParams(id = PRODUCT_ID) {
  return { params: Promise.resolve({ id }) };
}

// ── GET tests ─────────────────────────────────────────────────────────────────

describe("GET /api/products/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when product does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });
    const res = await GET(new Request(`http://localhost/api/products/${PRODUCT_ID}`), makeParams());
    expect(res.status).toBe(404);
    const payload = await res.json();
    expect(payload.message).toContain("não encontrado");
  });

  it("returns 200 with the product when it exists", async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => buildStoredProduct() });
    const res = await GET(new Request(`http://localhost/api/products/${PRODUCT_ID}`), makeParams());
    expect(res.status).toBe(200);
    const product = await res.json();
    expect(product.id).toBe(PRODUCT_ID);
    expect(product.title).toBe("Vestido de Linho Artesanal");
  });

  it("passes the correct id to the Firestore doc reference", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => buildStoredProduct({ id: "custom-id" }),
    });
    await GET(new Request("http://localhost/api/products/custom-id"), makeParams("custom-id"));
    expect(mockDoc).toHaveBeenCalledWith("custom-id");
  });
});

// ── PUT tests ─────────────────────────────────────────────────────────────────

describe("PUT /api/products/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ exists: true, data: () => buildStoredProduct() });
    mockEmbed.mockRejectedValue(new Error("Vertex AI configuration is missing."));
  });

  it("returns 400 when body is not valid JSON", async () => {
    const req = new Request(`http://localhost/api/products/${PRODUCT_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "not-json{",
    });
    const res = await PUT(req, makeParams());
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.message).toContain("inválido");
  });

  it("returns 404 when product does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });
    const res = await PUT(makeRequest("PUT", buildPutBody()), makeParams());
    expect(res.status).toBe(404);
    const payload = await res.json();
    expect(payload.message).toContain("não encontrado");
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await PUT(makeRequest("PUT", { title: "Only title" }), makeParams());
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.errors).toBeDefined();
  });

  it("returns 200 and fully replaces the product", async () => {
    const res = await PUT(makeRequest("PUT", buildPutBody({ title: "Novo Título" })), makeParams());
    expect(res.status).toBe(200);
    const product = await res.json();
    expect(product.id).toBe(PRODUCT_ID);
    expect(product.title).toBe("Novo Título");
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("preserves createdAt from the existing document", async () => {
    const oldCreatedAt = "2020-01-01T00:00:00.000Z";
    mockGet.mockResolvedValue({
      exists: true,
      data: () => buildStoredProduct({ createdAt: oldCreatedAt }),
    });
    const res = await PUT(makeRequest("PUT", buildPutBody()), makeParams());
    expect(res.status).toBe(200);
    const product = await res.json();
    expect(product.createdAt).toBe(oldCreatedAt);
  });

  it("ignores id in the body and uses the URL param", async () => {
    const res = await PUT(makeRequest("PUT", buildPutBody({ id: "some-other-id" })), makeParams());
    expect(res.status).toBe(200);
    const product = await res.json();
    expect(product.id).toBe(PRODUCT_ID);
  });

  it("includes embeddings in the stored product when embedding succeeds", async () => {
    const fakeEmbedding = Array.from({ length: 8 }, (_, i) => (i + 1) / 10);
    mockEmbed.mockResolvedValue(fakeEmbedding);
    const res = await PUT(makeRequest("PUT", buildPutBody()), makeParams());
    expect(res.status).toBe(200);
    const product = await res.json();
    expect(product.vectorEmbedding).toEqual(fakeEmbedding);
    expect(product.searchEmbedding).toEqual(fakeEmbedding);
  });
});

// ── PATCH tests ───────────────────────────────────────────────────────────────

describe("PATCH /api/products/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ exists: true, data: () => buildStoredProduct() });
    mockEmbed.mockRejectedValue(new Error("Vertex AI configuration is missing."));
  });

  it("returns 400 when body is not valid JSON", async () => {
    const req = new Request(`http://localhost/api/products/${PRODUCT_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json{",
    });
    const res = await PATCH(req, makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 404 when product does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });
    const res = await PATCH(makeRequest("PATCH", { status: "archived" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 200 and updates only the provided field", async () => {
    const res = await PATCH(makeRequest("PATCH", { status: "archived" }), makeParams());
    expect(res.status).toBe(200);
    const product = await res.json();
    expect(product.status).toBe("archived");
    expect(product.title).toBe("Vestido de Linho Artesanal");
  });

  it("sets a nullable field to null when explicitly passed as null", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => buildStoredProduct({ ratingAverage: 4.5 }),
    });
    const res = await PATCH(makeRequest("PATCH", { ratingAverage: null }), makeParams());
    expect(res.status).toBe(200);
    const product = await res.json();
    expect(product.ratingAverage).toBeNull();
  });

  it("does not update a field that is absent from the payload", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => buildStoredProduct({ ratingAverage: 4.5 }),
    });
    const res = await PATCH(makeRequest("PATCH", { status: "archived" }), makeParams());
    expect(res.status).toBe(200);
    const product = await res.json();
    expect(product.ratingAverage).toBe(4.5);
  });

  it("regenerates embeddings when title is in the payload", async () => {
    const fakeEmbedding = Array.from({ length: 8 }, (_, i) => (i + 1) / 10);
    mockEmbed.mockResolvedValue(fakeEmbedding);
    const res = await PATCH(makeRequest("PATCH", { title: "Novo Título Alterado" }), makeParams());
    expect(res.status).toBe(200);
    const product = await res.json();
    expect(product.vectorEmbedding).toEqual(fakeEmbedding);
  });

  it("does not call embed when title and description are absent from the payload", async () => {
    mockEmbed.mockResolvedValue([0.1, 0.2]);
    const res = await PATCH(makeRequest("PATCH", { status: "archived" }), makeParams());
    expect(res.status).toBe(200);
    expect(mockEmbed).not.toHaveBeenCalled();
  });

  it("preserves id and createdAt from the existing document", async () => {
    const oldCreatedAt = "2020-01-01T00:00:00.000Z";
    mockGet.mockResolvedValue({
      exists: true,
      data: () => buildStoredProduct({ createdAt: oldCreatedAt }),
    });
    const res = await PATCH(
      makeRequest("PATCH", { id: "attacker-id", createdAt: "2000-01-01T00:00:00.000Z" }),
      makeParams(),
    );
    expect(res.status).toBe(200);
    const product = await res.json();
    expect(product.id).toBe(PRODUCT_ID);
    expect(product.createdAt).toBe(oldCreatedAt);
  });
});

// ── DELETE tests ──────────────────────────────────────────────────────────────

describe("DELETE /api/products/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ exists: true });
  });

  it("returns 404 when product does not exist", async () => {
    mockGet.mockResolvedValue({ exists: false });
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(404);
    const payload = await res.json();
    expect(payload.message).toContain("não encontrado");
  });

  it("returns 204 and deletes the product", async () => {
    const res = await DELETE(makeRequest("DELETE"), makeParams());
    expect(res.status).toBe(204);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("passes the correct product id to the Firestore doc reference", async () => {
    await DELETE(makeRequest("DELETE"), makeParams("custom-id-123"));
    expect(mockDoc).toHaveBeenCalledWith("custom-id-123");
  });
});
