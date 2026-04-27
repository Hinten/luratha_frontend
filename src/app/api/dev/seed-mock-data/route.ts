import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { Category, Product } from "@/src/schemas/firestore";
import { firestoreCollections } from "@/src/schemas/firestore";
import {
  buildHomeSeedCategories,
  buildHomeSeedProducts,
  buildHomeSeedStock,
} from "@/src/lib/repositories/homeSeedMockData";
import { adminDb } from "@/src/lib/firestore/firebaseAdmin";
import { adminProductConverter } from "@/src/lib/firestore/adminProductConverter";
import { uploadProductImage } from "@/src/lib/repositories/productImageUpload";

const SEED_IMAGES_DIRECTORY = path.join(process.cwd(), "test-images");
const SUPPORTED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MIN_IMAGES_PER_PRODUCT = 3;

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const categories = buildHomeSeedCategories();
  const products = buildHomeSeedProducts(categories);
  const stockItems = buildHomeSeedStock(products);

  const categoriesCreated = await seedCategories(categories);
  const createdProductIds = await seedProducts(products);
  const stockCreated = await seedStock(stockItems);
  const uploadedImages = await seedProductImages(products, createdProductIds);

  return NextResponse.json({
    message: "Dados mock cadastrados com sucesso.",
    categoriesCreated,
    productsCreated: createdProductIds.length,
    stockCreated,
    uploadedImages,
  });
}

async function seedCategories(categories: Category[]): Promise<number> {
  const results = await Promise.all(
    categories.map(async (category) => {
      const categoryRef = adminDb.collection(firestoreCollections.categories).doc(category.id);
      const existingCategory = await categoryRef.get();
      if (existingCategory.exists) {
        return false;
      }

      await categoryRef.set(category);
      return true;
    }),
  );
  return results.filter(Boolean).length;
}

async function seedProducts(products: Product[]): Promise<string[]> {
  const results = await Promise.all(
    products.map(async (product) => {
      const productRef = adminDb
        .collection(firestoreCollections.products)
        .doc(product.id)
        .withConverter(adminProductConverter);
      const existingProduct = await productRef.get();
      if (existingProduct.exists) {
        return null;
      }

      await productRef.set(product);
      return product.id;
    }),
  );

  return results.filter((productId): productId is string => productId !== null);
}

async function seedStock(stocks: Stock[]): Promise<number> {
  const results = await Promise.all(
    stocks.map(async (stock) => {
      const stockRef = adminDb.collection(firestoreCollections.stock).doc(stock.productId);
      const existing = await stockRef.get();
      if (existing.exists) {
        return false;
      }

      await stockRef.set(stock);
      return true;
    }),
  );
  return results.filter(Boolean).length;
}

async function seedProductImages(products: Product[], createdProductIds: string[]): Promise<number> {
  if (createdProductIds.length === 0) {
    return 0;
  }

  const imagePaths = await getSeedImagePaths();
  if (imagePaths.length === 0) {
    return 0;
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  let uploadedImages = 0;

  for (const [index, productId] of createdProductIds.entries()) {
    const product = productById.get(productId);
    if (!product) {
      continue;
    }

    for (let imageOffset = 0; imageOffset < MIN_IMAGES_PER_PRODUCT; imageOffset += 1) {
      const imagePath = imagePaths[(index + imageOffset) % imagePaths.length];
      const imageBuffer = await readFile(imagePath);

      await uploadProductImage({
        productId,
        fileBuffer: imageBuffer,
        fileName: path.basename(imagePath),
        alt: `${product.title} — imagem seed ${imageOffset + 1}`,
      });

      uploadedImages += 1;
    }
  }

  return uploadedImages;
}

async function getSeedImagePaths(): Promise<string[]> {
  try {
    const imageDirectoryEntries = await readdir(SEED_IMAGES_DIRECTORY, { withFileTypes: true });
    return imageDirectoryEntries
      .filter((entry) => entry.isFile() && SUPPORTED_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => path.join(SEED_IMAGES_DIRECTORY, entry.name))
      .sort();
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      return [];
    }
    throw error;
  }
}

function isMissingDirectoryError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
