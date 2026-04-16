import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/src/app/api/images/upload/route";
import {
  ProductImageUploadError,
  uploadProductImage,
} from "@/src/lib/repositories/productImageUpload";

vi.mock("@/src/lib/repositories/productImageUpload", () => ({
  ProductImageUploadError: class extends Error {
    code: "not_found" | "validation" | "unknown";

    constructor(message: string, code: "not_found" | "validation" | "unknown") {
      super(message);
      this.code = code;
    }
  },
  uploadProductImage: vi.fn(),
}));

describe("POST /api/images/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when productId is missing", async () => {
    const formData = new FormData();
    formData.append("image", new File(["fake"], "sample.jpg", { type: "image/jpeg" }));

    const response = await POST(new Request("http://localhost/api/images/upload", {
      method: "POST",
      body: formData,
    }));

    expect(response.status).toBe(400);
  });

  it("returns 201 with uploaded payload", async () => {
    vi.mocked(uploadProductImage).mockResolvedValue({
      productId: "prod_1",
      imageAsset: {
        id: "asset-1",
        alt: null,
        resolutions: {
          mobile: {
            width: 480,
            height: 600,
            storagePath: "products/prod_1/asset-1/mobile.webp",
            downloadUrl: "https://example.com/mobile.webp",
            temporaryUrl: null,
            format: "webp",
          },
          tablet: {
            width: 768,
            height: 960,
            storagePath: "products/prod_1/asset-1/tablet.webp",
            downloadUrl: "https://example.com/tablet.webp",
            temporaryUrl: null,
            format: "webp",
          },
          desktop: {
            width: 1200,
            height: 1500,
            storagePath: "products/prod_1/asset-1/desktop.webp",
            downloadUrl: "https://example.com/desktop.webp",
            temporaryUrl: "https://example.com/temp.webp",
            format: "webp",
          },
        },
        createdAt: "2026-04-16T00:00:00.000Z",
        updatedAt: "2026-04-16T00:00:00.000Z",
      },
      photoAssets: [],
    });

    const formData = new FormData();
    formData.append("productId", "prod_1");
    formData.append("image", new File(["fake"], "sample.jpg", { type: "image/jpeg" }));

    const response = await POST(new Request("http://localhost/api/images/upload", {
      method: "POST",
      body: formData,
    }));

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.productId).toBe("prod_1");
    expect(payload.imageAsset.resolutions.desktop.format).toBe("webp");
  });

  it("maps repository not_found to 404", async () => {
    vi.mocked(uploadProductImage).mockRejectedValue(
      new ProductImageUploadError("Product not found", "not_found"),
    );

    const formData = new FormData();
    formData.append("productId", "missing");
    formData.append("image", new File(["fake"], "sample.jpg", { type: "image/jpeg" }));

    const response = await POST(new Request("http://localhost/api/images/upload", {
      method: "POST",
      body: formData,
    }));

    expect(response.status).toBe(404);
  });

  it("accepts multiple files via images[] field", async () => {
    vi.mocked(uploadProductImage).mockResolvedValue({
      productId: "prod_1",
      imageAsset: {
        id: "asset-1",
        alt: null,
        resolutions: {
          mobile: {
            width: 480,
            height: 600,
            storagePath: "products/prod_1/asset-1/mobile.webp",
            downloadUrl: "https://example.com/mobile.webp",
            temporaryUrl: null,
            format: "webp",
          },
          tablet: {
            width: 768,
            height: 960,
            storagePath: "products/prod_1/asset-1/tablet.webp",
            downloadUrl: "https://example.com/tablet.webp",
            temporaryUrl: null,
            format: "webp",
          },
          desktop: {
            width: 1200,
            height: 1500,
            storagePath: "products/prod_1/asset-1/desktop.webp",
            downloadUrl: "https://example.com/desktop.webp",
            temporaryUrl: "https://example.com/temp.webp",
            format: "webp",
          },
        },
        createdAt: "2026-04-16T00:00:00.000Z",
        updatedAt: "2026-04-16T00:00:00.000Z",
      },
      photoAssets: [],
    });

    const formData = new FormData();
    formData.append("productId", "prod_1");
    formData.append("images", new File(["fake 1"], "sample-1.jpg", { type: "image/jpeg" }));
    formData.append("images", new File(["fake 2"], "sample-2.jpg", { type: "image/jpeg" }));

    const response = await POST(new Request("http://localhost/api/images/upload", {
      method: "POST",
      body: formData,
    }));

    expect(response.status).toBe(201);
    expect(uploadProductImage).toHaveBeenCalledTimes(2);
  });
});
