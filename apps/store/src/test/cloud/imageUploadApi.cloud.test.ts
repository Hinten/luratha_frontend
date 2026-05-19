/**
 * Cloud integration tests for the image upload API endpoint.
 *
 * Run with: npm run test:firestore (cloud-backed)
 *
 * The suite is automatically skipped when cloud credentials are missing.
 * Verifies the full upload pipeline against real Firebase Storage:
 *   - Webp responsive variants are generated and stored.
 *   - The product document is updated with the asset references.
 *   - Storage files exist on disk.
 */

import path from "node:path";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { POST } from "@/src/app/api/images/upload/route";
import { adminBucket, adminDb } from "@luratha/firestore/firebaseAdmin";
import { buildMockProducts } from "@luratha/repositories/productsMockData";
import { firestoreCollections, validateProduct } from "@luratha/schemas";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { describeCloud, createCloudTestPrefix } from "@/src/test/cloud/sharedSetup";

describeCloud("POST /api/images/upload (Cloud Firebase)", () => {
  const prefix = createCloudTestPrefix();
  const [mockProduct] = buildMockProducts();
  // testProductId must stay ≤50 chars (product id schema limit).
  // prefix (~29 chars) + "_up" leaves enough room without embedding mockProduct.id.
  const testProductId = `${prefix}_up`;
  const testImagePath = path.join(process.cwd(), "test-images", "IMG_34562.png");

  beforeAll(async () => {
    await clearProductFiles(testProductId);
  });

  beforeEach(async () => {
    await clearProductFiles(testProductId);
    await adminDb.collection(firestoreCollections.products).doc(testProductId).set({
      ...mockProduct,
      id: testProductId,
      updatedAt: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await clearProductFiles(testProductId);
    await adminDb.collection(firestoreCollections.products).doc(testProductId).delete();
  });

  it("uploads image, generates webp responsive variants, and persists links on product", async () => {
    const imageBuffer = await readFile(testImagePath);
    const formData = new FormData();
    formData.append("productId", testProductId);
    formData.append("alt", "Imagem de teste para upload");
    formData.append("image", new File([imageBuffer], "IMG_34562.png", { type: "image/png" }));

    const response = await POST(
      new Request("http://localhost/api/images/upload", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.imageAsset.resolutions.mobile.storagePath).toContain("/mobile.webp");
    expect(payload.imageAsset.resolutions.tablet.storagePath).toContain("/tablet.webp");
    expect(payload.imageAsset.resolutions.desktop.storagePath).toContain("/desktop.webp");
    expect(payload.imageAsset.resolutions.desktop.downloadUrl).toContain("firebasestorage.googleapis.com");
    if (payload.imageAsset.resolutions.zoom) {
      expect(payload.imageAsset.resolutions.zoom.storagePath).toContain("/zoom.webp");
    }

    const updatedDoc = await adminDb
      .collection(firestoreCollections.products)
      .doc(testProductId)
      .withConverter(adminProductConverter)
      .get();
    const parsedProduct = validateProduct(updatedDoc.data());

    expect(parsedProduct.photoAssets).toHaveLength(1);
    expect(parsedProduct.photoAssets[0].resolutions.desktop.downloadUrl).toBeTruthy();

    const [mobileExists] = await adminBucket.file(payload.imageAsset.resolutions.mobile.storagePath).exists();
    const [tabletExists] = await adminBucket.file(payload.imageAsset.resolutions.tablet.storagePath).exists();
    const [desktopExists] = await adminBucket.file(payload.imageAsset.resolutions.desktop.storagePath).exists();

    expect(mobileExists).toBe(true);
    expect(tabletExists).toBe(true);
    expect(desktopExists).toBe(true);

    if (payload.imageAsset.resolutions.zoom) {
      const [zoomExists] = await adminBucket.file(payload.imageAsset.resolutions.zoom.storagePath).exists();
      expect(zoomExists).toBe(true);
    }
  });
});

async function clearProductFiles(productId: string): Promise<void> {
  const [files] = await adminBucket.getFiles({ prefix: `products/${productId}/` });
  await Promise.all(files.map((file) => file.delete().catch(() => undefined)));
}
