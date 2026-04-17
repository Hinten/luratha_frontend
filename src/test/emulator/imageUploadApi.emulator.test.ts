import net from "node:net";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/src/app/api/images/upload/route";
import { adminBucket, adminDb } from "@/src/lib/firebaseAdmin";
import { buildMockProducts } from "@/src/lib/repositories/productsMockData";
import { firestoreCollections, validateProduct } from "@/src/schemas/firestore";

const firestoreReady = process.env.FIRESTORE_EMULATOR_READY === "true";
const describeWhenReady = firestoreReady ? describe : describe.skip;

const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199";
const [storageHostname, storagePortString] = storageHost.split(":");
const storagePort = Number(storagePortString);

describeWhenReady("POST /api/images/upload (emulator)", () => {
  const [mockProduct] = buildMockProducts();
  const testProductId = `${mockProduct.id}_upload`;
  const testImagePath = path.join(process.cwd(), "test-images", "IMG_34562.png");

  beforeEach(async () => {
    await clearProductFiles(testProductId);
    await adminDb.collection(firestoreCollections.products).doc(testProductId).set({
      ...mockProduct,
      id: testProductId,
      updatedAt: new Date().toISOString(),
    });
  });

  it("uploads image, generates webp responsive variants, and persists links on product", async () => {
    const storageReachable = await isPortOpen(storageHostname, storagePort, 500);
    if (!storageReachable) {
      return;
    }

    const imageBuffer = await readFile(testImagePath);
    const formData = new FormData();
    formData.append("productId", testProductId);
    formData.append("alt", "Imagem de teste para upload");
    formData.append("image", new File([imageBuffer], "IMG_34562.png", { type: "image/png" }));

    const response = await POST(new Request("http://localhost/api/images/upload", {
      method: "POST",
      body: formData,
    }));

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.imageAsset.resolutions.mobile.storagePath).toContain("/mobile.webp");
    expect(payload.imageAsset.resolutions.tablet.storagePath).toContain("/tablet.webp");
    expect(payload.imageAsset.resolutions.desktop.storagePath).toContain("/desktop.webp");
    expect(payload.imageAsset.resolutions.desktop.temporaryUrl).toBeTruthy();
    if (payload.imageAsset.resolutions.zoom) {
      expect(payload.imageAsset.resolutions.zoom.storagePath).toContain("/zoom.webp");
    }

    const updatedDoc = await adminDb.collection(firestoreCollections.products).doc(testProductId).get();
    const parsedProduct = validateProduct(updatedDoc.data());

    expect(parsedProduct.photoAssets).toHaveLength(1);
    expect(parsedProduct.photoAssets[0].resolutions.desktop.downloadUrl).toBeTruthy();
    if (parsedProduct.photoAssets[0].resolutions.zoom) {
      expect(parsedProduct.photoAssets[0].resolutions.zoom.downloadUrl).toBeTruthy();
    }

    const [mobileExists] = await adminBucket.file(payload.imageAsset.resolutions.mobile.storagePath).exists();
    const [tabletExists] = await adminBucket.file(payload.imageAsset.resolutions.tablet.storagePath).exists();
    const [desktopExists] = await adminBucket.file(payload.imageAsset.resolutions.desktop.storagePath).exists();
    const zoomExists = payload.imageAsset.resolutions.zoom
      ? (await adminBucket.file(payload.imageAsset.resolutions.zoom.storagePath).exists())[0]
      : null;

    expect(mobileExists).toBe(true);
    expect(tabletExists).toBe(true);
    expect(desktopExists).toBe(true);
    if (payload.imageAsset.resolutions.zoom) {
      expect(zoomExists).toBe(true);
    } else {
      expect(zoomExists).toBeNull();
    }
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
