import net from "node:net";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/src/app/api/images/upload/route";
import { DELETE } from "@/src/app/api/images/[imageId]/route";
import { adminBucket, adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { buildMockProducts } from "@/src/lib/repositories/productsMockData";
import { firestoreCollections, validateProduct } from "@/src/schemas/firestore";

const firestoreReady = process.env.FIRESTORE_EMULATOR_READY === "true";
const describeWhenReady = firestoreReady ? describe : describe.skip;

const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";
const [storageHostname, storagePortString] = storageHost.split(":");
const storagePort = Number(storagePortString);

const testImagePath = path.join(process.cwd(), "test-images", "IMG_34562.png");

describeWhenReady("DELETE /api/images/[imageId] (emulator)", () => {
  const [mockProduct] = buildMockProducts();

  const testProductId = `${mockProduct.id}_delete_test`;

  beforeEach(async () => {
    await clearProductFiles(testProductId);
    await adminDb.collection(firestoreCollections.products).doc(testProductId).set({
      ...mockProduct,
      id: testProductId,
      photoAssets: [],
      lifeStylePhotos: [],
      updatedAt: new Date().toISOString(),
    });
  });

  it("deletes image storage files and removes asset from product photoAssets", async () => {
    const storageReachable = await isPortOpen(storageHostname, storagePort, 500);
    if (!storageReachable) {
      return;
    }

    const imageBuffer = await readFile(testImagePath);
    const formData = new FormData();
    formData.append("productId", testProductId);
    formData.append("alt", "Imagem de teste para delete");
    formData.append("image", new File([imageBuffer], "IMG_34562.png", { type: "image/png" }));

    const uploadResponse = await POST(
      new Request("http://localhost/api/images/upload", { method: "POST", body: formData }),
    );
    expect(uploadResponse.status).toBe(201);
    const uploadPayload = await uploadResponse.json();
    const imageId: string = uploadPayload.imageAsset.id;

    // Confirm the asset is present on the product before deletion.
    const beforeDoc = await adminDb.collection(firestoreCollections.products).doc(testProductId).get();
    const beforeProduct = validateProduct(beforeDoc.data());
    expect(beforeProduct.photoAssets.some((a) => a.id === imageId)).toBe(true);

    // Execute deletion.
    const deleteResponse = await DELETE(
      new Request(`http://localhost/api/images/${imageId}`, { method: "DELETE" }),
      { params: Promise.resolve({ imageId }) },
    );
    expect(deleteResponse.status).toBe(204);

    // Asset should be removed from the product.
    const afterDoc = await adminDb.collection(firestoreCollections.products).doc(testProductId).get();
    const afterProduct = validateProduct(afterDoc.data());
    expect(afterProduct.photoAssets.some((a) => a.id === imageId)).toBe(false);

    // Storage files should be deleted.
    const [mobileExists] = await adminBucket
      .file(uploadPayload.imageAsset.resolutions.mobile.storagePath)
      .exists();
    const [desktopExists] = await adminBucket
      .file(uploadPayload.imageAsset.resolutions.desktop.storagePath)
      .exists();
    expect(mobileExists).toBe(false);
    expect(desktopExists).toBe(false);
  });

  it("deletes image referenced in lifeStylePhotos", async () => {
    const storageReachable = await isPortOpen(storageHostname, storagePort, 500);
    if (!storageReachable) {
      return;
    }

    const imageBuffer = await readFile(testImagePath);
    const formData = new FormData();
    formData.append("productId", testProductId);
    formData.append("image", new File([imageBuffer], "lifestyle.png", { type: "image/png" }));

    const uploadResponse = await POST(
      new Request("http://localhost/api/images/upload", { method: "POST", body: formData }),
    );
    expect(uploadResponse.status).toBe(201);
    const uploadPayload = await uploadResponse.json();
    const imageId: string = uploadPayload.imageAsset.id;

    // Manually move the asset from photoAssets to lifeStylePhotos.
    const snapBefore = await adminDb.collection(firestoreCollections.products).doc(testProductId).get();
    const productBefore = validateProduct(snapBefore.data());
    const asset = productBefore.photoAssets.find((a) => a.id === imageId)!;

    await adminDb.collection(firestoreCollections.products).doc(testProductId).set({
      ...productBefore,
      photoAssets: productBefore.photoAssets.filter((a) => a.id !== imageId),
      lifeStylePhotos: [asset],
    });

    // Execute deletion.
    const deleteResponse = await DELETE(
      new Request(`http://localhost/api/images/${imageId}`, { method: "DELETE" }),
      { params: Promise.resolve({ imageId }) },
    );
    expect(deleteResponse.status).toBe(204);

    // Asset should be removed from lifeStylePhotos.
    const afterDoc = await adminDb.collection(firestoreCollections.products).doc(testProductId).get();
    const afterProduct = validateProduct(afterDoc.data());
    expect(afterProduct.lifeStylePhotos.some((a) => a.id === imageId)).toBe(false);
  });

  it("returns 404 when imageId is not found in any product", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/images/nonexistent-image-id", { method: "DELETE" }),
      { params: Promise.resolve({ imageId: "nonexistent-image-id" }) },
    );

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.code).toBe("not_found");
  });

  it("removes imageId from multiple products when the same imageId is shared", async () => {
    const secondProductId = `${mockProduct.id}_delete_second`;
    const now = new Date().toISOString();
    const sharedImageId = "shared-img-abc";

    const sharedAsset = {
      id: sharedImageId,
      alt: null,
      resolutions: {
        mobile: {
          width: 480,
          height: 600,
          storagePath: `products/${testProductId}/${sharedImageId}/mobile.webp`,
          downloadUrl: `http://localhost/v0/b/test/o/mobile.webp?alt=media&token=x`,
          temporaryUrl: null,
          format: "webp",
        },
        tablet: {
          width: 768,
          height: 960,
          storagePath: `products/${testProductId}/${sharedImageId}/tablet.webp`,
          downloadUrl: `http://localhost/v0/b/test/o/tablet.webp?alt=media&token=x`,
          temporaryUrl: null,
          format: "webp",
        },
        desktop: {
          width: 1200,
          height: 1500,
          storagePath: `products/${testProductId}/${sharedImageId}/desktop.webp`,
          downloadUrl: `http://localhost/v0/b/test/o/desktop.webp?alt=media&token=x`,
          temporaryUrl: null,
          format: "webp",
        },
      },
      createdAt: now,
      updatedAt: now,
    };

    // Seed the shared asset into two products.
    const [prodWithSlug] = buildMockProducts();
    await adminDb.collection(firestoreCollections.products).doc(testProductId).set({
      ...mockProduct,
      id: testProductId,
      photoAssets: [sharedAsset],
      lifeStylePhotos: [],
      updatedAt: now,
    });
    await adminDb.collection(firestoreCollections.products).doc(secondProductId).set({
      ...prodWithSlug,
      id: secondProductId,
      sku: `${prodWithSlug.sku}_2`,
      photoAssets: [sharedAsset],
      lifeStylePhotos: [],
      updatedAt: now,
    });

    const deleteResponse = await DELETE(
      new Request(`http://localhost/api/images/${sharedImageId}`, { method: "DELETE" }),
      { params: Promise.resolve({ imageId: sharedImageId }) },
    );
    expect(deleteResponse.status).toBe(204);

    const [snap1, snap2] = await Promise.all([
      adminDb.collection(firestoreCollections.products).doc(testProductId).get(),
      adminDb.collection(firestoreCollections.products).doc(secondProductId).get(),
    ]);
    const prod1 = validateProduct(snap1.data());
    const prod2 = validateProduct(snap2.data());

    expect(prod1.photoAssets.some((a) => a.id === sharedImageId)).toBe(false);
    expect(prod2.photoAssets.some((a) => a.id === sharedImageId)).toBe(false);

    // Cleanup second product.
    await adminDb.collection(firestoreCollections.products).doc(secondProductId).delete();
  });
});

async function clearProductFiles(productId: string): Promise<void> {
  const [files] = await adminBucket.getFiles({ prefix: `products/${productId}/` });
  await Promise.all(files.map((file) => file.delete().catch(() => undefined)));
}

async function isPortOpen(hostname: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: hostname, port });
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
