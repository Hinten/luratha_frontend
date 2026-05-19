import {
  execute,
  field,
} from "firebase/firestore/pipelines";
import { z } from "zod";
import { firestoreCollections, validateProduct, type Product } from "@luratha/schemas";
import { adminBucket, adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { searchDb } from "@/src/lib/firestore/firebaseSearchDb";

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
 *  1. Uses two Firestore Pipeline queries (via the client SDK pipeline API) to
 *     efficiently find only the products that reference the given imageId in
 *     their `photoAssets` or `lifeStylePhotos` arrays. Each query unnests the
 *     respective array, filters by asset id, and returns only the matching
 *     product ids — avoiding a full-collection scan.
 *  2. Fetches those specific product documents via the Admin SDK for updates.
 *  3. Deletes every storage file (variant) associated with the image.
 *  4. Removes the matching asset entry from every affected product and persists
 *     the change.
 *
 * Throws `ProductImageDeleteError` with code `"not_found"` when no product
 * references the given imageId.
 */
export async function deleteProductImage(imageId: string): Promise<DeleteProductImageResult> {
  if (!imageId.trim()) {
    throw new ProductImageDeleteError("imageId é obrigatório.", "validation");
  }

  // 1. Run two pipeline queries in parallel:
  //    - one unnesting photoAssets, filtered by asset.id == imageId
  //    - one unnesting lifeStylePhotos, filtered by asset.id == imageId
  //    Both queries return only the `id` field to minimise data transfer.
  //    Using the client-SDK pipeline (searchDb) because firebase-admin/firestore
  //    does not expose the pipeline API.
  const [photoSnap, lifeSnap] = await Promise.all([
    execute(
      searchDb
        .pipeline()
        .collection(firestoreCollections.products)
        .unnest(field("photoAssets").as("_pa"))
        .where(field("_pa.id").equal(imageId))
        .select("id"),
    ),
    execute(
      searchDb
        .pipeline()
        .collection(firestoreCollections.products)
        .unnest(field("lifeStylePhotos").as("_lp"))
        .where(field("_lp.id").equal(imageId))
        .select("id"),
    ),
  ]);

  // 2. Collect unique product IDs from both pipeline results.
  const productIdSet = new Set<string>(
    [
      ...photoSnap.results.map(
        (r) => ((r.data() as Record<string, unknown>).id as string | undefined) ?? r.id ?? "",
      ),
      ...lifeSnap.results.map(
        (r) => ((r.data() as Record<string, unknown>).id as string | undefined) ?? r.id ?? "",
      ),
    ].filter(Boolean),
  );

  if (productIdSet.size === 0) {
    throw new ProductImageDeleteError(
      `Imagem "${imageId}" não encontrada em nenhum produto.`,
      "not_found",
    );
  }

  // 3. Fetch the full product documents using the Admin SDK so we can update them.
  const productSnapshots = await Promise.all(
    Array.from(productIdSet).map((id) =>
      adminDb.collection(firestoreCollections.products).doc(id).get(),
    ),
  );

  const affectedProducts: Product[] = productSnapshots
    .filter((snap) => snap.exists)
    .map((snap) => {
      try {
        return validateProduct(snap.data());
      } catch (err) {
        if (err instanceof z.ZodError) {
          // Stored product doesn't match the schema (older write, manual edit).
          // Skip it for this image-cleanup pass; any other error propagates.
          return null;
        }
        throw err;
      }
    })
    .filter((p): p is Product => p !== null);

  // 4. Collect every storage path that belongs to this imageId across all products.
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

  // 5. Delete storage files (best-effort: when a file is already gone we skip
  // it, but any other failure — auth, network, etc. — is propagated so it
  // surfaces in logs instead of being silently swallowed).
  const deletedStorageFiles: string[] = [];
  await Promise.all(
    Array.from(storagePathsToDelete).map(async (storagePath) => {
      try {
        await adminBucket.file(storagePath).delete();
        deletedStorageFiles.push(storagePath);
      } catch (error) {
        if (isStorageNotFoundError(error)) {
          console.warn(`Storage file "${storagePath}" already gone — skipping.`);
          return;
        }
        throw error;
      }
    }),
  );

  // 6. Remove the asset from every affected product and persist.
  const now = new Date().toISOString();
  const updatedProductIds: string[] = [];

  await Promise.all(
    affectedProducts.map(async (product) => {
      const { slug: _slug, ...productWithoutSlug } = product as Record<string, unknown>;
      const updatedVariants = product.variants?.map((variant) => ({
        ...variant,
        photoIds: variant.photoIds.filter((photoId) => photoId !== imageId),
      })) ?? null;
      const updatedProduct = validateProduct({
        ...productWithoutSlug,
        photoAssets: product.photoAssets.filter((asset) => asset.id !== imageId),
        lifeStylePhotos: product.lifeStylePhotos.filter((asset) => asset.id !== imageId),
        variants: updatedVariants,
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

/**
 * @google-cloud/storage surfaces its `ApiError` class via a transitive export
 * only; rather than couple the repository to its internal path, narrow on the
 * documented shape (numeric `.code === 404`). Any other error must propagate.
 */
function isStorageNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 404
  );
}
