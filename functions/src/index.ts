import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";

if (getApps().length === 0) {
  initializeApp();
}

type PhotoResolution = {
  storagePath?: string | null;
};

type ImageAsset = {
  resolutions?: {
    mobile?: PhotoResolution | null;
    tablet?: PhotoResolution | null;
    desktop?: PhotoResolution | null;
  } | null;
};

type ProductData = {
  photoAssets?: ImageAsset[] | null;
  lifeStylePhotos?: ImageAsset[] | null;
};

/**
 * Triggered when a product document is deleted from Firestore.
 *
 * Performs best-effort cleanup:
 *  1. Deletes the corresponding stock document from the "stock" collection.
 *  2. Deletes all storage files referenced in the product's photoAssets and
 *     lifeStylePhotos arrays.
 *
 * Both operations are best-effort — a failure in one does not abort the other.
 */
export const onProductDeleted = onDocumentDeleted(
  "products/{productId}",
  async (event) => {
    const productId = event.params.productId;
    const productData = event.data?.data() as ProductData | undefined;

    console.log(`[onProductDeleted] Starting cleanup for product "${productId}"`);

    await Promise.allSettled([
      deleteStockForProduct(productId),
      productData ? deleteProductStorageFiles(productId, productData) : Promise.resolve(),
    ]);

    console.log(`[onProductDeleted] Cleanup complete for product "${productId}"`);
  },
);

async function deleteStockForProduct(productId: string): Promise<void> {
  try {
    const db = getFirestore();
    const stockRef = db.collection("stock").doc(productId);
    const stockSnap = await stockRef.get();

    if (stockSnap.exists) {
      await stockRef.delete();
      console.log(`[onProductDeleted] Deleted stock document for product "${productId}"`);
    } else {
      console.log(`[onProductDeleted] No stock document found for product "${productId}" — nothing to delete`);
    }
  } catch (error) {
    console.error(`[onProductDeleted] Error deleting stock for product "${productId}":`, error);
  }
}

async function deleteProductStorageFiles(productId: string, productData: ProductData): Promise<void> {
  const storagePaths: string[] = [];

  const photoAssets = productData.photoAssets ?? [];
  const lifeStylePhotos = productData.lifeStylePhotos ?? [];

  for (const asset of [...photoAssets, ...lifeStylePhotos]) {
    if (!asset?.resolutions) continue;
    for (const resolution of Object.values(asset.resolutions)) {
      if (resolution?.storagePath) {
        storagePaths.push(resolution.storagePath);
      }
    }
  }

  if (storagePaths.length === 0) {
    console.log(`[onProductDeleted] No storage files to delete for product "${productId}"`);
    return;
  }

  const bucket = getStorage().bucket();

  await Promise.allSettled(
    storagePaths.map(async (storagePath) => {
      try {
        await bucket.file(storagePath).delete();
        console.log(`[onProductDeleted] Deleted storage file: "${storagePath}"`);
      } catch (error) {
        console.warn(`[onProductDeleted] Could not delete storage file "${storagePath}":`, error);
      }
    }),
  );
}
