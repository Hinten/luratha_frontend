import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { docStore, collectionMock } = vi.hoisted(() => {
  const sharedDocStore = new Map<string, unknown>();
  const sharedCollectionMock = vi.fn((collectionName: string) => ({
    doc: (id: string) => ({
      get: vi.fn(async () => ({ exists: sharedDocStore.has(`${collectionName}:${id}`) })),
      set: vi.fn(async (value: unknown) => {
        sharedDocStore.set(`${collectionName}:${id}`, value);
      }),
    }),
  }));

  return {
    docStore: sharedDocStore,
    collectionMock: sharedCollectionMock,
  };
});

const { readdirMock, readFileMock, uploadProductImageMock } = vi.hoisted(() => ({
  readdirMock: vi.fn(),
  readFileMock: vi.fn(),
  uploadProductImageMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readdir: readdirMock,
  readFile: readFileMock,
  default: {
    readdir: readdirMock,
    readFile: readFileMock,
  },
}));

vi.mock("@/src/lib/firebaseAdmin", () => ({
  adminDb: {
    collection: collectionMock,
  },
}));

vi.mock("@/src/lib/repositories/homeSeedMockData", () => ({
  buildHomeSeedCategories: () => [
    { id: "cat_1", name: "Vestidos", slug: "vestidos" },
    { id: "cat_2", name: "Blusas", slug: "blusas" },
  ],
  buildHomeSeedProducts: () => [
    {
      id: "prod_1",
      title: "Produto 1",
      slug: "produto-1",
      description: "Descrição 1",
      sku: "LURATHA_9001",
      status: "active",
      isPurchasable: true,
      brandName: "Luratha",
      categoryId: "cat_1",
      tags: [],
      materialTags: [],
      seasonalTags: [],
      price: { price: 100, priceMin: 100, priceMax: 120, currency: "BRL" },
      photoAssets: [],
      lifeStylePhotos: [],
      totalStock: 10,
      createdAt: "2026-04-15T00:00:00.000Z",
      updatedAt: "2026-04-15T00:00:00.000Z",
    },
  ],
}));

vi.mock("@/src/lib/repositories/productImageUpload", () => ({
  uploadProductImage: uploadProductImageMock,
}));

import { POST } from "@/src/app/api/dev/seed-mock-data/route";

describe("POST /api/dev/seed-mock-data", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    docStore.clear();
    collectionMock.mockClear();
    readdirMock.mockReset();
    readFileMock.mockReset();
    uploadProductImageMock.mockReset();
    readdirMock.mockResolvedValue([
      { isFile: () => true, name: "IMG_9532.jpg" },
      { isFile: () => true, name: "IMG_9481.jpg" },
    ]);
    readFileMock.mockResolvedValue(Buffer.from("image-binary"));
    uploadProductImageMock.mockResolvedValue({
      productId: "prod_1",
      imageAsset: {},
      photoAssets: [],
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns 404 outside development mode", async () => {
    process.env.NODE_ENV = "production";

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.message).toBe("Not found");
    expect(uploadProductImageMock).not.toHaveBeenCalled();
  });

  it("seeds categories and products in development mode", async () => {
    process.env.NODE_ENV = "development";

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.categoriesCreated).toBe(2);
    expect(payload.productsCreated).toBe(1);
    expect(payload.uploadedImages).toBe(1);
    expect(uploadProductImageMock).toHaveBeenCalledTimes(1);
    expect(uploadProductImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prod_1",
        fileBuffer: expect.any(Buffer),
        fileName: "IMG_9481.jpg",
        alt: "Produto 1 — imagem seed",
      }),
    );
  });

  it("ignores non-image files and directories when seeding uploads", async () => {
    process.env.NODE_ENV = "development";
    readdirMock.mockResolvedValueOnce([
      { isFile: () => false, name: "nested-folder" },
      { isFile: () => true, name: "README.md" },
      { isFile: () => true, name: "IMG_34562.png" },
    ]);

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.uploadedImages).toBe(1);
    expect(uploadProductImageMock).toHaveBeenCalledTimes(1);
    expect(uploadProductImageMock).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "IMG_34562.png" }),
    );
  });

  it("returns success without uploads when test-images directory does not exist", async () => {
    process.env.NODE_ENV = "development";
    const enoentError = Object.assign(new Error("missing"), { code: "ENOENT" });
    readdirMock.mockRejectedValueOnce(enoentError);

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.productsCreated).toBe(1);
    expect(payload.uploadedImages).toBe(0);
    expect(uploadProductImageMock).not.toHaveBeenCalled();
  });
});
