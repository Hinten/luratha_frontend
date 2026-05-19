import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/src/app/api/dev/seed-mock-data/route";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const {
  mockCategoryGet,
  mockCategorySet,
  mockProductGet,
  mockProductSet,
  mockStockGet,
  mockStockSet,
  mockCollection,
  mockReaddir,
  mockReadFile,
  mockUploadProductImage,
} = vi.hoisted(() => {
  // Categories
  const mockCategorySet = vi.fn().mockResolvedValue(undefined);
  const mockCategoryGet = vi.fn().mockResolvedValue({ exists: false });
  const mockCategoryDocRef = { get: mockCategoryGet, set: mockCategorySet };
  const mockCategoryDoc = vi.fn().mockReturnValue(mockCategoryDocRef);

  // Products (with converter)
  const mockProductSet = vi.fn().mockResolvedValue(undefined);
  const mockProductGet = vi.fn().mockResolvedValue({ exists: false });
  const mockProductDocRef = {
    get: mockProductGet,
    set: mockProductSet,
    withConverter: vi.fn(),
  };
  mockProductDocRef.withConverter.mockReturnValue(mockProductDocRef);
  const mockProductDoc = vi.fn().mockReturnValue(mockProductDocRef);

  // Stock
  const mockStockSet = vi.fn().mockResolvedValue(undefined);
  const mockStockGet = vi.fn().mockResolvedValue({ exists: false });
  const mockStockDocRef = { get: mockStockGet, set: mockStockSet };
  const mockStockDoc = vi.fn().mockReturnValue(mockStockDocRef);

  // collection() dispatcher
  const mockCollection = vi.fn().mockImplementation((name: string) => {
    if (name === "categories") return { doc: mockCategoryDoc };
    if (name === "products") return { doc: mockProductDoc };
    if (name === "stock") return { doc: mockStockDoc };
    throw new Error(`Unexpected collection: ${name}`);
  });

  // fs/promises
  const mockReaddir = vi.fn().mockRejectedValue(
    Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" }),
  );
  const mockReadFile = vi.fn().mockResolvedValue(Buffer.from("fake-image-data"));

  // productImageUpload
  const mockUploadProductImage = vi.fn().mockResolvedValue(undefined);

  return {
    mockCategoryGet,
    mockCategorySet,
    mockProductGet,
    mockProductSet,
    mockStockGet,
    mockStockSet,
    mockCollection,
    mockReaddir,
    mockReadFile,
    mockUploadProductImage,
  };
});

vi.mock("@luratha/firestore/firebaseAdmin", () => ({
  adminDb: { collection: mockCollection },
  adminApp: { options: { credential: undefined } },
}));

vi.mock("node:fs/promises", () => ({
  default: { readdir: mockReaddir, readFile: mockReadFile },
  readdir: mockReaddir,
  readFile: mockReadFile,
}));

vi.mock("@/src/lib/repositories/productImageUpload", () => ({
  uploadProductImage: mockUploadProductImage,
}));

vi.mock("@/src/lib/repositories/homeSeedMockData", () => ({
  buildHomeSeedCategories: vi.fn().mockReturnValue([
    { id: "cat_seed_01", name: "Vestidos", slug: "vestidos" },
    { id: "cat_seed_02", name: "Blusas", slug: "blusas" },
  ]),
  buildHomeSeedProducts: vi.fn().mockReturnValue([
    {
      id: "prod_seed_01",
      title: "Vestido Midi",
      sku: "SKU_SEED_01",
      totalStock: 5,
      categoryId: "cat_seed_01",
    },
  ]),
  buildHomeSeedStock: vi.fn().mockReturnValue([
    {
      productId: "prod_seed_01",
      sku: "SKU_SEED_01",
      quantity: 5,
      hasVariants: false,
      variants: null,
      updatedAt: new Date().toISOString(),
    },
  ]),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/dev/seed-mock-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
    mockCategoryGet.mockResolvedValue({ exists: false });
    mockProductGet.mockResolvedValue({ exists: false });
    mockStockGet.mockResolvedValue({ exists: false });
    mockReaddir.mockRejectedValue(
      Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ── Environment guard ──────────────────────────────────────────────────────

  it("returns 404 when NODE_ENV is not development", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const res = await POST();
    expect(res.status).toBe(404);
    const payload = await res.json();
    expect(payload.message).toBe("Not found");
  });

  // ── Successful seeding ─────────────────────────────────────────────────────

  it("returns 200 with seeding summary when all data is new", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.message).toContain("sucesso");
    expect(payload.categoriesCreated).toBe(2);
    expect(payload.productsCreated).toBe(1);
    expect(payload.stockCreated).toBe(1);
    expect(payload.uploadedImages).toBe(0);
  });

  it("writes each new category to Firestore", async () => {
    await POST();
    expect(mockCategorySet).toHaveBeenCalledTimes(2);
  });

  it("writes each new product to Firestore", async () => {
    await POST();
    expect(mockProductSet).toHaveBeenCalledTimes(1);
  });

  it("writes each new stock document to Firestore", async () => {
    await POST();
    expect(mockStockSet).toHaveBeenCalledTimes(1);
    const [savedStock] = mockStockSet.mock.calls[0];
    expect(savedStock.productId).toBe("prod_seed_01");
    expect(savedStock.quantity).toBe(5);
    expect(savedStock.hasVariants).toBe(false);
    expect(savedStock.variants).toBeNull();
  });

  // ── Skip-existing logic ────────────────────────────────────────────────────

  it("skips categories that already exist in Firestore", async () => {
    mockCategoryGet.mockResolvedValue({ exists: true });

    const res = await POST();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.categoriesCreated).toBe(0);
    expect(mockCategorySet).not.toHaveBeenCalled();
  });

  it("skips products that already exist in Firestore", async () => {
    mockProductGet.mockResolvedValue({ exists: true });

    const res = await POST();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.productsCreated).toBe(0);
    expect(mockProductSet).not.toHaveBeenCalled();
  });

  it("skips stock documents that already exist in Firestore", async () => {
    mockStockGet.mockResolvedValue({ exists: true });

    const res = await POST();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.stockCreated).toBe(0);
    expect(mockStockSet).not.toHaveBeenCalled();
  });

  // ── Image seeding ──────────────────────────────────────────────────────────

  it("returns 0 uploadedImages when the image directory is missing", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.uploadedImages).toBe(0);
    expect(mockUploadProductImage).not.toHaveBeenCalled();
  });

  it("returns 0 uploadedImages when no new products were created", async () => {
    mockProductGet.mockResolvedValue({ exists: true });

    const res = await POST();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.uploadedImages).toBe(0);
    expect(mockUploadProductImage).not.toHaveBeenCalled();
  });

  it("uploads images for each newly created product when image directory exists", async () => {
    mockReaddir.mockResolvedValue([
      { isFile: () => true, name: "image1.jpg" },
      { isFile: () => true, name: "image2.jpg" },
      { isFile: () => true, name: "image3.jpg" },
    ]);

    const res = await POST();
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.uploadedImages).toBeGreaterThan(0);
    expect(mockUploadProductImage).toHaveBeenCalled();
  });
});
