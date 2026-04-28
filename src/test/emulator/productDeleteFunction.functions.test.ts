/**
 * Emulator integration tests for the `onProductDeleted` Firebase Function.
 *
 * These tests verify that when a product document is deleted from Firestore,
 * the function automatically:
 *   1. Deletes the corresponding stock document from the "stock" collection.
 *   2. Deletes all storage files referenced in the product's photoAssets and
 *      lifeStylePhotos arrays.
 *
 * Run with: npm run test:functions
 *
 * The suite is skipped when the Functions emulator is not available.
 * Use `npm run emulator` (with firebase.json now including functions) or the
 * global setup in vitest.functions.config.mts to start all required emulators.
 */

import net from "node:net";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { adminDb, adminBucket } from "@/src/lib/firestore/firebaseAdmin";
import { buildMockProducts, buildMockStock } from "@/src/lib/repositories/productsMockData";
import { firestoreCollections } from "@/src/schemas/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// Skip when the Functions emulator is not available
// ─────────────────────────────────────────────────────────────────────────────

const functionsEmulatorReady = process.env.FUNCTIONS_EMULATOR_READY === "true";

if (!functionsEmulatorReady) {
  console.warn(
    `[productDeleteFunction.functions.test] skipped: ${
      process.env.FUNCTIONS_EMULATOR_REASON ?? "Functions emulator unavailable"
    }`,
  );
}

const describeWhenFunctions = functionsEmulatorReady ? describe : describe.skip;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const FUNCTION_SETTLE_TIMEOUT_MS = 12_000;
const POLL_INTERVAL_MS = 300;

/**
 * Polls until the Firestore document at `collection/docId` no longer exists,
 * or until `timeoutMs` elapses. Returns true when the document was deleted,
 * false on timeout.
 */
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isPortOpen(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const fail = (): void => {
      socket.destroy();
      resolve(false);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("timeout", fail);
    socket.once("error", fail);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

describeWhenFunctions("onProductDeleted (Functions Emulator)", () => {
  const [mockProduct] = buildMockProducts();
  const [mockStock] = buildMockStock();

  const testProductId = `fn_test_${mockProduct.id}`;
  const testStockId = testProductId; // stock doc ID == productId

  beforeEach(async () => {
    // Remove any leftover documents from previous test runs.
    await Promise.allSettled([
      adminDb.collection(firestoreCollections.products).doc(testProductId).delete(),
      adminDb.collection(firestoreCollections.stock).doc(testStockId).delete(),
    ]);
  });

  afterAll(async () => {
    await Promise.allSettled([
      adminDb.collection(firestoreCollections.products).doc(testProductId).delete(),
      adminDb.collection(firestoreCollections.stock).doc(testStockId).delete(),
    ]);
  });

  it("deletes the stock document when a product is deleted", async () => {
    const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";
    const [storageHostname, storagePortStr] = storageHost.split(":");
    const storageReachable = await isPortOpen(storageHostname, Number(storagePortStr), 500);
    if (!storageReachable) {
      console.warn("[onProductDeleted test] skipped: storage emulator not reachable");
      return;
    }

    // Seed product and its stock.
    await adminDb
      .collection(firestoreCollections.products)
      .doc(testProductId)
      .set({ ...mockProduct, id: testProductId });

    await adminDb
      .collection(firestoreCollections.stock)
      .doc(testStockId)
      .set({ ...mockStock, productId: testProductId });

    // Verify both documents exist before deletion.
    const stockBefore = await adminDb.collection(firestoreCollections.stock).doc(testStockId).get();
    expect(stockBefore.exists).toBe(true);

    // Delete the product — this triggers `onProductDeleted`.
    await adminDb.collection(firestoreCollections.products).doc(testProductId).delete();

    // Wait for the function to delete the stock document.
    const stockDeleted = await waitForDocumentDeletion(firestoreCollections.stock, testStockId);
    expect(stockDeleted).toBe(true);
  });

  it("handles product deletion when no stock document exists", async () => {
    // Seed only the product — no stock document.
    await adminDb
      .collection(firestoreCollections.products)
      .doc(testProductId)
      .set({ ...mockProduct, id: testProductId });

    // Delete the product — function should complete without error.
    await adminDb.collection(firestoreCollections.products).doc(testProductId).delete();

    // Wait for the function to settle, then confirm the product is deleted
    // and no stock document was accidentally created.
    await sleep(FUNCTION_SETTLE_TIMEOUT_MS / 2);

    const [productSnap, stockSnap] = await Promise.all([
      adminDb.collection(firestoreCollections.products).doc(testProductId).get(),
      adminDb.collection(firestoreCollections.stock).doc(testStockId).get(),
    ]);

    expect(productSnap.exists).toBe(false);
    expect(stockSnap.exists).toBe(false);
  });

  it("deletes storage files referenced in photoAssets when the product is deleted", async () => {
    const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";
    const [storageHostname, storagePortStr] = storageHost.split(":");
    const storageReachable = await isPortOpen(storageHostname, Number(storagePortStr), 500);
    if (!storageReachable) {
      console.warn("[onProductDeleted test] skipped: storage emulator not reachable");
      return;
    }

    // Upload a small placeholder file to storage.
    const storagePath = `products/${testProductId}/photo_fn_test/mobile.webp`;
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
            downloadUrl: `http://localhost/test-mobile.webp`,
            temporaryUrl: null,
            format: "webp",
          },
          tablet: null,
          desktop: null,
        },
        createdAt: now,
        updatedAt: now,
      },
    ];

    // Seed product with the photo asset.
    await adminDb
      .collection(firestoreCollections.products)
      .doc(testProductId)
      .set({ ...mockProduct, id: testProductId, photoAssets, lifeStylePhotos: [] });

    // Verify the file exists before deletion.
    const [existsBefore] = await adminBucket.file(storagePath).exists();
    expect(existsBefore).toBe(true);

    // Delete the product — function should clean up storage.
    await adminDb.collection(firestoreCollections.products).doc(testProductId).delete();

    // Poll until the storage file is deleted.
    const deadline = Date.now() + FUNCTION_SETTLE_TIMEOUT_MS;
    let fileDeleted = false;
    while (Date.now() < deadline) {
      const [exists] = await adminBucket.file(storagePath).exists();
      if (!exists) {
        fileDeleted = true;
        break;
      }
      await sleep(POLL_INTERVAL_MS);
    }

    expect(fileDeleted).toBe(true);
  });
});
