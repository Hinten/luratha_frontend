/**
 * Cloud integration tests for the `onProductDeleted` Firebase Function.
 *
 * These tests run against the deployed function in the dedicated test project
 * (`luratha-96386`). The CI workflow deploys the function before running the
 * suite (see .github/workflows/test.yml). For local runs, deploy manually:
 *
 *   firebase deploy --only functions --project luratha-96386
 *   npm run test:functions:cloud
 *
 * The suite is skipped when cloud credentials are missing.
 *
 * What is verified:
 *   1. Deleting a product also deletes its stock document.
 *   2. Deleting a product with no stock completes without errors.
 *   3. Deleting a product cleans up storage files referenced in photoAssets.
 */

import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { adminBucket, adminDb } from "@luratha/firestore/firebaseAdmin";
import { buildMockProducts, buildMockStock } from "@luratha/repositories/productsMockData";
import { firestoreCollections } from "@luratha/schemas";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";

const FUNCTION_SETTLE_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;

async function waitForDocumentDeletion(
  collectionName: string,
  docId: string,
  timeoutMs = FUNCTION_SETTLE_TIMEOUT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snap = await adminDb.collection(collectionName).doc(docId).get();
    if (!snap.exists) return true;
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

async function waitForFileDeletion(storagePath: string, timeoutMs = FUNCTION_SETTLE_TIMEOUT_MS): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [exists] = await adminBucket.file(storagePath).exists();
    if (!exists) return true;
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describeCloud("onProductDeleted (Cloud Functions)", () => {
  const prefix = createCloudTestPrefix();
  const [mockProduct] = buildMockProducts();
  const [mockStock] = buildMockStock();

  const stockOnlyProductId = `${prefix}_fn_stock`;
  const noStockProductId = `${prefix}_fn_nostock`;
  const photoProductId = `${prefix}_fn_photo`;
  const allTestIds = [stockOnlyProductId, noStockProductId, photoProductId];

  // Warm up the deployed function — first invocation may have a cold start.
  beforeAll(async () => {
    const warmupId = `${prefix}_fn_warmup`;
    await adminDb
      .collection(firestoreCollections.products)
      .doc(warmupId)
      .set({ id: warmupId, title: "Warmup", photoAssets: [], lifeStylePhotos: [] });
    await adminDb.collection(firestoreCollections.products).doc(warmupId).delete();
    await sleep(5_000);
  }, 90_000);

  beforeEach(async () => {
    await Promise.allSettled(
      allTestIds.flatMap((id) => [
        adminDb.collection(firestoreCollections.products).doc(id).delete(),
        adminDb.collection(firestoreCollections.stock).doc(id).delete(),
      ]),
    );
  });

  afterAll(async () => {
    await Promise.allSettled(
      allTestIds.flatMap((id) => [
        adminDb.collection(firestoreCollections.products).doc(id).delete(),
        adminDb.collection(firestoreCollections.stock).doc(id).delete(),
      ]),
    );
  });

  it("deletes the stock document when a product is deleted", async () => {
    await adminDb
      .collection(firestoreCollections.products)
      .doc(stockOnlyProductId)
      .set({ ...mockProduct, id: stockOnlyProductId });

    await adminDb
      .collection(firestoreCollections.stock)
      .doc(stockOnlyProductId)
      .set({ ...mockStock, productId: stockOnlyProductId });

    const stockBefore = await adminDb.collection(firestoreCollections.stock).doc(stockOnlyProductId).get();
    expect(stockBefore.exists).toBe(true);

    await adminDb.collection(firestoreCollections.products).doc(stockOnlyProductId).delete();

    const stockDeleted = await waitForDocumentDeletion(firestoreCollections.stock, stockOnlyProductId);
    expect(stockDeleted).toBe(true);
  });

  it("handles product deletion when no stock document exists", async () => {
    await adminDb
      .collection(firestoreCollections.products)
      .doc(noStockProductId)
      .set({ ...mockProduct, id: noStockProductId });

    await adminDb.collection(firestoreCollections.products).doc(noStockProductId).delete();

    // Give the function a moment to (incorrectly) act, then verify the absence
    // of any side effect.
    await sleep(10_000);

    const [productSnap, stockSnap] = await Promise.all([
      adminDb.collection(firestoreCollections.products).doc(noStockProductId).get(),
      adminDb.collection(firestoreCollections.stock).doc(noStockProductId).get(),
    ]);

    expect(productSnap.exists).toBe(false);
    expect(stockSnap.exists).toBe(false);
  });

  it("deletes storage files referenced in photoAssets when the product is deleted", async () => {
    const storagePath = `products/${photoProductId}/photo_fn_test/mobile.webp`;
    await adminBucket.file(storagePath).save(Buffer.from("test-image-data"), {
      contentType: "image/webp",
    });

    const now = new Date().toISOString();
    const photoAssets = [
      {
        id: "photo_fn_test",
        alt: "Test image",
        resolutions: {
          mobile: {
            width: 480,
            height: 600,
            storagePath,
            downloadUrl: `https://example.com/test-mobile.webp`,
            format: "webp",
          },
          tablet: null,
          desktop: null,
        },
        createdAt: now,
        updatedAt: now,
      },
    ];

    await adminDb
      .collection(firestoreCollections.products)
      .doc(photoProductId)
      .set({ ...mockProduct, id: photoProductId, photoAssets, lifeStylePhotos: [] });

    const [existsBefore] = await adminBucket.file(storagePath).exists();
    expect(existsBefore).toBe(true);

    await adminDb.collection(firestoreCollections.products).doc(photoProductId).delete();

    const fileDeleted = await waitForFileDeletion(storagePath);
    expect(fileDeleted).toBe(true);
  });
});
