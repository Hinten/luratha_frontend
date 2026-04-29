import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { firestoreCollections, type Product, validateProduct } from "@/src/schemas/firestore";
import { adminBucket, adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminProductConverter } from "@/src/lib/firestore/adminProductConverter";

type ImageVariantName = "card" | "mobile" | "tablet" | "desktop";

type ImageVariantDefinition = {
  name: ImageVariantName;
  width: number;
};

const IMAGE_VARIANTS: ImageVariantDefinition[] = [
  { name: "card", width: 400 },
  { name: "mobile", width: 480 },
  { name: "tablet", width: 768 },
  { name: "desktop", width: 1200 },
];

const WEBP_QUALITY = 82;
const ZOOM_WEBP_QUALITY = 88;
const ZOOM_WIDTH = 2000;
const ZOOM_MIN_WIDTH = 1500;
const ZOOM_MIN_HEIGHT = 1500;
const TEMP_LINK_EXPIRATION_MS = 15 * 60 * 1_000;

type ProductImageResolution = {
  width: number;
  height: number;
  storagePath: string;
  downloadUrl: string;
  temporaryUrl: string | null;
  format: "webp";
};

type ProductImageResolutionsMap = Record<ImageVariantName, ProductImageResolution> & {
  zoom?: ProductImageResolution;
};

type UploadProductImageInput = {
  productId: string;
  imageId?: string;
  alt?: string;
  fileBuffer: Buffer;
  fileName?: string;
  variantId?: string;
};

type UploadProductImageResult = {
  productId: string;
  imageAsset: Product["photoAssets"][number];
  photoAssets: Product["photoAssets"];
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

  const productRef = adminDb.collection(firestoreCollections.products).doc(input.productId).withConverter(adminProductConverter);
  const snapshot = await productRef.get();

  if (!snapshot.exists) {
    throw new ProductImageUploadError(`Product "${input.productId}" not found`, "not_found");
  }

  const currentProduct = snapshot.data()!;
  const uploadedVariants = await createAndUploadVariants(input.productId, imageId, input.fileBuffer);
  const imageAsset = {
    id: imageId,
    alt: input.alt?.trim() || null,
    resolutions: {
      card: uploadedVariants.card,
      ...(uploadedVariants.zoom ? { zoom: uploadedVariants.zoom } : {}),
      mobile: uploadedVariants.mobile,
      tablet: uploadedVariants.tablet,
      desktop: uploadedVariants.desktop,
    },
    createdAt: now,
    updatedAt: now,
  } satisfies Product["photoAssets"][number];

  const previousAssets = currentProduct.photoAssets.filter((asset) => asset.id !== imageId);
  const nextAssets = [...previousAssets, imageAsset];

  const variantId = input.variantId?.trim();
  const nextVariants = variantId
    ? currentProduct.variants?.map((variant) =>
        variant.id === variantId && !variant.photoIds.includes(imageId)
          ? { ...variant, photoIds: [...variant.photoIds, imageId] }
          : variant,
      ) ?? null
    : currentProduct.variants;

  if (variantId && currentProduct.variants && !currentProduct.variants.some((v) => v.id === variantId)) {
    throw new ProductImageUploadError(
      `Variant "${variantId}" not found in product "${input.productId}"`,
      "validation",
    );
  }

  const updatedProduct = validateProduct({
    ...currentProduct,
    photoAssets: nextAssets,
    variants: nextVariants,
    updatedAt: now,
  });

  await productRef.set(updatedProduct);

  return {
    productId: currentProduct.id,
    imageAsset,
    photoAssets: updatedProduct.photoAssets,
  };
}

async function createAndUploadVariants(
  productId: string,
  imageId: string,
  fileBuffer: Buffer,
): Promise<ProductImageResolutionsMap> {
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

  const requiredVariants = uploads.reduce(
    (accumulator, current) => {
      accumulator[current.name] = current.resolution;
      return accumulator;
    },
    {} as Record<ImageVariantName, ProductImageResolution>,
  );

  const zoomResolution = await createZoomVariant(productId, imageId, fileBuffer, sourceMetadata);
  return zoomResolution ? { ...requiredVariants, zoom: zoomResolution } : requiredVariants;
}

async function createZoomVariant(
  productId: string,
  imageId: string,
  fileBuffer: Buffer,
  sourceMetadata: sharp.Metadata,
): Promise<ProductImageResolution | undefined> {
  const sourceWidth = sourceMetadata.width ?? 0;
  const sourceHeight = sourceMetadata.height ?? 0;

  if (sourceWidth < ZOOM_MIN_WIDTH || sourceHeight < ZOOM_MIN_HEIGHT) {
    return undefined;
  }

  const transformed = await sharp(fileBuffer)
    .rotate()
    .resize({ width: ZOOM_WIDTH, fit: "inside", withoutEnlargement: true })
    .webp({ quality: ZOOM_WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const storagePath = `products/${productId}/${imageId}/zoom.webp`;
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

  const sourceAspectRatio = sourceWidth > 0 ? sourceHeight / sourceWidth : null;
  const outputWidth = transformed.info.width ?? Math.min(ZOOM_WIDTH, sourceWidth);
  const outputHeight = transformed.info.height
    ?? (sourceAspectRatio ? Math.max(1, Math.round(outputWidth * sourceAspectRatio)) : outputWidth);

  return {
    width: outputWidth,
    height: outputHeight,
    storagePath,
    downloadUrl: buildDownloadUrl(storagePath, downloadUrlToken),
    temporaryUrl: await buildTemporaryUrl(fileRef, storagePath, downloadUrlToken),
    format: "webp",
  };
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
