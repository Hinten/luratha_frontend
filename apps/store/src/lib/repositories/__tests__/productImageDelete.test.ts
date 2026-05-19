import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  deleteProductImage,
  ProductImageDeleteError,
} from "@/src/lib/repositories/productImageDelete";
import { validateProduct } from "@luratha/schemas";

// ─────────────────────────────────────────────────────────────────────────────
// Hoisted mocks
// ─────────────────────────────────────────────────────────────────────────────

const {
  mockAdminGet,
  mockAdminSet,
  mockAdminCollection,
  mockStorageDelete,
  mockBucketFile,
  mockExecute,
  mockPipelineRef,
} = vi.hoisted(() => {
  const mockAdminGet = vi.fn();
  const mockAdminSet = vi.fn().mockResolvedValue(undefined);
  const mockDocRef = { get: mockAdminGet, set: mockAdminSet };
  const mockAdminDoc = vi.fn().mockReturnValue(mockDocRef);
  const mockAdminCollection = vi.fn().mockReturnValue({ doc: mockAdminDoc });

  const mockStorageDelete = vi.fn().mockResolvedValue(undefined);
  const mockBucketFile = vi.fn().mockReturnValue({ delete: mockStorageDelete });

  const mockExecute = vi.fn();
  const mockPipelineRef = {
    collection: vi.fn(),
    unnest: vi.fn(),
    where: vi.fn(),
    select: vi.fn(),
  };
  mockPipelineRef.collection.mockReturnValue(mockPipelineRef);
  mockPipelineRef.unnest.mockReturnValue(mockPipelineRef);
  mockPipelineRef.where.mockReturnValue(mockPipelineRef);
  mockPipelineRef.select.mockReturnValue(mockPipelineRef);

  return {
    mockAdminGet,
    mockAdminSet,
    mockAdminDoc,
    mockAdminCollection,
    mockStorageDelete,
    mockBucketFile,
    mockExecute,
    mockPipelineRef,
  };
});

vi.mock("@/src/lib/firestore/firebaseAdmin", () => ({
  adminDb: { collection: mockAdminCollection },
  adminBucket: { file: mockBucketFile },
}));

vi.mock("@/src/lib/firestore/firebaseSearchDb", () => ({
  searchDb: { pipeline: vi.fn(() => mockPipelineRef) },
}));

vi.mock("firebase/firestore/pipelines", () => ({
  execute: mockExecute,
  field: vi.fn((name: string) => ({
    as: vi.fn((alias: string) => ({ _field: name, _alias: alias })),
    equal: vi.fn((val: unknown) => ({ _eq: { field: name, val } })),
  })),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const IMAGE_ID = "img-abc-123";
const PRODUCT_ID = "prod-xyz-001";
const now = "2024-01-01T00:00:00.000Z";

function buildStoredProduct(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return validateProduct({
    id: PRODUCT_ID,
    title: "Vestido Linho",
    description: "Vestido de linho.",
    sku: "VLA-001-BR",
    status: "active",
    isPurchasable: true,
    brandName: "Luratha",
    categoryId: "vestidos",
    tags: [],
    materialTags: [],
    seasonalTags: [],
    price: { price: 250, currency: "BRL" },
    totalStock: 5,
    photoAssets: [
      {
        id: IMAGE_ID,
        alt: null,
        resolutions: {
          mobile: { width: 480, height: 600, storagePath: `products/${PRODUCT_ID}/${IMAGE_ID}/mobile.webp`, downloadUrl: "https://ex.com/mobile.webp", format: "webp" },
          tablet: { width: 768, height: 960, storagePath: `products/${PRODUCT_ID}/${IMAGE_ID}/tablet.webp`, downloadUrl: "https://ex.com/tablet.webp", format: "webp" },
          desktop: { width: 1200, height: 1500, storagePath: `products/${PRODUCT_ID}/${IMAGE_ID}/desktop.webp`, downloadUrl: "https://ex.com/desktop.webp", format: "webp" },
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    lifeStylePhotos: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("deleteProductImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset pipeline chain after clearAllMocks
    mockPipelineRef.collection.mockReturnValue(mockPipelineRef);
    mockPipelineRef.unnest.mockReturnValue(mockPipelineRef);
    mockPipelineRef.where.mockReturnValue(mockPipelineRef);
    mockPipelineRef.select.mockReturnValue(mockPipelineRef);

    // Default: pipeline returns empty results (no products found)
    mockExecute.mockResolvedValue({ results: [] });

    // Default: adminDb get resolves with not-found
    mockAdminGet.mockResolvedValue({ exists: false });

    // Reset storage mock (some tests override with a rejection — without
    // resetting, the rejection persists across tests).
    mockStorageDelete.mockResolvedValue(undefined);
  });

  it("throws validation error when imageId is empty", async () => {
    await expect(deleteProductImage("  ")).rejects.toMatchObject({
      code: "validation",
    });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("throws not_found when pipeline returns no results", async () => {
    mockExecute.mockResolvedValue({ results: [] });

    await expect(deleteProductImage(IMAGE_ID)).rejects.toMatchObject({
      code: "not_found",
    });

    // Both pipeline queries (photoAssets + lifeStylePhotos) must run
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("uses pipeline to find products and updates only affected ones", async () => {
    // Pipeline: first query (photoAssets) finds the product
    mockExecute
      .mockResolvedValueOnce({ results: [{ id: PRODUCT_ID, data: () => ({ id: PRODUCT_ID }) }] })
      .mockResolvedValueOnce({ results: [] }); // lifeStylePhotos: none

    // Admin fetch returns the stored product
    mockAdminGet.mockResolvedValue({
      exists: true,
      data: () => buildStoredProduct(),
    });

    const result = await deleteProductImage(IMAGE_ID);

    expect(result.imageId).toBe(IMAGE_ID);
    expect(result.updatedProducts).toContain(PRODUCT_ID);

    // AdminDb set was called once (to update the product)
    expect(mockAdminSet).toHaveBeenCalledTimes(1);
    const savedProduct = mockAdminSet.mock.calls[0][0] as Record<string, unknown>;
    expect((savedProduct.photoAssets as unknown[]).length).toBe(0);
  });

  it("deduplicates product IDs when the same product appears in both pipeline results", async () => {
    // Both pipeline queries (photoAssets and lifeStylePhotos) return the same product
    const result1 = { id: PRODUCT_ID, data: () => ({ id: PRODUCT_ID }) };
    mockExecute
      .mockResolvedValueOnce({ results: [result1] })
      .mockResolvedValueOnce({ results: [result1] });

    const storedProduct = buildStoredProduct({
      photoAssets: [],
      lifeStylePhotos: [
        {
          id: IMAGE_ID,
          alt: null,
          resolutions: {
            mobile: { width: 480, height: 600, storagePath: `products/${PRODUCT_ID}/${IMAGE_ID}/mobile.webp`, downloadUrl: "https://ex.com/mobile.webp", format: "webp" },
            tablet: { width: 768, height: 960, storagePath: `products/${PRODUCT_ID}/${IMAGE_ID}/tablet.webp`, downloadUrl: "https://ex.com/tablet.webp", format: "webp" },
            desktop: { width: 1200, height: 1500, storagePath: `products/${PRODUCT_ID}/${IMAGE_ID}/desktop.webp`, downloadUrl: "https://ex.com/desktop.webp", format: "webp" },
          },
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    mockAdminGet.mockResolvedValue({ exists: true, data: () => storedProduct });

    const result = await deleteProductImage(IMAGE_ID);

    // The product should appear only once in updatedProducts
    expect(result.updatedProducts).toEqual([PRODUCT_ID]);
    // And adminDb.set called only once
    expect(mockAdminSet).toHaveBeenCalledTimes(1);
  });

  it("deletes the storage files for every resolution", async () => {
    mockExecute
      .mockResolvedValueOnce({ results: [{ id: PRODUCT_ID, data: () => ({ id: PRODUCT_ID }) }] })
      .mockResolvedValueOnce({ results: [] });

    mockAdminGet.mockResolvedValue({
      exists: true,
      data: () => buildStoredProduct(),
    });

    await deleteProductImage(IMAGE_ID);

    // Should have tried to delete 3 storage files (mobile, tablet, desktop)
    expect(mockBucketFile).toHaveBeenCalledWith(`products/${PRODUCT_ID}/${IMAGE_ID}/mobile.webp`);
    expect(mockBucketFile).toHaveBeenCalledWith(`products/${PRODUCT_ID}/${IMAGE_ID}/tablet.webp`);
    expect(mockBucketFile).toHaveBeenCalledWith(`products/${PRODUCT_ID}/${IMAGE_ID}/desktop.webp`);
  });

  it("continues when storage file deletion returns 404 (file already gone)", async () => {
    mockExecute
      .mockResolvedValueOnce({ results: [{ id: PRODUCT_ID, data: () => ({ id: PRODUCT_ID }) }] })
      .mockResolvedValueOnce({ results: [] });

    mockAdminGet.mockResolvedValue({
      exists: true,
      data: () => buildStoredProduct(),
    });

    // @google-cloud/storage surfaces "object not found" as an ApiError with
    // numeric `code: 404`. Mirror that shape; the repository must treat it as
    // a best-effort no-op.
    const notFoundError = Object.assign(new Error("Not Found"), { code: 404 });
    mockStorageDelete.mockRejectedValue(notFoundError);

    const result = await deleteProductImage(IMAGE_ID);
    expect(result.deletedStorageFiles).toEqual([]);
    expect(result.updatedProducts).toContain(PRODUCT_ID);
  });

  it("propagates unexpected storage errors instead of silently swallowing them", async () => {
    mockExecute
      .mockResolvedValueOnce({ results: [{ id: PRODUCT_ID, data: () => ({ id: PRODUCT_ID }) }] })
      .mockResolvedValueOnce({ results: [] });

    mockAdminGet.mockResolvedValue({
      exists: true,
      data: () => buildStoredProduct(),
    });

    mockStorageDelete.mockRejectedValue(new Error("Storage unavailable"));

    await expect(deleteProductImage(IMAGE_ID)).rejects.toThrow("Storage unavailable");
  });

  it("removes imageId from lifeStylePhotos when found there", async () => {
    mockExecute
      .mockResolvedValueOnce({ results: [] }) // photoAssets: not found
      .mockResolvedValueOnce({ results: [{ id: PRODUCT_ID, data: () => ({ id: PRODUCT_ID }) }] }); // lifeStylePhotos: found

    const storedProduct = buildStoredProduct({
      photoAssets: [],
      lifeStylePhotos: [
        {
          id: IMAGE_ID,
          alt: null,
          resolutions: {
            mobile: { width: 480, height: 600, storagePath: `products/${PRODUCT_ID}/${IMAGE_ID}/mobile.webp`, downloadUrl: "https://ex.com/mobile.webp", format: "webp" },
            tablet: { width: 768, height: 960, storagePath: `products/${PRODUCT_ID}/${IMAGE_ID}/tablet.webp`, downloadUrl: "https://ex.com/tablet.webp", format: "webp" },
            desktop: { width: 1200, height: 1500, storagePath: `products/${PRODUCT_ID}/${IMAGE_ID}/desktop.webp`, downloadUrl: "https://ex.com/desktop.webp", format: "webp" },
          },
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    mockAdminGet.mockResolvedValue({ exists: true, data: () => storedProduct });

    const result = await deleteProductImage(IMAGE_ID);

    expect(result.updatedProducts).toContain(PRODUCT_ID);
    const saved = mockAdminSet.mock.calls[0][0] as Record<string, unknown>;
    expect((saved.lifeStylePhotos as unknown[]).length).toBe(0);
  });

  it("throws ProductImageDeleteError when pipeline finds nothing", async () => {
    mockExecute.mockResolvedValue({ results: [] });

    const error = await deleteProductImage(IMAGE_ID).catch((e) => e);

    expect(error).toBeInstanceOf(ProductImageDeleteError);
    expect(error.code).toBe("not_found");
  });
});
