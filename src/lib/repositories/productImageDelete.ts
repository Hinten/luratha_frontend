import { firestoreCollections, validateProduct } from "@/src/schemas/firestore";
import { adminBucket, adminDb } from "@/src/lib/firestore/firebaseAdmin";

export type DeleteProductImageResult = {
  imageId: string;
  deletedStorageFiles: string[];
  updatedProducts: string[];
};

export class ProductImageDeleteError extends Error {
  readonly code: "not_found" | "validation" | "unknown";

  constructor(message: string, code: "not_found" | "validation" | "unknown") {
    super(message);
    this.name = "ProductImageDeleteError";
    this.code = code;
  }
}

/**
 * Deletes a product image asset by its imageId.
 *
 * Steps:
 *  1. Scans all products to find those that reference the given imageId in
 *     `photoAssets` or `lifeStylePhotos`.
 *  2. Deletes every storage file (variant) associated with the image.
 *  3. Removes the matching asset entry from every affected product and persists
 *     the change.
 *
 * Throws `ProductImageDeleteError` with code `"not_found"` when no product
 * references the given imageId.
 */
export async function deleteProductImage(imageId: string): Promise<DeleteProductImageResult> {
  if (!imageId.trim()) {
    throw new ProductImageDeleteError("imageId é obrigatório.", "validation");
  }

  // 1. Find every product that contains this imageId in photoAssets or lifeStylePhotos.
  //    Firestore does not support querying by a nested field inside an array, so we
  //    fetch all products and filter in memory.  For a fashion-store catalogue this
  //    is acceptable; a dedicated index would be the optimisation path for larger data sets.
  const snapshot = await adminDb.collection(firestoreCollections.products).get();

  const affectedProducts = snapshot.docs
    .map((doc) => {
      try {
        return validateProduct(doc.data());
      } catch {
        return null;
      }
    })
    .filter((product) => product !== null)
    .filter(
      (product) =>
        product.photoAssets.some((asset) => asset.id === imageId) ||
        product.lifeStylePhotos.some((asset) => asset.id === imageId),
    );

  if (affectedProducts.length === 0) {
    throw new ProductImageDeleteError(
      `Imagem "${imageId}" não encontrada em nenhum produto.`,
      "not_found",
    );
  }

  // 2. Collect every storage path that belongs to this imageId across all products.
  const storagePathsToDelete = new Set<string>();
  for (const product of affectedProducts) {
    for (const collection of [product.photoAssets, product.lifeStylePhotos]) {
      for (const asset of collection) {
        if (asset.id !== imageId) continue;
        for (const resolution of Object.values(asset.resolutions)) {
          if (resolution?.storagePath) {
            storagePathsToDelete.add(resolution.storagePath);
          }
        }
      }
    }
  }

  // 3. Delete storage files (best-effort – we continue even when a file is missing).
  const deletedStorageFiles: string[] = [];
  await Promise.all(
    Array.from(storagePathsToDelete).map(async (storagePath) => {
      try {
        await adminBucket.file(storagePath).delete();
        deletedStorageFiles.push(storagePath);
      } catch {
        // The file may have been removed manually; do not fail the whole operation.
      }
    }),
  );

  // 4. Remove the asset from every affected product and persist.
  const now = new Date().toISOString();
  const updatedProductIds: string[] = [];

  await Promise.all(
    affectedProducts.map(async (product) => {
      const { slug: _slug, ...productWithoutSlug } = product as Record<string, unknown>;
      const updatedProduct = validateProduct({
        ...productWithoutSlug,
        photoAssets: product.photoAssets.filter((asset) => asset.id !== imageId),
        lifeStylePhotos: product.lifeStylePhotos.filter((asset) => asset.id !== imageId),
        updatedAt: now,
      });

      await adminDb
        .collection(firestoreCollections.products)
        .doc(product.id)
        .set(updatedProduct);

      updatedProductIds.push(product.id);
    }),
  );

  return {
    imageId,
    deletedStorageFiles,
    updatedProducts: updatedProductIds,
  };
}
