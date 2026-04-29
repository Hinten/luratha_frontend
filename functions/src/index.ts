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
  {
    document: "products/{productId}",
    database: "default",
  },
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
    const db = getFirestore("default");
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

  // Determine the storage bucket name.
  //
  // In a deployed Cloud Functions environment, `FIREBASE_CONFIG` is set by the
  // runtime and includes `storageBucket`, so `initializeApp()` (called without
  // arguments above) picks it up automatically and `getStorage().bucket()` works
  // fine with no explicit name.
  //
  // In the local Functions emulator the emulator may warn "Unable to fetch project
  // Admin SDK configuration", which means `FIREBASE_CONFIG.storageBucket` is
  // absent.  In that case `getStorage().bucket()` throws
  // "Bucket name not specified or invalid", the rejection is swallowed by
  // Promise.allSettled, and no files are deleted.
  //
  // We therefore resolve the bucket name explicitly:
  //   1. FIREBASE_STORAGE_BUCKET  – set by some environments
  //   2. storageBucket from FIREBASE_CONFIG  – standard production path
  //   3. {GCLOUD_PROJECT}.appspot.com  – reliable fallback; GCLOUD_PROJECT is
  //      always injected by the Functions runtime and the local emulator
  let bucketName: string | undefined;
  if (process.env.FIREBASE_STORAGE_BUCKET) {
    bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  } else {
    try {
      const cfg = JSON.parse(process.env.FIREBASE_CONFIG ?? "{}") as Record<string, unknown>;
      if (typeof cfg.storageBucket === "string" && cfg.storageBucket) {
        bucketName = cfg.storageBucket;
      }
    } catch {
      // Malformed FIREBASE_CONFIG — fall through to the GCLOUD_PROJECT fallback
    }
  }
  if (!bucketName) {
    const projectId = process.env.GCLOUD_PROJECT ?? process.env.PROJECT_ID;
    if (projectId) bucketName = `${projectId}.appspot.com`;
  }

  if (!bucketName) {
    throw new Error(
      `[onProductDeleted] Cannot determine storage bucket for product "${productId}". ` +
        "Set FIREBASE_STORAGE_BUCKET or ensure GCLOUD_PROJECT is available.",
    );
  }

  const bucket = getStorage().bucket(bucketName);

  await Promise.allSettled(
    storagePaths.map(async (storagePath) => {
      try {
        await bucket.file(storagePath).delete();
        console.log(`[onProductDeleted] Deleted storage file: "${storagePath}"`);
      } catch (error) {
        throw new Error(`[onProductDeleted] Could not delete storage file "${storagePath}": ${error}`);
      }
    }),
  );
}
