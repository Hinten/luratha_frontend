import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { firestoreCollections, type Product, validateProduct } from "@/src/schemas/firestore";
import { adminBucket, adminDb } from "@/src/lib/firebaseAdmin";

type ImageVariantName = "mobile" | "tablet" | "desktop";

type ImageVariantDefinition = {
  name: ImageVariantName;
  width: number;
};

const IMAGE_VARIANTS: ImageVariantDefinition[] = [
  { name: "mobile", width: 480 },
  { name: "tablet", width: 768 },
  { name: "desktop", width: 1200 },
];

const WEBP_QUALITY = 82;
const TEMP_LINK_EXPIRATION_MS = 15 * 60 * 1_000;

type ProductImageResolution = {
  width: number;
  height: number;
  storagePath: string;
  downloadUrl: string;
  temporaryUrl: string | null;
  format: "webp";
};

type UploadProductImageInput = {
  productId: string;
  imageId?: string;
  alt?: string;
  fileBuffer: Buffer;
  fileName?: string;
};

type UploadProductImageResult = {
  productId: string;
  imageAsset: Product["photoAssets"][number];
  photoIds: string[];
};

export class ProductImageUploadError extends Error {
  readonly code: "not_found" | "validation" | "unknown";

  constructor(message: string, code: "not_found" | "validation" | "unknown") {
    super(message);
    this.name = "ProductImageUploadError";
    this.code = code;
  }
}

export async function uploadProductImage(input: UploadProductImageInput): Promise<UploadProductImageResult> {
  const imageId = input.imageId?.trim() || createImageId(input.fileName);
  const now = new Date().toISOString();

  if (!input.productId.trim()) {
    throw new ProductImageUploadError("productId is required", "validation");
  }

  const productRef = adminDb.collection(firestoreCollections.products).doc(input.productId);
  const snapshot = await productRef.get();

  if (!snapshot.exists) {
    throw new ProductImageUploadError(`Product "${input.productId}" not found`, "not_found");
  }

  const currentProduct = validateProduct(snapshot.data());
  const uploadedVariants = await createAndUploadVariants(input.productId, imageId, input.fileBuffer);
  const imageAsset = {
    id: imageId,
    alt: input.alt?.trim() || null,
    resolutions: {
      mobile: uploadedVariants.mobile,
      tablet: uploadedVariants.tablet,
      desktop: uploadedVariants.desktop,
    },
    createdAt: now,
    updatedAt: now,
  } satisfies Product["photoAssets"][number];

  const previousAssets = currentProduct.photoAssets.filter((asset) => asset.id !== imageId);
  const nextAssets = [...previousAssets, imageAsset];
  const nextPhotoIds = [
    ...currentProduct.photoIds.filter((url) => !previousAssets.some((asset) => asset.resolutions.desktop.downloadUrl === url)),
    ...nextAssets.map((asset) => asset.resolutions.desktop.downloadUrl),
  ];

  const updatedProduct = validateProduct({
    ...currentProduct,
    photoAssets: nextAssets,
    photoIds: nextPhotoIds,
    updatedAt: now,
  });

  await productRef.set(updatedProduct);

  return {
    productId: currentProduct.id,
    imageAsset,
    photoIds: updatedProduct.photoIds,
  };
}

async function createAndUploadVariants(
  productId: string,
  imageId: string,
  fileBuffer: Buffer,
): Promise<Record<ImageVariantName, ProductImageResolution>> {
  const sourceMetadata = await sharp(fileBuffer).metadata();
  const sourceAspectRatio =
    sourceMetadata.width && sourceMetadata.height ? sourceMetadata.height / sourceMetadata.width : null;

  const uploads = await Promise.all(
    IMAGE_VARIANTS.map(async ({ name, width }) => {
      const transformed = await sharp(fileBuffer)
        .rotate()
        .resize({ width, fit: "inside", withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });

      const storagePath = `products/${productId}/${imageId}/${name}.webp`;
      const downloadUrlToken = randomUUID();
      const fileRef = adminBucket.file(storagePath);

      await fileRef.save(transformed.data, {
        contentType: "image/webp",
        metadata: {
          cacheControl: "public, max-age=31536000, immutable",
          metadata: {
            firebaseStorageDownloadTokens: downloadUrlToken,
          },
        },
      });

      const outputWidth = transformed.info.width ?? width;
      const outputHeight =
        transformed.info.height ??
        (sourceAspectRatio ? Math.max(1, Math.round(outputWidth * sourceAspectRatio)) : outputWidth);

      return {
        name,
        resolution: {
          width: outputWidth,
          height: outputHeight,
          storagePath,
          downloadUrl: buildDownloadUrl(storagePath, downloadUrlToken),
          temporaryUrl: await buildTemporaryUrl(fileRef, storagePath, downloadUrlToken),
          format: "webp" as const,
        },
      };
    }),
  );

  return uploads.reduce(
    (accumulator, current) => {
      accumulator[current.name] = current.resolution;
      return accumulator;
    },
    {} as Record<ImageVariantName, ProductImageResolution>,
  );
}

async function buildTemporaryUrl(
  fileRef: ReturnType<typeof adminBucket.file>,
  storagePath: string,
  token: string,
): Promise<string | null> {
  try {
    const [url] = await fileRef.getSignedUrl({
      action: "read",
      expires: Date.now() + TEMP_LINK_EXPIRATION_MS,
      version: "v4",
    });
    return url;
  } catch {
    return buildDownloadUrl(storagePath, token);
  }
}

function buildDownloadUrl(storagePath: string, token: string): string {
  const encodedPath = encodeURIComponent(storagePath);
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST;
  const bucketName = adminBucket.name;
  const baseUrl = emulatorHost
    ? `http://${emulatorHost}/v0/b/${bucketName}/o`
    : `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o`;

  return `${baseUrl}/${encodedPath}?alt=media&token=${token}`;
}

function createImageId(fileName?: string): string {
  const normalizedName = fileName
    ?.toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return [normalizedName || "image", randomUUID().slice(0, 8)].join("-");
}
