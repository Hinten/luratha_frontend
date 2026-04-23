import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/src/app/api/products/route";

// ── Hoisted mocks (vi.mock is hoisted; variables must be declared via vi.hoisted) ─
const { mockSet, mockGet, mockDoc, mockCollection, mockEmbed } = vi.hoisted(() => {
  const mockSet = vi.fn().mockResolvedValue(undefined);
  const mockGet = vi.fn().mockResolvedValue({ exists: false });
  const mockDoc = vi.fn().mockReturnValue({ get: mockGet, set: mockSet });
  const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
  const mockEmbed = vi.fn();
  return { mockSet, mockGet, mockDoc, mockCollection, mockEmbed };
});

vi.mock("@/src/lib/firestore/firebaseAdmin", () => ({
  adminDb: { collection: mockCollection },
}));

vi.mock("@/src/lib/embeddingService", () => ({
  createEmbeddingService: vi.fn(() => ({ embed: mockEmbed })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const now = "2026-04-23T00:00:00.000Z";

/** Minimum valid product body (server adds id / timestamps) */
function buildMinimalProductBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ exists: false });
    mockEmbed.mockRejectedValue(new Error("Vertex AI configuration is missing."));
  });

  it("returns 400 when body is not valid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json{",
      }),
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.message).toContain("inválido");
  });

  it("returns 400 when required fields are missing", async () => {
    const response = await POST(makeRequest({ title: "Only title" }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.message).toContain("inválidos");
    expect(payload.errors).toBeDefined();
  });

  it("returns 201 and creates product without photos (photoAssets defaults to [])", async () => {
    const body = buildMinimalProductBody();
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(201);
    const product = await response.json();
    expect(product.id).toBeDefined();
    expect(product.title).toBe("Vestido de Linho Artesanal");
    expect(product.photoAssets).toEqual([]);
    expect(product.lifeStylePhotos).toEqual([]);
    expect(product.vectorEmbedding).toBeNull();
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  it("returns 201 and creates product with photos", async () => {
    const photoAsset = {
      id: "photo-001",
      alt: "Foto frontal do vestido",
      resolutions: {
        mobile: {
          width: 480,
          height: 600,
          storagePath: "products/test/photo-001/mobile.webp",
          downloadUrl: "https://example.com/mobile.webp",
          format: "webp",
        },
        tablet: {
          width: 768,
          height: 960,
          storagePath: "products/test/photo-001/tablet.webp",
          downloadUrl: "https://example.com/tablet.webp",
          format: "webp",
        },
        desktop: {
          width: 1200,
          height: 1500,
          storagePath: "products/test/photo-001/desktop.webp",
          downloadUrl: "https://example.com/desktop.webp",
          format: "webp",
        },
      },
      createdAt: now,
      updatedAt: now,
    };

    const body = buildMinimalProductBody({ photoAssets: [photoAsset] });
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(201);
    const product = await response.json();
    expect(product.photoAssets).toHaveLength(1);
    expect(product.photoAssets[0].id).toBe("photo-001");
  });

  it("returns 201 and creates product without variants (variants defaults to null)", async () => {
    const body = buildMinimalProductBody();
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(201);
    const product = await response.json();
    expect(product.variants).toBeNull();
  });

  it("returns 201 and creates product with variants", async () => {
    const variants = [
      {
        sku: "VLA-001-BR-P",
        stock: 10,
        photoIds: ["photo-001"],
        active: true,
      },
      {
        sku: "VLA-001-BR-M",
        stock: 5,
        photoIds: ["photo-001"],
        active: true,
      },
    ];

    const body = buildMinimalProductBody({ variants });
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(201);
    const product = await response.json();
    expect(product.variants).toHaveLength(2);
    expect(product.variants[0].sku).toBe("VLA-001-BR-P");
  });

  it("returns 201 with embeddings when embedding service succeeds", async () => {
    const fakeEmbedding = Array.from({ length: 8 }, (_, i) => (i + 1) / 10);
    mockEmbed.mockResolvedValue(fakeEmbedding);

    const body = buildMinimalProductBody();
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(201);
    const product = await response.json();
    expect(product.vectorEmbedding).toEqual(fakeEmbedding);
    expect(product.searchEmbedding).toEqual(fakeEmbedding);
  });

  it("creates product without embeddings when embedding service fails", async () => {
    mockEmbed.mockRejectedValue(new Error("Vertex AI not available"));

    const body = buildMinimalProductBody();
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(201);
    const product = await response.json();
    expect(product.vectorEmbedding).toBeNull();
  });

  it("returns 409 when product with same id already exists", async () => {
    mockGet.mockResolvedValue({ exists: true });

    const body = buildMinimalProductBody();
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.message).toContain("já existe");
  });

  it("auto-generates id, createdAt, updatedAt regardless of client input", async () => {
    const body = buildMinimalProductBody({
      id: "client-provided-id",
      createdAt: "2000-01-01T00:00:00.000Z",
      updatedAt: "2000-01-01T00:00:00.000Z",
    });
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(201);
    const product = await response.json();
    // id overriding: server always generates a UUID, client value is ignored
    // (the server injects its own id over the provided one)
    expect(product.id).toBeTruthy();
    expect(product.createdAt).not.toBe("2000-01-01T00:00:00.000Z");
  });

  it("generates a slug from title and sku", async () => {
    const body = buildMinimalProductBody();
    const response = await POST(makeRequest(body));

    expect(response.status).toBe(201);
    const product = await response.json();
    expect(product.slug).toBe("vestido-de-linho-artesanal-vla-001-br");
  });
});
