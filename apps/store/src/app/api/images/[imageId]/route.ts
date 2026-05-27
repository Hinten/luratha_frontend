import { NextResponse } from "next/server";
import {
  ProductImageDeleteError,
  deleteProductImage,
} from "@luratha/repositories/productImageDelete";
import { logger } from "@luratha/core/logging/logger";

export const runtime = "nodejs";

/**
 * DELETE /api/images/[imageId]
 *
 * Deletes all storage variants associated with the given imageId and removes the
 * asset entry from every product that references it (photoAssets / lifeStylePhotos).
 *
 * Returns 204 No Content on success.
 * Returns 404 when no product holds the given imageId.
 * Returns 500 on unexpected errors.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  const { imageId } = await params;

  try {
    await deleteProductImage(imageId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ProductImageDeleteError) {
      const status = error.code === "not_found" ? 404 : error.code === "validation" ? 400 : 500;
      return NextResponse.json({ message: error.message, code: error.code }, { status });
    }

    logger.error("[DELETE /api/images/:imageId] unexpected error", { imageId, error });
    return NextResponse.json(
      { message: "Falha ao excluir a imagem.", code: "unknown" },
      { status: 500 },
    );
  }
}
