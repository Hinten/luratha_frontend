import { describe, expect, it, vi, beforeEach } from "vitest";
import { DELETE } from "@/src/app/api/images/[imageId]/route";
import {
  ProductImageDeleteError,
  deleteProductImage,
} from "@luratha/repositories/productImageDelete";

vi.mock("@luratha/repositories/productImageDelete", () => ({
  ProductImageDeleteError: class extends Error {
    code: "not_found" | "validation" | "unknown";

    constructor(message: string, code: "not_found" | "validation" | "unknown") {
      super(message);
      this.code = code;
    }
  },
  deleteProductImage: vi.fn(),
}));

const IMAGE_ID = "test-image-abc123";

function makeParams(imageId = IMAGE_ID): Promise<{ imageId: string }> {
  return Promise.resolve({ imageId });
}

describe("DELETE /api/images/[imageId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 204 on success", async () => {
    vi.mocked(deleteProductImage).mockResolvedValue({
      imageId: IMAGE_ID,
      deletedStorageFiles: [
        `products/prod_1/${IMAGE_ID}/mobile.webp`,
        `products/prod_1/${IMAGE_ID}/desktop.webp`,
      ],
      updatedProducts: ["prod_1"],
    });

    const response = await DELETE(
      new Request(`http://localhost/api/images/${IMAGE_ID}`, { method: "DELETE" }),
      { params: makeParams() },
    );

    expect(response.status).toBe(204);
    expect(deleteProductImage).toHaveBeenCalledWith(IMAGE_ID);
  });

  it("returns 204 with empty body", async () => {
    vi.mocked(deleteProductImage).mockResolvedValue({
      imageId: IMAGE_ID,
      deletedStorageFiles: [],
      updatedProducts: ["prod_1"],
    });

    const response = await DELETE(
      new Request(`http://localhost/api/images/${IMAGE_ID}`, { method: "DELETE" }),
      { params: makeParams() },
    );

    expect(response.status).toBe(204);
    const body = await response.text();
    expect(body).toBe("");
  });

  it("returns 404 when image is not found in any product", async () => {
    vi.mocked(deleteProductImage).mockRejectedValue(
      new ProductImageDeleteError(`Imagem "${IMAGE_ID}" não encontrada em nenhum produto.`, "not_found"),
    );

    const response = await DELETE(
      new Request(`http://localhost/api/images/${IMAGE_ID}`, { method: "DELETE" }),
      { params: makeParams() },
    );

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.code).toBe("not_found");
  });

  it("returns 500 on unexpected errors", async () => {
    vi.mocked(deleteProductImage).mockRejectedValue(new Error("Unexpected failure"));

    const response = await DELETE(
      new Request(`http://localhost/api/images/${IMAGE_ID}`, { method: "DELETE" }),
      { params: makeParams() },
    );

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.code).toBe("unknown");
  });

  it("calls deleteProductImage with the correct imageId", async () => {
    const customId = "my-custom-image-id";
    vi.mocked(deleteProductImage).mockResolvedValue({
      imageId: customId,
      deletedStorageFiles: [],
      updatedProducts: [],
    });

    await DELETE(
      new Request(`http://localhost/api/images/${customId}`, { method: "DELETE" }),
      { params: makeParams(customId) },
    );

    expect(deleteProductImage).toHaveBeenCalledWith(customId);
  });
});
