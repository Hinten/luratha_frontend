import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { Category, Product, Stock } from "@luratha/schemas";
import { firestoreCollections } from "@luratha/schemas";
import {
  buildHomeSeedCategories,
  buildHomeSeedProducts,
  buildHomeSeedStock,
} from "@luratha/repositories/homeSeedMockData";
import { adminBucket, adminDb } from "@luratha/firestore/firebaseAdmin";
import { adminProductConverter } from "@luratha/firestore/adminProductConverter";
import { uploadProductImage } from "@luratha/repositories/productImageUpload";

const SEED_IMAGES_DIRECTORY = path.join(process.cwd(), "test-images");
const SUPPORTED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MIN_IMAGES_PER_PRODUCT = 3;

export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  console.log("[seed-mock-data] Iniciando seed de dados mock...");

  const categories = buildHomeSeedCategories();
  const products = buildHomeSeedProducts(categories);
  const stockItems = buildHomeSeedStock(products);

  console.log(`[seed-mock-data] Cadastrando ${categories.length} categorias...`);
  const categoriesCreated = await seedCategories(categories);
  console.log(`[seed-mock-data] Categorias criadas: ${categoriesCreated}`);

  console.log(`[seed-mock-data] Cadastrando ${products.length} produtos...`);
  const createdProductIds = await seedProducts(products);
  console.log(`[seed-mock-data] Produtos criados: ${createdProductIds.length}`);

  console.log(`[seed-mock-data] Cadastrando ${stockItems.length} itens de estoque...`);
  const stockCreated = await seedStock(stockItems);
  console.log(`[seed-mock-data] Itens de estoque criados: ${stockCreated}`);

  console.log(`[seed-mock-data] Fazendo upload de imagens para ${createdProductIds.length} produto(s)...`);
  const uploadedImages = await seedProductImages(products, createdProductIds);
  console.log(`[seed-mock-data] Imagens de produto enviadas: ${uploadedImages}`);

  console.log("[seed-mock-data] Fazendo upload de imagens de variante...");
  const variantImagesUploaded = await seedVariantImages(products, createdProductIds);
  console.log(`[seed-mock-data] Imagens de variante enviadas: ${variantImagesUploaded}`);

  console.log("[seed-mock-data] Seed concluído.");
  return NextResponse.json({
    message: "Dados mock cadastrados com sucesso.",
    categoriesCreated,
    productsCreated: createdProductIds.length,
    stockCreated,
    uploadedImages,
    variantImagesUploaded,
  });
}

export async function DELETE() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  console.log("[seed-mock-data] Iniciando deleção de dados mock...");

  const categories = buildHomeSeedCategories();
  const products = buildHomeSeedProducts(categories);

  console.log(`[seed-mock-data] Deletando ${categories.length} categorias...`);
  const categoriesDeleted = await deleteCategories(categories);
  console.log(`[seed-mock-data] Categorias deletadas: ${categoriesDeleted}`);

  console.log(`[seed-mock-data] Deletando ${products.length} produtos do Firestore...`);
  const productsDeleted = await deleteProducts(products);
  console.log(`[seed-mock-data] Produtos deletados: ${productsDeleted}`);

  console.log(`[seed-mock-data] Deletando ${products.length} itens de estoque...`);
  const stockDeleted = await deleteStock(products);
  console.log(`[seed-mock-data] Itens de estoque deletados: ${stockDeleted}`);

  console.log(`[seed-mock-data] Deletando arquivos do Storage para ${products.length} produto(s)...`);
  const storageFilesDeleted = await deleteProductStorageFiles(products);
  console.log(`[seed-mock-data] Arquivos do Storage deletados: ${storageFilesDeleted}`);

  console.log("[seed-mock-data] Deleção concluída.");
  return NextResponse.json({
    message: "Dados mock deletados com sucesso.",
    categoriesDeleted,
    productsDeleted,
    stockDeleted,
    storageFilesDeleted,
  });
}

// ── Seed helpers ──────────────────────────────────────────────────────────────

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

    console.log(
      `[seed-mock-data]   Upload de imagens: "${product.title}" (${index + 1}/${createdProductIds.length})...`,
    );
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

async function seedVariantImages(products: Product[], createdProductIds: string[]): Promise<number> {
  if (createdProductIds.length === 0) {
    return 0;
  }

  const imagePaths = await getSeedImagePaths();
  if (imagePaths.length === 0) {
    return 0;
  }

  const productById = new Map(products.map((product) => [product.id, product]));
  let uploaded = 0;
  let imagePoolOffset = 0;

  for (const productId of createdProductIds) {
    const product = productById.get(productId);
    if (!product?.variants) continue;

    const seenColors = new Set<string>();
    for (const variant of product.variants) {
      const variantColor = variant.color?.[0];
      if (!variantColor || seenColors.has(variantColor)) continue;
      seenColors.add(variantColor);

      console.log(`[seed-mock-data]   Upload variante "${variantColor}" de "${product.title}"...`);
      const imagePath = imagePaths[imagePoolOffset % imagePaths.length];
      imagePoolOffset += 1;

      const sameColorVariantIds = product.variants
        .filter((v) => v.color?.[0] === variantColor)
        .map((v) => v.id);

      const imageBuffer = await readFile(imagePath);
      await uploadProductImage({
        productId,
        variantIds: sameColorVariantIds,
        fileBuffer: imageBuffer,
        fileName: path.basename(imagePath),
        alt: `${product.title} — ${variantColor}`,
      });

      uploaded += 1;
    }
  }

  return uploaded;
}

// ── Delete helpers ────────────────────────────────────────────────────────────

async function deleteCategories(categories: Category[]): Promise<number> {
  const results = await Promise.all(
    categories.map(async (category) => {
      const categoryRef = adminDb.collection(firestoreCollections.categories).doc(category.id);
      const snapshot = await categoryRef.get();
      if (!snapshot.exists) return false;
      await categoryRef.delete();
      return true;
    }),
  );
  return results.filter(Boolean).length;
}

async function deleteProducts(products: Product[]): Promise<number> {
  const results = await Promise.all(
    products.map(async (product) => {
      const productRef = adminDb.collection(firestoreCollections.products).doc(product.id);
      const snapshot = await productRef.get();
      if (!snapshot.exists) return false;
      await productRef.delete();
      return true;
    }),
  );
  return results.filter(Boolean).length;
}

async function deleteStock(products: Product[]): Promise<number> {
  const results = await Promise.all(
    products.map(async (product) => {
      const stockRef = adminDb.collection(firestoreCollections.stock).doc(product.id);
      const snapshot = await stockRef.get();
      if (!snapshot.exists) return false;
      await stockRef.delete();
      return true;
    }),
  );
  return results.filter(Boolean).length;
}

async function deleteProductStorageFiles(products: Product[]): Promise<number> {
  let total = 0;
  for (const product of products) {
    const prefix = `products/${product.id}/`;
    const [files] = await adminBucket.getFiles({ prefix });
    if (files.length === 0) continue;
    console.log(`[seed-mock-data]   Deletando ${files.length} arquivo(s) do Storage: "${product.id}"...`);
    await Promise.all(files.map((file) => file.delete()));
    total += files.length;
  }
  return total;
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

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
